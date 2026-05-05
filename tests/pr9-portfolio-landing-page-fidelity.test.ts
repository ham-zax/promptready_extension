import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';
import { loadOfflineWebsiteCase, readOfflineWebsiteFixture } from './helpers/offline-website-harness';

const baseConfig = {
  turndownPreset: 'standard' as const,
  postProcessing: {
    enabled: false,
    addTableOfContents: false,
    optimizeForPlatform: 'standard' as const,
  },
  performance: {
    maxContentLength: 1_000_000,
    enableCaching: false,
    chunkSize: 100_000,
  },
  fallbacks: {
    enableReadabilityFallback: true,
    enableTurndownFallback: true,
    maxRetries: 1,
  },
  extractionTuning: {
    mode: 'balanced' as const,
    slider: 50,
    minTextLength: 80,
    highQualityThreshold: 0.8,
    lowQualityPenalty: 20,
  },
};

const portfolioCase = loadOfflineWebsiteCase('portfolio-landing');

describe('PR9 Portfolio and Landing Page Fidelity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures multi-section portfolio pages without dropping blog, contact, CTAs, forms, or footer links', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: `
        <article>
          <h1>Flutter Developer and Product Builder</h1>
          <p>I build reliable mobile apps and clean developer tools.</p>
          <h2>About</h2>
          <p>Portfolio pages need section-preserving capture.</p>
          <h2>Projects</h2>
          <p>PromptReady Extension</p>
        </article>
      `,
    });

    const result = await OfflineModeManager.processContent(
      readOfflineWebsiteFixture(portfolioCase),
      portfolioCase.url,
      portfolioCase.title,
      baseConfig
    );

    expect(result.processingStats.extractionDiagnostics?.pageType?.profile).toBe('landing-page');

    expect(result.markdown).toContain('Latest Blog Posts');
    expect(result.markdown).toContain('Shipping Offline-First Capture');
    expect(result.markdown).toContain('Flutter State Patterns');
    expect(result.markdown).toContain('Email: hamza@example.com');
    expect(result.markdown).toContain('Phone: +1 555 0100');
    expect(result.markdown).toContain('Location: San Francisco, CA');
    expect(result.markdown).toContain('[GitHub](https://github.com/hamza)');
    expect(result.markdown).toContain('[LinkedIn](https://linkedin.com/in/hamza)');
    expect(result.markdown).toContain('[Hire me](mailto:hamza@example.com)');
    expect(result.markdown).toContain('[Download Resume](https://hamza.dev/resume.pdf)');
    expect(result.markdown).toContain('[Privacy](https://hamza.dev/privacy)');
    expect(result.markdown).toContain('[Uses](https://hamza.dev/uses)');
    expect(result.markdown).toContain('[Now](https://hamza.dev/now)');
    expect(result.markdown).toContain('Name: Your name');
    expect(result.markdown).toContain('Email: you@example.com');
    expect(result.markdown).toContain('Message: Project details');
    expect(result.markdown).toContain('Send Message');

    expect(result.markdown).toContain('- Mobile Development');
    expect(result.markdown).toContain('- Clean Code');
    expect(result.markdown).toContain('- Problem Solver');
    expect(result.markdown).toContain('- Flutter');
    expect(result.markdown).toContain('- Dart');
    expect(result.markdown).toContain('- GetX');
    expect(result.markdown).toContain('- Bloc');
    expect(result.markdown).toContain('- Provider');
    expect(result.markdown).toContain('- RESTful API');
    expect(result.markdown).not.toContain('-->');
  });

  it('does not classify a normal article on a root URL as a landing page', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: `
        <article>
          <h1>How Offline Capture Works</h1>
          <p>This article explains the capture pipeline in detail with long-form prose and no portfolio sections.</p>
          <p>The page has a root-like URL but it is still a normal editorial article, not a landing page.</p>
          <p>Extraction should preserve the article body without switching to a section-preserving portfolio profile.</p>
        </article>
      `,
    });

    const articleHtml = `
      <!doctype html>
      <html>
        <body>
          <article>
            <h1>How Offline Capture Works</h1>
            <p>This article explains the capture pipeline in detail with long-form prose and no portfolio sections.</p>
            <p>The page has a root-like URL but it is still a normal editorial article, not a landing page.</p>
            <p>Extraction should preserve the article body without switching to a section-preserving portfolio profile.</p>
          </article>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      articleHtml,
      'https://example.com/',
      'How Offline Capture Works',
      baseConfig
    );

    expect(result.processingStats.extractionDiagnostics?.pageType?.profile).not.toBe('landing-page');
    expect(result.processingStats.strategyWinner).not.toBe('generic:landing-page');
    expect(result.markdown).toContain('How Offline Capture Works');
    expect(result.markdown).toContain('normal editorial article');
  });
});
