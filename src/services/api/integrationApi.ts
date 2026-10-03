import { api } from './client'

// ─── HL7 DTOs ───────────────────────────────────────────────────────────────

export interface Hl7Report {
  accessionNumber: string
  patientName: string
  patientId: string
  patientSex: 'M' | 'F' | 'O' | ''
  patientBirthDate?: string
  modality: string
  studyDate: string
  studyTime: string
  findings: string
  conclusion: string
  authorName: string
  authorId: string
  reviewerName?: string
  reviewedAt?: string
  reportId: string
  radsCategory?: string
}

export interface Hl7OruResponse {
  message: string
  controlId: string
  messageType: string
  generatedAt: string
  bytes: number
}

export interface Hl7BatchResponse {
  count: number
  messages: Array<{ reportId: string; message: string }>
}

export interface Hl7OrmOrder {
  patientId: string
  patientName: string
  patientSex: 'M' | 'F' | 'O' | ''
  patientBirthDate?: string
  accessionNumber: string
  modality: string
  bodyPart: string
  orderNumber: string
  orderingDoctor: string
  orderingDept?: string
  orderDateTime?: string
  studyDate?: string
  studyTime?: string
}

export interface Hl7OrmResponse {
  message: string
  controlId: string
  messageType: string
  generatedAt: string
  bytes: number
}

export interface Hl7DftTransaction {
  patientId: string
  patientName: string
  patientSex?: 'M' | 'F' | 'O' | ''
  invoiceNumber: string
  totalAmount: string
  paidAmount?: string
  chargeCode: string
  chargeName: string
  transactionDate?: string
}

export interface Hl7DftResponse {
  message: string
  controlId: string
  messageType: string
  generatedAt: string
  bytes: number
}

export interface Hl7ArchiveRecord {
  id: number
  messageType: string
  controlId: string
  direction: 'INBOUND' | 'OUTBOUND' | 'ACK'
  ackStatus: 'SUCCESS' | 'FAILED' | 'PENDING'
  retryCount: number
  rawMessage: string
  createdAt: string
}

export interface MllpStatus {
  running: boolean
  port: number
  tlsEnabled: boolean
  tlsPort?: number
  whitelist: string[]
  uptimeMs: number
  totalConnections: number
  totalMessages: number
}

export interface ConnectionLogEntry {
  id: number
  peer: string
  event: 'connect' | 'disconnect' | 'message' | 'error'
  timestamp: string
  detail?: string
}

// ─── IHE DTOs ───────────────────────────────────────────────────────────────

export interface AffinityDomain {
  homeCommunityId: string
  name: string
  nameEn?: string
  repositoryUniqueIds: string[]
  registryUniqueId?: string
  assigningAuthorityId: string
  pixManagerEndpoint?: string
  pdqSupplierEndpoint?: string
  registryEndpoint?: string
  repositoryEndpoint?: string
  atnaEndpoint?: string
}

export interface IheStatus {
  profile: string
  affinityDomain: AffinityDomain
  metrics: { pixRecords: number; pdqCache: number; pamLogSize: number }
  transactions: string[]
}

export interface PixFeedRequest {
  patientId: string
  assigningAuthority: string
  identifiers: Array<{ domain: string; value: string; assigningAuthority: string }>
  name: { family: string; given: string[] }
  birthDate: string
  gender: 'M' | 'F' | 'O' | 'U'
  address?: { line: string[]; city: string; state: string; postalCode: string; country: string }
  telecom?: { system: 'phone' | 'email' | 'sms'; value: string; use?: 'home' | 'work' | 'mobile' }
}

export interface PixQueryRequest {
  patientId: string
  sourceDomain: string
  targetDomains: string[]
}

export interface PixQueryResult {
  transaction: string
  count: number
  patientId: string
  sourceDomain: string
  results: Array<{
    patientId: string
    assigningAuthority: string
    identifiers: Array<{ domain: string; value: string; assigningAuthority: string }>
    name: { family: string; given: string[] }
  }>
}

export interface PdqQueryRequest {
  patientId?: string
  familyName?: string
  givenName?: string
  birthDate?: string
  gender?: 'M' | 'F' | 'O' | 'U'
  addressCity?: string
  addressState?: string
  assigningAuthority?: string
  limit?: number
}

export interface PdqResult {
  patientId: string
  assigningAuthority: string
  identifiers: Array<{ domain: string; value: string }>
  name: { family: string; given: string[] }
  birthDate: string
  gender: string
  address?: string
  phone?: string
  confidence: number
}

export interface PamMessageRequest {
  messageType: string
  patientId: string
  assigningAuthority?: string
  visitNumber?: string
  accountNumber?: string
  attendingDoctor?: string
  classCode?: string
  assignedLocation?: {
    facility: string
    building?: string
    floor?: string
    pointOfCare?: string
    room?: string
    bed?: string
  }
  admitDateTime?: string
  dischargeDateTime?: string
}

export interface PamAckResponse {
  success: boolean
  ack: 'AA' | 'AE' | 'AR'
  messageId: string
  visitNumber?: string
  errors?: string[]
  timestamp: string
}

export interface PamMessagesResponse {
  total: number
  entries: Array<{
    ts: string
    message: PamMessageRequest
    ack: 'AA' | 'AE' | 'AR'
    messageId: string
  }>
}

export interface VisitState {
  patientId: string
  visitNumber: string
  status: string
  classCode?: string
  assignedLocation?: any
  admitDateTime?: string
  dischargeDateTime?: string
  inProgressAt?: string
  completedAt?: string
  timeline?: Array<{ event: string; timestamp: string; description: string }>
  adtMessages?: Array<{ id: string; messageType: string; timestamp: string; content: string }>
}

// ─── HL7 API ────────────────────────────────────────────────────────────────

// [v3.0.6.11-104 Wave 2D] HL7 监控扩展端点 DTO (对齐 backend hl7.service)
export interface Hl7OverviewDto {
  totalMessages: number
  todayMessages: number
  inboundCount: number
  outboundCount: number
  successCount: number
  failedCount: number
  successRate: number
  ackStatusBreakdown: Array<{ ackStatus: string; count: number }>
  byType: Array<{ messageType: string; count: number; percent: number }>
  seeded: boolean
}

export interface Hl7ErrorAnalysisDto {
  totalErrors: number
  byErrorType: Array<{ errorType: string; count: number; percent: number }>
  byChannel: Array<{ channel: string; count: number }>
  byHour: Array<{ hour: string; count: number }>
  recentErrors: Array<{ id: string; messageType: string; ackStatus: string; createdAt: string }>
  seeded: boolean
}

export interface Hl7ThroughputPoint {
  date: string
  label: string
  total: number
  success: number
  failed: number
  successRate: number
  seeded: boolean
}

export interface Hl7MessageTypeDto {
  messageType: string
  count: number
  percent: number
  avgBytes: number
  direction: string
}

export const hl7Api = {
  buildOru: (data: Hl7Report) =>
    api.post<Hl7OruResponse>('/hl7/oru', data),

  buildBatch: (reports: Hl7Report[]) =>
    api.post<Hl7BatchResponse>('/hl7/batch', { reports }),

  buildOrm: (data: Hl7OrmOrder) =>
    api.post<Hl7OrmResponse>('/hl7/orm', data),

  buildDft: (data: Hl7DftTransaction) =>
    api.post<Hl7DftResponse>('/hl7/dft', data),

  pushOru: (examId: string, reportId: string) =>
    api.post<{ pushed: boolean; examId: string; reportId: string }>('/hl7/push-oru', { examId, reportId }),

  getArchive: (params?: { messageType?: string; direction?: string; ackStatus?: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams()
    if (params?.messageType) sp.set('messageType', params.messageType)
    if (params?.direction) sp.set('direction', params.direction)
    if (params?.ackStatus) sp.set('ackStatus', params.ackStatus)
    if (params?.from) sp.set('from', params.from)
    if (params?.to) sp.set('to', params.to)
    return api.get<Hl7ArchiveRecord[]>(`/hl7/archive?${sp.toString()}`)
  },

  retryBatch: (ids: number[]) =>
    api.post<{ success: boolean }>('/hl7/batch', { ids }),

  getMllpStatus: () =>
    api.get<MllpStatus>('/hl7/mllp/status'),

  getMllpLogs: (limit = 50) =>
    api.get<ConnectionLogEntry[]>(`/hl7/mllp/logs?limit=${limit}`),

  startMllp: () =>
    api.post<{ success: boolean }>('/hl7/mllp/start'),

  stopMllp: () =>
    api.post<{ success: boolean }>('/hl7/mllp/stop'),

  addMllpWhitelist: (cidr: string) =>
    api.post<{ success: boolean }>('/hl7/mllp/whitelist/add', { cidr }),

  removeMllpWhitelist: (cidr: string) =>
    api.post<{ success: boolean }>('/hl7/mllp/whitelist/remove', { cidr }),

  toggleMllpTls: (enabled: boolean) =>
    api.post<{ success: boolean }>('/hl7/mllp/tls', { enabled }),

  // [v3.0.6.11-104 Wave 2D] HL7 监控看板
  getOverview: () =>
    api.get<Hl7OverviewDto>('/hl7/overview'),

  getErrorAnalysis: () =>
    api.get<Hl7ErrorAnalysisDto>('/hl7/error-analysis'),

  getThroughput: (days = 30) =>
    api.get<Hl7ThroughputPoint[]>(`/hl7/throughput?days=${days}`),

  getMessageTypes: () =>
    api.get<Hl7MessageTypeDto[]>('/hl7/message-types'),
}

// ─── IHE API ────────────────────────────────────────────────────────────────

export const iheApi = {
  getStatus: () =>
    api.get<IheStatus>('/ihe/status'),

  getAffinityDomain: () =>
    api.get<AffinityDomain>('/ihe/affinity-domain'),

  setAffinityDomain: (domain: AffinityDomain) =>
    api.put<AffinityDomain>('/ihe/affinity-domain', domain),

  resetAffinityDomain: () =>
    api.delete<AffinityDomain>('/ihe/affinity-domain'),

  pixFeed: (data: PixFeedRequest) =>
    api.post<{ ack: string; messageId: string; storedPid?: string }>('/ihe/pix/feed', data),

  pixQuery: (data: PixQueryRequest) =>
    api.post<PixQueryResult>('/ihe/pix/query', data),

  pixUpdateNotification: (data: PixFeedRequest) =>
    api.post<{ transaction: string; ack: string; messageId: string }>('/ihe/pix/update-notification', data),

  pdqQuery: (data: PdqQueryRequest) =>
    api.post<{ transaction: string; count: number; results: PdqResult[] }>('/ihe/pdq/query', data),

  pamMessage: (data: PamMessageRequest) =>
    api.post<{ transaction: string } & PamAckResponse>('/ihe/pam/message', data),

  pamMessages: (params?: { limit?: number; messageType?: string; patientId?: string }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.messageType) sp.set('messageType', params.messageType)
    if (params?.patientId) sp.set('patientId', params.patientId)
    return api.get<PamMessagesResponse>(`/ihe/pam/messages?${sp.toString()}`)
  },

  getVisit: (patientId: string, visitNumber?: string) => {
    const sp = new URLSearchParams({ patientId })
    if (visitNumber) sp.set('visitNumber', visitNumber)
    return api.get<VisitState>(`/ihe/pam/visit?${sp.toString()}`)
  },

  getVisitDetail: (patientId: string, visitNumber: string) => {
    const sp = new URLSearchParams({ patientId, visitNumber })
    return api.get<VisitState>(`/ihe/pam/visit-detail?${sp.toString()}`)
  },

  mockRegisterDocument: (patientId: string, repository?: string) =>
    api.get<{ documentId: string; patientId: string; repository: string }>(`/ihe/mock/register-document?patientId=${encodeURIComponent(patientId)}${repository ? `&repository=${encodeURIComponent(repository)}` : ''}`),

  mockDocuments: (patientId: string, domain?: string) =>
    api.get<{ patientId: string; domain: string; documents: any[] }>(`/ihe/mock/documents?patientId=${encodeURIComponent(patientId)}${domain ? `&domain=${encodeURIComponent(domain)}` : ''}`),

  mockPdq: (patientId: string, assigningAuthority?: string) =>
    api.get<any>(`/ihe/mock/pdq?patientId=${encodeURIComponent(patientId)}${assigningAuthority ? `&assigningAuthority=${encodeURIComponent(assigningAuthority)}` : ''}`),

  mockCrossReference: (localId: string, remoteDomain: string) =>
    api.post<{ localId: string; remoteDomain: string; remoteId: string }>('/ihe/mock/cross-reference', { localId, remoteDomain }),
}

// ─── XDS.b / XCA / XDR API [v3.0.6.13] ──────────────────────────────────────

export interface XdsDocumentEntry {
  uniqueId: string
  id: string
  patientId: string
  repositoryUniqueId: string
  homeCommunityId: string
  title: string
  classCode: string
  formatCode: string
  typeCode: string
  mimeType: string
  size: number
  hash: string
  creationTime: string
  authorPerson?: string
  authorInstitution?: string
  availabilityStatus: 'APPROVED' | 'DEPRECATED'
  source: 'SUBMISSION' | 'SEED'
}

export interface XdsProvideRequest {
  patientId: string
  repositoryUniqueId?: string
  homeCommunityId?: string
  documents: Array<{
    uniqueId?: string
    title?: string
    mimeType?: string
    classCode?: string
    formatCode?: string
    typeCode?: string
    authorPerson?: string
    content?: string
    size?: number
    creationTime?: string
  }>
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

export interface XdsQueryResult {
  transaction: string
  total: number
  documents: XdsDocumentEntry[]
}

export interface XdsStatsResponse {
  transaction: string
  communities: Array<{ homeCommunityId: string; count: number }>
  stats: {
    total: number
    approved: number
    deprecated: number
    byCommunity: Array<{ homeCommunityId: string; count: number }>
    byRepository: Array<{ repositoryUniqueId: string; count: number }>
    bytes: number
  }
}

// [G005 W4B] 按 uniqueId 调阅单份 XDS 文档 (GET /ihe/xds/documents/:uniqueId)
export interface XdsDocumentDetail extends XdsDocumentEntry {
  classDisplayName?: string
  formatDisplayName?: string
  typeDisplayName?: string
  hashAlgorithm?: string
  content?: string
  sourcePatientId?: string
  submittedAt?: string
}

export const XDS_HOME_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.1'
export const XDS_REMOTE_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.2'
export const XDS_HOME_REPOSITORY = '1.2.840.113556.1.8000.2554.1.100'

export const xdsApi = {
  provide: (data: XdsProvideRequest) => api.post<XdsProvideResult>('/ihe/xds/provide', data),

  retrieve: (documents: Array<{ repositoryUniqueId: string; documentUniqueId: string }>, homeCommunityId?: string) =>
    api.post<{ transaction: string; results: XdsRetrieveResult[]; successCount: number; failureCount: number }>(
      '/ihe/xds/retrieve',
      { documents, ...(homeCommunityId ? { homeCommunityId } : {}) },
    ),

  query: (params: {
    patientId?: string
    classCode?: string
    formatCode?: string
    typeCode?: string
    homeCommunityId?: string
    status?: 'APPROVED' | 'DEPRECATED' | 'ALL'
    limit?: number
  }) => api.post<XdsQueryResult>('/ihe/xds/query', params),

  documents: (params?: { patientId?: string; classCode?: string; formatCode?: string; homeCommunityId?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.patientId) sp.set('patientId', params.patientId)
    if (params?.classCode) sp.set('classCode', params.classCode)
    if (params?.formatCode) sp.set('formatCode', params.formatCode)
    if (params?.homeCommunityId) sp.set('homeCommunityId', params.homeCommunityId)
    if (params?.limit) sp.set('limit', String(params.limit))
    return api.get<XdsQueryResult>(`/ihe/xds/documents?${sp.toString()}`)
  },

  stats: () => api.get<XdsStatsResponse>('/ihe/xds/stats'),

  // [G005 W4B] 按 uniqueId 调阅单份文档 (GET /ihe/xds/documents/:uniqueId)
  getDocument: (uniqueId: string) =>
    api.get<XdsDocumentDetail>(`/ihe/xds/documents/${encodeURIComponent(uniqueId)}`),

  crossGatewayQuery: (params: { homeCommunityId: string; patientId?: string; classCode?: string; formatCode?: string; limit?: number }) =>
    api.post<{ transaction: string; homeCommunityId: string; total: number; communities: Array<{ homeCommunityId: string; count: number }>; documents: XdsDocumentEntry[] }>(
      '/ihe/xca/query',
      params,
    ),

  crossGatewayRetrieve: (homeCommunityId: string, documents: Array<{ repositoryUniqueId: string; documentUniqueId: string }>) =>
    api.post<{ transaction: string; homeCommunityId: string; results: XdsRetrieveResult[]; successCount: number; failureCount: number }>(
      '/ihe/xca/retrieve',
      { homeCommunityId, documents },
    ),

  provideDirect: (data: XdsProvideRequest) => api.post<XdsProvideResult>('/ihe/xdr/provide', data),
}

// ─── 接口监控 + 重试队列 API [v3.0.6.13] ────────────────────────────────────

export type InterfaceType = 'HL7' | 'FHIR' | 'DICOM' | 'ORU' | 'XDS'

export interface InterfaceMessageRecord {
  id: string
  interfaceType: InterfaceType
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: string
  status: 'success' | 'fail' | 'retry' | 'pending'
  ackStatus?: string
  retryCount: number
  patientId?: string
  endpoint?: string
  summary: string
  createdAt: string
}

export interface RetryQueueRecord {
  id: string
  interfaceType: InterfaceType
  endpoint: string
  payload: Record<string, unknown>
  status: 'pending' | 'retrying' | 'success' | 'dead_letter'
  attempts: number
  maxAttempts: number
  nextAttemptAt: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface InterfaceStatsResponse {
  totalMessages: number
  success: number
  fail: number
  retry: number
  pending: number
  successRate: number
  byInterface: Array<{ interfaceType: InterfaceType; total: number; success: number; fail: number; retry: number }>
  queue: { total: number; pending: number; retrying: number; success: number; deadLetter: number }
}

export const interopApi = {
  getMessages: (params?: { interfaceType?: InterfaceType; status?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.interfaceType) sp.set('interfaceType', params.interfaceType)
    if (params?.status) sp.set('status', params.status)
    if (params?.limit) sp.set('limit', String(params.limit))
    return api.get<{ total: number; entries: InterfaceMessageRecord[] }>(`/interface-monitor/messages?${sp.toString()}`)
  },

  getStats: () => api.get<InterfaceStatsResponse>('/interface-monitor/stats'),

  getQueue: (params?: { status?: string; interfaceType?: InterfaceType; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.interfaceType) sp.set('interfaceType', params.interfaceType)
    if (params?.limit) sp.set('limit', String(params.limit))
    return api.get<{ total: number; entries: RetryQueueRecord[] }>(`/interface-monitor/queue?${sp.toString()}`)
  },

  enqueue: (data: { interfaceType: InterfaceType; endpoint: string; payload?: Record<string, unknown>; maxAttempts?: number }) =>
    api.post<RetryQueueRecord>('/interface-monitor/queue', data),

  process: () => api.post<{ processed: number; succeeded: number; retried: number; deadLettered: number; entries: RetryQueueRecord[] }>('/interface-monitor/queue/process'),

  retry: (id: string) => api.post<RetryQueueRecord>(`/interface-monitor/queue/${id}/retry`),
  deadLetter: (id: string) => api.post<RetryQueueRecord>(`/interface-monitor/queue/${id}/dead-letter`),
  requeue: (id: string) => api.post<RetryQueueRecord>(`/interface-monitor/queue/${id}/requeue`),

  getDeadLetters: () => api.get<{ total: number; entries: RetryQueueRecord[] }>('/interface-monitor/dead-letter'),
}

// ─── CDS Hooks API [v3.0.6.13] ──────────────────────────────────────────────

export interface CdsCard {
  uuid: string
  summary: string
  indicator: 'info' | 'warning' | 'critical'
  detail: string
  source: { label: string; url?: string }
  overrideReasons?: Array<{ code: string; display: string }>
  suggestions?: Array<{ label: string; actions?: Array<{ type: string; description: string }> }>
}

export const cdsHooksApi = {
  discovery: () =>
    api.get<{ services: Array<{ hook: string; id: string; title: string; description: string }> }>('/cds-services'),

  invoke: (serviceId: string, body: { hook?: string; hookInstance?: string; context?: Record<string, unknown>; prefetch?: Record<string, unknown> }) =>
    api.post<{ cards: CdsCard[]; systemActions?: unknown[] }>(`/cds-services/${serviceId}`, body),

  feedback: (body: { serviceId: string; hook?: string; cardUuid?: string; outcome: string; overrideReason?: unknown }) =>
    api.post<{ id: string }>('/cds-services/feedback', body),
}

// ─── HL7 ORU publish → HIS 扩展 [v3.0.6.13] ─────────────────────────────────

export interface OruPublishRecord {
  id: string
  reportId: string
  examId?: string
  controlId: string
  messageType: 'ORU^R01'
  message: string
  ackStatus: string
  ackMessage?: string
  endpoint: string
  mode: 'MLLP' | 'STUB'
  attempts: number
  status: 'SENT' | 'STUBBED' | 'FAILED'
  error?: string
  createdAt: string
  updatedAt: string
}

export const hl7OruApi = {
  publish: (reportId: string, examId?: string) =>
    api.post<OruPublishRecord>('/hl7/oru/publish', { reportId, examId }),

  list: (params?: { reportId?: string; status?: string; ackStatus?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.reportId) sp.set('reportId', params.reportId)
    if (params?.status) sp.set('status', params.status)
    if (params?.ackStatus) sp.set('ackStatus', params.ackStatus)
    if (params?.limit) sp.set('limit', String(params.limit))
    return api.get<{ total: number; entries: OruPublishRecord[] }>(`/hl7/oru/messages?${sp.toString()}`)
  },

  resend: (id: string) => api.post<OruPublishRecord>(`/hl7/oru/messages/${id}/resend`),

  getEndpoint: () => api.get<{ host: string; port: number; enabled: boolean }>('/hl7/oru/endpoint'),

  setEndpoint: (data: { host?: string; port?: number; enabled?: boolean }) =>
    api.post<{ host: string; port: number; enabled: boolean }>('/hl7/oru/endpoint', data),
}
