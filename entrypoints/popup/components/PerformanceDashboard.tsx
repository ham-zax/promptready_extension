import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, Cog6ToothIcon, ChartBarIcon, ClockIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface PerformanceMetrics {
  timestamp: number;
  activeProcessingSessions: number;
  currentMemoryUsage?: number;
  cachePerformance: {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
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

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
  onSettingsClick?: () => void;
}

export function PerformanceDashboard({ isVisible, onClose, onSettingsClick }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2 seconds default

  // Fetch performance metrics from background script
  const fetchMetrics = useCallback(async () => {
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
      console.error('[PerformanceDashboard] Failed to fetch analytics:', error);
    }
  }, []);

  // Fetch real-time metrics
  const fetchRealTimeMetrics = useCallback(async () => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime) {
        const response = await browser.runtime.sendMessage({
          type: 'GET_REAL_TIME_METRICS'
        });

        if (response && response.success) {
          setMetrics(response.data);
        }
      }
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to fetch metrics:', error);
    }
  }, []);

  // Initialize data fetching
  useEffect(() => {
    if (!isVisible) return;

    setIsLoading(true);
    fetchMetrics();
    fetchRealTimeMetrics();

    // Set up auto-refresh if enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchRealTimeMetrics();
      }, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isVisible, autoRefresh, refreshInterval, fetchMetrics, fetchRealTimeMetrics]);

  // Close dashboard and cleanup
  const handleClose = () => {
    setAutoRefresh(false);
    onClose();
  };

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

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Performance Dashboard</h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto-refresh toggle */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 mr-2"
                />
                <span className="text-sm text-gray-700">Auto-refresh</span>
              </label>

              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="rounded border-gray-300 text-sm text-gray-700 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>
              )}
            </div>

            {/* Settings button */}
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Performance Settings"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            )}

            {/* Close button */}
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Close Dashboard"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading performance data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* System Health Overview */}
              {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">System Health</h3>
                      {getHealthIcon(analytics.systemHealth.status)}
                    </div>
                    <div className="mt-2">
                      <p className={`text-sm font-medium ${getHealthColor(analytics.systemHealth.status)}`}>
                        {analytics.systemHealth.status.toUpperCase()}
                      </p>
                      {analytics.recommendations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Recommendations:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {analytics.recommendations.slice(0, 3).map((rec, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-yellow-500 mr-1">•</span>
                                {rec}
                              </li>
                            ))}
                            {analytics.recommendations.length > 3 && (
                              <li className="text-gray-400">... and {analytics.recommendations.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <ClockIcon className="w-5 h-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-bold text-gray-900">
                        {metrics?.activeProcessingSessions || 0}
                      </p>
                      <p className="text-sm text-gray-500">Currently processing</p>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center">
                      <CpuChipIcon className="w-5 h-5 text-purple-600 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">Memory Usage</h3>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatMemory(metrics?.currentMemoryUsage)}
                      </p>
                      <p className="text-sm text-gray-500">Current usage</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              {metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cache Performance */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Cache Performance</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Hit Rate:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {metrics.cachePerformance.hitRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Requests:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {metrics.cachePerformance.totalRequests}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Retrieval:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {metrics.cachePerformance.averageRetrievalTime.toFixed(1)}ms
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Processing Trends */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Trends</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Processing Time:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {metrics.processingTrends.averageProcessingTime.toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Quality Score:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {metrics.processingTrends.averageQualityScore.toFixed(0)}/100
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Processed:</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {(metrics.processingTrends.totalProcessedContent / 1024).toFixed(1)}KB
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Overview Analytics */}
              {analytics && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Session Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {analytics.overview.totalSessions}
                      </p>
                      <p className="text-sm text-gray-500">Total Sessions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.overview.averageProcessingTime.toFixed(0)}ms
                      </p>
                      <p className="text-sm text-gray-500">Avg Time</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {analytics.overview.averageQualityScore.toFixed(0)}/100
                      </p>
                      <p className="text-sm text-gray-500">Avg Quality</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {analytics.overview.successRate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Success Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Chart */}
              {analytics && analytics.timeline.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-2">
                    {analytics.timeline.slice(-10).map((session, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            session.qualityScore > 80 ? 'bg-green-500' :
                            session.qualityScore > 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {session.sessionType}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTime(session.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {session.processingTime.toFixed(0)}ms
                          </p>
                          <p className="text-xs text-gray-500">
                            Score: {session.qualityScore}/100
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Last updated: {metrics ? formatTime(metrics.timestamp) : 'N/A'}
          </div>
          <div className="text-sm text-gray-500">
            {autoRefresh ? `Auto-refreshing every ${refreshInterval/1000}s` : 'Manual refresh'}
          </div>
        </div>
      </div>
    </div>
  );
}