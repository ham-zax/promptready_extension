// Comprehensive test suite for the offline capabilities system
// Tests all components and integration scenarios

import { describe, test, expect } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';
import { TurndownConfigManager } from '../core/turndown-config';
import { MarkdownPostProcessor } from '../core/post-processor';
import { ContentQualityValidator } from '../core/content-quality-validator';
import { ErrorHandler } from '../core/error-handler';

// Mock DOM environment for testing
const mockDOMParser = {
  parseFromString: (html: string, type: string) => {
    // Simple mock implementation
    return {
      body: {
        innerHTML: html,
        textContent: html.replace(/<[^>]*>/g, ''),
        children: [],
        querySelectorAll: () => [],
        querySelector: () => null,
      },
      title: 'Test Document',
      cloneNode: () => mockDOMParser.parseFromString(html, type),
    };
  },
};

// @ts-ignore
global.DOMParser = function() {
  return mockDOMParser;
};

describe('Offline Capabilities System', () => {
  
  describe('OfflineModeManager', () => {
    
    test('should process simple HTML content successfully', async () => {
      const html = `
        <html>
          <body>
            <h1>Test Article</h1>
            <p>This is a test paragraph with some content.</p>
            <p>Another paragraph with more content.</p>
          </body>
        </html>
      `;
      
      const result = await OfflineModeManager.processContent(
        html,
        'https://example.com/test',
        'Test Article'
      );
      
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Test Article');
      expect(result.markdown).toContain('test paragraph');
      expect(result.processingStats.totalTime).toBeGreaterThan(0);
      expect(result.warnings).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });
    
    test('should handle large content with chunking', async () => {
      const largeContent = '<article><h1>Large</h1><p>' + 'Large content '.repeat(50000) + '</p></article>';
      const html = `<html><body>${largeContent}</body></html>`;

      const result = await OfflineModeManager.processLargeContent(
        html,
        'https://example.com/large',
        'Large Document'
      );

      expect(result.success).toBe(true);
      expect(typeof result.markdown).toBe('string');
      expect(result.processingStats.fallbacksUsed).toBeDefined();
    });
    
    test('should get optimal configuration for different URLs', async () => {
      const githubConfig = await OfflineModeManager.getOptimalConfig('https://github.com/user/repo', { renderer: 'unified' });
      expect(githubConfig.readabilityPreset).toBe('technical-documentation');
      expect(githubConfig.turndownPreset).toBe('github');

      const blogConfig = await OfflineModeManager.getOptimalConfig('https://blog.example.com/post', { renderer: 'unified' });
      expect(blogConfig.readabilityPreset).toBe('blog-article');
      expect(blogConfig.postProcessing.addTableOfContents).toBe(true);
    });
    
  });
  
  describe('ReadabilityConfigManager', () => {
    
    test('should detect content type from URL patterns', () => {
      const techConfig = ReadabilityConfigManager.getConfigForUrl('https://docs.example.com/api');
      expect(techConfig.charThreshold).toBe(300); // Technical docs threshold

      const newsConfig = ReadabilityConfigManager.getConfigForUrl('https://news.example.com/2024/01/01/article');
      expect(newsConfig.charThreshold).toBe(800); // News article threshold (updated)
    });
    
    test('should provide fallback configuration for unknown URLs', () => {
      const defaultConfig = ReadabilityConfigManager.getConfigForUrl('https://unknown-site.com');
      expect(defaultConfig.charThreshold).toBe(500); // Default threshold
      expect(defaultConfig.classesToPreserve).toContain('highlight');
    });
    
    test('should validate content quality', () => {
      const content = '<p>Good content</p>'.repeat(100);
      const originalLength = 10000;
      
      const validation = ReadabilityConfigManager.validateContentQuality(content, originalLength);
      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(60);
    });
    
  });
  
  describe('TurndownConfigManager', () => {
    
    test('should convert HTML to markdown with different presets', async () => {
      const html = `
        <h1>Title</h1>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <pre><code class="language-javascript">console.log('hello');</code></pre>
        <ul><li>Item 1</li><li>Item 2</li></ul>
      `;
      
      const standardMarkdown = await TurndownConfigManager.convert(html, 'standard');
      expect(standardMarkdown).toContain('# Title');
      expect(standardMarkdown).toContain('**bold**');
      expect(standardMarkdown).toContain('*italic*');
      expect(standardMarkdown).toContain('```javascript');
      
      const githubMarkdown = await TurndownConfigManager.convert(html, 'github');
      expect(githubMarkdown).toContain('```javascript');
      
      const obsidianMarkdown = await TurndownConfigManager.convert(html, 'obsidian');
      expect(obsidianMarkdown).toContain('# Title');
    });
    
    test('should validate markdown output quality', () => {
      const markdown = '# Title\n\nParagraph with **bold** text.\n\n```js\nconsole.log("test");\n```';
      const originalHtml = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p><pre><code>console.log("test");</code></pre>';
      
      const validation = TurndownConfigManager.validateMarkdown(markdown, originalHtml);
      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(70);
      expect(validation.stats.headings).toBe(1);
      expect(validation.stats.codeBlocks).toBe(1);
    });
    
  });
  
  describe('MarkdownPostProcessor', () => {
    
    test('should clean up markdown formatting', () => {
      const messyMarkdown = `
        #  Title



        Paragraph with   trailing spaces



        Another paragraph




      `;

      const result = MarkdownPostProcessor.process(messyMarkdown);
      const body = result.markdown.replace(/```[\s\S]*?```/g, '');
      expect(body).not.toContain('   '); // No trailing spaces outside code blocks
      expect(result.markdown).not.toMatch(/\n{3,}/); // No excessive newlines
      expect(result.improvements.length).toBeGreaterThan(0);
    });
    
    test('should normalize heading structure', () => {
      const badHeadings = '# Title\n\n#### Skipped Level\n\n## Proper Level';
      
      const result = MarkdownPostProcessor.process(badHeadings, {
        normalizeHeadings: true,
        cleanupWhitespace: true,
        removeEmptyLines: true,
        maxConsecutiveNewlines: 2,
        fixListFormatting: false,
        improveCodeBlocks: false,
        enhanceLinks: false,
        optimizeImages: false,
        addTableOfContents: false,
        preserveLineBreaks: false,
      });
      
      expect(result.improvements).toContain('Fixed heading hierarchy');
    });
    
    test('should add table of contents when requested', () => {
      const markdown = '# Main Title\n\n## Section 1\n\n### Subsection\n\n## Section 2';
      
      const result = MarkdownPostProcessor.process(markdown, {
        addTableOfContents: true,
        cleanupWhitespace: true,
        normalizeHeadings: true,
        removeEmptyLines: true,
        maxConsecutiveNewlines: 2,
        fixListFormatting: false,
        improveCodeBlocks: false,
        enhanceLinks: false,
        optimizeImages: false,
        preserveLineBreaks: false,
      });
      
      expect(result.markdown).toContain('## Table of Contents');
      expect(result.markdown).toContain('- [Section 1]');
    });
    
  });
  
  describe('ContentQualityValidator', () => {
    
    test('should validate high-quality content', () => {
      const goodMarkdown = `
        # Article Title
        
        This is a well-structured article with multiple paragraphs.
        
        ## Section 1
        
        Content with proper structure and formatting.
        
        - List item 1
        - List item 2
        
        \`\`\`javascript
        console.log('code example');
        \`\`\`
        
        ## Section 2
        
        More content with [links](https://example.com) and **formatting**.
      `;
      
      const originalHtml = '<h1>Article Title</h1><p>Content...</p>'.repeat(10);
      const mockStats = {
        totalTime: 1000,
        fallbacksUsed: [],
        errors: [],
      };
      
      const report = ContentQualityValidator.validate(goodMarkdown, originalHtml, mockStats);
      expect(report.overallScore).toBeGreaterThan(70);
      expect(report.passesThreshold).toBe(true);
      expect(report.metrics.markdownQuality).toBeGreaterThan(80);
    });
    
    test('should detect poor-quality content', () => {
      const poorMarkdown = 'Short content';
      const originalHtml = '<div>Much longer original content</div>'.repeat(100);
      const mockStats = {
        totalTime: 100,
        fallbacksUsed: ['readability-fallback', 'turndown-fallback'],
        errors: ['Processing error'],
      };

      const report = ContentQualityValidator.validate(poorMarkdown, originalHtml, mockStats);
      expect(report.overallScore).toBeLessThan(60);
      expect(report.passesThreshold).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
    
    test('should provide quality grade and summary', () => {
      const grade = ContentQualityValidator.getQualityGrade(85);
      expect(grade.grade).toBe('B');
      expect(grade.description).toBe('Good quality');
      
      const mockReport = {
        overallScore: 75,
        passesThreshold: true,
        issues: [
          { type: 'warning' as const, message: 'Test warning', severity: 5, category: 'content' as const },
        ],
        recommendations: ['Improve content structure', 'Add more headings'],
        metrics: {
          contentPreservation: 80,
          structureIntegrity: 75,
          markdownQuality: 70,
          readability: 75,
          completeness: 80,
        },
      };
      
      const summary = ContentQualityValidator.generateSummaryReport(mockReport);
      expect(summary).toContain('Quality Report: C');
      expect(summary).toContain('✅ Passes quality threshold');
    });
    
  });
  
  describe('ErrorHandler', () => {
    
    test('should handle retryable errors', async () => {
      const retryableError = new Error('Network timeout occurred');
      
      const result = await ErrorHandler.handleError(retryableError, {
        stage: 'content-extraction',
        operation: 'fetchContent',
        retryCount: 0,
      });
      
      expect(result.fallbackUsed).toBe('retry');
      expect(result.warnings).toContain('Retrying after error: Network timeout occurred');
    });
    
    test('should use fallback strategies for non-retryable errors', async () => {
      const processingError = new Error('Readability parsing failed');

      const result = await ErrorHandler.handleError(processingError, {
        stage: 'readability-processing',
        operation: 'extractContent',
        input: { html: '<p>Test content</p>' },
      });

      expect(['readability-fallback', 'text-only-extraction']).toContain(result.fallbackUsed);
      expect(result.success).toBe(true);
    });
    
    test('should handle memory issues with cleanup strategy', async () => {
      const memoryError = new Error('Out of memory');
      
      const result = await ErrorHandler.handleError(memoryError, {
        stage: 'markdown-conversion',
        operation: 'convertLargeContent',
      });
      
      expect(result.fallbackUsed).toBe('memory-cleanup');
      expect(result.warnings).toContain('Performed memory cleanup, retry recommended');
    });
    
  });
  
  describe('Integration Tests', () => {
    
    test('should process complete workflow without errors', async () => {
      const testHtml = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Main Title</h1>
              <p>Introduction paragraph with some content.</p>
              
              <h2>Section 1</h2>
              <p>Content for section 1 with <strong>bold text</strong>.</p>
              <ul>
                <li>List item 1</li>
                <li>List item 2</li>
              </ul>
              
              <h2>Section 2</h2>
              <p>More content with <a href="https://example.com">a link</a>.</p>
              <pre><code class="language-javascript">
                console.log('Hello, world!');
              </code></pre>
              
              <h2>Conclusion</h2>
              <p>Final thoughts and summary.</p>
            </article>
          </body>
        </html>
      `;
      
      // Test the complete pipeline
      const result = await OfflineModeManager.processContent(
        testHtml,
        'https://example.com/article',
        'Test Article'
      );
      
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Main Title');
      expect(result.markdown).toContain('## Section 1');
      expect(result.markdown).toContain('**bold text**');
      expect(result.markdown).toContain('[a link](https://example.com)');
      expect(result.markdown).toContain('```javascript');
      
      // Validate quality
      const qualityReport = ContentQualityValidator.validate(
        result.markdown,
        testHtml,
        result.processingStats
      );
      
      expect(qualityReport.overallScore).toBeGreaterThan(70);
      expect(qualityReport.passesThreshold).toBe(true);
    });
    
    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '', // Empty content
        '<html></html>', // Minimal HTML
        '<script>alert("xss")</script>', // Potentially dangerous content
        'Not HTML at all', // Invalid HTML
      ];
      
      for (const html of edgeCases) {
        const result = await OfflineModeManager.processContent(
          html,
          'https://example.com/edge-case',
          'Edge Case'
        );
        
        // Should not throw errors, even if processing fails
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      }
    });
    
  });
  
});

// Performance benchmarks
describe('Performance Tests', () => {
  
  test('should process medium content within time limits', async () => {
    const mediumContent = '<p>' + 'Content '.repeat(10000) + '</p>';
    const html = `<html><body><article>${mediumContent}</article></body></html>`;
    
    const startTime = performance.now();
    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/medium',
      'Medium Article'
    );
    const processingTime = performance.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(processingTime).toBeLessThan(5000); // 5 seconds max
  });
  
  test('should handle concurrent processing requests', async () => {
    const html = '<html><body><h1>Test</h1><p>Content</p></body></html>';
    
    const promises = Array.from({ length: 5 }, (_, i) =>
      OfflineModeManager.processContent(
        html,
        `https://example.com/concurrent-${i}`,
        `Concurrent Test ${i}`
      )
    );
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Test');
    });
  });
  
});

// Export test utilities for manual testing
export const TestUtils = {
  generateTestHtml: (size: number) => {
    const content = '<p>' + 'Test content '.repeat(size) + '</p>';
    return `<html><body><article>${content}</article></body></html>`;
  },
  
  runManualTest: async (html: string, url: string, title: string) => {
    console.log('Running manual test...');
    const result = await OfflineModeManager.processContent(html, url, title);
    console.log('Result:', result);
    
    const qualityReport = ContentQualityValidator.validate(
      result.markdown,
      html,
      result.processingStats
    );
    console.log('Quality Report:', qualityReport);
    
    return { result, qualityReport };
  },
};
