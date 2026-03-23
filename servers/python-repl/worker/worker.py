"""Python REPL worker — Unix domain socket server with JSON-RPC 2.0.

Executes code via exec() with a persistent globals dict.
Communicates over AF_UNIX (or localhost TCP on Windows) using
newline-delimited JSON-RPC 2.0.

Usage:
    python worker.py --socket /path/to/bridge.sock [--ready-file /path/to/ready]
    python worker.py --port 9001 [--ready-file /path/to/ready]

Env vars (fallbacks for CLI args):
    WORKER_SOCKET_PATH  - path for Unix domain socket
    WORKER_PORT         - TCP port (Windows fallback)
    WORKER_READY_FILE   - path to write when listening
    WORKER_PARENT_PID   - parent PID to monitor
"""
import sys
import os
import json
import socket
import threading
import signal
import io
import base64
import traceback
import resource
import argparse

# ---------------------------------------------------------------------------
# JSON-RPC 2.0 helpers
# ---------------------------------------------------------------------------

def _ok(req_id, result):
    return json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result})


def _err(req_id, code, message, data=None):
    e = {"code": code, "message": message}
    if data is not None:
        e["data"] = data
    return json.dumps({"jsonrpc": "2.0", "id": req_id, "error": e})


# Standard JSON-RPC error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INTERNAL_ERROR = -32603

# ---------------------------------------------------------------------------
# Execution engine — persistent globals, plain exec()
# ---------------------------------------------------------------------------

class ExecutionEngine:
    def __init__(self):
        self._globals = {"__builtins__": __builtins__, "__name__": "__main__"}
        self._lock = threading.Lock()
        self._interrupted = False
        self._init_matplotlib()

    def _init_matplotlib(self):
        """Set Agg backend if matplotlib is available."""
        try:
            import matplotlib
            matplotlib.use("Agg")
        except ImportError:
            pass

    def execute(self, code):
        """Execute code, return dict with stdout, stderr, success, figures."""
        out_buf = io.StringIO()
        err_buf = io.StringIO()
        success = True

        with self._lock:
            self._interrupted = False
            old_stdout, old_stderr = sys.stdout, sys.stderr
            sys.stdout, sys.stderr = out_buf, err_buf
            try:
                exec(compile(code, "<repl>", "exec"), self._globals)
            except SystemExit:
                raise
            except KeyboardInterrupt:
                success = False
                err_buf.write("Execution interrupted\n")
            except Exception:
                success = False
                err_buf.write(traceback.format_exc())
            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr

        figures = self._capture_figures()

        return {
            "success": success,
            "stdout": out_buf.getvalue(),
            "stderr": err_buf.getvalue(),
            "figures": figures,
        }

    def interrupt(self):
        """Request interruption of running code (best-effort)."""
        self._interrupted = True

    def reset(self):
        """Clear the execution namespace."""
        with self._lock:
            self._globals = {"__builtins__": __builtins__, "__name__": "__main__"}
            self._init_matplotlib()

    def get_state(self):
        """Return variable summary and memory usage."""
        skip = {
            "__builtins__", "__name__", "__doc__", "__package__",
            "__loader__", "__spec__", "matplotlib",
        }
        variables = {}
        for name, val in self._globals.items():
            if name.startswith("_") or name in skip:
                continue
            if callable(val):
                # Include callable data structures (DataFrame, ndarray)
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
                try:
                    entry["dtypes"] = {str(k): str(v) for k, v in val.dtypes.items()}
                except Exception:
                    pass
            elif hasattr(val, "dtype"):
                entry["dtype"] = str(val.dtype)
            variables[name] = entry

        usage = resource.getrusage(resource.RUSAGE_SELF)
        memory_mb = usage.ru_maxrss / 1024  # Linux: KB -> MB

        return {"variables": variables, "memory_mb": round(memory_mb, 1)}

    def _capture_figures(self):
        """Capture open matplotlib figures as base64 PNG, then close them."""
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

# ---------------------------------------------------------------------------
# Client handler — one thread per connection
# ---------------------------------------------------------------------------

def handle_client(conn, engine, shutdown_event):
    """Read newline-delimited JSON-RPC requests from conn, write responses."""
    rfile = conn.makefile("r", encoding="utf-8")
    wlock = threading.Lock()

    def send(data):
        try:
            with wlock:
                conn.sendall((data + "\n").encode("utf-8"))
        except OSError:
            pass

    try:
        for line in rfile:
            line = line.strip()
            if not line:
                continue

            # Parse JSON
            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                send(_err(None, PARSE_ERROR, f"Parse error: {e}"))
                continue

            # Validate request
            req_id = msg.get("id")
            method = msg.get("method")
            if not method or not req_id:
                send(_err(req_id, INVALID_REQUEST, "Missing method or id"))
                continue

            params = msg.get("params", {})

            # Dispatch
            try:
                if method == "execute":
                    code = params.get("code", "")
                    result = engine.execute(code)
                    send(_ok(req_id, result))

                elif method == "interrupt":
                    engine.interrupt()
                    send(_ok(req_id, {"interrupted": True}))

                elif method == "reset":
                    engine.reset()
                    send(_ok(req_id, {"reset": True}))

                elif method == "get_state":
                    state = engine.get_state()
                    send(_ok(req_id, state))

                elif method == "ping":
                    send(_ok(req_id, {"pong": True}))

                else:
                    send(_err(req_id, METHOD_NOT_FOUND, f"Unknown method: {method}"))

            except SystemExit:
                send(_ok(req_id, {"success": False, "stderr": "SystemExit called"}))
                shutdown_event.set()
                return
            except Exception:
                send(_err(req_id, INTERNAL_ERROR, traceback.format_exc()))

    except (OSError, ValueError):
        pass  # Client disconnected
    finally:
        try:
            rfile.close()
        except OSError:
            pass
        try:
            conn.close()
        except OSError:
            pass

# ---------------------------------------------------------------------------
# Parent PID monitor — exit if parent dies
# ---------------------------------------------------------------------------

def start_parent_monitor(parent_pid, shutdown_event):
    """Background thread that triggers shutdown when the parent process dies."""
    if parent_pid is None:
        return

    def _monitor():
        while not shutdown_event.is_set():
            try:
                os.kill(parent_pid, 0)
            except OSError:
                # Parent is gone
                shutdown_event.set()
                return
            shutdown_event.wait(2.0)

    t = threading.Thread(target=_monitor, daemon=True)
    t.start()

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

def run_server(sock_path=None, port=None, ready_file=None, parent_pid=None):
    engine = ExecutionEngine()
    shutdown_event = threading.Event()
    server_sock = None

    # SIGTERM handler
    def _sigterm(signum, frame):
        shutdown_event.set()

    signal.signal(signal.SIGTERM, _sigterm)

    try:
        if sock_path:
            # Clean up stale socket file
            try:
                os.unlink(sock_path)
            except FileNotFoundError:
                pass

            server_sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server_sock.bind(sock_path)
            listen_addr = sock_path
        elif port:
            server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_sock.bind(("127.0.0.1", port))
            listen_addr = f"127.0.0.1:{port}"
        else:
            print("ERROR: --socket or --port is required", file=sys.stderr)
            sys.exit(1)

        server_sock.listen(2)
        server_sock.settimeout(1.0)  # Allow periodic shutdown checks

        # Write ready file
        if ready_file:
            try:
                os.makedirs(os.path.dirname(ready_file), exist_ok=True)
            except OSError:
                pass
            with open(ready_file, "w") as f:
                f.write(listen_addr)

        # Start parent monitor
        start_parent_monitor(parent_pid, shutdown_event)

        print(f"Worker listening on {listen_addr}", file=sys.stderr)

        # Accept loop
        while not shutdown_event.is_set():
            try:
                conn, _ = server_sock.accept()
                t = threading.Thread(
                    target=handle_client,
                    args=(conn, engine, shutdown_event),
                    daemon=True,
                )
                t.start()
            except socket.timeout:
                continue
            except OSError:
                if not shutdown_event.is_set():
                    raise

    finally:
        if server_sock:
            try:
                server_sock.close()
            except OSError:
                pass
        if sock_path:
            try:
                os.unlink(sock_path)
            except FileNotFoundError:
                pass
        # Clean up ready file
        if ready_file:
            try:
                os.unlink(ready_file)
            except FileNotFoundError:
                pass

        print("Worker shut down", file=sys.stderr)

# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Python REPL worker")
    parser.add_argument("--socket", default=os.environ.get("WORKER_SOCKET_PATH"),
                        help="Unix domain socket path")
    parser.add_argument("--port", type=int, default=None,
                        help="TCP port (Windows fallback)")
    parser.add_argument("--ready-file", default=os.environ.get("WORKER_READY_FILE"),
                        help="File to write when ready")
    parser.add_argument("--parent-pid", type=int,
                        default=int(os.environ["WORKER_PARENT_PID"])
                        if "WORKER_PARENT_PID" in os.environ else None,
                        help="Parent PID to monitor")
    args = parser.parse_args()

    if args.port is None and os.environ.get("WORKER_PORT"):
        args.port = int(os.environ["WORKER_PORT"])

    run_server(
        sock_path=args.socket,
        port=args.port,
        ready_file=args.ready_file,
        parent_pid=args.parent_pid,
    )


if __name__ == "__main__":
    main()
