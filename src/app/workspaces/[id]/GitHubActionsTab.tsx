'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';

interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  event: string;
  repository: {
    owner: string;
    name: string;
    full_name: string;
  };
}

interface WorkflowSummary {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  recent_runs: WorkflowRun[];
}

interface AIAnalysis {
  summary: string;
  root_cause?: string;
  recommendations?: string[];
  affected_files?: string[];
  error_category?: string;
  fix_complexity?: 'low' | 'medium' | 'high';
}

interface HealthMetrics {
  success_rate: number;
  average_duration: number;
  health_score: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface GitHubActionsTabProps {
  workspaceId: string;
}

export default function GitHubActionsTab({ workspaceId }: GitHubActionsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed' | 'success'>('all');
  const [showHealthMetrics, setShowHealthMetrics] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    fetchWorkflowRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, filter]);

  const fetchWorkflowRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filter === 'failed') {
        params.append('failed_only', 'true');
      }
      params.append('limit', '20');

      const data = await apiGet<WorkflowSummary>(`/api/workspaces/${workspaceId}/actions?${params}`);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow runs');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeRun = async (run: WorkflowRun) => {
    try {
      setAnalyzing(true);
      setSelectedRun(run);
      setAnalysis(null);
      setError(null);

      const result = await apiPost<{ result: AIAnalysis }>(`/api/workspaces/${workspaceId}/actions`, {
        analysisType: 'run',
        owner: run.repository.owner,
        repo: run.repository.name,
        runId: run.id,
      });

      setAnalysis(result.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze workflow run');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFetchHealthMetrics = async () => {
    try {
      setLoadingHealth(true);
      setError(null);

      const result = await apiPost<{ result: HealthMetrics }>(`/api/workspaces/${workspaceId}/actions`, {
        analysisType: 'health',
      });

      setHealthMetrics(result.result);
      setShowHealthMetrics(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health metrics');
    } finally {
      setLoadingHealth(false);
    }
  };

  const getStatusBadge = (run: WorkflowRun) => {
    if (run.status !== 'completed') {
      return (
        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded">
          {run.status === 'in_progress' ? '🔄 In Progress' : '⏸️ Queued'}
        </span>
      );
    }

    switch (run.conclusion) {
      case 'success':
        return (
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium rounded">
            ✅ Success
          </span>
        );
      case 'failure':
        return (
          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-medium rounded">
            ❌ Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded">
            🚫 Cancelled
          </span>
        );
      case 'skipped':
        return (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded">
            ⏭️ Skipped
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded">
            ⚪ Unknown
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary mb-1">Total Runs</p>
                <p className="text-3xl font-bold text-primary">{summary.total_runs}</p>
              </div>
              <div className="text-4xl">🔄</div>
            </div>
          </div>
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary mb-1">Successful</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{summary.successful_runs}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{summary.failed_runs}</p>
              </div>
              <div className="text-4xl">❌</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-primary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Runs
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-primary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Failed Only
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              filter === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-primary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Success Only
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchHealthMetrics}
            disabled={loadingHealth}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingHealth ? <InlineSpinner size="sm" /> : '📊 Build Health'}
          </button>
          <button
            onClick={fetchWorkflowRuns}
            className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Health Metrics Modal */}
      {showHealthMetrics && healthMetrics && (
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-primary">Build Health Metrics</h3>
            <button
              onClick={() => setShowHealthMetrics(false)}
              className="text-secondary hover:text-gray-900 dark:hover:text-gray-100"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-secondary mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-primary">
                {healthMetrics.success_rate?.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-secondary mb-1">Avg Duration</p>
              <p className="text-2xl font-bold text-primary">
                {healthMetrics.average_duration ? `${Math.floor(healthMetrics.average_duration / 60)}m` : 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-secondary mb-1">Health Score</p>
              <p className="text-2xl font-bold text-primary">
                {healthMetrics.health_score?.toFixed(0)}/100
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-secondary mb-1">Trend</p>
              <p className="text-2xl font-bold text-primary">
                {healthMetrics.trend === 'improving' ? '📈' : healthMetrics.trend === 'declining' ? '📉' : '➡️'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Runs List */}
      {summary && summary.recent_runs.length > 0 ? (
        <div className="space-y-3">
          {summary.recent_runs
            .filter((run) => {
              if (filter === 'failed') return run.conclusion === 'failure';
              if (filter === 'success') return run.conclusion === 'success';
              return true;
            })
            .map((run) => (
              <div
                key={run.id}
                className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-primary">{run.name}</h4>
                      {getStatusBadge(run)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-secondary">
                      <span>📁 {run.repository.full_name}</span>
                      <span>🌿 {run.head_branch}</span>
                      <span>⏰ {formatDate(run.created_at)}</span>
                      <span>🔔 {run.event}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.conclusion === 'failure' && (
                      <button
                        onClick={() => handleAnalyzeRun(run)}
                        disabled={analyzing && selectedRun?.id === run.id}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analyzing && selectedRun?.id === run.id ? <InlineSpinner size="sm" /> : '🤖 AI Analysis'}
                      </button>
                    )}
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      View on GitHub ↗
                    </a>
                  </div>
                </div>

                {/* AI Analysis Results */}
                {selectedRun?.id === run.id && analysis && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="text-md font-semibold text-primary mb-3">🤖 AI Analysis</h5>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary:</p>
                        <p className="text-sm text-secondary">{analysis.summary}</p>
                      </div>
                      {analysis.root_cause && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Root Cause:</p>
                          <p className="text-sm text-secondary">{analysis.root_cause}</p>
                        </div>
                      )}
                      {analysis.recommendations && analysis.recommendations.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendations:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {analysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-secondary">
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.error_category && (
                        <div className="flex items-center gap-4">
                          <span className="text-sm">
                            <strong>Category:</strong> {analysis.error_category}
                          </span>
                          {analysis.fix_complexity && (
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              analysis.fix_complexity === 'low'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                : analysis.fix_complexity === 'medium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            }`}>
                              Fix Complexity: {analysis.fix_complexity}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-6xl mb-6">🔄</div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            No Workflow Runs Found
          </h3>
          <p className="text-secondary">
            {filter === 'failed'
              ? 'No failed workflow runs found. Great job!'
              : 'Add repositories with GitHub Actions workflows to see their status here.'}
          </p>
        </div>
      )}
    </div>
  );
}
