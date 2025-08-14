// Content Quality Validator - ensures high-quality markdown output
// Provides comprehensive validation and quality scoring

export interface QualityMetrics {
  contentPreservation: number;
  structureIntegrity: number;
  markdownQuality: number;
  readability: number;
  completeness: number;
}

export interface QualityReport {
  overallScore: number;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  passesThreshold: boolean;
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  category: 'content' | 'structure' | 'formatting' | 'metadata';
  message: string;
  severity: number; // 1-10, 10 being most severe
  suggestion?: string;
}

export interface ValidationOptions {
  minContentLength: number;
  maxContentReduction: number; // Maximum allowed content reduction (0-1)
  minStructurePreservation: number; // Minimum structure preservation ratio (0-1)
  qualityThreshold: number; // Minimum overall quality score (0-100)
  strictMode: boolean;
}

export class ContentQualityValidator {
  
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    minContentLength: 500,
    maxContentReduction: 0.9, // Allow up to 90% reduction
    minStructurePreservation: 0.5, // Require at least 50% structure preservation
    qualityThreshold: 70, // Minimum score of 70/100
    strictMode: false,
  };

  /**
   * Validate processed markdown content quality
   */
  static validate(
    markdown: string,
    originalHtml: string,
    processingStats: any,
    options: Partial<ValidationOptions> = {}
  ): QualityReport {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const issues: QualityIssue[] = [];
    const recommendations: string[] = [];

    console.log('[ContentQualityValidator] Starting quality validation...');

    // Calculate individual metrics
    const contentPreservation = this.calculateContentPreservation(markdown, originalHtml, issues);
    const structureIntegrity = this.calculateStructureIntegrity(markdown, originalHtml, issues);
    const markdownQuality = this.calculateMarkdownQuality(markdown, issues);
    const readability = this.calculateReadability(markdown, issues);
    const completeness = this.calculateCompleteness(markdown, originalHtml, processingStats, issues);

    const metrics: QualityMetrics = {
      contentPreservation,
      structureIntegrity,
      markdownQuality,
      readability,
      completeness,
    };

    // Calculate overall score (weighted average)
    const weights = {
      contentPreservation: 0.25,
      structureIntegrity: 0.20,
      markdownQuality: 0.20,
      readability: 0.15,
      completeness: 0.20,
    };

    const overallScore = Object.entries(metrics).reduce((score, [metric, value]) => {
      return score + (value * weights[metric as keyof QualityMetrics]);
    }, 0);

    // Generate recommendations
    this.generateRecommendations(metrics, issues, recommendations, config);

    // Check if passes threshold
    const passesThreshold = overallScore >= config.qualityThreshold && 
                           this.meetsMinimumRequirements(metrics, config);

    console.log(`[ContentQualityValidator] Validation complete. Score: ${overallScore.toFixed(1)}/100`);

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      metrics,
      issues: issues.sort((a, b) => b.severity - a.severity),
      recommendations,
      passesThreshold,
    };
  }

  /**
   * Calculate content preservation score
   */
  private static calculateContentPreservation(
    markdown: string,
    originalHtml: string,
    issues: QualityIssue[]
  ): number {
    const markdownLength = markdown.length;
    const originalLength = originalHtml.length;
    
    if (originalLength === 0) {
      issues.push({
        type: 'error',
        category: 'content',
        message: 'Original content is empty',
        severity: 10,
      });
      return 0;
    }

    const reductionRatio = 1 - (markdownLength / originalLength);
    
    // Score based on content reduction
    let score = 100;
    
    if (reductionRatio > 0.95) {
      score = 10;
      issues.push({
        type: 'error',
        category: 'content',
        message: 'Excessive content loss (>95%)',
        severity: 9,
        suggestion: 'Check Readability configuration and fallback mechanisms',
      });
    } else if (reductionRatio > 0.9) {
      score = 30;
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'High content loss (>90%)',
        severity: 7,
        suggestion: 'Consider adjusting content extraction parameters',
      });
    } else if (reductionRatio > 0.8) {
      score = 60;
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Moderate content loss (>80%)',
        severity: 5,
      });
    } else if (reductionRatio < 0.1) {
      score = 70;
      issues.push({
        type: 'info',
        category: 'content',
        message: 'Minimal content filtering (<10% reduction)',
        severity: 3,
        suggestion: 'Content may contain noise that could be filtered',
      });
    }

    // Check for minimum content length
    if (markdownLength < 200) {
      score = Math.min(score, 20);
      issues.push({
        type: 'error',
        category: 'content',
        message: 'Output content too short',
        severity: 8,
      });
    }

    return score;
  }

  /**
   * Calculate structure integrity score
   */
  private static calculateStructureIntegrity(
    markdown: string,
    originalHtml: string,
    issues: QualityIssue[]
  ): number {
    let score = 100;

    // Count structural elements
    const markdownHeadings = (markdown.match(/^#{1,6}\s/gm) || []).length;
    const originalHeadings = (originalHtml.match(/<h[1-6][^>]*>/gi) || []).length;
    
    const markdownLists = (markdown.match(/^[\s]*[-*+]\s/gm) || []).length;
    const originalLists = (originalHtml.match(/<[uo]l[^>]*>/gi) || []).length;
    
    const markdownCodeBlocks = (markdown.match(/```[\s\S]*?```/g) || []).length;
    const originalCodeBlocks = (originalHtml.match(/<pre[^>]*>/gi) || []).length;

    // Check heading preservation
    if (originalHeadings > 0) {
      const headingPreservation = markdownHeadings / originalHeadings;
      if (headingPreservation < 0.3) {
        score -= 30;
        issues.push({
          type: 'error',
          category: 'structure',
          message: 'Poor heading preservation (<30%)',
          severity: 8,
          suggestion: 'Check heading extraction rules',
        });
      } else if (headingPreservation < 0.6) {
        score -= 15;
        issues.push({
          type: 'warning',
          category: 'structure',
          message: 'Moderate heading loss',
          severity: 5,
        });
      }
    }

    // Check list preservation
    if (originalLists > 0) {
      const listPreservation = markdownLists / originalLists;
      if (listPreservation < 0.5) {
        score -= 20;
        issues.push({
          type: 'warning',
          category: 'structure',
          message: 'Poor list preservation',
          severity: 6,
        });
      }
    }

    // Check code block preservation
    if (originalCodeBlocks > 0) {
      const codePreservation = markdownCodeBlocks / originalCodeBlocks;
      if (codePreservation < 0.7) {
        score -= 25;
        issues.push({
          type: 'error',
          category: 'structure',
          message: 'Poor code block preservation',
          severity: 7,
          suggestion: 'Verify code block extraction and conversion rules',
        });
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate markdown quality score
   */
  private static calculateMarkdownQuality(
    markdown: string,
    issues: QualityIssue[]
  ): number {
    let score = 100;

    // Check for HTML tags in markdown
    const htmlTagMatches = markdown.match(/<[^>]+>/g);
    if (htmlTagMatches && htmlTagMatches.length > 0) {
      const htmlTagCount = htmlTagMatches.length;
      score -= Math.min(40, htmlTagCount * 2);
      issues.push({
        type: 'warning',
        category: 'formatting',
        message: `HTML tags found in markdown output (${htmlTagCount})`,
        severity: 6,
        suggestion: 'Improve HTML to markdown conversion rules',
      });
    }

    // Check for excessive whitespace
    const excessiveWhitespace = markdown.match(/\n{4,}/g);
    if (excessiveWhitespace && excessiveWhitespace.length > 0) {
      score -= 10;
      issues.push({
        type: 'info',
        category: 'formatting',
        message: 'Excessive whitespace detected',
        severity: 3,
        suggestion: 'Enable post-processing whitespace cleanup',
      });
    }

    // Check for malformed links
    const malformedLinks = markdown.match(/\[([^\]]*)\]\(\s*\)/g);
    if (malformedLinks && malformedLinks.length > 0) {
      score -= 15;
      issues.push({
        type: 'warning',
        category: 'formatting',
        message: 'Malformed links detected',
        severity: 5,
        suggestion: 'Improve link processing and validation',
      });
    }

    // Check for proper heading hierarchy
    const headings = markdown.match(/^(#{1,6})\s/gm);
    if (headings && headings.length > 1) {
      const levels = headings.map(h => h.length - 1);
      let hierarchyIssues = 0;
      
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i-1] + 1) {
          hierarchyIssues++;
        }
      }
      
      if (hierarchyIssues > 0) {
        score -= hierarchyIssues * 5;
        issues.push({
          type: 'info',
          category: 'structure',
          message: 'Heading hierarchy issues detected',
          severity: 4,
          suggestion: 'Enable heading normalization in post-processing',
        });
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate readability score
   */
  private static calculateReadability(
    markdown: string,
    issues: QualityIssue[]
  ): number {
    let score = 100;

    // Calculate basic readability metrics
    const sentences = markdown.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = markdown.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = markdown.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    if (sentences.length === 0 || words.length === 0) {
      score = 0;
      issues.push({
        type: 'error',
        category: 'content',
        message: 'No readable content found',
        severity: 10,
      });
      return score;
    }

    // Average sentence length
    const avgSentenceLength = words.length / sentences.length;
    if (avgSentenceLength > 30) {
      score -= 15;
      issues.push({
        type: 'info',
        category: 'content',
        message: 'Long average sentence length may affect readability',
        severity: 3,
      });
    }

    // Paragraph structure
    if (paragraphs.length < 2 && words.length > 100) {
      score -= 20;
      issues.push({
        type: 'warning',
        category: 'structure',
        message: 'Poor paragraph structure',
        severity: 5,
        suggestion: 'Content may need better paragraph breaks',
      });
    }

    // Check for very short content
    if (words.length < 50) {
      score -= 30;
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Very short content may not be meaningful',
        severity: 6,
      });
    }

    return Math.max(0, score);
  }

  /**
   * Calculate completeness score
   */
  private static calculateCompleteness(
    markdown: string,
    originalHtml: string,
    processingStats: any,
    issues: QualityIssue[]
  ): number {
    let score = 100;

    // Check if processing used fallbacks
    if (processingStats?.fallbacksUsed?.length > 0) {
      const fallbackPenalty = processingStats.fallbacksUsed.length * 15;
      score -= fallbackPenalty;
      issues.push({
        type: 'warning',
        category: 'content',
        message: `Processing used ${processingStats.fallbacksUsed.length} fallback(s)`,
        severity: 6,
        suggestion: 'Primary processing methods failed, check configuration',
      });
    }

    // Check processing time (very fast might indicate failure)
    if (processingStats?.totalTime < 100) {
      score -= 10;
      issues.push({
        type: 'info',
        category: 'metadata',
        message: 'Very fast processing time may indicate incomplete processing',
        severity: 3,
      });
    }

    // Check for processing errors
    if (processingStats?.errors?.length > 0) {
      score -= 40;
      issues.push({
        type: 'error',
        category: 'content',
        message: 'Processing errors occurred',
        severity: 8,
      });
    }

    return Math.max(0, score);
  }

  /**
   * Generate recommendations based on metrics and issues
   */
  private static generateRecommendations(
    metrics: QualityMetrics,
    issues: QualityIssue[],
    recommendations: string[],
    config: ValidationOptions
  ): void {
    // Content preservation recommendations
    if (metrics.contentPreservation < 60) {
      recommendations.push('Consider adjusting Readability configuration for better content extraction');
      recommendations.push('Review content extraction selectors and rules');
    }

    // Structure integrity recommendations
    if (metrics.structureIntegrity < 70) {
      recommendations.push('Enable structure-preserving options in Turndown configuration');
      recommendations.push('Review heading and list conversion rules');
    }

    // Markdown quality recommendations
    if (metrics.markdownQuality < 80) {
      recommendations.push('Enable post-processing to clean up markdown formatting');
      recommendations.push('Review Turndown custom rules for better conversion');
    }

    // Readability recommendations
    if (metrics.readability < 70) {
      recommendations.push('Consider content preprocessing to improve structure');
      recommendations.push('Enable paragraph normalization in post-processing');
    }

    // Completeness recommendations
    if (metrics.completeness < 80) {
      recommendations.push('Review processing pipeline for potential failures');
      recommendations.push('Consider enabling more robust fallback mechanisms');
    }

    // High-severity issue recommendations
    const highSeverityIssues = issues.filter(issue => issue.severity >= 7);
    if (highSeverityIssues.length > 0) {
      recommendations.push('Address high-severity issues to improve overall quality');
    }

    // Remove duplicates
    const uniqueRecommendations = [...new Set(recommendations)];
    recommendations.splice(0, recommendations.length, ...uniqueRecommendations);
  }

  /**
   * Check if metrics meet minimum requirements
   */
  private static meetsMinimumRequirements(
    metrics: QualityMetrics,
    config: ValidationOptions
  ): boolean {
    if (config.strictMode) {
      return Object.values(metrics).every(score => score >= 70);
    }

    // At least content preservation and structure integrity should be decent
    return metrics.contentPreservation >= 50 && metrics.structureIntegrity >= 40;
  }

  /**
   * Get quality grade based on score
   */
  static getQualityGrade(score: number): { grade: string; description: string } {
    if (score >= 90) {
      return { grade: 'A', description: 'Excellent quality' };
    } else if (score >= 80) {
      return { grade: 'B', description: 'Good quality' };
    } else if (score >= 70) {
      return { grade: 'C', description: 'Acceptable quality' };
    } else if (score >= 60) {
      return { grade: 'D', description: 'Poor quality' };
    } else {
      return { grade: 'F', description: 'Failed quality check' };
    }
  }

  /**
   * Generate quality summary report
   */
  static generateSummaryReport(report: QualityReport): string {
    const grade = this.getQualityGrade(report.overallScore);
    const errorCount = report.issues.filter(i => i.type === 'error').length;
    const warningCount = report.issues.filter(i => i.type === 'warning').length;

    return `Quality Report: ${grade.grade} (${report.overallScore}/100)
${grade.description}

Issues: ${errorCount} errors, ${warningCount} warnings
${report.passesThreshold ? '✅ Passes quality threshold' : '❌ Below quality threshold'}

Top Recommendations:
${report.recommendations.slice(0, 3).map(r => `• ${r}`).join('\n')}`;
  }
}
