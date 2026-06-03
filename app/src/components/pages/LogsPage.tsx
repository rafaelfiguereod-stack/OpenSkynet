import { useState } from 'react';
import { Search, Download, Trash2, Bug, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { cn } from '@/lib/utils';
import { type LogEntry } from '@/types';

// Mock logs data
const mockLogs: LogEntry[] = [
  {
    id: '1',
    level: 'info',
    message: 'Application started successfully',
    timestamp: new Date('2024-01-15T10:30:00'),
    source: 'app',
  },
  {
    id: '2',
    level: 'debug',
    message: 'Connecting to RPC server at ws://localhost:8765',
    timestamp: new Date('2024-01-15T10:30:01'),
    source: 'rpc',
  },
  {
    id: '3',
    level: 'info',
    message: 'Browser session initialized',
    timestamp: new Date('2024-01-15T10:30:02'),
    source: 'browser',
  },
  {
    id: '4',
    level: 'warning',
    message: 'Slow response from LLM API (>5s latency detected)',
    timestamp: new Date('2024-01-15T10:30:15'),
    source: 'llm',
  },
  {
    id: '5',
    level: 'error',
    message: 'Failed to navigate to page: timeout after 30s',
    timestamp: new Date('2024-01-15T10:30:30'),
    source: 'browser',
  },
  {
    id: '6',
    level: 'info',
    message: 'Task completed successfully',
    timestamp: new Date('2024-01-15T10:31:00'),
    source: 'agent',
  },
];

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'debug'>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.source?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesLevel =
      levelFilter === 'all' || log.level === levelFilter;

    return matchesSearch && matchesLevel;
  });

  const getLevelStyles = (level: LogEntry['level']) => {
    const base = 'px-2 py-0.5 rounded text-xs font-mono font-medium';
    switch (level) {
      case 'error':
        return `${base} bg-red-100 text-red-700 border border-red-200`;
      case 'warning':
        return `${base} bg-yellow-100 text-yellow-700 border border-yellow-200`;
      case 'info':
        return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
      case 'debug':
        return `${base} bg-gray-100 text-gray-700 border border-gray-200`;
      default:
        return `${base} bg-gray-100 text-gray-700 border border-gray-200`;
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    const iconClass = 'w-3.5 h-3.5';
    switch (level) {
      case 'error':
        return <AlertCircle className={`${iconClass} text-red-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-600`} />;
      case 'debug':
        return <Bug className={`${iconClass} text-gray-600`} />;
      default:
        return null;
    }
  };

  const handleExport = () => {
    const text = filteredLogs
      .map(
        (log) =>
          `[${log.level.toUpperCase()}] ${log.timestamp.toISOString()} [${log.source || 'app'}] ${log.message}`
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sediman-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-white">
        <h2 className="text-lg font-semibold text-foreground">Logs</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-6 border-b border-border bg-white space-y-4">
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 max-w-3xl mx-auto">
          <Button
            variant={levelFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevelFilter('all')}
          >
            All
          </Button>
          <Button
            variant={levelFilter === 'error' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevelFilter('error')}
          >
            Errors
          </Button>
          <Button
            variant={levelFilter === 'warning' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevelFilter('warning')}
          >
            Warnings
          </Button>
          <Button
            variant={levelFilter === 'info' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevelFilter('info')}
          >
            Info
          </Button>
          <Button
            variant={levelFilter === 'debug' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevelFilter('debug')}
          >
            Debug
          </Button>
        </div>
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1 bg-muted/30">
        <div className="max-w-4xl mx-auto py-6 px-6">
          <div className="font-mono text-xs space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 py-2 px-3 rounded-md hover:bg-white transition-colors"
              >
                {/* Level badge */}
                <span className={getLevelStyles(log.level)}>
                  {log.level.toUpperCase()}
                </span>

                {/* Timestamp */}
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {log.timestamp.toLocaleTimeString()}
                </span>

                {/* Source */}
                {log.source && (
                  <span className="text-muted-foreground shrink-0">
                    [{log.source}]
                  </span>
                )}

                {/* Icon */}
                <span className="shrink-0">{getLevelIcon(log.level)}</span>

                {/* Message */}
                <span className="text-foreground flex-1 break-words">
                  {log.message}
                </span>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No logs found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
