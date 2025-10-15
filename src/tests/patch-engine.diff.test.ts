import { createUnifiedDiffForTest } from '../lib/patch-engine';

/**
 * Diff Engine Tests (Myers) covering:
 * 1. No-op (identical files)
 * 2. Single insertion (header patch style)
 * 3. Multiple separated changes => multiple hunks
 * 4. Truncation by max hunks / bytes (override env)
 */

describe('createUnifiedDiffForTest', () => {
  const file = 'sample.ts';

  it('produces no-op diff marker when identical', () => {
    const content = 'line1\nline2';
    const diff = createUnifiedDiffForTest(file, content, content, 2);
    expect(diff).toContain(' (no changes)');
  });

  it('captures single insertion with context', () => {
    const oldStr = ['a','b','c'].join('\n');
    const newStr = ['a','INSERT','b','c'].join('\n');
    const diff = createUnifiedDiffForTest(file, oldStr, newStr, 1);
    expect(diff).toContain('@@');
    expect(diff).toContain('+INSERT');
  });

  it('creates multiple hunks for distant changes', () => {
    const oldStr = Array.from({length:20}, (_,i)=>`L${i+1}`).join('\n');
    const newLines = oldStr.split('\n');
    newLines[1] = 'L2_mod';
    newLines[15] = 'L16_mod';
    const newStr = newLines.join('\n');
    const diff = createUnifiedDiffForTest(file, oldStr, newStr, 1);
    const hunkCount = diff.split('\n').filter(l => l.startsWith('@@')).length;
    expect(hunkCount).toBeGreaterThanOrEqual(2);
    expect(diff).toContain('-L2');
    expect(diff).toContain('+L2_mod');
    expect(diff).toContain('-L16');
    expect(diff).toContain('+L16_mod');
  });

  it('truncates when exceeding max hunks', () => {
    const oldStr = Array.from({length:120}, (_,i)=>`L${i}`).join('\n');
    const newLines = oldStr.split('\n');
    // modify many spaced lines
    for (let i=0;i<50;i+=5) newLines[i] = newLines[i] + '_m';
    const newStr = newLines.join('\n');
    process.env.AUTOFIX_DIFF_MAX_HUNKS = '3';
    const diff = createUnifiedDiffForTest(file, oldStr, newStr, 0);
    const hunkCount = diff.split('\n').filter(l => l.startsWith('@@')).length;
    expect(hunkCount).toBeLessThanOrEqual(3);
    expect(diff).toMatch(/Diff truncated/);
    delete process.env.AUTOFIX_DIFF_MAX_HUNKS;
  });
});
