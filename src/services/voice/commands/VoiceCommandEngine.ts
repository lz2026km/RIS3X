/**
 * G005 放射RIS系统 v3.0.6.5 - 语音命令识别引擎
 * 40 升级点:命令匹配 / 上下文感知 / 优先级 / 拼音 fallback
 */

import { VOICE_COMMANDS } from '../../../data/voice/voiceCommands';
import type {
  VoiceCommandDefinition,
  VoiceCommandMatch,
  VoiceCommandContext,
  VoiceCommandAction,
  VoiceCommandCategory,
} from '../../../types/voice';

const PUNCTUATION_MAP: Record<string, string> = {
  句号: '。', period: '。',
  逗号: '，', comma: '，',
  冒号: '：', colon: '：',
  分号: '；', semicolon: '；',
  问号: '？', question: '？',
  引号: '"', quote: '"',
  单引号: '\'', singlequote: '\'',
};

const SNIPPET_MAP: Record<string, string> = {
  左肺: '左肺',
  右肺: '右肺',
  双肺: '双肺',
  全肺: '双肺',
  未见异常: '未见明显异常',
  未见明显异常: '未见明显异常',
  建议随访: '建议随访',
  建议随诊: '建议随访',
  建议复查: '建议复查',
  结合临床: '结合临床',
  必要时: '必要时',
  进一步检查: '进一步检查',
};

const FIELD_MAP: Record<string, { field: string; section: VoiceCommandContext['currentSection'] }> = {
  '影像所见': { field: 'findings', section: 'findings' },
  '所见': { field: 'findings', section: 'findings' },
  '诊断印象': { field: 'impression', section: 'impression' },
  '印象': { field: 'impression', section: 'impression' },
  '诊断': { field: 'diagnosis', section: 'diagnosis' },
  '建议': { field: 'recommendation', section: 'recommendation' },
  '推荐': { field: 'recommendation', section: 'recommendation' },
};

const TEMPLATE_MAP: Record<string, string> = {
  '正常模板': 'tpl-normal',
  '正常': 'tpl-normal',
  '正常报告': 'tpl-normal',
  '急诊模板': 'tpl-emergency',
  '急诊': 'tpl-emergency',
  '急诊报告': 'tpl-emergency',
  '随访模板': 'tpl-followup',
  '随访': 'tpl-followup',
};

interface MatchResult {
  match: VoiceCommandMatch | null;
  consumedText: string;
}

export class VoiceCommandEngine {
  private commandIndex: Map<string, VoiceCommandDefinition> = new Map();
  private aliasesIndex: Map<string, VoiceCommandDefinition> = new Map();
  private pinyinMap: Map<string, VoiceCommandDefinition> = new Map();
  private context: VoiceCommandContext = {
    availableFields: ['findings', 'impression', 'diagnosis', 'recommendation'],
    availableTemplates: ['tpl-normal', 'tpl-emergency', 'tpl-followup'],
    language: 'zh-CN',
  };
  private recentCommands: { command: VoiceCommandDefinition; ts: number }[] = [];
  private maxRecent = 10;

  constructor() {
    this.rebuild();
  }

  private rebuild(): void {
    this.commandIndex.clear();
    this.aliasesIndex.clear();
    this.pinyinMap.clear();
    VOICE_COMMANDS.filter((c: VoiceCommandDefinition) => c.enabled).forEach((c: VoiceCommandDefinition) => {
      this.commandIndex.set(c.command, c);
      this.commandIndex.set(c.english.toLowerCase(), c);
      c.aliases.forEach((a: string) => this.aliasesIndex.set(a, c));
    });
  }

  setContext(ctx: Partial<VoiceCommandContext>): void {
    this.context = { ...this.context, ...ctx };
  }

  getContext(): VoiceCommandContext {
    return { ...this.context };
  }

  /**
   * 核心:从一段识别文本中提取命令
   */
  recognize(text: string): VoiceCommandMatch[] {
    if (!text || !text.trim()) return [];
    const matches: VoiceCommandMatch[] = [];
    const remaining = text.trim();
    const ts = Date.now();

    // 1. 完全匹配(优先)
    const exact = this.commandIndex.get(remaining);
    if (exact) {
      matches.push({ command: exact, matchedPhrase: remaining, confidence: 0.99, timestamp: ts, payload: exact.customPayload });
      this.recordRecent(exact);
      return matches;
    }

    // 2. 别名匹配
    const aliased = this.aliasesIndex.get(remaining);
    if (aliased) {
      matches.push({ command: aliased, matchedPhrase: remaining, confidence: 0.95, timestamp: ts, payload: aliased.customPayload });
      this.recordRecent(aliased);
      return matches;
    }

    // 3. 多命令组合识别
    let workText = remaining;
    let guard = 0;
    while (workText.length > 0 && guard < 10) {
      guard++;
      const result = this.matchSingleCommand(workText);
      if (result.match) {
        matches.push(result.match);
        workText = result.consumedText;
      } else {
        break;
      }
    }

    // 4. 模糊匹配(单字符 / 部分匹配)
    if (matches.length === 0 && remaining.length <= 4) {
      const fuzzy = this.fuzzyMatch(remaining);
      if (fuzzy) {
        matches.push({ command: fuzzy, matchedPhrase: remaining, confidence: 0.7, timestamp: ts, payload: fuzzy.customPayload });
        this.recordRecent(fuzzy);
      }
    }

    return matches;
  }

  /**
   * 处理命令 + 输出对应动作
   */
  apply(matches: VoiceCommandMatch[], currentText: string): { text: string; newPosition: number; actions: { action: VoiceCommandAction; payload?: Record<string, string> }[] } {
    let text = currentText;
    const actions: { action: VoiceCommandAction; payload?: Record<string, string> }[] = [];
    for (const m of matches) {
      const payload = { ...(m.command.customPayload ?? {}), ...(m.payload ?? {}) };
      switch (m.command.action) {
        case 'insert-punctuation': {
          const ch = payload.char ?? '。';
          text += ch;
          actions.push({ action: 'insert-punctuation', payload: { char: ch } });
          break;
        }
        case 'insert-snippet': {
          const t = payload.text ?? '';
          if (t) {
            text += t;
            actions.push({ action: 'insert-snippet', payload: { text: t } });
          }
          break;
        }
        case 'insert-template': {
          actions.push({ action: 'insert-template', payload });
          break;
        }
        case 'new-line':
          text += '\n';
          actions.push({ action: 'new-line' });
          break;
        case 'new-paragraph':
          text += '\n\n';
          actions.push({ action: 'new-paragraph' });
          break;
        case 'next-field':
          actions.push({ action: 'next-field' });
          break;
        case 'prev-field':
          actions.push({ action: 'prev-field' });
          break;
        case 'goto-field': {
          const f = payload.field ?? '';
          actions.push({ action: 'goto-field', payload: { field: f } });
          if (f && FIELD_MAP[Object.keys(FIELD_MAP).find((k) => FIELD_MAP[k]?.field === f) ?? '']) {
            this.context.currentField = f;
            const fm = FIELD_MAP[Object.keys(FIELD_MAP).find((k) => FIELD_MAP[k]?.field === f) ?? ''];
            if (fm) this.context.currentSection = fm.section;
          }
          break;
        }
        case 'clear-field':
          actions.push({ action: 'clear-field' });
          break;
        case 'focus-field':
          actions.push({ action: 'focus-field' });
          break;
        case 'save-draft':
          actions.push({ action: 'save-draft' });
          break;
        case 'submit-report':
          actions.push({ action: 'submit-report' });
          break;
        case 'save-template':
          actions.push({ action: 'save-template' });
          break;
        case 'undo':
          actions.push({ action: 'undo' });
          break;
        case 'redo':
          actions.push({ action: 'redo' });
          break;
        case 'delete-last':
          text = text.slice(0, -1);
          actions.push({ action: 'delete-last' });
          break;
        case 'delete-word': {
          const m2 = text.match(/(\s*\S+)\s*$/);
          if (m2) text = text.slice(0, text.length - (m2[0]?.length ?? 0));
          actions.push({ action: 'delete-word' });
          break;
        }
        case 'select-all':
          actions.push({ action: 'select-all' });
          break;
        case 'switch-lang':
          if (payload.lang) {
            this.context.language = payload.lang as VoiceCommandContext['language'];
            actions.push({ action: 'switch-lang', payload });
          }
          break;
        case 'start-dictation':
          actions.push({ action: 'start-dictation' });
          break;
        case 'stop-dictation':
          actions.push({ action: 'stop-dictation' });
          break;
        case 'pause-dictation':
          actions.push({ action: 'pause-dictation' });
          break;
        case 'resume-dictation':
          actions.push({ action: 'resume-dictation' });
          break;
        case 'open-vocab':
          actions.push({ action: 'open-vocab' });
          break;
        case 'open-history':
          actions.push({ action: 'open-history' });
          break;
        case 'format-emphasis':
          actions.push({ action: 'format-emphasis' });
          break;
        case 'format-normal':
          actions.push({ action: 'format-normal' });
          break;
        case 'spell-out':
          actions.push({ action: 'spell-out' });
          break;
      }
    }
    return { text, newPosition: text.length, actions };
  }

  /**
   * 复合:从识别结果直接得到处理结果
   */
  process(text: string, currentText: string): { text: string; matches: VoiceCommandMatch[]; actions: { action: VoiceCommandAction; payload?: Record<string, string> }[] } {
    const matches = this.recognize(text);
    if (matches.length === 0) return { text: currentText, matches: [], actions: [] };
    const r = this.apply(matches, currentText);
    return { text: r.text, matches, actions: r.actions };
  }

  getCommandsByCategory(category: VoiceCommandCategory): VoiceCommandDefinition[] {
    return VOICE_COMMANDS.filter((c: VoiceCommandDefinition) => c.enabled && c.category === category);
  }

  getRecentCommands(): VoiceCommandDefinition[] {
    return [...this.recentCommands].reverse().map((r) => r.command);
  }

  // ---------- 内部 ----------

  private matchSingleCommand(text: string): MatchResult {
    const ts = Date.now();
    const sorted = [...VOICE_COMMANDS.filter((c: VoiceCommandDefinition) => c.enabled)].sort((a: VoiceCommandDefinition, b: VoiceCommandDefinition) => b.priority - a.priority);
    for (const c of sorted) {
      const candidates = [c.command, ...c.aliases];
      for (const phrase of candidates) {
        if (text === phrase) {
          return { match: { command: c, matchedPhrase: phrase, confidence: 1, timestamp: ts, payload: c.customPayload }, consumedText: '' };
        }
        if (text.startsWith(phrase)) {
          const rest = text.slice(phrase.length).trim();
          return { match: { command: c, matchedPhrase: phrase, confidence: 0.9, timestamp: ts, payload: c.customPayload }, consumedText: rest };
        }
      }
    }
    return { match: null, consumedText: text };
  }

  private fuzzyMatch(text: string): VoiceCommandDefinition | null {
    const t = text.toLowerCase().trim();
    let bestCmd: VoiceCommandDefinition | null = null;
    let bestScore = 0;
    for (const c of VOICE_COMMANDS) {
      if (!c.enabled) continue;
      const candidates = [c.command, c.english, ...c.aliases];
      for (const p of candidates) {
        const dist = levenshtein(t, p.toLowerCase());
        const score = 1 - dist / Math.max(t.length, p.length);
        if (!bestCmd || score > bestScore) {
          bestCmd = c;
          bestScore = score;
        }
      }
    }
    return bestCmd && bestScore >= 0.6 ? bestCmd : null;
  }

  private recordRecent(c: VoiceCommandDefinition): void {
    this.recentCommands =     this.recentCommands.filter((r: any) => r.command.id !== c.id);
    this.recentCommands.push({ command: c, ts: Date.now() });
    if (this.recentCommands.length > this.maxRecent) {
      this.recentCommands = this.recentCommands.slice(-this.maxRecent);
    }
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + 1);
      }
      prev = tmp;
    }
  }
  return dp[b.length] ?? 0;
}

export const voiceCommandEngine = new VoiceCommandEngine();
export { PUNCTUATION_MAP, SNIPPET_MAP, FIELD_MAP, TEMPLATE_MAP };
