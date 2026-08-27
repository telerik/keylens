# Security policy

## Report a vulnerability

Do not open a public issue for a suspected vulnerability. Use
[GitHub private vulnerability reporting](https://github.com/telerik/keylens/security/advisories/new)
to send the affected version, impact, reproduction steps, and any suggested mitigation.

Do not include production credentials, customer data, access tokens, or unnecessary
private-site content. You will receive acknowledgement through the advisory when the
maintainers review the report; no fixed response or remediation time is guaranteed.

## Supported versions

Keylens is currently prerelease software. Security fixes are provided for the latest
documented GitHub Packages prerelease only. `1.0.0` is not published.

## Security considerations for audits

Keylens drives a real browser against supplied URLs. Treat audited pages and generated
reports as untrusted or sensitive input:

- run against authorized targets only;
- use isolated test environments and least-privilege accounts;
- keep GitHub Packages credentials out of source control and reports;
- review HTML, JSON, Markdown, screenshots, selectors, accessible names, and URLs
  before sharing artifacts;
- keep experimental interactions disabled unless controls are known safe;
- use include selectors, destructive-action exclusion, navigation blocking, strict
  limits, and disposable test data when interactions are required;
- remember that browser automation can execute page JavaScript and make network
  requests from the runner.

Interaction safeguards are heuristic and do not guarantee that server-side effects are
prevented or rolled back.

## MCP

The experimental MCP server grants compatible agents the ability to initiate browser
audits and optionally write reports. Restrict which clients can launch it, control its
working directory and environment, and do not expose its stdio transport as an
unauthenticated network service.
