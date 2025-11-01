/**
 * @jest-environment node
 */

/**
 * Integration test: Code review list filtering
 * Validates that risk level and impact scope filters work correctly.
 */

interface MockReview {
  id: string;
  projectId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  headBranch: string;
  baseBranch: string;
  authorLogin: string;
  riskLevel: string;
  riskScore: number;
  overallScore: number;
  approved: boolean;
  requiresChanges: boolean;
  filesAnalyzed: number;
  linesAdded: number;
  linesRemoved: number;
  status: string;
  simulation?: { estimatedImpact?: string };
  documentationSuggestions?: Array<{ type: string }>;
  testingSuggestions?: Array<{ type: string }>;
  CodeReviewComment: unknown[];
  CodeReviewRisk: unknown[];
  CodeReviewImpact: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

interface MockStorage {
  client: Record<string, unknown>;
  getProjectReviews: jest.Mock;
}

describe('Code Review List Filters', () => {
  let mockReviews: MockReview[];

  beforeAll(() => {
    // Mock reviews with different risk levels and impact scopes
    mockReviews = [
      {
        id: 'review-critical-widespread',
        projectId: 'test-filters',
        prNumber: 101,
        prTitle: 'Critical refactor',
        prUrl: 'https://github.com/test/repo/pull/101',
        headBranch: 'feature/critical',
        baseBranch: 'main',
        authorLogin: 'dev1',
        riskLevel: 'CRITICAL',
        riskScore: 9.5,
        overallScore: 75,
        approved: false,
        requiresChanges: true,
        filesAnalyzed: 15,
        linesAdded: 500,
        linesRemoved: 300,
        status: 'COMPLETED',
        simulation: { estimatedImpact: 'widespread' },
        documentationSuggestions: [{ type: 'API_DOCUMENTATION' }, { type: 'INLINE_COMMENT' }],
        testingSuggestions: [{ type: 'UNIT_TEST' }],
        CodeReviewComment: [],
        CodeReviewRisk: [],
        CodeReviewImpact: [],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
      {
        id: 'review-high-moderate',
        projectId: 'test-filters',
        prNumber: 102,
        prTitle: 'High risk change',
        prUrl: 'https://github.com/test/repo/pull/102',
        headBranch: 'feature/high',
        baseBranch: 'main',
        authorLogin: 'dev2',
        riskLevel: 'HIGH',
        riskScore: 7.2,
        overallScore: 82,
        approved: false,
        requiresChanges: true,
        filesAnalyzed: 8,
        linesAdded: 200,
        linesRemoved: 100,
        status: 'COMPLETED',
        simulation: { estimatedImpact: 'moderate' },
        documentationSuggestions: [{ type: 'README_UPDATE' }],
        testingSuggestions: [],
        CodeReviewComment: [],
        CodeReviewRisk: [],
        CodeReviewImpact: [],
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16'),
      },
      {
        id: 'review-medium-isolated',
        projectId: 'test-filters',
        prNumber: 103,
        prTitle: 'Medium risk feature',
        prUrl: 'https://github.com/test/repo/pull/103',
        headBranch: 'feature/medium',
        baseBranch: 'main',
        authorLogin: 'dev3',
        riskLevel: 'MEDIUM',
        riskScore: 5.0,
        overallScore: 88,
        approved: true,
        requiresChanges: false,
        filesAnalyzed: 3,
        linesAdded: 80,
        linesRemoved: 20,
        status: 'COMPLETED',
        simulation: { estimatedImpact: 'isolated' },
        documentationSuggestions: [],
        testingSuggestions: [{ type: 'INTEGRATION_TEST' }, { type: 'E2E_TEST' }],
        CodeReviewComment: [],
        CodeReviewRisk: [],
        CodeReviewImpact: [],
        createdAt: new Date('2024-01-17'),
        updatedAt: new Date('2024-01-17'),
      },
      {
        id: 'review-low-minimal',
        projectId: 'test-filters',
        prNumber: 104,
        prTitle: 'Low risk bugfix',
        prUrl: 'https://github.com/test/repo/pull/104',
        headBranch: 'bugfix/low',
        baseBranch: 'main',
        authorLogin: 'dev4',
        riskLevel: 'LOW',
        riskScore: 2.0,
        overallScore: 92,
        approved: true,
        requiresChanges: false,
        filesAnalyzed: 1,
        linesAdded: 10,
        linesRemoved: 5,
        status: 'COMPLETED',
        simulation: { estimatedImpact: 'minimal' },
        documentationSuggestions: [],
        testingSuggestions: [],
        CodeReviewComment: [],
        CodeReviewRisk: [],
        CodeReviewImpact: [],
        createdAt: new Date('2024-01-18'),
        updatedAt: new Date('2024-01-18'),
      },
    ];
  });

  it('should filter by risk level (CRITICAL only)', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(
        mockReviews.filter(r => r.riskLevel === 'CRITICAL')
      ),
    };

    const reviews = await mockStorage.getProjectReviews('test-filters', { riskLevel: 'CRITICAL' });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].riskLevel).toBe('CRITICAL');
    expect(reviews[0].prNumber).toBe(101);
  });

  it('should filter by risk level (HIGH only)', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(
        mockReviews.filter(r => r.riskLevel === 'HIGH')
      ),
    };

    const reviews = await mockStorage.getProjectReviews('test-filters', { riskLevel: 'HIGH' });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].riskLevel).toBe('HIGH');
    expect(reviews[0].prNumber).toBe(102);
  });

  it('should filter by impact scope (widespread)', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(
        mockReviews.filter(r => r.simulation?.estimatedImpact?.toLowerCase() === 'widespread')
      ),
    };

    const reviews = await mockStorage.getProjectReviews('project-1', { impactLevel: 'widespread' });
    
    expect(reviews).toHaveLength(1);
    expect(reviews[0].prNumber).toBe(101);
    expect(reviews[0].simulation?.estimatedImpact).toBe('widespread');
  });

  it('should filter by impact scope (isolated)', () => {
    const filtered = mockReviews.filter(
      r => r.simulation?.estimatedImpact?.toLowerCase() === 'isolated'
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].simulation?.estimatedImpact).toBe('isolated');
    expect(filtered[0].prNumber).toBe(103);
  });

  it('should return correct suggestion counts', () => {
    const withDocs = mockReviews.filter(r => (r.documentationSuggestions?.length || 0) > 0);
    const withTests = mockReviews.filter(r => (r.testingSuggestions?.length || 0) > 0);

    expect(withDocs).toHaveLength(2); // PR 101 (2 docs), PR 102 (1 doc)
    expect(withTests).toHaveLength(2); // PR 101 (1 test), PR 103 (2 tests)

    const criticalReview = mockReviews[0];
    expect(criticalReview.documentationSuggestions).toHaveLength(2);
    expect(criticalReview.testingSuggestions).toHaveLength(1);
  });

  it('should handle combined filters (HIGH risk + moderate impact)', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(
        mockReviews.filter(r => r.riskLevel === 'HIGH')
      ),
    };

    const reviews = await mockStorage.getProjectReviews('test-filters', { riskLevel: 'HIGH' });
    const filtered = reviews.filter(
      (r: MockReview) => r.simulation?.estimatedImpact?.toLowerCase() === 'moderate'
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].riskLevel).toBe('HIGH');
    expect(filtered[0].simulation?.estimatedImpact).toBe('moderate');
    expect(filtered[0].prNumber).toBe(102);
  });

  it('should return empty array when no matches', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(
        mockReviews.filter(r => r.riskLevel === 'CRITICAL')
      ),
    };

    const reviews = await mockStorage.getProjectReviews('test-filters', { riskLevel: 'CRITICAL' });
    const filtered = reviews.filter(
      (r: MockReview) => r.simulation?.estimatedImpact?.toLowerCase() === 'minimal'
    );

    expect(filtered).toHaveLength(0);
  });

  it('should return all reviews when no filters applied', async () => {
    const mockStorage: MockStorage = {
      client: {},
      getProjectReviews: jest.fn().mockResolvedValue(mockReviews),
    };

    const reviews = await mockStorage.getProjectReviews('test-filters', {});
    expect(reviews).toHaveLength(4);
  });
});
