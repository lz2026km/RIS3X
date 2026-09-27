/**
 * G005 放射RIS系统 v3.0.6.13 - IHE XDS.b / XCA / XDR 真实实现 (DB-less-safe 内存)
 *
 * 交易:
 *   - ITI-41 ProvideAndRegisterDocumentSet-b  (XDS Document Repository)
 *   - ITI-43 RetrieveDocumentSet              (XDS Document Repository)
 *   - ITI-18 RegistryStoredQuery              (XDS Document Registry)
 *   - ITI-38 CrossGatewayQuery                (XCA Initiating/Responding Gateway)
 *   - ITI-39 CrossGatewayRetrieve             (XCA Initiating/Responding Gateway)
 *   - ITI-41 Direct ProvideAndRegisterDocumentSet-b (XDR point-to-point)
 *
 * 数据落地: 内存 registry (元数据) + repository (字节, base64)。
 * 说明: DB-less-safe —— 无 Prisma 依赖; 多社区 (homeCommunityId) mock 供 XCA 演示。
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'

export type DocumentAvailability = 'APPROVED' | 'DEPRECATED'

export const XDS_HOME_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.1'
export const XDS_REMOTE_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.2'
export const XDS_HOME_REPOSITORY = '1.2.840.113556.1.8000.2554.1.100'
export const XDS_HOME_REPOSITORY_2 = '1.2.840.113556.1.8000.2554.1.101'
export const XDS_REMOTE_REPOSITORY = '1.2.840.113556.1.8000.2554.2.100'

export interface XdsDocumentInput {
  /** 客户端可指定 documentUniqueId; 未指定则服务端生成 urn:oid */
  uniqueId?: string
  title?: string
  mimeType?: string
  classCode?: string
  classDisplayName?: string
  formatCode?: string
  formatDisplayName?: string
  typeCode?: string
  typeDisplayName?: string
  languageCode?: string
  practiceSettingCode?: string
  healthcareFacilityTypeCode?: string
  creationTime?: string
  serviceStartTime?: string
  serviceStopTime?: string
  authorInstitution?: string
  authorPerson?: string
  /** base64 编码文档内容 (可省略, 省略则仅登记元数据) */
  content?: string
  size?: number
}

export interface XdsProvideRequest {
  patientId: string
  repositoryUniqueId?: string
  homeCommunityId?: string
  sourcePatientId?: string
  sourcePatientInfo?: string
  submissionSetStatus?: 'Original' | 'Approved' | 'Deprecated'
  documents: XdsDocumentInput[]
}

export interface XdsDocumentEntry {
  id: string
  uniqueId: string
  patientId: string
  repositoryUniqueId: string
  homeCommunityId: string
  title: string
  classCode: string
  classDisplayName: string
  formatCode: string
  formatDisplayName: string
  typeCode: string
  typeDisplayName: string
  mimeType: string
  size: number
  hash: string
  hashAlgorithm: 'SHA1'
  creationTime: string
  serviceStartTime?: string
  serviceStopTime?: string
  authorInstitution?: string
  authorPerson?: string
  languageCode?: string
  practiceSettingCode?: string
  healthcareFacilityTypeCode?: string
  availabilityStatus: DocumentAvailability
  sourcePatientId?: string
  submittedAt: string
  source: 'SUBMISSION' | 'SEED'
}

export interface XdsRetrieveRequest {
  homeCommunityId?: string
  documents: Array<{ repositoryUniqueId: string; documentUniqueId: string }>
}

export interface XdsRetrieveResult {
  repositoryUniqueId: string
  documentUniqueId: string
  homeCommunityId?: string
  mimeType?: string
  size?: number
  hash?: string
  content?: string
  status: 'SUCCESS' | 'FAILURE'
  error?: string
}

export interface XdsStoredQuery {
  patientId?: string
  classCode?: string
  formatCode?: string
  typeCode?: string
  creationTimeFrom?: string
  creationTimeTo?: string
  status?: DocumentAvailability | 'ALL'
  homeCommunityId?: string
  authorPerson?: string
  limit?: number
}

export interface XdsCrossGatewayQuery extends XdsStoredQuery {
  homeCommunityId: string
}

export interface XdsCrossGatewayRetrieve extends XdsRetrieveRequest {
  homeCommunityId: string
}

export interface XdsProvideResult {
  success: boolean
  transaction: 'ITI-41'
  mode: 'repository' | 'direct'
  repositoryUniqueId: string
  homeCommunityId: string
  documentIds: string[]
  documents: XdsDocumentEntry[]
  submittedAt: string
}

export interface XdsQueryResult {
  transaction: 'ITI-18'
  total: number
  documents: XdsDocumentEntry[]
}

export interface XdsCrossGatewayQueryResult {
  transaction: 'ITI-38'
  homeCommunityId: string
  total: number
  communities: Array<{ homeCommunityId: string; count: number }>
  documents: XdsDocumentEntry[]
}

export interface XdsStats {
  total: number
  approved: number
  deprecated: number
  byCommunity: Array<{ homeCommunityId: string; count: number }>
  byRepository: Array<{ repositoryUniqueId: string; count: number }>
  bytes: number
}

const sha1 = (buf: Buffer | string): string => createHash('sha1').update(buf).digest('hex')
const iso = (offsetMin = 0): string => new Date(Date.now() - offsetMin * 60_000).toISOString()

@Injectable()
export class XdsService {
  private readonly logger = new Logger(XdsService.name)
  private readonly registry = new Map<string, XdsDocumentEntry>()
  private readonly repository = new Map<string, string>()
  private seq = 0

  constructor() {
    this.seed()
  }

  private blobKey(repositoryUniqueId: string, uniqueId: string): string {
    return `${repositoryUniqueId}^${uniqueId}`
  }

  private newUniqueId(): string {
    return `2.25.${randomUUID().replace(/-/g, '')}` + this.seq.toString(16)
  }

  private normalize(input: XdsDocumentInput, repositoryUniqueId: string, homeCommunityId: string, patientId: string): XdsDocumentEntry {
    const uniqueId = input.uniqueId?.trim() || this.newUniqueId()
    const content = input.content
    const size = input.size ?? (content ? Buffer.from(content, 'base64').length : 0)
    const hash = content ? sha1(Buffer.from(content, 'base64')) : sha1(`${uniqueId}|${patientId}|${input.title ?? ''}`)
    return {
      id: uniqueId,
      uniqueId,
      patientId,
      repositoryUniqueId,
      homeCommunityId,
      title: input.title ?? '未命名文档',
      classCode: input.classCode ?? 'RAD',
      classDisplayName: input.classDisplayName ?? '影像文档',
      formatCode: input.formatCode ?? 'urn:ihe:rad:1',
      formatDisplayName: input.formatDisplayName ?? 'DICOM 影像',
      typeCode: input.typeCode ?? 'RAD-REPORT',
      typeDisplayName: input.typeDisplayName ?? '放射报告',
      mimeType: input.mimeType ?? 'application/dicom',
      size,
      hash,
      hashAlgorithm: 'SHA1',
      creationTime: input.creationTime ?? iso(),
      serviceStartTime: input.serviceStartTime,
      serviceStopTime: input.serviceStopTime,
      authorInstitution: input.authorInstitution,
      authorPerson: input.authorPerson,
      languageCode: input.languageCode ?? 'zh-CN',
      practiceSettingCode: input.practiceSettingCode,
      healthcareFacilityTypeCode: input.healthcareFacilityTypeCode,
      availabilityStatus: 'APPROVED',
      sourcePatientId: patientId,
      submittedAt: iso(),
      source: 'SUBMISSION',
    }
  }

  /** ITI-41 ProvideAndRegisterDocumentSet-b (Repository / XDR 共用) */
  provideAndRegister(req: XdsProvideRequest, mode: 'repository' | 'direct' = 'repository'): XdsProvideResult {
    if (!req?.patientId) throw new BadRequestException('patientId is required')
    if (!req.documents || req.documents.length === 0) throw new BadRequestException('at least one document is required')
    const homeCommunityId = req.homeCommunityId ?? XDS_HOME_COMMUNITY
    const repositoryUniqueId = req.repositoryUniqueId ?? (mode === 'direct' ? `xdr-${homeCommunityId}` : XDS_HOME_REPOSITORY)

    const documents: XdsDocumentEntry[] = []
    for (const raw of req.documents) {
      const entry = this.normalize(raw, repositoryUniqueId, homeCommunityId, req.patientId)
      this.registry.set(entry.uniqueId, entry)
      if (raw.content) this.repository.set(this.blobKey(repositoryUniqueId, entry.uniqueId), raw.content)
      documents.push(entry)
    }
    this.seq += 1
    this.logger.log(`XDS ITI-41 (${mode}) patient=${req.patientId} repo=${repositoryUniqueId} docs=${documents.length}`)
    return {
      success: true,
      transaction: 'ITI-41',
      mode,
      repositoryUniqueId,
      homeCommunityId,
      documentIds: documents.map((d) => d.uniqueId),
      documents,
      submittedAt: iso(),
    }
  }

  /** ITI-41 Direct (XDR point-to-point) */
  provideAndRegisterDirect(req: XdsProvideRequest): XdsProvideResult {
    return this.provideAndRegister(req, 'direct')
  }

  /** ITI-43 RetrieveDocumentSet */
  retrieveDocumentSet(req: XdsRetrieveRequest): { transaction: 'ITI-43'; results: XdsRetrieveResult[]; successCount: number; failureCount: number } {
    if (!req?.documents || req.documents.length === 0) throw new BadRequestException('documents[] is required')
    const results: XdsRetrieveResult[] = req.documents.map((item) => {
      const entry = this.registry.get(item.documentUniqueId)
      if (!entry) {
        return {
          repositoryUniqueId: item.repositoryUniqueId,
          documentUniqueId: item.documentUniqueId,
          status: 'FAILURE' as const,
          error: 'DocumentNotFound',
        }
      }
      if (req.homeCommunityId && entry.homeCommunityId !== req.homeCommunityId) {
        return {
          repositoryUniqueId: item.repositoryUniqueId,
          documentUniqueId: item.documentUniqueId,
          homeCommunityId: entry.homeCommunityId,
          status: 'FAILURE' as const,
          error: 'HomeCommunityMismatch',
        }
      }
      const content = this.repository.get(this.blobKey(entry.repositoryUniqueId, entry.uniqueId))
      return {
        repositoryUniqueId: entry.repositoryUniqueId,
        documentUniqueId: entry.uniqueId,
        homeCommunityId: entry.homeCommunityId,
        mimeType: entry.mimeType,
        size: entry.size,
        hash: entry.hash,
        content,
        status: content ? ('SUCCESS' as const) : ('FAILURE' as const),
        error: content ? undefined : 'DocumentContentUnavailable',
      }
    })
    const successCount = results.filter((r) => r.status === 'SUCCESS').length
    return { transaction: 'ITI-43', results, successCount, failureCount: results.length - successCount }
  }

  private filter(query: XdsStoredQuery): XdsDocumentEntry[] {
    let docs = [...this.registry.values()]
    if (query.patientId) docs = docs.filter((d) => d.patientId === query.patientId)
    if (query.classCode) docs = docs.filter((d) => d.classCode === query.classCode)
    if (query.formatCode) docs = docs.filter((d) => d.formatCode === query.formatCode)
    if (query.typeCode) docs = docs.filter((d) => d.typeCode === query.typeCode)
    if (query.authorPerson) docs = docs.filter((d) => (d.authorPerson ?? '').includes(query.authorPerson!))
    if (query.homeCommunityId) docs = docs.filter((d) => d.homeCommunityId === query.homeCommunityId)
    if (query.creationTimeFrom) docs = docs.filter((d) => d.creationTime >= query.creationTimeFrom!)
    if (query.creationTimeTo) docs = docs.filter((d) => d.creationTime <= query.creationTimeTo!)
    if (query.status && query.status !== 'ALL') docs = docs.filter((d) => d.availabilityStatus === query.status)
    docs.sort((a, b) => b.creationTime.localeCompare(a.creationTime))
    const limit = query.limit ?? 100
    return docs.slice(0, Math.max(1, Math.min(limit, 500)))
  }

  /** ITI-18 RegistryStoredQuery */
  registryStoredQuery(query: XdsStoredQuery = {}): XdsQueryResult {
    const documents = this.filter(query)
    return { transaction: 'ITI-18', total: documents.length, documents }
  }

  /** ITI-38 CrossGatewayQuery */
  crossGatewayQuery(query: XdsCrossGatewayQuery): XdsCrossGatewayQueryResult {
    // 跨社区: 默认跨全部社区; 指定 homeCommunityId 时仅查该社区
    const scoped = query.homeCommunityId === 'ALL' ? { ...query, homeCommunityId: undefined } : query
    const documents = this.filter(scoped)
    const byCommunity = new Map<string, number>()
    for (const d of documents) byCommunity.set(d.homeCommunityId, (byCommunity.get(d.homeCommunityId) ?? 0) + 1)
    return {
      transaction: 'ITI-38',
      homeCommunityId: query.homeCommunityId,
      total: documents.length,
      communities: Array.from(byCommunity.entries()).map(([homeCommunityId, count]) => ({ homeCommunityId, count })),
      documents,
    }
  }

  /** ITI-39 CrossGatewayRetrieve */
  crossGatewayRetrieve(req: XdsCrossGatewayRetrieve): { transaction: 'ITI-39'; homeCommunityId: string; results: XdsRetrieveResult[]; successCount: number; failureCount: number } {
    const { results, successCount, failureCount } = this.retrieveDocumentSet(req)
    return { transaction: 'ITI-39', homeCommunityId: req.homeCommunityId, results, successCount, failureCount }
  }

  getDocument(uniqueId: string): XdsDocumentEntry | null {
    return this.registry.get(uniqueId) ?? null
  }

  getDocumentContent(repositoryUniqueId: string, uniqueId: string): string | null {
    return this.repository.get(this.blobKey(repositoryUniqueId, uniqueId)) ?? null
  }

  listCommunities(): Array<{ homeCommunityId: string; count: number }> {
    const map = new Map<string, number>()
    for (const d of this.registry.values()) map.set(d.homeCommunityId, (map.get(d.homeCommunityId) ?? 0) + 1)
    return Array.from(map.entries()).map(([homeCommunityId, count]) => ({ homeCommunityId, count }))
  }

  getStats(): XdsStats {
    const all = [...this.registry.values()]
    const byCommunity = new Map<string, number>()
    const byRepository = new Map<string, number>()
    let bytes = 0
    for (const d of all) {
      byCommunity.set(d.homeCommunityId, (byCommunity.get(d.homeCommunityId) ?? 0) + 1)
      byRepository.set(d.repositoryUniqueId, (byRepository.get(d.repositoryUniqueId) ?? 0) + 1)
      bytes += d.size
    }
    return {
      total: all.length,
      approved: all.filter((d) => d.availabilityStatus === 'APPROVED').length,
      deprecated: all.filter((d) => d.availabilityStatus === 'DEPRECATED').length,
      byCommunity: Array.from(byCommunity.entries()).map(([homeCommunityId, count]) => ({ homeCommunityId, count })),
      byRepository: Array.from(byRepository.entries()).map(([repositoryUniqueId, count]) => ({ repositoryUniqueId, count })),
      bytes,
    }
  }

  reset(): void {
    this.registry.clear()
    this.repository.clear()
    this.seq = 0
    this.seed()
  }

  /** 确定性 seed: 本社区 + 远端社区各若干文档, 供 XCA 演示 */
  private seed(): void {
    const seedDocs: Array<{ repo: string; community: string; patientId: string; input: XdsDocumentInput }> = [
      {
        repo: XDS_HOME_REPOSITORY, community: XDS_HOME_COMMUNITY, patientId: 'P000023',
        input: { uniqueId: '1.2.840.113556.1.8000.2554.1.100.1', title: '胸部 CT 平扫报告', classCode: 'RAD', formatCode: 'urn:ihe:rad:1', typeCode: 'RAD-REPORT', mimeType: 'application/pdf', authorPerson: '王建华^主任医师', creationTime: '2026-06-28T09:12:00.000Z', content: Buffer.from('CT chest plain report').toString('base64') },
      },
      {
        repo: XDS_HOME_REPOSITORY_2, community: XDS_HOME_COMMUNITY, patientId: 'P000023',
        input: { uniqueId: '1.2.840.113556.1.8000.2554.1.101.1', title: '胸部 CT 影像', classCode: 'RAD', formatCode: 'urn:ihe:rad:2', typeCode: 'RAD-IMAGE', mimeType: 'application/dicom', authorInstitution: '汉东省人民医院', creationTime: '2026-06-28T09:05:00.000Z', size: 524288 },
      },
      {
        repo: XDS_REMOTE_REPOSITORY, community: XDS_REMOTE_COMMUNITY, patientId: 'P000023',
        input: { uniqueId: '1.2.840.113556.1.8000.2554.2.100.1', title: '外院胸部 CT 基线影像', classCode: 'RAD', formatCode: 'urn:ihe:rad:2', typeCode: 'RAD-IMAGE', mimeType: 'application/dicom', authorInstitution: '东华区第一医院', creationTime: '2025-03-12T03:20:00.000Z', size: 786432, content: Buffer.from('remote baseline dicom').toString('base64') },
      },
      {
        repo: XDS_HOME_REPOSITORY, community: XDS_HOME_COMMUNITY, patientId: 'P000047',
        input: { uniqueId: '1.2.840.113556.1.8000.2554.1.100.2', title: '腰椎 MRI 报告', classCode: 'RAD', formatCode: 'urn:ihe:rad:1', typeCode: 'RAD-REPORT', mimeType: 'application/pdf', authorPerson: '李慧敏^副主任医师', creationTime: '2026-05-20T07:40:00.000Z', content: Buffer.from('MRI lumbar report').toString('base64') },
      },
    ]
    for (const d of seedDocs) {
      const entry = this.normalize(d.input, d.repo, d.community, d.patientId)
      entry.source = 'SEED'
      this.registry.set(entry.uniqueId, entry)
      if (d.input.content) this.repository.set(this.blobKey(entry.repositoryUniqueId, entry.uniqueId), d.input.content)
    }
  }
}
