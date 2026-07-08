/**
 * G005 放射RIS系统 - 关键词冲突检测器
 * 报告内容语义冲突检测
 */

export interface Conflict {
  type: string;
  message: string;
  positions: { start: number; end: number }[];
}

interface Rule {
  type: string;
  message: string;
  patterns: [string, string];
}

const RULES: Rule[] = [
  {
    type: 'left_right_conflict',
    message: '左右混用："左肺" 和 "右肺" 同时出现，请确认检查部位',
    patterns: ['左肺', '右肺'],
  },
  {
    type: 'self_contradiction',
    message: '自我矛盾："未见异常" 和 "可见占位" 不可同时出现',
    patterns: ['未见异常', '可见占位'],
  },
  {
    type: 'negation_conflict',
    message: '阴阳性冲突：前文描述"未见明确占位"但结论出现"占位性病变"',
    patterns: ['未见明确占位', '占位性病变'],
  },
];

function findAllPositions(text: string, pattern: string): { start: number; end: number }[] {
  const positions: { start: number; end: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const idx = text.indexOf(pattern, start);
    if (idx === -1) break;
    positions.push({ start: idx, end: idx + pattern.length });
    start = idx + 1;
  }
  return positions;
}

export function detectConflicts(text: string): Conflict[] {
  if (!text) return [];

  const conflicts: Conflict[] = [];

  for (const rule of RULES) {
    const [patA, patB] = rule.patterns;
    const posA = findAllPositions(text, patA);
    const posB = findAllPositions(text, patB);

    if (posA.length > 0 && posB.length > 0) {
      conflicts.push({
        type: rule.type,
        message: rule.message,
        positions: [...posA, ...posB],
      });
    }
  }

  return conflicts;
}
