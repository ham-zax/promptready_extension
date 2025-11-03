// Comprehensive error handling and fallback system
// Provides robust recovery mechanisms for all processing stages

import { safeParseHTML, extractTextContent, removeUnwantedElements, extractSemanticContent } from '../lib/dom-utils.js';

export interface ErrorContext {
  stage: ProcessingStage;
  operation: string;
  input: {
    html?: string;
    url?: string;
    config?: any;
  };
  originalError: Error;
  timestamp: Date;
  retryCount: number;
}

export interface FallbackResult<T> {
  success: boolean;
  result?: T;
  fallbackUsed: string;
  warnings: string[];
  errors: string[];
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  canHandle: (context: ErrorContext) => boolean;
  execute: (context: ErrorContext) => Promise<FallbackResult<any>>;
  priority: number; // Lower number = higher priority
}

export type ProcessingStage = 
  | 'initialization'
  | 'content-extraction'
  | 'readability-processing'
  | 'html-cleaning'
  | 'markdown-conversion'
  | 'post-processing'
  | 'validation'
  | 'finalization';

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableFallbacks: boolean;
  logErrors: boolean;
  strictMode: boolean;
  timeoutMs: number;
}

export class ErrorHandler {
  
  private static readonly DEFAULT_CONFIG: ErrorHandlerConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    enableFallbacks: true,
    logErrors: true,
    strictMode: false,
    timeoutMs: 30000, // 30 seconds
  };

  private static recoveryStrategies: RecoveryStrategy[] = [];
  private static errorLog: ErrorContext[] = [];

  /**
   * Initialize error handler with recovery strategies
   */
  static initialize(): void {
    this.registerDefaultStrategies();
    console.log('[ErrorHandler] Initialized with recovery strategies');
  }

  /**
   * Handle errors with automatic recovery attempts
   */
  static async handleError<T>(
    error: Error,
    context: Partial<ErrorContext>,
    config: Partial<ErrorHandlerConfig> = {}
  ): Promise<FallbackResult<T>> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    const errorContext: ErrorContext = {
      stage: context.stage || 'initialization',
      operation: context.operation || 'unknown',
      input: context.input || {},
      originalError: error,
      timestamp: new Date(),
      retryCount: context.retryCount || 0,
    };

    // Log error if enabled
    if (finalConfig.logErrors) {
      this.logError(errorContext);
    }

    console.error(`[ErrorHandler] Error in ${errorContext.stage}:${errorContext.operation}:`, error);

    // Check if we should retry
    if (errorContext.retryCount < finalConfig.maxRetries && this.isRetryableError(error)) {
      console.log(`[ErrorHandler] Retrying operation (attempt ${errorContext.retryCount + 1}/${finalConfig.maxRetries})`);
      
      // Wait before retry
      if (finalConfig.retryDelay > 0) {
        await this.delay(finalConfig.retryDelay);
      }

      return {
        success: false,
        fallbackUsed: 'retry',
        warnings: [`Retrying after error: ${error.message}`],
        errors: [error.message],
      };
    }

    // Try fallback strategies if enabled
    if (finalConfig.enableFallbacks) {
      return await this.attemptRecovery<T>(errorContext, finalConfig);
    }

    // No recovery possible
    return {
      success: false,
      fallbackUsed: 'none',
      warnings: [],
      errors: [error.message],
    };
  }

  /**
   * Attempt recovery using registered strategies
   */
  private static async attemptRecovery<T>(
    context: ErrorContext,
    config: ErrorHandlerConfig
  ): Promise<FallbackResult<T>> {
    const applicableStrategies = this.recoveryStrategies
      .filter(strategy => strategy.canHandle(context))
      .sort((a, b) => a.priority - b.priority);

    if (applicableStrategies.length === 0) {
      console.warn('[ErrorHandler] No applicable recovery strategies found');
      return {
        success: false,
        fallbackUsed: 'none',
        warnings: ['No recovery strategies available'],
        errors: [context.originalError.message],
      };
    }

    for (const strategy of applicableStrategies) {
      try {
        console.log(`[ErrorHandler] Attempting recovery with strategy: ${strategy.name}`);
        
        const result = await this.executeWithTimeout(
          () => strategy.execute(context),
          config.timeoutMs
        );

        if (result.success) {
          console.log(`[ErrorHandler] Recovery successful with strategy: ${strategy.name}`);
          return result;
        } else {
          console.warn(`[ErrorHandler] Recovery strategy ${strategy.name} failed:`, result.errors);
        }
      } catch (strategyError) {
        console.error(`[ErrorHandler] Recovery strategy ${strategy.name} threw error:`, strategyError);
      }
    }

    return {
      success: false,
      fallbackUsed: 'all-failed',
      warnings: ['All recovery strategies failed'],
      errors: [context.originalError.message],
    };
  }

  /**
   * Register default recovery strategies
   */
  private static registerDefaultStrategies(): void {
    // Readability fallback strategy
    this.registerStrategy({
      name: 'readability-fallback',
      description: 'Fallback content extraction when Readability fails',
      priority: 1,
      canHandle: (context) => context.stage === 'readability-processing',
      execute: async (context) => {
        try {
          const html = context.input.html;
          if (!html) {
            throw new Error('No HTML input available for fallback');
          }

          const doc = safeParseHTML(html);
          if (!doc) {
            throw new Error('Failed to parse HTML for fallback extraction');
          }
          const content = await this.extractContentFallback(doc);

          return {
            success: true,
            result: content,
            fallbackUsed: 'readability-fallback',
            warnings: ['Used fallback content extraction'],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'readability-fallback',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });

    // Turndown fallback strategy
    this.registerStrategy({
      name: 'turndown-fallback',
      description: 'Simple HTML to Markdown conversion when Turndown fails',
      priority: 1,
      canHandle: (context) => context.stage === 'markdown-conversion',
      execute: async (context) => {
        try {
          const html = context.input.html;
          if (!html) {
            throw new Error('No HTML input available for fallback');
          }

          const markdown = await this.simpleHtmlToMarkdown(html);

          return {
            success: true,
            result: markdown,
            fallbackUsed: 'turndown-fallback',
            warnings: ['Used simple HTML to Markdown conversion'],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'turndown-fallback',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });

    // DOM parsing fallback strategy
    this.registerStrategy({
      name: 'dom-parsing-fallback',
      description: 'Alternative DOM parsing when DOMParser fails',
      priority: 2,
      canHandle: (context) => context.originalError.message.includes('DOMParser'),
      execute: async (context) => {
        try {
          // Try alternative parsing methods
          const html = context.input.html;
          if (!html) {
            throw new Error('No HTML input available');
          }

          if (typeof document === 'undefined') {
            throw new Error('Cannot create DOM element in this environment');
          }
          // Create a temporary element for parsing
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;

          return {
            success: true,
            result: tempDiv,
            fallbackUsed: 'dom-parsing-fallback',
            warnings: ['Used alternative DOM parsing method'],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'dom-parsing-fallback',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });

    // Memory cleanup strategy
    this.registerStrategy({
      name: 'memory-cleanup',
      description: 'Clean up memory and retry when out of memory errors occur',
      priority: 3,
      canHandle: (context) => 
        context.originalError.message.includes('memory') ||
        context.originalError.message.includes('Maximum call stack'),
      execute: async (context) => {
        try {
          // Force garbage collection if available (not in service worker)
          if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
            (globalThis as any).gc();
          }

          // Clear any caches
          this.clearProcessingCaches();

          // Wait a bit for cleanup
          await this.delay(2000);

          return {
            success: true,
            result: null,
            fallbackUsed: 'memory-cleanup',
            warnings: ['Performed memory cleanup, retry recommended'],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'memory-cleanup',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });

    // Content chunking strategy
    this.registerStrategy({
      name: 'content-chunking',
      description: 'Split large content into smaller chunks',
      priority: 2,
      canHandle: (context) =>
        Boolean(context.input.html && context.input.html.length > 500000), // 500KB
      execute: async (context) => {
        try {
          const html = context.input.html;
          if (!html) {
            throw new Error('No HTML input available');
          }

          const chunks = this.splitContentIntoChunks(html, 100000); // 100KB chunks

          return {
            success: true,
            result: chunks,
            fallbackUsed: 'content-chunking',
            warnings: [`Split content into ${chunks.length} chunks`],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'content-chunking',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });

    // Text-only extraction strategy
    this.registerStrategy({
      name: 'text-only-extraction',
      description: 'Extract plain text when all other methods fail',
      priority: 10, // Lowest priority - last resort
      canHandle: (context) => 
        context.stage === 'content-extraction' || 
        context.stage === 'readability-processing',
      execute: async (context) => {
        try {
          const html = context.input.html;
          if (!html) {
            throw new Error('No HTML input available');
          }

          const textContent = extractTextContent(html);

          // Convert to basic markdown
          const markdown = textContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n\n');

          return {
            success: true,
            result: markdown,
            fallbackUsed: 'text-only-extraction',
            warnings: ['Used text-only extraction - formatting may be lost'],
            errors: [],
          };
        } catch (error) {
          return {
            success: false,
            fallbackUsed: 'text-only-extraction',
            warnings: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      },
    });
  }

  /**
   * Register a custom recovery strategy
   */
  static registerStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
    console.log(`[ErrorHandler] Registered recovery strategy: ${strategy.name}`);
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /temporary/i,
      /rate limit/i,
      /service unavailable/i,
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Execute function with timeout
   */
  private static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error for debugging
   */
  private static logError(context: ErrorContext): void {
    this.errorLog.push(context);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }

  /**
   * Fallback content extraction
   */
  private static async extractContentFallback(doc: Document): Promise<string> {
    // Try semantic elements first
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '#content',
      '#main-content',
    ];

    for (const selector of semanticSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 500) {
        return element.innerHTML;
      }
    }

    // Fallback to body with basic cleaning
    const body = doc.body;
    if (body) {
      // Remove unwanted elements using centralized utility
      removeUnwantedElements(body);
      return body.innerHTML;
    }

    throw new Error('No content could be extracted');
  }

  /**
   * Simple HTML to Markdown conversion
   */
  private static async simpleHtmlToMarkdown(html: string): Promise<string> {
    const doc = safeParseHTML(html);
    if (!doc) {
      return extractTextContent(html);
    }
    let markdown = '';

    const processElement = (element: Element): void => {
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
          markdown += `# ${element.textContent}\n\n`;
          break;
        case 'h2':
          markdown += `## ${element.textContent}\n\n`;
          break;
        case 'h3':
          markdown += `### ${element.textContent}\n\n`;
          break;
        case 'h4':
          markdown += `#### ${element.textContent}\n\n`;
          break;
        case 'h5':
          markdown += `##### ${element.textContent}\n\n`;
          break;
        case 'h6':
          markdown += `###### ${element.textContent}\n\n`;
          break;
        case 'p':
          markdown += `${element.textContent}\n\n`;
          break;
        case 'pre':
          markdown += `\`\`\`\n${element.textContent}\n\`\`\`\n\n`;
          break;
        case 'code':
          if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
            markdown += `\`${element.textContent}\``;
          }
          break;
        case 'strong':
        case 'b':
          markdown += `**${element.textContent}**`;
          break;
        case 'em':
        case 'i':
          markdown += `*${element.textContent}*`;
          break;
        case 'a':
          const href = element.getAttribute('href') || '';
          markdown += `[${element.textContent}](${href})`;
          break;
        case 'img':
          const src = element.getAttribute('src') || '';
          const alt = element.getAttribute('alt') || '';
          markdown += `![${alt}](${src})`;
          break;
        case 'ul':
        case 'ol':
          element.querySelectorAll('li').forEach(li => {
            markdown += `- ${li.textContent}\n`;
          });
          markdown += '\n';
          break;
        case 'blockquote':
          const lines = element.textContent?.split('\n') || [];
          lines.forEach(line => {
            if (line.trim()) {
              markdown += `> ${line.trim()}\n`;
            }
          });
          markdown += '\n';
          break;
        default:
          // For other elements, just process children
          Array.from(element.children).forEach(processElement);
      }
    };

    Array.from(doc.body.children).forEach(processElement);
    
    return markdown.trim();
  }

  /**
   * Split content into manageable chunks
   */
  private static splitContentIntoChunks(html: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const elements = Array.from(doc.body.children);
    
    for (const element of elements) {
      const elementHtml = element.outerHTML;
      
      if (currentChunk.length + elementHtml.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = elementHtml;
      } else {
        currentChunk += elementHtml;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Clear processing caches
   */
  private static clearProcessingCaches(): void {
    // This would clear any caches used by the processing pipeline
    console.log('[ErrorHandler] Clearing processing caches');
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number;
    errorsByStage: Record<ProcessingStage, number>;
    recentErrors: ErrorContext[];
  } {
    const errorsByStage = this.errorLog.reduce((acc, error) => {
      acc[error.stage] = (acc[error.stage] || 0) + 1;
      return acc;
    }, {} as Record<ProcessingStage, number>);

    return {
      totalErrors: this.errorLog.length,
      errorsByStage,
      recentErrors: this.errorLog.slice(-10),
    };
  }

  /**
   * Clear error log
   */
  static clearErrorLog(): void {
    this.errorLog.length = 0;
    console.log('[ErrorHandler] Error log cleared');
  }
}

// Initialize error handler
ErrorHandler.initialize();
