// [v3.0.6.11-7] /api/v1/cds MSW handlers
// [G005 W2-B] 补全 6 方法覆盖: listGuidelines / getGuideline / createGuideline /
//             listAlerts / acknowledgeAlert / getDoseMonitoring
// [G005 W5-Expand] 演示数据扩容 (跨表自洽 + 确定性种子, 全量 ID 取自 store/主数据):
//   - 指南库 40 条 GL001-GL040 (肺结节 Lung-RADS / 甲状腺 TI-RADS / 偶发发现 / 造影与妊娠 / 剂量告警)
//   - 规则库 40 条 CDR001-CDR040 (与指南 1:1 关联; /cds/rules + /cds/management 共用)
//   - 告警 30 条 AL001-AL030 (patientId/examId/reportId 来自 store.list('exams'), 含已确认/待确认;
//     EXAM_REPORT_PRE 形状无独立 examId, 该池以 reportId 作为检查键)
//   - 剂量监测 30 例 (每位患者 1 条 RDSR 剂量记录 + 监测行, 记录引用 rdsrId/studyUid)
// 页面: /cds/guidelines (GuidelineLibraryPage), /cds/alerts (AlertCenterPage),
//       /cds/dose-monitoring (CdsDoseMonitoringPage), /cds/rules|/cds/management (CdsManagementPage),
//       /cds/statistics (CdsStatisticsPage)
import { http, HttpResponse, delay } from 'msw';
import { list, create, update } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/cds';

// ── 确定性随机: mulberry32 + FNV-1a 标签种子 (固定 tag → 固定序列, 无 Math.random) ──
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tagSeed(tag: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const rngFor = (tag: string) => mulberry32(tagSeed(tag));
const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const round1 = (v: number) => Math.round(v * 10) / 10;

let delaySeq = 0;
const delayMs = (min = 50, max = 150) => {
  const rnd = mulberry32(tagSeed(`cds-delay-${delaySeq++}`));
  return Math.floor(min + rnd() * (max - min));
};

const safeList = <T>(key: string): T[] => {
  try { return list<T>(key as any); } catch { return []; }
};

// ── store.exams 字段归一 (EXAM_REPORT_PRE / unified-exams / initialRadiologyExams 三种形状) ──
const examKey = (e: any) => String(e?.examId ?? e?.id ?? e?.reportId ?? '');
const reportKey = (e: any) => String(e?.reportId ?? e?.id ?? '');
// 检查名称: store 两种形状的 examItem/examItemName 与 modality 偶有不一致 (unified 种子噪声),
// 一致时用原始名称, 不一致时退回 "模态+真实部位" 组合, 保证展示不失真
const MODALITY_MATCHERS: Record<string, RegExp> = {
  CT: /CT|CTA/i,
  MR: /MR|磁共振/i,
  DR: /DR|平片|正侧位|轴位|斜位/i,
  US: /超声|彩超|多普勒|US/i,
  MG: /钼靶|乳腺|MG/i,
  DSA: /DSA|造影/i,
  'PET-CT': /PET/i,
  介入: /介入|穿刺/i,
  CR: /CR|平片/i,
};
const examLabel = (e: any): string => {
  const modality = String(e?.modality ?? '');
  const bodyPart = String(e?.bodyPart ?? '');
  const raw = String(e?.examItem ?? e?.examItemName ?? '');
  const re = MODALITY_MATCHERS[modality];
  if (raw && (!re || re.test(raw))) return raw;
  return `${modality}${bodyPart}` || raw || `${modality || '影像'}检查`;
};
const examAt = (e: any): string | undefined =>
  e?.examAt ?? e?.createdAt ?? (e?.examDate ? `${e.examDate}T00:00:00.000Z` : undefined);
const examAge = (e: any): number => Number(e?.patientAge ?? e?.age ?? 0) || 0;
const examGender = (e: any): string => String(e?.patientGender ?? e?.gender ?? '');

// 检查 → 真实报告 ID (unified 报告池 examId→reportId; EXAM_REPORT_PRE 自带 reportId; 兜底检查键)
function makeReportIdResolver(): (exam: any) => string {
  const byExam = new Map<string, string>();
  for (const r of safeList<any>('reports')) {
    const rid = String(r?.reportId ?? r?.id ?? '');
    const eid = String(r?.examId ?? '');
    if (rid && eid && !byExam.has(eid)) byExam.set(eid, rid);
  }
  return (exam: any) =>
    String(exam?.reportId ?? '') || byExam.get(examKey(exam)) || reportKey(exam);
}

// ════════════════════════════════════════════════════════════════════
// 1. 指南库种子: 40 条 (每类 8 条) — 与 CdsGuidelineDto 对齐
// ════════════════════════════════════════════════════════════════════
type GuidelineRow = {
  name: string;
  category: string;
  source: string;
  description: string;
  ruleType: 'appropriateness' | 'pathway' | 'contrast' | 'drug';
  status?: 'active' | 'draft' | 'archived';
};

const GUIDELINE_ROWS: GuidelineRow[] = [
  // ── 肺结节 (Lung-RADS / Fleischner) 8 条 — ruleType: pathway ──
  { name: '肺结节 Lung-RADS 分级与随访', category: '肺结节', source: 'ACR Lung-RADS v1.1', ruleType: 'pathway', description: '低剂量 CT 肺癌筛查结节按 Lung-RADS 0-4X 分级, 给出复查 / PET-CT / 穿刺活检建议' },
  { name: '肺结节 Fleischner 实体结节随访', category: '肺结节', source: 'Fleischner Society 2017', ruleType: 'pathway', description: '非筛查场景实体结节按大小与风险分层给出 3 / 6 / 12 个月复查间隔' },
  { name: '亚实性结节与磨玻璃结节 (GGN) 管理', category: '肺结节', source: 'Fleischner Society 2017', ruleType: 'pathway', description: '纯磨玻璃与部分实性结节的最小随访周期、实性成分测量与停止随访条件' },
  { name: '肺结节 8mm 以下低危结节观察', category: '肺结节', source: 'ACR Lung-RADS v1.1', ruleType: 'pathway', description: '低危小结节建议年度 LDCT 复查, 避免低收益 PET-CT 与过早穿刺' },
  { name: '肺结节 PET-CT 适应症 (实性成分 ≥8mm)', category: '肺结节', source: 'ACR Appropriateness Criteria', ruleType: 'pathway', description: '实性成分 ≥8mm 且代谢增高者行 PET-CT 分期, 用于治疗前评估' },
  { name: '肺癌筛查 LDCT 准入与剂量约束', category: '肺结节', source: 'NCCN Guideline / Image Gently', ruleType: 'pathway', description: '高危人群 (≥50 岁, 吸烟 ≥20 包年) 准入条件与筛查用 CTDIvol 上限', status: 'draft' },
  { name: '肺结节 AI/CAD 结果人工复核', category: '肺结节', source: 'RSNA AI 清单 / ACR DSAS', ruleType: 'pathway', description: 'AI 提示的结节须经放射医师复核测量后方可写入正式报告', status: 'draft' },
  { name: '肺结节结构化报告与随访建议模板', category: '肺结节', source: 'RSNA 结构化报告共识', ruleType: 'pathway', description: '报告须包含结节位置 / 最大径测量 / Lung-RADS 分级 / 随访间隔建议' },

  // ── 甲状腺 TI-RADS 8 条 — ruleType: appropriateness ──
  { name: '甲状腺结节 TI-RADS 分级', category: '甲状腺', source: 'ACR TI-RADS (2017)', ruleType: 'appropriateness', description: '按成分 / 回声 / 形态 / 边界 / 强回声五项打分, 输出 TR1-TR5 分级' },
  { name: '甲状腺结节 FNA 穿刺指征', category: '甲状腺', source: 'ACR TI-RADS', ruleType: 'appropriateness', description: 'TR4 结节 ≥2.5cm 或 TR5 结节 ≥1.0cm 建议超声引导下细针穿刺' },
  { name: '甲状腺微小癌 (<1cm) 主动监测', category: '甲状腺', source: 'ATA 2015 指南', ruleType: 'appropriateness', description: '低危微小乳头状癌可在手术与主动监测间选择, 需记录随访超声' },
  { name: '甲状腺超声弹性成像补充价值', category: '甲状腺', source: 'EFSUMB 指南', ruleType: 'appropriateness', description: '硬度评分辅助良恶性判断, 不得单独作为手术决策依据', status: 'archived' },
  { name: '甲状腺结节复查间隔 (TR1-TR5)', category: '甲状腺', source: 'ACR TI-RADS', ruleType: 'appropriateness', description: 'TR1-2 年度复查, TR3 1-2 年, TR4-5 6-12 个月复查并记录尺寸变化' },
  { name: '甲状腺结节合并桥本甲状腺炎报告规范', category: '甲状腺', source: 'ATA 2015 指南', ruleType: 'appropriateness', description: '背景甲状腺炎征象与结节对照描述, 同时评估颈部淋巴结' },
  { name: '儿童与青少年甲状腺结节评估', category: '甲状腺', source: 'ATA Pediatric Guideline', ruleType: 'appropriateness', description: '儿童结节恶性风险更高, FNA 阈值下调并建议儿科内分泌随访' },
  { name: '甲状腺超声造影 (CEUS) 应用', category: '甲状腺', source: '甲状腺影像 CEUS 专家共识', ruleType: 'appropriateness', description: '造影模式辅助鉴别, 需记录达峰时间、增强强度与周围腺体对照', status: 'draft' },

  // ── 偶发发现 8 条 — ruleType: pathway ──
  { name: '肾上腺偶发瘤 (AI) 影像随访', category: '偶发发现', source: 'ACR Incidental Findings White Paper', ruleType: 'pathway', description: '按最大径与 CT 值决定 6-12 个月复查或内分泌功能评估' },
  { name: '肾脏囊肿 Bosniak 分级与随访', category: '偶发发现', source: 'ACR / Bosniak 2019', ruleType: 'pathway', description: 'I / II 观察, IIF 6-12 个月复查, III / IV 建议手术评估' },
  { name: '垂体偶发微腺瘤处理', category: '偶发发现', source: 'ACR White Paper / 内分泌共识', ruleType: 'pathway', description: '<10mm 无功能微腺瘤建议垂体增强 MRI 随访并查激素水平' },
  { name: '椎体血管瘤与偶发骨病变报告', category: '偶发发现', source: 'ACR Incidental Findings', ruleType: 'pathway', description: '无症状血管瘤常规随访, 有疼痛或破坏性征象者需 MRI 进一步评估' },
  { name: '冠脉钙化积分与偶发心脏所见', category: '偶发发现', source: 'SCCT 专家共识', ruleType: 'pathway', description: 'Agatston 评分、心影增大等偶发所见的分级报告与风险提示' },
  { name: '肝脏偶发灶 LI-RADS 分类', category: '偶发发现', source: 'ACR LI-RADS v2018', ruleType: 'pathway', description: '高危人群肝内病灶按 LR-1~LR-5 分类并给出随访 / 增强复查路径' },
  { name: '胰腺偶发囊性病变随访', category: '偶发发现', source: 'ACR / 国际福冈共识', ruleType: 'pathway', description: '依据大小、壁结节、主胰管扩张决定复查间隔或建议 EUS' },
  { name: '偶发甲状腺 / 淋巴结 / 乳腺结节转诊', category: '偶发发现', source: 'ACR Incidental Findings', ruleType: 'pathway', description: '非目标部位结节的转诊路径、随访建议与患者告知模板', status: 'draft' },

  // ── 造影与妊娠 8 条 — contrast 4 / drug 4 ──
  { name: '对比剂使用前肾功能 (eGFR) 评估', category: '造影与妊娠', source: 'ACR Manual on Contrast Media 2024', ruleType: 'contrast', description: 'eGFR <30 mL/min/1.73m² 禁用碘对比剂或水化后慎用, 自动触发检验医嘱' },
  { name: '碘对比剂过敏史分级与预处理', category: '造影与妊娠', source: 'ACR Manual on Contrast Media', ruleType: 'drug', description: '既往中重度过敏者按糖皮质激素预处理方案给药并备抢救设备' },
  { name: '钆对比剂 eGFR<30 风险与剂量限制', category: '造影与妊娠', source: 'ACR Manual on Contrast Media', ruleType: 'contrast', description: '优先线性非离子型钆剂, 单次剂量 ≤0.1mmol/kg 并避免重复扫描' },
  { name: '二甲双胍与对比剂检查停药流程', category: '造影与妊娠', source: 'ACR / FDA 指导原则', ruleType: 'drug', description: '增强检查前后 48 小时停用二甲双胍, 检查后复查肾功能再恢复' },
  { name: '对比剂外渗预防与处置', category: '造影与妊娠', source: 'ACR Manual on Contrast Media', ruleType: 'drug', description: '按血管条件选择套管针与注射速率, 外渗按分级处置并记录随访' },
  { name: '妊娠期碘对比剂检查风险评估', category: '造影与妊娠', source: 'ACR / ACOG', ruleType: 'contrast', description: '非必需增强检查延至产后, 必须检查时签署知情同意并记录孕周' },
  { name: '妊娠期 MRI 安全性 (非钆、孕早期)', category: '造影与妊娠', source: 'ACR Manual on Contrast Media (MR)', ruleType: 'contrast', description: '避免孕早期非必要检查, 妊娠期禁用钆对比剂并规避高 SAR 序列' },
  { name: '哺乳期钆对比剂与母乳喂养', category: '造影与妊娠', source: 'ACR Manual on Contrast Media', ruleType: 'drug', description: '钆对比剂无需停止哺乳, 报告中给出循证说明避免患者自行断乳', status: 'archived' },

  // ── 剂量告警 8 条 — ruleType: appropriateness ──
  { name: 'CT 剂量 DLP/CTDIvol 超 DRL 告警', category: '剂量告警', source: '国家 DRLs 2023 / IAEA', ruleType: 'appropriateness', description: '部位 DLP 超参考水平 150% 触发严重告警, 需复核扫描范围与重建核' },
  { name: '儿童 CT 低剂量协议与年龄阈值', category: '剂量告警', source: 'Image Gently Campaign', ruleType: 'appropriateness', description: '<18 岁按年龄 / 体重下调 kV 与 mAs, DLP 上限 500 mGy·cm' },
  { name: '患者 30 日 / 1 年累积剂量监测', category: '剂量告警', source: 'ICRP 103 / 国家辐射防护标准', ruleType: 'appropriateness', description: '累积 DLP 接近年剂量约束时提示替代检查 (超声 / MR)' },
  { name: '分部位 DLP 阈值 (头 / 胸 / 腹 / 盆)', category: '剂量告警', source: '国家 DRLs 2023', ruleType: 'appropriateness', description: '头部 1000 / 胸部 500 / 腹部 800 / 盆腔 600 mGy·cm 分部位阈值' },
  { name: 'DR / MG 曝光剂量与 AGD 监测', category: '剂量告警', source: '国家 DRLs 2023 / ACR', ruleType: 'appropriateness', description: '乳腺平均腺体剂量 AGD ≤6 mGy, DR 管电压与滤过配置合规性检查' },
  { name: '介入 / DSA 透视时间与 DAP 告警', category: '剂量告警', source: 'IAEA 安全标准', ruleType: 'appropriateness', description: '透视时间 >30min 或剂量面积乘积 >3000 时提示复核并记录皮肤剂量', status: 'draft' },
  { name: '孕妇腹部 / 盆腔 X 线检查剂量核查', category: '剂量告警', source: 'ICRP / ACR Appropriateness', ruleType: 'appropriateness', description: '孕期检查须记录孕周与腹部剂量, 优先选择超声 / MRI 替代' },
  { name: '报告自动附带剂量信息 (RDSR)', category: '剂量告警', source: 'DICOM PS3.17 RDSR / AAPM', ruleType: 'appropriateness', description: '报告自动写入 CTDIvol / DLP / SSDE 并与剂量监测、告警联动', status: 'draft' },
];

const GL_BASE_MS = Date.UTC(2026, 6, 20);

const SEED_GUIDELINES: any[] = GUIDELINE_ROWS.map((row, i) => ({
  id: `GL${pad(i + 1)}`,
  name: row.name,
  category: row.category,
  version: row.status === 'draft' ? '1.0' : '2025',
  status: row.status ?? 'active',
  updatedAt: new Date(GL_BASE_MS - i * 2 * 86400000).toISOString(),
  description: row.description,
  source: row.source,
  ruleType: row.ruleType,
}));

// ════════════════════════════════════════════════════════════════════
// 2. 规则库种子: 40 条 CDR001-CDR040 (与指南 1:1 关联) — 与 CdsRuleSummary 对齐
//    CDR001-004 保留既有名称 (与 /cds/management 审计条目自洽), 其余按指南派生
// ════════════════════════════════════════════════════════════════════
const LEGACY_RULES: any[] = [
  { id: 'CDR001', type: 'appropriateness', name: '辐射剂量超限拦截', guidelineId: 'GL033', isActive: true, version: '1.2', updatedTime: '2026-07-20T08:00:00.000Z', usageCount: 128 },
  { id: 'CDR002', type: 'pathway', name: '胸部CT肺结节随访路径', guidelineId: 'GL001', isActive: true, version: '2.0', updatedTime: '2026-07-18T08:00:00.000Z', usageCount: 96 },
  { id: 'CDR003', type: 'contrast', name: '造影剂适应症检查', guidelineId: 'GL025', isActive: true, version: '1.1', updatedTime: '2026-07-15T08:00:00.000Z', usageCount: 243 },
  { id: 'CDR004', type: 'drug', name: '药物交互检查', guidelineId: 'GL028', isActive: false, version: '1.0', updatedTime: '2026-06-30T08:00:00.000Z', usageCount: 12 },
];

const LEGACY_GUIDELINE_IDS = new Set<string>(LEGACY_RULES.map((r) => r.guidelineId));

const SEED_RULES: any[] = (() => {
  const rows: any[] = LEGACY_RULES.map((r) => ({ ...r }));
  for (const g of SEED_GUIDELINES) {
    if (LEGACY_GUIDELINE_IDS.has(g.id)) continue;
    rows.push({
      id: `CDR${pad(rows.length + 1)}`,
      type: g.ruleType,
      name: g.name,
      guidelineId: g.id,
      isActive: g.status === 'active',
      version: g.version,
      updatedTime: g.updatedAt,
      usageCount: 12 + (tagSeed(g.id) % 240),
    });
  }
  return rows;
})();

const RULE_BY_GUIDELINE = new Map<string, any>(SEED_RULES.map((r) => [r.guidelineId, r]));

// ── /cds/management 审计 (前 4 条与既有条目一致, 后 6 条引用规则真实名称) ──
const AUDIT_SPECS: Array<{ idx: number; action: string; performedBy: string; performedAt: string; details: (r: any) => string }> = [
  { idx: 1, action: 'updated', performedBy: '张主任', performedAt: '2026-07-18T09:00:00.000Z', details: () => '更新肺结节随访周期' },
  { idx: 0, action: 'activated', performedBy: '张主任', performedAt: '2026-07-16T09:00:00.000Z', details: () => '启用辐射剂量超限拦截' },
  { idx: 3, action: 'deactivated', performedBy: '李医生', performedAt: '2026-07-01T09:00:00.000Z', details: () => '药物库升级后停用旧规则' },
  { idx: 2, action: 'created', performedBy: '张主任', performedAt: '2026-06-25T09:00:00.000Z', details: () => '创建造影剂适应症检查规则' },
  { idx: 12, action: 'updated', performedBy: '李医生', performedAt: '2026-06-18T09:00:00.000Z', details: (r) => `更新「${r.name}」触发阈值` },
  { idx: 20, action: 'created', performedBy: '王主任', performedAt: '2026-06-12T09:00:00.000Z', details: (r) => `新增「${r.name}」并纳入质控抽查` },
  { idx: 8, action: 'activated', performedBy: '陈医生', performedAt: '2026-06-05T09:00:00.000Z', details: (r) => `启用「${r.name}」` },
  { idx: 28, action: 'updated', performedBy: '张主任', performedAt: '2026-05-28T09:00:00.000Z', details: (r) => `同步「${r.name}」到报告结构化模板` },
  { idx: 33, action: 'overridden', performedBy: '李医生', performedAt: '2026-05-20T09:00:00.000Z', details: (r) => `记录「${r.name}」人工覆盖原因: 临床指征充分` },
  { idx: 36, action: 'deactivated', performedBy: '王主任', performedAt: '2026-05-12T09:00:00.000Z', details: (r) => `暂停「${r.name}」等待专家共识更新` },
];

const SEED_AUDIT: any[] = AUDIT_SPECS.map((spec, i) => {
  const rule = SEED_RULES[spec.idx] ?? SEED_RULES[0];
  return {
    id: `AUD-${pad(i + 1)}`,
    ruleId: rule.id,
    ruleType: rule.type,
    action: spec.action,
    performedBy: spec.performedBy,
    performedAt: spec.performedAt,
    details: spec.details(rule),
  };
});

// ════════════════════════════════════════════════════════════════════
// 3. 剂量监测种子: 每位患者 1 条 RDSR 剂量记录 + 1 条监测行 (30 位患者)
// ════════════════════════════════════════════════════════════════════
const RADIATION_MODALITIES = new Set(['CT', 'DR', 'MG', 'DSA', 'PET-CT', '介入', 'CR']);

const SEED_DOSE_THRESHOLDS: any[] = [
  { id: 'TH-CT', modality: 'CT', dlpLimit: 1500, unit: 'mGy·cm', level: '常规成人' },
  { id: 'TH-CT-PED', modality: 'CT', dlpLimit: 500, unit: 'mGy·cm', level: '儿童 (<18岁)' },
  { id: 'TH-DR', modality: 'DR', dlpLimit: 5, unit: 'mGy·cm', level: '常规' },
  { id: 'TH-MG', modality: 'MG', dlpLimit: 60, unit: 'mGy·cm', level: 'AGD 参考' },
  { id: 'TH-DSA', modality: 'DSA', dlpLimit: 3000, unit: 'mGy·cm', level: '透视累计' },
  { id: 'TH-IR', modality: '介入', dlpLimit: 3000, unit: 'mGy·cm', level: '透视累计' },
  { id: 'TH-PET', modality: 'PET-CT', dlpLimit: 1200, unit: 'mGy·cm', level: '常规' },
];

function thresholdFor(modality: string, age: number): { id: string; limit: number } {
  if (modality === 'CT') {
    return age > 0 && age < 18
      ? { id: 'TH-CT-PED', limit: 500 }
      : { id: 'TH-CT', limit: 1500 };
  }
  switch (modality) {
    case 'DR': return { id: 'TH-DR', limit: 5 };
    case 'MG': return { id: 'TH-MG', limit: 60 };
    case 'DSA': return { id: 'TH-DSA', limit: 3000 };
    case '介入': return { id: 'TH-IR', limit: 3000 };
    case 'PET-CT': return { id: 'TH-PET', limit: 1200 };
    default: return { id: 'TH-CT', limit: 1500 };
  }
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function pickDistinctPatients<T>(pool: T[], n: number, tag: string, idOf: (v: T) => string): T[] {
  const shuffled = shuffle(pool, rngFor(tag));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of shuffled) {
    const key = idOf(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
    if (out.length >= n) break;
  }
  if (out.length < n) {
    for (const item of shuffled) {
      if (out.includes(item)) continue;
      out.push(item);
      if (out.length >= n) break;
    }
  }
  return out;
}

// RDSR 剂量值 (按模态/年龄分层, 每条记录用固定 tag 派生 → 可复现)
function buildRdsrValues(modality: string, age: number, seedTag: string) {
  const rnd = rngFor(seedTag);
  let ctdiVol = 0;
  let dlp = 0;
  let ssde = 0;
  let kerma = 0;
  const pediatric = modality === 'CT' && age > 0 && age < 18;
  if (modality === 'CT') {
    ctdiVol = +(pediatric ? 2 + rnd() * 6 : 6 + rnd() * 22).toFixed(1);
    dlp = Math.round(ctdiVol * (pediatric ? 30 + rnd() * 70 : 35 + rnd() * 95));
    ssde = +(pediatric ? 2 + rnd() * 4 : 5 + rnd() * 18).toFixed(1);
    kerma = +(ctdiVol * (0.6 + rnd() * 0.8)).toFixed(1);
  } else if (modality === 'DR' || modality === 'CR') {
    dlp = +(0.4 + rnd() * 4.4).toFixed(2);
    kerma = +(0.1 + rnd() * 0.6).toFixed(2);
  } else if (modality === 'MG') {
    dlp = +(20 + rnd() * 55).toFixed(1);
    kerma = +(3 + rnd() * 3.5).toFixed(2); // AGD (mGy)
  } else if (modality === 'DSA' || modality === '介入') {
    ctdiVol = +(20 + rnd() * 40).toFixed(1);
    dlp = Math.round(800 + rnd() * 3600);
    kerma = +(20 + rnd() * 60).toFixed(1);
    ssde = +(8 + rnd() * 20).toFixed(1);
  } else {
    ctdiVol = +(8 + rnd() * 20).toFixed(1);
    dlp = Math.round(300 + rnd() * 900);
  }
  return { ctdiVol, dlp, ssde, kerma, pediatric };
}

type DoseSeed = { records: any[]; byPatient: Map<string, any> };

let doseCache: { size: number; seed: DoseSeed } | null = null;

function getDoseSeed(): DoseSeed {
  const exams = safeList<any>('exams');
  if (doseCache && doseCache.size === exams.length) return doseCache.seed;
  const pool = exams.filter((e: any) => e && e.patientId && RADIATION_MODALITIES.has(String(e.modality ?? '')));
  const chosen = pickDistinctPatients(pool, 30, 'cds-dose-pick', (e: any) => String(e.patientId));
  const resolveReportId = makeReportIdResolver();
  const records = chosen.map((exam: any, i: number) => {
    const modality = String(exam.modality ?? 'CT');
    const age = examAge(exam);
    const values = buildRdsrValues(modality, age, `cds-dose-${i}`);
    const thr = thresholdFor(modality, age);
    const patientId = String(exam.patientId);
    const when = examAt(exam) ?? '2026-08-01T09:30:00.000Z';
    return {
      id: `DOSE-${pad(i + 1)}`,
      rdsrId: `RDSR-${pad(i + 1)}`,
      source: 'RDSR',
      patientId,
      patientName: String(exam.patientName ?? '未知患者'),
      examId: examKey(exam),
      reportId: resolveReportId(exam),
      examType: examLabel(exam),
      modality,
      bodyPart: String(exam.bodyPart ?? ''),
      patientAge: age,
      ageGroup: values.pediatric ? '儿童' : '成人',
      ctdiVol: values.ctdiVol,
      dlp: values.dlp,
      kerma: values.kerma,
      ssde: values.ssde,
      threshold: thr.limit,
      thresholdId: thr.id,
      status: values.dlp > thr.limit ? 'exceeded' : 'normal',
      studyUid: `1.2.840.13619.7.${tagSeed(`${examKey(exam)}-${modality}`)}.${pad(i + 1)}`,
      date: when,
      recordedAt: when,
    };
  });
  const byPatient = new Map<string, any>();
  for (const r of records) byPatient.set(r.patientId, r);
  const seed = { records, byPatient };
  doseCache = { size: exams.length, seed };
  return seed;
}

// ════════════════════════════════════════════════════════════════════
// 4. 告警种子: 30 条, 挂真实 patientId/examId/reportId + 指南/规则引用
// ════════════════════════════════════════════════════════════════════
const ALERT_TYPES = ['肺结节随访', '甲状腺分级', '偶发发现', '造影与妊娠', '剂量告警'];
const SEVERITIES = ['critical', 'warning', 'info'] as const;
const ALERT_BASE_MS = Date.UTC(2026, 7, 1, 9, 30, 0);
const ACK_BY = ['张主任', '李医生', '王主任', '陈医生'];

function alertMessage(group: number, exam: any, rnd: () => number, dose: any): string {
  const item = examLabel(exam);
  const modality = String(exam.modality ?? 'CT');
  const age = examAge(exam);
  const gender = examGender(exam);
  switch (group) {
    case 0: {
      const mm = (2 + rnd() * 9).toFixed(1);
      const lads = 1 + Math.floor(rnd() * 4);
      const interval = [3, 6, 12][Math.floor(rnd() * 3)];
      return `${item}: 检出 ${mm}mm 结节 (Lung-RADS ${lads}), 建议 ${interval} 个月低剂量 CT 复查`;
    }
    case 1: {
      const tr = 3 + Math.floor(rnd() * 3);
      const cm = (0.6 + rnd() * 3).toFixed(1);
      const fna = tr >= 4 && Number(cm) >= 1;
      return `${item}: 甲状腺结节 TI-RADS ${tr} 类, 约 ${cm}cm, ${fna ? '符合 FNA 穿刺指征' : '建议 6-12 个月复查'}`;
    }
    case 2: {
      const findings = ['肾上腺腺瘤', '肝囊肿 (Bosniak IIF)', '垂体微腺瘤', '椎体血管瘤', '胰腺囊性灶'];
      const f = findings[Math.floor(rnd() * findings.length)];
      const months = [6, 12, 24][Math.floor(rnd() * 3)];
      return `${item}: 偶发${f} (${(0.5 + rnd() * 3).toFixed(1)}cm), 按 ACR 偶发发现白皮书建议 ${months} 个月随访`;
    }
    case 3: {
      const female = gender === '女';
      const childbearing = female && age >= 15 && age <= 50;
      if (childbearing) {
        return `${item}: 育龄期女性 (${age} 岁), 增强检查前须排除妊娠并签署知情同意`;
      }
      return `${item}: ${age} 岁患者, 使用碘对比剂前须确认 eGFR ≥ 30 mL/min/1.73m²`;
    }
    default: {
      if (dose) {
        const pct = dose.threshold > 0 ? Math.round((dose.dlp / dose.threshold) * 100) : 100;
        return `${item}: RDSR DLP ${dose.dlp} mGy·cm, ${dose.status === 'exceeded' ? '超过' : '占'}${dose.modality} 阈值 ${dose.threshold} mGy·cm (${pct}%), 请复核扫描范围与重建剂量`;
      }
      return `${item}: RDSR 剂量接近 ${modality} 阈值, 请复核扫描范围与重建参数`;
    }
  }
}

function buildSeedAlerts(): any[] {
  const exams = safeList<any>('exams');
  const pool = exams.filter((e: any) => e && (e.patientId || e.reportId || e.id));
  if (!pool.length) return [];
  const { byPatient } = getDoseSeed();
  const picked = pickDistinctPatients(pool, 30, 'cds-alert-pick', (e: any) => String(e.patientId ?? e.reportId ?? e.id ?? ''));
  const msgRnd = rngFor('cds-alert-messages');
  const resolveReportId = makeReportIdResolver();
  const alerts = picked.map((exam: any, i: number) => {
    const group = i % 5;
    const offset = Math.floor(i / 5) % 2; // 每组 2 条规则 × 各 3 条告警
    const guideline = SEED_GUIDELINES[group * 8 + offset];
    const rule = RULE_BY_GUIDELINE.get(guideline?.id);
    const acknowledged = i % 5 < 2; // 12 已确认 / 18 待确认
    const dose = group === 4 ? byPatient.get(String(exam.patientId)) : undefined;
    const time = examAt(exam) ?? new Date(ALERT_BASE_MS - i * 37 * 60000).toISOString();
    return {
      id: `AL${pad(i + 1)}`,
      severity: SEVERITIES[i % 3],
      patientName: String(exam.patientName ?? '未知患者'),
      type: ALERT_TYPES[group]!,
      message: alertMessage(group, exam, msgRnd, dose),
      time,
      status: acknowledged ? 'acknowledged' : 'pending',
      // ── 交叉引用: store.list('exams') 真实 ID ──
      patientId: String(exam.patientId ?? ''),
      examId: examKey(exam),
      reportId: resolveReportId(exam),
      modality: String(exam.modality ?? ''),
      examType: examLabel(exam),
      bodyPart: String(exam.bodyPart ?? ''),
      patientAge: examAge(exam),
      // ── 交叉引用: 指南库 GLxxx / 规则库 CDRxxx ──
      ruleId: guideline?.id ?? null,
      ruleName: guideline?.name ?? null,
      cdsRuleId: rule?.id ?? null,
      guidelineCategory: guideline?.category ?? null,
      ...(dose ? { doseRecordId: dose.id, rdsrId: dose.rdsrId } : {}),
      ...(acknowledged
        ? {
            acknowledgedAt: new Date(Date.parse(time) + ((i % 4) + 1) * 7 * 60000).toISOString(),
            acknowledgedBy: ACK_BY[i % ACK_BY.length],
          }
        : {}),
    };
  });
  return alerts.sort((a, b) => String(b.time).localeCompare(String(a.time)));
}

const ensureSeeded = (key: any, seed: any[] | (() => any[])) => {
  try {
    const existing = list<any>(key);
    if (!existing.length) {
      const items = typeof seed === 'function' ? seed() : seed;
      for (const item of items) create(key, { ...item });
    }
  } catch {}
};

// 默认返回全量 (页面不传 pageSize 时仍可看到 40 条指南 / 40 条规则 / 30 条告警)
const applyListQuery = (url: URL, items: any[], defaultPageSize = 100) => {
  const opts = parseQuery(url);
  if (!url.searchParams.has('pageSize')) opts.pageSize = defaultPageSize;
  return applyQuery(items, opts);
};

// ════════════════════════════════════════════════════════════════════
// 5. CDS 统计概览 (从指南/规则/告警真实派生, 与 CdsStatsOverview 对齐)
// ════════════════════════════════════════════════════════════════════
function buildStatistics(rules: any[], alerts: any[]): any {
  const totalAlerts = alerts.length;
  const acked = alerts.filter((a) => a.status === 'acknowledged').length;
  const pendingCritical = alerts.filter((a) => a.status === 'pending' && a.severity === 'critical').length;
  const contrastAlerts = alerts.filter((a) => a.type === '造影与妊娠').length;
  const pathwayRules = rules.filter((r) => r.type === 'pathway');

  const overrideCount = new Map<string, number>();
  for (const a of alerts) {
    if (a.status !== 'acknowledged') continue; // 覆盖次数 = 已确认的告警
    const rid = String(a.cdsRuleId ?? a.ruleId ?? '');
    if (rid) overrideCount.set(rid, (overrideCount.get(rid) ?? 0) + 1);
  }
  const topOverriddenRules = [...overrideCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([ruleId, count]) => ({
      ruleId,
      ruleName: rules.find((r) => r.id === ruleId)?.name ?? ruleId,
      count,
    }));

  const topPathways = [...pathwayRules]
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
    .slice(0, 5)
    .map((r) => ({ pathwayId: r.id, pathwayName: r.name, activationCount: r.usageCount ?? 0 }));

  return {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.isActive).length,
    totalOverrides: acked,
    overrideRate: totalAlerts ? round1(acked / totalAlerts) : 0,
    suggestionAcceptanceRate: totalAlerts ? round1((totalAlerts - pendingCritical) / totalAlerts) : 0,
    pathwayCompletionRate: pathwayRules.length
      ? round1(pathwayRules.filter((r) => r.isActive).length / pathwayRules.length)
      : 0,
    contrastAlertsThisMonth: contrastAlerts,
    topOverriddenRules,
    topPathways,
    dailyUsage: buildDailyUsage(),
  };
}

function buildDailyUsage(): any[] {
  const rnd = rngFor('cds-stat-daily');
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(GL_BASE_MS - (29 - i) * 86400000).toISOString().slice(0, 10);
    const suggestions = 40 + Math.floor(rnd() * 90);
    const overrides = Math.floor(suggestions * (0.12 + rnd() * 0.24));
    return { date, suggestions, overrides };
  });
}

export const cdsHandlers = [
  // ── 指南库 (3 端点, 40 条) ──
  http.get(`${API}/guidelines`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const url = new URL(request.url);
    const result = applyListQuery(url, list<any>('cdsGuidelines' as any));
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/guidelines/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const found = list<any>('cdsGuidelines' as any).find((g) => g.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `指南 ${params.id} 不存在` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),
  http.post(`${API}/guidelines`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const body = (await request.json()) as any;
    const newItem = {
      id: body.id || `GL-${uuidv4()}`,
      name: body.name || '未命名指南',
      category: body.category || '通用',
      version: body.version || '1.0',
      status: body.status || 'draft',
      updatedAt: new Date().toISOString(),
      description: body.description || '',
      source: body.source || '',
      ...body,
    };
    try { create('cdsGuidelines' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // ── 告警中心 (2 端点, 30 条真实关联告警) ──
  http.get(`${API}/alerts`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsAlerts' as any, buildSeedAlerts);
    const url = new URL(request.url);
    const result = applyListQuery(url, list<any>('cdsAlerts' as any));
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/alerts/:id/acknowledge`, async ({ params, request }) => {
    await delay(delayMs());
    ensureSeeded('cdsAlerts' as any, buildSeedAlerts);
    const body = (await request.json()) as any;
    const updated = update<any>('cdsAlerts' as any, params.id as string, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: body?.acknowledgedBy || '当前用户',
    });
    if (!updated) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `告警 ${params.id} 不存在` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: updated });
  }),

  // ── 剂量监测 (1 端点: 30 条 RDSR 监测行 + 7 条阈值 + 原始 RDSR 记录) ──
  http.get(`${API}/dose-monitoring`, async () => {
    await delay(delayMs());
    const dose = getDoseSeed();
    ensureSeeded('cdsDoseRecords' as any, dose.records);
    ensureSeeded('cdsDoseThresholds' as any, SEED_DOSE_THRESHOLDS);
    const records = list<any>('cdsDoseRecords' as any);
    const rdsrEntries = records.map((r: any) => ({
      rdsrId: r.rdsrId,
      studyUid: r.studyUid,
      patientId: r.patientId,
      examId: r.examId,
      reportId: r.reportId,
      modality: r.modality,
      bodyPart: r.bodyPart,
      ctdiVol: r.ctdiVol,
      dlp: r.dlp,
      ssde: r.ssde,
      source: r.source,
      examAt: r.date,
    }));
    return HttpResponse.json({
      success: true,
      data: {
        records,
        thresholds: list<any>('cdsDoseThresholds' as any),
        rdsrEntries,
      },
    });
  }),

  // ── 统计概览 (从 40 指南 / 40 规则 / 30 告警 派生) ──
  http.get(`${API}/statistics`, async () => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    ensureSeeded('cdsRules' as any, SEED_RULES);
    ensureSeeded('cdsAlerts' as any, buildSeedAlerts);
    const rules = list<any>('cdsRules' as any);
    const alerts = list<any>('cdsAlerts' as any);
    return HttpResponse.json({ success: true, data: buildStatistics(rules, alerts) });
  }),

  // ── 规则库 (40 条 CDS 规则, 与指南 1:1 关联) ──
  http.get(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsRules' as any, SEED_RULES);
    const url = new URL(request.url);
    const result = applyListQuery(url, list<any>('cdsRules' as any));
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsRules' as any, SEED_RULES);
    const body = (await request.json()) as any;
    const newItem: any = {
      type: body.type || 'appropriateness',
      name: body.name || '未命名规则',
      isActive: body.isActive ?? true,
      version: body.version || '1.0',
      updatedTime: body.updatedTime || new Date().toISOString(),
      usageCount: body.usageCount ?? 0,
      ...body,
      id: body.id || `CDR-${uuidv4()}`,
      createdAt: new Date().toISOString(),
    };
    try { create('cdsRules' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // ── 规则管理页 (CdsManagementPage): GET /cds/management ──
  // [W2-B-3] 对齐后端 cds.controller getCdsManagement: { rules, audit }
  http.get(`${API}/management`, async () => {
    await delay(delayMs());
    ensureSeeded('cdsRules' as any, SEED_RULES);
    return HttpResponse.json({
      success: true,
      data: {
        rules: list<any>('cdsRules' as any),
        audit: SEED_AUDIT,
      },
    });
  }),

  // ── 规则评估 (RuleConfigPanel): POST /cds/rule/evaluate ──
  // [W2-B-3] 对齐前端 cdsApi.evaluateRule: { results: RuleEvaluateResult[] }
  http.post(`${API}/rule/evaluate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const examType = String(body?.examType ?? '常规');
    const modality = String(body?.modality ?? 'CT');
    const age = Number(body?.age ?? 40);
    const results: any[] = [
      {
        ruleId: 'contrast-001',
        ruleName: '造影剂适应症检查',
        priority: 1,
        triggered: examType.includes('增强'),
        severity: examType.includes('增强') ? 'warning' : 'info',
        message: examType.includes('增强') ? '增强检查需确认肾功能正常 (eGFR > 30)' : '当前检查类型无需对比剂核查',
        suggestions: examType.includes('增强') ? ['检查血清肌酐水平', '确认 eGFR > 30 mL/min/1.73m²'] : [],
        source: 'ACR Manual on Contrast Media',
      },
      {
        ruleId: 'dose-001',
        ruleName: '辐射剂量优化',
        priority: 2,
        triggered: modality === 'CT' && age < 18,
        severity: modality === 'CT' && age < 18 ? 'warning' : 'info',
        message: modality === 'CT' && age < 18 ? '儿童CT检查建议使用低剂量协议' : '辐射剂量处于常规范围',
        suggestions: modality === 'CT' && age < 18 ? ['启用儿童低剂量协议', '考虑MRI替代检查'] : [],
        source: 'Image Gently Campaign',
      },
      {
        ruleId: 'protocol-001',
        ruleName: '检查协议匹配',
        priority: 3,
        triggered: true,
        severity: 'info',
        message: `推荐检查方案: ${examType}扫描`,
        suggestions: ['标准扫描序列'],
        source: 'RSNA Radiology Protocols',
      },
    ];
    return HttpResponse.json({ success: true, data: { results } });
  }),

  // ── 规则优先级 (RuleConfigPanel): PUT /cds/rule/priority ──
  // [W2-B-3] 对齐后端 cds.controller updateRulePriority: { success }
  http.put(`${API}/rule/priority`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { success: true } });
  }),
];
