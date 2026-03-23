import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BridgeManager as PythonBridge } from "./bridge/bridge-manager.js";
import {
  pythonReplSchema,
  handlePythonRepl,
} from "./tool.js";

const server = new McpServer({
  name: "otterwise-python-repl",
  version: "1.0.0",
});

const bridge = new PythonBridge();

// Single unified tool
server.tool(
  "python_repl",
  "Python REPL with persistent kernel. Actions: execute, start_notebook, get_state, install_package, interrupt, reset.",
  pythonReplSchema,
  async (params) => {
    try {
      const text = await handlePythonRepl(bridge, params);
      return { content: [{ type: "text" as const, text }] };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        }],
      };
    }
  },
);

// Cleanup on exit
async function gracefulShutdown() {
  await bridge.shutdown();
  process.exit(0);
}

process.on("SIGINT", () => {
  gracefulShutdown();
});
process.on("SIGTERM", () => {
  gracefulShutdown();
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
