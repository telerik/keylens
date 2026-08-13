# Keylens Keyboard Navigation Report

- **URL:** https://webaim.org
- **Version:** 0.1.0
- **Timestamp:** 2026-08-12T18:47:03.705Z

## Summary

| Errors | Warnings | Info | Rules Passed | Rules Failed | Score  |
| ------ | -------- | ---- | ------------ | ------------ | ------ |
| 1      | 1        | 0    | 6            | 2            | 94/100 |

## Crawl

| Focusable Elements | Interactive Elements | Unreached | Cycle Completed | Duration |
| ------------------ | -------------------- | --------- | --------------- | -------- |
| 49                 | 49                   | 0         | Yes             | 13.67s   |

## Focus Sequence

| #   | Tag   | Role  | Name                                               | Selector                                                       | Context |
| --- | ----- | ----- | -------------------------------------------------- | -------------------------------------------------------------- | ------- |
| 1   | a     | a     | skip to main content                               | `#skiptocontent > a`                                           | header  |
| 2   | a     | a     |                                                    | `#headcontainer > header > h2 > a`                             | header  |
| 3   | a     | a     | Services                                           | `#headcontainer > header > nav > ul > li:nth-of-type(1) > a`   | nav     |
| 4   | a     | a     | Articles                                           | `#headcontainer > header > nav > ul > li:nth-of-type(2) > a`   | nav     |
| 5   | a     | a     | Resources                                          | `#headcontainer > header > nav > ul > li:nth-of-type(3) > a`   | nav     |
| 6   | a     | a     | Projects                                           | `#headcontainer > header > nav > ul > li:nth-of-type(4) > a`   | nav     |
| 7   | a     | a     | Community                                          | `#headcontainer > header > nav > ul > li:nth-of-type(5) > a`   | nav     |
| 8   | input | input |                                                    | `#q`                                                           | form    |
| 9   | input | input | Submit Search                                      | `#sitesearch > p.search > span > input:nth-of-type(2)`         | form    |
| 10  | a     | a     | Introduction to Web Accessibility                  | `#search > p.intro:nth-of-type(1) > a`                         | header  |
| 11  | a     | a     | WebAIM Training                                    | `#search > p.training:nth-of-type(2) > a`                      | header  |
| 12  | a     | a     | LEARN MORE                                         | `#bannerreg > a`                                               | article |
| 13  | a     | a     | Accessibility Training                             | `#training > h2 > a`                                           | article |
| 14  | a     | a     | Technical Assistance                               | `#consulting > h2 > a`                                         | article |
| 15  | a     | a     | Accessibility in Procurement                       | `#strategica11y > h2 > a`                                      | article |
| 16  | a     | a     | Evaluation and Reporting                           | `#monitoring > h2 > a`                                         | article |
| 17  | a     | a     | Newsletter                                         | `#commbox > ul > li:nth-of-type(1) > a`                        | article |
| 18  | a     | a     | WebAIM Blog                                        | `#commbox > ul > li:nth-of-type(2) > a`                        | article |
| 19  | a     | a     | WebAIM Conference                                  | `#commbox > ul > li:nth-of-type(3) > a`                        | article |
| 20  | a     | a     | LinkedIn                                           | `#commbox > ul > li:nth-of-type(4) > a`                        | article |
| 21  | a     | a     | Take the Survey                                    | `#features > p.more:nth-of-type(2) > a`                        | article |
| 22  | a     | a     | Read the WebAIM Million report                     | `#features > p.more:nth-of-type(4) > a`                        | article |
| 23  | a     | a     | Ask AIMee                                          | `#features > p.more:nth-of-type(6) > a`                        | article |
| 24  | a     | a     | Archive of featured items…                         | `#features > p.archive:nth-of-type(7) > a`                     | article |
| 25  | a     | a     | Virtual Web Accessibility Training                 | `#trainings > div.events > ul > li:nth-of-type(1) > a`         | article |
| 26  | a     | a     | Accessibility in Technology Procurement and Use    | `#trainings > div.events > ul > li:nth-of-type(2) > a`         | article |
| 27  | a     | a     | Document Accessibility Online Course               | `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of…` | article |
| 28  | a     | a     | July cohort                                        | `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of…` | article |
| 29  | a     | a     | August cohort                                      | `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of…` | article |
| 30  | a     | a     | A11y Camp Pocatello                                | `#activities > div.events > ul > li:nth-of-type(1) > a`        | article |
| 31  | a     | a     | Web Accessibility in Mind Conference               | `#activities > div.events > ul > li:nth-of-type(2) > a`        | article |
| 32  | a     | a     | 435.797.7024                                       | `#contact > a.phone`                                           | footer  |
| 33  | input | input | Web site address                                   | `#waveurl`                                                     | form    |
| 34  | input | input |                                                    | `#checkpage > form > input:nth-of-type(2)`                     | form    |
| 35  | a     | a     | An Extension is Not an Excuse                      | `#footerresources > div.footerblock:nth-of-type(2) > ul > li…` | footer  |
| 36  | a     | a     | Tolerating Inaccessibility                         | `#footerresources > div.footerblock:nth-of-type(2) > ul > li…` | footer  |
| 37  | a     | a     | Ask AIMee: An accessible accessibility-focused AI… | `#footerresources > div.footerblock:nth-of-type(2) > ul > li…` | footer  |
| 38  | a     | a     | A New Path for Digital Accessibility?              | `#footerresources > div.footerblock:nth-of-type(2) > ul > li…` | footer  |
| 39  | a     | a     | WebAIM Training                                    | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 40  | a     | a     | WCAG 2 Checklist                                   | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 41  | a     | a     | Ask AIMee Chatbot                                  | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 42  | a     | a     | Color Contrast Checker                             | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 43  | a     | a     | Web Accessibility for Designers                    | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 44  | a     | a     | WAVE Web Accessibility Evaluation Tool             | `#footerresources > div.footerblock:nth-of-type(3) > ul > li…` | footer  |
| 45  | a     | a     | Contact                                            | `#footercontact`                                               | footer  |
| 46  | a     | a     | About                                              | `#footerabout`                                                 | footer  |
| 47  | a     | a     | RSS Feeds                                          | `#footerrss`                                                   | footer  |
| 48  | a     | a     | LinkedIn                                           | `#footerli`                                                    | footer  |
| 49  | a     | a     | Copyright & Terms of Use                           | `#footercopyright`                                             | footer  |

## Skip Link

Skip link: **functional.**

## Rules

### Keyboard Trap [PASS]

Detects elements that trap keyboard focus, preventing users from navigating away.

**WCAG:** 2.1.2

### Unreachable Interactive Elements [PASS]

Detects interactive elements that cannot be reached via keyboard navigation.

**WCAG:** 2.1.1

### Focus Order Mismatch [FAIL]

Detects when keyboard focus order doesn't match the visual layout order.

**WCAG:** 2.4.3

- **warning**: 27 element(s) have a focus order that significantly differs from their visual position.
  - **Impact:** Keyboard users may be confused when focus jumps to unexpected locations that don't match the visual layout.
  - **Elements:**
    - `#bannerreg > a` (tab #12)
    - `#strategica11y > h2 > a` (tab #15)
    - `#monitoring > h2 > a` (tab #16)
    - `#commbox > ul > li:nth-of-type(3) > a` (tab #19)
    - `#commbox > ul > li:nth-of-type(4) > a` (tab #20)
    - `#features > p.more:nth-of-type(2) > a` (tab #21)
    - `#features > p.more:nth-of-type(6) > a` (tab #23)
    - `#features > p.archive:nth-of-type(7) > a` (tab #24)
    - `#trainings > div.events > ul > li:nth-of-type(1) > a` (tab #25)
    - `#trainings > div.events > ul > li:nth-of-type(2) > a` (tab #26)
    - `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of-type(1)` (tab #27)
    - `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of-type(2)` (tab #28)
    - `#trainings > div.events > ul > li:nth-of-type(3) > a:nth-of-type(3)` (tab #29)
    - `#activities > div.events > ul > li:nth-of-type(1) > a` (tab #30)
    - `#activities > div.events > ul > li:nth-of-type(2) > a` (tab #31)
    - `#contact > a.phone` (tab #32)
    - `#waveurl` (tab #33)
    - `#checkpage > form > input:nth-of-type(2)` (tab #34)
    - `#footerresources > div.footerblock:nth-of-type(2) > ul > li:nth-of-type(1) > a` (tab #35)
    - `#footerresources > div.footerblock:nth-of-type(2) > ul > li:nth-of-type(2) > a` (tab #36)
    - `#footerresources > div.footerblock:nth-of-type(2) > ul > li:nth-of-type(3) > a` (tab #37)
    - `#footerresources > div.footerblock:nth-of-type(2) > ul > li:nth-of-type(4) > a` (tab #38)
    - `#footerresources > div.footerblock:nth-of-type(3) > ul > li:nth-of-type(1) > a` (tab #39)
    - `#footerresources > div.footerblock:nth-of-type(3) > ul > li:nth-of-type(2) > a` (tab #40)
    - `#footerresources > div.footerblock:nth-of-type(3) > ul > li:nth-of-type(3) > a` (tab #41)
    - `#footerresources > div.footerblock:nth-of-type(3) > ul > li:nth-of-type(4) > a` (tab #42)
    - `#footerresources > div.footerblock:nth-of-type(3) > ul > li:nth-of-type(5) > a` (tab #43)

### Tabindex Abuse [PASS]

Detects elements with positive tabindex values that disrupt natural focus order.

**WCAG:** 2.4.3

### Missing Focus Indicator [PASS]

Detects interactive elements that lack a visible focus indicator.

**WCAG:** 2.4.7

### Skip Link [PASS]

Validates that a skip navigation link is present and functions correctly.

**WCAG:** 2.4.1

### Focus Not Obscured [PASS]

Ensures focused elements are not entirely hidden by sticky/fixed content.

**WCAG:** 2.4.11

### Focus After Interaction [FAIL]

Ensures focus is not lost after clicking interactive elements.

**WCAG:** 2.4.3, 2.4.7

- **error**: Focus lost after clicking #sitesearch > p.search > span > input:nth-of-type(2) — activeElement reverted to body
  - **Impact:** Keyboard users lose their position on the page after interacting with this element, forcing them to Tab from the beginning.
  - **Elements:**
    - `#sitesearch > p.search > span > input:nth-of-type(2)`

---

Generated by Keylens v0.1.0 on 2026-08-12T18:47:03.705Z
