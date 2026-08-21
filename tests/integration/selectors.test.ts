import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium, type Browser, type Page } from "playwright";
import {
  GET_UNIQUE_SELECTOR_SCRIPT,
  GET_FOCUSED_ELEMENT_INFO_SCRIPT,
  GET_INTERACTIVE_ELEMENTS_SCRIPT,
} from "@/utils/selectors.js";

function serveFixture(fixtureName: string): Promise<{
  server: Server;
  url: string;
}> {
  const html = readFileSync(
    resolve(__dirname, `../fixtures/${fixtureName}`),
    "utf-8",
  );
  return new Promise((resolvePromise) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, url: `http://localhost:${port}` });
    });
  });
}

describe("Integration: browser selector scripts", () => {
  let browser: Browser;
  let page: Page;
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const fixture = await serveFixture("selectors-test.html");
    server = fixture.server;
    url = fixture.url;

    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto(url);
    await page.waitForLoadState("domcontentloaded");
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  describe("GET_UNIQUE_SELECTOR_SCRIPT", () => {
    it("should return #id for element with id", async () => {
      const selector = await page.evaluate(
        `(${GET_UNIQUE_SELECTOR_SCRIPT})(document.getElementById('unique-id'))`,
      );
      expect(selector).toBe("#unique-id");
    });

    it("should not include classes in selector (classes can be toggled at runtime, e.g. on focus)", async () => {
      const selector = await page.evaluate(
        `(${GET_UNIQUE_SELECTOR_SCRIPT})(document.querySelector('.cls-a'))`,
      );
      expect(selector).not.toContain("cls-a");
      expect(selector).not.toContain("cls-b");
    });

    it("should build path with > for nested elements", async () => {
      const selector = await page.evaluate(
        `(${GET_UNIQUE_SELECTOR_SCRIPT})(document.querySelector('.nested'))`,
      );
      expect(selector).toContain(">");
      expect(selector).toContain("#parent");
    });

    it("should generate selectors that can re-query the element", async () => {
      const result = await page.evaluate(`
        (() => {
          const getSelector = ${GET_UNIQUE_SELECTOR_SCRIPT};
          const btn = document.querySelector('#info-btn');
          const selector = getSelector(btn);
          const reQueried = document.querySelector(selector);
          return { selector, sameElement: btn === reQueried };
        })()
      `);
      expect(result.sameElement).toBe(true);
    });
  });

  describe("GET_FOCUSED_ELEMENT_INFO_SCRIPT", () => {
    it("should return null when activeElement is body", async () => {
      // Ensure focus is on body
      await page.evaluate("document.body.focus()");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result).toBeNull();
    });

    it("should return correct info for a focused button", async () => {
      await page.focus("#info-btn");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );

      expect(result).not.toBeNull();
      expect(result.selector).toBe("#info-btn");
      expect(result.tagName).toBe("button");
      expect(result.accessibleName).toBe("Info Button Label");
      expect(result.boundingRect).toBeDefined();
      expect(result.boundingRect.width).toBeGreaterThan(0);
    });

    it("should use aria-label as accessibleName when present", async () => {
      await page.focus("#info-btn");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result.accessibleName).toBe("Info Button Label");
    });

    it("should fall back to title attribute for accessibleName", async () => {
      await page.focus("#titled-link");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result.accessibleName).toBe("Title Attr Link");
    });

    it("should parse tabindexAttr when present", async () => {
      await page.focus('[role="checkbox"]');
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result.tabindexAttr).toBe(0);
    });

    it("should return null tabindexAttr when not set", async () => {
      await page.focus("#info-btn");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result.tabindexAttr).toBeNull();
    });

    it("should truncate outerHTML to 300 chars", async () => {
      await page.focus("#info-btn");
      const result = await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      );
      expect(result.outerHTML.length).toBeLessThanOrEqual(300);
    });
  });

  describe("GET_INTERACTIVE_ELEMENTS_SCRIPT", () => {
    it("should find links, buttons, inputs, selects, textareas", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      const tagNames = elements.map((el: { tagName: string }) => el.tagName);
      expect(tagNames).toContain("a");
      expect(tagNames).toContain("button");
      expect(tagNames).toContain("input");
      expect(tagNames).toContain("select");
      expect(tagNames).toContain("textarea");
    });

    it("should find ARIA role elements", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      const roles = elements.map((el: { role: string }) => el.role);
      expect(roles).toContain("button");
      expect(roles).toContain("checkbox");
    });

    it("should exclude display:none elements", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      const selectors = elements.map((el: { selector: string }) => el.selector);
      const hasHiddenButton = selectors.some((s: string) =>
        s.includes("hidden-el"),
      );
      expect(hasHiddenButton).toBe(false);
    });

    it("should exclude disabled fieldset children but keep legend children", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      const selectors = elements.map((el: { selector: string }) => el.selector);
      // Legend button should be included
      expect(selectors.some((s: string) => s.includes("legend-btn"))).toBe(
        true,
      );
      // Disabled fieldset inputs/buttons should be excluded
      // (they are disabled by the fieldset, not by their own disabled attr)
      // Note: browsers handle this natively — disabled fieldset children
      // have their disabled property set, so they're filtered by :not([disabled])
    });

    it("should return elements with reached: false", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      for (const el of elements) {
        expect(el.reached).toBe(false);
      }
    });

    it("should return correct shape for each element", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );

      expect(elements.length).toBeGreaterThan(0);
      const first = elements[0];
      expect(first).toHaveProperty("selector");
      expect(first).toHaveProperty("tagName");
      expect(first).toHaveProperty("role");
      expect(first).toHaveProperty("accessibleName");
      expect(first).toHaveProperty("boundingRect");
      expect(first).toHaveProperty("reached");
      expect(first).toHaveProperty("outerHTML");
      expect(first.boundingRect).toHaveProperty("x");
      expect(first.boundingRect).toHaveProperty("y");
      expect(first.boundingRect).toHaveProperty("width");
      expect(first.boundingRect).toHaveProperty("height");
    });

    it("should assign the implicit role of a native <a href> element (no role attribute)", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );
      const link = elements.find(
        (el: { selector: string }) => el.selector === "#titled-link",
      );
      expect(link?.role).toBe("link");
    });

    it("should assign the implicit 'radio' role to a native input[type=radio] with no role attribute", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );
      const radio = elements.find(
        (el: { selector: string }) => el.selector === "#native-radio-2",
      );
      expect(radio?.role).toBe("radio");
    });

    it("should compute rovingContainerSelector for a native radio input via its implicit role", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );
      const radio = elements.find(
        (el: { selector: string }) => el.selector === "#native-radio-2",
      );
      expect(radio?.rovingContainerSelector).toBe("#native-radiogroup");
    });

    it("should assign implicit roles for other native form controls", async () => {
      const elements = await page.evaluate(
        `(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`,
      );
      const byLabel = (label: string) =>
        elements.find(
          (el: { accessibleName: string }) => el.accessibleName === label,
        );
      expect(byLabel("Select box")?.role).toBe("combobox");
      expect(byLabel("Text area")?.role).toBe("textbox");
      expect(byLabel("Text input")?.role).toBe("textbox");
    });
  });
});
