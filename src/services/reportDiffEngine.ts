/**
 * G005 放射RIS系统 - 报告 Diff 引擎
 * 基于 diff-match-patch 的行级 + 词级对比
 */
import { diff_match_patch, type Diff } from 'diff-match-patch';

export interface DiffChunk {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

const dmp = new diff_match_patch();

function wordDiff(lineOld: string, lineNew: string): DiffChunk[] {
  const diffs: Diff[] = dmp.diff_main(lineOld, lineNew);
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({
    type: op === 1 ? 'added' : op === -1 ? 'removed' : 'unchanged',
    text,
  }));
}

export function computeDiff(oldText: string, newText: string): DiffChunk[] {
  if (oldText === newText) {
    return [{ type: 'unchanged', text: newText }];
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const lineDiffs: Diff[] = dmp.diff_main(
    oldLines.join('\n'),
    newLines.join('\n'),
  );
  dmp.diff_cleanupSemantic(lineDiffs);

  const result: DiffChunk[] = [];

  for (const [op, text] of lineDiffs) {
    if (op === 0) {
      result.push({ type: 'unchanged', text });
    } else if (op === 1) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (line) result.push({ type: 'added', text: line });
      }
    } else if (op === -1) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (line) result.push({ type: 'removed', text: line });
      }
    }
  }

  return result;
}

export function computeWordDiff(oldText: string, newText: string): DiffChunk[] {
  if (oldText === newText) {
    return [{ type: 'unchanged', text: newText }];
  }

  return wordDiff(oldText, newText);
}
