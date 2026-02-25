// Quality Gate Validators for Graceful Degradation Pipeline
// Validates extraction results between stages to determine if fallback is needed

export interface QualityMetrics {
  characterCount: number;
  paragraphCount: number;
  linkDensity: number;
  avgParagraphLength: number;
  headingCount: number;
  signalToNoiseRatio: number;
  structureScore: number;
  temporalSignalCount: number;
  bylineSignalCount: number;
  orderedListCount: number;
  retentionCueScore: number;
}

export interface QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  failureReasons: string[];
  metrics: QualityMetrics;
}

export class QualityGateValidator {
  /**
   * Validates semantic query results (Stage 1)
   * Strict threshold: 55+ score required
   */
  static validateSemanticQuery(element: Element | null): QualityGateResult {
    if (!element) {
      return {
        passed: false,
        score: 0,
        failureReasons: ['No semantic element found'],
        metrics: this.createEmptyMetrics(),
      };
    }

    const metrics = this.calculateMetrics(element);
    const score = this.calculateScore(metrics);

    const failureReasons: string[] = [];
    if (metrics.characterCount < 300) {
      failureReasons.push(`Low character count: ${metrics.characterCount} < 300`);
    }
    if (metrics.paragraphCount < 2) {
      failureReasons.push(`Insufficient paragraphs: ${metrics.paragraphCount} < 2`);
    }
    if (metrics.linkDensity > 0.45) {
      failureReasons.push(`High link density: ${(metrics.linkDensity * 100).toFixed(1)}% > 45%`);
    }
    if (metrics.structureScore < 10) {
      failureReasons.push(`Poor structure score: ${metrics.structureScore} < 10`);
    }
    const passed = score >= 55 && failureReasons.length === 0;

    return {
      passed,
      score,
      failureReasons,
      metrics,
    };
  }

  /**
   * Validates Readability extraction results (Stage 2)
   * Medium threshold: 40+ score required
   */
  static validateReadability(
    article: any,
    originalDocument: Document
  ): QualityGateResult {
    if (!article || !article.content) {
      return {
        passed: false,
        score: 0,
        failureReasons: ['No content extracted by Readability'],
        metrics: this.createEmptyMetrics(),
      };
    }

    const tempDiv = originalDocument.createElement('div');
    tempDiv.innerHTML = article.content;
    const metrics = this.calculateMetrics(tempDiv);
    const score = this.calculateScore(metrics);

    const failureReasons: string[] = [];
    if (metrics.characterCount < 120) {
      failureReasons.push(`Low character count: ${metrics.characterCount} < 120`);
    }
    if (metrics.linkDensity > 0.4) {
      failureReasons.push(`High link density: ${(metrics.linkDensity * 100).toFixed(1)}% > 40%`);
    }
    const passed = score >= 40 && failureReasons.length === 0;

    return {
      passed,
      score,
      failureReasons,
      metrics,
    };
  }

  /**
   * Validates heuristic scoring results (Stage 3)
   * Lenient threshold: always passes (best-effort fallback)
   */
  static validateHeuristicScoring(element: Element | null): QualityGateResult {
    const metrics = this.calculateMetrics(element);
    const score = this.calculateScore(metrics);

    return {
      passed: true, // Stage 3 always passes - it's the last resort
      score,
      failureReasons: [],
      metrics,
    };
  }

  /**
   * Calculate quality metrics from an element
   */
  private static calculateMetrics(element: Element | null): QualityMetrics {
    if (!element) {
      return this.createEmptyMetrics();
    }

    const text = element.textContent || '';
    const characterCount = text.length;

    // Count paragraphs
    const paragraphs = Array.from(element.querySelectorAll('p'));
    const paragraphCount = paragraphs.length;

    // Calculate link density
    const links = element.querySelectorAll('a');
    const linkText = Array.from(links)
      .map(a => a.textContent?.length || 0)
      .reduce((a, b) => a + b, 0);
    const linkDensity = characterCount > 0 ? linkText / characterCount : 0;

    // Average paragraph length
    const avgParagraphLength =
      paragraphCount > 0
        ? paragraphs.reduce(
            (sum, p) => sum + ((p.textContent || '').length || 0),
            0
          ) / paragraphCount
        : 0;

    // Count headings
    const headingCount = element.querySelectorAll('h1, h2, h3, h4, h5, h6')
      .length;

    // Calculate signal-to-noise ratio (text vs tags)
    const htmlLength = element.innerHTML.length;
    const signalToNoiseRatio =
      htmlLength > 0 ? characterCount / htmlLength : 0;

    // Structure score (presence of semantic elements)
    const isSemanticRoot = element.matches(
      'article, main, section, [role="main"], [role="article"]'
    )
      ? 1
      : 0;
    const semanticElements = isSemanticRoot + element.querySelectorAll(
      'article, main, section, [role="main"], [role="article"]'
    ).length;
    const structureScore = Math.min(100, semanticElements * 20 + headingCount * 5);

    // Retention cue detection: helps rank candidates that preserve chronology and attribution.
    const temporalSignalCount =
      element.querySelectorAll(
        'time, [datetime], [itemprop*="date"], [class*="date"], [class*="time"], [data-testid*="time"], [data-testid*="date"]'
      ).length;
    const bylineSignalCount =
      element.querySelectorAll(
        '[rel="author"], [itemprop*="author"], .byline, [class*="author"], [data-testid*="author"]'
      ).length;
    const orderedListCount = element.querySelectorAll('ol').length;

    const textLower = text.toLowerCase();
    const temporalTextHits = Math.min(
      3,
      (textLower.match(
        /\b(\d{1,2}:\d{2}\s?(?:am|pm)?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})\b/gi
      ) || []).length
    );
    const bylineTextHits = /\bby\s+[a-z][a-z\s.'-]{2,60}\b/i.test(textLower) ? 1 : 0;
    const numberedEntryHits = Math.min(
      3,
      (text.match(/(^|\n)\s*\d{1,2}[.)]\s+\S/gm) || []).length
    );
    const retentionCueScore = Math.min(
      100,
      temporalSignalCount * 20 +
        bylineSignalCount * 18 +
        orderedListCount * 12 +
        temporalTextHits * 8 +
        bylineTextHits * 8 +
        numberedEntryHits * 8
    );

    return {
      characterCount,
      paragraphCount,
      linkDensity,
      avgParagraphLength,
      headingCount,
      signalToNoiseRatio,
      structureScore,
      temporalSignalCount,
      bylineSignalCount,
      orderedListCount,
      retentionCueScore,
    };
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private static calculateScore(metrics: QualityMetrics): number {
    if (metrics.characterCount <= 0) return 0;

    let score = 0;

    // Character count scoring (0-25 points)
    if (metrics.characterCount < 300) score += 0;
    else if (metrics.characterCount < 1000) score += 12;
    else if (metrics.characterCount < 5000) score += 20;
    else score += 25;

    // Paragraph count scoring (0-18 points)
    if (metrics.paragraphCount >= 5) score += 18;
    else if (metrics.paragraphCount >= 3) score += 14;
    else if (metrics.paragraphCount >= 1) score += 8;

    // Link density scoring (0-15 points)
    if (metrics.linkDensity < 0.1) score += 15;
    else if (metrics.linkDensity < 0.2) score += 12;
    else if (metrics.linkDensity < 0.4) score += 8;
    else if (metrics.linkDensity < 0.6) score += 4;

    // Signal-to-noise ratio scoring (0-10 points)
    if (metrics.signalToNoiseRatio > 0.5) score += 10;
    else if (metrics.signalToNoiseRatio > 0.3) score += 7;
    else if (metrics.signalToNoiseRatio > 0.1) score += 3;

    // Structure score (0-15 points)
    score += Math.min(15, metrics.structureScore / 10);

    // Retention cues (0-17 points)
    score += Math.min(17, metrics.retentionCueScore / 6);

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Generate a human-readable quality report
   */
  static generateReport(result: QualityGateResult): string {
    const { passed, score, metrics, failureReasons } = result;
    const lines: string[] = [];

    lines.push(`Quality Gate Report`);
    lines.push(`Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    lines.push(`Score: ${score}/100`);
    lines.push('');
    lines.push('Metrics:');
    lines.push(`  - Characters: ${metrics.characterCount}`);
    lines.push(`  - Paragraphs: ${metrics.paragraphCount}`);
    lines.push(
      `  - Link Density: ${(metrics.linkDensity * 100).toFixed(1)}%`
    );
    lines.push(
      `  - Avg Paragraph Length: ${metrics.avgParagraphLength.toFixed(0)}`
    );
    lines.push(`  - Headings: ${metrics.headingCount}`);
    lines.push(
      `  - Signal-to-Noise: ${(metrics.signalToNoiseRatio * 100).toFixed(1)}%`
    );
    lines.push(`  - Structure Score: ${metrics.structureScore.toFixed(1)}`);
    lines.push(`  - Temporal Signals: ${metrics.temporalSignalCount}`);
    lines.push(`  - Byline Signals: ${metrics.bylineSignalCount}`);
    lines.push(`  - Ordered Lists: ${metrics.orderedListCount}`);
    lines.push(`  - Retention Cue Score: ${metrics.retentionCueScore.toFixed(1)}`);

    if (failureReasons.length > 0) {
      lines.push('');
      lines.push('Failure Reasons:');
      failureReasons.forEach(reason => {
        lines.push(`  - ${reason}`);
      });
    }

    return lines.join('\n');
  }

  private static createEmptyMetrics(): QualityMetrics {
    return {
      characterCount: 0,
      paragraphCount: 0,
      linkDensity: 0,
      avgParagraphLength: 0,
      headingCount: 0,
      signalToNoiseRatio: 0,
      structureScore: 0,
      temporalSignalCount: 0,
      bylineSignalCount: 0,
      orderedListCount: 0,
      retentionCueScore: 0,
    };
  }
}
