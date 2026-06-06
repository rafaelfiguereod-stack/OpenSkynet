/**
 * Tests for Memory Importance Scorer.
 * Converted from Python tests/test_memory_importance.py
 */

import { test, describe, expect } from "bun:test";
import { scoreImportance, ImportanceScorer } from "../../src/memory/utils/importance";

describe("ImportanceScorer", () => {
  describe("scoreImportance", () => {
    test("returns zero for empty content", () => {
      const result = scoreImportance("");
      expect(result.score).toBe(0);
      expect(result.confidence).toBe("low");
    });

    test("returns zero for whitespace only", () => {
      const result = scoreImportance("   \n  \t  ");
      expect(result.score).toBe(0);
    });

    test("increases score for important keywords", () => {
      const result = scoreImportance("This is a critical setting that must always be configured");
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.reasons.some(r => r.startsWith("high_importance_pattern"))).toBe(true);
    });

    test("increases score for preferences", () => {
      const result = scoreImportance("User prefers dark mode theme");
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.reasons.some(r => r.startsWith("high_importance_pattern"))).toBe(true);
    });

    test("increases score for passwords/secrets", () => {
      const result = scoreImportance("API key: sk-1234567890");
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.reasons.some(r => r.startsWith("high_importance_pattern"))).toBe(true);
    });

    test("increases score for errors and bugs", () => {
      const result = scoreImportance("Bug: Application crashes when user clicks submit");
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.reasons.some(r => r.startsWith("high_importance_pattern"))).toBe(true);
    });

    test("decreases score for low importance patterns", () => {
      const result = scoreImportance("just okay whatever maybe");
      expect(result.score).toBeLessThan(0.5);
    });

    test("decreases score for test/tmp content", () => {
      const result = scoreImportance("this is just a test tmp file");
      expect(result.score).toBeLessThan(0.5);
      expect(result.reasons.some(r => r.startsWith("low_importance_pattern"))).toBe(true);
    });

    test("adjusts for content length", () => {
      const short = scoreImportance("setting");
      const long = scoreImportance("This is a detailed configuration setting that affects the entire application behavior");

      expect(long.score).toBeGreaterThan(short.score);
    });

    test("adjusts for structured content", () => {
      const structured = scoreImportance("Line 1\nLine 2\nLine 3\nLine 4");
      const unstructured = scoreImportance("Single line");

      expect(structured.score).toBeGreaterThan(unstructured.score);
    });

    test("detects factual statements", () => {
      const result = scoreImportance("The system uses Node.js for backend");
      expect(result.reasons).toContainEqual("factual_statement");
    });

    test("detects procedural content", () => {
      const result = scoreImportance("First click the button, then navigate to settings");
      expect(result.reasons).toContainEqual("procedural_content");
    });

    test("clamps score between 0.1 and 1.0", () => {
      const low = scoreImportance("ok");
      const high = scoreImportance("critical must always important essential password api key error bug rule policy " +
        "critical must always important essential password api key error bug rule policy " +
        "critical must always important essential password api key error bug rule policy");

      expect(low.score).toBeGreaterThanOrEqual(0.1);
      expect(low.score).toBeLessThanOrEqual(1.0);
      expect(high.score).toBeGreaterThanOrEqual(0.1);
      expect(high.score).toBeLessThanOrEqual(1.0);
    });

    test("sets confidence based on reason count", () => {
      const few = scoreImportance("important");
      expect(few.confidence).toBe("medium");

      const many = scoreImportance("critical error bug password api important must essential rule policy " +
        "fact: system uses node step first then next");
      expect(many.confidence).toBe("high");
    });
  });

  describe("ImportanceScorer class", () => {
    test("score method returns same result as function", () => {
      const scorer = new ImportanceScorer();
      const content = "User prefers dark mode";

      const result = scorer.score(content);
      const funcResult = scoreImportance(content);

      expect(result.score).toBeCloseTo(funcResult.score);
      expect(result.confidence).toBe(funcResult.confidence);
    });

    test("compare ranks two contents", () => {
      const scorer = new ImportanceScorer();
      const important = "Critical system configuration that must always be applied";
      const unimportant = "just a temp test maybe";

      const comparison = scorer.compare(important, unimportant);
      expect(comparison).toBeGreaterThan(0);
    });

    test("rank sorts contents by importance", () => {
      const scorer = new ImportanceScorer();
      const contents = [
        "just okay",
        "critical must always",
        "whatever maybe",
        "important essential",
      ];

      const ranked = scorer.rank(contents);

      expect(ranked[0].content).toBe("critical must always");
      expect(ranked[0].rank).toBeGreaterThan(ranked[3].rank);
    });

    test("rank handles empty array", () => {
      const scorer = new ImportanceScorer();
      const ranked = scorer.rank([]);
      expect(ranked).toEqual([]);
    });

    test("rank handles single item", () => {
      const scorer = new ImportanceScorer();
      const ranked = scorer.rank(["test"]);
      expect(ranked.length).toBe(1);
      expect(ranked[0].content).toBe("test");
    });
  });

  describe("edge cases", () => {
    test("handles very long content", () => {
      const longContent = "important ".repeat(10000);
      const result = scoreImportance(longContent);
      expect(result.score).toBeDefined();
    });

    test("handles unicode content", () => {
      const unicode = "用户偏好设置：暗色主题";
      const result = scoreImportance(unicode);
      expect(result).toBeDefined();
    });

    test("handles special characters", () => {
      const special = "!@#$%^&*() important setting";
      const result = scoreImportance(special);
      expect(result).toBeDefined();
    });
  });
});
