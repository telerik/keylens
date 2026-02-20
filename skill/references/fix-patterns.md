# Common Fix Patterns

## Keyboard Trap — Add Escape key handler

```html
<!-- Before: modal traps focus with no escape -->
<div class="modal" tabindex="-1">...</div>

<!-- After: Escape closes the modal -->
<div class="modal" tabindex="-1" role="dialog" aria-modal="true">...</div>
```

```js
dialog.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDialog();
    triggerButton.focus(); // Return focus to trigger
  }
});
```

## Unreachable Elements — Use native elements or tabindex

```html
<!-- Before: custom div not keyboard-reachable -->
<div class="btn" onclick="doSomething()">Click me</div>

<!-- After: use native button -->
<button class="btn" onclick="doSomething()">Click me</button>

<!-- Or add tabindex + keyboard handler -->
<div
  class="btn"
  tabindex="0"
  role="button"
  onclick="doSomething()"
  onkeydown="if(event.key==='Enter'||event.key===' ')doSomething()"
>
  Click me
</div>
```

## Focus Indicator — Add visible :focus-visible styles

```css
/* Before: focus indicator removed */
button:focus {
  outline: none;
}

/* After: visible focus indicator */
button:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* Alternative using box-shadow (works on rounded elements) */
button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 95, 204, 0.5);
}
```

## Skip Link — Add bypass navigation

```html
<!-- Add as first child of <body> -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Target element -->
<main id="main-content" tabindex="-1">...</main>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: #005fcc;
  color: white;
  z-index: 100;
}
.skip-link:focus {
  top: 0;
}
```

## Tabindex Abuse — Remove positive values

```html
<!-- Before: manually ordered tabindex -->
<input tabindex="2" />
<button tabindex="1">Submit</button>

<!-- After: rely on DOM order -->
<button>Submit</button>
<input />
```

## Focus After Interaction — Manage focus on element removal

```js
// Before: element removed, focus lost to <body>
button.addEventListener("click", () => {
  button.parentElement.removeChild(button);
});

// After: move focus before removing
button.addEventListener("click", () => {
  const next = button.nextElementSibling || button.parentElement;
  button.parentElement.removeChild(button);
  next.focus();
});
```

## Focus Not Obscured — Account for sticky elements

```css
/* Ensure focused elements scroll clear of sticky headers */
html {
  scroll-padding-top: 80px; /* height of sticky header */
}

/* Or per-element */
:focus {
  scroll-margin-top: 80px;
}
```
