# Development Setup and Deployment Guide

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Git**: For version control and collaboration
- **Chrome**: Version 88.0+ for Manifest V3 support
- **VS Code**: Recommended IDE with extensions

### Required Software

**Core Development Tools**
```bash
# Verify Node.js installation
node --version  # Should show v18.0.0+

# Verify npm installation
npm --version   # Should show 8.0.0+

# Verify Git installation
git --version   # Should show 2.30+
```

**Recommended VS Code Extensions**
- **ESLint**: For code quality and consistency
- **Prettier**: For code formatting
- **TypeScript**: For type checking and IntelliSense
- **Thunder Client**: For REST API testing
- **Auto Rename Tag**: For efficient refactoring
- **GitLens**: For enhanced Git capabilities

---

## Local Development

### Repository Setup

```bash
# Clone the repository
git clone https://github.com/ham-zax/promptready_extension.git
cd promptready_extension

# Install all dependencies
npm install

# Verify installation
npm run test:setup   # Runs basic setup verification
```

### Development Scripts

```json
{
  "scripts": {
    "dev": "wxt",                          // Development with hot reload
    "dev:firefox": "wxt -b firefox",       // Firefox development
    "compile": "tsc --noEmit",           // Type checking only
    "build": "wxt build",                 // Production build
    "build:firefox": "wxt build -b firefox",  // Firefox production build
    "zip": "wxt zip",                     // Chrome distribution package
    "zip:firefox": "wxt zip -b firefox",   // Firefox distribution package
    "test": "vitest run",                 // Run unit tests
    "test:ui": "vitest",                 // Run tests with UI
    "test:setup": "vitest run --run",       // Setup verification tests
    "lint": "npx eslint . --ext .ts,.tsx",  // Code quality check
    "lint:fix": "npx eslint . --ext .ts,.tsx --fix",  // Auto-fix linting issues
    "format": "npx prettier --write . --ignore-path .git",  // Format code
    "format:check": "npx prettier --check . --ignore-path .git"   // Check formatting
  }
}
```

### Development Workflow

#### Starting Development
```bash
# Start Chrome development with hot reload
npm run dev

# Start Firefox development (if needed)
npm run dev:firefox
```

**Development Features:**
- **Hot Reload**: Changes automatically reload the extension
- **Type Checking**: Real-time TypeScript validation
- **Console Logging**: Enhanced logging for debugging
- **Source Maps**: Available in browser dev tools

#### File Watching
The development server watches for changes in:
- `entrypoints/**/*` - Extension entry points
- `core/**/*` - Core processing logic
- `components/**/*` - Reusable React components
- `lib/**/*` - Shared utilities and types
- `assets/**/*` - Static assets

---

## Project Structure

### Directory Layout
```
promptready_extension/
├── .github/                     # GitHub Actions workflows
│   ├── workflows/              # CI/CD pipeline definitions
│   └── ISSUE_TEMPLATE/        # Issue reporting templates
├── .husky/                      # Git hooks configuration
│   ├── pre-commit             # Pre-commit hook script
│   └── prepare               # Git hooks setup
├── .vscode/                     # VS Code workspace settings
│   ├── settings.json          # Workspace configuration
│   ├── extensions.json        # Recommended extensions
│   └── launch.json           # Debug configurations
├── docs/                        # Documentation
│   ├── API_REFERENCE.md       # Complete API documentation
│   ├── COMPLETE_DOCUMENTATION.md # Comprehensive documentation
│   ├── REACT_COMPONENTS.md   # Component library docs
│   ├── USER_GUIDE.md          # User guide
│   └── DEVELOPMENT.md         # This file
├── entrypoints/                   # Extension entry points
│   ├── background.ts         # Service worker (main orchestrator)
│   ├── content.ts            # Content script (DOM interaction)
│   ├── offscreen/            # Offscreen document processing
│   │   ├── index.html        # Offscreen HTML template
│   │   └── enhanced-processor.ts # Advanced processing logic
│   ├── popup/                # React-based popup UI
│   │   ├── components/       # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── main.tsx         # Popup entry component
│   │   └── style.css         # Popup styling
│   └── options/              # Extension options page
├── core/                        # Core processing engines
│   ├── filters/              # Content filtering utilities
│   ├── scoring/              # Content quality scoring
│   ├── content-quality-validator.ts # Content validation
│   ├── error-handler.ts       # Error management
│   ├── offline-mode-manager.ts      # Main processing orchestrator
│   ├── performance-metrics.ts       # Performance monitoring
│   ├── post-processor.ts           # Content enhancement
│   ├── readability-config.ts          # Mozilla Readability config
│   └── turndown-config.ts           # HTML-to-Markdown conversion
├── components/                  # Reusable UI components
├── functions/                    # Cloudflare Workers
│   ├── credit-service/       # Credit management service
│   ├── ai-proxy/            # AI processing proxy
│   └── circuit-breaker/     # Budget protection service
├── lib/                        # Shared utilities and types
├── assets/                     # Static assets (icons, images)
├── test/                       # Test suites and fixtures
├── tests/                      # Additional test files
└── public/                     # Public assets
```

### Key Configuration Files

#### `package.json`
```json
{
  "name": "promptready-extension",
  "version": "1.0.0",
  "type": "module",
  "scripts": { /* Development scripts */ },
  "dependencies": {
    "@joplin/turndown": "^4.0.80",
    "@mozilla/readability": "^0.4.1",
    "@radix-ui/react-*": "^1.1.14",
    "react": "^19.1.0",
    "tailwindcss": "^4.1.11"
  },
  "devDependencies": {
    "@wxt-dev/module-react": "^1.1.3",
    "eslint": "^9.39.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4",
    "wxt": "^0.20.6"
  }
}
```

#### `wxt.config.ts`
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PromptReady',
    description: 'AI-powered Chrome extension that instantly cleans and structures webpage content into prompt-ready formats',
    permissions: [
      'storage',
      'activeTab',
      'clipboardWrite',
      'scripting',
      'offscreen'
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'assets/icon-16.png',
        '48': 'assets/icon-48.png',
        '128': 'assets/icon-128.png'
      }
    },
    commands: {
      'capture-selection': {
        suggested_key: {
          default: 'Ctrl+Shift+P',
          mac: 'Command+Shift+P'
        },
        description: 'Capture and clean webpage content'
      }
    }
  },
  vite: () => ({
    build: {
      target: 'chrome',
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        external: ['chrome', 'browser']
      }
    }
  })
});
```

---

## Testing Strategy

### Unit Testing

#### Test Framework Setup
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom

# Run unit tests
npm test

# Run tests in watch mode
npm test --watch

# Run tests with coverage
npm test --coverage
```

#### Test Structure
```
test/
├── unit/                     # Unit tests for individual functions
│   ├── core/              # Core logic tests
│   ├── components/        # React component tests
│   ├── hooks/             # Custom hook tests
│   └── lib/               # Utility function tests
├── integration/              # Integration tests for workflows
├── e2e/                   # End-to-end tests
└── fixtures/               # Test data and mocks
```

#### Component Testing Example
```typescript
// test/unit/components/PrimaryButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PrimaryButton } from '@/entrypoints/popup/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('renders with correct content', () => {
    render(<PrimaryButton>Test Button</PrimaryButton>);
    expect(screen.getByRole('button')).toHaveTextContent('Test Button');
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

  it('is accessible', () => {
    render(<PrimaryButton disabled>Disabled</PrimaryButton>);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('tabIndex', '-1');
  });
});
```

#### Hook Testing Example
```typescript
// test/unit/hooks/useProManager.test.ts
import { renderHook, act } from '@testing-library/react';
import { useProManager } from '@/entrypoints/popup/hooks/useProManager';

describe('useProManager', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useProManager());

    expect(result.current.credits).toBe(0);
    expect(result.current.isPro).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it('handles credit updates', async () => {
    const { result } = renderHook(() => useProManager());

    await act(async () => {
      result.current.checkCredits();
    });

    expect(result.current.loading).toBe(false);
  });
});
```

### Integration Testing

#### Extension Context Testing
```typescript
// test/integration/extension-workflow.test.ts
import { chromium } from 'playwright/test';
import { build } from 'wxt';

describe('Extension Workflow', () => {
  let browser;
  let extensionId;

  beforeAll(async () => {
    // Build extension for testing
    await build({ mode: 'development' });

    // Launch browser with extension
    browser = await chromium.launch();
    const context = await browser.newContext();

    // Load extension
    const extensionPath = './dist';
    await context.addInitScript({
      content: `chrome.runtime.onInstalled.addListener(() => {
        window.extensionId = chrome.runtime.id;
      });`
    });

    const page = await context.newPage();
    await page.goto('chrome://extensions/');
    // Extension loading and setup logic
  });

  it('processes content end-to-end', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com/article');

    // Test content capture
    await page.click('[data-testid="capture-button"]');

    // Wait for processing completion
    await page.waitForSelector('[data-testid="processing-complete"]');

    // Verify processed content
    const processedContent = await page.locator('[data-testid="processed-content"]').textContent();
    expect(processedContent).toContain('# Processed Content');
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

---

## Code Quality

### ESLint Configuration

#### `.eslintrc.json`
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react/prop-types": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-console": "warn"
  },
  "env": {
    "browser": true,
    "webextensions": true
  }
}
```

#### Type Checking

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "declaration": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"]
    }
  },
  "include": [
    "entrypoints/**/*",
    "core/**/*",
    "components/**/*",
    "lib/**/*",
    "test/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ]
}
```

### Prettier Configuration

#### `.prettierrc`
```json
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "bracketSameLine": false,
  "jsxSingleQuote": false,
  "proseWrap": "preserve"
}
```

---

## Build Process

### Development Build

```bash
# Start development with hot reload
npm run dev

# Development build features:
# - Fast rebuild times
# - Source maps for debugging
# - Hot module replacement
# - Detailed error reporting
```

### Production Build

```bash
# Build for Chrome Web Store
npm run build

# Build for Firefox Add-ons
npm run build:firefox

# Build outputs:
# - dist/manifest.json - Extension manifest
# - dist/entrypoints/ - Built entry points
# - dist/assets/ - Optimized assets
# - Source maps for production debugging
```

### Build Optimization

#### Vite Configuration
```typescript
// vite.config.ts (if needed for custom config)
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          core: ['@mozilla/readability', '@joplin/turndown']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});
```

---

## Deployment

### Chrome Web Store Deployment

#### Preparation Steps
```bash
# 1. Clean previous builds
rm -rf dist/

# 2. Production build
npm run build

# 3. Validate build
npm run lint
npm test

# 4. Create distribution package
npm run zip

# 5. Review package contents
unzip -l dist.zip
```

#### Store Listing Requirements

**Package Information**
```json
{
  "name": "PromptReady",
  "description": "AI-powered Chrome extension that instantly cleans and structures webpage content into prompt-ready formats",
  "category": "Productivity",
  "languages": ["en"],
  "version": "1.0.0",
  "permissions": [
    "storage",
    "activeTab",
    "clipboardWrite",
    "scripting",
    "offscreen"
  ],
  "host_permissions": ["<all_urls>"]
}
```

**Screenshots Required**
- **128x128**: Extension icon and popup interface
- **640x400**: Main extension interface
- **1280x800**: Full extension workflow demonstration
- **Additional**: Feature-specific screenshots

#### Privacy Policy Requirements
```markdown
# Privacy Policy for PromptReady Extension

## Data Collection
- No personal data is collected or stored
- All processing happens locally on user's device
- API keys are stored locally and encrypted
- No analytics or telemetry data is transmitted

## Data Usage
- Content is processed locally unless AI mode is explicitly chosen
- API requests only made when user configures BYOK
- No content is stored on external servers
- Temporary processing data is cleared after session

## Data Security
- API keys encrypted with browser's secure storage API
- HTTPS required for all API communications
- No data sharing with third parties
- User has full control over all data
```

### Firefox Add-ons Deployment

#### Firefox-Specific Build
```bash
# Build for Firefox
npm run build:firefox

# Firefox build differences:
# - Slightly different manifest permissions
# - Firefox-specific API adaptations
# - Different packaging requirements
```

#### AMO (addons.mozilla.org) Submission

**Package Requirements**
```json
{
  "name": "PromptReady",
  "description": "AI-powered content cleaning extension for Firefox",
  "version": "1.0.0",
  "applications": {
    "gecko": {
      "id": "your-extension-id@yourdomain.com",
      "strict_min_version": "109.0"
    }
  },
  "permissions": [
    "storage",
    "activeTab",
    "clipboardWrite",
    "scripting",
    "<all_urls>"
  ]
}
```

---

## Cloudflare Workers Deployment

### Service Architecture

#### Credit Service Deployment
```bash
cd functions/credit-service
wrangler deploy

# Environment variables required:
# AI_API_KEY: Groq API key for trial processing
# SERVICE_SECRET: Internal service authentication
# CREDITS_KV: KV namespace for user credits
# KV_NAMESPACE: Unique identifier for credit storage
```

#### AI Proxy Deployment
```bash
cd ../ai-proxy
wrangler deploy

# Environment variables:
# AI_API_KEY: Primary AI service API key
# SERVICE_SECRET: Service-to-service authentication
# CIRCUIT_BREAKER_URL: Circuit breaker service endpoint
# RATE_LIMIT_KV: KV namespace for rate limiting
```

#### Circuit Breaker Deployment
```bash
cd ../circuit-breaker
wrangler deploy

# Environment variables:
# SERVICE_SECRET: Authentication secret
# BUDGET_KV: KV namespace for global budget
# ALERT_EMAIL: Email for budget alerts
# MONITORING_WEBHOOK: Webhook for system alerts
```

### Production Configuration

#### `wrangler.toml` Files
```toml
# credit-service/wrangler.toml
name = "promptready-credit-service"
main = "src/index.js"
compatibility_date = "2023-05-18"

[env.production]
vars = { ENVIRONMENT = "production" }

kv_namespaces = [
  { binding = "CREDITS", id = "credits_kv" }
]

[env.production.vars]
ENVIRONMENT = "production"
```

#### Deployment Script
```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "Starting PromptReady deployment..."

# Build extension
echo "Building extension..."
npm run build

# Deploy Cloudflare Workers
echo "Deploying Cloudflare Workers..."
cd functions/credit-service && wrangler deploy --env production
cd ../ai-proxy && wrangler deploy --env production
cd ../circuit-breaker && wrangler deploy --env production

# Create distribution packages
echo "Creating distribution packages..."
npm run zip
npm run zip:firefox

echo "Deployment completed successfully!"
echo "Chrome package: dist.zip"
echo "Firefox package: dist-firefox.zip"
```

---

## Continuous Integration

### GitHub Actions Workflow

#### `.github/workflows/ci.yml`
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Type checking
        run: npm run compile

      - name: Build extension
        run: npm run build

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install and build
        run: |
          npm ci
          npm run build

      - name: Deploy Workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          cd functions/credit-service && wrangler deploy
          cd ../ai-proxy && wrangler deploy
          cd ../circuit-breaker && wrangler deploy

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: extension-build
          path: dist/
```

### Quality Gates

#### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
echo "Running pre-commit checks..."

# Lint code
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

# Type check
npm run compile
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed"
  exit 1
fi

echo "✅ All checks passed"
```

---

## Debugging

### Development Debugging

#### Chrome DevTools Integration
```typescript
// In background.ts or content.ts
console.log('[PromptReady Debug]', {
  message: 'Debug information',
  data: debugData,
  timestamp: new Date().toISOString(),
  stackTrace: new Error().stack
});

// Enable verbose logging
const DEBUG_MODE = true;
if (DEBUG_MODE) {
  console.log('Verbose debug information');
}
```

#### Extension Reloading
```bash
# During development, reload extension
# Chrome: Go to chrome://extensions/ and click reload button
# Firefox: Go to about:debugging and reload

# Command line reload (Chrome)
npx wxt reload

# Watch mode with auto-reload
npm run dev  # Automatically reloads on changes
```

#### Performance Profiling
```typescript
// Performance monitoring in dev mode
if (process.env.NODE_ENV === 'development') {
  // Enable detailed performance tracking
  PerformanceMetrics.getInstance().setDebugMode(true);

  // Memory profiling
  setInterval(() => {
    const memory = (performance as any).memory;
    console.log('Memory usage:', {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit
    });
  }, 5000);
}
```

### Production Debugging

#### Remote Debugging
```bash
# For deployed extensions
# 1. Add debug flag to manifest
# 2. Load in Chrome with --enable-logging
# 3. Check chrome://extensions/ for developer tools

# Production debugging in Firefox
# 1. Install temporarily via about:debugging
# 2. Use Browser Toolbox
# 3. Check Web Console for detailed logs
```

---

## Performance Optimization

### Build Optimization

#### Bundle Analysis
```bash
# Analyze bundle size
npm run build

# Install bundle analyzer
npm install --save-dev @rollup/plugin-analyzer

# Generate analysis
npx wxt analyze
```

#### Optimization Strategies
- **Tree Shaking**: Remove unused code
- **Code Splitting**: Separate vendor and application code
- **Minification**: Terser optimization
- **Source Maps**: Production debugging maps
- **Asset Optimization**: Image compression and optimization

### Runtime Optimization

#### Memory Management
```typescript
// Cleanup patterns in components
useEffect(() => {
  // Setup
  return () => {
    // Cleanup function
    controller.abort();
    subscriptions.unsubscribe();
  };
}, [dependencies]);
```

#### Performance Monitoring
```typescript
// Performance measurement
const startPerformance = () => performance.now();
const measurePerformance = (operation: string) => {
  const duration = performance.now() - startPerformance;
  console.log(`[Performance] ${operation}: ${duration}ms`);
};
```

---

*This development guide covers all aspects of setting up, developing, testing, and deploying the PromptReady extension. For specific technical implementation details, refer to the inline code documentation and API reference.*