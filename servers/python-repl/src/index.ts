import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PythonBridge } from "./bridge/python-bridge.js";
import { executePython } from "./tools/execute.js";
import { startNotebook } from "./tools/notebook.js";
import { getKernelState } from "./tools/state.js";
import { installPackage } from "./tools/install.js";

const server = new McpServer({
  name: "otterwise-python-repl",
  version: "1.0.0",
});

const bridge = new PythonBridge();

// Tool: execute_python
server.tool(
  "execute_python",
  "Execute Python code in a persistent IPython kernel. Returns JSON with stdout, stderr, figures, and success status.",
  {
    code: z.string().describe("Python code to execute"),
    notebook_path: z.string().describe("Path to .ipynb file to append results"),
  },
  async ({ code, notebook_path }) => ({
    content: [{ type: "text" as const, text: await executePython(bridge, code, notebook_path) }],
  })
);

// Tool: start_notebook
server.tool(
  "start_notebook",
  "Create a new Jupyter notebook and initialize with dataset loading.",
  {
    path: z.string().describe("Notebook file path"),
    title: z.string().describe("Notebook title"),
    dataset_path: z.string().describe("Path to CSV dataset"),
  },
  async ({ path, title, dataset_path }) => ({
    content: [{ type: "text" as const, text: await startNotebook(bridge, path, title, dataset_path) }],
  })
);

// Tool: get_kernel_state
server.tool(
  "get_kernel_state",
  "Return current kernel variables with types and shapes.",
  {},
  async () => ({
    content: [{ type: "text" as const, text: await getKernelState(bridge) }],
  })
);

// Tool: install_package
server.tool(
  "install_package",
  "Install a whitelisted data-science package via pip.",
  { package: z.string().describe("Package name to install") },
  async ({ package: pkg }) => ({
    content: [{ type: "text" as const, text: await installPackage(pkg) }],
  })
);

// Cleanup on exit
process.on("SIGINT", () => {
  bridge.shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  bridge.shutdown();
  process.exit(0);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
