import { Suspense } from 'react';
import { Metadata } from 'next';
import SimpleAutoFixDashboard from '@/components/SimpleAutoFixDashboard';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Auto Fix Dashboard - CodeMind',
  description: 'View and manage automated code fixes, pull requests, and fix history.',
};

export default function AutoFixPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 Auto Fix Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor automated code fixes, review pull requests, and manage fix settings.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <SimpleAutoFixDashboard />
      </Suspense>
    </div>
  );
}