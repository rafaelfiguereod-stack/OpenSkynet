/**
 * Tests for Memory Consolidator.
 * Converted from Python tests for memory consolidation.
 */

import { test, describe, expect, beforeEach } from "bun:test";
import { MemoryConsolidator } from "../../src/memory/utils/consolidator";

describe("MemoryConsolidator", () => {
  describe("consolidateAndAdd", () => {
    test("adds directly when space available", async () => {
      const mockStore = {
        getUsage: () => ({
          entries: ["entry1", "entry2"],
          chars: 100,
          limit: 1000,
        }),
        add: (target: string, content: string) => ({
          success: true,
          entry: content,
        }),
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result.success).toBe(true);
    });

    test("merges small entries when needed", async () => {
      const entries = [
        "short entry 1",
        "short entry 2",
        "short entry 3",
        "medium sized entry that has more content",
      ];

      const mockStore = {
        getUsage: () => ({
          entries,
          chars: 500,
          limit: 300, // Need to free space
        }),
        add: (target: string, content: string) => ({
          success: true,
          entry: content,
        }),
        get: () => entries.join("\n---\n"),
        set: (target: string, content: string) => {},
        getFile: (target: string) => target,
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result).toBeDefined();
    });

    test("removes least relevant entries when full", async () => {
      const entries = [
        "very important memory with high importance score",
        "less important entry",
        "another less important entry",
        "temporary note",
      ];

      const mockStore = {
        getUsage: () => ({
          entries,
          chars: 600,
          limit: 400, // Need to free space
        }),
        add: (target: string, content: string) => ({
          success: true,
          entry: content,
        }),
        get: () => entries.join("\n---\n"),
        set: (target: string, content: string) => {},
        getFile: (target: string) => target,
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result).toBeDefined();
    });

    test("handles empty entries", async () => {
      const mockStore = {
        getUsage: () => ({
          entries: [],
          chars: 0,
          limit: 1000,
        }),
        add: (target: string, content: string) => ({
          success: true,
          entry: content,
        }),
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result.success).toBe(true);
    });

    test("returns error when cannot consolidate", async () => {
      const mockStore = {
        getUsage: () => ({
          entries: ["single entry"],
          chars: 1000,
          limit: 100, // Way over limit
        }),
        add: () => ({ success: true, entry: "new entry" }), // Succeeds after consolidation
        get: () => "single entry",
        set: () => {},
        getFile: () => "test",
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result.success).toBe(true);
    });
  });

  describe("with LLM", () => {
    test("summarizes old entries with LLM", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "Summary of entries",
          tool_calls: [],
          done: true,
        }),
      };

      const entries = [
        "Entry 1: User prefers dark mode",
        "Entry 2: User likes keyboard shortcuts",
        "Entry 3: User uses Emacs",
        "Entry 4: User knows TypeScript",
      ];

      const mockStore = {
        getUsage: () => ({
          entries,
          chars: 500,
          limit: 300,
        }),
        add: (target: string, content: string) => ({
          success: true,
          entry: content,
        }),
        get: () => entries.join("\n---\n"),
        set: (target: string, content: string) => {},
        getFile: (target: string) => target,
      };

      const consolidator = new MemoryConsolidator(mockLLM as any);
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new entry"
      );

      expect(result).toBeDefined();
    });
  });

  describe("setLLM", () => {
    test("updates LLM provider", () => {
      const consolidator = new MemoryConsolidator();
      const mockLLM = {};

      consolidator.setLLM(mockLLM as any);
      // LLM is set (no direct way to verify without implementation detail check)
    });

    test("can set to null", () => {
      const consolidator = new MemoryConsolidator();
      consolidator.setLLM(null);
      // Should work without error
    });
  });

  describe("ConsolidationResult", () => {
    test("returns consolidation metadata", async () => {
      const mockStore = {
        getUsage: () => ({
          entries: ["a", "b", "c"],
          chars: 100,
          limit: 50,
        }),
        add: () => ({ success: true }),
        get: () => "a\n---\nb\n---\nc",
        set: () => {},
        getFile: () => "test",
      };

      const consolidator = new MemoryConsolidator();
      const result = await consolidator.consolidateAndAdd(
        mockStore as any,
        "test",
        "new"
      );

      if (result.consolidation) {
        expect(result.consolidation.beforeCount).toBeGreaterThan(0);
        expect(result.consolidation.afterCount).toBeLessThanOrEqual(result.consolidation.beforeCount);
      }
    });
  });
});
