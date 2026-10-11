/**
 * G005 放射RIS系统 - Prisma Seed (商业演示级关系型数据集)
 *
 * [规模] users 5 | devices 25 | patients 30 | exams 60 | reports 45 | critical values 15
 *        appointments 20 | contrast administrations 10 | dose records 5
 *        rads templates 5 | report templates 6 | hanging protocols 8 | DICOM samples N
 *
 * [确定性] 所有随机决策来自本文件内的 mulberry32 (固定 seed = 0x47303035 = G005),
 *          全文件无 Math.random; 时间戳以当天 00:00 为锚点推导 (演示数据保持近时效),
 *          同一天重复执行 buildDemoDataset 结果完全一致。
 *
 * [幂等]   自然唯一键走 upsert / find-then-update; 无唯一键的演示表走 clear-then-seed
 *          (清理范围只落在本 seed 自己的数据上, 见各段注释)。
 *
 * [schema.prisma 无对应列的字段落库约定] (schema 不在本次改动范围内)
 *   开单医生      -> audit_logs resource='exam-order' (userId=开单医生, resourceId=exam.id,
 *                    detail.orderingDoctorId / orderingDoctor)
 *   设备 AE Title -> audit_logs resource='device-ae-title' (resourceId=device.id, detail.aeTitle)
 *   危急值 <-> 报告 -> critical_values.confirmed_comment(JSON.reportId) + reports.is_critical=true
 *                    (CriticalValue 无 report_id 列; 两侧统一以 exam 关联保持关系一致:
 *                     critical.exam_id = report.exam_id)
 *   对比剂使用    -> audit_logs resource='contrast-administration' (resourceId=exam.id,
 *                    detail{contrastAgent, volumeMl, adverseEvent, ...}) - 沿用 devicemgmt
 *                    将对比剂数据写 audit_logs 的既有惯例
 *   剂量 DAP/DRL  -> dose_records 落 CTDIvol/DLP/SSDE + audit_logs resource='dose-dap'
 *                    落 DAP 与 DRL 达标判定 (rdsr.service 亦可由 CTDIvol/DLP 现算, 此处为快照)
 */
import { PrismaClient, Prisma, UserRole, Gender, DeviceState, ReportState, CriticalState, CriticalSeverity, NotificationMethod, PatientType, AppointmentState, AppointmentPriority, RadsCategory } from '@prisma/client'
import { hash } from 'bcrypt'
import * as fs from 'node:fs'
import * as path from 'node:path'

const prisma = new PrismaClient()

const TENANT = 'default'
const DAY_MS = 86_400_000
const SEED_RNG = 0x47303035 // G005
const SEED_ACTION = 'SEED'

/* ==================================================================== *
 * 1. 确定性随机 (mulberry32) - 全文件唯一随机源, 禁止 Math.random
 * ==================================================================== */

type Rng = () => number

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1))
}

function pickOne<T>(r: Rng, pool: readonly T[]): T {
  return pool[Math.floor(r() * pool.length)]!
}

function shuffled<T>(r: Rng, input: readonly T[]): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

/** 在 arr 中均匀取 n 个 (不消耗随机数, 用于保证对比剂/剂量等实体数量精确) */
function evenlySpaced<T>(arr: readonly T[], n: number): T[] {
  if (n >= arr.length) return [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]!)
  return out
}

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function at(day: Date, dayOffset: number, hour: number, minute: number): Date {
  return new Date(day.getTime() + dayOffset * DAY_MS + hour * 3600000 + minute * 60000)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function pad(v: number, len: number): string {
  return String(v).padStart(len, '0')
}

/* ==================================================================== *
 * 2. 中文姓名池 (60 个常见姓 + 男/女名池, 确定性组合)
 * ==================================================================== */

const SURNAMES = [
  '赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈',
  '蒋', '沈', '韩', '杨', '朱', '秦', '许', '何', '吕', '施',
  '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜', '谢',
  '邹', '柏', '窦', '章', '云', '苏', '潘', '葛', '范', '彭',
  '鲁', '韦', '昌', '马', '苗', '凤', '花', '方', '俞', '任',
  '袁', '柳', '邝', '唐', '罗', '薛', '雷', '贺', '汤', '梁',
]

const MALE_GIVEN = [
  '伟', '强', '军', '洋', '勇', '杰', '涛', '明', '超', '刚',
  '平', '辉', '健', '俊', '磊', '鹏', '飞', '波', '斌', '志远',
  '建国', '志强', '浩然', '子轩', '宇航', '立诚', '嘉豪', '天佑', '文博', '一鸣',
  '承志', '若谷', '铭轩', '世豪', '昊然', '俊杰', '远航', '宏斌', '正阳', '泽宇',
]

const FEMALE_GIVEN = [
  '芳', '娜', '敏', '静', '丽', '娟', '霞', '燕', '玲', '桂',
  '英', '梅', '雪', '婷', '悦', '婧', '欣', '琳', '怡', '佳',
  '若涵', '雨欣', '梦瑶', '晓彤', '思颖', '语嫣', '芷若', '沁雯', '慧敏', '秀兰',
  '凤英', '玉兰', '红梅', '淑芬', '翠萍', '桂英', '月华', '丹丹', '婉婷', '雅静',
]

/** 与 5 个登录账号同名会混淆, 患者池内回避 */
const RESERVED_NAMES = ['系统管理员', '李明辉', '王芳', '张伟', '刘洋']

const ID_AREAS = [
  '110101', '310101', '440106', '330106', '320102', '420106', '510104', '610103',
  '210102', '370102', '120101', '500101', '430102', '350102', '410102', '230102',
]

const PHONE_PREFIX = [
  '133', '135', '136', '137', '138', '139', '150', '151', '158', '159',
  '176', '177', '186', '188', '199', '131', '155', '189',
]

/** 旧 seed 三名患者的手机号 (按手机号找回旧行并回填档案) */
const LEGACY_PHONES = ['13800138001', '13800138002', '13800138003']

const ID_WEIGHT = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

function idCardCheckDigit(body17: string): string {
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(body17[i]) * ID_WEIGHT[i]!
  return ID_CHECK[sum % 11]!
}

/* ==================================================================== *
 * 3. 演示数据规模与规格类型 (纯函数构造, 不触库)
 * ==================================================================== */

const PATIENT_COUNT = 30
const DEVICE_COUNT = 25
const EXAM_COUNT = 60
const REPORT_COUNT = 45
const CRITICAL_COUNT = 15
const APPOINTMENT_COUNT = 20
const CONTRAST_COUNT = 10
const DOSE_COUNT = 5

const ORDERING_DOCTORS = ['director_li', 'doctor_wang', 'doctor_zhang']
const RADIOLOGISTS = ['doctor_wang', 'doctor_zhang', 'director_li']

interface PatientSpec {
  seq: number
  name: string
  gender: Gender
  age: number
  birthDate: Date
  idCard: string
  phone: string
  type: PatientType
  allergyHistory: string | null
  pregnancyStatus: string
  isolationFlag: boolean
}

interface DeviceSpec {
  code: string
  name: string
  modality: string
  manufacturer: string
  location: string
  aeTitle: string
  state: DeviceState
  todayExams: number
  todayUsageMin: number
  /** 旧 seed 仅 3 台设备带维护列 (DB 未迁移该列时由 upsert 回退), 保持原行为 */
  maintenance?: { hours: number; lastMaintenanceAt: Date }
}

interface ExamSpec {
  index: number
  accessionNumber: string
  patientSeq: number
  deviceCode: string
  modality: string
  bodyPart: string
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  state: string
  priority: string
  orderingDoctor: string
  techNotes: string | null
}

interface ReportSpec {
  examIndex: number
  radiologist: string
  state: ReportState
  findings: string
  impression: string
  conclusion: string
  signedAt: Date | null
  publishedAt: Date | null
  isCritical: boolean
  qualityScore: number | null
}

interface CriticalSpec {
  examIndex: number
  description: string
  severity: CriticalSeverity
  state: CriticalState
  method: NotificationMethod
  notifiedTo: string
  voiceCalledAt: Date | null
  voiceCalledBy: string | null
  ackedBy: string | null
  ackedAt: Date | null
  resolvedBy: string | null
  resolvedAt: Date | null
  closedBy: string | null
  closedAt: Date | null
}

interface AppointmentSpec {
  patientSeq: number
  deviceCode: string
  modality: string
  bodyPart: string
  scheduledAt: Date
  endAt: Date
  state: AppointmentState
  priority: AppointmentPriority
  createdById: string
}

interface ContrastSpec {
  examIndex: number
  contrastAgent: string
  volumeMl: number
  flowRateMlMin: number
  route: string
  injectedAt: Date
  adverseEvent: boolean
  adverseSeverity: string
  reaction: string
  operator: string
}

interface DoseSpec {
  examIndex: number
  studyUid: string
  modality: string
  bodyPart: string
  ctdiVol: number
  dlp: number
  ssde: number
  dapGycm2: number
  drlCtdiVol: number
  drlDlp: number
  drlCompliance: 'WITHIN_DRL' | 'ABOVE_DRL'
  date: Date
}

export interface DemoDataset {
  patients: PatientSpec[]
  devices: DeviceSpec[]
  exams: ExamSpec[]
  reports: ReportSpec[]
  criticals: CriticalSpec[]
  appointments: AppointmentSpec[]
  contrasts: ContrastSpec[]
  doses: DoseSpec[]
}

/* ---------------- 25 台设备 (CT/MR/DR/US/MG/PET-CT/DSA + AE Title + 机房) ---------------- */

const DEVICE_SPECS: DeviceSpec[] = [
  { code: 'CT-001', name: 'Siemens SOMATOM Definition', modality: 'CT', manufacturer: 'Siemens', location: 'CT 室 1', aeTitle: 'G005_CT_001', state: DeviceState.IDLE, todayExams: 14, todayUsageMin: 265, maintenance: { hours: 1500, lastMaintenanceAt: new Date(Date.now() - 180 * DAY_MS) } },
  { code: 'CT-002', name: 'GE Revolution Apex', modality: 'CT', manufacturer: 'GE Healthcare', location: 'CT 室 2', aeTitle: 'G005_CT_002', state: DeviceState.IN_USE, todayExams: 21, todayUsageMin: 380 },
  { code: 'CT-003', name: 'Philips Incisive CT 70', modality: 'CT', manufacturer: 'Philips', location: 'CT 室 3', aeTitle: 'G005_CT_003', state: DeviceState.IDLE, todayExams: 12, todayUsageMin: 210 },
  { code: 'CT-004', name: 'United Imaging uCT 760', modality: 'CT', manufacturer: 'United Imaging', location: 'CT 室 4', aeTitle: 'G005_CT_004', state: DeviceState.IDLE, todayExams: 9, todayUsageMin: 160 },
  { code: 'CT-005', name: 'Siemens SOMATOM Force', modality: 'CT', manufacturer: 'Siemens', location: 'CT 室 5', aeTitle: 'G005_CT_005', state: DeviceState.OFFLINE, todayExams: 0, todayUsageMin: 0 },
  { code: 'MR-001', name: 'GE SIGNA Premier 3.0T', modality: 'MR', manufacturer: 'GE Healthcare', location: 'MR 室 1', aeTitle: 'G005_MR_001', state: DeviceState.IDLE, todayExams: 8, todayUsageMin: 300 },
  { code: 'MR-002', name: 'GE Signa HDxt 3.0T', modality: 'MR', manufacturer: 'GE', location: 'MR 室 2', aeTitle: 'G005_MR_002', state: DeviceState.IDLE, todayExams: 7, todayUsageMin: 255, maintenance: { hours: 260, lastMaintenanceAt: new Date(Date.now() - 12 * DAY_MS) } },
  { code: 'MR-003', name: 'Siemens MAGNETOM Vida 3.0T', modality: 'MR', manufacturer: 'Siemens', location: 'MR 室 3', aeTitle: 'G005_MR_003', state: DeviceState.IN_USE, todayExams: 10, todayUsageMin: 390 },
  { code: 'MR-004', name: 'United Imaging uMR 790', modality: 'MR', manufacturer: 'United Imaging', location: 'MR 室 4', aeTitle: 'G005_MR_004', state: DeviceState.MAINTENANCE, todayExams: 0, todayUsageMin: 0 },
  { code: 'DR-001', name: 'Carestream DRX-Revolution', modality: 'DR', manufacturer: 'Carestream', location: 'DR 室 1', aeTitle: 'G005_DR_001', state: DeviceState.IDLE, todayExams: 26, todayUsageMin: 130 },
  { code: 'DR-002', name: 'GE Definium 6000', modality: 'DR', manufacturer: 'GE Healthcare', location: 'DR 室 2', aeTitle: 'G005_DR_002', state: DeviceState.IN_USE, todayExams: 31, todayUsageMin: 150 },
  { code: 'DR-003', name: 'Philips DigitalDiagnost', modality: 'DR', manufacturer: 'Philips', location: 'DR 室 3', aeTitle: 'G005_DR_003', state: DeviceState.MAINTENANCE, todayExams: 0, todayUsageMin: 0, maintenance: { hours: 0, lastMaintenanceAt: new Date(Date.now() - 2 * DAY_MS) } },
  { code: 'DR-004', name: 'Siemens Ysio Max', modality: 'DR', manufacturer: 'Siemens', location: 'DR 室 4', aeTitle: 'G005_DR_004', state: DeviceState.IDLE, todayExams: 18, todayUsageMin: 95 },
  { code: 'DR-005', name: 'Fujifilm FDR D-EVO III', modality: 'DR', manufacturer: 'Fujifilm', location: 'DR 室 5', aeTitle: 'G005_DR_005', state: DeviceState.BROKEN, todayExams: 0, todayUsageMin: 0 },
  { code: 'US-001', name: 'Philips EPIQ 7 Elite', modality: 'US', manufacturer: 'Philips', location: '超声室 1', aeTitle: 'G005_US_001', state: DeviceState.IDLE, todayExams: 19, todayUsageMin: 340 },
  { code: 'US-002', name: 'GE LOGIQ E10', modality: 'US', manufacturer: 'GE Healthcare', location: '超声室 2', aeTitle: 'G005_US_002', state: DeviceState.IN_USE, todayExams: 23, todayUsageMin: 410 },
  { code: 'US-003', name: 'Siemens ACUSON Sequoia', modality: 'US', manufacturer: 'Siemens', location: '超声室 3', aeTitle: 'G005_US_003', state: DeviceState.IDLE, todayExams: 15, todayUsageMin: 280 },
  { code: 'US-004', name: 'Samsung HERA W10', modality: 'US', manufacturer: 'Samsung', location: '超声室 4', aeTitle: 'G005_US_004', state: DeviceState.IDLE, todayExams: 11, todayUsageMin: 205 },
  { code: 'US-005', name: 'Canon Aplio i800', modality: 'US', manufacturer: 'Canon', location: '超声室 5', aeTitle: 'G005_US_005', state: DeviceState.OFFLINE, todayExams: 0, todayUsageMin: 0 },
  { code: 'MG-001', name: 'Hologic Selenia Dimensions', modality: 'MG', manufacturer: 'Hologic', location: '钼靶室 1', aeTitle: 'G005_MG_001', state: DeviceState.IDLE, todayExams: 12, todayUsageMin: 145 },
  { code: 'MG-002', name: 'GE Senographe Pristina', modality: 'MG', manufacturer: 'GE Healthcare', location: '钼靶室 2', aeTitle: 'G005_MG_002', state: DeviceState.IDLE, todayExams: 8, todayUsageMin: 95 },
  { code: 'PET-001', name: 'Siemens Biograph Vision 600', modality: 'PET-CT', manufacturer: 'Siemens', location: 'PET-CT 室 1', aeTitle: 'G005_PET_001', state: DeviceState.IDLE, todayExams: 6, todayUsageMin: 320 },
  { code: 'PET-002', name: 'GE Discovery MI', modality: 'PET-CT', manufacturer: 'GE Healthcare', location: 'PET-CT 室 2', aeTitle: 'G005_PET_002', state: DeviceState.IDLE, todayExams: 5, todayUsageMin: 275 },
  { code: 'DSA-001', name: 'Siemens ARTIS icono floor', modality: 'DSA', manufacturer: 'Siemens', location: 'DSA 室 1', aeTitle: 'G005_DSA_001', state: DeviceState.IN_USE, todayExams: 4, todayUsageMin: 190 },
  { code: 'DSA-002', name: 'Philips Azurion 7', modality: 'DSA', manufacturer: 'Philips', location: 'DSA 室 2', aeTitle: 'G005_DSA_002', state: DeviceState.IDLE, todayExams: 3, todayUsageMin: 140 },
]

/* ---------------- 60 例检查的模态配比与部位池 ---------------- */

const EXAM_MODALITY_PLAN: Array<{ modality: string; count: number }> = [
  { modality: 'CT', count: 18 },
  { modality: 'MR', count: 12 },
  { modality: 'DR', count: 12 },
  { modality: 'US', count: 8 },
  { modality: 'MG', count: 5 },
  { modality: 'PET-CT', count: 5 },
]

const BODY_PART_POOL: Record<string, string[]> = {
  CT: ['CHEST', 'CHEST', 'CHEST', 'ABDOMEN', 'ABDOMEN', 'ABDOMEN', 'HEAD', 'HEAD', 'HEAD', 'SPINE', 'SPINE', 'NECK', 'NECK', 'PELVIS', 'PELVIS', 'EXTREMITY', 'EXTREMITY', 'HEART'],
  MR: ['HEAD', 'HEAD', 'SPINE', 'SPINE', 'KNEE', 'KNEE', 'ABDOMEN', 'PELVIS', 'HEART', 'CHEST', 'EXTREMITY'],
  DR: ['CHEST', 'CHEST', 'CHEST', 'CHEST', 'ABDOMEN', 'SPINE', 'PELVIS', 'EXTREMITY', 'EXTREMITY', 'NECK'],
  US: ['ABDOMEN', 'ABDOMEN', 'THYROID', 'HEART', 'OBSTETRIC', 'GYNECOLOGY', 'URINARY', 'VESSEL'],
  MG: ['BREAST'],
  'PET-CT': ['WHOLE_BODY', 'WHOLE_BODY', 'BRAIN'],
}

const EXAM_TECH_NOTES = [
  '患者配合良好, 一次扫描成功。',
  '屏气欠佳, 已复扫 1 次。',
  '留置金属异物, 已伪影抑制处理。',
  '危重患者床旁候诊, 优先扫描。',
  '对比剂外渗风险已评估, 通路通畅。',
]

const REPORT_FINDINGS: Record<string, string[]> = {
  CHEST: [
    '双肺纹理清晰, 未见明显异常密度影; 气管支气管通畅; 纵隔内未见肿大淋巴结; 心影大小正常; 双侧胸腔未见积液。',
    '双肺见散在条索状影, 以双下肺为著, 边界清; 气管及主支气管通畅; 心影增大, 主动脉壁可见钙化; 双侧肋膈角锐利。',
  ],
  HEAD: [
    '脑实质内未见异常密度/信号灶; 脑室系统形态大小正常; 中线结构居中; 颅骨骨质未见异常。',
    '双侧基底节区见斑点状异常密度影, 边界清; 脑室系统无受压; 中线结构无移动; 颅内外未见异常。',
  ],
  ABDOMEN: [
    '肝脏形态大小正常, 密度均匀; 胆囊壁不厚, 腔内未见高密度影; 脾胰肾未见明显异常; 腹腔未见积液。',
    '肝实质见多发小囊状低密度影, 边界清; 胆总管未见扩张; 双肾形态正常; 腹膜后未见肿大淋巴结。',
  ],
  BREAST: [
    '双侧乳腺腺体呈纤维腺体型, 分布对称; 未见明确肿块、恶性钙化及结构扭曲; 乳头无凹陷, 皮肤未见增厚。',
    '右乳外上象限见簇状细小多形性钙化, 范围约 1.5cm; 未见明确肿块; 左乳未见异常。',
  ],
  SPINE: [
    '椎体序列正常, 骨质结构完整, 未见明显骨质破坏及压缩改变; 椎间盘未见明显突出; 椎旁软组织未见肿胀。',
    '腰 4/5 椎间盘向后突出, 硬膜囊受压; 椎管有效前后径未见明显狭窄; 骨质未见异常。',
  ],
  GENERIC: [
    '检查区域显示清晰, 未见明显异常密度/回声/信号改变; 邻近结构未见受压、移位或肿胀。',
    '检查区域结构层次清楚, 未见明确占位性病变; 周围软组织未见异常。',
  ],
}

const REPORT_CONCLUSIONS: Record<string, string[]> = {
  CHEST: ['胸部检查未见明显异常, 建议结合临床随访。', '考虑慢性炎症/陈旧性病变可能, 建议 3 个月后复查。'],
  HEAD: ['颅脑检查未见明确异常。', '考虑腔隙性脑缺血可能, 建议结合临床及实验室检查。'],
  ABDOMEN: ['腹部检查未见明显异常。', '考虑肝脏小囊肿可能, 属良性, 建议定期复查。'],
  BREAST: ['双侧乳腺未见异常。BI-RADS 1 类。', '右乳可疑钙化, BI-RADS 4A 类, 建议穿刺活检。'],
  SPINE: ['脊柱未见明显异常。', '腰椎间盘突出伴退变, 建议结合临床。'],
  GENERIC: ['所见未见明确异常, 建议结合临床随访复查。', '请结合临床及其他检查综合判断, 必要时复查。'],
}

/* ---------------- 15 条危急值定义 (前 5 条沿用旧 seed 描述, 便于旧行回改) ---------------- */

interface CriticalDef {
  description: string
  parts: string[]
  severity: CriticalSeverity
  legacy?: boolean
}

const CRITICAL_DEFS: CriticalDef[] = [
  { description: '大量气胸', parts: ['CHEST'], severity: CriticalSeverity.CRITICAL, legacy: true },
  { description: '主动脉夹层', parts: ['CHEST', 'ABDOMEN', 'HEART'], severity: CriticalSeverity.CRITICAL, legacy: true },
  { description: '大面积脑梗死', parts: ['HEAD'], severity: CriticalSeverity.CRITICAL, legacy: true },
  { description: '急性心肌梗死', parts: ['HEART'], severity: CriticalSeverity.HIGH, legacy: true },
  { description: '肠系膜栓塞', parts: ['ABDOMEN'], severity: CriticalSeverity.HIGH, legacy: true },
  { description: '张力性气胸', parts: ['CHEST'], severity: CriticalSeverity.CRITICAL },
  { description: '急性脑出血', parts: ['HEAD'], severity: CriticalSeverity.CRITICAL },
  { description: '消化道穿孔', parts: ['ABDOMEN'], severity: CriticalSeverity.URGENT },
  { description: '脾破裂出血', parts: ['ABDOMEN'], severity: CriticalSeverity.URGENT },
  { description: '肺栓塞', parts: ['CHEST'], severity: CriticalSeverity.CRITICAL },
  { description: '颅内占位伴脑疝形成', parts: ['HEAD'], severity: CriticalSeverity.CRITICAL },
  { description: '异位妊娠破裂出血', parts: ['PELVIS'], severity: CriticalSeverity.URGENT },
  { description: '急性梗阻性化脓性胆管炎', parts: ['ABDOMEN'], severity: CriticalSeverity.HIGH },
  { description: '纵隔气肿', parts: ['CHEST'], severity: CriticalSeverity.HIGH },
  { description: '急性阑尾炎穿孔', parts: ['ABDOMEN'], severity: CriticalSeverity.URGENT },
]

/* ---------------- 对比剂 / 剂量参考 ---------------- */

const CONTRAST_AGENTS: Record<string, string[]> = {
  CT: ['碘海醇 Iohexol 350', '碘普罗胺 Iopromide 370', '碘克沙醇 Iodixanol 320', '碘佛醇 Ioversol 320'],
  MR: ['钆布醇 Gadobutrol', '钆双胺 Gadodiamide', '钆喷酸葡胺 Gd-DTPA'],
  'PET-CT': ['18F-FDG 脱氧葡萄糖'],
}

const ADVERSE_REACTIONS = ['轻度荨麻疹', '恶心呕吐', '一过性潮红伴瘙痒', '对比剂外渗 (I 级)']

/** 成人诊断参考水平 (DRL): CTDIvol mGy / DLP mGy*cm */
const DOSE_PROFILE: Record<string, { ctdi: number; drlCtdi: number; drlDlp: number; lengthCm: number; areaCm2: number }> = {
  HEAD: { ctdi: 45, drlCtdi: 60, drlDlp: 1100, lengthCm: 10, areaCm2: 320 },
  CHEST: { ctdi: 12, drlCtdi: 15, drlDlp: 500, lengthCm: 30, areaCm2: 350 },
  ABDOMEN: { ctdi: 18, drlCtdi: 25, drlDlp: 1000, lengthCm: 35, areaCm2: 420 },
  PELVIS: { ctdi: 15, drlCtdi: 25, drlDlp: 900, lengthCm: 30, areaCm2: 400 },
  SPINE: { ctdi: 20, drlCtdi: 30, drlDlp: 900, lengthCm: 40, areaCm2: 380 },
  NECK: { ctdi: 15, drlCtdi: 20, drlDlp: 600, lengthCm: 20, areaCm2: 300 },
  HEART: { ctdi: 12, drlCtdi: 15, drlDlp: 600, lengthCm: 40, areaCm2: 340 },
}
const DOSE_PROFILE_DEFAULT = { ctdi: 15, drlCtdi: 25, drlDlp: 800, lengthCm: 30, areaCm2: 360 }

/* ==================================================================== *
 * 4. 数据集构造 (纯函数, 无数据库也可验证)
 * ==================================================================== */

function buildPatients(r: Rng, now: Date): PatientSpec[] {
  // 55% 男性: 前三名 (旧 seed 回改) 固定男/女/男, 其余 15 男 + 12 女 -> 合计 17/30
  const tailPlan: Gender[] = []
  for (let i = 0; i < 15; i++) tailPlan.push(Gender.MALE)
  for (let i = 0; i < 12; i++) tailPlan.push(Gender.FEMALE)
  const genders: Gender[] = [Gender.MALE, Gender.FEMALE, Gender.MALE, ...shuffled(r, tailPlan)]

  const usedNames = new Set<string>(RESERVED_NAMES)
  const usedIdCards = new Set<string>()
  const usedPhones = new Set<string>(LEGACY_PHONES)
  const allergies = ['青霉素过敏', '碘对比剂过敏史', '海鲜过敏', '花粉过敏']

  const patients: PatientSpec[] = []
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const gender = genders[i]!

    let name = ''
    for (let attempt = 0; attempt < 60; attempt++) {
      const surname = pickOne(r, SURNAMES)
      const given = pickOne(r, gender === Gender.MALE ? MALE_GIVEN : FEMALE_GIVEN)
      name = `${surname}${given}`
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)

    const age = randInt(r, 20, 80)
    const birthDate = new Date(now.getFullYear() - age, randInt(r, 1, 12), randInt(r, 1, 28))

    let idCard = ''
    for (let attempt = 0; attempt < 40; attempt++) {
      const area = pickOne(r, ID_AREAS)
      const body17 = `${area}${birthDate.getFullYear()}${pad(birthDate.getMonth() + 1, 2)}${pad(birthDate.getDate(), 2)}${pad(randInt(r, 0, 999), 3)}`
      idCard = `${body17}${idCardCheckDigit(body17)}`
      if (!usedIdCards.has(idCard)) break
    }
    usedIdCards.add(idCard)

    let phone = LEGACY_PHONES[i] ?? ''
    if (!phone) {
      for (let attempt = 0; attempt < 40; attempt++) {
        let digits = ''
        for (let d = 0; d < 8; d++) digits += String(randInt(r, 0, 9))
        phone = `${pickOne(r, PHONE_PREFIX)}${digits}`
        if (!usedPhones.has(phone)) break
      }
    }
    usedPhones.add(phone)

    const typeRoll = randInt(r, 1, 10)
    const type =
      typeRoll <= 5 ? PatientType.OUTPATIENT
      : typeRoll <= 8 ? PatientType.INPATIENT
      : typeRoll <= 9 ? PatientType.EMERGENCY
      : PatientType.PHYSICAL

    const female = gender === Gender.FEMALE
    const pregnancyStatus = female && age >= 20 && age <= 45 && r() < 0.08 ? 'pregnant' : r() < 0.03 ? 'unknown' : 'none'

    patients.push({
      seq: i + 1,
      name,
      gender,
      age,
      birthDate,
      idCard,
      phone,
      type,
      allergyHistory: r() < 0.2 ? pickOne(r, allergies) : null,
      pregnancyStatus,
      isolationFlag: r() < 0.07,
    })
  }
  return patients
}

function groupDevicesByModality(): Map<string, DeviceSpec[]> {
  const map = new Map<string, DeviceSpec[]>()
  for (const d of DEVICE_SPECS) {
    const list = map.get(d.modality) ?? []
    list.push(d)
    map.set(d.modality, list)
  }
  return map
}

function buildExams(r: Rng, day: Date, patients: PatientSpec[]): ExamSpec[] {
  const modalities: string[] = []
  for (const plan of EXAM_MODALITY_PLAN) {
    for (let i = 0; i < plan.count; i++) modalities.push(plan.modality)
  }
  const mixed = shuffled(r, modalities)
  const devicesByModality = groupDevicesByModality()

  const exams: ExamSpec[] = []
  for (let i = 0; i < EXAM_COUNT; i++) {
    const modality = mixed[i]!
    const device = pickOne(r, devicesByModality.get(modality) ?? DEVICE_SPECS)
    const bodyPart = pickOne(r, BODY_PART_POOL[modality] ?? BODY_PART_POOL.CHEST!)
    // 时间轴: 0..44 既往 (已完成, 挂报告), 45..49 今日在检, 50..59 未来待检
    const dayOffset = i < 45 ? -(45 - i) : i < 50 ? 0 : i - 49
    const scheduledAt = at(day, dayOffset, randInt(r, 8, 16), pickOne(r, [0, 15, 30, 45]))
    const state = i < 45 ? 'COMPLETED' : i < 47 ? 'IN_PROGRESS' : i < 50 ? 'ARRIVED' : 'SCHEDULED'
    const priorityRoll = r()
    const priority = priorityRoll < 0.7 ? 'ROUTINE' : priorityRoll < 0.9 ? 'URGENT' : 'STAT'
    const durationMin = randInt(r, 15, 55)

    exams.push({
      index: i,
      accessionNumber: `ACC-2026-${pad(i + 1, 4)}`,
      patientSeq: (i % patients.length) + 1,
      deviceCode: device.code,
      modality,
      bodyPart,
      scheduledAt,
      startedAt: state === 'COMPLETED' || state === 'IN_PROGRESS' ? scheduledAt : null,
      completedAt: state === 'COMPLETED' ? new Date(scheduledAt.getTime() + durationMin * 60000) : null,
      state,
      priority,
      orderingDoctor: pickOne(r, ORDERING_DOCTORS),
      techNotes: i % 5 === 0 ? pickOne(r, EXAM_TECH_NOTES) : null,
    })
  }
  return exams
}

function buildCriticalSpec(r: Rng, def: CriticalDef, exam: ExamSpec, idx: number, doctor: string): CriticalSpec {
  const anchor = exam.completedAt ?? exam.scheduledAt
  const voiceCalledAt = new Date(anchor.getTime() + randInt(r, 2, 12) * 60000)
  const ackedAt = new Date(voiceCalledAt.getTime() + randInt(r, 3, 20) * 60000)
  const resolvedAt = new Date(ackedAt.getTime() + randInt(r, 30, 240) * 60000)

  let state: CriticalState
  if (idx < 4) state = CriticalState.CLOSED_LOOP
  else if (idx < 10) state = CriticalState.ACKNOWLEDGED
  else if (idx < 13) state = CriticalState.VOICE_CALLED
  else state = CriticalState.FOUND

  const method = idx % 4 === 3 ? NotificationMethod.SMS : idx % 5 === 4 ? NotificationMethod.SYSTEM : NotificationMethod.PHONE
  const withCall = state !== CriticalState.FOUND
  const withAck = state === CriticalState.CLOSED_LOOP || state === CriticalState.ACKNOWLEDGED

  return {
    examIndex: exam.index,
    description: def.description,
    severity: def.severity,
    state,
    method,
    notifiedTo: doctor,
    voiceCalledAt: withCall ? voiceCalledAt : null,
    voiceCalledBy: withCall ? 'tech_liu' : null,
    ackedBy: withAck ? doctor : null,
    ackedAt: withAck ? ackedAt : null,
    resolvedBy: state === CriticalState.CLOSED_LOOP ? doctor : null,
    resolvedAt: state === CriticalState.CLOSED_LOOP ? resolvedAt : null,
    closedBy: state === CriticalState.CLOSED_LOOP ? 'director_li' : null,
    closedAt: state === CriticalState.CLOSED_LOOP ? new Date(resolvedAt.getTime() + 30 * 60000) : null,
  }
}

function buildCriticals(r: Rng, exams: ExamSpec[]): CriticalSpec[] {
  // 危急值只挂在既往 CT/MR/DR 检查上 (部位与描述临床匹配), 轮转起点保证时间分布均匀
  const pool = exams.filter((e) => e.state === 'COMPLETED' && ['CT', 'MR', 'DR'].includes(e.modality))
  const used = new Set<number>()
  const criticals: CriticalSpec[] = []

  CRITICAL_DEFS.forEach((def, idx) => {
    const offset = (idx * 3) % Math.max(pool.length, 1)
    let exam: ExamSpec | undefined
    for (let k = 0; k < pool.length; k++) {
      const cand = pool[(offset + k) % pool.length]!
      if (used.has(cand.index) || !def.parts.includes(cand.bodyPart)) continue
      exam = cand
      break
    }
    exam = exam ?? pool.find((e) => !used.has(e.index))
    if (!exam) throw new Error('[seed] critical value pool exhausted')
    used.add(exam.index)
    // 同模态内回填部位: 保证危急值描述与检查部位始终一致 (设备 modality 不变)
    if (!def.parts.includes(exam.bodyPart)) exam.bodyPart = def.parts[0]!

    const doctor = ORDERING_DOCTORS[idx % ORDERING_DOCTORS.length]!
    criticals.push(buildCriticalSpec(r, def, exam, idx, doctor))
  })

  if (criticals.length !== CRITICAL_COUNT) throw new Error(`[seed] critical count ${criticals.length} != ${CRITICAL_COUNT}`)
  return criticals
}

function buildReports(r: Rng, exams: ExamSpec[], criticals: CriticalSpec[]): ReportSpec[] {
  const criticalByExam = new Map<number, CriticalSpec>()
  for (const c of criticals) criticalByExam.set(c.examIndex, c)

  const reports: ReportSpec[] = []
  for (let i = 0; i < REPORT_COUNT; i++) {
    const exam = exams[i]!
    const critical = criticalByExam.get(i)
    // draft / signed / published 三态轮转; 危急值报告保证已签发 (临床闭环)
    const state = critical
      ? i % 2 === 0 ? ReportState.SIGNED : ReportState.PUBLISHED
      : i % 3 === 0 ? ReportState.WRITING
      : i % 3 === 1 ? ReportState.SIGNED
      : ReportState.PUBLISHED

    const findings = pickOne(r, REPORT_FINDINGS[exam.bodyPart] ?? REPORT_FINDINGS.GENERIC!)
    const conclusion = critical
      ? `${critical.description}。请立即结合临床紧急处理并随访。`
      : pickOne(r, REPORT_CONCLUSIONS[exam.bodyPart] ?? REPORT_CONCLUSIONS.GENERIC!)

    const anchor = exam.completedAt ?? exam.scheduledAt
    const signedAt = state === ReportState.WRITING ? null : new Date(anchor.getTime() + randInt(r, 1, 8) * 3600000)
    const publishedAt = state === ReportState.PUBLISHED && signedAt ? new Date(signedAt.getTime() + randInt(r, 2, 20) * 3600000) : null

    reports.push({
      examIndex: i,
      radiologist: pickOne(r, RADIOLOGISTS),
      state,
      findings,
      impression: conclusion,
      conclusion,
      signedAt,
      publishedAt,
      isCritical: Boolean(critical),
      qualityScore: state === ReportState.WRITING ? null : randInt(r, 78, 98),
    })
  }
  if (reports.length !== REPORT_COUNT) throw new Error(`[seed] report count ${reports.length} != ${REPORT_COUNT}`)
  return reports
}

function buildAppointments(r: Rng, day: Date, patients: PatientSpec[]): AppointmentSpec[] {
  const chosen = shuffled(r, patients).slice(0, APPOINTMENT_COUNT)
  const devicesByModality = groupDevicesByModality()
  const modalityPool = ['CT', 'CT', 'MR', 'MR', 'DR', 'DR', 'US', 'US', 'MG', 'PET-CT']

  const appointments: AppointmentSpec[] = []
  for (let i = 0; i < APPOINTMENT_COUNT; i++) {
    const patient = chosen[i]!
    const modality = pickOne(r, modalityPool)
    const device = pickOne(r, devicesByModality.get(modality) ?? DEVICE_SPECS)
    const bodyPart = pickOne(r, BODY_PART_POOL[modality] ?? BODY_PART_POOL.CHEST!)
    const dayOffset = i < 8 ? -(1 + (i % 3)) : i < 14 ? 0 : i - 13
    const scheduledAt = at(day, dayOffset, randInt(r, 8, 17), pickOne(r, [0, 30]))
    const state =
      dayOffset < 0 ? pickOne(r, [AppointmentState.COMPLETED, AppointmentState.COMPLETED, AppointmentState.CANCELLED, AppointmentState.NO_SHOW])
      : dayOffset === 0 ? pickOne(r, [AppointmentState.CHECKED_IN, AppointmentState.IN_PROGRESS, AppointmentState.REGISTERED, AppointmentState.CONFIRMED])
      : pickOne(r, [AppointmentState.SCHEDULED, AppointmentState.SCHEDULED, AppointmentState.CONFIRMED])
    const priorityRoll = r()
    const priority = priorityRoll < 0.75 ? AppointmentPriority.ROUTINE : priorityRoll < 0.93 ? AppointmentPriority.URGENT : AppointmentPriority.STAT

    appointments.push({
      patientSeq: patient.seq,
      deviceCode: device.code,
      modality,
      bodyPart,
      scheduledAt,
      endAt: new Date(scheduledAt.getTime() + 30 * 60000),
      state,
      priority,
      createdById: pickOne(r, ORDERING_DOCTORS),
    })
  }
  if (appointments.length !== APPOINTMENT_COUNT) throw new Error(`[seed] appointment count ${appointments.length} != ${APPOINTMENT_COUNT}`)
  return appointments
}

function buildContrasts(r: Rng, exams: ExamSpec[]): ContrastSpec[] {
  const contrastable = exams.filter((e) => e.state === 'COMPLETED' && ['CT', 'MR', 'PET-CT'].includes(e.modality))
  const fallback = exams.filter((e) => ['CT', 'MR', 'PET-CT'].includes(e.modality))
  const picked = evenlySpaced(contrastable.length >= CONTRAST_COUNT ? contrastable : fallback, CONTRAST_COUNT)

  const contrasts: ContrastSpec[] = picked.map((exam, idx) => {
    const agents = CONTRAST_AGENTS[exam.modality] ?? CONTRAST_AGENTS.CT!
    const adverseEvent = idx === 3 || idx === 8
    const volumeMl = exam.modality === 'CT' ? randInt(r, 80, 100) : exam.modality === 'MR' ? randInt(r, 10, 15) : randInt(r, 5, 8)
    const anchor = exam.startedAt ?? exam.scheduledAt
    return {
      examIndex: exam.index,
      contrastAgent: pickOne(r, agents),
      volumeMl,
      flowRateMlMin: exam.modality === 'CT' ? round1(2.5 + r() * 1.5) : 0,
      route: 'IV (肘正中静脉)',
      injectedAt: new Date(anchor.getTime() + randInt(r, 2, 12) * 60000),
      adverseEvent,
      adverseSeverity: adverseEvent ? pickOne(r, ['MINOR', 'MODERATE']) : '',
      reaction: adverseEvent ? pickOne(r, ADVERSE_REACTIONS) : '',
      operator: idx % 3 === 0 ? 'tech_liu' : 'doctor_zhang',
    }
  })
  if (contrasts.length !== CONTRAST_COUNT) throw new Error(`[seed] contrast count ${contrasts.length} != ${CONTRAST_COUNT}`)
  return contrasts
}

function buildDoses(r: Rng, exams: ExamSpec[]): DoseSpec[] {
  const ctCompleted = exams.filter((e) => e.modality === 'CT' && e.state === 'COMPLETED')
  const ctAll = exams.filter((e) => e.modality === 'CT')
  const picked = evenlySpaced(ctCompleted.length >= DOSE_COUNT ? ctCompleted : ctAll, DOSE_COUNT)

  const doses: DoseSpec[] = picked.map((exam, idx) => {
    const profile = DOSE_PROFILE[exam.bodyPart] ?? DOSE_PROFILE_DEFAULT
    // 第 3 例刻意超标, 用于演示 DRL 告警/复核链路
    const overLimit = idx === 2
    const ctdiVol = overLimit ? round1(profile.drlCtdi * 1.4) : round1(profile.ctdi * (0.8 + r() * 0.4))
    const dlp = overLimit ? Math.round(profile.drlDlp * 1.3) : Math.round(ctdiVol * profile.lengthCm)
    const ssde = round1(ctdiVol * (0.85 + r() * 0.3))
    const dapGycm2 = round1((ctdiVol * profile.areaCm2) / 1000)
    const within = ctdiVol <= profile.drlCtdi && dlp <= profile.drlDlp
    return {
      examIndex: exam.index,
      studyUid: `1.2.826.0.1.3680043.8.498.SEED.CT.${exam.accessionNumber}`,
      modality: 'CT',
      bodyPart: exam.bodyPart,
      ctdiVol,
      dlp,
      ssde,
      dapGycm2,
      drlCtdiVol: profile.drlCtdi,
      drlDlp: profile.drlDlp,
      drlCompliance: within ? 'WITHIN_DRL' : 'ABOVE_DRL',
      date: exam.completedAt ?? exam.scheduledAt,
    }
  })
  if (doses.length !== DOSE_COUNT) throw new Error(`[seed] dose count ${doses.length} != ${DOSE_COUNT}`)
  return doses
}

/** 演示数据集 (纯函数): 同一 now 下两次调用结果完全一致 */
export function buildDemoDataset(now: Date = new Date()): DemoDataset {
  const r = mulberry32(SEED_RNG)
  const day = startOfDay(now)

  const patients = buildPatients(r, now)
  const exams = buildExams(r, day, patients)
  const criticals = buildCriticals(r, exams)
  const reports = buildReports(r, exams, criticals)
  const appointments = buildAppointments(r, day, patients)
  const contrasts = buildContrasts(r, exams)
  const doses = buildDoses(r, exams)

  if (patients.length !== PATIENT_COUNT) throw new Error(`[seed] patient count ${patients.length} != ${PATIENT_COUNT}`)
  if (DEVICE_SPECS.length !== DEVICE_COUNT) throw new Error(`[seed] device count ${DEVICE_SPECS.length} != ${DEVICE_COUNT}`)
  if (exams.length !== EXAM_COUNT) throw new Error(`[seed] exam count ${exams.length} != ${EXAM_COUNT}`)

  return { patients, devices: DEVICE_SPECS, exams, reports, criticals, appointments, contrasts, doses }
}

/* ==================================================================== *
 * 5. 扩展区 (schema 无对应列) - audit_logs 按 resource 标记 clear-then-seed
 * ==================================================================== */

const EXT = {
  examOrder: 'exam-order',
  deviceAe: 'device-ae-title',
  contrast: 'contrast-administration',
  doseDap: 'dose-dap',
} as const

/** 扩展区写入: 按 resource 标记 clear-then-seed; 表不可用时仅告警, 不中断主数据落库 */
async function writeExtRows(label: string, resource: string, data: Prisma.AuditLogCreateManyInput[]): Promise<void> {
  try {
    const { count } = await prisma.auditLog.deleteMany({ where: { resource } })
    if (count > 0) console.log(`[seed] cleared ${count} audit rows (resource=${resource})`)
    await prisma.auditLog.createMany({ data })
    console.log(`[seed] ${data.length} ${label} (audit resource=${resource})`)
  } catch (e) {
    console.warn(`[seed] WARN ${label} skipped, audit_logs unavailable: ${(e as Error).message}`)
  }
}

/* ==================================================================== *
 * 6. 落库
 * ==================================================================== */

async function main(): Promise<void> {
  console.log('[seed] starting G005 demo dataset ...')
  const dataset = buildDemoDataset(new Date())

  // ---- 5 角色用户 (不变: 唯一键 username upsert) ----
  const users = [
    { username: 'admin', password: 'Admin@123', fullName: '系统管理员', role: UserRole.ADMIN, department: '信息中心' },
    { username: 'director_li', password: 'Dir@2024', fullName: '李明辉', role: UserRole.DIRECTOR, department: '放射科' },
    { username: 'doctor_wang', password: 'Doc@2024', fullName: '王芳', role: UserRole.DOCTOR, department: '放射科' },
    { username: 'doctor_zhang', password: 'Doc@2024', fullName: '张伟', role: UserRole.DOCTOR, department: '放射科' },
    { username: 'tech_liu', password: 'Tech@2024', fullName: '刘洋', role: UserRole.TECHNICIAN, department: 'CT 室' },
  ]
  const userIds = new Map<string, string>()
  for (const u of users) {
    const passwordHash = await hash(u.password, 10)
    const row = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        tenantId: TENANT,
      },
    })
    userIds.set(u.username, row.id)
  }
  console.log(`[seed] ${users.length} users upserted`)

  // ---- 25 设备 (唯一键 code upsert; 维护列 DB 未迁移时回退基础字段) ----
  const deviceIds = new Map<string, string>()
  for (const d of dataset.devices) {
    const base = {
      code: d.code,
      name: d.name,
      modality: d.modality,
      manufacturer: d.manufacturer,
      location: d.location,
      state: d.state,
      todayExams: d.todayExams,
      todayUsageMin: d.todayUsageMin,
      tenantId: TENANT,
    }
    let row
    if (d.maintenance) {
      const withMaint = { ...base, maintenanceHours: d.maintenance.hours, lastMaintenanceAt: d.maintenance.lastMaintenanceAt }
      try {
        row = await prisma.device.upsert({ where: { code: d.code }, update: {}, create: withMaint })
      } catch {
        // DB 未迁移维护列 -> 基础字段写入 (维护信息由 service 内存回退承载)
        row = await prisma.device.upsert({ where: { code: d.code }, update: {}, create: base })
      }
    } else {
      row = await prisma.device.upsert({ where: { code: d.code }, update: {}, create: base })
    }
    deviceIds.set(d.code, row.id)
  }
  console.log(`[seed] ${deviceIds.size} devices upserted (target ${DEVICE_COUNT})`)

  // ---- 设备 AE Title (schema 无 aeTitle 列 -> audit 扩展区, clear-then-seed) ----
  await writeExtRows(
    `${dataset.devices.length} device AE titles`,
    EXT.deviceAe,
    dataset.devices.map((d) => ({
      tenantId: TENANT,
      action: SEED_ACTION,
      resource: EXT.deviceAe,
      resourceId: deviceIds.get(d.code) ?? null,
      detail: { code: d.code, aeTitle: d.aeTitle, modality: d.modality, room: d.location, manufacturer: d.manufacturer, deviceName: d.name },
      success: true,
    })),
  )

  // ---- 30 患者 (idCard 唯一 + 手机号找回旧行; 存在则回填档案, 否则 create) ----
  const patientIds: string[] = []
  for (const p of dataset.patients) {
    // 只回填演示档案字段, 不覆盖 state/软删等业务状态
    const profile = {
      name: p.name,
      gender: p.gender,
      birthDate: p.birthDate,
      idCard: p.idCard,
      phone: p.phone,
      type: p.type,
      allergyHistory: p.allergyHistory,
      pregnancyStatus: p.pregnancyStatus,
      isolationFlag: p.isolationFlag,
    }
    const found = await prisma.patient.findFirst({ where: { OR: [{ idCard: p.idCard }, { phone: p.phone }] } })
    const row = found
      ? await prisma.patient.update({ where: { id: found.id }, data: profile })
      : await prisma.patient.create({ data: { ...profile, tenantId: TENANT } })
    patientIds.push(row.id)
  }
  console.log(`[seed] ${patientIds.length} patients`)

  // ---- 60 例检查 (唯一键 accessionNumber upsert; 患者/设备 FK + 开单医生) ----
  interface ExamRow { id: string; patientId: string; spec: ExamSpec }
  const examRows: ExamRow[] = []
  for (const e of dataset.exams) {
    const patientId = patientIds[e.patientSeq - 1]!
    const deviceId = deviceIds.get(e.deviceCode) ?? null
    const payload = {
      patientId,
      modality: e.modality,
      bodyPart: e.bodyPart,
      deviceId,
      scheduledAt: e.scheduledAt,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      state: e.state,
      priority: e.priority,
      techNotes: e.techNotes,
    }
    const row = await prisma.exam.upsert({
      where: { accessionNumber: e.accessionNumber },
      update: payload,
      create: { ...payload, accessionNumber: e.accessionNumber, tenantId: TENANT },
    })
    examRows.push({ id: row.id, patientId, spec: e })
  }
  console.log(`[seed] ${examRows.length} exams (patient+device FK)`)

  // ---- 45 份报告 (examId 找回 -> update / create; 放射医师 + draft/signed/published) ----
  const reportIdByExamIndex = new Map<number, string>()
  for (const rp of dataset.reports) {
    const examRow = examRows[rp.examIndex]!
    const radiologistId = userIds.get(rp.radiologist) ?? null
    const payload = {
      patientId: examRow.patientId,
      examId: examRow.id,
      radiologistId,
      state: rp.state,
      findings: rp.findings,
      impression: rp.impression,
      conclusion: rp.conclusion,
      signedAt: rp.signedAt,
      signedById: rp.signedAt ? radiologistId : null,
      publishedAt: rp.publishedAt,
      reviewedAt: rp.publishedAt,
      reviewerId: rp.publishedAt ? (userIds.get('director_li') ?? null) : null,
      isCritical: rp.isCritical,
      qualityScore: rp.qualityScore,
    }
    const existing = await prisma.report.findFirst({ where: { examId: examRow.id } })
    const row = existing
      ? await prisma.report.update({ where: { id: existing.id }, data: payload })
      : await prisma.report.create({ data: { ...payload, tenantId: TENANT } })
    reportIdByExamIndex.set(rp.examIndex, row.id)
  }
  console.log(`[seed] ${reportIdByExamIndex.size} reports (exam+radiologist FK)`)

  // ---- 开单医生 (schema 无列 -> audit 扩展区, resourceId=exam.id) ----
  await writeExtRows(
    `${dataset.exams.length} exam ordering-doctor links`,
    EXT.examOrder,
    dataset.exams.map((e) => {
      const examRow = examRows[e.index]!
      const doctorId = userIds.get(e.orderingDoctor) ?? null
      return {
        tenantId: TENANT,
        action: SEED_ACTION,
        resource: EXT.examOrder,
        userId: doctorId,
        resourceId: examRow.id,
        detail: {
          accessionNumber: e.accessionNumber,
          orderingDoctorId: doctorId,
          orderingDoctor: e.orderingDoctor,
          orderSource: 'HIS',
          modality: e.modality,
          bodyPart: e.bodyPart,
        },
        success: true,
      }
    }),
  )

  // ---- 15 条危急值 (description 找回旧行 -> update / create; 患者+检查+报告 FK) ----
  for (const c of dataset.criticals) {
    const examRow = examRows[c.examIndex]!
    const reportId = reportIdByExamIndex.get(c.examIndex)
    const payload = {
      examId: examRow.id,
      patientId: examRow.patientId,
      description: c.description,
      severity: c.severity,
      state: c.state,
      method: c.method,
      notifiedTo: c.notifiedTo,
      voiceCalledAt: c.voiceCalledAt,
      voiceCalledBy: c.voiceCalledBy,
      ackedBy: c.ackedBy,
      ackedAt: c.ackedAt,
      resolvedBy: c.resolvedBy,
      resolvedAt: c.resolvedAt,
      closedBy: c.closedBy,
      closedAt: c.closedAt,
      // schema 无 report_id 列: 报告关联以 JSON 快照落 comment (同 exam 的 report 侧已置 is_critical)
      confirmedComment: JSON.stringify({
        reportId: reportId ?? '',
        accessionNumber: examRow.spec.accessionNumber,
        link: 'critical.examId = report.examId',
      }),
    }
    // 旧版 seed 对危急值无幂等保护 (重复执行会堆重复行): 按 description 收敛为一行
    const existing = await prisma.criticalValue.findMany({ where: { description: c.description }, orderBy: { createdAt: 'asc' } })
    const duplicates = existing.slice(1)
    if (duplicates.length > 0) {
      await prisma.criticalValue.deleteMany({ where: { id: { in: duplicates.map((x) => x.id) } } })
      console.log(`[seed] removed ${duplicates.length} duplicate critical rows (${c.description})`)
    }
    if (existing[0]) {
      await prisma.criticalValue.update({ where: { id: existing[0].id }, data: payload })
    } else {
      await prisma.criticalValue.create({ data: { ...payload, tenantId: TENANT } })
    }
  }
  console.log(`[seed] ${dataset.criticals.length} critical values (patient+exam+report)`)

  // ---- 20 条预约 (无自然唯一键 -> 按 demo 患者范围 clear-then-seed) ----
  const clearedAppointments = await prisma.appointment.deleteMany({ where: { patientId: { in: patientIds } } })
  if (clearedAppointments.count > 0) console.log(`[seed] cleared ${clearedAppointments.count} seed-patient appointments`)
  for (const a of dataset.appointments) {
    await prisma.appointment.create({
      data: {
        tenantId: TENANT,
        patientId: patientIds[a.patientSeq - 1]!,
        patientName: dataset.patients[a.patientSeq - 1]!.name,
        deviceId: deviceIds.get(a.deviceCode) ?? null,
        modality: a.modality,
        bodyPart: a.bodyPart,
        scheduledAt: a.scheduledAt,
        endAt: a.endAt,
        priority: a.priority,
        createdById: userIds.get(a.createdById) ?? null,
        state: a.state,
      },
    })
  }
  console.log(`[seed] ${dataset.appointments.length} appointments (patient+device FK)`)

  // ---- 10 条对比剂使用 (schema 无模型 -> audit 扩展区, resourceId=exam.id) ----
  await writeExtRows(
    `${dataset.contrasts.length} contrast administrations`,
    EXT.contrast,
    dataset.contrasts.map((c) => {
      const examRow = examRows[c.examIndex]!
      return {
        tenantId: TENANT,
        action: SEED_ACTION,
        resource: EXT.contrast,
        userId: userIds.get(c.operator) ?? null,
        resourceId: examRow.id,
        detail: {
          examId: examRow.id,
          accessionNumber: examRow.spec.accessionNumber,
          patientId: examRow.patientId,
          modality: examRow.spec.modality,
          deviceId: deviceIds.get(examRow.spec.deviceCode) ?? null,
          contrastAgent: c.contrastAgent,
          volumeMl: c.volumeMl,
          flowRateMlMin: c.flowRateMlMin,
          route: c.route,
          injectedAt: c.injectedAt.toISOString(),
          adverseEvent: c.adverseEvent,
          adverseEventSeverity: c.adverseSeverity,
          adverseReaction: c.reaction,
        },
        success: true,
      }
    }),
  )

  // ---- 5 条剂量记录 (唯一化 studyUid 清理后重建; DAP/DRL 判定落 audit 扩展区) ----
  try {
    await prisma.doseRecord.deleteMany({ where: { studyUid: { in: dataset.doses.map((d) => d.studyUid) } } })
    for (const d of dataset.doses) {
      const examRow = examRows[d.examIndex]!
      await prisma.doseRecord.create({
        data: {
          tenantId: TENANT,
          patientId: examRow.patientId,
          patientName: dataset.patients[examRow.spec.patientSeq - 1]!.name,
          examId: examRow.id,
          studyUid: d.studyUid,
          modality: d.modality,
          bodyPart: d.bodyPart,
          ctdiVol: d.ctdiVol,
          dlp: d.dlp,
          ssde: d.ssde,
          date: d.date,
        },
      })
    }
    console.log(`[seed] ${dataset.doses.length} dose records (CTDIvol/DLP/SSDE, patient+exam FK)`)
  } catch (e) {
    console.warn(`[seed] WARN dose records skipped, dose_records unavailable: ${(e as Error).message}`)
  }
  await writeExtRows(
    `${dataset.doses.length} dose DAP/DRL snapshots`,
    EXT.doseDap,
    dataset.doses.map((d) => {
      const examRow = examRows[d.examIndex]!
      return {
        tenantId: TENANT,
        action: SEED_ACTION,
        resource: EXT.doseDap,
        resourceId: examRow.id,
        detail: {
          examId: examRow.id,
          accessionNumber: examRow.spec.accessionNumber,
          studyUid: d.studyUid,
          dapGycm2: d.dapGycm2,
          ctdiVol: d.ctdiVol,
          dlp: d.dlp,
          drlCtdiVol: d.drlCtdiVol,
          drlDlp: d.drlDlp,
          drlCompliance: d.drlCompliance,
        },
        success: true,
      }
    }),
  )

  // ---- 5 RADS 模板 (不变: 唯一键 id upsert) ----
  const rads = [
    { category: RadsCategory.BI_RADS, code: 'BI-RADS 1', name: '阴性', body: '乳腺影像未见异常。' },
    { category: RadsCategory.BI_RADS, code: 'BI-RADS 2', name: '良性', body: '乳腺所见为良性。' },
    { category: RadsCategory.LI_RADS, code: 'LI-RADS 1', name: '肯定良性', body: '肝脏病灶肯定良性。' },
    { category: RadsCategory.PI_RADS, code: 'PI-RADS 1', name: '极低危', body: '前列腺癌极低危。' },
    { category: RadsCategory.TI_RADS, code: 'TI-RADS 2', name: '良性', body: '甲状腺结节良性。' },
  ]
  for (const r of rads) {
    await prisma.radsTemplate.upsert({
      where: { id: `${r.category}_${r.code}`.replace(/\s+/g, '_') },
      update: {},
      create: { id: `${r.category}_${r.code}`.replace(/\s+/g, '_'), ...r, tenantId: TENANT },
    })
  }
  console.log(`[seed] ${rads.length} RADS templates`)

  // ---- 6 报告模板 (审批流示例: approved/pending/rejected; 唯一键 id upsert) ----
  const doctorZhangId = userIds.get('doctor_zhang') ?? 'seed'
  const directorId = userIds.get('director_li')
  const tplSeed = [
    { id: 'tpl-seed-ct-chest', name: '胸部CT平扫常规模板', category: 'CT', modality: 'CT', bodyPart: '胸部', status: 'approved', approvedBy: directorId, body: '【影像所见】双肺纹理清晰，未见实变及肿块影；纵隔无肿大淋巴结；心影大小形态正常；胸腔无积液。\n【诊断意见】胸部CT平扫未见明显异常。' },
    { id: 'tpl-seed-mr-brain', name: '头颅MR平扫常规模板', category: 'MR', modality: 'MR', bodyPart: '头颅', status: 'approved', approvedBy: directorId, body: '【影像所见】脑实质内未见异常信号灶；脑室系统形态大小正常；中线结构居中；脑沟脑裂未见增宽。\n【诊断意见】头颅MRI平扫未见明显异常。' },
    { id: 'tpl-seed-dr-chest', name: '胸部DR正位模板', category: 'DR', modality: 'DR', bodyPart: '胸部', status: 'approved', approvedBy: directorId, body: '【影像所见】双肺野清晰，肺门结构正常，心影大小正常，膈面光滑，肋膈角锐利。\n【诊断意见】胸部正位片未见明显异常。' },
    { id: 'tpl-seed-us-abdomen', name: '腹部超声常规模板', category: 'US', modality: 'US', bodyPart: '腹部', status: 'approved', approvedBy: directorId, body: '【影像所见】肝脏形态大小正常，回声均匀；胆囊壁不厚，腔内未见结石；脾胰肾未见明显异常。\n【诊断意见】腹部超声未见明显异常。' },
    { id: 'tpl-seed-mg-breast', name: '乳腺钼靶常规模板', category: 'MG', modality: 'MG', bodyPart: '乳腺', status: 'pending', approvedBy: null, body: '【影像所见】双侧乳腺腺体呈纤维腺体型，未见明确肿块、钙化及结构扭曲。\n【诊断意见】双侧乳腺钼靶未见明显异常。BI-RADS 1 类。' },
    { id: 'tpl-seed-ct-abdomen', name: '腹部CT增强常规模板', category: 'CT', modality: 'CT', bodyPart: '腹部', status: 'rejected', approvedBy: null, rejectReason: '增强时相描述不完整, 请补充门静脉期', body: '【影像所见】肝脏形态大小正常，增强三期强化均匀。\n【诊断意见】腹部CT增强未见明显异常。' },
  ]
  for (const t of tplSeed) {
    await prisma.reportTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        ...t,
        tags: ['常规'],
        createdById: doctorZhangId,
        version: 1,
        tenantId: TENANT,
      },
    })
  }
  console.log(`[seed] ${tplSeed.length} report templates (approval flow)`)

  // 内置示例 DICOM (Phase 1.2+1.3): 从 dicom-samples/manifest.json 注册到 dicomInstance 表
  await seedDicomSamples(prisma)

  // Auto-hanging 默认悬挂协议
  await seedHangingProtocols()

  await logCounts()
  console.log('[seed] done ✓')
}

/** 落库后按实体统计并打印 (演示数据集对账); 单表缺失只标 n/a, 不影响其余统计 */
async function safeCount(fn: () => Promise<number>): Promise<number | 'n/a'> {
  try {
    return await fn()
  } catch {
    return 'n/a'
  }
}

async function logCounts(): Promise<void> {
  const [users, devices, patients, exams, reports, criticals, appointments, doseRecords, rads, templates, hanging, contrastRows, doseDapRows, orderRows, aeRows] = await Promise.all([
    safeCount(() => prisma.user.count()),
    safeCount(() => prisma.device.count()),
    safeCount(() => prisma.patient.count()),
    safeCount(() => prisma.exam.count()),
    safeCount(() => prisma.report.count()),
    safeCount(() => prisma.criticalValue.count()),
    safeCount(() => prisma.appointment.count()),
    safeCount(() => prisma.doseRecord.count()),
    safeCount(() => prisma.radsTemplate.count()),
    safeCount(() => prisma.reportTemplate.count()),
    safeCount(() => prisma.hangingProtocol.count()),
    safeCount(() => prisma.auditLog.count({ where: { resource: EXT.contrast } })),
    safeCount(() => prisma.auditLog.count({ where: { resource: EXT.doseDap } })),
    safeCount(() => prisma.auditLog.count({ where: { resource: EXT.examOrder } })),
    safeCount(() => prisma.auditLog.count({ where: { resource: EXT.deviceAe } })),
  ])
  console.log(
    `[seed] counts users=${users} devices=${devices} patients=${patients} exams=${exams} reports=${reports} ` +
      `criticals=${criticals} appointments=${appointments} contrast=${contrastRows} dose=${doseRecords} ` +
      `doseDap=${doseDapRows} examOrder=${orderRows} deviceAe=${aeRows} rads=${rads} templates=${templates} hanging=${hanging}`,
  )
}

interface SampleSeriesManifest {
  key: string
  modality: string
  sopClassUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  patientName: string
  patientId: string
  rows: number
  columns: number
  windowCenter: string
  windowWidth: string
  rescaleIntercept: string
  rescaleSlope: string
  transferSyntax: string
  instances: Array<{
    file: string
    sopInstanceUid: string
    instanceNumber: number
    sliceLocation: number
  }>
}

async function seedDicomSamples(client: PrismaClient): Promise<void> {
  const manifestPath = path.resolve(__dirname, '..', 'dicom-samples', 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.log('[seed] dicom-samples/manifest.json not found, skip DICOM sample seeding (run: npx ts-node scripts/generate-dicom-samples.ts)')
    return
  }
  const manifest: { baseDir: string; instanceCount: number; series: SampleSeriesManifest[] } = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8'),
  )
  const baseDir = path.resolve(path.dirname(manifestPath))
  const model = (client as any).dicomInstance
  if (!model?.upsert) {
    console.log('[seed] dicomInstance model not available, skip DICOM sample seeding')
    return
  }
  let count = 0
  for (const series of manifest.series) {
    for (const inst of series.instances) {
      const storagePath = path.join(baseDir, inst.file)
      const sizeBytes = fs.statSync(storagePath).size
      try {
        await model.upsert({
          where: { sopInstanceUid: inst.sopInstanceUid },
          update: {
            storagePath,
            sizeBytes,
            modality: series.modality,
            sopClassUid: series.sopClassUid,
          },
          create: {
            tenantId: TENANT,
            studyInstanceUid: series.studyInstanceUid,
            seriesInstanceUid: series.seriesInstanceUid,
            sopInstanceUid: inst.sopInstanceUid,
            sopClassUid: series.sopClassUid,
            modality: series.modality,
            storagePath,
            sizeBytes,
            transferSyntax: series.transferSyntax,
          },
        })
        count++
      } catch (e) {
        console.error(`[seed] failed to upsert DICOM instance ${inst.sopInstanceUid}: ${(e as Error).message}`)
      }
    }
  }
  console.log(`[seed] ${count}/${manifest.instanceCount} built-in DICOM instances registered (tenant=${TENANT})`)
}

// Auto-hanging 默认悬挂协议 seed (对标 GE/Siemens/Fujifilm)
async function seedHangingProtocols(): Promise<void> {
  const seeds = [
    { name: 'CT 头颅 轴位标准', modality: 'CT', bodyPart: 'HEAD', layout: { rows: 1, cols: 1, seriesOrder: ['轴位'] }, priority: 100, description: 'CT 头颅常规: 单视野轴位' },
    { name: 'CT 胸部 肺窗+纵隔窗', modality: 'CT', bodyPart: 'CHEST', layout: { rows: 2, cols: 2, seriesOrder: ['轴位-肺窗', '轴位-纵隔窗', '冠状位', '矢状位'] }, priority: 100, description: 'CT 胸部常规: 肺窗/纵隔窗双窗 2×2' },
    { name: 'MR 头颅 多序列', modality: 'MR', bodyPart: 'HEAD', layout: { rows: 2, cols: 3, seriesOrder: ['T1', 'T2', 'FLAIR', 'DWI', 'T1增强', 'SWI'] }, priority: 100, description: 'MR 头颅: T1/T2/FLAIR/DWI 六序列 2×3' },
    { name: 'DR 胸部 正侧位', modality: 'DR', bodyPart: 'CHEST', layout: { rows: 1, cols: 2, seriesOrder: ['正位', '侧位'] }, priority: 95, description: 'DR 胸部: 正位+侧位 1×2' },
    { name: 'CT 腹部 平扫+增强', modality: 'CT', bodyPart: 'ABDOMEN', layout: { rows: 2, cols: 2, seriesOrder: ['平扫', '动脉期', '门脉期', '延迟期'] }, priority: 90, description: 'CT 腹部: 四期对比 2×2' },
    { name: 'MR 脊柱 矢冠轴', modality: 'MR', bodyPart: 'SPINE', layout: { rows: 1, cols: 3, seriesOrder: ['矢状位', '冠状位', '轴位'] }, priority: 90, description: 'MR 脊柱: 矢状+冠状+轴位 1×3' },
    { name: 'CT 颈椎 骨窗+软窗', modality: 'CT', bodyPart: 'NECK', layout: { rows: 1, cols: 2, seriesOrder: ['骨窗', '软组织窗'] }, priority: 85, description: 'CT 颈椎: 双窗对比 1×2' },
    { name: 'MR 膝关节 多序列', modality: 'MR', bodyPart: 'KNEE', layout: { rows: 2, cols: 2, seriesOrder: ['矢状位 PD', '矢状位 T1', '冠状位 PD', '轴位 PD'] }, priority: 80, description: 'MR 膝关节: 矢冠轴四序列 2×2' },
  ]
  for (const s of seeds) {
    const existing = await prisma.hangingProtocol.findFirst({ where: { name: s.name } })
    if (existing) continue
    await prisma.hangingProtocol.create({ data: { ...s, tenantId: TENANT } })
  }
  console.log(`[seed] ${seeds.length} hanging protocols upserted`)
}

// 直接执行 (ts-node prisma/seed.ts) 时才落库; 被 import 时仅导出纯函数供校验
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => {
      void prisma.$disconnect()
    })
}
