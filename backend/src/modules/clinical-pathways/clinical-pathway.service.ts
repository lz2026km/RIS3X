import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ClinicalPathway {
  id: string
  name: string
  dept: string
  phase: string
  progress: number
  status: 'active' | 'paused' | 'archived'
  patients: number
  version: string
  updatedAt: string
}

export interface PathwayPatient {
  id: string
  patient: string
  pathway: string
  step: number
  totalSteps: number
  status: 'on-track' | 'delayed' | 'completed'
  enteredAt: string
  variance: string | null
  steps?: string[]
}

export interface PathwayStats {
  active: number
  paused: number
  totalPatients: number
  onTrack: number
  delayed: number
}

const SEED_PATHWAYS: ClinicalPathway[] = [
  { id: 'PW-001', name: '肺结节随访路径', dept: '呼吸科', phase: '随访复查', progress: 0.65, status: 'active', patients: 128, version: 'v1.3', updatedAt: '2026-07-28T08:00:00.000Z' },
  { id: 'PW-002', name: '乳腺癌筛查路径', dept: '乳腺外科', phase: '影像评估', progress: 0.4, status: 'active', patients: 86, version: 'v2.1', updatedAt: '2026-07-27T09:30:00.000Z' },
  { id: 'PW-003', name: '卒中绿色通道', dept: '神经内科', phase: '溶栓评估', progress: 0.8, status: 'active', patients: 42, version: 'v1.0', updatedAt: '2026-07-28T10:00:00.000Z' },
  { id: 'PW-004', name: '骨科术后康复路径', dept: '骨科', phase: '术后康复', progress: 0.3, status: 'paused', patients: 57, version: 'v1.1', updatedAt: '2026-07-20T14:00:00.000Z' },
  { id: 'PW-005', name: '心血管CTA路径', dept: '心内科', phase: '随访', progress: 1, status: 'archived', patients: 214, version: 'v3.0', updatedAt: '2026-06-30T16:00:00.000Z' },
]

const SEED_PATIENTS: PathwayPatient[] = [
  { id: 'PP-001', patient: '张三', pathway: '肺结节随访路径', step: 3, totalSteps: 6, status: 'on-track', enteredAt: '2026-07-01', variance: null, steps: ['初诊登记', '低剂量CT', 'AI分析', '随访复查', '专科门诊', '年度复查'] },
  { id: 'PP-002', patient: '李四', pathway: '卒中绿色通道', step: 4, totalSteps: 5, status: 'on-track', enteredAt: '2026-07-10', variance: null, steps: ['急诊分诊', '头颅CT', '溶栓评估', '溶栓治疗', '康复转诊'] },
  { id: 'PP-003', patient: '王五', pathway: '乳腺癌筛查路径', step: 2, totalSteps: 5, status: 'delayed', enteredAt: '2026-06-20', variance: '影像设备检修', steps: ['登记', '钼靶检查', '超声补充', '病理活检', '多学科会诊'] },
  { id: 'PP-004', patient: '赵六', pathway: '骨科术后康复路径', step: 5, totalSteps: 5, status: 'completed', enteredAt: '2026-05-15', variance: null, steps: ['术前评估', '手术', '影像复查', '康复训练', '出院评估'] },
  { id: 'PP-005', patient: '钱七', pathway: '肺结节随访路径', step: 1, totalSteps: 6, status: 'on-track', enteredAt: '2026-07-25', variance: null, steps: ['初诊登记', '低剂量CT', 'AI分析', '随访复查', '专科门诊', '年度复查'] },
]

const memPatients: PathwayPatient[] = []

// ── [G005 Wave 10A] 5 条完整临床路径步骤定义 (每路径 8-12 步, 含时长/负责科室/触发条件) ──

export interface PathwayStep {
  index: number
  name: string
  dept: string
  durationDays: number
  triggers?: string
  keyCheckpoints?: string[]
}

export interface PathwayDefinition extends ClinicalPathway {
  steps: PathwayStep[]
  inclusion: string
  exclusion: string
}

const SEED_PATHWAY_STEPS: Record<string, PathwayStep[]> = {
  'PW-001': [
    { index: 1, name: '门诊初诊登记', dept: '呼吸科', durationDays: 1, triggers: '肺结节影像学报告', keyCheckpoints: ['获取既往影像'] },
    { index: 2, name: '低剂量螺旋 CT (LDCT)', dept: '放射科', durationDays: 3, triggers: '结节 >4mm', keyCheckpoints: ['层厚 ≤1.25mm'] },
    { index: 3, name: 'AI 辅助分析 (肺结节 CAD)', dept: '放射科', durationDays: 1, triggers: '自动触发', keyCheckpoints: ['风险分级 低/中/高'] },
    { index: 4, name: '随访复查预约', dept: '呼吸科', durationDays: 90, triggers: '中危 6 个月/低危 12 个月', keyCheckpoints: ['Fleischner 指南'] },
    { index: 5, name: '增强 CT / PET-CT', dept: '放射科', durationDays: 7, triggers: '高危或可疑恶性', keyCheckpoints: ['分期评估'] },
    { index: 6, name: '肺结节专科门诊', dept: '胸外科', durationDays: 5, triggers: '高危结节', keyCheckpoints: ['手术可行性'] },
    { index: 7, name: '穿刺活检', dept: '介入科', durationDays: 3, triggers: '患者同意', keyCheckpoints: ['病理回报'] },
    { index: 8, name: '多学科会诊 (MDT)', dept: '肿瘤科', durationDays: 7, triggers: '病理确诊', keyCheckpoints: ['治疗方案'] },
    { index: 9, name: '手术或 SBRT 治疗', dept: '胸外科', durationDays: 14, triggers: 'MDT 决策', keyCheckpoints: ['R0 切除'] },
    { index: 10, name: '术后复查', dept: '胸外科', durationDays: 30, triggers: '术后 1 月', keyCheckpoints: ['CT 复查'] },
    { index: 11, name: '年度随访', dept: '呼吸科', durationDays: 365, triggers: '长期随访', keyCheckpoints: ['LDCT 年度'] },
  ],
  'PW-002': [
    { index: 1, name: '乳腺筛查登记', dept: '体检中心', durationDays: 1, triggers: '40 岁以上女性', keyCheckpoints: ['高危问卷'] },
    { index: 2, name: '乳腺钼靶 (MG)', dept: '放射科', durationDays: 3, triggers: '常规筛查', keyCheckpoints: ['双体位'] },
    { index: 3, name: '乳腺超声补充', dept: '超声科', durationDays: 2, triggers: '致密型乳腺或 BI-RADS 0', keyCheckpoints: ['BI-RADS 分级'] },
    { index: 4, name: '影像评估 (BI-RADS)', dept: '放射科', durationDays: 1, triggers: '自动', keyCheckpoints: ['4a 及以上转诊'] },
    { index: 5, name: '穿刺活检', dept: '乳腺外科', durationDays: 5, triggers: 'BI-RADS 4-5', keyCheckpoints: ['病理结果'] },
    { index: 6, name: '乳腺癌专科门诊', dept: '乳腺外科', durationDays: 3, triggers: '病理确诊', keyCheckpoints: ['分期'] },
    { index: 7, name: '多学科会诊 (MDT)', dept: '肿瘤科', durationDays: 7, triggers: '确诊患者', keyCheckpoints: ['新辅助/手术决策'] },
    { index: 8, name: '手术治疗', dept: '乳腺外科', durationDays: 10, triggers: 'MDT 决策', keyCheckpoints: ['保乳/全切'] },
    { index: 9, name: '辅助化疗/放疗', dept: '肿瘤科', durationDays: 90, triggers: '分期决定', keyCheckpoints: ['方案完成'] },
    { index: 10, name: '内分泌治疗随访', dept: '乳腺外科', durationDays: 365, triggers: '激素受体阳性', keyCheckpoints: ['依从性'] },
    { index: 11, name: '年度复查', dept: '乳腺外科', durationDays: 365, triggers: '5 年随访', keyCheckpoints: ['MG+US'] },
  ],
  'PW-003': [
    { index: 1, name: '急诊分诊 (FAST 评分)', dept: '急诊科', durationDays: 0, triggers: '疑似卒中', keyCheckpoints: ['发病时间 <4.5h'] },
    { index: 2, name: '头颅 CT (平扫)', dept: '放射科', durationDays: 0, triggers: '急诊绿色通道', keyCheckpoints: ['排除出血 25min 内'] },
    { index: 3, name: 'CT 血管成像 (CTA)', dept: '放射科', durationDays: 0, triggers: '缺血性卒中', keyCheckpoints: ['大血管闭塞'] },
    { index: 4, name: 'ASPECTS 评分', dept: '放射科', durationDays: 0, triggers: '前循环梗死', keyCheckpoints: ['≥6 分'] },
    { index: 5, name: '静脉溶栓 (rt-PA)', dept: '神经内科', durationDays: 0, triggers: '时间窗内无禁忌', keyCheckpoints: ['Door-to-Needle <60min'] },
    { index: 6, name: '机械取栓评估', dept: '介入科', durationDays: 1, triggers: '大血管闭塞', keyCheckpoints: ['M1/ICA 闭塞'] },
    { index: 7, name: '神经重症监护', dept: 'NICU', durationDays: 7, triggers: '溶栓/取栓后', keyCheckpoints: ['血压/血糖管理'] },
    { index: 8, name: '康复评估与转诊', dept: '康复科', durationDays: 3, triggers: '病情稳定 48h', keyCheckpoints: ['mRS 评分'] },
    { index: 9, name: '二级预防用药', dept: '神经内科', durationDays: 14, triggers: '出院前', keyCheckpoints: ['抗血小板/他汀'] },
    { index: 10, name: '3 月随访', dept: '神经内科', durationDays: 90, triggers: '出院 90 天', keyCheckpoints: ['mRS/生活质量'] },
    { index: 11, name: '颈动脉超声复查', dept: '超声科', durationDays: 180, triggers: '颈动脉狭窄', keyCheckpoints: ['狭窄进展'] },
    { index: 12, name: '年度卒中预防门诊', dept: '神经内科', durationDays: 365, triggers: '长期随访', keyCheckpoints: ['危险因素控制'] },
  ],
  'PW-004': [
    { index: 1, name: '门诊评估 (Framingham 评分)', dept: '心内科', durationDays: 1, triggers: '胸痛/冠心病高危', keyCheckpoints: ['危险分层'] },
    { index: 2, name: '冠脉 CTA', dept: '放射科', durationDays: 3, triggers: '中危', keyCheckpoints: ['CAD-RADS 分级'] },
    { index: 3, name: '负荷心肌灌注 (SPECT/CMR)', dept: '核医学科', durationDays: 5, triggers: 'CTA 中重度狭窄', keyCheckpoints: ['缺血范围'] },
    { index: 4, name: '冠脉造影 (CAG)', dept: '导管室', durationDays: 3, triggers: '功能学阳性', keyCheckpoints: ['FFR 测量'] },
    { index: 5, name: '血运重建 (PCI/CABG)', dept: '心内科', durationDays: 7, triggers: '造影决策', keyCheckpoints: ['完全血运重建'] },
    { index: 6, name: '术后监护', dept: 'CCU', durationDays: 3, triggers: '介入术后', keyCheckpoints: ['出血/心衰监测'] },
    { index: 7, name: '心脏康复 I 期', dept: '康复科', durationDays: 14, triggers: '病情稳定', keyCheckpoints: ['运动负荷测试'] },
    { index: 8, name: '心脏康复 II 期', dept: '康复科', durationDays: 90, triggers: '出院后', keyCheckpoints: ['36 次训练'] },
    { index: 9, name: '药物调整随访', dept: '心内科', durationDays: 30, triggers: '出院 1 月', keyCheckpoints: ['LDL-C 达标'] },
    { index: 10, name: '冠脉 CTA 复查', dept: '放射科', durationDays: 365, triggers: '支架/搭桥术后 1 年', keyCheckpoints: ['通畅性'] },
  ],
  'PW-005': [
    { index: 1, name: '急诊创伤评估 (ATLS)', dept: '急诊科', durationDays: 0, triggers: '创伤患者', keyCheckpoints: ['气道/循环稳定'] },
    { index: 2, name: 'X 线/CT 检查', dept: '放射科', durationDays: 0, triggers: '疑似骨折', keyCheckpoints: ['骨折部位确认'] },
    { index: 3, name: '骨折分型评估', dept: '骨科', durationDays: 1, triggers: '影像确诊', keyCheckpoints: ['AO 分型'] },
    { index: 4, name: '手法复位/石膏固定', dept: '骨科', durationDays: 1, triggers: '无移位/可复位', keyCheckpoints: ['复位后复查 X 线'] },
    { index: 5, name: '手术内固定', dept: '骨科', durationDays: 3, triggers: '不稳定骨折', keyCheckpoints: ['钢板/髓内钉'] },
    { index: 6, name: '术后影像复查', dept: '放射科', durationDays: 2, triggers: '术后', keyCheckpoints: ['对位对线'] },
    { index: 7, name: '康复训练 (关节活动度)', dept: '康复科', durationDays: 30, triggers: '术后/固定后 2 周', keyCheckpoints: ['ROM 达标'] },
    { index: 8, name: '骨折愈合复查', dept: '骨科', durationDays: 90, triggers: '6-12 周', keyCheckpoints: ['骨痂形成'] },
    { index: 9, name: '去除固定物评估', dept: '骨科', durationDays: 180, triggers: '愈合良好', keyCheckpoints: ['X 线确认'] },
    { index: 10, name: '功能康复 (肌力训练)', dept: '康复科', durationDays: 180, triggers: '持续康复', keyCheckpoints: ['肌力 4-5 级'] },
    { index: 11, name: '终末随访', dept: '骨科', durationDays: 365, triggers: '术后 1 年', keyCheckpoints: ['功能评分'] },
  ],
}

@Injectable()
export class ClinicalPathwayService {
  private readonly logger = new Logger(ClinicalPathwayService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listPathways(): Promise<ClinicalPathway[]> {
    try {
      const rows = await this.prisma.workflowDefinition.findMany({
        select: { id: true, name: true, description: true, active: true, version: true, updatedAt: true, _count: { select: { steps: true } } },
        orderBy: { updatedAt: 'desc' },
      })
      if (rows.length === 0) return SEED_PATHWAYS
      return rows.map((r) => ({
        id: `pw-${r.id}`,
        name: r.name,
        dept: r.description || '放射科',
        phase: r.active ? '运行中' : '已归档',
        progress: Math.min(1, (r._count.steps || 1) / 8),
        status: (r.active ? 'active' : 'archived') as ClinicalPathway['status'],
        patients: 0,
        version: `v${r.version}`,
        updatedAt: r.updatedAt.toISOString(),
      }))
    } catch (err) {
      this.logger.warn(`[ClinicalPathway] DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_PATHWAYS
    }
  }

  async getStats(): Promise<PathwayStats> {
    const pathways = await this.listPathways()
    const patients = await this.listPatients()
    return {
      active: pathways.filter((p) => p.status === 'active').length,
      paused: pathways.filter((p) => p.status === 'paused').length,
      totalPatients: patients.length,
      onTrack: patients.filter((p) => p.status === 'on-track').length,
      delayed: patients.filter((p) => p.status === 'delayed').length,
    }
  }

  async listPatients(): Promise<PathwayPatient[]> {
    return [...memPatients, ...SEED_PATIENTS]
  }

  async getSteps(id: string): Promise<string[]> {
    const patient = [...memPatients, ...SEED_PATIENTS].find((p) => p.id === id)
    const steps = patient?.steps ?? SEED_PATIENTS[0]?.steps ?? []
    return steps
  }

  /** [G005 Wave 10A] 路径步骤定义 (5 条完整路径, 每路径 8-12 步) */
  async getPathwaySteps(pathwayId: string): Promise<PathwayStep[]> {
    return SEED_PATHWAY_STEPS[pathwayId] ?? []
  }

  /** [G005 Wave 10A] 路径目录 (含步骤数/时长/入排标准) */
  async listPathwayDefinitions(): Promise<PathwayDefinition[]> {
    const pathways = await this.listPathways()
    return pathways.map((p) => ({
      ...p,
      steps: SEED_PATHWAY_STEPS[p.id] ?? [],
      inclusion: this.inclusionOf(p.id),
      exclusion: this.exclusionOf(p.id),
    }))
  }

  private inclusionOf(id: string): string {
    const map: Record<string, string> = {
      'PW-001': '影像学发现肺结节(≥4mm)或肺癌高危人群筛查',
      'PW-002': '40-69 岁女性常规筛查或乳腺自查异常',
      'PW-003': '疑似急性缺血性卒中(发病 <4.5h)',
      'PW-004': '冠心病高危或确诊冠心病患者',
      'PW-005': '四肢/骨盆闭合性骨折(无血管神经损伤)',
    }
    return map[id] ?? '按临床指南纳入'
  }

  private exclusionOf(id: string): string {
    const map: Record<string, string> = {
      'PW-001': '晚期转移性肺癌、无法耐受手术',
      'PW-002': '妊娠期、既往乳腺癌根治术后',
      'PW-003': '出血性卒中、发病 >4.5h 且无影像学支持',
      'PW-004': '急性心梗 STEMI(走胸痛中心路径)',
      'PW-005': '开放性骨折伴神经血管损伤、病理性骨折',
    }
    return map[id] ?? '按临床指南排除'
  }

  async togglePathway(id: string, status?: 'active' | 'paused'): Promise<{ id: string; status: string }> {
    const target = SEED_PATHWAYS.find((p) => p.id === id)
    return { id, status: status ?? (target?.status === 'active' ? 'paused' : 'active') }
  }

  async enrollPatient(input: { patientName: string; pathwayName: string }): Promise<PathwayPatient> {
    const record: PathwayPatient = {
      id: `PP-${Date.now()}`,
      patient: input.patientName ?? '新患者',
      pathway: input.pathwayName ?? '未指定路径',
      step: 1,
      totalSteps: 8,
      status: 'on-track',
      enteredAt: new Date().toISOString().slice(0, 10),
      variance: null,
      steps: ['门诊评估', '术前检查', '会诊', '宣教', '治疗', '观察', '随访', '复查'],
    }
    memPatients.unshift(record)
    return record
  }

  // ── [G005 W3-BackendParity] 患者路径追踪: 推进阶段 / 退出路径 ──

  private findPatient(id: string): PathwayPatient {
    const patient = [...memPatients, ...SEED_PATIENTS].find((p) => p.id === id)
    if (!patient) throw new NotFoundException(`患者 ${id} 未在路径内`)
    return patient
  }

  /** POST /clinical-pathways/patients/:id/advance — 推进到下一阶段 */
  async advancePatient(id: string): Promise<PathwayPatient> {
    const patient = this.findPatient(id)
    if (patient.step < patient.totalSteps) {
      patient.step += 1
      if (patient.step >= patient.totalSteps) patient.status = 'completed'
    }
    return { ...patient }
  }

  /** POST /clinical-pathways/patients/:id/exit — 退出路径 */
  async exitPatient(id: string): Promise<{ deleted: boolean }> {
    const memIdx = memPatients.findIndex((p) => p.id === id)
    if (memIdx >= 0) {
      memPatients.splice(memIdx, 1)
      return { deleted: true }
    }
    const seedIdx = SEED_PATIENTS.findIndex((p) => p.id === id)
    if (seedIdx >= 0) {
      SEED_PATIENTS.splice(seedIdx, 1)
      return { deleted: true }
    }
    throw new NotFoundException(`患者 ${id} 未在路径内`)
  }
}
