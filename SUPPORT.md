# Support policy

## Release status

Keylens is distributed through the public npm registry. The latest stable release is
supported; upgrade before reporting a defect.

The deterministic CLI, report schema, and programmatic core are the intended stable
surface. MCP and agent-skill contracts can change independently and
do not carry compatibility guarantees.

## Runtime support

| Surface           | Supported                                                                             |
| ----------------- | ------------------------------------------------------------------------------------- |
| Node.js           | 20 and later                                                                          |
| Module system     | ESM                                                                                   |
| Browser engines   | Chromium, Firefox, and WebKit revisions installed by the package's Playwright version |
| Browser mode      | Headless and headed                                                                   |
| Operating systems | Environments supported by the installed Playwright version                            |

Keylens tests Playwright-managed engines, not arbitrary system-browser versions.
Browser behavior and screenshots can differ by engine, operating system, fonts, device
scale, and headless/headed mode. Pin Node, dependencies, browser binaries, and runner
images for reproducible CI.

The `@telerik/keylens/guidance` subpath is browser-safe. The root package, CLI, and MCP
server require Node.js and must not be bundled for browser execution.

## Compatibility

Stable releases follow Semantic Versioning for the supported surface. Report JSON has
its own `schemaVersion`, so consumers should validate that field rather than infer
report compatibility from the package version.

## Getting help

Before opening an issue:

1. reproduce with the latest supported release;
2. include Node, OS, Keylens, Playwright, and browser-engine versions;
3. include the command/config with credentials removed;
4. attach semantic JSON where safe, after reviewing URLs, selectors, names, and HTML
   snippets for sensitive data;
5. state whether the behavior reproduces with interactions disabled.

Use [GitHub Issues](https://github.com/telerik/keylens/issues) for bugs and
documentation requests. Use the private process in [SECURITY.md](SECURITY.md) for
vulnerabilities. Support response times are not guaranteed.
