'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';

interface InsightsTabProps {
  workspaceId: string;
  repositories: string[]; // Array of "owner/repo" strings
}

interface ActivityEvent {
  id: string;
  eventType: string;
  title: string;
  description?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface RepositoryStats {
  owner: string;
  repo: string;
  commits: number;
  pullRequests: number;
  issues: number;
  contributors: number;
  lastActivity: string;
}

interface WorkspaceInsights {
  overview: {
    totalCommits: number;
    totalPullRequests: number;
    totalIssues: number;
    totalContributors: number;
    activeRepositories: number;
  };
  recentActivity: ActivityEvent[];
  repositoryStats: RepositoryStats[];
  topContributors: Array<{
    login: string;
    contributions: number;
    avatarUrl?: string;
  }>;
  activityTrend: Array<{
    date: string;
    commits: number;
    prs: number;
    issues: number;
  }>;
}

export default function InsightsTab({ workspaceId, repositories }: InsightsTabProps) {
  const [insights, setInsights] = useState<WorkspaceInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch real insights from API
      const data = await apiGet<WorkspaceInsights>(
        `/api/workspaces/${workspaceId}/insights?timeRange=${timeRange}${forceRefresh ? '&refresh=true' : ''}`
      );

      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (repositories.length > 0) {
      fetchInsights();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, timeRange, repositories.length]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'PR_MERGED':
        return '✅';
      case 'PR_OPENED':
        return '🔀';
      case 'COMMIT':
        return '💾';
      case 'ISSUE_OPENED':
        return '🐛';
      case 'ISSUE_CLOSED':
        return '✔️';
      default:
        return '📝';
    }
  };

  if (repositories.length === 0) {
    return (
      <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-primary mb-2">
            No Repositories Yet
          </h3>
          <p className="text-secondary mb-6">
            Add repositories to your workspace to see insights and analytics
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="flex flex-col items-center justify-center">
          <InlineSpinner />
          <p className="text-secondary mt-4">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
              Failed to Load Insights
            </h3>
            <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={() => fetchInsights(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">
          Workspace Insights
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 surface-card border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeRange === '7d'
                  ? 'bg-blue-600 text-white'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeRange === '30d'
                  ? 'bg-blue-600 text-white'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeRange === '90d'
                  ? 'bg-blue-600 text-white'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              90 Days
            </button>
          </div>
          <button
            onClick={() => fetchInsights(true)}
            disabled={refreshing}
            className="btn-accent px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {refreshing ? <InlineSpinner /> : '🔄'}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">💾</span>
          </div>
          <div className="text-sm text-secondary mb-1">Total Commits</div>
          <div className="text-2xl font-bold text-primary">
            {insights.overview.totalCommits.toLocaleString()}
          </div>
        </div>

        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">🔀</span>
          </div>
          <div className="text-sm text-secondary mb-1">Pull Requests</div>
          <div className="text-2xl font-bold text-primary">
            {insights.overview.totalPullRequests.toLocaleString()}
          </div>
        </div>

        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">🐛</span>
          </div>
          <div className="text-sm text-secondary mb-1">Issues</div>
          <div className="text-2xl font-bold text-primary">
            {insights.overview.totalIssues.toLocaleString()}
          </div>
        </div>

        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">👥</span>
          </div>
          <div className="text-sm text-secondary mb-1">Contributors</div>
          <div className="text-2xl font-bold text-primary">
            {insights.overview.totalContributors.toLocaleString()}
          </div>
        </div>

        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📁</span>
          </div>
          <div className="text-sm text-secondary mb-1">Active Repos</div>
          <div className="text-2xl font-bold text-primary">
            {insights.overview.activeRepositories}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {insights.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-2xl">{getEventIcon(activity.eventType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-secondary mt-1">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {formatTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            Top Contributors
          </h3>
          <div className="space-y-3">
            {insights.topContributors.map((contributor, index) => (
              <div
                key={contributor.login}
                className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <span className="text-lg font-bold text-gray-400 dark:text-gray-600 w-6">
                  #{index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">
                    {contributor.login}
                  </p>
                  <p className="text-xs text-secondary">
                    {contributor.contributions} contributions
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Trend Chart */}
      <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          Activity Trend (Last 7 Days)
        </h3>
        <div className="space-y-4">
          {insights.activityTrend.map((day) => (
            <div key={day.date} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary font-medium">{day.date}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-blue-600 dark:text-blue-400">
                    💾 {day.commits}
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    🔀 {day.prs}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400">
                    🐛 {day.issues}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 h-8">
                <div
                  className="bg-blue-500 rounded"
                  style={{ width: `${(day.commits / 50) * 100}%` }}
                  title={`${day.commits} commits`}
                />
                <div
                  className="bg-green-500 rounded"
                  style={{ width: `${(day.prs / 10) * 100}%` }}
                  title={`${day.prs} PRs`}
                />
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: `${(day.issues / 8) * 100}%` }}
                  title={`${day.issues} issues`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Repository Stats */}
      {insights.repositoryStats.length > 0 && (
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            Repository Statistics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">
                    Repository
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">
                    Commits
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">
                    PRs
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">
                    Issues
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">
                    Contributors
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.repositoryStats.map((stat) => (
                  <tr
                    key={`${stat.owner}/${stat.repo}`}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-primary">
                        {stat.owner}/{stat.repo}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary">
                      {stat.commits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary">
                      {stat.pullRequests.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary">
                      {stat.issues.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-secondary">
                      {stat.contributors.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-secondary">
                      {formatTimeAgo(stat.lastActivity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
