'use client';

import React, { Suspense } from 'react';
import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { Spinner } from '../../components/ui/Spinner';

// Loading component for dashboard
const DashboardLoading = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600">Loading analytics dashboard...</p>
      </div>
    </div>
  </div>
);

// Error fallback component
const DashboardError = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="text-red-600 text-6xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-red-800 mb-2">
        Analytics Dashboard Error
      </h2>
      <p className="text-red-600 mb-4">
        {error.message || 'Failed to load the analytics dashboard'}
      </p>
      <div className="space-x-4">
        <button
          onClick={resetError}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
);

// Main analytics page component
export default function AnalyticsPage() {
  const handleError = (error: Error) => {
    console.error('Analytics dashboard error:', error);
    // Could integrate with error tracking service here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-gray-600 mt-1">
                Monitor system performance, user activity, and usage metrics
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                Live Data
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <ErrorBoundary fallback={DashboardError}>
        <Suspense fallback={<DashboardLoading />}>
          <AnalyticsDashboard
            refreshInterval={30000} // 30 seconds
            onError={handleError}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <p>CodeMind Analytics Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}