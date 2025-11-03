# PromptReady API Reference

## Core Processing APIs

### OfflineModeManager

#### Methods

##### `processContent(html, url, title, customConfig?)`

Main entry point for offline content processing.

**Parameters:**
- `html` (string): Raw HTML content to process
- `url` (string): Source URL for configuration and metadata
- `title` (string): Content title for metadata
- `customConfig?` (Partial<OfflineModeConfig>): Optional configuration overrides

**Returns:** `Promise<OfflineProcessingResult>`

**Example:**
```typescript
const result = await OfflineModeManager.processContent(
  '<html>...</html>',
  'https://example.com/article',
  'Article Title',
  { turndownPreset: 'github' }
);

if (result.success) {
  console.log(`Processed in ${result.processingStats.totalTime}ms`);
  console.log(`Quality score: ${result.processingStats.qualityScore}/100`);
}
```

##### `getOptimalConfig(url, settings?)`

Generates optimal processing configuration based on URL patterns and user settings.

**Parameters:**
- `url` (string): Target URL for configuration
- `settings?` (any): User settings to apply

**Returns:** `Promise<OfflineModeConfig>`

**Configuration Detection:**
- **Technical Documentation**: `github.com`, `docs.*`, `api.*` → technical preset
- **Blog Articles**: `*blog*`, `medium.com`, `substack.com` → blog preset
- **Wiki Content**: `wikipedia.org`, `*wiki*` → wiki preset

##### `processLargeContent(html, url, title, config?)`

Processes large documents by splitting into manageable chunks.

**Parameters:**
- Same as `processContent()`

**Special Handling:**
- Automatic chunking at 100KB boundaries
- Combined results with separator markers
- Memory-efficient processing for large content

##### `insertCiteFirstBlock(markdown, metadata)`

Inserts standardized citation block at the top of markdown content.

**Parameters:**
- `markdown` (string): Processed markdown content
- `metadata` (ExportMetadata): Content metadata for citation

**Citation Format:**
```markdown
> Source: [Article Title](https://example.com)
> Captured: 2024-01-15
> Hash: abc123def456
```

#### Properties

##### Configuration Defaults

```typescript
const DEFAULT_CONFIG: OfflineModeConfig = {
  turndownPreset: 'standard',
  postProcessing: {
    enabled: true,
    addTableOfContents: false,
    optimizeForPlatform: 'standard',
  },
  performance: {
    maxContentLength: 1000000,    // 1MB
    enableCaching: true,
    chunkSize: 100000,           // 100KB
  },
  fallbacks: {
    enableReadabilityFallback: true,
    enableTurndownFallback: true,
    maxRetries: 2,
  },
};
```

### PerformanceMetrics

#### Methods

##### `getInstance()`

Returns singleton instance of the performance metrics system.

**Returns:** `PerformanceMetrics`

##### `recordExtraction(metrics)`

Records extraction performance data.

**Parameters:**
```typescript
interface ExtractionMetrics {
  extractionTime: number;
  contentLength: number;
  contentQuality: number;
  charThreshold: string;
  presetUsed: string;
  timestamp: number;
}
```

##### `recordExtractionStart()` / `endTimer(timerId)`

Measures operation duration with unique timer IDs.

**Returns:** `string` - Timer identifier for `endTimer()`

##### `measureAsyncOperation(operationName, operation)`

Measures async operation duration with error handling.

**Parameters:**
- `operationName` (string): Descriptive operation name
- `operation` (function): Async function to measure

**Returns:** `Promise<{ result: T; duration: number }>`

**Example:**
```typescript
const { result: processedMarkdown, duration } =
  await performance.measureAsyncOperation('readability_extraction', () =>
    ReadabilityConfigManager.extractContent(doc, url, config)
  );
```

##### `generateReport()`

Generates comprehensive performance report with recommendations.

**Returns:** `PerformanceReport`

```typescript
interface PerformanceReport {
  summary: MetricsSummary;
  pipelinePerformance: PipelineMetrics;
  cachePerformance: CacheMetrics;
  qualityAssessment: QualityMetrics;
  memoryEfficiency: MemoryEfficiency;
  recommendations: string[];
  generatedAt: string;
}
```

#### Real-Time Monitoring

##### `startRealTimeMonitoring()`

Starts real-time performance monitoring with periodic updates.

**Returns:** `MonitoringController`

```typescript
interface MonitoringController {
  stop: () => void;
  getMetrics: () => Promise<RealTimeMetrics>;
}
```

**Real-time Data Structure:**
```typescript
interface RealTimeMetrics {
  timestamp: number;
  activeProcessingSessions: number;
  currentMemoryUsage?: number;
  cachePerformance: CacheMetrics;
  processingTrends: SessionMetrics;
  systemHealth: 'optimal' | 'warning' | 'critical';
  recommendations: string[];
}
```

## Extension Messaging APIs

### Background Script Communication

#### Message Types

##### Capture Messages
```typescript
// Request content capture from active tab
interface CaptureRequest {
  type: 'CAPTURE_REQUEST';
  payload: { tabId: number };
}

// Content capture completed
interface CaptureComplete {
  type: 'CAPTURE_COMPLETE';
  payload: {
    html: string;
    url: string;
    title: string;
    selectionHash: string;
  };
}

// Manual capture command (keyboard shortcut)
interface CaptureSelection {
  type: 'CAPTURE_SELECTION';
  payload: { tabId?: number };
}
```

##### Processing Messages
```typescript
// Processing completed successfully
interface ProcessingComplete {
  type: 'PROCESSING_COMPLETE';
  payload: {
    exportMd: string;
    exportJson: any;
    metadata: ExportMetadata;
    stats: ProcessingStats;
    warnings: string[];
    qualityReport: QualityReport;
  };
}

// Processing failed
interface ProcessingError {
  type: 'PROCESSING_ERROR';
  payload: {
    error: string;
    stage: string;
    fallbackUsed: boolean;
  };
}

// Processing progress updates
interface ProcessingProgress {
  type: 'PROCESSING_PROGRESS';
  payload: {
    progress: number;    // 0-100
    stage: string;      // 'extracting' | 'converting' | 'post-processing'
  };
}
```

##### Export Messages
```typescript
// Request content export
interface ExportRequest {
  type: 'EXPORT_REQUEST';
  payload: {
    format: 'md' | 'json';
    action: 'copy' | 'download';
    content?: string;  // For direct content export
  };
}

// Export completed
interface ExportComplete {
  type: 'EXPORT_COMPLETE';
  payload: {
    format: string;
    action: string;
    success: boolean;
    content?: string;  // For download action
  };
}
```

##### Clipboard Messages
```typescript
// Copy content to clipboard
interface CopyToClipboard {
  type: 'COPY_TO_CLIPBOARD';
  payload: {
    content: string;
    waitForPopupClose?: boolean;
  };
}

// Copy operation completed
interface CopyComplete {
  type: 'COPY_COMPLETE';
  payload: {
    success: boolean;
    method: 'background' | 'offscreen' | 'content';
    error?: string;
  };
}
```

#### Error Handling

##### Error Types
```typescript
interface ProcessingError {
  type: 'PROCESSING_ERROR';
  payload: {
    error: string;
    stage: 'content-extraction' | 'readability' | 'turndown' | 'post-processing';
    fallbackUsed: boolean;
    recoverable: boolean;
  };
}

interface SystemError {
  type: 'SYSTEM_ERROR';
  payload: {
    error: string;
    component: 'background' | 'content' | 'offscreen' | 'popup';
    critical: boolean;
  };
}
```

### Content Script APIs

#### DOM Interaction

##### `extractSelectedText()`

Extracts currently selected text content from the page.

**Returns:** `string | null`

**Example:**
```typescript
const selection = extractSelectedText();
if (selection) {
  console.log(`Selected ${selection.length} characters`);
} else {
  console.log('No text selected');
}
```

##### `extractFullPage()`

Extracts the full page content using smart DOM traversal.

**Returns:** `PageContent`

```typescript
interface PageContent {
  html: string;
  text: string;
  title: string;
  url: string;
  metadata: {
    description: string;
    keywords: string[];
    author: string;
    publishDate: string;
  };
}
```

#### Clipboard Operations

##### `copyToClipboard(content, options?)`

Copies content to clipboard with cross-browser support.

**Parameters:**
- `content` (string): Content to copy
- `options?` (ClipboardOptions): Copy operation options

```typescript
interface ClipboardOptions {
  waitForPopupClose?: boolean;
  fallbackToOffscreen?: boolean;
  timeout?: number;
}
```

**Returns:** `Promise<CopyResult>`

```typescript
interface CopyResult {
  success: boolean;
  method: 'content' | 'offscreen' | 'fallback';
  error?: string;
}
```

#### Communication

##### `sendMessage(message)`

Sends message to background script with retry logic.

**Parameters:**
- `message` (BackgroundMessage): Message to send

**Returns:** `Promise<BackgroundResponse>`

##### `ping()`

Pings background script to check connectivity.

**Returns:** `Promise<boolean>` - True if background script responds

## React Component APIs

### Core Hooks

#### `useProManager`

Manages Pro subscription status, credits, and BYOK configuration.

**Returns:** `ProState & ProActions`

```typescript
interface ProState {
  credits: number;
  isPro: boolean;
  byokConfig: BYOKConfig | null;
  loading: boolean;
  error: string | null;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'inactive';
}

interface ProActions {
  checkCredits: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
  configureBYOK: (config: BYOKConfig) => Promise<void>;
  removeBYOK: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}
```

**Usage:**
```typescript
function ProComponent() {
  const { credits, isPro, checkCredits, upgradeToPro } = useProManager();

  return (
    <div>
      <p>Credits: {credits}</p>
      {!isPro && (
        <button onClick={upgradeToPro}>Upgrade to Pro</button>
      )}
    </div>
  );
}
```

#### `usePopupController`

Manages popup state, processing operations, and user interactions.

**Returns:** `PopupControllerState & PopupControllerActions`

```typescript
interface PopupControllerState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: ProcessingResult | null;
  mode: 'offline' | 'ai';
  lastExport: ExportData | null;
}

interface PopupControllerActions {
  startProcessing: (options: ProcessingOptions) => Promise<void>;
  cancelProcessing: () => void;
  retryProcessing: () => void;
  exportResult: (format: ExportFormat) => Promise<void>;
  reset: () => void;
  setMode: (mode: 'offline' | 'ai') => void;
}
```

#### `useToastManager`

Manages toast notifications with queue and auto-dismissal.

**Returns:** `ToastState & ToastActions`

```typescript
interface ToastState {
  toasts: ToastMessage[];
  queue: ToastMessage[];
}

interface ToastActions {
  showToast: (toast: Partial<ToastMessage>) => string;
  showSuccess: (title: string, message: string) => string;
  showError: (title: string, message: string) => string;
  showWarning: (title: string, message: string) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}
```

**Usage:**
```typescript
function StatusComponent() {
  const { showSuccess, showError } = useToastManager();

  const handleSuccess = () => {
    showSuccess('Success!', 'Content processed and copied to clipboard');
  };

  const handleError = () => {
    showError('Processing Failed', 'Please try again or check your connection');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Test Success</button>
      <button onClick={handleError}>Test Error</button>
    </div>
  );
}
```

#### `useErrorHandler`

Global error boundary with automatic error reporting and recovery.

**Returns:** `ErrorHandlerState & ErrorHandlerActions`

```typescript
interface ErrorHandlerState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempts: number;
}

interface ErrorHandlerActions {
  handleError: (error: Error, errorInfo?: ErrorInfo) => void;
  attemptRecovery: () => Promise<boolean>;
  clearError: () => void;
  reportError: (error: Error, context?: string) => Promise<void>;
}
```

### Component Props

#### PrimaryButton

Primary action button with loading states and accessibility features.

**Props:**
```typescript
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  className?: string;
  tabIndex?: number;
  ariaLabel?: string;
}
```

#### ModeToggle

Toggle switch for processing modes with visual feedback.

**Props:**
```typescript
interface ModeToggleProps {
  mode: 'offline' | 'ai';
  onModeChange: (mode: 'offline' | 'ai') => void;
  disabled?: boolean;
  showLabels?: boolean;
  className?: string;
}
```

#### ProcessingProfiles

Profile selection and management for different content types.

**Props:**
```typescript
interface ProcessingProfilesProps {
  profiles: ProcessingProfile[];
  activeProfile: string;
  onProfileChange: (profileId: string) => void;
  onProfileEdit?: (profile: ProcessingProfile) => void;
  onProfileDelete?: (profileId: string) => void;
  onProfileCreate?: () => void;
  disabled?: boolean;
}
```

```typescript
interface ProcessingProfile {
  id: string;
  name: string;
  description: string;
  config: Partial<OfflineModeConfig>;
  icon?: string;
  preset: 'blog' | 'technical' | 'wiki' | 'custom';
}
```

## Storage APIs

### Extension Storage

#### Settings Management

```typescript
interface ExtensionSettings {
  mode: 'offline' | 'ai';
  renderer: 'turndown' | 'readability';
  useReadability: boolean;
  byokConfig?: BYOKConfig;
  performance?: PerformanceSettings;
  ui?: UISettings;
  privacy?: PrivacySettings;
}

class Storage {
  static async getSettings(): Promise<ExtensionSettings>
  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void>
  static async resetSettings(): Promise<void>
  static async exportSettings(): Promise<string>
  static async importSettings(settingsJson: string): Promise<boolean>
}
```

#### Cache Management

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

class CacheManager {
  static async get<T>(key: string): Promise<T | null>
  static async set<T>(key: string, data: T, ttlHours: number): Promise<void>
  static async delete(key: string): Promise<void>
  static async clear(): Promise<void>
  static async getStats(): Promise<CacheStats>
  static async cleanupExpired(): Promise<number>
}
```

#### Session Storage

```typescript
interface SessionData {
  currentExport: ExportData | null;
  lastCapture: CaptureData | null;
  processingState: ProcessingState | null;
  failedMessages: FailedMessage[];
}

class SessionManager {
  static async setData<T>(key: string, data: T): Promise<void>
  static async getData<T>(key: string): Promise<T | null>
  static async clearData(key: string): Promise<void>
  static async clearAll(): Promise<void>
}
```

## Cloudflare Workers APIs

### Credit Service Endpoints

#### Check Credits
```http
GET /api/credits/check
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "credits": 150,
    "lastReset": "2024-01-01T00:00:00Z",
    "tier": "trial",
    "monthlyLimit": 150,
    "usageHistory": [
      {
        "date": "2024-01-15",
        "creditsUsed": 25,
        "operation": "ai-processing"
      }
    ]
  }
}
```

#### Consume Credits
```http
POST /api/credits/consume
Authorization: Bearer <user-token>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "user_123",
  "amount": 5,
  "operation": "ai-processing",
  "metadata": {
    "model": "llama-3.1-70b",
    "contentLength": 1500,
    "processingTime": 250
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_456",
    "remainingCredits": 145,
    "creditsDeducted": 5,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### AI Proxy Endpoints

#### Process Content
```http
POST /api/ai/process
Authorization: Bearer <user-token>
Content-Type: application/json
```

**Body:**
```json
{
  "content": "<html>Web page content...</html>",
  "model": "llama-3.1-70b",
  "options": {
    "temperature": 0.7,
    "maxTokens": 4000,
    "systemPrompt": "Convert this HTML to clean, structured Markdown"
  },
  "metadata": {
    "sourceUrl": "https://example.com",
    "contentType": "article",
    "userTier": "pro"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": "# Cleaned Content\n\nThis is the processed markdown...",
    "creditsUsed": 5,
    "processingTime": 1250,
    "model": "llama-3.1-70b",
    "qualityScore": 92,
    "metadata": {
      "tokensUsed": 1250,
      "originalLength": 5000,
      "processedLength": 2500
    }
  }
}
```

#### Available Models
```http
GET /api/ai/models
Authorization: Bearer <user-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trial": [
      {
        "name": "llama-3.1-8b",
        "description": "Fast processing model",
        "cost": 1,
        "maxTokens": 2000
      }
    ],
    "pro": [
      {
        "name": "llama-3.1-70b",
        "description": "High-quality processing model",
        "cost": 5,
        "maxTokens": 8000
      },
      {
        "name": "mixtral-8x7b",
        "description": "Balanced performance model",
        "cost": 3,
        "maxTokens": 4000
      }
    ],
    "byok": [
      {
        "name": "gpt-4-turbo",
        "provider": "openai",
        "description": "OpenAI GPT-4 Turbo",
        "cost": "user-provided",
        "maxTokens": 128000
      },
      {
        "name": "claude-3.5-sonnet",
        "provider": "anthropic",
        "description": "Anthropic Claude 3.5 Sonnet",
        "cost": "user-provided",
        "maxTokens": 200000
      }
    ]
  }
}
```

### Circuit Breaker Endpoints

#### System Status
```http
GET /api/circuit/status
Authorization: Bearer <service-secret>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "open",
    "globalBudgetRemaining": 85.7,
    "activeRequests": 12,
    "averageResponseTime": 145,
    "failureRate": 2.1,
    "lastFailure": null,
    "thresholds": {
      "failureRate": 5.0,
      "responseTime": 500,
      "concurrentRequests": 100
    }
  }
}
```

#### Validate Operation
```http
POST /api/circuit/validate
Authorization: Bearer <user-token>
Content-Type: application/json
```

**Body:**
```json
{
  "operation": "ai-processing",
  "estimatedCost": 5,
  "userId": "user_123",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "budgetRemaining": 145,
    "reason": null,
    "quotaRemaining": 295,
    "backpressure": false,
    "retryAfter": null
  }
}
```

## Error Reference

### Error Codes

#### Processing Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `ERR_EXTRACT_001` | HTML parsing failed | Use fallback extraction |
| `ERR_EXTRACT_002` | Content too large | Enable chunked processing |
| `ERR_READABILITY_001` | Readability extraction failed | Use fallback extraction |
| `ERR_TURNDOWN_001` | Turndown conversion failed | Use fallback conversion |
| `ERR_QUALITY_001` | Content quality below threshold | Adjust processing settings |

#### System Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `ERR_SYS_001` | Background script unavailable | Refresh extension |
| `ERR_SYS_002` | Content script injection failed | Reload page |
| `ERR_SYS_003` | Offscreen document creation failed | Restart extension |
| `ERR_SYS_004` | Storage quota exceeded | Clear cache/data |
| `ERR_SYS_005` | Network timeout | Retry operation |

#### API Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `ERR_API_001` | Invalid API key | Check BYOK configuration |
| `ERR_API_002` | Insufficient credits | Upgrade or wait for reset |
| `ERR_API_003` | Rate limit exceeded | Wait and retry |
| `ERR_API_004` | Service unavailable | Use offline mode |
| `ERR_API_005` | Invalid request format | Check request structure |

---

*This API reference covers all major interfaces and methods in the PromptReady extension. For implementation details, refer to the inline JSDoc comments in the source code.*