'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Line, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Activity,
  GitPullRequest,
  AlertCircle,
  Calendar,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

// Register ChartJS components
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

interface AnalyticsData {
  summary: {
    totalAiFixes: number;
    estimatedTimeSaved: number;
    successRate: number;
    totalAiPrs: number;
    mergedAiPrs: number;
  };
  activityTrends: Array<{
    date: string;
    issues: number;
    pullRequests: number;
  }>;
  metrics: {
    avgResolutionTime: number;
    issuesResolvedThisWeek: number;
    prsCreatedThisWeek: number;
  };
  timeframe: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

interface DeveloperInsightsDashboardProps {
  projectId?: string;
}

const DeveloperInsightsDashboard: React.FC<DeveloperInsightsDashboardProps> = ({ 
  projectId = "1" 
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/analytics/developer-insights?projectId=${projectId}&timeframe=${timeframe}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, timeframe]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);



  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Error Loading Analytics</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-600">Analytics data will appear here once you have activity.</p>
        </div>
      </Card>
    );
  }

  // Prepare chart data with consistent color scheme
  const activityChartData = {
    labels: data.activityTrends.map(item => format(new Date(item.date), 'MMM dd')),
    datasets: [
      {
        label: 'Issues',
        data: data.activityTrends.map(item => item.issues),
        borderColor: 'rgb(59, 130, 246)', // Blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Pull Requests',
        data: data.activityTrends.map(item => item.pullRequests),
        borderColor: 'rgb(16, 185, 129)', // Green-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const successRateChartData = {
    labels: ['Merged PRs', 'Pending PRs'],
    datasets: [
      {
        data: [data.summary.mergedAiPrs, data.summary.totalAiPrs - data.summary.mergedAiPrs],
        backgroundColor: ['rgb(16, 185, 129)', 'rgb(156, 163, 175)'], // Green-500 and Gray-400
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBackgroundColor: ['rgb(5, 150, 105)', 'rgb(107, 114, 128)'], // Green-600 and Gray-500
      },
    ],
  };

  const chartOptions = {
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
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Developer Insights</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                AI-powered development analytics and productivity metrics
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">AI Fixes</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.summary.totalAiFixes}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +{data.metrics.issuesResolvedThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.summary.estimatedTimeSaved}h</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Estimated developer hours saved
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.successRate}%</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              AI PRs merged successfully
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">AI Pull Requests</CardTitle>
            <GitPullRequest className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.summary.totalAiPrs}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +{data.metrics.prsCreatedThisWeek} this week
            </p>
          </CardContent>
        </Card>
          </div>

          {/* Charts Section */}
          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="bg-gray-100 dark:bg-gray-800">
              <TabsTrigger value="activity" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">Activity Trends</TabsTrigger>
              <TabsTrigger value="success" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Success Metrics</TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-4">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Repository Activity</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Issues and pull requests over the last {timeframe} days
                  </CardDescription>
                </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <Line data={activityChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="success" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI PR Success Rate</CardTitle>
                <CardDescription>
                  Breakdown of AI-generated pull requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <Doughnut data={successRateChartData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>
                  Performance indicators for AI assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Average Resolution Time</span>
                  <Badge variant="secondary">
                    {data.metrics.avgResolutionTime}h
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Issues Resolved This Week</span>
                  <Badge variant="secondary">
                    {data.metrics.issuesResolvedThisWeek}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">PRs Created This Week</span>
                  <Badge variant="secondary">
                    {data.metrics.prsCreatedThisWeek}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Success Rate</span>
                  <Badge 
                    variant={data.summary.successRate > 70 ? "default" : "secondary"}
                  >
                    {data.summary.successRate}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Development Velocity</CardTitle>
                <CardDescription>
                  How AI assistance impacts development speed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Issues Resolved</span>
                    <span className="font-medium">{data.summary.totalAiFixes}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${Math.min((data.summary.totalAiFixes / 50) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Time Efficiency</span>
                    <span className="font-medium">{data.summary.estimatedTimeSaved}h saved</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min((data.summary.estimatedTimeSaved / 100) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Impact Summary</CardTitle>
                <CardDescription>
                  Overall impact of AI assistance on your development workflow
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Issues Resolved</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {data.summary.totalAiFixes}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Time Saved</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    {data.summary.estimatedTimeSaved}h
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium">Success Rate</span>
                  </div>
                  <span className="text-lg font-bold text-purple-600">
                    {data.summary.successRate}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>
  );
};

export default DeveloperInsightsDashboard;