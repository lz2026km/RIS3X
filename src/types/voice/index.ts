/**
 * G005 放射RIS系统 v3.0.6.5 - 语音听写 类型定义
 * 15 升级点:云STT / 语音命令 / 生物识别 / 多语言 / 后处理
 *
 * 覆盖:
 *  - CloudSttGateway / Provider 接口 (.001 ~ .005)
 *  - VoiceCommand / VoiceCommandResult (.006 ~ .008)
 *  - SpeakerProfile / SpeakerMatch (.009 ~ .011)
 *  - VoiceFeedback / AudioMetrics (.012 ~ .015)
 */

import type { ModalityType } from '../index';

// ---------- 1. 云STT通用 ----------

export type SttProviderId = 'azure' | 'iflytek' | 'deepseek' | 'web-speech';

export type SttLanguage = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW';

export type SttEngineState = 'idle' | 'connecting' | 'listening' | 'paused' | 'processing' | 'error' | 'closed';

export interface SttAudioConfig {
  sampleRate: number;          // 16000
  channels: 1 | 2;
  bitsPerSample: 8 | 16 | 24;
  encoding: 'pcm' | 'opus' | 'wav';
  enableNoiseSuppression: boolean;
  enableAutoGainControl: boolean;
  enableEchoCancellation: boolean;
}

export interface SttRecognitionRequest {
  sessionId: string;
  lang: SttLanguage;
  audio?: Blob | ArrayBuffer;
  interim: boolean;
  vocabularyHints?: string[];
  profanityFilter?: boolean;
  enableWordTimeOffsets?: boolean;
}

export interface SttAlternative {
  text: string;
  confidence: number;          // 0-1
  words?: SttWord[];
}

export interface SttWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speakerTag?: number;
}

export interface SttRecognitionResult {
  sessionId: string;
  isFinal: boolean;
  text: string;
  alternatives: SttAlternative[];
  language: SttLanguage;
  provider: SttProviderId;
  audioMs: number;
  recognitionMs: number;
  words?: SttWord[];
  speakerTag?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface SttProviderStatus {
  provider: SttProviderId;
  state: SttEngineState;
  latencyMs: number;
  activeSessions: number;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  quotaUsed: number;
  quotaTotal: number;
}

// ---------- 2. CloudSttGateway ----------

export interface ICloudSttProvider {
  readonly id: SttProviderId;
  readonly displayName: string;
  readonly supportedLanguages: SttLanguage[];
  initialize(config: Record<string, string>): Promise<void>;
  startSession(req: { lang: SttLanguage; audioConfig: SttAudioConfig }): Promise<string>;
  sendAudio(sessionId: string, audio: ArrayBuffer | Blob): Promise<void>;
  stopSession(sessionId: string): Promise<SttRecognitionResult>;
  getStatus(): Promise<SttProviderStatus>;
  cancelAllSessions(): Promise<void>;
}

export interface SttGatewayOptions {
  primaryProvider: SttProviderId;
  fallbackProvider?: SttProviderId;
  audioConfig?: Partial<SttAudioConfig>;
  retryAttempts?: number;
  retryDelayMs?: number;
  enableAutoFallback?: boolean;
}

export interface SttSessionDescriptor {
  sessionId: string;
  provider: SttProviderId;
  lang: SttLanguage;
  startedAt: number;
  state: SttEngineState;
  bytesProcessed: number;
  interimText: string;
  finalText: string;
}

// ---------- 3. 语音命令 ----------

export type VoiceCommandCategory =
  | 'navigation' | 'insertion' | 'punctuation' | 'formatting'
  | 'control' | 'template' | 'field' | 'save' | 'review' | 'system';

export type VoiceCommandAction =
  | 'insert-text' | 'insert-template' | 'insert-snippet'
  | 'next-field' | 'prev-field' | 'goto-field' | 'clear-field' | 'focus-field'
  | 'save-draft' | 'submit-report' | 'save-template'
  | 'new-paragraph' | 'new-line' | 'insert-punctuation'
  | 'undo' | 'redo' | 'delete-last' | 'delete-word' | 'select-all'
  | 'switch-lang' | 'open-vocab' | 'open-history'
  | 'start-dictation' | 'stop-dictation' | 'pause-dictation' | 'resume-dictation'
  | 'spell-out' | 'format-normal' | 'format-emphasis';

export interface VoiceCommandDefinition {
  id: string;
  command: string;            // 中文触发词
  english: string;            // 英文触发词
  aliases: string[];
  action: VoiceCommandAction;
  category: VoiceCommandCategory;
  description: string;
  descriptionEn: string;
  shortcut?: string;          // 快捷键
  example?: string;
  enabled: boolean;
  priority: number;
  customPayload?: Record<string, string>;
}

export interface VoiceCommandMatch {
  command: VoiceCommandDefinition;
  matchedPhrase: string;
  confidence: number;
  payload?: Record<string, string>;
  timestamp: number;
}

export interface VoiceCommandContext {
  currentField?: string;
  currentSection?: 'findings' | 'impression' | 'diagnosis' | 'recommendation' | 'full';
  availableFields: string[];
  availableTemplates: string[];
  language: SttLanguage;
}

// ---------- 4. 说话人识别 ----------

export interface SpeakerProfile {
  id: string;
  userId: string;
  userName: string;
  role: string;
  title?: string;
  enrollmentSamples: SpeakerEmbedding[];
  embeddingDimension: number;
  enrolledAt: string;
  lastVerifiedAt?: string;
  totalVerifications: number;
  successRate: number;
  mfccMean: number[];         // 13 维 MFCC 均值(简化)
  mfccStd: number[];
  pitchMean: number;
  pitchStd: number;
  speechRate: number;
  notes?: string;
  active: boolean;
}

export interface SpeakerEmbedding {
  id: string;
  speakerId: string;
  mfcc: number[];             // 13 维 MFCC
  pitch: number;
  energy: number;
  durationMs: number;
  capturedAt: string;
  quality: number;            // 0-1
}

export interface SpeakerMatchResult {
  matched: boolean;
  speakerId?: string;
  userId?: string;
  userName?: string;
  confidence: number;
  distance: number;
  livenessScore: number;
  decision: 'accept' | 'reject' | 'uncertain';
  alternatives: { speakerId: string; userName: string; confidence: number }[];
  threshold: number;
  capturedAt: string;
}

export interface SpeakerEnrollmentRequest {
  userId: string;
  userName: string;
  samples: Array<{ audio: ArrayBuffer; durationMs: number }>;
}

export type SpeakerRegistryEvent = 'enrolled' | 'updated' | 'removed' | 'matched' | 'rejected';

// ---------- 5. 后处理 / 格式化 ----------

export type PunctuationStrategy = 'auto' | 'manual' | 'disabled';

export interface FormattingRule {
  id: string;
  pattern: RegExp;
  replacement: string;
  description: string;
  category: 'punctuation' | 'spacing' | 'case' | 'medical' | 'numeric' | 'unit';
  enabled: boolean;
}

export interface FormattingContext {
  autoPunctuation: boolean;
  strategy: PunctuationStrategy;
  medicalNormalization: boolean;
  numberToChinese: boolean;
  unitNormalization: boolean;
  sentenceSpacing: boolean;
  customRules: FormattingRule[];
}

export interface FormattedResult {
  original: string;
  formatted: string;
  appliedRules: { ruleId: string; before: string; after: string }[];
  punctuation: { char: string; position: number; confidence: number }[];
  durationMs: number;
}

// ---------- 6. 多语言 STT ----------

export interface LanguageConfig {
  code: SttLanguage;
  displayName: string;
  nativeName: string;
  provider: SttProviderId;
  modelId: string;
  sampleRate: number;
  features: { punctuation: boolean; profanity: boolean; speakerDiarization: boolean };
  accuracy: number;           // 0-1
  costPerMinuteUsd: number;
}

export interface MultiLangSession {
  sessionId: string;
  primaryLang: SttLanguage;
  fallbackLangs: SttLanguage[];
  autoSwitch: boolean;
  startedAt: string;
  languageSwitches: { from: SttLanguage; to: SttLanguage; at: string; confidence: number }[];
}

// ---------- 7. 噪声抑制 ----------

export interface NoiseSuppressorConfig {
  enabled: boolean;
  aggressiveness: 0 | 1 | 2 | 3;     // RNNoise 风格
  sampleRate: number;
  frameMs: 10 | 20 | 30;
  highPassFilterHz: number;
  enableVad: boolean;
  vadThreshold: number;        // 0-1
}

export interface AudioMetrics {
  rmsLevel: number;            // 0-1
  peakLevel: number;           // 0-1
  snr: number;                 // dB
  voiceActivity: boolean;
  speechProbability: number;   // 0-1
  noiseFloor: number;          // dB
  clipping: boolean;
  latencyMs: number;
  processedAt: number;
}

// ---------- 8. 词汇管理 ----------

export type VocabCategory = 'anatomy' | 'finding' | 'diagnosis' | 'measurement' | 'medication' | 'procedure' | 'modality' | 'modifier' | 'custom';

export interface MedicalTerm {
  id: string;
  term: string;                // 简称
  fullTerm: string;            // 完整术语
  pinyin?: string;
  pinyinInitials?: string;
  en?: string;
  category: VocabCategory;
  modality: ModalityType[];
  bodyPart: string[];
  synonyms: string[];
  weight: number;              // 提升权重
  enabled: boolean;
  source: 'system' | 'user' | 'department' | 'hospital';
  createdBy?: string;
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  notes?: string;
}

export interface CustomDictionary {
  id: string;
  name: string;
  description?: string;
  scope: 'user' | 'department' | 'hospital' | 'tenant';
  ownerId: string;
  terms: MedicalTerm[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- 9. 语音反馈 ----------

export type FeedbackLevel = 'minimal' | 'normal' | 'verbose' | 'debug';

export interface VoiceFeedbackState {
  level: FeedbackLevel;
  showInterim: boolean;
  showCommands: boolean;
  showWaveform: boolean;
  showSpeaker: boolean;
  showMetrics: boolean;
  animationEnabled: boolean;
  soundEnabled: boolean;
  toastOnCommand: boolean;
}

// ---------- 10. 字段导航 ----------

export interface VoiceFieldTarget {
  fieldKey: string;
  fieldLabel: string;
  fieldLabelEn: string;
  section: 'findings' | 'impression' | 'diagnosis' | 'recommendation' | 'full';
  triggerWords: string[];      // 该字段的导航词
  order: number;
  required: boolean;
  value?: string;
}

export interface VoiceFieldNavigationEvent {
  from: string;
  to: string;
  trigger: string;
  timestamp: number;
  mode: 'next' | 'prev' | 'goto' | 'clear' | 'focus';
}
