/**
 * [G005 W11-DeviceOps] 确定性种子数据 (无 DB 可启动).
 * 时间锚点固定为 2026-09-01, 便于单测复现 (方法可显式传入 now)。
 */
import type {
  CalibrationKind,
  CalibrationResult,
  DepreciationMethod,
  DowntimeEventInput,
  ScheduleFrequency,
  WorkOrderKind,
  WorkOrderPriority,
  WorkOrderStatus,
} from './device-ops.types'

export const ANCHOR = '2026-09-01'

export function anchorOffset(days: number, hour = 8): string {
  const d = new Date(`${ANCHOR}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export interface SeedDevice {
  id: string
  name: string
  modality: string
  location: string
}

export const DEVICES: SeedDevice[] = [
  { id: 'CT-01', name: 'CT 1号机 (GE Revolution)', modality: 'CT', location: 'CT室1' },
  { id: 'CT-02', name: 'CT 2号机 (联影 uCT 780)', modality: 'CT', location: 'CT室2' },
  { id: 'MR-01', name: 'MR 1号机 (Siemens Skyra)', modality: 'MR', location: 'MR室1' },
  { id: 'MR-02', name: 'MR 2号机 (Philips Ingenia)', modality: 'MR', location: 'MR室2' },
  { id: 'DR-01', name: 'DR 1号机 (Philips DigitalDiagnost)', modality: 'DR', location: 'DR室1' },
  { id: 'DR-02', name: 'DR 2号机 (Siemens Ysio)', modality: 'DR', location: 'DR室2' },
  { id: 'MG-01', name: '钼靶 1号机 (Hologic Selenia)', modality: 'MG', location: '乳腺室' },
  { id: 'DSA-01', name: 'DSA 1号机 (GE Innova)', modality: 'DSA', location: '介入室' },
]

export interface SeedPart {
  name: string
  quantity: number
  unitPrice: number
}

export interface SeedWorkOrder {
  id: string
  kind: WorkOrderKind
  title: string
  deviceId: string
  deviceName: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  assignee: string
  parts: SeedPart[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  closedAt?: string
  description: string
  source: 'manual' | 'fault-report'
}

const part = (name: string, quantity: number, unitPrice: number): SeedPart => ({ name, quantity, unitPrice })

export const SEED_WORK_ORDERS: SeedWorkOrder[] = [
  {
    id: 'WO-1001', kind: 'fault', title: 'CT-01 球管打火报警', deviceId: 'CT-01', deviceName: 'CT 1号机 (GE Revolution)',
    priority: 'critical', status: 'in_progress', assignee: '张工', parts: [part('高压电缆', 1, 3200)],
    createdAt: anchorOffset(-1, 9), updatedAt: anchorOffset(0, 10), startedAt: anchorOffset(-1, 11),
    description: '扫描中报 tube arcing，图像偶发环形伪影，需现场排查高压回路。', source: 'fault-report',
  },
  {
    id: 'WO-1002', kind: 'fault', title: 'MR-01 冷头压缩机异响', deviceId: 'MR-01', deviceName: 'MR 1号机 (Siemens Skyra)',
    priority: 'high', status: 'waiting_parts', assignee: '李工', parts: [part('冷头压缩机', 1, 86000), part('氦气', 1, 12000)],
    createdAt: anchorOffset(-3, 8), updatedAt: anchorOffset(-1, 16), startedAt: anchorOffset(-2, 9),
    description: '冷头压缩机噪音增大，液氦蒸发率上升，已订购备件。', source: 'fault-report',
  },
  {
    id: 'WO-1003', kind: 'maintenance', title: 'DR-01 季度预防性维护', deviceId: 'DR-01', deviceName: 'DR 1号机 (Philips DigitalDiagnost)',
    priority: 'medium', status: 'assigned', assignee: '王工', parts: [],
    createdAt: anchorOffset(-2, 8), updatedAt: anchorOffset(-1, 9),
    description: '探测器增益校准、X线管训练、机械运动部件润滑。', source: 'manual',
  },
  {
    id: 'WO-1004', kind: 'maintenance', title: 'MG-01 图像质量年检', deviceId: 'MG-01', deviceName: '钼靶 1号机 (Hologic Selenia)',
    priority: 'medium', status: 'completed', assignee: '陈工', parts: [part('压迫器', 1, 2800)],
    createdAt: anchorOffset(-10, 8), updatedAt: anchorOffset(-6, 15), startedAt: anchorOffset(-8, 9), completedAt: anchorOffset(-6, 15),
    description: '按 ACR 标准完成乳腺模体图像质量检测。', source: 'manual',
  },
  {
    id: 'WO-1005', kind: 'fault', title: 'US-01 探头图像暗带', deviceId: 'DR-02', deviceName: 'DR 2号机 (Siemens Ysio)',
    priority: 'low', status: 'open', assignee: '', parts: [],
    createdAt: anchorOffset(-1, 14), updatedAt: anchorOffset(-1, 14),
    description: '腹部探头图像出现纵向暗带，待分派工程师。', source: 'fault-report',
  },
  {
    id: 'WO-1006', kind: 'maintenance', title: 'DSA-01 造影剂注射器联动巡检', deviceId: 'DSA-01', deviceName: 'DSA 1号机 (GE Innova)',
    priority: 'high', status: 'new', assignee: '', parts: [],
    createdAt: anchorOffset(0, 7), updatedAt: anchorOffset(0, 7),
    description: '注射器与 DSA 联动时序校验，压力传感器标定。', source: 'manual',
  },
  {
    id: 'WO-1007', kind: 'fault', title: 'CT-02 重建服务器磁盘告警', deviceId: 'CT-02', deviceName: 'CT 2号机 (联影 uCT 780)',
    priority: 'high', status: 'closed', assignee: '赵工', parts: [part('企业级 SSD', 2, 4200)],
    createdAt: anchorOffset(-14, 8), updatedAt: anchorOffset(-12, 18), startedAt: anchorOffset(-14, 10), completedAt: anchorOffset(-13, 12), closedAt: anchorOffset(-12, 18),
    description: 'RAID 降级告警，更换故障磁盘并重建阵列。', source: 'fault-report',
  },
  {
    id: 'WO-1008', kind: 'maintenance', title: 'MR-02 液氦液位补充', deviceId: 'MR-02', deviceName: 'MR 2号机 (Philips Ingenia)',
    priority: 'medium', status: 'in_progress', assignee: '李工', parts: [part('液氦', 1, 15000)],
    createdAt: anchorOffset(-1, 8), updatedAt: anchorOffset(0, 9), startedAt: anchorOffset(0, 9),
    description: '液氦液位低于 55%，按计划补充。', source: 'manual',
  },
  {
    id: 'WO-1009', kind: 'fault', title: 'DR-02 工作站软件崩溃', deviceId: 'DR-02', deviceName: 'DR 2号机 (Siemens Ysio)',
    priority: 'low', status: 'completed', assignee: '王工', parts: [],
    createdAt: anchorOffset(-5, 8), updatedAt: anchorOffset(-4, 11), startedAt: anchorOffset(-4, 9), completedAt: anchorOffset(-4, 11),
    description: '检查采集软件异常退出，重装并升级补丁。', source: 'fault-report',
  },
  {
    id: 'WO-1010', kind: 'maintenance', title: 'CT-01 半年度保养', deviceId: 'CT-01', deviceName: 'CT 1号机 (GE Revolution)',
    priority: 'medium', status: 'new', assignee: '', parts: [],
    createdAt: anchorOffset(0, 8), updatedAt: anchorOffset(0, 8),
    description: '球管老化测试、准直器校准、机架平衡检查。', source: 'manual',
  },
]

export interface SeedCalibration {
  id: string
  deviceId: string
  deviceName: string
  kind: CalibrationKind
  standard: string
  lastDate: string
  nextDue: string
  result: CalibrationResult
  certNo: string
  lab: string
  operator: string
  notes?: string
}

export const SEED_CALIBRATIONS: SeedCalibration[] = [
  { id: 'CAL-2001', deviceId: 'CT-01', deviceName: 'CT 1号机 (GE Revolution)', kind: 'calibration', standard: 'JJF 1257-2010 CT X射线剂量', lastDate: anchorOffset(-330), nextDue: anchorOffset(35), result: 'pass', certNo: 'CAL-CT01-2025', lab: '省计量院', operator: '张工' },
  { id: 'CAL-2002', deviceId: 'CT-02', deviceName: 'CT 2号机 (联影 uCT 780)', kind: 'calibration', standard: 'JJF 1257-2010 CT X射线剂量', lastDate: anchorOffset(-350), nextDue: anchorOffset(15), result: 'pass', certNo: 'CAL-CT02-2025', lab: '省计量院', operator: '王工' },
  { id: 'CAL-2003', deviceId: 'MR-01', deviceName: 'MR 1号机 (Siemens Skyra)', kind: 'calibration', standard: 'JJF 1337-2012 MR 成像质量', lastDate: anchorOffset(-360), nextDue: anchorOffset(-10), result: 'fail', certNo: 'CAL-MR01-2025', lab: '医学物理科', operator: '李工', notes: '信噪比低于标准，需整改后复测' },
  { id: 'CAL-2004', deviceId: 'MR-02', deviceName: 'MR 2号机 (Philips Ingenia)', kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: anchorOffset(-300), nextDue: anchorOffset(65), result: 'pass', certNo: 'CERT-MR02-2025', lab: '市疾控中心', operator: '赵工' },
  { id: 'CAL-2005', deviceId: 'DR-01', deviceName: 'DR 1号机 (Philips DigitalDiagnost)', kind: 'calibration', standard: 'JJG 1078-2012 医用数字摄影', lastDate: anchorOffset(-320), nextDue: anchorOffset(45), result: 'pass', certNo: 'CAL-DR01-2025', lab: '省计量院', operator: '王工' },
  { id: 'CAL-2006', deviceId: 'DR-02', deviceName: 'DR 2号机 (Siemens Ysio)', kind: 'calibration', standard: 'JJG 1078-2012 医用数字摄影', lastDate: anchorOffset(-360), nextDue: anchorOffset(-5), result: 'fail', certNo: 'CAL-DR02-2025', lab: '省计量院', operator: '陈工', notes: '空间分辨力不达标' },
  { id: 'CAL-2007', deviceId: 'MG-01', deviceName: '钼靶 1号机 (Hologic Selenia)', kind: 'calibration', standard: 'JJG 1078-2012 MG 摄影', lastDate: anchorOffset(-180), nextDue: anchorOffset(20), result: 'pass', certNo: 'CAL-MG01-2026', lab: '省计量院', operator: '陈工' },
  { id: 'CAL-2008', deviceId: 'DSA-01', deviceName: 'DSA 1号机 (GE Innova)', kind: 'certification', standard: 'GBZ 130-2020 介入防护', lastDate: anchorOffset(-200), nextDue: anchorOffset(160), result: 'pass', certNo: 'CERT-DSA01-2026', lab: '市疾控中心', operator: '赵工' },
  { id: 'CAL-2009', deviceId: 'DR-01', deviceName: 'DR 1号机 (Philips DigitalDiagnost)', kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: anchorOffset(-150), nextDue: anchorOffset(28), result: 'pending', certNo: 'CERT-DR01-2026', lab: '市疾控中心', operator: '王工', notes: '现场检测完成，报告待出' },
  { id: 'CAL-2010', deviceId: 'CT-01', deviceName: 'CT 1号机 (GE Revolution)', kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: anchorOffset(-290), nextDue: anchorOffset(75), result: 'pass', certNo: 'CERT-CT01-2025', lab: '市疾控中心', operator: '张工' },
]

export interface SeedAsset {
  id: string
  deviceId: string
  deviceName: string
  category: string
  vendor: string
  procurementCost: number
  procurementDate: string
  installDate: string
  warrantyEnd: string
  method: DepreciationMethod
  salvageRate: number
  usefulLifeMonths: number
  status: 'in_use' | 'maintenance' | 'retired' | 'scrapped'
}

export const SEED_ASSETS: SeedAsset[] = [
  { id: 'AST-3001', deviceId: 'CT-01', deviceName: 'CT 1号机 (GE Revolution)', category: '放射影像设备', vendor: 'GE Healthcare', procurementCost: 6800000, procurementDate: '2021-03-15', installDate: '2021-05-01', warrantyEnd: '2024-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3002', deviceId: 'CT-02', deviceName: 'CT 2号机 (联影 uCT 780)', category: '放射影像设备', vendor: '联影医疗', procurementCost: 4200000, procurementDate: '2022-06-01', installDate: '2022-08-01', warrantyEnd: '2025-08-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3003', deviceId: 'MR-01', deviceName: 'MR 1号机 (Siemens Skyra)', category: '放射影像设备', vendor: 'Siemens Healthineers', procurementCost: 12800000, procurementDate: '2020-09-01', installDate: '2021-01-01', warrantyEnd: '2024-01-01', method: 'declining', salvageRate: 0.08, usefulLifeMonths: 120, status: 'maintenance' },
  { id: 'AST-3004', deviceId: 'MR-02', deviceName: 'MR 2号机 (Philips Ingenia)', category: '放射影像设备', vendor: 'Philips', procurementCost: 9600000, procurementDate: '2023-02-01', installDate: '2023-05-01', warrantyEnd: '2026-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3005', deviceId: 'DR-01', deviceName: 'DR 1号机 (Philips DigitalDiagnost)', category: '放射影像设备', vendor: 'Philips', procurementCost: 850000, procurementDate: '2019-04-01', installDate: '2019-05-01', warrantyEnd: '2022-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 96, status: 'in_use' },
  { id: 'AST-3006', deviceId: 'DR-02', deviceName: 'DR 2号机 (Siemens Ysio)', category: '放射影像设备', vendor: 'Siemens Healthineers', procurementCost: 780000, procurementDate: '2018-08-01', installDate: '2018-09-01', warrantyEnd: '2021-09-01', method: 'declining', salvageRate: 0.05, usefulLifeMonths: 96, status: 'retired' },
  { id: 'AST-3007', deviceId: 'MG-01', deviceName: '钼靶 1号机 (Hologic Selenia)', category: '放射影像设备', vendor: 'Hologic', procurementCost: 1560000, procurementDate: '2022-11-01', installDate: '2022-12-15', warrantyEnd: '2025-12-15', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 96, status: 'in_use' },
  { id: 'AST-3008', deviceId: 'DSA-01', deviceName: 'DSA 1号机 (GE Innova)', category: '介入设备', vendor: 'GE Healthcare', procurementCost: 8900000, procurementDate: '2021-07-01', installDate: '2021-10-01', warrantyEnd: '2024-10-01', method: 'declining', salvageRate: 0.08, usefulLifeMonths: 108, status: 'in_use' },
]

/** 真实停机事件 (来自工单/避免重复登记), 按设备维度 */
export interface SeedDowntime extends DowntimeEventInput {
  id: string
  deviceId: string
  date: string
}

export const SEED_DOWNTIME: SeedDowntime[] = [
  { id: 'DT-01', deviceId: 'CT-01', date: anchorOffset(-1), reason: 'unplanned', minutes: 95, workOrderId: 'WO-1001', note: '球管打火停机' },
  { id: 'DT-02', deviceId: 'CT-01', date: anchorOffset(0), reason: 'planned', minutes: 45, note: '球管预热' },
  { id: 'DT-03', deviceId: 'CT-01', date: anchorOffset(0), reason: 'changeover', minutes: 25, note: '换床与摆位' },
  { id: 'DT-04', deviceId: 'CT-01', date: anchorOffset(0), reason: 'small-stop', minutes: 18, note: '图像重建等待' },
  { id: 'DT-05', deviceId: 'MR-01', date: anchorOffset(-2), reason: 'unplanned', minutes: 210, workOrderId: 'WO-1002', note: '冷头压缩机停机' },
  { id: 'DT-06', deviceId: 'MR-01', date: anchorOffset(0), reason: 'planned', minutes: 60, note: '每日质控' },
  { id: 'DT-07', deviceId: 'MR-01', date: anchorOffset(0), reason: 'idle', minutes: 40, note: '无预约空转' },
  { id: 'DT-08', deviceId: 'MR-02', date: anchorOffset(0), reason: 'planned', minutes: 180, workOrderId: 'WO-1008', note: '液氦补充' },
  { id: 'DT-09', deviceId: 'DR-01', date: anchorOffset(0), reason: 'changeover', minutes: 30 },
  { id: 'DT-10', deviceId: 'DR-01', date: anchorOffset(0), reason: 'small-stop', minutes: 22 },
  { id: 'DT-11', deviceId: 'DR-02', date: anchorOffset(-4), reason: 'unplanned', minutes: 60, workOrderId: 'WO-1009', note: '工作站崩溃' },
  { id: 'DT-12', deviceId: 'MG-01', date: anchorOffset(0), reason: 'idle', minutes: 55 },
  { id: 'DT-13', deviceId: 'DSA-01', date: anchorOffset(0), reason: 'changeover', minutes: 35 },
  { id: 'DT-14', deviceId: 'DSA-01', date: anchorOffset(0), reason: 'small-stop', minutes: 12 },
]

/** 当日/计划产量 (用于 OEE 性能与质量) */
export const SEED_PRODUCTION: Record<string, { plannedMinutes: number; idealCycleMinutes: number; totalCount: number; goodCount: number }> = {
  'CT-01': { plannedMinutes: 720, idealCycleMinutes: 8, totalCount: 78, goodCount: 74 },
  'CT-02': { plannedMinutes: 720, idealCycleMinutes: 9, totalCount: 70, goodCount: 68 },
  'MR-01': { plannedMinutes: 660, idealCycleMinutes: 22, totalCount: 24, goodCount: 22 },
  'MR-02': { plannedMinutes: 660, idealCycleMinutes: 24, totalCount: 20, goodCount: 19 },
  'DR-01': { plannedMinutes: 720, idealCycleMinutes: 4, totalCount: 155, goodCount: 150 },
  'DR-02': { plannedMinutes: 720, idealCycleMinutes: 4, totalCount: 140, goodCount: 133 },
  'MG-01': { plannedMinutes: 600, idealCycleMinutes: 12, totalCount: 45, goodCount: 44 },
  'DSA-01': { plannedMinutes: 480, idealCycleMinutes: 35, totalCount: 12, goodCount: 12 },
}

/** 成本核算行 (按检查项目/模态) */
export interface SeedCostRow {
  examItem: string
  modality: string
  volume: number
  unitPrice: number
  consumables: number
  contrast: number
  labor: number
  depreciation: number
  overhead: number
}

export const SEED_COST_ROWS: SeedCostRow[] = [
  { examItem: 'CT 胸部平扫', modality: 'CT', volume: 1280, unitPrice: 260, consumables: 18, contrast: 0, labor: 45, depreciation: 38, overhead: 22 },
  { examItem: 'CT 腹部增强', modality: 'CT', volume: 760, unitPrice: 520, consumables: 26, contrast: 185, labor: 62, depreciation: 42, overhead: 30 },
  { examItem: 'MR 头颅平扫', modality: 'MR', volume: 640, unitPrice: 420, consumables: 12, contrast: 0, labor: 68, depreciation: 96, overhead: 34 },
  { examItem: 'MR 腰椎增强', modality: 'MR', volume: 380, unitPrice: 680, consumables: 15, contrast: 210, labor: 78, depreciation: 104, overhead: 40 },
  { examItem: 'DR 胸部正位', modality: 'DR', volume: 2100, unitPrice: 90, consumables: 6, contrast: 0, labor: 14, depreciation: 8, overhead: 7 },
  { examItem: 'MG 乳腺钼靶', modality: 'MG', volume: 520, unitPrice: 180, consumables: 10, contrast: 0, labor: 26, depreciation: 24, overhead: 12 },
  { examItem: 'DSA 冠脉造影', modality: 'DSA', volume: 160, unitPrice: 3800, consumables: 420, contrast: 860, labor: 520, depreciation: 680, overhead: 260 },
]

/** DRG 运营行 (桩) */
export interface SeedDrgRow {
  drgCode: string
  name: string
  mdc: string
  weight: number
  cases: number
  revenuePerCase: number
  costPerCase: number
}

export const SEED_DRG_ROWS: SeedDrgRow[] = [
  { drgCode: 'FM19', name: '经皮冠脉支架植入', mdc: 'MDC-F', weight: 3.42, cases: 86, revenuePerCase: 42800, costPerCase: 36200 },
  { drgCode: 'BR23', name: '脑缺血性疾患', mdc: 'MDC-B', weight: 1.28, cases: 214, revenuePerCase: 16200, costPerCase: 13800 },
  { drgCode: 'ES31', name: '呼吸系统感染/炎症', mdc: 'MDC-E', weight: 0.92, cases: 356, revenuePerCase: 11800, costPerCase: 10500 },
  { drgCode: 'GK29', name: '消化系统恶性肿瘤', mdc: 'MDC-G', weight: 2.15, cases: 132, revenuePerCase: 27600, costPerCase: 25400 },
  { drgCode: 'IR15', name: '骨骼肌肉系统手术', mdc: 'MDC-I', weight: 1.76, cases: 178, revenuePerCase: 22400, costPerCase: 19600 },
  { drgCode: 'NR20', name: '神经系统其他疾患', mdc: 'MDC-N', weight: 1.05, cases: 240, revenuePerCase: 13400, costPerCase: 12200 },
]

export interface SeedReportDefinition {
  id: string
  name: string
  reportType: string
  frequency: ScheduleFrequency
  timeOfDay: string
  recipients: string[]
  format: 'xlsx' | 'pdf' | 'csv'
  enabled: boolean
  createdAt: string
  lastRunAt?: string
}

export const SEED_REPORT_DEFINITIONS: SeedReportDefinition[] = [
  { id: 'RPT-4001', name: '设备 OEE 日报', reportType: 'oee-daily', frequency: 'daily', timeOfDay: '07:00', recipients: ['设备科', '院长办公室'], format: 'xlsx', enabled: true, createdAt: anchorOffset(-30), lastRunAt: anchorOffset(0, 7) },
  { id: 'RPT-4002', name: '停机损失周报', reportType: 'downtime-weekly', frequency: 'weekly', timeOfDay: '08:00', recipients: ['设备科'], format: 'pdf', enabled: true, createdAt: anchorOffset(-60), lastRunAt: anchorOffset(-4, 8) },
  { id: 'RPT-4003', name: '运营成本月报', reportType: 'cost-monthly', frequency: 'monthly', timeOfDay: '09:00', recipients: ['财务科', '运营办', '院长办公室'], format: 'xlsx', enabled: true, createdAt: anchorOffset(-90), lastRunAt: anchorOffset(-14, 9) },
  { id: 'RPT-4004', name: 'DRG 绩效月报', reportType: 'drg-monthly', frequency: 'monthly', timeOfDay: '09:30', recipients: ['医保办', '运营办'], format: 'pdf', enabled: false, createdAt: anchorOffset(-45) },
  { id: 'RPT-4005', name: '临时导出报表 (手动)', reportType: 'adhoc', frequency: 'manual', timeOfDay: '10:00', recipients: ['设备科'], format: 'csv', enabled: true, createdAt: anchorOffset(-10) },
]

export interface SeedReportInstance {
  id: string
  definitionId: string
  definitionName: string
  generatedAt: string
  status: 'success' | 'failed' | 'running'
  rowCount: number
  sizeKb: number
  format: 'xlsx' | 'pdf' | 'csv'
  deliveryLog: Array<{ recipient: string; channel: string; status: 'sent' | 'failed'; at: string }>
}

export const SEED_REPORT_INSTANCES: SeedReportInstance[] = [
  {
    id: 'INST-5001', definitionId: 'RPT-4001', definitionName: '设备 OEE 日报', generatedAt: anchorOffset(0, 7), status: 'success', rowCount: 8, sizeKb: 42, format: 'xlsx',
    deliveryLog: [
      { recipient: '设备科', channel: 'email', status: 'sent', at: anchorOffset(0, 7) },
      { recipient: '院长办公室', channel: 'email', status: 'sent', at: anchorOffset(0, 7) },
    ],
  },
  {
    id: 'INST-5002', definitionId: 'RPT-4002', definitionName: '停机损失周报', generatedAt: anchorOffset(-4, 8), status: 'success', rowCount: 14, sizeKb: 88, format: 'pdf',
    deliveryLog: [{ recipient: '设备科', channel: 'email', status: 'sent', at: anchorOffset(-4, 8) }],
  },
  {
    id: 'INST-5003', definitionId: 'RPT-4003', definitionName: '运营成本月报', generatedAt: anchorOffset(-14, 9), status: 'success', rowCount: 7, sizeKb: 65, format: 'xlsx',
    deliveryLog: [
      { recipient: '财务科', channel: 'email', status: 'sent', at: anchorOffset(-14, 9) },
      { recipient: '运营办', channel: 'email', status: 'sent', at: anchorOffset(-14, 9) },
      { recipient: '院长办公室', channel: 'email', status: 'failed', at: anchorOffset(-14, 9) },
    ],
  },
]
