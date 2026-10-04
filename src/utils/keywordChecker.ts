// ============================================================
// G005 放射科RIS系统 v1.0.1 - 关键字纠错引擎
// Phase R1：左右/上下、阴/阳、否定词、关键病灶词缺失
// 规则数据从 ./keywordRules 引入
// ============================================================

import {
  ANATOMY_PAIR_RULES,
  POS_NEG_WORD_RULES,
  LESION_KEYWORDS_BY_MODALITY,
  NEGATION_WORDS,
  PUNCTUATION_RULES,
  STANDARD_FORMAT_RULES,
  type KeywordRule,
  type KeywordCheckResult,
  type KeywordIssue,
  type IssueSeverity,
} from '../data/keywordRules';

export interface KeywordCheckInput {
  text: string;
  modality?: string;          // CT / MR / DR / 乳腺钼靶 etc.
  bodyPart?: string;          // 胸部 / 腹部 / 头颅 etc.
  hasCriticalFinding?: boolean;
  hasImpression?: boolean;    // 是否包含诊断意见段落
  hasFindings?: boolean;      // 是否包含检查所见段落
}

export interface KeywordCheckOutput {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: KeywordIssue[];
  score: number;              // 0-100
  passed: boolean;            // score >= 80
}

/**
 * 主入口 - 执行全量关键字检查
 */
export function checkKeywords(input: KeywordCheckInput): KeywordCheckOutput {
  const issues: KeywordIssue[] = [];

  // 1. 解剖方位左右/上下/前后一致性
  issues.push(...checkAnatomyPair(input.text));

  // 2. 阴/阳性矛盾检测
  issues.push(...checkPositiveNegative(input.text));

  // 3. 否定词歧义（"未见异常" vs "未见明显异常"）
  issues.push(...checkNegationWords(input.text));

  // 4. 标点/格式规范
  issues.push(...checkPunctuation(input.text));

  // 5. 标准格式（数值/单位）
  issues.push(...checkStandardFormat(input.text));

  // 6. 病灶关键词缺失（按 modality + bodyPart）
  if (input.hasFindings && input.modality) {
    issues.push(...checkLesionKeywords(input.text, input.modality, input.bodyPart));
  }

  // 7. 危急值报告必须包含关键提示
  if (input.hasCriticalFinding) {
    issues.push(...checkCriticalValueFlags(input.text));
  }

  // 8. 诊断意见段落完整性
  if (input.hasImpression) {
    issues.push(...checkImpressionCompleteness(input.text));
  }

  // 统计
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // 计算得分（错误扣 20，警告扣 8，提示扣 2）
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 8 - infoCount * 2);

  return {
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
    issues,
    score,
    passed: score >= 80,
  };
}

/**
 * 1. 解剖方位一致性（左右 / 上下 / 前后）
 * 例：报告中"右侧"和"左侧"同时出现且指向同一解剖结构，提示矛盾
 */
function checkAnatomyPair(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  for (const rule of ANATOMY_PAIR_RULES) {
    const leftCount = (text.match(new RegExp(rule.left, 'g')) || []).length;
    const rightCount = (text.match(new RegExp(rule.right, 'g')) || []).length;

    if (leftCount > 0 && rightCount > 0) {
      issues.push({
        id: `anatomy-${rule.id}`,
        ruleId: rule.id,
        severity: rule.severity,
        category: 'anatomy',
        message: rule.message,
        suggestion: rule.suggestion,
        matched: `${rule.leftLabel} × ${leftCount} / ${rule.rightLabel} × ${rightCount}`,
        position: text.indexOf(rule.left),
      });
    }
  }

  return issues;
}

/**
 * 2. 阴/阳性矛盾
 * 例：同段落出现"未见"和"可见"且描述同一结构
 */
function checkPositiveNegative(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  for (const rule of POS_NEG_WORD_RULES) {
    const negCount = (text.match(new RegExp(rule.negative, 'g')) || []).length;
    const posCount = (text.match(new RegExp(rule.positive, 'g')) || []).length;

    if (negCount > 0 && posCount > 0) {
      issues.push({
        id: `posneg-${rule.id}`,
        ruleId: rule.id,
        severity: rule.severity,
        category: 'logic',
        message: rule.message,
        suggestion: rule.suggestion,
        matched: `"${rule.negativeLabel}" × ${negCount} 与 "${rule.positiveLabel}" × ${posCount} 同时出现`,
        position: text.indexOf(rule.negative),
      });
    }
  }

  return issues;
}

/**
 * 3. 否定词歧义
 * 单独使用"未见"过于绝对，应配合"明显"等修饰词
 */
function checkNegationWords(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  for (const word of NEGATION_WORDS) {
    const regex = new RegExp(`(?<![\\u4e00-\\u9fa5])${word}(?![\\u4e00-\\u9fa5]{0,3}(?:明显|明确|异常|占位))`, 'g');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      issues.push({
        id: `negation-${word}`,
        ruleId: `negation-${word}`,
        severity: 'info',
        category: 'logic',
        message: `"${word}" 用法欠精确，建议改为"${word}明显..."等修饰词`,
        suggestion: `建议改为"${word}明显异常"或"${word}明确异常"`,
        matched: `${word} × ${matches.length}`,
        position: text.indexOf(word),
      });
    }
  }

  return issues;
}

/**
 * 4. 标点符号规范
 */
function checkPunctuation(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  for (const rule of PUNCTUATION_RULES) {
    const matches = text.match(rule.pattern);
    if (matches && matches.length > 0) {
      issues.push({
        id: `punct-${rule.id}`,
        ruleId: rule.id,
        severity: rule.severity,
        category: 'punctuation',
        message: rule.message,
        suggestion: rule.suggestion,
        matched: matches.slice(0, 3).join('、'),
        position: text.indexOf(matches[0]),
      });
    }
  }

  return issues;
}

/**
 * 5. 标准格式（数值/单位）
 * 例：温度单位、长度单位、CT 值
 */
function checkStandardFormat(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  for (const rule of STANDARD_FORMAT_RULES) {
    const matches = text.match(rule.pattern);
    if (matches && matches.length > 0) {
      // 检查是否包含推荐的标准格式
      const hasStandard = rule.standardForm && text.includes(rule.standardForm);
      if (!hasStandard) {
        issues.push({
          id: `format-${rule.id}`,
          ruleId: rule.id,
          severity: 'info',
          category: 'format',
          message: rule.message,
          suggestion: rule.standardForm ? `推荐写法：${rule.standardForm}` : rule.suggestion,
          matched: matches.slice(0, 3).join('、'),
          position: text.indexOf(matches[0]),
        });
      }
    }
  }

  return issues;
}

/**
 * 6. 病灶关键词缺失检测
 * 例：CT 胸部报告应至少包含"肺"、"纵隔"等关键结构
 */
function checkLesionKeywords(text: string, modality: string, bodyPart?: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  // 按 modality 查找应包含的关键词
  const expectedKeywords = LESION_KEYWORDS_BY_MODALITY[modality] || [];
  for (const kw of expectedKeywords) {
    if (bodyPart && !kw.bodyParts.includes(bodyPart) && kw.bodyParts.length > 0) {
      continue;
    }
    if (!text.includes(kw.keyword)) {
      issues.push({
        id: `lesion-${modality}-${kw.keyword}`,
        ruleId: `lesion-${modality}-${kw.keyword}`,
        severity: kw.severity,
        category: 'completeness',
        message: kw.message,
        suggestion: kw.suggestion,
        matched: '未找到',
        position: -1,
      });
    }
  }

  return issues;
}

/**
 * 7. 危急值报告关键提示
 */
function checkCriticalValueFlags(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  const requiredFlags = ['危急值', '紧急', '立即', '尽快'];
  const hasFlag = requiredFlags.some(flag => text.includes(flag));

  if (!hasFlag) {
    issues.push({
      id: 'critical-no-flag',
      ruleId: 'critical-no-flag',
      severity: 'warning',
      category: 'critical',
      message: '危急值报告应在报告中明确标注"危急值"、"紧急"、"立即"或"尽快"等提示',
      suggestion: '在报告开头添加"危急值"标识',
      matched: '未找到',
      position: -1,
    });
  }

  return issues;
}

/**
 * 8. 诊断意见段落完整性
 */
function checkImpressionCompleteness(text: string): KeywordIssue[] {
  const issues: KeywordIssue[] = [];

  // 意见段应至少包含"考虑"、"提示"、"建议"或"诊断"
  const opinionKeywords = ['考虑', '提示', '建议', '诊断', '符合', '不除外', '可能为'];
  const hasOpinion = opinionKeywords.some(kw => text.includes(kw));

  if (!hasOpinion) {
    issues.push({
      id: 'impression-incomplete',
      ruleId: 'impression-incomplete',
      severity: 'warning',
      category: 'completeness',
      message: '诊断意见段落缺少关键判断词',
      suggestion: `请使用"考虑"、"提示"、"建议"或"诊断"等判断词。当前文本似乎只描述了所见。`,
      matched: '未找到',
      position: -1,
    });
  }

  return issues;
}

/**
 * 严重程度排序
 */
export function sortIssuesBySeverity(issues: KeywordIssue[]): KeywordIssue[] {
  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * 按类别分组
 */
export function groupIssuesByCategory(issues: KeywordIssue[]): Record<string, KeywordIssue[]> {
  return issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category]!.push(issue);
    return acc;
  }, {} as Record<string, KeywordIssue[]>);
}

/**
 * 高亮关键字问题（返回包含高亮标记的 React 节点数组）
 */
export function highlightIssues(text: string, issues: KeywordIssue[]): Array<{ text: string; hasIssue: boolean }> {
  // 简化版本：按 position 排序，标记有问题位置
  const sortedIssues = issues.filter(i => i.position >= 0).sort((a, b) => a.position - b.position);
  if (sortedIssues.length === 0) {
    return [{ text, hasIssue: false }];
  }

  const result: Array<{ text: string; hasIssue: boolean }> = [];
  let cursor = 0;

  for (const issue of sortedIssues) {
    if (issue.position > cursor) {
      result.push({ text: text.substring(cursor, issue.position), hasIssue: false });
    }
    const nextPos = sortedIssues[sortedIssues.indexOf(issue) + 1]?.position ?? text.length;
    result.push({ text: text.substring(issue.position, Math.min(nextPos, issue.position + issue.matched.length)), hasIssue: true });
    cursor = Math.min(nextPos, issue.position + issue.matched.length);
  }

  if (cursor < text.length) {
    result.push({ text: text.substring(cursor), hasIssue: false });
  }

  return result;
}

// 命名导出兼容
export { sortIssuesBySeverity as _sortIssuesBySeverity, groupIssuesByCategory as _groupIssuesByCategory };
export type { KeywordRule, KeywordCheckResult, KeywordIssue, IssueSeverity };
