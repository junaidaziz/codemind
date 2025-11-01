'use client';

import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  image?: string;
  metrics: {
    prsReviewed: number;
    avgReviewTime: number; // in hours
    approvalRate: number; // percentage
    commentsGiven: number;
    criticalIssuesFound: number;
    avgResponseTime: number; // in hours
  };
}

interface TeamMetrics {
  overall: {
    totalPRs: number;
    avgReviewTurnaround: number;
    avgApprovalRate: number;
    totalReviewers: number;
    activePRs: number;
  };
  timeline: Array<{
    date: string;
    prs: number;
    avgReviewTime: number;
    approvalRate: number;
  }>;
  members: TeamMember[];
  trends: {
    reviewTimeChange: number; // percentage change
    approvalRateChange: number;
    throughputChange: number;
  };
}

export default function TeamPerformancePage() {
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [sortBy, setSortBy] = useState<'reviews' | 'speed' | 'quality'>('reviews');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/analytics/team-performance?range=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to load team performance metrics');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const getSortedMembers = () => {
    if (!metrics) return [];

    const sorted = [...metrics.members];
    
    switch (sortBy) {
      case 'reviews':
        return sorted.sort((a, b) => b.metrics.prsReviewed - a.metrics.prsReviewed);
      case 'speed':
        return sorted.sort((a, b) => a.metrics.avgReviewTime - b.metrics.avgReviewTime);
      case 'quality':
        return sorted.sort((a, b) => b.metrics.criticalIssuesFound - a.metrics.criticalIssuesFound);
      default:
        return sorted;
    }
  };

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  const getTrendColor = (change: number, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    if (isPositive) return 'text-green-600 dark:text-green-400';
    if (!isPositive && change !== 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorBanner
          message={error}
          title="Failed to Load Metrics"
          dismissible
          onDismiss={() => setError(null)}
        />
        <button
          onClick={loadMetrics}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-600 dark:text-gray-400">
          No metrics available
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Team Performance Metrics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Code review productivity and quality insights
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="mt-4 md:mt-0 flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {range === '7d' && 'Last 7 Days'}
              {range === '30d' && 'Last 30 Days'}
              {range === '90d' && 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total PRs Reviewed</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.overall.totalPRs}
          </div>
          <div className={`text-sm ${getTrendColor(metrics.trends.throughputChange)}`}>
            {getTrendIcon(metrics.trends.throughputChange)} {Math.abs(metrics.trends.throughputChange).toFixed(1)}% from previous period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Review Time</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {formatHours(metrics.overall.avgReviewTurnaround)}
          </div>
          <div className={`text-sm ${getTrendColor(metrics.trends.reviewTimeChange, true)}`}>
            {getTrendIcon(metrics.trends.reviewTimeChange)} {Math.abs(metrics.trends.reviewTimeChange).toFixed(1)}% from previous period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Approval Rate</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
            {metrics.overall.avgApprovalRate.toFixed(1)}%
          </div>
          <div className={`text-sm ${getTrendColor(metrics.trends.approvalRateChange)}`}>
            {getTrendIcon(metrics.trends.approvalRateChange)} {Math.abs(metrics.trends.approvalRateChange).toFixed(1)}% from previous period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Reviewers</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.overall.totalReviewers}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {metrics.overall.activePRs} active PRs
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Review Trends
        </h2>
        <div className="h-64 flex items-end justify-between gap-2">
          {metrics.timeline.map((point, index) => {
            const maxPRs = Math.max(...metrics.timeline.map(p => p.prs));
            const height = (point.prs / maxPRs) * 100;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {point.prs}
                  </div>
                  <div
                    className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-500"
                    style={{ height: `${height}%`, minHeight: point.prs > 0 ? '10px' : '0' }}
                    title={`${point.prs} PRs - ${formatHours(point.avgReviewTime)} avg review time - ${point.approvalRate.toFixed(1)}% approval rate`}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
                  {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Team Member Performance
          </h2>
          
          {/* Sort Options */}
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('reviews')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                sortBy === 'reviews'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              By Volume
            </button>
            <button
              onClick={() => setSortBy('speed')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                sortBy === 'speed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              By Speed
            </button>
            <button
              onClick={() => setSortBy('quality')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                sortBy === 'quality'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              By Quality
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Reviewer
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  PRs Reviewed
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Review Time
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Response Time
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Approval Rate
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Comments
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Critical Issues
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedMembers().map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900 dark:text-white">
                    {member.metrics.prsReviewed}
                  </td>
                  <td className="py-4 px-4 text-right text-gray-700 dark:text-gray-300">
                    {formatHours(member.metrics.avgReviewTime)}
                  </td>
                  <td className="py-4 px-4 text-right text-gray-700 dark:text-gray-300">
                    {formatHours(member.metrics.avgResponseTime)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`font-medium ${
                      member.metrics.approvalRate >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : member.metrics.approvalRate >= 60
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {member.metrics.approvalRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-700 dark:text-gray-300">
                    {member.metrics.commentsGiven}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
                      {member.metrics.criticalIssuesFound}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {metrics.members.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-500">
            No team member data available for this period
          </div>
        )}
      </div>

      {/* Export Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => {
            const dataStr = JSON.stringify(metrics, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `team-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Data
        </button>
      </div>
    </div>
  );
}
