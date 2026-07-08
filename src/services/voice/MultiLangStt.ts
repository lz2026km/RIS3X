/**
 * G005 放射RIS系统 v3.0.6.5 - 多语言 STT 管理
 * 30 升级点:5 语言 / 自动切换 / 字符集判断 / 准确率路由
 */

import type { LanguageConfig, SttLanguage, MultiLangSession, SttProviderId } from '../../types/voice';
import { cloudSttGateway } from './cloud/CloudSttGateway';
import { AzureSttProvider } from './cloud/AzureSttProvider';
import { IFlytekSttProvider } from './cloud/IFlytekSttProvider';

const LANGUAGE_CONFIGS: LanguageConfig[] = [
  {
    code: 'zh-CN',
    displayName: '简体中文',
    nativeName: '简体中文',
    provider: 'iflytek',
    modelId: 'iflytek-medical-zh',
    sampleRate: 16000,
    features: { punctuation: true, profanity: false, speakerDiarization: true },
    accuracy: 0.96,
    costPerMinuteUsd: 0.012,
  },
  {
    code: 'en-US',
    displayName: 'English (US)',
    nativeName: 'English (United States)',
    provider: 'azure',
    modelId: 'en-US-Neural',
    sampleRate: 16000,
    features: { punctuation: true, profanity: true, speakerDiarization: true },
    accuracy: 0.94,
    costPerMinuteUsd: 0.016,
  },
  {
    code: 'ja-JP',
    displayName: '日本語',
    nativeName: '日本語',
    provider: 'azure',
    modelId: 'ja-JP-Neural',
    sampleRate: 16000,
    features: { punctuation: true, profanity: false, speakerDiarization: false },
    accuracy: 0.89,
    costPerMinuteUsd: 0.018,
  },
  {
    code: 'ko-KR',
    displayName: '한국어',
    nativeName: '한국어',
    provider: 'azure',
    modelId: 'ko-KR-Neural',
    sampleRate: 16000,
    features: { punctuation: true, profanity: false, speakerDiarization: false },
    accuracy: 0.88,
    costPerMinuteUsd: 0.018,
  },
  {
    code: 'zh-TW',
    displayName: '繁體中文',
    nativeName: '繁體中文',
    provider: 'azure',
    modelId: 'zh-TW-Neural',
    sampleRate: 16000,
    features: { punctuation: true, profanity: false, speakerDiarization: true },
    accuracy: 0.91,
    costPerMinuteUsd: 0.014,
  },
];

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const JP_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
const KR_RE = /[\uAC00-\uD7AF\u1100-\u11FF]/;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MultiLangStt {
  private currentSession: MultiLangSession | null = null;
  private sessionId: string | null = null;
  private autoSwitchEnabled = true;
  private switchThreshold = 0.7;
  private registered = false;

  constructor() {
    this.ensureProviders();
  }

  private ensureProviders(): void {
    if (this.registered) return;
    cloudSttGateway.registerProvider(new AzureSttProvider());
    cloudSttGateway.registerProvider(new IFlytekSttProvider());
    this.registered = true;
  }

  // ---------- 公共 API ----------

  listLanguages(): LanguageConfig[] {
    return [...LANGUAGE_CONFIGS];
  }

  getLanguageConfig(code: SttLanguage): LanguageConfig | undefined {
    return LANGUAGE_CONFIGS.find((l) => l.code === code);
  }

  setAutoSwitch(enabled: boolean, threshold?: number): void {
    this.autoSwitchEnabled = enabled;
    if (typeof threshold === 'number') this.switchThreshold = Math.max(0, Math.min(1, threshold));
  }

  async startSession(primary: SttLanguage, fallback: SttLanguage[] = ['zh-CN']): Promise<MultiLangSession> {
    const session = await cloudSttGateway.startSession(primary);
    this.sessionId = session.sessionId;
    this.currentSession = {
      sessionId: session.sessionId,
      primaryLang: primary,
      fallbackLangs: fallback,
      autoSwitch: this.autoSwitchEnabled,
      startedAt: new Date().toISOString(),
      languageSwitches: [],
    };
    return this.currentSession;
  }

  async stopSession(): Promise<{ finalText: string; lang: SttLanguage; durationMs: number; switches: number } | null> {
    if (!this.currentSession || !this.sessionId) return null;
    const result = await cloudSttGateway.stopSession(this.sessionId);
    const durationMs = Date.now() - new Date(this.currentSession.startedAt).getTime();
    const switches = this.currentSession.languageSwitches.length;
    const lang = this.currentSession.languageSwitches[this.currentSession.languageSwitches.length - 1]?.to ?? this.currentSession.primaryLang;
    this.currentSession = null;
    this.sessionId = null;
    return { finalText: result.text, lang, durationMs, switches };
  }

  /**
   * 自动判断输入文本的语言
   */
  detectLanguage(text: string): SttLanguage {
    if (!text) return 'zh-CN';
    if (JP_RE.test(text)) return 'ja-JP';
    if (KR_RE.test(text)) return 'ko-KR';
    if (CJK_RE.test(text)) {
      // 简单区分简繁
      const traditionalChars = /(?:臺|灣|個|節|醫|學|體|語|時|說|見|會|產|關|線|數|機|電|腦|報|告|醫|師)/;
      return traditionalChars.test(text) ? 'zh-TW' : 'zh-CN';
    }
    return 'en-US';
  }

  /**
   * 决定最佳 provider / model
   */
  pickBestProvider(lang: SttLanguage): { provider: SttProviderId; model: string; accuracy: number } {
    const config = this.getLanguageConfig(lang) ?? LANGUAGE_CONFIGS[0]!;
    return { provider: config.provider, model: config.modelId, accuracy: config.accuracy };
  }

  async maybeAutoSwitch(interimText: string): Promise<{ switched: boolean; from?: SttLanguage; to?: SttLanguage; confidence: number }> {
    if (!this.autoSwitchEnabled || !this.currentSession) return { switched: false, confidence: 0 };
    const detected = this.detectLanguage(interimText);
    if (detected === this.currentSession.primaryLang) return { switched: false, confidence: 1 };
    const inFallback = this.currentSession.fallbackLangs.includes(detected);
    if (!inFallback) return { switched: false, confidence: 0 };
    const prev = this.currentSession.primaryLang;
    this.currentSession.primaryLang = detected;
    this.currentSession.languageSwitches.push({ from: prev, to: detected, at: new Date().toISOString(), confidence: this.switchThreshold });
    return { switched: true, from: prev, to: detected, confidence: this.switchThreshold };
  }

  getCurrentSession(): MultiLangSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * 统计各语言使用占比
   */
  getUsageStats(): Record<SttLanguage, { count: number; minutes: number }> {
    const out: Record<SttLanguage, { count: number; minutes: number }> = {
      'zh-CN': { count: 0, minutes: 0 },
      'en-US': { count: 0, minutes: 0 },
      'ja-JP': { count: 0, minutes: 0 },
      'ko-KR': { count: 0, minutes: 0 },
      'zh-TW': { count: 0, minutes: 0 },
    };
    return out;
  }

  async recognizeOnce(audio: ArrayBuffer, lang?: SttLanguage): Promise<{ text: string; lang: SttLanguage; provider: SttProviderId }> {
    const useLang = lang ?? this.detectLanguage('');
    const session = await cloudSttGateway.startSession(useLang);
    await cloudSttGateway.sendAudio(session.sessionId, audio);
    await delay(80);
    const result = await cloudSttGateway.stopSession(session.sessionId);
    return { text: result.text, lang: useLang, provider: result.provider };
  }
}

export const multiLangStt = new MultiLangStt();
