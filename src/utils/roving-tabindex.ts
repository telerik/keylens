import type { InteractiveElement } from "../types/index.js";

/**
 * Returns interactive elements that are genuinely unreachable via keyboard.
 *
 * Roving-tabindex composite widgets (e.g. role="tablist") only expose one Tab
 * stop; other members (tabindex="-1") are reached via arrow keys, not Tab. An
 * element is excluded here if another member of its same composite container
 * was reached - that confirms the pattern is actually wired up, not just
 * declared in markup - so a container whose members are ALL unreached (a
 * genuinely broken widget) is still reported.
 *
 * Some widgets use a different (also valid) focus-management strategy where
 * NO member ever gets tabindex="0" - real DOM focus stays on the container
 * itself (which is a Tab stop in its own right) and arrow keys move an
 * internal highlight (e.g. via aria-activedescendant or a CSS-only "current
 * item" indicator) without moving document.activeElement off the container.
 * An element is also excluded here if its composite container was itself
 * reached via Tab, since that proves the widget is enterable by keyboard even
 * though no individual member ever receives real DOM focus.
 *
 * Conversely, a composite-container role (e.g. role="listbox") is itself
 * discovered as an "interactive element" (it matches the same role-based
 * selector its members do), but many such containers are purely semantic
 * wrappers that never receive focus themselves - each member is
 * independently `tabindex="0"` and directly Tab-reachable (e.g. a Kendo
 * chip-list `<div role="listbox">` whose `<div role="option" tabindex="0">`
 * chips are each their own Tab stop). The container element is excluded here
 * if any of ITS OWN members were reached, proving the container's contents
 * are keyboard-accessible even though the wrapper itself never takes focus.
 *
 * Some pages also split ONE logical widget across multiple sibling ARIA
 * containers (e.g. a `role="grid"` per visual category) that share a single
 * Tab-reachable member across the whole set. An unreached container is also
 * excluded here if it shares its members' role with exactly one OTHER
 * container that WAS reached - that's the same shared-domain signal used by
 * the crawler's arrow-key verification.
 */
export function getUnreachedInteractiveElements(
  interactiveElements: InteractiveElement[],
): InteractiveElement[] {
  const reachedRovingContainers = new Set(
    interactiveElements
      .filter((el) => el.reached && el.rovingContainerSelector)
      .map((el) => el.rovingContainerSelector),
  );

  const memberContainerSelectors = new Set(
    interactiveElements
      .map((el) => el.rovingContainerSelector)
      .filter((selector): selector is string => Boolean(selector)),
  );
  const reachedContainerElements = new Set(
    interactiveElements
      .filter((el) => el.reached && memberContainerSelectors.has(el.selector))
      .map((el) => el.selector),
  );

  // Some pages split ONE logical roving-tabindex widget across multiple
  // sibling ARIA containers (e.g. a `role="grid"` per visual category) that
  // share a single Tab-reachable member across the whole set. A container
  // whose own members were never reached can't be judged wired-up in
  // isolation; if exactly one OTHER container sharing the same member role
  // WAS reached, treat this one as part of the same verified domain instead
  // of flagging its members as unreachable.
  const containersByMemberRole = new Map<string, Set<string>>();
  for (const el of interactiveElements) {
    if (!el.rovingContainerSelector) continue;
    const set = containersByMemberRole.get(el.role) ?? new Set();
    set.add(el.rovingContainerSelector);
    containersByMemberRole.set(el.role, set);
  }
  const isContainerReached = (selector: string) =>
    reachedRovingContainers.has(selector) ||
    reachedContainerElements.has(selector);
  const sharedDomainContainers = new Set<string>();
  for (const containers of containersByMemberRole.values()) {
    const reached = [...containers].filter(isContainerReached);
    const unreached = [...containers].filter((c) => !isContainerReached(c));
    if (reached.length === 1 && unreached.length > 0) {
      for (const selector of unreached) sharedDomainContainers.add(selector);
    }
  }

  return interactiveElements.filter((el) => {
    if (el.reached) return false;
    if (
      el.rovingContainerSelector &&
      (reachedRovingContainers.has(el.rovingContainerSelector) ||
        reachedContainerElements.has(el.rovingContainerSelector) ||
        sharedDomainContainers.has(el.rovingContainerSelector))
    ) {
      return false;
    }
    // This element IS a composite container (its selector is some other
    // element's rovingContainerSelector) and at least one of its own members
    // was reached - the container is a semantic wrapper, not a broken widget.
    if (reachedRovingContainers.has(el.selector)) return false;
    return true;
  });
}
