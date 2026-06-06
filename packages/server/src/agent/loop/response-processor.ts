/**
 * ResponseProcessor - Handles LLM response processing
 * Extracted from agent/loop.ts for better modularity
 */

import type { Message } from "../core/types";

export interface ParsedResponse {
  visible: string;
  thinking: string;
  hasThinking: boolean;
}

export interface ProcessedResponse {
  hasToolCalls: boolean;
  finalResult: string;
  visibleText?: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export class ResponseProcessor {
  private thinkParser: ThinkTagParser;

  constructor() {
    this.thinkParser = new ThinkTagParser();
  }

  /**
   * Parse thinking tags from response text
   */
  parseThinking(text: string): ParsedResponse {
    const parsed = this.thinkParser.parse(text);
    return {
      visible: parsed.visible || "",
      thinking: parsed.thinking || "",
      hasThinking: !!parsed.thinking,
    };
  }

  /**
   * Process LLM response to extract tool calls and text
   */
  processResponse(response: {
    text?: string;
    tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }): ProcessedResponse {
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;

    if (hasToolCalls) {
      // Process tool calls response
      let visibleText = "";
      if (response.text) {
        const parsed = this.parseThinking(response.text);
        visibleText = parsed.visible;
      }

      return {
        hasToolCalls: true,
        finalResult: "",
        visibleText,
        toolCalls: response.tool_calls!,
      };
    } else {
      // Process final text response
      const text = response.text ?? "";
      const parsed = this.parseThinking(text);
      const finalResult = parsed.visible || text;

      return {
        hasToolCalls: false,
        finalResult,
        visibleText: parsed.visible,
        toolCalls: [],
      };
    }
  }

  /**
   * Check if response indicates completion
   */
  isCompletion(processed: ProcessedResponse): boolean {
    return !processed.hasToolCalls && processed.finalResult.length > 0;
  }
}

/**
 * ThinkTagParser - Parse thinking tags from LLM responses
 * Copied from agent/loop.ts to be used by ResponseProcessor
 */
export class ThinkTagParser {
  /**
   * Parse text to extract visible content and thinking
   */
  parse(text: string): { visible?: string; thinking?: string } {
    const thinkRegex = /<think[^>]*>([\s\S]*?)<\/think>/gi;
    const matches = text.match(thinkRegex);
    const thinking = matches ? matches.map((m) => m.replace(/<\/?think[^>]*>/gi, "").trim()).join("\n") : "";
    const visible = text.replace(thinkRegex, "").trim();

    return { visible: visible || undefined, thinking: thinking || undefined };
  }

  /**
   * Check if text contains thinking tags
   */
  hasThinking(text: string): boolean {
    return /<think[^>]*>[\s\S]*?<\/think>/gi.test(text);
  }

  /**
   * Strip thinking tags from text
   */
  stripThinking(text: string): string {
    return text.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, "").trim();
  }
}
