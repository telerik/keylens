import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const testHome = vi.hoisted(() => ({ dir: "" }));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => testHome.dir };
});

import { ensureNoticeShown, _statePathForTests } from "@/telemetry/notice.js";

function makeWriter(): { writer: NodeJS.WritableStream; text(): string } {
  const chunks: string[] = [];
  return {
    writer: {
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    } as NodeJS.WritableStream,
    text: () => chunks.join(""),
  };
}

describe("telemetry notice", () => {
  beforeEach(() => {
    testHome.dir = mkdtempSync(join(tmpdir(), "keylens-notice-test-"));
  });

  afterEach(() => {
    rmSync(testHome.dir, { recursive: true, force: true });
  });

  it("shows the notice on the first call and persists state", () => {
    const { writer, text } = makeWriter();

    expect(ensureNoticeShown(writer)).toBe(true);
    expect(text()).toContain("Telemetry");
    expect(text()).toContain("anonymous, aggregate usage data");
    expect(existsSync(_statePathForTests())).toBe(true);
  });

  it("never shows the notice again once persisted", () => {
    const first = makeWriter();
    expect(ensureNoticeShown(first.writer)).toBe(true);

    const second = makeWriter();
    expect(ensureNoticeShown(second.writer)).toBe(false);
    expect(second.text()).toBe("");
  });

  it("never throws when the state directory can't be created", () => {
    // A path component that is actually a regular file (not a directory)
    // makes mkdirSync fail with ENOTDIR.
    const blocking = join(tmpdir(), `keylens-notice-blocker-${Date.now()}`);
    writeFileSync(blocking, "not a directory");
    testHome.dir = join(blocking, "nested");

    expect(ensureNoticeShown()).toBe(false);

    rmSync(blocking, { force: true });
  });
});
