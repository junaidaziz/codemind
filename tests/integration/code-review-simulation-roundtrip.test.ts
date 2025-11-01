/** @jest-environment node */
import { POST as analyzePOST } from '@/app/api/code-review/analyze/route';
import { GET as listGET } from '@/app/api/code-review/list/route';
import { NextRequest } from 'next/server';

// Mock GitHubFetcher to produce deterministic simulation scope
jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 77,
        repository: 'acme/widgets',
        title: 'Refactor parser & minor feature',
        description: 'Refactors parser and adds a small optimization.',
        author: 'dev1',
        headBranch: 'refactor/parser',
        baseBranch: 'main',
        headSha: 'def456',
        url: 'https://example.com/pr/77',
        filesChanged: [
          {
            filename: 'src/lib/parser.ts',
            status: 'modified',
            additions: 45,
            deletions: 10,
            changes: 55,
            patch: '+ export function parse(input){ /* heavy change */ }\n',
          },
          {
            filename: 'src/lib/util.ts',
            status: 'modified',
            additions: 8,
            deletions: 2,
            changes: 10,
            patch: '+ export const helper = () => true;\n',
          }
        ],
        totalAdditions: 53,
        totalDeletions: 12,
        commits: 5,
        analyzedAt: new Date(),
      };
    }
  }
}));

// Use real ReviewStorage for list retrieval but mock persistence to keep test hermetic
// We'll capture the saved review including simulation JSON and then make sure list endpoint can expose scope
interface SimulationData {
  impactAnalysis: {
    scope: string;
    estimatedBlastRadius?: number;
  };
  estimatedImpact: string;
  [k: string]: unknown;
}

interface MockStoredReview {
  id: string;
  projectId: string;
  prNumber: number;
  riskLevel: string;
  riskScore: number;
  overallScore: number;
  approved: boolean;
  requiresChanges: boolean;
  filesAnalyzed: number;
  linesAdded: number;
  linesRemoved: number;
  createdAt: Date;
  simulation: SimulationData; // narrowed structural type
  documentationSuggestions: unknown;
  testingSuggestions: unknown;
  CodeReviewComment: { filePath: string }[];
}
const captured: MockStoredReview[] = [];
jest.mock('@/lib/code-review/review-storage', () => {
  return {
    ReviewStorage: class {
      async saveReview(projectId: string, prNumber: number, result: {
        riskScore: { level: string; overall: number };
        summary: { overallScore: number; approved: boolean; requiresChanges: boolean };
        prAnalysis: { filesChanged: unknown[]; totalAdditions: number; totalDeletions: number };
        simulation: SimulationData;
        documentationSuggestions: unknown;
        testingSuggestions: unknown;
        comments: { file: string }[];
      }) {
        const stored = {
          id: 'rev-sim-77',
          projectId,
          prNumber,
          riskLevel: result.riskScore.level.toUpperCase(),
          riskScore: result.riskScore.overall,
          overallScore: result.summary.overallScore,
          approved: result.summary.approved,
          requiresChanges: result.summary.requiresChanges,
          filesAnalyzed: result.prAnalysis.filesChanged.length,
          linesAdded: result.prAnalysis.totalAdditions,
          linesRemoved: result.prAnalysis.totalDeletions,
          createdAt: new Date(),
          simulation: result.simulation,
          documentationSuggestions: result.documentationSuggestions,
          testingSuggestions: result.testingSuggestions,
          CodeReviewComment: result.comments.map((c: { file: string }) => ({ filePath: c.file })),
        };
        captured.push(stored);
        return stored;
      }
      async getProjectReviews(projectId: string) {
        return captured.filter(r => r.projectId === projectId).map(r => ({ ...r }));
      }
    }
  };
});

function buildNextRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return req as unknown as NextRequest;
}

describe('Simulation round-trip integration', () => {
  it('persists and lists simulation impact scope', async () => {
    const projectId = 'proj-sim';
    // Analyze endpoint invocation
    const analyzeReq = buildNextRequest('http://localhost/api/code-review/analyze', 'POST', {
      owner: 'acme',
      repo: 'widgets',
      prNumber: 77,
      projectId,
    });
    const analyzeRes = await analyzePOST(analyzeReq);
    const analyzeJson = await analyzeRes.json();
    expect(analyzeJson.success).toBe(true);
    expect(analyzeJson.review.simulation).toBeDefined();
    expect(analyzeJson.review.simulation.impactAnalysis.scope).toMatch(/isolated|moderate|widespread|minimal/);
    // Backward compatibility: summary.simulation
    expect(analyzeJson.review.summary.simulation).toBeDefined();

    // List endpoint invocation
    const listReq = buildNextRequest(`http://localhost/api/code-review/list?projectId=${projectId}`, 'GET');
    const listRes = await listGET(listReq);
    const listJson = await listRes.json();
    expect(Array.isArray(listJson.reviews)).toBe(true);
  const item = listJson.reviews.find((r: { prNumber: number }) => r.prNumber === 77);
    expect(item).toBeDefined();
    // Expect estimatedImpact (derived from simulation) present or gracefully fallback
    expect(item.estimatedImpact).toBeTruthy();
  });
});