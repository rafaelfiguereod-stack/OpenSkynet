/**
 * Electron Tools - Senior-level implementation with:
 * - Lazy loading
 * - Dependency injection
 * - Lifecycle management
 * - Optimized performance
 */

export { BrowserTool } from './browser-tool';
export { ShellTool } from './shell-tool';
export { FileTool } from './file-tool';
export { WebTool } from './web-tool';
export { SkillsTool, createSkillsTool } from './skills-tool';
export { DocumentConverterTool as DocumentTool } from './document-tool';
export { CodingTool } from './coding-tool';

export * from '../tooling/types';
export * from '../tooling/tool-access';
export * from '../tooling/result-builder';
export * from '../tooling/action-tool';
export * from '../tooling/tool-manager';

import { BrowserTool } from './browser-tool';
import { ShellTool } from './shell-tool';
import { FileTool } from './file-tool';
import { WebTool } from './web-tool';
import { SkillsTool, createSkillsTool } from './skills-tool';
import { DocumentConverterTool } from './document-tool';
import { CodingTool } from './coding-tool';
import type { BuiltinTool } from '../tooling/types';
import type { ToolBus } from '../../agent/tools/bus';
import { getToolManager, type LazyToolManager } from '../tooling/tool-manager';

/**
 * Optimized output converter (extracted for reuse)
 */
const outputToString = (
  output: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
): string => {
  if (typeof output === 'string') {
    return output;
  }

  const parts = new Array(output.length);
  for (let i = 0; i < output.length; i++) {
    const item = output[i];
    if (item.type === 'text' && item.text) {
      parts[i] = item.text;
    } else if (item.type === 'image_url' && item.image_url?.url) {
      parts[i] = `[Image: ${item.image_url.url}]`;
    } else {
      parts[i] = `[${item.type}]`;
    }
  }

  return parts.join('\n');
};

/**
 * Create optimized tool executor
 */
const createToolExecutor = (builtinTool: BuiltinTool<unknown>) => {
  return async (name: string, args: unknown) => {
    const execution = await builtinTool.resolveExecution(args);

    if ('isError' in execution && execution.isError === true) {
      return {
        success: false,
        output: outputToString(execution.output),
        error: typeof execution.output === 'string' ? execution.output : 'Tool resolution failed'
      };
    }

    const runnable = execution as import('../tooling/types').RunnableToolExecution;

    try {
      const result = await runnable.execute({
        turnId: 'electron-turn',
        toolCallId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        signal: new AbortController().signal
      });

      if (result.isError) {
        return {
          success: false,
          output: outputToString(result.output),
          error: typeof result.output === 'string' ? result.output : 'Tool execution failed'
        };
      }

      return {
        success: true,
        output: outputToString(result.output)
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.message : 'Tool execution failed'
      };
    }
  };
};

/**
 * Register tool to ToolBus (optimized)
 */
const registerToolToToolBus = (
  toolBus: ToolBus,
  builtinTool: BuiltinTool<unknown>
): void => {
  toolBus.register(
    {
      name: builtinTool.name,
      description: builtinTool.description,
      parameters: builtinTool.parameters,
    },
    createToolExecutor(builtinTool)
  );
};

/**
 * Tool configuration options
 */
export interface ToolConfig {
  cwd?: string;
  enableShellTools?: boolean;
  enableBrowserTools?: boolean;
  enableFileTools?: boolean;
  enableWebTools?: boolean;
  enableSkillsTools?: boolean;
  enableDocumentTools?: boolean;
  enableCodingTools?: boolean;
  skillDeps?: {
    skillEngine?: import('../../skills/engine').SkillEngine;
    skillSearch?: import('../../skills/search').SkillSearchEngine;
    runSkill?: (name: string) => Promise<unknown>;
  };
  useLazyLoading?: boolean;
}

/**
 * Initialize all tools (optimized with lazy loading option)
 */
export function initializeT800Tools(
  toolBus: ToolBus,
  options: ToolConfig = {}
): void {
  const {
    cwd = process.cwd(),
    enableShellTools = true,
    enableBrowserTools = true,
    enableFileTools = true,
    enableWebTools = true,
    enableSkillsTools = true,
    enableDocumentTools = true,
    enableCodingTools = true,
    skillDeps,
    useLazyLoading = false,
  } = options;

  // If using lazy loading, register descriptors instead of instances
  if (useLazyLoading) {
    const manager = getToolManager();

    if (enableBrowserTools) {
      manager.registerImmediateTool('Browser', BrowserTool);
    }
    if (enableShellTools) {
      manager.registerTool('Shell', async () => new ShellTool(cwd));
    }
    if (enableFileTools) {
      manager.registerImmediateTool('File', FileTool);
    }
    if (enableWebTools) {
      manager.registerImmediateTool('Web', WebTool);
    }
    if (enableSkillsTools) {
      manager.registerTool('Skills', async () => createSkillsTool(skillDeps));
    }
    if (enableDocumentTools) {
      manager.registerImmediateTool('Document', DocumentConverterTool);
    }
    if (enableCodingTools) {
      manager.registerImmediateTool('Coding', CodingTool);
    }

    // Register a proxy tool that loads on demand
    toolBus.register(
      {
        name: 'LazyTools',
        description: 'Lazy-loading tool proxy',
        parameters: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name to load' },
            args: { type: 'object', description: 'Arguments for the tool' },
          },
          required: ['tool', 'args'],
        },
      },
      async (name, args) => {
        const { tool: toolName, args: toolArgs } = args as { tool: string; args: unknown };
        const tool = await manager.getTool(toolName);
        if (!tool) {
          return {
            success: false,
            output: `Tool not found: ${toolName}`,
            error: `Tool not found: ${toolName}`
          };
        }
        return createToolExecutor(tool)(toolName, toolArgs);
      }
    );

    return;
  }

  // Immediate loading (original behavior)
  if (enableBrowserTools) {
    registerToolToToolBus(toolBus, BrowserTool);
  }

  if (enableShellTools) {
    registerToolToToolBus(toolBus, new ShellTool(cwd));
  }

  if (enableFileTools) {
    registerToolToToolBus(toolBus, FileTool);
  }

  if (enableWebTools) {
    registerToolToToolBus(toolBus, WebTool);
  }

  if (enableSkillsTools) {
    registerToolToToolBus(toolBus, createSkillsTool(skillDeps));
  }

  if (enableDocumentTools) {
    registerToolToToolBus(toolBus, DocumentConverterTool);
  }

  if (enableCodingTools) {
    registerToolToToolBus(toolBus, CodingTool);
  }
}

/**
 * Initialize legacy Electron tools
 *
 * @deprecated Use initializeT800Tools instead for full tool suite
 */
export function initializeElectronTools(
  toolBus: ToolBus,
  options: Omit<ToolConfig, 'enableFileTools' | 'enableWebTools' | 'enableSkillsTools' | 'enableDocumentTools' | 'enableCodingTools'> = {}
): void {
  initializeT800Tools(toolBus, {
    cwd: options.cwd,
    enableShellTools: options.enableShellTools,
    enableBrowserTools: options.enableBrowserTools,
  });
}

/**
 * Get tool manager for advanced usage
 */
export function getToolManagerInstance(): LazyToolManager {
  return getToolManager();
}
