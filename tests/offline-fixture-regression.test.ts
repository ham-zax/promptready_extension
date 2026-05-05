import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import {
  assertOfflineWebsiteResult,
  loadOfflineWebsiteManifest,
  maybeDumpOfflineWebsiteMarkdown,
  normalizeOfflineWebsiteDynamicMetadata,
  readOfflineWebsiteFixture,
} from './helpers/offline-website-harness';

describe('Offline extractor fixture corpus regression', () => {
  const fixtureCases = loadOfflineWebsiteManifest().cases;

  beforeEach(async () => {
    await OfflineModeManager.clearCache();
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('Offline website corpus tests must not fetch live websites');
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const fixture of fixtureCases) {
    it(`extracts ${fixture.name} with quality gate`, async () => {
      const html = readOfflineWebsiteFixture(fixture);
      const config = await OfflineModeManager.getOptimalConfig(fixture.url);
      const result = await OfflineModeManager.processContent(html, fixture.url, fixture.title, {
        ...config,
        performance: {
          ...config.performance,
          enableCaching: false,
        },
      });

      expect(globalThis.fetch).not.toHaveBeenCalled();
      assertOfflineWebsiteResult(fixture, html, result);

      const normalized = normalizeOfflineWebsiteDynamicMetadata(result.markdown);
      if (process.env.UPDATE_FIXTURE_SNAPSHOTS === '1') {
        expect(normalized).toMatchSnapshot();
      }

      maybeDumpOfflineWebsiteMarkdown(fixture, result.markdown);
    }, 20000);
  }
});
