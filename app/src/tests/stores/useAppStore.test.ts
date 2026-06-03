import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setSidebarOpen(true);
      result.current.setCurrentPage('agent');
    });
  });

  it('has initial state', () => {
    const { result } = renderHook(() => useAppStore());

    expect(result.current.sidebarOpen).toBe(true);
    expect(result.current.currentPage).toBe('agent');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.rpcUrl).toBe('ws://localhost:8765');
  });

  it('toggles sidebar open state', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setSidebarOpen(false);
    });

    expect(result.current.sidebarOpen).toBe(false);

    act(() => {
      result.current.setSidebarOpen(true);
    });

    expect(result.current.sidebarOpen).toBe(true);
  });

  it('changes current page', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setCurrentPage('settings');
    });

    expect(result.current.currentPage).toBe('settings');
  });

  it('sets connected state', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setConnected(true);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('updates agent status', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setAgentStatus({ state: 'running' });
    });

    expect(result.current.agentStatus.state).toBe('running');
  });

  it('adds and removes notifications', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test notification',
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    const notificationId = result.current.notifications[0]!.id;
    act(() => {
      result.current.removeNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('updates settings', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setSettings({ rpcUrl: 'ws://localhost:9000' });
    });

    expect(result.current.rpcUrl).toBe('ws://localhost:9000');
  });
});
