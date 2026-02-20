import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    target: "node22",
    outDir: "dist",
    external: ["playwright", "@anthropic-ai/sdk"],
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "node22",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node\n" },
    external: ["playwright", "@anthropic-ai/sdk"],
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
  {
    entry: { "mcp/server": "src/mcp/server.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "node22",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node\n" },
    external: [
      "playwright",
      "@anthropic-ai/sdk",
      "@modelcontextprotocol/sdk",
      "zod",
    ],
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
]);
