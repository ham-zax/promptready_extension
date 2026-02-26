import { describe, expect, it } from 'vitest';
import {
  buildIterationSummaryFromRecords,
  diffSummaries,
  summarizeRecords,
} from '../scripts/offline-iteration-report.mjs';

describe('offline iteration report', () => {
  it('summarizes markdown records deterministically', () => {
    const summary = summarizeRecords([
      { file: 'b.md', content: 'line1\nline2\n' },
      { file: 'a.md', content: '# Title\nbody' },
    ]);

    expect(summary.files.map((item) => item.file)).toEqual(['a.md', 'b.md']);
    expect(summary.totals.files).toBe(2);
    expect(summary.totals.totalLines).toBe(5);
    expect(summary.files[0]?.sha256).toHaveLength(64);
  });

  it('diffs previous and current summaries by hash/size/lines', () => {
    const previous = buildIterationSummaryFromRecords(
      [
        { file: 'a.md', content: '# Title\nbody' },
        { file: 'b.md', content: 'same' },
      ],
      '2026-02-01T00:00:00.000Z'
    );

    const current = buildIterationSummaryFromRecords(
      [
        { file: 'a.md', content: '# Title\nbody changed' },
        { file: 'c.md', content: 'new file' },
        { file: 'b.md', content: 'same' },
      ],
      '2026-02-02T00:00:00.000Z'
    );

    const diff = diffSummaries(previous, current);
    expect(diff.added.map((item) => item.file)).toEqual(['c.md']);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged.map((item) => item.file)).toEqual(['b.md']);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.file).toBe('a.md');
    expect(diff.changed[0]?.byteDelta).toBeGreaterThan(0);
  });
});
