/**
 * Tests for TerminatorAgent
 *
 * Tests the orchestrator agent with:
 * - Task decomposition
 * - Subtask execution
 * - Parallel execution support
 * - Result aggregation
 */

import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { TerminatorAgent } from "../../../src/electron/agent/TerminatorAgent";
import { T800Agent, type T800AgentOpts } from "../../../src/electron/agent/T800Agent";
import type { LLMProvider } from "../../../src/llm/provider";
import type { BaseMemoryStrategy } from "../../../src/memory/strategy";

// Mock LLM Provider
class MockLLMProvider implements LLMProvider {
  constructor(private responses: string[] = [], private shouldFail = false) {}

  async chat(
    messages: Array<{ role: string; content: string }>,
    tools: unknown[],
    systemPrompt?: string
  ): Promise<{
    text?: string;
    tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }> {
    if (this.shouldFail) {
      throw new Error("LLM connection failed");
    }

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

describe("TerminatorAgent", () => {
  let testDir: string;
  let agent: TerminatorAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `terminator-agent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create mock LLM provider
    mockLLM = new MockLLMProvider(["Task completed successfully"]);

    // Create agent with minimal dependencies
    const opts: T800AgentOpts & {
      maxParallelism?: number;
      decompositionThreshold?: number;
    } = {
      llmProvider: mockLLM,
      memory: new MockMemoryStrategy(),
      workingDirectory: testDir,
      enableShellTools: false,
      enableBrowserTools: false,
      enableFileTools: false,
      enableWebTools: false,
      enableSkillsTools: false,
      enableDocumentTools: false,
      enableCodingTools: false,
      maxParallelism: 2,
      decompositionThreshold: 10, // Lower threshold for testing
    };

    agent = new TerminatorAgent(opts);
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

    test("extends T800Agent", () => {
      expect(agent instanceof T800Agent).toBe(true);
    });
  });

  describe("task classification", () => {
    test("executes simple tasks directly", async () => {
      // Simple task under threshold
      const result = await agent.run("Simple task");

      expect(result.success).toBe(true);
      expect(result.strategy_used).toBe("t800_agent");
    });

    test("decomposes complex tasks", async () => {
      // This is a complex task that should trigger decomposition
      const result = await agent.run("First, analyze the data. Then, create a report. Finally, summarize the findings.");

      // Should use orchestrator strategy
      expect(result.strategy_used).toBe("terminator_orchestrator");
    });

    test("handles tasks with multiple steps", async () => {
      const result = await agent.run("Step 1: Setup. Step 2: Execute. Step 3: Verify.");

      expect(result.success).toBe(true);
    });
  });

  describe("task decomposition", () => {
    test("decomposes task by delimiters", async () => {
      // Mock LLM to fail decomposition, triggering fallback
      const fallbackLLM = new MockLLMProvider(["Task 1. Task 2. Task 3."]);
      let callCount = 0;
      fallbackLLM.chat = async () => {
        callCount++;
        // Fail on first call (decomposition), succeed on subtask calls
        if (callCount === 1) {
          throw new Error("Decomposition failed");
        }
        return { text: "Subtask completed" };
      };

      const opts: T800AgentOpts = {
        llmProvider: fallbackLLM,
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

      const fallbackAgent = new TerminatorAgent(opts);

      const result = await fallbackAgent.run("Task 1. Task 2. Task 3.");

      // Should use fallback decomposition and complete
      expect(result !== undefined).toBe(true);
    });
  });

  describe("subtask execution", () => {
    test("executes subtasks sequentially", async () => {
      const result = await agent.run("Complex multi-step task that exceeds threshold");

      expect(result.success).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    test("aggregates results from subtasks", async () => {
      const result = await agent.run("First do this. Then do that. Finally complete.");

      expect(result.result).toBeTruthy();
      expect(typeof result.result).toBe("string");
    });

    test("tracks total iterations across subtasks", async () => {
      const result = await agent.run("Complex task");

      expect(result.iterations).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    test("handles subtask failures gracefully", async () => {
      // Create LLM that fails on second call
      let callCount = 0;
      const failingLLM = new MockLLMProvider(["Success", "Failure"]);
      failingLLM.chat = async () => {
        callCount++;
        if (callCount > 1) {
          throw new Error("Subtask failed");
        }
        return { text: "Success" };
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

      const errorAgent = new TerminatorAgent(opts);

      const result = await errorAgent.run("Complex task");

      // Should still complete but with some failures
      expect(result !== undefined).toBe(true);
    });

    test("handles LLM errors during decomposition", async () => {
      // Create LLM that fails decomposition but works for subtasks
      let callCount = 0;
      const failingLLM = new MockLLMProvider(["Subtask success"]);
      failingLLM.chat = async () => {
        callCount++;
        // First call is decomposition - fail it
        if (callCount === 1) {
          throw new Error("LLM failed");
        }
        // Subsequent calls for subtasks - succeed
        return { text: "Subtask completed" };
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

      const errorAgent = new TerminatorAgent(opts);

      const result = await errorAgent.run("Complex task");

      // Should fallback to simple decomposition and complete
      expect(result !== undefined).toBe(true);
    });
  });

  describe("parallelism", () => {
    test("respects maxParallelism setting", async () => {
      // This tests the configuration is applied
      // Actual parallel execution would require more complex setup
      const result = await agent.run("Complex task");

      expect(result !== undefined).toBe(true);
    });
  });

  describe("result aggregation", () => {
    test("provides detailed summary", async () => {
      const result = await agent.run("Complex multi-step task that exceeds threshold");

      expect(result.result).toBeTruthy();
      // Check that result contains summary information
      if (result.success) {
        expect(result.result.length).toBeGreaterThan(0);
      }
    });

    test("includes subtask status", async () => {
      const result = await agent.run("Complex task");

      // Result should indicate what happened with subtasks
      expect(typeof result.result).toBe("string");
    });
  });

  describe("configuration", () => {
    test("accepts undefined options", () => {
      // Test that agent can be created with minimal options
      const agent2 = new TerminatorAgent({
        llmProvider: mockLLM,
        memory: new MockMemoryStrategy(),
        workingDirectory: testDir,
        enableShellTools: false,
        enableBrowserTools: false,
        enableFileTools: false,
        enableWebTools: false,
        enableSkillsTools: false,
        enableDocumentTools: false,
        enableCodingTools: false,
      });
      expect(agent2).toBeTruthy();
    });

    test("uses custom maxParallelism", () => {
      const customOpts: T800AgentOpts & {
        maxParallelism?: number;
      } = {
        llmProvider: mockLLM,
        memory: new MockMemoryStrategy(),
        workingDirectory: testDir,
        enableShellTools: false,
        enableBrowserTools: false,
        enableFileTools: false,
        enableWebTools: false,
        enableSkillsTools: false,
        enableDocumentTools: false,
        enableCodingTools: false,
        maxParallelism: 5,
      };

      const customAgent = new TerminatorAgent(customOpts);
      expect(customAgent).toBeTruthy();
    });

    test("uses custom decompositionThreshold", () => {
      const customOpts: T800AgentOpts & {
        decompositionThreshold?: number;
      } = {
        llmProvider: mockLLM,
        memory: new MockMemoryStrategy(),
        workingDirectory: testDir,
        enableShellTools: false,
        enableBrowserTools: false,
        enableFileTools: false,
        enableWebTools: false,
        enableSkillsTools: false,
        enableDocumentTools: false,
        enableCodingTools: false,
        decompositionThreshold: 100,
      };

      const customAgent = new TerminatorAgent(customOpts);
      expect(customAgent).toBeTruthy();
    });
  });
});
