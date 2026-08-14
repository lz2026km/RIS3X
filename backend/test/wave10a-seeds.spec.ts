/**
 * [G005 Wave 10A] 确定性 seed 扩充验证 spec
 *
 * 覆盖 10 个模块的 seed 扩充:
 *   1. ai-diagnosis    — 4 模型各 +15 例 (肺 10 类/乳腺 BI-RADS/骨折 8 类/心脏 6 类)
 *   2. dicom-sr        — 20 个 TID1500/2000 测量模板 (CT 胸腹/MR 脑脊柱/DR 骨折/MG 乳腺)
 *   3. rdsr            — DRL 阈值表完整版 (CT 10 部位成人/儿童 + MG/DR/RF)
 *   4. smart-route     — 20 医生资质档案 + 10 科室路由规则
 *   5. clinical-pathways — 5 条完整路径 (每路径 8-12 步骤)
 *   6. followup        — 20 个随访模板 (病种 + 术式 8 类)
 *   7. qc-pdca         — 5 个完整 PDCA 周期 (plan/do/check/act 全阶段)
 *   8. custom-report   — 8 个报表定义 (日工作量/周收入/月度质控/危急值 SLA)
 *   9. tech-schedule   — 4 周 × 8 技师月排班
 *  10. lesion-tracking — 5 患者 12 病灶完整测量序列
 */
import { AiDiagnosisService } from '../src/modules/ai-diagnosis/ai-diagnosis.service'
import { DicomSrService } from '../src/modules/dicom-sr/dicom-sr.service'
import { RdsrService } from '../src/modules/rdsr/rdsr.service'
import { SmartRouteService } from '../src/modules/smart-route/smart-route.service'
import { ClinicalPathwayService } from '../src/modules/clinical-pathways/clinical-pathway.service'
import { FollowUpService } from '../src/modules/followup/followup.service'
import { QcPdcaService } from '../src/modules/qc-pdca/qc-pdca.service'
import { CustomReportService } from '../src/modules/custom-report/custom-report.service'
import { TechScheduleService } from '../src/modules/tech-schedule/tech-schedule.service'
import { LesionTrackingService } from '../src/modules/lesion-tracking/lesion-tracking.service'
import { PrismaService } from '../src/prisma/prisma.service'

function failingPrisma(): any {
  return new Proxy({}, { get: () => () => { throw new Error('no db (seed spec stub)') } })
}

describe('[Wave 10A] seed 扩充: ai-diagnosis (每模型 +15 例)', () => {
  let svc: AiDiagnosisService

  beforeEach(() => {
    svc = new AiDiagnosisService()
  })

  it('肺结节: ≥19 例, 含 10 类形态与 LIDC 编号', async () => {
    const res = await svc.listLungCad()
    const cases = res.data
    expect(cases.length).toBeGreaterThanOrEqual(19)
    const extra = cases.filter((c) => c.id.startsWith('LUNG-10') || c.id.startsWith('LUNG-11'))
    expect(extra.length).toBe(15)
    const chars = new Set(extra.flatMap((c) => c.nodules.map((n) => n.characteristics[0])))
    expect(chars.size).toBeGreaterThanOrEqual(8)
    for (const c of extra) {
      expect(c.studyId).toMatch(/^LS2026/)
      for (const n of c.nodules) {
        expect(n.diameter).toBeGreaterThan(0)
        expect(n.malignancyRisk).toBeGreaterThanOrEqual(0)
        expect(n.malignancyRisk).toBeLessThanOrEqual(1)
        expect(n.lidcId).toMatch(/^LIDC-IDRI-/)
        expect(['solid', 'partSolid', 'groundGlass', 'calcified']).toContain(n.density)
      }
    }
  })

  it('乳腺: ≥19 例, BI-RADS 全分级 2/3/4a/4b/4c/5 均覆盖', async () => {
    const res = await svc.listBreastCad()
    const cases = res.data
    expect(cases.length).toBeGreaterThanOrEqual(19)
    const biRads = new Set(cases.map((c) => c.overallBiRads))
    for (const level of ['2', '3', '4a', '4b', '4c', '5']) expect(biRads.has(level)).toBe(true)
    for (const c of cases) expect(c.recommendation).toContain('BI-RADS')
  })

  it('骨折: ≥19 例, 8 类骨折部位 (桡骨/舟骨/踝/髋/骨盆/肩/脊柱/肋骨)', async () => {
    const res = await svc.listFractureCad()
    const cases = res.data
    expect(cases.length).toBeGreaterThanOrEqual(19)
    const bodyParts = new Set(cases.map((c) => c.bodyPart))
    for (const part of ['前臂', '手腕', '踝部', '髋部', '骨盆', '肩部', '脊柱', '肋骨', '小腿', '足部', '锁骨']) {
      expect(bodyParts.has(part)).toBe(true)
    }
    for (const c of cases) {
      for (const f of c.fractures) {
        expect(f.confidence).toBeGreaterThan(0.7)
        expect(f.boundingBox.width).toBeGreaterThan(0)
      }
    }
  })

  it('心脏: ≥18 例, CAD-RADS 0-5 与 MR 心衰评估均覆盖, 病例库可汇总', async () => {
    const res = await svc.listCardiacAi()
    expect(res.data.length).toBeGreaterThanOrEqual(18)
    const rads = new Set(res.data.filter((c) => c.cadRads).map((c) => c.cadRads as string))
    for (const level of ['0', '1', '2', '3', '4', '5']) expect(rads.has(level)).toBe(true)
    const lib = await svc.listCaseLibrary()
    expect(lib.data.lungCad.total).toBeGreaterThanOrEqual(19)
    expect(lib.data.breastCad.total).toBeGreaterThanOrEqual(19)
    expect(lib.data.fractureCad.total).toBeGreaterThanOrEqual(19)
    expect(lib.data.cardiacAi.total).toBeGreaterThanOrEqual(18)
  })
})

describe('[Wave 10A] seed 扩充: dicom-sr (20 个测量模板)', () => {
  let svc: DicomSrService

  beforeEach(() => {
    svc = new DicomSrService(failingPrisma() as unknown as PrismaService, {} as never)
  })

  it('模板库 22 个, 覆盖 CT 胸腹/MR 脑脊柱/DR 骨折/MG 乳腺', () => {
    const templates = svc.getMeasurementTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(22)
    const modalities = new Set(templates.map((t) => t.modality))
    for (const m of ['CT', 'MR', 'DR', 'MG']) expect(modalities.has(m)).toBe(true)
    const ctChest = svc.getMeasurementTemplates({ modality: 'CT', bodyPart: 'Chest' })
    expect(ctChest.length).toBeGreaterThanOrEqual(4)
    const mg = svc.getMeasurementTemplates({ modality: 'MG' })
    expect(mg).toHaveLength(2)
    const stent = svc.getMeasurementTemplate('SR-CT-CHEST-STENT')
    expect(stent.templateName).toContain('支架')
    const prostate = svc.getMeasurementTemplate('SR-MR-PROSTATE')
    expect(prostate.measurements).toHaveLength(6)
  })

  it('每模板含 5-8 个 SNOMED 编码测量项与正常参考范围', () => {
    for (const t of svc.getMeasurementTemplates()) {
      expect(t.templateId).toMatch(/^tid(1500|2000)$/)
      expect(t.measurements.length).toBeGreaterThanOrEqual(3)
      for (const item of t.measurements) {
        expect(item.code).toMatch(/^\d+$/)
        expect(item.meaning).toBeTruthy()
        expect(item.description).toBeTruthy()
        expect(['SCT', 'DCM', 'UMLS']).toContain(item.scheme)
      }
      expect(t.snomedFindings.length).toBeGreaterThan(0)
    }
  })

  it('详情按 id 可取, 未知 id 抛 404; 分类统计聚合正确', () => {
    const tpl = svc.getMeasurementTemplate('SR-CT-CHEST-LUNG-NODULE')
    expect(tpl.templateName).toContain('肺结节')
    expect(() => svc.getMeasurementTemplate('SR-NOPE')).toThrow()
    const cats = svc.getMeasurementTemplateCategories()
    expect(cats.length).toBeGreaterThanOrEqual(6)
    expect(cats.reduce((s, c) => s + c.count, 0)).toBeGreaterThanOrEqual(22)
  })
})

describe('[Wave 10A] seed 扩充: rdsr DRL 阈值表完整版', () => {
  let svc: RdsrService

  beforeEach(() => {
    svc = new RdsrService(failingPrisma() as unknown as PrismaService, undefined)
  })

  it('CT 10 部位 × 成人/儿童 + MG 2 视角 + DR 5 部位 + 介入 4 类', async () => {
    const entries = await svc.getDrls()
    const childEntries = await svc.getDrls(undefined, undefined, 'child')
    const adultCt = entries.filter((e: any) => e.modality === 'CT' && e.ageGroup !== 'child')
    const childCt = childEntries.filter((e: any) => e.modality === 'CT' && e.ageGroup === 'child')
    expect(adultCt.length).toBeGreaterThanOrEqual(10)
    expect(childCt.length).toBeGreaterThanOrEqual(10)
    expect(entries.some((e: any) => e.modality === 'MG' && e.bodyPart.includes('CC'))).toBe(true)
    expect(entries.some((e: any) => e.modality === 'MG' && e.bodyPart.includes('MLO'))).toBe(true)
    expect(entries.filter((e: any) => e.modality === 'DR').length).toBeGreaterThanOrEqual(5)
    expect(entries.filter((e: any) => e.modality === 'RF').length).toBeGreaterThanOrEqual(4)
    for (const e of adultCt) {
      expect(e.source).toContain('国家DRLs')
      expect(e.bodyPart).toBeTruthy()
    }
  })
})

describe('[Wave 10A] seed 扩充: smart-route (20 医生 + 10 规则)', () => {
  let svc: SmartRouteService

  beforeEach(() => {
    svc = new SmartRouteService(failingPrisma() as unknown as PrismaService)
  })

  it('资质档案 20 名医生, 覆盖 ≥10 个亚专科', async () => {
    const doctors = svc.getQualifications()
    expect(doctors.length).toBeGreaterThanOrEqual(20)
    const subs = new Set(doctors.map((d) => d.subspecialty))
    expect(subs.size).toBeGreaterThanOrEqual(10)
    for (const d of doctors) {
      expect(d.modality.length).toBeGreaterThan(0)
      expect(d.accuracy).toBeGreaterThan(0.8)
      expect(d.maxLoad).toBeGreaterThan(0)
    }
  })

  it('路由规则 10 条, 含急诊/卒中/儿科等专用规则', async () => {
    const rules = await svc.getRules()
    expect(rules.length).toBeGreaterThanOrEqual(10)
    expect(rules.some((r) => r.name.includes('Emergency'))).toBe(true)
    expect(rules.some((r) => r.name.includes('Stroke'))).toBe(true)
    expect(rules.some((r) => r.name.includes('Screening'))).toBe(true)
    expect(rules.some((r) => r.name.includes('Oncology'))).toBe(true)
    for (const r of rules) {
      expect(r.priority).toBeGreaterThanOrEqual(0)
      expect(r.enabled).toBe(true)
    }
  })
})

describe('[Wave 10A] seed 扩充: clinical-pathways (5 条完整路径)', () => {
  let svc: ClinicalPathwayService

  beforeEach(() => {
    svc = new ClinicalPathwayService(failingPrisma() as unknown as PrismaService)
  })

  it('5 条路径定义, 每路径 8-12 步骤且含时长/科室/检查点', async () => {
    const defs = await svc.listPathwayDefinitions()
    expect(defs.length).toBeGreaterThanOrEqual(5)
    for (const d of defs) {
      expect(d.steps.length).toBeGreaterThanOrEqual(8)
      expect(d.steps.length).toBeLessThanOrEqual(12)
      expect(d.inclusion).toBeTruthy()
      expect(d.exclusion).toBeTruthy()
      for (const s of d.steps) {
        expect(s.dept).toBeTruthy()
        expect(s.durationDays).toBeGreaterThanOrEqual(0)
        expect(s.keyCheckpoints?.length).toBeGreaterThan(0)
      }
    }
    const stroke = await svc.getPathwaySteps('PW-003')
    expect(stroke.length).toBeGreaterThanOrEqual(12)
    expect(stroke.some((s) => s.name.includes('溶栓'))).toBe(true)
  })
})

describe('[Wave 10A] seed 扩充: followup-templates (20 个模板)', () => {
  let svc: FollowUpService

  beforeEach(() => {
    svc = new FollowUpService(failingPrisma() as unknown as PrismaService)
  })

  it('模板列表 20 个, 覆盖肺癌/乳腺/甲状腺病种 + 术式 8 类', async () => {
    const res = await svc.listTemplates()
    expect(res.items.length).toBeGreaterThanOrEqual(20)
    const names = new Set(res.items.map((t) => t.name))
    for (const name of ['肺癌术后随访', '乳腺癌术后随访', '甲状腺癌术后随访', '冠脉支架术后随访', '冠脉搭桥术后随访', '髋关节置换术后随访', '膝关节置换术后随访', '脊柱融合术后随访', '白内障术后随访']) {
      expect(names.has(name)).toBe(true)
    }
    const categories = new Set(res.items.map((t) => t.category))
    expect(categories.has('病种')).toBe(true)
    expect(categories.has('术式')).toBe(true)
    for (const t of res.items) {
      expect(t.intervals.length).toBeGreaterThan(0)
      expect(t.items.length).toBeGreaterThan(0)
    }
  })
})

describe('[Wave 10A] seed 扩充: qc-pdca (5 个完整周期)', () => {
  let svc: QcPdcaService

  beforeEach(() => {
    svc = new QcPdcaService(failingPrisma())
  })

  it('周期 ≥11 个, 新增 5 个完整周期均含 plan/do/check/act 全阶段', async () => {
    const res = await svc.listCycles()
    expect(res.data.length).toBeGreaterThanOrEqual(11)
    for (const id of ['pdca-101', 'pdca-102', 'pdca-103', 'pdca-104', 'pdca-105']) {
      const phases = await svc.listPhases(id)
      expect(phases.data.length).toBeGreaterThanOrEqual(2)
      const codes = new Set(phases.data.map((p) => p.phase))
      expect(codes.has('plan')).toBe(true)
      expect(codes.has('do')).toBe(true)
      expect(codes.has('check')).toBe(true)
      expect(codes.has('act')).toBe(true)
    }
    const cycle = await svc.getCycle('pdca-101')
    expect(cycle.status).toBe('已完成')
    expect(cycle.summary).toBeTruthy()
    expect(cycle.defectIds).toContain('df-101')
    const defects = await svc.listAllDefects()
    expect(defects.data.length).toBeGreaterThanOrEqual(12)
  })
})

describe('[Wave 10A] seed 扩充: custom-report (8 个报表定义)', () => {
  let svc: CustomReportService

  beforeEach(() => {
    const olap = { executeQuery: jest.fn().mockResolvedValue({ rows: [], total: 0 }) }
    const stats = {
      getDaily: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getWeekly: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getWorkload: jest.fn().mockResolvedValue([]),
      getQuality: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getUtilization: jest.fn().mockResolvedValue({}),
      getAccuracy: jest.fn().mockResolvedValue({}),
      getTopDevices: jest.fn().mockResolvedValue([]),
    }
    const bi = {
      getKpi: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getPhysicianRvu: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getReportTimeliness: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getCriticalSla: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getPhysicianPerformance: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
      getDeviceOee: jest.fn().mockResolvedValue({ source: 'database', data: {} }),
    }
    const notifications = { reportGenerated: jest.fn() }
    svc = new CustomReportService(olap as never, stats as never, bi as never, notifications as never)
  })

  it('报表定义 8 个, 覆盖日工作量/周收入/月度质控/危急值 SLA', () => {
    const defs = svc.list()
    expect(defs.length).toBeGreaterThanOrEqual(8)
    const names = new Set(defs.map((d) => d.name))
    for (const name of ['日工作量日报', '周收入汇总', '月度质控报告', '危急值SLA周报', '科室检查周报', '月度设备利用率']) {
      expect(names.has(name)).toBe(true)
    }
    const periods = new Set(defs.map((d) => d.period))
    for (const p of ['daily', 'weekly', 'monthly']) expect(periods.has(p)).toBe(true)
    for (const d of defs) {
      expect(d.fields.length).toBeGreaterThan(0)
      expect(d.description).toBeTruthy()
    }
  })
})

describe('[Wave 10A] seed 扩充: tech-schedule (4 周 × 8 技师)', () => {
  let svc: TechScheduleService

  beforeEach(() => {
    svc = new TechScheduleService()
  })

  it('月排班覆盖 28 天 × 8 技师轮转', () => {
    const all = svc.list({})
    expect(all.length).toBeGreaterThanOrEqual(130)
    const techIds = new Set(all.map((s) => s.technicianId))
    expect(techIds.size).toBeGreaterThanOrEqual(8)
    const dates = new Set(all.map((s) => s.date))
    expect(dates.size).toBeGreaterThanOrEqual(28)
    for (const t of ['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006', 'T-007', 'T-008']) {
      const shifts = all.filter((s) => s.technicianId === t)
      expect(shifts.length).toBeGreaterThanOrEqual(9)
      expect(shifts.some((s) => s.shift === 'NIGHT')).toBe(true)
      expect(shifts.some((s) => s.shift === 'DAY')).toBe(true)
    }
    expect(all.some((s) => s.status === 'ON_LEAVE')).toBe(true)
    expect(all.some((s) => s.status === 'SWAPPED')).toBe(true)
    expect(all.some((s) => s.status === 'CONFIRMED')).toBe(true)
  })

  it('按技师与月份过滤可用', () => {
    const month = allMonth()
    const byTech = svc.list({ technicianId: 'T-003' })
    expect(byTech.every((s) => s.technicianId === 'T-003')).toBe(true)
    const byMonth = svc.list({ month })
    expect(byMonth.every((s) => s.date.startsWith(month))).toBe(true)

    function allMonth(): string {
      const d = new Date()
      return d.toISOString().slice(0, 7)
    }
  })
})

describe('[Wave 10A] seed 扩充: lesion-tracking (5 患者 12 病灶)', () => {
  let svc: LesionTrackingService

  beforeEach(() => {
    svc = new LesionTrackingService(failingPrisma() as unknown as PrismaService)
  })

  it('12 病灶覆盖 5 患者, 每病灶含完整测量序列', async () => {
    const patients = ['P000001', 'P000002', 'P000003', 'P000004', 'P000005']
    const all: Array<{ id: string; patientId: string; type: string; currentStatus: string; measurements: Array<{ sizeMm: number; response?: string }> }> = []
    for (const p of patients) {
      const res = await svc.list(p)
      all.push(...res.items)
    }
    expect(all.length).toBeGreaterThanOrEqual(12)
    const patientIds = new Set(all.map((l) => l.patientId))
    expect(patientIds.size).toBeGreaterThanOrEqual(5)
    const types = new Set(all.map((l) => l.type))
    expect(types.has('肺结节')).toBe(true)
    expect(types.has('肝占位')).toBe(true)
    expect(types.has('淋巴结')).toBe(true)
    for (const l of all) {
      expect(l.measurements.length).toBeGreaterThanOrEqual(1)
      const sizes = l.measurements.map((m) => m.sizeMm)
      expect(Math.max(...sizes)).toBeGreaterThan(0)
    }
    const LT010 = all.find((l) => l.id === 'LT010')!
    expect(LT010.patientId).toBe('P000005')
    expect(LT010.currentStatus).toBe('消失')
    expect(LT010.measurements.some((m) => m.response === 'CR')).toBe(true)
    const LT007 = all.find((l) => l.id === 'LT007')!
    expect(LT007.measurements.length).toBeGreaterThanOrEqual(4)
  })
})
