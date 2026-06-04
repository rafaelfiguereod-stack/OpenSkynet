import { useState, useCallback, useEffect } from 'react';
import { useSandbox } from '@/hooks/useSandbox';
import { BrowserView } from './BrowserView';
import { X, Plus, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { getRPCClient } from '@/services/rpcClient';

interface Tab {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

export function SandboxPanel() {
  const [state, actions] = useSandbox();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: 'Google', url: 'https://www.google.com', isActive: true }
  ]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsResizing(true);
    e.preventDefault();
  }, [isFullscreen]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 400 && newWidth <= window.innerWidth - 100) {
      setPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const addTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: 'New Tab',
      url: 'https://www.google.com',
      isActive: true
    };
    setTabs(prev => prev.map(t => ({ ...t, isActive: false })).concat(newTab));
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (prev.find(t => t.id === tabId)?.isActive) {
        filtered[filtered.length - 1].isActive = true;
      }
      return filtered;
    });
  };

  const switchTab = (tabId: string) => {
    setTabs(prev => prev.map(t => ({ ...t, isActive: t.id === tabId })));
  };

  if (!state.isOpen) {
    return null;
  }

  const activeTab = tabs.find(t => t.isActive);

  return (
    <>
      {/* Resize handle */}
      {!isFullscreen && (
        <div
          className="fixed top-0 h-1 w-full cursor-row-resize z-[60] hover:bg-blue-500 bg-transparent"
          style={{ right: 0, left: 'auto', width: panelWidth, top: 'auto' }}
          onMouseDown={handleMouseDown}
        />
      )}
      <div
        className={`flex flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-50' : 'fixed right-0 top-0 h-screen border-l border-border z-40'}`}
        style={{ width: isFullscreen ? '100%' : panelWidth }}
      >
        {/* Browser Chrome */}
        <div className="bg-muted/30 border-b border-border">
          {/* Tabs */}
          <div className="flex items-center bg-muted/50">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer group relative ${
                  tab.isActive ? 'bg-background' : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => switchTab(tab.id)}
              >
                <span className="text-sm max-w-[150px] truncate">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addTab}
              className="p-2 hover:bg-muted-foreground/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-muted-foreground/20 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* URL Bar */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Back">
                <span className="text-xs">◀</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Forward">
                <span className="text-xs">▶</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Refresh">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1 flex items-center bg-background border border-border rounded-md px-3 py-1.5">
              <ExternalLink className="w-3 h-3 text-muted-foreground mr-2" />
              <input
                type="text"
                value={activeTab?.url || ''}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {/* Browser View */}
        <div className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden">
          {!state.isActive ? (
            <div className="text-center">
              <p className="text-white/60 mb-4">Click Start to launch the browser</p>
              <Button onClick={() => actions.start('browser')} size="lg">
                Start Browser
              </Button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <div className="mb-4 text-center">
                <p className="text-white/60 text-sm mb-2">Debug: screenshot length = {state.lastScreenshot?.length || 0} bytes</p>
                <p className="text-white/40 text-xs">Blue border should be visible below</p>
              </div>
              <BrowserView
                screenshot={state.lastScreenshot}
                isActive={state.isActive}
                isLoading={state.isStarting}
                error={state.error}
              />
              {/* Test buttons */}
              <div className="mt-4 flex gap-2 flex-wrap justify-center">
                <Button
                  onClick={() => {
                    console.log('Test button clicked');
                    console.log('Current state:', {
                      isActive: state.isActive,
                      screenshotLength: state.lastScreenshot?.length,
                      isStarting: state.isStarting
                    });
                    alert(`Active: ${state.isActive}\nScreenshot: ${state.lastScreenshot?.length || 0} bytes`);
                  }}
                  size="sm"
                  variant="outline"
                >
                  Test State
                </Button>
                <Button
                  onClick={() => {
                    console.log('Download clicked, screenshot length:', state.lastScreenshot?.length);
                    if (!state.lastScreenshot) {
                      alert('No screenshot available!');
                      return;
                    }
                    try {
                      const link = document.createElement('a');
                      link.href = `data:image/png;base64,${state.lastScreenshot}`;
                      link.download = `browser-screenshot-${Date.now()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      console.log('Download triggered!');
                      alert('Screenshot downloaded!');
                    } catch (error) {
                      console.error('Download failed:', error);
                      alert('Download failed: ' + error);
                    }
                  }}
                  size="sm"
                >
                  Download Screenshot
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      console.log('Navigating to Google via browser.goto...');
                      const rpc = getRPCClient();
                      const result = await rpc.call('browser.goto', {
                        url: 'https://www.google.com'
                      });
                      console.log('Navigation result:', result);
                      if (result.success) {
                        alert('Navigated to Google! Check the browser view in 2-3 seconds.');
                      } else {
                        alert('Navigation failed: ' + result.error);
                      }
                    } catch (error) {
                      console.error('Navigation failed:', error);
                      alert('Navigation failed: ' + error);
                    }
                  }}
                  size="sm"
                  variant="default"
                >
                  Go to Google
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {state.isActive && (
          <div className="flex items-center justify-between px-3 py-1 bg-muted/30 border-t border-border text-xs text-muted-foreground">
            <span>Connected</span>
            <span>{state.isStreaming ? '● Streaming' : '○ Idle'}</span>
          </div>
        )}
      </div>
    </>
  );
}
