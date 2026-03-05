import { describe, it, expect } from "vitest";
import {
  safeParseJSON,
  fixSuggestionBatchSchema,
  focusOrderResultSchema,
  reportSummarySchema,
  widgetClassificationBatchSchema,
  accessibleNameBatchSchema,
  focusIndicatorScoreBatchSchema,
  crossPagePatternBatchSchema,
} from "@/ai/schemas.js";

describe("safeParseJSON", () => {
  it("returns parsed data for valid JSON matching schema", () => {
    const json = JSON.stringify({
      summary: "ok",
      issues: [],
      overallAssessment: "good",
    });
    const result = safeParseJSON(json, focusOrderResultSchema);
    expect(result).toEqual({
      summary: "ok",
      issues: [],
      overallAssessment: "good",
    });
  });

  it("returns null for invalid JSON", () => {
    expect(safeParseJSON("not json", focusOrderResultSchema)).toBeNull();
  });

  it("returns null for valid JSON that does not match schema", () => {
    const json = JSON.stringify({ foo: "bar" });
    expect(safeParseJSON(json, focusOrderResultSchema)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeParseJSON("", focusOrderResultSchema)).toBeNull();
  });
});

describe("fixSuggestionBatchSchema", () => {
  it("validates a correct batch", () => {
    const data = [
      {
        violationIndex: 1,
        summary: "Add tabindex",
        wcagRef: "2.1.1",
        explanation: "Element is not focusable",
        estimatedEffort: "low",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      fixSuggestionBatchSchema,
    );
    expect(result).toHaveLength(1);
    expect(result![0].summary).toBe("Add tabindex");
  });

  it("allows optional codeBefore/codeAfter", () => {
    const data = [
      {
        violationIndex: 1,
        summary: "Fix",
        wcagRef: "2.1.1",
        explanation: "...",
        estimatedEffort: "medium",
        codeBefore: "<div>",
        codeAfter: "<button>",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      fixSuggestionBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].codeBefore).toBe("<div>");
  });

  it("rejects item missing required fields", () => {
    const data = [{ violationIndex: 1, summary: "Fix" }];
    expect(
      safeParseJSON(JSON.stringify(data), fixSuggestionBatchSchema),
    ).toBeNull();
  });
});

describe("focusOrderResultSchema", () => {
  it("validates result with issues", () => {
    const data = {
      summary: "Focus order has issues",
      issues: [
        {
          elementIndex: 3,
          description: "Skip nav is out of order",
          severity: "warning",
          suggestion: "Move skip nav first",
        },
      ],
      overallAssessment: "acceptable",
    };
    const result = safeParseJSON(JSON.stringify(data), focusOrderResultSchema);
    expect(result).not.toBeNull();
    expect(result!.issues).toHaveLength(1);
    expect(result!.overallAssessment).toBe("acceptable");
  });

  it("rejects invalid overallAssessment value", () => {
    const data = {
      summary: "ok",
      issues: [],
      overallAssessment: "terrible",
    };
    expect(
      safeParseJSON(JSON.stringify(data), focusOrderResultSchema),
    ).toBeNull();
  });
});

describe("reportSummarySchema", () => {
  it("validates a complete summary", () => {
    const data = {
      overview: "The page has good keyboard accessibility.",
      criticalIssues: ["Missing skip link"],
      prioritizedFixes: [
        { fix: "Add skip link", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 75,
      recommendation: "Add a skip link to improve navigation.",
    };
    const result = safeParseJSON(JSON.stringify(data), reportSummarySchema);
    expect(result).not.toBeNull();
    expect(result!.aiSeverityRating).toBe(75);
  });

  it("rejects rating outside 1-100", () => {
    const data = {
      overview: "ok",
      criticalIssues: [],
      prioritizedFixes: [],
      aiSeverityRating: 150,
      recommendation: "ok",
    };
    expect(safeParseJSON(JSON.stringify(data), reportSummarySchema)).toBeNull();
  });

  it("rejects rating of 0", () => {
    const data = {
      overview: "ok",
      criticalIssues: [],
      prioritizedFixes: [],
      aiSeverityRating: 0,
      recommendation: "ok",
    };
    expect(safeParseJSON(JSON.stringify(data), reportSummarySchema)).toBeNull();
  });
});

describe("widgetClassificationBatchSchema", () => {
  it("validates classification items", () => {
    const data = [
      {
        index: 1,
        pattern: "dialog",
        confidence: 0.9,
        expectedKeyboard: [{ key: "Escape", expectedBehavior: "Close dialog" }],
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      widgetClassificationBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].pattern).toBe("dialog");
  });

  it("rejects invalid pattern", () => {
    const data = [
      {
        index: 1,
        pattern: "carousel",
        confidence: 0.8,
        expectedKeyboard: [],
      },
    ];
    expect(
      safeParseJSON(JSON.stringify(data), widgetClassificationBatchSchema),
    ).toBeNull();
  });
});

describe("accessibleNameBatchSchema", () => {
  it("validates name suggestions", () => {
    const data = [
      {
        index: 1,
        suggestedLabel: "Submit form",
        confidence: 0.85,
        reasoning: "Button submits form",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      accessibleNameBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].suggestedLabel).toBe("Submit form");
  });

  it("allows optional suggestedRole", () => {
    const data = [
      {
        index: 1,
        suggestedLabel: "Menu",
        suggestedRole: "navigation",
        confidence: 0.7,
        reasoning: "Contains nav links",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      accessibleNameBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].suggestedRole).toBe("navigation");
  });
});

describe("focusIndicatorScoreBatchSchema", () => {
  it("validates score items", () => {
    const data = [
      {
        elementIndex: 1,
        score: 8,
        contrast: "sufficient",
        visibility: "clear",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      focusIndicatorScoreBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].score).toBe(8);
  });

  it("rejects score outside 1-10", () => {
    const data = [
      {
        elementIndex: 1,
        score: 15,
        contrast: "sufficient",
        visibility: "clear",
      },
    ];
    expect(
      safeParseJSON(JSON.stringify(data), focusIndicatorScoreBatchSchema),
    ).toBeNull();
  });

  it("allows optional recommendation", () => {
    const data = [
      {
        elementIndex: 1,
        score: 5,
        contrast: "low",
        visibility: "subtle",
        recommendation: "Increase outline width",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      focusIndicatorScoreBatchSchema,
    );
    expect(result![0].recommendation).toBe("Increase outline width");
  });
});

describe("crossPagePatternBatchSchema", () => {
  it("validates pattern items", () => {
    const data = [
      {
        findingIndex: 1,
        type: "inconsistent-order",
        description: "Tab order differs",
        severity: "warning",
        suggestion: "Align tab order",
      },
    ];
    const result = safeParseJSON(
      JSON.stringify(data),
      crossPagePatternBatchSchema,
    );
    expect(result).not.toBeNull();
    expect(result![0].type).toBe("inconsistent-order");
  });

  it("rejects invalid type", () => {
    const data = [
      {
        findingIndex: 1,
        type: "bad-layout",
        description: "...",
        severity: "error",
        suggestion: "...",
      },
    ];
    expect(
      safeParseJSON(JSON.stringify(data), crossPagePatternBatchSchema),
    ).toBeNull();
  });

  it("validates empty array as valid", () => {
    const result = safeParseJSON("[]", crossPagePatternBatchSchema);
    expect(result).toEqual([]);
  });
});
