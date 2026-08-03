import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

export interface TenantFeatures {
  aiOrchestration: boolean
  biDashboard: boolean
  doseManagement: boolean
  vna: boolean
  similarCases: boolean
  environmentReport: boolean
  mobileApp: boolean
  teleRadiology: boolean
}

export const DEFAULT_TENANT_FEATURES: TenantFeatures = {
  aiOrchestration: true,
  biDashboard: true,
  doseManagement: true,
  vna: true,
  similarCases: true,
  environmentReport: true,
  mobileApp: true,
  teleRadiology: true,
}

export const TENANT_FEATURE_KEYS = Object.keys(DEFAULT_TENANT_FEATURES) as Array<keyof TenantFeatures>

export interface TenantRecord {
  id: string
  code: string
  name: string
  status: string
  license: string
  maxUsers: number
  maxStorageGb: number
  maxExams: number
  features: TenantFeatures
  config: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

function seedMemoryTenants(): Map<string, TenantRecord> {
  const now = new Date()
  const base: TenantRecord = {
    id: 'default',
    code: 'default',
    name: '主租户（默认）',
    status: 'ACTIVE',
    license: 'Enterprise',
    maxUsers: 200,
    maxStorageGb: 1024,
    maxExams: 100000,
    features: { ...DEFAULT_TENANT_FEATURES },
    config: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    createdAt: now,
    updatedAt: now,
  }
  const second: TenantRecord = {
    ...base,
    id: 'tenant-001',
    code: 'demo-a',
    name: '演示租户 A',
    features: { ...DEFAULT_TENANT_FEATURES, mobileApp: false },
    createdAt: new Date(now.getTime() - 86400000 * 30),
    updatedAt: new Date(now.getTime() - 86400000 * 2),
  }
  const third: TenantRecord = {
    ...base,
    id: 'tenant-002',
    code: 'demo-b',
    name: '演示租户 B',
    status: 'DISABLED',
    maxUsers: 50,
    maxStorageGb: 128,
    features: { ...DEFAULT_TENANT_FEATURES, vna: false, teleRadiology: false },
    createdAt: new Date(now.getTime() - 86400000 * 60),
    updatedAt: new Date(now.getTime() - 86400000 * 5),
  }
  return new Map([
    [base.id, base],
    [second.id, second],
    [third.id, third],
  ])
}

function normalizeFeatures(value: unknown): TenantFeatures {
  const raw = (value && typeof value === 'object' ? value as Record<string, unknown> : {}) ?? {}
  const out: TenantFeatures = { ...DEFAULT_TENANT_FEATURES }
  for (const key of TENANT_FEATURE_KEYS) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean
  }
  return out
}

const memoryTenants = seedMemoryTenants()

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(record: { id: string; code: string; name: string; status: string; license: string; maxUsers: number; maxStorageGb: number; maxExams: number; features: unknown; config: unknown; createdAt: Date; updatedAt: Date }) {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      status: record.status,
      license: record.license,
      maxUsers: record.maxUsers,
      maxStorageGb: record.maxStorageGb,
      maxExams: record.maxExams,
      features: normalizeFeatures(record.features),
      config: (record.config ?? {}) as Record<string, unknown>,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async getCurrent(): Promise<TenantRecord> {
    const tenantId = getCurrentTenantId()
    try {
      const row = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
      if (row) return this.toDto(row)
    } catch {
      // DB 不可用时回退内存 seed
    }
    const memory = memoryTenants.get(tenantId)
    if (memory) return memory
    const fallback = memoryTenants.get('default')
    if (!fallback) throw new NotFoundException('Tenant not found')
    return { ...fallback, id: tenantId }
  }

  async getUsage() {
    const tenantId = getCurrentTenantId()
    const info = await this.getCurrent()
    const q = { tenantId }
    try {
      const [users, patients, exams, reports, dicomSize, vnaSize] = await Promise.all([
        this.prisma.user.count({ where: q }),
        this.prisma.patient.count({ where: q }),
        this.prisma.exam.count({ where: q }),
        this.prisma.report.count({ where: q }),
        this.prisma.dicomInstance.aggregate({ where: q, _sum: { sizeBytes: true } }),
        this.prisma.vnaObject.aggregate({ where: q, _sum: { size: true } }),
      ])
      return {
        users,
        patients,
        exams,
        reports,
        storageBytes: Number(dicomSize._sum.sizeBytes ?? 0) + Number(vnaSize._sum.size ?? 0),
        storageLimitBytes: info.maxStorageGb * 1024 * 1024 * 1024,
        examLimit: info.maxExams,
        userLimit: info.maxUsers,
      }
    } catch {
      return {
        users: 156,
        patients: 12840,
        exams: 52360,
        reports: 49820,
        storageBytes: 50 * 1024 * 1024 * 1024,
        storageLimitBytes: info.maxStorageGb * 1024 * 1024 * 1024,
        examLimit: info.maxExams,
        userLimit: info.maxUsers,
      }
    }
  }

  async updateProfile(dto: { name?: string; license?: string; maxUsers?: number; maxStorageGb?: number; config?: Record<string, unknown> }) {
    const tenantId = getCurrentTenantId()
    const data: Prisma.TenantUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.license !== undefined) data.license = dto.license
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers
    if (dto.maxStorageGb !== undefined) data.maxStorageGb = dto.maxStorageGb
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue
    try {
      const row = await this.prisma.tenant.update({ where: { id: tenantId }, data })
      return this.toDto(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const existing = memoryTenants.get(tenantId)
        if (!existing) throw new NotFoundException('Tenant not found')
        const updated: TenantRecord = {
          ...existing,
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.license !== undefined ? { license: dto.license } : {}),
          ...(dto.maxUsers !== undefined ? { maxUsers: dto.maxUsers } : {}),
          ...(dto.maxStorageGb !== undefined ? { maxStorageGb: dto.maxStorageGb } : {}),
          ...(dto.config !== undefined ? { config: { ...existing.config, ...dto.config } } : {}),
          updatedAt: new Date(),
        }
        memoryTenants.set(tenantId, updated)
        return updated
      }
      // DB 不可用 → 内存更新
      const existing = memoryTenants.get(tenantId)
      if (!existing) throw new NotFoundException('Tenant not found')
      const updated: TenantRecord = {
        ...existing,
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.license !== undefined ? { license: dto.license } : {}),
        ...(dto.maxUsers !== undefined ? { maxUsers: dto.maxUsers } : {}),
        ...(dto.maxStorageGb !== undefined ? { maxStorageGb: dto.maxStorageGb } : {}),
        ...(dto.config !== undefined ? { config: { ...existing.config, ...dto.config } } : {}),
        updatedAt: new Date(),
      }
      memoryTenants.set(tenantId, updated)
      return updated
    }
  }

  async getFeatures(): Promise<TenantFeatures> {
    const info = await this.getCurrent()
    return normalizeFeatures(info.features)
  }

  async updateFeatures(patch: Partial<TenantFeatures>) {
    const tenantId = getCurrentTenantId()
    const current = await this.getFeatures()
    const next: TenantFeatures = { ...current }
    for (const key of TENANT_FEATURE_KEYS) {
      if (typeof patch[key] === 'boolean') next[key] = patch[key] as boolean
    }
    try {
      const row = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { features: next as unknown as Prisma.InputJsonValue },
      })
      return normalizeFeatures(row.features)
    } catch {
      const existing = memoryTenants.get(tenantId)
      if (!existing) throw new NotFoundException('Tenant not found')
      const updated: TenantRecord = { ...existing, features: next, updatedAt: new Date() }
      memoryTenants.set(tenantId, updated)
      return next
    }
  }

  // ─────────── 平台管理（管理员） ───────────

  async listAll(): Promise<TenantRecord[]> {
    try {
      const rows = await this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
      return rows.map((row) => this.toDto(row))
    } catch {
      return Array.from(memoryTenants.values())
        .map((t) => ({ ...t }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
  }

  async create(dto: { code: string; name: string; license?: string; maxUsers?: number; maxStorageGb?: number; features?: Partial<TenantFeatures> }) {
    const code = dto.code?.trim()
    const name = dto.name?.trim()
    if (!code || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(code)) {
      throw new BadRequestException('租户 code 必须为 1-64 位字母/数字/._:-，且以字母或数字开头')
    }
    if (!name) throw new BadRequestException('租户名称不能为空')
    const features = normalizeFeatures(dto.features)
    try {
      const row = await this.prisma.tenant.create({
        data: {
          code,
          name,
          license: dto.license ?? 'Enterprise',
          maxUsers: dto.maxUsers ?? 100,
          maxStorageGb: dto.maxStorageGb ?? 256,
          status: 'ACTIVE',
          features: features as unknown as Prisma.InputJsonValue,
        },
      })
      return this.toDto(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('租户 code 已存在')
      }
      const existing = Array.from(memoryTenants.values()).find((t) => t.code === code)
      if (existing) throw new ConflictException('租户 code 已存在')
      const now = new Date()
      const record: TenantRecord = {
        id: `tenant-${code}`,
        code,
        name,
        status: 'ACTIVE',
        license: dto.license ?? 'Enterprise',
        maxUsers: dto.maxUsers ?? 100,
        maxStorageGb: dto.maxStorageGb ?? 256,
        maxExams: 50000,
        features,
        config: {},
        createdAt: now,
        updatedAt: now,
      }
      memoryTenants.set(record.id, record)
      return record
    }
  }

  async setStatus(id: string, status: 'ACTIVE' | 'DISABLED') {
    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      throw new BadRequestException('status 必须为 ACTIVE 或 DISABLED')
    }
    try {
      const row = await this.prisma.tenant.update({ where: { id }, data: { status } })
      return this.toDto(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('租户不存在')
      }
      const existing = memoryTenants.get(id)
      if (!existing) throw new NotFoundException('租户不存在')
      const updated: TenantRecord = { ...existing, status, updatedAt: new Date() }
      memoryTenants.set(id, updated)
      return updated
    }
  }
}
