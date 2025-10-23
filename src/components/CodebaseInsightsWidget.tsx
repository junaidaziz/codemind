'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { RefreshCw, TrendingUp, FileCode, GitBranch, AlertTriangle } from 'lucide-react';

interface FileStats {
  path: string;
  changes: number;
  additions: number;
  deletions: number;
  lastModified: string;
  size?: number;
  lines?: number;
}

interface ComplexityHotspot {
  path: string;
  score: number;
  lines: number;
}

interface CodebaseInsights {
  mostChangedFiles: FileStats[];
  fileTypeDistribution: Record<string, number>;
  complexityHotspots: ComplexityHotspot[];
  codeChurn: {
    totalFiles: number;
    totalChanges: number;
    averageChangesPerFile: number;
  };
  recentActivity: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  cached: boolean;
  lastUpdated: string;
}

interface CodebaseInsightsWidgetProps {
  projectId?: string;
  days?: number;
  autoRefresh?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function CodebaseInsightsWidget({
  projectId,
  days = 90,
  autoRefresh = false
}: CodebaseInsightsWidgetProps) {
  const [insights, setInsights] = useState<CodebaseInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(days);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = React.useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        days: selectedPeriod.toString(),
        limit: '20',
        ...(forceRefresh && { refresh: 'true' }),
        ...(projectId && { projectId })
      });

      console.log('Fetching codebase insights:', {
        url: `/api/insights/codebase?${params}`,
        projectId,
        selectedPeriod,
        forceRefresh
      });

      const response = await fetch(`/api/insights/codebase?${params}`);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Codebase insights loaded:', data);
      setInsights(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Insights fetch error:', {
        error: err,
        message: errorMessage,
        projectId,
        selectedPeriod
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, projectId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => fetchInsights(), 300000); // Refresh every 5 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchInsights]);

  const handleRefresh = () => {
    fetchInsights(true);
  };

  const handlePeriodChange = (newPeriod: number) => {
    setSelectedPeriod(newPeriod);
  };

  if (loading && !insights) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">
            Failed to load codebase insights: {error}
          </p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  // Prepare data for charts
  const fileChangeData = (insights.mostChangedFiles || []).slice(0, 10).map(file => ({
    name: file.path.split('/').pop() || file.path,
    fullPath: file.path,
    changes: file.changes,
    additions: file.additions,
    deletions: file.deletions,
    lines: file.lines || 0
  }));

  const fileTypeData = Object.entries(insights.fileTypeDistribution || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext, count]) => ({
      name: ext,
      value: count
    }));

  const activityData = [
    { period: 'Last 7 days', commits: insights.recentActivity?.last7Days || 0 },
    { period: 'Last 30 days', commits: insights.recentActivity?.last30Days || 0 },
    { period: 'Last 90 days', commits: insights.recentActivity?.last90Days || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Codebase Insights
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 6 months</option>
              <option value={365}>Last year</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Cache Status */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {insights.cached && (
            <span className="inline-flex items-center gap-1">
              📦 Cached data •
            </span>
          )}{' '}
          Last updated: {new Date(insights.lastUpdated).toLocaleString()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Files
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {insights.codeChurn?.totalFiles || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Modified in period
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Changes
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {insights.codeChurn?.totalChanges || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Commits to tracked files
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Changes
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {(insights.codeChurn?.averageChangesPerFile || 0).toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Per file
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Hotspots
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {(insights.complexityHotspots || []).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            High complexity areas
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Changed Files Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Most Changed Files
          </h3>
          {fileChangeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fileChangeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#6b7280"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'changes') return [value, 'Changes'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="changes" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-12">
              No file change data available
            </p>
          )}
        </div>

        {/* File Type Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            File Type Distribution
          </h3>
          {fileTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fileTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const entry = props as any;
                    return `${entry.name} (${(entry.percent * 100).toFixed(0)}%)`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fileTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-12">
              No file type data available
            </p>
          )}
        </div>
      </div>

      {/* Complexity Hotspots Table */}
      {(insights.complexityHotspots || []).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Complexity Hotspots
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File Path
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Complexity Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lines of Code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(insights.complexityHotspots || []).map((hotspot, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {hotspot.path}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
                        {hotspot.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {hotspot.lines.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Commit Activity Trends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activityData.map((item, index) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {item.period}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {item.commits}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                commits
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
