/**
 * G005 RIS v3.0.6.11-60 - VNA 厂商中立归档服务 (Vendor Neutral Archive 基础版)
 * 对标 Agfa Enterprise Imaging / Sectra VNA / GE Datalogue
 * 职责: 非 DICOM 内容归档 (document/image) + WORM 不可变锁定 + DICOM 检查统一视图
 * 存储: 本地目录 (backend/vna-storage/) 或 S3/MinIO (StorageDriver 抽象, STORAGE_DRIVER=s3);
 *       元数据 Prisma 持久化, DB 不可用时回退内存 Map
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, Inject } from '@nestjs/common'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { STORAGE_DRIVER } from '../../common/storage/storage.module'
import { LocalStorageDriver } from '../../common/storage/local-storage.driver'
import type { StorageDriver } from '../../common/storage/storage.interface'

export type VnaObjectType = 'document' | 'image'

export interface VnaObjectDto {
  id: string
  patientId: string | null
  studyUid: string | null
  objectType: VnaObjectType
  name: string
  description: string
  mimeType: string
  size: number
  storagePath: string | null
  wormLocked: boolean
  createdAt: string
  storageSource: 'database' | 'memory'
}

export interface VnaStudyDto {
  studyUid: string
  patientId: string | null
  modality: string
  studyDescription: string
  instanceCount: number
  seriesCount: number
  createdAt: string
  storageSource: 'database' | 'memory'
}

export interface VnaStatsDto {
  totalObjects: number
  totalSizeBytes: number
  dicomCount: number
  nonDicomCount: number
  wormLockedCount: number
  studyCount: number
  storageSource: 'database' | 'memory'
}

export interface PatientArchiveDto {
  patientId: string
  studies: VnaStudyDto[]
  objects: VnaObjectDto[]
  totalSizeBytes: number
}

export interface CreateVnaObjectInput {
  patientId?: string | null
  studyUid?: string | null
  objectType?: string
  name?: string
  description?: string
  mimeType?: string
  size?: number
  buffer?: Buffer
  originalName?: string
}

interface MemoryObject {
  id: string
  tenantId: string
  patientId: string | null
  studyUid: string | null
  objectType: string
  name: string
  description: string
  mimeType: string
  size: number
  storagePath: string | null
  wormLocked: boolean
  createdAt: Date
  buffer?: Buffer
}

interface VnaObjectRow {
  id: string
  tenantId: string
  patientId: string | null
  studyUid: string | null
  objectType: string
  name: string
  description: string | null
  mimeType: string
  size: number
  storagePath: string | null
  wormLocked: boolean
  createdAt: Date
}

interface VnaRepo {
  vnaObject: {
    findMany(args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }): Promise<VnaObjectRow[]>
    findUnique(args: { where: { id: string } }): Promise<VnaObjectRow | null>
    create(args: { data: Record<string, unknown> }): Promise<VnaObjectRow>
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<VnaObjectRow>
    delete(args: { where: { id: string } }): Promise<VnaObjectRow>
    count(args?: { where?: Record<string, unknown> }): Promise<number>
    aggregate(args: { _sum?: { size?: true }; where?: Record<string, unknown> }): Promise<{ _sum: { size: number | null } }>
  }
}

const MAX_OBJECT_SIZE = 100 * 1024 * 1024
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.dcm': 'application/dicom',
  '.zip': 'application/zip',
}

function sanitizeName(name: string | undefined, fallback: string): string {
  const base = (name ?? '').trim().slice(0, 200)
  return base || fallback
}

function resolveStorageDir(): string {
  const cwd = process.cwd()
  const root = cwd.includes(`${path.sep}backend`) ? cwd : path.join(cwd, 'backend')
  return process.env['VNA_STORAGE_DIR']?.trim() || path.join(root, 'vna-storage')
}

@Injectable()
export class VnaService {
  private readonly logger = new Logger(VnaService.name)
  private readonly storageDir = resolveStorageDir()
  private readonly storage: StorageDriver
  private readonly memory = new Map<string, MemoryObject>()

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(STORAGE_DRIVER) storageDriver?: StorageDriver,
  ) {
    this.storage = storageDriver ?? new LocalStorageDriver({ root: this.storageDir })
    try {
      fs.mkdirSync(this.storageDir, { recursive: true })
    } catch (err) {
      this.logger.warn(`[VNA] cannot create storage dir ${this.storageDir}: ${(err as Error).message}`)
    }
  }

  private get repo(): VnaRepo {
    return this.prisma as unknown as VnaRepo
  }

  private toDto(row: VnaObjectRow | MemoryObject, source: 'database' | 'memory'): VnaObjectDto {
    return {
      id: row.id,
      patientId: row.patientId,
      studyUid: row.studyUid,
      objectType: (row.objectType === 'image' ? 'image' : 'document'),
      name: row.name,
      description: row.description ?? '',
      mimeType: row.mimeType,
      size: row.size,
      storagePath: row.storagePath,
      wormLocked: row.wormLocked,
      createdAt: new Date(row.createdAt).toISOString(),
      storageSource: source,
    }
  }

  private memoryList(): MemoryObject[] {
    return Array.from(this.memory.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  private memoryGet(id: string): MemoryObject | undefined {
    return this.memory.get(id)
  }

  // ─────────────────────── 归档对象列表 ───────────────────────

  async listObjects(query: { type?: string; patientId?: string; search?: string } = {}): Promise<VnaObjectDto[]> {
    const where: Record<string, unknown> = {}
    if (query.type === 'document' || query.type === 'image') where.objectType = query.type
    if (query.patientId) where.patientId = query.patientId
    try {
      const rows = await this.repo.vnaObject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      let filtered = rows
      if (query.search) {
        const q = query.search.trim().toLowerCase()
        filtered = rows.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q) || (r.studyUid ?? '').toLowerCase().includes(q),
        )
      }
      return filtered.map((r) => this.toDto(r, 'database'))
    } catch (err) {
      this.logger.warn(`[VNA] listObjects DB failed, fallback to memory: ${(err as Error).message}`)
      let rows = this.memoryList()
      if (query.type === 'document' || query.type === 'image') rows = rows.filter((r) => r.objectType === query.type)
      if (query.patientId) rows = rows.filter((r) => r.patientId === query.patientId)
      if (query.search) {
        const q = query.search.trim().toLowerCase()
        rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || (r.studyUid ?? '').toLowerCase().includes(q))
      }
      return rows.map((r) => this.toDto(r, 'memory'))
    }
  }

  // ─────────────────────── 创建归档对象 ───────────────────────

  async createObject(input: CreateVnaObjectInput): Promise<VnaObjectDto> {
    const objectType = input.objectType === 'image' ? 'image' : 'document'
    const mimeType = input.mimeType?.trim() || this.guessMimeType(input.originalName) || 'application/octet-stream'
    const name = sanitizeName(input.name, input.originalName || `未命名${objectType === 'image' ? '图像' : '文档'}`)
    const description = (input.description ?? '').slice(0, 500)

    if (input.buffer && input.buffer.length > MAX_OBJECT_SIZE) {
      throw new BadRequestException('文件大小超过限制 (100MB)')
    }

    const id = `vna-${crypto.randomBytes(8).toString('hex')}`
    const now = new Date()
    const tenantId = 'default'
    const size = input.size ?? input.buffer?.length ?? 0

    let storagePath: string | null = null
    if (input.buffer && input.buffer.length > 0) {
      storagePath = await this.persistFile(id, input.originalName ?? name, input.buffer)
    }

    const data = {
      tenantId,
      patientId: input.patientId?.trim() || null,
      studyUid: input.studyUid?.trim() || null,
      objectType,
      name,
      description,
      mimeType,
      size,
      storagePath,
      wormLocked: false,
    }

    try {
      const row = await this.repo.vnaObject.create({ data })
      this.logger.log(`[VNA] object ${row.id} created via database (${mimeType}, ${size}B)`)
      return this.toDto(row, 'database')
    } catch (err) {
      this.logger.warn(`[VNA] createObject DB failed, fallback to memory: ${(err as Error).message}`)
      const mem: MemoryObject = { id, tenantId, patientId: data.patientId, studyUid: data.studyUid, objectType, name, description, mimeType, size, storagePath, wormLocked: false, createdAt: now, buffer: input.buffer }
      this.memory.set(id, mem)
      return this.toDto(mem, 'memory')
    }
  }

  private async persistFile(id: string, originalName: string, buffer: Buffer): Promise<string> {
    const safeBase = path.basename(originalName).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 80)
    const filename = `${id}_${safeBase || 'object.bin'}`
    try {
      await this.storage.put(filename, buffer)
      return filename
    } catch (err) {
      this.logger.warn(`[VNA] persistFile failed, keep in memory: ${(err as Error).message}`)
      return filename
    }
  }

  private guessMimeType(name?: string): string {
    if (!name) return 'application/octet-stream'
    const ext = path.extname(name).toLowerCase()
    return CONTENT_TYPES[ext] ?? 'application/octet-stream'
  }

  // ─────────────────────── 对象详情 / 内容 ───────────────────────

  async getObject(id: string): Promise<VnaObjectDto> {
    try {
      const row = await this.repo.vnaObject.findUnique({ where: { id } })
      if (row) return this.toDto(row, 'database')
    } catch (err) {
      this.logger.warn(`[VNA] getObject DB failed, fallback to memory: ${(err as Error).message}`)
    }
    const mem = this.memoryGet(id)
    if (mem) return this.toDto(mem, 'memory')
    throw new NotFoundException(`VNA object ${id} not found`)
  }

  async getObjectContent(id: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const obj = await this.getObject(id)
    // 存储驱动 (本地磁盘 / S3) 优先
    if (obj.storagePath) {
      try {
        const buffer = await this.storage.get(obj.storagePath)
        return { buffer, mimeType: obj.mimeType, filename: obj.name }
      } catch (err) {
        this.logger.warn(`[VNA] storage.get failed for ${obj.storagePath}: ${(err as Error).message}`)
      }
    }
    const mem = this.memoryGet(id)
    if (mem?.buffer) return { buffer: mem.buffer, mimeType: obj.mimeType, filename: obj.name }
    // 无内容: 返回元数据 JSON
    return { buffer: Buffer.from(JSON.stringify(obj, null, 2)), mimeType: 'application/json', filename: `${obj.name}.json` }
  }

  // ─────────────────────── WORM 锁定 / 删除 ───────────────────────

  async wormLock(id: string): Promise<VnaObjectDto> {
    const obj = await this.getObject(id)
    if (obj.wormLocked) return obj // 幂等: 已锁定直接返回

    if (obj.storageSource === 'database') {
      try {
        const row = await this.repo.vnaObject.update({ where: { id }, data: { wormLocked: true } })
        this.logger.log(`[VNA] object ${id} WORM-locked (database)`)
        return this.toDto(row, 'database')
      } catch (err) {
        this.logger.warn(`[VNA] wormLock DB failed, fallback to memory: ${(err as Error).message}`)
      }
    }
    const mem = this.memoryGet(id)
    if (!mem) throw new NotFoundException(`VNA object ${id} not found`)
    mem.wormLocked = true
    return this.toDto(mem, 'memory')
  }

  async deleteObject(id: string): Promise<{ deleted: boolean }> {
    const obj = await this.getObject(id)
    if (obj.wormLocked) {
      throw new ForbiddenException(`VNA object ${id} is WORM-locked, deletion is forbidden`)
    }
    if (obj.storageSource === 'database') {
      try {
        await this.repo.vnaObject.delete({ where: { id } })
        this.logger.log(`[VNA] object ${id} deleted (database)`)
        return { deleted: true }
      } catch (err) {
        this.logger.warn(`[VNA] deleteObject DB failed, fallback to memory: ${(err as Error).message}`)
      }
    }
    this.memory.delete(id)
    return { deleted: true }
  }

  // ─────────────────────── 患者归档视图 ───────────────────────

  async getPatientArchive(patientId: string): Promise<PatientArchiveDto> {
    const objects = await this.listObjects({ patientId })
    let studies: VnaStudyDto[] = []
    try {
      const rows = await this.repo.vnaObject.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      const byStudy = new Map<string, { studyUid: string; createdAt: Date; count: number }>()
      for (const r of rows) {
        if (!r.studyUid) continue
        const entry = byStudy.get(r.studyUid) ?? { studyUid: r.studyUid, createdAt: r.createdAt, count: 0 }
        entry.count += 1
        byStudy.set(r.studyUid, entry)
      }
      studies = Array.from(byStudy.values()).map((e) => ({
        studyUid: e.studyUid,
        patientId,
        modality: 'DOC',
        studyDescription: `${e.count} 份归档对象`,
        instanceCount: e.count,
        seriesCount: 1,
        createdAt: e.createdAt.toISOString(),
        storageSource: 'database' as const,
      }))
    } catch (err) {
      this.logger.warn(`[VNA] patient studies DB failed: ${(err as Error).message}`)
      const mem = this.memoryList().filter((r) => r.patientId === patientId && r.studyUid)
      const byStudy = new Map<string, MemoryObject[]>()
      for (const r of mem) {
        const list = byStudy.get(r.studyUid!) ?? []
        list.push(r)
        byStudy.set(r.studyUid!, list)
      }
      studies = Array.from(byStudy.entries()).map(([studyUid, list]) => ({
        studyUid,
        patientId,
        modality: 'DOC',
        studyDescription: `${list.length} 份归档对象`,
        instanceCount: list.length,
        seriesCount: 1,
        createdAt: list[0]!.createdAt.toISOString(),
        storageSource: 'memory' as const,
      }))
    }
    return {
      patientId,
      studies,
      objects,
      totalSizeBytes: objects.reduce((s, o) => s + o.size, 0),
    }
  }

  // ─────────────────────── DICOM 检查归档 (dicomInstance 聚合) ───────────────────────

  async listStudies(): Promise<VnaStudyDto[]> {
    try {
      const rows = await this.prisma.dicomInstance.findMany({
        select: {
          studyInstanceUid: true,
          seriesInstanceUid: true,
          sopInstanceUid: true,
          modality: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      })
      if (rows.length === 0) throw new Error('no dicom instances')
      const byStudy = new Map<string, { series: Set<string>; instances: number; first: (typeof rows)[number] }>()
      for (const r of rows) {
        const existing = byStudy.get(r.studyInstanceUid)
        if (existing) {
          existing.series.add(r.seriesInstanceUid)
          existing.instances += 1
        } else {
          byStudy.set(r.studyInstanceUid, { series: new Set([r.seriesInstanceUid]), instances: 1, first: r })
        }
      }
      return Array.from(byStudy.values())
        .map(({ series, instances, first }) => ({
          studyUid: first.studyInstanceUid,
          patientId: null,
          modality: first.modality ?? '',
          studyDescription: `DICOM Study ${first.studyInstanceUid.slice(-8)}`,
          instanceCount: instances,
          seriesCount: series.size,
          createdAt: first.createdAt.toISOString(),
          storageSource: 'database' as const,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    } catch (err) {
      this.logger.warn(`[VNA] listStudies DB failed, fallback to memory: ${(err as Error).message}`)
      const mem = this.memoryList().filter((r) => r.studyUid)
      const byStudy = new Map<string, MemoryObject[]>()
      for (const r of mem) {
        const list = byStudy.get(r.studyUid!) ?? []
        list.push(r)
        byStudy.set(r.studyUid!, list)
      }
      return Array.from(byStudy.entries())
        .map(([studyUid, list]) => ({
          studyUid,
          patientId: list[0]?.patientId ?? null,
          modality: 'DOC',
          studyDescription: `${list.length} 份归档对象`,
          instanceCount: list.length,
          seriesCount: 1,
          createdAt: list[0]!.createdAt.toISOString(),
          storageSource: 'memory' as const,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
  }

  // ─────────────────────── 归档统计 ───────────────────────

  async getStats(): Promise<VnaStatsDto> {
    try {
      const [totalObjects, wormLockedCount, dicomCount, agg] = await Promise.all([
        this.repo.vnaObject.count(),
        this.repo.vnaObject.count({ where: { wormLocked: true } }),
        this.repo.vnaObject.count({ where: { objectType: 'document' } }),
        this.repo.vnaObject.aggregate({ _sum: { size: true } }),
      ])
      const instanceCount = await this.prisma.dicomInstance.count().catch(() => 0)
      return {
        totalObjects,
        totalSizeBytes: agg._sum.size ?? 0,
        dicomCount: instanceCount,
        nonDicomCount: totalObjects,
        wormLockedCount,
        studyCount: await this.listStudies().then((s) => s.length),
        storageSource: 'database',
      }
    } catch (err) {
      this.logger.warn(`[VNA] getStats DB failed, fallback to memory: ${(err as Error).message}`)
      const all = this.memoryList()
      return {
        totalObjects: all.length,
        totalSizeBytes: all.reduce((s, o) => s + o.size, 0),
        dicomCount: 0,
        nonDicomCount: all.length,
        wormLockedCount: all.filter((o) => o.wormLocked).length,
        studyCount: new Set(all.filter((o) => o.studyUid).map((o) => o.studyUid)).size,
        storageSource: 'memory',
      }
    }
  }
}
