'use client';

import { useState, useEffect } from 'react';
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
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Project {
  id: string;
  name: string;
}

interface ModelPerformanceData {
  model: string;
  provider: string;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  successRate: number;
  avgCostPerRequest: number;
  avgTokensPerRequest: number;
}

export default function ModelPerformancePage() {
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [performanceData, setPerformanceData] = useState<ModelPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadPerformanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dateRange]);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        if (data.projects?.length > 0) {
          setProjectId(data.projects[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date | undefined;

      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }

      const params = new URLSearchParams({ projectId });
      if (startDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', now.toISOString());
      }

      const response = await fetch(`/api/ai-models/performance?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.models || []);
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const costComparisonData = {
    labels: performanceData.map((d) => d.model),
    datasets: [
      {
        label: 'Average Cost per Request ($)',
        data: performanceData.map((d) => d.avgCostPerRequest),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const latencyComparisonData = {
    labels: performanceData.map((d) => d.model),
    datasets: [
      {
        label: 'Average Latency (ms)',
        data: performanceData.map((d) => d.avgLatency),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  };

  const successRateData = {
    labels: performanceData.map((d) => d.model),
    datasets: [
      {
        label: 'Success Rate (%)',
        data: performanceData.map((d) => d.successRate * 100),
        backgroundColor: performanceData.map((d) =>
          d.successRate >= 0.95
            ? 'rgba(16, 185, 129, 0.5)'
            : d.successRate >= 0.8
            ? 'rgba(251, 191, 36, 0.5)'
            : 'rgba(239, 68, 68, 0.5)'
        ),
        borderColor: performanceData.map((d) =>
          d.successRate >= 0.95
            ? 'rgb(16, 185, 129)'
            : d.successRate >= 0.8
            ? 'rgb(251, 191, 36)'
            : 'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const usageDistributionData = {
    labels: performanceData.map((d) => d.model),
    datasets: [
      {
        label: 'Request Distribution',
        data: performanceData.map((d) => d.totalRequests),
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(16, 185, 129, 0.5)',
          'rgba(251, 191, 36, 0.5)',
          'rgba(139, 92, 246, 0.5)',
          'rgba(236, 72, 153, 0.5)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(251, 191, 36)',
          'rgb(139, 92, 246)',
          'rgb(236, 72, 153)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#D1D5DB',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
      y: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#D1D5DB',
        },
      },
    },
  };

  // Get best performing model for each metric
  const getBestModel = (metric: keyof ModelPerformanceData) => {
    if (performanceData.length === 0) return null;
    
    if (metric === 'successRate') {
      return performanceData.reduce((best, current) =>
        current.successRate > best.successRate ? current : best
      );
    } else if (metric === 'avgLatency' || metric === 'avgCostPerRequest') {
      return performanceData.reduce((best, current) =>
        current[metric] < best[metric] ? current : best
      );
    }
    return null;
  };

  const bestCostModel = getBestModel('avgCostPerRequest');
  const bestLatencyModel = getBestModel('avgLatency');
  const bestReliabilityModel = getBestModel('successRate');

  if (loading && performanceData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Model Performance</h1>
          <p className="text-gray-400">
            Compare costs, latency, and reliability across different AI models
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Time Range
              </label>
              <div className="flex gap-2">
                {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {range === 'all' ? 'All Time' : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Best Models Summary */}
        {performanceData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6">
              <div className="text-blue-100 text-sm font-medium mb-2">Most Cost-Effective</div>
              <div className="text-2xl font-bold text-white mb-1">
                {bestCostModel?.model}
              </div>
              <div className="text-blue-100 text-sm">
                ${bestCostModel?.avgCostPerRequest.toFixed(4)} per request
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6">
              <div className="text-green-100 text-sm font-medium mb-2">Fastest Response</div>
              <div className="text-2xl font-bold text-white mb-1">
                {bestLatencyModel?.model}
              </div>
              <div className="text-green-100 text-sm">
                {bestLatencyModel?.avgLatency.toFixed(0)}ms average latency
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6">
              <div className="text-purple-100 text-sm font-medium mb-2">Most Reliable</div>
              <div className="text-2xl font-bold text-white mb-1">
                {bestReliabilityModel?.model}
              </div>
              <div className="text-purple-100 text-sm">
                {((bestReliabilityModel?.successRate || 0) * 100).toFixed(1)}% success rate
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        {performanceData.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Comparison */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Cost per Request</h3>
                <div style={{ height: '300px' }}>
                  <Bar data={costComparisonData} options={chartOptions} />
                </div>
              </div>

              {/* Latency Comparison */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Average Latency</h3>
                <div style={{ height: '300px' }}>
                  <Bar data={latencyComparisonData} options={chartOptions} />
                </div>
              </div>

              {/* Success Rate */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Success Rate</h3>
                <div style={{ height: '300px' }}>
                  <Bar data={successRateData} options={chartOptions} />
                </div>
              </div>

              {/* Usage Distribution */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Usage Distribution</h3>
                <div style={{ height: '300px' }}>
                  <Doughnut data={usageDistributionData} options={doughnutOptions} />
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Detailed Metrics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="pb-3 text-gray-300 font-medium">Model</th>
                      <th className="pb-3 text-gray-300 font-medium">Provider</th>
                      <th className="pb-3 text-gray-300 font-medium text-right">Requests</th>
                      <th className="pb-3 text-gray-300 font-medium text-right">Total Cost</th>
                      <th className="pb-3 text-gray-300 font-medium text-right">Avg Cost</th>
                      <th className="pb-3 text-gray-300 font-medium text-right">Avg Latency</th>
                      <th className="pb-3 text-gray-300 font-medium text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.map((model) => (
                      <tr key={model.model} className="border-b border-gray-700">
                        <td className="py-3 text-white font-medium">{model.model}</td>
                        <td className="py-3 text-gray-400">{model.provider}</td>
                        <td className="py-3 text-gray-300 text-right">
                          {model.totalRequests.toLocaleString()}
                        </td>
                        <td className="py-3 text-gray-300 text-right">
                          ${model.totalCost.toFixed(4)}
                        </td>
                        <td className="py-3 text-gray-300 text-right">
                          ${model.avgCostPerRequest.toFixed(6)}
                        </td>
                        <td className="py-3 text-gray-300 text-right">
                          {model.avgLatency.toFixed(0)}ms
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                              model.successRate >= 0.95
                                ? 'bg-green-900 text-green-200'
                                : model.successRate >= 0.8
                                ? 'bg-yellow-900 text-yellow-200'
                                : 'bg-red-900 text-red-200'
                            }`}
                          >
                            {(model.successRate * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="text-gray-400 text-lg mb-2">No performance data available</div>
            <div className="text-gray-500 text-sm">
              Start using AI models in your project to see performance metrics
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
