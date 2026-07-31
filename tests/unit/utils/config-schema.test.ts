import { readFileSync } from "fs";
import { resolve } from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { validateConfigInput } from "@/utils/config.js";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const jsonSchema = JSON.parse(
  readFileSync(resolve(process.cwd(), "keylens.config.schema.json"), "utf8"),
) as object;
const validateJsonSchema = ajv.compile(jsonSchema);

function runtimeAccepts(value: unknown): boolean {
  try {
    validateConfigInput(value);
    return true;
  } catch {
    return false;
  }
}

describe("config schema parity", () => {
  it.each([
    {},
    { $schema: "./keylens.config.schema.json", profile: "fast" },
    { waitForSelector: "#ready", outputDir: "./reports" },
    { interactions: { include: ["button"], timeout: 0.5 } },
    { capture: { limits: { maxBytes: 1024 } } },
    { ai: { model: "gpt-4o", baseURL: "https://example.com/v1" } },
    { ai: { limits: { batchSize: 3, maxWidgets: 4, maxElements: 5 } } },
    { rules: { keyboardTrap: false } },
  ])("accepts the same valid file input: %j", (value) => {
    expect(
      validateJsonSchema(value),
      JSON.stringify(validateJsonSchema.errors),
    ).toBe(true);
    expect(runtimeAccepts(value)).toBe(true);
  });

  it.each([
    { profile: "turbo" },
    { rules: { typo: true } },
    { waitForSelector: "" },
    { outputDir: "" },
    { interactions: { include: [""] } },
    { capture: { limits: { maxBytes: 1.5 } } },
    { ai: { baseURL: "not a URL" } },
    { ai: { limits: { batchSize: 1.5 } } },
    { ai: { transport: "not allowed in JSON" } },
  ])("rejects the same invalid file input: %j", (value) => {
    expect(validateJsonSchema(value)).toBe(false);
    expect(runtimeAccepts(value)).toBe(false);
  });
});
