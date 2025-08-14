// Post-processing module for final markdown cleanup and optimization
// Handles structure improvement, formatting consistency, and quality enhancement

export interface PostProcessingOptions {
  cleanupWhitespace: boolean;
  normalizeHeadings: boolean;
  fixListFormatting: boolean;
  removeEmptyLines: boolean;
  maxConsecutiveNewlines: number;
  improveCodeBlocks: boolean;
  enhanceLinks: boolean;
  optimizeImages: boolean;
  addTableOfContents: boolean;
  preserveLineBreaks: boolean;
}

export interface ProcessingResult {
  markdown: string;
  improvements: string[];
  warnings: string[];
  stats: {
    originalLength: number;
    processedLength: number;
    linesRemoved: number;
    structureChanges: number;
  };
}

export class MarkdownPostProcessor {
  
  private static readonly DEFAULT_OPTIONS: PostProcessingOptions = {
    cleanupWhitespace: true,
    normalizeHeadings: true,
    fixListFormatting: true,
    removeEmptyLines: true,
    maxConsecutiveNewlines: 2,
    improveCodeBlocks: true,
    enhanceLinks: true,
    optimizeImages: true,
    addTableOfContents: false,
    preserveLineBreaks: false,
  };

  /**
   * Main post-processing pipeline
   */
  static process(
    markdown: string,
    options: Partial<PostProcessingOptions> = {}
  ): ProcessingResult {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const improvements: string[] = [];
    const warnings: string[] = [];
    const originalLength = markdown.length;
    let processed = markdown;
    let structureChanges = 0;

    console.log('[PostProcessor] Starting post-processing...');

    try {
      // Step 1: Basic cleanup
      if (config.cleanupWhitespace) {
        const result = this.cleanupWhitespace(processed, config);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 2: Normalize headings
      if (config.normalizeHeadings) {
        const result = this.normalizeHeadings(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
        structureChanges += result.changes;
      }

      // Step 3: Fix list formatting
      if (config.fixListFormatting) {
        const result = this.fixListFormatting(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 4: Improve code blocks
      if (config.improveCodeBlocks) {
        const result = this.improveCodeBlocks(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 5: Enhance links
      if (config.enhanceLinks) {
        const result = this.enhanceLinks(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
        warnings.push(...result.warnings);
      }

      // Step 6: Optimize images
      if (config.optimizeImages) {
        const result = this.optimizeImages(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 7: Remove excessive empty lines
      if (config.removeEmptyLines) {
        const result = this.removeExcessiveEmptyLines(processed, config.maxConsecutiveNewlines);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 8: Add table of contents (if requested)
      if (config.addTableOfContents) {
        const result = this.addTableOfContents(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
        structureChanges += result.changes;
      }

      // Step 9: Final cleanup
      processed = this.finalCleanup(processed, config);

      const linesRemoved = (markdown.match(/\n/g) || []).length - (processed.match(/\n/g) || []).length;

      console.log(`[PostProcessor] Processing completed. ${improvements.length} improvements made.`);

      return {
        markdown: processed,
        improvements,
        warnings,
        stats: {
          originalLength,
          processedLength: processed.length,
          linesRemoved,
          structureChanges,
        },
      };

    } catch (error) {
      console.error('[PostProcessor] Processing failed:', error);
      warnings.push(`Post-processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        markdown,
        improvements,
        warnings,
        stats: {
          originalLength,
          processedLength: markdown.length,
          linesRemoved: 0,
          structureChanges: 0,
        },
      };
    }
  }

  /**
   * Clean up whitespace issues
   */
  private static cleanupWhitespace(
    markdown: string,
    config: PostProcessingOptions
  ): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    let processed = markdown;

    // Remove trailing whitespace
    const beforeTrailing = processed;
    processed = processed.replace(/[ \t]+$/gm, '');
    if (processed !== beforeTrailing) {
      improvements.push('Removed trailing whitespace');
    }

    // Fix mixed line endings
    const beforeLineEndings = processed;
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (processed !== beforeLineEndings) {
      improvements.push('Normalized line endings');
    }

    // Remove tabs and replace with spaces
    const beforeTabs = processed;
    processed = processed.replace(/\t/g, '  ');
    if (processed !== beforeTabs) {
      improvements.push('Replaced tabs with spaces');
    }

    return { markdown: processed, improvements };
  }

  /**
   * Normalize heading structure and formatting
   */
  private static normalizeHeadings(markdown: string): {
    markdown: string;
    improvements: string[];
    changes: number;
  } {
    const improvements: string[] = [];
    let processed = markdown;
    let changes = 0;

    // Fix heading spacing
    const beforeSpacing = processed;
    processed = processed.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');
    if (processed !== beforeSpacing) {
      improvements.push('Fixed heading spacing');
      changes++;
    }

    // Ensure headings have proper line breaks
    const beforeBreaks = processed;
    processed = processed.replace(/^(#{1,6}\s.+)$/gm, '\n$1\n');
    processed = processed.replace(/^\n+/gm, '\n'); // Clean up excessive newlines
    if (processed !== beforeBreaks) {
      improvements.push('Added proper heading line breaks');
      changes++;
    }

    // Fix heading hierarchy (ensure no skipped levels)
    const headingMatches = processed.match(/^(#{1,6})\s/gm);
    if (headingMatches) {
      const levels = headingMatches.map(h => h.length - 1);
      let currentLevel = 0;
      let hierarchyFixed = false;

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        if (level > currentLevel + 1) {
          // Skip detected, fix it
          const newLevel = currentLevel + 1;
          const oldHeading = '#'.repeat(level);
          const newHeading = '#'.repeat(newLevel);
          processed = processed.replace(new RegExp(`^${oldHeading}\\s`, 'm'), `${newHeading} `);
          hierarchyFixed = true;
          currentLevel = newLevel;
        } else {
          currentLevel = level;
        }
      }

      if (hierarchyFixed) {
        improvements.push('Fixed heading hierarchy');
        changes++;
      }
    }

    return { markdown: processed, improvements, changes };
  }

  /**
   * Fix list formatting issues
   */
  private static fixListFormatting(markdown: string): {
    markdown: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let processed = markdown;

    // Normalize bullet list markers
    const beforeBullets = processed;
    processed = processed.replace(/^(\s*)[*+]\s+/gm, '$1- ');
    if (processed !== beforeBullets) {
      improvements.push('Normalized bullet list markers');
    }

    // Fix list item spacing
    const beforeSpacing = processed;
    processed = processed.replace(/^(\s*[-*+])\s+/gm, '$1 ');
    if (processed !== beforeSpacing) {
      improvements.push('Fixed list item spacing');
    }

    // Fix numbered list formatting
    const beforeNumbered = processed;
    processed = processed.replace(/^(\s*)(\d+)\.\s+/gm, '$1$2. ');
    if (processed !== beforeNumbered) {
      improvements.push('Fixed numbered list formatting');
    }

    // Ensure proper list line breaks
    const beforeListBreaks = processed;
    processed = processed.replace(/^(\s*[-*+]\s.+)$/gm, '\n$1');
    processed = processed.replace(/^(\s*\d+\.\s.+)$/gm, '\n$1');
    processed = processed.replace(/\n{3,}/g, '\n\n'); // Clean up excessive newlines
    if (processed !== beforeListBreaks) {
      improvements.push('Added proper list line breaks');
    }

    return { markdown: processed, improvements };
  }

  /**
   * Improve code block formatting
   */
  private static improveCodeBlocks(markdown: string): {
    markdown: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let processed = markdown;

    // Fix code block fencing
    const beforeFencing = processed;
    processed = processed.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
      const cleanCode = code.replace(/^\n+|\n+$/g, ''); // Remove leading/trailing newlines
      return `\n\n\`\`\`${lang}\n${cleanCode}\n\`\`\`\n\n`;
    });
    if (processed !== beforeFencing) {
      improvements.push('Improved code block formatting');
    }

    // Fix inline code spacing
    const beforeInline = processed;
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
      const cleanCode = code.trim();
      return `\`${cleanCode}\``;
    });
    if (processed !== beforeInline) {
      improvements.push('Fixed inline code spacing');
    }

    // Detect and fix indented code blocks
    const beforeIndented = processed;
    processed = processed.replace(/^(    .+)$/gm, (match) => {
      // Convert indented code to fenced code blocks
      const code = match.replace(/^    /gm, '');
      return `\n\`\`\`\n${code}\n\`\`\`\n`;
    });
    if (processed !== beforeIndented) {
      improvements.push('Converted indented code to fenced blocks');
    }

    return { markdown: processed, improvements };
  }

  /**
   * Enhance link formatting and validation
   */
  private static enhanceLinks(markdown: string): {
    markdown: string;
    improvements: string[];
    warnings: string[];
  } {
    const improvements: string[] = [];
    const warnings: string[] = [];
    let processed = markdown;

    // Fix link formatting
    const beforeLinks = processed;
    processed = processed.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, text, url) => {
      const cleanText = text.trim();
      const cleanUrl = url.trim();
      
      // Validate URL
      if (!cleanUrl) {
        warnings.push(`Empty URL found for link: ${cleanText}`);
        return cleanText; // Remove broken link
      }

      // Fix relative URLs (basic validation)
      if (cleanUrl.startsWith('//')) {
        return `[${cleanText}](https:${cleanUrl})`;
      }

      return `[${cleanText}](${cleanUrl})`;
    });
    if (processed !== beforeLinks) {
      improvements.push('Enhanced link formatting');
    }

    // Fix image links
    const beforeImages = processed;
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (match, alt, src) => {
      const cleanAlt = alt.trim();
      const cleanSrc = src.trim();
      
      if (!cleanSrc) {
        warnings.push(`Empty image source found: ${cleanAlt}`);
        return ''; // Remove broken image
      }

      return `![${cleanAlt}](${cleanSrc})`;
    });
    if (processed !== beforeImages) {
      improvements.push('Enhanced image link formatting');
    }

    return { markdown: processed, improvements, warnings };
  }

  /**
   * Optimize image formatting
   */
  private static optimizeImages(markdown: string): {
    markdown: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let processed = markdown;

    // Ensure images have proper line breaks
    const beforeBreaks = processed;
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '\n\n$&\n\n');
    processed = processed.replace(/\n{3,}/g, '\n\n'); // Clean up excessive newlines
    if (processed !== beforeBreaks) {
      improvements.push('Added proper image line breaks');
    }

    // Add alt text for images without it
    const beforeAlt = processed;
    processed = processed.replace(/!\[\]\(([^)]+)\)/g, (match, src) => {
      const filename = src.split('/').pop()?.split('.')[0] || 'image';
      return `![${filename}](${src})`;
    });
    if (processed !== beforeAlt) {
      improvements.push('Added missing alt text for images');
    }

    return { markdown: processed, improvements };
  }

  /**
   * Remove excessive empty lines
   */
  private static removeExcessiveEmptyLines(
    markdown: string,
    maxConsecutive: number
  ): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    
    const beforeCleanup = markdown;
    const pattern = new RegExp(`\\n{${maxConsecutive + 1},}`, 'g');
    const processed = markdown.replace(pattern, '\n'.repeat(maxConsecutive));
    
    if (processed !== beforeCleanup) {
      improvements.push(`Limited consecutive empty lines to ${maxConsecutive}`);
    }

    return { markdown: processed, improvements };
  }

  /**
   * Add table of contents
   */
  private static addTableOfContents(markdown: string): {
    markdown: string;
    improvements: string[];
    changes: number;
  } {
    const improvements: string[] = [];
    let changes = 0;

    // Extract headings
    const headings = markdown.match(/^(#{1,6})\s(.+)$/gm);
    
    if (!headings || headings.length < 2) {
      return { markdown, improvements, changes };
    }

    // Generate TOC
    let toc = '\n## Table of Contents\n\n';
    headings.forEach(heading => {
      const level = heading.match(/^(#{1,6})/)?.[1].length || 1;
      const text = heading.replace(/^#{1,6}\s/, '');
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const indent = '  '.repeat(Math.max(0, level - 2));
      toc += `${indent}- [${text}](#${anchor})\n`;
    });

    toc += '\n';

    // Insert TOC after first heading
    const firstHeadingIndex = markdown.search(/^#{1,6}\s/m);
    if (firstHeadingIndex !== -1) {
      const nextLineIndex = markdown.indexOf('\n', firstHeadingIndex);
      if (nextLineIndex !== -1) {
        const processed = markdown.slice(0, nextLineIndex + 1) + toc + markdown.slice(nextLineIndex + 1);
        improvements.push('Added table of contents');
        changes = 1;
        return { markdown: processed, improvements, changes };
      }
    }

    return { markdown, improvements, changes };
  }

  /**
   * Final cleanup pass
   */
  private static finalCleanup(markdown: string, config: PostProcessingOptions): string {
    let processed = markdown;

    // Remove non-printable characters
    processed = processed.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, '');

    // Ensure file ends with single newline
    processed = processed.replace(/\n*$/, '\n');

    // Preserve line breaks if requested
    if (config.preserveLineBreaks) {
      processed = processed.replace(/\n/g, '  \n');
    }

    return processed;
  }
}
