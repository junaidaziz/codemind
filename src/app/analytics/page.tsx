'use client';

import React, { Suspense } from 'react';
import DeveloperInsightsDashboard from '../../components/DeveloperInsightsDashboard';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { Spinner } from '../../components/ui/Spinner';

// Loading component for dashboard
const DashboardLoading = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics dashboard...</p>
      </div>
    </div>
  </div>
);

// Error fallback component
const DashboardError = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
      <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
        Analytics Dashboard Error
      </h2>
      <p className="text-red-600 dark:text-red-300 mb-4">
        {error.message || 'Failed to load the analytics dashboard'}
      </p>
      <div className="space-x-4">
        <button
          onClick={resetError}
          className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
          className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
);

// Main analytics page component
export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DeveloperInsightsDashboard projectId="1" />
          </div>
        </Suspense>
      </ErrorBoundary>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
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