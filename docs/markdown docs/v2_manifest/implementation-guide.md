# MarkDownload Core Implementation Guide

## Purpose
This guide extracts the **CORE functionality** from MarkDownload to help you build your own website-to-markdown converter. Whether you're building a web app, CLI tool, or different type of extension, this guide provides the essential patterns and code.

## Core Technology Stack

### Essential Libraries (Copy these patterns exactly)

```javascript
// 1. Content Extraction: Mozilla's Readability.js
// - Cleans up web pages like Firefox Reader View
// - Extracts main content, removes ads/navigation/footers
// - Creates structured article object

// 2. HTML → Markdown: Turndown.js  
// - Converts cleaned HTML to markdown
// - Highly configurable conversion rules
// - Support for GitHub Flavored Markdown

// 3. Date Formatting: Moment.js (or modern alternative)
// - Template variable replacement for dates
// - Multiple format support

// 4. MIME Type Detection: apache-mime-types.js
// - File extension detection for downloaded images
```

### Dependencies You Need
```json
{
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "turndown": "^7.1.3", 
    "turndown-plugin-gfm": "^1.0.2",
    "moment": "^2.29.4"
  }
}
```

## Core Architecture Pattern

### 1. Content Processing Pipeline

```javascript
// STEP 1: Extract Content from DOM
async function extractContent(htmlString, baseURL) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(htmlString, "text/html");
  
  // Set base URI for relative links
  if (!dom.head.querySelector('base')) {
    const baseEl = document.createElement('base');
    baseEl.href = baseURL;
    dom.head.appendChild(baseEl);
  }
  
  // Use Readability to extract main content
  const article = new Readability(dom).parse();
  
  // Add URL metadata
  const url = new URL(baseURL);
  article.baseURI = baseURL;
  article.hostname = url.hostname;
  article.pathname = url.pathname;
  // ... add other URL components
  
  return article;
}

// STEP 2: Convert to Markdown  
function convertToMarkdown(article, options = {}) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    ...options
  });
  
  // Add GitHub Flavored Markdown support
  turndownService.use(turndownPluginGfm.gfm);
  
  // Convert content
  const markdown = turndownService.turndown(article.content);
  
  return {
    markdown,
    title: article.title,
    metadata: {
      author: article.byline,
      excerpt: article.excerpt,
      url: article.baseURI,
      publishedDate: article.publishedTime
    }
  };
}
```

### 2. Template System (Copy this pattern)

```javascript
// Template replacement function from MarkDownload
function applyTemplate(template, article, options = {}) {
  let result = template;
  
  // Replace article data
  for (const key in article) {
    if (article.hasOwnProperty(key) && key !== "content") {
      let value = (article[key] || '') + '';
      
      // Basic replacements
      result = result.replace(new RegExp('{' + key + '}', 'g'), value)
        .replace(new RegExp('{' + key + ':lower}', 'g'), value.toLowerCase())
        .replace(new RegExp('{' + key + ':upper}', 'g'), value.toUpperCase())
        .replace(new RegExp('{' + key + ':kebab}', 'g'), value.replace(/ /g, '-').toLowerCase())
        .replace(new RegExp('{' + key + ':snake}', 'g'), value.replace(/ /g, '_').toLowerCase());
    }
  }
  
  // Replace date formats  
  const now = new Date();
  const dateRegex = /{date:(.+?)}/g;
  const matches = result.match(dateRegex);
  if (matches) {
    matches.forEach(match => {
      const format = match.substring(6, match.length - 1);
      const dateString = moment(now).format(format);
      result = result.replaceAll(match, dateString);
    });
  }
  
  // Clean up any remaining placeholders
  result = result.replace(/{.*?}/g, '');
  
  return result;
}
```

### 3. Default Configuration (Use these proven settings)

```javascript
const DEFAULT_OPTIONS = {
  // Markdown conversion settings
  headingStyle: "atx",              // # headers vs underlined
  bulletListMarker: "-",            // -, *, or +
  codeBlockStyle: "fenced",         // ``` vs indented
  fence: "```",                     // ``` or ~~~
  emDelimiter: "_",                 // _italic_ vs *italic*
  strongDelimiter: "**",            // **bold** vs __bold__
  linkStyle: "inlined",             // [text](url) vs referenced
  
  // Templates
  frontmatter: `---
created: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})
tags: [{keywords}]
source: {baseURI}
author: {byline}
---

# {pageTitle}

> ## Excerpt  
> {excerpt}

---`,
  backmatter: "",
  titleTemplate: "{pageTitle}",
  
  // Processing options
  downloadImages: false,
  includeTemplate: false,
  turndownEscape: true              // Escape markdown characters
};
```

## Implementation Examples

### Web Application Example

```javascript
// For a web app or API endpoint
class WebToMarkdown {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupTurndown();
  }
  
  setupTurndown() {
    this.turndownService = new TurndownService(this.options);
    this.turndownService.use(turndownPluginGfm.gfm);
    
    // Add custom rules for better conversion
    this.addCustomRules();
  }
  
  async convertUrl(url) {
    // 1. Fetch the webpage
    const response = await fetch(url);
    const html = await response.text();
    
    // 2. Extract content
    const article = await this.extractContent(html, url);
    
    // 3. Convert to markdown
    const result = this.convertToMarkdown(article);
    
    // 4. Apply templates
    if (this.options.includeTemplate) {
      const frontmatter = this.applyTemplate(this.options.frontmatter, article);
      const backmatter = this.applyTemplate(this.options.backmatter, article);
      result.markdown = frontmatter + '\n\n' + result.markdown + '\n\n' + backmatter;
    }
    
    return result;
  }
  
  // Copy the core functions from above...
}

// Usage
const converter = new WebToMarkdown({
  includeTemplate: true,
  downloadImages: false
});

const result = await converter.convertUrl('https://example.com/article');
console.log(result.markdown);
```

### Node.js CLI Tool Example

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

class CliWebToMarkdown {
  async convertFile(inputFile, outputFile) {
    const html = fs.readFileSync(inputFile, 'utf8');
    const result = await this.convertHtml(html, 'file://' + path.resolve(inputFile));
    fs.writeFileSync(outputFile, result.markdown);
    console.log(`Converted: ${inputFile} → ${outputFile}`);
  }
  
  async convertHtml(html, baseUrl) {
    const dom = new JSDOM(html, { url: baseUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    // Convert using the same patterns as above...
    return this.convertToMarkdown(article);
  }
}
```

## Key Custom Rules (Copy these for better conversion)

```javascript
function addCustomRules() {
  // Handle images with better metadata
  this.turndownService.addRule('images', {
    filter: 'img',
    replacement: function (content, node) {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      const title = node.getAttribute('title');
      const titlePart = title ? ` "${title}"` : '';
      return src ? `![${alt}](${src}${titlePart})` : '';
    }
  });
  
  // Handle code blocks with language detection
  this.turndownService.addRule('fencedCodeBlock', {
    filter: function (node) {
      return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE';
    },
    replacement: function (content, node) {
      const code = node.firstChild;
      const language = code.className.match(/language-(\w+)/)?.[1] || '';
      const fence = '```';
      return `\n\n${fence}${language}\n${code.textContent}\n${fence}\n\n`;
    }
  });
  
  // Handle tables properly
  // (GFM plugin handles this, but you can customize)
}
```

## Testing Your Implementation

### Test with Real Websites

```javascript
// Test articles
const testUrls = [
  'https://developer.mozilla.org/en-US/docs/Web/API',
  'https://github.com/microsoft/vscode', 
  'https://stackoverflow.com/questions/...',
  'https://medium.com/@author/article',
  'https://news.ycombinator.com/item?id=...'
];

// Test different content types
testUrls.forEach(async url => {
  try {
    const result = await converter.convertUrl(url);
    console.log(`✅ ${url} - ${result.title}`);
    console.log(`📝 ${result.markdown.length} chars`);
  } catch (error) {
    console.log(`❌ ${url} - ${error.message}`);
  }
});
```

### Quality Checks

```javascript
function validateMarkdown(markdown) {
  const checks = {
    hasTitle: /^#\s+.+/m.test(markdown),
    hasContent: markdown.length > 100,
    noHtmlTags: !/<[^>]+>/.test(markdown.replace(/```[\s\S]*?```/g, '')),
    properLinks: /\[.+\]\(.+\)/.test(markdown),
    properImages: /!\[.*\]\(.+\)/.test(markdown)
  };
  
  return checks;
}
```

## Deployment Options

### 1. Express.js API
```javascript
app.post('/convert', async (req, res) => {
  const { url, options } = req.body;
  const converter = new WebToMarkdown(options);
  const result = await converter.convertUrl(url);
  res.json(result);
});
```

### 2. Serverless Function (Vercel/Netlify)
```javascript
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const result = await convertUrl(req.body.url);
    res.json(result);
  }
}
```

### 3. Browser Extension (like MarkDownload)
- Follow the architecture patterns from `docs/architect.md`
- Use content scripts + background script pattern
- Add browser API integration

### 4. Desktop App (Electron)
- Combine Node.js patterns with GUI
- Built-in browser for rendering pages
- File system access for saving

## Next Steps

1. **Choose your platform** (web app, CLI, extension, etc.)
2. **Install the dependencies** listed above  
3. **Copy the core conversion functions** from this guide
4. **Test with real websites** to verify functionality
5. **Add custom rules** for your specific needs
6. **Implement error handling** for edge cases

## Files to Extract from MarkDownload

If you want to use the exact MarkDownload implementation:

**Core Files to Copy:**
- `src/background/background.js` - Lines 14-430 (conversion engine)
- `src/shared/default-options.js` - Complete file (configuration)
- `src/background/Readability.js` - Complete file (content extraction) 
- `src/background/turndown.js` - Complete file (HTML→Markdown)
- `src/background/turndown-plugin-gfm.js` - Complete file (tables/strikethrough)

**Key Functions to Extract:**
- `turndown()` - Core conversion function  
- `textReplace()` - Template processing
- `getArticleFromDom()` - Content extraction
- `generateValidFileName()` - File naming

## Success Criteria

✅ Extracts clean content from complex web pages  
✅ Converts HTML to properly formatted markdown  
✅ Handles images, links, code blocks, tables  
✅ Supports custom templates with variables  
✅ Robust error handling for edge cases  
✅ Performance: <1 second for typical articles  

---

**You now have everything needed to build your own website-to-markdown converter using the proven MarkDownload patterns!**
