'use client';

import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface QualityTrend {
  date: string;
  avgRiskScore: number;
  avgOverallScore: number;
  totalReviews: number;
  highRiskCount: number;
  criticalIssues: number;
  avgLinesChanged: number;
}

interface IssueTrend {
  category: string;
  count: number;
  trend: number; // % change from previous period
}

interface QualityMetrics {
  trends: QualityTrend[];
  issuesByCategory: IssueTrend[];
  topImprovements: Array<{
    metric: string;
    change: number;
    unit: string;
  }>;
  summary: {
    avgRiskScore: number;
    avgOverallScore: number;
    totalReviews: number;
    riskScoreChange: number;
    overallScoreChange: number;
  };
}

export default function CodeQualityPage() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    fetchMetrics();
  }, [timePeriod]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/code-quality?days=${timePeriod}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch quality metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const getRiskScoreData = () => {
    if (!metrics) return null;

    return {
      labels: metrics.trends.map((t) => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Risk Score',
          data: metrics.trends.map((t) => t.avgRiskScore),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Overall Score',
          data: metrics.trends.map((t) => t.avgOverallScore),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
        },
      ],
    };
  };

  const getReviewVolumeData = () => {
    if (!metrics) return null;

    return {
      labels: metrics.trends.map((t) => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Total Reviews',
          data: metrics.trends.map((t) => t.totalReviews),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
        },
        {
          label: 'High Risk Reviews',
          data: metrics.trends.map((t) => t.highRiskCount),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
        },
      ],
    };
  };

  const getIssuesByCategoryData = () => {
    if (!metrics) return null;

    return {
      labels: metrics.issuesByCategory.map((i) => i.category),
      datasets: [
        {
          label: 'Issues',
          data: metrics.issuesByCategory.map((i) => i.count),
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(251, 146, 60, 0.8)',
            'rgba(234, 179, 8, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)',
          ],
        },
      ],
    };
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getChangeColor = (change: number, inverse = false) => {
    // For metrics where lower is better (like risk score), inverse = true
    const isPositive = inverse ? change < 0 : change > 0;
    return isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorBanner message={error} title="Failed to Load Quality Metrics" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const riskScoreData = getRiskScoreData();
  const reviewVolumeData = getReviewVolumeData();
  const issuesByCategoryData = getIssuesByCategoryData();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Code Quality Trends
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track code quality metrics and improvement over time
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="mb-6 flex justify-end">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            {(['7', '30', '90'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${period === '7' ? 'rounded-l-lg' : ''} ${period === '90' ? 'rounded-r-lg' : ''}`}
              >
                {period} days
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Average Risk Score
            </h3>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metrics.summary.avgRiskScore.toFixed(1)}
              </p>
              <span className={`text-sm font-medium ${getChangeColor(metrics.summary.riskScoreChange, true)}`}>
                {formatChange(metrics.summary.riskScoreChange)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Lower is better
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Average Quality Score
            </h3>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metrics.summary.avgOverallScore.toFixed(1)}
              </p>
              <span className={`text-sm font-medium ${getChangeColor(metrics.summary.overallScoreChange)}`}>
                {formatChange(metrics.summary.overallScoreChange)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Out of 100
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Total Reviews
            </h3>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metrics.summary.totalReviews}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Last {timePeriod} days
            </p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Risk & Quality Score Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quality Scores Over Time
            </h3>
            <div className="h-80">
              {riskScoreData && (
                <Line data={riskScoreData} options={lineChartOptions} />
              )}
            </div>
          </div>

          {/* Review Volume */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Review Volume & High Risk Count
            </h3>
            <div className="h-80">
              {reviewVolumeData && (
                <Bar data={reviewVolumeData} options={barChartOptions} />
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Issues by Category */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Issues by Category
            </h3>
            <div className="h-80">
              {issuesByCategoryData && (
                <Bar data={issuesByCategoryData} options={barChartOptions} />
              )}
            </div>
          </div>

          {/* Top Improvements */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Improvements
            </h3>
            <div className="space-y-4">
              {metrics.topImprovements.length > 0 ? (
                metrics.topImprovements.map((improvement, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {improvement.metric}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        vs. previous period
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getChangeColor(improvement.change)}`}>
                        {formatChange(improvement.change)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {improvement.unit}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                  Not enough data to calculate improvements yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Issue Category Trends Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Issue Category Trends
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {metrics.issuesByCategory.map((issue, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {issue.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {issue.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={getChangeColor(issue.trend, true)}>
                        {formatChange(issue.trend)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
