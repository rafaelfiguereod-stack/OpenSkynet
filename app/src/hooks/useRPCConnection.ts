import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { getRPCClient } from '@/services/rpcClient';

export function useRPCConnection() {
  const rpcUrl = useAppStore((state) => state.rpcUrl);
  const autoConnect = useAppStore((state) => state.autoConnect);
  const setConnected = useAppStore((state) => state.setConnected);
  const isConnecting = useRef(false);

  useEffect(() => {
    if (!autoConnect || isConnecting.current) {
      return;
    }

    const connect = async () => {
      isConnecting.current = true;
      try {
        const client = getRPCClient(rpcUrl);

        // Set up connection state callback
        client.setOnConnectionChange((connected) => {
          setConnected(connected);
        });

        // Only connect if not already connected
        if (!client.isConnected()) {
          await client.connect();
          console.log('[RPC] Connection initiated');
        } else {
          console.log('[RPC] Already connected');
        }
      } catch (error) {
        console.error('[RPC] Connection failed:', error);
        setConnected(false);
        isConnecting.current = false;
      }
    };

    connect();
  }, [rpcUrl, autoConnect]); // Remove setConnected from dependencies
}
