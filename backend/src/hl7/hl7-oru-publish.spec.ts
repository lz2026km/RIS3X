/**
 * [G005 v3.0.6.13] 报告发布 → HIS ORU^R01 spec
 * 覆盖: build+send(stub) / ACK 记录 / 消息日志 / 重发
 */
import { NotFoundException } from '@nestjs/common'
import { Hl7Service } from './hl7.service'

const makeSystemConfig = () => ({
  getString: jest.fn(async (_key: string, fallback: string) => fallback),
  getNumber: jest.fn(async (_key: string, fb: number) => fb),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const makePrisma = () => {
  const archives: any[] = []
  return {
    archives,
    report: {
      findUnique: jest.fn(async () => ({
        id: 'R-ORU-1',
        patientId: 'P1',
        examId: 'E1',
        findings: '右上肺斑片影',
        conclusion: '炎症可能',
        impression: '炎症',
        authorName: '李医生',
        authorId: 'U1',
        patient: { name: '张三', gender: 'MALE', birthDate: new Date('1980-01-01') },
        exam: { id: 'E1', accessionNumber: 'ACC-1', modality: 'CT', startedAt: new Date('2026-08-01T06:30:00Z') },
      })),
    },
    exam: { findUnique: jest.fn(async () => null) },
    hl7MessageArchive: {
      create: jest.fn(async ({ data }: any) => {
        archives.push(data)
        return data
      }),
    },
  }
}

const makeService = () => {
  const prisma = makePrisma()
  const svc = new Hl7Service(prisma as never, makeSystemConfig())
  return { svc, prisma }
}

describe('Hl7Service ORU publish → HIS (stub)', () => {
  it('publishOruByReportId: 组装 ORU^R01 + stub ACK AA + 归档', async () => {
    const { svc, prisma } = makeService()
    const rec = await svc.publishOruByReportId('R-ORU-1')
    expect(rec.messageType).toBe('ORU^R01')
    expect(rec.status).toBe('STUBBED')
    expect(rec.ackStatus).toBe('AA')
    expect(rec.mode).toBe('STUB')
    expect(rec.message).toContain('ORU^R01')
    expect(rec.message).not.toContain('MSA')
    expect(prisma.archives.length).toBe(1)
    expect(prisma.archives[0].ackStatus).toBe('AA')
  })

  it('listOruMessages 记录并可过滤报告', async () => {
    const { svc } = makeService()
    await svc.publishOruByReportId('R-ORU-1')
    const all = svc.listOruMessages()
    expect(all.total).toBe(1)
    expect(all.entries[0]!.reportId).toBe('R-ORU-1')
    expect(svc.listOruMessages({ reportId: 'NOPE' }).total).toBe(0)
  })

  it('resendOru: 重发同一条消息, attempts 递增', async () => {
    const { svc } = makeService()
    const rec = await svc.publishOruByReportId('R-ORU-1')
    const resent = await svc.resendOru(rec.id)
    expect(resent.attempts).toBe(2)
    expect(resent.ackStatus).toBe('AA')
    expect(resent.status).toBe('STUBBED')
  })

  it('resendOru: 不存在 → NotFound', async () => {
    const { svc } = makeService()
    await expect(svc.resendOru('missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('publishOruByReportId: 报告不存在 → NotFound', async () => {
    const prisma = makePrisma()
    prisma.report.findUnique = jest.fn(async () => null) as never
    const svc = new Hl7Service(prisma as never, makeSystemConfig())
    await expect(svc.publishOruByReportId('missing')).rejects.toBeInstanceOf(NotFoundException)
  })
})
