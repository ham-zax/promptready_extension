// Enhanced Readability.js configuration for optimal content extraction
// Provides different presets for various content types and use cases

import { Readability } from '@mozilla/readability';

export interface ReadabilityConfig {
  debug: boolean;
  maxElemsToParse: number;
  nbTopCandidates: number;
  charThreshold: number;
  classesToPreserve: string[];
  keepClasses: boolean;
  serializer?: (node: Node) => string;
  disableJSONLD: boolean;
  allowedVideoRegex?: RegExp;
}

export interface ContentTypePreset {
  name: string;
  description: string;
  config: ReadabilityConfig;
  urlPatterns?: RegExp[];
}

export class ReadabilityConfigManager {
  
  // Default configuration optimized for general content
  private static readonly DEFAULT_CONFIG: ReadabilityConfig = {
    debug: false,
    maxElemsToParse: 0, // No limit
    nbTopCandidates: 5,
    charThreshold: 500,
    classesToPreserve: [
      'highlight',
      'code',
      'pre',
      'math',
      'equation',
      'formula',
      'syntax',
      'language-',
      'hljs',
      'codehilite',
      'sourceCode',
      'code-block',
    ],
    keepClasses: true,
    disableJSONLD: false,
  };

  // Preset configurations for different content types
  private static readonly PRESETS: ContentTypePreset[] = [
    {
      name: 'technical-documentation',
      description: 'Optimized for technical docs, API references, and code-heavy content',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 300, // Lower threshold for technical content
        nbTopCandidates: 8,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'api-',
          'method-',
          'parameter-',
          'example-',
          'snippet-',
          'terminal',
          'console',
          'output',
        ],
      },
      urlPatterns: [
        /docs?\./,
        /api\./,
        /developer\./,
        /github\.com/,
        /stackoverflow\.com/,
        /\.readthedocs\./,
      ],
    },
    {
      name: 'blog-article',
      description: 'Optimized for blog posts and articles',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 800, // Higher threshold for articles
        nbTopCandidates: 3,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'quote',
          'blockquote',
          'pullquote',
          'caption',
          'author',
          'byline',
        ],
      },
      urlPatterns: [
        /blog/,
        /article/,
        /post/,
        /medium\.com/,
        /substack\.com/,
      ],
    },
    {
      name: 'news-article',
      description: 'Optimized for news articles and journalism',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 600,
        nbTopCandidates: 4,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'dateline',
          'byline',
          'lead',
          'summary',
          'excerpt',
        ],
      },
      urlPatterns: [
        /news/,
        /\.com\/\d{4}\/\d{2}\/\d{2}/,
        /reuters\.com/,
        /bbc\.com/,
        /cnn\.com/,
        /nytimes\.com/,
      ],
    },
    {
      name: 'academic-paper',
      description: 'Optimized for academic papers and research content',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 400,
        nbTopCandidates: 6,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'abstract',
          'citation',
          'reference',
          'footnote',
          'figure',
          'table',
          'theorem',
          'proof',
          'definition',
        ],
      },
      urlPatterns: [
        /arxiv\.org/,
        /\.edu/,
        /researchgate\.net/,
        /scholar\.google/,
        /pubmed/,
      ],
    },
    {
      name: 'forum-discussion',
      description: 'Optimized for forum posts and discussions',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 200, // Lower threshold for forum posts
        nbTopCandidates: 10,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'post',
          'comment',
          'reply',
          'thread',
          'user',
          'username',
          'timestamp',
        ],
      },
      urlPatterns: [
        /reddit\.com/,
        /discourse\./,
        /forum/,
        /community/,
        /discuss/,
      ],
    },
    {
      name: 'wiki-content',
      description: 'Optimized for wiki pages and reference content',
      config: {
        ...ReadabilityConfigManager.DEFAULT_CONFIG,
        charThreshold: 500,
        nbTopCandidates: 5,
        classesToPreserve: [
          ...ReadabilityConfigManager.DEFAULT_CONFIG.classesToPreserve,
          'infobox',
          'navbox',
          'sidebar',
          'toc',
          'references',
          'external',
          'citation',
        ],
      },
      urlPatterns: [
        /wikipedia\.org/,
        /wiki/,
        /fandom\.com/,
        /wikia\.com/,
      ],
    },
  ];

  /**
   * Get the optimal Readability configuration for a given URL
   */
  static getConfigForUrl(url: string): ReadabilityConfig {
    try {
      const preset = this.detectContentType(url);
      if (preset) {
        console.log(`[ReadabilityConfig] Using preset: ${preset.name} for URL: ${url}`);
        return preset.config;
      }
    } catch (error) {
      console.warn('[ReadabilityConfig] Error detecting content type:', error);
    }

    console.log('[ReadabilityConfig] Using default configuration');
    return this.DEFAULT_CONFIG;
  }

  /**
   * Detect content type based on URL patterns
   */
  private static detectContentType(url: string): ContentTypePreset | null {
    for (const preset of this.PRESETS) {
      if (preset.urlPatterns) {
        for (const pattern of preset.urlPatterns) {
          if (pattern.test(url)) {
            return preset;
          }
        }
      }
    }
    return null;
  }

  /**
   * Get configuration by preset name
   */
  static getPresetConfig(presetName: string): ReadabilityConfig | null {
    const preset = this.PRESETS.find(p => p.name === presetName);
    return preset ? preset.config : null;
  }

  /**
   * Get all available presets
   */
  static getAvailablePresets(): ContentTypePreset[] {
    return [...this.PRESETS];
  }

  /**
   * Create a custom configuration with overrides
   */
  static createCustomConfig(baseConfig: ReadabilityConfig, overrides: Partial<ReadabilityConfig>): ReadabilityConfig {
    return {
      ...baseConfig,
      ...overrides,
      classesToPreserve: [
        ...(baseConfig.classesToPreserve || []),
        ...(overrides.classesToPreserve || []),
      ],
    };
  }

  /**
   * Enhanced content extraction with retry logic
   */
  static async extractContent(
    doc: Document,
    url: string,
    customConfig?: Partial<ReadabilityConfig>
  ): Promise<{ content: string; title?: string; excerpt?: string; byline?: string }> {
    
    // Get optimal configuration
    let config = this.getConfigForUrl(url);
    
    // Apply custom overrides if provided
    if (customConfig) {
      config = this.createCustomConfig(config, customConfig);
    }

    // Clone document to avoid modifying original
    const clonedDoc = doc.cloneNode(true) as Document;

    try {
      // First attempt with optimal configuration
      const reader = new Readability(clonedDoc, config);
      const article = reader.parse();

      if (article && article.content && article.content.length > config.charThreshold) {
        console.log('[ReadabilityConfig] Content extraction successful');
        return {
          content: article.content,
          title: article.title,
          excerpt: article.excerpt,
          byline: article.byline,
        };
      }

      console.log('[ReadabilityConfig] First attempt yielded insufficient content, trying fallback');
      
      // Fallback: Try with more lenient settings
      const fallbackConfig = this.createCustomConfig(config, {
        charThreshold: Math.max(200, config.charThreshold * 0.5),
        nbTopCandidates: Math.min(10, config.nbTopCandidates + 3),
      });

      const fallbackReader = new Readability(doc.cloneNode(true) as Document, fallbackConfig);
      const fallbackArticle = fallbackReader.parse();

      if (fallbackArticle && fallbackArticle.content) {
        console.log('[ReadabilityConfig] Fallback extraction successful');
        return {
          content: fallbackArticle.content,
          title: fallbackArticle.title,
          excerpt: fallbackArticle.excerpt,
          byline: fallbackArticle.byline,
        };
      }

      throw new Error('Readability extraction failed with both primary and fallback configurations');

    } catch (error) {
      console.error('[ReadabilityConfig] Content extraction failed:', error);
      throw error;
    }
  }

  /**
   * Validate extracted content quality
   */
  static validateContentQuality(content: string, originalLength: number): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check content length
    if (content.length < 500) {
      issues.push('Content too short');
      score -= 30;
    }

    // Check content reduction ratio
    const reductionRatio = content.length / originalLength;
    if (reductionRatio < 0.1) {
      issues.push('Excessive content reduction');
      score -= 20;
    } else if (reductionRatio > 0.8) {
      issues.push('Minimal content filtering');
      score -= 10;
    }

    // Check for common extraction issues
    if (content.includes('cookie') && content.includes('accept')) {
      issues.push('Cookie banner detected');
      score -= 15;
    }

    if (content.includes('subscribe') && content.includes('newsletter')) {
      issues.push('Newsletter signup detected');
      score -= 10;
    }

    // Check content structure
    const paragraphCount = (content.match(/<p[^>]*>/g) || []).length;
    if (paragraphCount < 2) {
      issues.push('Poor content structure');
      score -= 15;
    }

    return {
      isValid: score >= 60,
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Debug helper to analyze content extraction
   */
  static analyzeExtraction(doc: Document, url: string): {
    detectedType: string | null;
    candidateElements: number;
    contentLength: number;
    recommendations: string[];
  } {
    const preset = this.detectContentType(url);
    const recommendations: string[] = [];

    // Count potential content elements
    const contentSelectors = ['article', 'main', '.content', '.post', '.entry'];
    const candidateElements = contentSelectors.reduce((count, selector) => {
      return count + doc.querySelectorAll(selector).length;
    }, 0);

    const contentLength = doc.body.textContent?.length || 0;

    // Generate recommendations
    if (candidateElements === 0) {
      recommendations.push('No semantic content elements found - consider custom extraction');
    }

    if (contentLength < 1000) {
      recommendations.push('Low content volume - consider reducing charThreshold');
    }

    if (doc.querySelectorAll('pre, code').length > 5) {
      recommendations.push('Code-heavy content detected - use technical-documentation preset');
    }

    return {
      detectedType: preset?.name || null,
      candidateElements,
      contentLength,
      recommendations,
    };
  }
}
