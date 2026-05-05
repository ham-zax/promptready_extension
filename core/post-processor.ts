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

      // Step 4.5: Remove deterministic extraction artifacts exposed by the
      // offline website corpus without changing site-specific extraction seams.
      {
        const result = this.tightenMarkdownFidelity(processed);
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

      const headingMatch = trimmed.match(/^(#{1,6})\s*(\S[^\n]*)$/);
      if (!headingMatch || i + 1 >= lines.length) {
        merged.push(raw);
        continue;
      }

      let nextIndex = i + 1;
      let nextRaw = lines[nextIndex] ?? '';
      let nextTrimmed = nextRaw.trim();
      // Some sites split headings with a blank line for styling. Allow merging across a single blank.
      if (!nextTrimmed && nextIndex + 1 < lines.length) {
        const candidateRaw = lines[nextIndex + 1] ?? '';
        const candidateTrimmed = candidateRaw.trim();
        if (candidateTrimmed) {
          nextIndex = nextIndex + 1;
          nextRaw = candidateRaw;
          nextTrimmed = candidateTrimmed;
        }
      }
      const headingText = headingMatch[2].trim();

      const shouldMerge =
        nextTrimmed.length > 0 &&
        nextTrimmed.length <= 48 &&
        !/^#{1,6}\s*\S/.test(nextTrimmed) &&
        !/^```/.test(nextTrimmed) &&
        !/^(>|-|\*|\d+\.)\s/.test(nextTrimmed) &&
        ((/[,:\u2014\u2013-]$/.test(headingText) && !/[.!?]$/.test(headingText)) ||
          nextTrimmed.startsWith('&') ||
          nextTrimmed.startsWith('and '));

      if (shouldMerge) {
        merged.push(`${headingMatch[1]} ${headingText} ${nextTrimmed}`.replace(/\s+/g, ' ').trim());
        i = nextIndex;
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
    let previousHeadingLevel = 0;

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

      const match = trimmed.match(/^(#{1,6})\s*(\S[^\n]*)$/);
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

      if (level === 1) {
        if (!seenH1) {
          seenH1 = true;
        } else if (!lockH1Demotion) {
          // Many landing pages emit multiple H1s before any real sectioning.
          // Demote only duplicate early H1s, never the first H1.
          level = 2;
          changes += 1;
        }
      } else if (seenH1 && level >= 2) {
        lockH1Demotion = true;
      }

      if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
        level = previousHeadingLevel + 1;
        changes += 1;
      }

      const normalizedHeading = `${'#'.repeat(level)} ${text}`;

      // Ensure blank line before heading (except at start or after another blank)
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        output.push('');
        changes += 1;
      }

      output.push(normalizedHeading);
      previousHeadingLevel = level;

      // Ensure blank line after heading if next line is non-empty content.
      const nextLine = (merged[i + 1] ?? '').trim();
      if (nextLine && !/^```/.test(nextLine)) {
        output.push('');
        changes += 1;
      }
    }

    const processed = output.join('\n');
    if (changes > 0) {
      improvements.push('Fixed heading hierarchy');
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
      const bulletMatch = nextLine.match(/^([^\S\r\n]*)[*+][^\S\r\n]+(\S[^\n]*)$/);
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

      const open = trimmed.match(/^&lt;([a-z0-9]+)(?:\s[^&]*)?&gt;$/i);
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
      // Skip existing markdown structures: blockquotes, headings, list items, ordered lists.
      // Note: headings can start with multiple hashes (e.g. "## Heading"), so we must match
      // the full heading pattern rather than only "# " prefixes.
      if (/^>/.test(trimmed)) return false;
      if (/^#{1,6}\s/.test(trimmed)) return false;
      if (/^[-*+]\s+/.test(trimmed)) return false;
      if (/^\d+\.\s+/.test(trimmed)) return false;
      if (trimmed.length < 6 || trimmed.length > 64) return false;
      if (/[.!?;:]$/.test(trimmed)) return false;
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 10) return false;
      return true;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
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

  static tightenMarkdownFidelity(markdown: string): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    let processed = markdown;

    const codeTables = this.normalizeMarkdownCodeTables(processed);
    processed = codeTables.markdown;
    improvements.push(...codeTables.improvements);

    const residualCodeTables = this.cleanupResidualCodeTableMarkers(processed);
    processed = residualCodeTables.markdown;
    improvements.push(...residualCodeTables.improvements);

    const duplicatedCode = this.dedupeAdjacentTechnicalCodeCopies(processed);
    processed = duplicatedCode.markdown;
    improvements.push(...duplicatedCode.improvements);

    const misfencedHeadings = this.cleanupMisfencedMarkdownHeadings(processed);
    processed = misfencedHeadings.markdown;
    improvements.push(...misfencedHeadings.improvements);

    const malformedDuplicates = this.cleanupMalformedDuplicateCodeExample(processed);
    processed = malformedDuplicates.markdown;
    improvements.push(...malformedDuplicates.improvements);

    const githubHeadings = this.restoreGitHubRepositoryHeadings(processed);
    processed = githubHeadings.markdown;
    improvements.push(...githubHeadings.improvements);

    const authorBlocks = this.cleanupMalformedAuthorMediaBlocks(processed);
    processed = authorBlocks.markdown;
    improvements.push(...authorBlocks.improvements);

    const demoChrome = this.removeInteractiveDemoChrome(processed);
    processed = demoChrome.markdown;
    improvements.push(...demoChrome.improvements);

    const redditChrome = this.cleanupListingChrome(processed);
    processed = redditChrome.markdown;
    improvements.push(...redditChrome.improvements);

    const identifierSpacing = this.cleanupIdentifierSpacing(processed);
    processed = identifierSpacing.markdown;
    improvements.push(...identifierSpacing.improvements);

    return { markdown: processed, improvements };
  }

  private static normalizeMarkdownCodeTables(markdown: string): { markdown: string; improvements: string[] } {
    const improvements: string[] = [];
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;
    let lastCodeKey: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        const endIndex = this.findFenceEnd(lines, i + 1);
        if (endIndex === -1) {
          output.push(line);
          continue;
        }

        const contentLines = lines.slice(i + 1, endIndex);
        const normalizedCode = this.parseMarkdownCodeTable(contentLines);
        if (!normalizedCode) {
          output.push(...lines.slice(i, endIndex + 1));
          i = endIndex;
          continue;
        }

        const key = normalizedCode.join('\n');
        if (key !== lastCodeKey) {
          output.push(line);
          output.push(...normalizedCode);
          output.push(lines[endIndex] ?? '```');
        }
        lastCodeKey = key;
        changed = true;
        i = endIndex;
        continue;
      }

      if (this.isMarkdownTableRow(trimmed)) {
        const tableStart = i;
        let tableEnd = i;
        while (tableEnd < lines.length && this.isMarkdownTableRow((lines[tableEnd] ?? '').trim())) {
          tableEnd++;
        }

        const normalizedCode = this.parseMarkdownCodeTable(lines.slice(tableStart, tableEnd));
        if (normalizedCode) {
          const key = normalizedCode.join('\n');
          if (key !== lastCodeKey) {
            output.push('```');
            output.push(...normalizedCode);
            output.push('```');
            lastCodeKey = key;
          }
          changed = true;
          i = tableEnd - 1;
          continue;
        }
      }

      output.push(line);
    }

    if (changed) {
      improvements.push('Normalized table-shaped code blocks');
    }
    return { markdown: output.join('\n'), improvements };
  }

  private static cleanupResidualCodeTableMarkers(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (!/^```/.test(trimmed)) {
        const tableCodeLine = this.parseResidualCodeTableLine(line);
        if (tableCodeLine !== null) {
          output.push(tableCodeLine);
          changed = true;
          continue;
        }
        output.push(line);
        continue;
      }

      const endIndex = this.findFenceEnd(lines, i + 1);
      if (endIndex === -1) {
        output.push(line);
        continue;
      }

      output.push(line);
      let sawCodeTableMarker = false;
      for (let j = i + 1; j < endIndex; j++) {
        const contentLine = lines[j] ?? '';
        const parsedLine = this.parseResidualCodeTableLine(contentLine);
        if (parsedLine !== null) {
          if (parsedLine !== '') {
            output.push(parsedLine);
          }
          sawCodeTableMarker = true;
          changed = true;
          continue;
        }

        if (sawCodeTableMarker && /\s\|\s*$/.test(contentLine)) {
          output.push(contentLine.replace(/\s+\|\s*$/, ''));
          changed = true;
          continue;
        }

        output.push(contentLine);
      }
      output.push(lines[endIndex] ?? '```');
      i = endIndex;
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: output.join('\n'), improvements: ['Removed residual code table markers'] };
  }

  private static dedupeAdjacentTechnicalCodeCopies(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;
    let lastFenceBody: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        const endIndex = this.findFenceEnd(lines, i + 1);
        if (endIndex === -1) {
          output.push(line);
          lastFenceBody = null;
          continue;
        }

        const body = this.trimEmptyEdgeLines(lines.slice(i + 1, endIndex));
        const dedupedBody = this.truncateRepeatedCodeBody(body);
        if (dedupedBody.length !== body.length) {
          changed = true;
        }
        const previousCopyCount = this.countPreviousRawCodeCopy(output, dedupedBody);
        if (previousCopyCount > 0) {
          output.splice(output.length - previousCopyCount, previousCopyCount);
          changed = true;
        }
        output.push(line);
        output.push(...dedupedBody);
        output.push(lines[endIndex] ?? '```');
        lastFenceBody = dedupedBody;
        i = endIndex;
        continue;
      }

      if (lastFenceBody && trimmed) {
        const consumed = this.countAdjacentRawCodeCopy(lines, i, lastFenceBody);
        if (consumed > 0) {
          changed = true;
          i += consumed - 1;
          continue;
        }
      }

      output.push(line);
      if (trimmed) {
        lastFenceBody = null;
      }
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: output.join('\n'), improvements: ['Removed duplicated technical code copies'] };
  }

  private static countPreviousRawCodeCopy(output: string[], body: string[]): number {
    const expected = body.map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
    if (expected.length === 0 || !this.looksLikeTechnicalCodeStart(expected[0])) {
      return 0;
    }

    let cursor = output.length - 1;
    while (cursor >= 0 && (output[cursor] ?? '').trim() === '') {
      cursor--;
    }

    for (let expectedIndex = expected.length - 1; expectedIndex >= 0; expectedIndex--) {
      while (cursor >= 0 && (output[cursor] ?? '').trim() === '') {
        cursor--;
      }
      if (cursor < 0 || (output[cursor] ?? '').trimEnd() !== expected[expectedIndex]) {
        return 0;
      }
      cursor--;
    }

    const removeStart = cursor + 1;
    return output.length - removeStart;
  }

  private static trimEmptyEdgeLines(lines: string[]): string[] {
    const output = [...lines];
    while (output.length > 0 && output[0].trim() === '') {
      output.shift();
    }
    while (output.length > 0 && output[output.length - 1].trim() === '') {
      output.pop();
    }
    return output;
  }

  private static truncateRepeatedCodeBody(lines: string[]): string[] {
    const firstContentIndex = lines.findIndex((line) => line.trim() !== '');
    if (firstContentIndex === -1) {
      return lines;
    }

    const firstLine = lines[firstContentIndex].trim();
    if (!this.looksLikeTechnicalCodeStart(firstLine)) {
      return lines;
    }

    for (let i = firstContentIndex + 3; i < lines.length; i++) {
      if (lines[i]?.trim() === firstLine) {
        return lines.slice(0, i);
      }
    }

    return lines;
  }

  private static looksLikeTechnicalCodeStart(line: string): boolean {
    return /^(?:import|from|const|let|var|function|class|async function|def |npm |pnpm |yarn |bun |python |node )/.test(line);
  }

  private static countAdjacentRawCodeCopy(lines: string[], startIndex: number, body: string[]): number {
    const expected = body.map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
    if (expected.length === 0) {
      return 0;
    }

    let cursor = startIndex;
    let matched = 0;
    while (cursor < lines.length && matched < expected.length) {
      const actual = (lines[cursor] ?? '').trimEnd();
      if (!actual.trim()) {
        cursor++;
        continue;
      }
      if (actual !== expected[matched]) {
        return 0;
      }
      matched++;
      cursor++;
    }

    return matched === expected.length ? cursor - startIndex : 0;
  }

  private static parseResidualCodeTableLine(line: string): string | null {
    const trimmed = line.trim();
    if (/^\|\s*-{3,}\s*\|\s*-{3,}\s*\|$/.test(trimmed)) {
      return '';
    }

    if (!trimmed.startsWith('|')) {
      return null;
    }
    const markerSeparator = trimmed.indexOf('|', 1);
    if (markerSeparator === -1) {
      return null;
    }

    const marker = trimmed.slice(1, markerSeparator).trim();
    if (marker !== '$' && !/^\d+$/.test(marker)) {
      return null;
    }

    let value = trimmed.slice(markerSeparator + 1);
    if (value.endsWith('|')) {
      value = value.slice(0, -1);
    }
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    return value.trimEnd();
  }

  private static findFenceEnd(lines: string[], startIndex: number): number {
    for (let i = startIndex; i < lines.length; i++) {
      if (/^```/.test((lines[i] ?? '').trim())) {
        return i;
      }
    }
    return -1;
  }

  private static parseMarkdownCodeTable(lines: string[]): string[] | null {
    const rows = lines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseMarkdownTableRow(line));

    if (rows.length < 2 || rows.some((row) => !row)) {
      return null;
    }

    const parsedRows = rows as string[][];
    const hasSeparator = parsedRows.some((cells) => cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim())));
    if (!hasSeparator) {
      return null;
    }

    const dataRows = parsedRows.filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim())));
    const looksLikeCodeTable = dataRows.some((cells) => /^\d+$/.test(cells[0]?.trim() ?? '') || (cells[0]?.trim() ?? '') === '$');
    if (!looksLikeCodeTable) {
      return null;
    }

    return dataRows.map((cells) => cells.slice(1).join(' | ').trimEnd());
  }

  private static parseMarkdownTableRow(line: string): string[] | null {
    if (!this.isMarkdownTableRow(line)) {
      return null;
    }
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  private static isMarkdownTableRow(line: string): boolean {
    return line.startsWith('|') && line.endsWith('|') && line.includes(' | ');
  }

  private static restoreGitHubRepositoryHeadings(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const repoStats = this.parseGitHubRepositoryStatsLine(line);
      if (!repoStats) {
        continue;
      }

      const { owner, repo } = repoStats;
      const heading = `## [${owner} / ${repo}](https://github.com/${owner}/${repo})`;
      if (this.hasRecentRepositoryHeading(lines, i, heading)) {
        continue;
      }

      const insertIndex = this.findRepositoryDescriptionStart(lines, i);
      lines.splice(insertIndex, 0, heading, '');
      changed = true;
      i += 2;
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: lines.join('\n'), improvements: ['Restored GitHub repository headings'] };
  }

  private static parseGitHubRepositoryStatsLine(line: string): { owner: string; repo: string } | null {
    const stargazersPath = '/stargazers)';
    const stargazersEnd = line.indexOf(stargazersPath);
    if (stargazersEnd === -1) {
      return null;
    }

    const urlStart = line.lastIndexOf('(https://github.com/', stargazersEnd);
    if (urlStart === -1) {
      return null;
    }

    const repoPath = line.slice(urlStart + '(https://github.com/'.length, stargazersEnd);
    const [owner, repo, extra] = repoPath.split('/');
    if (!owner || !repo || extra) {
      return null;
    }

    const forksUrl = `(https://github.com/${owner}/${repo}/forks)`;
    return line.includes(forksUrl) ? { owner, repo } : null;
  }

  private static hasRecentRepositoryHeading(lines: string[], index: number, heading: string): boolean {
    let seen = 0;
    for (let i = index - 1; i >= 0 && seen < 8; i--) {
      const trimmed = (lines[i] ?? '').trim();
      if (!trimmed) {
        continue;
      }
      seen++;
      if (trimmed === heading) {
        return true;
      }
    }
    return false;
  }

  private static findRepositoryDescriptionStart(lines: string[], statsIndex: number): number {
    let cursor = statsIndex - 1;
    while (cursor >= 0 && (lines[cursor] ?? '').trim() === '') {
      cursor--;
    }
    if (cursor < 0) {
      return statsIndex;
    }

    while (cursor > 0) {
      const previous = (lines[cursor - 1] ?? '').trim();
      if (!previous || /^#{1,6}\s/.test(previous) || /stars today$/.test(previous)) {
        break;
      }
      cursor--;
    }
    return cursor;
  }

  private static cleanupMalformedAuthorMediaBlocks(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i] ?? '';
      if (current.trim() === '- [') {
        let cursor = this.skipBlankLines(lines, i + 1);
        const imageMatch = (lines[cursor] ?? '').trim().match(/^!\[([^\]]+)\]\([^)]+\)$/);
        cursor = this.skipBlankLines(lines, cursor + 1);
        if (imageMatch && (lines[cursor] ?? '').trim() === '```') {
          cursor = this.skipBlankLines(lines, cursor + 1);
          const linkMatch = (lines[cursor] ?? '').trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          cursor = this.skipBlankLines(lines, cursor + 1);
          if (linkMatch && imageMatch[1] === linkMatch[1] && (lines[cursor] ?? '').trim() === '```') {
            output.push('', `[${linkMatch[1]}](${linkMatch[2]})`, '');
            i = cursor;
            changed = true;
            continue;
          }
        }
      }

      output.push(current);
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: output.join('\n'), improvements: ['Cleaned malformed author media block'] };
  }

  private static skipBlankLines(lines: string[], startIndex: number): number {
    let cursor = startIndex;
    while (cursor < lines.length && (lines[cursor] ?? '').trim() === '') {
      cursor++;
    }
    return cursor;
  }

  private static removeInteractiveDemoChrome(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      if (/^Raw input\s+\S+/.test(trimmed)) {
        changed = true;
        continue;
      }

      if (/^```/.test(trimmed)) {
        const endIndex = this.findFenceEnd(lines, i + 1);
        if (endIndex !== -1) {
          const block = lines.slice(i + 1, endIndex).join('\n');
          if (this.isInteractiveDemoChromeBlock(block)) {
            changed = true;
            i = endIndex;
            continue;
          }
        }
      }

      if (this.isInteractiveDemoChromeBlock(line)) {
        changed = true;
        continue;
      }

      output.push(line);
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: output.join('\n'), improvements: ['Removed interactive demo chrome'] };
  }

  private static isInteractiveDemoChromeBlock(value: string): boolean {
    return (
      /<div class="mt-6 flex flex-col items-center justify-between/.test(value) &&
      /Run Demo/.test(value) &&
      /data-discover=/.test(value)
    );
  }

  private static cleanupListingChrome(markdown: string): { markdown: string; improvements: string[] } {
    const before = markdown;
    let processed = markdown
      .replace(/^\s*-\s*\[save\]\([^)]+#\)\s*$/gm, '')
      .replace(/\[newslett er\.eng-leadership\.com\]/g, '[newsletter.eng-leadership.com]')
      .replace(/\[ope n\.substack\.com\]/g, '[open.substack.com]');

    processed = processed.replace(/\n{3,}/g, '\n\n');

    if (processed === before) {
      return { markdown, improvements: [] };
    }
    return { markdown: processed, improvements: ['Removed listing action chrome'] };
  }

  private static cleanupIdentifierSpacing(markdown: string): { markdown: string; improvements: string[] } {
    const before = markdown;
    const processed = markdown
      .replace(/\bopen ai(?=\.chat\b)/g, 'openai')
      .replace(/^(main\(\);)\s+\|\s*$/gm, '$1');

    if (processed === before) {
      return { markdown, improvements: [] };
    }
    return { markdown: processed, improvements: ['Repaired split technical identifiers'] };
  }

  private static cleanupMisfencedMarkdownHeadings(markdown: string): { markdown: string; improvements: string[] } {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i] ?? '';
      const maybeHeading = lines[i + 1] ?? '';
      if (current.trim() === '```' && /^#{1,6}\s+\S/.test(maybeHeading) && (lines[i + 2] ?? '').trim() === '```') {
        output.push(maybeHeading);
        i += 2;
        changed = true;
        continue;
      }
      output.push(current);
    }

    if (!changed) {
      return { markdown, improvements: [] };
    }
    return { markdown: output.join('\n'), improvements: ['Unwrapped misfenced markdown headings'] };
  }

  private static cleanupMalformedDuplicateCodeExample(markdown: string): { markdown: string; improvements: string[] } {
    const before = markdown;
    const processed = markdown.replace(
      /(## Using the OpenAI SDK)\n\nimport OpenAI from 'openai';\n```\n[\s\S]*?\nmain\(\);\s*\|?\n```\n\n(?=```\nimport OpenAI from 'openai';)/g,
      '$1\n\n'
    );

    if (processed === before) {
      return { markdown, improvements: [] };
    }
    return { markdown: processed, improvements: ['Removed malformed duplicate code example'] };
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
    const headings = markdown.match(/^(#{1,6})\s*\S.*$/gm);
    
    if (!headings || headings.length < 2) {
      return { markdown, improvements, changes };
    }

    // Generate TOC
    let toc = '\n## Table of Contents\n\n';
    headings.forEach(heading => {
      const level = heading.match(/^(#{1,6})/)?.[1].length || 1;
      const text = heading.replace(/^#{1,6}\s*/, '');
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const indent = '  '.repeat(Math.max(0, level - 2));
      toc += `${indent}- [${text}](#${anchor})\n`;
    });

    toc += '\n';

    // Insert TOC after first heading
    const firstHeadingIndex = markdown.search(/^#{1,6}\s*\S/m);
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
