/**
 * [G005 v3.0.6.11-86 Wave 4B (G-03 / G-05)] DICOM DIMSE TLS 配置 + MPPS spec
 * - TLS 配置: 内存 + seed 回退, GET/PUT 语义
 * - MPPS: 内存记录 + Exam 派生回退
 * [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列 spec
 * - 内存 + seed, 入队/重试/暂停/恢复/取消/统计 状态机
 * [G005 v3.0.6.11-96 Wave 2B (B/D)] MPPS 落库 (Prisma 优先, DB 不可用回退内存) + 传输关联检查 (examId/accessionNumber)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DicomDimseService, type DicomTlsConfig } from './dicom-dimse.service'

const makeConfig = (env: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback),
  }) as never as ConfigService

const makePrisma = (exam?: unknown, mppsRecord?: unknown) =>
  ({
    exam: {
      findUnique: jest.fn().mockResolvedValue(exam ?? null),
    },
    ...(mppsRecord ? { mppsRecord } : {}),
  }) as never

describe('DicomDimseService TLS (G-03)', () => {
  it('getTlsConfig 回退 seed: DIMSE_TLS_ENABLED/PORT/VERIFY_PEER', () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({
      DIMSE_TLS_ENABLED: 'true',
      DIMSE_TLS_PORT: '2762',
      DIMSE_TLS_VERIFY_PEER: 'true',
    }), undefined)
    const cfg = service.getTlsConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.port).toBe(2762)
    expect(cfg.verifyPeer).toBe(true)
  })

  it('updateTlsConfig 合并更新并保留未传字段', () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({}), undefined)
    service.updateTlsConfig({ enabled: true, port: 2763 })
    const cfg = service.getTlsConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.port).toBe(2763)
  })

  it('updateTlsConfig 空串证书视为清理', () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({ DIMSE_TLS_CERT: 'seed-cert' }), undefined)
    const cfg: DicomTlsConfig = service.updateTlsConfig({ certificate: '' })
    expect(cfg.certificate).toBeUndefined()
  })

  it('节点级 TLS 开关 GET/PUT (内存)', () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({}), undefined)
    expect(service.getNodeTls('CT_SCANNER_01').tlsEnabled).toBe(false)
    const updated = service.setNodeTls('CT_SCANNER_01', true)
    expect(updated.tlsEnabled).toBe(true)
    expect(service.getNodeTls('CT_SCANNER_01').tlsEnabled).toBe(true)
  })

  it('节点级 TLS seed 从 DIMSE_NODE_TLS 解析', () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({
      DIMSE_NODE_TLS: 'CT_SCANNER_01=true;MR_SCANNER_02=false',
    }), undefined)
    expect(service.getNodeTls('CT_SCANNER_01').tlsEnabled).toBe(true)
    expect(service.getNodeTls('MR_SCANNER_02').tlsEnabled).toBe(false)
  })
})

describe('DicomDimseService MPPS (G-05)', () => {
  it('N-CREATE IN_PROGRESS 记录并返回 startedAt', async () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({}), undefined)
    const rec = await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'IN_PROGRESS', performedSteps: [{ code: '1.2.3', description: '开始检查' }] })
    expect(rec.status).toBe('IN_PROGRESS')
    expect(rec.startedAt).toBeDefined()
    expect(rec.performedSteps).toHaveLength(1)
    expect(await service.listMpps()).toHaveLength(1)
  })

  it('N-SET COMPLETED 更新同 study 记录并写 completedAt', async () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({}), undefined)
    await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'IN_PROGRESS' })
    const done = await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'COMPLETED' })
    expect(done.completedAt).toBeDefined()
    expect(await service.listMpps()).toHaveLength(1)
  })

  it('无内存记录时从 Exam 派生回退 (studyUid = exam.id)', async () => {
    const service = new DicomDimseService(
      makePrisma({ id: 'EX1', patientId: 'P1', modality: 'CT', patient: { name: '张明远' } }),
      makeConfig({}),
      undefined,
    )
    const rec = await service.createOrUpdateMpps({ studyUid: 'EX1', status: 'IN_PROGRESS' })
    expect(rec.source).toBe('exam')
    expect(rec.patientName).toBe('张明远')
    expect(rec.modality).toBe('CT')
  })

  it('无内存记录且 Exam 不存在 → source=mpps 空派生', async () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const rec = await service.createOrUpdateMpps({ studyUid: 'UNKNOWN', status: 'DISCONTINUED' })
    expect(rec.source).toBe('mpps')
    expect(rec.status).toBe('DISCONTINUED')
  })

  // [G005 v3.0.6.11-96 Wave 2B (B)] MPPS 落库: Prisma 优先, DB 不可用回退内存
  it('N-CREATE 经 Prisma upsert 落库并返回 DB 行映射', async () => {
    const upsert = jest.fn().mockResolvedValue({
      studyUid: 'ST-DB',
      status: 'IN_PROGRESS',
      patientName: '张明远',
      patientId: 'P1',
      modality: 'CT',
      startedAt: new Date('2026-08-10T01:00:00.000Z'),
      completedAt: null,
      steps: [{ code: '1.2.3', description: '开始检查' }],
      source: 'exam',
      updatedAt: new Date('2026-08-10T01:00:00.000Z'),
    })
    const service = new DicomDimseService(
      makePrisma({ id: 'ST-DB', patientId: 'P1', modality: 'CT', patient: { name: '张明远' } }, { upsert }),
      makeConfig({}),
      undefined,
    )
    const rec = await service.createOrUpdateMpps({ studyUid: 'ST-DB', status: 'IN_PROGRESS', performedSteps: [{ code: '1.2.3', description: '开始检查' }] })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { studyUid: 'ST-DB' },
      create: expect.objectContaining({ studyUid: 'ST-DB', status: 'IN_PROGRESS', steps: expect.any(Array) }),
    }))
    expect(rec.studyUid).toBe('ST-DB')
    expect(rec.source).toBe('exam')
    expect(rec.patientName).toBe('张明远')
  })

  it('N-SET COMPLETED 更新 DB 行 (upsert update 分支写 completedAt)', async () => {
    const upsert = jest.fn().mockResolvedValue({
      studyUid: 'ST1',
      status: 'COMPLETED',
      steps: [],
      source: 'mpps',
      updatedAt: new Date(),
    })
    const service = new DicomDimseService(makePrisma(null, { upsert }), makeConfig({}), undefined)
    const rec = await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'COMPLETED' })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
    }))
    expect(rec.status).toBe('COMPLETED')
  })

  it('DB upsert 抛错时回退内存 Map (不阻塞上报)', async () => {
    const upsert = jest.fn().mockRejectedValue(new Error('relation mpps_records does not exist'))
    const service = new DicomDimseService(makePrisma(null, { upsert }), makeConfig({}), undefined)
    const rec = await service.createOrUpdateMpps({ studyUid: 'ST-FB', status: 'IN_PROGRESS' })
    expect(rec.status).toBe('IN_PROGRESS')
    expect(await service.listMpps()).toHaveLength(1)
  })

  it('listMpps 优先读 DB (有行时返回 DB 数据)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { studyUid: 'ST-DB', status: 'COMPLETED', steps: [], source: 'mpps', updatedAt: new Date('2026-08-10T02:00:00.000Z') },
    ])
    const service = new DicomDimseService(makePrisma(null, { findMany }), makeConfig({}), undefined)
    const list = await service.listMpps()
    expect(list).toHaveLength(1)
    expect(list[0]?.studyUid).toBe('ST-DB')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { updatedAt: 'desc' } }))
  })

  it('listMpps: DB 查询失败回退内存记录', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('no db'))
    const service = new DicomDimseService(makePrisma(null, { findMany }), makeConfig({}), undefined)
    await service.createOrUpdateMpps({ studyUid: 'MEM-1', status: 'IN_PROGRESS' })
    const list = await service.listMpps()
    expect(list).toHaveLength(1)
    expect(list[0]?.studyUid).toBe('MEM-1')
  })
})

describe('DicomDimseService 传输队列 (PACS P0-1)', () => {
  it('构造时 seed 回退: 默认 4 条样例 (sending/queued/completed/failed)', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const list = service.listTransfers()
    expect(list.length).toBe(4)
    expect(list.some((t) => t.status === 'sending')).toBe(true)
    expect(list.some((t) => t.status === 'completed' && t.progress === 100)).toBe(true)
    expect(list.some((t) => t.source === 'seed')).toBe(true)
  })

  it('DIMSE_TRANSFER_SEED 环境 seed 覆盖默认样例', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({
      DIMSE_TRANSFER_SEED: 'ST1,PACS_A,queued,0|ST2,PACS_B,failed,20',
    }), undefined)
    const list = service.listTransfers()
    expect(list.length).toBe(2)
    expect(list.find((t) => t.studyUid === 'ST2')?.status).toBe('failed')
  })

  it('enqueueTransfer 入队: queued + 递增 id + 目标 AE', async () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const record = await service.enqueueTransfer({ studyUid: '1.2.3.4', targetAe: 'PACS_ARCHIVE' })
    expect(record.status).toBe('queued')
    expect(record.progress).toBe(0)
    expect(record.targetAe).toBe('PACS_ARCHIVE')
    expect(service.listTransfers()).toHaveLength(5)
  })

  // [G005 v3.0.6.11-96 Wave 2B (D)] C-STORE ↔ worklist 联动: 入队关联检查
  it('enqueueTransfer: 显式 examId/accessionNumber 写入记录 (worklist 联动)', async () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const record = await service.enqueueTransfer({ studyUid: '1.2.3.4', targetAe: 'PACS_ARCHIVE', examId: 'E1', accessionNumber: 'ACC-001' })
    expect(record.examId).toBe('E1')
    expect(record.accessionNumber).toBe('ACC-001')
  })

  it('enqueueTransfer: 未传 examId 时从 studyUid 反查检查并回填', async () => {
    const service = new DicomDimseService(
      makePrisma({ id: 'EX1', accessionNumber: 'ACC-EX1' }),
      makeConfig({}),
      undefined,
    )
    const record = await service.enqueueTransfer({ studyUid: '1.2.840.10008.EX1', targetAe: 'PACS_ARCHIVE' })
    expect(record.examId).toBe('EX1')
    expect(record.accessionNumber).toBe('ACC-EX1')
  })

  it('enqueueTransfer: 反查不到检查时 examId 为空 (不阻断入队)', async () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const record = await service.enqueueTransfer({ studyUid: '1.2.3.4', targetAe: 'PACS_ARCHIVE' })
    expect(record.examId).toBeUndefined()
    expect(record.status).toBe('queued')
  })

  it('retryTransfer: failed → sending 且进度清零', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const failed = service.listTransfers().find((t) => t.status === 'failed')!
    const retried = service.retryTransfer(failed.id)
    expect(retried.status).toBe('sending')
    expect(retried.progress).toBe(0)
    expect(retried.error).toBeUndefined()
  })

  it('retryTransfer: sending 中不可重试 (BadRequest)', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const sending = service.listTransfers().find((t) => t.status === 'sending')!
    expect(() => service.retryTransfer(sending.id)).toThrow(BadRequestException)
  })

  it('pause/resume 状态机: queued → paused → sending', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const queued = service.listTransfers().find((t) => t.status === 'queued')!
    expect(service.pauseTransfer(queued.id).status).toBe('paused')
    expect(service.resumeTransfer(queued.id).status).toBe('sending')
  })

  it('pause: completed 任务不可暂停 (BadRequest)', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const done = service.listTransfers().find((t) => t.status === 'completed')!
    expect(() => service.pauseTransfer(done.id)).toThrow(BadRequestException)
  })

  it('cancelTransfer: sending → canceled, completed 不可取消', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const sending = service.listTransfers().find((t) => t.status === 'sending')!
    expect(service.cancelTransfer(sending.id).status).toBe('canceled')
    const done = service.listTransfers().find((t) => t.status === 'completed')!
    expect(() => service.cancelTransfer(done.id)).toThrow(BadRequestException)
  })

  it('未知 id 抛 NotFound', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    expect(() => service.retryTransfer('TR-NOPE')).toThrow(NotFoundException)
  })

  it('getTransferStats: 各状态计数 + 成功率 + 平均进度', () => {
    const service = new DicomDimseService(makePrisma(null), makeConfig({}), undefined)
    const stats = service.getTransferStats()
    expect(stats.total).toBe(4)
    expect(stats.completed).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.successRate).toBe(50)
    expect(stats.avgProgress).toBeGreaterThanOrEqual(0)
  })
})
