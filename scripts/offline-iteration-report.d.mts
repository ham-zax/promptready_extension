export interface MarkdownRecord {
  file: string;
  content: string;
}

export interface IterationSummaryFile {
  file: string;
  bytes: number;
  lines: number;
  sha256: string;
}

export interface IterationSummaryTotals {
  files: number;
  totalBytes: number;
  totalLines: number;
}

export interface IterationSummary {
  generatedAt: string;
  files: IterationSummaryFile[];
  totals: IterationSummaryTotals;
}

export interface IterationSummaryDiffChanged {
  file: string;
  previousSha256: string;
  currentSha256: string;
  byteDelta: number;
  lineDelta: number;
}

export interface IterationSummaryDiff {
  added: IterationSummaryFile[];
  removed: IterationSummaryFile[];
  changed: IterationSummaryDiffChanged[];
  unchanged: IterationSummaryFile[];
}

export function summarizeRecords(records: MarkdownRecord[]): {
  files: IterationSummaryFile[];
  totals: IterationSummaryTotals;
};

export function diffSummaries(
  previousSummary: { files: IterationSummaryFile[] },
  currentSummary: { files: IterationSummaryFile[] }
): IterationSummaryDiff;

export function buildIterationSummaryFromRecords(
  records: MarkdownRecord[],
  generatedAt?: string
): IterationSummary;
