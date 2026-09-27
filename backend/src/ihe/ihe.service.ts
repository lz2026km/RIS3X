/**
 * G005 放射RIS系统 v3.0.6.11-7 - IHE 集成层 (PAM / PIX / PDQ)
 * 真实实现 IHE IT Infrastructure 交易:
 *   - ITI-8  Patient Identity Feed (PIX Source → PIX Manager)
 *   - ITI-9  PIX Query (PIX Consumer → PIX Manager)
 *   - ITI-10 PIX Update Notification
 *   - ITI-21 PDQ Query (PDQ Source → PDQ Supplier)
 *   - ITI-22 PDQ Supplier response
 *   - ITI-30 Patient Identity Management (PAM)
 *   - ITI-31 Patient Visit Management (PAM)
 *
 * 数据落地:
 *   - 系统配置 → SystemConfig (ihe_affinity_domain / ihe_pix_store / ihe_pdq_index)
 *   - 患者主数据 → Patient
 *   - 交叉引用 + PDQ 索引 → FhirResource (resourceType: 'Patient' | 'Person')
 *   - PAM 消息审计 → SysConfig (ihe_pam_log:list)
 */

import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { XdsService } from './xds.service'
import type {
  PixFeedDto,
  PixQueryDto,
  PdqQueryDto,
  PamMessageDto,
  PamQueryDto,
  AffinityDomainDto,
} from './dto'

export interface IhePixRecord {
  patientId: string
  assigningAuthority: string
  identifiers: { domain: string; value: string; assigningAuthority: string }[]
  name: { family: string; given: string[] }
  birthDate: string
  gender: 'M' | 'F' | 'O' | 'U'
  address?: { line: string[]; city: string; state: string; postalCode: string; country: string }
  telecom?: { system: 'phone' | 'email' | 'sms'; value: string; use?: 'home' | 'work' | 'mobile' }
  lastUpdated: string
  source: 'PIX-FEED' | 'LOCAL' | 'MIGRATION'
}

export interface IhePixQueryResult {
  patientId: string
  assigningAuthority: string
  identifiers: { domain: string; value: string; assigningAuthority: string }[]
  name: { family: string; given: string[] }
}

export interface IhePdqResult {
  patientId: string
  assigningAuthority: string
  identifiers: { domain: string; value: string }[]
  name: { family: string; given: string[] }
  birthDate: string
  gender: string
  address?: string
  phone?: string
  confidence: number
}

export interface PamAck {
  success: boolean
  ack: 'AA' | 'AE' | 'AR'
  messageId: string
  visitNumber?: string
  errors?: string[]
  timestamp: string
}

export interface PamLogEntry {
  ts: string
  message: PamMessageDto
  ack: 'AA' | 'AE' | 'AR'
  messageId: string
}

export type VisitStatus = 'registered' | 'admitted' | 'inProgress' | 'completed' | 'discharged'

const VISIT_TRANSITIONS: Record<string, VisitStatus | null> = {
  'ADT^A01': 'admitted',
  'ADT^A03': 'discharged',
  'ADT^A04': 'registered',
  'ADT^A05': 'registered',
  'ADT^A08': null,
  'ADT^A11': null,
  'ADT^A13': 'completed',
}

const TRANSITION_RULES: Record<string, { validFrom: VisitStatus[]; newVisit: boolean }> = {
  'ADT^A01': { validFrom: ['registered'], newVisit: false },
  'ADT^A03': { validFrom: ['admitted', 'inProgress', 'completed'], newVisit: false },
  'ADT^A04': { validFrom: ['registered', 'admitted', 'inProgress', 'completed', 'discharged'], newVisit: true },
  'ADT^A05': { validFrom: ['registered', 'admitted', 'inProgress', 'completed', 'discharged'], newVisit: true },
  'ADT^A08': { validFrom: ['registered', 'admitted', 'inProgress', 'completed', 'discharged'], newVisit: false },
  'ADT^A11': { validFrom: ['admitted'], newVisit: false },
  'ADT^A13': { validFrom: ['discharged'], newVisit: false },
}

const DEFAULT_DOMAIN: AffinityDomainDto = {
  homeCommunityId: 'urn:oid:1.2.840.113556.1.8000.2554.1',
  name: '汉东省人民医院集成域',
  nameEn: 'Handong Provincial Hospital Affinity Domain',
  repositoryUniqueIds: ['1.2.840.113556.1.8000.2554.1.100', '1.2.840.113556.1.8000.2554.1.101'],
  registryUniqueId: '1.2.840.113556.1.8000.2554.1.200',
  assigningAuthorityId: '1.2.840.113556.1.8000.2554.1.300',
  pixManagerEndpoint: 'pix://g005.local/iti-8',
  pdqSupplierEndpoint: 'pdq://g005.local/iti-21',
  registryEndpoint: 'xds://g005.local/iti-14',
  repositoryEndpoint: 'xds://g005.local/iti-41',
  atnaEndpoint: 'audit://g005.local/iti-20',
}

const SYS_KEY_DOMAIN = 'ihe_affinity_domain'
const SYS_KEY_PIX_STORE = 'ihe_pix_store'
const SYS_KEY_PDQ_INDEX = 'ihe_pdq_index'
const SYS_KEY_PAM_LOG = 'ihe_pam_log'

export interface VisitState {
  patientId: string
  visitNumber: string
  status: VisitStatus
  classCode?: string
  assignedLocation?: PamMessageDto['assignedLocation']
  admitDateTime?: string
  dischargeDateTime?: string
  updatedAt: string
}

@Injectable()
export class IheService {
  private readonly logger = new Logger(IheService.name)
  private seq = 0

  constructor(
    private readonly prisma: PrismaService,
    // [v3.0.6.13] XDS.b 注册/仓储 (未注入时自建, 兼容单测构造)
    @Optional() private readonly xds?: XdsService,
  ) {
    this.xds ??= new XdsService()
  }

  // ===========================================================
  //  Affinity Domain 配置
  // ===========================================================

  async getAffinityDomain(): Promise<AffinityDomainDto> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: SYS_KEY_DOMAIN } })
    return (cfg?.value as AffinityDomainDto | null) ?? DEFAULT_DOMAIN
  }

  async setAffinityDomain(input: AffinityDomainDto): Promise<AffinityDomainDto> {
    await this.prisma.systemConfig.upsert({
      where: { key: SYS_KEY_DOMAIN },
      create: { key: SYS_KEY_DOMAIN, value: input as any },
      update: { value: input as any },
    })
    return input
  }

  async resetAffinityDomain(): Promise<AffinityDomainDto> {
    await this.prisma.systemConfig.delete({ where: { key: SYS_KEY_DOMAIN } }).catch(() => undefined)
    return DEFAULT_DOMAIN
  }

  // ===========================================================
  //  PIX Feed (ITI-8): 接收外部 PIX Source 推送的 MPI 更新
  // ===========================================================

  async pixFeed(dto: PixFeedDto): Promise<{ ack: 'AA' | 'AE' | 'AR'; messageId: string; errors?: string[]; storedPid?: string }> {
    const messageId = `PIX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${++this.seq}`
    const errors: string[] = []

    if (!dto.patientId) errors.push('缺少 patientId')
    if (!dto.name?.family) errors.push('缺少 familyName')
    if (!dto.assigningAuthority) errors.push('缺少 assigningAuthority')
    if (errors.length > 0) {
      return { ack: 'AE', messageId, errors }
    }

    const store = await this.readPixStore()
    const key = this.pixKey(dto.assigningAuthority, dto.patientId)
    const record: IhePixRecord = {
      patientId: dto.patientId,
      assigningAuthority: dto.assigningAuthority,
      identifiers: dto.identifiers,
      name: dto.name,
      birthDate: dto.birthDate,
      gender: dto.gender,
      address: dto.address,
      telecom: dto.telecom,
      lastUpdated: new Date().toISOString(),
      source: 'PIX-FEED',
    }
    store[key] = record
    await this.writePixStore(store)

    try {
      await this.upsertLocalPatientFromPix(record)
    } catch (err) {
      this.logger.error(`PIX Feed → 本地 Patient 同步失败: ${(err as Error).message}`, (err as Error).stack)
    }

    await this.auditNotify('ITI-8', 'C', dto.patientId, dto.assigningAuthority)

    return { ack: 'AA', messageId, storedPid: dto.patientId }
  }

  // ===========================================================
  //  PIX Query (ITI-9): 跨域查找患者标识符
  // ===========================================================

  async pixQuery(query: PixQueryDto): Promise<IhePixQueryResult[]> {
    const store = await this.readPixStore()
    const sourceKey = this.pixKey(query.sourceDomain, query.patientId)
    const stored = store[sourceKey] ?? null

    const candidate: IhePixRecord | null = stored ?? this.findByGlobalId(store, query.patientId)
    if (!candidate) return []

    const personId = candidate.patientId
    const allRecords = Object.values(store).filter(
      (r) => r.patientId === personId || r.identifiers.some((i) => i.value === personId || candidate.identifiers.some((ci) => ci.value === i.value)),
    )

    return query.targetDomains.map((domain) => {
      const domainRecord = allRecords.find((r) => r.assigningAuthority === domain)
      return {
        patientId: domainRecord?.patientId ?? query.patientId,
        assigningAuthority: domain,
        identifiers: domainRecord
          ? domainRecord.identifiers.map((i) => ({ domain: i.domain, value: i.value, assigningAuthority: i.assigningAuthority }))
          : [],
        name: domainRecord?.name ?? candidate.name,
      }
    })
  }

  // ===========================================================
  //  PIX Update Notification (ITI-10)
  // ===========================================================

  async pixUpdateNotification(dto: PixFeedDto): Promise<{ ack: 'AA' | 'AE' | 'AR'; messageId: string }> {
    const r = await this.pixFeed(dto)
    return { ack: r.ack, messageId: r.messageId }
  }

  // ===========================================================
  //  PDQ Supplier (ITI-21 / ITI-22): 患者人口学查询
  // ===========================================================

  async pdqQuery(query: PdqQueryDto): Promise<IhePdqResult[]> {
    const all = await this.collectPdqCandidates()

    let results = all
    if (query.patientId) {
      results = results.filter((p) => p.patientId === query.patientId || p.identifiers.some((i) => i.value === query.patientId))
    }
    if (query.familyName) {
      const f = query.familyName.toLowerCase()
      results = results.filter((p) => p.name.family.toLowerCase().includes(f))
    }
    if (query.givenName) {
      const g = query.givenName.toLowerCase()
      results = results.filter((p) => p.name.given.some((x) => x.toLowerCase().includes(g)))
    }
    if (query.birthDate) {
      results = results.filter((p) => p.birthDate === query.birthDate)
    }
    if (query.gender) {
      results = results.filter((p) => p.gender === query.gender)
    }
    if (query.addressCity) {
      const c = query.addressCity.toLowerCase()
      results = results.filter((p) => p.address?.city.toLowerCase().includes(c))
    }
    if (query.addressState) {
      const s = query.addressState.toLowerCase()
      results = results.filter((p) => p.address?.state.toLowerCase().includes(s))
    }
    if (query.assigningAuthority) {
      results = results.filter((p) => p.assigningAuthority === query.assigningAuthority)
    }

    const scored = results.map((p) => ({ p, confidence: this.computeMatchConfidence(query, p) }))
    scored.sort((a, b) => b.confidence - a.confidence)

    const limit = query.limit ?? 50
    return scored.slice(0, limit).map(({ p, confidence }) => ({
      patientId: p.patientId,
      assigningAuthority: p.assigningAuthority,
      identifiers: p.identifiers.map((i) => ({ domain: i.domain, value: i.value })),
      name: p.name,
      birthDate: p.birthDate,
      gender: p.gender,
      address: p.address ? `${p.address.line.filter(Boolean).join(' ')}, ${p.address.city}, ${p.address.state}`.trim() : undefined,
      phone: p.telecom?.value,
      confidence,
    }))
  }

  // ===========================================================
  //  PAM (ITI-30 / ITI-31): 患者管理消息 (ADT A01/A03/A04/A05/A08/A11/A13)
  // ===========================================================

  // ===========================================================
  //  Visit 生命周期管理（状态机）
  // ===========================================================

  private async transitionVisitState(dto: PamMessageDto, visitNumber: string): Promise<VisitState> {
    const newStatus = VISIT_TRANSITIONS[dto.messageType]
    const rules = TRANSITION_RULES[dto.messageType]
    const now = new Date()

    const existing = await this.prisma.patientVisit.findUnique({
      where: { patientId_visitNumber: { patientId: dto.patientId, visitNumber } },
    })

    if (existing) {
      if (rules && !rules.validFrom.includes(existing.status as VisitStatus)) {
        throw new BadRequestException(
          `PAM 状态机非法跳转: ${existing.status} → ${newStatus ?? existing.status} via ${dto.messageType}`,
        )
      }

      const updateData: any = {
        status: newStatus ?? existing.status,
        classCode: dto.classCode ?? existing.classCode,
        assignedLocation: (dto.assignedLocation as any) ?? existing.assignedLocation,
      }
      if (dto.messageType === 'ADT^A08') updateData.status = existing.status
      if (dto.admitDateTime) updateData.admitDateTime = new Date(dto.admitDateTime)
      if (dto.dischargeDateTime) updateData.dischargeDateTime = new Date(dto.dischargeDateTime)
      if (newStatus === 'admitted') updateData.admitDateTime = updateData.admitDateTime ?? now
      if (newStatus === 'discharged') updateData.dischargeDateTime = updateData.dischargeDateTime ?? now
      if (newStatus === 'inProgress') updateData.inProgressAt = now
      if (newStatus === 'completed') updateData.completedAt = now

      await this.prisma.patientVisit.update({
        where: { patientId_visitNumber: { patientId: dto.patientId, visitNumber } },
        data: updateData,
      })
    } else {
      if (dto.messageType === 'ADT^A08') {
        throw new BadRequestException(`PAM ${dto.messageType} 不能创建新 visit，需先有 A01/A04/A05 记录`)
      }
      await this.prisma.patientVisit.create({
        data: {
          tenantId: 'default',
          patientId: dto.patientId,
          visitNumber,
          status: newStatus ?? 'registered',
          classCode: dto.classCode,
          assignedLocation: dto.assignedLocation as any,
          admitDateTime: dto.admitDateTime
            ? new Date(dto.admitDateTime)
            : newStatus === 'admitted' ? now : null,
          dischargeDateTime: dto.dischargeDateTime
            ? new Date(dto.dischargeDateTime)
            : newStatus === 'discharged' ? now : null,
          inProgressAt: newStatus === 'inProgress' ? now : null,
          completedAt: newStatus === 'completed' ? now : null,
        },
      })
    }

    const updated = await this.prisma.patientVisit.findUnique({
      where: { patientId_visitNumber: { patientId: dto.patientId, visitNumber } },
    })

    return {
      patientId: updated!.patientId,
      visitNumber: updated!.visitNumber,
      status: updated!.status as VisitStatus,
      classCode: updated!.classCode ?? undefined,
      assignedLocation: updated!.assignedLocation as any,
      admitDateTime: updated!.admitDateTime?.toISOString(),
      dischargeDateTime: updated!.dischargeDateTime?.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    }
  }

  async getVisitDetail(patientId: string, visitNumber?: string): Promise<(VisitState & { timeline: any[]; inProgressAt?: string; completedAt?: string; adtMessages: any[] }) | null> {
    if (visitNumber) {
      const v = await this.prisma.patientVisit.findUnique({
        where: { patientId_visitNumber: { patientId, visitNumber } },
      })
      if (!v) return null
      const timeline = await this.getVisitTimeline(patientId, visitNumber)
      const adtMessages = await this.getVisitAdtMessages(patientId, visitNumber)
      return {
        patientId: v.patientId,
        visitNumber: v.visitNumber,
        status: v.status as VisitStatus,
        classCode: v.classCode ?? undefined,
        assignedLocation: v.assignedLocation as any,
        admitDateTime: v.admitDateTime?.toISOString(),
        dischargeDateTime: v.dischargeDateTime?.toISOString(),
        inProgressAt: v.inProgressAt?.toISOString(),
        completedAt: v.completedAt?.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        timeline,
        adtMessages,
      }
    }
    const visits = await this.prisma.patientVisit.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    })
    if (visits.length === 0) return null
    const v = visits[0]!
    const timeline = await this.getVisitTimeline(patientId, v.visitNumber)
    const adtMessages = await this.getVisitAdtMessages(patientId, v.visitNumber)
    return {
      patientId: v.patientId,
      visitNumber: v.visitNumber,
      status: v.status as VisitStatus,
      classCode: v.classCode ?? undefined,
      assignedLocation: v.assignedLocation as any,
      admitDateTime: v.admitDateTime?.toISOString(),
      dischargeDateTime: v.dischargeDateTime?.toISOString(),
      inProgressAt: v.inProgressAt?.toISOString(),
      completedAt: v.completedAt?.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      timeline,
      adtMessages,
    }
  }

  async getVisitState(patientId: string, visitNumber?: string): Promise<VisitState | null> {
    if (visitNumber) {
      const v = await this.prisma.patientVisit.findUnique({
        where: { patientId_visitNumber: { patientId, visitNumber } },
      })
      if (!v) return null
      return {
        patientId: v.patientId,
        visitNumber: v.visitNumber,
        status: v.status as VisitStatus,
        classCode: v.classCode ?? undefined,
        assignedLocation: v.assignedLocation as any,
        admitDateTime: v.admitDateTime?.toISOString(),
        dischargeDateTime: v.dischargeDateTime?.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      }
    }
    const visits = await this.prisma.patientVisit.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    })
    if (visits.length === 0) return null
    const v = visits[0]!
    return {
      patientId: v.patientId,
      visitNumber: v.visitNumber,
      status: v.status as VisitStatus,
      classCode: v.classCode ?? undefined,
      assignedLocation: v.assignedLocation as any,
      admitDateTime: v.admitDateTime?.toISOString(),
      dischargeDateTime: v.dischargeDateTime?.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }
  }

  async sendPamMessage(dto: PamMessageDto): Promise<PamAck> {
    const messageId = `PAM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${++this.seq}`
    const ts = new Date().toISOString()
    const errors: string[] = []

    if (!dto.patientId) errors.push('缺少 patientId')
    if (!dto.assigningAuthority) errors.push('缺少 assigningAuthority')

    if (errors.length > 0) {
      await this.appendPamLog({ ts, message: dto, ack: 'AE', messageId })
      return { success: false, ack: 'AE', messageId, errors, timestamp: ts }
    }

    try {
      await this.applyPamToLocalPatient(dto)
    } catch (err) {
      this.logger.error(`PAM ${dto.messageType} 应用到本地 Patient 失败: ${(err as Error).message}`, (err as Error).stack)
    }

    const visitNumber = dto.visitNumber ?? `VN-${Date.now()}-${++this.seq}`
    await this.transitionVisitState(dto, visitNumber)
    await this.appendPamLog({ ts, message: dto, ack: 'AA', messageId })

    await this.auditNotify('ITI-30', /A01|A04|A05/.test(dto.messageType) ? 'C' : 'U', dto.patientId, dto.assigningAuthority)

    return { success: true, ack: 'AA', messageId, visitNumber, timestamp: ts }
  }

  async listPamMessages(query: PamQueryDto): Promise<{ total: number; entries: PamLogEntry[] }> {
    const all = await this.readPamLog()
    let filtered = all
    if (query.messageType) filtered = filtered.filter((e) => e.message.messageType === query.messageType)
    if (query.patientId) filtered = filtered.filter((e) => e.message.patientId === query.patientId)
    const limit = query.limit ?? 100
    return { total: filtered.length, entries: filtered.slice(-limit).reverse() }
  }

  // ===========================================================
  //  XDS.b 兼容前端 iheService.mock* 接口 (委托真实 XDS 注册/仓储)
  // ===========================================================

  async registerDocumentStub(document: Record<string, unknown>, repository: string): Promise<string> {
    const patientId = String(document?.patientId ?? '').trim() || 'UNKNOWN'
    const homeCommunityId = repository.startsWith('urn:oid') ? repository : undefined
    const result = this.xds!.provideAndRegister({
      patientId,
      repositoryUniqueId: repository.startsWith('urn:oid') ? undefined : repository,
      homeCommunityId,
      documents: [{
        title: String(document?.title ?? '兼容登记文档'),
        classCode: String(document?.classCode ?? 'RAD'),
        formatCode: String(document?.formatCode ?? 'urn:ihe:rad:1'),
        mimeType: String(document?.mimeType ?? 'application/dicom'),
        authorPerson: typeof document?.authorPerson === 'string' ? document.authorPerson : undefined,
      }],
    })
    return result.documentIds[0] ?? ''
  }

  async queryDocumentsStub(patientId: string, domain: string): Promise<Array<Record<string, unknown>>> {
    const homeCommunityId = domain.startsWith('urn:oid') ? domain : undefined
    const result = this.xds!.registryStoredQuery({ patientId, homeCommunityId, limit: 200 })
    return result.documents.map((d) => ({
      documentId: d.uniqueId,
      uniqueId: d.uniqueId,
      patientId: d.patientId,
      repositoryUniqueId: d.repositoryUniqueId,
      homeCommunityId: d.homeCommunityId,
      classCode: d.classCode,
      formatCode: d.formatCode,
      typeCode: d.typeCode,
      mimeType: d.mimeType,
      size: d.size,
      title: d.title,
      authorPerson: d.authorPerson,
      creationTime: d.creationTime,
      availabilityStatus: d.availabilityStatus,
    }))
  }

  async pdqQueryStub(patientId: string, assigningAuthority: string): Promise<IhePdqResult | null> {
    const r = await this.pdqQuery({ patientId, assigningAuthority, limit: 1 })
    return r[0] ?? null
  }

  async crossReferencePatientStub(localId: string, remoteDomain: string): Promise<string> {
    await this.delay(200)
    return `${remoteDomain}-${localId}`
  }

  // ===========================================================
  //  状态 / 度量
  // ===========================================================

  async getStatus(): Promise<{
    profile: string
    affinityDomain: AffinityDomainDto
    metrics: { pixRecords: number; pdqCache: number; pamLogSize: number; xdsDocuments: number; xdsCommunities: number }
    transactions: string[]
  }> {
    const [domain, pixStore, pdqIndex, pamLog] = await Promise.all([
      this.getAffinityDomain(),
      this.readPixStore(),
      this.readPdqIndex(),
      this.readPamLog(),
    ])
    const xdsStats = this.xds!.getStats()
    return {
      profile: 'XDS.b/XCA/XDR/PAM/PIX/PDQ',
      affinityDomain: domain,
      metrics: {
        pixRecords: Object.keys(pixStore).length,
        pdqCache: Object.keys(pdqIndex).length,
        pamLogSize: pamLog.length,
        xdsDocuments: xdsStats.total,
        xdsCommunities: xdsStats.byCommunity.length,
      },
      transactions: ['ITI-8', 'ITI-9', 'ITI-10', 'ITI-18', 'ITI-21', 'ITI-22', 'ITI-30', 'ITI-31', 'ITI-38', 'ITI-39', 'ITI-41', 'ITI-43'],
    }
  }

  // ===========================================================
  //  内部: PIX 存储 (SystemConfig JSON)
  // ===========================================================

  private pixKey(domain: string, pid: string): string {
    return `${domain}^${pid}`
  }

  private async readPixStore(): Promise<Record<string, IhePixRecord>> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: SYS_KEY_PIX_STORE } })
    return (cfg?.value as Record<string, IhePixRecord> | null) ?? {}
  }

  private async writePixStore(store: Record<string, IhePixRecord>): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: SYS_KEY_PIX_STORE },
      create: { key: SYS_KEY_PIX_STORE, value: store as any },
      update: { value: store as any },
    })
  }

  private async readPdqIndex(): Promise<Record<string, IhePixRecord>> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: SYS_KEY_PDQ_INDEX } })
    return (cfg?.value as Record<string, IhePixRecord> | null) ?? {}
  }

  private async writePdqIndex(index: Record<string, IhePixRecord>): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: SYS_KEY_PDQ_INDEX },
      create: { key: SYS_KEY_PDQ_INDEX, value: index as any },
      update: { value: index as any },
    })
  }

  private async readPamLog(): Promise<PamLogEntry[]> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: SYS_KEY_PAM_LOG } })
    return (cfg?.value as PamLogEntry[] | null) ?? []
  }

  private async writePamLog(log: PamLogEntry[]): Promise<void> {
    const trimmed = log.length > 1000 ? log.slice(-1000) : log
    await this.prisma.systemConfig.upsert({
      where: { key: SYS_KEY_PAM_LOG },
      create: { key: SYS_KEY_PAM_LOG, value: trimmed as any },
      update: { value: trimmed as any },
    })
  }

  private async appendPamLog(entry: PamLogEntry): Promise<void> {
    const log = await this.readPamLog()
    log.push(entry)
    await this.writePamLog(log)
  }

  private findByGlobalId(store: Record<string, IhePixRecord>, patientId: string): IhePixRecord | null {
    for (const rec of Object.values(store)) {
      if (rec.patientId === patientId) return rec
      if (rec.identifiers.some((i) => i.value === patientId)) return rec
    }
    return null
  }

  private async collectPdqCandidates(): Promise<IhePixRecord[]> {
    const pixStore = await this.readPixStore()
    const pixValues = Object.values(pixStore)
    const pdqIndex = await this.readPdqIndex()
    const pdqValues = Object.values(pdqIndex)
    const mappings = await this.prisma.patientExternalId.findMany()

    const externalToInternal = new Map<string, string>()
    for (const m of mappings) {
      externalToInternal.set(`${m.assigningAuthority}^${m.externalId}`, m.internalPatientId)
    }

    const remapPatientId = (record: IhePixRecord): IhePixRecord => {
      const internalId = externalToInternal.get(`${record.assigningAuthority}^${record.patientId}`)
      return internalId ? { ...record, patientId: internalId } : record
    }

    if (pdqValues.length === 0) {
      const localPatients = await this.prisma.patient.findMany({ take: 200, orderBy: { updatedAt: 'desc' } })
      const domain = await this.getAffinityDomain()
      const inferred: IhePixRecord[] = localPatients.map((p) => ({
        patientId: p.id,
        assigningAuthority: domain.assigningAuthorityId,
        identifiers: [
          {
            domain: domain.assigningAuthorityId,
            value: p.idCard ?? p.id,
            assigningAuthority: domain.assigningAuthorityId,
          },
        ],
        name: { family: p.name, given: [] },
        birthDate: p.birthDate ? p.birthDate.toISOString().split('T')[0]! : '',
        gender: p.gender === 'MALE' ? 'M' : p.gender === 'FEMALE' ? 'F' : 'U',
        telecom: p.phone ? { system: 'phone', value: p.phone } : undefined,
        lastUpdated: p.updatedAt.toISOString(),
        source: 'LOCAL',
      }))
      const merged = new Map<string, IhePixRecord>()
      for (const r of [...pixValues.map(remapPatientId), ...pdqValues.map(remapPatientId), ...inferred]) {
        merged.set(`${r.assigningAuthority}^${r.patientId}`, r)
      }
      return Array.from(merged.values())
    }

    const merged = new Map<string, IhePixRecord>()
    for (const r of [...pixValues.map(remapPatientId), ...pdqValues.map(remapPatientId)]) {
      merged.set(`${r.assigningAuthority}^${r.patientId}`, r)
    }
    return Array.from(merged.values())
  }

  private computeMatchConfidence(q: PdqQueryDto, p: IhePixRecord): number {
    let score = 0
    let weight = 0
    if (q.patientId) { weight += 0.4; if (p.patientId === q.patientId) score += 0.4 }
    if (q.familyName) { weight += 0.2; if (p.name.family.toLowerCase().includes(q.familyName.toLowerCase())) score += 0.2 }
    if (q.givenName) { weight += 0.15; if (p.name.given.some((g) => g.toLowerCase().includes(q.givenName!.toLowerCase()))) score += 0.15 }
    if (q.birthDate) { weight += 0.15; if (p.birthDate === q.birthDate) score += 0.15 }
    if (q.gender) { weight += 0.1; if (p.gender === q.gender) score += 0.1 }
    if (weight === 0) return 0.5
    return Math.min(1, Math.max(0, score / weight))
  }

  // ===========================================================
  //  内部: Patient 主索引同步 (PIX Feed → Patient 表)
  // ===========================================================

  private async upsertLocalPatientFromPix(record: IhePixRecord): Promise<void> {
    const genderMap: Record<string, 'MALE' | 'FEMALE' | 'OTHER'> = { M: 'MALE', F: 'FEMALE', O: 'OTHER', U: 'OTHER' }
    const fullName = `${record.name.family}${record.name.given.length ? ' ' + record.name.given.join(' ') : ''}`
    const idCardValue = record.identifiers.find((i) => i.domain === record.assigningAuthority)?.value ?? null

    // Use PatientExternalId mapping: assigningAuthority + externalId → internal patient id
    const mapping = await this.prisma.patientExternalId.findUnique({
      where: {
        assigningAuthority_externalId: {
          assigningAuthority: record.assigningAuthority,
          externalId: record.patientId,
        },
      },
    })

    let patientId: string
    if (mapping) {
      patientId = mapping.internalPatientId
      await this.prisma.patient.update({
        where: { id: patientId },
        data: {
          name: fullName,
          gender: genderMap[record.gender] ?? 'OTHER',
          birthDate: record.birthDate ? new Date(record.birthDate) : undefined,
          phone: record.telecom?.value ?? undefined,
        },
      })
    } else {
      const existingByIdCard = idCardValue
        ? await this.prisma.patient.findFirst({ where: { idCard: idCardValue } })
        : null

      if (existingByIdCard) {
        patientId = existingByIdCard.id
        await this.prisma.patient.update({
          where: { id: patientId },
          data: {
            name: fullName,
            gender: genderMap[record.gender] ?? 'OTHER',
            birthDate: record.birthDate ? new Date(record.birthDate) : undefined,
            phone: record.telecom?.value ?? existingByIdCard.phone,
          },
        })
      } else {
        const newPatient = await this.prisma.patient.create({
          data: {
            tenantId: 'default',
            name: fullName,
            gender: genderMap[record.gender] ?? 'OTHER',
            birthDate: record.birthDate ? new Date(record.birthDate) : null,
            idCard: idCardValue,
            phone: record.telecom?.value ?? null,
          },
        })
        patientId = newPatient.id
      }

      await this.prisma.patientExternalId.create({
        data: {
          tenantId: 'default',
          assigningAuthority: record.assigningAuthority,
          externalId: record.patientId,
          internalPatientId: patientId,
        },
      }).catch((err) => this.logger.warn(`Failed to create patientExternalId during PIX feed: ${(err as Error).message}`))
    }

    await this.prisma.fhirResource.upsert({
      where: { id: `pix-${record.assigningAuthority}-${record.patientId}` },
      create: {
        id: `pix-${record.assigningAuthority}-${record.patientId}`,
        tenantId: 'default',
        resourceType: 'Patient',
        content: this.toFhirPatientFromPix(record) as any,
        patientId,
      },
      update: {
        content: this.toFhirPatientFromPix(record) as any,
        versionId: { increment: 1 },
        patientId,
      },
    })

    const pdqIndex = await this.readPdqIndex()
    pdqIndex[`${record.assigningAuthority}^${record.patientId}`] = { ...record, patientId }
    await this.writePdqIndex(pdqIndex)
  }

  private toFhirPatientFromPix(record: IhePixRecord): Record<string, unknown> {
    return {
      resourceType: 'Patient',
      id: record.patientId,
      identifier: record.identifiers.map((i) => ({
        system: `urn:oid:${i.assigningAuthority}`,
        value: i.value,
      })),
      name: [
        {
          family: record.name.family,
          given: record.name.given,
        },
      ],
      gender: record.gender.toLowerCase() === 'm' ? 'male' : record.gender.toLowerCase() === 'f' ? 'female' : 'unknown',
      birthDate: record.birthDate,
      telecom: record.telecom ? [{ system: record.telecom.system, value: record.telecom.value }] : [],
      address: record.address
        ? [
            {
              line: record.address.line,
              city: record.address.city,
              state: record.address.state,
              postalCode: record.address.postalCode,
              country: record.address.country,
            },
          ]
        : [],
      meta: { lastUpdated: record.lastUpdated },
    }
  }

  // ===========================================================
  //  内部: PAM 应用到本地患者
  // ===========================================================

  private async applyPamToLocalPatient(dto: PamMessageDto): Promise<void> {
    const mapping = await this.prisma.patientExternalId.findUnique({
      where: {
        assigningAuthority_externalId: {
          assigningAuthority: dto.assigningAuthority,
          externalId: dto.patientId,
        },
      },
    })
    const patientId = mapping?.internalPatientId ?? dto.patientId

    const patient = await this.prisma.patient.findFirst({
      where: {
        OR: [
          { id: patientId },
          { idCard: dto.patientId },
        ],
      },
    })
    if (!patient) return

    const newState = VISIT_TRANSITIONS[dto.messageType]
    if (newState && newState !== patient.state) {
      await this.prisma.patient.update({
        where: { id: patient.id },
        data: { state: newState },
      })
      this.logger.log(`PAM ${dto.messageType} → 更新患者 ${patient.id} state: ${patient.state} → ${newState}`)
    }

    if (dto.messageType === 'ADT^A08') {
      this.logger.log(`PAM ${dto.messageType} → 更新患者 ${patient.id} 信息`)
    }
  }

  async getVisitTimeline(patientId: string, visitNumber: string): Promise<Array<{ event: string; timestamp: string; description: string }>> {
    const log = await this.readPamLog()
    return log
      .filter((e) => e.message.patientId === patientId && (e.message as any).visitNumber === visitNumber)
      .map((e) => ({
        event: e.message.messageType,
        timestamp: e.ts,
        description: e.ack === 'AA' ? '处理成功' : `处理失败: ${((e as any).errors as string[] | undefined)?.join(', ') ?? ''}`,
      }))
  }

  async getVisitAdtMessages(patientId: string, visitNumber: string): Promise<Array<{ id: string; messageType: string; timestamp: string; content: string }>> {
    const log = await this.readPamLog()
    return log
      .filter((e) => e.message.patientId === patientId && (e.message as any).visitNumber === visitNumber)
      .map((e, i) => ({
        id: `${i + 1}`,
        messageType: e.message.messageType.replace('ADT^', ''),
        timestamp: e.ts,
        content: `MSH|^~\\&|G005_RIS|G005|IHE|PAM|${e.ts.replace(/[-:.TZ]/g, '').slice(0, 14)}||${e.message.messageType}|${e.messageId}|P|2.5.1`,
      }))
  }

  // ===========================================================
  //  内部: 工具
  // ===========================================================

  private async auditNotify(transaction: string, action: 'C' | 'R' | 'U' | 'D' | 'E', patientId: string, source: string): Promise<void> {
    this.logger.log(`IHE ${transaction} ${action} pid=${patientId} source=${source}`)
    const eventOutcome: Record<string, string> = { C: '0', R: '0', U: '0', D: '0', E: '4' }
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        action,
        resource: `IHE-${transaction}`,
        resourceId: patientId,
        detail: {
          EventIdentification: {
            EventID: { code: transaction, displayName: transaction },
            EventActionCode: action,
            EventDateTime: new Date().toISOString(),
            EventOutcomeIndicator: eventOutcome[action] ?? '0',
          },
          ActiveParticipant: [{ UserID: source, RoleIDCode: { code: '110153', displayName: 'Source' } }],
          AuditSourceIdentification: { AuditSourceID: 'G005-RIS', AuditEnterpriseSiteID: process.env.IHE_DOMAIN_NAME ?? 'Handong-Provincial-Hospital' },
          ParticipantObjectIdentification: [{
            ParticipantObjectID: patientId,
            ParticipantObjectTypeCode: '1',
            ParticipantObjectTypeCodeRole: '1',
            ParticipantObjectIDTypeCode: { code: '2', displayName: 'Patient Number' },
          }],
        },
        ip: source,
        success: action !== 'E',
      },
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
