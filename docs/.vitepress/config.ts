import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Keylens",
  description:
    "Keyboard navigation testing CLI. See your site through the lens of keyboard users.",
  base: "/",
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],
  themeConfig: {
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
          { text: "AI Features", link: "/guide/ai" },
          { text: "MCP Server", link: "/guide/mcp" },
          { text: "Agent Skill", link: "/guide/agent-skill" },
          { text: "CI/CD Integration", link: "/guide/ci-cd" },
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
        text: "API",
        items: [{ text: "Programmatic Usage", link: "/api/" }],
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
