import { createUnifiedDiffForTest } from '../lib/patch-engine';

const file = 'snapshot.ts';

describe('Diff snapshots', () => {
  it('single insertion snapshot', () => {
    const oldStr = 'a\nb\nc';
    const newStr = 'a\nX\nb\nc';
    const diff = createUnifiedDiffForTest(file, oldStr, newStr, 1);
    expect(diff).toMatchSnapshot();
  });

  it('multi distant edits snapshot', () => {
    const oldStr = Array.from({length:15}, (_,i)=>`L${i}`).join('\n');
    const lines = oldStr.split('\n');
    lines[2] = lines[2] + '_mod';
    lines[11] = lines[11] + '_mod';
    const diff = createUnifiedDiffForTest(file, oldStr, lines.join('\n'), 1);
    expect(diff).toMatchSnapshot();
  });
});
