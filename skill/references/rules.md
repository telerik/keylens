# Keylens Rules Reference

## keyboard-trap

- **WCAG**: 2.1.2 No Keyboard Trap
- **Severity**: error
- **Detects**: Elements where focus gets stuck (cannot Tab or Shift+Tab away)
- **Common causes**: Modal dialogs without close handler, custom widgets trapping focus without Escape key support
- **Fix**: Ensure all focused elements allow Tab/Shift+Tab navigation; modals should trap focus intentionally but release on Escape

## unreachable-elements

- **WCAG**: 2.1.1 Keyboard
- **Severity**: error
- **Detects**: Interactive elements (buttons, links, inputs) that exist in the DOM but are never reached via Tab
- **Common causes**: `tabindex="-1"` on interactive elements, custom elements without tabindex, elements hidden behind overlays
- **Fix**: Use native interactive elements (`<button>`, `<a href>`, `<input>`) or add `tabindex="0"` to custom interactive elements

## focus-order-mismatch

- **WCAG**: 2.4.3 Focus Order
- **Severity**: warning
- **Detects**: Tab order that significantly diverges from visual layout order (tolerance: 3+ position difference)
- **Common causes**: CSS reordering (flexbox `order`, grid placement, absolute positioning) without matching DOM order
- **Fix**: Align DOM order with visual order, or use `tabindex` carefully to correct the sequence

## tabindex-abuse

- **WCAG**: 2.4.3 Focus Order
- **Severity**: warning
- **Detects**: Elements with positive `tabindex` values (tabindex > 0)
- **Common causes**: Attempts to manually control focus order via tabindex="1", tabindex="2", etc.
- **Fix**: Remove positive tabindex values; rely on DOM order for focus sequence

## missing-focus-indicator

- **WCAG**: 2.4.7 Focus Visible
- **Severity**: error (when confirmed via screenshot diff) or warning (CSS heuristic only)
- **Detects**: Elements that receive focus but show no visible focus indicator
- **Common causes**: `outline: none` / `outline: 0` in CSS without replacement styles, transparent outlines, browser default overridden
- **Fix**: Add visible `:focus-visible` styles (outline, box-shadow, or border change)

## skip-link

- **WCAG**: 2.4.1 Bypass Blocks
- **Severity**: warning (missing) or error (present but non-functional)
- **Detects**: Missing skip navigation link, or skip link that doesn't move focus to main content
- **Common causes**: No skip link at all, skip link href doesn't match any element ID, target element not focusable
- **Fix**: Add `<a href="#main-content" class="skip-link">Skip to content</a>` as first focusable element; ensure target has `id` and is focusable

## focus-not-obscured

- **WCAG**: 2.4.11 Focus Not Obscured
- **Severity**: error
- **Detects**: Focused elements hidden behind sticky headers, fixed footers, or overlay content
- **Common causes**: Sticky navigation bars, cookie banners, chat widgets covering focused elements
- **Fix**: Use `scroll-padding-top`/`scroll-padding-bottom` to account for fixed elements, or dynamically scroll focused elements into visible area

## focus-after-interaction

- **WCAG**: 2.4.3 / 2.4.7
- **Severity**: error
- **Detects**: Focus lost to `<body>` after clicking buttons or `role="button"` elements
- **Common causes**: JavaScript removes or replaces the clicked element without managing focus, dynamic content insertion without focus management
- **Fix**: After removing/replacing interactive elements, programmatically move focus to a logical next element
