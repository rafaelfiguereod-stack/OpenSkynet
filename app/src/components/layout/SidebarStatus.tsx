import { Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

export function SidebarStatus() {
  const agentStatus = useAppStore((state) => state.agentStatus);
  const isConnected = useAppStore((state) => state.isConnected);

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <Circle
          className={cn(
            'h-2 w-2',
            isConnected
              ? 'fill-green-500 text-green-500 shadow-[0_0_4px_rgba(34,197,94,0.2)]'
              : 'fill-red-500 text-red-500'
          )}
        />
        <span className={cn('text-xs font-medium', isConnected ? 'text-green-600' : 'text-red-600')}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Agent status */}
      <div className="flex items-center gap-2">
        {agentStatus.state === 'running' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
            <span className="text-xs font-medium">Running</span>
          </>
        ) : (
          <>
            <Circle
              className={cn(
                'h-2 w-2',
                agentStatus.state === 'idle'
                  ? 'fill-green-500 text-green-500 shadow-[0_0_4px_rgba(34,197,94,0.2)]'
                  : 'fill-red-500 text-red-500'
              )}
            />
            <span className={cn(
              'text-xs font-medium capitalize',
              agentStatus.state === 'idle' ? 'text-green-600' : 'text-red-600'
            )}>
              {agentStatus.state}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
