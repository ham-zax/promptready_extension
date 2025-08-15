// Core Types for PromptReady Extension
// Based on PRD Section 14 (Machine-Readable Specs) and Architecture

// =============================================================================
// Settings & Configuration
// =============================================================================

export interface Settings {
  mode: 'offline' | 'ai';
  theme?: 'system' | 'light' | 'dark';
  templates: {
    bundles: PromptBundle[];
  };
  byok: {
    provider: 'openrouter' | 'custom';
    apiBase: string;
    apiKey: string; // Will be encrypted at rest
    model: string;
  };
  privacy: {
    telemetryEnabled: boolean;
  };
  isPro?: boolean; // Local flag for Pro features - being phased out
  // Optional: choose markdown renderer
  renderer?: 'structurer' | 'turndown';
  // Enable/disable Readability for general mode
  useReadability?: boolean;
  // Processing profile configuration
  processing?: {
    profile: string; // Selected processing profile ID
    readabilityPreset: string; // Readability extraction preset
    turndownPreset: string; // Markdown conversion preset
    customOptions: {
      preserveCodeBlocks: boolean;
      includeImages: boolean;
      preserveTables: boolean;
      preserveLinks: boolean;
    };
  };
}

// Feature flags for phased rollout
export interface FeatureFlags {
  aiModeEnabled: boolean;   // Gate AI mode availability
  byokEnabled: boolean;     // Gate BYOK settings usage
  trialEnabled: boolean;    // Gate trial/credit experience
}

// Phase 2 state (optional on client; populated when backend is enabled)
export interface CreditsState {
  remaining: number;
  total: number;
  lastReset: string; // ISO 8601
}

export interface UserState {
  id: string;            // Anonymous or chrome.identity id
  cohort?: 'A' | 'B' | 'C';
}

export interface TrialState {
  hasExhausted: boolean;
  showUpgradePrompt: boolean;
}

// Extend Settings with optional feature flags and Phase 2 state (interface merging)
export interface Settings {
  flags?: FeatureFlags;
  credits?: CreditsState;
  user?: UserState;
  trial?: TrialState;
}


// =============================================================================
// Export Data Models (PRD Section 14.1)
// =============================================================================

export interface PromptReadyExport {
  version: '1.0';
  metadata: ExportMetadata;
  blocks: ContentBlock[];
}

export interface ExportMetadata {
  title: string;
  url: string;
  capturedAt: string; // ISO 8601 format
  selectionHash: string;
}

export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'quote';
  level?: number; // 1-3 for headings
  text?: string;
  items?: string[]; // For lists
  table?: {
    headers: string[];
    rows: string[][];
  };
  code?: string;
  language?: string;
}

// =============================================================================
// Prompt Bundle Models (PRD Section 14.2)
// =============================================================================

export interface PromptBundle {
  version: '1.0';
  bundle: {
    system: string;
    task: string;
    content: string;
    metadata?: Record<string, any>;
  };
}

// =============================================================================
// Rules Engine Types (Architecture Section 5)
// =============================================================================

export enum FilterAction {
  REMOVE = 'remove',
  UNWRAP = 'unwrap',
}

export interface FilterRule {
  description: string;
  selector: string;
  action: FilterAction;
}

// =============================================================================
// Messaging Contracts (Architecture Section 6)
// =============================================================================

export type MessageType =
  | 'CAPTURE_SELECTION'    // UI → Content Script
  | 'CAPTURE_SELECTION_ONLY' // UI → Content Script (no fallback)
  | 'CAPTURE_COMPLETE'     // Content Script → Service Worker
  | 'PROCESSING_COMPLETE'  // Service Worker → UI
  | 'EXPORT_REQUEST'       // UI → Service Worker
  | 'EXPORT_COMPLETE'      // Service Worker → UI
  | 'OFFSCREEN_READY'      // Offscreen → Service Worker
  | 'OFFSCREEN_COPY'       // Background → Offscreen Document
  | 'OFFSCREEN_PROCESS'    // Background → Offscreen Document
  | 'OFFSCREEN_PROCESSED'  // Offscreen → Background
  | 'BYOK_REQUEST'         // UI → Service Worker
  | 'BYOK_RESULT'          // Service Worker → UI
  | 'FETCH_MODELS'         // UI → Service Worker
  | 'MODELS_RESULT'        // Service Worker → UI
  | 'ERROR';               // Any → UI

export interface Message<T extends MessageType, P = unknown> {
  type: T;
  payload?: P;
}

// Message type definitions
export type CaptureSelectionMessage = Message<'CAPTURE_SELECTION'>;

export type CaptureCompleteMessage = Message<'CAPTURE_COMPLETE', {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
}>;

export type ProcessingCompleteMessage = Message<'PROCESSING_COMPLETE', {
  exportMd: string;
  exportJson: PromptReadyExport;
}>;

export type ExportRequestMessage = Message<'EXPORT_REQUEST', {
  format: 'md' | 'json';
  action: 'copy' | 'download';
}>;

export type ByokRequestMessage = Message<'BYOK_REQUEST', {
  bundleContent: string;
  model: string;
}>;

export type ByokResultMessage = Message<'BYOK_RESULT', {
  content: string;
}>;

export type FetchModelsMessage = Message<'FETCH_MODELS', {
  provider?: 'openrouter';
  apiBase?: string; // allow override
}>;

export type ModelsResultMessage = Message<'MODELS_RESULT', {
  models: Array<{ id: string; name: string }>;
}>;

export type ExportCompleteMessage = Message<'EXPORT_COMPLETE', {
  format: 'md' | 'json';
  action: 'copy' | 'download';
}>;

export type ErrorMessage = Message<'ERROR', {
  message: string;
  code?: string;
}>;

export type OffscreenCopyMessage = Message<'OFFSCREEN_COPY', {
  content: string;
}>;

export type OffscreenProcessMessage = Message<'OFFSCREEN_PROCESS', {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  mode: 'general' | 'code_docs' | string;
  renderer?: 'structurer' | 'turndown';
  useReadability?: boolean;
}>;

export type OffscreenProcessedMessage = Message<'OFFSCREEN_PROCESSED', {
  exportMd: string;
  exportJson: PromptReadyExport;
  metadata: ExportMetadata;
}>;

// =============================================================================
// Processing State Types
// =============================================================================

export interface ProcessingState {
  status: 'idle' | 'capturing' | 'cleaning' | 'structuring' | 'exporting' | 'complete' | 'error';
  progress?: number;
  message?: string;
}

// =============================================================================
// BYOK Types
// =============================================================================

export interface ByokRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature: number;
}

export interface ByokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// =============================================================================
// Telemetry Types (opt-in)
// =============================================================================

export interface TelemetryEvent {
  event: 'clean' | 'export' | 'bundle_use';
  data: {
    mode?: 'general' | 'code_docs';
    durationMs?: number;
    type?: 'md' | 'json';
    fileName?: string;
    action?: 'validate' | 'export';
    model?: string;
  };
  timestamp: string;
}

// =============================================================================
// File Naming Convention
// =============================================================================

export interface FileNaming {
  generateFileName(title: string, format: 'md' | 'json', hash: string): string;
  sanitizeTitle(title: string): string;
}
