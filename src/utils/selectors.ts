import { TEXT_PREVIEW_LENGTH, HTML_PREVIEW_LENGTH } from "./constants.js";

/**
 * Injected into the browser to compute a unique CSS selector for an element.
 * This runs in the page context via page.evaluate().
 */
export const GET_UNIQUE_SELECTOR_SCRIPT = `
  (element) => {
    if (!element) return '';

    // Cache the computed selector per DOM node (identity-keyed, not string-keyed)
    // for the lifetime of the page. Pages commonly mutate attributes at runtime in
    // response to interaction - a "focus"/"active"/"selected" class, an id added
    // for aria-activedescendant wiring, aria-current toggling, etc. Recomputing
    // the selector from live attributes on every call would make it unstable
    // across discovery-time vs. later lookups (e.g. document.activeElement after
    // a Tab press) for any of those cases. Freezing it on first observation makes
    // the identifier stable regardless of what the page mutates afterwards.
    if (!window.__klrSelectorCache) window.__klrSelectorCache = new WeakMap();
    const cache = window.__klrSelectorCache;
    if (cache.has(element)) return cache.get(element);

    let result;
    if (element.id) {
      result = '#' + CSS.escape(element.id);
    } else {
      const parts = [];
      let current = element;

      while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
          selector = '#' + CSS.escape(current.id);
          parts.unshift(selector);
          break;
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => el.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }

        parts.unshift(selector);
        current = current.parentElement;
      }

      result = parts.join(' > ');
    }

    cache.set(element, result);
    return result;
  }
`;

/**
 * How many ancestor levels (beyond the immediate parent) to capture for
 * :focus-within diffing. :focus-within styling is commonly applied to a
 * wrapper several levels up (e.g. a form-group/fieldset around a
 * label+input), not just the direct parent, so checking only the immediate
 * parent misses those patterns and produces false "missing indicator"
 * violations. Capped (rather than walking to document.body) to bound the
 * cost of serializing full computed-style declarations for every focused
 * element on pages with deeply nested DOM trees.
 */
export const FOCUS_STYLE_ANCESTOR_DEPTH = 4;

/**
 * Max descendant elements to capture for :focus-within-style diffing in the
 * other direction — a focusable wrapper (e.g. a switch/checkbox root) that
 * paints its indicator on an inner decorative child via a `.wrapper:focus
 * .child { ... }` rule, rather than on itself. Bounded (breadth-first, not a
 * full subtree walk) so large composite widgets (grids, calendars) with
 * hundreds of descendants don't blow up per-element capture cost.
 */
export const FOCUS_STYLE_DESCENDANT_LIMIT = 20;

/**
 * Computes a FocusStyleSnapshot for a given element: the *entire* computed
 * style declaration (all longhand properties, not a curated subset) for the
 * element itself, its ::before/::after pseudo-elements, a chain of ancestors
 * up to FOCUS_STYLE_ANCESTOR_DEPTH levels (for :focus-within container
 * patterns), and up to FOCUS_STYLE_DESCENDANT_LIMIT descendants (for
 * indicators painted on an inner child instead of the focusable element
 * itself). Diffing full declarations avoids blind spots from hand-picking
 * properties — any CSS-expressible indicator (border-radius,
 * background-image/position, text-shadow, clip-path, letter-spacing, etc.)
 * shows up as a value difference somewhere. Runs in page context.
 */
export const GET_FOCUS_STYLE_SNAPSHOT_SCRIPT = `
  (el) => {
    const serialize = (style) => {
      const out = {};
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        out[prop] = style.getPropertyValue(prop);
      }
      return out;
    };
    const ancestors = [];
    let cur = el.parentElement;
    for (let depth = 0; cur && depth < ${FOCUS_STYLE_ANCESTOR_DEPTH}; depth++) {
      ancestors.push(serialize(window.getComputedStyle(cur)));
      cur = cur.parentElement;
    }
    const descendants = [];
    const queue = [el];
    while (queue.length && descendants.length < ${FOCUS_STYLE_DESCENDANT_LIMIT}) {
      const node = queue.shift();
      for (const child of node.children) {
        if (descendants.length >= ${FOCUS_STYLE_DESCENDANT_LIMIT}) break;
        descendants.push(serialize(window.getComputedStyle(child)));
        queue.push(child);
      }
    }
    return {
      self: serialize(window.getComputedStyle(el)),
      before: serialize(window.getComputedStyle(el, '::before')),
      after: serialize(window.getComputedStyle(el, '::after')),
      ancestors,
      descendants,
    };
  }
`;

/**
 * Computes a FocusStyleSnapshot for document.activeElement.
 * Runs in page context via page.evaluate().
 */
export const GET_ACTIVE_ELEMENT_STYLE_SNAPSHOT_SCRIPT = `
  () => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const getSnapshot = ${GET_FOCUS_STYLE_SNAPSHOT_SCRIPT};
    return getSnapshot(el);
  }
`;

/**
 * Computes a FocusStyleSnapshot for the element matching a CSS selector.
 * Used to read the style of an element that just lost focus — it's no
 * longer document.activeElement, so it must be re-located by selector.
 * Runs in page context via page.evaluate().
 */
export const GET_STYLE_SNAPSHOT_BY_SELECTOR_SCRIPT = `
  (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const getSnapshot = ${GET_FOCUS_STYLE_SNAPSHOT_SCRIPT};
    return getSnapshot(el);
  }
`;

/**
 * Script to extract info about the currently focused element.
 * Runs in page context.
 */
export const GET_FOCUSED_ELEMENT_INFO_SCRIPT = `
  () => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return null;
    }

    const rect = el.getBoundingClientRect();
    const getSelector = ${GET_UNIQUE_SELECTOR_SCRIPT};

    return {
      selector: getSelector(el),
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      accessibleName: el.getAttribute('aria-label')
        || el.getAttribute('aria-labelledby')
        || el.getAttribute('alt')
        || el.getAttribute('title')
        || el.textContent?.trim().substring(0, ${TEXT_PREVIEW_LENGTH})
        || '',
      boundingRect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      pageRect: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
      tabindexAttr: el.hasAttribute('tabindex')
        ? parseInt(el.getAttribute('tabindex'), 10)
        : null,
      outerHTML: el.outerHTML.substring(0, ${HTML_PREVIEW_LENGTH}),
      ariaAttributes: (function() {
        var attrs = {};
        for (var i = 0; i < el.attributes.length; i++) {
          var a = el.attributes[i];
          if (a.name.indexOf('aria-') === 0) {
            attrs[a.name] = a.value;
          }
        }
        return attrs;
      })(),
      parentContext: (function() {
        var landmarks = ['nav', 'main', 'header', 'footer', 'aside', 'form', 'dialog', 'section', 'article'];
        var roles = ['navigation', 'main', 'banner', 'contentinfo', 'complementary', 'form', 'dialog', 'region', 'search'];
        var cur = el.parentElement;
        while (cur && cur !== document.body) {
          var tag = cur.tagName.toLowerCase();
          if (landmarks.indexOf(tag) !== -1) return tag;
          var r = cur.getAttribute('role');
          if (r && roles.indexOf(r) !== -1) return r;
          cur = cur.parentElement;
        }
        return null;
      })(),
    };
  }
`;

/**
 * Script to find all interactive elements on the page.
 * Runs in page context.
 */
export const GET_INTERACTIVE_ELEMENTS_SCRIPT = `
  () => {
    const interactiveSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="menuitemradio"]',
      '[role="menuitemcheckbox"]',
      '[role="option"]',
      '[role="gridcell"]',
      '[role="treeitem"]',
      '[role="columnheader"]',
      '[role="rowheader"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="slider"]',
      '[role="switch"]',
      '[contenteditable]',
      'details > summary:first-of-type',
      'audio[controls]',
      'video[controls]',
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(','));
    const getSelector = ${GET_UNIQUE_SELECTOR_SCRIPT};

    // ARIA composite widgets (e.g. tablist, menu) use "roving tabindex": only the
    // active member is a Tab stop (tabindex="0"), the rest are tabindex="-1" and
    // reached via arrow keys, not Tab. Find the nearest such ancestor so the
    // unreachable-elements rule can avoid flagging these as keyboard-inaccessible.
    const rovingWidgetMemberRoles = [
      'tab', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'radio',
      'gridcell', 'treeitem', 'columnheader', 'rowheader',
    ];
    const rovingContainerRoles = [
      'tablist', 'menu', 'menubar', 'listbox', 'radiogroup', 'tree', 'treegrid',
      'grid', 'toolbar',
    ];
    // Native HTML elements carry an ARIA role implicitly (HTML-AAM spec) even
    // with no explicit role attribute - e.g. <input type="radio"> is "radio",
    // <a href> is "link". Checking getAttribute('role') alone misses every
    // native element relying on that implicit mapping, silently breaking
    // roving-tabindex detection for any widget built from real form controls
    // instead of role-bearing <div>/<span> elements. This table is fixed by
    // the HTML/ARIA spec, not a per-case guess, so it doesn't need
    // per-widget patches as new pages are discovered.
    const INPUT_TYPE_ROLES = {
      button: 'button', submit: 'button', reset: 'button', image: 'button',
      checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton',
      email: 'textbox', tel: 'textbox', text: 'textbox', url: 'textbox',
      password: 'textbox', search: 'searchbox',
    };
    const getImplicitRole = (el) => {
      const tag = el.tagName;
      if (tag === 'INPUT') {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (el.hasAttribute('list') && (type === 'text' || type === 'search')) {
          return 'combobox';
        }
        return INPUT_TYPE_ROLES[type] || null;
      }
      if (tag === 'BUTTON' || tag === 'SUMMARY') return 'button';
      if (tag === 'A' && el.hasAttribute('href')) return 'link';
      if (tag === 'SELECT') return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
      if (tag === 'OPTION') return 'option';
      if (tag === 'TEXTAREA') return 'textbox';
      return null;
    };
    const getEffectiveRole = (el) =>
      el.getAttribute('role') || getImplicitRole(el);
    const getRovingContainerSelector = (el) => {
      const role = getEffectiveRole(el);
      if (!role || rovingWidgetMemberRoles.indexOf(role) === -1) return null;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const parentRole = getEffectiveRole(parent);
        if (parentRole && rovingContainerRoles.indexOf(parentRole) !== -1) {
          return getSelector(parent);
        }
        parent = parent.parentElement;
      }
      return null;
    };

    // Check if an element is inside a disabled fieldset (but not inside its legend)
    const isInDisabledFieldset = (el) => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName === 'FIELDSET' && parent.disabled) {
          // Check if element is inside the fieldset's first legend
          const legend = parent.querySelector('legend');
          if (legend && legend.contains(el)) return false;
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    // aria-hidden="true" removes an element (and its subtree) from the
    // accessibility tree by definition - assistive tech is told to ignore it,
    // so it can never be a real keyboard-reachability requirement (e.g. a
    // hidden native <select> kept only for form-semantics behind a custom
    // combobox widget).
    const isAriaHidden = (el) => {
      let current = el;
      while (current) {
        if (current.getAttribute && current.getAttribute('aria-hidden') === 'true') return true;
        current = current.parentElement;
      }
      return false;
    };

    // Some widgets (e.g. calendar grids) mark purely structural filler/padding
    // cells with the same role as their real, functional cells (role="gridcell"
    // on both a real day and an empty out-of-range placeholder). A cell with no
    // tabindex, no accessible name, no text, and no element children carries no
    // operable content - it was never meant to be keyboard-reachable.
    const isEmptyStructuralCell = (el) => {
      const role = getEffectiveRole(el);
      if (['gridcell', 'columnheader', 'rowheader'].indexOf(role) === -1) return false;
      if (el.hasAttribute('tabindex')) return false;
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.children.length > 0) return false;
      return el.textContent.trim() === '';
    };

    return Array.from(elements)
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          el.offsetWidth <= 0 ||
          el.offsetHeight <= 0
        ) return false;

        // Skip elements inside disabled fieldsets (unless inside legend)
        if (isInDisabledFieldset(el)) return false;

        if (isAriaHidden(el)) return false;
        if (isEmptyStructuralCell(el)) return false;

        return true;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: getSelector(el),
          tagName: el.tagName.toLowerCase(),
          role: getEffectiveRole(el) || el.tagName.toLowerCase(),
          accessibleName: el.getAttribute('aria-label')
            || el.getAttribute('aria-labelledby')
            || el.getAttribute('alt')
            || el.getAttribute('title')
            || el.textContent?.trim().substring(0, ${TEXT_PREVIEW_LENGTH})
            || '',
          boundingRect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          reached: false,
          tabindexAttr: el.hasAttribute('tabindex')
            ? parseInt(el.getAttribute('tabindex'), 10)
            : null,
          outerHTML: el.outerHTML.substring(0, ${HTML_PREVIEW_LENGTH}),
          rovingContainerSelector: getRovingContainerSelector(el),
        };
      });
  }
`;
