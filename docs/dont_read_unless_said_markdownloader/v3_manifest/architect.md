

---

# MarkDownload Brownfield Architecture Document

## Introduction

This document provides a comprehensive architectural overview of the "MarkDownload" browser extension. Its purpose is to analyze the existing codebase, document its structure and patterns, and serve as a foundational blueprint for future development, maintenance, and enhancement by both human and AI developers.

### Document Scope

This document covers the entire client-side architecture of the MarkDownload browser extension, including its background processes, user interface, content scripts, and core logic. It does not cover the external browser extension stores or the deployment process to them, beyond the commands required to build the distributable package.

### Change Log

| Date       | Version | Description                 | Author    |
| :--------- | :------ | :-------------------------- | :-------- |
| 2024-05-23 | 1.0     | Initial brownfield analysis | Architect |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

-   **Manifest**: `src/manifest.json` (The core of the extension; defines permissions, scripts, and UI components.)
-   **Background Worker**: `src/background/background.js` (The main event handler that launches the extension's UI.)
-   **Side Panel UI Logic**: `src/sidepanel/sidepanel.js` (The primary controller for the user interface, event listeners, and editor.)
-   **Core Conversion Logic**: `src/common/markdownload.js` (Contains the central `parse` method that orchestrates HTML-to-Markdown conversion.)
-   **State Management**: `src/common/state-manager.js` (Manages the application's session state, including content and settings.)
-   **Content Extraction**: `src/content/page-context.js`, `src/content/grab-selection.js` (Scripts injected into web pages to prepare and extract HTML content.)

### Enhancement Impact Areas

-   `src/common/custom-turndown.js` (Any changes to the Markdown output format, like link or image handling, would require modifying the custom Turndown rules here.)
-   `src/sidepanel/sidepanel.js` (New UI features, buttons, or interactions would be added to this file.)
-   `src/common/options.js` & `src/options/options.html` (Adding new user-configurable settings would impact these files.)
-   `src/common/metadata.js` (Extracting new types of metadata from a page would require changes here.)

## High Level Architecture

### Technical Summary

MarkDownload is a **Manifest V3 browser extension** architected as an event-driven, client-side application. It operates without a backend server, relying entirely on the browser's WebExtensions API. Its core function is to convert webpage HTML into Markdown using a pipeline of third-party libraries: `Readability.js` to isolate the primary content, and `Turndown.js` to perform the conversion. The architecture is modular, with clear separation between the background service worker, the side panel UI, content scripts for page interaction, and common modules for shared logic. It is written in vanilla JavaScript (using ES Modules) and does not employ a declarative UI framework like React or Vue.

### Actual Tech Stack

| Category            | Technology         | Version    | Notes                                                                                       |
| :------------------ | :----------------- | :--------- | :------------------------------------------------------------------------------------------ |
| Language            | JavaScript         | ES Modules | Used for all extension logic.                                                               |
| Extension API       | WebExtensions      | Manifest V3| The fundamental browser API for all functionality.                                          |
| Build & Dev Tool    | `web-ext`          | ^8.7.1     | Mozilla's tool for running, testing, and packaging the extension.                           |
| HTML to Markdown    | Turndown.js        | 7.2.0      | Core library for converting HTML. Extended with GFM plugin and custom rules.                |
| Content Extraction  | Readability.js     | 0.6.0      | Mozilla's library for parsing articles and removing clutter.                                |
| Markdown Editor     | EasyMDE            | 2.20.0     | A CodeMirror-based editor used for displaying and editing the clipped Markdown in the UI.   |
| Base Styling        | simple.css         | 2.3.7      | Provides basic, clean styling for the UI elements in the side panel and options page.       |

### Repository Structure Reality Check

-   **Type**: Single application repository.
-   **Package Manager**: `npm` (inferred from `package.json`).
-   **Build Tool**: `web-ext` is used for development and packaging, not a traditional bundler like Webpack or Vite.
-   **Notable**: Core dependencies (`Readability`, `Turndown`, etc.) are not managed via `package.json` but are instead checked directly into the `src/3rd-party/` directory. This is an unconventional approach that avoids a build step but complicates dependency updates.

## Source Tree and Module Organization

### Project Structure (Actual)

```text
src/
├── 3rd-party/          # Manually included, third-party libraries.
├── background/         # Background service worker, the extension's entry point.
├── common/             # Shared core logic, classes, and utilities.
├── content/            # Content scripts injected into web pages.
├── css/                # Global and component-specific stylesheets.
├── icons/              # (Not in provided files) Extension icons.
├── options/            # HTML and JS for the extension's options page.
├── sidepanel/          # HTML and JS for the main user-facing side panel.
└── manifest.json       # The extension's manifest file.
```

### Key Modules and Their Purpose

-   **Background (`background/background.js`)**: Handles the initial browser action click event. Its sole responsibility is to check for permissions and open the side panel with the appropriate starting page (`welcome.html` or `sidepanel.html`).
-   **Side Panel UI (`sidepanel/sidepanel.js`)**: The main application controller. It initializes the UI, sets up all event listeners for the toolbar, manages the EasyMDE editor instance, and acts as the interface between the user and the `StateManager`.
-   **State Management (`common/state-manager.js`)**: A class that abstracts the `browser.storage.session` API. It holds the current state (Markdown content, title, image list) and orchestrates the complex process of grabbing page content by executing content scripts and processing the results.
-   **Markdown Conversion (`common/markdownload.js`)**: The core conversion engine. It takes raw HTML, applies Readability.js to clean it, and then uses a configured Turndown service instance to generate the final Markdown.
-   **Metadata Extraction (`common/metadata.js`)**: A class responsible for parsing the initial DOM to extract all relevant metadata (title, URL parts, meta tags, etc.) which is then used in the conversion process and for filename templating.

## Data Models and APIs

### Data Models

**Session State** (Managed by `StateManager` in `browser.storage.session`)

```javascript
{
  content: string, // The full Markdown content displayed in the editor.
  title: string,   // The title used for the downloaded file.
  imgList: Object, // A map of image URLs to their intended filenames, e.g., { "http://.../img.png": "image-1.png" }.
  meta: Object     // A map of tab IDs to their scraped metadata objects.
}
```

**User Options** (Managed by `Options` class in `browser.storage.sync`)

```javascript
{
  // Turndown options, front/back matter templates, image handling settings, etc.
  // This object structure is defined by the properties of the Options class.
}
```

### API Specifications

**Browser WebExtensions APIs Used**:

-   `browser.permissions`: To request and verify host permissions needed to read page content.
-   `browser.scripting.executeScript`: To inject content scripts into the active tab for DOM manipulation and data extraction.
-   `browser.storage`: Used for both `sync` (persistent user options) and `session` (temporary state for the side panel).
-   `browser.sidePanel` / `browser.sidebarAction`: To programmatically open and set the content of the side panel.
-   `browser.tabs`: To identify the active tab to operate on.

**Internal Function Calls**: The system is highly interconnected through class methods. A typical flow is:

```javascript
// A user click in `sidepanel.js` triggers a call to the state manager.
stateManager.grabPageContent(tabId);

// `stateManager.js` then calls a script to get the page's HTML.
browser.scripting.executeScript(...);

// The result is then passed to the core conversion logic.
Markdownload.parse(html, metadata, options);
```

## Technical Debt and Known Issues

### Critical Technical Debt

1.  **Manual Dependency Management**: Storing third-party libraries in `src/3rd-party/` instead of using a package manager makes updates tedious, prevents automated security vulnerability scanning (`npm audit`), and increases the repository size.
2.  **Lack of Automated Testing**: The complete absence of a test suite (unit, integration, or E2E) means that every change requires extensive manual regression testing. This significantly increases the risk of introducing bugs.
3.  **Global Namespace Pollution**: Libraries like `Readability.js` are loaded in a way that attaches them to the global object. The `dodgy-require.js` file is a workaround for this, indicating a fragile integration pattern.

### Workarounds and Gotchas

-   **DOM Pre-processing**: The `page-context.js` script must be run on a page *before* its HTML is extracted. It performs critical modifications, like marking hidden nodes and ensuring a `<base>` tag exists, to prevent issues with Readability.js and URL resolution.
-   **Readability is Destructive**: The `Readability.js` library modifies the DOM it processes. The code correctly handles this by passing a *clone* of the DOM to Readability, preserving the original for other operations.
-   **Permissions Flow**: The extension cannot function until the user grants broad host permissions. The logic in `background.js` and `sidepanel.js` handles redirecting the user to a `welcome.html` page to request these permissions if they are missing.

## Integration Points and External Dependencies

### External Services & Libraries

| Service/Library    | Purpose                    | Integration Type      | Key Files                                                |
| :----------------- | :------------------------- | :-------------------- | :------------------------------------------------------- |
| Readability.js     | Article Content Extraction | Manual Library Include| `src/3rd-party/Readability.js`, `src/common/markdownload.js`|
| Turndown.js        | HTML to Markdown           | Manual Library Include| `src/3rd-party/turndown...js`, `src/common/markdownload.js` |
| EasyMDE            | Markdown Editor UI         | Manual Library Include| `src/3rd-party/easymde.min.js`, `src/sidepanel/sidepanel.js`|

### Platform Integration Points

-   **Browser Side Panel**: The primary UI is integrated via the `side_panel` (Chrome) and `sidebar_action` (Firefox) keys in `manifest.json`.
-   **Browser Action**: The toolbar icon click is the main entry point, handled by `browser.action.onClicked` in `background/background.js`.
-   **Page Content**: The deepest integration is with the DOM of arbitrary web pages via content scripts, making it susceptible to changes in website structures.

### External App Integrations

-   None. The extension is self-contained.

## Development and Deployment

### Local Development Setup

1.  **Prerequisites**: Node.js and npm.
2.  **Install dependencies**: `npm install`
3.  **Run development server**: `npm run start:firefoxdeveloper` (or a similar script for other browsers)

### Build and Deployment Process

-   **Build Command**: `npm run build`
-   **Deployment**: This command creates a zip file in the `web-ext-artifacts/` directory. This zip file is then manually uploaded to the respective browser extension stores (Chrome Web Store, Mozilla Add-ons, etc.).
-   **Environments**: There are no formal environments like staging or production; development happens locally, and the build artifact is deployed directly to the stores.

## Testing Reality

### Current Test Coverage

-   **Unit Tests**: None.
-   **Integration Tests**: None.
-   **E2E Tests**: None.
-   **Manual Testing**: This is the sole method of quality assurance. The process likely involves loading the extension locally and testing its clipping functionality on a variety of websites.

### Quality Assurance Process

1.  The developer runs the extension locally using a `web-ext` command.
2.  The developer navigates to various websites to test the "Capture Page" and "Capture Selection" features.
3.  The developer manually inspects the generated Markdown in the side panel for correctness.
4.  The developer tests UI interactions and options to ensure they function as expected.
5.  Issues are tracked and fixed, and the process is repeated.

## Technical Patterns and Architecture Decisions

### Content Clipping Pipeline

The core process of the application follows a distinct, multi-stage pipeline:

1.  **Trigger**: The user clicks a capture button in the side panel UI (`sidepanel.js`).
2.  **Orchestration**: The UI controller calls the `StateManager`, which executes a content script (`page-context.js`) to prepare the page.
3.  **Extraction**: A second content script is executed to get the full page HTML or the user's selection.
4.  **Metadata Parsing**: The raw HTML is used to instantiate a `Metadata` object, which scrapes titles, URLs, and other tags.
5.  **Readability Pass**: A clone of the DOM is processed by `Readability.js` to isolate the main article content, stripping away ads, navigation, and other clutter.
6.  **Turndown Conversion**: The cleaned HTML from Readability is passed to the `Turndown.js` service, which converts it into Markdown based on a set of custom rules.
7.  **Display**: The final Markdown is set in the `StateManager` and displayed in the EasyMDE editor in the side panel.

### State Management

-   Application state is explicitly managed by the `StateManager` class. This is a custom, centralized approach. It uses `browser.storage.session` as its backing store, meaning the state is non-persistent and is cleared when the browser session ends or the side panel is closed. Persistent user settings are handled separately by the `Options` class, which uses `browser.storage.sync`.

### Error Handling Patterns

-   Error handling is primarily done using `async/await` with `try/catch` blocks. When an error occurs during a critical operation (like loading options or executing a script), it is caught and logged to the console via `console.error(err)`. There is no global error handling or reporting to an external service.

## Extension Permissions and Security

### Required Permissions

```json
"permissions": [
  "activeTab",    // To interact with the currently active tab.
  "scripting",    // To execute content scripts on pages.
  "storage",      // To save user options and session state.
  "debugger",     // For debugging purposes.
  "sidePanel"     // To use the browser's side panel feature.
],
"optional_host_permissions": [
  "*://*/*"       // To run content scripts on any website, requested at runtime.
]
```

### Security Considerations

-   **Broad Host Permissions**: The extension requires the `*://*/*` permission to function, which is a significant security consideration. The manifest correctly defines this as `optional_host_permissions`, ensuring the user must explicitly grant it at runtime, which is a best practice.
-   **Content Script Injection**: The extension injects scripts that read and manipulate the DOM of visited pages. The code is self-contained and does not appear to send page data to any external servers, as confirmed by the Privacy Policy.
-   **Third-Party Code**: The inclusion of unaudited, manually-managed third-party libraries in `src/3rd-party/` poses a potential security risk if vulnerabilities are discovered in those libraries and they are not updated.

## Performance Characteristics

### Content Clipping Performance

-   **Blocking Operations**: The entire content clipping pipeline is a synchronous, blocking process on the client-side. Clipping very large or complex web pages can lead to noticeable delays and high CPU usage.
-   **Memory Usage**: The process involves creating multiple in-memory copies of the page's DOM, which can be memory-intensive for large pages.

### Optimization Patterns

-   The application is simple enough that it does not employ common web performance optimizations like lazy loading or code splitting. Its performance is almost entirely dependent on the efficiency of the `Readability.js` and `Turndown.js` libraries and the complexity of the target webpage.

## Appendix - Useful Commands and Scripts

### Development Commands

```bash
# Install development dependencies
npm install

# Build a production-ready extension package (.zip)
npm run build

# Run the extension in Firefox Developer Edition for live testing
npm run start:firefoxdeveloper

# Run the extension in Chrome Dev on Windows for live testing
npm run start:win:chromedev
```

### Setup and Configuration

-   **Initial Setup**: After cloning the repository, run `npm install`. No other setup is required.
-   **Loading for Development**: The extension can be loaded as an "unpacked extension" by pointing the browser to the `src/` directory. The `npm run start:*` commands automate this process.

### Debugging and Troubleshooting

-   **Side Panel**: The side panel can be debugged by right-clicking inside it and selecting "Inspect". This opens the dev tools for the side panel's context.
-   **Background Worker**: The service worker can be debugged from the browser's main extensions management page (e.g., `about:debugging` in Firefox, `chrome://extensions` in Chrome).
-   **Content Scripts**: Content scripts can be debugged within the dev tools of the web page they are injected into, under the "Sources" or "Debugger" tab.
-   **Common Issues**:
    -   **Permissions Error**: Ensure host permissions have been granted via the `welcome.html` page if the extension fails to clip a page.
    -   **Content Clipping Failure**: Often due to unusual or complex DOM structures on the target website that confuse `Readability.js`.

---