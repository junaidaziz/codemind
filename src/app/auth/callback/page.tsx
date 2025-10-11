'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '../../lib/supabase';
import { Spinner } from '../../../components/ui';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createBrowserClient();
        
        // Get the URL hash parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (type === 'signup' && access_token && refresh_token) {
          // Set the session with the tokens
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error('Error setting session:', error);
            setStatus('error');
            setMessage('Failed to verify email. Please try again.');
            return;
          }

          setStatus('success');
          setMessage('Email verified successfully! Redirecting to dashboard...');
          
          // Redirect to dashboard after successful verification
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } else {
          // Handle other auth flows or errors
          const error = searchParams.get('error');
          const error_description = searchParams.get('error_description');
          
          if (error) {
            setStatus('error');
            setMessage(error_description || 'Authentication failed');
          } else {
            setStatus('error');
            setMessage('Invalid authentication callback');
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Something went wrong during authentication');
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verifying your email...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Email Verified!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
          <div className="animate-pulse">
            <Spinner size="sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verification Failed
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => router.push('/auth/signup')}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Signing Up Again
          </button>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}