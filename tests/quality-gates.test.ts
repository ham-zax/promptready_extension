
import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateValidator, QualityGateResult } from '../core/quality-gates';

describe('QualityGateValidator', () => {
  describe('validateSemanticQuery', () => {
    it('should pass high-quality semantic elements', () => {
      // Create a mock document with good semantic structure
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Main Article</h1>
              <p>Paragraph one with substantial content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              <p>Paragraph two with more content about the topic at hand.</p>
              <p>Paragraph three continuing the discussion with valuable information.</p>
              <p>Paragraph four providing additional context and details.</p>
            </article>
          </body>
        </html>
      `);
      
      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.failureReasons).toHaveLength(0);
      expect(result.metrics.characterCount).toBeGreaterThan(500);
      expect(result.metrics.paragraphCount).toBeGreaterThanOrEqual(2);
    });

    it('should fail on low character count', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Short.</p>
            </article>
          </body>
        </html>
      `);
      
      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);
      
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(60);
      expect(result.failureReasons.length).toBeGreaterThan(0);
    });

    it('should fail on insufficient paragraphs', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>One paragraph with some content that is decently long but only one.</p>
            </article>
          </body>
        </html>
      `);
      
      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);
      
      expect(result.passed).toBe(false);
      expect(result.failureReasons.some(r => r.includes('Insufficient paragraphs'))).toBe(true);
    });

    it('should fail on high link density', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p><a href="#">Link one</a> <a href="#">Link two</a> <a href="#">Link three</a></p>
              <p><a href="#">Link four</a> <a href="#">Link five</a> <a href="#">Link six</a></p>
              <p><a href="#">Link seven</a> <a href="#">Link eight</a> <a href="#">Link nine</a></p>
              <p><a href="#">Link ten</a> <a href="#">Link eleven</a> <a href="#">Link twelve</a></p>
            </article>
          </body>
        </html>
      `);
      
      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);
      
      expect(result.passed).toBe(false);
      expect(result.failureReasons.some(r => r.includes('link density'))).toBe(true);
    });

    it('should handle null element gracefully', () => {
      const result = QualityGateValidator.validateSemanticQuery(null);
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.metrics.characterCount).toBe(0);
    });
  });

  describe('validateReadability', () => {
    it('should pass well-formed Readability article', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="content">
              <h1>Article Title</h1>
              <p>Good paragraph one with substantial text content.</p>
              <p>Good paragraph two with more information.</p>
              <p>Good paragraph three continuing discussion.</p>
              <p>Good paragraph four with final thoughts.</p>
            </div>
          </body>
        </html>
      `);

      const article = {
        content: `
          <h1>Article Title</h1>
          <p>Good paragraph one with substantial text content.</p>
          <p>Good paragraph two with more information.</p>
          <p>Good paragraph three continuing discussion.</p>
          <p>Good paragraph four with final thoughts.</p>
        `,
        title: 'Test Article'
      };

      const result = QualityGateValidator.validateReadability(
        article,
        dom.window.document
      );

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.failureReasons).toHaveLength(0);
    });

    it('should fail when Readability returns no content', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html><body></body></html>
      `);

      const article = null;

      const result = QualityGateValidator.validateReadability(
        article,
        dom.window.document
      );

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.failureReasons).toContain('No content extracted by Readability');
    });

    it('should fail on low character count from Readability', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html><body></body></html>
      `);

      const article = {
        content: '<p>Too short.</p>',
        title: 'Short'
      };

      const result = QualityGateValidator.validateReadability(
        article,
        dom.window.document
      );

      expect(result.passed).toBe(false);
      expect(result.failureReasons.some(r => r.includes('Low character count'))).toBe(true);
    });

    it('should fail on high link density in Readability result', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html><body></body></html>
      `);

      const article = {
        content: `
          <p><a href="#">Link</a> <a href="#">Link</a> <a href="#">Link</a></p>
          <p><a href="#">Link</a> <a href="#">Link</a> <a href="#">Link</a></p>
          <p><a href="#">Link</a> <a href="#">Link</a> <a href="#">Link</a></p>
        `,
        title: 'Link Heavy'
      };

      const result = QualityGateValidator.validateReadability(
        article,
        dom.window.document
      );

      expect(result.passed).toBe(false);
      expect(result.failureReasons.some(r => r.includes('link density'))).toBe(true);
    });
  });

  describe('validateHeuristicScoring', () => {
    it('should always pass (safety net)', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <div>Any content at all</div>
          </body>
        </html>
      `);

      const element = dom.window.document.querySelector('body');
      const result = QualityGateValidator.validateHeuristicScoring(element);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should pass even on null element (fallback)', () => {
      const result = QualityGateValidator.validateHeuristicScoring(null);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('metric calculations', () => {
    it('should accurately calculate character count', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Hello World this is test content with exactly known length.</p>
              <p>Second paragraph for counting purposes.</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.metrics.characterCount).toBeGreaterThan(0);
      expect(typeof result.metrics.characterCount).toBe('number');
    });

    it('should calculate paragraph count', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
              <p>Paragraph 3</p>
              <p>Paragraph 4</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.metrics.paragraphCount).toBeGreaterThanOrEqual(4);
    });

    it('should calculate link density', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Text before <a href="#">link</a> text after</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.metrics.linkDensity).toBeGreaterThanOrEqual(0);
      expect(result.metrics.linkDensity).toBeLessThanOrEqual(1);
    });

    it('should calculate heading count', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Main Heading</h1>
              <h2>Sub Heading 1</h2>
              <p>Content</p>
              <h2>Sub Heading 2</h2>
              <p>More content</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.metrics.headingCount).toBeGreaterThanOrEqual(3);
    });

    it('should calculate signal-to-noise ratio', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Real content here</p>
              <p>More real content</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.metrics.signalToNoiseRatio).toBeGreaterThanOrEqual(0);
      expect(result.metrics.signalToNoiseRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('score generation', () => {
    it('should generate score between 0 and 100', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Test content that should generate a reasonable quality score.</p>
              <p>Additional paragraph for variety.</p>
              <p>Third paragraph for good measure.</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should generate reports without errors', () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Test content paragraph one.</p>
              <p>Test content paragraph two.</p>
              <p>Test content paragraph three.</p>
            </article>
          </body>
        </html>
      `);

      const article = dom.window.document.querySelector('article');
      const result = QualityGateValidator.validateSemanticQuery(article);

      const report = QualityGateValidator.generateReport(result);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('Quality Gate Report');
    });
  });
});
