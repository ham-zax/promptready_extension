// Comprehensive edge case test coverage for large content and malformed HTML scenarios
// Ensures robustness and security of the content processing pipeline

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { safeParseHTML, extractSemanticContent, removeUnwantedElements } from '../lib/dom-utils';
import { MarkdownPostProcessor } from '../core/post-processor';

describe('Edge Cases - Large Content Processing', () => {
  beforeEach(() => {
    // Reset cache before each test
    OfflineModeManager.clearCache();
  });

  afterEach(() => {
    // Clean up any cache entries
    OfflineModeManager.clearCache();
  });

  it('should handle extremely large HTML content (>1MB)', async () => {
    const largeHtml = '<html><body>' + '<p>Large content block.</p>'.repeat(10000) + '</body></html>';
    const url = 'https://example.com/large-content';
    const title = 'Large Content Test';

    const result = await OfflineModeManager.processContent(largeHtml, url, title);

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('Content truncated')
    ]));
    expect(result.markdown.length).toBeGreaterThan(0);
    expect(result.processingStats.totalTime).toBeLessThan(10000); // Should complete within 10s
  });

  it('should handle content with many nested levels', async () => {
    const nestedHtml = generateNestedHtml(50); // 50 levels deep
    const url = 'https://example.com/nested';
    const title = 'Nested Content Test';

    const result = await OfflineModeManager.processContent(nestedHtml, url, title);

    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeLessThan(5); // Should handle gracefully
    expect(result.processingStats.qualityScore).toBeGreaterThan(50); // Reasonable quality
  });

  it('should process content with massive tables efficiently', async () => {
    const tableHtml = generateLargeTable(1000); // 1000 rows
    const url = 'https://example.com/large-table';
    const title = 'Large Table Test';

    const result = await OfflineModeManager.processContent(tableHtml, url, title);

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('|'); // Should contain table markdown
    expect(result.processingStats.turndownTime).toBeLessThan(5000); // Efficient table processing
  });

  it('should handle content with thousands of list items', async () => {
    const listHtml = generateLargeList(5000); // 5000 list items
    const url = 'https://example.com/large-list';
    const title = 'Large List Test';

    const result = await OfflineModeManager.processContent(listHtml, url, title);

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('-'); // Should contain list markdown
    expect(result.processingStats.qualityScore).toBeGreaterThan(70); // Good list preservation
  });

  it('should handle mixed content types efficiently', async () => {
    const mixedHtml = generateMixedContent(); // Tables, lists, headings, code blocks
    const url = 'https://example.com/mixed-content';
    const title = 'Mixed Content Test';

    const startTime = performance.now();
    const result = await OfflineModeManager.processContent(mixedHtml, url, title);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(3000); // Should process efficiently
    expect(result.processingStats.qualityScore).toBeGreaterThan(75);
  });
});

describe('Edge Cases - Malformed HTML Scenarios', () => {
  it('should handle unclosed tags gracefully', async () => {
    const malformedHtml = `
      <html>
        <body>
          <div>
            <h1>Unclosed heading
            <p>This paragraph is never closed
            <ul>
              <li>Item 1
              <li>Item 2
              <li>Item 3
            <table>
              <tr>
                <td>Cell 1
                <td>Cell 2
              <td>Cell 3
    `;

    const result = await OfflineModeManager.processContent(malformedHtml, 'https://example.com/malformed', 'Unclosed Tags Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('unclosed'),
      expect.stringContaining('malformed')
    ]));
    expect(result.markdown.length).toBeGreaterThan(0); // Should still produce output
  });

  it('should handle self-closing and normal tag mixtures', async () => {
    const mixedTagsHtml = `
      <div>
        <img src="test.jpg" />
        <br>
        <input type="text" />
        <hr>
        <meta charset="utf-8">
        <p>Normal paragraph</p>
        <span>Inline content</span>
      </div>
    `;

    const result = await OfflineModeManager.processContent(mixedTagsHtml, 'https://example.com/mixed-tags', 'Mixed Tags Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Normal paragraph');
    expect(result.markdown).toContain('Inline content');
  });

  it('should handle deeply nested broken structures', async () => {
    const brokenNestedHtml = `
      <div>
        <div>
          <div>
            <table>
              <tr>
                <td>
                  <div>
                    <p>Deep content
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;

    const result = await OfflineModeManager.processContent(brokenNestedHtml, 'https://example.com/broken-nested', 'Broken Nested Test');

    expect(result.success).toBe(true);
    expect(result.processingStats.qualityScore).toBeGreaterThan(40); // Some structure preserved
  });

  it('should handle HTML with comments and CDATA sections', async () => {
    const htmlWithComments = `
      <html>
        <!-- This is a comment -->
        <head>
          <!-- Another comment -->
          <style>
            /* CSS comment */
            body { color: red; }
          </style>
        </head>
        <body>
          <!-- Body comment -->
          <script>
            // JavaScript comment
            var x = 5;
          </script>
          <div>Content</div>
          <![CDATA[Some data]]>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(htmlWithComments, 'https://example.com/comments', 'Comments Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Content');
    expect(result.markdown).not.toContain('<!--'); // Comments should be stripped
  });

  it('should handle malformed attributes', async () => {
    const malformedAttrs = `
      <div class="unclosed-class" id="valid-id" data-test="value with quotes" title='single quotes'>
        <img src=unquoted.jpg alt="valid alt" width=100 height=200>
        <a href="https://example.com" target="_blank" rel=nofollow>Link</a>
      </div>
    `;

    const result = await OfflineModeManager.processContent(malformedAttrs, 'https://example.com/malformed-attrs', 'Malformed Attributes Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('attribute')
    ]));
  });

  it('should handle invalid HTML entities', async () => {
    const invalidEntities = `
      <div>
        <p>Content with &invalid; entity</p>
        <p>Content with &ampersand; entity</p>
        <p>Content with &#9999999; invalid entity</p>
        <p>Content with &lt; not escaped</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(invalidEntities, 'https://example.com/invalid-entities', 'Invalid Entities Test');

    expect(result.success).toBe(true);
    expect(result.markdown.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases - Security and XSS Scenarios', () => {
  it('should sanitize and neutralize XSS attempts', async () => {
    const xssHtml = `
      <div>
        <script>alert('XSS')</script>
        <img src="x" onerror="alert('XSS')">
        <a href="javascript:alert('XSS')">Malicious Link</a>
        <iframe src="javascript:alert('XSS')"></iframe>
        <body onload="alert('XSS')">
        <svg onload="alert('XSS')">
        <div onclick="alert('XSS')">Click me</div>
        <input onfocus="alert('XSS')" autofocus>
        <details open ontoggle="alert('XSS')">
        <marquee onstart="alert('XSS')">Scrolling text</marquee>
      </div>
    `;

    const result = await OfflineModeManager.processContent(xssHtml, 'https://example.com/xss', 'XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('<script>'); // Scripts should be removed
    expect(result.markdown).not.toContain('javascript:'); // JS URLs should be neutralized
    expect(result.markdown).not.toContain('onerror='); // Event handlers should be removed
    expect(result.markdown).not.toContain('onclick='); // Event handlers should be removed
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('XSS'),
      expect.stringContaining('script'),
      expect.stringContaining('malicious')
    ]));
  });

  it('should handle protocol XSS attempts', async () => {
    const protocolXss = `
      <div>
        <a href="javasc&rlt;ript:alert('XSS')">Protocol XSS 1</a>
        <a href="jav\u0000ascript:alert('XSS')">Protocol XSS 2</a>
        <a href="java\nscript:alert('XSS')">Protocol XSS 3</a>
        <iframe src="j\0\tav\0ascript:alert('XSS')"></iframe>
        <embed src="javasc\nript:alert('XSS')">
        <link href="javasc\t\t\rript:alert('XSS')">
      </div>
    `;

    const result = await OfflineModeManager.processContent(protocolXss, 'https://example.com/protocol-xss', 'Protocol XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('javascript:');
    expect(result.markdown).not.toContain('alert(');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('protocol'),
      expect.stringContaining('XSS')
    ]));
  });

  it('should handle encoding-based XSS', async () => {
    const encodingXss = `
      <div>
        <div data="&#60;script&#62;alert('XSS')&#60;/script&#62;">Encoded XSS 1</div>
        <div>&#x6A;script&alert('XSS');</div>
        <div>%3Cscript%3Ealert('XSS')%3C/script%3E</div>
        <img src="x" onerror="&#97;l&#101;rt('XSS')">
        <a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert('XSS')">Encoded Link</a>
      </div>
    `;

    const result = await OfflineModeManager.processContent(encodingXss, 'https://example.com/encoding-xss', 'Encoding XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('alert('); // Should not execute decoded
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('encoded'),
      expect.stringContaining('XSS')
    ]));
  });

  it('should handle DOM clobbering attempts', async () => {
    const clobberingHtml = `
      <div>
        <form id="testForm">
          <input name="action" value="clobbered">
        </form>
        <img name="src" id="image1">
        <img name="id" id="image2">
        <a name="href" id="link1">Link 1</a>
        <script>
          // Try to access clobbered properties
          alert(document.testForm.action); // Will show clobbered value
          alert(document.image1.src); // Will show clobbered value
          alert(document.link1.href); // Will show clobbered value
        </script>
      </div>
    `;

    const result = await OfflineModeManager.processContent(clobberingHtml, 'https://example.com/clobbering', 'DOM Clobbering Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('clobber'),
      expect.stringContaining('conflict')
    ]));
  });

  it('should handle data injection attempts', async () => {
    const dataInjection = `
      <div>
        <input type="hidden" name="redirect" value="javascript:alert('XSS')">
        <meta http-equiv="refresh" content="0; url=javascript:alert('XSS')">
        <style>
          @import url('javascript:alert('XSS')');
          body { background: url('javascript:alert('XSS')'); }
        </style>
        <object data="data:text/html,&lt;script&gt;alert('XSS')&lt;/script&gt;"></object>
        <embed src="data:text/html,&lt;script&gt;alert('XSS')&lt;/script&gt;">
      </div>
    `;

    const result = await OfflineModeManager.processContent(dataInjection, 'https://example.com/data-injection', 'Data Injection Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('javascript:');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('data'),
      expect.stringContaining('injection')
    ]));
  });
});

describe('Edge Cases - Empty and Unicode Content', () => {
  it('should handle completely empty content', async () => {
    const emptyHtml = '';
    const url = 'https://example.com/empty';
    const title = 'Empty Content Test';

    const result = await OfflineModeManager.processContent(emptyHtml, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle whitespace-only content', async () => {
    const whitespaceHtml = '   \n\t   \r\n   \t   ';
    const url = 'https://example.com/whitespace';
    const title = 'Whitespace Content Test';

    const result = await OfflineModeManager.processContent(whitespaceHtml, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle content with only invisible characters', async () => {
    const invisibleHtml = '\u200B\u200C\u200D\uFEFF\u2060\u180E'; // Various invisible Unicode chars
    const url = 'https://example.com/invisible';
    const title = 'Invisible Characters Test';

    const result = await OfflineModeManager.processContent(invisibleHtml, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle complex Unicode content', async () => {
    const unicodeHtml = `
      <div>
        <h1>Unicode Test - Mixed Scripts</h1>
        <p>English: Hello World!</p>
        <p>Chinese: 你好世界!</p>
        <p>Japanese: こんにちは世界!</p>
        <p>Arabic: مرحبا بالعالم!</p>
        <p>Hindi: नमस्त दुनिया!</p>
        <p>Emoji: 🌍🍕🎉🚀💻</p>
        <p>Mathematical: ∑∏∫∆∇∂</p>
        <p>Currency: $100.50 €200.00 ¥1,000</p>
        <p>Special combining: e\u0301 (e with combining acute)</p>
        <p>RTL: مرحبا (Arabic)</p>
        <p>LTR: Hello (English)</p>
        <code>console.log('JavaScript with Unicode: 你好');</code>
        <pre>
        #!/bin/bash
        echo "Unicode in shell: 🌍"
        curl -X POST "https://api.example.com" -H "Content-Type: application/json" -d '{"message": "测试中文"}'
        </pre>
      </div>
    `;

    const result = await OfflineModeManager.processContent(unicodeHtml, 'https://example.com/unicode', 'Unicode Content Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Hello World!'); // English preserved
    expect(result.markdown).toContain('你好世界!'); // Chinese preserved
    expect(result.markdown).toContain('こんにちは世界!'); // Japanese preserved
    expect(result.markdown).toContain('مرحبا بالعالم!'); // Arabic preserved
    expect(result.markdown).toContain('🌍🍕🎉🚀💻'); // Emoji preserved
    expect(result.markdown).toContain('∑∏∫∆∇∂'); // Math symbols preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(80); // High quality preservation
  });

  it('should handle zero-width characters and unusual whitespace', async () => {
    const zeroWidthHtml = `
      <div>
        <p>Text\u200Bwith\u200Czero\u200Dwidth\u2060characters</p>
        <p>Regular\u00A0non-breaking\u2003space</p>
        <p>Tabs\tand\nnewlines\r\rcarriage\u2028returns</p>
        <pre>
          Code block\twith\ttabs
          and\nnewlines
          and\u200Bzero-width\nspaces
        </pre>
      </div>
    `;

    const result = await OfflineModeManager.processContent(zeroWidthHtml, 'https://example.com/zero-width', 'Zero-Width Characters Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Text with zero-width characters'); // Content preserved
    expect(result.markdown).toContain('Code block with tabs'); // Formatting preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(70);
  });

  it('should handle extremely long words and text', async () => {
    const longWord = 'a'.repeat(1000); // 1000 character word
    const longText = `This is a sentence with ${longWord} which is an extremely long word that might cause issues with text wrapping and processing performance.`;

    const longWordHtml = `<p>${longText}</p>`;
    const url = 'https://example.com/long-words';
    const title = 'Long Words Test';

    const result = await OfflineModeManager.processContent(longWordHtml, url, title);

    expect(result.success).toBe(true);
    expect(result.markdown).toContain(longWord); // Long word preserved
    expect(result.processingStats.totalTime).toBeLessThan(2000); // Should process efficiently
  });

  it('should handle mixed RTL and LTR content', async () => {
    const mixedDirectionHtml = `
      <div>
        <p dir="rtl">مرحبا بالعالم (Arabic RTL)</p>
        <p dir="ltr">Hello World (English LTR)</p>
        <div>
          <span dir="rtl">عربي</span>
          <span dir="ltr">English</span>
          <span>العربية</span>
        </div>
        <p>Mixed: Hello مرحبا World English</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(mixedDirectionHtml, 'https://example.com/mixed-direction', 'Mixed Direction Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('مرحبا بالعالم'); // Arabic preserved
    expect(result.markdown).toContain('Hello World'); // English preserved
    expect(result.markdown).toContain('عربي'); // Mixed content preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(75);
  });
});

// Helper functions for generating test content
function generateNestedHtml(depth: number): string {
  let html = '';
  for (let i = 0; i < depth; i++) {
    html += '<div>';
  }
  html += '<p>Nested content</p>';
  for (let i = 0; i < depth; i++) {
    html += '</div>';
  }
  return html;
}

function generateLargeTable(rows: number): string {
  let html = '<table><thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead><tbody>';
  for (let i = 0; i < rows; i++) {
    html += `<tr><td>Row ${i} Cell 1</td><td>Row ${i} Cell 2</td><td>Row ${i} Cell 3</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function generateLargeList(items: number): string {
  let html = '<ul>';
  for (let i = 0; i < items; i++) {
    html += `<li>List item ${i + 1} with some content that makes it longer</li>`;
  }
  html += '</ul>';
  return html;
}

function generateMixedContent(): string {
  return `
    <h1>Main Title</h1>
    <h2>Subtitle</h2>
    <p>Introduction paragraph with some content.</p>
    <table>
      <thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>
      <tbody>
        <tr><td>Cell 1</td><td>Cell 2</td></tr>
        <tr><td>Cell 3</td><td>Cell 4</td></tr>
        <tr><td>Cell 5</td><td>Cell 6</td></tr>
      </tbody>
    </table>
    <ul>
      <li>First list item</li>
      <li>Second list item</li>
      <li>Third list item</li>
    </ul>
    <pre><code>
      function example() {
        console.log('Code block example');
        return true;
      }
    </code></pre>
    <blockquote>
      <p>This is a quote that spans multiple lines and should be handled properly by the processing pipeline.</p>
      <p>Second paragraph of the quote.</p>
    </blockquote>
    <p>Concluding paragraph to wrap up the content.</p>
  `;
}