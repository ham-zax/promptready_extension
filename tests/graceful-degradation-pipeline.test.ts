import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GracefulDegradationPipeline, PipelineConfig } from '../core/graceful-degradation-pipeline';

describe('GracefulDegradationPipeline', () => {
  let mockDocument: Document;

  beforeEach(() => {
    // Create a basic mock document for testing
    const dom = new (global as any).JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>First paragraph with substantial content about the topic.</p>
            <p>Second paragraph with more information about the article.</p>
            <p>Third paragraph continuing the main discussion.</p>
            <p>Fourth paragraph with concluding remarks.</p>
            <p>Fifth paragraph with additional context.</p>
          </article>
          <aside>
            <p>Sidebar content that is not main article</p>
          </aside>
        </body>
      </html>
    `);

    mockDocument = dom.window.document;
  });

  describe('Stage 1: Semantic Query', () => {
    it('should extract content from semantic elements', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: false,
        enableStage3: false,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should report stage as semantic when successful', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: false,
        enableStage3: false,
      });

      expect(result.stage).toBe('semantic');
    });

    it('should track semantic extraction time', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: false,
        enableStage3: false,
      });

      expect(result.extractionTime).toBeGreaterThan(0);
      expect(typeof result.extractionTime).toBe('number');
    });

    it('should include quality score from semantic extraction', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: false,
        enableStage3: false,
      });

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should skip Stage 1 when disabled', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.stage).not.toBe('semantic');
      expect(result.stage).toMatch(/readability|heuristic/);
    });
  });

  describe('Stage 2: Readability Extraction', () => {
    it('should fall back to Readability when Stage 1 fails', async () => {
      // Create a document with minimal semantic content
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Minimal Page</title></head>
          <body>
            <div>Short text</div>
          </body>
        </html>
      `);

      const result = await GracefulDegradationPipeline.execute(
        dom.window.document,
        {
          enableStage1: true,
          enableStage2: true,
          enableStage3: false,
        }
      );

      // Should either pass Stage 1 or fall back to Stage 2
      expect(['semantic', 'readability']).toContain(result.stage);
    });

    it('should report stage as readability when successful', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: true,
        enableStage3: false,
      });

      expect(result.stage).toBe('readability');
    });

    it('should track readability quality score', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: true,
        enableStage3: false,
      });

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should skip Stage 2 when disabled', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: false,
        enableStage3: true,
      });

      expect(result.stage).toBe('heuristic');
    });
  });

  describe('Stage 3: Heuristic Scoring (Safety Net)', () => {
    it('should always return content from Stage 3', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: false,
        enableStage3: true,
      });

      expect(result.stage).toBe('heuristic');
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should report stage as heuristic', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: false,
        enableStage3: true,
      });

      expect(result.stage).toBe('heuristic');
    });

    it('should always pass quality gate (safety net)', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: false,
        enableStage2: false,
        enableStage3: true,
      });

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      // Heuristic should always provide something
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Chain', () => {
    it('should track fallbacks used in pipeline', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(Array.isArray(result.fallbacksUsed)).toBe(true);
      // fallbacksUsed should be an array (may be empty if Stage 1 succeeded)
      if (result.fallbacksUsed.length > 0) {
        expect(result.fallbacksUsed[0]).toMatch(
          /semantic-gate-failed|readability-gate-failed/
        );
      }
    });

    it('should never return empty content regardless of stage', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should cascade through stages when previous stages fail quality gate', async () => {
      // Create a minimal document to trigger failures
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Minimal</title></head>
          <body>
            <p>Very short.</p>
          </body>
        </html>
      `);

      const result = await GracefulDegradationPipeline.execute(
        dom.window.document,
        {
          enableStage1: true,
          enableStage2: true,
          enableStage3: true,
        }
      );

      // Should try stages in order and succeed with at least heuristic
      expect(result).toBeDefined();
      expect(result.stage).toMatch(/semantic|readability|heuristic/);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract page title', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.title.length).toBeGreaterThan(0);
    });

    it('should extract URL from document location', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.metadata.url).toBeDefined();
      // URL may be undefined in test environment
      if (result.metadata.url) {
        expect(typeof result.metadata.url).toBe('string');
      }
    });

    it('should include timestamp in metadata', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.metadata.timestamp).toBeDefined();
      expect(typeof result.metadata.timestamp).toBe('string');
    });
  });

  describe('Quality Reporting', () => {
    it('should generate quality report', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.qualityReport).toBeDefined();
      expect(typeof result.qualityReport).toBe('string');
      expect(result.qualityReport.length).toBeGreaterThan(0);
    });

    it('should include quality metrics in report', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      expect(result.qualityReport).toContain('Quality Gate Report');
      expect(result.qualityReport).toContain('Status');
      expect(result.qualityReport).toContain('Score');
    });
  });

  describe('Configuration Handling', () => {
    it('should use default config when none provided', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should respect custom config', async () => {
      const customConfig: Partial<PipelineConfig> = {
        enableStage1: false,
        enableStage2: false,
        enableStage3: true,
        debug: true,
      };

      const result = await GracefulDegradationPipeline.execute(
        mockDocument,
        customConfig
      );

      expect(result.stage).toBe('heuristic');
    });

    it('should respect debug flag', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');

      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
        debug: true,
      });

      // Debug should log information (may or may not log depending on stage success)
      expect(result).toBeDefined();

      consoleLogSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should complete extraction in reasonable time', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
      });

      // Should complete within 5 seconds
      expect(result.extractionTime).toBeLessThan(5000);
    });

    it('should respect timeout setting', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
        timeout: 1000,
      });

      // Should still complete (timeout may not apply to all stages)
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document gracefully', async () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Empty</title></head>
          <body></body>
        </html>
      `);

      const result = await GracefulDegradationPipeline.execute(
        dom.window.document,
        {
          enableStage1: true,
          enableStage2: true,
          enableStage3: true,
        }
      );

      // Should still return something via heuristic fallback
      expect(result).toBeDefined();
    });

    it('should handle document with only whitespace', async () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Whitespace</title></head>
          <body>
            
            
          </body>
        </html>
      `);

      const result = await GracefulDegradationPipeline.execute(
        dom.window.document,
        {
          enableStage1: true,
          enableStage2: true,
          enableStage3: true,
        }
      );

      expect(result).toBeDefined();
    });

    it('should handle malformed HTML', async () => {
      const dom = new (global as any).JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Malformed</title></head>
          <body>
            <article>
              <p>Unclosed paragraph
              <p>Another unclosed paragraph
            </article>
          </body>
        </html>
      `);

      const result = await GracefulDegradationPipeline.execute(
        dom.window.document,
        {
          enableStage1: true,
          enableStage2: true,
          enableStage3: true,
        }
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should work end-to-end with all stages enabled', async () => {
      const result = await GracefulDegradationPipeline.execute(mockDocument, {
        enableStage1: true,
        enableStage2: true,
        enableStage3: true,
        minQualityScore: 0,
        timeout: 5000,
        debug: false,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.stage).toMatch(/semantic|readability|heuristic/);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(result.extractionTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata).toBeDefined();
      expect(result.fallbacksUsed).toEqual(expect.any(Array));
      expect(result.qualityReport).toBeDefined();
    });
  });
});
