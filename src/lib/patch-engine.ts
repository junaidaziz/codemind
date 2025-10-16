/**
 * Minimal Patch Engine (Phase 3 Stub)
 * Generates and applies extremely simple unified diffs.
 * Future: expand to multi-hunk, context validation, conflict detection.
 */

export interface SimpleDiffPlan {
  filePath: string;
  originalContent: string;
  updatedContent: string;
  unifiedDiff: string; // minimal diff for display
}

export function buildHeaderCommentPatch(filePath: string, source: string): SimpleDiffPlan | null {
  // Avoid double insertion
  if (source.startsWith('// AI: AutoFix header')) return null;
  const header = `// AI: AutoFix header inserted for initial patch planning\n`;
  const updated = header + source;
  const context = parseInt(process.env.AUTOFIX_DIFF_CONTEXT || '', 10);
  const diff = createUnifiedDiffForTest(filePath, source, updated, isNaN(context) ? 3 : Math.max(0, context));
  return { filePath, originalContent: source, updatedContent: updated, unifiedDiff: diff };
}

export function createUnifiedDiffForTest(filePath: string, oldStr: string, newStr: string, context = 3): string {
  const a = oldStr.split('\n');
  const b = newStr.split('\n');
  if (oldStr === newStr) {
    return [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      '@@ -0,0 +0,0 @@',
      ' (no changes)'
    ].join('\n');
  }

  // Myers O(ND) diff to produce minimal edit script
  type Op = { type: 'equal' | 'add' | 'del'; line: string; aIndex: number; bIndex: number };
  function myers(aLines: string[], bLines: string[]): Op[] {
    const N = aLines.length; const M = bLines.length;
    const max = N + M;
    const trace: Map<number, number>[] = [];
    let v = new Map<number, number>();
    v.set(1, 0);
    let foundD = 0;
    outer: for (let d = 0; d <= max; d++) {
      const vNext = new Map<number, number>();
      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
          x = v.get(k + 1) ?? 0; // insertion
        } else {
          x = (v.get(k - 1) ?? 0) + 1; // deletion
        }
        let y = x - k;
        while (x < N && y < M && aLines[x] === bLines[y]) { x++; y++; }
        vNext.set(k, x);
        if (x >= N && y >= M) {
          trace.push(vNext);
          foundD = d;
          break outer;
        }
      }
      trace.push(vNext);
      v = vNext;
    }
    // Reconstruct path
    const ops: Op[] = [];
    let x = aLines.length; let y = bLines.length;
    for (let d = foundD; d >= 0; d--) {
      const k = x - y;
      let prevK: number;
      if (d === 0) {
        prevK = 0;
      } else if (k === -d || (k !== d && (trace[d - 1].get(k - 1) ?? -1) < (trace[d - 1].get(k + 1) ?? -1))) {
        prevK = k + 1; // insertion
      } else {
        prevK = k - 1; // deletion
      }
      const vPrev = trace[d - 1];
      const xStart = d === 0 ? 0 : (vPrev.get(prevK) ?? 0);
      const yStart = xStart - prevK;
      while (x > xStart && y > yStart) {
        ops.push({ type: 'equal', line: aLines[x - 1], aIndex: x - 1, bIndex: y - 1 });
        x--; y--;
      }
      if (d === 0) break;
      if (xStart < x) {
        // deletion
        ops.push({ type: 'del', line: aLines[x - 1], aIndex: x - 1, bIndex: y });
        x--;
      } else if (yStart < y) {
        // insertion
        ops.push({ type: 'add', line: bLines[y - 1], aIndex: x, bIndex: y - 1 });
        y--;
      }
    }
    return ops.reverse();
  }

  const ops = myers(a, b);

  // Group into hunks with context
  interface HunkOp { type: 'context' | 'add' | 'del'; line: string }
  interface Hunk { aStart: number; bStart: number; lines: HunkOp[] }
  const hunks: Hunk[] = [];
  let hunk: Hunk | null = null;
  const pushHunk = () => { if (hunk) { hunks.push(hunk); hunk = null; } };
  // Track current indices
  let aIndex = 0; let bIndex = 0;
  for (let idx = 0; idx < ops.length; idx++) {
    const o = ops[idx];
    if (o.type === 'equal') {
      if (hunk) {
        // inside hunk - trailing context management
        if (context > 0) {
          hunk.lines.push({ type: 'context', line: o.line });
          // lookahead for further changes within remaining context window
          let aheadChange = false;
          for (let look = 1; look <= context; look++) {
            const next = ops[idx + look];
            if (!next) break;
            if (next.type !== 'equal') { aheadChange = true; break; }
          }
          if (!aheadChange) pushHunk();
        } else {
          // zero context => close immediately after change block
          pushHunk();
        }
      }
      aIndex++; bIndex++;
    } else {
      // start hunk if none
      if (!hunk) {
        const startA = o.type === 'add' ? aIndex + 1 : aIndex + 1; // 1-based
        const startB = o.type === 'del' ? bIndex + 1 : bIndex + 1;
        hunk = { aStart: startA, bStart: startB, lines: [] };
        // leading context lines
        if (context > 0 && hunks.length === 0) {
          // attempt to include previous context from already processed equals (not stored). Skipped for simplicity.
        }
      }
      if (o.type === 'del') {
        hunk.lines.push({ type: 'del', line: o.line });
        aIndex++;
      } else if (o.type === 'add') {
        hunk.lines.push({ type: 'add', line: o.line });
        bIndex++;
      }
    }
  }
  pushHunk();

  // Add leading context for each hunk retrospectively
  if (context > 0) {
    // We regenerate with another pass using original lines for proper context around hunk boundaries
    for (const h of hunks) {
      const aStart0 = h.aStart - 1; // zero-based
      const preStart = Math.max(0, aStart0 - context);
      const leading: HunkOp[] = [];
      for (let i = preStart; i < aStart0; i++) {
        leading.push({ type: 'context', line: a[i] });
      }
      h.lines = [...leading, ...h.lines];
      // trailing context
      // compute last affected a index
      let lastA = aStart0;
      for (const l of h.lines) {
        if (l.type === 'del' || l.type === 'context') lastA++; // context & del advance in original file perspective
      }
      const trailStart = lastA; // already advanced one past last changed line
      for (let i = trailStart; i < Math.min(a.length, trailStart + context); i++) {
        h.lines.push({ type: 'context', line: a[i] });
      }
    }
  }

  // Merge overlapping context between consecutive hunks
  const merged: Hunk[] = [];
  for (const h of hunks) {
    if (!merged.length) { merged.push(h); continue; }
    const prev = merged[merged.length - 1];
    // crude heuristic: if original line ranges overlap or are adjacent within context*2, merge
    const prevEndA = prev.aStart - 1 + prev.lines.filter(l => l.type !== 'add').length; // approximate span in original
    if (h.aStart <= prevEndA + context * 2) {
      prev.lines.push(...h.lines);
    } else {
      merged.push(h);
    }
  }

  // Build unified diff
  interface Count { added: number; deleted: number; }
  function buildHunk(h: Hunk): { text: string; count: Count } {
    let aLen = 0, bLen = 0, added = 0, deleted = 0;
    for (const l of h.lines) {
      if (l.type === 'context') { aLen++; bLen++; }
      else if (l.type === 'add') { bLen++; added++; }
      else if (l.type === 'del') { aLen++; deleted++; }
    }
    const range = `@@ -${h.aStart},${aLen} +${h.bStart},${bLen} @@`;
    const body = h.lines.map(l => l.type === 'context' ? ` ${l.line}` : (l.type === 'add' ? `+${l.line}` : `-${l.line}`));
    return { text: [range, ...body].join('\n'), count: { added, deleted } };
  }
  const header = [`--- a/${filePath}`, `+++ b/${filePath}`];
  const maxHunks = parseInt(process.env.AUTOFIX_DIFF_MAX_HUNKS || '20', 10) || 20;
  const maxBytes = parseInt(process.env.AUTOFIX_DIFF_MAX_BYTES || '25000', 10) || 25000;
  const built = merged.map(buildHunk);
  const diffBody: string[] = []; let usedBytes = header.join('\n').length; let includedHunks = 0; let totalAdded = 0; let totalDeleted = 0;
  for (const h of built) {
    const projectedSize = usedBytes + h.text.length + 1; // + newline
    if (includedHunks >= maxHunks || projectedSize > maxBytes) break;
    diffBody.push(h.text); usedBytes = projectedSize; includedHunks++; totalAdded += h.count.added; totalDeleted += h.count.deleted;
  }
  const truncated = includedHunks < built.length;
  if (truncated) {
    diffBody.push(`# Diff truncated: showed ${includedHunks}/${built.length} hunks, +${totalAdded} -${totalDeleted} so far.`);
  } else {
    // accumulate totals if not truncated
    for (let i = includedHunks; i < built.length; i++) { totalAdded += built[i].count.added; totalDeleted += built[i].count.deleted; }
  }
  return [...header, ...diffBody].join('\n');
}
