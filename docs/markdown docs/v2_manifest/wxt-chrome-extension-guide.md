# MarkDownload → WXT Chrome Extension Guide

## The Secret Sauce 🧪

**MarkDownload's core magic** happens in 3 key processes:
1. **Content Extraction** (Readability.js) - Cleans web pages like Firefox Reader
2. **Markdown Conversion** (Turndown.js) - HTML → Beautiful Markdown  
3. **Template System** - Dynamic variables like `{title}`, `{date:YYYY-MM-DD}`

## WXT Project Structure Mapping

### Create Your WXT Project
```bash
npm create wxt@latest my-web-clipper
cd my-web-clipper
npm install
```

### Install Core Dependencies
```bash
npm install @mozilla/readability turndown turndown-plugin-gfm moment
npm install @types/turndown --save-dev
```

### File Architecture Map

```
my-web-clipper/
├── entrypoints/
│   ├── background.ts          # ← MarkDownload: src/background/background.js
│   ├── content.ts            # ← MarkDownload: src/contentScript/contentScript.js  
│   └── popup/
│       ├── index.html        # ← MarkDownload: src/popup/popup.html
│       ├── main.ts          # ← MarkDownload: src/popup/popup.js
│       └── style.css        # ← MarkDownload: src/popup/popup.css
├── components/
│   └── MarkdownProcessor.ts  # NEW: Core conversion logic
├── utils/
│   ├── readability.ts       # ← MarkDownload: Readability integration
│   ├── turndown.ts          # ← MarkDownload: Turndown setup
│   └── templates.ts         # ← MarkDownload: Template system
├── assets/
│   └── icon/               # ← MarkDownload: src/icons/
└── wxt.config.ts           # ← MarkDownload: manifest.json settings
```

## Core Implementation Files

### 1. `wxt.config.ts` (Permissions & Setup)

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Web to Markdown Clipper',
    description: 'Convert web pages to markdown files',
    permissions: [
      'activeTab',
      'downloads', 
      'storage',
      'contextMenus'
    ],
    host_permissions: ['<all_urls>']
  },
  modules: ['@wxt-dev/module-react'] // if using React for popup
});
```

### 2. `components/MarkdownProcessor.ts` (The Secret Sauce!)

```typescript
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import * as turndownPluginGfm from 'turndown-plugin-gfm';
import moment from 'moment';

export interface ConversionOptions {
  includeTemplate?: boolean;
  headingStyle?: 'atx' | 'setext';
  bulletListMarker?: '-' | '*' | '+';
  codeBlockStyle?: 'fenced' | 'indented';
  downloadImages?: boolean;
}

export interface ArticleData {
  title: string;
  content: string;
  byline?: string;
  excerpt?: string;
  baseURI: string;
  pageTitle: string;
  keywords?: string[];
  hostname: string;
  pathname: string;
  publishedTime?: string;
}

export class MarkdownProcessor {
  private turndownService: TurndownService;
  private options: ConversionOptions;

  constructor(options: ConversionOptions = {}) {
    this.options = {
      includeTemplate: false,
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      downloadImages: false,
      ...options
    };
    
    this.setupTurndown();
  }

  // 🎯 SECRET SAUCE #1: Content Extraction
  extractContent(htmlString: string, baseURL: string): ArticleData | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Set base URI for relative links (CRITICAL for link resolution)
    if (!doc.head.querySelector('base')) {
      const baseEl = document.createElement('base');
      baseEl.href = baseURL;
      doc.head.appendChild(baseEl);
    }

    // Remove hidden content before processing (MarkDownload's optimization)
    this.removeHiddenNodes(doc.body);
    
    // Extract with Readability (Mozilla's algorithm)
    const reader = new Readability(doc);
    const article = reader.parse();
    
    if (!article) return null;

    // Add URL metadata (MarkDownload pattern)
    const url = new URL(baseURL);
    return {
      ...article,
      baseURI: baseURL,
      pageTitle: doc.title,
      hostname: url.hostname,
      pathname: url.pathname,
      keywords: this.extractKeywords(doc)
    };
  }

  // 🎯 SECRET SAUCE #2: Markdown Conversion  
  convertToMarkdown(article: ArticleData): { markdown: string; title: string } {
    let markdown = this.turndownService.turndown(article.content);
    
    // Apply templates if enabled
    if (this.options.includeTemplate) {
      const frontmatter = this.applyTemplate(DEFAULT_FRONTMATTER, article);
      markdown = frontmatter + '\n\n' + markdown;
    }
    
    // Clean up special characters (MarkDownload's approach)
    markdown = markdown.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, '');
    
    return {
      markdown,
      title: this.generateFileName(article.title || article.pageTitle)
    };
  }

  // 🎯 SECRET SAUCE #3: Template System
  private applyTemplate(template: string, article: ArticleData): string {
    let result = template;
    
    // Replace article variables
    Object.entries(article).forEach(([key, value]) => {
      if (key !== 'content' && value) {
        const strValue = String(value);
        result = result
          .replace(new RegExp(`{${key}}`, 'g'), strValue)
          .replace(new RegExp(`{${key}:lower}`, 'g'), strValue.toLowerCase())
          .replace(new RegExp(`{${key}:upper}`, 'g'), strValue.toUpperCase())
          .replace(new RegExp(`{${key}:kebab}`, 'g'), strValue.replace(/ /g, '-').toLowerCase());
      }
    });
    
    // Replace date variables (MarkDownload's moment.js integration)
    const now = new Date();
    result = result.replace(/{date:([^}]+)}/g, (match, format) => {
      return moment(now).format(format);
    });
    
    // Replace keywords
    if (article.keywords?.length) {
      result = result.replace(/{keywords}/g, article.keywords.join(', '));
    }
    
    // Clean up remaining placeholders
    return result.replace(/{[^}]*}/g, '');
  }

  // Setup Turndown with MarkDownload's custom rules
  private setupTurndown(): void {
    this.turndownService = new TurndownService({
      headingStyle: this.options.headingStyle,
      bulletListMarker: this.options.bulletListMarker,
      codeBlockStyle: this.options.codeBlockStyle,
      fence: '```'
    });

    // Add GitHub Flavored Markdown (tables, strikethrough)
    this.turndownService.use(turndownPluginGfm.gfm);

    // Custom image rule (MarkDownload's approach)
    this.turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node: any) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title');
        const titlePart = title ? ` "${title}"` : '';
        return src ? `![${alt}](${src}${titlePart})` : '';
      }
    });

    // Custom code block rule  
    this.turndownService.addRule('fencedCodeBlock', {
      filter: (node: any) => {
        return node.nodeName === 'PRE' && 
               node.firstChild && 
               node.firstChild.nodeName === 'CODE';
      },
      replacement: (content, node: any) => {
        const code = node.firstChild;
        const language = code.className.match(/language-(\w+)/)?.[1] || '';
        const fence = '```';
        return `\n\n${fence}${language}\n${code.textContent}\n${fence}\n\n`;
      }
    });
  }

  // MarkDownload's hidden content removal
  private removeHiddenNodes(root: Element): void {
    const walker = document.createNodeIterator(
      root,
      NodeFilter.SHOW_ELEMENT,
      (node: any) => {
        const nodeName = node.nodeName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(nodeName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const style = window.getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none') {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        return NodeFilter.FILTER_SKIP;
      }
    );

    const nodesToRemove: Node[] = [];
    let node;
    while (node = walker.nextNode()) {
      nodesToRemove.push(node);
    }
    
    nodesToRemove.forEach(n => n.parentNode?.removeChild(n));
  }

  private extractKeywords(doc: Document): string[] {
    const metaKeywords = doc.querySelector('meta[name="keywords"]');
    return metaKeywords?.getAttribute('content')?.split(',').map(k => k.trim()) || [];
  }

  private generateFileName(title: string): string {
    // MarkDownload's file naming logic
    return title
      .replace(/[\/\?<>\\:\*\|":]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// MarkDownload's default frontmatter template
const DEFAULT_FRONTMATTER = `---
created: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})
tags: [{keywords}]
source: {baseURI}
author: {byline}
---

# {pageTitle}

> ## Excerpt
> {excerpt}

---`;
```

### 3. `entrypoints/content.ts` (Page Interaction)

```typescript
import { MarkdownProcessor } from '../components/MarkdownProcessor';

export default defineContentScript({
  matches: ['<all_urls>'],
  
  main() {
    // Function to get page DOM and selection
    function getPageContent() {
      // Add title if missing (MarkDownload's fix)
      if (document.head.getElementsByTagName('title').length === 0) {
        const titleEl = document.createElement('title');
        titleEl.innerText = document.title;
        document.head.appendChild(titleEl);
      }

      return {
        dom: document.documentElement.outerHTML,
        selection: getSelectedHTML(),
        url: window.location.href
      };
    }

    // Get selected HTML (MarkDownload's selection logic)
    function getSelectedHTML(): string {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return '';
      
      const range = selection.getRangeAt(0);
      const div = document.createElement('div');
      div.appendChild(range.cloneContents());
      return div.innerHTML;
    }

    // Listen for requests from popup/background
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const content = getPageContent();
        sendResponse(content);
      }
    });
  }
});
```

### 4. `entrypoints/background.ts` (Core Processing)

```typescript
import { MarkdownProcessor } from '../components/MarkdownProcessor';

export default defineBackground(() => {
  const processor = new MarkdownProcessor();

  // Handle conversion requests
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'CONVERT_TO_MARKDOWN') {
      try {
        const { dom, selection, url, options } = message;
        
        // Use selection if provided, otherwise full DOM
        const htmlToProcess = selection || dom;
        
        // Extract and convert
        const article = processor.extractContent(htmlToProcess, url);
        if (!article) {
          sendResponse({ error: 'Could not extract content' });
          return;
        }

        const result = processor.convertToMarkdown(article);
        sendResponse({ success: true, ...result });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    }
  });

  // Context menu (MarkDownload's right-click functionality)
  browser.contextMenus.create({
    id: 'download-markdown',
    title: 'Download as Markdown',
    contexts: ['page']
  });

  browser.contextMenus.create({
    id: 'download-selection-markdown', 
    title: 'Download Selection as Markdown',
    contexts: ['selection']
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    // Get page content
    const response = await browser.tabs.sendMessage(tab.id, { 
      type: 'GET_PAGE_CONTENT' 
    });

    const useSelection = info.menuItemId === 'download-selection-markdown';
    
    // Convert to markdown
    const result = await browser.runtime.sendMessage({
      type: 'CONVERT_TO_MARKDOWN',
      dom: response.dom,
      selection: useSelection ? response.selection : null,
      url: response.url,
      options: { includeTemplate: true }
    });

    if (result.success) {
      // Download the file
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      
      await browser.downloads.download({
        url: url,
        filename: `${result.title}.md`,
        saveAs: true
      });
    }
  });
});
```

### 5. `entrypoints/popup/main.ts` (UI Interface)

```typescript
import { MarkdownProcessor } from '../../components/MarkdownProcessor';

// Get current tab content and convert
async function convertCurrentTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    // Get page content
    const response = await browser.tabs.sendMessage(tab.id, { 
      type: 'GET_PAGE_CONTENT' 
    });

    // Convert to markdown
    const result = await browser.runtime.sendMessage({
      type: 'CONVERT_TO_MARKDOWN',
      dom: response.dom,
      url: response.url,
      options: { includeTemplate: true }
    });

    if (result.success) {
      // Display in textarea
      const textarea = document.getElementById('markdown') as HTMLTextAreaElement;
      const titleInput = document.getElementById('title') as HTMLInputElement;
      
      textarea.value = result.markdown;
      titleInput.value = result.title;
    }
  } catch (error) {
    console.error('Conversion failed:', error);
  }
}

// Download functionality
async function downloadMarkdown() {
  const textarea = document.getElementById('markdown') as HTMLTextAreaElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  
  const blob = new Blob([textarea.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  await browser.downloads.download({
    url: url,
    filename: `${titleInput.value}.md`,
    saveAs: true
  });
  
  window.close();
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  convertCurrentTab();
  
  document.getElementById('download')?.addEventListener('click', downloadMarkdown);
});
```

### 6. `entrypoints/popup/index.html` (UI)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 500px; height: 600px; margin: 0; padding: 16px; }
    input, textarea { width: 100%; margin-bottom: 12px; }
    textarea { height: 400px; font-family: monospace; }
    button { padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #3367d6; }
  </style>
</head>
<body>
  <input type="text" id="title" placeholder="Filename">
  <textarea id="markdown" placeholder="Markdown will appear here..."></textarea>
  <button id="download">Download Markdown</button>
  
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production  
npm run build

# Test in Chrome
npm run dev:chrome
```

## The Magic Workflow 🎭

1. **User clicks extension** → Popup opens
2. **Content script** extracts DOM → Sends to background
3. **Background** processes with Readability.js → Cleans content  
4. **Turndown.js** converts HTML → Beautiful markdown
5. **Template system** adds frontmatter → Final document
6. **Download** triggers → Markdown file saved

## Key Differences from Original MarkDownload

✅ **Modern**: Manifest V3, TypeScript, WXT framework  
✅ **Cleaner**: Better separation of concerns  
✅ **Maintainable**: Modern async/await patterns  
✅ **Same Core**: Identical Readability.js + Turndown.js magic  

## Testing Your Extension

```bash
# Load in Chrome
npm run dev:chrome
# → Opens Chrome with extension loaded

# Test these sites
https://developer.mozilla.org/en-US/docs/Web/API
https://github.com/microsoft/vscode
https://stackoverflow.com/questions/tagged/javascript
```

## Success Metrics

✅ Converts complex pages to clean markdown  
✅ Preserves formatting, links, code blocks  
✅ Template system works with variables  
✅ Right-click context menu functions  
✅ Download saves proper .md files  

**You now have MarkDownload's full power in a modern WXT Chrome extension!** 🚀
