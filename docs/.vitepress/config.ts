import { defineConfig } from "vitepress";

// Override for deploys not served under /keylens/ (e.g. root-served previews).
const base = process.env.DOCS_BASE ?? "/keylens/";

export default defineConfig({
  title: "Keylens",
  description:
    "Keyboard navigation testing with real browsers. Press Tab and record what actually happens.",
  base,
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: `${base}logo.svg`,
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Keylens" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Keyboard navigation testing with real browsers. Press Tab and record what actually happens.",
      },
    ],
    // Matches the sitemap hostname below: the public URL this site will be
    // served at once the repo goes public, not wherever it's previewed from.
    [
      "meta",
      {
        property: "og:image",
        content: "https://telerik.github.io/keylens/og-image.png",
      },
    ],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://telerik.github.io/keylens/og-image.png",
      },
    ],
    ["meta", { name: "theme-color", content: "#3d57d8" }],
  ],
  cleanUrls: true,
  // VISION.md is an internal roadmap/go-to-market doc, not linked from any
  // nav or sidebar; kept in docs/ only so tests/unit/docs-drift.test.ts can
  // cross-check it against source. Exclude it from the built site so it
  // never ships as an orphaned, sitemapped public page.
  srcExclude: ["VISION.md"],
  sitemap: {
    hostname: "https://telerik.github.io/keylens/",
  },
  lastUpdated: true,
  themeConfig: {
    search: {
      provider: "local",
    },
    outline: "deep",
    editLink: {
      pattern: "https://github.com/telerik/keylens/edit/develop/docs/:path",
      text: "Edit this page on GitHub",
    },
    docFooter: {
      prev: "Previous page",
      next: "Next page",
    },
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Rules", link: "/rules/" },
      { text: "API", link: "/api/" },
      {
        text: "GitHub",
        link: "https://github.com/telerik/keylens",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "CLI Reference", link: "/guide/cli" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Programmatic API", link: "/api/" },
          { text: "CI/CD", link: "/guide/ci-cd" },
          { text: "Performance", link: "/guide/performance" },
          { text: "Known Limitations", link: "/guide/limitations" },
        ],
      },
      {
        text: "Experimental",
        items: [
          { text: "MCP Server", link: "/guide/mcp" },
          { text: "Agent Skill", link: "/guide/agent-skill" },
        ],
      },
      {
        text: "Rules",
        items: [
          { text: "Overview", link: "/rules/" },
          { text: "Keyboard Trap", link: "/rules/keyboard-trap" },
          { text: "Unreachable Elements", link: "/rules/unreachable-elements" },
          { text: "Focus Order Mismatch", link: "/rules/focus-order-mismatch" },
          { text: "Tabindex Abuse", link: "/rules/tabindex-abuse" },
          {
            text: "Missing Focus Indicator",
            link: "/rules/missing-focus-indicator",
          },
          { text: "Skip Link", link: "/rules/skip-link" },
          { text: "Focus Not Obscured", link: "/rules/focus-not-obscured" },
          {
            text: "Focus After Interaction",
            link: "/rules/focus-after-interaction",
          },
          {
            text: "Broken Roving Tabindex Navigation",
            link: "/rules/roving-tabindex-broken",
          },
        ],
      },
      {
        text: "Project",
        items: [
          {
            text: "Support Policy",
            link: "https://github.com/telerik/keylens/blob/develop/SUPPORT.md",
          },
          {
            text: "Security",
            link: "https://github.com/telerik/keylens/blob/develop/SECURITY.md",
          },
          {
            text: "Telemetry",
            link: "https://github.com/telerik/keylens/blob/develop/src/telemetry/README.md",
          },
          {
            text: "Changelog",
            link: "https://github.com/telerik/keylens/blob/develop/CHANGELOG.md",
          },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/telerik/keylens" },
    ],
    footer: {
      message: "Released under the Apache License 2.0.",
      copyright: "Copyright © 2026 Progress Software Corporation",
    },
  },
});
