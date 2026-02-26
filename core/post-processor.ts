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
  // Capture cite-first block (if present) so we can ensure it isn't accidentally removed
  // This matches a block that starts with a line beginning `> Source:` and any subsequent
  // contiguous blockquote lines (e.g. `> Captured: ...`, `> Hash: ...`). We store it and
  // re-insert it at the top if post-processing removed it.
  const citeFirstRegex = /^> Source:[^\n]*(?:\n>.*)*/m;
  const citeFirstMatch = markdown.match(citeFirstRegex);
  const citeFirstBlock = citeFirstMatch ? citeFirstMatch[0].trim() : null;
    let structureChanges = 0;

    console.log('[PostProcessor] Starting post-processing...');

    try {
      // Step 1: Basic cleanup
      if (config.cleanupWhitespace) {
        const result = this.cleanupWhitespace(processed, config);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 1.5: Unescape common markdown tokens that are often escaped in UI demo blocks
      // (e.g. "\# Heading" -> "# Heading") so later structure steps can reason about them.
      {
        const result = this.unescapeLeadingMarkdownTokens(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
      }

      // Step 1.6: Wrap escaped HTML samples (e.g. "&lt;div&gt;") into fenced code blocks.
      {
        const result = this.fenceEscapedHtmlSamples(processed);
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

      // Step 2.5: Turn "card" lines into bullet lists when they look like a list of benefits.
      {
        const result = this.bulletizeStandaloneParagraphRuns(processed);
        processed = result.markdown;
        improvements.push(...result.improvements);
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

      // If the original content had a cite-first block but processing removed it,
      // re-insert it at the top to guarantee citation preservation.
      if (citeFirstBlock && !/^> Source:/m.test(processed)) {
        processed = citeFirstBlock + '\n\n' + processed;
        improvements.push('Preserved cite-first block');
      }

  // No synthesized cite-first here: the OfflineModeManager inserts a canonical
  // cite-first block (Source/Captured/Hash) after post-processing. We only
  // preserve an existing cite-first block above.

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
   * Simple deterministic fingerprint function (FNV-1a 32-bit) returning 8-char hex
   * Used only for lightweight in-repo hashes for cite-first fingerprints.
   */
  private static simpleFingerprint(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      // 32-bit FNV-1a multiply
      hash = (hash >>> 0) * 0x01000193 >>> 0;
    }
    // Convert to 8-digit hex
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  /**
   * Clean up whitespace issues
   */
  private static cleanupWhitespace(
    markdown: string,
    _config: PostProcessingOptions
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
    let changes = 0;
    const lines = markdown.split('\n');

    // Pass 1: Merge heading continuation lines (e.g. "## Same source," + "cleaner context")
    const merged: string[] = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const trimmed = raw.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        merged.push(raw);
        continue;
      }
      if (inFence) {
        merged.push(raw);
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s*(.+)$/);
      if (!headingMatch || i + 1 >= lines.length) {
        merged.push(raw);
        continue;
      }

      const nextRaw = lines[i + 1] ?? '';
      const nextTrimmed = nextRaw.trim();
      const headingText = headingMatch[2].trim();

      const shouldMerge =
        nextTrimmed.length > 0 &&
        nextTrimmed.length <= 48 &&
        !/^#{1,6}\s/.test(nextTrimmed) &&
        !/^```/.test(nextTrimmed) &&
        !/^(>|-|\*|\d+\.)\s/.test(nextTrimmed) &&
        /[,:\u2014\u2013-]$/.test(headingText) &&
        !/[.!?]$/.test(headingText);

      if (shouldMerge) {
        merged.push(`${headingMatch[1]} ${headingText} ${nextTrimmed}`.replace(/\s+/g, ' ').trim());
        i += 1;
        changes += 1;
        continue;
      }

      merged.push(raw);
    }

    // Pass 2: Normalize spacing + demote early duplicate H1s + enforce blank lines around headings.
    const output: string[] = [];
    inFence = false;
    let seenH1 = false;
    let lockH1Demotion = false;

    for (let i = 0; i < merged.length; i++) {
      let raw = merged[i] ?? '';
      const trimmed = raw.trim();

      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        output.push(raw);
        continue;
      }
      if (inFence) {
        output.push(raw);
        continue;
      }

      const match = trimmed.match(/^(#{1,6})\s*(.+)$/);
      if (!match) {
        output.push(raw);
        continue;
      }

      let level = match[1].length;
      const text = match[2].trim();
      if (!text) {
        output.push(raw);
        continue;
      }

      if (!seenH1 && level === 1) {
        seenH1 = true;
      } else if (seenH1 && level >= 2) {
        lockH1Demotion = true;
      }

      // Many landing pages emit multiple H1s before any real sectioning. Demote those early H1s.
      if (level === 1 && seenH1 && !lockH1Demotion) {
        level = 2;
        changes += 1;
      }

      const normalizedHeading = `${'#'.repeat(level)} ${text}`;

      // Ensure blank line before heading (except at start or after another blank)
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        output.push('');
        changes += 1;
      }

      output.push(normalizedHeading);

      // Ensure blank line after heading if next line is non-empty content.
      const nextLine = (merged[i + 1] ?? '').trim();
      if (nextLine && !/^```/.test(nextLine)) {
        output.push('');
        changes += 1;
      }
    }

    const processed = output.join('\n');
    if (changes > 0) {
      improvements.push('Normalized heading structure');
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
    const lines = markdown.split('\n');
    const output: string[] = [];
    let inFence = false;
    let changed = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        output.push(line);
        continue;
      }
      if (inFence) {
        output.push(line);
        continue;
      }

      let nextLine = line;
      // Normalize bullet markers.
      const bulletMatch = nextLine.match(/^(\s*)[*+]\s+(.+)$/);
      if (bulletMatch) {
        nextLine = `${bulletMatch[1]}- ${bulletMatch[2]}`;
      }
      // Normalize dash list spacing.
      nextLine = nextLine.replace(/^(\s*[-])\s+/, '$1 ');
      // Normalize numbered list spacing.
      nextLine = nextLine.replace(/^(\s*)(\d+)\.\s+/, '$1$2. ');

      if (nextLine !== line) {
        changed = true;
      }
      output.push(nextLine);
    }

    if (changed) {
      improvements.push('Normalized list formatting');
    }
    return { markdown: output.join('\n'), improvements };
  }

  private static unescapeLeadingMarkdownTokens(markdown: string): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    const lines = markdown.split('\n');
    const output: string[] = [];
    let inFence = false;
    let changed = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        output.push(line);
        continue;
      }
      if (inFence) {
        output.push(line);
        continue;
      }

      const nextLine = line.replace(/^\\#(\s+)/, '#$1');
      if (nextLine !== line) {
        changed = true;
      }
      output.push(nextLine);
    }

    if (changed) {
      improvements.push('Unescaped leading markdown tokens');
    }
    return { markdown: output.join('\n'), improvements };
  }

  private static fenceEscapedHtmlSamples(markdown: string): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    const lines = markdown.split('\n');
    let inFence = false;
    let changed = false;

    const isFenceLine = (line: string): boolean => /^```/.test(line.trim());
    const decode = (value: string): string => this.decodeBasicHtmlEntities(value);

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const trimmed = raw.trim();
      if (isFenceLine(raw)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }

      const open = trimmed.match(/^&lt;([a-z0-9]+)(?:\s[^&]*)&gt;$/i);
      if (!open) {
        continue;
      }
      const tag = open[1].toLowerCase();
      let closeIndex = -1;
      for (let j = i + 1; j < Math.min(lines.length, i + 60); j++) {
        const candidate = (lines[j] ?? '').trim().toLowerCase();
        if (candidate === `&lt;/${tag}&gt;`) {
          closeIndex = j;
          break;
        }
        if (isFenceLine(lines[j] ?? '')) {
          break;
        }
      }
      if (closeIndex === -1) {
        continue;
      }

      const block = lines.slice(i, closeIndex + 1);
      const decodedLines = block.map((line) => decode(line).replace(/\u00a0/g, ' '));
      // Strip leading/trailing empty lines inside the fence.
      while (decodedLines.length > 0 && decodedLines[0].trim() === '') decodedLines.shift();
      while (decodedLines.length > 0 && decodedLines[decodedLines.length - 1].trim() === '') decodedLines.pop();

      const fenced = ['```html', ...decodedLines, '```'];
      lines.splice(i, closeIndex - i + 1, ...fenced);
      i += fenced.length - 1;
      changed = true;
    }

    if (changed) {
      improvements.push('Wrapped escaped HTML samples in fenced blocks');
    }
    return { markdown: lines.join('\n'), improvements };
  }

  private static bulletizeStandaloneParagraphRuns(markdown: string): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    const lines = markdown.split('\n');
    const output: string[] = [];
    let inFence = false;
    let changed = false;

    const isFenceLine = (line: string): boolean => /^```/.test(line.trim());
    const isItemLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^(>|#|-|\*|\d+\.)\s/.test(trimmed)) return false;
      if (trimmed.length < 6 || trimmed.length > 64) return false;
      if (/[.!?;:]$/.test(trimmed)) return false;
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 10) return false;
      return true;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();
      if (isFenceLine(line)) {
        inFence = !inFence;
        output.push(line);
        continue;
      }
      if (inFence) {
        output.push(line);
        continue;
      }

      if (!isItemLine(line)) {
        output.push(line);
        continue;
      }

      // Candidate sequence is item + blank + item + blank + item...
      const items: string[] = [];
      let cursor = i;
      while (cursor < lines.length) {
        const candidate = lines[cursor] ?? '';
        if (!isItemLine(candidate)) {
          break;
        }
        items.push(candidate.trim());

        // Consume blank lines between items.
        let next = cursor + 1;
        let sawBlank = false;
        while (next < lines.length && (lines[next] ?? '').trim() === '') {
          sawBlank = true;
          next++;
        }
        if (!sawBlank) {
          break;
        }
        cursor = next;
      }

      if (items.length >= 3) {
        // Ensure a blank line before the list.
        if (output.length > 0 && output[output.length - 1].trim() !== '') {
          output.push('');
        }
        for (const item of items) {
          output.push(`- ${item}`);
        }
        output.push('');
        changed = true;
        i = cursor - 1;
        continue;
      }

      output.push(line);
    }

    if (changed) {
      improvements.push('Converted standalone benefit lines into lists');
    }
    return { markdown: output.join('\n'), improvements };
  }

  private static decodeBasicHtmlEntities(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');
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
    processed = processed.replace(/^(\s{4}.+)$/gm, (match) => {
      // Convert indented code to fenced code blocks
      const code = match.replace(/^\s{4}/gm, '');
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
