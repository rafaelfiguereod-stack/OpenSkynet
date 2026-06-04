/**
 * Sandbox hook with proper error handling
 */

import { useCallback } from 'react';
import { getRPCClient } from '@/services/rpcClient';
import {
  createServiceContainer,
} from '@/core/services';
import { isAppError, getUserMessage } from '@/core/errors';
import { useSandboxStore } from '@/stores/useSandboxStore';
import type { SandboxType, ControlMode } from '@/stores/useSandboxStore';
import type { ScreenshotData } from '@/types/sandbox';

export interface UseSandboxState {
  isOpen: boolean;
  isActive: boolean;
  sandboxType: SandboxType;
  controlMode: ControlMode;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isStreaming: boolean;
  lastScreenshot: string | null;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
}

export interface UseSandboxActions {
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  start: (type: SandboxType) => Promise<void>;
  stop: () => Promise<void>;
  setControlMode: (mode: ControlMode) => Promise<void>;
  setSandboxType: (type: SandboxType) => void;
  clearError: () => void;
}

/**
 * Hook for interacting with the sandbox service
 */
export function useSandbox(): [UseSandboxState, UseSandboxActions] {
  const rpc = getRPCClient();
  const services = createServiceContainer(rpc);

  // Get store state
  const store = useSandboxStore();

  const start = useCallback(async (type: SandboxType) => {
    store.setStarting(true);
    store.setError(null);
    store.setConnectionStatus('connecting');
    store.setIsActive(true); // Add this line

    try {
      const session = await services.sandbox.start(type);
      store.setSession(session);
      store.setStarting(false);
      store.setConnectionStatus('connected');

      // Subscribe to screenshots
      services.sandbox.subscribeToStream({
        onScreenshot: (data: ScreenshotData) => {
          console.log('[useSandbox] Screenshot callback received, length:', data.data?.length);
          store.setScreenshot(data.data);
          store.setStreaming(true);
        },
        onError: (error: string) => {
          store.setStreamError(error);
          store.setError(error);
        },
        onStatusChange: (status) => {
          if (status === 'disconnected' || status === 'error') {
            store.setConnectionStatus(status);
            store.setStreaming(false);
          }
        },
      });
    } catch (error) {
      const message = isAppError(error) ? getUserMessage(error) : 'Failed to start sandbox';
      store.setError(message);
      store.setStarting(false);
      store.setConnectionStatus('error');
      store.setIsActive(false); // Set to false on error
    }
  }, [services, store]);

  const stop = useCallback(async () => {
    store.setStopping(true);
    store.setIsActive(false); // Set to false when stopping

    try {
      await services.sandbox.stop();
      store.setSession(null);
      store.setStreaming(false);
      store.setScreenshot(null);
      store.setStopping(false);
      store.setConnectionStatus('disconnected');
    } catch (error) {
      const message = isAppError(error) ? getUserMessage(error) : 'Failed to stop sandbox';
      store.setError(message);
      store.setStopping(false);
    }
  }, [services, store]);

  const setControlMode = useCallback(async (mode: ControlMode) => {
    try {
      await services.sandbox.setControlMode(mode);
      store.setControlMode(mode);
    } catch (error) {
      const message = isAppError(error) ? getUserMessage(error) : 'Failed to set control mode';
      store.setError(message);
    }
  }, [services, store]);

  const clearError = useCallback(() => {
    store.clearError();
  }, [store]);

  return [
    {
      isOpen: store.isOpen,
      isActive: store.isActive,
      sandboxType: store.sandboxType,
      controlMode: store.controlMode,
      connectionStatus: store.connectionStatus,
      isStreaming: store.isStreaming,
      lastScreenshot: store.lastScreenshot,
      isStarting: store.isStarting,
      isStopping: store.isStopping,
      error: store.error,
    },
    {
      togglePanel: store.togglePanel,
      setOpen: store.setOpen,
      start,
      stop,
      setControlMode,
      setSandboxType: store.setSandboxType,
      clearError,
    },
  ];
}
