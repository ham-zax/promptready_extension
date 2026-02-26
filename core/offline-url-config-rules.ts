export interface UrlConfigRuleConfig {
  readabilityPreset?: string;
  turndownPreset: string;
  postProcessing: {
    enabled: boolean;
    addTableOfContents: boolean;
    optimizeForPlatform?: 'standard' | 'obsidian' | 'github';
  };
}

interface UrlRuleContext {
  normalizedUrl: string;
  hostname: string;
}

interface UrlConfigRule<T extends UrlConfigRuleConfig> {
  id: string;
  match: (context: UrlRuleContext) => boolean;
  apply: (config: T) => void;
}

function toHostname(normalizedUrl: string): string {
  try {
    return new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    return normalizedUrl;
  }
}

const URL_CONFIG_RULES: Array<UrlConfigRule<UrlConfigRuleConfig>> = [
  {
    id: 'reddit',
    match: ({ normalizedUrl, hostname }) => hostname.endsWith('reddit.com') || normalizedUrl.includes('reddit.com'),
    apply: (config) => {
      config.readabilityPreset = 'reddit-post';
      config.turndownPreset = 'standard';
      config.postProcessing = {
        ...config.postProcessing,
        addTableOfContents: false,
        optimizeForPlatform: 'standard',
      };
    },
  },
  {
    id: 'technical-docs',
    match: ({ normalizedUrl, hostname }) =>
      hostname.endsWith('github.com') ||
      hostname.startsWith('docs.') ||
      hostname.startsWith('api.') ||
      normalizedUrl.includes('/docs/'),
    apply: (config) => {
      config.readabilityPreset = 'technical-documentation';
      config.turndownPreset = 'github';
      config.postProcessing.optimizeForPlatform = 'github';
    },
  },
  {
    id: 'blog',
    match: ({ normalizedUrl, hostname }) =>
      hostname.startsWith('blog.') ||
      hostname.endsWith('medium.com') ||
      hostname.endsWith('substack.com') ||
      normalizedUrl.includes('/blog/'),
    apply: (config) => {
      config.readabilityPreset = 'blog-article';
      config.turndownPreset = 'standard';
      config.postProcessing.addTableOfContents = true;
    },
  },
  {
    id: 'wiki',
    match: ({ normalizedUrl, hostname }) =>
      hostname.endsWith('wikipedia.org') ||
      normalizedUrl.includes('/wiki/'),
    apply: (config) => {
      config.readabilityPreset = 'wiki-content';
      config.turndownPreset = 'standard';
      config.postProcessing.addTableOfContents = true;
    },
  },
];

export function applyOfflineUrlConfigRule<T extends UrlConfigRuleConfig>(
  url: string,
  config: T,
): string | null {
  const normalizedUrl = (url || '').toLowerCase();
  const context: UrlRuleContext = {
    normalizedUrl,
    hostname: toHostname(normalizedUrl),
  };

  const matchedRule = URL_CONFIG_RULES.find((rule) => rule.match(context));
  if (!matchedRule) {
    return null;
  }

  matchedRule.apply(config);
  return matchedRule.id;
}
