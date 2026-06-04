/**
 * Sandbox Service Tests
 * Tests for sandbox session management, browser startup, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RPCSandboxService } from '@/core/services/SandboxService';
import { RPCClient } from '@/services/rpcClient';

// Mock RPC Client
vi.mock('@/services/rpcClient', () => ({
  getRPCClient: vi.fn(() => ({
    call: vi.fn(),
    isConnected: () => true
  }))
}));

describe('SandboxService', () => {
  let service: RPCSandboxService;
  let mockRPC: any;

  beforeEach(() => {
    mockRPC = {
      call: vi.fn(),
      isConnected: () => true
    };
    service = new RPCSandboxService();
    (service as any).getRPCClient = () => mockRPC;
  });

  describe('Browser Startup', () => {
    it('should start browser sandbox successfully', async () => {
      mockRPC.call.mockResolvedValue({
        session: {
          id: 'browser-123',
          type: 'browser',
          startedAt: Date.now(),
          controlMode: 'agent'
        },
        status: 'connected'
      });

      const session = await service.start('browser');

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.start', { type: 'browser' }, 60000);
      expect(session).toEqual({
        id: 'browser-123',
        type: 'browser',
        startedAt: expect.any(Number),
        controlMode: 'agent'
      });
    });

    it('should handle browser startup timeout with helpful error', async () => {
      mockRPC.call.mockRejectedValue(new Error('RPC request timeout'));

      await expect(service.start('browser')).rejects.toThrow('timeout');
    });

    it('should handle "computer not implemented" error', async () => {
      mockRPC.call.mockResolvedValue({
        error: 'Computer sandbox not yet implemented',
        session: null
      });

      await expect(service.start('computer')).rejects.toThrow('not yet implemented');
    });

    it('should handle backend not connected error', async () => {
      mockRPC.call.mockRejectedValue(new Error('Not connected to RPC server'));

      await expect(service.start('browser')).rejects.toThrow('Backend server not running');
    });

    it('should handle missing session error', async () => {
      mockRPC.call.mockResolvedValue({
        session: null,
        status: 'error'
      });

      await expect(service.start('browser')).rejects.toThrow('Failed to start sandbox session');
    });
  });

  describe('Session Management', () => {
    it('should stop sandbox session', async () => {
      mockRPC.call.mockResolvedValue({ stopped: true });

      await service.stop();

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.stop', {});
    });

    it('should get sandbox status', async () => {
      const mockStatus = {
        isActive: true,
        type: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        sessionId: 'browser-123'
      };

      mockRPC.call.mockResolvedValue(mockStatus);

      const status = await service.getStatus();

      expect(status).toEqual(mockStatus);
    });

    it('should handle errors during stop', async () => {
      mockRPC.call.mockRejectedValue(new Error('Connection lost'));

      await expect(service.stop()).rejects.toThrow('Connection lost');
    });
  });

  describe('Control Mode', () => {
    it('should set control mode to agent', async () => {
      mockRPC.call.mockResolvedValue({ mode: 'agent' });

      await service.setControlMode('agent');

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.set_mode', { mode: 'agent' });
    });

    it('should set control mode to user', async () => {
      mockRPC.call.mockResolvedValue({ mode: 'user' });

      await service.setControlMode('user');

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.set_mode', { mode: 'user' });
    });

    it('should handle control mode errors', async () => {
      mockRPC.call.mockRejectedValue(new Error('Invalid mode'));

      await expect(service.setControlMode('shared')).rejects.toThrow('Invalid mode');
    });
  });

  describe('Input Handling', () => {
    it('should send mouse input event', async () => {
      mockRPC.call.mockResolvedValue({ processed: true });

      const event = {
        type: 'mouse' as const,
        action: 'click' as const,
        data: { x: 100, y: 200, button: 'left' }
      };

      await service.sendInput(event);

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.control', { event });
    });

    it('should send keyboard input event', async () => {
      mockRPC.call.mockResolvedValue({ processed: true });

      const event = {
        type: 'keyboard' as const,
        action: 'type' as const,
        data: { text: 'hello world' }
      };

      await service.sendInput(event);

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.control', { event });
    });

    it('should handle input when not in user mode', async () => {
      mockRPC.call.mockResolvedValue({
        processed: false,
        reason: 'Not in user control mode'
      });

      const event = {
        type: 'mouse' as const,
        action: 'click' as const,
        data: { x: 100, y: 200 }
      };

      await service.sendInput(event);

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.control', { event });
    });
  });

  describe('Browser Diagnostics', () => {
    it('should run browser diagnostic test', async () => {
      const mockDiagnostics = {
        start_time: expect.any(Number),
        browser_exists: false,
        browser_started: true,
        steps: ['Step 1', 'Step 2', 'Step 3'],
        errors: [],
        total_time: expect.any(Number),
        startup_time: expect.any(Number)
      };

      mockRPC.call.mockResolvedValue(mockDiagnostics);

      const result = await service.testBrowser();

      expect(mockRPC.call).toHaveBeenCalledWith('sandbox.test_browser', {}, 120000);
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('startup_time');
    });

    it('should handle diagnostic timeout', async () => {
      mockRPC.call.mockRejectedValue(new Error('RPC request timeout'));

      await expect(service.testBrowser()).rejects.toThrow('timeout');
    });

    it('should handle diagnostic errors', async () => {
      mockRPC.call.mockResolvedValue({
        steps: ['Step 1', 'Step 2 failed'],
        errors: ['browser_use import failed', 'Browser not ready'],
        total_time: 5.5
      });

      const result = await service.testBrowser();

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('import failed');
    });
  });

  describe('Stream Management', () => {
    it('should subscribe to screenshot stream', () => {
      const callbacks = {
        onScreenshot: vi.fn(),
        onError: vi.fn(),
        onStatusChange: vi.fn()
      };

      const unsubscribe = service.subscribeToStream(callbacks);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from stream', () => {
      const callbacks = {
        onScreenshot: vi.fn(),
        onError: vi.fn(),
        onStatusChange: vi.fn()
      };

      const unsubscribe = service.subscribeToStream(callbacks);
      unsubscribe();

      // Should not throw and should clean up resources
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
