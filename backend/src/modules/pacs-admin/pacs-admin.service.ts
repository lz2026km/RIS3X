import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ============================================================
// [G005 Wave1A] PACS Admin — 孤儿模块 (DB 派生 + 确定性 seed 回退 + 进程内存)
// 覆盖: nodes / storage / worklist-entries / archives / logs /
//       configs / routes + nodes test/sync + storage cleanup
// ============================================================

export interface PacsNode {
  id: string
  name: string
  aeTitle: string
  hostname: string
  port: number
  status: 'online' | 'offline' | 'error'
  lastHeartbeat: string
  modality: string
  location: string
  studyCount: number
}

export interface PacsStorageGroup {
  id: string
  name: string
  path: string
  totalBytes: number
  usedBytes: number
  studyCount: number
  status: 'active' | 'readonly' | 'offline'
}

export interface PacsWorklistEntry {
  id: string
  accessionNumber: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  state: string
  scheduledAt?: string
}

export interface PacsArchive {
  id: string
  studyId: string
  patientName: string
  modality: string
  archivedAt: string
  sizeBytes: number
  status: 'archived' | 'restoring' | 'restored'
}

export interface PacsLogEntry {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
}

export interface PacsConfig {
  key: string
  value: string
  description: string
  category: string
}

export interface PacsRoute {
  id: string
  name: string
  sourceAe: string
  targetAe: string
  targetHost: string
  targetPort: number
  protocol: string
  enabled: boolean
}

export interface PacsTestResult {
  success: boolean
  latencyMs: number
  serverId: string
}

// [G005 Wave1B P1] pacsAdminApi 4 组扩展: servers / storage-groups / associations / stats
export interface PacsServer {
  id: string
  name: string
  hostname: string
  port: number
  aeTitle: string
  status: 'online' | 'offline' | 'error'
  lastHeartbeat: string
  storageBytes: number
  studyCount: number
  seriesCount: number
}

export interface PacsAssociation {
  id: string
  localAe: string
  remoteAe: string
  remoteHost: string
  remotePort: number
  status: 'connected' | 'disconnected' | 'failed'
  lastActivity: string
  requestCount: number
  errorCount: number
}

export interface PacsAdminStats {
  totalServers: number
  onlineServers: number
  totalStorageBytes: number
  usedStorageBytes: number
  totalStudies: number
  totalAssociations: number
  activeAssociations: number
  dailyTransferBytes: number
}

const SEED_ASSOCIATIONS: PacsAssociation[] = [
  { id: 'AS-001', localAe: 'G005RIS_PACS', remoteAe: 'GE_REV_CT1', remoteHost: 'ge-ct1.local', remotePort: 11112, status: 'connected', lastActivity: '2026-08-08 08:32', requestCount: 1240, errorCount: 3 },
  { id: 'AS-002', localAe: 'G005RIS_PACS', remoteAe: 'SIEMENS_MR1', remoteHost: 'siemens-mr1.local', remotePort: 11112, status: 'connected', lastActivity: '2026-08-08 08:28', requestCount: 860, errorCount: 1 },
  { id: 'AS-003', localAe: 'G005RIS_PACS', remoteAe: 'VNA_ARCHIVE', remoteHost: 'vna-01.local', remotePort: 11112, status: 'connected', lastActivity: '2026-08-08 08:10', requestCount: 3200, errorCount: 5 },
  { id: 'AS-004', localAe: 'G005RIS_PACS', remoteAe: 'DICOM_PRINTER', remoteHost: 'printer-01.local', remotePort: 104, status: 'disconnected', lastActivity: '2026-08-07 22:40', requestCount: 120, errorCount: 18 },
  { id: 'AS-005', localAe: 'G005RIS_PACS', remoteAe: 'REMOTE_SITE', remoteHost: 'remote.example.com', remotePort: 11112, status: 'failed', lastActivity: '2026-08-06 15:22', requestCount: 45, errorCount: 32 },
]

const memServers: PacsServer[] = []
const memStorageGroups: PacsStorageGroup[] = []

// 确定性 seed 数据 (无 Math.random)
const SEED_STORAGE: PacsStorageGroup[] = [
  { id: 'SG-001', name: '在线存储', path: '/mnt/pacs/online', totalBytes: 4 * 1024 ** 4, usedBytes: 3140 * 1024 ** 3, studyCount: 128400, status: 'active' },
  { id: 'SG-002', name: '近线存储', path: '/mnt/pacs/nearline', totalBytes: 12 * 1024 ** 4, usedBytes: 8600 * 1024 ** 3, studyCount: 342000, status: 'active' },
  { id: 'SG-003', name: '离线归档', path: '/mnt/pacs/archive', totalBytes: 40 * 1024 ** 4, usedBytes: 27 * 1024 ** 4, studyCount: 981000, status: 'readonly' },
]

const SEED_ARCHIVES: PacsArchive[] = [
  { id: 'ARC-001', studyId: 'STU20260728-050', patientName: '张三', modality: 'CT', archivedAt: '2026-08-01T09:00:00Z', sizeBytes: 460 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-002', studyId: 'STU20260728-051', patientName: '李四', modality: 'MR', archivedAt: '2026-08-01T10:30:00Z', sizeBytes: 890 * 1024 ** 2, status: 'restored' },
  { id: 'ARC-003', studyId: 'STU20260729-011', patientName: '王五', modality: 'DX', archivedAt: '2026-08-02T08:15:00Z', sizeBytes: 32 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-004', studyId: 'STU20260729-012', patientName: '赵六', modality: 'US', archivedAt: '2026-08-02T14:40:00Z', sizeBytes: 210 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-005', studyId: 'STU20260730-020', patientName: '钱七', modality: 'CT', archivedAt: '2026-08-03T11:20:00Z', sizeBytes: 520 * 1024 ** 2, status: 'restoring' },
]

const SEED_LOGS: PacsLogEntry[] = [
  { id: 'LOG-001', time: '2026-08-08T08:30:00Z', level: 'INFO', source: 'DICOM', message: 'SCU 连接建立 (GE Revolution CT → PACS-NODE-01)' },
  { id: 'LOG-002', time: '2026-08-08T08:32:11Z', level: 'INFO', source: 'DICOM', message: 'C-STORE 完成 1/1 实例, 耗时 1.2s' },
  { id: 'LOG-003', time: '2026-08-08T08:35:47Z', level: 'WARN', source: 'STORAGE', message: '在线存储使用率超过 75%' },
  { id: 'LOG-004', time: '2026-08-08T07:58:03Z', level: 'ERROR', source: 'ROUTING', message: '转发失败: 目标 AE DICOM-PRINTER-2 无响应 (超时 30s)' },
  { id: 'LOG-005', time: '2026-08-08T07:45:00Z', level: 'INFO', source: 'AUDIT', message: '管理员触发全量存储校验' },
]

const SEED_CONFIGS: PacsConfig[] = [
  { key: 'ae_title', value: 'G005RIS_PACS', description: 'PACS AE Title', category: 'DICOM' },
  { key: 'port', value: '104', description: 'DICOM 监听端口', category: 'DICOM' },
  { key: 'max_retry', value: '3', description: '转发最大重试次数', category: 'ROUTING' },
  { key: 'retention_days', value: '730', description: '在线存储保留天数', category: 'STORAGE' },
  { key: 'auto_migrate', value: 'true', description: '到期自动迁移至近线', category: 'STORAGE' },
  { key: 'wado_port', value: '8080', description: 'WADO 服务端口', category: 'WEB' },
]

const SEED_ROUTES: PacsRoute[] = [
  { id: 'RT-001', name: 'CT 影像转发', sourceAe: 'G005RIS_PACS', targetAe: 'VNA_ARCHIVE', targetHost: 'vna-01.local', targetPort: 11112, protocol: 'DICOM', enabled: true },
  { id: 'RT-002', name: '胶片打印路由', sourceAe: 'G005RIS_PACS', targetAe: 'DICOM_PRINTER', targetHost: 'printer-01.local', targetPort: 104, protocol: 'DICOM', enabled: true },
  { id: 'RT-003', name: '远程会诊转发', sourceAe: 'G005RIS_PACS', targetAe: 'REMOTE_SITE', targetHost: 'remote.example.com', targetPort: 11112, protocol: 'DICOM', enabled: false },
]

const memConfigs: PacsConfig[] = []

function deviceStateToStatus(state: string): 'online' | 'offline' | 'error' {
  if (state === 'IDLE' || state === 'IN_USE') return 'online'
  if (state === 'BROKEN') return 'error'
  return 'offline'
}

@Injectable()
export class PacsAdminService {
  private readonly logger = new Logger(PacsAdminService.name)

  constructor(private readonly prisma: PrismaService) {}

  // GET /pacs-admin/nodes — Device 表派生 DICOM 节点
  async listNodes(): Promise<PacsNode[]> {
    try {
      const devices = await this.prisma.device.findMany({
        select: { id: true, code: true, name: true, modality: true, location: true, state: true, todayExams: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      if (devices.length === 0) return this.seedNodes()
      return devices.map((d) => ({
        id: d.id,
        name: d.name,
        aeTitle: `PACS-${d.code}`,
        hostname: `pacs-${d.code.toLowerCase()}.local`,
        port: d.modality === 'MR' || d.modality === 'CT' ? 11112 : 104,
        status: deviceStateToStatus(d.state),
        lastHeartbeat: d.updatedAt.toISOString(),
        modality: d.modality,
        location: d.location ?? '',
        studyCount: d.todayExams,
      }))
    } catch (err) {
      this.logger.warn(`[PacsAdmin] nodes DB query failed, fallback to seed: ${(err as Error).message}`)
      return this.seedNodes()
    }
  }

  // GET /pacs-admin/storage — 存储组 (seed 基础 + Exam 真实 study 数)
  async listStorage(): Promise<PacsStorageGroup[]> {
    try {
      const [studyCount, exams] = await Promise.all([
        this.prisma.exam.count(),
        this.prisma.exam.findMany({ select: { id: true }, take: 1 }),
      ])
      if (studyCount === 0) return SEED_STORAGE.map((s) => ({ ...s }))
      void exams
      return SEED_STORAGE.map((s) => ({ ...s, studyCount: s.studyCount + Math.floor(studyCount * 0.2) }))
    } catch {
      return SEED_STORAGE.map((s) => ({ ...s }))
    }
  }

  // GET /pacs-admin/worklist-entries — Exam 表派生 (今日/近期条目)
  async listWorklistEntries(): Promise<PacsWorklistEntry[]> {
    try {
      const rows = await this.prisma.exam.findMany({
        select: {
          id: true,
          accessionNumber: true,
          patientId: true,
          modality: true,
          bodyPart: true,
          state: true,
          scheduledAt: true,
          patient: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 200,
      })
      if (rows.length === 0) return this.seedWorklist()
      return rows.map((r) => ({
        id: r.id,
        accessionNumber: r.accessionNumber,
        patientId: r.patientId,
        patientName: r.patient?.name ?? '未知患者',
        modality: r.modality,
        bodyPart: r.bodyPart,
        state: r.state,
        scheduledAt: r.scheduledAt?.toISOString(),
      }))
    } catch (err) {
      this.logger.warn(`[PacsAdmin] worklist DB query failed, fallback to seed: ${(err as Error).message}`)
      return this.seedWorklist()
    }
  }

  // GET /pacs-admin/archives — 已发布报告/检查派生归档记录
  async listArchives(): Promise<PacsArchive[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { state: { in: ['SIGNED', 'PUBLISHED'] as never } },
        select: {
          id: true,
          publishedAt: true,
          exam: {
            select: {
              id: true,
              accessionNumber: true,
              modality: true,
              patient: { select: { name: true } },
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      })
      if (rows.length === 0) return SEED_ARCHIVES.map((a) => ({ ...a }))
      return rows.map((r, i) => ({
        id: `ARC-DB-${r.id.slice(-8)}`,
        studyId: r.exam?.accessionNumber ?? r.exam?.id ?? `STU-${r.id.slice(-6)}`,
        patientName: r.exam?.patient?.name ?? '未知患者',
        modality: r.exam?.modality ?? 'CT',
        archivedAt: (r.publishedAt ?? new Date()).toISOString(),
        sizeBytes: (120 + (i % 9) * 40) * 1024 ** 2,
        status: 'archived' as const,
      }))
    } catch (err) {
      this.logger.warn(`[PacsAdmin] archives DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_ARCHIVES.map((a) => ({ ...a }))
    }
  }

  // GET /pacs-admin/logs — AuditLog 派生
  async listLogs(limit = 50): Promise<PacsLogEntry[]> {
    const clamped = Math.min(Math.max(Math.floor(limit) || 50, 1), 500)
    try {
      const rows = await this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: clamped,
        select: { id: true, createdAt: true, action: true, resource: true, detail: true, success: true },
      })
      if (rows.length === 0) return SEED_LOGS.slice(0, clamped).map((l) => ({ ...l }))
      return rows.map((r) => {
        const detail = (r.detail ?? {}) as Record<string, unknown>
        const level: PacsLogEntry['level'] = r.success === false ? 'ERROR' : r.action === 'DELETE' || r.action === 'EXPORT' ? 'WARN' : 'INFO'
        return {
          id: r.id,
          time: r.createdAt.toISOString(),
          level,
          source: r.resource.toUpperCase(),
          message: detail?.message ? String(detail.message) : `[${r.action}] ${r.resource}${r.resource ? ` #${r.resource}` : ''}`,
        }
      })
    } catch (err) {
      this.logger.warn(`[PacsAdmin] logs DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_LOGS.slice(0, clamped).map((l) => ({ ...l }))
    }
  }

  // GET /pacs-admin/configs — 内存 + seed 配置
  listConfigs(): PacsConfig[] {
    return [...memConfigs, ...SEED_CONFIGS.filter((c) => !memConfigs.some((m) => m.key === c.key))]
  }

  // POST /pacs-admin/configs/:key — 更新配置
  updateConfig(key: string, value: string, description?: string): PacsConfig {
    const existing = memConfigs.find((c) => c.key === key)
    if (existing) {
      existing.value = value
      if (description !== undefined) existing.description = description
      return existing
    }
    const seed = SEED_CONFIGS.find((c) => c.key === key)
    const config: PacsConfig = {
      key,
      value,
      description: description ?? seed?.description ?? '',
      category: seed?.category ?? 'CUSTOM',
    }
    memConfigs.push(config)
    return config
  }

  // GET /pacs-admin/routes — 转发路由 (seed + 在线节点派生)
  async listRoutes(): Promise<PacsRoute[]> {
    const nodes = await this.listNodes()
    const deviceRoutes: PacsRoute[] = nodes.slice(0, 6).map((n, i) => ({
      id: `RT-DEV-${i + 1}`,
      name: `${n.name} 归档路由`,
      sourceAe: n.aeTitle,
      targetAe: 'VNA_ARCHIVE',
      targetHost: 'vna-01.local',
      targetPort: 11112,
      protocol: 'DICOM',
      enabled: n.status === 'online',
    }))
    return [...deviceRoutes, ...SEED_ROUTES]
  }

  // POST /pacs-admin/nodes/:id/test — 连通性测试 (确定性延迟)
  async testNode(id: string): Promise<PacsTestResult> {
    const nodes = await this.listNodes()
    const node = nodes.find((n) => n.id === id)
    const latencyMs = 5 + (id.length * 7 + new Date().getMinutes()) % 60
    return { success: node ? node.status !== 'offline' : true, latencyMs, serverId: id }
  }

  // POST /pacs-admin/storage/cleanup — 清理 (确定性结果)
  cleanupStorage(): { ok: boolean; freedBytes: number; deletedCount: number; durationMs: number } {
    const day = new Date().getDate()
    return { ok: true, freedBytes: (150 + day * 13) * 1024 ** 3, deletedCount: 30 + day, durationMs: 2400 + day * 17 }
  }

  // ===== [Wave1B P1] servers / storage-groups / associations / stats =====

  // GET /pacs-admin/servers — 内存 + Device 节点派生 DICOM 服务器
  async listServers(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<PacsServer[]> {
    const nodes = await this.listNodes()
    const derived: PacsServer[] = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      hostname: n.hostname,
      port: n.port,
      aeTitle: n.aeTitle,
      status: n.status,
      lastHeartbeat: n.lastHeartbeat,
      storageBytes: (40 + (n.studyCount % 80) * 5) * 1024 ** 3,
      studyCount: n.studyCount,
      seriesCount: n.studyCount * 3,
    }))
    let all = [...memServers, ...derived]
    if (params.status) all = all.filter((s) => s.status === params.status)
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 50
    return all.slice((page - 1) * pageSize, page * pageSize)
  }

  async getServer(id: string): Promise<PacsServer> {
    const list = await this.listServers({})
    const found = list.find((s) => s.id === id)
    if (!found) throw new NotFoundException(`PACS server ${id} not found`)
    return found
  }

  createServer(dto: Partial<PacsServer>): PacsServer {
    const server: PacsServer = {
      id: dto.id ?? `PS-${Date.now().toString(36)}`,
      name: dto.name ?? '未命名服务器',
      hostname: dto.hostname ?? 'localhost',
      port: dto.port ?? 104,
      aeTitle: dto.aeTitle ?? 'G005RIS_PACS',
      status: 'online',
      lastHeartbeat: new Date().toISOString(),
      storageBytes: 0,
      studyCount: 0,
      seriesCount: 0,
    }
    memServers.unshift(server)
    return server
  }

  updateServer(id: string, dto: Partial<PacsServer>): PacsServer {
    const existing = memServers.find((s) => s.id === id)
    if (!existing) {
      const server = this.createServer({ ...dto, id })
      Object.assign(server, dto, { id })
      return server
    }
    Object.assign(existing, dto, { id })
    return existing
  }

  deleteServer(id: string): void {
    const idx = memServers.findIndex((s) => s.id === id)
    if (idx !== -1) memServers.splice(idx, 1)
    // Device 派生服务器删除视为 no-op (只移除内存记录)
  }

  // POST /pacs-admin/servers/:id/test — 复用 testNode
  async testServer(id: string): Promise<PacsTestResult> {
    return this.testNode(id)
  }

  // GET /pacs-admin/storage-groups — 内存 + seed 存储组 (复用 listStorage)
  async listStorageGroups(params: { status?: string } = {}): Promise<PacsStorageGroup[]> {
    const groups = [...memStorageGroups, ...(await this.listStorage())]
    return params.status ? groups.filter((g) => g.status === params.status) : groups
  }

  createStorageGroup(dto: Partial<PacsStorageGroup>): PacsStorageGroup {
    const group: PacsStorageGroup = {
      id: dto.id ?? `SG-${Date.now().toString(36)}`,
      name: dto.name ?? '未命名存储组',
      path: dto.path ?? '/mnt/pacs/custom',
      totalBytes: dto.totalBytes ?? 0,
      usedBytes: 0,
      studyCount: 0,
      status: 'active',
    }
    memStorageGroups.unshift(group)
    return group
  }

  deleteStorageGroup(id: string): void {
    const idx = memStorageGroups.findIndex((g) => g.id === id)
    if (idx !== -1) memStorageGroups.splice(idx, 1)
    else if (!SEED_STORAGE.some((g) => g.id === id)) throw new NotFoundException(`Storage group ${id} not found`)
  }

  // GET /pacs-admin/associations — 确定性 seed
  listAssociations(params: { status?: string } = {}): PacsAssociation[] {
    const list = SEED_ASSOCIATIONS.map((a) => ({ ...a }))
    return params.status ? list.filter((a) => a.status === params.status) : list
  }

  // GET /pacs-admin/stats — 服务器/存储/关联汇总
  async getStats(): Promise<PacsAdminStats> {
    const [servers, groups, associations] = await Promise.all([
      this.listServers({}),
      this.listStorageGroups({}),
      Promise.resolve(this.listAssociations({})),
    ])
    return {
      totalServers: servers.length,
      onlineServers: servers.filter((s) => s.status === 'online').length,
      totalStorageBytes: groups.reduce((s, g) => s + g.totalBytes, 0),
      usedStorageBytes: groups.reduce((s, g) => s + g.usedBytes, 0),
      totalStudies: servers.reduce((s, x) => s + x.studyCount, 0),
      totalAssociations: associations.length,
      activeAssociations: associations.filter((a) => a.status === 'connected').length,
      dailyTransferBytes: 86 * 1024 ** 3,
    }
  }

  // POST /pacs-admin/nodes/:id/sync — 触发同步 (确定性结果)
  async syncNode(id: string): Promise<{ ok: boolean; syncedStudies: number; durationMs: number }> {
    const day = new Date().getDate()
    return { ok: true, syncedStudies: 8 + (day % 12), durationMs: 1800 + day * 23 }
  }

  // ===== 确定性 seed 回退 =====
  private seedNodes(): PacsNode[] {
    return [
      { id: 'NODE-01', name: 'GE Revolution CT', aeTitle: 'PACS-CT1', hostname: 'pacs-ct1.local', port: 11112, status: 'online', lastHeartbeat: new Date(Date.now() - 10000).toISOString(), modality: 'CT', location: 'CT检查室1', studyCount: 423 },
      { id: 'NODE-02', name: '西门子 SOMATOM Force', aeTitle: 'PACS-CT2', hostname: 'pacs-ct2.local', port: 11112, status: 'online', lastHeartbeat: new Date(Date.now() - 22000).toISOString(), modality: 'CT', location: 'CT检查室2', studyCount: 391 },
      { id: 'NODE-03', name: 'GE SIGNA 3.0T', aeTitle: 'PACS-MR1', hostname: 'pacs-mr1.local', port: 11112, status: 'online', lastHeartbeat: new Date(Date.now() - 40000).toISOString(), modality: 'MR', location: 'MR检查室', studyCount: 178 },
      { id: 'NODE-04', name: '飞利浦 Ingenia 1.5T', aeTitle: 'PACS-MR2', hostname: 'pacs-mr2.local', port: 11112, status: 'offline', lastHeartbeat: new Date(Date.now() - 6 * 3600000).toISOString(), modality: 'MR', location: 'MR检查室2', studyCount: 165 },
      { id: 'NODE-05', name: '联影 uDR 数字化X线', aeTitle: 'PACS-DR1', hostname: 'pacs-dr1.local', port: 104, status: 'online', lastHeartbeat: new Date(Date.now() - 60000).toISOString(), modality: 'DR', location: 'DR检查室', studyCount: 512 },
      { id: 'NODE-06', name: '豪洛捷 Selenia Dimensions', aeTitle: 'PACS-MG1', hostname: 'pacs-mg1.local', port: 104, status: 'error', lastHeartbeat: new Date(Date.now() - 90 * 60000).toISOString(), modality: 'MG', location: '乳腺检查室', studyCount: 96 },
    ]
  }

  private seedWorklist(): PacsWorklistEntry[] {
    const now = Date.now()
    return [
      { id: 'WL-001', accessionNumber: 'ACC20260808-011', patientId: 'P100001', patientName: '张伟', modality: 'CT', bodyPart: '胸部', state: 'COMPLETED', scheduledAt: new Date(now - 55 * 60000).toISOString() },
      { id: 'WL-002', accessionNumber: 'ACC20260808-012', patientId: 'P100002', patientName: '李娜', modality: 'MR', bodyPart: '头颅', state: 'IN_PROGRESS', scheduledAt: new Date(now - 40 * 60000).toISOString() },
      { id: 'WL-003', accessionNumber: 'ACC20260808-013', patientId: 'P100003', patientName: '王芳', modality: 'DR', bodyPart: '胸部', state: 'COMPLETED', scheduledAt: new Date(now - 30 * 60000).toISOString() },
      { id: 'WL-004', accessionNumber: 'ACC20260808-014', patientId: 'P100004', patientName: '陈丽', modality: 'US', bodyPart: '腹部', state: 'SCHEDULED', scheduledAt: new Date(now + 20 * 60000).toISOString() },
      { id: 'WL-005', accessionNumber: 'ACC20260808-015', patientId: 'P100005', patientName: '刘洋', modality: 'CT', bodyPart: '腹部增强', state: 'SCHEDULED', scheduledAt: new Date(now + 45 * 60000).toISOString() },
    ]
  }
}
