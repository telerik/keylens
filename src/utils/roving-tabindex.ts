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
 */
export function getUnreachedInteractiveElements(
  interactiveElements: InteractiveElement[],
): InteractiveElement[] {
  const reachedRovingContainers = new Set(
    interactiveElements
      .filter((el) => el.reached && el.rovingContainerSelector)
      .map((el) => el.rovingContainerSelector),
  );

  return interactiveElements.filter((el) => {
    if (el.reached) return false;
    if (
      el.rovingContainerSelector &&
      reachedRovingContainers.has(el.rovingContainerSelector)
    ) {
      return false;
    }
    return true;
  });
}
