#!/bin/bash
# Otterwise MCP Server Launcher
# Uses the isolated venv created by /otterwise:ow-doctor

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="${OTTERWISE_VENV:-$SCRIPT_DIR/.venv}"

# Check if venv exists
if [ ! -f "$VENV_DIR/bin/python" ] && [ ! -f "$VENV_DIR/Scripts/python.exe" ]; then
    echo '{"error": "Otterwise environment not set up. Run /otterwise:ow-doctor first."}' >&2
    exit 1
fi

# Detect platform (Unix vs Windows/WSL)
if [ -f "$VENV_DIR/bin/python" ]; then
    PYTHON="$VENV_DIR/bin/python"
elif [ -f "$VENV_DIR/Scripts/python.exe" ]; then
    PYTHON="$VENV_DIR/Scripts/python.exe"
fi

exec "$PYTHON" "$SCRIPT_DIR/python_repl.py"
