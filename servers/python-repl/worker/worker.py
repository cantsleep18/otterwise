"""Minimal Python worker for TS MCP server.
Reads JSON-line commands from stdin, executes in IPython, returns results on stdout."""
import sys
import json
import io
import base64

_ipc_out = sys.stdout

from IPython.core.interactiveshell import InteractiveShell

shell = InteractiveShell.instance()
shell.colors = "NoColor"
shell.run_cell("import matplotlib; matplotlib.use('Agg')", silent=True)

def send_response(resp):
    _ipc_out.write(json.dumps(resp) + "\n")
    _ipc_out.flush()

def capture_figures():
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return []
    figs = []
    for fig in [plt.figure(n) for n in plt.get_fignums()]:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        figs.append(base64.b64encode(buf.read()).decode())
        plt.close(fig)
    return figs

def get_variable_summary():
    skip = {"__builtins__","__name__","__doc__","__package__","__loader__","__spec__",
            "In","Out","_ih","_oh","_dh","get_ipython","exit","quit","open",
            "matplotlib","np","pd"}
    info = {}
    for name, val in shell.user_ns.items():
        if name.startswith("_") or name in skip:
            continue
        if callable(val):
            try:
                import pandas as _pd
                import numpy as _np
                if not isinstance(val, (_pd.DataFrame, _pd.Series, _np.ndarray)):
                    continue
            except ImportError:
                continue
        entry = {"type": type(val).__name__}
        if hasattr(val, "shape"):
            entry["shape"] = list(val.shape)
        if hasattr(val, "dtypes"):
            entry["dtypes"] = {str(k): str(v) for k, v in val.dtypes.items()}
        elif hasattr(val, "dtype"):
            entry["dtype"] = str(val.dtype)
        info[name] = entry
    return info

def handle_execute(msg):
    mid = msg["id"]
    code = msg["code"]
    out_buf = io.StringIO()
    err_buf = io.StringIO()

    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out_buf, err_buf

    success = True
    try:
        result = shell.run_cell(code, silent=False)
        if result.error_in_exec or result.error_before_exec:
            success = False
            if result.error_in_exec:
                err_buf.write(f"\n{type(result.error_in_exec).__name__}: {result.error_in_exec}")
            if result.error_before_exec:
                err_buf.write(f"\n{type(result.error_before_exec).__name__}: {result.error_before_exec}")
    except Exception as exc:
        success = False
        err_buf.write(f"{type(exc).__name__}: {exc}")
    finally:
        sys.stdout, sys.stderr = old_stdout, old_stderr

    figures = capture_figures()
    send_response({
        "id": mid, "type": "result", "success": success,
        "stdout": out_buf.getvalue(), "stderr": err_buf.getvalue(),
        "figures": figures
    })

def handle_get_state(msg):
    send_response({
        "id": msg["id"], "type": "state",
        "variables": get_variable_summary()
    })

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        msg = json.loads(line)
        if msg["type"] == "execute":
            handle_execute(msg)
        elif msg["type"] == "get_state":
            handle_get_state(msg)
        else:
            send_response({"id": msg.get("id", ""), "type": "error", "message": f"Unknown type: {msg['type']}"})
    except json.JSONDecodeError as e:
        send_response({"id": "", "type": "error", "message": f"Invalid JSON: {e}"})
    except Exception as e:
        send_response({"id": msg.get("id", ""), "type": "error", "message": f"Worker error: {e}"})
