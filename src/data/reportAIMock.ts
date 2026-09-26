/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI 智能 Mock 数据
 * A5-REPORT 模块 / 80 点（全 mock）
 *
 * 数据原则：所有 AI 输出均为 mock 模拟，延迟 200-1500ms 模拟推理时间。
 */

import type {
  AIDraftResult,
  AIPreReview,
  AIRiskPrediction,
  AIDifferentialDx,
  AISynonymSuggestion,
  AILesionDetection,
  AIUsageLog,
  AIHealth,
  AIQuota,
  AIUsageRank,
  AIReference,
  AIScenario,
} from '../types/R3/R3.AI';

// ============================================================
// 通用引用源（卫健委 / 文献 / 指南）
// ============================================================

const COMMON_REFERENCES: AIReference[] = [
  { id: 'ref-001', title: '国家卫健委《放射诊断报告书写规范》', source: 'NHC', year: 2022 },
  { id: 'ref-002', title: 'Fleischner Society 肺结节随访指南 (2017)', source: 'Fleischner', year: 2017 },
  { id: 'ref-003', title: 'Lung-RADS v2022', source: 'ACR', year: 2022 },
  { id: 'ref-004', title: 'BI-RADS v5 乳腺', source: 'ACR', year: 2013 },
  { id: 'ref-005', title: 'Li-RADS v2018', source: 'ACR', year: 2018 },
];

// ============================================================
// AI 初稿（6 场景，覆盖 P0）
// ============================================================

export const AI_DRAFTS: AIDraftResult[] = [
  {
    id: 'aidraft-001',
    reportId: 'RP20260604010',
    scenario: 'chest-ct',
    clinicalHistory: '男性，65 岁，咳嗽咳痰 2 周，疑似肺部占位。',
    findings:
      '双肺纹理清晰，右肺下叶背段可见一磨玻璃密度结节，大小约 8mm×7mm，边界欠清，未见明显实性成分。余肺野未见明显实质性病变。纵隔居中，气管支气管通畅。心影大小形态正常。膈肌光滑，胸膜未见增厚，胸腔未见积液。',
    diagnosis: '右肺下叶背段磨玻璃结节（Lung-RADS 3 类）',
    impression: '右肺下叶磨玻璃结节，考虑为非典型腺瘤样增生或原位腺癌可能，建议 3 个月后复查。',
    recommendations: '3 个月后复查胸部 CT 平扫+靶扫描，必要时穿刺活检。',
    confidence: {
      overall: 0.88,
      findings: 0.9,
      diagnosis: 0.85,
      impression: 0.89,
      level: 'high',
    },
    references: [COMMON_REFERENCES[0]!, COMMON_REFERENCES[1]!, COMMON_REFERENCES[2]!],
    generatedAt: '2026-06-04T10:00:00Z',
    modelVersion: 'v2.3-mock',
    tokenUsage: { prompt: 230, completion: 480, total: 710 },
    processingMs: 1240,
  },
  {
    id: 'aidraft-002',
    reportId: 'RP20260604011',
    scenario: 'head-mri',
    clinicalHistory: '女性，58 岁，突发头痛伴呕吐 2 小时。',
    findings:
      '双侧大脑半球对称，灰白质对比正常。右侧基底节区可见一类圆形异常信号影，T1WI 呈等信号，T2WI 呈稍高信号，DWI 呈高信号，ADC 呈低信号，边界清楚，大小约 18mm×15mm。',
    diagnosis: '右侧基底节区急性脑梗塞',
    impression: '右侧基底节区急性脑梗塞，建议急诊神经内科会诊。',
    recommendations: '立即通知临床，建议溶栓或介入治疗评估。',
    confidence: {
      overall: 0.92,
      findings: 0.94,
      diagnosis: 0.91,
      impression: 0.91,
      level: 'high',
    },
    references: [COMMON_REFERENCES[0]!],
    generatedAt: '2026-06-04T11:00:00Z',
    modelVersion: 'v2.3-mock',
    tokenUsage: { prompt: 180, completion: 320, total: 500 },
    processingMs: 980,
  },
  {
    id: 'aidraft-003',
    reportId: 'RP20260604012',
    scenario: 'abdomen-ct',
    clinicalHistory: '男性，72 岁，上腹不适 1 月余。',
    findings:
      '肝右叶可见一稍低密度灶，大小约 25mm×22mm，平扫 CT 值约 38HU，增强后动脉期明显强化，门脉期及延迟期廓清，呈"快进快出"表现。',
    diagnosis: '肝右叶占位性病变，考虑肝细胞癌可能',
    impression: '肝右叶占位，建议多学科会诊进一步诊治。',
    recommendations: '建议 MRI 增强+DWI 进一步评估，必要时穿刺活检。',
    confidence: {
      overall: 0.84,
      findings: 0.86,
      diagnosis: 0.82,
      impression: 0.84,
      level: 'medium',
    },
    references: [COMMON_REFERENCES[0]!, COMMON_REFERENCES[4]!],
    generatedAt: '2026-06-04T12:00:00Z',
    modelVersion: 'v2.3-mock',
    tokenUsage: { prompt: 210, completion: 410, total: 620 },
    processingMs: 1100,
  },
];

// ============================================================
// AI 预审（3 条，含评分/缺陷/建议/diff/RADS/危急值）
// ============================================================

export const AI_PRE_REVIEWS: AIPreReview[] = [
  {
    id: 'aipre-001',
    reportId: 'RP20260601001',
    score: 88,
    defects: [
      {
        id: 'def-001',
        type: 'missing-key-finding',
        field: 'examFindings',
        severity: 'high',
        description: '右肺下叶磨玻璃结节（8mm×7mm）建议在所见中明确描述大小、边界、密度',
        location: { start: 8, end: 32 },
        fixSuggestion: '右肺下叶背段可见一磨玻璃密度结节，大小约 8mm×7mm',
      },
      {
        id: 'def-002',
        type: 'terminology-error',
        field: 'diagnosis',
        severity: 'medium',
        description: '建议使用标准术语"磨玻璃结节"而非"磨玻璃影"',
        fixSuggestion: '右肺下叶背段磨玻璃结节（Lung-RADS 3 类）',
      },
      {
        id: 'def-003',
        type: 'missing-key-finding',
        field: 'recommendations',
        severity: 'low',
        description: '建议补充随访时间间隔',
        fixSuggestion: '3 个月后复查胸部 CT',
      },
    ],
    suggestions: [
      {
        id: 'sug-001',
        category: 'rewrite',
        field: 'diagnosis',
        before: '右肺下叶磨玻璃影',
        after: '右肺下叶背段磨玻璃结节（Lung-RADS 3 类）',
        rationale: '更精确的解剖定位与影像术语',
      },
    ],
    diff: [
      {
        field: 'examFindings',
        aiValue:
          '双肺纹理清晰，右肺下叶背段可见一磨玻璃密度结节，大小约 8mm×7mm，边界欠清，未见明显实性成分。',
        doctorValue: '双肺纹理清晰，未见明显实质性病变。',
        agreementPercent: 45,
        changedSections: [
          { text: '双肺纹理清晰，', type: 'agree' },
          { text: '右肺下叶背段可见一磨玻璃密度结节', type: 'ai-only' },
          { text: '，未见明显实质性病变。', type: 'doctor-only' },
        ],
      },
    ],
    keyImages: [
      {
        id: 'ki-001',
        sopInstanceUid: '1.2.840.0.1.1.1.1.20260604001.1',
        seriesNumber: 3,
        instanceNumber: 87,
        reason: '右肺下叶结节所在层面',
        boundingBox: { x: 245, y: 312, width: 28, height: 24 },
        confidence: 0.92,
      },
    ],
    criticalHits: [],
    radsSuggestion: {
      system: 'Lung-RADS',
      category: '3',
      description: '可能良性结节',
      riskPercent: '1-2%',
      recommendation: '6 个月后复查 CT',
    },
    consistency: {
      imageReportMatch: true,
      clinicalReportMatch: true,
      priorReportMatch: false,
      mismatchedFields: ['prior'],
      score: 92,
    },
    terminology: {
      totalTerms: 24,
      matchedTerms: 22,
      radlexHits: [
        { term: '磨玻璃结节', radlexCode: 'RID4949', replaced: true },
        { term: '下叶背段', radlexCode: 'RID1331', replaced: false },
      ],
      snomedHits: [{ term: '磨玻璃结节', snomedCode: '428481000124106' }],
    },
    confidence: {
      overall: 0.88,
      findings: 0.9,
      diagnosis: 0.85,
      impression: 0.89,
      level: 'high',
    },
    reviewedAt: '2026-06-01T10:00:00Z',
    modelVersion: 'v2.3-mock',
    processingMs: 850,
  },
  {
    id: 'aipre-002',
    reportId: 'RP20260602001',
    score: 92,
    defects: [
      {
        id: 'def-004',
        type: 'specification',
        field: 'recommendations',
        severity: 'low',
        description: '建议增加随访频率',
      },
    ],
    suggestions: [],
    diff: [],
    criticalHits: [
      {
        id: 'crit-001',
        keyword: '脑疝',
        matchType: 'semantic',
        field: 'diagnosis',
        confidence: 0.78,
        recommendation: '疑似危急值，建议双签',
      },
    ],
    consistency: {
      imageReportMatch: true,
      clinicalReportMatch: true,
      priorReportMatch: true,
      mismatchedFields: [],
      score: 96,
    },
    terminology: {
      totalTerms: 18,
      matchedTerms: 18,
      radlexHits: [],
      snomedHits: [],
    },
    confidence: {
      overall: 0.92,
      findings: 0.94,
      diagnosis: 0.91,
      impression: 0.91,
      level: 'high',
    },
    reviewedAt: '2026-06-02T09:30:00Z',
    modelVersion: 'v2.3-mock',
    processingMs: 760,
  },
  {
    id: 'aipre-003',
    reportId: 'RP20260603008',
    score: 76,
    defects: [
      {
        id: 'def-005',
        type: 'inconsistency',
        field: 'diagnosis',
        severity: 'high',
        description: '诊断结论与所见不完全一致（所见提示占位但诊断写为良性可能）',
      },
      {
        id: 'def-006',
        type: 'grammar',
        field: 'impression',
        severity: 'low',
        description: '"考虑良性可能性大" 语序建议调整',
      },
    ],
    suggestions: [],
    diff: [],
    criticalHits: [],
    consistency: {
      imageReportMatch: false,
      clinicalReportMatch: true,
      priorReportMatch: true,
      mismatchedFields: ['diagnosis'],
      score: 65,
    },
    terminology: {
      totalTerms: 20,
      matchedTerms: 18,
      radlexHits: [],
      snomedHits: [],
    },
    confidence: {
      overall: 0.76,
      findings: 0.8,
      diagnosis: 0.7,
      impression: 0.78,
      level: 'medium',
    },
    reviewedAt: '2026-06-03T14:00:00Z',
    modelVersion: 'v2.3-mock',
    processingMs: 920,
  },
];

// ============================================================
// AI 风险预测（3 条）
// ============================================================

export const AI_RISK_PREDICTIONS: AIRiskPrediction[] = [
  {
    id: 'risk-001',
    reportId: 'RP20260601001',
    overallRisk: 'high',
    riskScore: 0.78,
    riskFactors: [
      {
        id: 'rf-001',
        category: 'finding',
        name: '磨玻璃结节 ≥ 6mm',
        weight: 0.35,
        description: '右肺下叶磨玻璃结节 8mm×7mm，按 Lung-RADS 属于中等风险结节',
        evidence: '结节大小 8mm×7mm',
      },
      {
        id: 'rf-002',
        category: 'patient',
        name: '年龄 > 60',
        weight: 0.2,
        description: '65 岁中老年患者，肺癌风险升高',
        evidence: '患者年龄 65 岁',
      },
      {
        id: 'rf-003',
        category: 'history',
        name: '长期吸烟史',
        weight: 0.23,
        description: '30 年吸烟史',
        evidence: '吸烟史 30 包年',
      },
    ],
    predictedOutcomes: [
      {
        id: 'po-001',
        outcome: '非典型腺瘤样增生（AAH）',
        probability: 0.45,
        timeframeDays: 90,
        rationale: '基于结节形态（纯磨玻璃）和大小',
      },
      {
        id: 'po-002',
        outcome: '原位腺癌（AIS）',
        probability: 0.35,
        timeframeDays: 180,
        rationale: '结节较大、年龄较大',
      },
      {
        id: 'po-003',
        outcome: '微浸润腺癌（MIA）',
        probability: 0.18,
        timeframeDays: 365,
        rationale: '需随访观察',
      },
    ],
    earlyWarnings: [
      {
        id: 'ew-001',
        severity: 'warning',
        message: '建议 3 个月内复查胸部 CT',
        suggestedAction: '在报告中补充随访建议',
      },
      {
        id: 'ew-002',
        severity: 'info',
        message: '建议结合肺癌七种自身抗体检测',
        suggestedAction: '可考虑推荐临床检查',
      },
    ],
    recommendedActions: [
      '3 个月后复查胸部 CT 平扫+靶扫描',
      '必要时穿刺活检',
      '建议结合肺癌自身抗体检测',
    ],
    confidence: {
      overall: 0.82,
      findings: 0.85,
      diagnosis: 0.78,
      impression: 0.83,
      level: 'medium',
    },
    predictedAt: '2026-06-04T10:30:00Z',
    modelVersion: 'v2.3-mock',
  },
  {
    id: 'risk-002',
    reportId: 'RP20260602001',
    overallRisk: 'critical',
    riskScore: 0.95,
    riskFactors: [
      {
        id: 'rf-004',
        category: 'finding',
        name: '急性脑梗塞 DWI 高信号',
        weight: 0.6,
        description: 'DWI 高信号 + ADC 低信号，符合急性脑梗塞影像特征',
      },
      {
        id: 'rf-005',
        category: 'history',
        name: '突发神经症状',
        weight: 0.35,
        description: '突发头痛伴呕吐 2 小时',
      },
    ],
    predictedOutcomes: [
      {
        id: 'po-004',
        outcome: '进展性卒中',
        probability: 0.65,
        timeframeDays: 7,
        rationale: '未及时溶栓可能进展',
      },
    ],
    earlyWarnings: [
      {
        id: 'ew-003',
        severity: 'critical',
        message: '符合急性脑梗塞，建议立即通知临床',
        field: 'diagnosis',
        suggestedAction: '触发危急值流程',
      },
    ],
    recommendedActions: ['立即通知神经内科', '评估溶栓或介入治疗', '监测生命体征'],
    confidence: {
      overall: 0.94,
      findings: 0.96,
      diagnosis: 0.93,
      impression: 0.93,
      level: 'high',
    },
    predictedAt: '2026-06-02T11:00:00Z',
    modelVersion: 'v2.3-mock',
  },
  {
    id: 'risk-003',
    reportId: 'RP20260603008',
    overallRisk: 'medium',
    riskScore: 0.58,
    riskFactors: [
      {
        id: 'rf-006',
        category: 'finding',
        name: '肝占位',
        weight: 0.4,
        description: '肝右叶 25mm 占位，需鉴别良恶性',
      },
      {
        id: 'rf-007',
        category: 'patient',
        name: '乙肝病史',
        weight: 0.18,
        description: '乙肝表面抗原阳性',
      },
    ],
    predictedOutcomes: [
      {
        id: 'po-005',
        outcome: '肝细胞癌',
        probability: 0.55,
        timeframeDays: 30,
        rationale: '乙肝病史+占位强化方式符合 HCC',
      },
      {
        id: 'po-006',
        outcome: '肝硬化结节',
        probability: 0.3,
        timeframeDays: 60,
        rationale: '需鉴别',
      },
    ],
    earlyWarnings: [
      {
        id: 'ew-004',
        severity: 'warning',
        message: '建议 MRI 增强+DWI 进一步评估',
      },
    ],
    recommendedActions: ['MRI 增强+DWI', 'AFP 检测', 'MDT 会诊'],
    confidence: {
      overall: 0.72,
      findings: 0.75,
      diagnosis: 0.68,
      impression: 0.73,
      level: 'medium',
    },
    predictedAt: '2026-06-03T15:00:00Z',
    modelVersion: 'v2.3-mock',
  },
];

// ============================================================
// AI 鉴别诊断（3 条）
// ============================================================

export const AI_DIFFERENTIAL_DXS: AIDifferentialDx[] = [
  {
    id: 'ddx-001',
    reportId: 'RP20260601001',
    primaryDiagnosis: '右肺下叶背段磨玻璃结节',
    differentials: [
      {
        id: 'dd-ent-001',
        diagnosis: '非典型腺瘤样增生（AAH）',
        icd10Code: 'D38.1',
        probability: 0.45,
        supportingFindings: ['纯磨玻璃密度', '结节较小（<10mm）', '边界欠清'],
        contradictingFindings: ['患者年龄较大'],
        reasoning: '结节形态为纯磨玻璃，<10mm，符合 AAH 典型表现',
      },
      {
        id: 'dd-ent-002',
        diagnosis: '原位腺癌（AIS）',
        icd10Code: 'D02.2',
        probability: 0.35,
        supportingFindings: ['磨玻璃密度结节', '>6mm'],
        contradictingFindings: ['未见实性成分'],
        reasoning: '纯磨玻璃结节 >6mm，需警惕 AIS',
      },
      {
        id: 'dd-ent-003',
        diagnosis: '微浸润腺癌（MIA）',
        icd10Code: 'C34.9',
        probability: 0.15,
        supportingFindings: ['磨玻璃结节'],
        contradictingFindings: ['未见实性成分（典型 MIA 可见部分实性）'],
        reasoning: '目前未见明显实性成分，MIA 可能性较低',
      },
      {
        id: 'dd-ent-004',
        diagnosis: '局灶性肺炎',
        icd10Code: 'J18.9',
        probability: 0.05,
        supportingFindings: ['边界欠清'],
        contradictingFindings: ['未见渗出', '临床无感染证据'],
        reasoning: '影像与临床表现不支持',
      },
    ],
    recommendedTests: [
      '3 个月后复查胸部 CT 平扫+靶扫描',
      '肺癌七种自身抗体检测',
      '必要时穿刺活检',
    ],
    similarCases: [
      {
        id: 'sim-001',
        reportId: 'RP20251203012',
        patientAge: 62,
        patientGender: '男',
        diagnosis: '右肺下叶 AAH',
        similarity: 0.89,
        outcome: '随访 1 年稳定',
      },
      {
        id: 'sim-002',
        reportId: 'RP20251108008',
        patientAge: 67,
        patientGender: '男',
        diagnosis: '右肺下叶 AIS',
        similarity: 0.84,
        outcome: '手术切除',
      },
    ],
    confidence: {
      overall: 0.84,
      findings: 0.88,
      diagnosis: 0.8,
      impression: 0.85,
      level: 'medium',
    },
    generatedAt: '2026-06-04T10:15:00Z',
    modelVersion: 'v2.3-mock',
  },
  {
    id: 'ddx-002',
    reportId: 'RP20260602008',
    primaryDiagnosis: '肝右叶占位',
    differentials: [
      {
        id: 'dd-ent-005',
        diagnosis: '肝细胞癌（HCC）',
        icd10Code: 'C22.0',
        probability: 0.55,
        supportingFindings: ['乙肝病史', '"快进快出"强化', '动脉期明显强化'],
        contradictingFindings: [],
        reasoning: '典型 HCC 影像表现 + 乙肝病史',
      },
      {
        id: 'dd-ent-006',
        diagnosis: '肝硬化退变结节',
        icd10Code: 'K74.6',
        probability: 0.25,
        supportingFindings: ['乙肝病史'],
        contradictingFindings: ['强化方式不符', '占位较大'],
        reasoning: '需鉴别',
      },
      {
        id: 'dd-ent-007',
        diagnosis: '肝腺瘤',
        icd10Code: 'D13.4',
        probability: 0.1,
        supportingFindings: ['边界清楚'],
        contradictingFindings: ['患者年龄', '乙肝背景'],
        reasoning: '可能性较低',
      },
      {
        id: 'dd-ent-008',
        diagnosis: '转移瘤',
        icd10Code: 'C78.7',
        probability: 0.1,
        supportingFindings: ['占位'],
        contradictingFindings: ['未见原发肿瘤证据'],
        reasoning: '需结合临床',
      },
    ],
    recommendedTests: ['MRI 增强+DWI', 'AFP', 'MDT 会诊'],
    similarCases: [
      {
        id: 'sim-003',
        reportId: 'RP20260120015',
        patientAge: 70,
        patientGender: '男',
        diagnosis: '肝右叶 HCC',
        similarity: 0.92,
        outcome: '手术切除',
      },
    ],
    confidence: {
      overall: 0.78,
      findings: 0.8,
      diagnosis: 0.75,
      impression: 0.79,
      level: 'medium',
    },
    generatedAt: '2026-06-03T15:30:00Z',
    modelVersion: 'v2.3-mock',
  },
  {
    id: 'ddx-003',
    reportId: 'RP20260603012',
    primaryDiagnosis: '肝右叶占位',
    differentials: [
      {
        id: 'dd-ent-009',
        diagnosis: '肝血管瘤',
        icd10Code: 'D18.0',
        probability: 0.5,
        supportingFindings: ['边界清楚', '强化方式待定'],
        contradictingFindings: [],
        reasoning: '肝血管瘤常见',
      },
      {
        id: 'dd-ent-010',
        diagnosis: '局灶性结节增生（FNH）',
        icd10Code: 'K76.8',
        probability: 0.25,
        supportingFindings: ['边界清楚'],
        contradictingFindings: [],
        reasoning: '中年女性多见',
      },
      {
        id: 'dd-ent-011',
        diagnosis: '肝细胞癌（HCC）',
        icd10Code: 'C22.0',
        probability: 0.15,
        supportingFindings: [],
        contradictingFindings: ['无乙肝背景'],
        reasoning: '可能性较低',
      },
    ],
    recommendedTests: ['MRI 增强', 'AFP'],
    similarCases: [
      {
        id: 'sim-004',
        reportId: 'RP20250905008',
        patientAge: 48,
        patientGender: '女',
        diagnosis: '肝血管瘤',
        similarity: 0.87,
        outcome: '随访稳定',
      },
    ],
    confidence: {
      overall: 0.72,
      findings: 0.75,
      diagnosis: 0.68,
      impression: 0.73,
      level: 'medium',
    },
    generatedAt: '2026-06-04T16:00:00Z',
    modelVersion: 'v2.3-mock',
  },
];

// ============================================================
// AI 同义词建议（4 组）
// ============================================================

export const AI_SYNONYM_SUGGESTIONS: AISynonymSuggestion[] = [
  {
    original: '磨玻璃影',
    synonyms: ['磨玻璃密度影', 'GGO', 'ground-glass opacity'],
    preferred: '磨玻璃密度影',
    rationale: '建议使用 RadLex 标准术语"磨玻璃密度影"',
  },
  {
    original: '占位',
    synonyms: ['占位性病变', '占位灶', '肿块', 'mass'],
    preferred: '占位性病变',
    rationale: '更规范',
  },
  {
    original: '阴影',
    synonyms: ['密度增高影', '异常信号影', '异常密度影'],
    preferred: '密度增高影',
    rationale: '更准确描述影像特征',
  },
  {
    original: '强化',
    synonyms: ['对比增强', 'contrast enhancement', '强化灶'],
    preferred: '对比增强',
    rationale: '使用对比增强',
  },
];

// ============================================================
// AI 病灶检测（2 条）
// ============================================================

export const AI_LESION_DETECTIONS: AILesionDetection[] = [
  {
    id: 'lesion-001',
    reportId: 'RP20260601001',
    modality: 'CT',
    totalLesions: 1,
    detectedAt: '2026-06-04T10:30:00Z',
    lesions: [
      {
        id: 'les-001',
        type: 'nodule',
        location: '右肺下叶背段',
        sizeMm: { length: 8, width: 7 },
        density: -650,
        measurements: [
          { type: 'length', value: 8, unit: 'mm' },
          { type: 'length', value: 7, unit: 'mm' },
        ],
        classification: '磨玻璃结节（GGN）',
        confidence: 0.91,
        sopInstanceUid: '1.2.840.0.1.1.1.1.20260604001.1',
        boundingBox: { x: 245, y: 312, width: 28, height: 24 },
      },
    ],
  },
  {
    id: 'lesion-002',
    reportId: 'RP20260602008',
    modality: 'CT',
    totalLesions: 1,
    detectedAt: '2026-06-03T15:30:00Z',
    lesions: [
      {
        id: 'les-002',
        type: 'mass',
        location: '肝右叶 S6 段',
        sizeMm: { length: 25, width: 22, height: 20 },
        density: 38,
        measurements: [
          { type: 'length', value: 25, unit: 'mm' },
          { type: 'length', value: 22, unit: 'mm' },
          { type: 'length', value: 20, unit: 'mm' },
        ],
        classification: '肝占位',
        confidence: 0.94,
        sopInstanceUid: '1.2.840.0.1.1.1.1.20260602008.1',
        boundingBox: { x: 320, y: 240, width: 80, height: 75 },
      },
    ],
  },
];

// ============================================================
// AI 使用日志（8 条）
// ============================================================

export const AI_USAGE_LOGS: AIUsageLog[] = [
  {
    id: 'usage-001',
    userId: 'D001',
    reportId: 'RP20260604010',
    endpoint: '/api/v1/ai/generate',
    requestTokens: 230,
    responseTokens: 480,
    processingMs: 1240,
    success: true,
    calledAt: '2026-06-04T10:00:00Z',
  },
  {
    id: 'usage-002',
    userId: 'D002',
    reportId: 'RP20260601001',
    endpoint: '/api/v1/ai/pre-review/:id',
    processingMs: 850,
    success: true,
    calledAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'usage-003',
    userId: 'D001',
    reportId: 'RP20260601001',
    endpoint: '/api/v1/ai/risk-predict',
    processingMs: 920,
    success: true,
    calledAt: '2026-06-04T10:30:00Z',
  },
  {
    id: 'usage-004',
    userId: 'D002',
    reportId: 'RP20260601001',
    endpoint: '/api/v1/ai/differential',
    processingMs: 760,
    success: true,
    calledAt: '2026-06-04T10:15:00Z',
  },
  {
    id: 'usage-005',
    userId: 'D003',
    endpoint: '/api/v1/ai/defect-detect',
    requestTokens: 150,
    responseTokens: 320,
    processingMs: 650,
    success: true,
    calledAt: '2026-06-04T11:00:00Z',
  },
  {
    id: 'usage-006',
    userId: 'D005',
    endpoint: '/api/v1/ai/critical-detect',
    processingMs: 380,
    success: true,
    calledAt: '2026-06-04T11:30:00Z',
  },
  {
    id: 'usage-007',
    userId: 'D007',
    endpoint: '/api/v1/ai/synonym',
    processingMs: 220,
    success: true,
    calledAt: '2026-06-04T12:00:00Z',
  },
  {
    id: 'usage-008',
    userId: 'D008',
    endpoint: '/api/v1/ai/lesion-detect',
    processingMs: 1500,
    success: false,
    errorCode: 'TIMEOUT',
    calledAt: '2026-06-04T12:30:00Z',
  },
];

// ============================================================
// AI 健康状态
// ============================================================

export const AI_HEALTH: AIHealth = {
  status: 'healthy',
  avgLatencyMs: 850,
  queueDepth: 2,
  rateLimitRemaining: 87,
  checkedAt: '2026-06-04T13:00:00Z',
};

// ============================================================
// AI 配额（5 医师）
// ============================================================

export const AI_QUOTAS: AIQuota[] = [
  { userId: 'D001', period: 'day', used: 23, limit: 100, resetAt: '2026-06-05T00:00:00Z' },
  { userId: 'D002', period: 'day', used: 18, limit: 100, resetAt: '2026-06-05T00:00:00Z' },
  { userId: 'D003', period: 'day', used: 12, limit: 100, resetAt: '2026-06-05T00:00:00Z' },
  { userId: 'D005', period: 'day', used: 8, limit: 100, resetAt: '2026-06-05T00:00:00Z' },
  { userId: 'D007', period: 'day', used: 5, limit: 100, resetAt: '2026-06-05T00:00:00Z' },
];

// ============================================================
// AI 使用排行（top 5）
// ============================================================

export const AI_USAGE_RANK: AIUsageRank[] = [
  { userId: 'D001', userName: '张明远', department: 'CT室', callsToday: 23, callsMonth: 412, acceptanceRate: 0.85 },
  { userId: 'D002', userName: '李慧敏', department: 'MR室', callsToday: 18, callsMonth: 356, acceptanceRate: 0.81 },
  { userId: 'D003', userName: '王建华', department: 'CT室', callsToday: 12, callsMonth: 248, acceptanceRate: 0.74 },
  { userId: 'D005', userName: '刘文博', department: 'MR室', callsToday: 8, callsMonth: 189, acceptanceRate: 0.79 },
  { userId: 'D007', userName: '孙立军', department: 'DR室', callsToday: 5, callsMonth: 124, acceptanceRate: 0.82 },
];

// ============================================================
// 场景模板（用于 AI 初稿选择）
// ============================================================

export const AI_SCENARIO_DETAILS: Record<AIScenario, { templateFindings: string; templateDiagnosis: string; radsSystem?: string }> = {
  'chest-ct': {
    templateFindings:
      '双肺纹理清晰，{finding}。纵隔居中，气管支气管通畅。心影大小形态正常。膈肌光滑，胸膜未见增厚，胸腔未见积液。',
    templateDiagnosis: '{finding}（Lung-RADS {category} 类）',
    radsSystem: 'Lung-RADS',
  },
  'head-mri': {
    templateFindings:
      '双侧大脑半球对称，灰白质对比正常。{finding}。脑室系统无扩大，脑沟、脑池无增宽，中线结构居中。',
    templateDiagnosis: '{finding}',
  },
  'abdomen-ct': {
    templateFindings:
      '肝脏大小形态正常，{finding}。胆囊不大，壁不厚。胰腺形态正常，脾脏不大。双肾对称，未见明显异常。',
    templateDiagnosis: '{finding}',
  },
  'spine-mri': {
    templateFindings:
      '脊柱生理曲度存在，椎体序列正常。{finding}。脊髓圆锥位置正常，终丝马尾神经未见异常。',
    templateDiagnosis: '{finding}',
  },
  'breast-mg': {
    templateFindings:
      '双乳形态正常，皮肤及皮下组织未见异常。{finding}。腋下淋巴结未见肿大。',
    templateDiagnosis: '{finding}（BI-RADS {category} 类）',
    radsSystem: 'BI-RADS',
  },
  'cardiac-cta': {
    templateFindings:
      '冠状动脉左主干、前降支、回旋支及右冠状动脉分布走行自然。{finding}。心影大小形态正常，心包腔未见积液。',
    templateDiagnosis: '{finding}',
  },
};

// ============================================================
// AI 错误日志
// ============================================================

export const AI_ERROR_LOGS = [
  {
    id: 'err-001',
    reportId: 'RP20260603008',
    errorCode: 'TIMEOUT',
    message: 'AI 调用超时',
    endpoint: '/api/v1/ai/lesion-detect',
    occurredAt: '2026-06-04T12:30:00Z',
  },
  {
    id: 'err-002',
    errorCode: 'RATE_LIMIT',
    message: '已达到每小时调用上限',
    endpoint: '/api/v1/ai/generate',
    occurredAt: '2026-06-04T11:45:00Z',
  },
];

// ============================================================
// 续写候选
// ============================================================

export const AI_CONTINUATION_CANDIDATES = [
  '，边界欠清，未见明显实性成分。',
  '，大小约 8mm×7mm。',
  '，建议 3 个月后复查。',
  '，必要时穿刺活检。',
];