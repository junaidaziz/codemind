import React, { useEffect, useState, useCallback } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface MemoryAnalytics {
  sessionId: string;
  projectId?: string;
  userId?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalInteractions: number;
    averageMemorySize: number;
    averageTokenUsage: number;
    averageExecutionTime: number;
    averageContextRelevance: number;
    averageResponseQuality: number;
    memoryEfficiency: number;
  };
  memoryGrowth: Array<{
    timestamp: Date;
    memorySize: number;
    tokenUsage: number;
  }>;
  commandBreakdown: Array<{
    command: string;
    count: number;
    avgExecutionTime: number;
    avgMemorySize: number;
  }>;
}

interface MemoryEfficiencyTrends {
  daily: Array<{
    date: string;
    memoryEfficiency: number;
    avgMemorySize: number;
    avgResponseQuality: number;
    interactionCount: number;
  }>;
  summary: {
    trend: 'improving' | 'declining' | 'stable';
    trendPercentage: number;
  };
}

interface AgentMemoryDashboardProps {
  projectId: string;
  userId?: string;
  sessionId?: string;
  className?: string;
}

export function AgentMemoryDashboard({
  projectId,
  userId,
  sessionId,
  className = '',
}: AgentMemoryDashboardProps) {
  const [analytics, setAnalytics] = useState<MemoryAnalytics | null>(null);
  const [trends, setTrends] = useState<MemoryEfficiencyTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        projectId,
        timeRange,
        ...(userId && { userId }),
        ...(sessionId && { sessionId }),
      });

      const [analyticsResponse, trendsResponse] = await Promise.all([
        fetch(`/api/analytics/memory?${params}`),
        fetch(`/api/analytics/memory/trends?${params}`)
      ]);

      if (!analyticsResponse.ok || !trendsResponse.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await analyticsResponse.json();
      const trendsData = await trendsResponse.json();

      setAnalytics(analyticsData);
      setTrends(trendsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, sessionId, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading memory analytics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error loading analytics: {error}</div>
          <button
            onClick={fetchAnalytics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics || !trends) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-gray-600">No memory analytics data available</div>
      </div>
    );
  }

  // Prepare chart data
  const memoryGrowthData = {
    labels: analytics.memoryGrowth.map(point => 
      new Date(point.timestamp).toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Memory Size (tokens)',
        data: analytics.memoryGrowth.map(point => point.memorySize),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Token Usage',
        data: analytics.memoryGrowth.map(point => point.tokenUsage),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const commandBreakdownData = {
    labels: analytics.commandBreakdown.map(cmd => cmd.command),
    datasets: [
      {
        label: 'Usage Count',
        data: analytics.commandBreakdown.map(cmd => cmd.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
      },
    ],
  };

  const efficiencyTrendData = {
    labels: trends.daily.map(day => day.date),
    datasets: [
      {
        label: 'Memory Efficiency',
        data: trends.daily.map(day => day.memoryEfficiency),
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      default: return '➡️';
    }
  };

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Agent Memory Analytics</h2>
        <div className="flex space-x-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600">Total Interactions</div>
          <div className="text-2xl font-bold text-blue-600">
            {analytics.metrics.totalInteractions}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600">Avg Memory Size</div>
          <div className="text-2xl font-bold text-green-600">
            {Math.round(analytics.metrics.averageMemorySize)}
          </div>
          <div className="text-xs text-gray-500">tokens</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600">Avg Execution Time</div>
          <div className="text-2xl font-bold text-yellow-600">
            {Math.round(analytics.metrics.averageExecutionTime)}
          </div>
          <div className="text-xs text-gray-500">ms</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600">Memory Efficiency</div>
          <div className="text-2xl font-bold text-purple-600">
            {analytics.metrics.memoryEfficiency.toFixed(2)}
          </div>
          <div className={`text-xs ${getTrendColor(trends.summary.trend)}`}>
            {getTrendIcon(trends.summary.trend)} {trends.summary.trend} 
            {trends.summary.trendPercentage !== 0 && 
              ` (${Math.abs(trends.summary.trendPercentage).toFixed(1)}%)`
            }
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-2">Context Relevance</div>
          <div className="flex items-center">
            <div className="text-xl font-bold text-blue-600">
              {(analytics.metrics.averageContextRelevance * 100).toFixed(1)}%
            </div>
            <div className="ml-2 flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${analytics.metrics.averageContextRelevance * 100}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-2">Response Quality</div>
          <div className="flex items-center">
            <div className="text-xl font-bold text-green-600">
              {(analytics.metrics.averageResponseQuality * 100).toFixed(1)}%
            </div>
            <div className="ml-2 flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${analytics.metrics.averageResponseQuality * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Growth Chart */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Memory Growth Over Time</h3>
          <div className="h-64">
            <Line 
              data={memoryGrowthData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Command Usage Breakdown */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Command Usage</h3>
          <div className="h-64">
            <Doughnut 
              data={commandBreakdownData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right' as const,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Efficiency Trend Chart */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Memory Efficiency Trend</h3>
        <div className="h-64">
          <Line 
            data={efficiencyTrendData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top' as const,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Command Performance Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Command Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Command
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Execution Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Memory Size
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.commandBreakdown.map((command, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {command.command}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {command.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(command.avgExecutionTime)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(command.avgMemorySize)} tokens
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}