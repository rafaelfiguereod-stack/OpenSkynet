/**
 * Tool Manager - Senior-level implementation with:
 * - Lazy loading
 * - Dependency Injection
 * - Lifecycle management
 * - Thread-safe operations
 */

import type { BuiltinTool } from './types';
import type { ToolBus } from '../../agent/tools/bus';

/**
 * Dependency Injection Container
 * Manages tool dependencies with proper lifecycle
 */
export class ToolDIContainer {
  private readonly singletons = new Map<string, unknown>();
  private readonly factories = new Map<string, () => unknown>();
  private readonly transient = new Set<string>();

  /**
   * Register a singleton dependency
   */
  registerSingleton<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
    this.singletons.delete(key);
    this.transient.delete(key);
  }

  /**
   * Register a transient dependency (new instance each time)
   */
  registerTransient<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
    this.transient.add(key);
  }

  /**
   * Register an existing instance
   */
  registerInstance<T>(key: string, instance: T): void {
    this.singletons.set(key, instance);
    this.factories.delete(key);
    this.transient.delete(key);
  }

  /**
   * Resolve a dependency
   */
  resolve<T>(key: string): T {
    // Check for existing instance
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Check if transient
    if (this.transient.has(key)) {
      const factory = this.factories.get(key);
      if (!factory) {
        throw new Error(`No factory registered for: ${key}`);
      }
      return factory() as T;
    }

    // Create new singleton
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`No factory registered for: ${key}`);
    }

    const instance = factory();
    this.singletons.set(key, instance);
    return instance as T;
  }

  /**
   * Check if dependency exists
   */
  has(key: string): boolean {
    return this.factories.has(key) || this.singletons.has(key);
  }

  /**
   * Clear all dependencies (for testing)
   */
  clear(): void {
    this.singletons.clear();
    this.factories.clear();
    this.transient.clear();
  }
}

/**
 * Tool lifecycle hooks
 */
export interface ToolLifecycle {
  onBeforeLoad?(toolName: string): void | Promise<void>;
  onAfterLoad?(toolName: string, tool: BuiltinTool): void | Promise<void>;
  onBeforeUnload?(toolName: string, tool: BuiltinTool): void | Promise<void>;
  onAfterUnload?(toolName: string): void | Promise<void>;
}

/**
 * Lazy tool descriptor
 */
interface LazyToolDescriptor {
  readonly name: string;
  readonly loader: () => Promise<BuiltinTool> | BuiltinTool;
  readonly dependencies?: string[];
  loaded?: boolean;
  tool?: BuiltinTool;
}

/**
 * Lazy-loading Tool Manager
 * Implements proxy pattern for on-demand tool loading
 */
export class LazyToolManager {
  private readonly container = new ToolDIContainer();
  private readonly tools = new Map<string, LazyToolDescriptor>();
  private readonly loadingPromises = new Map<string, Promise<BuiltinTool>>();
  private lifecycle?: ToolLifecycle;

  constructor(lifecycle?: ToolLifecycle) {
    this.lifecycle = lifecycle;
  }

  /**
   * Register a lazy tool
   */
  registerTool(
    name: string,
    loader: () => Promise<BuiltinTool> | BuiltinTool,
    dependencies: string[] = []
  ): void {
    this.tools.set(name, { name, loader, dependencies, loaded: false });
  }

  /**
   * Register an immediate tool
   */
  registerImmediateTool(name: string, tool: BuiltinTool): void {
    this.tools.set(name, {
      name,
      loader: () => tool,
      dependencies: [],
      loaded: true,
      tool
    });
  }

  /**
   * Register a tool factory (for DI)
   */
  registerToolFactory<T>(
    name: string,
    factory: () => T,
    singleton: boolean = true
  ): void {
    if (singleton) {
      this.container.registerSingleton(name, factory);
    } else {
      this.container.registerTransient(name, factory);
    }
  }

  /**
   * Get a tool (loads if necessary)
   */
  async getTool(name: string): Promise<BuiltinTool | null> {
    const descriptor = this.tools.get(name);
    if (!descriptor) {
      return null;
    }

    // Return cached tool if already loaded
    if (descriptor.loaded && descriptor.tool) {
      return descriptor.tool;
    }

    // Check if already loading (prevent duplicate loads)
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }

    // Load the tool
    const loadPromise = this.loadTool(descriptor);
    this.loadingPromises.set(name, loadPromise);

    try {
      const tool = await loadPromise;
      return tool;
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * Check if tool is loaded
   */
  isLoaded(name: string): boolean {
    const descriptor = this.tools.get(name);
    return descriptor?.loaded ?? false;
  }

  /**
   * Get all loaded tool names
   */
  getLoadedTools(): string[] {
    const loaded: string[] = [];
    for (const [name, descriptor] of this.tools.entries()) {
      if (descriptor.loaded) {
        loaded.push(name);
      }
    }
    return loaded;
  }

  /**
   * Preload tools (useful for initialization)
   */
  async preloadTools(...names: string[]): Promise<void> {
    await Promise.all(names.map(name => this.getTool(name)));
  }

  /**
   * Unload a tool (free memory)
   */
  async unloadTool(name: string): Promise<void> {
    const descriptor = this.tools.get(name);
    if (!descriptor || !descriptor.loaded) {
      return;
    }

    // Call lifecycle hook
    if (this.lifecycle?.onBeforeUnload && descriptor.tool) {
      await this.lifecycle.onBeforeUnload(name, descriptor.tool);
    }

    // Clear tool
    descriptor.loaded = false;
    descriptor.tool = undefined;

    // Call lifecycle hook
    if (this.lifecycle?.onAfterUnload) {
      await this.lifecycle.onAfterUnload(name);
    }
  }

  /**
   * Unload all tools
   */
  async unloadAll(): Promise<void> {
    const names = Array.from(this.tools.keys());
    await Promise.all(names.map(name => this.unloadTool(name)));
  }

  /**
   * Get tool from DI container
   */
  getDependency<T>(key: string): T {
    return this.container.resolve<T>(key);
  }

  /**
   * Check if dependency exists
   */
  hasDependency(key: string): boolean {
    return this.container.has(key);
  }

  /**
   * Internal: Load a tool with dependency resolution
   */
  private async loadTool(descriptor: LazyToolDescriptor): Promise<BuiltinTool> {
    // Load dependencies first
    if (descriptor.dependencies) {
      await Promise.all(
        descriptor.dependencies.map(dep => this.getTool(dep))
      );
    }

    // Call lifecycle hook
    if (this.lifecycle?.onBeforeLoad) {
      await this.lifecycle.onBeforeLoad(descriptor.name);
    }

    // Load the tool
    const tool = await descriptor.loader();

    // Cache the tool
    descriptor.loaded = true;
    descriptor.tool = tool;

    // Call lifecycle hook
    if (this.lifecycle?.onAfterLoad) {
      await this.lifecycle.onAfterLoad(descriptor.name, tool);
    }

    return tool;
  }
}

/**
 * Global tool manager instance
 */
let globalToolManager: LazyToolManager | null = null;

/**
 * Get or create global tool manager
 */
export function getToolManager(): LazyToolManager {
  if (!globalToolManager) {
    globalToolManager = new LazyToolManager();
  }
  return globalToolManager;
}

/**
 * Set global tool manager (for testing)
 */
export function setToolManager(manager: LazyToolManager): void {
  globalToolManager = manager;
}

/**
 * Tool registry proxy for lazy access
 */
export class ToolRegistryProxy {
  constructor(private readonly manager: LazyToolManager) {}

  /**
   * Proxy to get tool by name
   */
  async get(name: string): Promise<BuiltinTool | null> {
    return this.manager.getTool(name);
  }

  /**
   * Proxy to check if tool exists
   */
  has(name: string): boolean {
    return this.manager.isLoaded(name);
  }

  /**
   * Proxy to get all tool names
   */
  keys(): string[] {
    return this.manager.getLoadedTools();
  }
}
