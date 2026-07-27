import type {
  CrawlResult,
  KeylensConfig,
  Rule,
  RuleResult,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { raceWithSignal, throwIfAborted } from "../utils/execution.js";
import { KeyboardTrapRule } from "./keyboard-trap.js";
import { UnreachableElementsRule } from "./unreachable-elements.js";
import { FocusOrderMismatchRule } from "./focus-order-mismatch.js";
import { TabindexAbuseRule } from "./tabindex-abuse.js";
import { MissingFocusIndicatorRule } from "./missing-focus-indicator.js";
import { SkipLinkRule } from "./skip-link.js";
import { FocusNotObscuredRule } from "./focus-not-obscured.js";
import { FocusAfterInteractionRule } from "./focus-after-interaction.js";

/**
 * Registry of all available rules.
 */
const ALL_RULES: Rule[] = [
  new KeyboardTrapRule(),
  new UnreachableElementsRule(),
  new FocusOrderMismatchRule(),
  new TabindexAbuseRule(),
  new MissingFocusIndicatorRule(),
  new SkipLinkRule(),
  new FocusNotObscuredRule(),
  new FocusAfterInteractionRule(),
];

/**
 * Map rule IDs to config keys.
 */
const RULE_CONFIG_MAP: Record<string, keyof KeylensConfig["rules"]> = {
  "keyboard-trap": "keyboardTrap",
  "unreachable-elements": "unreachableElements",
  "focus-order-mismatch": "focusOrderMismatch",
  "tabindex-abuse": "tabindexAbuse",
  "missing-focus-indicator": "missingFocusIndicator",
  "skip-link": "skipLink",
  "focus-not-obscured": "focusNotObscured",
  "focus-after-interaction": "focusAfterInteraction",
};

/**
 * Run all enabled rules against the crawl results.
 */
export async function runRules(
  crawlResult: CrawlResult,
  config: KeylensConfig,
  signal?: AbortSignal,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  const enabledRules = ALL_RULES.filter((rule) => {
    const configKey = RULE_CONFIG_MAP[rule.id];
    return configKey ? config.rules[configKey] : true;
  });

  logger.info(`Running ${enabledRules.length} rules...`);

  for (const rule of enabledRules) {
    throwIfAborted(signal, "rules", crawlResult.url);
    logger.debug(`Running rule: ${rule.name}`);
    const startTime = Date.now();

    try {
      const result = await raceWithSignal(
        rule.evaluate(crawlResult),
        signal,
        "rules",
        crawlResult.url,
      );
      result.status = result.passed ? "passed" : "failed";
      result.duration = Date.now() - startTime;
      result.ruleName = rule.name;
      result.ruleDescription = rule.description;
      result.wcag = rule.wcag;
      results.push(result);

      logger.rule(
        result.passed,
        rule.name,
        result.passed ? undefined : `${result.violations.length} violation(s)`,
      );
    } catch (error) {
      throwIfAborted(signal, "rules", crawlResult.url);
      logger.error(`Rule "${rule.name}" failed: ${(error as Error).message}`);
      results.push({
        ruleId: rule.id,
        passed: false,
        status: "error",
        violations: [],
        duration: Date.now() - startTime,
        ruleName: rule.name,
        ruleDescription: rule.description,
        wcag: rule.wcag,
        error: {
          code: "RULE_ERROR",
          message: (error as Error).message,
        },
      });
    }
  }

  return results;
}
