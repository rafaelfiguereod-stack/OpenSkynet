/**
 * ActionBasedTool - Senior-level implementation with advanced patterns
 *
 * Design Patterns:
 * - Factory Pattern: For tool creation
 * - Strategy Pattern: Pluggable behaviors
 * - Builder Pattern: Fluent configuration
 * - Memoization: Cache expensive operations
 * - Lazy Loading: Defer initialization until needed
 * - Immutable Data: Readonly types for safety
 * - Result Types: Better error handling
 */

import { z } from 'zod';
import type { BuiltinTool, ExecutableToolResult, ToolExecution } from './types';
import { literalRulePattern, matchesGlobRuleSubject } from './types';
import { ToolAccesses } from './tool-access';
import { ToolResultBuilder } from './result-builder';
import { zodToJsonSchema, createOneOfSchema } from './schema-utils';

/**
 * Result type for better error handling (Functional programming pattern)
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Context passed to action handlers (immutable)
 */
export interface ReadonlyActionContext {
  readonly signal: AbortSignal;
  readonly turnId: string;
  readonly toolCallId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Action context type alias for convenience
 */
export type ActionContext = ReadonlyActionContext;

/**
 * Strategy interface for custom execution behaviors
 */
export interface ExecutionStrategy {
  shouldExecute(actionName: string): boolean;
  onBeforeExecute?(actionName: string): void | Promise<void>;
  onAfterExecute?(actionName: string, result: ExecutableToolResult): void | Promise<void>;
}

/**
 * Definition of a single action within a tool
 */
export interface ActionDef<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodSchema<TInput>;
  readonly getAccesses: (input: TInput) => ToolAccesses;
  readonly execute: (input: TInput, ctx: ReadonlyActionContext, builder: ToolResultBuilder) => Promise<ExecutableToolResult>;
  readonly toDisplay?: (input: TInput) => Readonly<Record<string, unknown>>;
  readonly middleware?: ActionMiddleware<TInput>;
}

/**
 * Middleware for action execution
 */
export interface ActionMiddleware<TInput = unknown> {
  before?: (input: TInput, ctx: ReadonlyActionContext) => Result<TInput> | Promise<Result<TInput>>;
  after?: (result: ExecutableToolResult, input: TInput, ctx: ReadonlyActionContext) => ExecutableToolResult | Promise<ExecutableToolResult>;
}

/**
 * Options for creating an ActionBasedTool
 */
export interface ActionBasedToolOptions {
  readonly description?: string;
  readonly strategy?: ExecutionStrategy;
  readonly lazy?: boolean;
  readonly cacheSchema?: boolean;
}

// Global caches with cleanup support
const schemaCache = new WeakMap<z.ZodSchema, Record<string, unknown>>();
const descriptionCache = new WeakMap<readonly ActionDef[], string>();

/**
 * Memoization decorator for expensive operations
 */
function memoize<Args extends readonly unknown[], Return>(
  fn: (...args: Args) => Return,
  keyGenerator: (...args: Args) => string
): (...args: Args) => Return {
  const cache = new Map<string, Return>();
  return (...args: Args) => {
    const key = keyGenerator(...args);
    if (cache.has(key)) {
      return cache.get(key) as Return;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Optimized tool with advanced patterns
 */
export class ActionBasedTool<TInput = unknown> implements BuiltinTool<TInput> {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;

  private readonly actionMap: ReadonlyMap<string, ActionDef>;
  private readonly unionSchema: z.ZodSchema<any>;
  private readonly previewKeys: readonly string[];
  private readonly strategy?: ExecutionStrategy;
  private readonly lazy: boolean;
  private _initialized = false;

  constructor(
    name: string,
    actions: readonly ActionDef[],
    options: ActionBasedToolOptions = {}
  ) {
    this.name = name;
    this.strategy = options.strategy;
    this.lazy = options.lazy ?? false;

    // Build immutable action map
    this.actionMap = new Map(
      actions.map(a => [a.name, a] as const)
    );

    // Create union schema
    const schemas = actions.map((a) => a.schema);
    this.unionSchema = z.union(schemas as any);

    // Build description with caching
    this.description = options.description ?? this.buildDescription(actions);

    // Build parameters with optional caching
    this.parameters = options.cacheSchema !== false
      ? this.buildJsonSchemaCached(actions)
      : this.buildJsonSchema(actions);

    // Cache preview keys
    this.previewKeys = Object.freeze([
      'path', 'source', 'command', 'search_term',
      'identifier', 'query', 'url', 'target'
    ]);
  }

  /**
   * Memoized description builder
   */
  private buildDescription(actions: readonly ActionDef[]): string {
    if (descriptionCache.has(actions)) {
      return descriptionCache.get(actions)!;
    }

    const parts = actions.map(a => `**${a.name}**: ${a.description}`);
    const result = parts.join('\n');

    descriptionCache.set(actions, result);
    return result;
  }

  /**
   * Cached JSON schema builder
   */
  private buildJsonSchemaCached = memoize(
    (actions: readonly ActionDef[]) => this.buildJsonSchema(actions),
    (actions) => actions.map(a => a.name).join(',')
  );

  private buildJsonSchema(actions: readonly ActionDef[]): Record<string, unknown> {
    const variants = new Array(actions.length);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Check cache
      let jsonSchema = schemaCache.get(action.schema);
      if (!jsonSchema) {
        jsonSchema = zodToJsonSchema(action.schema);
        schemaCache.set(action.schema, jsonSchema);
      }

      variants[i] = Object.freeze({
        description: action.description,
        properties: Object.freeze({ ...(jsonSchema as any).properties ?? {} }),
        required: Object.freeze([...((jsonSchema as any).required ?? [])]),
      });
    }

    return Object.freeze(createOneOfSchema(variants));
  }

  /**
   * Resolve execution with strategy pattern and middleware support
   */
  async resolveExecution(input: TInput): Promise<ToolExecution> {
    // Lazy initialization check
    if (this.lazy && !this._initialized) {
      this._initialized = true;
    }

    // Check strategy
    const actionName = this.extractActionName(input);
    if (this.strategy && !this.strategy.shouldExecute(actionName)) {
      return {
        isError: true,
        output: `Action '${actionName}' is not allowed by execution strategy`,
      };
    }

    // Validate input
    const validationResult = this.validateInput(input);
    if (!validationResult.success) {
      return {
        isError: true,
        output: validationResult.error instanceof Error ? validationResult.error.message : (validationResult.error ?? 'Validation failed'),
      };
    }

    const data = validationResult.value;

    // Get action
    const actionResult = this.getAction(actionName);
    if (!actionResult.success) {
      return {
        isError: true,
        output: actionResult.error instanceof Error ? actionResult.error.message : (actionResult.error ?? 'Action not found'),
      };
    }

    const action = actionResult.value;

    // Execute middleware if present
    const middlewareResult = await this.executeMiddleware(action, data);
    if (!middlewareResult.success) {
      return {
        isError: true,
        output: middlewareResult.error instanceof Error ? middlewareResult.error.message : (middlewareResult.error ?? 'Middleware execution failed'),
      };
    }

    const finalInput = middlewareResult.value;

    // Build execution plan
    const accesses = action.getAccesses(finalInput);
    const preview = this.buildPreview(finalInput);

    return {
      accesses,
      description: preview
        ? `${this.name} operation: ${actionName} - ${preview}`
        : `${this.name} operation: ${actionName}`,
      display: Object.freeze({
        kind: this.name.toLowerCase(),
        action: actionName,
        ...data,
      }),
      approvalRule: literalRulePattern(this.name, actionName),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, actionName),
      execute: (ctx) => this.executeActionWithStrategy(action, finalInput, ctx),
    };
  }

  /**
   * Extract action name from input with validation
   */
  private extractActionName(input: TInput): string {
    const data = input as any;
    const actionName = data?.action;

    if (!actionName || typeof actionName !== 'string') {
      throw new Error('Invalid input: missing or invalid action field');
    }

    return actionName;
  }

  /**
   * Validate input using Result type
   */
  private validateInput(input: TInput): Result<any> {
    const parsed = this.unionSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: new Error(`Validation error: ${parsed.error.message}`)
      };
    }

    return { success: true, value: parsed.data };
  }

  /**
   * Get action with Result type
   */
  private getAction(actionName: string): Result<ActionDef> {
    const action = this.actionMap.get(actionName);

    if (!action) {
      return {
        success: false,
        error: new Error(`Unknown action: ${actionName}`)
      };
    }

    return { success: true, value: action };
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddleware<TInput>(action: ActionDef<TInput>, input: TInput): Promise<Result<TInput>> {
    if (!action.middleware?.before) {
      return { success: true, value: input };
    }

    try {
      const result = await action.middleware.before!(input, this.createContext());
      return result.success
        ? result
        : { success: false, error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  }

  /**
   * Execute action with strategy pattern
   */
  private async executeActionWithStrategy(
    action: ActionDef,
    input: unknown,
    ctx: { signal: AbortSignal; turnId: string; toolCallId: string }
  ): Promise<ExecutableToolResult> {
    if (ctx.signal.aborted) {
      return { isError: true, output: 'Aborted before execution started' };
    }

    // Execute before strategy hook
    if (this.strategy?.onBeforeExecute) {
      await this.strategy.onBeforeExecute(action.name);
    }

    const readonlyCtx = this.createContext(ctx);
    const builder = new ToolResultBuilder({ maxChars: 100_000 });

    let result: ExecutableToolResult;

    try {
      result = await action.execute(input, readonlyCtx, builder);

      // Execute after strategy hook
      if (this.strategy?.onAfterExecute) {
        await this.strategy.onAfterExecute(action.name, result);
      }

      // Execute after middleware
      if (action.middleware?.after) {
        result = await action.middleware.after(result, input, readonlyCtx);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      builder.write(`\nError: ${errorMessage}`);
      result = builder.error(`${action.name} failed`);
    }

    return result;
  }

  /**
   * Create immutable context
   */
  private createContext(ctx?: { signal: AbortSignal; turnId: string; toolCallId: string }): ReadonlyActionContext {
    return Object.freeze({
      signal: ctx?.signal ?? new AbortController().signal,
      turnId: ctx?.turnId ?? 'unknown',
      toolCallId: ctx?.toolCallId ?? this.generateToolCallId(),
    });
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Build preview with optimized iteration
   */
  private buildPreview(data: any): string {
    const keys = this.previewKeys;
    for (let i = 0; i < keys.length; i++) {
      const value = data[keys[i]];
      if (typeof value === 'string') {
        return value.length <= 41 ? value : value.slice(0, 40) + '...';
      }
    }
    return '';
  }
}

/**
 * Factory function for creating ActionBasedTool (Factory Pattern)
 */
export function createActionBasedTool<TInput = unknown>(
  name: string,
  actions: readonly ActionDef[],
  options?: ActionBasedToolOptions
): ActionBasedTool<TInput> {
  return new ActionBasedTool(name, actions, options);
}

/**
 * Builder for ActionBasedTool (Builder Pattern)
 */
export class ActionBasedToolBuilder<TInput = unknown> {
  private name = '';
  private actions: ActionDef[] = [];
  private options: ActionBasedToolOptions = {};

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withActions(actions: readonly ActionDef[]): this {
    this.actions = [...actions];
    return this;
  }

  addAction(action: ActionDef): this {
    this.actions.push(action);
    return this;
  }

  withDescription(description: string): this {
    this.options = { ...this.options, description };
    return this;
  }

  withStrategy(strategy: ExecutionStrategy): this {
    this.options = { ...this.options, strategy };
    return this;
  }

  withLazyLoading(lazy: boolean): this {
    this.options = { ...this.options, lazy };
    return this;
  }

  withCacheSchema(cache: boolean): this {
    this.options = { ...this.options, cacheSchema: cache };
    return this;
  }

  build(): ActionBasedTool<TInput> {
    if (!this.name) {
      throw new Error('Tool name is required');
    }
    if (this.actions.length === 0) {
      throw new Error('At least one action is required');
    }
    return new ActionBasedTool(this.name, this.actions, this.options);
  }
}
