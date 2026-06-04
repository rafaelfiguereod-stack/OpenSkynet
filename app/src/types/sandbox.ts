import type { SandboxType, ControlMode } from '@/stores/useSandboxStore';

export interface SandboxSession {
  id: string;
  type: SandboxType;
  startedAt: number;
  controlMode: ControlMode;
}

export interface SandboxStatus {
  isActive: boolean;
  type: SandboxType;
  controlMode: ControlMode;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionId: string | null;
}

export interface ScreenshotData {
  type: 'screenshot';
  data: string; // base64 encoded image
  timestamp: number;
}

export interface InputEvent {
  type: 'mouse' | 'keyboard';
  action: 'move' | 'click' | 'scroll' | 'keydown' | 'keyup' | 'type';
  data: Record<string, unknown>;
}

export interface StreamCallback {
  onScreenshot?: (data: ScreenshotData) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error') => void;
}
