import { useState, useEffect, useCallback } from 'react';

interface PerformanceMetrics {
  timestamp: number;
  activeProcessingSessions: number;
  currentMemoryUsage?: number;
  cachePerformance: {
    hits: number;
    misses: number;
    hitRate: number;
    averageRetrievalTime: number;
  };
  processingTrends: {
    activeSessions: number;
    averageProcessingTime: number;
    averageQualityScore: number;
    totalProcessedContent: number;
  };
  systemHealth: 'optimal' | 'warning' | 'critical';
  recommendations: string[];
}

interface PerformanceAnalytics {
  overview: {
    totalSessions: number;
    averageProcessingTime: number;
    averageQualityScore: number;
    successRate: number;
  };
  timeline: Array<{
    timestamp: number;
    processingTime: number;
    qualityScore: number;
    sessionType: string;
  }>;
  cacheAnalytics: {
    hitRate: number;
    totalRequests: number;
    averageRetrievalTime: number;
  };
  systemHealth: {
    status: 'optimal' | 'warning' | 'critical';
    issues: string[];
  };
  recommendations: string[];
}

export function usePerformanceMonitor(refreshInterval: number = 2000) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Fetch real-time metrics
  const fetchMetrics = useCallback(async () => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime) {
        const response = await browser.runtime.sendMessage({
          type: 'GET_REAL_TIME_METRICS'
        });

        if (response && response.success) {
          setMetrics(response.data);
          setLastUpdate(Date.now());
        }
      }
    } catch (error) {
      console.error('[usePerformanceMonitor] Failed to fetch metrics:', error);
    }
  }, []);

  // Fetch comprehensive analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime) {
        const response = await browser.runtime.sendMessage({
          type: 'GET_PERFORMANCE_ANALYTICS'
        });

        if (response && response.success) {
          setAnalytics(response.data);
        }
      }
    } catch (error) {
      console.error('[usePerformanceMonitor] Failed to fetch analytics:', error);
    }
  }, []);

  // Setup message listener for real-time updates
  const handleMetricsUpdate = useCallback((message: any) => {
    if (message.type === 'PERFORMANCE_METRICS_UPDATE') {
      setMetrics(message.payload);
      setLastUpdate(Date.now());
    }
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!isConnected || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [isConnected, autoRefresh, refreshInterval, fetchMetrics]);

  // Setup message listener
  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.onMessage.addListener(handleMetricsUpdate);

      // Test connection on mount
      browser.runtime.sendMessage({
        type: 'GET_REAL_TIME_METRICS'
      }).then(() => {
        setIsConnected(true);
      }).catch(() => {
        console.warn('[usePerformanceMonitor] Failed to connect to performance monitoring');
      });
    }

    return () => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.removeListener(handleMetricsUpdate);
      }
    };
  }, [handleMetricsUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.removeListener(handleMetricsUpdate);
      }
    };
  }, []);

  // Format time display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format memory usage
  const formatMemory = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Get health status color
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get health status icon
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'optimal':
        return <div className="w-3 h-3 rounded-full bg-green-500" />;
      case 'warning':
        return <div className="w-3 h-3 rounded-full bg-yellow-500" />;
      case 'critical':
        return <div className="w-3 h-3 rounded-full bg-red-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-500" />;
    }
  };

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchMetrics();
    fetchAnalytics();
  }, [fetchMetrics, fetchAnalytics]);

  return {
    metrics,
    analytics,
    isConnected,
    autoRefresh,
    lastUpdate,
    refresh,
    formatTime,
    formatMemory,
    getHealthColor,
    getHealthIcon,
    setAutoRefresh,
  };
}