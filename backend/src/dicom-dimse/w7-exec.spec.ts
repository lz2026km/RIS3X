/**
 * [G005 W7-Exec] 检查执行专业深化 spec
 * - MWL C-FIND SCP: worklist-items 查询 + query dataset (Exam/Appointment seed + DB 回退)
 * - MPPS ↔ accession 关联 + worklist 状态联动
 * - 扫描协议/序列/曝光参数 + expectedImages 校验
 * - 序列级 QC (与检查级重拍区分但联动 retakeCount)
 * - RDSR 剂量回写 (DLP/CTDIvol/SSDE)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MwlService } from './mwl.service'
import { TechExecutionService } from './tech-execution.service'
import { DicomDimseService } from './dicom-dimse.service'
import { ConfigService } from '@nestjs/config'
import { DoseWritebackSchema } from './dto'

const makeConfig = (env: Record<string, string> = {}) =>
  ({ get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback) }) as never as ConfigService

const examRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'EX1',
  accessionNumber: 'ACC-EX1',
  patientId: 'P1',
  modality: 'CT',
  bodyPart: 'CHEST',
  state: 'IN_PROGRESS',
  priority: 'ROUTINE',
  scheduledAt: new Date('2026-09-26T09:00:00.000Z'),
  deviceId: 'DEV1',
  patient: { name: '张明远' },
  device: { name: 'CT-01', aeTitle: 'CT_SCANNER_01' },
  retakeCount: 0,
  qcNotes: '',
  ...overrides,
})

describe('MwlService (MWL C-FIND SCP)', () => {
  it('DB 不可用时回退确定性 seed 工作列表项', async () => {
    const prisma = { exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new MwlService(prisma)
    const res = await svc.listWorklistItems()
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.source).toBe('seed')
    const first = res.items[0]!
    expect(first.accessionNumber).toBeTruthy()
    expect(first.patientName).toBeTruthy()
    expect(first.scheduledStationAeTitle).toBeTruthy()
    expect(typeof first.contrast).toBe('boolean')
  })

  it('按 modality / stationAE / patientName / date 过滤', async () => {
    const prisma = { exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new MwlService(prisma)
    const mr = await svc.listWorklistItems({ modality: 'MR' })
    expect(mr.items.every((i) => i.modality === 'MR')).toBe(true)
    const station = await svc.listWorklistItems({ stationAE: 'CT_SCANNER_01' })
    expect(station.items.every((i) => i.scheduledStationAeTitle === 'CT_SCANNER_01')).toBe(true)
    const byName = await svc.listWorklistItems({ patientName: '张' })
    expect(byName.items.every((i) => i.patientName.includes('张'))).toBe(true)
    const today = new Date()
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const byDate = await svc.listWorklistItems({ date: dateKey })
    expect(byDate.items.every((i) => i.scheduledDate === dateKey)).toBe(true)
  })

  it('DB 有数据时返回 DB 派生条目 (source=db)', async () => {
    const prisma = { exam: { findMany: jest.fn().mockResolvedValue([examRow()]) } } as never
    const svc = new MwlService(prisma)
    const res = await svc.listWorklistItems({ modality: 'CT' })
    expect(res.source).toBe('db')
    expect(res.items[0]!.accessionNumber).toBe('ACC-EX1')
    expect(res.items[0]!.studyInstanceUid).toContain('EX1')
    expect(res.items[0]!.scheduledStationAeTitle).toBe('CT_SCANNER_01')
  })

  it('query 返回 C-FIND JSON dataset 形状 (scheduledProcedureStepSequence)', async () => {
    const prisma = { exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new MwlService(prisma)
    const res = await svc.query({ modality: 'CT' })
    expect(res.queryRetrieveLevel).toBe('WORKLIST')
    expect(res.sopClassUid).toBe('1.2.840.10008.5.1.4.31')
    expect(res.matches).toBe(res.dataset.length)
    const ds = res.dataset[0] as any
    expect(Array.isArray(ds.scheduledProcedureStepSequence)).toBe(true)
    expect(ds.scheduledProcedureStepSequence[0].scheduledStationAeTitle).toBeTruthy()
    expect(ds.accessionNumber).toBeTruthy()
  })

  it('MPPS 完成后联动 MWL 工作列表项状态', async () => {
    const prisma = { exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new MwlService(prisma)
    svc.applyMppsStatus({ studyUid: 'ST1', accessionNumber: 'AC-EXEC-001', status: 'COMPLETED' })
    const res = await svc.listWorklistItems({ accessionNumber: 'AC-EXEC-001' })
    expect(res.items[0]!.state).toBe('COMPLETED')
    expect(res.items[0]!.mppsStatus).toBe('COMPLETED')
    expect(svc.getWorklistState('AC-EXEC-001')).toBe('COMPLETED')
  })
})

describe('TechExecutionService (协议 / 序列 / QC / 剂量)', () => {
  const makePrisma = (opts: { exam?: unknown; update?: jest.Mock; dose?: Record<string, jest.Mock> } = {}) =>
    ({
      exam: {
        findUnique: jest.fn().mockResolvedValue(opts.exam === undefined ? examRow() : opts.exam),
        update: opts.update ?? jest.fn().mockResolvedValue({}),
      },
      ...(opts.dose ? { doseRecord: opts.dose } : {}),
    }) as never

  it('协议列表 seed + 新建 + 详情 + 不存在 NotFound', () => {
    const svc = new TechExecutionService(makePrisma())
    const list = svc.listProtocols()
    expect(list.total).toBeGreaterThanOrEqual(7)
    const created = svc.createProtocol({ code: 'CT_TEST', name: '测试协议', modality: 'CT', bodyPart: 'CHEST', expectedImages: 100 })
    expect(created.id).toMatch(/^PRT-/)
    expect(svc.getProtocol(created.id).code).toBe('CT_TEST')
    expect(() => svc.getProtocol('PRT-NOPE')).toThrow(NotFoundException)
  })

  it('设置检查协议: protocolId 派生 expectedImages/exposureParams/scanRange', async () => {
    const svc = new TechExecutionService(makePrisma())
    const state = await svc.setExamProtocol('EX1', { protocolId: 'PRT-0001' })
    expect(state.expectedImages).toBe(180)
    expect(state.exposureParams?.kVp).toBe(120)
    expect(state.scanRange?.orientation).toBe('axial')
    expect(state.contrastProtocolId).toBe('CP-IOHEXOL-350')
  })

  it('expectedImages 与已采集序列匹配校验 (一致匹配 / 不一致告警)', async () => {
    const svc = new TechExecutionService(makePrisma())
    await svc.setExamProtocol('EX1', { protocolId: 'PRT-0001' })
    await svc.registerSeries('EX1', { seriesNumber: 1, imageCount: 100 })
    await svc.registerSeries('EX1', { seriesNumber: 2, imageCount: 80 })
    let summary = await svc.getExamProtocol('EX1')
    expect(summary.validation.matches).toBe(true)
    expect(summary.validation.imageCountMismatch).toBe(false)
    expect(summary.validation.capturedImages).toBe(180)

    await svc.registerSeries('EX1', { seriesNumber: 3, imageCount: 10 })
    summary = await svc.getExamProtocol('EX1')
    expect(summary.validation.matches).toBe(false)
    expect(summary.validation.imageCountMismatch).toBe(true)
    expect(summary.validation.delta).toBe(10)
    expect(summary.validation.message).toContain('不一致')
  })

  it('序列级 QC REJECT 递增 retakeCount 并与检查级重拍区分', async () => {
    const update = jest.fn().mockResolvedValue({})
    const svc = new TechExecutionService(makePrisma({ update }))
    await svc.registerSeries('EX1', { seriesNumber: 1, imageCount: 100 })
    const res = await svc.submitSeriesQc('EX1', {
      items: [
        { seriesNumber: 1, quality: 'REJECT', reason: 'motion_artifact' },
        { seriesNumber: 1, quality: 'PASS' },
      ],
      scoredBy: 'TECH1',
    })
    expect(res.retakeTriggered).toBe(true)
    expect(res.retakeCount).toBe(1)
    expect(res.records).toHaveLength(2)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'EX1' } }))
    const qc = svc.listSeriesQc('EX1')
    expect(qc.some((q) => q.quality === 'REJECT')).toBe(true)
  })

  it('序列级 QC 全部 PASS 不触发重拍', async () => {
    const svc = new TechExecutionService(makePrisma({ update: jest.fn().mockResolvedValue({}) }))
    const res = await svc.submitSeriesQc('EX1', { items: [{ seriesNumber: 1, quality: 'PASS', score: 95 }] })
    expect(res.retakeTriggered).toBe(false)
    expect(res.retakeCount).toBe(0)
  })

  it('RDSR 剂量回写: DLP/CTDIvol/SSDE 落库并读回', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'DOSE-DB-1' })
    const findFirst = jest.fn().mockResolvedValue(null)
    const svc = new TechExecutionService(makePrisma({ dose: { findFirst, create, update: jest.fn() } }))
    const rec = await svc.writeDose('EX1', { rdsr: { ctdivol: 12.5, dlp: 320.4, ssde: 15.2, bodyPart: 'CHEST' }, source: 'RDSR' })
    expect(rec.ctdiVol).toBe(12.5)
    expect(rec.dlp).toBe(320.4)
    expect(rec.ssde).toBe(15.2)
    expect(create).toHaveBeenCalled()
    expect(rec.bodyPart).toBe('CHEST')
  })

  it('剂量 DB 不可用时回退内存并可读回', async () => {
    const findFirst = jest.fn().mockRejectedValue(new Error('relation dose_records does not exist'))
    const svc = new TechExecutionService(makePrisma({ dose: { findFirst, create: jest.fn(), update: jest.fn() } }))
    const rec = await svc.writeDose('EX1', { dlp: 100, ctdivol: 5 })
    expect(rec.dlp).toBe(100)
    const read = await svc.getDose('EX1')
    expect(read?.ctdiVol).toBe(5)
  })

  it('剂量 schema: 缺 ctdivol/dlp 校验失败', () => {
    expect(DoseWritebackSchema.safeParse({ ssde: 12 }).success).toBe(false)
    expect(DoseWritebackSchema.safeParse({ dlp: 100 }).success).toBe(true)
  })

  it('validateExpectedImages: 输入非法抛 BadRequest', () => {
    const svc = new TechExecutionService(makePrisma())
    expect(() => svc.validateExpectedImages(0, 10)).toThrow(BadRequestException)
    expect(svc.validateExpectedImages(10, 10).matches).toBe(true)
    expect(svc.validateExpectedImages(10, 12).imageCountMismatch).toBe(true)
  })
})

describe('DicomDimseService MPPS ↔ accession 关联', () => {
  it('N-CREATE 携带 accessionNumber/requestedProcedureId 并可经 accession 反查', async () => {
    const prisma = {
      exam: { findUnique: jest.fn().mockResolvedValue(examRow()) },
    } as never
    const svc = new DicomDimseService(prisma, makeConfig({}), undefined)
    const rec = await svc.createOrUpdateMpps({
      studyUid: 'ST-LINK',
      status: 'IN_PROGRESS',
      accessionNumber: 'ACC-EX1',
      requestedProcedureId: 'RP-ACC-EX1',
      examId: 'EX1',
    })
    expect(rec.accessionNumber).toBe('ACC-EX1')
    expect(rec.requestedProcedureId).toBe('RP-ACC-EX1')
    const byAcc = await svc.getMppsByAccession('ACC-EX1')
    expect(byAcc.examId).toBe('EX1')
    expect(byAcc.items).toHaveLength(1)
    expect(byAcc.items[0]!.studyUid).toBe('ST-LINK')
    expect(byAcc.total).toBe(1)
  })

  it('MPPS 完成时联动注入的 MwlService 状态', async () => {
    const prisma = {
      exam: { findUnique: jest.fn().mockResolvedValue(examRow()), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    } as never
    const mwl = new MwlService(prisma)
    const svc = new DicomDimseService(prisma, makeConfig({}), undefined, mwl)
    await svc.createOrUpdateMpps({ studyUid: 'ST1', status: 'COMPLETED', accessionNumber: 'AC-EXEC-001' })
    const list = await mwl.listWorklistItems({ accessionNumber: 'AC-EXEC-001' })
    expect(list.items[0]!.state).toBe('COMPLETED')
    expect((await svc.getMppsByAccession('AC-EXEC-001')).mwlState).toBe('COMPLETED')
  })
})