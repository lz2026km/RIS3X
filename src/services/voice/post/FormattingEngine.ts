/**
 * G005 放射RIS系统 v3.0.6.5 - 自动标点 / 格式化引擎
 * 20 升级点:规则管线 / 医学术语标准化 / 数字转换 / 标点恢复
 */

import type { FormattingContext, FormattingRule, FormattedResult } from '../../../types/voice';

const DEFAULT_RULES: FormattingRule[] = [
  // 数字 + 单位的医学标准化
  { id: 'r-mm', pattern: /(\d+)\s*(?:mm|毫米|mm)\b/gi, replacement: '$1mm', description: '统一毫米单位 mm', category: 'unit', enabled: true },
  { id: 'r-cm', pattern: /(\d+(?:\.\d+)?)\s*(?:cm|厘米)\b/gi, replacement: '$1cm', description: '统一厘米单位 cm', category: 'unit', enabled: true },
  { id: 'r-hu', pattern: /(\d+)\s*(?:HU|hu|亨氏单位)\b/gi, replacement: '$1HU', description: '统一 CT 值单位 HU', category: 'unit', enabled: true },
  { id: 'r-multiplication', pattern: /(\d+)\s*[xX×乘]\s*(\d+)/g, replacement: '$1×$2', description: '统一乘号 ×', category: 'numeric', enabled: true },
  { id: 'r-by', pattern: /(\d+)\s*乘\s*(\d+)/g, replacement: '$1×$2', description: '乘 → ×', category: 'numeric', enabled: true },
  // 医学术语
  { id: 'r-ggn', pattern: /(磨玻璃\s*密度\s*影|磨玻璃\s*影)/g, replacement: '磨玻璃密度影', description: '统一磨玻璃影', category: 'medical', enabled: true },
  { id: 'r-ggo', pattern: /GGO/g, replacement: 'GGO', description: 'GGO 保持', category: 'medical', enabled: true },
  { id: 'r-dwi', pattern: /(DWI|弥散加权)/g, replacement: 'DWI', description: 'DWI', category: 'medical', enabled: true },
  { id: 'r-t1wi', pattern: /(T1\s*WI|T1\s*加权|T1加权像)/gi, replacement: 'T1WI', description: 'T1WI', category: 'medical', enabled: true },
  { id: 'r-t2wi', pattern: /(T2\s*WI|T2\s*加权|T2加权像)/gi, replacement: 'T2WI', description: 'T2WI', category: 'medical', enabled: true },
  { id: 'r-bi-rads', pattern: /BI[-\s]?RADS/gi, replacement: 'BI-RADS', description: 'BI-RADS', category: 'medical', enabled: true },
  { id: 'r-ti-rads', pattern: /TI[-\s]?RADS/gi, replacement: 'TI-RADS', description: 'TI-RADS', category: 'medical', enabled: true },
  { id: 'r-lung-rads', pattern: /Lung[-\s]?RADS/gi, replacement: 'Lung-RADS', description: 'Lung-RADS', category: 'medical', enabled: true },
  { id: 'r-pi-rads', pattern: /PI[-\s]?RADS/gi, replacement: 'PI-RADS', description: 'PI-RADS', category: 'medical', enabled: true },
  { id: 'r-cad-rads', pattern: /CAD[-\s]?RADS/gi, replacement: 'CAD-RADS', description: 'CAD-RADS', category: 'medical', enabled: true },
  { id: 'r-li-rads', pattern: /LI[-\s]?RADS/gi, replacement: 'LI-RADS', description: 'LI-RADS', category: 'medical', enabled: true },
  { id: 'r-cdfi', pattern: /CDFI/gi, replacement: 'CDFI', description: 'CDFI', category: 'medical', enabled: true },
  // 标点
  { id: 'r-comma', pattern: /,\s*$/gm, replacement: '，', description: '末尾英文逗号 → 中文逗号', category: 'punctuation', enabled: true },
  { id: 'r-period', pattern: /\.\s*$/gm, replacement: '。', description: '末尾英文句号 → 中文句号', category: 'punctuation', enabled: true },
  { id: 'r-colon', pattern: /:\s*/g, replacement: '：', description: '冒号 → 中文冒号', category: 'punctuation', enabled: true },
  { id: 'r-semicolon', pattern: /;\s*/g, replacement: '；', description: '分号 → 中文分号', category: 'punctuation', enabled: true },
  { id: 'r-question', pattern: /\?\s*/g, replacement: '？', description: '问号 → 中文问号', category: 'punctuation', enabled: true },
  { id: 'r-exclamation', pattern: /!\s*/g, replacement: '！', description: '感叹号 → 中文感叹号', category: 'punctuation', enabled: true },
  // 空格
  { id: 'r-double-space', pattern: / {2,}/g, replacement: ' ', description: '压缩多余空格', category: 'spacing', enabled: true },
  { id: 'r-sp-before-punct', pattern: /\s+([。，！？：；])/g, replacement: '$1', description: '标点前空格去除', category: 'spacing', enabled: true },
  // 大小写
  { id: 'r-sentence-cap', pattern: /(?:^|[。！？]\s+)([a-z])/g, replacement: (_m: string, c: string) => c.toUpperCase(), description: '英文句首大写', category: 'case', enabled: true },
];

export class FormattingEngine {
  private rules: FormattingRule[] = [...DEFAULT_RULES];
  private context: FormattingContext;

  constructor(context: Partial<FormattingContext> = {}) {
    this.context = {
      autoPunctuation: context.autoPunctuation ?? true,
      strategy: context.strategy ?? 'auto',
      medicalNormalization: context.medicalNormalization ?? true,
      numberToChinese: context.numberToChinese ?? false,
      unitNormalization: context.unitNormalization ?? true,
      sentenceSpacing: context.sentenceSpacing ?? true,
      customRules: context.customRules ?? [],
    };
    this.context.customRules.forEach((r: any) => this.rules.push(r));
  }

  setContext(patch: Partial<FormattingContext>): void {
    this.context = { ...this.context, ...patch };
  }

  getContext(): FormattingContext {
    return { ...this.context };
  }

  addRule(rule: FormattingRule): void {
    this.rules.push(rule);
  }

  listRules(): FormattingRule[] {
    return [...this.rules];
  }

  toggleRule(id: string, enabled: boolean): void {
    this.rules = this.rules.map((r) => (r.id === id ? { ...r, enabled } : r));
  }

  /**
   * 主入口
   */
  format(input: string, options: { autoPunct?: boolean } = {}): FormattedResult {
    const start = performance.now();
    const autoPunct = options.autoPunct ?? this.context.autoPunctuation;
    let text = input;
    const applied: { ruleId: string; before: string; after: string }[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.category === 'medical' && !this.context.medicalNormalization) continue;
      if (rule.category === 'unit' && !this.context.unitNormalization) continue;
      const next = text.replace(rule.pattern, (...args: unknown[]) => {
        if (typeof rule.replacement === 'function') return (rule.replacement as (...a: unknown[]) => string)(...args);
        return rule.replacement;
      });
      if (next !== text) {
        applied.push({ ruleId: rule.id, before: text.slice(0, 80), after: next.slice(0, 80) });
        text = next;
      }
    }

    if (autoPunct && this.context.strategy === 'auto') {
      const sentences = this.splitSentences(text);
      const punctuated = sentences.map((s) => this.ensurePunctuation(s)).join('');
      if (punctuated !== text) {
        text = punctuated;
      }
    }

    if (this.context.sentenceSpacing) {
      text = text.replace(/([。！？])\s*([^\s])/g, '$1 $2');
    }

    return {
      original: input,
      formatted: text,
      appliedRules: applied,
      punctuation: this.extractPunctuation(text),
      durationMs: performance.now() - start,
    };
  }

  /**
   * 自动给句子补标点
   */
  private ensurePunctuation(sentence: string): string {
    const s = sentence.trim();
    if (!s) return s;
    if (/[。！？，：；,.\?:;:!?]$/.test(s)) return s;
    if (this.isLikelyList(s)) return s + '，';
    if (this.isLikelyQuestion(s)) return s + '？';
    if (this.isLikelyExclamation(s)) return s + '！';
    return s + '。';
  }

  private splitSentences(text: string): string[] {
    return text.split(/(?<=[。！？\n])/);
  }

  private isLikelyList(s: string): boolean {
    return /[,，、；]\s*[^。]*$/.test(s) || /见|显示|可见|发现|提示/.test(s.slice(-8));
  }

  private isLikelyQuestion(s: string): boolean {
    return /(吗|呢|？|?)$/.test(s) || /是否|能否|是不是|有没有/.test(s);
  }

  private isLikelyExclamation(s: string): boolean {
    return /(!|！)$/.test(s);
  }

  private extractPunctuation(text: string): { char: string; position: number; confidence: number }[] {
    const out: { char: string; position: number; confidence: number }[] = [];
    const pattern = /[。，！？：；,.\?:;!]/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      out.push({ char: m[0], position: m.index, confidence: 0.95 });
    }
    return out;
  }
}

export const formattingEngine = new FormattingEngine();
export { DEFAULT_RULES };
