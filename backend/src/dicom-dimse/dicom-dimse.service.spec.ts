/**
 * [G005 v3.0.6.11-86 Wave 4B (G-03 / G-05)] DICOM DIMSE TLS 配置 + MPPS spec
 * - TLS 配置: 内存 + seed 回退, GET/PUT 语义
 * - MPPS: 内存记录 + Exam 派生回退
 */
import { ConfigService } from '@nestjs/config'
import { DicomDimseService, type DicomTlsConfig } from './dicom-dimse.service'

const makeConfig = (env: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback),
  }) as never as ConfigService

const makePrisma = (exam?: unknown) =>
  ({
    exam: {
      findUnique: jest.fn().mockResolvedValue(exam ?? null),
    },
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
    expect(service.listMpps()).toHaveLength(1)
  })

  it('N-SET COMPLETED 更新同 study 记录并写 completedAt', async () => {
    const service = new DicomDimseService(makePrisma(), makeConfig({}), undefined)
    await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'IN_PROGRESS' })
    const done = await service.createOrUpdateMpps({ studyUid: 'ST1', status: 'COMPLETED' })
    expect(done.completedAt).toBeDefined()
    expect(service.listMpps()).toHaveLength(1)
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
})
