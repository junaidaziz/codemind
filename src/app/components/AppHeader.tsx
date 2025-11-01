'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '@/components/shared/Logo';
// Theme toggle removed from header per request (floating draggable button used instead)

export function AppHeader() {
  const { user, signOut, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    // Reserve space but don't show anything during initial load
    // This prevents layout shift when auth resolves
    return (
      <header className="surface-card rounded-none border-0 shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo />
            {/* Reserve space for user menu to prevent layout shift */}
            <div className="w-32 h-10"></div>
          </div>
        </div>
      </header>
    );
  }

  // Show minimal header for unauthenticated users (theme toggle now floating & draggable, so removed here)
  if (!user) {
    return (
      <header className="surface-card rounded-none sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-4">
              <Logo />
              <Link
                href="/docs"
                className="px-2 py-1 rounded-md text-xs font-medium text-secondary hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                📚 Docs
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-xs font-medium btn-accent px-3 py-1.5"
              >Login
              </Link>
              <Link
                href="/auth/signup"
                className="text-xs font-medium btn-accent px-3 py-1.5"
              >Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="surface-card rounded-none sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Logo />
            <nav className="hidden md:flex space-x-1">
                <Link
                  href="/dashboard"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all"
                >
                ⚡ Dashboard
              </Link>

              <Link href="/projects" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">📁 Projects</Link>
              <Link href="/workspaces" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">🏢 Workspaces</Link>
              <Link href="/chat" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">💬 Chat</Link>
              <Link href="/apr" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">🤖 APR</Link>
              <Link href="/activity" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">🎬 Activity</Link>
              <Link href="/analytics" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">📊 Analytics</Link>
              <Link href="/docs" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-all">📚 Docs</Link>
            </nav>
          </div>

          {/* User Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="group flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {/* User Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-md">
                {userInitials}
              </div>
              {/* User Name */}
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-white">
                {userName}
              </span>
              {/* Dropdown Icon */}
              <svg
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              </button>
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 surface-panel py-1 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {userName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/dashboard"
                    onClick={() => setIsDropdownOpen(false)}
                    className="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Dashboard
                  </Link>
                  
                  <Link
                    href="/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Profile
                  </Link>
                  <Link
                    href="/docs"
                    onClick={() => setIsDropdownOpen(false)}
                    className="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6l-2 2 2 2m0-4h8M4 6h4m4 6l-2 2 2 2m0-4h8M4 12h4m4 6l-2 2 2 2m0-4h8M4 18h4"
                      />
                    </svg>
                    Docs
                  </Link>
                </div>

                {/* Sign Out */}
                <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleSignOut();
                    }}
                    className="group flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}