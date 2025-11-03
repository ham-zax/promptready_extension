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
   * Strict threshold: 60+ score required
   */
  static validateSemanticQuery(element: Element | null): QualityGateResult {
    const metrics = this.calculateMetrics(element);
    const score = this.calculateScore(metrics);
    const passed = score >= 60;

    const failureReasons: string[] = [];
    if (metrics.characterCount < 500) {
      failureReasons.push(`Low character count: ${metrics.characterCount} < 500`);
    }
    if (metrics.paragraphCount < 2) {
      failureReasons.push(`Insufficient paragraphs: ${metrics.paragraphCount} < 2`);
    }
    if (metrics.linkDensity > 0.4) {
      failureReasons.push(`High link density: ${(metrics.linkDensity * 100).toFixed(1)}% > 40%`);
    }
    if (metrics.structureScore < 30) {
      failureReasons.push(`Poor structure score: ${metrics.structureScore} < 30`);
    }

    return {
      passed,
      score,
      failureReasons: passed ? [] : failureReasons,
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
    const passed = score >= 40;

    const failureReasons: string[] = [];
    if (metrics.characterCount < 300) {
      failureReasons.push(`Low character count: ${metrics.characterCount} < 300`);
    }
    if (metrics.linkDensity > 0.5) {
      failureReasons.push(`High link density: ${(metrics.linkDensity * 100).toFixed(1)}% > 50%`);
    }

    return {
      passed,
      score,
      failureReasons: passed ? [] : failureReasons,
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
    const semanticElements = element.querySelectorAll(
      'article, main, section, [role="main"], [role="article"]'
    ).length;
    const structureScore = Math.min(100, semanticElements * 20 + headingCount * 5);

    return {
      characterCount,
      paragraphCount,
      linkDensity,
      avgParagraphLength,
      headingCount,
      signalToNoiseRatio,
      structureScore,
    };
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private static calculateScore(metrics: QualityMetrics): number {
    let score = 0;

    // Character count scoring (0-30 points)
    if (metrics.characterCount < 300) score += 0;
    else if (metrics.characterCount < 1000) score += 15;
    else if (metrics.characterCount < 5000) score += 25;
    else score += 30;

    // Paragraph count scoring (0-20 points)
    if (metrics.paragraphCount >= 5) score += 20;
    else if (metrics.paragraphCount >= 3) score += 15;
    else if (metrics.paragraphCount >= 1) score += 10;

    // Link density scoring (0-20 points)
    if (metrics.linkDensity < 0.1) score += 20;
    else if (metrics.linkDensity < 0.2) score += 15;
    else if (metrics.linkDensity < 0.4) score += 10;
    else if (metrics.linkDensity < 0.6) score += 5;

    // Signal-to-noise ratio scoring (0-15 points)
    if (metrics.signalToNoiseRatio > 0.5) score += 15;
    else if (metrics.signalToNoiseRatio > 0.3) score += 10;
    else if (metrics.signalToNoiseRatio > 0.1) score += 5;

    // Structure score (0-15 points)
    score += Math.min(15, metrics.structureScore / 10);

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
    };
  }
}
