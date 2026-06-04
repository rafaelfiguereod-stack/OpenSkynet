# OpenSkynet Desktop - Core Architecture

This document describes the improved architecture for the OpenSkynet Desktop application.

## 📁 Structure

```
src/
├── core/                   # Core application layer (NEW)
│   ├── errors/            # Tagged error system
│   │   ├── base.ts        # Base error class and utilities
│   │   ├── network.ts     # Network-related errors
│   │   ├── rpc.ts         # RPC communication errors
│   │   ├── agent.ts       # Agent execution errors
│   │   └── validation.ts  # Validation errors
│   └── services/          # Service layer
│       ├── AgentService.ts      # Agent operations
│       ├── SkillsService.ts     # Skills management
│       ├── MemoryService.ts     # Memory operations
│       ├── types.ts             # Shared types
│       └── index.ts             # Service container
│
├── hooks/                  # React hooks (IMPROVED)
│   ├── useAgent.ts        # Agent hook with proper error handling
│   ├── useSkills.ts       # Skills hook
│   ├── useMemory.ts       # Memory hook
│   ├── useRPCConnection.ts  # Existing RPC connection hook
│   └── index.ts           # Export all hooks
│
├── services/              # Legacy RPC services (KEEP)
│   ├── rpcClient.ts       # WebSocket RPC client
│   └── chatService.ts     # Chat service
│
├── stores/                # Zustand stores (KEEP)
│   ├── useAppStore.ts     # Global app state
│   ├── useChatStore.ts    # Chat state
│   └── useTaskStore.ts    # Task state
│
├── components/            # React components
│   ├── layout/            # Layout components
│   ├── pages/             # Page components
│   └── shared/            # Shared components
│
└── types/                 # Type definitions
    ├── rpc.ts             # RPC types
    ├── chat.ts            # Chat types
    └── index.ts           # Export all types
```

## 🔑 Key Improvements

### 1. Tagged Error System

All errors now extend `AppError` with proper tagging for type narrowing:

```typescript
if (error instanceof AppError) {
  // TypeScript knows this is an AppError
  switch (error.code) {
    case 'NETWORK_ERROR':
      // Handle network error
    case 'RPC_ERROR':
      // Handle RPC error
  }
}
```

**Benefits:**
- Type-safe error handling
- User-friendly error messages
- Structured error metadata
- Proper error recovery

### 2. Service Layer

Services provide typed interfaces over RPC communication:

```typescript
const services = createServiceContainer(rpc);
const result = await services.agent.run('Do something');
```

**Benefits:**
- Type-safe RPC calls
- Input/output validation with Zod
- Consistent error handling
- Easy to test and mock

### 3. Improved Hooks

Hooks now use the service layer and provide better error handling:

```typescript
const [state, { run, cancel }] = useAgent();

await run('Do something');
// state.isLoading, state.error, state.result automatically updated
```

**Benefits:**
- Consistent state management
- Automatic error handling
- User-friendly error messages
- Less boilerplate code

## 📖 Usage Examples

### Using the Agent Service

```typescript
import { useAgent } from '@/hooks';

function MyComponent() {
  const [state, { run, stream, cancel }] = useAgent();

  const handleRun = async () => {
    await run('Search for weather in Tokyo', 'manager');
    console.log(state.result);
  };

  const handleStream = async () => {
    await stream('Write a poem', {
      onChunk: (delta) => console.log(delta),
      onProgress: (progress) => console.log(progress),
      onDone: () => console.log('Done!'),
    });
  };

  return (
    <div>
      {state.isLoading && <p>Loading...</p>}
      {state.error && <p>Error: {state.error}</p>}
      {state.result && <p>Result: {state.result}</p>}
    </div>
  );
}
```

### Using the Skills Service

```typescript
import { useSkills } from '@/hooks';

function SkillsBrowser() {
  const [state, { browse, install, remove }] = useSkills();

  useEffect(() => {
    browse();
  }, [browse]);

  return (
    <div>
      {state.hubSkills.map(skill => (
        <SkillCard
          key={skill.name}
          skill={skill}
          onInstall={() => install(skill.name)}
        />
      ))}
    </div>
  );
}
```

### Using Error Handling

```typescript
import { isAppError, getUserMessage } from '@/core/errors';

try {
  await services.agent.run(task);
} catch (error) {
  if (isAppError(error)) {
    console.log('User message:', getUserMessage(error));
    console.log('Error code:', error.code);
    console.log('Recoverable:', error.recoverable);
  }
}
```

## 🔄 Migration Path

### Phase 1: Use New Hooks (Easy)

Replace existing hook usage with new improved hooks:

```typescript
// Before
import { useChatStore } from '@/stores/useChatStore';

// After
import { useAgent } from '@/hooks';
```

### Phase 2: Use Services Directly (Medium)

For custom logic, use services directly:

```typescript
import { createServiceContainer } from '@/core/services';

const services = createServiceContainer(rpc);
const result = await services.agent.run(task);
```

### Phase 3: Add Custom Services (Advanced)

Create new services following the pattern:

```typescript
// src/core/services/CustomService.ts
export interface CustomService {
  doSomething(input: string): Promise<Result>;
}

class RPCCustomService implements CustomService {
  constructor(private rpc: RPCClient) {}

  async doSomething(input: string): Promise<Result> {
    // Implementation
  }
}

export function createCustomService(rpc: RPCClient): CustomService {
  return new RPCCustomService(rpc);
}
```

## 🧪 Testing

The service layer is designed to be easily testable:

```typescript
import { renderHook } from '@testing-library/react';
import { useAgent } from '@/hooks';

vi.mock('@/services/rpcClient');

describe('useAgent', () => {
  it('should handle agent errors', async () => {
    const { result } = renderHook(() => useAgent());
    
    await act(async () => {
      await result.current[1].run('test task');
    });
    
    expect(result.current[0].error).toBeTruthy();
  });
});
```

## 📝 TODO

- [ ] Update existing components to use new hooks
- [ ] Add more comprehensive error types
- [ ] Add service layer tests
- [ ] Add migration guide for existing code
- [ ] Update documentation

## 🤝 Contributing

When adding new features:

1. **Add error types** in `core/errors/` if new error conditions exist
2. **Add Zod schemas** for validation in service files
3. **Create service interface** following the pattern
4. **Create hook** for React usage
5. **Add tests** for new functionality
