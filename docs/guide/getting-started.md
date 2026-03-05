# Getting Started

## Prerequisites

### GitHub Packages Authentication

> **Private alpha:** Keylens is currently distributed through GitHub Packages. These one-time setup steps are required before installing.

1. **Authenticate with GitHub**

   ```bash
   gh auth login --scopes read:packages
   ```

2. **Configure the @telerik registry**

   ```bash
   echo "@telerik:registry=https://npm.pkg.github.com" >> ~/.npmrc
   ```

3. **Write the auth token to `~/.npmrc`**

   ```bash
   echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
   ```

### Runtime Requirements

- **Node.js 22+** is required.
- Keylens uses [Playwright](https://playwright.dev) to drive browsers. On first run, it will prompt you to install browser binaries if needed:

```bash
npx playwright install chromium
```

## Quick Start

Run a keyboard navigation audit on any URL without installing anything:

```bash
npx @telerik/keylens@dev audit https://your-site.com
```

## Installation

### Global

```bash
npm install -g @telerik/keylens@dev
```

### Project Dependency

```bash
npm install --save-dev @telerik/keylens@dev
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "test:keyboard": "keylens audit http://localhost:3000"
  }
}
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
