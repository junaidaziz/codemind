import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChartComponent,
  DoughnutChartComponent,
  MultiLineChartComponent
} from './ChartComponents';
import { ContributorDetailModal } from './ContributorDetailModal';
import { 
  GitCommit,
  GitPullRequest,
  Users,
  AlertCircle,
  RefreshCw,
  Calendar,
  TrendingUp,
  Filter,
  Search,
  X,
  GitBranch
} from 'lucide-react';
import { ErrorBanner } from '@/components/ui';

interface ProjectAnalyticsData {
  summary: {
    totalCommits: number;
    totalContributors: number;
    totalPullRequests: number;
    totalIssues: number;
    openPullRequests: number;
    mergedPullRequests: number;
    openIssues: number;
    closedIssues: number;
    // AI Metrics
    totalAIFixes: number;
    totalAISessions: number;
    aiSuccessRate: number;
    aiPRAcceptanceRate: number;
    avgAIConfidence: number;
    avgProcessingTime: number;
    timeframe: string;
    startDate: string;
    endDate: string;
  };
  aiMetrics?: {
    summary: {
      totalFixes: number;
      totalSessions: number;
      successfulSessions: number;
      successRate: number;
      avgConfidence: number;
      avgProcessingTime: number;
      prsCreated: number;
      prsMerged: number;
      prAcceptanceRate: number;
    };
    trends: Array<{
      date: string;
      fixes: number;
      sessionsStarted: number;
      successfulSessions: number;
      prsCreated: number;
      prsMerged: number;
      confidence: number;
    }>;
    recentMetrics: Array<{
      id: string;
      period: string;
      totalSessions: number;
      successfulSessions: number;
      totalIssuesFixed: number;
      avgConfidence: number;
      totalPRsCreated: number;
      totalPRsMerged: number;
    }>;
  };
  activityTrends: Array<{
    date: string;
    commits: number;
    pullRequests: number;
    issues: number;
  }>;
  contributors: Array<{
    login: string;
    avatarUrl: string;
    htmlUrl: string;
    totalContributions: number;
    commitsInPeriod: number;
    pullRequestsInPeriod: number;
    lastActivity: string | null;
  }>;
  codeChangesOverTime: Array<{
    date: string;
    additions: number;
    deletions: number;
    netChanges: number;
  }>;
  pullRequestMetrics: {
    averageTimeToMerge: number;
    mergeRate: number;
    reviewTurnaround: number;
  };
  recentCommits: Array<{
    sha: string;
    message: string;
    authorLogin: string;
    authorDate: string;
    htmlUrl: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  }>;
  recentPullRequests: Array<{
    number: number;
    title: string;
    authorLogin: string;
    state: string;
    createdAt: string;
    htmlUrl: string;
  }>;
}

interface ProjectAnalyticsDashboardProps {
  projectId: string;
  isDarkMode?: boolean;
}

export const ProjectAnalyticsDashboard: React.FC<ProjectAnalyticsDashboardProps> = ({
  projectId,
  isDarkMode = false
}) => {
  const [data, setData] = useState<ProjectAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [syncing, setSyncing] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    contributors: [] as string[],
    branch: '',
    search: '',
    showFilters: false
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        timeframe,
        ...(filters.contributors.length > 0 && { contributors: filters.contributors.join(',') }),
        ...(filters.branch && { branch: filters.branch }),
        ...(filters.search && { search: filters.search })
      });
      
      const response = await fetch(`/api/projects/${projectId}/analytics?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [projectId, timeframe, filters]);

  const syncGitHubData = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch(`/api/projects/${projectId}/sync-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncCommits: true,
          syncPullRequests: true,
          syncIssues: true,
          syncContributors: true,
        }),
      });
      
      if (response.ok) {
        // Refresh analytics data after sync
        await fetchAnalytics();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync GitHub data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync GitHub data');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner message={error}>
        <button
          onClick={fetchAnalytics}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </ErrorBanner>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No analytics data available
      </div>
    );
  }

  const activityChartData = data.activityTrends.map(trend => ({
    timestamp: trend.date,
    value: trend.commits + trend.pullRequests + trend.issues
  }));

  const commitActivityData = data.activityTrends.map(trend => ({
    timestamp: trend.date,
    commits: trend.commits,
    pullRequests: trend.pullRequests,
    issues: trend.issues
  }));

  const contributorChartData = data.contributors.slice(0, 8).map(contributor => ({
    name: contributor.login,
    value: contributor.totalContributions,
    percentage: (contributor.totalContributions / data.contributors.reduce((sum, c) => sum + c.totalContributions, 0)) * 100
  }));

  const codeChangesChartData = data.codeChangesOverTime.map(change => ({
    timestamp: change.date,
    additions: change.additions,
    deletions: change.deletions
  }));

  // AI metrics chart data
  const aiActivityData = data.aiMetrics?.trends.map(trend => ({
    timestamp: trend.date,
    fixes: trend.fixes,
    sessionsStarted: trend.sessionsStarted,
    successfulSessions: trend.successfulSessions,
    prsCreated: trend.prsCreated,
    confidence: trend.confidence * 100 // Convert to percentage
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Project Analytics
        </h2>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
              filters.showFilters || filters.contributors.length > 0 || filters.branch || filters.search
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {(filters.contributors.length > 0 || filters.branch || filters.search) && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {filters.contributors.length + (filters.branch ? 1 : 0) + (filters.search ? 1 : 0)}
              </span>
            )}
          </button>
          
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
          
          <button
            onClick={syncGitHubData}
            disabled={syncing}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync GitHub Data'}</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {filters.showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search commits, PRs, issues..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Branch Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Branch
              </label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g., main, develop, feature/*"
                  value={filters.branch}
                  onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
                {filters.branch && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, branch: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Contributors Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contributors
              </label>
              <div className="space-y-2">
                <select
                  onChange={(e) => {
                    const contributor = e.target.value;
                    if (contributor && !filters.contributors.includes(contributor)) {
                      setFilters(prev => ({
                        ...prev,
                        contributors: [...prev.contributors, contributor]
                      }));
                    }
                    e.target.value = '';
                  }}
                  className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Add contributor...</option>
                  {data?.contributors
                    .filter(c => !filters.contributors.includes(c.login))
                    .map(contributor => (
                      <option key={contributor.login} value={contributor.login}>
                        {contributor.login}
                      </option>
                    ))}
                </select>
                
                {filters.contributors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {filters.contributors.map(contributor => (
                      <span
                        key={contributor}
                        className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                      >
                        {contributor}
                        <button
                          onClick={() => setFilters(prev => ({
                            ...prev,
                            contributors: prev.contributors.filter(c => c !== contributor)
                          }))}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setFilters({
                contributors: [],
                branch: '',
                search: '',
                showFilters: true
              })}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear all filters
            </button>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {(filters.contributors.length > 0 || filters.branch || filters.search) && (
                <>
                  {filters.contributors.length + (filters.branch ? 1 : 0) + (filters.search ? 1 : 0)} filter(s) active
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Commits</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalCommits}</p>
            </div>
            <GitCommit className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Contributors</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalContributors}</p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pull Requests</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalPullRequests}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {data.summary.openPullRequests} open, {data.summary.mergedPullRequests} merged
              </p>
            </div>
            <GitPullRequest className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Issues</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalIssues}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {data.summary.openIssues} open, {data.summary.closedIssues} closed
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* AI Metrics Section */}
      {data.aiMetrics && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full p-1 mr-2">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              AI Assistant Analytics
            </h3>
            
            {/* AI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700 p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">AI Fixes Applied</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{data.aiMetrics.summary.totalFixes}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      From {data.aiMetrics.summary.totalSessions} sessions
                    </p>
                  </div>
                  <div className="bg-blue-600 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg shadow-sm border border-green-200 dark:border-green-700 p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Success Rate</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{data.aiMetrics.summary.successRate.toFixed(1)}%</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {data.aiMetrics.summary.successfulSessions} successful
                    </p>
                  </div>
                  <div className="bg-green-600 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg shadow-sm border border-purple-200 dark:border-purple-700 p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">AI PRs Created</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{data.aiMetrics.summary.prsCreated}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {data.aiMetrics.summary.prsMerged} merged ({data.aiMetrics.summary.prAcceptanceRate.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="bg-purple-600 rounded-full p-2">
                    <GitPullRequest className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg shadow-sm border border-orange-200 dark:border-orange-700 p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Avg Confidence</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{(data.aiMetrics.summary.avgConfidence * 100).toFixed(1)}%</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      ~{data.aiMetrics.summary.avgProcessingTime.toFixed(1)}s avg
                    </p>
                  </div>
                  <div className="bg-orange-600 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trends */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Overview</h3>
          <LineChartComponent
            data={activityChartData}
            title="Daily Activity"
            height={300}
            isDarkMode={isDarkMode}
            formatValue={(value) => value.toString()}
          />
        </div>

        {/* Contributor Distribution */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Contributors</h3>
          <DoughnutChartComponent
            data={contributorChartData}
            title="Contribution Distribution"
            height={300}
            isDarkMode={isDarkMode}
            showLabels={false}
          />
        </div>

        {/* Multi-line Activity Chart */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Breakdown</h3>
          <MultiLineChartComponent
            data={commitActivityData}
            lines={[
              { dataKey: 'commits', name: 'Commits', color: '#3B82F6' },
              { dataKey: 'pullRequests', name: 'Pull Requests', color: '#8B5CF6' },
              { dataKey: 'issues', name: 'Issues', color: '#F59E0B' }
            ]}
            title="Daily Activity by Type"
            height={350}
            isDarkMode={isDarkMode}
            formatValue={(value) => value.toString()}
          />
        </div>

        {/* Code Changes Over Time */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Code Changes</h3>
          <MultiLineChartComponent
            data={codeChangesChartData}
            lines={[
              { dataKey: 'additions', name: 'Additions', color: '#10B981' },
              { dataKey: 'deletions', name: 'Deletions', color: '#EF4444' }
            ]}
            title="Lines Added vs Deleted"
            height={350}
            isDarkMode={isDarkMode}
            formatValue={(value) => value.toLocaleString()}
          />
        </div>

        {/* AI Activity Chart */}
        {data.aiMetrics && aiActivityData.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
              <div className="bg-blue-600 rounded-full p-1 mr-2">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              AI Assistant Activity
            </h3>
            <MultiLineChartComponent
              data={aiActivityData}
              lines={[
                { dataKey: 'fixes', name: 'Issues Fixed', color: '#3B82F6' },
                { dataKey: 'sessionsStarted', name: 'Sessions Started', color: '#8B5CF6' },
                { dataKey: 'prsCreated', name: 'PRs Created', color: '#10B981' },
                { dataKey: 'confidence', name: 'Confidence %', color: '#F59E0B' }
              ]}
              title="AI Performance Over Time"
              height={350}
              isDarkMode={isDarkMode}
              formatValue={(value) => value.toString()}
            />
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Time to Merge</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {data.pullRequestMetrics.averageTimeToMerge.toFixed(1)} days
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">PR Merge Rate</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {data.pullRequestMetrics.mergeRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Review Turnaround</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {data.pullRequestMetrics.reviewTurnaround.toFixed(1)} hrs
          </p>
        </div>
      </div>

      {/* Contributors List */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Contributors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {data.contributors.slice(0, 12).map((contributor) => (
            <ContributorDetailModal
              key={contributor.login}
              contributor={contributor}
              projectId={projectId}
            >
              <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {contributor.avatarUrl ? (
                      <img
                        src={contributor.avatarUrl}
                        alt={contributor.login}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {contributor.login.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contributor.login}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{contributor.totalContributions} commits</span>
                      <span>•</span>
                      <span>{contributor.pullRequestsInPeriod} PRs</span>
                    </div>
                  </div>
                </div>
              </div>
            </ContributorDetailModal>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Commits */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Commits</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.recentCommits.slice(0, 10).map((commit) => (
              <div key={commit.sha} className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                <GitCommit className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {commit.message.split('\n')[0]}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    by {commit.authorLogin} • {new Date(commit.authorDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    +{commit.additions} -{commit.deletions} ({commit.changedFiles} files)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Pull Requests */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Pull Requests</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.recentPullRequests.slice(0, 10).map((pr) => (
              <div key={pr.number} className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                <GitPullRequest className={`h-4 w-4 mt-1 flex-shrink-0 ${
                  pr.state === 'OPEN' ? 'text-green-600' : 
                  pr.state === 'MERGED' ? 'text-purple-600' : 'text-gray-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    #{pr.number}: {pr.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    by {pr.authorLogin} • {new Date(pr.createdAt).toLocaleDateString()}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    pr.state === 'OPEN' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    pr.state === 'MERGED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                  }`}>
                    {pr.state.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectAnalyticsDashboard;