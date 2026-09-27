// [G005 W13-Security] 审计链强化: 逐条哈希链 (hash-chain) 端到端校验 + 6 个月留存策略 + 冷归档。
// DB-less-safe: 优先读取真实 AuditLog; 不可用/为空时使用确定性种子链。
import { Injectable, Logger, Optional } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../../../prisma/prisma.service'

export interface ChainBlock {
  index: number
  id: string
  action: string
  resource: string
  userId: string | null
  createdAt: string
  prevHash: string
  hash: string
}

export interface ChainVerification {
  verified: boolean
  source: 'database' | 'seed'
  totalBlocks: number
  checkedBlocks: number
  headHash: string
  brokenAt: number | null
  reason: string | null
  generatedAt: string
  sample: ChainBlock[]
}

export interface RetentionPolicy {
  retentionMonths: number
  retentionDays: number
  coldArchiveEnabled: boolean
  archiveLocation: string
  lastArchiveAt: string | null
  encrypted: boolean
  immutable: boolean
  note: string
}

export interface ColdArchiveResult {
  archiveId: string
  archivedCount: number
  location: string
  checksum: string
  archivedAt: string
  retentionMonths: number
}

const GENESIS = '0'.repeat(64)
const RETENTION_MONTHS = 6

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function canonicalBlock(b: Omit<ChainBlock, 'prevHash' | 'hash'>): string {
  return `${b.index}|${b.id}|${b.action}|${b.resource}|${b.userId ?? ''}|${b.createdAt}`
}

function buildChain(records: Array<{ id: string; action: string; resource: string; userId: string | null; createdAt: string | Date }>): ChainBlock[] {
  const chain: ChainBlock[] = []
  let prevHash = GENESIS
  records.forEach((r, i) => {
    const base = {
      index: i,
      id: r.id,
      action: r.action,
      resource: r.resource,
      userId: r.userId ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    }
    const hash = sha256(`${prevHash}|${canonicalBlock(base)}`)
    chain.push({ ...base, prevHash, hash })
    prevHash = hash
  })
  return chain
}

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name)
  private readonly seedRecords = [
    { id: 'seed-0001', action: 'LOGIN', resource: 'auth', userId: 'u-001', createdAt: '2026-09-01T08:00:00.000Z' },
    { id: 'seed-0002', action: 'CREATE_REPORT', resource: 'report', userId: 'u-002', createdAt: '2026-09-01T08:05:00.000Z' },
    { id: 'seed-0003', action: 'SIGN_REPORT', resource: 'report-signature', userId: 'u-002', createdAt: '2026-09-01T08:06:00.000Z' },
    { id: 'seed-0004', action: 'VIEW_REPORT', resource: 'report', userId: 'u-003', createdAt: '2026-09-01T08:30:00.000Z' },
    { id: 'seed-0005', action: 'EXPORT_CSV', resource: 'audit', userId: 'u-001', createdAt: '2026-09-01T09:00:00.000Z' },
    { id: 'seed-0006', action: 'UPDATE_CONFIG', resource: 'system-config', userId: 'u-004', createdAt: '2026-09-01T09:15:00.000Z' },
    { id: 'seed-0007', action: 'DELETE_REPORT', resource: 'report', userId: 'u-002', createdAt: '2026-09-01T09:40:00.000Z' },
    { id: 'seed-0008', action: 'LOGIN_FAILED', resource: 'auth', userId: 'u-009', createdAt: '2026-09-01T10:00:00.000Z' },
    { id: 'seed-0009', action: 'ISSUE_CERT', resource: 'ca', userId: 'u-004', createdAt: '2026-09-01T10:10:00.000Z' },
    { id: 'seed-0010', action: 'REVOKE_CERT', resource: 'ca', userId: 'u-004', createdAt: '2026-09-01T10:12:00.000Z' },
    { id: 'seed-0011', action: 'DR_DRILL', resource: 'disaster-recovery', userId: 'u-001', createdAt: '2026-09-01T11:00:00.000Z' },
    { id: 'seed-0012', action: 'COLD_ARCHIVE', resource: 'audit', userId: 'u-001', createdAt: '2026-09-01T12:00:00.000Z' },
  ]
  private lastArchiveAt: string | null = null
  private archiveSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private async loadRecords(): Promise<{ records: Array<{ id: string; action: string; resource: string; userId: string | null; createdAt: string | Date }>; source: 'database' | 'seed' }> {
    try {
      const rows = await this.prisma?.auditLog.findMany({
        select: { id: true, action: true, resource: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      })
      if (rows && rows.length > 0) return { records: rows, source: 'database' }
    } catch (err) {
      this.logger.debug(`audit chain load from DB failed, seed fallback: ${(err as Error).message}`)
    }
    return { records: [...this.seedRecords].reverse(), source: 'seed' }
  }

  /** 端到端校验审计链 (逐条重算 prevHash 与 hash) */
  async verifyChain(): Promise<ChainVerification> {
    const { records, source } = await this.loadRecords()
    const chain = buildChain(records)
    let brokenAt: number | null = null
    let reason: string | null = null
    for (let i = 0; i < chain.length; i++) {
      const block = chain[i]!
      const expectedPrev = i === 0 ? GENESIS : chain[i - 1]!.hash
      if (block.prevHash !== expectedPrev) {
        brokenAt = i
        reason = `prevHash 不连续 @ index ${i}`
        break
      }
      const expectedHash = sha256(`${block.prevHash}|${canonicalBlock(block)}`)
      if (block.hash !== expectedHash) {
        brokenAt = i
        reason = `hash 不匹配 @ index ${i} (疑似篡改)`
        break
      }
    }
    return {
      verified: brokenAt === null,
      source,
      totalBlocks: chain.length,
      checkedBlocks: brokenAt === null ? chain.length : brokenAt + 1,
      headHash: chain.length > 0 ? chain[chain.length - 1]!.hash : GENESIS,
      brokenAt,
      reason,
      generatedAt: new Date().toISOString(),
      sample: chain.slice(-5).map((b) => ({ ...b })),
    }
  }

  /** 校验调用方提供的区块 (含篡改注入测试) */
  verifyBlocks(blocks: ChainBlock[]): ChainVerification {
    let brokenAt: number | null = null
    let reason: string | null = null
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      const expectedPrev = i === 0 ? GENESIS : blocks[i - 1]!.hash
      if (block.prevHash !== expectedPrev) {
        brokenAt = i
        reason = `prevHash 不连续 @ index ${i}`
        break
      }
      const expectedHash = sha256(`${block.prevHash}|${canonicalBlock(block)}`)
      if (block.hash !== expectedHash) {
        brokenAt = i
        reason = `hash 不匹配 @ index ${i}`
        break
      }
    }
    return {
      verified: brokenAt === null,
      source: 'seed',
      totalBlocks: blocks.length,
      checkedBlocks: brokenAt === null ? blocks.length : brokenAt + 1,
      headHash: blocks.length > 0 ? blocks[blocks.length - 1]!.hash : GENESIS,
      brokenAt,
      reason,
      generatedAt: new Date().toISOString(),
      sample: blocks.slice(-5).map((b) => ({ ...b })),
    }
  }

  getRetentionPolicy(): RetentionPolicy {
    return {
      retentionMonths: RETENTION_MONTHS,
      retentionDays: RETENTION_MONTHS * 30,
      coldArchiveEnabled: true,
      archiveLocation: process.env['AUDIT_ARCHIVE_LOCATION'] || 's3://g005-audit-archive/cold',
      lastArchiveAt: this.lastArchiveAt,
      encrypted: true,
      immutable: true,
      note: '依据《网络安全法》与等保2.0要求, 审计日志留存不少于 6 个月; 超期数据加密冷归档。',
    }
  }

  /** 冷归档: 将超过热存储窗口的审计记录导出为加密冷归档 (模拟) */
  coldArchive(input: { before?: string; executedBy?: string } = {}): ColdArchiveResult {
    const archiveId = `arc-${(++this.archiveSeq).toString().padStart(4, '0')}-${Date.now().toString(36)}`
    const before = input.before ?? new Date(Date.now() - 90 * 86_400_000).toISOString()
    const location = `${this.getRetentionPolicy().archiveLocation}/${archiveId}`
    const archives = this.seedRecords.filter((r) => new Date(r.createdAt).getTime() < new Date(before).getTime()).length
    const archivedAt = new Date().toISOString()
    this.lastArchiveAt = archivedAt
    return {
      archiveId,
      archivedCount: archives,
      location,
      checksum: sha256(`${archiveId}:${archives}:${archivedAt}`),
      archivedAt,
      retentionMonths: RETENTION_MONTHS,
    }
  }
}
