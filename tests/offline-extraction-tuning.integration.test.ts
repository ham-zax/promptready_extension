import { describe, expect, it } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { DEFAULT_EXTRACTION_TUNING } from '../core/domain/extraction/policies';

describe('offline extraction tuning integration', () => {
  it('applies valid extraction tuning from processing settings', async () => {
    const settings = {
      processing: {
        profile: 'standard',
        readabilityPreset: 'standard',
        turndownPreset: 'standard',
        extractionTuning: {
          mode: 'max_retention',
          slider: 82,
        },
      },
    };

    const config = await OfflineModeManager.getOptimalConfig('https://example.com/article', settings);
    expect(config.extractionTuning).toEqual({
      mode: 'max_retention',
      slider: 82,
    });
  });

  it('normalizes invalid extraction tuning from settings to default', async () => {
    const settings = {
      processing: {
        profile: 'standard',
        readabilityPreset: 'standard',
        turndownPreset: 'standard',
        extractionTuning: {
          mode: 'invalid',
          slider: 999,
        },
      },
    };

    const config = await OfflineModeManager.getOptimalConfig('https://example.com/article', settings);
    expect(config.extractionTuning).toEqual(DEFAULT_EXTRACTION_TUNING);
  });

  it('fails closed for invalid custom config extraction tuning at processing time', async () => {
    const html = '<html><body><article><h1>Title</h1><p>Body content.</p></article></body></html>';
    await expect(
      OfflineModeManager.processContent(html, 'https://example.com/article', 'Title', {
        extractionTuning: {
          mode: 'balanced',
          slider: 500,
        } as any,
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      })
    ).rejects.toThrow('Invalid extraction tuning');
  });
});
