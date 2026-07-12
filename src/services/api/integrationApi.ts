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
