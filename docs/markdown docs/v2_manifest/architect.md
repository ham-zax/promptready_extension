
# MarkDownload Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the **MarkDownload** browser extension codebase, including technical patterns, browser compatibility constraints, and real-world implementation details. It serves as a reference for AI agents working on enhancements.

### Document Scope
Comprehensive documentation of the entire browser extension system - architecture, content processing pipeline, browser APIs, and integration patterns.

### Change Log

| Date   | Version | Description                 | Author    |
| ------ | ------- | --------------------------- | --------- |
| [Date] | 1.0     | Initial brownfield analysis | Winston (Architect) |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Extension Manifest**: `src/manifest.json` (Extension metadata, permissions, entry points)
- **Background Script**: `src/background/background.js` (Core markdown conversion engine)
- **Content Script**: `src/contentScript/contentScript.js` (Web page interaction & DOM extraction)
- **Popup Interface**: `src/popup/popup.js` (User interface for web clipper)
- **Options Page**: `src/options/options.js` (Extension configuration)
- **Default Config**: `src/shared/default-options.js` (All default extension settings)
- **Context Menus**: `src/shared/context-menus.js` (Right-click menu setup)

### Enhancement Impact Areas
Any changes to conversion logic, browser compatibility, or new features would primarily affect:
- `background/background.js` (core processing engine)
- `manifest.json` (permissions and browser compatibility)
- `popup/popup.js` (user interface)

## High Level Architecture

### Technical Summary

MarkDownload is a **cross-browser extension** (Chrome, Firefox, Edge, Safari) that converts web content to markdown files using Mozilla's Readability.js for content extraction and Turndown.js for HTML-to-Markdown conversion.

### Actual Tech Stack

| Category  | Technology | Version | Notes                      |
| --------- | ---------- | ------- | -------------------------- |
| Extension API | WebExtensions | V2 | Manifest V2, cross-browser compatibility |
| Content Processing | Readability.js | 0.5.0 | Mozilla's reader view engine |
| HTML → Markdown | Turndown | 7.1.3 | Core conversion with GFM plugin |
| Date Formatting | Moment.js | 2.29.4 | Template variable dates |
| Code Editor | CodeMirror | 5.x | Popup markdown editor |
| Polyfills | webextension-polyfill | - | Cross-browser API compatibility |

### Repository Structure Reality Check

- **Type**: Single repository, browser extension
- **Package Manager**: npm
- **Build Tool**: web-ext (Mozilla's extension development tool)
- **Notable**: Safari version requires Xcode project (see xcode/ folder)

## Source Tree and Module Organization

### Project Structure (Actual)

```text
markdownload/
├── src/
│   ├── background/              # Background script + processing libraries
│   │   ├── background.js        # CORE: Main conversion engine
│   │   ├── Readability.js       # Mozilla's content extraction
│   │   ├── turndown.js          # HTML → Markdown converter  
│   │   ├── turndown-plugin-gfm.js # GitHub Flavored Markdown
│   │   ├── moment.min.js        # Date formatting for templates
│   │   └── apache-mime-types.js # File type detection for images
│   ├── contentScript/           # Injected into web pages
│   │   ├── contentScript.js     # DOM extraction, clipboard ops
│   │   └── pageContext.js       # MathJax/LaTeX support  
│   ├── popup/                   # Extension popup UI
│   │   ├── popup.html/.css/.js  # Interface for web clipper
│   │   └── lib/                 # CodeMirror editor + themes
│   ├── options/                 # Extension settings page
│   │   ├── options.html/.css/.js # Comprehensive configuration UI
│   ├── shared/                  # Common utilities
│   │   ├── context-menus.js     # Right-click menu system
│   │   └── default-options.js   # All extension defaults
│   ├── icons/                   # Extension icons (various sizes)
│   ├── browser-polyfill.min.js  # Cross-browser API compatibility
│   └── manifest.json            # Extension metadata + permissions
├── media/                       # Store screenshots & promotional materials
├── README.md                    # Public documentation
├── user-guide.md               # Detailed usage instructions  
├── CHANGELOG.md                 # Version history
└── PRIVACY.md                   # Privacy policy
```

### Key Modules and Their Purpose

- **Background Script**: `src/background/background.js` - The heart of the extension. Handles ALL content processing, conversion, downloads, and browser API interactions
- **Content Scripts**: `src/contentScript/contentScript.js` - Runs in web pages to extract DOM content and handle clipboard operations
- **Popup Interface**: `src/popup/popup.js` - Provides interactive editor for markdown before download
- **Options System**: `src/options/options.js` - Comprehensive settings management with live preview
- **Context Menus**: `src/shared/context-menus.js` - Manages right-click menu options across different contexts

## Data Models and APIs

### Data Models

**Article Object** (Core data structure created by Readability.js):
```javascript
{
  title: string,          // Extracted article title  
  content: string,        // Cleaned HTML content
  byline: string,         // Author information
  excerpt: string,        // Article summary
  baseURI: string,        // Original page URL
  pageTitle: string,      // Page <title> tag
  keywords: array,        // Meta keywords
  // URL components
  hostname, pathname, protocol, search, hash
  // Custom metadata from meta tags
}
```

**Options Object** (Extension configuration):
```javascript
{
  // Templates
  frontmatter: string,     // YAML frontmatter template
  backmatter: string,      // Footer template  
  title: string,           // Filename template
  
  // Conversion settings
  headingStyle: 'atx'|'setext',
  bulletListMarker: '-'|'*'|'+',
  codeBlockStyle: 'fenced'|'indented',
  
  // Download settings
  downloadMode: 'downloadsApi'|'contentLink',
  downloadImages: boolean,
  imagePrefix: string,
  
  // Integration
  obsidianIntegration: boolean,
  obsidianVault: string,
  obsidianFolder: string
}
```

### API Specifications

**Browser Extension APIs Used**:
- `browser.runtime` - Message passing, platform info
- `browser.tabs` - Tab interaction, content script injection
- `browser.downloads` - File downloads (when supported)
- `browser.storage.sync` - Settings persistence
- `browser.contextMenus` - Right-click menus
- `browser.commands` - Keyboard shortcuts

**Internal Message API**:
```javascript
// Content → Background
{ type: "clip", dom: string, selection?: string }

// Background → Popup  
{ type: "display.md", markdown: string, article: object, imageList: object }

// Popup → Background
{ type: "download", markdown: string, title: string, tab: object }
```

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Manifest V2**: Still using deprecated extension manifest format - V3 migration needed for long-term Chrome support
2. **Safari Compatibility**: Requires separate Xcode project and paid developer account due to Apple's restrictions
3. **Image Download Limitations**: Only works with Downloads API mode, blocked by CORS in many cases
4. **Mixed Async Patterns**: Combination of callbacks, promises, and async/await throughout codebase

### Workarounds and Gotchas

- **Downloads API Detection**: Must check `browser.downloads` availability (missing in Safari) before using
- **Content Script Injection**: Requires checking if already injected to avoid multiple executions
- **CORS Limitations**: Image downloading fails on many sites due to cross-origin restrictions
- **Context Menu Browser Differences**: Chrome doesn't support "tab" context menus, requires try/catch
- **MathJax Support**: Custom page context script required to extract LaTeX from MathJax 3
- **File Extension Detection**: Uses MIME type database when images lack extensions

## Integration Points and External Dependencies

### External Services & Libraries

| Service/Library  | Purpose  | Integration Type | Key Files                      |
| ---------------- | -------- | ---------------- | ------------------------------ |
| Readability.js   | Content extraction | Embedded library | `background/Readability.js` |
| Turndown         | HTML→MD conversion | Embedded library | `background/turndown.js` |
| Moment.js        | Date formatting | Embedded library | `background/moment.min.js` |
| CodeMirror       | Text editor | Embedded library | `popup/lib/codemirror.js` |
| WebExtensions Polyfill | Browser compatibility | Polyfill | `browser-polyfill.min.js` |

### Browser Integration Points

- **Content Security Policy**: Must inject content scripts properly to avoid CSP violations
- **Download Permissions**: Requires `downloads` permission for file saving
- **Active Tab Permission**: Needed to access current page content
- **Storage Permission**: For settings persistence across devices
- **Context Menu Permission**: For right-click functionality

### External App Integrations

- **Obsidian**: Via Advanced URI plugin for direct note creation
- **File System**: Downloads folder via browser Downloads API
- **Clipboard**: For copy-to-clipboard functionality

## Development and Deployment

### Local Development Setup

1. **Prerequisites**: Node.js, npm
2. **Install dependencies**: `npm run npminstall` (installs web-ext)
3. **Development servers available**:
   ```bash
   npm run start:firefoxdeveloper    # Firefox Developer Edition
   npm run start:chromedevwin        # Chrome Dev on Windows
   npm run start:waveboxwin          # Wavebox browser
   npm run start:androidwin11        # Firefox Android (via ADB)
   ```

### Build and Deployment Process

- **Build Command**: `npm run build` (uses web-ext)
- **Deployment**: Manual upload to browser extension stores
- **Browsers Supported**: 
  - Chrome Web Store
  - Firefox Add-ons
  - Microsoft Edge Add-ons
  - Safari App Store (separate Xcode build)

### Browser-Specific Considerations

- **Chrome**: Standard WebExtensions, Downloads API supported
- **Firefox**: Native WebExtensions support, all features available
- **Edge**: Chrome-compatible, full feature support
- **Safari**: Limited API support, requires contentLink download mode, separate Xcode project

## Testing Reality

### Current Test Coverage
- **Unit Tests**: None (manual testing only)
- **Integration Tests**: None
- **E2E Tests**: None  
- **Manual Testing**: Primary QA method across multiple browsers
- **User Testing**: Community feedback via GitHub issues

### Quality Assurance Process
1. Manual testing across 4 browsers (Chrome, Firefox, Edge, Safari)
2. Test on various website types (news, blogs, documentation)
3. Community beta testing via GitHub releases
4. Issue tracking and bug reports via GitHub

## Technical Patterns and Architecture Decisions

### Content Processing Pipeline

1. **Content Extraction**: User clicks extension → Content script extracts DOM → Background script processes with Readability.js
2. **Markdown Conversion**: Cleaned HTML → Turndown.js → Custom rules for images, links, code blocks
3. **Template Processing**: Apply frontmatter/backmatter templates with variable substitution
4. **File Generation**: Create download or clipboard content

### Browser API Abstraction

- Uses `webextension-polyfill` for cross-browser compatibility
- Graceful degradation when APIs unavailable (e.g., Downloads API in Safari)
- Feature detection patterns throughout codebase

### State Management

- Extension options stored in `browser.storage.sync` (syncs across devices)
- Runtime state managed in background script global variables
- UI state managed locally in popup/options pages

### Error Handling Patterns

- Try/catch blocks around browser API calls
- Fallback modes for unsupported features
- User-friendly error messages in popup interface
- Console logging for debugging

## Extension Permissions and Security

### Required Permissions

```javascript
"permissions": [
  "<all_urls>",        // Access any website for content extraction
  "activeTab",         // Current tab access
  "downloads",         // File downloads
  "storage",           // Settings storage  
  "contextMenus",      // Right-click menus
  "clipboardWrite"     // Copy to clipboard
]
```

### Security Considerations

- **Content Script Injection**: Only when user explicitly triggers extension
- **DOM Access**: Read-only access for content extraction
- **File Downloads**: Uses browser's native download system
- **No External Network Requests**: All processing happens locally
- **No User Data Collection**: Privacy-focused design

## Performance Characteristics

### Content Processing Performance
- **Readability Processing**: ~100-500ms depending on page complexity
- **Markdown Conversion**: ~50-200ms for typical articles
- **Image Processing**: Variable (depends on image sizes and quantity)
- **Memory Usage**: Moderate (DOM parsing + content processing)

### Optimization Patterns
- **Lazy Loading**: Content scripts only injected when needed
- **Blob URLs**: Used for efficient image downloads
- **DOM Cleanup**: Removes hidden/irrelevant elements before processing

## Appendix - Useful Commands and Scripts

### Development Commands

```bash
npm run npminstall           # Install dependencies
npm run build                # Build extension package
npm run start:firefoxdeveloper  # Test in Firefox
npm run start:chromedevwin   # Test in Chrome
```

### Browser Extension Loading
- **Chrome**: Load unpacked extension from `src/` folder
- **Firefox**: Use web-ext run or load temporary add-on
- **Edge**: Similar to Chrome
- **Safari**: Requires Xcode project build

### Debugging and Troubleshooting

- **Background Script**: Chrome DevTools → Extensions → Background Page
- **Content Script**: Page DevTools → Console (filter by extension)
- **Popup**: Right-click popup → Inspect
- **Permissions**: Check `manifest.json` vs browser extension page
- **Common Issues**: CORS failures, CSP violations, API unavailability

---
