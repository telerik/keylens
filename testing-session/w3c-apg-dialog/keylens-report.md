# Keylens Keyboard Navigation Report

- **URL:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/
- **Version:** 0.1.0
- **Timestamp:** 2026-08-12T18:47:30.246Z

## Summary

| Errors | Warnings | Info | Rules Passed | Rules Failed | Score  |
| ------ | -------- | ---- | ------------ | ------------ | ------ |
| 8      | 2        | 0    | 4            | 4            | 81/100 |

## Crawl

| Focusable Elements | Interactive Elements | Unreached | Cycle Completed | Duration |
| ------------------ | -------------------- | --------- | --------------- | -------- |
| 61                 | 52                   | 0         | Yes             | 46.10s   |

## Focus Sequence

| #   | Tag             | Role            | Name                                               | Selector                                                       | Context |
| --- | --------------- | --------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------- |
| 1   | a               | a               | ARIA Authoring Practices Guide (APG)               | `#site-header > div.minimal-header-info:nth-of-type(1) > div…` | header  |
| 2   | a               | a               | W3C homepage                                       | `#site-header > div.minimal-header-logo:nth-of-type(2) > div…` | header  |
| 3   | a               | a               | Web Accessibility Initiative (WAI) homepage        | `#site-header > div.minimal-header-logo:nth-of-type(2) > div…` | header  |
| 4   | a               | a               | APG Home                                           | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` | nav     |
| 5   | a               | a               | Patterns                                           | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` | nav     |
| 6   | a               | a               | Practices                                          | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` | nav     |
| 7   | a               | a               | Index                                              | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` | nav     |
| 8   | a               | a               | About                                              | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` | nav     |
| 9   | a               | a               | Read This First                                    | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 10  | a               | a               | About This Example                                 | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 11  | a               | a               | Example                                            | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 12  | a               | a               | Accessibility Features                             | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 13  | a               | a               | Keyboard Support                                   | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 14  | a               | a               | Role, Property, State, and Tabindex Attributes     | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 15  | a               | a               | Assistive Technology Support                       | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 16  | a               | a               | JavaScript and CSS Source Code                     | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 17  | a               | a               | HTML Source Code                                   | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` | nav     |
| 18  | summary         | summary         | The code in this example is not intended for prod… | `#support-notice > summary`                                    | main    |
| 19  | a               | a               | Dialog (Modal) Pattern                             | `#main > div > div > section:nth-of-type(1) > p:nth-of-type(…` | section |
| 20  | a               | a               | Alert Dialog Example                               | `#main > div > div > section:nth-of-type(1) > ul > li:nth-of…` | section |
| 21  | a               | a               | Date Picker Dialog example                         | `#main > div > div > section:nth-of-type(1) > ul > li:nth-of…` | section |
| 22  | button          | button          | Open In CodePen                                    | `#ex_label-codepenbutton`                                      | form    |
| 23  | button          | button          | Add Delivery Address                               | `#ex1 > button`                                                | section |
| 24  | a               | a               | Learn how to interpret and use assistive technolo… | `#at-support > p > a`                                          | section |
| 25  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 26  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 27  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 28  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 29  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 30  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 31  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 32  | iframe          | iframe          |                                                    | `#at-support > iframe.support-levels-modal-dialog`             | section |
| 33  | a               | a               | dialog.css                                         | `#css_js_files > li:nth-of-type(1) > a`                        | section |
| 34  | a               | a               | dialog.js                                          | `#css_js_files > li:nth-of-type(2) > a:nth-of-type(1)`         | section |
| 35  | a               | a               | utils.js                                           | `#css_js_files > li:nth-of-type(2) > a:nth-of-type(2)`         | section |
| 36  | button          | button          | Open In CodePen                                    | `#sc1_description-codepenbutton`                               | form    |
| 37  | a               | a               | public-aria-practices@w3.org                       | `#helpimprove > div.box-i > p > a`                             | aside   |
| 38  | a               | a               | E-mail                                             | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` | aside   |
| 39  | a               | a               | Fork & Edit on GitHub                              | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` | aside   |
| 40  | a               | a               | New GitHub Issue                                   | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` | aside   |
| 41  | a               | a               | Back to Top                                        | `a.button.button-backtotop:nth-of-type(2)`                     |         |
| 42  | a               | a               | View issues related to this example                | `#wai-site-footer > div.inner > div.example-page-footer > p:…` | footer  |
| 43  | a               | a               | W3C Web Accessibility Initiative (WAI)             | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 44  | a               | a               | Get News in Email                                  | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 45  | a               | a               | LinkedIn                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 46  | a               | a               | Mastodon                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 47  | a               | a               | YouTube                                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 48  | a               | a               | Home                                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 49  | a               | a               | Contact                                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 50  | a               | a               | Site map                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 51  | a               | a               | Support WAI                                        | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 52  | a               | a               | News                                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 53  | a               | a               | Accessibility statement                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 54  | a               | a               | All Translations                                   | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 55  | a               | a               | Resources for roles                                | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 56  | a               | a               | World Wide Web Consortium                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 57  | a               | a               | liability                                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 58  | a               | a               | trademark                                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 59  | a               | a               | W3C Software License                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 60  | a               | a               | Permission to Use WAI Material                     | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` | footer  |
| 61  | skip-to-content | skip-to-content |                                                    | `skip-to-content`                                              |         |

## Skip Link

- **warning**: No skip navigation link found among the first focusable elements. Keyboard users must tab through all navigation items to reach main content.

## Rules

### Keyboard Trap [FAIL]

Detects elements that trap keyboard focus, preventing users from navigating away.

**WCAG:** 2.1.2

- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 25 and 26.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #26)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 26 and 27.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #27)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 27 and 28.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #28)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 28 and 29.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #29)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 29 and 30.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #30)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 30 and 31.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #31)
- **error**: Focus appears trapped at element. The same element received focus consecutively at positions 31 and 32.
  - **Impact:** Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.
  - **Elements:**
    - `#at-support > iframe.support-levels-modal-dialog` (tab #32)

### Unreachable Interactive Elements [PASS]

Detects interactive elements that cannot be reached via keyboard navigation.

**WCAG:** 2.1.1

### Focus Order Mismatch [FAIL]

Detects when keyboard focus order doesn't match the visual layout order.

**WCAG:** 2.4.3

- **warning**: 49 element(s) have a focus order that significantly differs from their visual position.
  - **Impact:** Keyboard users may be confused when focus jumps to unexpected locations that don't match the visual layout.
  - **Elements:**
    - `#site-header > div.minimal-header-info:nth-of-type(1) > div.minimal-header-titl…` (tab #1)
    - `#site-header > div.minimal-header-logo:nth-of-type(2) > div.logos > a.home.w3c:…` (tab #2)
    - `#site-header > div.minimal-header-logo:nth-of-type(2) > div.logos > a.home.wai:…` (tab #3)
    - `div.default-grid.nav-container:nth-of-type(2) > div.nav > nav.nav > ul > li.nav…` (tab #4)
    - `div.default-grid.nav-container:nth-of-type(2) > div.nav > nav.nav > ul > li.nav…` (tab #5)
    - `div.default-grid.nav-container:nth-of-type(2) > div.nav > nav.nav > ul > li.nav…` (tab #6)
    - `div.default-grid.nav-container:nth-of-type(2) > div.nav > nav.nav > ul > li.nav…` (tab #7)
    - `div.default-grid.nav-container:nth-of-type(2) > div.nav > nav.nav > ul > li.nav…` (tab #8)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #9)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #10)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #11)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #12)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #13)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #14)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #15)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #16)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #17)
    - `#main > div > div > section:nth-of-type(1) > p:nth-of-type(1) > a` (tab #19)
    - `#main > div > div > section:nth-of-type(1) > ul > li:nth-of-type(1) > a` (tab #20)
    - `#main > div > div > section:nth-of-type(1) > ul > li:nth-of-type(2) > a` (tab #21)
    - `#ex_label-codepenbutton` (tab #22)
    - `#ex1 > button` (tab #23)
    - `#at-support > p > a` (tab #24)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #25)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #26)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #27)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #28)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #29)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #30)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #31)
    - `#at-support > iframe.support-levels-modal-dialog` (tab #32)
    - `#css_js_files > li:nth-of-type(1) > a` (tab #33)
    - `#css_js_files > li:nth-of-type(2) > a:nth-of-type(1)` (tab #34)
    - `#css_js_files > li:nth-of-type(2) > a:nth-of-type(2)` (tab #35)
    - `#sc1_description-codepenbutton` (tab #36)
    - `#helpimprove > div.box-i > p > a` (tab #37)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(1)` (tab #38)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(2)` (tab #39)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(3)` (tab #40)
    - `a.button.button-backtotop:nth-of-type(2)` (tab #41)
    - `#wai-site-footer > div.inner > div.example-page-footer > p:nth-of-type(1) > a` (tab #42)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #43)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #45)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #46)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #47)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.w3c…` (tab #48)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.w3c…` (tab #49)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > p.w3c-c…` (tab #58)
    - `skip-to-content` (tab #61)

### Tabindex Abuse [PASS]

Detects elements with positive tabindex values that disrupt natural focus order.

**WCAG:** 2.4.3

### Missing Focus Indicator [FAIL]

Detects interactive elements that lack a visible focus indicator.

**WCAG:** 2.4.7

- **error**: 1 element(s) show no visible change between focused and unfocused states (screenshot comparison).
  - **Impact:** Screenshot comparison confirms no visible focus indicator. Keyboard users cannot see which element has focus.
  - **Elements:**
    - `#ex_label-codepenbutton` (tab #22)

### Skip Link [FAIL]

Validates that a skip navigation link is present and functions correctly.

**WCAG:** 2.4.1

- **warning**: No skip navigation link found among the first focusable elements. Keyboard users must tab through all navigation items to reach main content.
  - **Impact:** Without a skip link, keyboard users must navigate through all header and navigation elements on every page load.

### Focus Not Obscured [PASS]

Ensures focused elements are not entirely hidden by sticky/fixed content.

**WCAG:** 2.4.11

### Focus After Interaction [PASS]

Ensures focus is not lost after clicking interactive elements.

**WCAG:** 2.4.3, 2.4.7

---

Generated by Keylens v0.1.0 on 2026-08-12T18:47:30.246Z
