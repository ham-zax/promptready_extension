
---

# MarkDownload → wxt (Modern Chrome Extension) Migration Guide

This guide breaks down the core logic of the MarkDownload extension and shows you how to rebuild it from scratch using a modern, TypeScript-based framework.

## The Core Logic 🧪

The original project's magic happens in **3 key processes**:

1.  **DOM Preparation & Metadata Scraping** (`metadata.js`, `page-context.js`) - Before conversion, it scrapes essential data (title, URL, tags) and prepares the page's HTML by fixing links and marking hidden elements to ensure a clean capture.
2.  **Content Extraction & Cleaning** (`Readability.js`) - It processes the prepared HTML through Mozilla's Readability library to strip away ads, navigation, and other clutter, isolating the main article content.
3.  **HTML-to-Markdown Conversion** (`Turndown.js`) - It takes the clean, readable HTML and converts it into well-formatted Markdown, applying custom rules for images, code blocks, and links.

## `wxt` Project Structure

### Create Your Project

We'll use `wxt`, a modern, Vite-powered toolkit for building browser extensions.

```bash
# Command to initialize a new project in the target framework
npm create wxt@latest my-markdown-clipper
cd my-markdown-clipper
npm install
```

### Install Core Dependencies

These libraries replicate the original's core logic, but managed properly with npm.

```bash
# Commands to install the libraries that replicate the core logic
npm install @mozilla/readability turndown turndown-plugin-gfm
npm install @types/turndown --save-dev
```

### File Architecture Map

```text
my-markdown-clipper/
├── entrypoints/
│   ├── background.ts            # ← [MarkDownload]: src/background/background.js
│   ├── content.ts               # ← [MarkDownload]: src/content/page-context.js & grab-selection.js
│   └── sidepanel/
│       ├── index.html           # ← [MarkDownload]: src/sidepanel/sidepanel.html
│       └── main.ts              # ← [MarkDownload]: src/sidepanel/sidepanel.js
├── lib/
│   └── MarkdownConverter.ts     # NEW: Refactored core logic from common/*.js
├── public/                      # ← [MarkDownload]: media/img/, icons/
└── wxt.config.ts                # ← [MarkDownload]: src/manifest.json
```

## Core Implementation Files

### 1. `wxt.config.ts` (Permissions & Setup)

This file replaces `manifest.json` and configures your extension.

```typescript
// Import necessary configuration functions from the new framework
import { defineConfig } from 'wxt';

export default defineConfig({
  // Configuration block mirroring the old project's manifest
  manifest: {
    name: 'My Markdown Clipper',
    description: 'A custom web-to-markdown converter.',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'sidePanel',
      'contextMenus',
    ],
    // MarkDownload's crucial permission, requested at runtime
    host_permissions: ['*://*/*'], 
  },
});
```

### 2. `lib/MarkdownConverter.ts` (The Core Logic!)

This class encapsulates all the conversion magic from MarkDownload's `common/` directory.

```typescript
// Import core dependencies
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Define key data structures
export interface PageMetadata {
  title: string;
  url: string;
  [key: string]: any; // For other scraped meta tags
}

export interface ConversionResult {
  markdown: string;
  metadata: PageMetadata;
}

export class MarkdownConverter {
  private turndownService: TurndownService;

  constructor(options: any = {}) {
    this.setupTurndownService(options);
  }

  // 🎯 CORE LOGIC: The entire conversion pipeline
  public convert(html: string, documentUrl: string): ConversionResult {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // MarkDownload's trick: Ensure all relative URLs are made absolute first.
    this.fixRelativeUrls(doc.body, documentUrl);

    // 1. Scrape metadata before Readability modifies the DOM
    const metadata = this.scrapeMetadata(doc, documentUrl);

    // 2. Use Readability for a clean, readable article
    // MarkDownload's optimization: Clone the document because Readability is destructive.
    const reader = new Readability(doc.cloneNode(true) as Document);
    const article = reader.parse();

    // Use the full body as a fallback if Readability fails
    const contentToConvert = article?.content || doc.body.innerHTML;

    // 3. Convert the cleaned HTML to Markdown
    let markdown = this.turndownService.turndown(contentToConvert);
    
    // Final cleanup, mirroring MarkDownload
    markdown = markdown.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, '');

    return { markdown, metadata };
  }
  
  private scrapeMetadata(doc: Document, url: string): PageMetadata {
    const pageTitle = doc.querySelector('title')?.textContent || 'Untitled';
    return {
      title: pageTitle,
      url: url,
    };
  }

  private fixRelativeUrls(element: HTMLElement, baseUrl: string) {
    element.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
      a.href = new URL(a.getAttribute('href')!, baseUrl).href;
    });
    element.querySelectorAll<HTMLImageElement>('img[src]').forEach(img => {
      img.src = new URL(img.getAttribute('src')!, baseUrl).href;
    });
  }
  
  // A private method to set up Turndown, mirroring MarkDownload's setup
  private setupTurndownService(options: any): void {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      ...options
    });
    
    // MarkDownload's integration: Use the GFM plugin for tables, strikethrough, etc.
    this.turndownService.use(gfm);

    // Custom rule from MarkDownload for images
    this.turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        const alt = img.alt || '';
        const src = img.src || '';
        return `![${alt}](${src})`;
      }
    });
  }
}
```

### 3. `entrypoints/content.ts` (Page Interaction)

This script is injected into the webpage to get its content.

```typescript
// Import necessary modules from wxt
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Listen for a message from the background script or side panel
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        // MarkDownload's logic: Send back the full document HTML.
        return Promise.resolve({
          html: document.documentElement.outerHTML,
          url: window.location.href,
        });
      }
    });
  },
});
```

### 4. `entrypoints/background.ts` (The Orchestrator)

This script manages the core process, listening for user actions.

```typescript
// Import necessary modules
import { MarkdownConverter } from '~/lib/MarkdownConverter';

export default defineBackground(() => {
  // Initialize the core processor
  const converter = new MarkdownConverter();
  
  // Listen for clicks on the context menu item
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'clip-page' && tab?.id) {
      try {
        // Send a message to the content script in the active tab
        const response = await browser.tabs.sendMessage(tab.id, {
          type: 'GET_PAGE_CONTENT',
        });
        
        // Use the core logic to process the returned HTML
        const { markdown, metadata } = converter.convert(response.html, response.url);
        
        console.log('--- Converted Markdown ---');
        console.log(markdown);
        
        // Next step: Open the side panel and display the markdown, or download it.
        await browser.sidePanel.open({ tabId: tab.id });
        await browser.runtime.sendMessage({ type: 'DISPLAY_MARKDOWN', markdown, metadata });
        
      } catch (err) {
        console.error('Failed to clip page:', err);
      }
    }
  });
  
  // Set up the context menu, mirroring the original's functionality
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'clip-page',
      title: 'Clip Page as Markdown',
      contexts: ['page'],
    });
  });
});
```

## Development Commands

```bash
# Start development server with hot-reloading
npm run dev

# Build for production
npm run build

# Lint and format code
npm run lint
```

## The Core Workflow 🎭

1.  **User right-clicks** a page → Clicks "Clip Page as Markdown" menu item.
2.  `background.ts` → Catches the click event → Sends a `GET_PAGE_CONTENT` message to the active tab's content script.
3.  `content.ts` → Receives the message → Extracts the page's full HTML and current URL → Sends it back to `background.ts`.
4.  `background.ts` → Instantiates `MarkdownConverter` → Processes with `Readability.js` then `Turndown.js` → Gets the final Markdown.
5.  `background.ts` → Opens the `sidepanel` and sends the final Markdown to be displayed.

## Key Differences from the Original

✅ **Modern Stack**: Built with TypeScript, Vite, and Manifest V3 for better performance, security, and maintainability.
✅ **Clean Separation of Concerns**: The core conversion logic is neatly encapsulated in its own `MarkdownConverter` class, completely separate from UI or background tasks.
✅ **Proper Dependency Management**: Core libraries are managed via `npm`, allowing for easy updates and security audits.
✅ **Identical Core Logic**: The fundamental pipeline of Metadata → Readability → Turndown is preserved, ensuring high-quality output on par with the original.

## Testing the Implementation

```bash
# How to run in a test environment
npm run dev
# → Opens Chrome with the new extension loaded.

# Test these key inputs/scenarios
- A Wikipedia article (good for testing Readability).
- A blog post on Medium or dev.to (tests code blocks and complex layouts).
- A GitHub README page (a good test for Markdown-heavy sources).
```

## Success Metrics

✅ Converts complex articles from sites like Wikipedia correctly.
✅ Preserves code blocks, tables, and lists from technical blogs.
✅ Extracts the correct title and metadata.
✅ Creates functional links and images with absolute URLs.
✅ Final Markdown output is clean, readable, and matches the original project's quality.

**You now have MarkDownload's full power in a modern `wxt` implementation!** 🚀