// [v3.0.6.8-32] In-memory Store + IndexedDB 持久化
// 支持 CRUD 操作, 写入自动持久到 IDB, 启动时从 IDB 恢复
import Dexie, { type EntityTable } from 'dexie';
import {
  PATIENT_MASTER, DEVICE_MASTER, DOCTOR_MASTER, EXAM_ITEM_MASTER,
} from '../../data/master';
import {
  EXAM_REPORT_PRE, DOCTOR_PERFORMANCE_PRE, DAILY_KPI_PRE,
  CRITICAL_EVENTS_PRE, COSIGN_TASKS_PRE, QUALITY_SCORE_PRE,
} from '../../data/_generators';
// [v3.0.6.11-10] 生成的大规模演示数据
import { GENERATED_CRITICAL_VALUES } from '../../data/generatedCriticalValues';
import { KPI_HISTORY } from '../../data/kpiHistory';
import { SITE_CONFIG } from '../../data/siteMasterMock';
import { GENERATED_INVOICES } from '../../data/financeMock';
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
  // [v3.0.6.11-10] 生成的演示数据
  'reports',
  'kpiHistory',
  'invoices',
  'sites',
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
      fetch('/data/generated-exams.json').then(r => r.json()).catch(() => null),
      fetch('/data/generated-reports.json').then(r => r.json()).catch(() => null),
    ]);
    if (examsData && Array.isArray(examsData)) {
      examsData.slice(0, 3000).forEach((e: any) => examsCol.set(e.id || e.reportId, e));
      console.info(`[RIS Seed] 加载了 ${Math.min(3000, examsData.length)} 条演示检查`);
    }
    if (reportsData && Array.isArray(reportsData)) {
      reportsData.slice(0, 2000).forEach((r: any) => reportsCol.set(r.id || r.reportId, r));
      console.info(`[RIS Seed] 加载了 ${Math.min(2000, reportsData.length)} 条演示报告`);
    }
  } catch (e) {
    console.info('[RIS Seed] 演示检查/报告数据懒加载跳过（不影响运行）:', (e as Error).message);
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;

// ==================== 初始化 ====================
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
    QUALITY_SCORE_PRE.forEach(q => getCollection('qualityScores').set(q.id, q));
    CRITICAL_EVENTS_PRE.forEach(c => getCollection('criticalEvents').set(c.id, c));
    COSIGN_TASKS_PRE.forEach(c => getCollection('cosignTasks').set(c.id, c));
    DOCTOR_PERFORMANCE_PRE.forEach(d => getCollection('doctorPerformance').set(d.id, d));
    DAILY_KPI_PRE.forEach(d => getCollection('dailyKpi').set(d.date, d));

    // [v3.0.6.11-10] 生成的演示数据
    try {
      GENERATED_CRITICAL_VALUES.forEach((cv: any) => getCollection('criticalEvents').set(cv.id, cv));
      KPI_HISTORY && Object.entries(KPI_HISTORY).forEach(([kpiId, days]) => {
        days.forEach((d: any) => getCollection('kpiHistory').set(`${kpiId}-${d.date}`, d));
      });
      GENERATED_INVOICES && GENERATED_INVOICES.forEach((inv: any) => getCollection('invoices').set(inv.invoiceId, inv));
      SITE_CONFIG && SITE_CONFIG.forEach((s: any) => getCollection('sites').set(s.siteId, s));
      console.info(`[RIS Seed] 加载了 ${GENERATED_CRITICAL_VALUES.length} 条危急值, ${Object.keys(KPI_HISTORY||{}).length} 个KPI, ${(GENERATED_INVOICES||[]).length} 张发票, ${(SITE_CONFIG||[]).length} 个院区`);
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

// ==================== 同步初始化 (用于同步代码路径) ====================
export function ensureInitialized(): void {
  if (initialized) return;
  // 同步模式: 直接加载基线数据, 不等待 IDB
  PATIENT_MASTER.forEach(p => getCollection('patients').set(p.id, p));
  DEVICE_MASTER.forEach(d => getCollection('devices').set(d.id, d));
  DOCTOR_MASTER.forEach(d => getCollection('doctors').set(d.id, d));
  EXAM_ITEM_MASTER.forEach(e => getCollection('examItems').set(e.code, e));
  EXAM_REPORT_PRE.forEach(e => getCollection('exams').set(e.reportId, e));
  QUALITY_SCORE_PRE.forEach(q => getCollection('qualityScores').set(q.id, q));
  CRITICAL_EVENTS_PRE.forEach(c => getCollection('criticalEvents').set(c.id, c));
  COSIGN_TASKS_PRE.forEach(c => getCollection('cosignTasks').set(c.id, c));
  DOCTOR_PERFORMANCE_PRE.forEach(d => getCollection('doctorPerformance').set(d.id, d));
  DAILY_KPI_PRE.forEach(d => getCollection('dailyKpi').set(d.date, d));
  // [v3.0.6.11-10] 同步加载部分生成数据
  try {
    GENERATED_CRITICAL_VALUES.forEach((cv: any) => getCollection('criticalEvents').set(cv.id, cv));
    if (KPI_HISTORY) Object.entries(KPI_HISTORY).forEach(([kpiId, days]) => {
      (days as any[]).forEach((d: any) => getCollection('kpiHistory').set(`${kpiId}-${d.date}`, d));
    });
    if (GENERATED_INVOICES) GENERATED_INVOICES.forEach((inv: any) => getCollection('invoices').set(inv.invoiceId, inv));
    if (SITE_CONFIG) SITE_CONFIG.forEach((s: any) => getCollection('sites').set(s.siteId, s));
  } catch (e) { console.warn('[RIS Seed] 同步加载警告:', (e as Error).message); }
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
