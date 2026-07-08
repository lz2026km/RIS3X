/**
 * G005 放射RIS系统 v3.0.6.0 - IHE Profiles(XDS.b / PIX / PDQ / ATNA / PAM)
 * 40 升级点:ebXML 提交 / Stored Query / PIX Feed / PDQ 查询
 *      PAM 患者管理 / ATNA 审计发送
 */

import type {
  IheAffinityDomain, IheProfileId, IheXdsSubmission, IheXdsQuery,
  IheXdsQueryResult, IheXdsDocument, IhePixFeed, IhePdqQuery, IhePdqResult,
  IhePamMessage,
} from '../../../types/integration';

// ============================================================
// 1. 模拟 Affinity Domain 配置
// ============================================================
const DEFAULT_AFFINITY_DOMAIN: IheAffinityDomain = {
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
};

// ============================================================
// 2. 内部存储
// ============================================================
const xdsStore: Map<string, IheXdsDocument> = new Map<string, IheXdsDocument>();
const pixStore: Map<string, IhePixFeed> = new Map<string, IhePixFeed>();
const pamLog: { ts: string; msg: IhePamMessage; ack: 'AA' | 'AE' | 'AR' }[] = [];

function oid(): string {
  return `1.2.840.113556.1.8000.2554.${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
}

function genUuid(): string {
  return `urn:uuid:${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 14)}`;
}

function nowHl7(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

// ============================================================
// 3. XDS.b 集成
// ============================================================
export interface RegisterDocumentOptions {
  patientId: string;
  title: string;
  titleEn?: string;
  comments?: string;
  classCode: { code: string; display: string };
  typeCode: { code: string; display: string };
  formatCode: { code: string; display: string };
  mimeType: string;
  content?: ArrayBuffer | string;
  sourceId?: string;
  repositoryUniqueId?: string;
}

export async function registerDocument(opts: RegisterDocumentOptions, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<IheXdsDocument> {
  await delay(300);
  const size = typeof opts.content === 'string'
    ? new Blob([opts.content]).size
    : opts.content instanceof ArrayBuffer
      ? opts.content.byteLength
      : 0;
  const doc: IheXdsDocument = {
    entryUUID: genUuid(),
    uniqueId: oid(),
    patientId: opts.patientId,
    repositoryUniqueId: opts.repositoryUniqueId ?? domain.repositoryUniqueIds[0] ?? oid(),
    classCode: opts.classCode.code,
    typeCode: opts.typeCode.code,
    formatCode: opts.formatCode.code,
    size,
    hash: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
    mimeType: opts.mimeType,
    title: opts.titleEn ?? opts.title,
    creationTime: nowHl7(),
    status: 'approved',
    availability: 'Online',
  };
  xdsStore.set(doc.entryUUID, doc);
  return doc;
}

export interface ProvideAndRegisterResult {
  success: boolean;
  submissionSetId: string;
  documentEntries: IheXdsDocument[];
  rs: 'Success' | 'Failure' | 'PartialSuccess';
  timestamp: string;
  errors?: { codeContext: string; errorCode: string; severity: 'error' | 'warning' }[];
}

export async function provideAndRegister(submission: IheXdsSubmission, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<ProvideAndRegisterResult> {
  await delay(400);
  if (!submission.patientId) {
    return { success: false, submissionSetId: '', documentEntries: [], rs: 'Failure', timestamp: new Date().toISOString(), errors: [{ codeContext: 'ProvideAndRegister', errorCode: 'XDSRegistryMetadataError', severity: 'error' }] };
  }
  const documents: IheXdsDocument[] = [];
  for (const d of submission.documentEntries) {
    xdsStore.set(d.entryUUID, d);
    documents.push(d);
  }
  return {
    success: true,
    submissionSetId: submission.submissionSetId || genUuid(),
    documentEntries: documents,
    rs: 'Success',
    timestamp: new Date().toISOString(),
  };
}

export async function queryRegistry(query: IheXdsQuery): Promise<IheXdsQueryResult> {
  await delay(250);
  const start = Date.now();
  let docs = Array.from(xdsStore.values()).filter((d) => d.patientId === query.patientId);
  if (query.status) docs = docs.filter((d) => d.status === query.status);
  if (query.classCode) docs = docs.filter((d) => d.classCode === query.classCode);
  if (query.typeCode) docs = docs.filter((d) => d.typeCode === query.typeCode);
  if (query.formatCode) docs = docs.filter((d) => d.formatCode === query.formatCode);
  if (query.creationTimeFrom) docs = docs.filter((d) => d.creationTime >= query.creationTimeFrom!);
  if (query.creationTimeTo) docs = docs.filter((d) => d.creationTime <= query.creationTimeTo!);
  if (query.limit && query.limit > 0) docs = docs.slice(0, query.limit);
  return {
    total: docs.length,
    documents: docs,
    registryObjectList: docs.map((d) => ({ id: d.entryUUID, status: d.status })),
    queryTime: Date.now() - start,
  };
}

export async function retrieveDocument(entryUUID: string): Promise<{ document: IheXdsDocument; contentType: string; content: string; retrievedAt: string } | null> {
  await delay(200);
  const doc = xdsStore.get(entryUUID);
  if (!doc) return null;
  return {
    document: doc,
    contentType: doc.mimeType,
    content: `<Document title="${doc.title}" size="${doc.size}"/>`,
    retrievedAt: new Date().toISOString(),
  };
}

export function buildFindDocumentsQueryXml(patientId: string, status = 'approved'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<query:AdhocQueryRequest xmlns:query="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0">
  <query:ResponseOption returnComposedObjects="true" returnType="LeafClass"/>
  <query:AdhocQuery id="urn:uuid:14d4debf-8f97-4251-9a74-fb0b3b2c4f7a">
    <query:Slot name="$XDSDocumentEntryPatientId">
      <query:ValueList><query:Value>'${patientId}'</query:Value></query:ValueList>
    </query:Slot>
    <query:Slot name="$XDSDocumentEntryStatus">
      <query:ValueList><query:Value>'${status}'</query:Value></query:ValueList>
    </query:Slot>
  </query:AdhocQuery>
</query:AdhocQueryRequest>`;
}

// ============================================================
// 4. PIX Manager
// ============================================================
export interface PixFeedResult { success: boolean; ack: 'AA' | 'AE' | 'AR'; messageId: string; errors?: string[]; }

export async function pixFeed(feed: IhePixFeed, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<PixFeedResult> {
  await delay(150);
  if (!feed.patientId) return { success: false, ack: 'AE', messageId: '', errors: ['缺少 patientId'] };
  if (!feed.name.family) return { success: false, ack: 'AE', messageId: '', errors: ['缺少 familyName'] };
  pixStore.set(`${feed.assigningAuthority}^${feed.patientId}`, feed);
  return { success: true, ack: 'AA', messageId: `PIX-${Date.now()}` };
}

export interface PixQueryResult { patientId: string; assigningAuthority: string; identifiers: { domain: string; value: string }[]; name: { family: string; given: string[] }; }

export async function pixQuery(patientId: string, sourceDomain: string, targetDomain: string[]): Promise<PixQueryResult[]> {
  await delay(150);
  const stored = pixStore.get(`${sourceDomain}^${patientId}`);
  if (!stored) return [];
  return targetDomain.map((domain) => ({
    patientId: stored.patientId,
    assigningAuthority: domain,
    identifiers: stored.identifiers.concat([{ domain, value: `${domain}-${patientId}`, assigningAuthority: domain }]),
    name: stored.name,
  }));
}

// ============================================================
// 5. PDQ Supplier
// ============================================================
export async function pdqQuery(query: IhePdqQuery, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<IhePdqResult[]> {
  await delay(200);
  const all = Array.from(pixStore.values());
  let results = all;
  if (query.patientId) results = results.filter((p) => p.patientId === query.patientId);
  if (query.familyName) results = results.filter((p) => p.name.family.toLowerCase().includes(query.familyName!.toLowerCase()));
  if (query.givenName) results = results.filter((p) => p.name.given.some((g) => g.toLowerCase().includes(query.givenName!.toLowerCase())));
  if (query.birthDate) results = results.filter((p) => p.birthDate === query.birthDate);
  if (query.gender) results = results.filter((p) => p.gender === query.gender);
  if (query.assigningAuthority) results = results.filter((p) => p.assigningAuthority === query.assigningAuthority);
  return results.map((p) => ({
    patientId: p.patientId,
    assigningAuthority: p.assigningAuthority,
    identifiers: p.identifiers.map((i) => ({ domain: i.domain, value: i.value })),
    name: p.name,
    birthDate: p.birthDate,
    gender: p.gender,
    address: p.address ? `${p.address.line.join(' ')}, ${p.address.city}, ${p.address.state}` : undefined,
    phone: p.telecom?.value,
    confidence: 0.95,
  }));
}

// ============================================================
// 6. PAM(Patient Administration Management)
// ============================================================
export interface PamResult { success: boolean; ack: 'AA' | 'AE' | 'AR'; visitNumber?: string; message: string; timestamp: string; }

export async function sendPamMessage(msg: IhePamMessage, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<PamResult> {
  await delay(200);
  if (!msg.patientId) {
    const r: PamResult = { success: false, ack: 'AE', message: '缺少 patientId', timestamp: new Date().toISOString() };
    pamLog.push({ ts: r.timestamp, msg, ack: r.ack });
    return r;
  }
  const visitNumber = msg.visitNumber ?? `VN-${Date.now()}`;
  const r: PamResult = { success: true, ack: 'AA', visitNumber, message: 'PAM 消息已接受', timestamp: new Date().toISOString() };
  pamLog.push({ ts: r.timestamp, msg, ack: r.ack });
  return r;
}

export function getPamLog() { return [...pamLog]; }

// ============================================================
// 7. ATNA(导出,见 audit/AtnaLogger.ts)
// ============================================================
export async function atnaAudit(_event: { eventId: string; sourceId: string; userId: string; action: 'C' | 'R' | 'U' | 'D' | 'E' }, domain: IheAffinityDomain = DEFAULT_AFFINITY_DOMAIN): Promise<{ sent: boolean; endpoint: string; ts: string }> {
  await delay(80);
  return { sent: true, endpoint: domain.atnaEndpoint ?? 'audit://unknown', ts: new Date().toISOString() };
}

// ============================================================
// 8. IHE Profile 元信息
// ============================================================
export interface IheProfileMeta {
  id: IheProfileId;
  name: string;
  nameEn: string;
  acronym: string;
  domain: 'IT Infrastructure' | 'Radiology' | 'Laboratory' | 'Patient Care' | 'Cardiology' | 'Pharmacy';
  actors: { name: string; role: string }[];
  transactions: { id: string; name: string; description: string }[];
}

export const IHE_PROFILES: IheProfileMeta[] = [
  {
    id: 'XDS.b', name: '跨企业文档共享(b)', nameEn: 'Cross-Enterprise Document Sharing (b)',
    acronym: 'XDS.b', domain: 'IT Infrastructure',
    actors: [
      { name: 'Document Repository', role: '持久化存储文档' },
      { name: 'Document Registry', role: '索引与发现' },
      { name: 'Document Source', role: '提交文档' },
      { name: 'Document Consumer', role: '查询/检索' },
    ],
    transactions: [
      { id: 'ITI-14', name: 'Register Document Set-b', description: '注册文档集到 Registry' },
      { id: 'ITI-15', name: 'Provide and Register', description: '提供并注册文档' },
      { id: 'ITI-16', name: 'Query Registry', description: '查询 Registry' },
      { id: 'ITI-17', name: 'Retrieve Document', description: '从 Repository 检索文档' },
      { id: 'ITI-18', name: 'Stored Query', description: '存储查询' },
    ],
  },
  {
    id: 'PIX', name: '患者标识符交叉引用', nameEn: 'Patient Identifier Cross-Referencing',
    acronym: 'PIX', domain: 'IT Infrastructure',
    actors: [
      { name: 'PIX Source', role: '发送患者标识符' },
      { name: 'PIX Manager', role: '管理交叉引用' },
      { name: 'PIX Consumer', role: '查询患者标识符' },
    ],
    transactions: [
      { id: 'ITI-8', name: 'Patient Identity Feed', description: '提交患者标识符' },
      { id: 'ITI-9', name: 'PIX Query', description: 'PIX 查询' },
      { id: 'ITI-10', name: 'PIX Update Notification', description: 'PIX 更新通知' },
    ],
  },
  {
    id: 'PDQ', name: '患者人口学查询', nameEn: 'Patient Demographics Query',
    acronym: 'PDQ', domain: 'IT Infrastructure',
    actors: [
      { name: 'PDQ Source', role: '查询患者人口学' },
      { name: 'PDQ Supplier', role: '提供患者人口学' },
    ],
    transactions: [
      { id: 'ITI-21', name: 'PDQ Query', description: '患者人口学查询' },
      { id: 'ITI-22', name: 'PDQ Supplier', description: 'PDQ 应答' },
    ],
  },
  {
    id: 'ATNA', name: '审计追踪与节点认证', nameEn: 'Audit Trail and Node Authentication',
    acronym: 'ATNA', domain: 'IT Infrastructure',
    actors: [
      { name: 'ATNA Secure Node', role: '产生审计消息' },
      { name: 'ATNA Audit Repository', role: '记录审计消息' },
      { name: 'ATNA Audit Record Repository', role: '存储审计记录' },
    ],
    transactions: [
      { id: 'ITI-19', name: 'Node Authentication', description: '节点认证' },
      { id: 'ITI-20', name: 'Record Audit Event', description: '记录审计事件' },
    ],
  },
  {
    id: 'PAM', name: '患者管理', nameEn: 'Patient Administration Management',
    acronym: 'PAM', domain: 'Patient Care',
    actors: [
      { name: 'Patient Source', role: '发送 ADT 消息' },
      { name: 'Patient Consumer', role: '接收并处理 ADT' },
    ],
    transactions: [
      { id: 'ITI-30', name: 'Patient Identity Management', description: '患者身份管理' },
      { id: 'ITI-31', name: 'Patient Visit Management', description: '患者就诊管理' },
    ],
  },
  {
    id: 'XDR', name: '跨企业文档可靠交换', nameEn: 'Cross-Enterprise Document Reliable Interchange',
    acronym: 'XDR', domain: 'IT Infrastructure',
    actors: [
      { name: 'Document Source', role: '发送' },
      { name: 'Document Recipient', role: '接收' },
    ],
    transactions: [
      { id: 'ITI-41', name: 'Provide and Register Document Set-b', description: '提供并注册文档' },
    ],
  },
  {
    id: 'XCA', name: '跨企业文档访问', nameEn: 'Cross-Community Access for Documents',
    acronym: 'XCA', domain: 'IT Infrastructure',
    actors: [
      { name: 'Initiating Gateway', role: '发起跨域查询' },
      { name: 'Responding Gateway', role: '响应跨域查询' },
    ],
    transactions: [
      { id: 'ITI-36', name: 'Cross-Community Fetch', description: '跨域文档获取' },
      { id: 'ITI-37', name: 'Cross-Community Query', description: '跨域文档查询' },
      { id: 'ITI-38', name: 'Cross-Community Retrieve', description: '跨域文档检索' },
    ],
  },
  {
    id: 'XDS-I', name: 'XDS 用于影像', nameEn: 'Cross-Enterprise Document Sharing for Imaging',
    acronym: 'XDS-I', domain: 'Radiology',
    actors: [
      { name: 'Imaging Document Source', role: '影像文档源' },
      { name: 'Imaging Document Consumer', role: '影像文档消费者' },
    ],
    transactions: [
      { id: 'RAD-68', name: 'Provide Imaging Document Set', description: '提供影像文档' },
      { id: 'RAD-69', name: 'Retrieve Imaging Document Set', description: '检索影像文档' },
    ],
  },
  {
    id: 'PDQm', name: 'PDQ for Mobile', nameEn: 'PDQ for Mobile',
    acronym: 'PDQm', domain: 'IT Infrastructure',
    actors: [
      { name: 'PDQm Client', role: '移动端查询' },
      { name: 'PDQm Supplier', role: '响应' },
    ],
    transactions: [
      { id: 'ITI-78', name: 'Mobile PDQ Query', description: '移动患者人口学查询' },
    ],
  },
  {
    id: 'PIXm', name: 'PIX for Mobile', nameEn: 'PIX for Mobile',
    acronym: 'PIXm', domain: 'IT Infrastructure',
    actors: [
      { name: 'PIXm Client', role: '移动端查询' },
      { name: 'PIXm Manager', role: '响应' },
    ],
    transactions: [
      { id: 'ITI-83', name: 'Mobile PIX Query', description: '移动患者标识符查询' },
    ],
  },
];

export function getProfile(id: IheProfileId): IheProfileMeta | null {
  return IHE_PROFILES.find((p) => p.id === id) ?? null;
}

export function getDefaultAffinityDomain(): IheAffinityDomain { return DEFAULT_AFFINITY_DOMAIN; }

export function setDefaultAffinityDomain(d: IheAffinityDomain): void {
  Object.assign(DEFAULT_AFFINITY_DOMAIN, d);
}

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
