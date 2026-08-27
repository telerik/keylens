# Broken Roving Tabindex Navigation

| Property | Value                    |
| -------- | ------------------------ |
| ID       | `roving-tabindex-broken` |
| Severity | Warning                  |
| WCAG     | 2.1.1                    |
| Config   | `rovingTabindexBroken`   |

## What it checks

Composite widgets (tablist, menu, menubar, listbox, tree, toolbar, radiogroup, grid,
treegrid) commonly use the "roving tabindex" pattern: only the active member is a
Tab stop (`tabindex="0"`), and the rest use `tabindex="-1"`, reachable via arrow
keys instead. This rule verifies that pattern actually works by simulating real
key presses from the active member — it does not just trust the markup.

This is distinct from `unreachable-elements`, which only checks that the
composite _container_ is reachable via Tab.

## Why it's a Warning, not an Error

The verification presses arrow keys and observes what receives focus — a
best-effort simulation, not a structural markup check. Orientation is inferred
from `aria-orientation` or the widget's role default (falling back through the
opposite axis before giving up), but timing quirks or unusual custom
implementations could occasionally under-detect reachability a real user would
find fine. Treat a failure here as a strong signal to verify manually.

## Always runs

Unlike `focus-after-interaction`, this check requires no opt-in flag — it runs
automatically whenever a roving-tabindex composite widget is discovered during
the crawl.

## Outcomes

Each entry in `rovingTabindexGroups[]` (JSON report) has:

- `containerSelector` / `containerRole` — the composite widget checked;
- `totalMembers` — how many members were discovered;
- `reachedViaArrowKeys[]` — members confirmed reachable, each with a live
  page-relative `pageRect` (the first entry is always the active/entry member);
- `unreachedViaArrowKeys[]` — member selectors that could not be reached.

Members in `unreachedViaArrowKeys` become warning-severity violations. The HTML
report's Focus Order Map also renders reached members as dashed satellite
markers connected to the active member, since they never appear in the
Tab-order focus sequence otherwise.

## Fix

Attach a keydown handler on the composite container that moves DOM focus (and
updates `tabindex`) between members on the arrow keys appropriate for the
widget's role/orientation — see the
[WAI-ARIA APG keyboard interaction patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
for tablist, menu, listbox, tree, toolbar, and radiogroup.
