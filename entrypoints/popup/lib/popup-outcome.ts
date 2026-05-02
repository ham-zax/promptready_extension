import type { AIAttemptOutcome } from '@/lib/types';
import type { AILockReason } from '@/lib/entitlement-policy';

export type PopupOutcome =
  | 'ready_ai'
  | 'ready_offline'
  | 'ready_offline_degraded'
  | 'needs_ai_config'
  | 'failed';

export type PopupOutcomeTone = 'success' | 'neutral' | 'degraded' | 'info' | 'error';

export type PopupOutcomeAction =
  | 'copy_md'
  | 'save_md'
  | 'open_settings'
  | 'change_model'
  | 'view_details';

export interface PopupOutcomeViewModel {
  kind: PopupOutcome;
  title: string;
  message: string;
  tone: PopupOutcomeTone;
  primaryActions: PopupOutcomeAction[];
  secondaryActions: PopupOutcomeAction[];
  details?: string;
}

export interface PopupOutcomeInput {
  mode: 'offline' | 'ai';
  hasContent: boolean;
  aiOutcome?: AIAttemptOutcome;
  aiFallbackError?: string;
  canUseAIMode?: boolean;
  aiLockReason?: AILockReason;
  processingStatus?: string;
  processingMessage?: string;
  qualityReport?: {
    completenessStatus?: 'complete' | 'partial' | 'incomplete_title_only' | 'incomplete_empty_body' | 'incomplete_navigation_only';
    overallScore?: number;
    issues?: Array<{ message: string; category: string }>;
  };
}

function isFallbackOutcome(aiOutcome?: AIAttemptOutcome): boolean {
  return typeof aiOutcome === 'string' && aiOutcome.startsWith('fallback_');
}

function fallbackMessage(aiOutcome?: AIAttemptOutcome): string {
  switch (aiOutcome) {
    case 'fallback_missing_key':
      return 'Add an API key to use AI. Offline capture still works.';
    case 'fallback_missing_model':
      return 'Choose an AI model to use AI. Offline capture still works.';
    case 'fallback_daily_limit_reached':
      return 'Daily AI limit reached. Offline capture still works.';
    case 'fallback_provider':
      return 'Selected AI provider is not supported. Offline capture still works.';
    case 'fallback_quality_gate_failed':
      return 'AI output failed fidelity checks. Offline capture still works.';
    case 'fallback_cancelled':
      return 'AI enhancement was cancelled. Offline capture still works.';
    case 'fallback_request_failed':
    default:
      return 'AI enhancement was skipped or failed.';
  }
}

function fallbackActions(aiOutcome?: AIAttemptOutcome): PopupOutcomeAction[] {
  switch (aiOutcome) {
    case 'fallback_missing_key':
    case 'fallback_missing_model':
    case 'fallback_daily_limit_reached':
      return ['open_settings', 'view_details'];
    case 'fallback_provider':
    case 'fallback_request_failed':
      return ['change_model', 'view_details'];
    case 'fallback_quality_gate_failed':
      return ['view_details'];
    default:
      return ['view_details'];
  }
}

export function derivePopupOutcome(input: PopupOutcomeInput): PopupOutcomeViewModel | null {
  if (input.hasContent) {
    const completenessStatus = input.qualityReport?.completenessStatus;

    if (completenessStatus === 'incomplete_empty_body') {
      return {
        kind: 'failed',
        title: 'Capture incomplete',
        message: 'PromptReady found only metadata, but no page content. The page may have changed structure.',
        tone: 'error',
        primaryActions: [],
        secondaryActions: ['view_details'],
        details: input.qualityReport?.issues?.[0]?.message,
      };
    }

    if (completenessStatus === 'incomplete_title_only') {
      return {
        kind: 'failed',
        title: 'Capture incomplete',
        message: 'PromptReady found the page title, but not the main body content.',
        tone: 'error',
        primaryActions: [],
        secondaryActions: ['view_details'],
        details: input.qualityReport?.issues?.[0]?.message,
      };
    }

    if (completenessStatus === 'incomplete_navigation_only') {
      return {
        kind: 'failed',
        title: 'Capture incomplete',
        message: 'Only navigation content was captured, not the main page content.',
        tone: 'error',
        primaryActions: [],
        secondaryActions: ['view_details'],
      };
    }

    if (input.mode === 'ai' && input.aiOutcome === 'success') {
      return {
        kind: 'ready_ai',
        title: 'AI enhanced output ready',
        message: 'Copy or save the cleaned Markdown.',
        tone: 'success',
        primaryActions: ['copy_md', 'save_md'],
        secondaryActions: [],
      };
    }

    if (input.mode === 'ai' && isFallbackOutcome(input.aiOutcome)) {
      return {
        kind: 'ready_offline_degraded',
        title: 'Offline output ready',
        message: fallbackMessage(input.aiOutcome),
        tone: 'degraded',
        primaryActions: ['copy_md', 'save_md'],
        secondaryActions: fallbackActions(input.aiOutcome),
        details: input.aiFallbackError,
      };
    }

    return {
      kind: 'ready_offline',
      title: 'Offline output ready',
      message: 'Copy or save the cleaned Markdown.',
      tone: 'neutral',
      primaryActions: ['copy_md', 'save_md'],
      secondaryActions: [],
    };
  }

  if (input.processingStatus === 'error') {
    return {
      kind: 'failed',
      title: 'Capture failed',
      message: 'No usable output was generated.',
      tone: 'error',
      primaryActions: [],
      secondaryActions: ['view_details'],
      details: input.processingMessage,
    };
  }

  if (input.mode === 'ai' && input.canUseAIMode === false) {
    return {
      kind: 'needs_ai_config',
      title: 'Add an API key to use AI',
      message: 'Offline capture still works.',
      tone: 'info',
      primaryActions: ['open_settings'],
      secondaryActions: [],
    };
  }

  return null;
}
