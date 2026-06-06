/**
 * CompressionHandler - Handles context compression logic
 * Extracted from agent/loop.ts for better modularity
 */

import type { Message } from "../core/types";
import { ContextCompressor } from "../../agent/memory/compressor";

export class CompressionHandler {
  private compressor: ContextCompressor;
  private compressThreshold: number;

  constructor(compressor: ContextCompressor, compressThreshold: number) {
    this.compressor = compressor;
    this.compressThreshold = compressThreshold;
  }

  /**
   * Check if compression is needed based on iteration and conversation length
   */
  shouldCompress(iteration: number, conversationLength: number): boolean {
    return (
      iteration % this.compressThreshold === 0 &&
      conversationLength > this.compressThreshold
    );
  }

  /**
   * Compress conversation history
   */
  compress(conversation: Message[], maxTokens: number): Message[] {
    // ContextCompressor expects generic Message type, convert if needed
    const genericMessages = conversation.map(m => ({
      role: m.role as string,
      content: m.content,
    }));
    const compressed = this.compressor.compress(genericMessages, maxTokens);
    // Convert back to our Message type (timestamp may be lost in compression)
    return compressed.map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      timestamp: 'timestamp' in m ? (m.timestamp as number | undefined) : undefined,
    }));
  }

  /**
   * Compress with default threshold
   */
  compressWithThreshold(conversation: Message[]): Message[] {
    return this.compress(conversation, 80_000);
  }

  /**
   * Get compression threshold
   */
  getThreshold(): number {
    return this.compressThreshold;
  }
}
