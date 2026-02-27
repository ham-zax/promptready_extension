import React from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';

type LoadingOverlayProps = {
  status: 'idle' | 'capturing' | 'cleaning' | 'structuring' | 'exporting' | 'complete' | 'error' | 'processing';
  message?: string;
  progress?: number;
  stage?: string;
  mode?: 'offline' | 'ai';
};

type StageItem = {
  id: string;
  label: string;
};

const AI_STAGES: StageItem[] = [
  { id: 'initialization', label: 'Capture request queued' },
  { id: 'preprocessing', label: 'Cleaning and preparing content' },
  { id: 'ai-processing', label: 'Sending request to OpenRouter' },
  { id: 'byok-processing', label: 'Waiting for AI response' },
  { id: 'postprocessing', label: 'Validating and finalizing output' },
  { id: 'fallback', label: 'Fallback to offline pipeline (if needed)' },
];

const OFFLINE_STAGES: StageItem[] = [
  { id: 'initialization', label: 'Capture request queued' },
  { id: 'preprocessing', label: 'Cleaning and preparing content' },
  { id: 'postprocessing', label: 'Finalizing markdown + JSON output' },
];

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

function stageFromStatus(status: LoadingOverlayProps['status']): string {
  if (status === 'capturing') return 'initialization';
  if (status === 'cleaning' || status === 'processing') return 'preprocessing';
  if (status === 'structuring' || status === 'exporting') return 'postprocessing';
  return 'initialization';
}

export function LoadingOverlay({ status, message, progress, stage, mode = 'offline' }: LoadingOverlayProps) {
  const label = message || statusToLabel(status);
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;
  const stages = mode === 'ai' ? AI_STAGES : OFFLINE_STAGES;
  const currentStage = stage || stageFromStatus(status);
  const activeIndex = Math.max(0, stages.findIndex((item) => item.id === currentStage));

  return (
    <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center px-4">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-primary animate-spin" />
        <div className="absolute inset-3 rounded-full bg-brand-surface border border-brand-border animate-pulse" />
      </div>

      <div className="mt-4 text-sm font-semibold text-foreground text-center">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground text-center">
        {mode === 'ai' ? 'AI mode is waiting for server response…' : 'Offline pipeline is processing locally…'}
      </div>

      {pct !== undefined && (
        <div className="mt-3 w-64">
          <div className="h-2 rounded-full bg-muted overflow-hidden border border-border">
            <div className="h-2 rounded-full bg-brand-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground text-center">{pct}%</div>
        </div>
      )}

      <ul className="mt-4 w-full max-w-[320px] space-y-1.5">
        {stages.map((item, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                isDone
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                  : isActive
                  ? 'border-brand-primary/30 bg-brand-surface text-foreground'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isActive ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current/60" />
              )}
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
