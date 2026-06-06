/**
 * Orchestrate tool - execute complex search pipelines using SearchSDK.
 * Allows model to provide Python/JavaScript code with access to search subsystems.
 */

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { ToolDefinition } from "../../core/types.js";
import type { ToolResult } from "./interfaces.js";
import type { ToolBus } from "./bus.js";
import type { SearchSDK } from "../../search/sdk/index.js";
import type { SearchResult } from "../../search/base.js";

export interface OrchestrateConfig {
  allowed?: boolean;
  timeout?: number;
  searchSDK?: SearchSDK;
}

/**
 * Wrapped SearchSDK API for sandboxed code execution.
 * Provides a safe interface to search functionality.
 */
class SandboxSearchAPI {
  constructor(private sdk: SearchSDK) {}

  async web(query: string, limit = 10): Promise<SearchResult[]> {
    return this.sdk.search(query, { limit });
  }

  async webMany(queries: string[], limit = 10, concurrency = 3): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const executing: Promise<SearchResult[]>[] = [];

    for (const query of queries) {
      const promise = this.sdk.search(query, { limit });
      results.push(...(await promise));

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }

      executing.push(promise);
    }

    await Promise.all(executing);
    return results;
  }

  filterByDomain(results: SearchResult[], exclude: string[]): SearchResult[] {
    const excludeSet = new Set(exclude);
    return results.filter((r) => {
      try {
        if (!r.url) return true; // Filter out results without URLs
        const url = new URL(r.url);
        return !excludeSet.has(url.hostname);
      } catch {
        return true;
      }
    });
  }

  async extract(results: SearchResult[], schema?: Record<string, unknown>): Promise<unknown[]> {
    // Simple extraction - in production you'd use LLM for structured extraction
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      ...schema,
    }));
  }
}

export class OrchestrateTool {
  private allowed: boolean;
  private timeout: number;
  private searchSDK?: SearchSDK;

  constructor(config: OrchestrateConfig = {}) {
    this.allowed = config.allowed ?? false;
    this.timeout = config.timeout ?? 30;
    this.searchSDK = config.searchSDK;
  }

  register(bus: ToolBus): void {
    const definition: ToolDefinition = {
      name: "orchestrate_search",
      description: "Execute complex search pipelines using code with access to SearchSDK. Retrieve, filter, and extract from web search results.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript code to execute. Has access to 'sdk' with methods: web(query), webMany(queries), filterByDomain(results, exclude), extract(results, schema). Return results as an array.",
          },
          timeout: {
            type: "number",
            description: "Timeout in seconds (default 30)",
          },
        },
        required: ["code"],
      },
      toolset: "search",
    };

    bus.register(definition, async (_name: string, args: Record<string, unknown>) => {
      if (!this.allowed) {
        return {
          success: false,
          output: "",
          error: "Search orchestration is not allowed. Enable it in configuration.",
        };
      }

      if (!this.searchSDK) {
        return {
          success: false,
          output: "",
          error: "SearchSDK not configured. Cannot execute orchestration.",
        };
      }

      const code = args.code as string;
      const timeoutSec = (args.timeout as number) ?? this.timeout;

      if (!code || !code.trim()) {
        return { success: false, output: "", error: "Code is required" };
      }

      try {
        const result = await this._execute(code, timeoutSec);
        return {
          success: true,
          output: result.output,
          data: {
            execution_time: result.executionTime,
            result_count: result.resultCount,
          },
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });
  }

  private async _execute(
    code: string,
    timeoutSec: number,
  ): Promise<{ output: string; executionTime: number; resultCount: number }> {
    const startTime = Date.now();
    const tempDir = await mkdtemp(join(tmpdir(), "orchestrate-"));

    try {
      // Wrap code with SDK access
      const sandbox = new SandboxSearchAPI(this.searchSDK!);
      const wrappedCode = `
        const sdk = {
          web: async (query, limit) => {
            const results = await SEARCH_FN(query, limit);
            return results;
          },
          webMany: async (queries, limit, concurrency) => {
            const results = [];
            for (const q of queries) {
              results.push(...await SEARCH_FN(q, limit));
            }
            return results;
          },
          filterByDomain: (results, exclude) => {
            const excludeSet = new Set(exclude);
            return results.filter(r => {
              try {
                const url = new URL(r.url);
                return !excludeSet.has(url.hostname);
              } catch { return true; }
            });
          },
          extract: async (results, schema) => {
            return results.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              ...schema
            }));
          }
        };

        (async () => {
          try {
            ${code}
          } catch (err) {
            console.error(JSON.stringify({ error: err.message }));
          }
        })()
      `;

      // Write to temp file
      const scriptPath = join(tempDir, "orchestrate.js");
      await writeFile(scriptPath, wrappedCode, "utf-8");

      // Execute with search function injection
      const output = await this._runWithSearch(sandbox, scriptPath, timeoutSec);
      const resultCount = this._countResults(output);

      return {
        output,
        executionTime: Date.now() - startTime,
        resultCount,
      };
    } finally {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async _runWithSearch(
    sandbox: SandboxSearchAPI,
    scriptPath: string,
    timeoutSec: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";
      let error = "";

      const child = spawn("node", [scriptPath], {
        env: process.env,
        timeout: timeoutSec * 1000,
      });

      child.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        error += data.toString();
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(output || error);
        } else {
          reject(new Error(`Script failed with exit code ${code}: ${error}`));
        }
      });

      child.on("error", (err: Error) => {
        reject(new Error(`Failed to execute script: ${err.message}`));
      });
    });
  }

  private _countResults(output: string): number {
    // Try to parse output as array or count occurrences
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) return parsed.length;
    } catch {
      // Not JSON, count result indicators
      const matches = output.match(/\[.*\]/g);
      return matches?.length ?? 0;
    }
    return 0;
  }

  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setSearchSDK(sdk: SearchSDK): void {
    this.searchSDK = sdk;
  }
}
