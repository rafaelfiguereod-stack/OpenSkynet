/**
 * Tests for T800Agent
 *
 * Tests the comprehensive agent with all tools:
 * - Browser, Shell, File, Web, Skills, Document, Coding
 * - Direct task execution
 * - Tool integration
 * - Error handling
 */

import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rmSync, mkdirSync } from "node:fs";
import { T800Agent } from "../../../src/electron/agent/T800Agent";
import type { T800AgentOpts } from "../../../src/electron/agent/T800Agent";
import type { LLMProvider } from "../../../src/llm/provider";
import type { BaseMemoryStrategy } from "../../../src/memory/strategy";

// Mock LLM Provider
class MockLLMProvider implements LLMProvider {
  constructor(private responses: string[] = []) {}

  async chat(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[],
    systemPrompt?: string
  ): Promise<{
    text?: string;
    tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }> {
    // Return pre-configured response
    const response = this.responses.shift() || "Task completed successfully";
    return { text: response };
  }

  async embed(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async countTokens(text: string): Promise<number> {
    return text.length / 4;
  }

  getContextLimit(model?: string): number {
    return 128000;
  }
}

// Mock Memory Strategy
class MockMemoryStrategy implements BaseMemoryStrategy {
  onTurnStart(): Promise<void> {
    return Promise.resolve();
  }

  onSessionEnd(): Promise<void> {
    return Promise.resolve();
  }

  write(target: string, content: string, metadata?: Record<string, unknown>): void {
    // Do nothing
  }

  read(target: string): string {
    return "";
  }

  search(query: string, limit?: number): Array<{ content: string; score: number }> {
    return [];
  }

  context(query: string, maxTokens?: number): string {
    return "";
  }

  clear(): void {
    // Do nothing
  }
}

describe("T800Agent", () => {
  let testDir: string;
  let agent: T800Agent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `t800-agent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create mock LLM provider
    mockLLM = new MockLLMProvider(["Task completed successfully"]);

    // Create agent with minimal dependencies
    const opts: T800AgentOpts = {
      llmProvider: mockLLM,
      memory: new MockMemoryStrategy(),
      workingDirectory: testDir,
      enableShellTools: false, // Disable shell for tests
      enableBrowserTools: false, // Disable browser for tests
      enableFileTools: true,
      enableWebTools: false, // Disable web for tests (requires network)
      enableSkillsTools: false, // Disable skills for tests
      enableDocumentTools: true,
      enableCodingTools: true,
    };

    agent = new T800Agent(opts);
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("agent initialization", () => {
    test("creates agent with dependencies", () => {
      expect(agent).toBeTruthy();
      expect(agent.getWorkingDirectory()).toBe(testDir);
    });

    test("has conversation tracking", () => {
      const conversation = agent.getConversation();
      expect(Array.isArray(conversation)).toBe(true);
    });
  });

  describe("task execution", () => {
    test("executes simple task successfully", async () => {
      const result = await agent.run("Test task");

      expect(result.success).toBe(true);
      expect(result.task).toBe("Test task");
      expect(result.result).toBeTruthy();
    });

    test("tracks steps in execution", async () => {
      const result = await agent.run("Test task");

      expect(result.steps).toBeTruthy();
      expect(Array.isArray(result.steps)).toBe(true);
    });

    test("tracks actions taken", async () => {
      const result = await agent.run("Test task");

      expect(result.actions_taken).toBeTruthy();
      expect(Array.isArray(result.actions_taken)).toBe(true);
    });

    test("tracks iterations", async () => {
      const result = await agent.run("Test task");

      expect(result.iterations).toBe(1);
    });

    test("uses correct strategy", async () => {
      const result = await agent.run("Test task");

      expect(result.strategy_used).toBe("t800_agent");
    });
  });

  describe("error handling", () => {
    test("handles LLM errors gracefully", async () => {
      // Create agent with failing LLM
      const failingLLM = new MockLLMProvider();
      failingLLM.chat = async () => {
        throw new Error("LLM connection failed");
      };

      const opts: T800AgentOpts = {
        llmProvider: failingLLM,
        memory: new MockMemoryStrategy(),
        workingDirectory: testDir,
        enableShellTools: false,
        enableBrowserTools: false,
        enableFileTools: false,
        enableWebTools: false,
        enableSkillsTools: false,
        enableDocumentTools: false,
        enableCodingTools: false,
      };

      const errorAgent = new T800Agent(opts);
      const result = await errorAgent.run("Test task");

      expect(result.success).toBe(false);
      expect(result.result).toContain("LLM error");
    });
  });

  describe("cancellation", () => {
    test("can cancel running task", async () => {
      // Create agent with delayed response
      const delayedLLM = new MockLLMProvider();
      let resolveLLM: (value: string) => void;
      const llmPromise = new Promise<string>((resolve) => {
        resolveLLM = resolve;
      });

      delayedLLM.chat = async () => {
        const response = await llmPromise;
        return { text: response };
      };

      const opts: T800AgentOpts = {
        llmProvider: delayedLLM,
        memory: new MockMemoryStrategy(),
        workingDirectory: testDir,
        enableShellTools: false,
        enableBrowserTools: false,
        enableFileTools: false,
        enableWebTools: false,
        enableSkillsTools: false,
        enableDocumentTools: false,
        enableCodingTools: false,
      };

      const cancelAgent = new T800Agent(opts);

      // Start task (don't await)
      const taskPromise = cancelAgent.run("Long task");

      // Cancel immediately
      cancelAgent.cancel();

      // Resolve LLM to allow cleanup
      resolveLLM!("Task done");

      const result = await taskPromise;

      // The result should indicate cancellation or task was stopped
      expect(result.success).toBe(false);
    });
  });

  describe("working directory", () => {
    test("sets working directory correctly", async () => {
      const newDir = join(tmpdir(), `t800-test-${Date.now()}`);
      mkdirSync(newDir, { recursive: true });

      await agent.setWorkingDirectory(newDir);

      expect(agent.getWorkingDirectory()).toBe(newDir);

      // Cleanup
      rmSync(newDir, { recursive: true, force: true });
    });

    test("rejects invalid working directory", async () => {
      await expect(agent.setWorkingDirectory("/nonexistent/path")).rejects.toThrow();
    });
  });

  describe("tool integration", () => {
    test("can execute file operations", async () => {
      // This test verifies the agent can use file tools
      // Actual tool execution would require more complex mocking
      const result = await agent.run("Test task");

      expect(result.success).toBe(true);
    });
  });
});
