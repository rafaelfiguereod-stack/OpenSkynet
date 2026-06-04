import { ArrowLeft, ArrowRight, RotateCw, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useState } from 'react';
import { getRPCClient } from '@/services/rpcClient';

interface BrowserToolbarProps {
  url?: string;
  onNavigate?: (url: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function BrowserToolbar({ url = 'https://www.google.com', onNavigate, isFullscreen = false, onToggleFullscreen }: BrowserToolbarProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigate = async () => {
    if (!currentUrl.trim()) return;
    setIsNavigating(true);
    try {
      const rpc = getRPCClient();
      await rpc.call('browser.navigate', { url: currentUrl });
      console.log('[BrowserToolbar] Navigated to:', currentUrl);
      onNavigate?.(currentUrl);
    } catch (error) {
      console.error('[BrowserToolbar] Navigation failed:', error);
    } finally {
      setIsNavigating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleRefresh = async () => {
    try {
      const rpc = getRPCClient();
      await rpc.call('browser.refresh', {});
      console.log('[BrowserToolbar] Refreshed page');
    } catch (error) {
      console.error('[BrowserToolbar] Refresh failed:', error);
    }
  };

  const handleBack = async () => {
    try {
      const rpc = getRPCClient();
      await rpc.call('browser.back', {});
      console.log('[BrowserToolbar] Went back');
    } catch (error) {
      console.error('[BrowserToolbar] Back failed:', error);
    }
  };

  const handleForward = async () => {
    try {
      const rpc = getRPCClient();
      await rpc.call('browser.forward', {});
      console.log('[BrowserToolbar] Went forward');
    } catch (error) {
      console.error('[BrowserToolbar] Forward failed:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleBack}
          className="h-7 w-7 p-0"
          title="Back"
        >
          <ArrowLeft className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleForward}
          className="h-7 w-7 p-0"
          title="Forward"
        >
          <ArrowRight className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="h-7 w-7 p-0"
          title="Refresh"
        >
          <RotateCw className="w-3 h-3" />
        </Button>
      </div>

      {/* URL bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 flex items-center bg-background border border-border rounded-md px-3 py-1">
          <ExternalLink className="w-3 h-3 text-muted-foreground mr-2" />
          <input
            type="text"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter URL..."
            className="flex-1 bg-transparent text-sm outline-none"
            disabled={isNavigating}
          />
        </div>
        <Button
          size="sm"
          onClick={handleNavigate}
          disabled={isNavigating || !currentUrl.trim()}
          className="h-7 px-3"
        >
          {isNavigating ? 'Going...' : 'Go'}
        </Button>
      </div>

      {/* Fullscreen toggle */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onToggleFullscreen}
        className="h-7 w-7 p-0"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </Button>
    </div>
  );
}
