# React Component Library Documentation

## Overview

The PromptReady extension uses a modern React-based popup interface with comprehensive state management, accessibility features, and responsive design patterns.

## Component Architecture

### Design System

**Styling Framework**: Tailwind CSS v4+ with custom extensions
**Component Library**: Radix UI primitives for accessibility
**Icon System**: Lucide React icons with semantic meaning
**Animation**: Tailwind Animate CSS for smooth transitions
**Theme**: Light/dark mode support with CSS custom properties

### State Management

**Pattern**: Custom hooks with Context API
**Persistence**: Browser storage synchronization
**Real-time Updates**: Background script messaging
**Error Boundaries**: Graceful error handling and recovery

---

## Core Components

### Popup.tsx

**Purpose**: Main popup container with responsive layout and global state management.

#### Features
- **Developer Mode**: Hidden feature activated via keyboard sequence ("devmode")
- **Responsive Design**: Mobile-first layout with desktop enhancements
- **Loading States**: Visual feedback for all operations
- **Error Boundaries**: Comprehensive error handling with recovery

#### Props
```typescript
// No props - uses global state via hooks
```

#### State Integration
```typescript
// Core controller hook
const {
  state,              // Global application state
  isProcessing,       // Current processing status
  hasContent,         // Content availability
  handleModeToggle,    // Mode switching handler
  handleCapture,        // Content capture initiator
  handleCopy,          // Clipboard operation handler
  handleExport,         // Export functionality
  onSettingsChange,    // Settings update handler
} = usePopupController();

// Specialized manager hooks
const byokManager = useByokManager();      // BYOK management
const proManager = useProManager();          // Pro subscription handling
const errorHandler = useErrorHandler();       // Error boundary management
const toastManager = useToastManager();        // Notification system
```

#### Developer Mode
```typescript
// Activation sequence
const DEV_MODE_SEQUENCE = 'devmode';

// Effects
- Unlocks all AI features without credit limits
- Shows debug information in UI
- Enables advanced export options
- Bypasses certain validation checks
```

### ModeToggle.tsx

**Purpose**: Interactive toggle between Offline and AI processing modes.

#### Props
```typescript
interface ModeToggleProps {
  mode: 'offline' | 'ai';                    // Current mode
  onModeChange: (mode: 'offline' | 'ai') => void;  // Mode change handler
  disabled?: boolean;                            // Disable toggle
  showLabels?: boolean;                          // Show text labels
  className?: string;                             // Additional CSS classes
}
```

#### Usage
```typescript
<ModeToggle
  mode={currentMode}
  onModeChange={(newMode) => setCurrentMode(newMode)}
  disabled={isProcessing}
  showLabels={true}
/>
```

#### Features
- **Visual Feedback**: Animated transitions between modes
- **Accessibility**: Keyboard navigation and ARIA labels
- **Status Indicators**: Mode-specific status badges
- **Upgrade Prompts**: Contextual upgrade suggestions

### PrimaryButton.tsx

**Purpose**: Primary action button with loading states and accessibility features.

#### Props
```typescript
interface PrimaryButtonProps {
  children: React.ReactNode;                    // Button content
  onClick?: () => void;                        // Click handler
  disabled?: boolean;                            // Disabled state
  loading?: boolean;                              // Loading state
  variant?: 'primary' | 'secondary' | 'danger';  // Visual variant
  size?: 'sm' | 'md' | 'lg';                 // Size variant
  icon?: React.ReactNode;                         // Optional icon
  className?: string;                              // Additional CSS classes
  tabIndex?: number;                               // Custom tab index
  ariaLabel?: string;                              // Accessibility label
}
```

#### Usage
```typescript
<PrimaryButton
  onClick={handleAction}
  loading={isProcessing}
  disabled={!hasContent}
  variant="primary"
  size="lg"
  icon={<ProcessingIcon />}
  ariaLabel="Process content"
>
  Process Content
</PrimaryButton>
```

#### Features
- **Loading States**: Spinner and text changes during processing
- **Accessibility**: Full ARIA support and keyboard navigation
- **Focus Management**: Visual focus indicators and trap
- **Responsive**: Mobile-optimized sizing and spacing

### UnifiedSettings.tsx

**Purpose**: Comprehensive settings panel with real-time validation and category organization.

#### Props
```typescript
interface UnifiedSettingsProps {
  isExpanded: boolean;                           // Panel expansion state
  settings: Settings;                              // Current settings object
  onSettingsChange: (settings: Partial<Settings>) => void;  // Update handler
  isPro: boolean;                                // Pro subscription status
  hasApiKey: boolean;                             // API key availability
}
```

#### Settings Categories
```typescript
interface Settings {
  // Processing Configuration
  mode: 'offline' | 'ai';
  renderer: 'turndown' | 'readability';
  useReadability: boolean;

  // BYOK Configuration
  byokConfig?: {
    provider: 'openrouter' | 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    model: string;
    baseUrl?: string;
  };

  // Performance Settings
  performance?: {
    enableCaching: boolean;
    maxContentLength: number;
    chunkSize: number;
  };

  // UI Preferences
  ui?: {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
    compactMode: boolean;
  };

  // Privacy Settings
  privacy?: {
    enableTelemetry: boolean;
    localProcessing: boolean;
    dataRetention: number; // days
  };

  // Feature Flags
  flags?: {
    aiModeEnabled: boolean;
    byokEnabled: boolean;
    trialEnabled: boolean;
    developerMode: boolean;
  };
}
```

#### Features
- **Real-time Validation**: Input validation with immediate feedback
- **Category Organization**: Logical grouping of related settings
- **Import/Export**: Settings backup and restoration
- **Reset Functionality**: Factory reset with confirmation

### ProBadge.tsx

**Purpose**: Visual indicator for Pro subscription status.

#### Props
```typescript
interface ProBadgeProps {
  className?: string;      // Additional CSS classes
  showTooltip?: boolean;   // Show explanatory tooltip
  size?: 'sm' | 'md' | 'lg';  // Size variant
}
```

#### Usage
```typescript
<ProBadge
  showTooltip={true}
  size="sm"
  className="ml-2"
/>
```

#### Features
- **Dynamic Content**: Content changes based on subscription status
- **Tooltips**: Helpful explanations on hover
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility**: Screen reader friendly descriptions

### ProcessingProfiles.tsx

**Purpose**: Pre-configured processing profiles with custom profile management.

#### Props
```typescript
interface ProcessingProfilesProps {
  profiles: ProcessingProfile[];                   // Available profiles
  activeProfile: string;                          // Currently selected profile
  onProfileChange: (profileId: string) => void;   // Profile selection handler
  onProfileEdit?: (profile: ProcessingProfile) => void;  // Profile edit handler
  onProfileDelete?: (profileId: string) => void;     // Profile deletion handler
  onProfileCreate?: () => void;                       // New profile creation
  disabled?: boolean;                                 // Disable interaction
}
```

#### Profile Structure
```typescript
interface ProcessingProfile {
  id: string;                           // Unique identifier
  name: string;                         // Display name
  description: string;                    // Profile description
  config: Partial<OfflineModeConfig>;     // Processing configuration
  icon?: string;                         // Icon identifier
  preset: 'blog' | 'technical' | 'wiki' | 'custom';  // Content type preset
  priority: number;                      // Sort order
  createdAt: number;                      // Creation timestamp
  lastUsed?: number;                      // Last usage timestamp
}
```

#### Built-in Profiles
- **Blog Article**: Optimized for blog posts and articles
- **Technical Documentation**: Enhanced for technical docs and API references
- **Wiki Content**: Configured for wiki-style content
- **Custom**: User-created profiles with full configuration

### PerformanceDashboard.tsx

**Purpose**: Real-time performance monitoring dashboard with metrics visualization.

#### Props
```typescript
interface PerformanceDashboardProps {
  className?: string;           // Additional CSS classes
  showDetails?: boolean;       // Show detailed metrics
  refreshRate?: number;        // Auto-refresh interval (seconds)
}
```

#### Metrics Displayed
```typescript
interface PerformanceMetrics {
  // Processing Performance
  processingTime: {
    current: number;        // Current operation time
    average: number;        // Historical average
    trend: 'improving' | 'stable' | 'degrading';
  };

  // Quality Assessment
  quality: {
    overallScore: number;    // 0-100 quality rating
    structurePreservation: number;
    readabilityScore: number;
    issues: QualityIssue[];  // Quality problems found
  };

  // System Performance
  system: {
    memoryUsage: number;      // Current memory usage
    cacheHitRate: number;     // Cache efficiency
    errorRate: number;        // Error percentage
    uptime: number;           // Extension uptime
  };

  // Usage Analytics
  usage: {
    totalProcessings: number;
    successfulExtractions: number;
    averageContentLength: number;
    mostUsedPreset: string;
    dailyUsage: DailyUsage[];
  };
}
```

#### Visualization Features
- **Real-time Charts**: Live performance graphs and trends
- **Progress Bars**: Visual quality score representation
- **Status Indicators**: Color-coded system health status
- **Historical Data**: Time-series performance tracking

---

## Custom Hooks

### usePopupController

**Purpose**: Central state management for popup operations and user interactions.

#### Returns
```typescript
interface PopupControllerState {
  isProcessing: boolean;                    // Processing status
  progress: number;                          // Processing progress (0-100)
  error: string | null;                      // Current error message
  result: ProcessingResult | null;             // Last processing result
  mode: 'offline' | 'ai';                 // Current mode
  settings: Settings | null;                  // Current settings
  credits: CreditsInfo | null;                 // Credit information
  isPro: boolean;                            // Pro subscription status
  showUpgrade: boolean;                       // Upgrade modal visibility
}

interface PopupControllerActions {
  startProcessing: (options?: ProcessingOptions) => Promise<void>;
  cancelProcessing: () => void;              // Cancel current operation
  retryProcessing: () => Promise<void>;         // Retry last operation
  exportResult: (format: ExportFormat) => Promise<void>;  // Export result
  reset: () => void;                          // Reset all state
  setMode: (mode: 'offline' | 'ai') => void;          // Set processing mode
}
```

#### Usage
```typescript
function MyComponent() {
  const {
    isProcessing,
    progress,
    error,
    startProcessing,
    exportResult,
    mode
  } = usePopupController();

  const handleProcess = async () => {
    await startProcessing({
      source: 'manual',
      options: { optimizeForReadability: true }
    });
  };

  return (
    <div>
      {isProcessing && (
        <ProgressBar progress={progress} />
      )}
      {error && <ErrorMessage error={error} />}
      <button onClick={handleProcess}>Start Processing</button>
    </div>
  );
}
```

### useProManager

**Purpose**: Manages Pro subscription status, credits, and BYOK configuration.

#### Returns
```typescript
interface ProState {
  credits: number;                                    // Available credits
  isPro: boolean;                                     // Pro subscription status
  byokConfig: BYOKConfig | null;                       // BYOK configuration
  loading: boolean;                                     // Loading state
  error: string | null;                                 // Error message
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'inactive';
  trialInfo: {
    started: string;                                   // Trial start date
    expires: string;                                   // Trial expiration date
    dailyReset: boolean;                                // Daily reset enabled
  } | null;
}

interface ProActions {
  checkCredits: () => Promise<void>;                     // Check credit balance
  upgradeToPro: () => Promise<void>;                     // Initiate upgrade
  configureBYOK: (config: BYOKConfig) => Promise<void>;  // Configure BYOK
  removeBYOK: () => Promise<void>;                       // Remove BYOK
  refreshStatus: () => Promise<void>;                     // Refresh subscription status
  startTrial: (email: string) => Promise<void>;         // Start free trial
}
```

#### BYOK Configuration
```typescript
interface BYOKConfig {
  provider: 'openrouter' | 'openai' | 'anthropic' | 'custom';
  apiKey: string;                                    // Encrypted API key
  model: string;                                      // Selected model
  baseUrl?: string;                                   // Custom endpoint URL
  maxTokens?: number;                                  // Token limit per request
  temperature?: number;                                // Response randomness
  systemPrompt?: string;                               // Custom system prompt
}
```

#### Usage
```typescript
function ProStatus() {
  const {
    credits,
    isPro,
    byokConfig,
    configureBYOK,
    subscriptionStatus,
    trialInfo
  } = useProManager();

  const handleUpgrade = async () => {
    if (!isPro) {
      await upgradeToPro();
    }
  };

  const statusMessage = subscriptionStatus === 'trial' && trialInfo
    ? `Trial ends: ${new Date(trialInfo.expires).toLocaleDateString()}`
    : isPro ? 'Pro Subscription Active' : 'Free Mode';

  return (
    <div>
      <p>Credits: {credits}</p>
      <p>Status: {statusMessage}</p>
      {isPro && <ProBadge />}
      <button onClick={handleUpgrade}>Manage Subscription</button>
    </div>
  );
}
```

### useToastManager

**Purpose**: Toast notification system with queue management and auto-dismissal.

#### Returns
```typescript
interface ToastState {
  toasts: ToastMessage[];          // Active toasts
  queue: ToastMessage[];           // Queued toasts
  maxVisible: number;             // Maximum concurrent toasts
}

interface ToastActions {
  showToast: (toast: Partial<ToastMessage>) => string;   // Show new toast
  showSuccess: (title: string, message: string) => string;  // Success toast
  showError: (title: string, message: string) => string;    // Error toast
  showWarning: (title: string, message: string) => string;  // Warning toast
  showInfo: (title: string, message: string) => string;      // Info toast
  removeToast: (id: string) => void;                      // Remove specific toast
  clearAll: () => void;                                    // Clear all toasts
}
```

#### Toast Structure
```typescript
interface ToastMessage {
  id: string;                                    // Unique identifier
  type: 'success' | 'error' | 'warning' | 'info';    // Toast type
  title: string;                                 // Toast title
  message: string;                               // Toast message
  duration?: number;                              // Auto-dismiss timeout (ms)
  persistent?: boolean;                            // Persistent until manually dismissed
  action?: {                                     // Optional action button
    label: string;
    handler: () => void;
  };
  timestamp: number;                              // Creation timestamp
}
```

#### Usage
```typescript
function StatusComponent() {
  const { showSuccess, showError, showWarning } = useToastManager();

  const handleSuccess = () => {
    showSuccess('Operation Complete', 'Content processed successfully');
  };

  const handleError = () => {
    showError('Processing Failed', 'Unable to process content. Please try again.');
  };

  const handleWarning = () => {
    showWarning('Credit Warning', 'You have 5 credits remaining');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
    </div>
  );
}
```

### useErrorHandler

**Purpose**: Global error boundary with automatic error reporting and recovery mechanisms.

#### Returns
```typescript
interface ErrorHandlerState {
  hasError: boolean;                    // Error state
  error: Error | null;                  // Current error
  errorInfo: ErrorInfo | null;            // Detailed error context
  recoveryAttempts: number;               // Recovery attempt count
  lastErrorTime: number;                 // Last error timestamp
}

interface ErrorHandlerActions {
  handleError: (error: Error, errorInfo?: ErrorInfo) => void;  // Handle new error
  attemptRecovery: () => Promise<boolean>;                      // Attempt error recovery
  clearError: () => void;                                      // Clear current error
  reportError: (error: Error, context?: string) => Promise<void>;  // Report error
  getErrorHistory: () => ErrorRecord[];                       // Get error history
}
```

#### Error Information
```typescript
interface ErrorInfo {
  component: string;           // Component where error occurred
  operation: string;          // Operation being performed
  context: any;              // Additional context data
  userAgent: string;          // Browser information
  timestamp: string;          // Error timestamp
  stackTrace: string;         // Error stack trace
  recoverable: boolean;        // Whether error is recoverable
}

interface ErrorRecord {
  id: string;                // Unique error ID
  error: Error;              // Error object
  info: ErrorInfo;            // Error context
  recovered: boolean;          // Recovery status
  resolution?: string;         // Recovery resolution
}
```

#### Usage
```typescript
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { hasError, error, handleError, attemptRecovery } = useErrorHandler();

  useEffect(() => {
    if (hasError && error) {
      const recover = async () => {
        const recovered = await attemptRecovery();
        if (recovered) {
          console.log('Error recovered successfully');
        }
      };
      recover();
    }
  }, [hasError, error]);

  if (hasError) {
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

### useByokManager

**Purpose**: Manages Bring Your Own Key (BYOK) configuration and API integration.

#### Returns
```typescript
interface ByokState {
  hasApiKey: boolean;                                     // API key availability
  config: BYOKConfig | null;                             // Current configuration
  isValid: boolean;                                       // Configuration validity
  providers: ProviderInfo[];                               // Available providers
  loading: boolean;                                       // Loading state
  error: string | null;                                     // Error message
  lastValidation: ValidationResult | null;                 // Last validation result
}

interface ByokActions {
  configureBYOK: (config: BYOKConfig) => Promise<void>;   // Configure BYOK
  removeBYOK: () => Promise<void>;                          // Remove BYOK
  validateKey: (apiKey: string, provider: string) => Promise<ValidationResult>;  // Validate API key
  testConnection: () => Promise<boolean>;                    // Test API connection
  refreshProviders: () => Promise<void>;                    // Refresh provider list
}
```

#### Provider Information
```typescript
interface ProviderInfo {
  id: string;                    // Provider identifier
  name: string;                  // Display name
  baseUrl: string;               // API base URL
  models: ModelInfo[];            // Available models
  features: string[];              // Supported features
  documentation: string;           // Documentation URL
  pricing: PricingInfo;           // Pricing information
}

interface ModelInfo {
  id: string;                    // Model identifier
  name: string;                  // Display name
  description: string;           // Model description
  maxTokens: number;             // Maximum tokens
  cost: number;                  // Cost per request
  capabilities: string[];        // Model capabilities
}
```

#### Usage
```typescript
function ByokSettings() {
  const {
    hasApiKey,
    config,
    providers,
    configureBYOK,
    removeBYOK,
    testConnection
  } = useByokManager();

  const handleProviderChange = async (provider: string) => {
    await configureBYOK({
      ...config!,
      provider: provider as any,
      apiKey: '',
    });
  };

  return (
    <div>
      <select onChange={(e) => handleProviderChange(e.target.value)}>
        {providers.map(provider => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
      {config?.apiKey && (
        <button onClick={testConnection}>Test Connection</button>
      )}
      {hasApiKey && (
        <button onClick={removeBYOK}>Remove API Key</button>
      )}
    </div>
  );
}
```

---

## Component Patterns

### Error Boundaries

All components implement comprehensive error boundaries:

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  retry?: () => void;
}
```

### Accessibility Features

- **ARIA Labels**: All interactive elements have proper labels
- **Keyboard Navigation**: Full keyboard support for all features
- **Screen Reader Support**: Semantic HTML with proper roles
- **Focus Management**: Logical tab order and focus trapping
- **Color Contrast**: WCAG AA compliant color schemes

### Performance Optimizations

- **Lazy Loading**: Heavy components load on demand
- **Memoization**: Expensive computations cached
- **Virtual Scrolling**: Large lists use virtualization
- **Debounced Updates**: User inputs are debounced
- **Animation Performance**: CSS-based animations over JavaScript

### Responsive Design

- **Mobile First**: Design starts with mobile layout
- **Breakpoints**: Consistent breakpoint system (sm, md, lg, xl)
- **Touch Targets**: Minimum 44px touch targets
- **Flexible Layouts**: Grid and flexbox for adaptive layouts
- **Viewport Meta**: Proper viewport configuration

---

## State Management Patterns

### Immutable Updates

All state updates use immutable patterns:

```typescript
// Good: immutable update
const newState = { ...prevState, newValue: updatedValue };

// Bad: direct mutation
prevState.newValue = updatedValue;
```

### Action Dispatching

Consistent action patterns for state updates:

```typescript
// Standard action structure
interface StateAction {
  type: string;
  payload: any;
  error?: string;
  timestamp: number;
}

// Example usage
dispatch({
  type: 'SET_PROCESSING_MODE',
  payload: { mode: 'ai' },
  timestamp: Date.now()
});
```

### Persistence Strategy

Layered persistence approach:

```typescript
// Session Storage (temporary)
sessionStorage.setItem('currentExport', JSON.stringify(exportData));

// Local Storage (persistent)
localStorage.setItem('userPreferences', JSON.stringify(settings));

// Chrome Storage API (extension)
chrome.storage.local.set({ settings: userSettings });
```

---

## Testing Strategy

### Component Testing

Unit tests for all components:

```typescript
describe('PrimaryButton', () => {
  it('renders with correct props', () => {
    render(<PrimaryButton>Test</PrimaryButton>);
    expect(screen.getByRole('button')).toHaveTextContent('Test');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<PrimaryButton onClick={handleClick}>Test</PrimaryButton>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<PrimaryButton loading>Test</PrimaryButton>);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

### Hook Testing

Custom hooks tested with renderHook:

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useToastManager', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useToastManager());

    expect(result.current.toasts).toEqual([]);
    expect(result.current.queue).toEqual([]);
  });

  it('shows success toast', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showSuccess('Test', 'Success message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
  });
});
```

### Integration Testing

Full workflow testing:

```typescript
describe('Content Processing Flow', () => {
  it('processes content end-to-end', async () => {
    const mockContent = '<html><body>Test content</body></html>';

    // Mock background script
    jest.spyOn(browser.runtime, 'sendMessage')
      .mockResolvedValue({ success: true, data: { markdown: '# Test' } });

    const { result } = renderHook(() => usePopupController());

    await act(async () => {
      await result.current.startProcessing({ content: mockContent });
    });

    expect(result.current.result?.markdown).toBe('# Test');
  });
});
```

---

*This component library documentation covers all React components, custom hooks, and patterns used in the PromptReady extension. For implementation details, refer to the component source code and inline documentation.*