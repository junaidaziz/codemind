'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';

interface DashboardStats {
  projects: number;
  workspaces: number;
  repositories: number;
  messages: number;
  aprSessions: number;
  recentActivity: ActivityEvent[];
}

interface ActivityEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  status: string;
  createdAt: string;
  project: {
    name: string;
  } | null;
}

export default function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiGet<DashboardStats>('/api/dashboard/stats');
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">Error loading dashboard: {error}</p>
      </div>
    );
  }

  return (
    <>
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
          href="/workspaces"
          className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl">�️</div>
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
              View All →
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Workspaces
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Multi-repo workspace management
          </p>
        </Link>

        <Link
          href="/projects"
          className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl">�</div>
            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              View All →
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Projects
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Individual project repositories
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
      </div>

      {/* Stats Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          📈 Quick Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {stats?.workspaces ?? '0'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Workspaces
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {stats?.repositories ?? '0'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Repositories
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {stats?.messages ?? '0'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Chat Messages
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {stats?.aprSessions ?? '0'}
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
        
        {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Your recent AI activities will appear here</p>
            <Link
              href="/projects"
              className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              Get started by adding a project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="text-2xl">
                  {activity.eventType === 'APR_CODE_GENERATION' && '🤖'}
                  {activity.eventType === 'APR_COMPLETED' && '✅'}
                  {activity.eventType === 'APR_PR_CREATED' && '🎉'}
                  {activity.eventType === 'CHAT_MESSAGE' && '💬'}
                  {activity.eventType === 'INDEXING_COMPLETED' && '📊'}
                  {!['APR_CODE_GENERATION', 'APR_COMPLETED', 'APR_PR_CREATED', 'CHAT_MESSAGE', 'INDEXING_COMPLETED'].includes(activity.eventType) && '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {activity.project?.name} • {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  activity.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  activity.status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {activity.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
