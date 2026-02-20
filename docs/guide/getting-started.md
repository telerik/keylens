# Getting Started

## Quick Start

Run a keyboard navigation audit on any URL without installing anything:

```bash
npx @telerik/keylens audit https://your-site.com
```

## Installation

### Global

```bash
npm install -g @telerik/keylens
```

### Project Dependency

```bash
npm install --save-dev @telerik/keylens
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "test:keyboard": "keylens audit http://localhost:3000"
  }
}
```

## Prerequisites

- **Node.js 22+** is required.
- Keylens uses [Playwright](https://playwright.dev) to drive browsers. On first run, it will prompt you to install browser binaries if needed:

```bash
npx playwright install chromium
```

## Your First Audit

```bash
keylens audit https://example.com
```

This will:

1. Launch a headless Chromium browser
2. Navigate to the URL and capture a full-page screenshot
3. Test skip link functionality (if present)
4. Discover all interactive elements on the page
5. Press Tab through every focusable element, recording the focus sequence
6. Run all 8 rules against the crawl results
7. Print results to your terminal

## Multi-Page Scanning

To audit multiple pages in a single run, set `urls` in your config file:

```json
{
  "urls": ["https://example.com", "https://example.com/about"],
  "reporters": ["cli", "html"]
}
```

Then run without a URL argument:

```bash
keylens audit --config keylens.config.json
```

The HTML report will include a tabbed interface with a focus order map for each page.

## Next Steps

- [CLI Reference](/guide/cli) — All flags and options
- [Configuration](/guide/configuration) — Config file setup
- [AI Features](/guide/ai) — Enable AI-powered analysis
- [Rules](/rules/) — What Keylens checks for
