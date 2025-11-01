'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  documentationSuggestions?: Array<{ type: string }>;
  testingSuggestions?: Array<{ type: string }>;
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

function impactColor(scope?: string) {
  switch ((scope || '').toLowerCase()) {
    case 'widespread': return 'bg-purple-600 text-white';
    case 'moderate': return 'bg-indigo-500 text-white';
    case 'isolated': return 'bg-blue-500 text-white';
    case 'minimal': return 'bg-teal-500 text-white';
    default: return 'bg-gray-200 text-gray-700';
  }
}

function ReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const riskFilter = searchParams.get('risk') || '';
  const impactFilter = searchParams.get('impact') || '';

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ projectId: 'default' });
      if (riskFilter) params.set('riskLevel', riskFilter);
      if (impactFilter) params.set('impact', impactFilter);
      
      const res = await fetch(`/api/code-review/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      } else {
        setReviews([]);
      }
      setLoading(false);
    }
    load();
  }, [riskFilter, impactFilter]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/reviews?${params.toString()}`);
  };

  const docCount = (r: ReviewRow) => r.documentationSuggestions?.length || 0;
  const testCount = (r: ReviewRow) => r.testingSuggestions?.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Code Reviews</h1>
        <div className="flex gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Risk Level</label>
            <select
              value={riskFilter}
              onChange={(e) => handleFilterChange('risk', e.target.value)}
              className="border rounded px-3 py-1 text-sm bg-white"
            >
              <option value="">All Risks</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Impact Scope</label>
            <select
              value={impactFilter}
              onChange={(e) => handleFilterChange('impact', e.target.value)}
              className="border rounded px-3 py-1 text-sm bg-white"
            >
              <option value="">All Impacts</option>
              <option value="widespread">Widespread</option>
              <option value="moderate">Moderate</option>
              <option value="isolated">Isolated</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading reviews...</div>
      ) : (
        <table className="min-w-full border divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">PR #</th>
              <th className="px-3 py-2 text-left">Risk</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Impact Scope</th>
              <th className="px-3 py-2 text-left">Suggestions</th>
              <th className="px-3 py-2 text-left">Files</th>
              <th className="px-3 py-2 text-left">Lines +/-</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reviews.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/reviews/${r.id}`)}>
                <td className="px-3 py-2 font-mono">{r.prNumber}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${riskColor(r.riskLevel)}`}>{r.riskLevel}</span>
                </td>
                <td className="px-3 py-2">{r.overallScore}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${impactColor(r.estimatedImpact)}`}>
                    {r.estimatedImpact || 'n/a'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {docCount(r) > 0 && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Documentation Suggestions">
                        📝 {docCount(r)}
                      </span>
                    )}
                    {testCount(r) > 0 && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800" title="Testing Suggestions">
                        🧪 {testCount(r)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{r.filesAnalyzed}</td>
                <td className="px-3 py-2">+{r.linesAdded}/-{r.linesRemoved}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                {riskFilter || impactFilter ? 'No reviews match the selected filters.' : 'No reviews yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Code Reviews</h1>
        <div className="text-center py-8 text-gray-500">Loading reviews...</div>
      </div>
    }>
      <ReviewsContent />
    </Suspense>
  );
}
