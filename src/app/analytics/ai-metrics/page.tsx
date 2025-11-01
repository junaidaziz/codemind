'use client';

import React, { useState } from 'react';
import { ErrorBanner } from '@/components/ui';

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
  const [exporting, setExporting] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [sendingToSlack, setSendingToSlack] = useState(false);

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

  const handleExport = async (format: 'csv' | 'json' | 'markdown') => {
    setExporting(true);
    try {
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
          startDate.setFullYear(2020);
          break;
      }

      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-metrics-${format}-${Date.now()}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleSendToSlack = async () => {
    if (!slackWebhook.trim()) {
      setError('Please enter a Slack webhook URL');
      return;
    }

    setSendingToSlack(true);
    try {
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
          startDate.setFullYear(2020);
          break;
      }

      const response = await fetch('/api/analytics/export/POST_SLACK', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: slackWebhook,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send to Slack');
      }

      setShowSlackModal(false);
      setSlackWebhook('');
      // Show success message
      alert('Successfully sent to Slack!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to Slack');
    } finally {
      setSendingToSlack(false);
    }
  };

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
      <div className="bg-gray-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
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
            <div className="flex items-center gap-3">
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
              
              {/* Export Dropdown */}
              <div className="relative group">
                <button
                  disabled={exporting || loading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
                
                <div className="absolute right-0 mt-2 w-48 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    disabled={exporting}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Export as Markdown
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button
                    onClick={() => setShowSlackModal(true)}
                    disabled={exporting}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                    </svg>
                    Send to Slack
                  </button>
                </div>
              </div>
              
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
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Fixes */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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

      {/* Slack Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Send to Slack
                </h2>
                <button
                  onClick={() => setShowSlackModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your Slack webhook URL to send the AI productivity metrics report directly to your Slack channel.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Slack Webhook URL
                </label>
                <input
                  type="url"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Don&apos;t have a webhook URL?{' '}
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Create one here
                  </a>
                </p>
              </div>
              {error && (
                <div className="mb-4">
                  <ErrorBanner message={error} onDismiss={() => setError(null)} />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowSlackModal(false);
                  setSlackWebhook('');
                  setError(null);
                }}
                disabled={sendingToSlack}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToSlack}
                disabled={sendingToSlack || !slackWebhook.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {sendingToSlack ? 'Sending...' : 'Send to Slack'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
