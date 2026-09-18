import { defineConfig } from "tsup";
import { readFileSync, rmSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
rmSync("./dist", { recursive: true, force: true });

// Never a literal secret in source: only set in the CI publish workflow's
// environment. Local/dev builds omit it, which keeps telemetry dormant by
// default (see src/telemetry/call-home-client.ts).
const TELEMETRY_API_KEY = process.env.KEYLENS_TELEMETRY_IDENTITY_API_KEY ?? "";
// Same rule as the API key: no literal URL anywhere in source. These must
// come from the CI environment (or a local override for testing); an empty
// value here means a real build has no token URL/endpoint and telemetry
// stays inert (see src/telemetry/call-home-client.ts).
const TELEMETRY_TOKEN_URL = process.env.KEYLENS_TELEMETRY_TOKEN_URL ?? "";
const TELEMETRY_ENDPOINT = process.env.KEYLENS_TELEMETRY_ENDPOINT ?? "";

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
      __TELEMETRY_API_KEY__: JSON.stringify(TELEMETRY_API_KEY),
      __TELEMETRY_TOKEN_URL__: JSON.stringify(TELEMETRY_TOKEN_URL),
      __TELEMETRY_ENDPOINT__: JSON.stringify(TELEMETRY_ENDPOINT),
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
      __TELEMETRY_API_KEY__: JSON.stringify(TELEMETRY_API_KEY),
      __TELEMETRY_TOKEN_URL__: JSON.stringify(TELEMETRY_TOKEN_URL),
      __TELEMETRY_ENDPOINT__: JSON.stringify(TELEMETRY_ENDPOINT),
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
      __TELEMETRY_API_KEY__: JSON.stringify(TELEMETRY_API_KEY),
      __TELEMETRY_TOKEN_URL__: JSON.stringify(TELEMETRY_TOKEN_URL),
      __TELEMETRY_ENDPOINT__: JSON.stringify(TELEMETRY_ENDPOINT),
    },
  },
]);
