import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canShowFullBanner,
  hasSeenWelcome,
  renderAuditBanner,
  renderWelcome,
} from "@/cli/banner";

const wideTTY = { isTTY: true, columns: 120, env: {} };
const LOGO_MARKER = "██╗  ██╗";

describe("CLI banner", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "keylens-banner-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("only shows the ASCII logo in a wide interactive terminal outside CI", () => {
    expect(canShowFullBanner(wideTTY)).toBe(true);
    expect(canShowFullBanner({ ...wideTTY, isTTY: false })).toBe(false);
    expect(canShowFullBanner({ ...wideTTY, columns: 40 })).toBe(false);
    expect(canShowFullBanner({ ...wideTTY, env: { CI: "true" } })).toBe(false);
  });

  it("shows the logo on the first audit only, then the compact banner", () => {
    const first = renderAuditBanner("1.2.3", wideTTY, stateDir);
    expect(first).toContain(LOGO_MARKER);
    expect(hasSeenWelcome(stateDir)).toBe(true);

    const second = renderAuditBanner("1.2.3", wideTTY, stateDir);
    expect(second).not.toContain(LOGO_MARKER);
    expect(second).toContain("Keylens");
    expect(second).toContain("v1.2.3");
  });

  it("does not consume the first-run logo when output is not a TTY", () => {
    const banner = renderAuditBanner(
      "1.2.3",
      { ...wideTTY, isTTY: false },
      stateDir,
    );
    expect(banner).not.toContain(LOGO_MARKER);
    expect(hasSeenWelcome(stateDir)).toBe(false);
  });

  it("includes quick-start commands in the welcome screen", () => {
    const welcome = renderWelcome("1.2.3", { ...wideTTY, columns: 40 });
    expect(welcome).not.toContain(LOGO_MARKER);
    expect(welcome).toContain("keylens audit https://example.com");
    expect(welcome).toContain("keylens init");
  });
});
