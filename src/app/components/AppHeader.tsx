'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../../components/ui';

export function AppHeader() {
  const { user, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🧠</span>
              <span className="text-xl font-bold">CodeMind</span>
            </div>
            <Spinner size="sm" />
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return null; // Don't show header on auth pages
  }

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center header-logo cursor-pointer">
              <span className="text-2xl mr-2">🧠</span>
              <span className="text-xl font-bold">CodeMind</span>
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/projects"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Projects
              </Link>
              <Link
                href="/chat"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Chat
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {user.user_metadata?.name || user.email?.split('@')[0]}
            </div>
            <div className="relative">
              <div className="flex items-center space-x-2">
                <Link
                  href="/profile"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm cursor-pointer px-2 py-1 rounded-md"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}