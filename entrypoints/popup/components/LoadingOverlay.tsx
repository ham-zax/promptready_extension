import React from 'react';

type LoadingOverlayProps = {
  status: 'idle' | 'capturing' | 'cleaning' | 'structuring' | 'exporting' | 'complete' | 'error' | 'processing';
  message?: string;
  progress?: number;
};

function statusToLabel(status: LoadingOverlayProps['status']): string {
  switch (status) {
    case 'capturing':
      return 'Capturing content...';
    case 'cleaning':
      return 'Cleaning content...';
    case 'structuring':
      return 'Structuring content...';
    case 'exporting':
      return 'Preparing export...';
    case 'processing':
      return 'Processing...';
    case 'error':
      return 'Something went wrong';
    case 'complete':
      return 'Complete';
    case 'idle':
    default:
      return 'Ready';
  }
}

export function LoadingOverlay({ status, message, progress }: LoadingOverlayProps) {
  const label = message || statusToLabel(status);
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;

  return (
    <div className="absolute inset-0 z-50 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Animated gradient halo */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 animate-spin-slow blur-[2px]" />
        <div className="absolute inset-0 m-2 rounded-full border-4 border-white/70" />
        {/* Orbiting dot */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/90 animate-orbit" />
      </div>

      <div className="mt-4 text-sm font-medium text-gray-800">{label}</div>

      {pct !== undefined && (
        <div className="mt-3 w-64">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 pr-shimmer"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-500 text-center">{pct}%</div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-500">This will be replaced by the result shortly...</div>
    </div>
  );
}