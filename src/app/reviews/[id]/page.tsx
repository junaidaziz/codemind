import React from 'react';
import { RiskBadge } from '@/components/code-review/RiskBadge';
import { ReviewStatusChip } from '@/components/code-review/ReviewStatusChip';
import type { ReviewSummary, ReviewSimulation, AffectedComponent, DocumentationSuggestion, TestingSuggestion } from '@/types/code-review';

interface ReviewDetailResponse {
  id: string;
  prNumber: number;
  projectId: string;
  prTitle?: string;
  riskLevel: string; // stored uppercase (LOW|MEDIUM|HIGH|CRITICAL)
  riskScore: number;
  overallScore: number;
  approved: boolean;
  requiresChanges: boolean;
  summary: string; // JSON stringified ReviewSummary
  filesAnalyzed: number;
  linesAdded: number;
  linesRemoved: number;
  CodeReviewComment: Array<{
    id: string;
    filePath: string;
    lineNumber: number;
    severity: string;
    category: string;
    message: string;
  }>;
  CodeReviewRisk: Array<{
    id: string;
    factor: string;
    score: number;
    weight: number;
    description: string;
  }>;
  CodeReviewImpact: Array<{
    id: string;
    category: string;
    severity: string;
    affectedFiles: string[];
    description: string;
    recommendations?: string;
  }>;
}

async function fetchReview(id: string): Promise<ReviewDetailResponse | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const res = await fetch(`${base}/api/code-review/analyze?reviewId=${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function severityColor(sev: string) {
  const s = sev.toLowerCase();
  if (s === 'critical') return 'bg-red-100 text-red-700 border-red-300';
  if (s === 'high') return 'bg-orange-100 text-orange-700 border-orange-300';
  if (s === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  if (s === 'low') return 'bg-green-100 text-green-700 border-green-300';
  return 'bg-gray-100 text-gray-700 border-gray-300';
}

// Parsed summary type (subset of ReviewSummary with optional simulation)
interface ParsedSummary extends Omit<ReviewSummary, 'simulation' | 'documentationSuggestions' | 'testingSuggestions'> {
  simulation?: ReviewSimulation;
  documentationSuggestions?: DocumentationSuggestion[];
  testingSuggestions?: TestingSuggestion[];
}

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const review = await fetchReview(id);

  if (!review) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-red-600">Review not found.</div>;
  }

  let parsedSummary: ParsedSummary = {
    overallAssessment: '',
    keyFindings: [],
    criticalIssues: 0,
    highPriorityIssues: 0,
    mediumPriorityIssues: 0,
    lowPriorityIssues: 0,
    positiveAspects: [],
    areasOfConcern: [],
    approvalRecommendation: 'comment',
    overallScore: review.overallScore,
    approved: review.approved,
    requiresChanges: review.requiresChanges,
  };
  try {
    const raw = JSON.parse(review.summary) as ParsedSummary;
    parsedSummary = { ...parsedSummary, ...raw };
  } catch {
    // swallow JSON parse error; fallback already set
  }

  // Attempt to hydrate suggestions & simulation from structured columns if not embedded in summary
  // @ts-expect-error runtime augmentation from API response
  if (!parsedSummary.simulation && review.simulation) parsedSummary.simulation = review.simulation as ReviewSimulation;
  // @ts-expect-error runtime augmentation from API response
  if (!parsedSummary.documentationSuggestions && review.documentationSuggestions) parsedSummary.documentationSuggestions = review.documentationSuggestions as DocumentationSuggestion[];
  // @ts-expect-error runtime augmentation from API response
  if (!parsedSummary.testingSuggestions && review.testingSuggestions) parsedSummary.testingSuggestions = review.testingSuggestions as TestingSuggestion[];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">PR #{review.prNumber}</h1>
          <p className="text-sm text-gray-600">Files analyzed: {review.filesAnalyzed} · +{review.linesAdded}/-{review.linesRemoved}</p>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge level={review.riskLevel} score={review.riskScore} />
          <ReviewStatusChip approved={review.approved} requiresChanges={review.requiresChanges} />
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Summary</h2>
        <p className="text-sm text-gray-700 whitespace-pre-line">{parsedSummary.overallAssessment}</p>
        <div className="mt-3 grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Key Findings</h3>
            <ul className="text-xs list-disc ml-4 space-y-1">
              {(parsedSummary.keyFindings || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Areas of Concern</h3>
            <ul className="text-xs list-disc ml-4 space-y-1">
              {(parsedSummary.areasOfConcern || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {parsedSummary.simulation && (
        <section>
          <h2 className="text-lg font-medium mb-2">Impact Simulation</h2>
          <p className="text-xs text-gray-600 mb-2">Scope: {parsedSummary.simulation.impactAnalysis.scope}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border">Component</th>
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Critical</th>
                  <th className="p-2 border">Change</th>
                  <th className="p-2 border">Usage</th>
                </tr>
              </thead>
              <tbody>
                {(parsedSummary.simulation?.affectedComponents || []).map((c: AffectedComponent) => (
                  <tr key={c.file} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2 border font-medium">{c.name}</td>
                    <td className="p-2 border">{c.type}</td>
                    <td className="p-2 border">{c.criticalPath ? 'Yes' : 'No'}</td>
                    <td className="p-2 border">{c.changeType}</td>
                    <td className="p-2 border">{c.usageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
        {(parsedSummary.documentationSuggestions && parsedSummary.documentationSuggestions.length > 0) && (
          <section>
            <h2 className="text-lg font-medium mb-2">Documentation Suggestions</h2>
            <ul className="space-y-2">
              {parsedSummary.documentationSuggestions.map((s, idx) => (
                <li key={idx} className="border rounded p-2 text-xs bg-white shadow-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold">{s.type}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 border text-[10px]">{s.priority}</span>
                  </div>
                  <p className="mb-1 text-gray-700">{s.suggestion}</p>
                  <p className="text-[10px] text-gray-500">{s.file} @ {s.location}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(parsedSummary.testingSuggestions && parsedSummary.testingSuggestions.length > 0) && (
          <section>
            <h2 className="text-lg font-medium mb-2">Testing Suggestions</h2>
            <ul className="space-y-2">
              {parsedSummary.testingSuggestions.map((s, idx) => (
                <li key={idx} className="border rounded p-2 text-xs bg-white shadow-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold">{s.type}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 border text-[10px]">{s.priority}</span>
                  </div>
                  <p className="mb-1 text-gray-700">{s.suggestion}</p>
                  {s.estimatedCoverage != null && (
                    <p className="text-[10px] text-gray-500">Est. Coverage: {s.estimatedCoverage}%</p>
                  )}
                  <p className="text-[10px] text-gray-500">Files: {s.files.join(', ')}</p>
                </li>
              ))}
            </ul>
          </section>
        )}


      <section>
        <h2 className="text-lg font-medium mb-2">Risk Factors</h2>
        <div className="space-y-2">
          {review.CodeReviewRisk.map(r => (
            <div key={r.id} className="border rounded p-2 text-xs flex justify-between items-center">
              <div>
                <span className="font-semibold">{r.factor}</span>: {r.description}
              </div>
              <span className="text-gray-600">{r.score}/100 · w:{r.weight}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Impacts</h2>
        {review.CodeReviewImpact.length === 0 && <p className="text-xs text-gray-500">No high-level impacts recorded.</p>}
        <div className="space-y-2">
          {review.CodeReviewImpact.map(imp => (
            <div key={imp.id} className="border rounded p-2 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded border ${severityColor(imp.severity)}`}>{imp.category} · {imp.severity}</span>
              </div>
              <p className="text-gray-700 mb-1">{imp.description}</p>
              {imp.recommendations && <p className="text-gray-600 italic">{imp.recommendations}</p>}
              <p className="text-[10px] text-gray-500 mt-1">Files: {imp.affectedFiles.join(', ') || 'None'}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Comments ({review.CodeReviewComment.length})</h2>
        <div className="space-y-2">
          {review.CodeReviewComment.map(c => (
            <div key={c.id} className="border rounded p-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{c.filePath}:{c.lineNumber}</span>
                <span className={`px-2 py-0.5 rounded border ${severityColor(c.severity)}`}>{c.severity}</span>
              </div>
              <p>{c.message}</p>
              <p className="text-[10px] text-gray-500 mt-1">{c.category}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
