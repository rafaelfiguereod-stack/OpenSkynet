# Electron Agent Module

Browser-focused agent for Electron app, based on kimi-code's architecture.

## Architecture (kimi-code inspired)

### Tool System

Following kimi-code's sophisticated tool architecture:

```
electron/
├── tooling/
│   ├── types.ts           # ExecutableTool, ToolExecution interfaces
│   ├── tool-access.ts     # ToolAccesses for resource tracking
│   └── result-builder.ts  # ToolResultBuilder for output formatting
├── tools/
│   ├── browser-tool.ts    # Browser automation (BuiltinTool class)
│   ├── shell-tool.ts      # Shell command execution (BuiltinTool class)
│   └── index.ts           # Tool initialization and registration
├── agent/
│   └── ElectronAgent.ts   # Main agent class
└── index.ts               # Public API
```

### Key Components

1. **BuiltinTool Interface**
   - Each tool is a class with `name`, `description`, `parameters`
   - `resolveExecution()` returns execution plan with approval rules
   - Proper display metadata for UI

2. **ToolResultBuilder**
   - Smart output formatting with truncation
   - Character and line length limits
   - Proper message formatting

3. **ToolAccesses**
   - Resource tracking (file read/write/search)
   - Conflict detection
   - Recursive operation support

4. **ExecutableToolContext**
   - turnId, toolCallId, signal
   - onUpdate callback for progress
   - Proper cancellation support

## Available Tools

### Browser Tool (Primary)

`Browser` tool with multiple actions:
- `navigate_and_screenshot` - Navigate and capture
- `navigate_and_extract` - Navigate and extract text
- `click_and_wait` - Click and wait for page load
- `fill_and_submit` - Fill forms and submit
- `scroll_and_capture` - Scroll and capture
- `wait_for_element` - Wait for element to appear

### Shell Tool

`Shell` tool for computer control:
- Execute shell commands
- Timeout protection
- Non-interactive environment
- Working directory management

## Usage

### Basic Example

```typescript
import { createElectronAgent } from "./electron";

const agent = createElectronAgent({
  llmProvider: myProvider,
  workingDirectory: "/path/to/workspace",
});

// Browser automation
const result = await agent.run(
  "Navigate to github.com, take a screenshot, and extract the navigation links"
);

// Form filling
const result = await agent.run(
  "Go to login page, fill in the credentials, and submit"
);

// Computer control
const result = await agent.run(
  "List all PDF files in the current directory"
);
```

### With Skill Integration

```typescript
const agent = createElectronAgent({
  llmProvider: myProvider,
  memory: myMemory,
  skillEngine: mySkills, // For OfficeCLI, etc.
  enableBrowserTools: true,
  enableShellTools: true,
});

const result = await agent.run(
  "Download the PDF from the website, process it using OfficeCLI, and extract the text"
);
```

## Tool Implementation Pattern

Each tool follows kimi-code's pattern:

```typescript
class MyTool implements BuiltinTool<MyInput> {
  readonly name = 'MyTool';
  readonly description = '...';
  readonly parameters = {...};

  resolveExecution(args: MyInput): ToolExecution {
    return {
      accesses: ToolAccesses.file('read', args.path),
      description: 'Brief description',
      display: { kind: 'my-display-type', ... },
      approvalRule: literalRulePattern(this.name, args.path),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, args.path),
      execute: (ctx) => this.execution(args, ctx)
    };
  }

  private async execution(args: MyInput, ctx: ExecutableToolContext): Promise<ExecutableToolResult> {
    const builder = new ToolResultBuilder();
    // ... do work
    return builder.ok('Success message');
  }
}
```

## Integration with Electron App

The Electron app uses this via HTTP API:

```typescript
// POST /api/electron/run
{
  "task": "Navigate to google.com and screenshot"
}
```

## Differences from kimi-code

We've adapted kimi-code's architecture for our needs:
- **Browser-focused**: Primary tool is Browser (not Bash)
- **Simplified**: No background tasks, cron, or subagents for now
- **Electron-specific**: Optimized for desktop app context

## Future Enhancements

- [ ] Background task support (inspired by kimi-code)
- [ ] MCP server integration for external tools
- [ ] Enhanced permission system
- [ ] Skill auto-discovery
- [ ] Tool collision detection

## Credits

Architecture heavily inspired by [kimi-code](https://github.com/MoonshotAI/kimi-code) by Moonshot AI.
