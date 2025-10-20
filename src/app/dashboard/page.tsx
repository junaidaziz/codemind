import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Dashboard | CodeMind',
  description: 'Your AI development dashboard',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            📊 Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome to your AI development command center
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            href="/projects"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl">📁</div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                View All →
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Projects
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your indexed repositories
            </p>
          </Link>

          <Link
            href="/chat"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl">💬</div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                Start Chat →
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              AI Chat
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chat with your codebase using AI
            </p>
          </Link>

          <Link
            href="/apr"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl">🤖</div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                View APR →
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Autonomous PRs
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI-powered pull requests
            </p>
          </Link>

          <Link
            href="/activity"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl">🎬</div>
              <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                View Feed →
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Activity Feed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track all AI actions
            </p>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📈 Quick Stats
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                -
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Projects
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                -
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Chat Messages
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                -
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                APR Sessions
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              🎬 Recent Activity
            </h2>
            <Link
              href="/activity"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All →
            </Link>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Your recent AI activities will appear here</p>
              <Link
                href="/projects"
                className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
              >
                Get started by adding a project
              </Link>
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
