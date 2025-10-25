/** @jest-environment node */
import { POST as analyzePOST } from '@/app/api/code-review/analyze/route';
import { NextRequest } from 'next/server';

// Mock GitHubFetcher to avoid real network calls
jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 42,
        repository: 'owner/repo',
        title: 'Test PR',
        description: 'Adds new feature',
        author: 'tester',
        headBranch: 'feature/impact',
        baseBranch: 'main',
        headSha: 'abc123',
        url: 'https://example.com/pr/42',
        filesChanged: [
          {
            filename: 'src/lib/sample.ts',
            status: 'modified',
            additions: 15,
            deletions: 2,
            changes: 17,
            patch: '+ const x = 1;\n+ eval(\"danger\");\n+ function risky() { if (x) { console.log(x); } }\n',
          },
        ],
        totalAdditions: 15,
        totalDeletions: 2,
        commits: 3,
        analyzedAt: new Date(),
      };
    }
  }
}));

// Mock ReviewStorage to avoid DB writes
jest.mock('@/lib/code-review/review-storage', () => ({
  ReviewStorage: class {
    async saveReview(projectId: string, prNumber: number, result: {
      riskScore: { level: string; overall: number };
      summary: { overallScore: number };
      comments: { file: string }[];
    }) {
      return {
        id: 'review-123',
        projectId,
        prNumber,
        riskLevel: result.riskScore.level.toUpperCase(),
        riskScore: result.riskScore.overall,
        overallScore: result.summary.overallScore,
        CodeReviewComment: result.comments.map((c) => ({ filePath: c.file })),
      };
    }
  }
}));

function buildNextRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Cast to NextRequest (sufficient for handler usage)
  return req as unknown as NextRequest;
}

describe('POST /api/code-review/analyze', () => {
  it('returns review data with riskScore and suggestions', async () => {
    const request = buildNextRequest('http://localhost/api/code-review/analyze', 'POST', {
      owner: 'owner',
      repo: 'repo',
      prNumber: 42,
      projectId: 'proj-1'
    });

    const response = await analyzePOST(request);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.review.riskScore).toBeDefined();
    expect(json.review.summary).toBeDefined();
    expect(json.review.documentationSuggestions).toBeDefined();
    expect(json.review.testingSuggestions).toBeDefined();
    expect(json.review.summary.simulation).toBeDefined();
    expect(json.review.summary.simulation.impactAnalysis.scope).toMatch(/isolated|moderate|widespread/);
  });

  it('validates missing input fields', async () => {
    const request = buildNextRequest('http://localhost/api/code-review/analyze', 'POST', {
      owner: 'owner',
      repo: '',
      prNumber: undefined,
    });
    const response = await analyzePOST(request);
    expect(response.status).toBe(400);
  });
});
