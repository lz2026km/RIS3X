// [G005 W10-Interop] 集成/互操作 MSW handlers (确定性, 内存态)
// 覆盖本 wave 新增端点:
//   - IHE XDS.b / XCA / XDR  (/ihe/xds/*, /ihe/xca/*, /ihe/xdr/*)
//   - 接口监控 + 持久化重试队列 (/interface-monitor/*)
//   - CDS Hooks (/cds-services/*)
//   - 报告发布 → HIS ORU^R01 (/hl7/oru/*)
// 注册于 handlers 数组最前 (静态子路径需先于既有参数/通配路由)。
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost/api/v1'; }
})();

const HOME_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.1';
const REMOTE_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.2';
const HOME_REPO = '1.2.840.113556.1.8000.2554.1.100';
const HOME_REPO_2 = '1.2.840.113556.1.8000.2554.1.101';
const REMOTE_REPO = '1.2.840.113556.1.8000.2554.2.100';

const nowIso = (offsetMin = 0): string => new Date(Date.now() - offsetMin * 60_000).toISOString();
const b64 = (s: string): string => {
  try { return btoa(unescape(encodeURIComponent(s))); } catch { return s; }
};

interface XdsDoc {
  id: string;
  uniqueId: string;
  patientId: string;
  repositoryUniqueId: string;
  homeCommunityId: string;
  title: string;
  classCode: string;
  formatCode: string;
  typeCode: string;
  mimeType: string;
  size: number;
  hash: string;
  creationTime: string;
  authorPerson?: string;
  authorInstitution?: string;
  availabilityStatus: 'APPROVED' | 'DEPRECATED';
  source: 'SUBMISSION' | 'SEED';
}

const docs = new Map<string, XdsDoc>();
const blobs = new Map<string, string>();

const blobKey = (repo: string, uid: string) => `${repo}^${uid}`;

const seedDoc = (
  uniqueId: string,
  patientId: string,
  repo: string,
  community: string,
  title: string,
  formatCode: string,
  mimeType: string,
  authorPerson: string | undefined,
  creationTime: string,
  content: string | undefined,
  size: number,
): void => {
  const doc: XdsDoc = {
    id: uniqueId,
    uniqueId,
    patientId,
    repositoryUniqueId: repo,
    homeCommunityId: community,
    title,
    classCode: 'RAD',
    formatCode,
    typeCode: formatCode === 'urn:ihe:rad:1' ? 'RAD-REPORT' : 'RAD-IMAGE',
    mimeType,
    size,
    hash: '6d5c' + uniqueId.slice(-8),
    creationTime,
    authorPerson,
    availabilityStatus: 'APPROVED',
    source: 'SEED',
  };
  docs.set(uniqueId, doc);
  if (content !== undefined) blobs.set(blobKey(repo, uniqueId), b64(content));
};

seedDoc('1.2.840.113556.1.8000.2554.1.100.1', 'P000023', HOME_REPO, HOME_COMMUNITY, '胸部 CT 平扫报告', 'urn:ihe:rad:1', 'application/pdf', '王建华^主任医师', '2026-06-28T09:12:00.000Z', 'CT chest plain report', 20);
seedDoc('1.2.840.113556.1.8000.2554.1.101.1', 'P000023', HOME_REPO_2, HOME_COMMUNITY, '胸部 CT 影像', 'urn:ihe:rad:2', 'application/dicom', undefined, '2026-06-28T09:05:00.000Z', undefined, 524288);
seedDoc('1.2.840.113556.1.8000.2554.2.100.1', 'P000023', REMOTE_REPO, REMOTE_COMMUNITY, '外院胸部 CT 基线影像', 'urn:ihe:rad:2', 'application/dicom', undefined, '2025-03-12T03:20:00.000Z', 'remote baseline dicom', 786432);
seedDoc('1.2.840.113556.1.8000.2554.1.100.2', 'P000047', HOME_REPO, HOME_COMMUNITY, '腰椎 MRI 报告', 'urn:ihe:rad:1', 'application/pdf', '李慧敏^副主任医师', '2026-05-20T07:40:00.000Z', 'MRI lumbar report', 17);

let docSeq = 0;
const newUniqueId = (): string => `2.25.mock${(++docSeq).toString(16).padStart(4, '0')}${Date.now().toString(16)}`;

const filterDocs = (q: {
  patientId?: string;
  classCode?: string;
  formatCode?: string;
  typeCode?: string;
  status?: string;
  homeCommunityId?: string;
  creationTimeFrom?: string;
  creationTimeTo?: string;
  limit?: number;
}): XdsDoc[] => {
  let rows = [...docs.values()];
  if (q.patientId) rows = rows.filter((d) => d.patientId === q.patientId);
  if (q.classCode) rows = rows.filter((d) => d.classCode === q.classCode);
  if (q.formatCode) rows = rows.filter((d) => d.formatCode === q.formatCode);
  if (q.typeCode) rows = rows.filter((d) => d.typeCode === q.typeCode);
  if (q.homeCommunityId) rows = rows.filter((d) => d.homeCommunityId === q.homeCommunityId);
  if (q.creationTimeFrom) rows = rows.filter((d) => d.creationTime >= q.creationTimeFrom!);
  if (q.creationTimeTo) rows = rows.filter((d) => d.creationTime <= q.creationTimeTo!);
  if (q.status && q.status !== 'ALL') rows = rows.filter((d) => d.availabilityStatus === q.status);
  rows.sort((a, b) => b.creationTime.localeCompare(a.creationTime));
  return rows.slice(0, Math.max(1, Math.min(q.limit ?? 100, 500)));
};

const statsOf = () => {
  const all = [...docs.values()];
  const byCommunity = new Map<string, number>();
  const byRepository = new Map<string, number>();
  let bytes = 0;
  for (const d of all) {
    byCommunity.set(d.homeCommunityId, (byCommunity.get(d.homeCommunityId) ?? 0) + 1);
    byRepository.set(d.repositoryUniqueId, (byRepository.get(d.repositoryUniqueId) ?? 0) + 1);
    bytes += d.size;
  }
  return {
    total: all.length,
    approved: all.filter((d) => d.availabilityStatus === 'APPROVED').length,
    deprecated: all.filter((d) => d.availabilityStatus === 'DEPRECATED').length,
    byCommunity: [...byCommunity.entries()].map(([homeCommunityId, count]) => ({ homeCommunityId, count })),
    byRepository: [...byRepository.entries()].map(([repositoryUniqueId, count]) => ({ repositoryUniqueId, count })),
    bytes,
  };
};

const communities = () => {
  const m = new Map<string, number>();
  for (const d of docs.values()) m.set(d.homeCommunityId, (m.get(d.homeCommunityId) ?? 0) + 1);
  return [...m.entries()].map(([homeCommunityId, count]) => ({ homeCommunityId, count }));
};

// ── 接口监控 内存态 ──
type IfaceType = 'HL7' | 'FHIR' | 'DICOM' | 'ORU' | 'XDS';
type MsgStatus = 'success' | 'fail' | 'retry' | 'pending';
type QueueStatus = 'pending' | 'retrying' | 'success' | 'dead_letter';

interface Message {
  id: string;
  interfaceType: IfaceType;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType: string;
  status: MsgStatus;
  ackStatus?: string;
  retryCount: number;
  patientId?: string;
  endpoint?: string;
  summary: string;
  createdAt: string;
}

interface QueueEntry {
  id: string;
  interfaceType: IfaceType;
  endpoint: string;
  payload: Record<string, unknown>;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

const MSG_SEED: Array<[IfaceType, MsgStatus, string, string]> = [
  ['HL7', 'success', 'ORU^R01', '报告结果发送 HIS'],
  ['HL7', 'success', 'ADT^A01', '患者入院更新'],
  ['HL7', 'fail', 'ORM^O01', '检查申请接收失败'],
  ['HL7', 'retry', 'SIU^S12', '预约排程重试'],
  ['FHIR', 'success', 'Patient', '患者资源同步'],
  ['FHIR', 'success', 'ImagingStudy', '影像研究发布'],
  ['FHIR', 'fail', 'DiagnosticReport', '诊断报告发布失败'],
  ['DICOM', 'success', 'C-STORE', '影像存储 PACS'],
  ['DICOM', 'retry', 'C-MOVE', '跨院调阅重试'],
  ['DICOM', 'fail', 'C-FIND', 'MWL 查询超时'],
  ['ORU', 'success', 'ORU^R01', '报告发布 ORU 投递'],
  ['XDS', 'success', 'ITI-41', '文档注册上架'],
  ['XDS', 'retry', 'ITI-43', '文档检索重试'],
];

let messages: Message[] = MSG_SEED.map(([interfaceType, status, messageType, summary], i) => ({
  id: `MSG-${String(i + 1).padStart(5, '0')}`,
  interfaceType,
  direction: interfaceType === 'DICOM' || interfaceType === 'XDS' ? 'INBOUND' : 'OUTBOUND',
  messageType,
  status,
  ackStatus: status === 'success' ? 'AA' : status === 'fail' ? 'AE' : undefined,
  retryCount: status === 'retry' ? 2 : 0,
  endpoint: `${interfaceType.toLowerCase()}://his.local/${i + 1}`,
  summary,
  createdAt: nowIso(5 + i * 7),
}));

const QUEUE_SEED: Array<[IfaceType, QueueStatus, number, number]> = [
  ['HL7', 'pending', 0, 3],
  ['FHIR', 'retrying', 1, 3],
  ['DICOM', 'dead_letter', 3, 3],
  ['XDS', 'success', 1, 3],
];

let queue: QueueEntry[] = QUEUE_SEED.map(([interfaceType, status, attempts, maxAttempts], i) => ({
  id: `RQ-${String(i + 1).padStart(5, '0')}`,
  interfaceType,
  endpoint: `${interfaceType.toLowerCase()}://his.local/retry/${i + 1}`,
  payload: { failTimes: status === 'dead_letter' ? 99 : 0 },
  status,
  attempts,
  maxAttempts,
  nextAttemptAt: nowIso(-10),
  lastError: status === 'dead_letter' ? 'exceeded maxAttempts=3' : undefined,
  createdAt: nowIso(30 + i * 5),
  updatedAt: nowIso(10 + i * 3),
}));

let seq = 0;
const persist = () => { /* noop: mock 内存态 */ };

const backoffMs = (attempts: number) => Math.min(1000 * 2 ** Math.max(0, attempts - 1), 60_000);

const attemptEntry = (e: QueueEntry): void => {
  const failTimes = Number((e.payload as { failTimes?: number })?.failTimes ?? 0);
  e.attempts += 1;
  e.updatedAt = new Date().toISOString();
  if (e.attempts > failTimes) {
    e.status = 'success';
    e.lastError = undefined;
    e.nextAttemptAt = e.updatedAt;
    return;
  }
  if (e.attempts >= e.maxAttempts) {
    e.status = 'dead_letter';
    e.lastError = `exceeded maxAttempts=${e.maxAttempts}`;
    e.nextAttemptAt = e.updatedAt;
    return;
  }
  e.status = 'retrying';
  e.lastError = `attempt ${e.attempts}/${e.maxAttempts} failed`;
  e.nextAttemptAt = new Date(Date.now() + backoffMs(e.attempts)).toISOString();
};

const statsOfInterface = () => {
  const types: IfaceType[] = ['HL7', 'FHIR', 'DICOM', 'ORU', 'XDS'];
  const success = messages.filter((m) => m.status === 'success').length;
  const fail = messages.filter((m) => m.status === 'fail').length;
  const retry = messages.filter((m) => m.status === 'retry').length;
  const pending = messages.filter((m) => m.status === 'pending').length;
  const countQ = (s: QueueStatus) => queue.filter((q) => q.status === s).length;
  return {
    totalMessages: messages.length,
    success,
    fail,
    retry,
    pending,
    successRate: messages.length > 0 ? Math.round((success / messages.length) * 100) : 0,
    byInterface: types.map((interfaceType) => {
      const rows = messages.filter((m) => m.interfaceType === interfaceType);
      return {
        interfaceType,
        total: rows.length,
        success: rows.filter((m) => m.status === 'success').length,
        fail: rows.filter((m) => m.status === 'fail').length,
        retry: rows.filter((m) => m.status === 'retry').length,
      };
    }),
    queue: {
      total: queue.length,
      pending: countQ('pending'),
      retrying: countQ('retrying'),
      success: countQ('success'),
      deadLetter: countQ('dead_letter'),
    },
  };
};

// ── HL7 ORU 消息日志 ──
interface OruRecord {
  id: string;
  reportId: string;
  examId?: string;
  controlId: string;
  messageType: 'ORU^R01';
  message: string;
  ackStatus: string;
  ackMessage?: string;
  endpoint: string;
  mode: 'MLLP' | 'STUB';
  attempts: number;
  status: 'SENT' | 'STUBBED' | 'FAILED';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const oruLog: OruRecord[] = [];
let oruSeq = 0;
let hisEndpoint = { host: '', port: 2576, enabled: false };

const buildOru = (reportId: string): string =>
  `MSH|^~\\&|G005_RIS|G005|HIS|HIS|${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}||ORU^R01|G005-${reportId}|P|2.5.1\r` +
  `PID|1||${reportId}||患者^示例\r` +
  `OBR|1|${reportId}||RAD|${reportId}\r` +
  `OBX|1|TX|FINDINGS||报告所见示例内容\r` +
  `OBX|2|TX|IMPRESSION||报告结论示例内容\r`;

// ── CDS Hooks ──
const CDS_SERVICES = [
  {
    hook: 'order-select',
    id: 'contrast-appropriateness',
    title: '造影剂适用性审查',
    description: '在开具增强检查时评估肾功能 (eGFR) / 儿童剂量 / 过敏史, 返回适用性卡片。',
  },
  {
    hook: 'order-sign',
    id: 'contrast-sign-check',
    title: '报告/医嘱签署前造影剂核查',
    description: '签署前再次核查 eGFR / 过敏 / 妊娠, 避免高风险对比剂使用。',
  },
];

interface CdsFeedback {
  id: string;
  serviceId: string;
  hook?: string;
  cardUuid?: string;
  outcome: string;
  overrideReason?: unknown;
  createdAt: string;
}
const cdsFeedback: CdsFeedback[] = [];

const isContrast = (ctx: Record<string, unknown>): boolean => {
  const orderText = JSON.stringify(ctx.draftOrders ?? ctx.orders ?? []).toLowerCase();
  const exam = `${ctx.examType ?? ''} ${ctx.modality ?? ''}`.toLowerCase();
  return /contrast|增强|造影|ce-|c\+/.test(orderText) || /增强|造影/.test(exam) || orderText.includes('with contrast');
};

const buildCdsCards = (ctx: Record<string, unknown>) => {
  const cards: Array<Record<string, unknown>> = [];
  if (!isContrast(ctx)) return cards;
  const egfr = typeof ctx.egfr === 'number' ? ctx.egfr : undefined;
  if (egfr !== undefined && egfr < 30) {
    cards.push({
      uuid: 'cds-card-egfr-low',
      summary: 'eGFR 显著降低 — 慎用碘对比剂',
      indicator: 'critical',
      detail: `患者 eGFR=${egfr} mL/min/1.73m² (<30)。建议改用非增强检查或充分评估收益/风险并做好水化。`,
      source: { label: 'ACR Manual on Contrast Media' },
      overrideReasons: [
        { code: 'benefit-outweighs-risk', display: '临床收益大于风险' },
        { code: 'already-dialyzed', display: '患者已行透析' },
      ],
    });
  } else if (egfr !== undefined && egfr < 45) {
    cards.push({
      uuid: 'cds-card-egfr-mid',
      summary: 'eGFR 轻中度降低 — 建议对比剂减量并水化',
      indicator: 'warning',
      detail: `患者 eGFR=${egfr} mL/min/1.73m² (<45)。建议使用低渗对比剂、最小化剂量并水化。`,
      source: { label: 'ACR Manual on Contrast Media' },
    });
  } else {
    cards.push({
      uuid: 'cds-card-egfr-ok',
      summary: '增强检查适用性通过',
      indicator: 'info',
      detail: '无明确对比剂禁忌, 请完成注射前核查。',
      source: { label: 'G005 造影剂安全闭环' },
    });
  }
  return cards;
};

export const w10InteropHandlers = [
  // ── IHE XDS.b ──
  http.post(`${API_BASE}/ihe/xds/provide`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as {
      patientId: string;
      repositoryUniqueId?: string;
      homeCommunityId?: string;
      documents: Array<Record<string, unknown>>;
    };
    if (!body?.patientId || !body?.documents?.length) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'patientId & documents required' } }, { status: 400 });
    }
    const repo = body.repositoryUniqueId ?? HOME_REPO;
    const community = body.homeCommunityId ?? HOME_COMMUNITY;
    const created = body.documents.map((d) => {
      const uniqueId = String(d.uniqueId ?? newUniqueId());
      const content = typeof d.content === 'string' ? d.content : undefined;
      const size = Number(d.size ?? (content ? Math.ceil((content.length * 3) / 4) : 0));
      const doc: XdsDoc = {
        id: uniqueId,
        uniqueId,
        patientId: body.patientId,
        repositoryUniqueId: repo,
        homeCommunityId: community,
        title: String(d.title ?? '未命名文档'),
        classCode: String(d.classCode ?? 'RAD'),
        formatCode: String(d.formatCode ?? 'urn:ihe:rad:1'),
        typeCode: String(d.typeCode ?? 'RAD-REPORT'),
        mimeType: String(d.mimeType ?? 'application/pdf'),
        size,
        hash: '6d5c' + uniqueId.slice(-8),
        creationTime: String(d.creationTime ?? new Date().toISOString()),
        authorPerson: typeof d.authorPerson === 'string' ? d.authorPerson : undefined,
        availabilityStatus: 'APPROVED',
        source: 'SUBMISSION',
      };
      docs.set(uniqueId, doc);
      if (content !== undefined) blobs.set(blobKey(repo, uniqueId), content);
      return doc;
    });
    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        transaction: 'ITI-41',
        mode: 'repository',
        repositoryUniqueId: repo,
        homeCommunityId: community,
        documentIds: created.map((d) => d.uniqueId),
        documents: created,
        submittedAt: new Date().toISOString(),
      },
    });
  }),

  http.post(`${API_BASE}/ihe/xdr/provide`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { patientId: string; homeCommunityId?: string; documents: Array<Record<string, unknown>> };
    const community = body.homeCommunityId ?? HOME_COMMUNITY;
    const repo = `xdr-${community}`;
    const created = (body.documents ?? []).map((d) => {
      const uniqueId = String(d.uniqueId ?? newUniqueId());
      const content = typeof d.content === 'string' ? d.content : undefined;
      const doc: XdsDoc = {
        id: uniqueId,
        uniqueId,
        patientId: body.patientId,
        repositoryUniqueId: repo,
        homeCommunityId: community,
        title: String(d.title ?? 'XDR 直传文档'),
        classCode: String(d.classCode ?? 'RAD'),
        formatCode: String(d.formatCode ?? 'urn:ihe:rad:1'),
        typeCode: 'RAD-REPORT',
        mimeType: String(d.mimeType ?? 'application/pdf'),
        size: Number(d.size ?? (content ? Math.ceil((content.length * 3) / 4) : 0)),
        hash: '6d5c' + uniqueId.slice(-8),
        creationTime: new Date().toISOString(),
        authorPerson: typeof d.authorPerson === 'string' ? d.authorPerson : undefined,
        availabilityStatus: 'APPROVED',
        source: 'SUBMISSION',
      };
      docs.set(uniqueId, doc);
      if (content !== undefined) blobs.set(blobKey(repo, uniqueId), content);
      return doc;
    });
    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        transaction: 'ITI-41',
        mode: 'direct',
        repositoryUniqueId: repo,
        homeCommunityId: community,
        documentIds: created.map((d) => d.uniqueId),
        documents: created,
        submittedAt: new Date().toISOString(),
      },
    });
  }),

  http.post(`${API_BASE}/ihe/xds/retrieve`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { homeCommunityId?: string; documents: Array<{ repositoryUniqueId: string; documentUniqueId: string }> };
    const results = (body.documents ?? []).map((item) => {
      const doc = docs.get(item.documentUniqueId);
      if (!doc) return { repositoryUniqueId: item.repositoryUniqueId, documentUniqueId: item.documentUniqueId, status: 'FAILURE', error: 'DocumentNotFound' };
      if (body.homeCommunityId && doc.homeCommunityId !== body.homeCommunityId) {
        return { repositoryUniqueId: item.repositoryUniqueId, documentUniqueId: item.documentUniqueId, homeCommunityId: doc.homeCommunityId, status: 'FAILURE', error: 'HomeCommunityMismatch' };
      }
      const content = blobs.get(blobKey(doc.repositoryUniqueId, doc.uniqueId));
      return {
        repositoryUniqueId: doc.repositoryUniqueId,
        documentUniqueId: doc.uniqueId,
        homeCommunityId: doc.homeCommunityId,
        mimeType: doc.mimeType,
        size: doc.size,
        hash: doc.hash,
        content,
        status: content ? 'SUCCESS' : 'FAILURE',
        error: content ? undefined : 'DocumentContentUnavailable',
      };
    });
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    return HttpResponse.json({ success: true, data: { transaction: 'ITI-43', results, successCount, failureCount: results.length - successCount } });
  }),

  http.post(`${API_BASE}/ihe/xds/query`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const rows = filterDocs(body as Parameters<typeof filterDocs>[0]);
    return HttpResponse.json({ success: true, data: { transaction: 'ITI-18', total: rows.length, documents: rows } });
  }),

  http.get(`${API_BASE}/ihe/xds/documents`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const rows = filterDocs({
      patientId: url.searchParams.get('patientId') ?? undefined,
      classCode: url.searchParams.get('classCode') ?? undefined,
      formatCode: url.searchParams.get('formatCode') ?? undefined,
      homeCommunityId: url.searchParams.get('homeCommunityId') ?? undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });
    return HttpResponse.json({ success: true, data: { transaction: 'ITI-18', total: rows.length, documents: rows } });
  }),

  http.get(`${API_BASE}/ihe/xds/stats`, async () => {
    await delay(60);
    return HttpResponse.json({ success: true, data: { transaction: 'ITI-18', communities: communities(), stats: statsOf() } });
  }),

  // ── XCA ──
  http.post(`${API_BASE}/ihe/xca/query`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { homeCommunityId?: string } & Record<string, unknown>;
    const scoped = body.homeCommunityId === 'ALL' ? { ...body, homeCommunityId: undefined } : body;
    const rows = filterDocs(scoped as Parameters<typeof filterDocs>[0]);
    const by = new Map<string, number>();
    for (const d of rows) by.set(d.homeCommunityId, (by.get(d.homeCommunityId) ?? 0) + 1);
    return HttpResponse.json({
      success: true,
      data: {
        transaction: 'ITI-38',
        homeCommunityId: body.homeCommunityId ?? 'ALL',
        total: rows.length,
        communities: [...by.entries()].map(([homeCommunityId, count]) => ({ homeCommunityId, count })),
        documents: rows,
      },
    });
  }),

  http.post(`${API_BASE}/ihe/xca/retrieve`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { homeCommunityId: string; documents: Array<{ repositoryUniqueId: string; documentUniqueId: string }> };
    const results = (body.documents ?? []).map((item) => {
      const doc = docs.get(item.documentUniqueId);
      if (!doc) return { repositoryUniqueId: item.repositoryUniqueId, documentUniqueId: item.documentUniqueId, status: 'FAILURE', error: 'DocumentNotFound' };
      if (body.homeCommunityId && body.homeCommunityId !== 'ALL' && doc.homeCommunityId !== body.homeCommunityId) {
        return { repositoryUniqueId: item.repositoryUniqueId, documentUniqueId: item.documentUniqueId, homeCommunityId: doc.homeCommunityId, status: 'FAILURE', error: 'HomeCommunityMismatch' };
      }
      const content = blobs.get(blobKey(doc.repositoryUniqueId, doc.uniqueId));
      return { repositoryUniqueId: doc.repositoryUniqueId, documentUniqueId: doc.uniqueId, homeCommunityId: doc.homeCommunityId, mimeType: doc.mimeType, size: doc.size, hash: doc.hash, content, status: content ? 'SUCCESS' : 'FAILURE' };
    });
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    return HttpResponse.json({ success: true, data: { transaction: 'ITI-39', homeCommunityId: body.homeCommunityId, results, successCount, failureCount: results.length - successCount } });
  }),

  // ── 接口监控 ──
  http.get(`${API_BASE}/interface-monitor/messages`, async ({ request }) => {
    await delay(70);
    const url = new URL(request.url);
    const iface = url.searchParams.get('interfaceType');
    const status = url.searchParams.get('status');
    let rows = [...messages];
    if (iface) rows = rows.filter((m) => m.interfaceType === iface);
    if (status) rows = rows.filter((m) => m.status === status);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;
    return HttpResponse.json({ success: true, data: { total: rows.length, entries: rows.slice(0, Math.max(1, Math.min(limit, 500))) } });
  }),

  http.post(`${API_BASE}/interface-monitor/messages`, async ({ request }) => {
    await delay(40);
    const body = (await request.json()) as Partial<Message> & { interfaceType: IfaceType };
    const entry: Message = {
      id: `MSG-${String(++seq + 1000).padStart(5, '0')}`,
      interfaceType: body.interfaceType,
      direction: body.direction ?? 'OUTBOUND',
      messageType: body.messageType ?? 'UNKNOWN',
      status: body.status ?? 'pending',
      ackStatus: body.ackStatus,
      retryCount: body.retryCount ?? 0,
      endpoint: body.endpoint,
      summary: body.summary ?? body.messageType ?? 'UNKNOWN',
      createdAt: new Date().toISOString(),
    };
    messages.unshift(entry);
    return HttpResponse.json({ success: true, data: entry }, { status: 201 });
  }),

  http.get(`${API_BASE}/interface-monitor/stats`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: statsOfInterface() });
  }),

  http.get(`${API_BASE}/interface-monitor/dead-letter`, async () => {
    await delay(50);
    const rows = queue.filter((q) => q.status === 'dead_letter');
    return HttpResponse.json({ success: true, data: { total: rows.length, entries: rows } });
  }),

  http.get(`${API_BASE}/interface-monitor/queue`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const iface = url.searchParams.get('interfaceType');
    let rows = [...queue];
    if (status) rows = rows.filter((q) => q.status === status);
    if (iface) rows = rows.filter((q) => q.interfaceType === iface);
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;
    return HttpResponse.json({ success: true, data: { total: rows.length, entries: rows.slice(0, Math.max(1, Math.min(limit, 500))) } });
  }),

  http.post(`${API_BASE}/interface-monitor/queue`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as { interfaceType?: IfaceType; endpoint: string; payload?: Record<string, unknown>; maxAttempts?: number };
    if (!body?.endpoint) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'endpoint is required' } }, { status: 400 });
    const now = new Date().toISOString();
    const entry: QueueEntry = {
      id: `RQ-G${String(++seq).padStart(4, '0')}`,
      interfaceType: body.interfaceType ?? 'HL7',
      endpoint: body.endpoint,
      payload: body.payload ?? {},
      status: 'pending',
      attempts: 0,
      maxAttempts: body.maxAttempts ?? 3,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    };
    queue.push(entry);
    persist();
    return HttpResponse.json({ success: true, data: entry }, { status: 201 });
  }),

  http.post(`${API_BASE}/interface-monitor/queue/process`, async () => {
    await delay(120);
    const now = new Date().toISOString();
    const due = queue.filter((q) => (q.status === 'pending' || q.status === 'retrying') && q.nextAttemptAt <= now);
    let succeeded = 0;
    let retried = 0;
    let deadLettered = 0;
    for (const e of due) {
      attemptEntry(e);
      if (e.status === 'success') succeeded += 1;
      else if (e.status === 'dead_letter') deadLettered += 1;
      else retried += 1;
      messages.unshift({
        id: `MSG-${String(++seq + 2000).padStart(5, '0')}`,
        interfaceType: e.interfaceType,
        direction: 'OUTBOUND',
        messageType: `RETRY:${e.interfaceType}`,
        status: e.status === 'success' ? 'success' : e.status === 'dead_letter' ? 'fail' : 'retry',
        retryCount: e.attempts,
        endpoint: e.endpoint,
        summary: `重试队列 ${e.id} → ${e.status}`,
        createdAt: new Date().toISOString(),
      });
    }
    persist();
    return HttpResponse.json({ success: true, data: { processed: due.length, succeeded, retried, deadLettered, entries: due } });
  }),

  http.post(`${API_BASE}/interface-monitor/queue/:id/retry`, async ({ params }) => {
    await delay(50);
    const e = queue.find((q) => q.id === params.id);
    if (!e) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 });
    if (e.status === 'success' || e.status === 'dead_letter') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '请先 requeue' } }, { status: 400 });
    }
    e.status = 'pending';
    e.nextAttemptAt = new Date().toISOString();
    e.lastError = undefined;
    e.updatedAt = new Date().toISOString();
    persist();
    return HttpResponse.json({ success: true, data: e });
  }),

  http.post(`${API_BASE}/interface-monitor/queue/:id/dead-letter`, async ({ params }) => {
    await delay(50);
    const e = queue.find((q) => q.id === params.id);
    if (!e) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 });
    e.status = 'dead_letter';
    e.updatedAt = new Date().toISOString();
    persist();
    return HttpResponse.json({ success: true, data: e });
  }),

  http.post(`${API_BASE}/interface-monitor/queue/:id/requeue`, async ({ params }) => {
    await delay(50);
    const e = queue.find((q) => q.id === params.id);
    if (!e) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 });
    e.status = 'pending';
    e.attempts = 0;
    e.lastError = undefined;
    e.nextAttemptAt = new Date().toISOString();
    e.updatedAt = new Date().toISOString();
    persist();
    return HttpResponse.json({ success: true, data: e });
  }),

  // ── CDS Hooks ──
  http.get(`${API_BASE}/cds-services`, async () => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { services: CDS_SERVICES } });
  }),

  http.get(`${API_BASE}/cds-services/feedback`, async () => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { total: cdsFeedback.length, entries: [...cdsFeedback] } });
  }),

  http.post(`${API_BASE}/cds-services/feedback`, async ({ request }) => {
    await delay(40);
    const body = (await request.json()) as { serviceId: string; hook?: string; cardUuid?: string; outcome: string; overrideReason?: unknown };
    const record: CdsFeedback = {
      id: `CDSFB-${String(++seq).padStart(5, '0')}`,
      serviceId: body.serviceId,
      hook: body.hook,
      cardUuid: body.cardUuid,
      outcome: body.outcome,
      overrideReason: body.overrideReason,
      createdAt: new Date().toISOString(),
    };
    cdsFeedback.unshift(record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  http.post(`${API_BASE}/cds-services/:serviceId`, async ({ params, request }) => {
    await delay(80);
    const service = CDS_SERVICES.find((s) => s.id === params.serviceId);
    if (!service) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'service not found' } }, { status: 404 });
    const body = (await request.json()) as { context?: Record<string, unknown> };
    const cards = buildCdsCards(body?.context ?? {});
    return HttpResponse.json({ success: true, data: { cards } });
  }),

  // ── HL7 ORU^R01 ──
  http.get(`${API_BASE}/hl7/oru/endpoint`, async () => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { ...hisEndpoint } });
  }),

  http.post(`${API_BASE}/hl7/oru/endpoint`, async ({ request }) => {
    await delay(40);
    const body = (await request.json()) as { host?: string; port?: number; enabled?: boolean };
    hisEndpoint = { ...hisEndpoint, ...body };
    return HttpResponse.json({ success: true, data: { ...hisEndpoint } });
  }),

  http.get(`${API_BASE}/hl7/oru/messages`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    const status = url.searchParams.get('status');
    const ackStatus = url.searchParams.get('ackStatus');
    let rows = [...oruLog];
    if (reportId) rows = rows.filter((r) => r.reportId === reportId);
    if (status) rows = rows.filter((r) => r.status === status);
    if (ackStatus) rows = rows.filter((r) => r.ackStatus === ackStatus);
    rows.reverse();
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;
    return HttpResponse.json({ success: true, data: { total: rows.length, entries: rows.slice(0, Math.max(1, Math.min(limit, 500))) } });
  }),

  http.get(`${API_BASE}/hl7/oru/messages/:id`, async ({ params }) => {
    await delay(40);
    const record = oruLog.find((r) => r.id === params.id);
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: record });
  }),

  http.post(`${API_BASE}/hl7/oru/publish`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { reportId: string; examId?: string };
    if (!body?.reportId) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'reportId is required' } }, { status: 400 });
    const message = buildOru(body.reportId);
    const controlId = `G005-${body.reportId}`;
    const mode: 'MLLP' | 'STUB' = hisEndpoint.enabled && hisEndpoint.host ? 'MLLP' : 'STUB';
    const now = new Date().toISOString();
    const record: OruRecord = {
      id: `ORU-${String(++oruSeq).padStart(4, '0')}-${body.reportId}`,
      reportId: body.reportId,
      examId: body.examId,
      controlId,
      messageType: 'ORU^R01',
      message,
      ackStatus: 'AA',
      ackMessage: `MSH|^~\\&|HIS|HIS_RECEIVER|G005|G005|${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}||ACK^R01|ACK-${controlId}|P|2.5.1\rMSA|AA|${controlId}\r`,
      endpoint: mode === 'MLLP' ? `${hisEndpoint.host}:${hisEndpoint.port}` : 'stub://his.local/oru',
      mode,
      attempts: 1,
      status: 'STUBBED',
      createdAt: now,
      updatedAt: now,
    };
    oruLog.push(record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  http.post(`${API_BASE}/hl7/oru/messages/:id/resend`, async ({ params }) => {
    await delay(120);
    const record = oruLog.find((r) => r.id === params.id);
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 });
    record.attempts += 1;
    record.updatedAt = new Date().toISOString();
    record.ackStatus = 'AA';
    record.status = 'STUBBED';
    record.error = undefined;
    return HttpResponse.json({ success: true, data: record });
  }),
];
