'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBanner, Spinner } from '../../../components/ui';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  // Check if email already exists
  const checkEmailExists = useCallback(async (emailToCheck: string): Promise<boolean> => {
    if (!emailToCheck || !emailToCheck.includes('@')) return false;
    
    try {
      setCheckingEmail(true);
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToCheck }),
      });

      const data = await response.json();
      return data.success ? data.data.exists : false;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    if (!name.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter a password');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Check if email already exists
    const emailExists = await checkEmailExists(email.trim().toLowerCase());
    if (emailExists) {
      setError('An account with this email address already exists. Please use a different email or try signing in.');
      setLoading(false);
      return;
    }

    // Attempt to create account
    const { error } = await signUp(email.trim().toLowerCase(), password, name.trim());

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('User already registered')) {
        setError('An account with this email address already exists. Please try signing in instead.');
      } else if (error.message.includes('Invalid email')) {
        setError('Please enter a valid email address');
      } else if (error.message.includes('Password')) {
        setError('Password must be at least 6 characters long');
      } else {
        setError(error.message || 'Failed to create account. Please try again.');
      }
      setLoading(false);
    } else {
      setSuccess(true);
      // Don't auto-redirect, let user know to check email
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
              Account Created Successfully!
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-blue-600 dark:text-blue-400 text-2xl mr-3">📧</div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                    We&apos;ve sent a verification email to <strong>{email}</strong>.
                    Please check your inbox (including spam/junk folder) and click the verification link to activate your account.
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-2">
                    📧 The email will come from your Supabase project domain and will redirect to <strong>codemind-delta.vercel.app</strong>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-yellow-600 dark:text-yellow-400 text-xl mr-3">⏰</div>
                <div className="text-left">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    <strong>Email taking too long?</strong> Check your spam/junk folder, wait a few minutes for delivery, 
                    or use the &ldquo;Resend&rdquo; button below. Note: After resetting your database, you may need to wait 
                    a few minutes before the system allows sending new confirmation emails.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/auth/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Go to Sign In
              </Link>
              <button
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const response = await fetch('/api/auth/resend-confirmation', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ email }),
                    });

                    const data = await response.json();

                    if (data.success) {
                      setError(`✅ ${data.message}`);
                      setTimeout(() => setError(null), 8000);
                    } else {
                      setError(`❌ ${data.error}`);
                      setTimeout(() => setError(null), 8000);
                    }
                  } catch {
                    setError('❌ Failed to resend confirmation email. Please try again.');
                    setTimeout(() => setError(null), 8000);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-green-300 dark:border-green-600 rounded-md shadow-sm text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : 'Resend Confirmation Email'}
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setName('');
                  setError(null);
                }}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Try Again with Different Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="text-center text-4xl mb-4">🧠</div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Create your CodeMind account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <ErrorBanner
              message={error}
              type="error"
              onDismiss={() => setError(null)}
            />
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your email address"
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Choose a password (minimum 6 characters)"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Spinner size="sm" color="white" />
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            By creating an account, you agree to our terms of service and privacy policy.
          </div>
        </form>
      </div>
    </div>
  );
}