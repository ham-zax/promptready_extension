
# MarkDownload Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the MarkDownload codebase, including its structure, patterns, and dependencies. It serves as a reference for AI agents working on enhancements.

### Document Scope

This is a comprehensive documentation of the entire browser extension system as provided.

### Change Log

| Date       | Version | Description                 | Author    |
| ---------- | ------- | --------------------------- | --------- |
| 2024-05-23 | 1.0     | Initial brownfield analysis | Architect |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

-   **Manifest**: `src/manifest.json` (Defines the extension's structure, permissions, and entry points)
-   **Background Service Worker**: `src/background/background.js` (Main event handler and extension entry point)
-   **Side Panel UI Logic**: `src/sidepanel/sidepanel.js` (Controls the primary user interface)
-   **Core Clipping Logic**: `src/common/markdownload.js` (Handles the conversion of HTML to Markdown)
-   **State Management**: `src/common/state-manager.js` (Manages session state for the extension)
-   **User Options**: `src/options/options.html` and `src/options/options.js` (Handles user-configurable settings)
-   **Content Scripts**: `src/content/grab-selection.js`, `src/content/page-context.js` (Scripts injected into web pages to extract content)

## High Level Architecture

### Technical Summary

The project is a **Manifest V3 browser extension** designed to "clip" web content and convert it to Markdown. Its architecture is event-driven, relying on the browser's WebExtensions API. It consists of a background service worker for core event handling, a side panel built with vanilla JavaScript and HTML for the user interface, and content scripts that are injected into active web pages to extract data. The core logic does not use a major frontend framework like React or Vue, instead opting for direct DOM manipulation and leveraging powerful third-party libraries like `Readability.js`, `Turndown.js`, and `EasyMDE` for its primary functionality.

### Actual Tech Stack (from package.json and README.md)

| Category        | Technology                                 | Version        | Notes                                                                       |
| --------------- | ------------------------------------------ | -------------- | --------------------------------------------------------------------------- |
| Language        | JavaScript                                 | ES Modules     | The primary language for all logic.                                         |
| Build Tool      | `web-ext`                                  | ^8.7.1         | Mozilla's tool for building, running, and testing WebExtensions.            |
| HTML to MD      | Turndown.js                                | 7.2.0          | Core library for converting HTML content to Markdown.                       |
| Content Parsing | Readability.js                             | 0.6.0          | Mozilla's library to extract the main readable content from a webpage.      |
| MD Editor       | EasyMDE                                    | 2.20.0         | A Markdown editor component used in the side panel UI.                      |
| Styling         | simple.css                                 | 2.3.7          | A lightweight CSS framework for basic UI styling.                           |
| Extension API   | WebExtensions API                          | Manifest V3    | The fundamental browser API for all extension functionality.                |

### Repository Structure Reality Check

-   **Type**: Single Repository (not a monorepo or polyrepo).
-   **Package Manager**: Assumed `npm` based on `package.json` format.
-   **Notable**: Third-party libraries are checked directly into the `src/3rd-party/` directory rather than being managed as `npm` dependencies, with sources tracked in `_sources.json`.

## Source Tree and Module Organization

### Project Structure (Actual)

```text
src/
├── 3rd-party/          # Manually included third-party libraries (Readability, Turndown, etc.)
├── background/         # Background service worker script
├── common/             # Shared logic and classes (core functionality)
├── content/            # Content scripts injected into web pages
├── css/                # CSS stylesheets
├── icons/              # Extension icons
├── options/            # HTML/JS for the user options page
└── sidepanel/          # HTML/JS for the main side panel UI
```

### Key Modules and Their Purpose

-   **`background/background.js`**: The extension's entry point. Handles browser action clicks and manages the side panel's state (welcome vs. main panel).
-   **`sidepanel/sidepanel.js`**: Controls the entire side panel UI. It initializes the EasyMDE editor, wires up all toolbar buttons, and communicates with the `StateManager`.
-   **`common/state-manager.js`**: Manages the application's state (current Markdown content, title, image list) using `browser.storage.session`. It orchestrates the page/selection grabbing logic.
-   **`common/markdownload.js`**: The core "engine". This class takes HTML and metadata, uses Readability and Turndown, and produces the final Markdown output.
-   **`common/custom-turndown.js`**: Contains custom rules for the Turndown service to handle specific cases like images, links, and code blocks.
-   **`content/page-context.js`**: A content script that runs on the page to prepare the DOM for analysis (e.g., ensuring a base URL, marking hidden nodes).
-   **`content/grab-selection.js`**: A content script responsible for capturing the HTML of a user's selection.

## Data Models and APIs

### Data Models

The application does not have a formal database. State is managed in two primary ways:

1.  **Session State**: Managed by `StateManager` and stored in `browser.storage.session`. This includes the current `content` (Markdown text), `title` (for filename), and `imgList`.
2.  **User Options**: Managed by `Options` class and stored in `browser.storage.sync`. This persists user settings across sessions.
3.  **`Metadata` Class**: An in-memory object created by `src/common/metadata.js` that structures all the data scraped from a webpage (title, author, content, keywords, etc.) before it's processed.

### API Specifications

The primary "API" is the browser's **WebExtensions API**. Key namespaces used are:

-   `browser.permissions`: To request and check permissions for accessing all sites.
-   `browser.action`: To handle clicks on the extension's toolbar icon.
-   `browser.sidebarAction` / `browser.sidePanel`: To control the side panel UI.
-   `browser.scripting`: To execute content scripts (`grab-selection.js`, `page-context.js`) on the active tab.
-   `browser.storage`: For saving user options and session state.
-   `browser.tabs`: To query for the active tab.

## Technical Debt and Known Issues

1.  **Manual Dependency Management**: Third-party libraries are stored directly in the repository. This makes updates difficult and bypasses standard package management and security scanning (e.g., `npm audit`).
2.  **Lack of Automated Testing**: The codebase contains no `tests/` directory and no testing dependencies or scripts in `package.json`. Testing appears to be entirely manual.
3.  **"Dodgy Require"**: The file `src/common/dodgy-require.js` exists to load a non-module script (`Readability.js`) as if it were a module. This is a workaround that indicates a dependency integration issue.
4.  **TODOs in Code**: Several `// todo:` comments exist in the code, indicating incomplete functionality, such as in `src/sidepanel/sidepanel.js` for download functionality and a potential highlighting popup.

## Integration Points and External Dependencies

-   **External Dependencies**: The primary external dependency is the **web page** being clipped. The extension is tightly coupled to the structure and content of arbitrary web pages.
-   **Internal Integration Points**:
    -   **Background <> Side Panel**: The background script opens the side panel in the correct state (`welcome.html` or `sidepanel.html`).
    -   **Side Panel <> State Manager**: The UI logic in `sidepanel.js` calls methods on `StateManager` to trigger actions like `grabPageContent`.
    -   **StateManager <> Content Scripts**: `StateManager` uses `browser.scripting.executeScript` to run content scripts on the active page and receive the resulting HTML/data.

## Development and Deployment

### Local Development Setup

As defined in `package.json`, developers can run the extension in various browsers using `web-ext`:

1.  Run `npm install` to install `web-ext`.
2.  Use a script like `npm run start:firefoxdeveloper` or `npm run start:win:chromedev` to load the extension in a browser with hot-reloading.

### Build and Deployment Process

-   **Build Command**: `npm run build` executes `web-ext build`, which packages the `src` directory into a zip file suitable for store submission.
-   **Deployment**: The resulting artifact is manually uploaded to the respective browser extension stores (Firefox, Chrome, Edge, Safari), as detailed in the `README.md`.

## Testing Reality

### Current Test Coverage

-   **Unit, Integration, E2E Tests**: **None.** There is no evidence of an automated testing framework, test scripts, or a test directory in the codebase. All testing is likely manual.

### Running Tests

-   No test commands are available.

## Appendix - Useful Commands and Scripts

### Frequently Used Commands (from `package.json`)

```bash
# Install dependencies
npm install

# Build the extension for production
npm run build

# Run in Firefox Developer Edition
npm run start:firefoxdeveloper

# Run in Chrome Dev on Windows
npm run start:win:chromedev
```

---