import { Metadata } from 'next';
import { Suspense } from 'react';
import APRDashboard from '@/components/APRDashboard';
import { DashboardSkeleton } from '@/components/LazyLoad';

export const metadata: Metadata = {
  title: 'APR Dashboard - Autonomous Pull Requests',
  description: 'Monitor autonomous PR status, retry attempts, AI decisions, validation results, and audit history',
};

export default function APRPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 Autonomous PR Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor AI-powered pull request generation, validation, and self-healing
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <APRDashboard />
      </Suspense>
    </div>
  );
}
