/**
 * Conversation management utilities
 *
 * Handles conversation history, message formatting,
 * and context window management.
 */

import type { AgentMessage } from '../types';
import { MESSAGE_ROLES, DEFAULTS } from '../constants';

/**
 * Create a conversation manager
 */
export class ConversationManager {
  private messages: AgentMessage[] = [];

  /**
   * Add a user message to the conversation
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: MESSAGE_ROLES.USER,
      content,
    });
  }

  /**
   * Add an assistant message to the conversation
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: MESSAGE_ROLES.ASSISTANT,
      content,
    });
  }

  /**
   * Add a system message to the conversation
   */
  addSystemMessage(content: string): void {
    this.messages.push({
      role: MESSAGE_ROLES.SYSTEM,
      content,
    });
  }

  /**
   * Add a tool result message to the conversation
   */
  addToolResult(toolCallId: string, toolName: string, content: string): void {
    this.messages.push({
      role: MESSAGE_ROLES.TOOL,
      content: JSON.stringify({
        tool_call_id: toolCallId,
        name: toolName,
        content,
      }),
      toolCallId,
      toolName,
    });
  }

  /**
   * Get recent messages within the context window
   */
  getRecentMessages(count: number = DEFAULTS.CONVERSATION_WINDOW_SIZE): AgentMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Get all messages
   */
  getAllMessages(): AgentMessage[] {
    return [...this.messages];
  }

  /**
   * Clear the conversation
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get conversation length
   */
  get length(): number {
    return this.messages.length;
  }
}

/**
 * Format message for LLM API
 */
export function formatMessage(message: AgentMessage): Record<string, unknown> {
  if (message.role === MESSAGE_ROLES.TOOL && message.toolCallId) {
    return {
      role: MESSAGE_ROLES.TOOL,
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

/**
 * Convert conversation to LLM format
 */
export function toLLMMessages(messages: AgentMessage[]): Array<Record<string, unknown>> {
  return messages.map(formatMessage);
}
