// [v3.0.6.8-32] In-memory Store + IndexedDB 持久化
// 支持 CRUD 操作, 写入自动持久到 IDB, 启动时从 IDB 恢复
import Dexie, { type EntityTable } from 'dexie';
import {
  PATIENT_MASTER, DEVICE_MASTER, DOCTOR_MASTER, EXAM_ITEM_MASTER,
} from '../../data/master';
import {
  EXAM_REPORT_PRE, DOCTOR_PERFORMANCE_PRE, DAILY_KPI_PRE,
  COSIGN_TASKS_PRE, QUALITY_SCORE_PRE,
} from '../../data/_generators';
// [Agent-B.1] Fallback 检查数据 (200 条 RAD-EX001..RAD-EX200)
import { initialRadiologyExams } from '../../data/initialData';
// [v3.0.6.12-A4] 危急值种子数据 (规则/级别/升级/KPI) 由 criticalValueMock 提供,
//   加载进 store 的 criticalRules / criticalLevels / criticalEscalationRules / criticalKpi
//   集合, 让 criticalExtHandlers 路由统一从 store 读取.
import {
  CRITICAL_LEVELS,
  CRITICAL_RULES,
  CRITICAL_ESCALATION_RULES,
  CRITICAL_KPI,
} from '../../data/criticalValueMock';
// [v3.0.6.8-33] 眼科专科 mock 数据 (21 个数据集)
import {
  MOCK_EYE_STUDIES, MOCK_EYE_PATIENTS, MOCK_EYE_SERIES,
  MOCK_KEY_IMAGES, MOCK_OCT_MAPS, MOCK_VISUAL_FIELDS,
  MOCK_EYE_MEASUREMENTS, MOCK_ANNOTATIONS, MOCK_LESION_SEGMENTATIONS,
} from '../../data/eyePacsMock';
import {
  MOCK_AI_MODELS, MOCK_AI_DIAGNOSES, MOCK_AI_HEATMAPS,
} from '../../data/eyeAiMock';
import {
  MOCK_STRABISMUS_EXAMS, MOCK_NEURO_OPHTHALMIC_EXAMS, MOCK_ONCOLOGY_RECORDS,
  MOCK_CONTACT_LENS_FITTINGS, MOCK_LOW_VISION_ASSESSMENTS,
} from '../../data/eyeClinicalSubspecialtyMock';
import {
  MOCK_OPHTHALMIC_DRUGS, MOCK_PRESCRIPTIONS,
} from '../../data/eyeDrugMock';
import {
  MOCK_EDUCATION_MATERIALS,
} from '../../data/eyeEducationMock';
import {
  MOCK_OPHTHALMOLOGY_EMR_LIST, MOCK_PRE_OP_ASSESSMENTS,
} from '../../data/eyeEmrMock';
import {
  MOCK_INSURANCE_CLAIMS,
} from '../../data/eyeFinancialMock';
import {
  MOCK_FINDINGS_LIBRARY,
} from '../../data/eyeFindingsLibraryMock';
import {
  MOCK_GRADING_SCALES,
} from '../../data/eyeGradingScalesMock';
import {
  MOCK_IMAGE_QC, MOCK_REPORTS,
} from '../../data/eyeImageQcMock';
import {
  MOCK_IOL_INVENTORY,
} from '../../data/eyeIolMock';
import {
  MOCK_PATIENT_PROFILES,
} from '../../data/eyePatientDataMock';
import {
  MOCK_QUALITY_METRICS,
} from '../../data/eyeQualityMock';
import {
  MOCK_REPORT_TEMPLATES,
} from '../../data/eyeReportTemplatesMock';
import {
  MOCK_VISION, MOCK_APPOINTMENTS, MOCK_SURGERY_APPOINTMENTS,
  MOCK_FOLLOW_UPS, MOCK_REFERRALS,
} from '../../data/eyeRisMock';
import {
  MOCK_DOCTOR_SCHEDULES, MOCK_NOTIFICATION_TEMPLATES,
} from '../../data/eyeSchedulingMock';
import {
  MOCK_CRITICAL_VALUES,
} from '../../data/eyeCriticalValuesMock';

// [v3.0.6.8-53] 口腔专科 mock 数据
import { MOCK_DENTAL_CHARTS } from '../../data/dental/dentalChartMock';
import { MOCK_DENTAL_STUDIES } from '../../data/dental/dentalImagingMock';
import { MOCK_DENTAL_TREATMENTS } from '../../data/dental/dentalTreatmentMock';
import { MOCK_INVOICES } from '../../data/dental/dentalBillingMock';

// [v3.0.6.12-B2] v3ReviewHandlers top-10 路由种子: 从 reportReviewMock 加载
//   reviewReviewers, reviewRejectTemplates, reviewComments, reviewAiHints,
//   reviewWorkloads, reviewKpiPersonal, reviewAssignments
import {
  REVIEWERS as REVIEWERS_SEED,
  SLA_METRICS as SLA_METRICS_SEED,
  WORKLOAD_STATS as WORKLOAD_STATS_SEED,
  REVIEW_KPI as REVIEW_KPI_SEED,
  REJECT_TEMPLATES as REJECT_TEMPLATES_SEED,
  REVIEW_COMMENTS as REVIEW_COMMENTS_SEED,
  AI_PRE_REVIEW_RESULTS as AI_PRE_REVIEW_RESULTS_SEED,
  REVIEWER_ASSIGNMENTS as REVIEWER_ASSIGNMENTS_SEED,
} from '../../data/reportReviewMock';

// ==================== IndexedDB Schema (Dexie) ====================
class RISBackendDB extends Dexie {
  patients!: EntityTable<{ id: string; data: unknown }, 'id'>;
  devices!: EntityTable<{ id: string; data: unknown }, 'id'>;
  doctors!: EntityTable<{ id: string; data: unknown }, 'id'>;
  examItems!: EntityTable<{ id: string; data: unknown }, 'id'>;
  exams!: EntityTable<{ id: string; data: unknown }, 'id'>;
  reports!: EntityTable<{ id: string; data: unknown }, 'id'>;
  criticalEvents!: EntityTable<{ id: string; data: unknown }, 'id'>;
  cosignTasks!: EntityTable<{ id: string; data: unknown }, 'id'>;
  qualityScores!: EntityTable<{ id: string; data: unknown }, 'id'>;
  doctorPerformance!: EntityTable<{ id: string; data: unknown }, 'id'>;
  dailyKpi!: EntityTable<{ id: string; data: unknown }, 'id'>;
  // 审计日志
  auditLog!: EntityTable<{ id: string; data: unknown }, 'id'>;
  // [v3.0.6.8-33] 眼科专科 28 集合 (Dexie 持久化)
  eye_studies!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_series!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_instances!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_patients!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_emrs!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_ophthalmic_exams!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_preop_assessments!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_anes_assessments!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_reports!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_report_templates!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_ai_models!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_ai_diagnoses!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_ai_heatmaps!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_appointments!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_follow_ups!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_referrals!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_surgeries!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_drugs!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_prescriptions!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_journey_events!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_education_materials!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_insurance_claims!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_schedules!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_clinical_subspecialties!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_kpis!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_quality_metrics!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_measurements!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_annotations!: EntityTable<{ id: string; data: unknown }, 'id'>;
  eye_lesion_segmentations!: EntityTable<{ id: string; data: unknown }, 'id'>;
  // [v3.0.6.12-B3] qualityScoringHandlers top-5 改造集合
  quality_dimensions!: EntityTable<{ id: string; data: unknown }, 'id'>;
  quality_scores!: EntityTable<{ id: string; data: unknown }, 'id'>;
  quality_kpi!: EntityTable<{ id: string; data: unknown }, 'id'>;
  quality_threshold_config!: EntityTable<{ id: string; data: unknown }, 'id'>;
  // [v3.0.6.12-B2] v3ReviewHandlers top-10 改造集合 (R3.REVIEW.ASSIST)
  review_ai_hints!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_history!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_comments!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_workloads!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_kpi_personal!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_sla!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_sla_config!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_reviewers!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_reject_templates!: EntityTable<{ id: string; data: unknown }, 'id'>;
  review_assignments!: EntityTable<{ id: string; data: unknown }, 'id'>;

  constructor() {
    super('RISBackendDB');
    this.version(1).stores({
      patients: 'id',
      devices: 'id',
      doctors: 'id',
      examItems: 'id',
      exams: 'id',
      reports: 'id',
      criticalEvents: 'id',
      cosignTasks: 'id',
      qualityScores: 'id',
      doctorPerformance: 'id',
      dailyKpi: 'id',
      auditLog: 'id, timestamp',
    });
    this.version(2).stores({
      // v1 集合
      patients: 'id',
      devices: 'id',
      doctors: 'id',
      examItems: 'id',
      exams: 'id',
      reports: 'id',
      criticalEvents: 'id',
      cosignTasks: 'id',
      qualityScores: 'id',
      doctorPerformance: 'id',
      dailyKpi: 'id',
      auditLog: 'id, timestamp',
      // [v3.0.6.8-33] 眼科 28 集合
      eye_studies: 'id, patientId, modality, status',
      eye_series: 'id, studyId, modality',
      eye_instances: 'id, seriesId',
      eye_patients: 'id, patientNo',
      eye_emrs: 'id, patientId, visitDate',
      eye_ophthalmic_exams: 'id, patientId, examType, examDate',
      eye_preop_assessments: 'id, patientId, surgeryDate',
      eye_anes_assessments: 'id, patientId, surgeryId',
      eye_reports: 'id, patientId, reportType, status',
      eye_report_templates: 'id, templateType, specialty',
      eye_ai_models: 'id, modelName, diseaseCategory',
      eye_ai_diagnoses: 'id, patientId, studyId, modelId, status',
      eye_ai_heatmaps: 'id, diagnosisId',
      eye_appointments: 'id, patientId, doctorId, appointmentDate, status',
      eye_follow_ups: 'id, patientId, dueDate, status',
      eye_referrals: 'id, patientId, status',
      eye_surgeries: 'id, patientId, doctorId, surgeryDate, status',
      eye_drugs: 'id, drugName, category',
      eye_prescriptions: 'id, patientId, doctorId, prescribedAt',
      eye_journey_events: 'id, patientId, eventType, eventDate',
      eye_education_materials: 'id, category, language',
      eye_insurance_claims: 'id, patientId, claimDate, status',
      eye_schedules: 'id, doctorId, scheduleDate',
      eye_notification_templates: 'id, templateType',
      eye_clinical_subspecialties: 'id, patientId, subspecialtyType',
      eye_kpis: 'id, metricName, period',
      eye_quality_metrics: 'id, studyId, examType',
      eye_measurements: 'id, studyId, measurementType',
      eye_annotations: 'id, studyId, annotationType',
      eye_lesion_segmentations: 'id, studyId',
      // [v3.0.6.8-53] 口腔专科集合
      dental_studies: 'id, patientId, modality, region',
      dental_charts: 'id, patientId',
      dental_treatments: 'id, patientId, treatmentType, status',
      dental_invoices: 'id, patientId, status',
      dental_appointments: 'id, patientId, doctorId, date',
    });
    // [v3.0.6.12-B3] qualityScoringHandlers top-5 改造: 增量声明新集合
    //   Dexie 累计保留 v1/v2 旧表, 仅新增 quality_* 4 张表
    this.version(3).stores({
      quality_dimensions: 'id',
      quality_scores: 'id, reportId',
      quality_kpi: 'id',
      quality_threshold_config: 'id',
    });
    // [v3.0.6.12-B2] v3ReviewHandlers top-10 改造: 增量声明新集合
    //   Dexie 累计保留 v1/v2/v3 旧表, 仅新增 review_* 10 张表
    this.version(4).stores({
      review_ai_hints: 'id, reportId',
      review_history: 'id, taskId, timestamp',
      review_comments: 'id, taskId, createdAt',
      review_workloads: 'id, reviewerId, period',
      review_kpi_personal: 'id',
      review_sla: 'id',
      review_sla_config: 'id',
      review_reviewers: 'id',
      review_reject_templates: 'id, category',
      review_assignments: 'id, taskId, reviewerId',
    });
  }
}

// ==================== 检测 IndexedDB 可用性 ====================
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

const USE_IDB = isIndexedDBAvailable();

let db: RISBackendDB | null = null;
if (USE_IDB) {
  try {
    db = new RISBackendDB();
  } catch (e) {
    console.warn('[RIS Backend] IndexedDB 初始化失败, 降级到纯内存:', e);
    db = null;
  }
}

// ==================== In-memory 缓存 ====================
const memoryStore: Map<string, Map<string, unknown>> = new Map();

const COLLECTIONS = [
  'patients', 'devices', 'doctors', 'examItems',
  'exams', 'reports', 'criticalEvents', 'cosignTasks',
  'qualityScores', 'doctorPerformance', 'dailyKpi',
  // [v3.0.6.8-33] 眼科专科 28 集合 (PACS/EMR/AI/RIS/Report/KPI/Subspecialty/Journey)
  'eye_studies', 'eye_series', 'eye_instances', 'eye_patients',
  'eye_emrs', 'eye_ophthalmic_exams', 'eye_preop_assessments', 'eye_anes_assessments',
  'eye_reports', 'eye_report_templates', 'eye_ai_models', 'eye_ai_diagnoses',
  'eye_ai_heatmaps', 'eye_appointments', 'eye_follow_ups', 'eye_referrals',
  'eye_surgeries', 'eye_drugs', 'eye_prescriptions', 'eye_journey_events',
  'eye_education_materials', 'eye_insurance_claims', 'eye_schedules',
  'eye_notification_templates',
  'eye_clinical_subspecialties', 'eye_kpis', 'eye_quality_metrics',
  'eye_measurements', 'eye_annotations', 'eye_lesion_segmentations',
  // [v3.0.6.8-53] 口腔专科集合
  'dental_studies', 'dental_charts', 'dental_treatments',
  'dental_invoices', 'dental_appointments',
  'cad_designs', 'implant_plans_3d', 'surgical_guides',
  'ceph_studies', 'aligner_plans',
  // [v3.0.6.11-10] 生成的演示数据
  'kpiHistory',
  'invoices',
  'sites',
  // [v3.0.6.12-A4] v3ReportHandlers top-20 路由支持集合
  'writing_templates',
  'writing_drafts',
  'writing_ai_drafts',
  'dist_channels',
  'dist_tasks',
  'dist_receipts',
  'quality_reports',
  'quality_exports',
  // [v3.0.6.12-A4] 危急值元数据集合 (从 criticalValueMock 种子加载)
  'criticalRules',
  'criticalLevels',
  'criticalEscalationRules',
  'criticalKpi',
  // [v3.0.6.12-B3] qualityScoringHandlers top-5 改造集合
  'quality_dimensions',
  'quality_scores',
  'quality_kpi',
  'quality_threshold_config',
  // [v3.0.6.12-B2] v3ReviewHandlers top-10 改造集合 (R3.REVIEW.ASSIST)
  'review_ai_hints',
  'review_history',
  'review_comments',
  'review_workloads',
  'review_kpi_personal',
  'review_sla',
  'review_sla_config',
  'review_reviewers',
  'review_reject_templates',
  'review_assignments',
  // [v3.0.6.11-60] Batch 3 壳页面真实化集合
  'pacs_servers',
  'pacs_storage',
  'term_mappings',
  'consents',
  'dental_ai_findings',
  'value5step',
  // [v3.0.6.11-61] 环境式 AI 报告草稿
  'ai_report_drafts',
] as const;
type Collection = typeof COLLECTIONS[number];

function getCollection(name: Collection): Map<string, unknown> {
  let col = memoryStore.get(name);
  if (!col) {
    col = new Map();
    memoryStore.set(name, col);
  }
  return col;
}

// [v3.0.6.11-10] 异步加载大规模检查/报告数据
async function loadGeneratedExamDataAsync(getCol: (n: string) => Map<string, unknown>, examsCol: Map<string, unknown>, reportsCol: Map<string, unknown>): Promise<void> {
  try {
    const [examsData, reportsData] = await Promise.all([
      fetch('/data/unified-exams.json').then(r => r.json()).catch(() => null),
      fetch('/data/unified-reports.json').then(r => r.json()).catch(() => null),
    ]);
    if (examsData && Array.isArray(examsData)) {
      examsData.forEach((e: any) => examsCol.set(e.id || e.reportId, e));
      console.info(`[RIS Seed] 加载了 ${examsData.length} 条统一检查数据`);
    }
    if (reportsData && Array.isArray(reportsData)) {
      reportsData.forEach((r: any) => reportsCol.set(r.id || r.reportId, r));
      console.info(`[RIS Seed] 加载了 ${reportsData.length} 条统一报告数据`);
    }
  } catch (e) {
    console.info('[RIS Seed] 演示检查/报告数据懒加载跳过（不影响运行）:', (e as Error).message);
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;

// ==================== 初始化 ====================
// [v3.0.6.12-B3] qualityScoringHandlers top-5: 同步路径使用的种子 (15 维度 + KPI + 阈值)
const QUALITY_DIMENSIONS_SEED: Array<{ id: string; key: string; category: string; name: string; weight: number }> = [
  { id: 'completeness_findings',       key: 'completeness_findings',       category: 'completeness', name: '检查所见完整性',     weight: 0.04 },
  { id: 'completeness_impression',     key: 'completeness_impression',     category: 'completeness', name: '诊断印象完整性',     weight: 0.04 },
  { id: 'completeness_recommendation', key: 'completeness_recommendation', category: 'completeness', name: '建议完整性',         weight: 0.03 },
  { id: 'completeness_structured',     key: 'completeness_structured',     category: 'completeness', name: '结构化字段完整',     weight: 0.05 },
  { id: 'completeness_signature',      key: 'completeness_signature',      category: 'completeness', name: '签名完整',           weight: 0.04 },
  { id: 'accuracy_diagnosis_match',    key: 'accuracy_diagnosis_match',    category: 'accuracy',     name: '所见-诊断一致',      weight: 0.06 },
  { id: 'accuracy_anatomy_laterality', key: 'accuracy_anatomy_laterality', category: 'accuracy',     name: '解剖方位正确',       weight: 0.04 },
  { id: 'accuracy_clinical_reference', key: 'accuracy_clinical_reference', category: 'accuracy',     name: '结合临床',           weight: 0.04 },
  { id: 'accuracy_critical_marking',   key: 'accuracy_critical_marking',   category: 'accuracy',     name: '危急值标记',         weight: 0.04 },
  { id: 'accuracy_no_contradiction',   key: 'accuracy_no_contradiction',   category: 'accuracy',     name: '无逻辑矛盾',         weight: 0.02 },
  { id: 'timeliness_tat_met',          key: 'timeliness_tat_met',          category: 'timeliness',   name: 'TAT 达标',           weight: 0.08 },
  { id: 'timeliness_priority_handling',key: 'timeliness_priority_handling',category: 'timeliness',   name: '优先级处理',         weight: 0.04 },
  { id: 'timeliness_on_time_rate',     key: 'timeliness_on_time_rate',     category: 'timeliness',   name: '个人按时率',         weight: 0.04 },
  { id: 'timeliness_submit_within_window', key: 'timeliness_submit_within_window', category: 'timeliness', name: '提交及时', weight: 0.02 },
  { id: 'timeliness_sign_within_window',   key: 'timeliness_sign_within_window',   category: 'timeliness', name: '签发及时', weight: 0.02 },
];

const QUALITY_KPI_SEED = {
  id: 'current',
  totalEvaluated: 1248,
  avgTotal: 88.6,
  publishableRate: 81.7,
  bonusEligibleRate: 41.3,
  gradeDistribution: { A: 542, B: 478, C: 168, D: 60 },
  trend30d: [],
};

const QUALITY_THRESHOLD_SEED = {
  id: 'default',
  criticalMaxMinutes: 30,
  emergencyMaxHours: 2,
  routineMaxHours: 24,
  inpatientMaxHours: 12,
  publishBlockThreshold: 60,
  bonusThreshold: 85,
  hardFailCodes: ['critical-not-marked', 'left-right-confusion'],
  version: 5,
  updatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  updatedBy: 'D001',
};

function seedQualityScoringCollections(): void {
  QUALITY_DIMENSIONS_SEED.forEach(d => getCollection('quality_dimensions').set(d.id, d));
  getCollection('quality_kpi').set('current', QUALITY_KPI_SEED);
  getCollection('quality_threshold_config').set('default', QUALITY_THRESHOLD_SEED);
}

// [v3.0.6.12-B2] v3ReviewHandlers top-10 路由种子
//   - reviewers / reject-templates / review-comments / ai-hints
//     来源: reportReviewMock.ts
//   - review-history / assignments: 初始为空, 由 POST 写入
//   - workloads / kpi-personal / sla / sla-config: 单条快照 (id='current')
function seedReviewAssistCollections(): void {
  REVIEWERS_SEED.forEach(r => getCollection('review_reviewers').set(r.id, r));
  REJECT_TEMPLATES_SEED.forEach(t => getCollection('review_reject_templates').set(t.id, t));
  REVIEW_COMMENTS_SEED.forEach(c => getCollection('review_comments').set(c.id, c));
  AI_PRE_REVIEW_RESULTS_SEED.forEach(a => getCollection('review_ai_hints').set(a.id, a));
  REVIEWER_ASSIGNMENTS_SEED.forEach(a => getCollection('review_assignments').set(a.id, a));
  WORKLOAD_STATS_SEED.forEach(w => getCollection('review_workloads').set(w.reviewerId, w));
  getCollection('review_kpi_personal').set('current', REVIEW_KPI_SEED as any);
  getCollection('review_sla').set('current', SLA_METRICS_SEED as any);
  getCollection('review_sla_config').set('default', {
    id: 'default',
    initialReviewSLA: SLA_METRICS_SEED.initialReviewSLA,
    finalReviewSLA: SLA_METRICS_SEED.finalReviewSLA,
    signSLA: SLA_METRICS_SEED.signSLA,
    cosignSLA: SLA_METRICS_SEED.cosignSLA,
    escalateSLA: SLA_METRICS_SEED.escalateSLA,
  });
}

export async function initStore(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 加载主数据池到内存 (只读基线)
    PATIENT_MASTER.forEach(p => getCollection('patients').set(p.id, p));
    DEVICE_MASTER.forEach(d => getCollection('devices').set(d.id, d));
    DOCTOR_MASTER.forEach(d => getCollection('doctors').set(d.id, d));
    EXAM_ITEM_MASTER.forEach(e => getCollection('examItems').set(e.code, e));

    // 加载生成器预生成数据
    EXAM_REPORT_PRE.forEach(e => getCollection('exams').set(e.reportId, e));
    // [Agent-B.1] 将 initialRadiologyExams (RAD-EX001..RAD-EX200) 也 seed 进 exams,
    //   ID 不与 EXAM_REPORT_PRE (RPT-...) 或 unified-exams.json (RAD-EX-...) 冲突,
    //   确保 store 加载早期/IDB 恢复失败时 fallback 数据可从 store 读取.
    initialRadiologyExams.forEach(e => getCollection('exams').set(e.id, e));
    QUALITY_SCORE_PRE.forEach(q => getCollection('qualityScores').set(q.id, q));
    // [v3.0.6.12-A4] criticalEvents 仅由 GENERATED_CRITICAL_VALUES 提供 (500 条),
    //   原 CRITICAL_EVENTS_PRE (300 条) 已移除以避免同 collection 两种 shape 混存.
    COSIGN_TASKS_PRE.forEach(c => getCollection('cosignTasks').set(c.id, c));
    DOCTOR_PERFORMANCE_PRE.forEach(d => getCollection('doctorPerformance').set(d.id, d));
    DAILY_KPI_PRE.forEach(d => getCollection('dailyKpi').set(d.date, d));

    // [v3.0.6.12-A4] 危急值元数据 (规则/级别/升级/KPI) 从 criticalValueMock 种子加载
    CRITICAL_RULES.forEach(r => getCollection('criticalRules').set(r.id, r));
    CRITICAL_LEVELS.forEach(l => getCollection('criticalLevels').set(l.level, l));
    CRITICAL_ESCALATION_RULES.forEach(r => getCollection('criticalEscalationRules').set(r.id, r));
    getCollection('criticalKpi').set('current', CRITICAL_KPI as any);

    // [v3.0.6.12-B3] qualityScoringHandlers top-5 路由种子
    //   dimensions: 15 条按 key 作为 id 加载
    //   kpi / threshold_config: 单条当前快照 (id = 'current' / 'default')
    //   scores: 初始为空, 由 POST /evaluate 写入
    seedQualityScoringCollections();

    // [v3.0.6.12-B2] v3ReviewHandlers top-10 路由种子
    //   reviewers (10) / reject-templates (12) / review-comments (5) / ai-hints (2)
    //   assignments (3) / workloads (6) / kpi-personal / sla / sla-config (单条快照)
    seedReviewAssistCollections();

    // [v3.0.6.11-10] 生成的演示数据 (动态导入, 避免大量 mock 数据打入主 bundle)
    try {
      const [
        { GENERATED_CRITICAL_VALUES: cv },
        { KPI_HISTORY: kpiH },
        { GENERATED_INVOICES: inv },
        { SITE_CONFIG: sc },
      ] = await Promise.all([
        import('../../data/unifiedCriticalValues'),
        import('../../data/kpiHistory'),
        import('../../data/unifiedFinanceMock'),
        import('../../data/siteMasterMock'),
      ]);
      cv.forEach((cvItem: any) => getCollection('criticalEvents').set(cvItem.id, cvItem));
      kpiH && Object.entries(kpiH).forEach(([kpiId, days]) => {
        (days as any[]).forEach((d: any) => getCollection('kpiHistory').set(`${kpiId}-${d.date}`, d));
      });
      inv && inv.forEach((invItem: any) => getCollection('invoices').set(invItem.invoiceId, invItem));
      sc && sc.forEach((s: any) => getCollection('sites').set(s.siteId, s));
      console.info(`[RIS Seed] 加载了 ${cv.length} 条危急值, ${Object.keys(kpiH||{}).length} 个KPI, ${(inv||[]).length} 张发票, ${(sc||[]).length} 个院区`);
    } catch (e) {
      console.warn('[RIS Seed] 部分演示数据加载失败（不影响运行）:', (e as Error).message);
    }

    // 异步加载大规模检查/报告数据 (JSON 文件，懒加载)
    loadGeneratedExamDataAsync(getCollection, getCollection('exams'), getCollection('reports'));

    // [v3.0.6.8-33] 眼科专科数据加载 (从 src/data/eye*Mock.ts)
    MOCK_EYE_PATIENTS.forEach((p: any) => getCollection('eye_patients').set(p.id || p.patientId || `EP${Date.now()}-${Math.random()}`, p));
    MOCK_EYE_STUDIES.forEach((s: any) => getCollection('eye_studies').set(s.studyId || s.id, s));
    MOCK_EYE_SERIES.forEach((s: any) => getCollection('eye_series').set(s.seriesId || s.id, s));
    MOCK_EYE_MEASUREMENTS.forEach((m: any) => getCollection('eye_measurements').set(m.id || `MS${Date.now()}-${Math.random()}`, m));
    MOCK_ANNOTATIONS.forEach((a: any, i: number) => getCollection('eye_annotations').set(a.id || `AN${i}`, a));
    MOCK_LESION_SEGMENTATIONS.forEach((l: any, i: number) => getCollection('eye_lesion_segmentations').set(l.id || `LS${i}`, l));
    MOCK_KEY_IMAGES.forEach((k: any, i: number) => getCollection('eye_instances').set(k.id || `KI${i}`, k));
    MOCK_OCT_MAPS.forEach((o: any, i: number) => getCollection('eye_instances').set(o.id || `OCT${i}`, o));
    MOCK_VISUAL_FIELDS.forEach((v: any, i: number) => getCollection('eye_instances').set(v.id || `VF${i}`, v));

    MOCK_OPHTHALMOLOGY_EMR_LIST.forEach((e: any) => getCollection('eye_emrs').set(e.id || e.emrId, e));
    MOCK_PRE_OP_ASSESSMENTS.forEach((p: any, i: number) => getCollection('eye_preop_assessments').set(p.id || `POA${i}`, p));

    MOCK_AI_MODELS.forEach((m: any) => getCollection('eye_ai_models').set(m.id || m.modelId, m));
    MOCK_AI_DIAGNOSES.forEach((d: any) => getCollection('eye_ai_diagnoses').set(d.id || d.diagnosisId, d));
    MOCK_AI_HEATMAPS.forEach((h: any, i: number) => getCollection('eye_ai_heatmaps').set(h.id || `HM${i}`, h));

    MOCK_APPOINTMENTS.forEach((a: any) => getCollection('eye_appointments').set(a.id || a.appointmentId, a));
    MOCK_FOLLOW_UPS.forEach((f: any) => getCollection('eye_follow_ups').set(f.id || f.followUpId, f));
    MOCK_REFERRALS.forEach((r: any) => getCollection('eye_referrals').set(r.id || r.referralId, r));
    MOCK_SURGERY_APPOINTMENTS.forEach((s: any, i: number) => getCollection('eye_surgeries').set(s.id || `SURG${i}`, s));

    MOCK_OPHTHALMIC_DRUGS.forEach((d: any) => getCollection('eye_drugs').set(d.id || d.drugId, d));
    MOCK_PRESCRIPTIONS.forEach((p: any, i: number) => getCollection('eye_prescriptions').set(p.id || `RX${i}`, p));

    MOCK_VISION.forEach((v: any, i: number) => getCollection('eye_ophthalmic_exams').set(v.id || `VIS${i}`, v));

    MOCK_REPORT_TEMPLATES.forEach((t: any) => getCollection('eye_report_templates').set(t.id || t.templateId, t));
    MOCK_REPORTS.forEach((r: any) => getCollection('eye_reports').set(r.id || r.reportId, r));

    MOCK_QUALITY_METRICS.forEach((q: any, i: number) => getCollection('eye_kpis').set(q.id || `KPI${i}`, q));
    MOCK_IMAGE_QC.forEach((q: any, i: number) => getCollection('eye_quality_metrics').set(q.id || `QC${i}`, q));

    MOCK_STRABISMUS_EXAMS.forEach((s: any, i: number) => getCollection('eye_clinical_subspecialties').set(s.id || `STR${i}`, { ...s, subspecialtyType: 'strabismus' }));
    MOCK_NEURO_OPHTHALMIC_EXAMS.forEach((n: any, i: number) => getCollection('eye_clinical_subspecialties').set(n.id || `NEURO${i}`, { ...n, subspecialtyType: 'neuro_ophthalmology' }));
    MOCK_ONCOLOGY_RECORDS.forEach((o: any, i: number) => getCollection('eye_clinical_subspecialties').set(o.id || `ONC${i}`, { ...o, subspecialtyType: 'ocular_oncology' }));
    MOCK_CONTACT_LENS_FITTINGS.forEach((c: any, i: number) => getCollection('eye_clinical_subspecialties').set(c.id || `CL${i}`, { ...c, subspecialtyType: 'contact_lens' }));
    MOCK_LOW_VISION_ASSESSMENTS.forEach((l: any, i: number) => getCollection('eye_clinical_subspecialties').set(l.id || `LV${i}`, { ...l, subspecialtyType: 'low_vision' }));

    MOCK_EDUCATION_MATERIALS.forEach((e: any) => getCollection('eye_education_materials').set(e.id || e.materialId, e));
    MOCK_INSURANCE_CLAIMS.forEach((c: any, i: number) => getCollection('eye_insurance_claims').set(c.id || `IC${i}`, c));
    MOCK_DOCTOR_SCHEDULES.forEach((s: any, i: number) => getCollection('eye_schedules').set(s.id || `SCH${i}`, s));
    MOCK_NOTIFICATION_TEMPLATES.forEach((n: any, i: number) => getCollection('eye_notification_templates').set(n.id || `NT${i}`, n));

    MOCK_CRITICAL_VALUES.forEach((c: any) => getCollection('eye_journey_events').set(c.id || c.criticalValueId, { ...c, eventType: 'critical_value' }));
    MOCK_FINDINGS_LIBRARY.forEach((f: any, i: number) => getCollection('eye_journey_events').set(f.id || `FL${i}`, { ...f, eventType: 'finding' }));
    MOCK_GRADING_SCALES.forEach((g: any, i: number) => getCollection('eye_journey_events').set(g.id || `GS${i}`, { ...g, eventType: 'grading_scale' }));
    MOCK_IOL_INVENTORY.forEach((i: any, idx: number) => getCollection('eye_journey_events').set(i.id || `IOL${idx}`, { ...i, eventType: 'iol_inventory' }));

    // [v3.0.6.8-53] 口腔专科数据加载
    MOCK_DENTAL_STUDIES.forEach((s: any) => getCollection('dental_studies').set(s.id || s.studyId, s));
    MOCK_DENTAL_CHARTS.forEach((c: any) => getCollection('dental_charts').set(c.patientId, c));
    MOCK_DENTAL_TREATMENTS.forEach((t: any) => getCollection('dental_treatments').set(t.id, t));
    MOCK_INVOICES.forEach((inv: any, i: number) => getCollection('dental_invoices').set(inv.id || `INV${i}`, inv));

    // 从 IDB 恢复用户修改 (覆盖基线)
    if (db) {
      try {
        for (const coll of COLLECTIONS) {
          const tbl = (db as any)[coll];
          if (!tbl) continue;
          const records = await tbl.toArray();
          records.forEach((r: { id: string; data: unknown }) => {
            getCollection(coll).set(r.id, r.data);
          });
        }
        console.info('[RIS Backend] IndexedDB 持久化数据已加载');
      } catch (e) {
        console.warn('[RIS Backend] IDB 读取失败, 用基线数据:', e);
      }
    }

    initialized = true;
  })();

  return initPromise;
}

// [v3.0.6.12-B5] 延迟加载模块 (用于同步路径, 避免静态导入大 mock 数据)
let _heavyDataPromise: Promise<void> | null = null;
function loadHeavyDataAsync(): void {
  if (_heavyDataPromise) return;
  _heavyDataPromise = (async () => {
    try {
      const [
        { GENERATED_CRITICAL_VALUES: cv },
        { KPI_HISTORY: kpiH },
        { GENERATED_INVOICES: inv },
        { SITE_CONFIG: sc },
      ] = await Promise.all([
        import('../../data/unifiedCriticalValues'),
        import('../../data/kpiHistory'),
        import('../../data/unifiedFinanceMock'),
        import('../../data/siteMasterMock'),
      ]);
      cv.forEach((cvItem: any) => getCollection('criticalEvents').set(cvItem.id, cvItem));
      kpiH && Object.entries(kpiH).forEach(([kpiId, days]) => {
        (days as any[]).forEach((d: any) => getCollection('kpiHistory').set(`${kpiId}-${d.date}`, d));
      });
      inv && inv.forEach((invItem: any) => getCollection('invoices').set(invItem.invoiceId, invItem));
      sc && sc.forEach((s: any) => getCollection('sites').set(s.siteId, s));
    } catch (e) { console.warn('[RIS Seed] 重数据同步加载跳过:', (e as Error).message); }
  })();
}

// ==================== 同步初始化 (用于同步代码路径) ====================
export function ensureInitialized(): void {
  if (initialized) return;
  // 同步模式: 直接加载基线数据, 不等待 IDB
  PATIENT_MASTER.forEach(p => getCollection('patients').set(p.id, p));
  DEVICE_MASTER.forEach(d => getCollection('devices').set(d.id, d));
  DOCTOR_MASTER.forEach(d => getCollection('doctors').set(d.id, d));
  EXAM_ITEM_MASTER.forEach(e => getCollection('examItems').set(e.code, e));
  EXAM_REPORT_PRE.forEach(e => getCollection('exams').set(e.reportId, e));
  // [Agent-B.1] 同步路径同样 seed initialRadiologyExams (RAD-EX001..RAD-EX200)
  initialRadiologyExams.forEach(e => getCollection('exams').set(e.id, e));
  QUALITY_SCORE_PRE.forEach(q => getCollection('qualityScores').set(q.id, q));
  // [v3.0.6.12-A4] criticalEvents 仅由 GENERATED_CRITICAL_VALUES 提供
  COSIGN_TASKS_PRE.forEach(c => getCollection('cosignTasks').set(c.id, c));
  DOCTOR_PERFORMANCE_PRE.forEach(d => getCollection('doctorPerformance').set(d.id, d));
  DAILY_KPI_PRE.forEach(d => getCollection('dailyKpi').set(d.date, d));
  // [v3.0.6.12-B5] 重数据异步加载 (不阻塞同步路径, 首次 list/get 会触发)
  loadHeavyDataAsync();
  // [v3.0.6.12-A4] 危急值元数据 (规则/级别/升级/KPI) 同步加载
  CRITICAL_RULES.forEach(r => getCollection('criticalRules').set(r.id, r));
  CRITICAL_LEVELS.forEach(l => getCollection('criticalLevels').set(l.level, l));
  CRITICAL_ESCALATION_RULES.forEach(r => getCollection('criticalEscalationRules').set(r.id, r));
  getCollection('criticalKpi').set('current', CRITICAL_KPI as any);
  // [v3.0.6.12-B3] qualityScoringHandlers top-5 同步种子
  seedQualityScoringCollections();
  // [v3.0.6.12-B2] v3ReviewHandlers top-10 同步种子
  seedReviewAssistCollections();
  loadEyeMockDataSync();
  initialized = true;
}

// [v3.0.6.8-33] 同步加载眼科 mock (供 ensureInitialized 调用)
function loadEyeMockDataSync(): void {
  (MOCK_EYE_PATIENTS as any[]).forEach((p: any) => getCollection('eye_patients').set(p.id || p.patientId || `EP${Math.random()}`, p));
  (MOCK_EYE_STUDIES as any[]).forEach((s: any) => getCollection('eye_studies').set(s.studyId || s.id, s));
  (MOCK_EYE_SERIES as any[]).forEach((s: any) => getCollection('eye_series').set(s.seriesId || s.id, s));
  (MOCK_EYE_MEASUREMENTS as any[]).forEach((m: any, i: number) => getCollection('eye_measurements').set(m.id || `MS${i}`, m));
  (MOCK_ANNOTATIONS as any[]).forEach((a: any, i: number) => getCollection('eye_annotations').set(a.id || `AN${i}`, a));
  (MOCK_LESION_SEGMENTATIONS as any[]).forEach((l: any, i: number) => getCollection('eye_lesion_segmentations').set(l.id || `LS${i}`, l));
  (MOCK_KEY_IMAGES as any[]).forEach((k: any, i: number) => getCollection('eye_instances').set(k.id || `KI${i}`, k));
  (MOCK_OCT_MAPS as any[]).forEach((o: any, i: number) => getCollection('eye_instances').set(o.id || `OCT${i}`, o));
  (MOCK_VISUAL_FIELDS as any[]).forEach((v: any, i: number) => getCollection('eye_instances').set(v.id || `VF${i}`, v));
  (MOCK_OPHTHALMOLOGY_EMR_LIST as any[]).forEach((e: any) => getCollection('eye_emrs').set(e.id || e.emrId, e));
  (MOCK_PRE_OP_ASSESSMENTS as any[]).forEach((p: any, i: number) => getCollection('eye_preop_assessments').set(p.id || `POA${i}`, p));
  (MOCK_AI_MODELS as any[]).forEach((m: any) => getCollection('eye_ai_models').set(m.id || m.modelId, m));
  (MOCK_AI_DIAGNOSES as any[]).forEach((d: any) => getCollection('eye_ai_diagnoses').set(d.id || d.diagnosisId, d));
  (MOCK_AI_HEATMAPS as any[]).forEach((h: any, i: number) => getCollection('eye_ai_heatmaps').set(h.id || `HM${i}`, h));
  (MOCK_APPOINTMENTS as any[]).forEach((a: any) => getCollection('eye_appointments').set(a.id || a.appointmentId, a));
  (MOCK_FOLLOW_UPS as any[]).forEach((f: any) => getCollection('eye_follow_ups').set(f.id || f.followUpId, f));
  (MOCK_REFERRALS as any[]).forEach((r: any) => getCollection('eye_referrals').set(r.id || r.referralId, r));
  (MOCK_SURGERY_APPOINTMENTS as any[]).forEach((s: any, i: number) => getCollection('eye_surgeries').set(s.id || `SURG${i}`, s));
  (MOCK_OPHTHALMIC_DRUGS as any[]).forEach((d: any) => getCollection('eye_drugs').set(d.id || d.drugId, d));
  (MOCK_PRESCRIPTIONS as any[]).forEach((p: any, i: number) => getCollection('eye_prescriptions').set(p.id || `RX${i}`, p));
  (MOCK_VISION as any[]).forEach((v: any, i: number) => getCollection('eye_ophthalmic_exams').set(v.id || `VIS${i}`, v));
  (MOCK_REPORT_TEMPLATES as any[]).forEach((t: any) => getCollection('eye_report_templates').set(t.id || t.templateId, t));
  (MOCK_REPORTS as any[]).forEach((r: any) => getCollection('eye_reports').set(r.id || r.reportId, r));
  (MOCK_QUALITY_METRICS as any[]).forEach((q: any, i: number) => getCollection('eye_kpis').set(q.id || `KPI${i}`, q));
  (MOCK_IMAGE_QC as any[]).forEach((q: any, i: number) => getCollection('eye_quality_metrics').set(q.id || `QC${i}`, q));
  (MOCK_STRABISMUS_EXAMS as any[]).forEach((s: any, i: number) => getCollection('eye_clinical_subspecialties').set(s.id || `STR${i}`, { ...s, subspecialtyType: 'strabismus' }));
  (MOCK_NEURO_OPHTHALMIC_EXAMS as any[]).forEach((n: any, i: number) => getCollection('eye_clinical_subspecialties').set(n.id || `NEURO${i}`, { ...n, subspecialtyType: 'neuro_ophthalmology' }));
  (MOCK_ONCOLOGY_RECORDS as any[]).forEach((o: any, i: number) => getCollection('eye_clinical_subspecialties').set(o.id || `ONC${i}`, { ...o, subspecialtyType: 'ocular_oncology' }));
  (MOCK_CONTACT_LENS_FITTINGS as any[]).forEach((c: any, i: number) => getCollection('eye_clinical_subspecialties').set(c.id || `CL${i}`, { ...c, subspecialtyType: 'contact_lens' }));
  (MOCK_LOW_VISION_ASSESSMENTS as any[]).forEach((l: any, i: number) => getCollection('eye_clinical_subspecialties').set(l.id || `LV${i}`, { ...l, subspecialtyType: 'low_vision' }));
  (MOCK_EDUCATION_MATERIALS as any[]).forEach((e: any) => getCollection('eye_education_materials').set(e.id || e.materialId, e));
  (MOCK_INSURANCE_CLAIMS as any[]).forEach((c: any, i: number) => getCollection('eye_insurance_claims').set(c.id || `IC${i}`, c));
  (MOCK_DOCTOR_SCHEDULES as any[]).forEach((s: any, i: number) => getCollection('eye_schedules').set(s.id || `SCH${i}`, s));
  (MOCK_NOTIFICATION_TEMPLATES as any[]).forEach((n: any, i: number) => getCollection('eye_notification_templates').set(n.id || `NT${i}`, n));
  (MOCK_CRITICAL_VALUES as any[]).forEach((c: any) => getCollection('eye_journey_events').set(c.id || c.criticalValueId, { ...c, eventType: 'critical_value' }));
  (MOCK_FINDINGS_LIBRARY as any[]).forEach((f: any, i: number) => getCollection('eye_journey_events').set(f.id || `FL${i}`, { ...f, eventType: 'finding' }));
  (MOCK_GRADING_SCALES as any[]).forEach((g: any, i: number) => getCollection('eye_journey_events').set(g.id || `GS${i}`, { ...g, eventType: 'grading_scale' }));
  (MOCK_IOL_INVENTORY as any[]).forEach((i: any, idx: number) => getCollection('eye_journey_events').set(i.id || `IOL${idx}`, { ...i, eventType: 'iol_inventory' }));
  // [v3.0.6.8-53] 口腔专科数据加载
  (MOCK_DENTAL_STUDIES as any[]).forEach((s: any) => getCollection('dental_studies').set(s.id || s.studyId, s));
  (MOCK_DENTAL_CHARTS as any[]).forEach((c: any) => getCollection('dental_charts').set(c.patientId, c));
  (MOCK_DENTAL_TREATMENTS as any[]).forEach((t: any) => getCollection('dental_treatments').set(t.id, t));
  (MOCK_INVOICES as any[]).forEach((inv: any, i: number) => getCollection('dental_invoices').set(inv.id || `INV${i}`, inv));
}

// ==================== CRUD 操作 ====================
export function list<T = unknown>(collection: Collection): T[] {
  ensureInitialized();
  const col = getCollection(collection);
  return Array.from(col.values()) as T[];
}

export function listPaginated<T = unknown>(collection: Collection, page: number = 1, pageSize: number = 50): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  ensureInitialized();
  const col = getCollection(collection);
  const all = Array.from(col.values()) as T[];
  const total = all.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, total, page, pageSize, totalPages };
}

export function get<T = unknown>(collection: Collection, id: string): T | undefined {
  ensureInitialized();
  return getCollection(collection).get(id) as T | undefined;
}

export function findOne<T = unknown>(collection: Collection, predicate: (item: T) => boolean): T | undefined {
  ensureInitialized();
  const col = getCollection(collection);
  for (const item of col.values()) {
    if (predicate(item as T)) return item as T;
  }
  return undefined;
}

export function findMany<T = unknown>(collection: Collection, predicate: (item: T) => boolean): T[] {
  ensureInitialized();
  const col = getCollection(collection);
  const result: T[] = [];
  for (const item of col.values()) {
    if (predicate(item as T)) result.push(item as T);
  }
  return result;
}

export function create<T extends { id: string }>(collection: Collection, item: T): T {
  ensureInitialized();
  getCollection(collection).set(item.id, item);
  persistAsync(collection, item.id, item);
  return item;
}

export function update<T extends { id: string }>(collection: Collection, id: string, updates: Partial<T>): T | undefined {
  ensureInitialized();
  const col = getCollection(collection);
  const existing = col.get(id) as T | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, id } as T;
  col.set(id, updated);
  persistAsync(collection, id, updated);
  return updated;
}

export function remove(collection: Collection, id: string): boolean {
  ensureInitialized();
  const col = getCollection(collection);
  const existed = col.delete(id);
  if (existed && db) {
    try {
      const tbl = (db as any)[collection];
      if (tbl) tbl.delete(id);
    } catch {}
  }
  return existed;
}

export function clear(collection: Collection): void {
  ensureInitialized();
  getCollection(collection).clear();
  if (db) {
    try {
      const tbl = (db as any)[collection];
      if (tbl) tbl.clear();
    } catch {}
  }
}

// ==================== 持久化 (异步, 不阻塞返回) ====================
function persistAsync(collection: Collection, id: string, data: unknown): void {
  if (!db) return;
  const tbl = (db as any)[collection];
  if (!tbl) return;
  tbl.put({ id, data }).catch((e: Error) => {
    console.warn(`[RIS Backend] IDB 写入失败 ${collection}/${id}:`, e.message);
  });
}

// ==================== 审计日志 ====================
export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'read' | 'status_change';
  resource: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

export function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  const full: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  if (db) {
    try {
      db.auditLog.put({ id: full.id, data: full });
    } catch {}
  }
  // 内存中也保留最近 1000 条
  if (!memoryStore.has('auditLog')) memoryStore.set('auditLog', new Map());
  const auditMap = memoryStore.get('auditLog')!;
  auditMap.set(full.id, full);
  if (auditMap.size > 1000) {
    const oldest = Array.from(auditMap.keys()).slice(0, auditMap.size - 1000);
    oldest.forEach(k => auditMap.delete(k));
  }
}

export function listAudit(limit = 100): AuditEntry[] {
  ensureInitialized();
  const col = memoryStore.get('auditLog');
  if (!col) return [];
  return Array.from(col.values())
    .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit) as AuditEntry[];
}

// ==================== 状态查询 ====================
export function stats() {
  const result: Record<string, number> = {};
  for (const coll of COLLECTIONS) {
    result[coll] = getCollection(coll).size;
  }
  result['auditLog'] = memoryStore.get('auditLog')?.size || 0;
  return result;
}

export function isUsingIndexedDB(): boolean {
  return USE_IDB && db !== null;
}

// ==================== 重置 (测试用) ====================
export async function resetStore(): Promise<void> {
  if (db) {
    for (const coll of [...COLLECTIONS, 'auditLog' as Collection]) {
      const tbl = (db as any)[coll];
      if (tbl) await tbl.clear();
    }
  }
  memoryStore.clear();
  initialized = false;
  initPromise = null;
  await initStore();
}
