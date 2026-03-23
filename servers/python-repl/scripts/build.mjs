import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/mcp-server.cjs",
  banner: {
    js: [
      "#!/usr/bin/env node",
      // Wrap everything in async IIFE for top-level await support
      "(async () => {",
      // Provide import.meta.url shim for CJS context
      "var __import_meta_url__ = require('url').pathToFileURL(__filename).href;",
    ].join("\n"),
  },
  footer: {
    js: "})();",
  },
  define: {
    "import.meta.url": "__import_meta_url__",
  },
  logLevel: "info",
});
