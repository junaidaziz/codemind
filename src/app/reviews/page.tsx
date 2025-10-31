import React from 'react';

interface ReviewRow {
  id: string;
  prNumber: number;
  riskLevel: string;
  riskScore: number;
  overallScore: number;
  approved: boolean;
  requiresChanges: boolean;
  filesAnalyzed: number;
  linesAdded: number;
  linesRemoved: number;
  createdAt: string;
  estimatedImpact?: string;
}

async function fetchReviews(): Promise<{ projectId: string; reviews: ReviewRow[] }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/code-review/list?projectId=default`, { cache: 'no-store' });
  if (!res.ok) return { projectId: 'default', reviews: [] };
  return res.json();
}

function riskColor(risk: string) {
  switch (risk) {
    case 'CRITICAL': return 'bg-red-600 text-white';
    case 'HIGH': return 'bg-orange-500 text-white';
    case 'MEDIUM': return 'bg-yellow-400 text-black';
    case 'LOW': return 'bg-green-500 text-white';
    default: return 'bg-gray-300 text-black';
  }
}

export default async function ReviewsPage() {
  const { reviews } = await fetchReviews();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Code Reviews</h1>
      <table className="min-w-full border divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">PR #</th>
            <th className="px-3 py-2 text-left">Risk</th>
            <th className="px-3 py-2 text-left">Score</th>
            <th className="px-3 py-2 text-left">Impact</th>
            <th className="px-3 py-2 text-left">Files</th>
            <th className="px-3 py-2 text-left">Lines +/-</th>
            <th className="px-3 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {reviews.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{r.prNumber}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${riskColor(r.riskLevel)}`}>{r.riskLevel}</span>
              </td>
              <td className="px-3 py-2">{r.overallScore}</td>
              <td className="px-3 py-2 capitalize">{r.estimatedImpact || 'n/a'}</td>
              <td className="px-3 py-2">{r.filesAnalyzed}</td>
              <td className="px-3 py-2">+{r.linesAdded}/-{r.linesRemoved}</td>
              <td className="px-3 py-2 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {reviews.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No reviews yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
