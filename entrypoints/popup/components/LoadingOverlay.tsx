import React from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

type LoadingOverlayProps = {
  status:
    | 'idle'
    | 'capturing'
    | 'cleaning'
    | 'structuring'
    | 'exporting'
    | 'complete'
    | 'error'
    | 'processing'
    | 'initialization'
    | 'preprocessing'
    | 'offline-baseline'
    | 'ai-processing'
    | 'byok-processing'
    | 'postprocessing'
    | 'fallback';
  message?: string;
  progress?: number;
  stage?: string;
  mode?: 'offline' | 'ai';
  failedStage?: string;
  failedMessage?: string;
};

type StageItem = {
  id: string;
  label: string;
};

const AI_STAGES: StageItem[] = [
  { id: 'initialization', label: 'Capture request queued' },
  { id: 'preprocessing', label: 'Extracting page content' },
  { id: 'offline-baseline', label: 'Preparing reliable Markdown baseline' },
  { id: 'ai-processing', label: 'Sending request to OpenRouter' },
  { id: 'byok-processing', label: 'Waiting for OpenRouter response' },
  { id: 'postprocessing', label: 'Checking and finalizing Markdown' },
];

const OFFLINE_STAGES: StageItem[] = [
  { id: 'initialization', label: 'Capture request queued' },
  { id: 'preprocessing', label: 'Extracting page content' },
  { id: 'postprocessing', label: 'Finalizing Markdown output' },
];

const FALLBACK_STAGE: StageItem = { id: 'fallback', label: 'Continuing with offline capture' };
const PIPELINE_STAGE_IDS = new Set<LoadingOverlayProps['status']>([
  'initialization',
  'preprocessing',
  'offline-baseline',
  'ai-processing',
  'byok-processing',
  'postprocessing',
  'fallback',
]);

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
    case 'initialization':
      return 'Preparing capture request...';
    case 'preprocessing':
      return 'Extracting page content...';
    case 'offline-baseline':
      return 'Preparing reliable Markdown baseline...';
    case 'ai-processing':
      return 'Sending request to OpenRouter...';
    case 'byok-processing':
      return 'Waiting for OpenRouter response...';
    case 'postprocessing':
      return 'Checking and finalizing Markdown...';
    case 'fallback':
      return 'Continuing with offline capture...';
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
  if (PIPELINE_STAGE_IDS.has(status)) {
    return status;
  }

  if (status === 'capturing') return 'initialization';
  if (status === 'cleaning' || status === 'processing') return 'preprocessing';
  if (status === 'structuring' || status === 'exporting' || status === 'complete') return 'postprocessing';
  return 'initialization';
}

function subtitleForStage(mode: LoadingOverlayProps['mode'], currentStage: string, status: LoadingOverlayProps['status']): string {
  if (status === 'error') {
    return 'Capture stopped before usable output was produced.';
  }

  if (mode !== 'ai') {
    return 'Offline pipeline is processing locally.';
  }

  switch (currentStage) {
    case 'initialization':
      return 'Capture request is queued.';
    case 'preprocessing':
      return 'Extracting page content before Markdown conversion.';
    case 'offline-baseline':
      return 'Preparing a local Markdown baseline before AI cleanup.';
    case 'ai-processing':
      return 'Sending the cleanup request to OpenRouter.';
    case 'byok-processing':
      return 'Waiting for OpenRouter response.';
    case 'postprocessing':
      return 'Checking Markdown fidelity and finalizing output.';
    case 'fallback':
      return 'Using offline Markdown because AI was unavailable or failed fidelity checks.';
    default:
      return 'Processing captured content.';
  }
}

export function LoadingOverlay({ status, message, progress, stage, mode = 'offline', failedStage, failedMessage }: LoadingOverlayProps) {
  const label = message || statusToLabel(status);
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;
  const currentStage = stage || stageFromStatus(status);
  const shouldShowFallback = mode === 'ai' && (currentStage === 'fallback' || failedStage === 'fallback');
  const stages = mode === 'ai' ? (shouldShowFallback ? [...AI_STAGES, FALLBACK_STAGE] : AI_STAGES) : OFFLINE_STAGES;
  const activeIndex = stages.findIndex((item) => item.id === currentStage);
  const isNoOutputFailure = status === 'error';

  return (
    <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center px-4">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-4 border-brand-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-primary animate-spin" />
        <div className="absolute inset-3 rounded-full bg-brand-surface border border-brand-border animate-pulse" />
      </div>

      <div className="mt-4 text-sm font-semibold text-foreground text-center">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground text-center">
        {subtitleForStage(mode, currentStage, status)}
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
          const failedStageId = typeof failedStage === 'string' ? failedStage : '';
          const hasStageFailure = Boolean(failedStageId) && item.id === failedStageId;
          const isFailed = hasStageFailure && isNoOutputFailure;
          const isDegraded = hasStageFailure && !isNoOutputFailure;
          const isDone = activeIndex >= 0 && index < activeIndex && !isFailed && !isDegraded;
          const isActive = index === activeIndex && !isFailed && !isDegraded;

          const truncatedFailure =
            typeof failedMessage === 'string' && failedMessage
              ? (failedMessage.length > 140 ? `${failedMessage.slice(0, 139)}…` : failedMessage)
              : '';

          return (
            <li
              key={item.id}
              className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                isFailed
                  ? 'border-rose-600/30 bg-rose-600/10 text-rose-700'
                  : isDegraded
                  ? 'border-amber-600/30 bg-amber-600/10 text-amber-800'
                  : isDone
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                  : isActive
                  ? 'border-brand-primary/30 bg-brand-surface text-foreground'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {isFailed ? (
                <XCircle className="mt-0.5 w-3.5 h-3.5" />
              ) : isDegraded ? (
                <AlertTriangle className="mt-0.5 w-3.5 h-3.5" />
              ) : isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isActive ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current/60" />
              )}

              <div className="min-w-0">
                <div>{item.label}</div>
                {(isFailed || isDegraded) && truncatedFailure && (
                  <div className="mt-0.5 text-[10px] opacity-80 leading-snug">{truncatedFailure}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
