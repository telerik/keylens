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
- **Detects**: Tab order that significantly diverges from DOM (content) order (tolerance: 3+ position difference). Does NOT compare against visual/pixel layout — WCAG 2.4.3 explicitly allows focus order to differ from visual layout (e.g. a nav sidebar fully before main content)
- **Common causes**: Positive `tabindex` values or scripted focus management reordering the tab sequence away from DOM order
- **Fix**: Remove positive tabindex values; rely on natural DOM order for focus sequence

## tabindex-abuse

- **WCAG**: 2.4.3 Focus Order
- **Severity**: warning
- **Detects**: Elements with positive `tabindex` values (tabindex > 0)
- **Common causes**: Attempts to manually control focus order via tabindex="1", tabindex="2", etc.
- **Fix**: Remove positive tabindex values; rely on DOM order for focus sequence

## missing-focus-indicator

- **WCAG**: 2.4.7 Focus Visible
- **Severity**: error
- **Detects**: Elements that receive focus but show no visible focus indicator (computed-style diff between focused/unfocused states, always on — no flag needed)
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

## roving-tabindex-broken

- **WCAG**: 2.1.1 Keyboard
- **Severity**: warning
- **Detects**: Composite widget members (tabs, menu items, listbox options, etc.) declared with the roving-tabindex pattern (`tabindex="-1"` on inactive members) that are NOT actually reachable via arrow keys from the active member — verified by simulating real key presses, not just inferred from markup
- **Common causes**: Missing or broken keydown handler on the composite container; wrong assumed arrow-key direction (e.g. handling only Left/Right on a vertically-oriented widget)
- **Fix**: Attach a keydown handler on the container that moves DOM focus (and updates `tabindex`) between members on the arrow keys appropriate for the widget's role/orientation (see WAI-ARIA APG keyboard interaction patterns for tablist/menu/listbox/tree/toolbar/radiogroup)

## focus-after-interaction

- **WCAG**: 2.4.3 / 2.4.7
- **Severity**: error
- **Detects**: Focus lost to `<body>` after clicking buttons or `role="button"` elements
- **Common causes**: JavaScript removes or replaces the clicked element without managing focus, dynamic content insertion without focus management
- **Fix**: After removing/replacing interactive elements, programmatically move focus to a logical next element
