import byokProcessingPromptTemplate from './byok-processing-prompt.md?raw';

export interface ByokPromptInput {
  html: string;
  url: string;
  title: string;
  capturedAt?: string;
  selectionHash?: string;
  metadataHtml?: string;
  customPrompt?: string;
}

const MAX_HTML_CHARS = 120_000;
const MAX_METADATA_HTML_CHARS = 20_000;
const MAX_CUSTOM_PROMPT_CHARS = 1_000;

function pruneHtmlForPrompt(html: string): string {
  const normalized = (html || '').trim();
  if (!normalized) {
    return '';
  }

  const withoutStyleTags = normalized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const withoutNonJsonLdScripts = withoutStyleTags.replace(
    /<script\b(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi,
    '',
  );
  const withoutNoscriptTags = withoutNonJsonLdScripts.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

  return withoutNoscriptTags.replace(/\n{3,}/g, '\n\n').trim();
}

function trimToNonEmpty(value: string | undefined, fallback: string): string {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function trimPayloadForPrompt(
  payload: string | undefined,
  maxChars: number,
  truncationMarker: string,
  fallback = 'n/a',
): string {
  const normalized = (payload || '').trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}\n\n<!-- ${truncationMarker}:${normalized.length - maxChars} -->`;
}

function normalizeCustomPromptPreference(customPrompt: string | undefined): string {
  const normalized = (customPrompt || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return 'n/a';
  }

  if (normalized.length <= MAX_CUSTOM_PROMPT_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_CUSTOM_PROMPT_CHARS)}\n\n<!-- PROMPTREADY_CUSTOM_PROMPT_TRUNCATED:${normalized.length - MAX_CUSTOM_PROMPT_CHARS} -->`;
}

export function buildByokPrompt(input: ByokPromptInput): string {
  const replacements: Record<string, string> = {
    SOURCE_TITLE: trimToNonEmpty(input.title, 'Untitled'),
    SOURCE_URL: trimToNonEmpty(input.url, 'about:blank'),
    CAPTURED_AT: trimToNonEmpty(input.capturedAt, new Date().toISOString()),
    SELECTION_HASH: trimToNonEmpty(input.selectionHash, 'n/a'),
    USER_CUSTOM_PROMPT: normalizeCustomPromptPreference(input.customPrompt),
    METADATA_HTML: trimPayloadForPrompt(
      input.metadataHtml,
      MAX_METADATA_HTML_CHARS,
      'PROMPTREADY_METADATA_HTML_TRUNCATED',
    ),
    HTML_CONTENT: trimPayloadForPrompt(
      pruneHtmlForPrompt(input.html),
      MAX_HTML_CHARS,
      'PROMPTREADY_HTML_TRUNCATED',
    ),
  };

  let prompt = byokProcessingPromptTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  return prompt;
}
