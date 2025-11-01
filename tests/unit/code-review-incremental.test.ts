/** @jest-environment node */
import { CodeReviewer } from '@/lib/code-review/code-reviewer';
import type { PRAnalysis } from '@/types/code-review';

function makePR(overrides: Partial<PRAnalysis> = {}): PRAnalysis {
  return {
    prNumber: 999,
    repository: 'acme/repo',
    title: 'Incremental Test PR',
    description: 'Testing incremental path',
    author: 'tester',
    headBranch: 'feat/incremental',
    baseBranch: 'main',
    headSha: 'deadbeef',
    url: 'https://example.com/pr/999',
    filesChanged: [
      {
        filename: 'src/lib/util-small.ts',
        status: 'modified',
        additions: 3,
        deletions: 0,
        changes: 3,
        patch: '+ export const foo = 1;\n+ // minor change\n+ console.log(foo);',
      },
      {
        filename: 'README.md',
        status: 'modified',
        additions: 2,
        deletions: 0,
        changes: 2,
        patch: '+ Minor doc tweak\n+ Another note',
      }
    ],
    totalAdditions: 5,
    totalDeletions: 0,
    commits: 1,
    analyzedAt: new Date(),
    ...overrides,
  };
}

describe('Incremental analysis optimization', () => {
  it('dampens risk and skips suggestions for minimal changes', async () => {
    const reviewer = new CodeReviewer();
    const fullResult = await reviewer.analyzePR(makePR());
    const incrementalResult = await reviewer.analyzeChangedFiles(makePR());

    // Risk should be dampened (overall reduced or equal but never higher for minimal changes)
    expect(incrementalResult.riskScore.overall).toBeLessThanOrEqual(fullResult.riskScore.overall);

    // For minimal change we expect no documentation/testing suggestions in incremental if none high severity
    if (incrementalResult.documentationSuggestions.length > 0 || incrementalResult.testingSuggestions.length > 0) {
      // If present they must be triggered by severity (ensures logic path correct)
      const highSeverity = incrementalResult.comments.some(c => c.severity === 'high' || c.severity === 'critical');
      expect(highSeverity).toBe(true);
    } else {
      expect(incrementalResult.documentationSuggestions.length).toBe(0);
      expect(incrementalResult.testingSuggestions.length).toBe(0);
    }

    // Simulation scope should not expand beyond full analysis scope
    const incScope = incrementalResult.simulation?.impactAnalysis.scope;
    const fullScope = fullResult.simulation?.impactAnalysis.scope;
    if (incScope && fullScope) {
      const order = ['isolated','moderate','widespread'];
      expect(order.indexOf(incScope)).toBeLessThanOrEqual(order.indexOf(fullScope));
    }
  });
});
