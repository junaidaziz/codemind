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
  const diff = createUnifiedDiff(filePath, source, updated);
  return { filePath, originalContent: source, updatedContent: updated, unifiedDiff: diff };
}

function createUnifiedDiff(filePath: string, oldStr: string, newStr: string, context = 3): string {
  const a = oldStr.split('\n');
  const b = newStr.split('\n');
  // Fast path identical
  if (oldStr === newStr) {
    return [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      '@@ -0,0 +0,0 @@',
      ' (no changes)'
    ].join('\n');
  }

  // LCS-based diff (simple O(n*m) for now; acceptable for small patch stubs)
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1; else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Array<{ type: 'equal' | 'add' | 'del'; line: string; aIndex: number; bIndex: number }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', line: a[i], aIndex: i, bIndex: j });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', line: a[i], aIndex: i, bIndex: j });
      i++;
    } else {
      ops.push({ type: 'add', line: b[j], aIndex: i, bIndex: j });
      j++;
    }
  }
  while (i < n) { ops.push({ type: 'del', line: a[i], aIndex: i, bIndex: m }); i++; }
  while (j < m) { ops.push({ type: 'add', line: b[j], aIndex: n, bIndex: j }); j++; }

  // Group into hunks with context lines
  interface HunkOp { type: 'context' | 'add' | 'del'; line: string }
  interface Hunk { aStart: number; aLen: number; bStart: number; bLen: number; lines: HunkOp[] }
  const hunks: Hunk[] = [];
  let hunk: Hunk | null = null;
  let aCursor = 0, bCursor = 0;
  const flush = () => { if (hunk) { hunks.push(hunk); hunk = null; } };

  for (let k = 0; k < ops.length; k++) {
    const o = ops[k];
    if (o.type === 'equal') {
      if (hunk) {
        // inside hunk, add context or close if beyond trailing context
        if (hunk.lines.filter(l => l.type !== 'context').length === 0) {
          // haven't added any real changes yet, continue collecting leading context (truncate if huge)
          hunk.lines.push({ type: 'context', line: o.line });
          aCursor++; bCursor++;
        } else if (context > 0) {
          hunk.lines.push({ type: 'context', line: o.line });
          aCursor++; bCursor++;
          // lookahead to see if we should close hunk
          let lookAheadChanges = 0;
          for (let t = k + 1; t < Math.min(ops.length, k + 1 + context); t++) {
            if (ops[t].type !== 'equal') { lookAheadChanges++; break; }
          }
          if (lookAheadChanges === 0) flush();
        }
      }
      else {
        // not in a hunk, but keep sliding cursors
        aCursor++; bCursor++;
      }
    } else {
      // change op
      if (!hunk) {
        // start new hunk with preceding context
        const aStart = o.aIndex + 1; // 1-based
        const bStart = o.bIndex + 1; // 1-based
        hunk = { aStart, aLen: 0, bStart, bLen: 0, lines: [] };
        // add up to context lines of previous equals
        let back = k - 1; let backContext = 0;
        while (back >= 0 && backContext < context && ops[back].type === 'equal') {
          hunk.lines.unshift({ type: 'context', line: ops[back].line });
          back--; backContext++;
        }
      }
      if (o.type === 'del') { hunk.lines.push({ type: 'del', line: o.line }); }
      if (o.type === 'add') { hunk.lines.push({ type: 'add', line: o.line }); }
      aCursor += o.type !== 'add' ? 1 : 0;
      bCursor += o.type !== 'del' ? 1 : 0;
      hunk.aLen = (aCursor - hunk.aStart + 1);
      hunk.bLen = (bCursor - hunk.bStart + 1);
    }
  }
  flush();

  const header = [`--- a/${filePath}`, `+++ b/${filePath}`];
  const hunkStrings = hunks.map(h => {
    // recompute lengths precisely from lines
    const aRemoved = h.lines.filter(l => l.type === 'del').length;
    const aContext = h.lines.filter(l => l.type === 'context').length;
    const aLen = aRemoved + aContext;
    const bAdded = h.lines.filter(l => l.type === 'add').length;
    const bContext = aContext; // context symmetric
    const bLen = bAdded + bContext;
    const range = `@@ -${h.aStart},${aLen} +${h.bStart},${bLen} @@`;
    const body = h.lines.map(l => {
      if (l.type === 'context') return ` ${l.line}`;
      if (l.type === 'add') return `+${l.line}`;
      return `-${l.line}`;
    });
    return [range, ...body].join('\n');
  });
  return [...header, ...hunkStrings].join('\n');
}
