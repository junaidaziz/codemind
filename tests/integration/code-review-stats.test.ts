/** @jest-environment node */
import { POST as analyzePOST } from '@/app/api/code-review/analyze/route';
import { GET as statsGET } from '@/app/api/code-review/stats/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 404,
        repository: 'acme/repo',
        title: 'Stats PR',
        description: 'Testing stats aggregation',
        author: 'statuser',
        headBranch: 'feat/stats',
        baseBranch: 'main',
        headSha: 'cafebabe',
        url: 'https://example.com/pr/404',
        filesChanged: [
          { filename: 'src/lib/a.ts', status: 'modified', additions: 15, deletions: 2, changes: 17, patch: '+ export const a = 1;\n+ eval(\"bad\");' },
          { filename: 'src/lib/b.ts', status: 'modified', additions: 5, deletions: 0, changes: 5, patch: '+ console.log("b");' },
        ],
        totalAdditions: 20,
        totalDeletions: 2,
        commits: 3,
        analyzedAt: new Date(),
      };
    }
  }
}));

// Mock ReviewStorage to accumulate reviews for stats
interface StoredReview {
  projectId: string;
  prNumber: number;
  riskLevel: string;
  overallScore: number;
  approved: boolean;
  requiresChanges: boolean;
  simulation: unknown;
}

const stored: StoredReview[] = [];
jest.mock('@/lib/code-review/review-storage', () => ({
  ReviewStorage: class {
    async saveReview(projectId: string, prNumber: number, result: {
      riskScore: { level: string };
      summary: { overallScore: number; approved: boolean; requiresChanges: boolean };
      simulation: unknown;
    }) {
      stored.push({ projectId, prNumber, riskLevel: result.riskScore.level.toUpperCase(), overallScore: result.summary.overallScore, approved: result.summary.approved, requiresChanges: result.summary.requiresChanges, simulation: result.simulation });
      return { id: `rev-${prNumber}`, projectId, prNumber };
    }
    async getProjectReviews(projectId: string) {
      return stored.filter(r => r.projectId === projectId);
    }
  }
}));

function buildReq(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  const req = new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return req as unknown as NextRequest;
}

describe('Code review stats endpoint', () => {
  it('aggregates reviews after analysis', async () => {
    const projectId = 'default';
    // Create two reviews
    for (const pr of [404, 405]) {
      const analyzeReq = buildReq('http://localhost/api/code-review/analyze', 'POST', { owner: 'acme', repo: 'repo', prNumber: pr, projectId });
      const res = await analyzePOST(analyzeReq); await res.json();
    }
    // Fetch stats
    const statsReq = buildReq('http://localhost/api/code-review/stats?projectId=default', 'GET');
    const statsRes = await statsGET(statsReq);
    const json = await statsRes.json();
    expect(json.total).toBeGreaterThanOrEqual(2);
    expect(json.riskDistribution).toBeDefined();
    expect(json.impactDistribution).toBeDefined();
    expect(typeof json.approvalRate).toBe('number');
  });
});
