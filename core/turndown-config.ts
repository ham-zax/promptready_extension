// Enhanced Turndown.js configuration for optimal markdown conversion
// Provides custom rules and presets for different output formats

import TurndownService from '@joplin/turndown';

// Type definitions for TurndownService
type TurndownOptions = {
  headingStyle?: 'setext' | 'atx';
  hr?: string;
  bulletListMarker?: '-' | '+' | '*';
  codeBlockStyle?: 'indented' | 'fenced';
  fence?: string;
  emDelimiter?: '_' | '*';
  strongDelimiter?: '**' | '__';
  linkStyle?: 'inlined' | 'referenced';
  linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  br?: string;
  preformattedCode?: boolean;
  blankReplacement?: (content: string, node: Node) => string;
  keepReplacement?: (content: string, node: Node) => string;
  defaultReplacement?: (content: string, node: Node) => string;
};

type TurndownFilter = string | string[] | ((node: Node) => boolean);
type TurndownReplacementFunction = (content: string, node: Node) => string;

export interface TurndownPreset {
  name: string;
  description: string;
  config: TurndownOptions;
  customRules: CustomRule[];
  enableGfm: boolean;
  postProcessors: PostProcessor[];
}

export interface CustomRule {
  name: string;
  filter: TurndownFilter;
  replacement: TurndownReplacementFunction;
  priority?: number;
}

export interface PostProcessor {
  name: string;
  process: (markdown: string) => string;
}

export class TurndownConfigManager {
  
  // Base configuration optimized for clean markdown output
  private static readonly BASE_CONFIG: TurndownOptions = {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    br: '  \n',
    preformattedCode: false,
    blankReplacement: (content: string, node: any) => {
      return node.isBlock ? '\n\n' : '';
    },
    keepReplacement: (content: string, node: any) => {
      return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML;
    },
    defaultReplacement: (content: string, node: any) => {
      return node.isBlock ? '\n\n' + content + '\n\n' : content;
    },
  };

  // Predefined presets for different use cases
  private static readonly PRESETS: TurndownPreset[] = [
    {
      name: 'standard',
      description: 'Standard markdown output for general content',
      config: {
        ...TurndownConfigManager.BASE_CONFIG,
      },
      customRules: [
        {
          name: 'enhancedCodeBlocks',
          filter: ['pre'],
          replacement: (content: string, node: any) => {
            const codeElement = node.querySelector('code');
            const language = codeElement?.className?.match(/(?:language-|lang-)(\w+)/)?.[1] || '';
            const cleanContent = content.replace(/^\n+|\n+$/g, '');
            return `\n\n\`\`\`${language}\n${cleanContent}\n\`\`\`\n\n`;
          },
        },
        {
          name: 'inlineCode',
          filter: ['code'],
          replacement: (content: string, node: any) => {
            // Don't process code inside pre blocks
            if (node.parentNode.nodeName === 'PRE') {
              return content;
            }
            return `\`${content}\``;
          },
        },
        {
          name: 'enhancedImages',
          filter: 'img',
          replacement: (content: string, node: any) => {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            const title = node.getAttribute('title');
            
            if (!src) return '';
            
            let markdown = `![${alt}](${src}`;
            if (title) {
              markdown += ` "${title}"`;
            }
            markdown += ')';
            
            return markdown;
          },
        },
      ],
      enableGfm: true,
      postProcessors: [
        {
          name: 'cleanupWhitespace',
          process: (markdown: string) => {
            return markdown
              .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
              .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
              .trim();
          },
        },
      ],
    },
    {
      name: 'obsidian',
      description: 'Optimized for Obsidian note-taking app',
      config: {
        ...TurndownConfigManager.BASE_CONFIG,
        linkStyle: 'inlined',
      },
      customRules: [
        {
          name: 'obsidianImages',
          filter: 'img',
          replacement: (content: string, node: any) => {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            
            if (!src) return '';
            
            // Use Obsidian's image syntax
            return `![[${src}|${alt}]]`;
          },
        },
        {
          name: 'obsidianLinks',
          filter: 'a',
          replacement: (content: string, node: any) => {
            const href = node.getAttribute('href') || '';
            
            if (!href) return content;
            
            // Internal links use Obsidian syntax
            if (href.startsWith('#') || href.startsWith('/')) {
              return `[[${content}]]`;
            }
            
            // External links use standard markdown
            return `[${content}](${href})`;
          },
        },
        {
          name: 'obsidianHighlights',
          filter: (node: any) => {
            return node.nodeName === 'MARK' || 
                   node.classList?.contains('highlight') ||
                   node.style?.backgroundColor;
          },
          replacement: (content: string) => {
            return `==${content}==`;
          },
        },
      ],
      enableGfm: true,
      postProcessors: [
        {
          name: 'obsidianFormatting',
          process: (markdown: string) => {
            return markdown
              .replace(/\n{3,}/g, '\n\n')
              .replace(/^#{7,}/gm, '######') // Limit heading levels
              .trim();
          },
        },
      ],
    },
    {
      name: 'github',
      description: 'Optimized for GitHub README and documentation',
      config: {
        ...TurndownConfigManager.BASE_CONFIG,
        linkStyle: 'inlined',
        codeBlockStyle: 'fenced',
      },
      customRules: [
        {
          name: 'githubCodeBlocks',
          filter: ['pre'],
          replacement: (content: string, node: any) => {
            const codeElement = node.querySelector('code');
            const language = codeElement?.className?.match(/(?:language-|lang-)(\w+)/)?.[1] || '';
            const cleanContent = content.replace(/^\n+|\n+$/g, '');
            
            // Use GitHub-style language hints
            const githubLanguage = TurndownConfigManager.mapToGitHubLanguage(language);
            return `\n\n\`\`\`${githubLanguage}\n${cleanContent}\n\`\`\`\n\n`;
          },
        },
        {
          name: 'githubAlerts',
          filter: (node: any) => {
            return node.classList?.contains('alert') ||
                   node.classList?.contains('warning') ||
                   node.classList?.contains('note') ||
                   node.classList?.contains('tip');
          },
          replacement: (content: string, node: any) => {
            const type = node.className.match(/(alert|warning|note|tip)/)?.[1] || 'note';
            const alertType = type.toUpperCase();
            return `\n\n> [!${alertType}]\n> ${content.replace(/\n/g, '\n> ')}\n\n`;
          },
        },
        {
          name: 'githubTables',
          filter: 'table',
          replacement: (content: string, node: any) => {
            // Enhanced table processing for GitHub
            return `\n\n${content}\n\n`;
          },
        },
      ],
      enableGfm: true,
      postProcessors: [
        {
          name: 'githubFormatting',
          process: (markdown: string) => {
            return markdown
              .replace(/\n{3,}/g, '\n\n')
              .replace(/^(\s*)-(\s*)/gm, '$1- ') // Normalize list formatting
              .trim();
          },
        },
      ],
    },
    {
      name: 'minimal',
      description: 'Minimal markdown with basic formatting only',
      config: {
        ...TurndownConfigManager.BASE_CONFIG,
        linkStyle: 'inlined',
        codeBlockStyle: 'indented',
        fence: '',
      },
      customRules: [
        {
          name: 'minimalCode',
          filter: ['pre', 'code'],
          replacement: (content: string, node: any) => {
            if (node.nodeName === 'PRE') {
              return `\n\n    ${content.replace(/\n/g, '\n    ')}\n\n`;
            }
            return `\`${content}\``;
          },
        },
        {
          name: 'stripComplexElements',
          filter: ['figure', 'aside', 'details', 'summary'],
          replacement: (content: string) => {
            return content; // Just return the text content
          },
        },
      ],
      enableGfm: false,
      postProcessors: [
        {
          name: 'minimalCleanup',
          process: (markdown: string) => {
            return markdown
              .replace(/\n{3,}/g, '\n\n')
              .replace(/[*_]{3,}/g, '**') // Simplify emphasis
              .trim();
          },
        },
      ],
    },
  ];

  /**
   * Create a configured Turndown service instance
   */
  static createService(presetName: string = 'standard', customOptions?: Partial<TurndownOptions>): typeof TurndownService {
    const preset = this.getPreset(presetName);
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    // Merge custom options with preset config
    const config = { ...preset.config, ...customOptions };
    const turndown = new TurndownService(config);

    // Add GFM plugin if enabled
    if (preset.enableGfm) {
      this.addGfmPlugin(turndown);
    }

    // Add custom rules
    preset.customRules.forEach(rule => {
      turndown.addRule(rule.name, {
        filter: rule.filter,
        replacement: rule.replacement,
      });
    });

    return turndown;
  }

  /**
   * Convert HTML to markdown using specified preset
   */
  static async convert(
    html: string,
    presetName: string = 'standard',
    customOptions?: Partial<TurndownOptions>
  ): Promise<string> {
    try {
      const turndown = this.createService(presetName, customOptions);
      let markdown = turndown.turndown(html);

      // Apply post-processors
      const preset = this.getPreset(presetName);
      if (preset) {
        preset.postProcessors.forEach(processor => {
          markdown = processor.process(markdown);
        });
      }

      return markdown;
    } catch (error) {
      console.error('[TurndownConfig] Conversion failed:', error);
      throw error;
    }
  }

  /**
   * Get preset by name
   */
  private static getPreset(name: string): TurndownPreset | null {
    return this.PRESETS.find(preset => preset.name === name) || null;
  }

  /**
   * Get all available presets
   */
  static getAvailablePresets(): TurndownPreset[] {
    return [...this.PRESETS];
  }

  /**
   * Add GFM plugin to Turndown service
   */
  private static addGfmPlugin(turndown: typeof TurndownService): void {
    try {
      // Dynamic import to handle potential loading issues
      import('@joplin/turndown-plugin-gfm').then(gfmModule => {
        if (gfmModule.gfm) {
          turndown.use(gfmModule.gfm);
        }
      }).catch(error => {
        console.warn('[TurndownConfig] Failed to load GFM plugin:', error);
      });
    } catch (error) {
      console.warn('[TurndownConfig] GFM plugin not available:', error);
    }
  }

  /**
   * Map language identifiers to GitHub-supported languages
   */
  private static mapToGitHubLanguage(language: string): string {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'bash',
      'shell': 'bash',
      'yml': 'yaml',
      'md': 'markdown',
      'dockerfile': 'docker',
    };

    return languageMap[language.toLowerCase()] || language;
  }

  /**
   * Create a custom preset
   */
  static createCustomPreset(
    name: string,
    description: string,
    basePreset: string = 'standard',
    overrides: {
      config?: Partial<TurndownOptions>;
      customRules?: CustomRule[];
      postProcessors?: PostProcessor[];
      enableGfm?: boolean;
    } = {}
  ): TurndownPreset {
    const base = this.getPreset(basePreset);
    if (!base) {
      throw new Error(`Base preset not found: ${basePreset}`);
    }

    return {
      name,
      description,
      config: { ...base.config, ...overrides.config },
      customRules: [...base.customRules, ...(overrides.customRules || [])],
      enableGfm: overrides.enableGfm !== undefined ? overrides.enableGfm : base.enableGfm,
      postProcessors: [...base.postProcessors, ...(overrides.postProcessors || [])],
    };
  }

  /**
   * Validate markdown output quality
   */
  static validateMarkdown(markdown: string, originalHtml: string): {
    isValid: boolean;
    score: number;
    issues: string[];
    stats: {
      length: number;
      headings: number;
      codeBlocks: number;
      links: number;
      images: number;
    };
  } {
    const issues: string[] = [];
    let score = 100;

    // Calculate stats
    const stats = {
      length: markdown.length,
      headings: (markdown.match(/^#{1,6}\s/gm) || []).length,
      codeBlocks: (markdown.match(/```[\s\S]*?```/g) || []).length,
      links: (markdown.match(/\[.*?\]\(.*?\)/g) || []).length,
      images: (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length,
    };

    // Check for conversion issues
    if (markdown.length < originalHtml.length * 0.1) {
      issues.push('Excessive content loss during conversion');
      score -= 30;
    }

    if (markdown.includes('<') && markdown.includes('>')) {
      issues.push('HTML tags present in markdown output');
      score -= 20;
    }

    if (markdown.match(/\n{4,}/)) {
      issues.push('Excessive whitespace in output');
      score -= 10;
    }

    // Check structure preservation
    const originalHeadings = (originalHtml.match(/<h[1-6][^>]*>/gi) || []).length;
    if (stats.headings < originalHeadings * 0.5) {
      issues.push('Significant heading loss');
      score -= 15;
    }

    const originalCodeBlocks = (originalHtml.match(/<pre[^>]*>/gi) || []).length;
    if (originalCodeBlocks > 0 && stats.codeBlocks === 0) {
      issues.push('Code blocks not preserved');
      score -= 25;
    }

    return {
      isValid: score >= 70,
      score: Math.max(0, score),
      issues,
      stats,
    };
  }
}
