import { spawn, ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExecuteResponse, StateResponse } from "./types.js";
import { attachResponseListener, sendRequest, clearPending } from "./ipc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "../../worker/worker.py");

export class PythonBridge {
  private process: ChildProcess | null = null;

  private spawnWorker(): ChildProcess {
    const proc = spawn("python3", ["-u", WORKER_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    attachResponseListener(proc);

    // Forward Python stderr for logging (worker redirects print() to stderr)
    proc.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    proc.on("exit", (code, signal) => {
      if (this.process === proc) {
        this.process = null;
      }
      process.stderr.write(
        `[python-bridge] Worker exited (code=${code}, signal=${signal})\n`,
      );
    });

    return proc;
  }

  private getProcess(): ChildProcess {
    if (!this.process || this.process.killed || this.process.exitCode !== null) {
      this.process = this.spawnWorker();
    }
    return this.process;
  }

  async execute(code: string): Promise<ExecuteResponse> {
    const proc = this.getProcess();
    const response = await sendRequest(proc, { type: "execute" as const, code });

    if (response.type === "error") {
      return {
        id: response.id,
        type: "result",
        success: false,
        stdout: "",
        stderr: response.message,
        figures: [],
      };
    }

    return response as ExecuteResponse;
  }

  async getState(): Promise<StateResponse> {
    const proc = this.getProcess();
    const response = await sendRequest(proc, { type: "get_state" as const });

    if (response.type === "error") {
      return {
        id: response.id,
        type: "state",
        variables: {},
      };
    }

    return response as StateResponse;
  }

  shutdown(): void {
    clearPending();
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}
