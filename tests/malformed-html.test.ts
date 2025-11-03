// Specialized malformed HTML test scenarios
// Focuses specifically on unclosed tags, XSS scenarios, and security edge cases

import { describe, it, expect } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

describe('Malformed HTML - Unclosed Tags', () => {
  it('should handle unclosed heading tags', async () => {
    const html = `
      <h1>Unclosed heading
      <p>This paragraph has a closed parent, but the heading doesn't
      <div>Normal div</div>
    `;

    const result = await OfflineModeManager.processContent(html, 'https://example.com', 'Unclosed Heading Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Unclosed heading'); // Content preserved
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('unclosed'),
      expect.stringContaining('heading')
    ]));
  });

  it('should handle deeply unclosed nested structures', async () => {
    const html = `
      <div>
        <div>
          <div>
            <p>This paragraph never closes
            <span>This span also never closes
      <div>This should close properly</div>
      <p>This paragraph is normal</p>
    `;

    const result = await OfflineModeManager.processContent(html, 'https://example.com', 'Deeply Unclosed Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('This paragraph never closes');
    expect(result.warnings.length).toBeGreaterThan(3); // Multiple unclosed warnings
  });

  it('should handle mismatched closing tags', async () => {
    const html = `
      <div>
        <p>This paragraph closes with wrong tag
        <span>This span never closes
      </div>
        <strong>This strong closes with wrong tag
      </span>
    `;

    const result = await OfflineModeManager.processContent(html, 'https://example.com', 'Mismatched Closing Tags Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('mismatched'),
      expect.stringContaining('closing tag')
    ]));
  });

  it('should handle self-closing tags used incorrectly', async () => {
    const html = `
      <div>
        <img src="test.jpg">
        <br>
        <hr>
        <input type="text">
        <img src="valid.jpg" />
        <br />
        <hr />
      </div>
    `;

    const result = await OfflineModeManager.processContent(html, 'https://example.com', 'Self-Closing Tags Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('test.jpg'); // Images preserved
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('self-closing')
    ]));
  });
});

describe('Malformed HTML - XSS Scenarios', () => {
  it('should neutralize script tag XSS', async () => {
    const xssHtml = `
      <script>
        alert('Direct XSS attempt');
        document.location.href = 'https://evil.com';
      </script>
      <div>Safe content after script</div>
    `;

    const result = await OfflineModeManager.processContent(xssHtml, 'https://example.com', 'Script XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('<script>'); // Script tag should be removed
    expect(result.markdown).not.toContain('alert('); // JavaScript should be removed
    expect(result.markdown).not.toContain('document.location'); // DOM access should be removed
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('script'),
      expect.stringContaining('XSS'),
      expect.stringContaining('removed')
    ]));
  });

  it('should neutralize event handler XSS', async () => {
    const xssHtml = `
      <div>
        <img src="x" onerror="alert('XSS via img onerror')">
        <body onload="alert('XSS via body onload')">
        <a href="javascript:alert('XSS via javascript: protocol')">Click me</a>
        <button onclick="alert('XSS via button onclick')">Click me too</button>
        <div onmouseover="alert('XSS via div onmouseover')">Hover me</div>
        <form onsubmit="alert('XSS via form onsubmit')">
          <input type="submit" value="Submit">
        </form>
      </div>
      <p>Safe content</p>
    `;

    const result = await OfflineModeManager.processContent(xssHtml, 'https://example.com', 'Event Handler XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('onerror=');
    expect(result.markdown).not.toContain('onload=');
    expect(result.markdown).not.toContain('onclick=');
    expect(result.markdown).not.toContain('onmouseover=');
    expect(result.markdown).not.toContain('javascript:');
    expect(result.markdown).toContain('Safe content');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('event handler'),
      expect.stringContaining('XSS'),
      expect.stringContaining('removed')
    ]));
  });

  it('should neutralize protocol-based XSS', async () => {
    const xssHtml = `
      <div>
        <a href="javAscRiPt:alert('XSS - encoded protocol 1')">Bad Link 1</a>
        <a href="java&Tab;script:alert('XSS - HTML entity protocol')">Bad Link 2</a>
        <a href="java&#x0A;script:alert('XSS - newline protocol')">Bad Link 3</a>
        <iframe src="java\0script:alert('XSS - null byte protocol')"></iframe>
        <embed src="javasc&Tab;ript:alert('XSS - tab protocol')">
        <link href="javasc\nript:alert('XSS - newline protocol')">
        <object data="text/html,<script>alert('XSS - data URI')</script>"></object>
        <meta http-equiv="refresh" content="0; url=javaScript:alert('XSS - meta refresh')">
      </div>
      <p>Safe content</p>
    `;

    const result = await OfflineModeManager.processContent(xssHtml, 'https://example.com', 'Protocol XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('javascript:');
    expect(result.markdown).not.toContain('javaScript:');
    expect(result.markdown).not.toContain('<script>'); // Should be sanitized
    expect(result.markdown).toContain('Safe content');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('protocol'),
      expect.stringContaining('XSS'),
      expect.stringContaining('sanitized')
    ]));
  });

  it('should neutralize encoding-based XSS', async () => {
    const xssHtml = `
      <div>
        <div>&#60;script&alert#59;XSS&I#60;/script&I#62;</div>
        <div>&lt;script&gt;alert('XSS encoded')&lt;/script&gt;</div>
        <div>%3Cscript%3Ealert('XSS URL encoded')%3C/script%3E</div>
        <div>&#x3C;script&alert('XSS hex encoded')& #x3C;/script& #x3E;</div>
        <img src="x" onerror="&ampersand;quot;alert('XSS')&quot;">
        <div style="background-image: url(javasc&Tab;ript:alert('XSS'))">Encoded CSS</div>
        <div data="text/html,&ampersand;lt;script&alert('XSS data URI')&ampersand;gt;/script&ampersand;gt;"></div>
      </div>
      <p>Safe content</p>
    `;

    const result = await OfflineModeManager.processContent(xssHtml, 'https://example.com', 'Encoding XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain("alert('XSS'); // Should not execute");
    expect(result.markdown).not.toContain('<script>'); // Tags should be removed
    expect(result.markdown).toContain('Safe content');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('encoded'),
      expect.stringContaining('XSS'),
      expect.stringContaining('sanitized')
    ]));
  });

  it('should handle DOM clobbering via form elements', async () => {
    const clobberHtml = `
      <form>
        <input name="action" value="malicious-action">
        <input name="method" value="GET">
        <button type="submit">Submit</button>
      </form>
      <div>Safe content</div>
    `;

    const result = await OfflineModeManager.processContent(clobberHtml, 'https://example.com', 'DOM Clobbering Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('clobber'),
      expect.stringContaining('name collision')
    ]));
  });

  it('should handle CSS-based XSS attempts', async () => {
    const cssXssHtml = `
      <style>
        @import url('javascript:alert('CSS import XSS')');
        body { background: url('javascript:alert('CSS background XSS')'); }
        .xss { expression('alert('CSS expression XSS')'); }
        .safe { color: red; }
      </style>
      <div class="xss">Malicious content</div>
      <div class="safe">Safe content</div>
      <div style="background-image: url('javascript:alert('inline style XSS')')">Style XSS</div>
      <link rel="stylesheet" href="javascript:alert('link stylesheet XSS')">
    `;

    const result = await OfflineModeManager.processContent(cssXssHtml, 'https://example.com', 'CSS XSS Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Safe content');
    expect(result.markdown).not.toContain('javascript:');
    expect(result.markdown).not.toContain('expression(');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('CSS'),
      expect.stringContaining('XSS'),
      expect.stringContaining('style')
    ]));
  });
});

describe('Malformed HTML - Attribute Edge Cases', () => {
  it('should handle malformed quotes in attributes', async () => {
    const malformedAttrs = `
      <div class="unclosed-quote id='mixed-quotes" data-attr="value with "quotes" title='single quotes' data-value=unquoted>
        <img src=image.jpg alt='mixed "quotes" width=100 height=200 border=0>
        <a href=https://example.com title=no quotes>Link without quotes</a>
      </div>
    `;

    const result = await OfflineModeManager.processContent(malformedAttrs, 'https://example.com', 'Malformed Attributes Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('attribute'),
      expect.stringContaining('quote'),
      expect.stringContaining('malformed')
    ]));
  });

  it('should handle boolean and minimized attributes', async () => {
    const booleanAttrs = `
      <input type="checkbox" checked disabled readonly>
      <option value="test" selected>
      <video autoplay controls loop muted>
      <script defer async></script>
      <img src="test.jpg" ismap>
      <audio src="audio.mp3" controls>
      <details open>
        <summary>Content</summary>
      </details>
    `;

    const result = await OfflineModeManager.processContent(booleanAttrs, 'https://example.com', 'Boolean Attributes Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Content'); // Summary preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(70);
  });

  it('should handle namespace and custom attributes', async () => {
    const namespaceHtml = `
      <div>
        <svg xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" fill="red" />
        </svg>
        <math xmlns="http://www.w3.org/1998/Math/MathML">
          <msqrt>
            <mn>2</mn>
            <mn>3</mn>
          </msqrt>
        </math>
        <div data-custom-attr="value" data-testid="test-element" role="button" aria-label="Custom Button">
          Custom content
        </div>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "name": "Test Article"
        }
        </script>
      </div>
    `;

    const result = await OfflineModeManager.processContent(namespaceHtml, 'https://example.com', 'Namespace Attributes Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Custom content'); // Content preserved
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('namespace'),
      expect.stringContaining('custom attribute')
    ]));
  });
});

describe('Malformed HTML - Comment and CDATA Edge Cases', () => {
  it('should handle malicious comment content', async () => {
    const maliciousComments = `
      <!--
        <script>alert('XSS in comment')</script>
        <img src=x onerror=alert('XSS in comment')>
        This comment looks like HTML but should be ignored
        --!>
      <![CDATA[
        <script>alert('XSS in CDATA')</script>
        More malicious content in CDATA section
      ]]>
      <div>Safe content</div>
    `;

    const result = await OfflineModeManager.processContent(maliciousComments, 'https://example.com', 'Malicious Comments Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('<script>'); // Script-like content in comments should be removed
    expect(result.markdown).not.toContain("alert('XSS in comment')");
    expect(result.markdown).toContain('Safe content');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('comment'),
      expect.stringContaining('CDATA'),
      expect.stringContaining('suspicious content')
    ]));
  });

  it('should handle conditional comments and browser-specific content', async () => {
    const conditionalComments = `
      <!--[if IE]>
        <script>alert('IE specific XSS')</script>
        <div>IE only content</div>
      <![endif]-->
      <!--[if !IE]><!-->
        <script>alert('Non-IE XSS')</script>
        <div>Non-IE content</div>
      <!--<![endif]-->
      <!--
        <script>alert('Another XSS')</script>
      </body>
      </html>
      -->
      <div>Safe content</div>
    `;

    const result = await OfflineModeManager.processContent(conditionalComments, 'https://example.com', 'Conditional Comments Test');

    expect(result.success).toBe(true);
    expect(result.markdown).not.toContain('<script>'); // Conditional scripts should be removed
    expect(result.markdown).not.toContain("alert('IE specific XSS')");
    expect(result.markdown).toContain('Safe content');
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('conditional comment'),
      expect.stringContaining('browser-specific')
    ]));
  });
});

describe('Malformed HTML - Structure Edge Cases', () => {
  it('should handle tables with malformed structure', async () => {
    const malformedTable = `
      <table>
        <thead>
          <tr>
            <th>Header 1
            <th>Header 2
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1
            <td>Cell 2
            <td>Cell 3
          <tr>
            <td>Row 2 Cell 1
            <td>Row 2 Cell 2
          </table>
          <td>Orphaned cell
        <div>
          <tr>
            <td>Row 3 Cell 1
            <td>Row 3 Cell 2
          </div>
        </tbody>
      </table>
      <p>After table content</p>
    `;

    const result = await OfflineModeManager.processContent(malformedTable, 'https://example.com', 'Malformed Table Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('After table content'); // Content preserved
    expect(result.markdown).toContain('|'); // Should generate table markdown
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('table'),
      expect.stringContaining('malformed'),
      expect.stringContaining('structure')
    ]));
  });

  it('should handle lists with missing or broken structure', async () => {
    const malformedList = `
      <ul>
        <li>Item 1
        <li>Item 2
        <li>Item 3
        </ul>
        <div>Between lists</div>
        <ol>
          <li>Ordered item 1
          <li>Ordered item 2
          <div>
            <li>Nested list item without parent
            <li>Another orphan
          </ol>
        <div>After ordered list</div>
      <p>Paragraph after lists</p>
    `;

    const result = await OfflineModeManager.processContent(malformedList, 'https://example.com', 'Malformed Lists Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('- Item 1'); // Should generate list markdown
    expect(result.markdown).toContain('1. Ordered item 1'); // Should generate ordered list
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('list'),
      expect.stringContaining('structure'),
      expect.stringContaining('orphaned')
    ]));
  });

  it('should handle deeply nested text formatting', async () => {
    const nestedFormatting = `
      <div>
        <p>
          <strong>
            <em>
              <u>
                <span style="color: red;">
                  <code>Deeply nested text</code>
                </span>
              </u>
            </em>
          </strong>
        </p>
      </div>
      <p>Simple paragraph</p>
    `;

    const result = await OfflineModeManager.processContent(nestedFormatting, 'https://example.com', 'Nested Formatting Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Deeply nested text'); // Content preserved
    expect(result.markdown).toContain('Simple paragraph'); // Other content preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(80); // High quality preservation
  });
});