import prisma from '../app/lib/db';

export interface AutoFixStartOptions {
  projectId: string;
  userId?: string | null;
  issueId?: string;
  issueNumber?: number;
}

export interface AutoFixPlan {
  sessionId: string;
  status: string;
  issueId?: string;
  steps: string[];
  summary: string;
}

/**
 * Phase 1 Orchestrator: create AutoFixSession and produce a placeholder plan.
 */
export async function startAutoFix(options: AutoFixStartOptions): Promise<AutoFixPlan> {
  const { projectId, userId, issueId, issueNumber } = options;

  let resolvedIssueId = issueId;
  if (!resolvedIssueId && typeof issueNumber === 'number') {
    const found = await prisma.issue.findFirst({ where: { projectId, number: issueNumber } });
    if (!found) throw new Error(`Issue #${issueNumber} not found in project`);
    resolvedIssueId = found.id;
  }

  const session = await prisma.autoFixSession.create({
    data: {
      projectId,
      userId: userId || null,
      status: 'ANALYZING',
      triggerType: 'MANUAL',
      issuesDetected: resolvedIssueId ? JSON.stringify([resolvedIssueId]) : '[]',
      analysisResult: 'Collecting context...',
    },
  });

  // Placeholder analysis plan (later replaced by real retrieval + model reasoning)
  const steps = [
    'Retrieve issue details',
    'Identify relevant code chunks (vector + lexical search)',
    'Draft minimal change plan',
    'Request user confirmation before patch generation',
  ];

  // Update analysisResult with stub plan
  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: { analysisResult: steps.join('\n') },
  });

  return {
    sessionId: session.id,
    status: 'ANALYZING',
    issueId: resolvedIssueId,
    steps,
    summary: 'AutoFix session initialized; awaiting enhancement phase for patch generation.',
  };
}

/**
 * Simple parser to detect /fix commands from chat messages.
 */
export function parseFixCommand(message: string): { issueNumber?: number } | null {
  const trimmed = message.trim();
  const patterns = [
    /^\/fix\s+#?(\d+)$/i,
    /^fix\s+issue\s+#?(\d+)$/i,
    /^fix\s+#?(\d+)$/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return { issueNumber: parseInt(m[1], 10) };
  }
  if (/^\/fix$/i.test(trimmed)) return {}; // generic fix request
  return null;
}
