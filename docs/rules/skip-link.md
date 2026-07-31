# Skip Link

| Property | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| ID       | `skip-link`                                                                           |
| Severity | Warning / Error                                                                       |
| WCAG     | [2.4.1 Bypass Blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html) |

## What it checks

Looks for a skip-navigation pattern and checks that activation leaves focus on a
non-document element.

## How it works

Keylens uses two detection methods, preferring the functional test when available:

### Functional Test (crawler)

Before the main tab crawl, the crawler:

1. Tabs through the first 5 focusable elements
2. Checks each element against skip link patterns (e.g., "skip to content", "jump to main")
3. If found, presses **Enter** on the skip link
4. Records whether focus is on a known main target, a descendant, an element ID, or
   another element tag

**Results:**

- Skip link found and focus is not on `<body>`/the document → **Pass**
- Skip link found but focus is lost to the document → **Error**
- No skip link found → **Warning**

### Heuristic Fallback

When the functional test is not available, the rule scans the first 5 elements in the focus sequence for skip link patterns in their accessible name or HTML.

The current functional check does not prove that the destination is main content or
matches the link fragment; a link that retains focus can pass. Confirm the recorded
target manually.

### Skip Link Patterns

The following regex patterns are matched against element text and HTML:

- `skip.*(?:nav|content|main)`
- `jump.*(?:nav|content|main)`
- `go.*to.*(?:content|main)`
- `skip.*to`

## Examples

### Pass

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
<!-- ... navigation ... -->
<main id="main-content" tabindex="-1">
  <!-- main content -->
</main>
```

### Fail (missing)

```html
<!-- No skip link at all -->
<nav>
  <a href="/home">Home</a>
  <a href="/about">About</a>
  <!-- 20 more nav links... -->
</nav>
```

### Fail (broken)

```html
<!-- Skip link points to non-existent target -->
<a href="#content" class="skip-link">Skip to content</a>
<main id="main-content"><!-- wrong ID --></main>
```

## How to fix

- Add a skip link as the first focusable element on the page
- Point it to the main content area via an `href` fragment (`#main-content`)
- Ensure the target element has `tabindex="-1"` so it can receive focus programmatically
- The skip link can be visually hidden until focused using CSS
