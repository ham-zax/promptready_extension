// Performance Metrics Tracking for Readability Integration
// Provides production-ready performance monitoring with minimal overhead

import { OfflineModeConfig } from './offline-mode-manager.js';

export interface ExtractionMetrics {
  extractionTime: number;
  contentLength: number;
  contentQuality: number;
  charThreshold: string;
  presetUsed: string;
  timestamp: number;
}

export interface PipelineMetrics {
  readabilityTime: number;
  turndownTime: number;
  postProcessingTime: number;
  totalTime: number;
  htmlLength: number;
  extractedLength: number;
  markdownLength: number;
  fallbacksUsed: string[];
  timestamp: number;
}

export interface QualityMetrics {
  overallScore: number;
  structurePreservation: number;
  readabilityScore: number;
  warningsCount: number;
  errorsCount: number;
  timestamp: number;
}

export interface MemorySnapshot {
  heapUsed?: number;
  heapTotal?: number;
  heapLimit?: number;
  timestamp: number;
  phase: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  averageRetrievalTime: number;
  totalRetrievalTime: number;
}

export interface PerformanceReport {
  averageExtractionTime: number;
  cacheHitRate: number;
  totalExtractions: number;
  qualityScore: number;
  memoryUsage?: number;
  recommendations: string[];
}

export class PerformanceMetrics {
  private static instance: PerformanceMetrics | null = null;

  // Performance optimization settings
  private static readonly ENABLE_DETAILED_TRACKING = true; // Can be set to false for production
  private static readonly OVERHEAD_THRESHOLD = 5; // 5% overhead limit
  private static readonly MAX_MEMORY_SNAPSHOTS = 50; // Limit memory usage for tracking

  // In-memory storage for metrics
  private metrics = {
    extractionTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    extractionErrors: 0,
    contentLengths: [] as number[],
    presetUsage: new Map<string, number>(),
    pipelineMetrics: [] as PipelineMetrics[],
    qualityMetrics: [] as QualityMetrics[],
    memorySnapshots: [] as MemorySnapshot[],
    cacheRetrievalTimes: [] as number[],
    activeTimers: new Map<string, number>(),
    extractionSuccessCount: 0,
    extractionFailureCount: 0,
  };

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics();
    }
    return PerformanceMetrics.instance;
  }

  /**
   * Record extraction metrics
   */
  recordExtraction(metrics: ExtractionMetrics): void {
    this.metrics.extractionTimes.push(metrics.extractionTime);
    this.metrics.contentLengths.push(metrics.contentLength);
    this.metrics.totalRequests++;
    this.metrics.extractionSuccessCount++;

    // Track preset usage
    const currentUsage = this.metrics.presetUsage.get(metrics.presetUsed) || 0;
    this.metrics.presetUsage.set(metrics.presetUsed, currentUsage + 1);

    // Log for debugging
    console.log(`[PerformanceMetrics] Recorded extraction: ${metrics.extractionTime}ms, preset: ${metrics.presetUsed}, quality: ${metrics.contentQuality}`);
  }

  /**
   * Start performance timer for a specific operation
   */
  recordExtractionStart(): string {
    const timerId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.activeTimers.set(timerId, performance.now());
    console.log(`[PerformanceMetrics] Started extraction timer: ${timerId}`);
    return timerId;
  }

  /**
   * End timer and return duration
   */
  endTimer(timerId: string): number {
    const startTime = this.metrics.activeTimers.get(timerId);
    if (!startTime) {
      console.warn(`[PerformanceMetrics] Timer not found: ${timerId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.activeTimers.delete(timerId);
    console.log(`[PerformanceMetrics] Ended timer ${timerId}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Record cache hit with duration
   */
  recordCacheHit(duration: number): void {
    this.metrics.cacheHits++;
    this.metrics.totalRequests++;
    this.metrics.cacheRetrievalTimes.push(duration);
    console.log(`[PerformanceMetrics] Cache hit: ${duration.toFixed(2)}ms`);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
    this.metrics.totalRequests++;
    console.log(`[PerformanceMetrics] Cache miss recorded`);
  }

  /**
   * Record extraction failure
   */
  recordExtractionFailure(): void {
    this.metrics.extractionErrors++;
    this.metrics.extractionFailureCount++;
    console.log(`[PerformanceMetrics] Extraction failure recorded`);
  }

  /**
   * Capture memory snapshot for a processing phase
   */
  captureMemorySnapshot(phase: string): void {
    // Skip detailed tracking if disabled to minimize overhead
    if (!PerformanceMetrics.ENABLE_DETAILED_TRACKING) return;

    // Limit memory snapshots to prevent excessive memory usage
    if (this.metrics.memorySnapshots.length >= PerformanceMetrics.MAX_MEMORY_SNAPSHOTS) {
      // Keep only the most recent snapshots
      this.metrics.memorySnapshots = this.metrics.memorySnapshots.slice(-PerformanceMetrics.MAX_MEMORY_SNAPSHOTS + 1);
    }

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      phase,
    };

    try {
      // Check if memory API is available (only in some contexts)
      if (typeof performance !== 'undefined' && 
          (performance as any).memory && 
          typeof (performance as any).memory.usedJSHeapSize === 'number') {
        const memory = (performance as any).memory;
        snapshot.heapUsed = memory.usedJSHeapSize;
        snapshot.heapTotal = memory.totalJSHeapSize;
        snapshot.heapLimit = memory.jsHeapSizeLimit;
      } else {
        // console.warn('[PerformanceMetrics] Memory snapshot API not available in this context');
      }
    } catch (e) {
      console.warn('[PerformanceMetrics] Failed to capture memory snapshot:', e);
    }

    this.metrics.memorySnapshots.push(snapshot);
    // console.log(`[PerformanceMetrics] Memory snapshot for ${phase}: ${snapshot.heapUsed ? `${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB` : 'N/A'}`);
  }

  /**
   * Record processing pipeline snapshot
   */
  recordProcessingSnapshot(phase: string, extractionMetrics?: PipelineMetrics, cacheMetrics?: CacheMetrics, qualityMetrics?: QualityMetrics): void {
    // Skip detailed tracking if disabled to minimize overhead
    if (!PerformanceMetrics.ENABLE_DETAILED_TRACKING) return;

    console.log(`[PerformanceMetrics] Processing snapshot: ${phase}`);

    if (extractionMetrics) {
      // Keep only recent pipeline metrics to prevent memory growth
      if (this.metrics.pipelineMetrics.length >= 100) {
        this.metrics.pipelineMetrics = this.metrics.pipelineMetrics.slice(-50);
      }
      this.metrics.pipelineMetrics.push(extractionMetrics);
    }

    if (cacheMetrics) {
      // Cache metrics are already tracked in the main cache methods
    }

    if (qualityMetrics) {
      // Keep only recent quality metrics to prevent memory growth
      if (this.metrics.qualityMetrics.length >= 100) {
        this.metrics.qualityMetrics = this.metrics.qualityMetrics.slice(-50);
      }
      this.metrics.qualityMetrics.push(qualityMetrics);
    }
  }

  /**
   * Measure async operation duration
   */
  async measureAsyncOperation<T>(operationName: string, operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    console.log(`[PerformanceMetrics] Starting async operation: ${operationName}`);

    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      console.log(`[PerformanceMetrics] Completed ${operationName}: ${duration.toFixed(2)}ms`);

      if (operationName.includes('cache_retrieval')) {
        this.metrics.cacheRetrievalTimes.push(duration);
      }

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`[PerformanceMetrics] Failed ${operationName}: ${duration.toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * Record complete extraction metrics
   */
  recordExtractionComplete(
    readabilityTime: number,
    turndownTime: number,
    postProcessingTime: number,
    htmlLength: number,
    extractedLength: number,
    markdownLength: number,
    fallbacksUsed: string[]
  ): PipelineMetrics {
    const pipelineMetrics: PipelineMetrics = {
      readabilityTime,
      turndownTime,
      postProcessingTime,
      totalTime: readabilityTime + turndownTime + postProcessingTime,
      htmlLength,
      extractedLength,
      markdownLength,
      fallbacksUsed,
      timestamp: Date.now(),
    };

    this.metrics.pipelineMetrics.push(pipelineMetrics);
    console.log(`[PerformanceMetrics] Pipeline complete: ${pipelineMetrics.totalTime.toFixed(2)}ms total`);
    return pipelineMetrics;
  }

  /**
   * Record quality metrics
   */
  recordQualityMetrics(
    overallScore: number,
    structurePreservation: number,
    readabilityScore: number,
    warningsCount: number,
    errorsCount: number
  ): QualityMetrics {
    const qualityMetrics: QualityMetrics = {
      overallScore,
      structurePreservation,
      readabilityScore,
      warningsCount,
      errorsCount,
      timestamp: Date.now(),
    };

    this.metrics.qualityMetrics.push(qualityMetrics);
    console.log(`[PerformanceMetrics] Quality metrics: ${overallScore}/100 overall`);
    return qualityMetrics;
  }

  /**
   * Record turndown time (legacy method)
   */
  recordTurndownTime(contentLength: number): number {
    const estimatedTime = contentLength * 0.001; // Rough estimate
    console.log(`[PerformanceMetrics] Turndown time estimate: ${estimatedTime.toFixed(2)}ms`);
    return estimatedTime;
  }

  /**
   * Record post-processing time (legacy method)
   */
  recordPostProcessingTime(): number {
    const estimatedTime = 50; // Rough estimate
    console.log(`[PerformanceMetrics] Post-processing time estimate: ${estimatedTime}ms`);
    return estimatedTime;
  }

  
  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    const totalRetrievalTime = this.metrics.cacheRetrievalTimes.reduce((sum, time) => sum + time, 0);

    return {
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      hitRate: total > 0 ? (this.metrics.cacheHits / total) * 100 : 0,
      totalRequests: total,
      averageRetrievalTime: this.metrics.cacheRetrievalTimes.length > 0 ?
        totalRetrievalTime / this.metrics.cacheRetrievalTimes.length : 0,
      totalRetrievalTime,
    };
  }

  /**
   * Calculate average extraction time
   */
  getAverageExtractionTime(): number {
    if (this.metrics.extractionTimes.length === 0) return 0;

    const sum = this.metrics.extractionTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.extractionTimes.length;
  }

  /**
   * Calculate average content length
   */
  getAverageContentLength(): number {
    if (this.metrics.contentLengths.length === 0) return 0;

    const sum = this.metrics.contentLengths.reduce((a, b) => a + b, 0);
    return sum / this.metrics.contentLengths.length;
  }

  /**
   * Get most used preset
   */
  getMostUsedPreset(): string | null {
    let maxUsage = 0;
    let mostUsed = null;

    for (const [preset, usage] of this.metrics.presetUsage.entries()) {
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsed = preset;
      }
    }

    return mostUsed;
  }

  /**
   * Get preset usage breakdown
   */
  getPresetUsage(): Map<string, number> {
    return new Map(this.metrics.presetUsage);
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(): PerformanceReport {
    const cacheMetrics = this.getCacheMetrics();

    // Calculate quality score based on extraction errors and content quality
    const qualityScore = Math.max(
      0,
      100 - (this.metrics.extractionErrors * 20) - (this.metrics.extractionErrors / this.metrics.totalRequests * 10)
    );

    const recommendations: string[] = [];

    // Performance recommendations
    if (this.getAverageExtractionTime() > 30) {
      recommendations.push('Consider optimizing content extraction for better performance');
    }

    if (cacheMetrics.hitRate < 70) {
      recommendations.push('Review cache configuration for better hit rates');
    }

    if (this.metrics.extractionErrors > this.metrics.totalRequests * 0.05) {
      recommendations.push('High error rate detected - investigate extraction failures');
    }

    // Content quality recommendations
    if (qualityScore < 80) {
      recommendations.push('Content quality below target - review extraction settings');
    }

    return {
      averageExtractionTime: this.getAverageExtractionTime(),
      cacheHitRate: cacheMetrics.hitRate,
      totalExtractions: this.metrics.totalRequests,
      qualityScore,
      recommendations,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate current memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation based on stored metrics
    const metricsSize = JSON.stringify(this.metrics).length;
    const cacheSize = JSON.stringify(this.getCacheMetrics()).length;
    return metricsSize + cacheSize + 1000; // Base overhead + estimate
  }

  /**
   * Get pipeline performance metrics
   */
  getPipelineMetrics(): {
    avgReadabilityTime: number;
    avgTurndownTime: number;
    avgPostProcessingTime: number;
    avgTotalTime: number;
    totalProcessings: number;
    fallbackRate: number;
  } {
    if (this.metrics.pipelineMetrics.length === 0) {
      return {
        avgReadabilityTime: 0,
        avgTurndownTime: 0,
        avgPostProcessingTime: 0,
        avgTotalTime: 0,
        totalProcessings: 0,
        fallbackRate: 0,
      };
    }

    const totals = this.metrics.pipelineMetrics.reduce((acc, metric) => ({
      readabilityTime: acc.readabilityTime + metric.readabilityTime,
      turndownTime: acc.turndownTime + metric.turndownTime,
      postProcessingTime: acc.postProcessingTime + metric.postProcessingTime,
      totalTime: acc.totalTime + metric.totalTime,
      fallbacksUsed: acc.fallbacksUsed + metric.fallbacksUsed.length,
    }), {
      readabilityTime: 0,
      turndownTime: 0,
      postProcessingTime: 0,
      totalTime: 0,
      fallbacksUsed: 0,
    });

    const count = this.metrics.pipelineMetrics.length;

    return {
      avgReadabilityTime: totals.readabilityTime / count,
      avgTurndownTime: totals.turndownTime / count,
      avgPostProcessingTime: totals.postProcessingTime / count,
      avgTotalTime: totals.totalTime / count,
      totalProcessings: count,
      fallbackRate: (totals.fallbacksUsed / count) * 100,
    };
  }

  /**
   * Get quality performance metrics
   */
  getQualityMetrics(): {
    avgOverallScore: number;
    avgStructurePreservation: number;
    avgReadabilityScore: number;
    avgWarningsCount: number;
    avgErrorsCount: number;
    qualityTrend: 'improving' | 'stable' | 'declining';
  } {
    if (this.metrics.qualityMetrics.length === 0) {
      return {
        avgOverallScore: 0,
        avgStructurePreservation: 0,
        avgReadabilityScore: 0,
        avgWarningsCount: 0,
        avgErrorsCount: 0,
        qualityTrend: 'stable',
      };
    }

    const totals = this.metrics.qualityMetrics.reduce((acc, metric) => ({
      overallScore: acc.overallScore + metric.overallScore,
      structurePreservation: acc.structurePreservation + metric.structurePreservation,
      readabilityScore: acc.readabilityScore + metric.readabilityScore,
      warningsCount: acc.warningsCount + metric.warningsCount,
      errorsCount: acc.errorsCount + metric.errorsCount,
    }), {
      overallScore: 0,
      structurePreservation: 0,
      readabilityScore: 0,
      warningsCount: 0,
      errorsCount: 0,
    });

    const count = this.metrics.qualityMetrics.length;

    // Determine quality trend
    const recent = this.metrics.qualityMetrics.slice(-5); // Last 5 measurements
    const older = this.metrics.qualityMetrics.slice(-10, -5); // Previous 5 measurements
    let qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';

    if (recent.length >= 3 && older.length >= 2) {
      const recentAvg = recent.reduce((sum, m) => sum + m.overallScore, 0) / recent.length;
      const olderAvg = older.reduce((sum, m) => sum + m.overallScore, 0) / older.length;

      if (recentAvg > olderAvg + 2) qualityTrend = 'improving';
      else if (recentAvg < olderAvg - 2) qualityTrend = 'declining';
    }

    return {
      avgOverallScore: totals.overallScore / count,
      avgStructurePreservation: totals.structurePreservation / count,
      avgReadabilityScore: totals.readabilityScore / count,
      avgWarningsCount: totals.warningsCount / count,
      avgErrorsCount: totals.errorsCount / count,
      qualityTrend,
    };
  }

  /**
   * Get memory efficiency metrics
   */
  getMemoryEfficiency(): {
    peakUsage: number;
    avgUsage: number;
    currentUsage?: number;
    leakDetection: boolean;
    memoryGrowthRate: number;
  } {
    if (this.metrics.memorySnapshots.length === 0) {
      return {
        peakUsage: 0,
        avgUsage: 0,
        currentUsage: undefined,
        leakDetection: false,
        memoryGrowthRate: 0,
      };
    }

    const snapshots = this.metrics.memorySnapshots;
    const heapUsages = snapshots
      .filter(s => s.heapUsed !== undefined)
      .map(s => s.heapUsed!);

    if (heapUsages.length === 0) {
      return {
        peakUsage: 0,
        avgUsage: 0,
        currentUsage: undefined,
        leakDetection: false,
        memoryGrowthRate: 0,
      };
    }

    const peakUsage = Math.max(...heapUsages);
    const avgUsage = heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
    const currentUsage = heapUsages[heapUsages.length - 1];

    // Simple leak detection: check if memory is consistently growing
    const recentSnapshots = heapUsages.slice(-10);
    let leakDetection = false;
    let memoryGrowthRate = 0;

    if (recentSnapshots.length >= 5) {
      const firstHalf = recentSnapshots.slice(0, Math.floor(recentSnapshots.length / 2));
      const secondHalf = recentSnapshots.slice(Math.floor(recentSnapshots.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, usage) => sum + usage, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, usage) => sum + usage, 0) / secondHalf.length;

      memoryGrowthRate = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      leakDetection = memoryGrowthRate > 10; // 10% growth indicates potential leak
    }

    return {
      peakUsage: (peakUsage / 1024 / 1024), // Convert to MB
      avgUsage: (avgUsage / 1024 / 1024),
      currentUsage: currentUsage ? (currentUsage / 1024 / 1024) : undefined,
      leakDetection,
      memoryGrowthRate,
    };
  }

  /**
   * Get session ID for tracking
   */
  getSessionId(): string {
    // Generate or retrieve session ID from localStorage or generate new one
    if (typeof window !== 'undefined' && window.localStorage) {
      let sessionId = window.localStorage.getItem('performance_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        window.localStorage.setItem('performance_session_id', sessionId);
      }
      return sessionId;
    }
    return `session_${Date.now()}`;
  }

  /**
   * Check if performance overhead is acceptable (<5%)
   */
  checkPerformanceOverhead(): boolean {
    const totalTime = this.metrics.pipelineMetrics.reduce((sum, m) => sum + m.totalTime, 0);
    const estimatedOverheadTime = this.metrics.activeTimers.size * 0.1 + this.metrics.memorySnapshots.length * 0.5;

    const overheadPercentage = totalTime > 0 ? (estimatedOverheadTime / totalTime) * 100 : 0;

    console.log(`[PerformanceMetrics] Performance overhead: ${overheadPercentage.toFixed(2)}%`);

    // Automatically disable detailed tracking if overhead is too high
    if (overheadPercentage > PerformanceMetrics.OVERHEAD_THRESHOLD) {
      console.warn(`[PerformanceMetrics] Overhead too high (${overheadPercentage.toFixed(2)}%), consider reducing tracking detail`);
      // In production, you might want to automatically disable tracking
      // (this.ENABLE_DETAILED_TRACKING = false);
    }

    return overheadPercentage < PerformanceMetrics.OVERHEAD_THRESHOLD;
  }

  /**
   * Adaptive tracking adjustment based on current performance
   */
  adaptTrackingLevel(currentOverhead: number): 'minimal' | 'standard' | 'detailed' {
    if (currentOverhead > 7) {
      console.log('[PerformanceMetrics] Switching to minimal tracking due to high overhead');
      return 'minimal';
    } else if (currentOverhead > 3) {
      console.log('[PerformanceMetrics] Using standard tracking level');
      return 'standard';
    } else {
      console.log('[PerformanceMetrics] Using detailed tracking level');
      return 'detailed';
    }
  }

  /**
   * Get comprehensive metrics summary
   */
  getMetricsSummary(): any {
    return {
      cache: this.getCacheMetrics(),
      pipeline: this.getPipelineMetrics(),
      quality: this.getQualityMetrics(),
      memory: this.getMemoryEfficiency(),
      session: {
        id: this.getSessionId(),
        totalRequests: this.metrics.totalRequests,
        successCount: this.metrics.extractionSuccessCount,
        failureCount: this.metrics.extractionFailureCount,
        successRate: this.metrics.totalRequests > 0 ?
          (this.metrics.extractionSuccessCount / this.metrics.totalRequests) * 100 : 0,
      },
      overhead: {
        acceptable: this.checkPerformanceOverhead(),
        activeTimers: this.metrics.activeTimers.size,
      },
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): any {
    const cacheMetrics = this.getCacheMetrics();
    const pipelineMetrics = this.getPipelineMetrics();
    const qualityMetrics = this.getQualityMetrics();
    const memoryMetrics = this.getMemoryEfficiency();

    const recommendations: string[] = [];

    // Performance recommendations
    if (pipelineMetrics.avgTotalTime > 500) {
      recommendations.push('Total processing time is slow (>500ms average) - consider optimization');
    }

    if (cacheMetrics.hitRate < 70) {
      recommendations.push('Cache hit rate is low (<70%) - review caching strategy');
    }

    if (cacheMetrics.averageRetrievalTime > 50) {
      recommendations.push('Cache retrieval is slow (>50ms average) - optimize cache storage');
    }

    if (qualityMetrics.avgOverallScore < 80) {
      recommendations.push('Content quality is below target (<80/100) - review extraction settings');
    }

    if (memoryMetrics.leakDetection) {
      recommendations.push('Memory leak detected - investigate memory management');
    }

    return {
      summary: this.getMetricsSummary(),
      pipelinePerformance: pipelineMetrics,
      cachePerformance: cacheMetrics,
      qualityAssessment: qualityMetrics,
      memoryEfficiency: memoryMetrics,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      extractionTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      extractionErrors: 0,
      contentLengths: [],
      presetUsage: new Map(),
      pipelineMetrics: [],
      qualityMetrics: [],
      memorySnapshots: [],
      cacheRetrievalTimes: [],
      activeTimers: new Map(),
      extractionSuccessCount: 0,
      extractionFailureCount: 0,
    };

    console.log('[PerformanceMetrics] All metrics reset');
  }

  /**
   * Export metrics for debugging
   */
  exportMetrics(): any {
    return {
      ...this.metrics,
      cacheMetrics: this.getCacheMetrics(),
      averageExtractionTime: this.getAverageExtractionTime(),
      mostUsedPreset: this.getMostUsedPreset(),
      presetUsage: Object.fromEntries(this.metrics.presetUsage),
    };
  }

  /**
   * Log performance summary to console
   */
  logPerformanceSummary(): void {
    const report = this.generatePerformanceReport();

    console.log(`[PerformanceMetrics] Performance Summary:`);
    console.log(`  Average Extraction Time: ${report.averageExtractionTime.toFixed(2)}ms`);
    console.log(`  Cache Hit Rate: ${report.cacheHitRate.toFixed(1)}%`);
    console.log(`  Total Extractions: ${report.totalExtractions}`);
    console.log(`  Quality Score: ${report.qualityScore}/100`);

    if (report.recommendations.length > 0) {
      console.log(`[PerformanceMetrics] Recommendations:`);
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
  }
}