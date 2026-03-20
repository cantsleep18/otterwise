#!/usr/bin/env python3
"""Otterwise JSON-RPC 2.0 Python worker.

Persistent IPython execution kernel with notebook integration.
Communicates over Unix Domain Socket (or TCP fallback) using
newline-delimited JSON-RPC 2.0.  NOT an MCP server.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
import signal
import subprocess
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any

import nbformat

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_REQUEST_BYTES = 10 * 1024 * 1024  # 10 MB per request line
BOUNDED_OUTPUT_BYTES = 1 * 1024 * 1024  # 1 MB per stream capture
EXEC_TIMEOUT_SECS = 60
PPID_POLL_SECS = 5

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

# ---------------------------------------------------------------------------
# BoundedStringIO — caps captured output at BOUNDED_OUTPUT_BYTES
# ---------------------------------------------------------------------------


class BoundedStringIO(io.StringIO):
    """A StringIO that silently stops accepting writes after a byte limit."""

    def __init__(self, max_bytes: int = BOUNDED_OUTPUT_BYTES) -> None:
        super().__init__()
        self._max_bytes = max_bytes
        self._bytes_written = 0
        self._truncated = False

    def write(self, s: str) -> int:
        encoded_len = len(s.encode("utf-8", errors="replace"))
        if self._bytes_written >= self._max_bytes:
            self._truncated = True
            return 0
        remaining = self._max_bytes - self._bytes_written
        if encoded_len > remaining:
            # Approximate character cut — good enough for capping output
            ratio = remaining / encoded_len
            s = s[: max(1, int(len(s) * ratio))]
            self._truncated = True
        written = super().write(s)
        self._bytes_written += len(s.encode("utf-8", errors="replace"))
        return written

    def getvalue(self) -> str:
        val = super().getvalue()
        if self._truncated:
            val += "\n[output truncated — exceeded 1 MB limit]"
        return val


# ---------------------------------------------------------------------------
# Execution timeout (SIGALRM on Unix, no-op on Windows)
# ---------------------------------------------------------------------------


class _Timeout:
    """Context manager that raises TimeoutError after *seconds* on Unix."""

    def __init__(self, seconds: int) -> None:
        self.seconds = seconds
        self._has_alarm = hasattr(signal, "SIGALRM")

    def __enter__(self) -> "_Timeout":
        if self._has_alarm:
            self._old_handler = signal.signal(signal.SIGALRM, self._raise)
            signal.alarm(self.seconds)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        if self._has_alarm:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, self._old_handler)
        return False

    @staticmethod
    def _raise(signum: int, frame: Any) -> None:
        raise TimeoutError("Cell execution timed out")


# ---------------------------------------------------------------------------
# Lazy IPython kernel singleton
# ---------------------------------------------------------------------------

_shell: Any = None


def _get_shell() -> Any:
    """Return (or create) the persistent IPython InteractiveShell."""
    global _shell
    if _shell is None:
        from IPython.core.interactiveshell import InteractiveShell

        _shell = InteractiveShell.instance()
        _shell.colors = "NoColor"
        _shell.run_cell("import matplotlib; matplotlib.use('Agg')", silent=True)
    return _shell


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
        outputs.append(
            nbformat.v4.new_output(output_type="stream", name="stdout", text=stdout)
        )
    if stderr:
        outputs.append(
            nbformat.v4.new_output(output_type="stream", name="stderr", text=stderr)
        )
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


def _variable_summary(shell: Any) -> dict[str, Any]:
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
        if hasattr(val, "nbytes"):
            entry["memory_bytes"] = int(val.nbytes)
        elif hasattr(val, "memory_usage"):
            try:
                entry["memory_bytes"] = int(val.memory_usage(deep=True).sum())
            except Exception:
                pass
        info[name] = entry
    return info


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 helpers
# ---------------------------------------------------------------------------


def _jsonrpc_result(id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": id, "result": result}


def _jsonrpc_error(id: Any, code: int, message: str, data: Any = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": id, "error": err}


# Standard JSON-RPC error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# Shutdown signal — set by _rpc_shutdown, awaited by _run_server
_server_should_stop = asyncio.Event()

# ---------------------------------------------------------------------------
# RPC method implementations
# ---------------------------------------------------------------------------


def _rpc_execute(params: dict[str, Any]) -> dict[str, Any]:
    code = params.get("code")
    notebook_path = params.get("notebook_path")
    if not isinstance(code, str):
        raise ValueError("'code' (string) is required")
    if not isinstance(notebook_path, str):
        raise ValueError("'notebook_path' (string) is required")

    shell = _get_shell()
    stdout_buf = BoundedStringIO()
    stderr_buf = BoundedStringIO()

    success = True
    try:
        with _Timeout(EXEC_TIMEOUT_SECS), redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            result = shell.run_cell(code, silent=False)
            if result.error_in_exec or result.error_before_exec:
                success = False
                if result.error_in_exec:
                    stderr_buf.write(
                        f"\n{type(result.error_in_exec).__name__}: {result.error_in_exec}"
                    )
                if result.error_before_exec:
                    stderr_buf.write(
                        f"\n{type(result.error_before_exec).__name__}: {result.error_before_exec}"
                    )
    except TimeoutError:
        success = False
        stderr_buf.write("TimeoutError: Cell execution exceeded 60 seconds")
    except Exception as exc:
        success = False
        stderr_buf.write(f"{type(exc).__name__}: {exc}")

    stdout_text = stdout_buf.getvalue()
    stderr_text = stderr_buf.getvalue()
    figures = _capture_figures()

    try:
        _append_cell_to_notebook(notebook_path, code, stdout_text, stderr_text, figures)
    except Exception:
        pass

    return {
        "success": success,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "figures": figures,
    }


def _rpc_start_notebook(params: dict[str, Any]) -> dict[str, Any]:
    path = params.get("path")
    title = params.get("title")
    dataset_path = params.get("dataset_path")
    if not isinstance(path, str):
        raise ValueError("'path' (string) is required")
    if not isinstance(title, str):
        raise ValueError("'title' (string) is required")
    if not isinstance(dataset_path, str):
        raise ValueError("'dataset_path' (string) is required")

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

    title_cell = nbformat.v4.new_markdown_cell(source=f"# {title}")
    nb.cells.append(title_cell)

    setup_code = (
        "import pandas as pd\n"
        "import numpy as np\n"
        f"\ndf = pd.read_csv({dataset_path!r})\n"
        "print(f'Dataset loaded: {df.shape[0]} rows x {df.shape[1]} columns')\n"
        "df.head()"
    )
    setup_cell = nbformat.v4.new_code_cell(source=setup_code)
    nb.cells.append(setup_cell)

    nb_path = Path(path)
    nb_path.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(nb, str(nb_path))

    shell = _get_shell()
    stdout_buf = BoundedStringIO()
    stderr_buf = BoundedStringIO()
    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            shell.run_cell(setup_code, silent=False)
    except Exception:
        pass

    stdout_text = stdout_buf.getvalue()
    stderr_text = stderr_buf.getvalue()

    outputs: list[dict[str, Any]] = []
    if stdout_text:
        outputs.append(
            nbformat.v4.new_output(output_type="stream", name="stdout", text=stdout_text)
        )
    if stderr_text:
        outputs.append(
            nbformat.v4.new_output(output_type="stream", name="stderr", text=stderr_text)
        )
    setup_cell["outputs"] = outputs
    nbformat.write(nb, str(nb_path))

    return {
        "success": True,
        "notebook_path": str(nb_path),
        "stdout": stdout_text,
        "stderr": stderr_text,
    }


def _rpc_get_state(params: dict[str, Any]) -> dict[str, Any]:
    shell = _get_shell()
    return _variable_summary(shell)


def _rpc_install_package(params: dict[str, Any]) -> dict[str, Any]:
    package = params.get("package")
    if not isinstance(package, str):
        raise ValueError("'package' (string) is required")

    normalized = package.strip().lower().replace("_", "-")
    if normalized not in {p.replace("_", "-") for p in WHITELISTED_PACKAGES}:
        return {
            "success": False,
            "message": (
                f"Package '{package}' is not whitelisted. "
                f"Allowed: {', '.join(sorted(WHITELISTED_PACKAGES))}"
            ),
        }

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return {
            "success": result.returncode == 0,
            "message": result.stdout if result.returncode == 0 else result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "pip install timed out after 120 seconds"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


def _rpc_shutdown(params: dict[str, Any]) -> dict[str, Any]:
    _server_should_stop.set()
    return {"success": True, "message": "Shutting down"}


# Method dispatch table
_RPC_METHODS: dict[str, Any] = {
    "execute": _rpc_execute,
    "start_notebook": _rpc_start_notebook,
    "get_state": _rpc_get_state,
    "install_package": _rpc_install_package,
    "shutdown": _rpc_shutdown,
}


# ---------------------------------------------------------------------------
# Request dispatcher
# ---------------------------------------------------------------------------


def _dispatch(raw: str) -> str | None:
    """Parse a JSON-RPC 2.0 request and return a JSON response string.

    Returns None for notifications (no ``id``).
    """
    try:
        req = json.loads(raw)
    except json.JSONDecodeError as exc:
        return json.dumps(_jsonrpc_error(None, PARSE_ERROR, f"Parse error: {exc}"))

    if not isinstance(req, dict):
        return json.dumps(
            _jsonrpc_error(None, INVALID_REQUEST, "Request must be a JSON object")
        )

    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if not isinstance(method, str):
        return json.dumps(
            _jsonrpc_error(req_id, INVALID_REQUEST, "'method' must be a string")
        )

    if not isinstance(params, dict):
        return json.dumps(
            _jsonrpc_error(req_id, INVALID_PARAMS, "'params' must be an object")
        )

    handler = _RPC_METHODS.get(method)
    if handler is None:
        return json.dumps(
            _jsonrpc_error(req_id, METHOD_NOT_FOUND, f"Unknown method: {method}")
        )

    try:
        result = handler(params)
    except ValueError as exc:
        return json.dumps(_jsonrpc_error(req_id, INVALID_PARAMS, str(exc)))
    except Exception as exc:
        return json.dumps(
            _jsonrpc_error(req_id, INTERNAL_ERROR, f"{type(exc).__name__}: {exc}")
        )

    # Notifications (no id) get no response
    if req_id is None:
        return None

    return json.dumps(_jsonrpc_result(req_id, result))


# ---------------------------------------------------------------------------
# Asyncio socket server
# ---------------------------------------------------------------------------


async def _handle_client(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter
) -> None:
    """Handle one connected client — read newline-delimited JSON-RPC requests."""
    try:
        while not reader.at_eof():
            try:
                line = await reader.readuntil(b"\n")
            except asyncio.IncompleteReadError:
                break
            except asyncio.LimitOverrunError:
                # Line exceeds MAX_REQUEST_BYTES
                err = json.dumps(
                    _jsonrpc_error(
                        None, PARSE_ERROR, "Request exceeds 10 MB size limit"
                    )
                )
                writer.write((err + "\n").encode())
                await writer.drain()
                # Drain the oversized line
                try:
                    await reader.readuntil(b"\n")
                except Exception:
                    pass
                continue

            raw = line.decode("utf-8", errors="replace").strip()
            if not raw:
                continue

            # Run dispatch in a thread to avoid blocking the event loop
            # (IPython execution is synchronous)
            response = await asyncio.get_event_loop().run_in_executor(
                None, _dispatch, raw
            )

            if response is not None:
                writer.write((response + "\n").encode())
                await writer.drain()

            # Check if shutdown was requested
            if _server_should_stop.is_set():
                break
    except ConnectionResetError:
        pass
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def _monitor_parent(ppid: int) -> None:
    """Watch parent process — shut down if it dies."""
    while True:
        await asyncio.sleep(PPID_POLL_SECS)
        try:
            os.kill(ppid, 0)  # Signal 0 = check existence
        except OSError:
            # Parent is gone
            _server_should_stop.set()
            return


async def _run_server(args: argparse.Namespace) -> None:
    """Start the JSON-RPC socket server and run until shutdown."""
    ppid = os.getppid()

    if args.socket_path:
        socket_path = args.socket_path
        # Remove stale socket file
        try:
            os.unlink(socket_path)
        except FileNotFoundError:
            pass

        # Secure socket permissions on Unix
        old_umask = os.umask(0o177)
        try:
            server = await asyncio.start_unix_server(
                _handle_client,
                path=socket_path,
                limit=MAX_REQUEST_BYTES,
            )
        finally:
            os.umask(old_umask)

        print(json.dumps({"status": "ready", "socket": socket_path}), flush=True)
    else:
        # TCP fallback (Windows)
        port = args.port or 0
        server = await asyncio.start_server(
            _handle_client,
            host="127.0.0.1",
            port=port,
            limit=MAX_REQUEST_BYTES,
        )
        actual_port = server.sockets[0].getsockname()[1]

        # Write port file so the bridge manager can discover it
        port_file = Path(args.port_file) if args.port_file else None
        if port_file:
            port_file.write_text(str(actual_port))

        print(
            json.dumps({"status": "ready", "port": actual_port}),
            flush=True,
        )

    # Start parent monitor
    monitor_task = asyncio.create_task(_monitor_parent(ppid))

    async with server:
        # Wait until shutdown is requested
        await _server_should_stop.wait()
        server.close()
        await server.wait_closed()

    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass

    # Clean up socket file
    if args.socket_path:
        try:
            os.unlink(args.socket_path)
        except FileNotFoundError:
            pass


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Otterwise JSON-RPC Python worker")
    parser.add_argument(
        "--socket-path",
        type=str,
        default=None,
        help="Path for Unix domain socket (preferred on Linux/macOS)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="TCP port for fallback on Windows (0 = auto-assign)",
    )
    parser.add_argument(
        "--port-file",
        type=str,
        default=None,
        help="File to write the assigned TCP port to (Windows mode)",
    )
    args = parser.parse_args()

    if not args.socket_path and args.port is None:
        parser.error("Either --socket-path or --port is required")

    try:
        asyncio.run(_run_server(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
