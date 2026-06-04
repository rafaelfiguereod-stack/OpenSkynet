import { Monitor, Loader2 } from 'lucide-react';

interface BrowserViewProps {
  screenshot: string | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

export function BrowserView({ screenshot, isActive, isLoading, error }: BrowserViewProps) {
  if (!isActive) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <div className="text-center">
          <p className="text-white font-medium">Starting browser...</p>
          <p className="text-white/60 text-sm">First launch may take 10-20 seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400">!</span>
        </div>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!screenshot) {
    return (
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-white/60">Waiting for browser...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-800">
      <img
        src={`data:image/png;base64,${screenshot}`}
        alt="Browser view"
        className="max-w-full max-h-full object-contain"
        style={{ imageRendering: 'auto', border: '2px solid #3b82f6', borderRadius: '4px' }}
        onLoad={(e) => {
          console.log('[BrowserView] Image loaded:', {
            naturalWidth: e.target.naturalWidth,
            naturalHeight: e.target.naturalHeight,
            displayWidth: e.target.width,
            displayHeight: e.target.height
          });
        }}
      />
    </div>
  );
}
