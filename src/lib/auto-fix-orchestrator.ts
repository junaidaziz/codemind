import prisma from '../app/lib/db';
import { buildHeaderCommentPatch } from './patch-engine';
import OpenAI from 'openai';
import { runValidationSimulation } from './validation-runner';
import { getGitHubToken } from './config-helper';
import GitHubService from './github-service';

interface RetrievedFileContext {
  path: string;
  reason: string;
}

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

export interface PatchGenerationResult {
  sessionId: string;
  filePath: string;
  diff: string;
  resultId: string;
  message: string;
}

export interface MultiPatchGenerationResult {
  sessionId: string;
  patches: Array<{
    filePath: string;
    diff: string;
    resultId: string;
    linesAdded: number;
  }>;
  message: string;
  count: number;
}

export interface LLMPatchOptions {
  style?: 'minimal' | 'refactor';
  rationale?: string;
}

export interface LLMPatchGenerationResult {
  sessionId: string;
  filePath: string;
  diff: string;
  rationale: string;
  resultId: string;
  message: string;
}

export interface LLMMultiPatchGenerationResult {
  sessionId: string;
  patches: Array<{ filePath: string; diff: string; resultId: string; rationale: string }>;
  message: string;
  count: number;
}

export interface ApplyResult {
  sessionId: string;
  prUrl?: string;
  simulated: boolean;
  branchName?: string;
  message: string;
  appliedFiles?: string[];
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

  // Log activity (best-effort)
  try {
    await prisma.activityLog.create({
      data: {
        projectId,
        userId: userId || null,
        activityType: 'AI_FIX_STARTED',
        entityType: 'issue',
        entityId: resolvedIssueId || session.id,
        description: `AutoFix session created (${session.id})`,
        impact: 'LOW',
        metadata: JSON.stringify({ sessionId: session.id, issueId: resolvedIssueId }),
      },
    });
  } catch {
    // ignore log failure
  }
  // Phase 2: basic analysis
  const issueRecord = resolvedIssueId
    ? await prisma.issue.findUnique({ where: { id: resolvedIssueId } })
    : null;

  const keywords = extractKeywords(issueRecord?.title || '', issueRecord?.body || '');
  const relatedFiles = await simpleFileHeuristics(projectId, keywords, 15);

  const steps = [
    'Issue retrieved',
    `Keywords extracted: ${keywords.slice(0, 8).join(', ') || 'none'}`,
    `Candidate files identified: ${relatedFiles.length}`,
    'Next: vector similarity (future), refine to top impactful lines',
    'Prepare patch plan after user confirmation',
  ];

  const analysisLines: string[] = [];
  if (issueRecord) {
    analysisLines.push(`# Issue ${issueRecord.number}: ${issueRecord.title}`);
  }
  if (keywords.length) analysisLines.push(`Keywords: ${keywords.join(', ')}`);
  if (relatedFiles.length) {
    analysisLines.push('Candidate Files:');
    relatedFiles.slice(0, 10).forEach(f => {
      analysisLines.push(`- ${f.path} (${f.reason})`);
    });
  }

  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: { analysisResult: analysisLines.join('\n') },
  });

  return {
    sessionId: session.id,
    status: 'ANALYZING',
    issueId: resolvedIssueId,
    steps,
    summary: 'Analysis prepared: review candidate files and confirm to proceed to patch generation (not yet implemented).',
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

// --- Helpers ---
function extractKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const tokens = text.split(/[^a-zA-Z0-9_]+/).filter(t => t.length > 3 && t.length < 30);
  const stop = new Set(['this','that','with','from','have','there','their','about','which','will','error','issue','problem','fix','failed','failing']);
  const freq: Record<string, number> = {};
  for (const tok of tokens) {
    if (stop.has(tok)) continue;
    freq[tok] = (freq[tok] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 20)
    .map(([k]) => k);
}

async function simpleFileHeuristics(projectId: string, keywords: string[], limit: number): Promise<RetrievedFileContext[]> {
  if (!keywords.length) return [];
  // naive approach: fetch recent project files (requires ProjectFile model) and rank by keyword overlap
  const files = await prisma.projectFile.findMany({
    where: { projectId },
    select: { relativePath: true, fileType: true, language: true },
    take: 400,
  });
  const scored = files.map(f => {
    const pathLower = f.relativePath.toLowerCase();
    const hit = keywords.filter(k => pathLower.includes(k)).length;
    return { file: f, score: hit };
  }).filter(s => s.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(s => ({ path: s.file.relativePath, reason: `matched ${s.score} keyword(s)` }));
}

export async function generatePatchPlan(sessionId: string): Promise<PatchGenerationResult> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.fixesGenerated && session.fixesGenerated.length > 0) {
    throw new Error('Patch already generated for this session (stub constraint)');
  }
  const issueIds: string[] = safeJson(session.issuesDetected) || [];
  let primaryIssue = issueIds[0] ? await prisma.issue.findUnique({ where: { id: issueIds[0] } }) : null;
  if (!primaryIssue) {
    // pick any recent issue as fallback
    primaryIssue = await prisma.issue.findFirst({ where: { projectId: session.projectId }, orderBy: { createdAt: 'desc' } });
  }
  const keywords = extractKeywords(primaryIssue?.title || '', primaryIssue?.body || '');
  const files = await simpleFileHeuristics(session.projectId, keywords, 5);
  if (!files.length) throw new Error('No candidate files to patch');
  const targetPath = files[0].path;
  const projectFile = await prisma.projectFile.findFirst({ where: { projectId: session.projectId, relativePath: targetPath } });
  if (!projectFile) throw new Error('Target file record not found');

  // Attempt to fetch real file content from GitHub if project config exists
  let originalContent = `// Placeholder content for ${targetPath}\n`;
  try {
    const project = await prisma.project.findUnique({ where: { id: session.projectId } });
    if (project) {
      const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (repoMatch) {
        const [, owner, repoRaw] = repoMatch;
        const repo = repoRaw.replace(/\.git$/, '');
        const token = await getGitHubToken(project.id);
        if (token) {
          const gh = new GitHubService(token);
            const file = await gh.getFileContent(owner, repo, targetPath).catch(() => null);
            if (file?.content) originalContent = file.content;
        }
      }
    }
  } catch {
    // swallow, fallback to placeholder
  }
  const patch = buildHeaderCommentPatch(targetPath, originalContent);
  if (!patch) throw new Error('Unable to build patch');

  const result = await prisma.autoFixResult.create({
    data: {
      sessionId: session.id,
      success: true,
      message: 'Generated initial header insertion patch',
      issueType: 'generic',
      severity: 'LOW',
      filePath: targetPath,
      changeType: 'modify',
      linesAdded: patch.updatedContent.split('\n').length - originalContent.split('\n').length,
      linesRemoved: 0,
      confidence: 0.3,
      testability: 'LOW',
      reviewComplexity: 'LOW',
    },
  });

  const storedPatch = {
    filePath: targetPath,
    diff: patch.unifiedDiff,
    updatedContent: patch.updatedContent,
    originalPreview: patch.originalContent.slice(0, 400),
    timestamp: Date.now(),
    stats: {
      hunks: (patch.unifiedDiff.match(/^@@/gm) || []).length,
      bytes: patch.unifiedDiff.length,
      truncated: /Diff truncated/.test(patch.unifiedDiff)
    }
  };
  // Log diff metrics (hunks & bytes) for analytics
  try {
    if (!/ \(no changes\)$/.test(patch.unifiedDiff)) {
      const hunkCount = storedPatch.stats.hunks;
      await prisma.activityLog.create({
        data: {
          projectId: session.projectId,
          userId: session.userId,
          activityType: 'AI_FIX_DIFF_METRICS',
          entityType: 'ai_fix',
          entityId: session.id,
          description: 'Diff metrics recorded for initial patch',
          impact: 'LOW',
          metadata: JSON.stringify({ sessionId: session.id, file: targetPath, bytes: storedPatch.stats.bytes, hunks: hunkCount, truncated: storedPatch.stats.truncated }),
        }
      });
    }
  } catch { /* ignore metrics log errors */ }
  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: {
      fixesGenerated: JSON.stringify([storedPatch]),
      status: 'FIXING',
    },
  });

  return {
    sessionId: session.id,
    filePath: targetPath,
    diff: patch.unifiedDiff,
    resultId: result.id,
    message: 'Patch plan generated (header insertion stub).',
  };
}

/**
 * LLM Patch Plan (stub): Simulates an LLM producing a minimal targeted change inside the file.
 * Current implementation: inserts a TODO comment near top tagged as LLM_EDIT. Future: real model call.
 */
export async function generateLLMPatchPlan(sessionId: string, options?: LLMPatchOptions): Promise<LLMPatchGenerationResult> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.fixesGenerated && session.fixesGenerated.length > 0) {
    throw new Error('Patch already generated for this session');
  }
  const issueIds: string[] = safeJson(session.issuesDetected) || [];
  let primaryIssue = issueIds[0] ? await prisma.issue.findUnique({ where: { id: issueIds[0] } }) : null;
  if (!primaryIssue) {
    primaryIssue = await prisma.issue.findFirst({ where: { projectId: session.projectId }, orderBy: { createdAt: 'desc' } });
  }
  const keywords = extractKeywords(primaryIssue?.title || '', primaryIssue?.body || '');
  const files = await simpleFileHeuristics(session.projectId, keywords, 5);
  if (!files.length) throw new Error('No candidate files');
  const targetPath = files[0].path;
  let originalContent = `// Placeholder content for ${targetPath}\n`;
  try {
    const project = await prisma.project.findUnique({ where: { id: session.projectId } });
    if (project) {
      const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (repoMatch) {
        const [, owner, repoRaw] = repoMatch; const repo = repoRaw.replace(/\.git$/, '');
        const token = await getGitHubToken(project.id);
        if (token) {
          const gh = new GitHubService(token);
          const file = await gh.getFileContent(owner, repo, targetPath).catch(() => null);
          if (file?.content) originalContent = file.content;
        }
      }
    }
  } catch { /* ignore */ }

  const useReal = process.env.AUTOFIX_LLM_ENABLED === 'true' && process.env.OPENAI_API_KEY;
  let updatedContent = originalContent;
  let insertion: string = '// LLM_EDIT';
  if (useReal) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `You are assisting in generating a minimal safe code patch. Modify ONLY one small spot if needed. Provide the updated file wrapped in <file> tags.
Issue Title: ${primaryIssue?.title || ''}
Issue Body: ${primaryIssue?.body?.slice(0,800) || ''}
File Path: ${targetPath}
Original File Start (first 120 lines):\n${originalContent.split('\n').slice(0,120).join('\n')}
Desired style: ${options?.style || 'minimal'}
Respond with only updated file content inside <file>...</file>.`;
      const completion = await client.chat.completions.create({
        model: process.env.AUTOFIX_LLM_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
      });
      const raw = completion.choices[0]?.message?.content || '';
      const match = raw.match(/<file>([\s\S]*?)<\/file>/i);
      if (match) {
        updatedContent = match[1].trimEnd();
      } else if (raw.trim()) {
        // Fallback: treat entire response as file if it looks like code
        updatedContent = raw;
      }
      if (!updatedContent || updatedContent === originalContent) {
        // fallback to stub insertion if model produced no change
        const lines = originalContent.split('\n');
        insertion = `// LLM_EDIT: (no-op fallback)`;
        if (!lines.some(l => l.includes('LLM_EDIT'))) lines.splice(Math.min(1, lines.length), 0, insertion);
        updatedContent = lines.join('\n');
      }
    } catch (e) {
      // On any failure, fallback to stub
      const lines = originalContent.split('\n');
      insertion = `// LLM_EDIT: fallback due to error (${(e as Error).message.slice(0,60)})`;
      if (!lines.some(l => l.includes('LLM_EDIT'))) lines.splice(Math.min(1, lines.length), 0, insertion);
      updatedContent = lines.join('\n');
    }
  } else {
    // Simulated minimal edit
    const lines = originalContent.split('\n');
    insertion = `// LLM_EDIT: ${options?.rationale || 'Proposed improvement'} (${options?.style || 'minimal'})`;
    if (!lines.some(l => l.includes('LLM_EDIT'))) {
      lines.splice(Math.min(1, lines.length), 0, insertion);
    }
    updatedContent = lines.join('\n');
  }
  const diff = buildUnifiedSingleLineDiff(targetPath, originalContent, updatedContent, insertion || '// LLM_EDIT');

  const result = await prisma.autoFixResult.create({
    data: {
      sessionId: session.id,
      success: true,
      message: 'Generated LLM-style patch stub',
      issueType: 'generic',
      severity: 'LOW',
      filePath: targetPath,
      changeType: 'modify',
      linesAdded: 1,
      linesRemoved: 0,
      confidence: 0.2,
      testability: 'LOW',
      reviewComplexity: 'LOW',
    },
  });

  const storedPatch: StoredPatchMeta[] = [{
    filePath: targetPath,
    diff,
    updatedContent,
    originalPreview: originalContent.slice(0,400),
    timestamp: Date.now(),
    meta: { method: 'llm', style: options?.style || 'minimal', real: !!useReal }
  }];

  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: { fixesGenerated: JSON.stringify(storedPatch), status: 'FIXING' },
  });

  return {
    sessionId: session.id,
    filePath: targetPath,
    diff,
    rationale: options?.rationale || 'Minimal illustrative change',
    resultId: result.id,
    message: 'LLM patch plan (stub) generated.',
  };
}

function buildUnifiedSingleLineDiff(filePath: string, original: string, updated: string, insertedLine: string): string {
  const oLines = original.split('\n');
  const uLines = updated.split('\n');
  let ln = 0;
  while (ln < oLines.length && ln < uLines.length && oLines[ln] === uLines[ln]) ln++;
  // present minimal diff hunk
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${ln+1},0 +${ln+1},1 @@`,
    `+${insertedLine}`
  ].join('\n');
}

/**
 * Multi-file LLM patch stub: apply simulated single-line insertions to top N candidate files.
 */
export async function generateLLMMultiPatchPlan(sessionId: string, desiredCount = 3, options?: LLMPatchOptions): Promise<LLMMultiPatchGenerationResult> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.fixesGenerated && session.fixesGenerated.length > 0) throw new Error('Patches already generated for this session');
  const issueIds: string[] = safeJson(session.issuesDetected) || [];
  let primaryIssue = issueIds[0] ? await prisma.issue.findUnique({ where: { id: issueIds[0] } }) : null;
  if (!primaryIssue) primaryIssue = await prisma.issue.findFirst({ where: { projectId: session.projectId }, orderBy: { createdAt: 'desc' } });
  const keywords = extractKeywords(primaryIssue?.title || '', primaryIssue?.body || '');
  const maxFiles = parseInt(process.env.AUTOFIX_MULTI_MAX_FILES || '5', 10) || 5;
  const targetCount = Math.min(Math.max(2, desiredCount), maxFiles);
  const files = await simpleFileHeuristics(session.projectId, keywords, targetCount + 2);
  if (files.length < 2) throw new Error('Not enough candidate files');

  const patches: Array<{ filePath: string; diff: string; resultId: string; rationale: string }> = [];
  const stored: Array<{ filePath: string; diff: string; updatedContent: string; originalPreview: string; timestamp: number; meta: { method: string; style: string } }> = [];
  for (const f of files.slice(0, targetCount)) {
    let original = `// Placeholder content for ${f.path}\n`;
    try {
      const project = await prisma.project.findUnique({ where: { id: session.projectId } });
      if (project) {
        const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          const [, owner, rawRepo] = match; const repo = rawRepo.replace(/\.git$/, '');
          const token = await getGitHubToken(project.id);
          if (token) {
            const gh = new GitHubService(token);
            const file = await gh.getFileContent(owner, repo, f.path).catch(() => null);
            if (file?.content) original = file.content;
          }
        }
      }
    } catch { /* ignore */ }
    const insertion = `// LLM_EDIT: ${options?.rationale || 'Proposed improvement'} (${options?.style || 'minimal'})`;
    const lines = original.split('\n');
    if (!lines.some(l => l.includes('LLM_EDIT'))) lines.splice(Math.min(1, lines.length), 0, insertion);
    const updated = lines.join('\n');
    const diff = buildUnifiedSingleLineDiff(f.path, original, updated, insertion);
    const result = await prisma.autoFixResult.create({
      data: {
        sessionId: session.id,
        success: true,
        message: 'Generated LLM-style patch stub (multi)',
        issueType: 'generic',
        severity: 'LOW',
        filePath: f.path,
        changeType: 'modify',
        linesAdded: 1,
        linesRemoved: 0,
        confidence: 0.18,
        testability: 'LOW',
        reviewComplexity: 'LOW',
      },
    });
    patches.push({ filePath: f.path, diff, resultId: result.id, rationale: options?.rationale || 'Minimal illustrative change' });
    stored.push({ filePath: f.path, diff, updatedContent: updated, originalPreview: original.slice(0,400), timestamp: Date.now(), meta: { method: 'llm', style: options?.style || 'minimal' } });
  }

  await prisma.autoFixSession.update({ where: { id: session.id }, data: { fixesGenerated: JSON.stringify(stored), status: 'FIXING' } });
  return { sessionId: session.id, patches, message: `Generated ${patches.length} LLM patch stub(s).`, count: patches.length };
}

/**
 * Multi-file patch planning: generate patches for the top N candidate files (header insertion stub per file).
 * Safety limits: maxFiles (default 5, env AUTOFIX_MULTI_MAX_FILES), requires at least 2 candidates.
 */
export async function generateMultiPatchPlan(sessionId: string, desiredCount = 3): Promise<MultiPatchGenerationResult> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.fixesGenerated && session.fixesGenerated.length > 0) {
    throw new Error('Patches already generated for this session');
  }
  const issueIds: string[] = safeJson(session.issuesDetected) || [];
  let primaryIssue = issueIds[0] ? await prisma.issue.findUnique({ where: { id: issueIds[0] } }) : null;
  if (!primaryIssue) {
    primaryIssue = await prisma.issue.findFirst({ where: { projectId: session.projectId }, orderBy: { createdAt: 'desc' } });
  }
  const keywords = extractKeywords(primaryIssue?.title || '', primaryIssue?.body || '');
  const maxFiles = parseInt(process.env.AUTOFIX_MULTI_MAX_FILES || '5', 10) || 5;
  const targetCount = Math.min(Math.max(2, desiredCount), maxFiles);
  const files = await simpleFileHeuristics(session.projectId, keywords, targetCount + 3); // overfetch a little
  if (files.length < 2) throw new Error('Not enough candidate files for multi-file planning');

  const generated: Array<{ filePath: string; diff: string; resultId: string; linesAdded: number }> = [];
  const patchStore: StoredPatchMeta[] = [];
  const maxTotalLocDelta = parseInt(process.env.AUTOFIX_MULTI_MAX_LOC_DELTA || '400', 10) || 400;
  let cumulativeAdded = 0;
  for (const f of files.slice(0, targetCount)) {
    // Fetch original content (best-effort)
    let originalContent = `// Placeholder content for ${f.path}\n`;
    try {
      const project = await prisma.project.findUnique({ where: { id: session.projectId } });
      if (project) {
        const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (repoMatch) {
          const [, owner, repoRaw] = repoMatch;
          const repo = repoRaw.replace(/\.git$/, '');
          const token = await getGitHubToken(project.id);
          if (token) {
            const gh = new GitHubService(token);
            const file = await gh.getFileContent(owner, repo, f.path).catch(() => null);
            if (file?.content) originalContent = file.content;
          }
        }
      }
    } catch { /* ignore */ }

    const patch = buildHeaderCommentPatch(f.path, originalContent);
    if (!patch) continue;
    const linesAdded = patch.updatedContent.split('\n').length - originalContent.split('\n').length;
    // Safety: check cumulative LOC delta
    if (cumulativeAdded + linesAdded > maxTotalLocDelta) {
      // If nothing generated yet fallback to single (still include this one), else break loop
      if (!generated.length) {
        // allow this single file even if it exceeds threshold (edge case) but mark truncated
        cumulativeAdded += linesAdded;
      } else {
        break;
      }
    } else {
      cumulativeAdded += linesAdded;
    }

    const result = await prisma.autoFixResult.create({
      data: {
        sessionId: session.id,
        success: true,
        message: 'Generated header insertion patch (multi)',
        issueType: 'generic',
        severity: 'LOW',
        filePath: f.path,
        changeType: 'modify',
        linesAdded: linesAdded,
        linesRemoved: 0,
        confidence: 0.25,
        testability: 'LOW',
        reviewComplexity: 'LOW',
      },
    });
    generated.push({
      filePath: f.path,
      diff: patch.unifiedDiff,
      resultId: result.id,
      linesAdded,
    });
    patchStore.push({
      filePath: f.path,
      diff: patch.unifiedDiff,
      updatedContent: patch.updatedContent,
      originalPreview: patch.originalContent.slice(0, 400),
      timestamp: Date.now(),
      stats: {
        hunks: (patch.unifiedDiff.match(/^@@/gm) || []).length,
        bytes: patch.unifiedDiff.length,
        truncated: /Diff truncated/.test(patch.unifiedDiff)
      }
    });
    // Per-file diff metrics log (best-effort)
    try {
      if (!/ \(no changes\)$/.test(patch.unifiedDiff)) {
        const hunkCount = (patch.unifiedDiff.match(/^@@/gm) || []).length;
        await prisma.activityLog.create({
          data: {
            projectId: session.projectId,
            userId: session.userId,
            activityType: 'AI_FIX_DIFF_METRICS',
            entityType: 'ai_fix',
            entityId: session.id,
            description: 'Diff metrics recorded for multi-file patch',
            impact: 'LOW',
            metadata: JSON.stringify({ sessionId: session.id, file: f.path, bytes: patch.unifiedDiff.length, hunks: hunkCount, truncated: /Diff truncated/.test(patch.unifiedDiff) }),
          },
        });
      }
    } catch { /* swallow */ }
  }

  if (!generated.length) throw new Error('No patches generated');

  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: { fixesGenerated: JSON.stringify(patchStore), status: 'FIXING' },
  });

  const truncated = generated.length < targetCount;
  return {
    sessionId: session.id,
    patches: generated,
    message: `Generated ${generated.length} patch stub(s).${truncated ? ' (truncated by safety limits)' : ''}`,
    count: generated.length,
  };
}

function safeJson<T>(val: unknown): T | null {
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return null;
}

interface StoredPatchMeta { filePath: string; diff: string; updatedContent: string; originalPreview?: string; timestamp: number; stats?: { hunks: number; bytes: number; truncated: boolean }; meta?: Record<string, unknown> }

import type { ValidationSummary } from './validation-runner';
export async function applyAutoFix(sessionId: string, { simulate = true }: { simulate?: boolean } = {}): Promise<ApplyResult & { validation?: ValidationSummary }> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.status === 'CANCELLED') {
    throw new Error('Cannot apply a cancelled AutoFix session');
  }
  const patchesRaw = safeJson<StoredPatchMeta[]>(session.fixesGenerated);
  if (!patchesRaw || !patchesRaw.length) throw new Error('No generated patch to apply');
  // Run validation (simulation for now) across all files
  const changedFiles = patchesRaw.map(p => p.filePath);
  const validation = await runValidationSimulation(changedFiles);
  if (!validation.allPassed) {
    await prisma.autoFixSession.update({
      where: { id: session.id },
      data: { status: 'FAILED' },
    });

    // Activity log: validation failed
    try {
      await prisma.activityLog.create({
        data: {
          projectId: session.projectId,
          userId: session.userId,
            activityType: 'AI_FIX_FAILED',
          entityType: 'ai_fix',
          entityId: session.id,
          description: 'AutoFix validation failed – patch not applied',
          impact: 'LOW',
          metadata: JSON.stringify({
            sessionId: session.id,
            changedFiles,
            validation,
            phase: 'validation',
          }),
        },
      });
    } catch { /* swallow log errors */ }
    return {
      sessionId: session.id,
      prUrl: undefined,
      simulated: true,
      branchName: undefined,
      message: 'Validation failed – patch not applied.',
      validation,
    };
  }

  let prUrl: string | undefined;
  let branchName: string | undefined;
  if (!simulate) {
    // Attempt real PR creation if token & repo available
    try {
      const project = await prisma.project.findUnique({ where: { id: session.projectId } });
      if (project) {
        const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (repoMatch) {
          const [, owner, rawRepo] = repoMatch;
          const repo = rawRepo.replace(/\.git$/, '');
          const token = await getGitHubToken(project.id);
          if (token) {
            const gh = new GitHubService(token);
            branchName = `autofix/${session.id.slice(0,8)}`;
            await gh.createBranch(owner, repo, branchName);
            await gh.commitChanges(owner, repo, branchName, patchesRaw.map(p => ({
              path: p.filePath,
              content: p.updatedContent,
              message: 'AI AutoFix patch (header insertion stub)'
            })), `AI AutoFix Patch for session ${session.id}`);
            const pr = await gh.createFixPullRequest(owner, repo, {
              title: `AI AutoFix: ${patchesRaw.length} file(s)`,
              body: 'Automated multi-file patch (stub) generated by CodeMind. Review before merge.',
              head: branchName,
              base: project.defaultBranch || 'main',
              draft: true,
            });
            prUrl = pr.html_url;
          }
        }
      }
    } catch {
      prUrl = undefined; // treat failure as simulation fallback
    }
  }

  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      prUrl: prUrl || session.prUrl,
      fixesGenerated: JSON.stringify(patchesRaw),
    },
  });

  // Activity logs for successful validation & apply
  try {
    // Validation success (only log once per apply call)
    await prisma.activityLog.create({
      data: {
        projectId: session.projectId,
        userId: session.userId,
        activityType: 'AI_FIX_COMPLETED',
        entityType: 'ai_fix',
        entityId: session.id,
        description: prUrl ? 'AutoFix applied and PR created (draft)' : 'AutoFix simulated apply completed',
        impact: 'LOW',
        metadata: JSON.stringify({
          sessionId: session.id,
          changedFiles,
          validation,
          prUrl,
          branchName,
          simulated: simulate || !prUrl,
        }),
      },
    });
    if (prUrl) {
      await prisma.activityLog.create({
        data: {
          projectId: session.projectId,
          userId: session.userId,
          activityType: 'PR_CREATED',
          entityType: 'pr',
          entityId: prUrl,
          description: 'Draft PR created from AutoFix session',
          impact: 'LOW',
          metadata: JSON.stringify({ sessionId: session.id, prUrl, branchName, files: changedFiles }),
        },
      });
    }
  } catch { /* swallow log errors */ }

  return {
    sessionId: session.id,
    prUrl: prUrl,
    simulated: simulate || !prUrl,
    branchName,
    message: prUrl ? 'Patch(es) applied and PR created (draft).' : 'Patch application simulated (no PR token available).',
    appliedFiles: patchesRaw.map(p => p.filePath),
  };
}

/**
 * Regenerate a session: clears previously generated fixes so a new patch plan can be produced.
 * Rules:
 * - Only allowed if session not COMPLETED, CANCELLED, or currently in ANALYZING (no need) with no fixes yet.
 * - Sets status back to ANALYZING and clears fixesGenerated + analysisResult optionally re-triggers lightweight analysis.
 */
export async function regenerateAutoFix(sessionId: string): Promise<{ sessionId: string; status: string; message: string }> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (['COMPLETED','CANCELLED'].includes(session.status)) {
    throw new Error(`Cannot regenerate a session in status ${session.status}`);
  }
  // Determine regeneration count from analysisResult
  let regenCount = 0;
  try {
    const match = session.analysisResult?.match(/Regenerations:\s*(\d+)/);
    if (match) regenCount = parseInt(match[1], 10);
  } catch { regenCount = 0; }
  regenCount += 1;
  if (regenCount > 3) {
    throw new Error('Regeneration limit exceeded (max 3)');
  }
  const cleanedAnalysis = session.analysisResult ? session.analysisResult.replace(/Regenerations:\s*\d+/,'').trim() : '';
  const newAnalysis = [cleanedAnalysis, `Regenerations: ${regenCount}`].filter(Boolean).join('\n');
  await prisma.autoFixSession.update({
    where: { id: session.id },
    data: { fixesGenerated: null, status: 'ANALYZING', analysisResult: newAnalysis },
  });
  try {
    await prisma.activityLog.create({
      data: {
        projectId: session.projectId,
        userId: session.userId,
        activityType: 'AI_FIX_REGENERATED',
        entityType: 'ai_fix',
        entityId: session.id,
        description: 'AutoFix session regenerated (cleared patches)',
        impact: 'LOW',
        metadata: JSON.stringify({ sessionId: session.id, action: 'regenerate', regenCount }),
      },
    });
  } catch { /* ignore */ }
  return { sessionId: session.id, status: 'ANALYZING', message: 'Session reset; generate a new patch plan.' };
}

/**
 * Cancel a session: mark status CANCELLED. No further patch generation or apply allowed.
 */
export async function cancelAutoFix(sessionId: string): Promise<{ sessionId: string; status: string; message: string }> {
  const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (['COMPLETED','CANCELLED'].includes(session.status)) {
    return { sessionId: session.id, status: session.status, message: `Session already ${session.status.toLowerCase()}.` };
  }
  await prisma.autoFixSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
  try {
    await prisma.activityLog.create({
      data: {
        projectId: session.projectId,
        userId: session.userId,
        activityType: 'AI_FIX_CANCELLED',
        entityType: 'ai_fix',
        entityId: session.id,
        description: 'AutoFix session cancelled by user',
        impact: 'LOW',
        metadata: JSON.stringify({ sessionId: session.id, action: 'cancel' }),
      },
    });
  } catch { /* ignore */ }
  return { sessionId: session.id, status: 'CANCELLED', message: 'Session cancelled.' };
}
