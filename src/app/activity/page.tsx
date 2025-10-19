import { Metadata } from 'next';
import ActivityFeed from '@/components/ActivityFeed';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Activity Feed | CodeMind',
  description: 'Real-time timeline of all AI actions across your projects',
};

export default function ActivityPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                🎬 AI Activity Feed
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Real-time timeline of all AI actions across your projects
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Indexing Jobs</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">📚</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">APR Sessions</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">🤖</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Chat Messages</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">💬</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Auto Fixes</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">🔧</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <ActivityFeed limit={50} />
      </div>
    </div>
  );
}
