/**
 * G005 放射RIS系统 v3.0.5.1 - R3.WRITING 书写模块 Service
 * 结构化字段 / 富文本 / AI 草稿 / 语音 / 影像锚定 / 模板 / 短语库 / RadLex / 草稿
 */

import type {
  StructuredTemplate, StructuredFieldDefinition, RecistResponse, RecistTargetLesion,
  BiradsAssessment, BiradsFinding, PiradsAssessment, PiradsScore,
  RichEditorDocument, AiDraftRequest, AiDraftResult, AiDraftStage,
  VoiceDictationSession, VoiceDictationState,
  ImageAnchor,
  Phrase, RadLexTerm,
  PriorReport, SimilarCase,
  ReportDraft, DraftVersionStrategy,
  ReportTemplate, TemplateCategory,
  WritingMetrics, PreSubmitScore,
  MultiModalityPanel,
  KeywordHighlight,
  ReportWritingContext,
  ComplianceCheckResult,
  ChargeItem,
  SignatureRecord,
  CriticalPattern,
} from '@types/R3/R3.WRITING';
import {
  RECIST_TEMPLATE, BIRADS_TEMPLATE, PIRADS_TEMPLATE, getStructuredTemplates,
  RECIST_LESIONS, RECIST_RESPONSE, BIRADS_CATEGORY_MAP, BIRADS_FINDINGS, PIRADS_ASSESSMENT,
  RICH_DOCUMENT_MOCK, AI_DRAFT_REQUEST, AI_DRAFT_RESULT, VOICE_DICTATION_MOCK,
  IMAGE_ANCHORS_MOCK, PHRASES_MOCK, RADLEX_TERMS_MOCK,
  PRIOR_REPORTS_MOCK, SIMILAR_CASES_MOCK,
  REPORT_DRAFTS_MOCK, REPORT_TEMPLATES_MOCK, TEMPLATE_CATEGORIES_MOCK,
  WRITING_METRICS_MOCK, PRE_SUBMIT_SCORE_MOCK, MULTI_MODALITY_MOCK, KEYWORD_HIGHLIGHTS_MOCK,
  REPORT_WRITING_CONTEXT_MOCK,
} from '@data/reportWritingMock';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. 模板加载
// ============================================================
export async function getStructuredTemplate(id: StructuredTemplate['id']): Promise<StructuredTemplate | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return getStructuredTemplates().find((t) => t.id === id) ?? null;
}

export async function listStructuredTemplates(): Promise<StructuredTemplate[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return getStructuredTemplates();
}

export async function listTemplateCategories(): Promise<TemplateCategory[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return TEMPLATE_CATEGORIES_MOCK;
}

export async function listReportTemplates(category?: string): Promise<ReportTemplate[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return category ? REPORT_TEMPLATES_MOCK.filter((t) => t.category === category) : REPORT_TEMPLATES_MOCK;
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return REPORT_TEMPLATES_MOCK.find((t) => t.id === id) ?? null;
}

export async function cloneTemplate(id: string, newName: string): Promise<ReportTemplate | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  const src = REPORT_TEMPLATES_MOCK.find((t) => t.id === id);
  if (!src) return null;
  return { ...src, id: `tpl-clone-${Date.now()}`, name: newName, version: '0.1.0', useCount: 0, rating: 0, approved: false };
}

export async function diffTemplates(idA: string, idB: string): Promise<{ red: string; green: string } | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return {
    red: '<p>右肺下叶基底段见一斑片状高密度影,边界模糊。</p>',
    green: '<p>右肺下叶基底段见一斑片状稍高密度影,边缘略模糊。</p>',
  };
}

// ============================================================
// 2. RECIST 1.1
// ============================================================
export async function getRecistLesions(reportId: string): Promise<RecistTargetLesion[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return RECIST_LESIONS;
}

export async function getRecistResponse(reportId: string): Promise<RecistResponse> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return RECIST_RESPONSE;
}

export function calcRecistResponse(lesions: RecistTargetLesion[]): RecistResponse {
  const sumOfDiameters = lesions.reduce((acc, l) => acc + l.longDiameterMm, 0);
  const baselineSum = lesions.reduce((acc, l) => acc + (l.baselineMm ?? l.longDiameterMm), 0);
  const percentChange = ((sumOfDiameters - baselineSum) / baselineSum) * 100;
  let category: RecistResponse['category'] = 'SD';
  if (percentChange <= -30) category = 'PR';
  if (percentChange <= -100 && lesions.every((l) => l.longDiameterMm === 0)) category = 'CR';
  if (percentChange >= 20) category = 'PD';
  return {
    category,
    categoryLabel: ({ CR: '完全缓解', PR: '部分缓解', SD: '疾病稳定', PD: '疾病进展', NE: '无法评估' } as const)[category],
    categoryLabelEn: ({ CR: 'Complete Response', PR: 'Partial Response', SD: 'Stable Disease', PD: 'Progressive Disease', NE: 'Not Evaluable' } as const)[category],
    sumOfDiameters, baselineSum, percentChange,
    confirmedAt: new Date().toISOString(), confirmedBy: '陈医师', notes: '',
  };
}

// ============================================================
// 3. BI-RADS
// ============================================================
export async function getBiradsAssessment(reportId: string): Promise<{ assessment: BiradsAssessment; findings: BiradsFinding[] }> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { assessment: BIRADS_CATEGORY_MAP['4B'], findings: BIRADS_FINDINGS };
}

export function getBiradsByCategory(c: BiradsAssessment['category']): BiradsAssessment {
  return BIRADS_CATEGORY_MAP[c];
}

// ============================================================
// 4. PI-RADS
// ============================================================
export async function getPiradsAssessment(reportId: string): Promise<PiradsAssessment> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return PIRADS_ASSESSMENT;
}

export function calcPiradsOverall(lesions: PiradsAssessment['findings']): PiradsScore {
  if (lesions.length === 0) return 1 as PiradsScore;
  return lesions.reduce((max, l) => Math.max(max, l.t2w, l.dwi), 1) as PiradsScore;
}

// ============================================================
// 5. 富文本编辑器
// ============================================================
export async function getRichDocument(reportId: string): Promise<RichEditorDocument> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { ...RICH_DOCUMENT_MOCK, reportId };
}

export async function saveRichDocument(doc: RichEditorDocument): Promise<RichEditorDocument> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { ...doc, lastEditedAt: new Date().toISOString(), autoSaveAt: new Date().toISOString() };
}

export async function autoSaveDocument(reportId: string, html: string, plainText: string): Promise<{ success: boolean; savedAt: string; version: number }> {
  await new Promise((r) => setTimeout(r, 30));
  return { success: true, savedAt: new Date().toISOString(), version: Math.floor(Math.random() * 100) };
}

export function countWords(text: string): number {
  return text.replace(/\s/g, '').length;
}

export function countParagraphs(text: string): number {
  return text.split(/\n+/).filter(Boolean).length;
}

export function readingTime(text: string, wordsPerMin = 300): number {
  return Math.ceil(countWords(text) / wordsPerMin);
}

// ============================================================
// 6. AI 草稿
// ============================================================
export async function generateAiDraft(req: AiDraftRequest): Promise<AiDraftResult> {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    ...AI_DRAFT_RESULT,
    id: `aidraft-${req.reportId}-${Date.now()}`,
    reportId: req.reportId,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAiDraftStatus(reportId: string): Promise<{ stage: AiDraftStage; progress: number }> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { stage: 'ready', progress: 100 };
}

// ============================================================
// 7. 语音听写
// ============================================================
export async function startVoiceDictation(reportId: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<VoiceDictationSession> {
  await new Promise((r) => setTimeout(r, 200));
  return { ...VOICE_DICTATION_MOCK, reportId, lang, state: 'listening', startedAt: new Date().toISOString() };
}

export async function pauseVoiceDictation(id: string): Promise<{ state: VoiceDictationState }> {
  await new Promise((r) => setTimeout(r, 50));
  return { state: 'paused' };
}

export async function resumeVoiceDictation(id: string): Promise<{ state: VoiceDictationState }> {
  await new Promise((r) => setTimeout(r, 50));
  return { state: 'listening' };
}

export async function stopVoiceDictation(id: string): Promise<{ state: VoiceDictationState; durationSec: number; totalWords: number }> {
  await new Promise((r) => setTimeout(r, 100));
  return { state: 'idle', durationSec: 120, totalWords: 78 };
}

export async function getVoiceDictationHistory(reportId: string): Promise<VoiceDictationSession['history']> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return VOICE_DICTATION_MOCK.history;
}

// ============================================================
// 8. 影像锚定
// ============================================================
export async function getImageAnchors(reportId: string): Promise<ImageAnchor[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return IMAGE_ANCHORS_MOCK.filter((a) => a.reportId === reportId);
}

export async function pinImageAnchor(id: string, userId: string): Promise<ImageAnchor | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  const anchor = IMAGE_ANCHORS_MOCK.find((a) => a.id === id);
  if (!anchor) return null;
  return { ...anchor, pinnedBy: userId, pinnedAt: new Date().toISOString() };
}

export async function uploadImageToReport(reportId: string, file: { name: string; size: number; data: string }): Promise<{ id: string; url: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return { id: `img-${Date.now()}`, url: `/uploads/${reportId}/${file.name}` };
}

// ============================================================
// 9. 短语库 / RadLex
// ============================================================
export async function searchPhrases(query: string, category?: string, modality?: string): Promise<Phrase[]> {
  await new Promise((r) => setTimeout(r, 50));
  const q = query.trim().toLowerCase();
  return PHRASES_MOCK.filter((p) => {
    const matchQ = !q || p.content.toLowerCase().includes(q) || p.contentEn.toLowerCase().includes(q) || (p.pinyin?.toLowerCase().includes(q) ?? false) || (p.pinyinInitials?.toLowerCase().includes(q) ?? false);
    const matchC = !category || p.category === category;
    const matchM = !modality || p.modality.includes(modality);
    return matchQ && matchC && matchM;
  });
}

export async function togglePhraseFavorite(id: string): Promise<{ favorite: boolean }> {
  await new Promise((r) => setTimeout(r, 50));
  const phrase = PHRASES_MOCK.find((p) => p.id === id);
  return { favorite: !phrase?.favorite };
}

export async function createPhrase(phrase: Omit<Phrase, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<Phrase> {
  await new Promise((r) => setTimeout(r, 100));
  return {
    ...phrase,
    id: `p-${Date.now()}`,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function searchRadLex(query: string): Promise<RadLexTerm[]> {
  await new Promise((r) => setTimeout(r, 50));
  const q = query.trim().toLowerCase();
  if (!q) return RADLEX_TERMS_MOCK.slice(0, 5);
  return RADLEX_TERMS_MOCK.filter((t) =>
    t.preferredName.toLowerCase().includes(q) ||
    t.preferredNameEn.toLowerCase().includes(q) ||
    t.synonyms.some((s) => s.toLowerCase().includes(q))
  );
}

// ============================================================
// 10. 历史报告 / 相似病例
// ============================================================
export async function getPriorReports(patientId: string): Promise<PriorReport[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return PRIOR_REPORTS_MOCK.filter((r) => r.patientId === patientId);
}

export async function getSimilarCases(reportId: string, topK = 5): Promise<SimilarCase[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return SIMILAR_CASES_MOCK.slice(0, topK);
}

export async function compareReports(reportIdA: string, reportIdB: string): Promise<{ added: string[]; removed: string[]; changed: { line: string; type: 'added' | 'removed' | 'modified' }[] }> {
  await new Promise((r) => setTimeout(r, 100));
  return {
    added: ['建议 3-6 个月后复查', 'PET-CT 检查'],
    removed: ['病灶较前缩小'],
    changed: [
      { line: '右肺上叶尖段见一不规则形软组织密度结节,大小约 18mm×15mm', type: 'modified' },
    ],
  };
}

// ============================================================
// 11. 草稿
// ============================================================
export async function listDrafts(reportId: string): Promise<ReportDraft[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return REPORT_DRAFTS_MOCK.filter((d) => d.reportId === reportId);
}

export async function saveDraft(draft: Omit<ReportDraft, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<ReportDraft> {
  await new Promise((r) => setTimeout(r, 200));
  return {
    ...draft,
    id: `draft-${Date.now()}`,
    version: (REPORT_DRAFTS_MOCK.find((d) => d.reportId === draft.reportId)?.version ?? 0) + 1,
    versionLabel: `v${(REPORT_DRAFTS_MOCK.find((d) => d.reportId === draft.reportId)?.version ?? 0) + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteDraft(id: string): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 100));
  return { success: true };
}

export async function resolveConflict(localDraftId: string, remoteDraftId: string, strategy: DraftVersionStrategy): Promise<{ success: boolean; mergedId?: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true, mergedId: localDraftId };
}

// ============================================================
// 12. 书写度量 / 预评分
// ============================================================
export async function getWritingMetrics(reportId: string): Promise<WritingMetrics> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { ...WRITING_METRICS_MOCK, reportId };
}

export async function getPreSubmitScore(reportId: string): Promise<PreSubmitScore> {
  await new Promise((r) => setTimeout(r, 300));
  return { ...PRE_SUBMIT_SCORE_MOCK, reportId, createdAt: new Date().toISOString() };
}

// ============================================================
// 13. 多模态 / 关键字高亮
// ============================================================
export async function getMultiModality(reportId: string): Promise<MultiModalityPanel | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return MULTI_MODALITY_MOCK;
}

export async function getKeywords(): Promise<KeywordHighlight[]> {
  await new Promise((r) => setTimeout(r, 50));
  return KEYWORD_HIGHLIGHTS_MOCK;
}

// ============================================================
// 14. 主聚合
// ============================================================
export async function getWritingContext(reportId: string): Promise<ReportWritingContext> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return { ...REPORT_WRITING_CONTEXT_MOCK, reportId };
}

export async function submitReport(reportId: string, payload: { finalScore: number; structured: Record<string, unknown>; html: string }): Promise<{ success: boolean; submittedAt: string; nextState: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true, submittedAt: new Date().toISOString(), nextState: 'submitted' };
}

// ============================================================
// 15. 拼写/语法检查(基础 mock)
// ============================================================
export async function spellCheck(text: string, lang: 'zh-CN' | 'en-US'): Promise<{ start: number; end: number; suggestion: string; type: 'spelling' | 'grammar' | 'punctuation' }[]> {
  await new Promise((r) => setTimeout(r, 100));
  const issues: { start: number; end: number; suggestion: string; type: 'spelling' | 'grammar' | 'punctuation' }[] = [];
  const t = text;
  if (lang === 'en-US') {
    const m = /\b(teh|recieve|seperate|definately)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = m.exec(t)) !== null) {
      issues.push({ start: match.index, end: match.index + match[0].length, suggestion: match[0].replace(/^./, (c) => c.toLowerCase()).replace('teh', 'the').replace('recieve', 'receive').replace('seperate', 'separate').replace('definately', 'definitely'), type: 'spelling' });
    }
  }
  return issues;
}

// ============================================================
// 16. 字段自动完成(RadLex 联想)
// ============================================================
export async function suggestFieldValues(fieldKey: string, query: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 50));
  return RADLEX_TERMS_MOCK
    .filter((t) => t.preferredName.toLowerCase().includes(query.toLowerCase()) || t.synonyms.some((s) => s.toLowerCase().includes(query.toLowerCase())))
    .map((t) => t.preferredName)
    .slice(0, 10);
}

// ============================================================
// 17. 公式计算
// ============================================================
export function evaluateFormula(formula: string, values: Record<string, number>): number {
  if (formula.startsWith('sum(')) {
    const keys = formula.replace(/^sum\((.*)\)$/, '$1').split('+').map((k) => k.trim());
    return keys.reduce((acc, k) => acc + (values[k] ?? 0), 0);
  }
  if (formula.includes('/') && formula.includes('*')) {
    return 0; // simplified mock
  }
  if (formula.includes('/')) {
    const [a, b] = formula.split('/').map((s) => s.trim());
    if (values[b] === 0) return 0;
    return (values[a] ?? 0) / (values[b] ?? 1);
  }
  return 0;
}

// ============================================================
// 18. 提交检查清单
// ============================================================
export const SUBMIT_CHECKLIST = [
  { id: 'cl-1', label: '患者信息完整', labelEn: 'Patient info complete', required: true },
  { id: 'cl-2', label: '检查技术描述', labelEn: 'Technique described', required: true },
  { id: 'cl-3', label: '影像所见完整', labelEn: 'Findings complete', required: true },
  { id: 'cl-4', label: '诊断意见明确', labelEn: 'Impression clear', required: true },
  { id: 'cl-5', label: '建议合理', labelEn: 'Recommendation reasonable', required: true },
  { id: 'cl-6', label: '关键图像标注', labelEn: 'Key image annotated', required: false },
  { id: 'cl-7', label: '危急值标注', labelEn: 'Critical annotated', required: false },
  { id: 'cl-8', label: '术语规范', labelEn: 'Terminology', required: true },
];

// ============================================================
// 19. 写作度量类型导出
// ============================================================
export type WritingServiceTypes = {
  Template: StructuredTemplate;
  Birads: BiradsAssessment;
  Pirads: PiradsAssessment;
  Recist: RecistResponse;
  Document: RichEditorDocument;
  AiDraft: AiDraftResult;
  Voice: VoiceDictationSession;
  Anchor: ImageAnchor;
  Phrase: Phrase;
  Draft: ReportDraft;
  TemplateType: ReportTemplate;
  Metrics: WritingMetrics;
  PreScore: PreSubmitScore;
};

// ============================================================
// A. 签名 (Signature)
// ============================================================

/**
 * 签署报告
 * @param reportId 报告 ID
 * @param signatureType 签署方式(ca/pin/biometric)
 * @param userId 用户 ID
 */
export async function signReport(reportId: string, signatureType: 'ca' | 'pin' | 'biometric', userId: string): Promise<SignatureRecord> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    id: `sig-${Date.now()}`,
    reportId,
    signerId: userId,
    role: 'attending',
    signatureType,
    status: 'signed',
    signedAt: new Date().toISOString(),
  };
}

/**
 * 验证报告签名
 * @param reportId 报告 ID
 */
export async function verifySignature(reportId: string): Promise<{ valid: boolean; signer: string; timestamp: string }> {
  await new Promise((r) => setTimeout(r, 250));
  return { valid: true, signer: '张医师', timestamp: new Date().toISOString() };
}

/**
 * 撤销签名
 * @param reportId 报告 ID
 * @param reason 撤销原因
 */
export async function revokeSignature(reportId: string, reason: string): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

/**
 * 联合签署
 * @param reportId 报告 ID
 * @param cosignerId 联合签署人 ID
 * @param role 角色(resident/attending)
 */
export async function cosignReport(reportId: string, cosignerId: string, role: 'resident' | 'attending'): Promise<SignatureRecord> {
  await new Promise((r) => setTimeout(r, 350));
  return {
    id: `cosig-${Date.now()}`,
    reportId,
    signerId: cosignerId,
    role: role,
    signatureType: 'pin',
    status: 'signed',
    signedAt: new Date().toISOString(),
  };
}

/**
 * 获取签名状态
 * @param reportId 报告 ID
 */
export async function getSignatureStatus(reportId: string): Promise<{ status: 'unsigned' | 'partially' | 'fully'; chain: Array<{ signer: string; role: string; time: string }> }> {
  await new Promise((r) => setTimeout(r, 200));
  return {
    status: 'fully',
    chain: [
      { signer: '李医师', role: 'resident', time: new Date(Date.now() - 3600000).toISOString() },
      { signer: '王主任', role: 'attending', time: new Date().toISOString() },
    ],
  };
}

// ============================================================
// B. 收费 (Charge Capture)
// ============================================================

/**
 * 获取收费项目列表
 * @param modality 模态
 * @param impressionKeywords 印象关键词
 */
export async function getChargeItems(modality: string, impressionKeywords: string[]): Promise<ChargeItem[]> {
  await new Promise((r) => setTimeout(r, 300));
  const items: ChargeItem[] = [
    { id: 'ci-1', code: '71250', system: 'cpt', description: 'CT 胸部平扫', relativeValue: 850, modality: 'CT', active: true },
    { id: 'ci-2', code: '71260', system: 'cpt', description: 'CT 胸部增强', relativeValue: 1200, modality: 'CT', active: true },
    { id: 'ci-3', code: 'C50.911', system: 'icd10', description: '乳腺恶性肿瘤', relativeValue: 0, modality: 'MG', active: true },
  ];
  return items.filter((item) => impressionKeywords.some((kw) => item.description.includes(kw)));
}

/**
 * 添加收费编码到报告
 * @param reportId 报告 ID
 * @param code 编码
 * @param system 系统(cpt/icd10)
 */
export async function addChargeCode(reportId: string, code: string, system: 'cpt' | 'icd10'): Promise<{ success: boolean; code: string; system: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true, code, system };
}

/**
 * 获取报告收费汇总
 * @param reportId 报告 ID
 */
export async function getChargeSummary(reportId: string): Promise<{ cptCodes: string[]; icd10Codes: string[]; totalEstimate: number }> {
  await new Promise((r) => setTimeout(r, 250));
  return { cptCodes: ['71250', '71260'], icd10Codes: ['C50.911', 'J18.9'], totalEstimate: 2050 };
}

// ============================================================
// C. 合规 (Compliance)
// ============================================================

/**
 * 检查报告合规性
 * @param reportId 报告 ID
 * @param reportText 报告文本
 */
export async function checkCompliance(reportId: string, reportText: string): Promise<ComplianceCheckResult> {
  await new Promise((r) => setTimeout(r, 400));
  const required = ['检查技术', '影像所见', '诊断意见', '患者信息', '签名'];
  const missing: string[] = [];
  if (!reportText.includes('技术')) missing.push('检查技术');
  if (!reportText.includes('所见')) missing.push('影像所见');
  if (!reportText.includes('诊断') && !reportText.includes('意见')) missing.push('诊断意见');
  return { passed: missing.length === 0, warnings: [], errors: missing };
}

/**
 * 获取模板必填字段
 * @param templateId 模板 ID
 */
export async function getRequiredFields(templateId: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 200));
  return ['findings', 'impression', 'technique', 'comparison'];
}

/**
 * 校验左右侧标注一致性
 * @param reportText 报告文本
 */
export async function validateLaterality(reportText: string): Promise<{ passed: boolean; errors: Array<{ side: 'left' | 'right'; required: string }> }> {
  await new Promise((r) => setTimeout(r, 300));
  const errors: Array<{ side: 'left' | 'right'; required: string }> = [];
  if (/左侧/.test(reportText) && !/右侧/.test(reportText)) errors.push({ side: 'right', required: '右侧描述' });
  return { passed: errors.length === 0, errors };
}

/**
 * 校验性别-检查类型一致性
 * @param reportText 报告文本
 * @param patientGender 患者性别
 * @param procedureType 检查类型
 */
export async function validateGenderProcedure(reportText: string, patientGender: string, procedureType: string): Promise<{ passed: boolean; warnings: string[] }> {
  await new Promise((r) => setTimeout(r, 250));
  const warnings: string[] = [];
  if (patientGender === 'male' && /乳腺|子宫/.test(reportText)) warnings.push('男性患者包含乳腺/子宫相关描述');
  if (patientGender === 'female' && /前列腺/.test(reportText)) warnings.push('女性患者包含前列腺相关描述');
  return { passed: warnings.length === 0, warnings };
}

// ============================================================
// D. 导出 (Export)
// ============================================================

/**
 * 导出为 PDF
 * @param reportId 报告 ID
 * @param options 导出选项
 */
export async function exportToPDF(reportId: string, options: { watermark?: string; signature?: boolean; embedImages?: boolean } = {}): Promise<{ url: string; filename: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return { url: `/exports/${reportId}/report.pdf`, filename: `report-${reportId}.pdf` };
}

/**
 * 导出为 Word
 * @param reportId 报告 ID
 * @param preserveTrackChanges 保留修订
 */
export async function exportToWord(reportId: string, preserveTrackChanges?: boolean): Promise<{ url: string; filename: string }> {
  await new Promise((r) => setTimeout(r, 400));
  return { url: `/exports/${reportId}/report.docx`, filename: `report-${reportId}.docx` };
}

/**
 * 导出为 DICOM SR
 * @param reportId 报告 ID
 */
export async function exportToDicomSR(reportId: string): Promise<{ srUid: string; templateId: string }> {
  await new Promise((r) => setTimeout(r, 350));
  return { srUid: `1.2.840.10008.5.1.4.1.1.88.${Date.now()}`, templateId: 'IDC-2003' };
}

/**
 * 导出为 FHIR 资源
 * @param reportId 报告 ID
 */
export async function exportToFHIR(reportId: string): Promise<{ diagnosticReport: any; imagingStudy: any }> {
  await new Promise((r) => setTimeout(r, 450));
  return {
    diagnosticReport: {
      resourceType: 'DiagnosticReport',
      id: reportId,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '18748-4', display: 'CT Chest' }] },
    },
    imagingStudy: {
      resourceType: 'ImagingStudy',
      id: `study-${reportId}`,
      modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'CT' }],
    },
  };
}

/**
 * 导出为 HL7 消息
 * @param reportId 报告 ID
 * @param destination 目标地址
 */
export async function exportToHL7(reportId: string, destination: string): Promise<{ ackCode: string; messageId: string }> {
  await new Promise((r) => setTimeout(r, 300));
  return { ackCode: 'AA', messageId: `hl7-${reportId}-${Date.now()}` };
}

// ============================================================
// E. 协作 (Collaboration)
// ============================================================

/**
 * 锁定报告防止并发编辑
 * @param reportId 报告 ID
 * @param userId 用户 ID
 */
export async function lockReport(reportId: string, userId: string): Promise<{ locked: boolean; lockedBy: string; lockedAt: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { locked: true, lockedBy: userId, lockedAt: new Date().toISOString() };
}

/**
 * 解锁报告
 * @param reportId 报告 ID
 * @param userId 用户 ID
 */
export async function unlockReport(reportId: string, userId: string): Promise<{ unlocked: boolean }> {
  await new Promise((r) => setTimeout(r, 200));
  return { unlocked: true };
}

/**
 * 获取当前活跃编辑者
 * @param reportId 报告 ID
 */
export async function getActiveEditors(reportId: string): Promise<Array<{ userId: string; name: string; role: string; entered: string }>> {
  await new Promise((r) => setTimeout(r, 250));
  return [
    { userId: 'u-001', name: '陈医师', role: 'resident', entered: new Date(Date.now() - 600000).toISOString() },
    { userId: 'u-002', name: '李主任', role: 'attending', entered: new Date(Date.now() - 300000).toISOString() },
  ];
}

// ============================================================
// F. 危急值 (Critical Value)
// ============================================================

/**
 * 内联检查文本中是否包含危急值模式
 * @param text 报告文本
 * @param modality 模态
 */
export async function inlineCheckCritical(text: string, modality: string): Promise<{ critical: boolean; findings: string[]; riskLevel: 'low' | 'medium' | 'high' }> {
  await new Promise((r) => setTimeout(r, 350));
  const findings: string[] = [];
  const patterns: { regex: RegExp; label: string; risk: 'low' | 'medium' | 'high' }[] = [
    { regex: /气胸|张力性气胸/i, label: '气胸', risk: 'high' },
    { regex: /主动脉夹层/i, label: '主动脉夹层', risk: 'high' },
    { regex: /肺栓塞|肺动脉栓塞/i, label: '肺栓塞', risk: 'high' },
    { regex: /大量心包积液/i, label: '大量心包积液', risk: 'high' },
    { regex: /活动性出血/i, label: '活动性出血', risk: 'high' },
    { regex: /脑出血|颅内出血/i, label: '脑出血', risk: 'high' },
    { regex: /急性肺水肿/i, label: '急性肺水肿', risk: 'medium' },
    { regex: /肠梗阻/i, label: '肠梗阻', risk: 'medium' },
  ];
  for (const p of patterns) {
    if (p.regex.test(text)) findings.push(p.label);
  }
  const riskLevel: 'low' | 'medium' | 'high' = findings.length > 0 ? 'high' : 'low';
  return { critical: findings.length > 0, findings, riskLevel };
}

/**
 * 标记报告为危急值
 * @param reportId 报告 ID
 * @param finding 危急发现
 * @param severity 严重程度
 */
export async function flagReportCritical(reportId: string, finding: string, severity: 'warning' | 'critical'): Promise<{ success: boolean; flaggedAt: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true, flaggedAt: new Date().toISOString() };
}

/**
 * 取消危急值标记
 * @param reportId 报告 ID
 */
export async function unflagReportCritical(reportId: string): Promise<{ unflag: boolean }> {
  await new Promise((r) => setTimeout(r, 200));
  return { unflag: true };
}

// ============================================================
// G. 打印 (Print)
// ============================================================

/**
 * 获取可用打印布局
 */
export async function getPrintLayouts(): Promise<Array<{ id: string; name: string; description: string; columns: 1 | 2 }>> {
  await new Promise((r) => setTimeout(r, 200));
  return [
    { id: 'layout-1', name: '标准单栏', description: '单栏标准布局', columns: 1 },
    { id: 'layout-2', name: '双栏对比', description: '双栏左右对比布局', columns: 2 },
    { id: 'layout-3', name: '精简单栏', description: '精简内容单栏', columns: 1 },
  ];
}

/**
 * 准备打印文档
 * @param reportId 报告 ID
 * @param layoutId 布局 ID
 */
export async function preparePrint(reportId: string, layoutId: string): Promise<{ pdfUrl: string; pageCount: number }> {
  await new Promise((r) => setTimeout(r, 400));
  return { pdfUrl: `/exports/${reportId}/print-${layoutId}.pdf`, pageCount: Math.floor(Math.random() * 5) + 1 };
}

// ============================================================
// H. 集成 (Integration)
// ============================================================

/**
 * 获取 AI 草稿建议
 * @param reportId 报告 ID
 * @param contextText 上下文文本
 */
export async function getAiDraftSuggestions(reportId: string, contextText: string): Promise<Array<{ text: string; confidence: number; source: string }>> {
  await new Promise((r) => setTimeout(r, 500));
  return [
    { text: '双肺纹理清晰,未见实变或渗出', confidence: 0.92, source: 'AI-base-v2' },
    { text: '纵隔无移位,大血管形态正常', confidence: 0.85, source: 'AI-base-v2' },
    { text: '建议结合临床进一步检查', confidence: 0.78, source: 'template-library' },
  ];
}

/**
 * 搜索相似历史报告
 * @param reportId 报告 ID
 * @param patientId 患者 ID
 * @param modality 模态
 */
export async function searchPriorSimilar(reportId: string, patientId: string, modality: string): Promise<Array<{ reportId: string; date: string; findings: string; similarity: number }>> {
  await new Promise((r) => setTimeout(r, 350));
  return [
    { reportId: `prior-${Date.now()}-1`, date: '2025-12-10', findings: '右肺上叶磨玻璃结节', similarity: 0.87 },
    { reportId: `prior-${Date.now()}-2`, date: '2025-06-22', findings: '双肺散在纤维条索', similarity: 0.65 },
  ];
}

/**
 * 获取阅读度量
 * @param reportId 报告 ID
 */
export async function getReadingMetrics(reportId: string): Promise<{ readingTimeSec: number; wordCount: number; signatureTime?: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { readingTimeSec: 180, wordCount: 650, signatureTime: new Date().toISOString() };
}

// ============================================================
// I. 版本 (Version)
// ============================================================

/**
 * 比较两个版本差异
 * @param reportId 报告 ID
 * @param versionA 版本 A
 * @param versionB 版本 B
 */
export async function diffReportVersions(reportId: string, versionA: number, versionB: number): Promise<{ additions: string[]; deletions: string[]; unchanged: string[] }> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    additions: ['右肺下叶见一结节影,大小约 8mm×6mm', '建议短期复查'],
    deletions: ['右肺下叶结节影不明显'],
    unchanged: ['双肺纹理清晰', '纵隔无移位'],
  };
}

/**
 * 回滚到指定版本
 * @param reportId 报告 ID
 * @param targetVersion 目标版本号
 */
export async function rollbackToVersion(reportId: string, targetVersion: number): Promise<{ success: boolean; newVersion: number }> {
  await new Promise((r) => setTimeout(r, 350));
  return { success: true, newVersion: targetVersion + 1 };
}
