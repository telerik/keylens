# Contributing to Keylens

## Introduction

These guidelines exist to make your contribution experience smooth and to streamline the process of getting changes triaged, merged and released. Any contribution helps, even an issue report or a documentation fix.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting Bugs

1. Always test against the most recent version of Keylens; the bug may already be fixed.
2. Search the [existing issues](https://github.com/telerik/keylens/issues) before filing a new one. It may already be reported.
3. Verify the bug is reproducible with a minimal page or a public URL, and run the audit with the `--verbose` flag.
4. If the issue is clear and unlikely to require discussion, open a GitHub issue using the [Bug Report template](https://github.com/telerik/keylens/issues/new?template=bug_report.yml) and include:
   - Keylens version
   - Node.js version and operating system
   - Playwright and browser-engine versions
   - The command or config used (with credentials removed)
   - The URL you were auditing, or a short reproduction page
   - Expected vs. actual behavior, plus the terminal output

## Code Fixes and Enhancements

### Log an Issue First

Before suggesting any change, open an issue describing the bug or enhancement. Check whether one already exists. Please include:

- The problem you want solved
- The keyboard behavior or WCAG success criterion involved
- An example page where it occurs

The Keylens team will review it, give early feedback, and decide how and when it is addressed. This keeps the rule set, scoring, report schema and telemetry consistent across releases.

## Reporting Security Issues

Do not use public issues for vulnerabilities. Follow the private process in [SECURITY.md](SECURITY.md).

## Getting Help

See [SUPPORT.md](SUPPORT.md). Response times are not guaranteed.

## License

By contributing to Keylens you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
