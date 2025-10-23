'use client';

import React, { useState } from 'react';

interface AIMetricsSummary {
  totalFixes: number;
  successfulFixes: number;
  failedFixes: number;
  successRate: number;
  totalPRs: number;
  totalTests: number;
  timeSaved: number;
}

interface TrendData {
  date: string;
  started: number;
  completed: number;
  failed: number;
  successRate: number;
}

interface ProjectActivity {
  projectId: string;
  fixes: number;
  prs: number;
  tests: number;
  total: number;
}

interface RecentAction {
  id: string;
  eventType: string;
  entityType: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  duration: number | null;
  metadata: unknown;
  createdAt: string;
}

interface AIMetricsData {
  summary: AIMetricsSummary;
  trends: TrendData[];
  topProjects: ProjectActivity[];
  recentActions: RecentAction[];
}

export default function AIMetricsPage() {
  const [data, setData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const loadMetrics = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case 'all':
          startDate.setFullYear(2020); // Far back date
          break;
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`/api/analytics/ai-metrics?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load metrics');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Load on mount and when date range changes
  React.useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      case 'IN_PROGRESS':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AI Productivity Metrics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track AI-powered development insights and time saved
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <button
                onClick={loadMetrics}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading metrics...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Fixes */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">AI Fixes</div>
                  <div className="text-2xl">🔧</div>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.summary.totalFixes}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.summary.successfulFixes} successful
                </div>
              </div>

              {/* Success Rate */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                  <div className="text-2xl">✅</div>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {data.summary.successRate}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.summary.failedFixes} failed
                </div>
              </div>

              {/* PRs Created */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">AI PRs</div>
                  <div className="text-2xl">🔀</div>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {data.summary.totalPRs}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pull requests created
                </div>
              </div>

              {/* Tests Generated */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tests</div>
                  <div className="text-2xl">🧪</div>
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  {data.summary.totalTests}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Test cases generated
                </div>
              </div>
            </div>

            {/* Time Saved Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold mb-1">Estimated Time Saved</div>
                  <div className="text-sm opacity-90">
                    Based on average manual development time
                  </div>
                </div>
                <div className="text-5xl font-bold">
                  {formatDuration(data.summary.timeSaved)}
                </div>
              </div>
            </div>

            {/* Trends Chart */}
            {data.trends.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Activity Trends
                </h2>
                <div className="space-y-3">
                  {data.trends.slice(-10).map((trend) => (
                    <div key={trend.date} className="flex items-center gap-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 w-24">
                        {new Date(trend.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-2 bg-green-500 rounded-full"
                            style={{ width: `${(trend.completed / (trend.started || 1)) * 100}%` }}
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {trend.completed}/{trend.started}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 text-right">
                        {trend.successRate.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Projects */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Most Active Projects
                </h2>
                {data.topProjects.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No project activity yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.topProjects.map((project, idx) => (
                      <div
                        key={project.projectId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {project.projectId}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {project.fixes} fixes • {project.prs} PRs • {project.tests} tests
                          </div>
                        </div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                          {project.total}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Recent AI Actions
                </h2>
                {data.recentActions.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No recent actions
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.recentActions.map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {action.title}
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                              action.status
                            )}`}
                          >
                            {action.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(action.createdAt).toLocaleString()}
                          {action.duration && ` • ${Math.round(action.duration / 1000)}s`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
