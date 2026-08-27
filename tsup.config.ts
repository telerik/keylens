import { defineConfig } from "tsup";
import { readFileSync, rmSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
rmSync("./dist", { recursive: true, force: true });

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "node26",
    outDir: "dist",
    external: ["playwright"],
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
  {
    entry: { guidance: "src/guidance.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "es2022",
    platform: "neutral",
    outDir: "dist",
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "node26",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node\n" },
    external: ["playwright"],
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
    target: "node26",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node\n" },
    external: ["playwright", "@modelcontextprotocol/sdk", "zod"],
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
]);
