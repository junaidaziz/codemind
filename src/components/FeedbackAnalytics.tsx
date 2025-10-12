// Agent Feedback Analytics Dashboard for CodeMind
'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface FeedbackMetrics {
  totalFeedbacks: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  categoryAverages: Record<string, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  responseTimeStats: {
    average: number;
    median: number;
    fastest: number;
    slowest: number;
  };
}

interface FeedbackAnalyticsProps {
  projectId: string;
  period?: 'day' | 'week' | 'month';
  className?: string;
}

/**
 * Simple analytics dashboard for agent feedback
 */
export const FeedbackAnalytics: React.FC<FeedbackAnalyticsProps> = ({
  projectId,
  period = 'week',
  className = '',
}) => {
  const [metrics, setMetrics] = useState<FeedbackMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/feedback?projectId=${projectId}&limit=100`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch feedback data');
      }

      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.data.summary);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching feedback metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load analytics</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback data</h3>
          <p className="text-gray-600">Start collecting feedback to see analytics here.</p>
        </div>
      </div>
    );
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const formatNumber = (num: number, decimals = 1) => {
    return Number.isInteger(num) ? num.toString() : num.toFixed(decimals);
  };

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Feedback Analytics</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>📅</span>
            <span className="capitalize">{period}ly view</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {metrics.totalFeedbacks}
            </div>
            <div className="text-sm text-gray-600">Total Feedback</div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold ${getRatingColor(metrics.averageRating)}`}>
              {formatNumber(metrics.averageRating)}
            </div>
            <div className="text-sm text-gray-600">Average Rating</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(metrics.responseTimeStats.average / 1000)}s
            </div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>

          <div className="text-center">
            <div className="text-2xl">
              {getTrendIcon(metrics.recentTrend)}
            </div>
            <div className="text-sm text-gray-600 capitalize">{metrics.recentTrend}</div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Rating Distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = metrics.ratingDistribution[rating] || 0;
              const percentage = metrics.totalFeedbacks > 0 
                ? (count / metrics.totalFeedbacks) * 100 
                : 0;
              
              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm">{rating}</span>
                    <span className="text-yellow-400 text-xs">⭐</span>
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        rating >= 4 ? 'bg-green-500' :
                        rating >= 3 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-600 w-12 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        {Object.keys(metrics.categoryAverages).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Category Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(metrics.categoryAverages).map(([category, average]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {category.toLowerCase().replace('_', ' ')}
                  </span>
                  <span className={`text-sm font-semibold ${getRatingColor(average)}`}>
                    {formatNumber(average)}/5
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact feedback summary widget
 */
interface FeedbackSummaryProps {
  projectId: string;
  className?: string;
}

export const FeedbackSummary: React.FC<FeedbackSummaryProps> = ({
  projectId,
  className = '',
}) => {
  const [summary, setSummary] = useState<{
    total: number;
    average: number;
    trend: 'up' | 'down' | 'stable';
  } | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/feedback?projectId=${projectId}&limit=10`);
        const data = await response.json();
        
        if (data.success) {
          setSummary({
            total: data.data.summary.totalFeedbacks,
            average: data.data.summary.averageRating,
            trend: 'stable', // TODO: Calculate actual trend
          });
        }
      } catch (error) {
        console.error('Error fetching feedback summary:', error);
      }
    };

    fetchSummary();
  }, [projectId]);

  if (!summary) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="w-16 h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <span>📝</span>
        <span className="text-sm">No feedback yet</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-lg">
        {summary.average >= 4 ? '😊' : summary.average >= 3 ? '😐' : '😞'}
      </span>
      <span className="text-sm font-medium">
        {summary.average.toFixed(1)}/5
      </span>
      <span className="text-xs text-gray-500">
        ({summary.total} feedback{summary.total !== 1 ? 's' : ''})
      </span>
      <span className="text-sm">
        {summary.trend === 'up' ? '📈' : summary.trend === 'down' ? '📉' : '➡️'}
      </span>
    </div>
  );
};