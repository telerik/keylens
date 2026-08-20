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

  return interactiveElements.filter((el) => {
    if (el.reached) return false;
    if (
      el.rovingContainerSelector &&
      (reachedRovingContainers.has(el.rovingContainerSelector) ||
        reachedContainerElements.has(el.rovingContainerSelector))
    ) {
      return false;
    }
    return true;
  });
}
