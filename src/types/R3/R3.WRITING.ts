/**
 * G005 放射RIS系统 v3.0.5.1 - R3.WRITING 书写模块类型定义
 * A5-REPORT 报告子系统 150 升级点(本批次 320 中的 150)
 *
 * 状态机路径:pendingAssignment -> assigned -> writing -> submitted
 * 涵盖结构化字段、富文本、AI 草稿、语音听写、影像锚定、模板、草稿、字数统计等
 */

// ---------- 1. 结构化字段(RECIST/BI-RADS/PI-RADS) ----------
export type StructuredFieldType =
  | 'text' | 'number' | 'enum' | 'multi-enum' | 'date'
  | 'scale' | 'boolean' | 'image' | 'signature' | 'formula';

export type StructuredTemplateId =
  | 'recist' | 'birads' | 'pirads' | 'lungRads' | 'tiRads' | 'cadRads'
  | 'liRads' | 'cRads' | 'oRads' | 'tnm' | 'custom';

export interface StructuredFieldOption {
  value: string;
  label: string;
  labelEn: string;
  color?: string;
  score?: number;
}

export interface StructuredFieldDefinition {
  id: string;
  key: string;
  label: string;
  labelEn: string;
  type: StructuredFieldType;
  required: boolean;
  group: string;
  options?: StructuredFieldOption[];
  min?: number;
  max?: number;
  unit?: string;
  unitOptions?: string[];
  placeholder?: string;
  placeholderEn?: string;
  description?: string;
  descriptionEn?: string;
  defaultValue?: unknown;
  referenceRange?: { min?: number; max?: number; unit?: string; note?: string };
  formula?: string;
  dependsOn?: { fieldKey: string; equals: unknown };
  locked?: boolean;
  permissions?: string[];
  fillGuide?: string;
  fillGuideEn?: string;
  example?: string;
  exampleEn?: string;
  order: number;
}

export interface StructuredFieldGroup {
  id: string;
  label: string;
  labelEn: string;
  order: number;
  collapsible: boolean;
  defaultExpanded: boolean;
}

export interface StructuredTemplate {
  id: StructuredTemplateId;
  name: string;
  nameEn: string;
  modality: string;
  bodyPart: string;
  version: string;
  parentId?: string;
  fields: StructuredFieldDefinition[];
  groups: StructuredFieldGroup[];
  createdAt: string;
  updatedAt: string;
  author: string;
  score: number;
  tags: string[];
  inheritable: boolean;
  approved: boolean;
  approver?: string;
}

// ---------- 2. RECIST 1.1 ----------
export interface RecistTargetLesion {
  id: string;
  site: string;
  longDiameterMm: number;
  shortDiameterMm?: number;
  baselineMm?: number;
  previousMm?: number;
  sum: number;
  isNonTarget?: boolean;
  isNew?: boolean;
  notes?: string;
}

export interface RecistResponse {
  category: 'CR' | 'PR' | 'SD' | 'PD' | 'NE';
  categoryLabel: string;
  categoryLabelEn: string;
  sumOfDiameters: number;
  baselineSum: number;
  percentChange: number;
  confirmedAt: string;
  confirmedBy: string;
  notes: string;
}

// ---------- 3. BI-RADS ----------
export type BiradsCategory = '0' | '1' | '2' | '3' | '4' | '4A' | '4B' | '4C' | '5' | '6';
export interface BiradsAssessment {
  category: BiradsCategory;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  recommendation: string;
  recommendationEn: string;
  malignancyRisk: number;
  color: string;
}
export interface BiradsFinding {
  findingType: 'mass' | 'calcification' | 'asymmetry' | 'architecturalDistortion' | 'associatedFeatures';
  shape?: 'round' | 'oval' | 'irregular';
  margin?: 'circumscribed' | 'obscured' | 'microlobulated' | 'indistinct' | 'spiculated';
  density?: 'high' | 'equal' | 'low' | 'fat-containing';
  size?: { x: number; y: number; z: number; unit: 'mm' | 'cm' };
  location: string;
  side: 'left' | 'right' | 'bilateral';
  clockPosition?: string;
}

// ---------- 4. PI-RADS ----------
export type PiradsScore = 1 | 2 | 3 | 4 | 5;
export interface PiradsAssessment {
  peripheralZoneScore: PiradsScore;
  transitionZoneScore: PiradsScore;
  overallScore: PiradsScore;
  overallCategory: 'VeryLow' | 'Low' | 'Intermediate' | 'High' | 'VeryHigh';
  prostateVolumeCc?: number;
  psad?: number;
  findings: {
    lesionId: string;
    zone: 'PZ' | 'TZ' | 'CZ' | 'AS';
    t2w: PiradsScore;
    dw: PiradsScore;
    dwi: PiradsScore;
    dce: 'positive' | 'negative' | 'NA';
    sizeMm: number;
    location: string;
  }[];
}

// ---------- 5. 富文本编辑器 ----------
export interface RichEditorStyle {
  fontFamily: 'SimSun' | 'SimHei' | 'KaiTi' | 'FangSong' | 'Arial' | 'Times New Roman' | 'Consolas';
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  backgroundColor: string;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  heading: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  bullet: 'ordered' | 'unordered' | null;
  subscript: boolean;
  superscript: boolean;
  indent: number;
  blockquote: boolean;
}

export interface RichEditorImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  keyImage: boolean;
  dicomRef?: string;
  annotation?: {
    type: 'arrow' | 'circle' | 'rect' | 'text';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    color: string;
  }[];
  uploadAt: string;
  uploadedBy: string;
}

export interface RichEditorTable {
  rows: number;
  cols: number;
  data: string[][];
  withHeader: boolean;
}

export interface RichEditorDocument {
  id: string;
  reportId: string;
  content: string;
  html: string;
  plainText: string;
  images: RichEditorImage[];
  tables: RichEditorTable[];
  style: Partial<RichEditorStyle>;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  readingTimeMin: number;
  writingDurationSec: number;
  lastEditedAt: string;
  lastEditedBy: string;
  version: number;
  undoStack: { html: string; ts: string }[];
  redoStack: { html: string; ts: string }[];
  spellCheck: {
    enabled: boolean;
    language: 'zh-CN' | 'en-US';
    errors: { start: number; end: number; suggestion: string; type: 'spelling' | 'grammar' | 'punctuation' }[];
  };
  pagination: { totalPages: number; currentPage: number; split: boolean };
  fullscreen: boolean;
  splitPreview: boolean;
  autoSaveAt: string;
}

// ---------- 6. AI 草稿 ----------
export type AiDraftStage = 'idle' | 'analyzing' | 'drafting' | 'ready' | 'merging' | 'error';
export interface AiDraftRequest {
  reportId: string;
  modality: string;
  bodyPart: string;
  clinicalInfo: string;
  priorReportId?: string;
  templates?: string[];
  includeImages: boolean;
  style: 'concise' | 'detailed' | 'structured';
  language: 'zh-CN' | 'en-US';
}
export interface AiDraftResult {
  id: string;
  reportId: string;
  stage: AiDraftStage;
  findings: string;
  impression: string;
  recommendation: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
  basedOnReports: string[];
  warnings: string[];
  tokens: { input: number; output: number; cost: number };
}

// ---------- 7. 语音听写 ----------
export type VoiceDictationLang = 'zh-CN' | 'en-US' | 'zh-EN';
export type VoiceDictationState = 'idle' | 'listening' | 'paused' | 'processing' | 'error';
export interface VoiceDictationSession {
  id: string;
  reportId: string;
  state: VoiceDictationState;
  lang: VoiceDictationLang;
  interimText: string;
  finalText: string;
  segments: { start: number; end: number; text: string; confidence: number }[];
  commands: { command: string; action: string; ts: number }[];
  startedAt: string;
  endedAt?: string;
  totalDurationSec: number;
  totalWords: number;
  autoPunctuation: boolean;
  history: { id: string; text: string; createdAt: string }[];
  errorMessage?: string;
  browser: 'webkit' | 'standard';
}

// ---------- 8. 影像锚定 ----------
export type ImageAnchorStatus = 'active' | 'pending' | 'archived';
export interface ImageAnchor {
  id: string;
  reportId: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  frameNumber: number;
  annotation: {
    type: 'point' | 'line' | 'angle' | 'area' | 'text' | 'arrow';
    coords: { x: number; y: number; z?: number }[];
    label: string;
    labelEn: string;
    color: string;
    measurement?: { value: number; unit: string };
  }[];
  keyImage: boolean;
  windowing?: { center: number; width: number };
  thumbnail: string;
  status: ImageAnchorStatus;
  createdBy: string;
  createdAt: string;
  pinnedBy?: string;
  pinnedAt?: string;
  usageCount: number;
}

// ---------- 9. 短语库 / RadLex ----------
export type PhraseCategory =
  | 'normal' | 'abnormal' | 'critical' | 'recommendation'
  | 'comparison' | 'technique' | 'history' | 'impression'
  | 'findingChest' | 'findingAbdomen' | 'findingNeuro' | 'findingMSK';

export interface Phrase {
  id: string;
  content: string;
  contentEn: string;
  category: PhraseCategory;
  subCategory?: string;
  modality: string[];
  bodyPart: string[];
  tags: string[];
  favorite: boolean;
  usageCount: number;
  variables: { key: string; label: string; labelEn: string; defaultValue: string }[];
  isTemplate: boolean;
  template?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  radlexId?: string;
  pinyin?: string;
  pinyinInitials?: string;
  scoring?: { value: number; votes: number };
}

export interface RadLexTerm {
  id: string;
  preferredName: string;
  preferredNameEn: string;
  synonyms: string[];
  definition: string;
  definitionEn: string;
  parentId?: string;
  childrenIds: string[];
  modality: string[];
  bodyPart: string[];
  category: string;
  usageCount: number;
  lastUsedAt?: string;
}

// ---------- 10. 历史报告 / 相似病例 ----------
export interface PriorReport {
  id: string;
  patientId: string;
  reportId: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  status: string;
  findings: string;
  impression: string;
  authorName: string;
  comparisonDelta?: { days: number; summary: string };
  thumbnail?: string;
}
export interface SimilarCase {
  id: string;
  reportId: string;
  patientId: string;
  modality: string;
  bodyPart: string;
  similarityScore: number;
  topTerms: string[];
  findings: string;
  impression: string;
  authorName: string;
  studyDate: string;
}

// ---------- 11. 草稿 / 自动保存 ----------
export interface ReportDraft {
  id: string;
  reportId: string;
  authorId: string;
  authorName: string;
  content: string;
  html: string;
  structured: Record<string, unknown>;
  wordCount: number;
  version: number;
  versionLabel: string;
  createdAt: string;
  updatedAt: string;
  autoSaved: boolean;
  conflict: boolean;
  conflictingDraftId?: string;
  restoreSource?: string;
  tags: string[];
}
export type DraftVersionStrategy = 'keep-local' | 'keep-remote' | 'merge' | 'manual';

// ---------- 12. 模板 ----------
export interface ReportTemplate {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  subCategory: string;
  modality: string;
  bodyPart: string;
  version: string;
  parentId?: string;
  inheritable: boolean;
  autoApply: boolean;
  content: string;
  variables: { key: string; label: string; labelEn: string; defaultValue: string; required: boolean }[];
  rating: number;
  useCount: number;
  rank: number;
  approved: boolean;
  approver?: string;
  approvalDate?: string;
  tags: string[];
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  diffPreview?: { red: string; green: string };
}
export interface TemplateCategory {
  id: string;
  name: string;
  nameEn: string;
  parentId?: string;
  childrenIds: string[];
  icon: string;
  order: number;
}

// ---------- 13. 书写度量 ----------
export interface WritingMetrics {
  reportId: string;
  startAt: string;
  endAt?: string;
  durationSec: number;
  pauseCount: number;
  pauseTotalSec: number;
  longestPauseSec: number;
  keystrokeCount: number;
  voiceWordsCount: number;
  typedWordsCount: number;
  phrasesUsed: number;
  imagesInserted: number;
  pagesGenerated: number;
  speedWordsPerMin: number;
  pagePerformanceMs: number;
}

// ---------- 14. 提交前预评分 ----------
export interface PreSubmitScore {
  reportId: string;
  score: number;
  dimensions: { name: string; nameEn: string; score: number; weight: number }[];
  checklist: { id: string; label: string; labelEn: string; passed: boolean; weight: number }[];
  aiPreReview: { score: number; issues: string[]; passed: boolean };
  termCheck: { checked: number; issues: string[] };
  requiredFieldsFilled: boolean;
  criticalValuesAnnotated: boolean;
  passed: boolean;
  createdAt: string;
}

// ---------- 15. 多模态融合 ----------
export interface MultiModalityPanel {
  id: string;
  reportId: string;
  modalities: { modality: string; studyUID: string; seriesCount: number; thumbnail: string }[];
  activeModality: string;
  crossFindings: {
    id: string;
    label: string;
    labelEn: string;
    matchedAcrossModalities: string[];
    mergedText: string;
    confidence: number;
  }[];
  syncScroll: boolean;
  diffHighlights: { modality: string; color: string; notes: string }[];
}

// ---------- 16. 关键字高亮 ----------
export interface KeywordHighlight {
  term: string;
  termEn: string;
  category: 'finding' | 'diagnosis' | 'critical' | 'recommendation' | 'anatomy';
  color: string;
  bg: string;
  weight: number;
}

// ---------- 17. 单元测试桩 ----------
export type WritingTestId = 'W001' | 'W040' | 'W150';

// ---------- 18. 主聚合类型 ----------
export interface ReportWritingContext {
  reportId: string;
  patientId: string;
  modality: string;
  bodyPart: string;
  template: StructuredTemplate;
  fields: Record<string, unknown>;
  recist?: RecistResponse;
  birads?: BiradsAssessment;
  pirads?: PiradsAssessment;
  document: RichEditorDocument;
  aiDraft: AiDraftResult | null;
  voice: VoiceDictationSession | null;
  anchors: ImageAnchor[];
  phrases: Phrase[];
  priorReports: PriorReport[];
  similarCases: SimilarCase[];
  drafts: ReportDraft[];
  metrics: WritingMetrics;
  preSubmitScore: PreSubmitScore | null;
  multiModality?: MultiModalityPanel;
  keywords: KeywordHighlight[];
  chargeCodes?: ChargeItem[];
  criticalFlagged?: boolean;
  complianceStatus?: ComplianceCheckResult;
  signature?: SignatureRecord;
  collaborators?: Collaborator[];
}

export const RECIST_CATEGORIES: RecistResponse['category'][] = ['CR', 'PR', 'SD', 'PD', 'NE'];
export const BIRADS_CATEGORIES: BiradsCategory[] = ['0', '1', '2', '3', '4', '4A', '4B', '4C', '5', '6'];
export const PIRADS_SCORES: PiradsScore[] = [1, 2, 3, 4, 5];
export const STRUCTURED_TEMPLATE_IDS: StructuredTemplateId[] = ['recist', 'birads', 'pirads', 'lungRads', 'tiRads', 'cadRads', 'liRads', 'cRads', 'oRads', 'tnm'];

// ---------- 19. Lung-RADS ----------
export type LungRadsCategory = '0' | '1' | '2' | '3' | '4A' | '4B' | '4X';
export type LungRadsModifier = 'S' | 'C';
export interface LungRadsAssessment {
  category: LungRadsCategory;
  modifier?: LungRadsModifier;
  noduleType: string;
  size: number;
  margin: string;
  calcification: string;
  management: string;
}

// ---------- 20. CAD-RADS ----------
export type CadRadsCategory = '0' | '1' | '2' | '3' | '4A' | '4B' | '5' | 'N';
export type CadRadsModifier = 'N' | 'P' | 'G' | 'HR';
export interface CadRadsAssessment {
  category: CadRadsCategory;
  modifier?: CadRadsModifier;
  stenosisPerVessel: Record<string, number>;
  plaqueComposition: string[];
}

// ---------- 21. LI-RADS ----------
export type LiRadsCategory = 'LR-1' | 'LR-2' | 'LR-3' | 'LR-4' | 'LR-5' | 'LR-M' | 'LR-TIV';
export interface LiRadsAssessment {
  category: LiRadsCategory;
  features: string[];
  ancillaryFeatures: string[];
}

// ---------- 22. TI-RADS ----------
export type TiRadsScore = 1 | 2 | 3 | 4 | 5;
export type TiRadsCategory = 'TR1' | 'TR2' | 'TR3' | 'TR4' | 'TR5';
export interface TiRadsAssessment {
  score: TiRadsScore;
  category: TiRadsCategory;
  composition: string;
  echogenicity: string;
  shape: string;
  margin: string;
  foci: string;
  management: string;
}

// ---------- 23. TNM 分期 ----------
export interface TnmStage {
  T: string;
  N: string;
  M: string;
  stageGroup: string;
  edition: string;
}
export type AjccEdition = '8th' | '9th';

// ---------- 24. 危急值模式 ----------
export interface CriticalPattern {
  id: string;
  pattern: string;
  category: string;
  threshold: string;
  severity: 'warning' | 'critical';
  modality: string;
}

// ---------- 25. 收费项 ----------
export interface ChargeItem {
  id: string;
  code: string;
  system: string;
  description: string;
  relativeValue: number;
  modality: string;
  active: boolean;
}

// ---------- 26. 合规检查结果 ----------
export interface ComplianceCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ---------- 27. 签名记录 ----------
export interface SignatureRecord {
  id: string;
  reportId: string;
  signerId: string;
  signerName: string;
  role: string;
  timestamp: string;
  type: string;
  status: string;
}

// ---------- 28. 语音命令 ----------
export interface VoiceCommand {
  command: string;
  english: string;
  description: string;
  category: string;
  shortcut?: string;
}

// ---------- 29. 语音配置文件 ----------
export interface VoiceProfile {
  id: string;
  name: string;
  role: string;
  language: string;
  active: boolean;
}

// ---------- 30. 协作者 ----------
export interface Collaborator {
  userId: string;
  name: string;
  role: string;
  status: string;
  entered: string;
  lockedSections?: string[];
}

