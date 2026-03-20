import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function getPlatformSocketType(): "unix" | "tcp" {
  return isWindows() ? "tcp" : "unix";
}

function parseVersion(output: string): [number, number] | null {
  const match = output.match(/Python\s+(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function tryPythonCommand(cmd: string): string | null {
  try {
    const output = execSync(`${cmd} --version`, {
      encoding: "utf-8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    const version = parseVersion(output);
    if (version && (version[0] > 3 || (version[0] === 3 && version[1] >= 10))) {
      return cmd;
    }
    return null;
  } catch {
    return null;
  }
}

export function findPython(): string | null {
  // 1. Check OTTERWISE_VENV env var
  const venvDir = process.env.OTTERWISE_VENV;
  if (venvDir) {
    const pythonBin = isWindows()
      ? join(venvDir, "Scripts", "python.exe")
      : join(venvDir, "bin", "python");

    if (existsSync(pythonBin)) {
      const result = tryPythonCommand(pythonBin);
      if (result) return result;
    }
  }

  // 2. Try python3
  const py3 = tryPythonCommand("python3");
  if (py3) return py3;

  // 3. Try python
  const py = tryPythonCommand("python");
  if (py) return py;

  return null;
}
