import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const WHITELISTED_PACKAGES = new Set([
  "pandas", "numpy", "scipy", "statsmodels",
  "scikit-learn", "matplotlib", "seaborn",
]);

export async function installPackage(packageName: string): Promise<string> {
  const normalized = packageName.trim().toLowerCase().replace(/_/g, "-");

  if (!WHITELISTED_PACKAGES.has(normalized)) {
    return JSON.stringify({
      success: false,
      error: `Package '${packageName}' is not whitelisted. Allowed: ${[...WHITELISTED_PACKAGES].sort().join(", ")}`,
    });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3", ["-m", "pip", "install", packageName],
      { timeout: 120_000 }
    );
    return JSON.stringify({ success: true, stdout, stderr });
  } catch (error: unknown) {
    const err = error as { killed?: boolean; message?: string };
    if (err.killed) {
      return JSON.stringify({ success: false, error: "pip install timed out after 120 seconds" });
    }
    return JSON.stringify({ success: false, error: err.message ?? String(error) });
  }
}
