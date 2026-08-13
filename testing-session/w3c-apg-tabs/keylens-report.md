# Keylens Keyboard Navigation Report

- **URL:** https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
- **Version:** 0.1.0
- **Timestamp:** 2026-08-12T18:46:31.941Z

## Summary

| Errors | Warnings | Info | Rules Passed | Rules Failed | Score  |
| ------ | -------- | ---- | ------------ | ------------ | ------ |
| 1      | 2        | 0    | 5            | 3            | 88/100 |

## Crawl

| Focusable Elements | Interactive Elements | Unreached | Cycle Completed | Duration |
| ------------------ | -------------------- | --------- | --------------- | -------- |
| 52                 | 54                   | 3         | Yes             | 15.81s   |

## Focus Sequence

| #   | Tag             | Role            | Name                                               | Selector                                                       | ARIA Attrs                                       | Context |
| --- | --------------- | --------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ | ------- |
| 1   | a               | a               | ARIA Authoring Practices Guide (APG)               | `#site-header > div.minimal-header-info:nth-of-type(1) > div…` |                                                  | header  |
| 2   | a               | a               | W3C homepage                                       | `#site-header > div.minimal-header-logo:nth-of-type(2) > div…` |                                                  | header  |
| 3   | a               | a               | Web Accessibility Initiative (WAI) homepage        | `#site-header > div.minimal-header-logo:nth-of-type(2) > div…` |                                                  | header  |
| 4   | a               | a               | APG Home                                           | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` |                                                  | nav     |
| 5   | a               | a               | Patterns                                           | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` |                                                  | nav     |
| 6   | a               | a               | Practices                                          | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` |                                                  | nav     |
| 7   | a               | a               | Index                                              | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` |                                                  | nav     |
| 8   | a               | a               | About                                              | `div.default-grid.nav-container:nth-of-type(2) > div.nav > n…` |                                                  | nav     |
| 9   | a               | a               | Read This First                                    | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 10  | a               | a               | About This Example                                 | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 11  | a               | a               | Example                                            | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 12  | a               | a               | Accessibility Features                             | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 13  | a               | a               | Keyboard Support                                   | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 14  | a               | a               | Role, Property, State, and Tabindex Attributes     | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 15  | a               | a               | JavaScript and CSS Source Code                     | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 16  | a               | a               | HTML Source Code                                   | `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack…` |                                                  | nav     |
| 17  | summary         | summary         | The code in this example is not intended for prod… | `#support-notice > summary`                                    |                                                  | main    |
| 18  | a               | a               | Tabs Pattern                                       | `#main > div > div > section:nth-of-type(1) > p:nth-of-type(…` |                                                  | section |
| 19  | a               | a               | Deciding When to Make Selection Automatically Fol… | `#main > div > div > section:nth-of-type(1) > p:nth-of-type(…` |                                                  | section |
| 20  | a               | a               | Example of Tabs with Manual Activation             | `#main > div > div > section:nth-of-type(1) > ul > li > a`     |                                                  | section |
| 21  | button          | button          | Open In CodePen                                    | `#ex_label-codepenbutton`                                      |                                                  | form    |
| 22  | button          | tab             | Maria Ahlefeldt                                    | `#tab-1`                                                       | aria-selected="true", aria-controls="tabpanel-1" | section |
| 23  | div             | tabpanel        | tab-1                                              | `#tabpanel-1`                                                  | aria-labelledby="tab-1"                          | section |
| 24  | a               | a               | Managing Focus Within Components Using a Roving t… | `#main > div > div > section:nth-of-type(5) > div.table-wrap…` |                                                  | section |
| 25  | a               | a               | tabs.css                                           | `#css_js_files > li:nth-of-type(1) > a`                        |                                                  | section |
| 26  | a               | a               | tabs-automatic.js                                  | `#css_js_files > li:nth-of-type(2) > a`                        |                                                  | section |
| 27  | button          | button          | Open In CodePen                                    | `#sc1_description-codepenbutton`                               |                                                  | form    |
| 28  | a               | a               | public-aria-practices@w3.org                       | `#helpimprove > div.box-i > p > a`                             |                                                  | aside   |
| 29  | a               | a               | E-mail                                             | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` |                                                  | aside   |
| 30  | a               | a               | Fork & Edit on GitHub                              | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` |                                                  | aside   |
| 31  | a               | a               | New GitHub Issue                                   | `#helpimprove > div.box-i > div.button-group > a.button:nth-…` |                                                  | aside   |
| 32  | a               | a               | Back to Top                                        | `a.button.button-backtotop:nth-of-type(2)`                     |                                                  |         |
| 33  | a               | a               | View issues related to this example                | `#wai-site-footer > div.inner > div.example-page-footer > p:…` |                                                  | footer  |
| 34  | a               | a               | W3C Web Accessibility Initiative (WAI)             | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 35  | a               | a               | Get News in Email                                  | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 36  | a               | a               | LinkedIn                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 37  | a               | a               | Mastodon                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 38  | a               | a               | YouTube                                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 39  | a               | a               | Home                                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 40  | a               | a               | Contact                                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 41  | a               | a               | Site map                                           | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 42  | a               | a               | Support WAI                                        | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 43  | a               | a               | News                                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 44  | a               | a               | Accessibility statement                            | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 45  | a               | a               | All Translations                                   | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 46  | a               | a               | Resources for roles                                | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 47  | a               | a               | World Wide Web Consortium                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 48  | a               | a               | liability                                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 49  | a               | a               | trademark                                          | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 50  | a               | a               | W3C Software License                               | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 51  | a               | a               | Permission to Use WAI Material                     | `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) >…` |                                                  | footer  |
| 52  | skip-to-content | skip-to-content |                                                    | `skip-to-content`                                              |                                                  |         |

## Skip Link

- **warning**: No skip navigation link found among the first focusable elements. Keyboard users must tab through all navigation items to reach main content.

## Rules

### Keyboard Trap [PASS]

Detects elements that trap keyboard focus, preventing users from navigating away.

**WCAG:** 2.1.2

### Unreachable Interactive Elements [FAIL]

Detects interactive elements that cannot be reached via keyboard navigation.

**WCAG:** 2.1.1

- **error**: 3 interactive element(s) are not reachable via keyboard.
  - **Impact:** Keyboard users cannot access these interactive elements. All functionality must be operable through a keyboard interface.
  - **Elements:**
    - `#tab-2`
    - `#tab-3`
    - `#tab-4`

### Focus Order Mismatch [FAIL]

Detects when keyboard focus order doesn't match the visual layout order.

**WCAG:** 2.4.3

- **warning**: 29 element(s) have a focus order that significantly differs from their visual position.
  - **Impact:** Keyboard users may be confused when focus jumps to unexpected locations that don't match the visual layout.
  - **Elements:**
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #12)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #13)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #14)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #15)
    - `div.default-grid.with-gap:nth-of-type(3) > nav.box.nav-hack > div.box-i > ul > …` (tab #16)
    - `#support-notice > summary` (tab #17)
    - `#main > div > div > section:nth-of-type(1) > p:nth-of-type(1) > a:nth-of-type(1)` (tab #18)
    - `#main > div > div > section:nth-of-type(1) > p:nth-of-type(1) > a:nth-of-type(2)` (tab #19)
    - `#main > div > div > section:nth-of-type(1) > ul > li > a` (tab #20)
    - `#ex_label-codepenbutton` (tab #21)
    - `#tabpanel-1` (tab #23)
    - `#main > div > div > section:nth-of-type(5) > div.table-wrap > table.data.attrib…` (tab #24)
    - `#css_js_files > li:nth-of-type(1) > a` (tab #25)
    - `#css_js_files > li:nth-of-type(2) > a` (tab #26)
    - `#sc1_description-codepenbutton` (tab #27)
    - `#helpimprove > div.box-i > p > a` (tab #28)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(1)` (tab #29)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(2)` (tab #30)
    - `#helpimprove > div.box-i > div.button-group > a.button:nth-of-type(3)` (tab #31)
    - `a.button.button-backtotop:nth-of-type(2)` (tab #32)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #36)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #37)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.wai…` (tab #38)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.w3c…` (tab #39)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.w3c…` (tab #45)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > div.w3c…` (tab #46)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > p.w3c-c…` (tab #48)
    - `footer.w3c-global-footer.wai-global-footer:nth-of-type(2) > div.inner > p.w3c-c…` (tab #49)
    - `skip-to-content` (tab #52)

### Tabindex Abuse [PASS]

Detects elements with positive tabindex values that disrupt natural focus order.

**WCAG:** 2.4.3

### Missing Focus Indicator [PASS]

Detects interactive elements that lack a visible focus indicator.

**WCAG:** 2.4.7

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

Generated by Keylens v0.1.0 on 2026-08-12T18:46:31.941Z
