/**
 * Injected into the browser to compute a unique CSS selector for an element.
 * This runs in the page context via page.evaluate().
 */
export const GET_UNIQUE_SELECTOR_SCRIPT = `
  (element) => {
    if (!element) return '';
    if (element.id) return '#' + CSS.escape(element.id);

    const parts = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = '#' + CSS.escape(current.id);
        parts.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\s+/).slice(0, 2);
        if (classes.length > 0 && classes[0] !== '') {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
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

    return parts.join(' > ');
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
        || el.textContent?.trim().substring(0, 100)
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
      outerHTML: el.outerHTML.substring(0, 300),
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
            || el.textContent?.trim().substring(0, 100)
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
          outerHTML: el.outerHTML.substring(0, 300),
        };
      });
  }
`;
