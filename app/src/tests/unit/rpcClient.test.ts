/**
 * RPC Client Tests
 * Tests for WebSocket connection management, infinite loop prevention, and request handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RPCClient } from '@/services/rpcClient';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  url: string;
  sentMessages: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('RPCClient', () => {
  let client: RPCClient;

  beforeEach(() => {
    client = new RPCClient('ws://localhost:8765');
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Connection Management', () => {
    it('should establish connection', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should not connect multiple times simultaneously', async () => {
      const connectSpy = vi.fn();
      const originalConnect = client.connect.bind(client);
      client.connect = () => {
        connectSpy();
        return originalConnect();
      };

      // Start multiple connections
      const promises = [
        client.connect(),
        client.connect(),
        client.connect()
      ];

      await Promise.all(promises);

      // Should have attempted multiple times but not created infinite loops
      expect(connectSpy).toHaveBeenCalled();
      expect(client.isConnected()).toBe(true);
    });

    it('should handle connection state changes', async () => {
      let connectionState: boolean | null = null;
      client.setOnConnectionChange((connected) => {
        connectionState = connected;
      });

      await client.connect();
      expect(connectionState).toBe(true);
    });

    it('should disconnect properly', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Request Handling', () => {
    it('should send RPC request and receive response', async () => {
      await client.connect();

      const requestPromise = client.call('test.method', { param: 'value' });

      // Simulate server response
      (client as any).ws.simulateMessage({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true }
      });

      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });

    it('should handle RPC error response', async () => {
      await client.connect();

      const requestPromise = client.call('test.method', {});

      // Simulate error response
      (client as any).ws.simulateMessage({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'Server error' }
      });

      await expect(requestPromise).rejects.toThrow('Server error');
    });

    it('should timeout requests after specified time', async () => {
      await client.connect();

      const requestPromise = client.call('test.method', {}, 100);

      // Don't send response, let it timeout
      await expect(requestPromise).rejects.toThrow('timeout');
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should not create infinite reconnection loops', async () => {
      let reconnectCount = 0;
      client.setOnConnectionChange((connected) => {
        if (!connected) {
          reconnectCount++;
        }
      });

      await client.connect();

      // Simulate connection close
      (client as any).ws.close();

      // Wait for potential reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have attempted reconnection but not infinitely
      expect(reconnectCount).toBeLessThan(5);
    });

    it('should clear pending requests on disconnect', async () => {
      await client.connect();

      // Start a request
      const requestPromise = client.call('test.method', {});

      // Disconnect before response
      client.disconnect();

      // Request should be rejected
      await expect(requestPromise).rejects.toThrow();
    });
  });

  describe('Diagnostics', () => {
    it('should provide diagnostic information', () => {
      const diagnostics = client.getDiagnostics();

      expect(diagnostics).toHaveProperty('url');
      expect(diagnostics).toHaveProperty('readyState');
      expect(diagnostics).toHaveProperty('pendingRequests');
      expect(diagnostics).toHaveProperty('reconnectAttempts');
    });

    it('should show correct connection state in diagnostics', async () => {
      let diagnostics = client.getDiagnostics();
      expect(diagnostics.readyState).not.toBe(1); // Not OPEN yet

      await client.connect();

      diagnostics = client.getDiagnostics();
      expect(diagnostics.readyState).toBe(1); // OPEN
    });
  });

  describe('Stream Handling', () => {
    it('should handle streaming responses', async () => {
      await client.connect();

      const chunks: string[] = [];
      const donePromise = new Promise<void>((resolve) => {
        client.stream('test.stream',
          (chunk) => chunks.push(chunk),
          { streamId: 'test-stream' },
          () => resolve()
        );
      });

      // Simulate stream chunks
      (client as any).ws.simulateMessage({
        type: 'chunk',
        streamId: 'test-stream',
        data: { delta: 'chunk1' }
      });

      (client as any).ws.simulateMessage({
        type: 'chunk',
        streamId: 'test-stream',
        data: { delta: 'chunk2' }
      });

      (client as any).ws.simulateMessage({
        type: 'done',
        streamId: 'test-stream'
      });

      await donePromise;
      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });

    it('should handle stream errors', async () => {
      await client.connect();

      const errorPromise = new Promise<string>((resolve) => {
        client.stream('test.stream',
          () => {},
          { streamId: 'test-stream' },
          () => {},
          (error) => resolve(error)
        );
      });

      // Simulate stream error
      (client as any).ws.simulateMessage({
        type: 'error',
        streamId: 'test-stream',
        data: { error: 'Stream failed' }
      });

      const error = await errorPromise;
      expect(error).toBe('Stream failed');
    });
  });
});
