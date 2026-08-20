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
    const getRovingContainerSelector = (el) => {
      const role = el.getAttribute('role');
      if (!role || rovingWidgetMemberRoles.indexOf(role) === -1) return null;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const parentRole = parent.getAttribute('role');
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

        return true;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
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
