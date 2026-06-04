/**
 * Sandbox Integration Tests
 * Tests for complete sandbox workflows from UI to backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSandbox } from '@/hooks/useSandbox';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { createServiceContainer } from '@/core/services';
import { RPCClient } from '@/services/rpcClient';

// Mock dependencies
vi.mock('@/services/rpcClient', () => ({
  getRPCClient: vi.fn(() => ({
    call: vi.fn(),
    isConnected: () => true,
    setOnConnectionChange: vi.fn()
  }))
}));

vi.mock('@/core/services', () => ({
  createServiceContainer: vi.fn(() => ({
    sandbox: {
      start: vi.fn(),
      stop: vi.fn(),
      getStatus: vi.fn(),
      setControlMode: vi.fn(),
      testBrowser: vi.fn(),
      subscribeToStream: vi.fn(() => vi.fn()),
      unsubscribe: vi.fn()
    }
  }))
}));

describe('Sandbox Integration Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useSandboxStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('Complete Browser Startup Flow', () => {
    it('should successfully start browser sandbox', async () => {
      const mockSession = {
        id: 'browser-123',
        type: 'browser' as const,
        startedAt: Date.now(),
        controlMode: 'agent' as const
      };

      const mockServices = {
        sandbox: {
          start: vi.fn().mockResolvedValue(mockSession),
          subscribeToStream: vi.fn(() => vi.fn()),
          stop: vi.fn(),
          getStatus: vi.fn(),
          setControlMode: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Start browser sandbox
      await act(async () => {
        await actions.start('browser');
      });

      // Verify service was called correctly
      expect(mockServices.sandbox.start).toHaveBeenCalledWith('browser');
      expect(mockServices.sandbox.subscribeToStream).toHaveBeenCalled();

      // Verify store state updated
      const [state] = result.current;
      expect(state.isActive).toBe(true);
      expect(state.connectionStatus).toBe('connected');
    });

    it('should handle browser startup failure gracefully', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn().mockRejectedValue(new Error('Browser startup failed')),
          subscribeToStream: vi.fn(() => vi.fn()),
          stop: vi.fn(),
          getStatus: vi.fn(),
          setControlMode: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Attempt to start browser
      await act(async () => {
        try {
          await actions.start('browser');
        } catch (e) {
          // Expected to fail
        }
      });

      // Verify error state
      const [state] = result.current;
      expect(state.error).toBeTruthy();
      expect(state.connectionStatus).toBe('error');
      expect(state.isActive).toBe(false);
    });

    it('should handle computer sandbox not implemented error', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn().mockRejectedValue(new Error('Computer sandbox is not yet implemented')),
          subscribeToStream: vi.fn(() => vi.fn()),
          stop: vi.fn(),
          getStatus: vi.fn(),
          setControlMode: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Attempt to start computer sandbox
      await act(async () => {
        try {
          await actions.start('computer');
        } catch (e) {
          // Expected to fail
        }
      });

      // Verify error message
      const [state] = result.current;
      expect(state.error).toContain('not yet implemented');
    });
  });

  describe('Control Mode Switching', () => {
    it('should switch control mode from agent to user', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn().mockResolvedValue({
            id: 'browser-123',
            type: 'browser' as const,
            startedAt: Date.now(),
            controlMode: 'agent' as const
          }),
          subscribeToStream: vi.fn(() => vi.fn()),
          setControlMode: vi.fn().mockResolvedValue({ mode: 'user' }),
          stop: vi.fn(),
          getStatus: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Start sandbox
      await act(async () => {
        await actions.start('browser');
      });

      // Switch to user control
      await act(async () => {
        await actions.setControlMode('user');
      });

      // Verify service was called
      expect(mockServices.sandbox.setControlMode).toHaveBeenCalledWith('user');

      // Verify state updated
      const [state] = result.current;
      expect(state.controlMode).toBe('user');
    });

    it('should handle control mode switch failure', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn().mockResolvedValue({
            id: 'browser-123',
            type: 'browser' as const,
            startedAt: Date.now(),
            controlMode: 'agent' as const
          }),
          subscribeToStream: vi.fn(() => vi.fn()),
          setControlMode: vi.fn().mockRejectedValue(new Error('Failed to switch mode')),
          stop: vi.fn(),
          getStatus: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Start sandbox
      await act(async () => {
        await actions.start('browser');
      });

      // Attempt to switch mode
      await act(async () => {
        try {
          await actions.setControlMode('user');
        } catch (e) {
          // Expected to fail
        }
      });

      // Verify error was set
      const [state] = result.current;
      expect(state.error).toBeTruthy();
    });
  });

  describe('Sandbox Stop Flow', () => {
    it('should stop sandbox and clean up state', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn().mockResolvedValue({
            id: 'browser-123',
            type: 'browser' as const,
            startedAt: Date.now(),
            controlMode: 'agent' as const
          }),
          subscribeToStream: vi.fn(() => vi.fn()),
          stop: vi.fn().mockResolvedValue({ stopped: true }),
          getStatus: vi.fn(),
          setControlMode: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Start sandbox
      await act(async () => {
        await actions.start('browser');
      });

      // Stop sandbox
      await act(async () => {
        await actions.stop();
      });

      // Verify cleanup
      expect(mockServices.sandbox.stop).toHaveBeenCalled();
      expect(mockServices.sandbox.unsubscribe).toHaveBeenCalled();

      // Verify state reset
      const [state] = result.current;
      expect(state.isActive).toBe(false);
      expect(state.isStreaming).toBe(false);
      expect(state.lastScreenshot).toBeNull();
    });
  });

  describe('Panel State Management', () => {
    it('should toggle panel open/closed', () => {
      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Initially closed
      let [state] = result.current;
      expect(state.isOpen).toBe(false);

      // Open panel
      act(() => {
        actions.togglePanel();
      });

      [state] = result.current;
      expect(state.isOpen).toBe(true);

      // Close panel
      act(() => {
        actions.togglePanel();
      });

      [state] = result.current;
      expect(state.isOpen).toBe(false);
    });

    it('should set panel open state explicitly', () => {
      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Set open
      act(() => {
        actions.setOpen(true);
      });

      let [state] = result.current;
      expect(state.isOpen).toBe(true);

      // Set closed
      act(() => {
        actions.setOpen(false);
      });

      [state] = result.current;
      expect(state.isOpen).toBe(false);
    });
  });

  describe('Sandbox Type Selection', () => {
    it('should switch sandbox type', () => {
      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Initially browser
      let [state] = result.current;
      expect(state.sandboxType).toBe('browser');

      // Switch to computer
      act(() => {
        actions.setSandboxType('computer');
      });

      [state] = result.current;
      expect(state.sandboxType).toBe('computer');

      // Switch back to browser
      act(() => {
        actions.setSandboxType('browser');
      });

      [state] = result.current;
      expect(state.sandboxType).toBe('browser');
    });
  });

  describe('Error Handling', () => {
    it('should clear error on user action', () => {
      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // Set error
      act(() => {
        useSandboxStore.getState().setError('Test error');
      });

      let [state] = result.current;
      expect(state.error).toBe('Test error');

      // Clear error
      act(() => {
        actions.clearError();
      });

      [state] = result.current;
      expect(state.error).toBeNull();
    });

    it('should handle multiple errors in sequence', async () => {
      const mockServices = {
        sandbox: {
          start: vi.fn()
            .mockRejectedValueOnce(new Error('First error'))
            .mockRejectedValueOnce(new Error('Second error')),
          subscribeToStream: vi.fn(() => vi.fn()),
          stop: vi.fn(),
          getStatus: vi.fn(),
          setControlMode: vi.fn(),
          testBrowser: vi.fn(),
          unsubscribe: vi.fn()
        }
      };

      (createServiceContainer as any).mockReturnValue(mockServices);

      const { result } = renderHook(() => useSandbox());
      const [, actions] = result.current;

      // First attempt
      await act(async () => {
        try {
          await actions.start('browser');
        } catch (e) {
          // Expected
        }
      });

      let [state] = result.current;
      expect(state.error).toBe('First error');

      // Clear error and try again
      act(() => {
        actions.clearError();
      });

      await act(async () => {
        try {
          await actions.start('browser');
        } catch (e) {
          // Expected
        }
      });

      [state] = result.current;
      expect(state.error).toBe('Second error');
    });
  });
});
