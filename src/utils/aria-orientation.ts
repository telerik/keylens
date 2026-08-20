/**
 * Determines which arrow keys move focus between members of an ARIA composite
 * widget (roving tabindex pattern), per the WAI-ARIA APG keyboard interaction
 * guidance for each container role.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ (tablist: horizontal default)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ (menu: vertical default, menubar: horizontal default)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ (listbox: vertical default)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ (toolbar: horizontal default)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/treeview/ (tree: vertical default)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/radio/ (radiogroup: all four arrow keys move
 *   forward/backward regardless of visual orientation - a deliberate exception, not a bug)
 */

/** Per-role default orientation when no explicit `aria-orientation` is set. */
const ROLE_DEFAULT_ORIENTATION: Record<string, "horizontal" | "vertical"> = {
  tablist: "horizontal",
  toolbar: "horizontal",
  menubar: "horizontal",
  menu: "vertical",
  listbox: "vertical",
  tree: "vertical",
  treegrid: "vertical",
};

export interface RovingArrowKeys {
  /** Key(s) that move focus to the next member. */
  forward: string[];
  /** Key(s) that move focus to the previous member. */
  backward: string[];
}

/**
 * Returns the arrow key(s) expected to move focus forward/backward within a
 * composite widget container.
 */
export function getRovingArrowKeys(
  containerRole: string,
  ariaOrientation: string | null,
): RovingArrowKeys {
  // radiogroup is not in the ARIA spec's aria-orientation-supported role list -
  // the APG pattern has all four arrow keys move forward/backward interchangeably,
  // regardless of visual layout.
  if (containerRole === "radiogroup") {
    return {
      forward: ["ArrowRight", "ArrowDown"],
      backward: ["ArrowLeft", "ArrowUp"],
    };
  }

  // grid/treegrid use 2D navigation; try both axes as "forward" probes since we
  // only need to confirm SOME key reaches each member, not simulate real usage.
  if (containerRole === "grid" || containerRole === "treegrid") {
    return {
      forward: ["ArrowDown", "ArrowRight"],
      backward: ["ArrowUp", "ArrowLeft"],
    };
  }

  const orientation: "horizontal" | "vertical" =
    ariaOrientation === "horizontal" || ariaOrientation === "vertical"
      ? ariaOrientation
      : (ROLE_DEFAULT_ORIENTATION[containerRole] ?? "vertical");

  return orientation === "horizontal"
    ? { forward: ["ArrowRight"], backward: ["ArrowLeft"] }
    : { forward: ["ArrowDown"], backward: ["ArrowUp"] };
}

/**
 * All arrow keys not already covered by the primary axis - tried as a fallback
 * before concluding a member is genuinely unreachable, in case the widget's
 * orientation was inferred incorrectly.
 */
export function getFallbackArrowKeys(
  primary: RovingArrowKeys,
): RovingArrowKeys {
  const usedKeys = new Set([...primary.forward, ...primary.backward]);
  const allForward = ["ArrowRight", "ArrowDown"];
  const allBackward = ["ArrowLeft", "ArrowUp"];
  return {
    forward: allForward.filter((key) => !usedKeys.has(key)),
    backward: allBackward.filter((key) => !usedKeys.has(key)),
  };
}
