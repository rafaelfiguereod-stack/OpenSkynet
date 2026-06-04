import { renderHook, act } from '@testing-library/react';
import { useSandbox } from '@/hooks/useSandbox';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { getRPCClient } from '@/services/rpcClient';
import { createServiceContainer } from '@/core/services';

// Mock dependencies
jest.mock('@/services/rpcClient');
jest.mock('@/core/services');

describe('useSandbox Hook', () => {
  const mockRPCClient = {
    call: jest.fn(),
    url: 'ws://localhost:8765',
  };

  const mockSandboxService = {
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(),
    sendInput: jest.fn(),
    setControlMode: jest.fn(),
    subscribeToStream: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const mockServiceContainer = {
    sandbox: mockSandboxService,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getRPCClient as jest.Mock).mockReturnValue(mockRPCClient);
    (createServiceContainer as jest.Mock).mockReturnValue(mockServiceContainer);

    // Reset store before each test
    const { result } = renderHook(() => useSandboxStore());
    act(() => {
      result.current.reset();
    });
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useSandbox());

    expect(result.current[0]).toEqual({
      isOpen: false,
      isActive: false,
      sandboxType: 'browser',
      controlMode: 'agent',
      connectionStatus: 'disconnected',
      isStreaming: false,
      lastScreenshot: null,
      isStarting: false,
      isStopping: false,
      error: null,
    });
  });

  it('provides togglePanel action', () => {
    const { result } = renderHook(() => useSandbox());

    act(() => {
      result.current[1].togglePanel();
    });

    const store = renderHook(() => useSandboxStore());
    expect(store.result.current.isOpen).toBe(true);
  });

  it('provides setOpen action', () => {
    const { result } = renderHook(() => useSandbox());

    act(() => {
      result.current[1].setOpen(true);
    });

    const store = renderHook(() => useSandboxStore());
    expect(store.result.current.isOpen).toBe(true);
  });

  it('starts sandbox with type', async () => {
    const session = {
      id: 'test-session',
      type: 'browser' as const,
      startedAt: Date.now(),
      controlMode: 'agent' as const,
    };

    mockSandboxService.start.mockResolvedValue(session);
    mockSandboxService.subscribeToStream.mockReturnValue(() => jest.fn());

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].start('browser');
    });

    expect(mockSandboxService.start).toHaveBeenCalledWith('browser');
    expect(mockSandboxService.subscribeToStream).toHaveBeenCalled();
  });

  it('sets error when start fails', async () => {
    mockSandboxService.start.mockRejectedValue(new Error('Start failed'));

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].start('browser');
    });

    expect(result.current[0].error).toBe('Failed to start sandbox');
  });

  it('stops sandbox', async () => {
    mockSandboxService.stop.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].stop();
    });

    expect(mockSandboxService.stop).toHaveBeenCalled();
  });

  it('sets error when stop fails', async () => {
    mockSandboxService.stop.mockRejectedValue(new Error('Stop failed'));

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].stop();
    });

    expect(result.current[0].error).toBe('Failed to stop sandbox');
  });

  it('sets control mode', async () => {
    mockSandboxService.setControlMode.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].setControlMode('user');
    });

    expect(mockSandboxService.setControlMode).toHaveBeenCalledWith('user');

    const store = renderHook(() => useSandboxStore());
    expect(store.result.current.controlMode).toBe('user');
  });

  it('sets error when setControlMode fails', async () => {
    mockSandboxService.setControlMode.mockRejectedValue(new Error('Mode change failed'));

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].setControlMode('user');
    });

    expect(result.current[0].error).toBe('Failed to set control mode');
  });

  it('provides setSandboxType action', () => {
    const { result } = renderHook(() => useSandbox());

    act(() => {
      result.current[1].setSandboxType('computer');
    });

    const store = renderHook(() => useSandboxStore());
    expect(store.result.current.sandboxType).toBe('computer');
  });

  it('provides clearError action', () => {
    const { result } = renderHook(() => useSandbox());

    // First set an error
    act(() => {
      result.current[1].setSandboxType('browser');
    });

    // Clear it
    act(() => {
      result.current[1].clearError();
    });

    expect(result.current[0].error).toBe(null);
  });

  it('subscribes to stream with callbacks', async () => {
    const mockUnsubscribe = jest.fn();
    const callbacks = {
      onScreenshot: jest.fn(),
      onError: jest.fn(),
      onStatusChange: jest.fn(),
    };

    mockSandboxService.subscribeToStream.mockReturnValue(mockUnsubscribe);

    const { result } = renderHook(() => useSandbox());

    await act(async () => {
      await result.current[1].start('browser');
    });

    expect(mockSandboxService.subscribeToStream).toHaveBeenCalledWith(
      expect.objectContaining({
        onScreenshot: expect.any(Function),
        onError: expect.any(Function),
        onStatusChange: expect.any(Function),
      })
    );
  });
});
