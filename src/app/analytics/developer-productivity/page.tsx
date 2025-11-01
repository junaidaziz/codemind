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
} from 'chart.js';

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

interface DeveloperMetrics {
  userId: string;
  name: string;
  email: string;
  prsCreated: number;
  prsReviewed: number;
  commentsGiven: number;
  commentsReceived: number;
  averageReviewTime: number;
  averagePrSize: number;
  approvalRate: number;
  weeklyActivity: Array<{
    week: string;
    prs: number;
    reviews: number;
  }>;
}

interface ProductivityData {
  developers: DeveloperMetrics[];
  teamAverages: {
    prsCreated: number;
    prsReviewed: number;
    reviewTime: number;
    prSize: number;
    approvalRate: number;
  };
}

export default function DeveloperProductivityPage() {
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'30' | '60' | '90'>('30');
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);

  useEffect(() => {
    fetchProductivityData();
  }, [timePeriod]);

  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/analytics/developer-productivity?days=${timePeriod}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch productivity data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getActivityChartData = (developer: DeveloperMetrics) => {
    return {
      labels: developer.weeklyActivity.map((w) => w.week),
      datasets: [
        {
          label: 'PRs Created',
          data: developer.weeklyActivity.map((w) => w.prs),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
        },
        {
          label: 'PRs Reviewed',
          data: developer.weeklyActivity.map((w) => w.reviews),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
        },
      ],
    };
  };

  const getTeamComparisonData = () => {
    if (!data) return null;

    return {
      labels: data.developers.map((d) => d.name.split(' ')[0]),
      datasets: [
        {
          label: 'PRs Created',
          data: data.developers.map((d) => d.prsCreated),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
        },
        {
          label: 'PRs Reviewed',
          data: data.developers.map((d) => d.prsReviewed),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
            <p className="font-medium">Error loading productivity data</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.developers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-4 py-3 rounded">
            <p>No productivity data available for the selected period.</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedDevData = selectedDeveloper
    ? data.developers.find((d) => d.userId === selectedDeveloper)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Developer Productivity Insights
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track individual and team productivity metrics
            </p>
          </div>

          {/* Time Period Selector */}
          <div className="flex gap-2">
            {(['30', '60', '90'] as const).map((days) => (
              <button
                key={days}
                onClick={() => setTimePeriod(days)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timePeriod === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Team Averages */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg PRs Created</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {data.teamAverages.prsCreated.toFixed(1)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg PRs Reviewed</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {data.teamAverages.prsReviewed.toFixed(1)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Review Time</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {data.teamAverages.reviewTime.toFixed(1)}h
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg PR Size</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {data.teamAverages.prSize.toFixed(0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Approval Rate</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {data.teamAverages.approvalRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Team Comparison Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Team Comparison
          </h2>
          {getTeamComparisonData() && (
            <Bar data={getTeamComparisonData()!} options={chartOptions} />
          )}
        </div>

        {/* Developer List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Individual Developers
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Developer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PRs Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PRs Reviewed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Review Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Approval Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.developers.map((dev) => (
                  <tr key={dev.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {dev.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {dev.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {dev.prsCreated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {dev.prsReviewed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {dev.averageReviewTime.toFixed(1)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          dev.approvalRate >= 80
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : dev.approvalRate >= 60
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {dev.approvalRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() =>
                          setSelectedDeveloper(
                            selectedDeveloper === dev.userId ? null : dev.userId
                          )
                        }
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {selectedDeveloper === dev.userId ? 'Hide' : 'View'} Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Developer Details */}
        {selectedDevData && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedDevData.name} - Detailed Activity
              </h2>
              <button
                onClick={() => setSelectedDeveloper(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Comments Given</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {selectedDevData.commentsGiven}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Comments Received</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {selectedDevData.commentsReceived}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg PR Size</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {selectedDevData.averagePrSize.toFixed(0)} lines
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Engagement Ratio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {(
                    selectedDevData.prsReviewed /
                    (selectedDevData.prsCreated || 1)
                  ).toFixed(1)}x
                </p>
              </div>
            </div>

            {/* Weekly Activity Chart */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Weekly Activity
              </h3>
              <Line data={getActivityChartData(selectedDevData)} options={chartOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
