import React from 'react';
import { RiskBadge } from '@/components/code-review/RiskBadge';
import { ReviewStatusChip } from '@/components/code-review/ReviewStatusChip';

async function fetchReviews() {
  const projectId = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID || 'default';
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/code-review/reviews?projectId=${projectId}`, {
    cache: 'no-store'
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.reviews || [];
}

export default async function ReviewsPage() {
  const reviews = await fetchReviews();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-4">Code Reviews</h1>
      <p className="text-sm text-gray-600 mb-6">Recent automated code reviews with risk assessment and summary.</p>
      <div className="space-y-2">
        {reviews.length === 0 && (
          <div className="text-sm text-gray-500">No reviews found.</div>
        )}
        {reviews.map((r: {
          id: string;
          prNumber: number;
          filesAnalyzed: number;
          linesAdded: number;
          linesRemoved: number;
          riskLevel: string;
          riskScore: number;
          approved: boolean;
          requiresChanges: boolean;
        }) => (
          <a
            key={r.id}
            href={`/reviews/${r.id}`}
            className="block border rounded hover:bg-gray-50 transition p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-medium">PR #{r.prNumber}</span>
                <span className="text-xs text-gray-500">Files: {r.filesAnalyzed} | +{r.linesAdded}/-{r.linesRemoved}</span>
              </div>
              <div className="flex items-center gap-3">
                <RiskBadge level={r.riskLevel} score={r.riskScore} />
                <ReviewStatusChip approved={r.approved} requiresChanges={r.requiresChanges} />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
