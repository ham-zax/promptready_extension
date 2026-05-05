import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOfflineWebsiteManifest } from './helpers/offline-website-harness';

describe('Offline website manifest contract', () => {
  it('keeps fixture paths local, existing, and uniquely identified', () => {
    const manifest = loadOfflineWebsiteManifest();
    const seen = new Set<string>();

    for (const fixture of manifest.cases) {
      expect(seen.has(fixture.id), `${fixture.id} should be unique`).toBe(false);
      seen.add(fixture.id);

      const absoluteFixturePath = path.resolve(process.cwd(), fixture.fixturePath);
      const relativeFixturePath = path.relative(process.cwd(), absoluteFixturePath);
      expect(
        relativeFixturePath.startsWith('..') || path.isAbsolute(relativeFixturePath),
        `${fixture.id} fixturePath should not escape repo root`
      ).toBe(false);
      expect(existsSync(absoluteFixturePath), `${fixture.id} fixture should exist`).toBe(true);

      expect(Array.isArray(fixture.requiredSnippets), `${fixture.id} requiredSnippets`).toBe(true);
      expect(Array.isArray(fixture.forbiddenSnippets), `${fixture.id} forbiddenSnippets`).toBe(true);
    }
  });

  it('marks every case as refreshable or pinned/manual', () => {
    const manifest = loadOfflineWebsiteManifest();

    for (const fixture of manifest.cases) {
      expect(fixture.capture, `${fixture.id} capture marker`).toBeDefined();
      expect(typeof fixture.capture?.enabled, `${fixture.id} capture.enabled`).toBe('boolean');

      if (fixture.capture?.enabled) {
        expect(['raw', 'rendered'], `${fixture.id} capture.mode`).toContain(fixture.capture.mode);
        expect(fixture.capture.reason, `${fixture.id} refreshable reason`).toBeUndefined();
      } else {
        expect(fixture.capture?.reason, `${fixture.id} pinned/manual reason`).toEqual(
          expect.any(String)
        );
        expect(fixture.capture?.reason?.trim().length, `${fixture.id} pinned/manual reason`).toBeGreaterThan(0);
      }
    }
  });
});
