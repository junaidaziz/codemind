'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ErrorBanner, Spinner } from '../../components/ui';

function ProfilePageContent() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);

    const { error } = await signOut();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/auth/login');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">👤 User Profile</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your account settings and preferences.
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorBanner
            message={error}
            type="error"
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Profile Information */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                  {user.user_metadata?.name || user.email?.split('@')[0] || 'Not set'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User ID
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-xs font-mono">
                  {user.id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account Created
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <Link
                    href="/projects"
                    className="block w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-center"
                  >
                    Manage Projects
                  </Link>
                  <Link
                    href="/chat"
                    className="block w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-center"
                  >
                    Start Chatting
                  </Link>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <h3 className="font-medium mb-2 text-red-600 dark:text-red-400">
                  Danger Zone
                </h3>
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Spinner size="sm" color="white" />
                      <span className="ml-2">Signing out...</span>
                    </div>
                  ) : (
                    'Sign Out'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">
            📝 About Your Data
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p>
              • Your projects and chat sessions are private and only accessible to you
            </p>
            <p>
              • All data is securely stored and encrypted
            </p>
            <p>
              • You can delete your account and all associated data at any time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}