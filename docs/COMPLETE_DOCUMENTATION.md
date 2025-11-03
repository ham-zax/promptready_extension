---
title: "Complete Documentation"
description: "A comprehensive collection of all documentation related to the PromptReady extension, including core system documentation, API references, and user guides."
context: "This document serves as a central repository for all PromptReady documentation. It is a concatenation of multiple documents, providing a single point of reference for the entire project."
---

# PromptReady Extension - Complete Documentation

## Overview

PromptReady is a sophisticated Chrome extension that transforms webpage content into clean, structured Markdown format. It features dual processing modes (offline and AI-powered), comprehensive monetization system, and enterprise-grade performance monitoring.

## Table of Contents

1. [Core System Documentation](#core-system-documentation)
2. [Extension Entry Points](#extension-entry-points)
3. [Cloudflare Workers API](#cloudflare-workers-api)
4. [React Component Library](#react-component-library)
5. [User Guide](#user-guide)
6. [Development Setup](#development-setup)

---

## Core System Documentation

### Offline Mode Manager

The `OfflineModeManager` orchestrates the complete offline content processing workflow with real-time performance monitoring and intelligent fallback mechanisms.

#### Key Features
- **Hybrid Processing Pipeline**: Mozilla Readability + Turndown conversion with fallback support
- **Performance Monitoring**: Real-time metrics tracking with <5% overhead guarantee
- **Intelligent Caching**: IndexedDB-based caching with 24-hour TTL
- **Quality Assessment**: Automated content quality scoring (0-100 scale)
- **Chunked Processing**: Handles large documents (>100KB) efficiently

#### Core Methods

```typescript
// Main processing entry point
static async processContent(
  html: string,
  url: string,
  title: string,
  customConfig?: Partial<OfflineModeConfig>
): Promise<OfflineProcessingResult>

// Get optimal configuration for URL
static async getOptimalConfig(url: string, settings?: any): Promise<OfflineModeConfig>

// Process large content in chunks
static async processLargeContent(
  html: string,
  url: string,
  title: string,
  config?: Partial<OfflineModeConfig>
): Promise<OfflineProcessingResult>
```

#### Configuration Options

```typescript
interface OfflineModeConfig {
  readabilityPreset?: 'blog-article' | 'technical-documentation' | 'wiki-content';           // 'blog-article' | 'technical-documentation' | 'wiki-content'
  turndownPreset: string;             // 'standard' | 'github' | 'obsidian'
  postProcessing: {
    enabled: boolean;
    addTableOfContents: boolean;
    optimizeForPlatform?: 'standard' | 'obsidian' | 'github';
  };
  performance: {
    maxContentLength: number;         // Default: 1MB
    enableCaching: boolean;           // Default: true
    chunkSize: number;               // Default: 100KB
  };
  fallbacks: {
    enableReadabilityFallback: boolean;
    enableTurndownFallback: boolean;
    maxRetries: number;              // Default: 2
  };
}
```

#### Processing Pipeline

1. **Content Validation**: HTML validation and size limits
2. **Readability Extraction**: Mozilla Readability with configurable presets
3. **Turndown Conversion**: HTML to Markdown conversion
4. **Post-Processing**: Content enhancement and optimization
5. **Quality Assessment**: Structure preservation and readability scoring
6. **Citation Insertion**: Source metadata and timestamp insertion

#### Performance Metrics

The system tracks comprehensive performance metrics:

```typescript
interface ProcessingStats {
  totalTime: number;                // Total processing time
  readabilityTime: number;           // Readability extraction time
  turndownTime: number;             // HTML to Markdown conversion time
  postProcessingTime: number;         // Post-processing time
  fallbacksUsed: string[];           // List of fallback mechanisms used
  qualityScore: number;               // Overall quality assessment (0-100)
}
```

### Performance Metrics System

The `PerformanceMetrics` class provides production-ready performance monitoring with intelligent overhead management.

#### Key Features
- **Real-Time Tracking**: Live performance monitoring via extension messaging
- **Memory Management**: Automatic cleanup and leak detection
- **Adaptive Tracking**: Adjusts detail level based on performance impact
- **Cache Analytics**: Hit rates, retrieval times, and efficiency metrics

#### Core Metrics Types

```typescript
interface ExtractionMetrics {
  extractionTime: number;
  contentLength: number;
  contentQuality: number;
  charThreshold: string;
  presetUsed: string;
  timestamp: number;
}

interface PipelineMetrics {
  readabilityTime: number;
  turndownTime: number;
  postProcessingTime: number;
  totalTime: number;
  htmlLength: number;
  extractedLength: number;
  markdownLength: number;
  fallbacksUsed: string[];
  timestamp: number;
}

interface QualityMetrics {
  overallScore: number;
  structurePreservation: number;      // Heading/list/table preservation
  readabilityScore: number;
  warningsCount: number;
  errorsCount: number;
  timestamp: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;                  // Percentage
  totalRequests: number;
  averageRetrievalTime: number;
  totalRetrievalTime: number;
}
```

#### Performance API

```typescript
class PerformanceMetrics {
  // Get comprehensive metrics summary
  static getMetricsSummary(): any;

  // Generate performance report with recommendations
  static generateReport(): PerformanceReport;

  // Check if overhead is acceptable (<5%)
  static checkPerformanceOverhead(): boolean;

  // Start real-time monitoring
  static startRealTimeMonitoring(): {
    stop: () => void;
    getMetrics: () => Promise<any>;
  };

  // Get performance analytics for dashboard
  static async getPerformanceAnalytics(): Promise<{
    overview: { totalSessions: number; averageProcessingTime: number; };
    timeline: Array<{ timestamp: number; processingTime: number; }>;
    cacheAnalytics: CacheMetrics;
    systemHealth: { status: 'optimal' | 'warning' | 'critical'; };
    recommendations: string[];
  }>;
}
```

#### Real-Time Monitoring

The system provides live performance streaming:

```typescript
// Real-time metrics update
interface RealTimeMetrics {
  timestamp: number;
  activeProcessingSessions: number;
  currentMemoryUsage?: number;
  cachePerformance: CacheMetrics;
  processingTrends: any;
  systemHealth: 'optimal' | 'warning' | 'critical';
  recommendations: string[];
}
```

---

## Extension Entry Points

### Background Script (`entrypoints/background.ts`)

The service worker orchestrator that manages the entire extension lifecycle and message routing.

#### Core Responsibilities
- **Message Routing**: Central hub for all extension communication
- **Content Processing**: Orchestrates offline and AI processing pipelines
- **Clipboard Management**: Multi-strategy clipboard operations with fallbacks
- **Error Recovery**: Comprehensive error handling and recovery mechanisms
- **Session Management**: Persistent data storage across service worker restarts

#### Message Types

```typescript
// Content Capture Messages
interface CaptureMessages {
  CAPTURE_SELECTION: { tabId: number };
  CAPTURE_COMPLETE: { html: string; url: string; title: string; selectionHash: string };
  CAPTURE_REQUEST: { tabId: number };
}

// Processing Messages
interface ProcessingMessages {
  PROCESSING_COMPLETE: { exportMd: string; exportJson: any; metadata: any; };
  PROCESSING_ERROR: { error: string; stage: string; fallbackUsed: boolean };
  PROCESSING_PROGRESS: { progress: number; stage: string };
}

// Export Messages
interface ExportMessages {
  EXPORT_REQUEST: { format: 'md' | 'json'; action: 'copy' | 'download' };
  EXPORT_COMPLETE: { format: string; action: string; success: boolean };
}

// Clipboard Messages
interface ClipboardMessages {
  COPY_TO_CLIPBOARD: { content: string; waitForPopupClose?: boolean };
  COPY_COMPLETE: { success: boolean; method: 'background' | 'offscreen' | 'content' };
}
```

#### Enhanced Features

- **Duplicate Prevention**: Request fingerprinting to prevent duplicate processing
- **Smart Clipboard**: Multi-strategy clipboard operations (content script → offscreen → fallback)
- **Session Persistence**: Data survives service worker termination via session storage
- **Quality Validation**: Integrated content quality assessment
- **Error Recovery**: Graceful degradation with fallback mechanisms

### Content Script (`entrypoints/content.ts`)

Handles DOM interaction, content extraction, and clipboard operations in the context of web pages.

#### Key Functions
- **Content Extraction**: Smart DOM traversal and content capture
- **Selection Management**: Text selection detection and validation
- **Clipboard Operations**: Cross-browser clipboard writing with permissions
- **Message Handling**: Communication with background script
- **Error Reporting**: Comprehensive error context collection

### Offscreen Document (`entrypoints/offscreen/`)

Provides a secure DOM environment for content processing and clipboard operations.

#### Components
- **Enhanced Processor**: Advanced content processing with AI integration
- **Clipboard Manager**: Cross-browser clipboard operations
- **Performance Monitor**: Real-time processing metrics
- **Error Handler**: Graceful error recovery and reporting

---

## Cloudflare Workers API

### Architecture Overview

The extension uses three specialized Cloudflare Workers for scalable backend operations:

1. **Credit Service**: User credit tracking and management
2. **AI Proxy**: Secure AI processing with credit validation
3. **Circuit Breaker**: Budget protection and rate limiting

### Credit Service (`functions/credit-service/`)

Manages user credits and trial limits with persistent KV storage.

#### Endpoints

```typescript
// Check user credit balance
GET /api/credits/check
Response: {
  userId: string;
  credits: number;
  lastReset: string;
  tier: 'trial' | 'pro';
}

// Consume credits for processing
POST /api/credits/consume
Body: { userId: string; amount: number; operation: string; }
Response: {
  success: boolean;
  remainingCredits: number;
  transactionId: string;
}

// Reset monthly credits (cron job)
POST /api/credits/reset
Body: { adminKey: string; }
Response: { success: boolean; resetCount: number; }
```

#### Features
- **Monthly Reset**: Automatic credit reset on billing cycle
- **Transaction Logging**: Complete audit trail of credit usage
- **Tier Management**: Trial vs Pro user differentiation
- **Rate Limiting**: Built-in request throttling

### AI Proxy (`functions/ai-proxy/`)

Secure proxy for AI processing with credit validation and budget protection.

#### Endpoints

```typescript
// Process content with AI
POST /api/ai/process
Body: {
  content: string;
  model: string;
  userId: string;
  options: { temperature: number; maxTokens: number; };
}
Response: {
  success: boolean;
  result: string;
  creditsUsed: number;
  processingTime: number;
  model: string;
}

// List available models
GET /api/ai/models
Response: {
  trial: [{ name: string; description: string; cost: number; }];
  pro: [{ name: string; description: string; cost: number; }];
  byok: [{ name: string; description: string; provider: string; }];
}
```

#### Security Features
- **Credit Validation**: Ensures sufficient credits before processing
- **Content Sanitization**: Removes sensitive information before AI processing
- **Rate Limiting**: Per-user request throttling
- **Audit Logging**: Complete processing audit trail

### Circuit Breaker (`functions/circuit-breaker/`)

Global budget protection and system-wide rate limiting.

#### Endpoints

```typescript
// Check system status
GET /api/circuit/status
Response: {
  status: 'closed' | 'open' | 'half-open';
  globalBudgetRemaining: number;
  activeRequests: number;
  averageResponseTime: number;
}

// Request permission for operation
POST /api/circuit/validate
Body: { operation: string; estimatedCost: number; userId: string; }
Response: {
  allowed: boolean;
  reason?: string;
  budgetRemaining: number;
}
```

#### Protection Mechanisms
- **Global Budget**: System-wide cost protection
- **Circuit States**: Open/half-open/closed based on failure rates
- **Adaptive Thresholds**: Dynamic limit adjustment based on usage
- **Emergency Cutoff**: Automatic service protection when limits exceeded

---

## React Component Library

### Popup Architecture (`entrypoints/popup/`)

Modern React-based popup interface with comprehensive state management and responsive design.

#### Core Components

**Popup.tsx**
- Main popup container with theme support
- Loading states and error boundaries
- Keyboard navigation support
- Responsive layout (mobile/desktop)

**ModeToggle.tsx**
- Switch between Offline and AI processing modes
- Visual indicators for mode status
- Animated transitions and feedback

**ProcessingProfiles.tsx**
- Pre-configured processing profiles
- Custom profile creation and management
- Performance presets for different content types

**ProStatusSettings.tsx**
- Credit usage display and history
- BYOK (Bring Your Own Key) management
- Upgrade prompts and trial status

**SettingsPanel.tsx**
- Comprehensive settings management
- Real-time validation and feedback
- Import/export configuration

**PerformanceDashboard.tsx**
- Real-time performance metrics
- Processing history and trends
- System health monitoring

#### Custom Hooks

**useProManager.ts**
```typescript
interface ProState {
  credits: number;
  isPro: boolean;
  byokConfig: BYOKConfig | null;
  loading: boolean;
  error: string | null;
}

const useProManager = (): ProState => {
  // Credit balance management
  // BYOK configuration handling
  // Upgrade flow orchestration
  // Error recovery and retry logic
};
```

**usePopupController.ts**
```typescript
interface PopupController {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: ProcessingResult | null;

  startProcessing: () => void;
  cancelProcessing: () => void;
  reset: () => void;
}

const usePopupController = (): PopupController => {
  // Processing state management
  // Progress tracking and cancellation
  // Error boundary integration
  // Result handling and export
};
```

**useToastManager.tsx**
```typescript
interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: { label: string; handler: () => void };
}

const useToastManager = () => {
  showToast: (toast: ToastMessage) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
};
```

#### Component Patterns

**State Management**
- Centralized state with React Context
- Persistent settings synchronization
- Real-time updates from background script

**Error Handling**
- Error boundaries with graceful degradation
- User-friendly error messages
- Automatic recovery mechanisms

**Performance Optimization**
- Lazy loading for heavy components
- Memoization for expensive computations
- Virtual scrolling for large lists

---

## User Guide

### Quick Start

1. **Installation**
   - Download extension from Chrome Web Store or sideload developer build
   - Grant necessary permissions (clipboard, storage, activeTab)
   - Pin extension to toolbar for easy access

2. **Basic Usage**
   - Navigate to any webpage with content
   - Select text or use extension to capture full page
   - Choose processing mode (Offline free vs AI enhanced)
   - Copy cleaned Markdown to clipboard
   - Paste into desired application

### Processing Modes

#### Offline Mode (Free)
- **Instant Processing**: No network latency
- **Privacy First**: All processing happens locally
- **Smart Extraction**: Mozilla Readability + custom filters
- **Quality Scoring**: Automated content assessment

#### AI Mode (Trial/BYOK)
- **Enhanced Quality**: Superior content structuring
- **Context Understanding**: AI-powered content improvement
- **Smart Formatting**: Intelligent heading and list optimization
- **Citation Generation**: Automatic source attribution

### BYOK Setup (Bring Your Own Key)

1. **Open Settings**: Click extension icon → Settings → Pro Status
2. **Select BYOK**: Choose "Add Your Own API Key"
3. **Configure Provider**:
   - OpenRouter (recommended)
   - OpenAI
   - Custom endpoint
4. **Enter API Key**: Securely store key locally
5. **Select Model**: Choose from available AI models

### Export Options

#### Markdown Export
- **Standard Format**: Clean Markdown with headings and lists
- **Citation Block**: Source URL and capture timestamp
- **Quality Metadata**: Processing stats and quality score
- **Platform Optimization**: GitHub, Obsidian, or Standard formatting

#### JSON Export
- **Structured Data**: Complete content metadata
- **Processing History**: Quality scores and timing data
- **Source Information**: URL, title, and timestamp
- **Settings Snapshot**: Configuration used for processing

### Performance Monitoring

The extension provides comprehensive performance monitoring:

#### Real-time Dashboard
- **Active Sessions**: Current processing operations
- **Quality Scores**: Live quality assessment
- **Cache Performance**: Hit rates and retrieval times
- **System Health**: Overall extension status

#### Performance Reports
- **Processing Trends**: Historical performance data
- **Bottleneck Identification**: Performance issue detection
- **Optimization Recommendations**: Automated suggestions
- **Export Capability**: Performance data export for analysis

### Troubleshooting

#### Common Issues

**Content Not Captured**
- Refresh the page and try again
- Check if content script is properly injected
- Try selecting text manually before capturing

**Processing Fails**
- Check internet connection for AI mode
- Verify API key configuration for BYOK
- Try offline mode as fallback

**Clipboard Copy Fails**
- Grant clipboard permissions in browser settings
- Try manual copy from extension popup
- Check browser compatibility (Chrome 88+ recommended)

**Performance Issues**
- Clear processing cache in settings
- Reduce chunk size for large documents
- Disable detailed performance tracking

#### Error Recovery

The extension includes automatic error recovery:
- **Fallback Processing**: Switch to offline mode on AI failures
- **Content Sanitization**: Remove problematic elements
- **Partial Results**: Return best-effort extraction
- **User Guidance**: Clear error messages and next steps

---

## Development Setup

### Prerequisites

- **Node.js**: Version 18+ recommended
- **npm**: Latest version for dependency management
- **Chrome**: Version 88+ for Manifest V3 support
- **Git**: For version control and collaboration

### Local Development

```bash
# Clone repository
git clone https://github.com/ham-zax/promptready_extension.git
cd promptready_extension

# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Firefox development (if needed)
npm run dev:firefox

# Type checking during development
npm run compile
```

### Project Structure

```
promptready_extension/
├── entrypoints/              # Extension entry points
│   ├── background.ts         # Service worker orchestrator
│   ├── content.ts           # Content script for DOM interaction
│   ├── offscreen/           # Offscreen document processing
│   └── popup/              # React-based UI
├── core/                    # Core processing logic
│   ├── offline-mode-manager.ts     # Offline processing orchestrator
│   ├── performance-metrics.ts      # Performance monitoring system
│   ├── readability-config.ts       # Mozilla Readability configuration
│   ├── turndown-config.ts         # HTML-to-Markdown conversion
│   └── post-processor.ts          # Content enhancement
├── functions/               # Cloudflare Workers
│   ├── credit-service/      # User credit management
│   ├── ai-proxy/           # AI processing proxy
│   └── circuit-breaker/    # Budget protection
├── lib/                    # Shared utilities and types
├── components/              # Reusable React components
├── assets/                  # Static assets (icons, images)
└── tests/                   # Test suites
```

### Build Process

```bash
# Build for production
npm run build

# Build for Firefox
npm run build:firefox

# Create distribution packages
npm run zip
npm run zip:firefox
```

### Testing

```bash
# Run unit tests
npm test

# Run tests with UI
npm run test:ui

# Type checking
npm run compile

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check
```

### Deployment

#### Chrome Web Store
1. **Build Extension**: `npm run build`
2. **Upload Package**: Upload `dist/` folder to Chrome Developer Dashboard
3. **Configure Listing**: Set store description, screenshots, and permissions
4. **Submit for Review**: Wait for Google approval process

#### Firefox Add-ons
1. **Build Firefox Version**: `npm run build:firefox`
2. **Sign Extension**: Use Firefox Add-on Developer Hub
3. **Upload Signed Package**: Submit to AMO marketplace

#### Cloudflare Workers Deployment

```bash
# Deploy each function
cd functions/credit-service
wrangler deploy

cd ../ai-proxy
wrangler deploy

cd ../circuit-breaker
wrangler deploy
```

Environment Variables Required:
- `AI_API_KEY`: Groq API key for trial processing
- `SERVICE_SECRET`: Internal service authentication
- `CREDITS_KV`: KV namespace for user credits
- `BUDGET_KV`: KV namespace for budget tracking

### Code Quality

#### ESLint Configuration
- TypeScript strict mode enabled
- React hooks rules enforced
- Import/export consistency checks
- Security vulnerability scanning

#### Testing Strategy
- **Unit Tests**: Core logic validation
- **Integration Tests**: Extension workflow testing
- **E2E Tests**: Full user journey testing
- **Performance Tests**: Processing time and memory usage

#### Documentation Standards
- **JSDoc Comments**: Comprehensive API documentation
- **Type Safety**: Full TypeScript coverage
- **Code Examples**: Usage patterns and best practices
- **Changelog**: Version history and changes

### Contributing Guidelines

1. **Fork Repository**: Create personal copy for development
2. **Feature Branch**: Isolate changes from main branch
3. **Code Quality**: Follow linting and formatting standards
4. **Testing**: Ensure test coverage for new features
5. **Documentation**: Update relevant documentation sections
6. **Pull Request**: Detailed description of changes and motivation

### Performance Guidelines

- **Processing Time**: Target <500ms for typical content
- **Memory Usage**: Keep heap usage under 50MB
- **Cache Hit Rate**: Maintain >70% for repeated content
- **Error Rate**: Keep processing failures under 5%
- **Quality Score**: Target >85/100 for extracted content

---

## Security & Privacy

### Data Protection
- **Local Processing**: All content processed locally in offline mode
- **Secure Storage**: API keys stored encrypted locally
- **No Telemetry**: No usage tracking or analytics collection
- **Memory Cleanup**: Automatic cleanup of sensitive data

### Permission Model
- **Minimal Permissions**: Only request essential permissions
- **User Control**: Clear permission explanations and controls
- **Privacy First**: No data collection or tracking
- **Open Source**: Transparent codebase for security review

---

## API Reference

### Core APIs

#### OfflineModeManager
```typescript
class OfflineModeManager {
  // Main processing method
  static async processContent(
    html: string,
    url: string,
    title: string,
    customConfig?: Partial<OfflineModeConfig>
  ): Promise<OfflineProcessingResult>

  // Cache management
  static async clearCache(): Promise<void>
  static async getCacheStats(): Promise<CacheStats>
  static async cleanupExpiredCache(): Promise<number>

  // Performance monitoring
  static getPerformanceMetrics(): PerformanceSummary
  static generatePerformanceReport(): PerformanceReport
  static startRealTimeMonitoring(): MonitoringController
}
```

#### PerformanceMetrics
```typescript
class PerformanceMetrics {
  // Recording methods
  static recordExtraction(metrics: ExtractionMetrics): void
  static recordCacheHit(duration: number): void
  static recordCacheMiss(): void
  static captureMemorySnapshot(phase: string): void

  // Analysis methods
  static generateReport(): PerformanceReport
  static getMetricsSummary(): MetricsSummary
  static checkPerformanceOverhead(): boolean
}
```

### Extension APIs

#### Background Script Messages
```typescript
interface BackgroundMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

interface BackgroundResponse {
  success: boolean;
  data?: any;
  error?: string;
}
```

#### Content Script API
```typescript
interface ContentScriptAPI {
  // Content extraction
  extractSelectedText(): string;
  extractFullPage(): PageContent;

  // Clipboard operations
  copyToClipboard(content: string): Promise<boolean>;

  // Communication
  sendMessage(message: BackgroundMessage): Promise<BackgroundResponse>;
}
```

### Storage APIs

#### Settings Storage
```typescript
interface ExtensionSettings {
  mode: 'offline' | 'ai';
  renderer: 'turndown' | 'readability';
  useReadability: boolean;
  byokConfig?: BYOKConfig;
  performance?: PerformanceSettings;
}

class Storage {
  static async getSettings(): Promise<ExtensionSettings>
  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void>
  static async clearSettings(): Promise<void>
}
```

---

*This documentation covers the complete PromptReady extension system. For specific implementation details, refer to the individual component documentation and inline code comments.*