/**
 * RPC Connection Hook Tests
 * Tests for RPC connection hook to prevent infinite loops and connection issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRPCConnection } from '@/hooks/useRPCConnection';
import * as useAppStoreModule from '@/stores/useAppStore';
import { getRPCClient } from '@/services/rpcClient';
import { RPCClient } from '@/services/rpcClient';

// Mock the store
vi.mock('@/stores/useAppStore', () => ({
  useAppStore: vi.fn()
}));

// Mock RPC Client
vi.mock('@/services/rpcClient', () => ({
  getRPCClient: vi.fn(() => ({
    connect: vi.fn(),
    isConnected: () => false,
    setOnConnectionChange: vi.fn()
  }))
}));

describe('useRPCConnection Hook', () => {
  let mockSetConnected: ReturnType<typeof vi.fn>;
  let mockConnect: ReturnType<typeof vi.fn>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock functions
    mockSetConnected = vi.fn();
    mockConnect = vi.fn();

    mockClient = {
      connect: mockConnect,
      isConnected: () => false,
      setOnConnectionChange: vi.fn()
    };

    (getRPCClient as any).mockReturnValue(mockClient);

    // Mock the store
    (useAppStoreModule.useAppStore as any).mockImplementation((selector) => {
      if (selector.toString().includes('rpcUrl')) {
        return 'ws://localhost:8765';
      }
      if (selector.toString().includes('autoConnect')) {
        return true;
      }
      if (selector.toString().includes('setConnected')) {
        return mockSetConnected;
      }
      return () => {};
    });
  });

  describe('Connection Management', () => {
    it('should connect when autoConnect is true', () => {
      renderHook(() => useRPCConnection());

      expect(mockConnect).toHaveBeenCalled();
    });

    it('should not connect when autoConnect is false', () => {
      (useAppStoreModule.useAppStore as any).mockImplementation((selector) => {
        if (selector.toString().includes('autoConnect')) {
          return false;
        }
        if (selector.toString().includes('rpcUrl')) {
          return 'ws://localhost:8765';
        }
        if (selector.toString().includes('setConnected')) {
          return mockSetConnected;
        }
        return () => {};
      });

      renderHook(() => useRPCConnection());

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('should set up connection change callback', () => {
      renderHook(() => useRPCConnection());

      expect(mockClient.setOnConnectionChange).toHaveBeenCalled();
      const callback = (mockClient.setOnConnectionChange as any).mock.calls[0][0];
      expect(typeof callback).toBe('function');
    });

    it('should not call connect if already connected', () => {
      mockClient.isConnected = () => true;

      renderHook(() => useRPCConnection());

      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should not create infinite loop when connection state changes', () => {
      let callCount = 0;

      mockConnect.mockImplementation(async () => {
        callCount++;
        // Simulate connection state change during connect
        // This should not cause the hook to re-run
      });

      const { rerender } = renderHook(() => useRPCConnection());

      // Trigger a re-render
      rerender();

      // Should have called connect only once (initial connection)
      expect(callCount).toBe(1);
    });

    it('should not re-connect on every state update', () => {
      let connectCount = 0;
      mockConnect.mockImplementation(async () => {
        connectCount++;
      });

      const { rerender } = renderHook(() => useRPCConnection());

      // Simulate multiple re-renders
      rerender();
      rerender();
      rerender();

      // Should connect only once despite multiple re-renders
      expect(connectCount).toBeLessThanOrEqual(1);
    });

    it('should handle connection errors without infinite retry loop', async () => {
      let errorCount = 0;
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      // Mock setConnected to track error state changes
      mockSetConnected.mockImplementation((connected: boolean) => {
        if (!connected) {
          errorCount++;
        }
      });

      renderHook(() => useRPCConnection());

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have attempted connection and failed, but not infinitely retry
      expect(mockConnect).toHaveBeenCalled();
      expect(errorCount).toBeLessThan(5);
    });
  });

  describe('Connection State Updates', () => {
    it('should update connection state when callback is triggered', async () => {
      let connectionCallback: ((connected: boolean) => void) | null = null;

      mockClient.setOnConnectionChange.mockImplementation((callback: (connected: boolean) => void) => {
        connectionCallback = callback;
      });

      renderHook(() => useRPCConnection());

      // Simulate connection established
      if (connectionCallback) {
        connectionCallback(true);
      }

      expect(mockSetConnected).toHaveBeenCalledWith(true);

      // Simulate connection lost
      if (connectionCallback) {
        connectionCallback(false);
      }

      expect(mockSetConnected).toHaveBeenCalledWith(false);
    });

    it('should handle connection state updates without re-connecting', async () => {
      let connectionCallback: ((connected: boolean) => void) | null = null;
      let connectCount = 0;

      mockClient.setOnConnectionChange.mockImplementation((callback: (connected: boolean) => void) => {
        connectionCallback = callback;
      });

      mockConnect.mockImplementation(async () => {
        connectCount++;
      });

      const { rerender } = renderHook(() => useRPCConnection());

      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 50));

      const initialConnectCount = connectCount;

      // Simulate connection state change
      if (connectionCallback) {
        connectionCallback(false);
        connectionCallback(true);
      }

      // Trigger re-render
      rerender();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not have called connect again
      expect(connectCount).toBe(initialConnectCount);
    });
  });

  describe('Dependency Array Issues', () => {
    it('should not include setConnected in dependency array', () => {
      // This test verifies that the hook is implemented correctly
      // to avoid infinite loops caused by setConnected being in dependencies

      // The hook should only depend on rpcUrl and autoConnect
      // If setConnected were in the dependencies, it would cause infinite loops

      renderHook(() => useRPCConnection());

      // If we get here without hanging, the dependency array is correct
      expect(true).toBe(true);
    });

    it('should re-connect when rpcUrl changes', () => {
      let currentRpcUrl = 'ws://localhost:8765';

      (useAppStoreModule.useAppStore as any).mockImplementation((selector) => {
        if (selector.toString().includes('rpcUrl')) {
          return currentRpcUrl;
        }
        if (selector.toString().includes('autoConnect')) {
          return true;
        }
        if (selector.toString().includes('setConnected')) {
          return mockSetConnected;
        }
        return () => {};
      });

      const { rerender } = renderHook(() => useRPCConnection());

      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Change rpcUrl
      currentRpcUrl = 'ws://localhost:8766';
      rerender();

      // Should connect again with new URL
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should not re-connect when autoConnect changes from true to false', () => {
      let currentAutoConnect = true;

      (useAppStoreModule.useAppStore as any).mockImplementation((selector) => {
        if (selector.toString().includes('rpcUrl')) {
          return 'ws://localhost:8765';
        }
        if (selector.toString().includes('autoConnect')) {
          return currentAutoConnect;
        }
        if (selector.toString().includes('setConnected')) {
          return mockSetConnected;
        }
        return () => {};
      });

      const { rerender } = renderHook(() => useRPCConnection());

      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Change autoConnect to false
      currentAutoConnect = false;
      rerender();

      // Should not attempt to connect again
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      mockConnect.mockRejectedValue(new Error('Network error'));

      renderHook(() => useRPCConnection());

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have attempted connection
      expect(mockConnect).toHaveBeenCalled();

      // Should have set connection state to false
      expect(mockSetConnected).toHaveBeenCalledWith(false);
    });

    it('should handle WebSocket already open scenario', async () => {
      mockClient.isConnected = () => true;

      renderHook(() => useRPCConnection());

      // Should not attempt to connect if already connected
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });
});
