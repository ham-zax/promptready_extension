import type { ExportMetadata } from './types.js';
import { normalizeInlineCodeSpacing } from './markdown-inline-code-normalizer.js';
import { normalizeTechnicalMarkdownBlocks } from './markdown-technical-block-normalizer.js';

export function buildCanonicalMetadata(
  sourceMetadata: Partial<ExportMetadata> | undefined,
  fallback?: Partial<ExportMetadata>
): ExportMetadata {
  const source = sourceMetadata || {};
  const fallbackSource = fallback || {};
  return {
    title:
      typeof source.title === 'string' && source.title.trim()
        ? source.title.trim()
        : (fallbackSource.title || 'Untitled Page'),
    url:
      typeof source.url === 'string' && source.url.trim()
        ? source.url.trim()
        : (fallbackSource.url || 'Unknown URL'),
    capturedAt:
      typeof source.capturedAt === 'string' && source.capturedAt.trim()
        ? source.capturedAt
        : (fallbackSource.capturedAt || new Date().toISOString()),
    selectionHash:
      typeof source.selectionHash === 'string' && source.selectionHash.trim()
        ? source.selectionHash
        : (fallbackSource.selectionHash || `canonical-${Date.now()}`),
    publishedAt:
      typeof source.publishedAt === 'string' && source.publishedAt.trim()
        ? source.publishedAt
        : undefined,
    publishedAtText:
      typeof source.publishedAtText === 'string' && source.publishedAtText.trim()
        ? source.publishedAtText
        : undefined,
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt.trim()
        ? source.updatedAt
        : undefined,
    updatedAtText:
      typeof source.updatedAtText === 'string' && source.updatedAtText.trim()
        ? source.updatedAtText
        : undefined,
    byline:
      typeof source.byline === 'string' && source.byline.trim()
        ? source.byline.trim()
        : undefined,
  };
}

export function canonicalizeDeliveredMarkdown(
  markdown: string,
  metadata: ExportMetadata,
  warnings: string[] = []
): string {
  const normalizedMetadata: ExportMetadata = {
    title: metadata?.title || 'Untitled Page',
    url: metadata?.url || '',
    capturedAt: metadata?.capturedAt || new Date().toISOString(),
    selectionHash: metadata?.selectionHash || 'N/A',
    publishedAt: metadata?.publishedAt,
    publishedAtText: metadata?.publishedAtText,
    updatedAt: metadata?.updatedAt,
    updatedAtText: metadata?.updatedAtText,
    byline: metadata?.byline,
  };

  let result = normalizeUnicodeWhitespace(markdown || '');
  result = unwrapWholeDocumentMarkdownFence(result, warnings);
  // Strip ==highlights== as they are non-standard and can cause rendering issues
  result = result.replace(/==([^=\n]+)==/g, '$1');
  result = stripLeadingCitationBlock(result);
  result = sanitizeRiskyMarkdown(result, warnings);
  result = stripResidualUiNoiseLines(result, warnings);
  result = stripSkipLinkTitlePrelude(result, normalizedMetadata.title, warnings);
  result = normalizeMarkdownSpacing(result);
  result = normalizeTechnicalMarkdownBlocks(result, warnings);
  result = normalizeInlineCodeSpacing(result, warnings);
  result = normalizeMarkdownSpacing(result);
  result = ensurePrimaryHeading(result, normalizedMetadata.title);

  if (!result || result.trim().length === 0) {
    result = `# ${normalizedMetadata.title}`;
  }

  return insertCiteFirstBlock(result, normalizedMetadata);
}

export function unwrapWholeDocumentMarkdownFence(markdown: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let first = 0;
  while (first < lines.length && lines[first].trim() === '') {
    first++;
  }
  let last = lines.length - 1;
  while (last >= first && lines[last].trim() === '') {
    last--;
  }

  if (first >= last) {
    return markdown;
  }

  if (!/^```\s*(?:markdown|md)\s*$/i.test(lines[first].trim())) {
    return markdown;
  }
  if (lines[last].trim() !== '```') {
    return markdown;
  }

  warnings.push('Unwrapped whole-document markdown fence');
  return lines.slice(first + 1, last).join('\n');
}

function normalizeInputText(value: string): string {
  return normalizeUnicodeWhitespace(
    value
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<!\[cdata\[[\s\S]*?\]\]>/gi, ' ')
      .replace(/-->/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnicodeWhitespace(value: string): string {
  if (!value) {
    return '';
  }
  return value
    // Remove zero-width characters completely rather than replacing them with a space
    // to prevent breaking URLs that contain them (e.g., 'ww w.reddit.com')
    .replace(/(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E)/g, '')
    // Normalize other space-like characters to standard space
    .replace(/[\u00A0\u2000-\u200A\u2028\u2029]/g, ' ');
}

function stripLeadingCitationBlock(markdown: string): string {
  if (!markdown) {
    return markdown;
  }

  const lines = markdown.split('\n');
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') {
    index++;
  }
  if (index >= lines.length || !/^\s*>\s*source:/i.test(lines[index])) {
    return markdown;
  }

  index++;
  while (index < lines.length) {
    const line = lines[index];
    if (!/^\s*>/.test(line)) {
      break;
    }
    const text = line.replace(/^\s*>\s?/, '').trim().toLowerCase();
    if (
      !text ||
      text.startsWith('captured:') ||
      text.startsWith('hash:') ||
      text.startsWith('published:') ||
      text.startsWith('updated:') ||
      text.startsWith('by:')
    ) {
      index++;
      continue;
    }
    break;
  }

  while (index < lines.length && lines[index].trim() === '') {
    index++;
  }
  return lines.slice(index).join('\n');
}

function sanitizeRiskyMarkdown(markdown: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  const before = markdown;
  const sanitized = markdown
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:java\s*script|vb\s*script)\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'data:text/blocked')
    .replace(/\balert\s*\(/gi, 'blocked_call(')
    .replace(/%3c\/?script%3e/gi, ' ');

  if (sanitized !== before) {
    warnings.push('Sanitized potentially unsafe markdown payload');
  }
  return normalizeUnicodeWhitespace(sanitized);
}

function stripResidualUiNoiseLines(markdown: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  const lines = markdown.split('\n');
  const filtered = lines.filter((line) => {
    const normalized = normalizeInputText(line).toLowerCase();
    const trimmed = line.trim();

    if (!normalized) return true;
    if (/^#{1,6}\s/.test(trimmed)) return true;

    const isUiNoise =
      normalized.length <= 220 &&
      (/accept all .*cookies?|manage (cookie|privacy) preferences|allow all cookies/.test(normalized) ||
        /popup ad|tracking cookies? to continue/.test(normalized) ||
        /limit my search to|advanced search: by author|see the search faq|join reddit|view more:/.test(normalized));
    const isSocialActionLine =
      /^(share|save|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)$/i.test(trimmed) ||
      /^\[(share|save|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)\]\([^)]+\)$/i.test(trimmed);
    const isStandaloneMarker = trimmed === '*' || trimmed === '•';
    const isTrivialCounter = /^\d{1,6}$/.test(trimmed) || /^links from:?$/i.test(trimmed);

    return !(isUiNoise || isSocialActionLine || isStandaloneMarker || isTrivialCounter);
  });

  if (filtered.length !== lines.length) {
    warnings.push('Removed residual UI-noise lines from markdown');
  }
  return filtered.join('\n');
}

function stripSkipLinkTitlePrelude(markdown: string, title: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  const normalizedTitle = normalizeHeadingForComparison(title);
  const lines = markdown.split('\n');
  const output: string[] = [];
  let changed = false;
  let dropImmediateSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (dropImmediateSeparator) {
      if (!trimmed) {
        changed = true;
        continue;
      }
      if (trimmed.length >= 3 && [...trimmed].every((char) => char === '-')) {
        changed = true;
        dropImmediateSeparator = false;
        continue;
      }
      dropImmediateSeparator = false;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('[skip to main content](')) {
      const closeIndex = trimmed.indexOf(')');
      const remainderText = closeIndex === -1 ? '' : trimmed.slice(closeIndex + 1).trim();
      const remainder = normalizeHeadingForComparison(remainderText);
      const previousHeading = [...output]
        .reverse()
        .map((candidate) => {
          const previous = candidate.trim();
          return previous.startsWith('# ') ? previous.slice(2) : '';
        })
        .find(Boolean) || '';
      const normalizedPreviousHeading = normalizeHeadingForComparison(previousHeading);

      if (
        !remainder ||
        areHeadingsEquivalent(normalizedTitle, remainder) ||
        areHeadingsEquivalent(normalizedPreviousHeading, remainder)
      ) {
        changed = true;
        dropImmediateSeparator = true;
        continue;
      }
    }

    output.push(line);
  }

  if (changed) {
    warnings.push('Removed skip-link navigation prelude from markdown');
  }
  return output.join('\n');
}

function normalizeMarkdownSpacing(markdown: string): string {
  if (!markdown) {
    return markdown;
  }
  return markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+$/gm, '')
    .trim();
}

function normalizeHeadingForComparison(value: string): string {
  return normalizeInputText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areHeadingsEquivalent(source: string, candidate: string): boolean {
  if (!source || !candidate) return false;
  if (source === candidate) return true;
  if (source.length >= 20 && candidate.includes(source)) return true;
  if (candidate.length >= 20 && source.includes(candidate)) return true;
  return false;
}

function ensurePrimaryHeading(markdown: string, title: string): string {
  const normalizedTitle = normalizeInputText(title);
  if (!normalizedTitle) {
    return markdown;
  }

  const body = markdown.trimStart();
  if (!body) {
    return `# ${normalizedTitle}`;
  }

  const h1Match = body.match(/^#\s+(\S[^\n]*)$/m);
  if (
    h1Match &&
    areHeadingsEquivalent(
      normalizeHeadingForComparison(normalizedTitle),
      normalizeHeadingForComparison(h1Match[1])
    )
  ) {
    return markdown;
  }

  return `# ${normalizedTitle}\n\n${markdown}`;
}

function formatMetadataTimestamp(value?: string): string {
  if (!value) {
    return '';
  }
  const normalized = normalizeInputText(value);
  if (!normalized) {
    return '';
  }
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return normalized;
}

function insertCiteFirstBlock(markdown: string, metadata: ExportMetadata): string {
  let result = markdown.trim();
  const title = (metadata.title || 'Untitled Page').trim();
  const url = (metadata.url || '').trim() || 'Unknown URL';
  const hash = (metadata.selectionHash || 'N/A').trim() || 'N/A';

  const captured = formatMetadataTimestamp(metadata.capturedAt) || new Date().toISOString();
  const published = formatMetadataTimestamp(metadata.publishedAt || metadata.publishedAtText);
  const updated = formatMetadataTimestamp(metadata.updatedAt || metadata.updatedAtText);
  const byline = normalizeInputText(metadata.byline || '');

  const citationLines = [`> Source: [${title}](${url})`, `> Captured: ${captured}`];
  if (published) {
    citationLines.push(`> Published: ${published}`);
  }
  if (updated) {
    citationLines.push(`> Updated: ${updated}`);
  }
  if (byline) {
    citationLines.push(`> By: ${byline}`);
  }
  citationLines.push(`> Hash: ${hash}`);

  const citationHeader = `${citationLines.join('\n')}\n\n`;
  const hasPrimaryHeading = /^#\s+/m.test(result);
  if (!hasPrimaryHeading) {
    result = `# ${title}\n\n${result.trimStart()}`;
  }

  return citationHeader + result;
}
