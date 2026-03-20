"""Otterwise MCP Python REPL Server.

Provides persistent Python execution via IPython with notebook integration.
Communicates over stdio using the MCP protocol (FastMCP).
"""

from __future__ import annotations

import base64
import io
import json
import signal
import sys
import subprocess
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from typing import Any

import nbformat
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# FastMCP server instance
# ---------------------------------------------------------------------------

mcp = FastMCP("otterwise-python-repl")

# ---------------------------------------------------------------------------
# Lazy IPython kernel singleton
# ---------------------------------------------------------------------------

_shell = None


def _get_shell():
    """Return (or create) the persistent IPython InteractiveShell."""
    global _shell
    if _shell is None:
        from IPython.core.interactiveshell import InteractiveShell

        _shell = InteractiveShell.instance()
        # Disable any interactive prompts
        _shell.colors = "NoColor"
        # Pre-configure matplotlib for non-interactive backend
        _shell.run_cell("import matplotlib; matplotlib.use('Agg')", silent=True)
    return _shell


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

WHITELISTED_PACKAGES = frozenset(
    {
        "pandas",
        "numpy",
        "scipy",
        "statsmodels",
        "scikit-learn",
        "matplotlib",
        "seaborn",
    }
)


class _Timeout:
    """Context manager that raises TimeoutError after *seconds* on Unix.

    On Windows (where SIGALRM is unavailable) this is a no-op -- the caller
    should handle the missing alarm gracefully.
    """

    def __init__(self, seconds: int):
        self.seconds = seconds
        self._has_alarm = hasattr(signal, "SIGALRM")

    def __enter__(self):
        if self._has_alarm:
            self._old_handler = signal.signal(signal.SIGALRM, self._raise)
            signal.alarm(self.seconds)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._has_alarm:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, self._old_handler)
        return False

    @staticmethod
    def _raise(signum, frame):
        raise TimeoutError("Cell execution timed out")


def _capture_figures() -> list[str]:
    """Close all matplotlib figures and return them as base64-encoded PNGs."""
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return []

    figures: list[str] = []
    for fig in [plt.figure(n) for n in plt.get_fignums()]:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        figures.append(base64.b64encode(buf.read()).decode())
        plt.close(fig)
    return figures


def _append_cell_to_notebook(
    notebook_path: str,
    code: str,
    stdout: str,
    stderr: str,
    figures: list[str],
) -> None:
    """Append a code cell with outputs to an existing .ipynb file."""
    path = Path(notebook_path)
    if not path.exists():
        return

    nb = nbformat.read(str(path), as_version=4)

    cell = nbformat.v4.new_code_cell(source=code)
    outputs: list[dict[str, Any]] = []

    if stdout:
        outputs.append(nbformat.v4.new_output(output_type="stream", name="stdout", text=stdout))
    if stderr:
        outputs.append(nbformat.v4.new_output(output_type="stream", name="stderr", text=stderr))
    for fig_b64 in figures:
        outputs.append(
            nbformat.v4.new_output(
                output_type="display_data",
                data={"image/png": fig_b64},
            )
        )

    cell["outputs"] = outputs
    nb.cells.append(cell)
    nbformat.write(nb, str(path))


def _variable_summary(shell) -> dict[str, Any]:
    """Return a dict of user-defined variables with type and shape info."""
    import numpy as np

    skip = {
        "__builtins__",
        "__name__",
        "__doc__",
        "__package__",
        "__loader__",
        "__spec__",
        "In",
        "Out",
        "_ih",
        "_oh",
        "_dh",
        "get_ipython",
        "exit",
        "quit",
        "open",
    }
    info: dict[str, Any] = {}
    for name, val in shell.user_ns.items():
        if name.startswith("_") or name in skip:
            continue
        # Skip modules and functions
        if callable(val) and not isinstance(val, (np.ndarray,)):
            try:
                import pandas as pd

                if not isinstance(val, (pd.DataFrame, pd.Series)):
                    continue
            except ImportError:
                continue

        entry: dict[str, Any] = {"type": type(val).__name__}
        if hasattr(val, "shape"):
            entry["shape"] = list(val.shape)
        if hasattr(val, "dtypes"):
            entry["dtypes"] = {str(k): str(v) for k, v in val.dtypes.items()}
        elif hasattr(val, "dtype"):
            entry["dtype"] = str(val.dtype)
        info[name] = entry
    return info


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------


@mcp.tool()
def execute_python(code: str, notebook_path: str) -> str:
    """Execute Python code in a persistent IPython kernel.

    The cell and its output are appended to the notebook at *notebook_path*.
    Returns JSON with keys: stdout, stderr, figures (list of base64 PNGs),
    and success (bool).
    """
    shell = _get_shell()

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    success = True
    try:
        with _Timeout(60), redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            result = shell.run_cell(code, silent=False)
            if result.error_in_exec or result.error_before_exec:
                success = False
                # IPython already wrote the traceback to stderr through showtraceback
                if result.error_in_exec:
                    stderr_buf.write(f"\n{type(result.error_in_exec).__name__}: {result.error_in_exec}")
                if result.error_before_exec:
                    stderr_buf.write(f"\n{type(result.error_before_exec).__name__}: {result.error_before_exec}")
    except TimeoutError:
        success = False
        stderr_buf.write("TimeoutError: Cell execution exceeded 60 seconds")
    except Exception as exc:
        success = False
        stderr_buf.write(f"{type(exc).__name__}: {exc}")

    stdout_text = stdout_buf.getvalue()
    stderr_text = stderr_buf.getvalue()
    figures = _capture_figures()

    # Persist to notebook
    try:
        _append_cell_to_notebook(notebook_path, code, stdout_text, stderr_text, figures)
    except Exception:
        pass  # Don't fail the tool if notebook write fails

    return json.dumps(
        {
            "success": success,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "figures": figures,
        }
    )


@mcp.tool()
def start_notebook(path: str, title: str, dataset_path: str) -> str:
    """Create a new Jupyter notebook and initialize the IPython kernel.

    A setup cell is added that imports pandas/numpy and loads the dataset
    at *dataset_path* into a variable called ``df``.
    Returns JSON confirmation with the notebook path.
    """
    nb = nbformat.v4.new_notebook()
    nb.metadata.update(
        {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3"},
            "otterwise": {"title": title, "dataset": dataset_path},
        }
    )

    # Title cell
    title_cell = nbformat.v4.new_markdown_cell(source=f"# {title}")
    nb.cells.append(title_cell)

    # Setup code
    setup_code = (
        "import pandas as pd\n"
        "import numpy as np\n"
        f"\ndf = pd.read_csv({dataset_path!r})\n"
        "print(f'Dataset loaded: {df.shape[0]} rows x {df.shape[1]} columns')\n"
        "df.head()"
    )
    setup_cell = nbformat.v4.new_code_cell(source=setup_code)
    nb.cells.append(setup_cell)

    # Write notebook file
    nb_path = Path(path)
    nb_path.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(nb, str(nb_path))

    # Execute the setup code in the persistent kernel
    shell = _get_shell()
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            shell.run_cell(setup_code, silent=False)
    except Exception:
        pass

    stdout_text = stdout_buf.getvalue()
    stderr_text = stderr_buf.getvalue()

    # Update the setup cell outputs in the notebook
    outputs: list[dict[str, Any]] = []
    if stdout_text:
        outputs.append(nbformat.v4.new_output(output_type="stream", name="stdout", text=stdout_text))
    if stderr_text:
        outputs.append(nbformat.v4.new_output(output_type="stream", name="stderr", text=stderr_text))
    setup_cell["outputs"] = outputs
    nbformat.write(nb, str(nb_path))

    return json.dumps(
        {
            "success": True,
            "notebook_path": str(nb_path),
            "stdout": stdout_text,
            "stderr": stderr_text,
        }
    )


@mcp.tool()
def get_kernel_state() -> str:
    """Return the current kernel variables with their types and shapes.

    Useful for understanding what data is available before writing code.
    Returns JSON dict mapping variable names to {type, shape?, dtypes?}.
    """
    shell = _get_shell()
    info = _variable_summary(shell)
    return json.dumps(info)


@mcp.tool()
def install_package(package: str) -> str:
    """Install a whitelisted data-science package via pip.

    Only the following packages are allowed: pandas, numpy, scipy,
    statsmodels, scikit-learn, matplotlib, seaborn.
    Returns JSON with success status and install output.
    """
    # Normalize for comparison (pip uses hyphens, imports use underscores)
    normalized = package.strip().lower().replace("_", "-")
    if normalized not in {p.replace("_", "-") for p in WHITELISTED_PACKAGES}:
        return json.dumps(
            {
                "success": False,
                "error": f"Package '{package}' is not whitelisted. "
                f"Allowed packages: {', '.join(sorted(WHITELISTED_PACKAGES))}",
            }
        )

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return json.dumps(
            {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }
        )
    except subprocess.TimeoutExpired:
        return json.dumps({"success": False, "error": "pip install timed out after 120 seconds"})
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)})


# ---------------------------------------------------------------------------
# Entry point -- stdio transport
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
