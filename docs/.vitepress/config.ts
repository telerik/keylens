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
    ["meta", { name: "twitter:card", content: "summary" }],
  ],
  cleanUrls: true,
  sitemap: {
    hostname: "https://telerik.github.io/keylens/",
  },
  lastUpdated: true,
  themeConfig: {
    search: {
      provider: "local",
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
          { text: "Migration Guide", link: "/guide/ga-migration" },
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
        ],
      },
      {
        text: "Project",
        items: [
          {
            text: "Support Policy",
            link: "https://github.com/telerik/keylens/blob/master/SUPPORT.md",
          },
          {
            text: "Security",
            link: "https://github.com/telerik/keylens/blob/master/SECURITY.md",
          },
          {
            text: "Changelog",
            link: "https://github.com/telerik/keylens/blob/master/CHANGELOG.md",
          },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/telerik/keylens" },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Keylens Contributors",
    },
  },
});
