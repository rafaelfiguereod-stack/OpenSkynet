/**
 * Tests for Memory Context Scrubber.
 * Converted from Python tests for memory scrubber.
 */

import { test, describe, expect } from "bun:test";
import {
  scrubMemoryTags,
  StreamingContextScrubber,
  ScrubberTransformStream,
} from "../../src/memory/utils/scrubber";

describe("StreamingContextScrubber", () => {
  describe("scrubMemoryTags", () => {
    test("removes memory context tags from text", () => {
      const text = "Hello <memory-context>secret info</memory-context> world";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).toBe("Hello  world");
    });

    test("removes multiple memory context blocks", () => {
      const text = "<memory-context>info1</memory-context> middle <memory-context>info2</memory-context>";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).not.toContain("<memory-context>");
      expect(scrubbed).not.toContain("</memory-context>");
    });

    test("handles case insensitive matching", () => {
      const text = "<Memory-Context>secret</MEMORY-CONTEXT>";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).not.toContain("<Memory-Context>");
    });

    test("handles nested content with newlines", () => {
      const text = "Start <memory-context>\nLine 1\nLine 2\n</memory-context> End";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).not.toContain("<memory-context>");
    });

    test("preserves text outside tags", () => {
      const text = "Before <memory-context>secret</memory-context> After";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).toContain("Before");
      expect(scrubbed).toContain("After");
    });

    test("handles empty string", () => {
      const scrubbed = scrubMemoryTags("");
      expect(scrubbed).toBe("");
    });

    test("handles text without tags", () => {
      const text = "Just normal text";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).toBe("Just normal text");
    });

    test("handles unclosed tag", () => {
      const text = "Text <memory-context>no closing";
      const scrubbed = scrubMemoryTags(text);
      // Scrub incomplete tags
      expect(scrubbed).toBeDefined();
    });

    test("trims whitespace", () => {
      const text = "  <memory-context>secret</memory-context>  ";
      const scrubbed = scrubMemoryTags(text);
      expect(scrubbed).toBe("");
    });
  });

  describe("StreamingContextScrubber class", () => {
    test("feed processes chunks incrementally", () => {
      const scrubber = new StreamingContextScrubber();

      const chunk1 = "Hello ";
      const chunk2 = "<memory-context>secret";
      const chunk3 = "</memory-context> world";

      const out1 = scrubber.feed(chunk1);
      const out2 = scrubber.feed(chunk2);
      const out3 = scrubber.feed(chunk3);

      expect(out1).toBe("Hello ");
      expect(out2).toBe("");
      expect(out3).toBe(" world");
    });

    test("feed returns safe content before tag", () => {
      const scrubber = new StreamingContextScrubber();

      const out1 = scrubber.feed("Safe text ");
      const out2 = scrubber.feed("<memory-context>hidden</memory-context> after");

      expect(out1).toBe("Safe text ");
      expect(out2).toBe(" after");
    });

    test("handles tag split across chunks", () => {
      const scrubber = new StreamingContextScrubber();

      const out1 = scrubber.feed("before <memory-con");
      const out2 = scrubber.feed("text>hidden</memory-context>");
      const out3 = scrubber.feed(" after");

      expect(out1).toBe("before ");
      expect(out2).toBe("");
      expect(out3).toBe(" after");
    });

    test("flush returns remaining buffer", () => {
      const scrubber = new StreamingContextScrubber();

      const out1 = scrubber.feed("some text");
      const out2 = scrubber.feed("<memory-context>incomplete");
      const flushed = scrubber.flush();

      expect(out1).toBe("some text");
      expect(out2).toBe("");
      expect(flushed).toBe("");
    });

    test("reset clears buffer and state", () => {
      const scrubber = new StreamingContextScrubber();

      scrubber.feed("<memory-context>incomplete");
      scrubber.reset();

      const out = scrubber.feed("new text");
      expect(out).toBe("new text");
    });

    test("multiple reset cycles work", () => {
      const scrubber = new StreamingContextScrubber();

      const out1 = scrubber.feed("first");
      scrubber.reset();
      const out2 = scrubber.feed("second");
      scrubber.reset();
      const out3 = scrubber.feed("third");

      expect(out1).toBe("first");
      expect(out2).toBe("second");
      expect(out3).toBe("third");

      const flushed = scrubber.flush();
      expect(flushed).toBe("");
    });

    test("handles large chunks", () => {
      const scrubber = new StreamingContextScrubber();

      const largeText = "a".repeat(10000) + "<memory-context>secret</memory-context>" + "b".repeat(10000);

      const out = scrubber.feed(largeText);
      expect(out).not.toContain("<memory-context>");
      expect(out).not.toContain("secret");
    });
  });

  describe("complex scenarios", () => {
    test("handles interleaved tags and content", () => {
      const scrubber = new StreamingContextScrubber();

      const chunks = [
        "Start ",
        "<memory-context>hide this</memory-context> ",
        "middle ",
        "<memory-context>also hide</memory-context> ",
        "end",
      ];

      let output = "";
      for (const chunk of chunks) {
        output += scrubber.feed(chunk);
      }

      expect(output).toBe("Start  middle  end");
    });

    test("handles only tag content", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("<memory-context>completely hidden</memory-context>");
      expect(out).toBe("");
    });

    test("handles only safe content", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("completely safe text");
      expect(out).toBe("completely safe text");
    });

    test("handles rapid tag open/close", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("a<memory-context>b</memory-context>c");
      expect(out).toBe("ac");
    });

    test("handles nested-like patterns (not real nesting)", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("before <memory-context>inner <memory-context>deep</memory-context> outer</memory-context> after");
      // First closing tag should end the first open
      expect(out).not.toContain("deep");
    });
  });

  describe("edge cases", () => {
    test("handles empty chunks", () => {
      const scrubber = new StreamingContextScrubber();

      const out1 = scrubber.feed("");
      const out2 = scrubber.feed("text");
      const out3 = scrubber.feed("");

      expect(out1).toBe("");
      expect(out2).toBe("text");
      expect(out3).toBe("");
    });

    test("handles unicode content", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("Unicode: 世界 <memory-context>hidden</memory-context> 🌍");
      expect(out).toContain("世界");
      expect(out).toContain("🌍");
      expect(out).not.toContain("hidden");
    });

    test("handles special characters", () => {
      const scrubber = new StreamingContextScrubber();

      const out = scrubber.feed("Special: !@#$% <memory-context>x</memory-context> ^&*()");
      expect(out).toContain("!@#$%");
      expect(out).toContain("^&*()");
      expect(out).not.toContain("x");
    });
  });
});

describe("ScrubberTransformStream", () => {
  test("creates transform stream", () => {
    const stream = new ScrubberTransformStream();
    expect(stream).toBeDefined();
    expect(stream.readable).toBeDefined();
    expect(stream.writable).toBeDefined();
  });

  test("can be used in pipeline", () => {
    const stream = new ScrubberTransformStream();

    // In real usage, this would be piped to another stream
    // For testing, we just verify it doesn't throw
    expect(() => {
      const writer = stream.writable.getWriter();
      writer.write("test");
      writer.close();
    }).not.toThrow();
  });
});
