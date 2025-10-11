'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { FullPageSpinner } from '../../components/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

export function ProtectedRoute({ children, fallbackUrl = '/auth/login' }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(fallbackUrl);
    }
  }, [user, loading, router, fallbackUrl]);

  if (loading) {
    return <FullPageSpinner text="Checking authentication..." />;
  }

  if (!user) {
    return <FullPageSpinner text="Redirecting to login..." />;
  }

  return <>{children}</>;
}

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function PublicRoute({ children, redirectTo = '/' }: PublicRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  if (loading) {
    return <FullPageSpinner text="Loading..." />;
  }

  if (user) {
    return <FullPageSpinner text="Redirecting..." />;
  }

  return <>{children}</>;
}