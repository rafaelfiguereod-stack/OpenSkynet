import { renderHook, act } from '@testing-library/react';
import { useSandboxStore } from '@/stores/useSandboxStore';

describe('useSandboxStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useSandboxStore());
    act(() => {
      result.current.reset();
    });
  });

  it('has initial state', () => {
    const { result } = renderHook(() => useSandboxStore());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.sandboxType).toBe('browser');
    expect(result.current.controlMode).toBe('agent');
    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.lastScreenshot).toBe(null);
    expect(result.current.isStarting).toBe(false);
    expect(result.current.isStopping).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('toggles panel open state', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.togglePanel();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.togglePanel();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('sets panel open state directly', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('starts sandbox with type', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.startSandbox('browser');
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.sandboxType).toBe('browser');
    expect(result.current.controlMode).toBe('agent');
    expect(result.current.connectionStatus).toBe('connecting');
    expect(result.current.isStarting).toBe(true);
    expect(result.current.error).toBe(null);

    act(() => {
      result.current.startSandbox('computer');
    });

    expect(result.current.sandboxType).toBe('computer');
  });

  it('stops sandbox', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.startSandbox('browser');
      result.current.setSession({
        id: 'test-session',
        type: 'browser',
        startedAt: Date.now(),
        controlMode: 'agent',
      });
    });

    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.stopSandbox();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.currentSession).toBe(null);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.lastScreenshot).toBe(null);
  });

  it('sets control mode', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setControlMode('user');
    });

    expect(result.current.controlMode).toBe('user');

    act(() => {
      result.current.setControlMode('shared');
    });

    expect(result.current.controlMode).toBe('shared');

    act(() => {
      result.current.setControlMode('agent');
    });

    expect(result.current.controlMode).toBe('agent');
  });

  it('sets sandbox type', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setSandboxType('computer');
    });

    expect(result.current.sandboxType).toBe('computer');

    act(() => {
      result.current.setSandboxType('browser');
    });

    expect(result.current.sandboxType).toBe('browser');
  });

  it('sets connection status', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setConnectionStatus('connecting');
    });

    expect(result.current.connectionStatus).toBe('connecting');

    act(() => {
      result.current.setConnectionStatus('connected');
    });

    expect(result.current.connectionStatus).toBe('connected');

    act(() => {
      result.current.setConnectionStatus('error');
    });

    expect(result.current.connectionStatus).toBe('error');
  });

  it('sets session', () => {
    const { result } = renderHook(() => useSandboxStore());

    const session = {
      id: 'test-session',
      type: 'browser' as const,
      startedAt: Date.now(),
      controlMode: 'agent' as const,
    };

    act(() => {
      result.current.setSession(session);
    });

    expect(result.current.currentSession).toEqual(session);
  });

  it('sets streaming state', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setStreaming(true);
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.setStreaming(false);
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('sets screenshot', () => {
    const { result } = renderHook(() => useSandboxStore());

    const screenshot = 'base64screenshotdata';

    act(() => {
      result.current.setScreenshot(screenshot);
    });

    expect(result.current.lastScreenshot).toBe(screenshot);

    act(() => {
      result.current.setScreenshot(null);
    });

    expect(result.current.lastScreenshot).toBe(null);
  });

  it('sets stream error', () => {
    const { result } = renderHook(() => useSandboxStore());

    const error = 'Stream connection error';

    act(() => {
      result.current.setStreamError(error);
    });

    expect(result.current.streamError).toBe(error);

    act(() => {
      result.current.setStreamError(null);
    });

    expect(result.current.streamError).toBe(null);
  });

  it('sets starting state', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setStarting(true);
    });

    expect(result.current.isStarting).toBe(true);

    act(() => {
      result.current.setStarting(false);
    });

    expect(result.current.isStarting).toBe(false);
  });

  it('sets stopping state', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setStopping(true);
    });

    expect(result.current.isStopping).toBe(true);

    act(() => {
      result.current.setStopping(false);
    });

    expect(result.current.isStopping).toBe(false);
  });

  it('sets and clears error', () => {
    const { result } = renderHook(() => useSandboxStore());

    const error = 'Failed to start sandbox';

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.error).toBe(error);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('resets to initial state', () => {
    const { result } = renderHook(() => useSandboxStore());

    act(() => {
      result.current.setOpen(true);
      result.current.startSandbox('browser');
      result.current.setError('test error');
      result.current.setScreenshot('test');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe('test error');

    act(() => {
      result.current.reset();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lastScreenshot).toBe(null);
  });
});
