import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { BridgeManager } from "./bridge/manager.js";
import { SessionLock } from "./bridge/lock.js";
import { getLockPath } from "./bridge/paths.js";

import { handleExecutePython } from "./tools/execute_python.js";
import { handleStartNotebook } from "./tools/start_notebook.js";
import { handleGetKernelState } from "./tools/state.js";
import { handleInstallPackage } from "./tools/install.js";

// --- Instances ---

const bridge = new BridgeManager();
const sessionLock = new SessionLock(getLockPath());

// --- Server setup ---

const server = new Server(
  { name: "python-repl", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// --- tools/list handler ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "execute_python",
      description: "Execute Python code in the connected kernel",
      inputSchema: {
        type: "object" as const,
        properties: {
          code: { type: "string", description: "Python code to execute" },
          notebook_path: {
            type: "string",
            description: "Path to the notebook file",
          },
        },
        required: ["code", "notebook_path"],
      },
    },
    {
      name: "start_notebook",
      description: "Start a new notebook session",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "File path for the notebook",
          },
          title: { type: "string", description: "Title for the notebook" },
          dataset_path: {
            type: "string",
            description: "Path to the dataset to load",
          },
        },
        required: ["path", "title", "dataset_path"],
      },
    },
    {
      name: "get_kernel_state",
      description: "Get the current state of the Python kernel",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "install_package",
      description: "Install a Python package in the kernel environment",
      inputSchema: {
        type: "object" as const,
        properties: {
          package: {
            type: "string",
            description: "Package name to install",
          },
        },
        required: ["package"],
      },
    },
  ],
}));

// --- tools/call handler ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let resultText: string;

    switch (name) {
      case "execute_python": {
        const result = await handleExecutePython(
          args as { code: string; notebook_path: string },
          bridge,
        );
        resultText = JSON.stringify(result);
        break;
      }

      case "start_notebook": {
        const result = await handleStartNotebook(
          args as { path: string; title: string; dataset_path: string },
          bridge,
        );
        resultText = JSON.stringify(result);
        break;
      }

      case "get_kernel_state":
        resultText = await handleGetKernelState(bridge, sessionLock);
        break;

      case "install_package":
        resultText = await handleInstallPackage(
          args as { package: string },
          bridge,
          sessionLock,
        );
        break;

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: resultText }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: message }],
      isError: true,
    };
  }
});

// --- Graceful shutdown ---

async function shutdown() {
  try {
    await bridge.stop();
    await sessionLock.release();
  } catch {
    // Best-effort cleanup
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// --- Health check ---

async function healthCheck(): Promise<void> {
  try {
    const python = await import("./utils/platform.js");
    const pythonPath = python.findPython();
    const status = {
      server: "python-repl",
      version: "0.1.0",
      python: pythonPath ? { path: pythonPath, found: true } : { found: false },
      tools: ["execute_python", "start_notebook", "get_kernel_state", "install_package"],
    };
    console.log(JSON.stringify(status, null, 2));
    process.exit(pythonPath ? 0 : 1);
  } catch (err) {
    console.error("Health check failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// --- Start ---

async function main() {
  if (process.argv.includes("--health-check")) {
    await healthCheck();
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
