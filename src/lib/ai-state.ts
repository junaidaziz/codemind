// Temporary in-memory AI state until schema migration introduces persistent fields.
// NOTE: This resets on serverless cold start / redeploy.

export interface IssueAIState {
  analyzed: boolean;
  summary?: string;
  fixPrUrl?: string;
  lastUpdated: number;
}

const issueState = new Map<string, IssueAIState>();

export function markIssueAnalyzed(issueId: string, summary: string) {
  const current = issueState.get(issueId) || { analyzed: false, lastUpdated: Date.now() };
  const updated: IssueAIState = {
    ...current,
    analyzed: true,
    summary,
    lastUpdated: Date.now(),
  };
  issueState.set(issueId, updated);
  return updated;
}

export function markIssueFix(issueId: string, prUrl: string) {
  const current = issueState.get(issueId) || { analyzed: true, lastUpdated: Date.now() };
  const updated: IssueAIState = {
    ...current,
    analyzed: true,
    fixPrUrl: prUrl,
    lastUpdated: Date.now(),
  };
  issueState.set(issueId, updated);
  return updated;
}

export function getIssueAIState(issueId: string): IssueAIState | undefined {
  return issueState.get(issueId);
}

export function serializeIssueWithAI<T extends { id: string }>(issue: T) {
  const ai = getIssueAIState(issue.id);
  return {
    ...issue,
    aiAnalyzed: ai?.analyzed || false,
    aiSummary: ai?.summary,
    aiFixAttempt: ai?.fixPrUrl,
  };
}
