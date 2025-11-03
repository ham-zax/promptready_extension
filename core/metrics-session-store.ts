// Session Metrics Store - Tracks pipeline metrics across browser sessions
// Used for analytics, debugging, and performance monitoring

export interface PipelineMetric {
  timestamp: number;
  stage: 'semantic' | 'readability' | 'heuristic';
  qualityScore: number;
  fallbacksUsed: string[];
  extractionTime: number;
  url: string;
  title?: string;
}

export interface SessionMetricsSnapshot {
  totalExtractions: number;
  stage1Successes: number;
  stage2Successes: number;
  stage3Successes: number;
  averageQualityScore: number;
  averageExtractionTime: number;
  fallbackFrequency: Record<string, number>;
  recentMetrics: PipelineMetric[];
}

export class SessionMetricsStore {
  private static readonly STORAGE_KEY = 'pipeline_metrics';
  private static readonly MAX_METRICS = 100;
  private static readonly CACHE_DURATION_MS = 60000; // 1 minute

  private static metricsCache: PipelineMetric[] | null = null;
  private static cacheTimestamp: number = 0;

  /**
   * Record a new pipeline metric
   */
  static async recordMetric(metric: Omit<PipelineMetric, 'timestamp'>): Promise<void> {
    try {
      const existing = await this.getMetrics();
      const metrics = [...existing];

      metrics.push({
        ...metric,
        timestamp: Date.now(),
      });

      // Keep only the last MAX_METRICS
      if (metrics.length > this.MAX_METRICS) {
        metrics.shift();
      }

      // Store in browser.storage.session
      if (typeof browser !== 'undefined' && browser.storage?.session) {
        await browser.storage.session.set({ [this.STORAGE_KEY]: metrics });
      }

      // Update cache
      this.metricsCache = metrics;
      this.cacheTimestamp = Date.now();

      console.log(`[SessionMetricsStore] Recorded metric for stage: ${metric.stage}`);
    } catch (error) {
      console.warn('[SessionMetricsStore] Failed to record metric:', error);
    }
  }

  /**
   * Get all recorded metrics
   */
  static async getMetrics(): Promise<PipelineMetric[]> {
    // Check cache first
    if (
      this.metricsCache &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION_MS
    ) {
      return this.metricsCache;
    }

    try {
      if (typeof browser !== 'undefined' && browser.storage?.session) {
        const result = await browser.storage.session.get(this.STORAGE_KEY);
        const metrics = result[this.STORAGE_KEY] || [];
        this.metricsCache = metrics;
        this.cacheTimestamp = Date.now();
        return metrics;
      }
    } catch (error) {
      console.warn('[SessionMetricsStore] Failed to retrieve metrics:', error);
    }

    return [];
  }

  /**
   * Get metrics for a specific time range (in milliseconds)
   */
  static async getMetricsInRange(
    startTime: number,
    endTime: number
  ): Promise<PipelineMetric[]> {
    const metrics = await this.getMetrics();
    return metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Get metrics for a specific stage
   */
  static async getMetricsByStage(
    stage: 'semantic' | 'readability' | 'heuristic'
  ): Promise<PipelineMetric[]> {
    const metrics = await this.getMetrics();
    return metrics.filter(m => m.stage === stage);
  }

  /**
   * Get a snapshot summary of current metrics
   */
  static async getSnapshot(): Promise<SessionMetricsSnapshot> {
    const metrics = await this.getMetrics();

    if (metrics.length === 0) {
      return {
        totalExtractions: 0,
        stage1Successes: 0,
        stage2Successes: 0,
        stage3Successes: 0,
        averageQualityScore: 0,
        averageExtractionTime: 0,
        fallbackFrequency: {},
        recentMetrics: [],
      };
    }

    const stage1 = metrics.filter(m => m.stage === 'semantic').length;
    const stage2 = metrics.filter(m => m.stage === 'readability').length;
    const stage3 = metrics.filter(m => m.stage === 'heuristic').length;

    const qualityScores = metrics.map(m => m.qualityScore);
    const averageQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const extractionTimes = metrics.map(m => m.extractionTime);
    const averageTime =
      extractionTimes.length > 0
        ? extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length
        : 0;

    // Calculate fallback frequency
    const fallbackFrequency: Record<string, number> = {};
    metrics.forEach(m => {
      m.fallbacksUsed.forEach(fb => {
        fallbackFrequency[fb] = (fallbackFrequency[fb] || 0) + 1;
      });
    });

    return {
      totalExtractions: metrics.length,
      stage1Successes: stage1,
      stage2Successes: stage2,
      stage3Successes: stage3,
      averageQualityScore: Math.round(averageQuality),
      averageExtractionTime: Math.round(averageTime),
      fallbackFrequency,
      recentMetrics: metrics.slice(-10), // Last 10 metrics
    };
  }

  /**
   * Clear all stored metrics
   */
  static async clearMetrics(): Promise<void> {
    try {
      if (typeof browser !== 'undefined' && browser.storage?.session) {
        await browser.storage.session.remove(this.STORAGE_KEY);
      }
      this.metricsCache = null;
      this.cacheTimestamp = 0;
      console.log('[SessionMetricsStore] Metrics cleared');
    } catch (error) {
      console.warn('[SessionMetricsStore] Failed to clear metrics:', error);
    }
  }

  /**
   * Export metrics as JSON for debugging
   */
  static async exportMetricsJSON(): Promise<string> {
    const metrics = await this.getMetrics();
    const snapshot = await this.getSnapshot();

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        summary: snapshot,
        metrics: metrics,
      },
      null,
      2
    );
  }

  /**
   * Get performance statistics
   */
  static async getPerformanceStats(): Promise<{
    fastExtractions: number; // < 500ms
    normalExtractions: number; // 500ms - 2s
    slowExtractions: number; // > 2s
    percentile50: number;
    percentile95: number;
  }> {
    const metrics = await this.getMetrics();

    if (metrics.length === 0) {
      return {
        fastExtractions: 0,
        normalExtractions: 0,
        slowExtractions: 0,
        percentile50: 0,
        percentile95: 0,
      };
    }

    const times = metrics.map(m => m.extractionTime).sort((a, b) => a - b);

    const fast = times.filter(t => t < 500).length;
    const normal = times.filter(t => t >= 500 && t <= 2000).length;
    const slow = times.filter(t => t > 2000).length;

    const p50Index = Math.floor(times.length * 0.5);
    const p95Index = Math.floor(times.length * 0.95);

    return {
      fastExtractions: fast,
      normalExtractions: normal,
      slowExtractions: slow,
      percentile50: times[p50Index] || 0,
      percentile95: times[p95Index] || 0,
    };
  }

  /**
   * Get success rate by stage
   */
  static async getSuccessRates(): Promise<{
    stage1Percentage: number;
    stage2Percentage: number;
    stage3Percentage: number;
  }> {
    const snapshot = await this.getSnapshot();

    if (snapshot.totalExtractions === 0) {
      return {
        stage1Percentage: 0,
        stage2Percentage: 0,
        stage3Percentage: 0,
      };
    }

    return {
      stage1Percentage: Math.round(
        (snapshot.stage1Successes / snapshot.totalExtractions) * 100
      ),
      stage2Percentage: Math.round(
        (snapshot.stage2Successes / snapshot.totalExtractions) * 100
      ),
      stage3Percentage: Math.round(
        (snapshot.stage3Successes / snapshot.totalExtractions) * 100
      ),
    };
  }
}
