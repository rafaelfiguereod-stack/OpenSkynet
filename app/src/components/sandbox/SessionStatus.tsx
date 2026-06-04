import { cn } from '@/lib/utils';
import type { ConnectionStatus, ControlMode } from '@/stores/useSandboxStore';

interface SessionStatusProps {
  connectionStatus: ConnectionStatus;
  controlMode: ControlMode;
  isStreaming: boolean;
}

export function SessionStatus({
  connectionStatus,
  controlMode,
  isStreaming,
}: SessionStatusProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-t border-border bg-muted/30 min-h-[38px]">
      <ConnectionStatusIndicator status={connectionStatus} />
      {connectionStatus === 'connected' && (
        <ControlModeBadge mode={controlMode} />
      )}
      {isStreaming && <StreamingIndicator />}
    </div>
  );
}

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
}

function ConnectionStatusIndicator({ status }: ConnectionStatusIndicatorProps) {
  const config = getStatusConfig(status);

  return (
    <div className="flex items-center gap-1.5">
      <StatusDot status={status} />
      <span className={cn('text-xs', config.color)}>{config.label}</span>
    </div>
  );
}

interface StatusDotProps {
  status: ConnectionStatus;
}

function StatusDot({ status }: StatusDotProps) {
  const className = cn(
    'w-2 h-2 rounded-full',
    status === 'connected' && 'bg-green-500 animate-pulse',
    status === 'connecting' && 'bg-yellow-500 animate-pulse',
    status === 'error' && 'bg-red-500',
    status === 'disconnected' && 'bg-muted-foreground'
  );

  return <div className={className} />;
}

interface ControlModeBadgeProps {
  mode: ControlMode;
}

function ControlModeBadge({ mode }: ControlModeBadgeProps) {
  const config = getModeConfig(mode);

  return (
    <div className={cn('px-2 py-0.5 rounded-md border text-xs', config.color)}>
      {config.label}
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-xs text-blue-500">Streaming</span>
    </div>
  );
}

interface StatusConfig {
  label: string;
  color: string;
}

function getStatusConfig(status: ConnectionStatus): StatusConfig {
  const configs: Record<ConnectionStatus, StatusConfig> = {
    disconnected: { label: 'Disconnected', color: 'text-muted-foreground' },
    connecting: { label: 'Connecting...', color: 'text-yellow-500' },
    connected: { label: 'Connected', color: 'text-green-500' },
    error: { label: 'Error', color: 'text-red-500' },
  };

  return configs[status];
}

interface ModeConfig {
  label: string;
  color: string;
}

function getModeConfig(mode: ControlMode): ModeConfig {
  const configs: Record<ControlMode, ModeConfig> = {
    agent: { label: 'Agent Control', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    user: { label: 'User Control', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
    shared: { label: 'Shared Control', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  };

  return configs[mode];
}
