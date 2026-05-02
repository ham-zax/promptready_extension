import type { Settings } from './types.js';

export type ContentStrategyId = 'auto' | 'article' | 'technical' | 'academic' | 'thread';
export type OutputFormatId = 'clean-markdown' | 'github' | 'obsidian' | 'notion';

export interface ProcessingChoice {
  id: ContentStrategyId | OutputFormatId;
  name: string;
  description: string;
}

export interface ResolvedProcessingConfig {
  profile: string;
  contentStrategy: ContentStrategyId;
  outputFormat: OutputFormatId;
  readabilityPreset: string;
  turndownPreset: string;
}

type ProcessingSettingsInput = Partial<NonNullable<Settings['processing']>> | undefined;

export const CONTENT_STRATEGIES: ProcessingChoice[] = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Detects the page type and chooses balanced extraction.',
  },
  {
    id: 'article',
    name: 'Article',
    description: 'For articles, blogs, essays, and editorial pages.',
  },
  {
    id: 'technical',
    name: 'Technical Docs',
    description: 'Preserves code, command snippets, API references, and tables.',
  },
  {
    id: 'academic',
    name: 'Academic',
    description: 'Keeps citations, references, footnotes, and dense structure.',
  },
  {
    id: 'thread',
    name: 'Thread / Social',
    description: 'For posts, comments, forum threads, and conversations.',
  },
];

export const OUTPUT_FORMATS: ProcessingChoice[] = [
  {
    id: 'clean-markdown',
    name: 'Clean Markdown',
    description: 'Portable Markdown for prompts, notes, and documents.',
  },
  {
    id: 'github',
    name: 'GitHub Markdown',
    description: 'GFM-style code fences, alerts, and tables.',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Markdown shaped for Obsidian notes and embeds.',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Markdown shaped for Notion import.',
  },
];

const LEGACY_PROFILE_MAP: Record<string, ResolvedProcessingConfig> = {
  standard: {
    profile: 'standard',
    contentStrategy: 'auto',
    outputFormat: 'clean-markdown',
    readabilityPreset: 'standard',
    turndownPreset: 'standard',
  },
  technical: {
    profile: 'technical',
    contentStrategy: 'technical',
    outputFormat: 'github',
    readabilityPreset: 'technical-documentation',
    turndownPreset: 'github',
  },
  academic: {
    profile: 'academic',
    contentStrategy: 'academic',
    outputFormat: 'clean-markdown',
    readabilityPreset: 'academic-paper',
    turndownPreset: 'academic',
  },
  social: {
    profile: 'social',
    contentStrategy: 'thread',
    outputFormat: 'clean-markdown',
    readabilityPreset: 'forum-discussion',
    turndownPreset: 'standard',
  },
  obsidian: {
    profile: 'obsidian',
    contentStrategy: 'auto',
    outputFormat: 'obsidian',
    readabilityPreset: 'standard',
    turndownPreset: 'obsidian',
  },
  notion: {
    profile: 'notion',
    contentStrategy: 'auto',
    outputFormat: 'notion',
    readabilityPreset: 'standard',
    turndownPreset: 'notion',
  },
};

const CONTENT_STRATEGY_PRESETS: Record<ContentStrategyId, string> = {
  auto: 'standard',
  article: 'blog-article',
  technical: 'technical-documentation',
  academic: 'academic-paper',
  thread: 'forum-discussion',
};

const OUTPUT_FORMAT_PRESETS: Record<OutputFormatId, string> = {
  'clean-markdown': 'standard',
  github: 'github',
  obsidian: 'obsidian',
  notion: 'notion',
};

const CONTENT_STRATEGY_IDS = new Set<ContentStrategyId>(
  CONTENT_STRATEGIES.map((item) => item.id as ContentStrategyId)
);
const OUTPUT_FORMAT_IDS = new Set<OutputFormatId>(
  OUTPUT_FORMATS.map((item) => item.id as OutputFormatId)
);

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeContentStrategy(value: unknown, fallback: ContentStrategyId): ContentStrategyId {
  const candidate = normalizeId(value) as ContentStrategyId;
  return CONTENT_STRATEGY_IDS.has(candidate) ? candidate : fallback;
}

function normalizeOutputFormat(value: unknown, fallback: OutputFormatId): OutputFormatId {
  const candidate = normalizeId(value) as OutputFormatId;
  return OUTPUT_FORMAT_IDS.has(candidate) ? candidate : fallback;
}

function legacyConfigFor(profile: unknown): ResolvedProcessingConfig {
  const candidate = normalizeId(profile);
  return LEGACY_PROFILE_MAP[candidate] || LEGACY_PROFILE_MAP.standard;
}

function profileFor(contentStrategy: ContentStrategyId, outputFormat: OutputFormatId): string {
  if (outputFormat === 'obsidian' || outputFormat === 'notion') {
    return outputFormat;
  }
  if (contentStrategy === 'technical') return 'technical';
  if (contentStrategy === 'academic') return 'academic';
  if (contentStrategy === 'thread') return 'social';
  return 'standard';
}

export function normalizeProcessingSettings<T extends ProcessingSettingsInput>(processing: T): ResolvedProcessingConfig {
  const legacy = legacyConfigFor(processing?.profile);
  const contentStrategy = normalizeContentStrategy((processing as any)?.contentStrategy, legacy.contentStrategy);
  const outputFormat = normalizeOutputFormat((processing as any)?.outputFormat, legacy.outputFormat);
  const profile = profileFor(contentStrategy, outputFormat);
  const readabilityPreset = CONTENT_STRATEGY_PRESETS[contentStrategy];
  let turndownPreset = OUTPUT_FORMAT_PRESETS[outputFormat];

  if (contentStrategy === 'technical' && outputFormat === 'clean-markdown') {
    turndownPreset = 'github';
  }

  if (contentStrategy === 'academic' && outputFormat === 'clean-markdown') {
    turndownPreset = 'academic';
  }

  return {
    profile,
    contentStrategy,
    outputFormat,
    readabilityPreset,
    turndownPreset,
  };
}

export function resolveProcessingConfig(processing: ProcessingSettingsInput): ResolvedProcessingConfig {
  return normalizeProcessingSettings(processing);
}
