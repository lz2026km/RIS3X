/**
 * G005 放射RIS系统 v3.0.6.0 - HL7 v2.x 完整解析器
 * 60 升级点:段解析 / 字段 / 组件 / 子组件 / 重复 / 转义
 *      ADT/ORM/ORU/DFT/MDM 报文识别 / 验证
 */

import type {
  Hl7Segment, Hl7SegmentName, Hl7Field, Hl7EncodingCharacters, Hl7FieldValue,
  Hl7ParsedMessage, Hl7ValidationResult, Hl7ValidationIssue, Hl7Component,
} from '../../../types/integration';

export type { Hl7Segment, Hl7SegmentName, Hl7Field, Hl7EncodingCharacters, Hl7FieldValue, Hl7ParsedMessage, Hl7ValidationResult, Hl7ValidationIssue, Hl7Component };

// HL7 v2.x 默认编码字符:<FS> ^ ~ \ &
const DEFAULT_ENCODING: Hl7EncodingCharacters = {
  fieldSeparator: '|',
  componentSeparator: '^',
  repetitionSeparator: '~',
  escapeCharacter: '\\',
  subcomponentSeparator: '&',
};

// HL7 v2.5 段名集合(用于快速校验)
const VALID_SEGMENT_NAMES: ReadonlySet<string> = new Set<Hl7SegmentName>([
  'MSH', 'PID', 'PV1', 'PV2', 'OBR', 'OBX', 'ORC', 'AL1', 'DG1',
  'NK1', 'EVN', 'PD1', 'PR1', 'IN1', 'GT1', 'MRG', 'NTE', 'MSA',
  'ERR', 'QPD', 'QAK', 'RCP', 'RDS', 'RXA', 'RXE', 'RXO', 'RXD',
  'SCH', 'TXA', 'PDC', 'FT1', 'CSP', 'CSR', 'CSS', 'AIS', 'AIG',
  'AIL', 'AIP', 'APR', 'BHS', 'FHS', 'BTS', 'FTS', 'DSP',
]);

// 支持的报文类型(根据 messageType^triggerEvent 拆分)
const SUPPORTED_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'ADT^A01', 'ADT^A02', 'ADT^A03', 'ADT^A04', 'ADT^A05', 'ADT^A08', 'ADT^A11', 'ADT^A12', 'ADT^A13',
  'ORM^O01', 'ORU^R01', 'ORU^R02', 'DFT^P03', 'MDM^T02', 'MDM^T04', 'MDM^T06', 'MDM^T07', 'MDM^T08', 'MDM^T10',
  'ACK', 'SIU^S12', 'SIU^S13', 'SIU^S14', 'SIU^S15', 'SIU^S22', 'SIU^S23', 'SIU^S26',
  'BAR^P01', 'BAR^P02', 'MFN^M01', 'MFK^M01', 'VXU^V04',
  'RSP^K11', 'RSP^K21', 'RSP^K22', 'RSP^K23', 'RSP^K25', 'RSP^K27', 'RSP^Q11', 'RSP^Z82',
  'QBP^Q11', 'QBP^Q21', 'QBP^Q22', 'QBP^Q23', 'QBP^Q24', 'QBP^Q25', 'QBP^Z73',
]);

// ============================================================
// 1. 编码字符解析
// ============================================================
function parseEncodingFromMsh(segRaw: string): Hl7EncodingCharacters {
  if (segRaw.length < 8) return DEFAULT_ENCODING;
  return {
    fieldSeparator: segRaw.charAt(3),
    componentSeparator: segRaw.charAt(4),
    repetitionSeparator: segRaw.charAt(5),
    escapeCharacter: segRaw.charAt(6),
    subcomponentSeparator: segRaw.charAt(7),
  };
}

// ============================================================
// 2. 段切分(支持 \r 与 \n 同时作为分隔符;生产环境用 \r)
// ============================================================
function splitSegments(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\r')
    .replace(/\n/g, '\r')
    .split('\r')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ============================================================
// 3. 单段解析
// ============================================================
function parseSegment(rawSeg: string, enc: Hl7EncodingCharacters, order: number): Hl7Segment | null {
  if (rawSeg.length < 3) return null;
  const name = rawSeg.slice(0, 3);
  if (!VALID_SEGMENT_NAMES.has(name)) return null;
  const fieldRawList = rawSeg.split(enc.fieldSeparator);
  const fields: Hl7Field[] = [];

  for (let i = 0; i < fieldRawList.length; i++) {
    const raw = fieldRawList[i] ?? '';
    const reps = raw.split(enc.repetitionSeparator);
    const components = reps.length === 1
      ? raw.split(enc.componentSeparator)
      : reps.map((r) => r.split(enc.componentSeparator));
    const repetitions = reps;
    let value: Hl7FieldValue = raw;
    if (reps.length > 1) value = components as Hl7Component[];
    else if ((components as string[]).length > 1) value = components as Hl7Component[];

    fields.push({
      index: i,
      raw,
      value,
      components: Array.isArray(components) && Array.isArray((components as string[])[0])
        ? (components as string[][]).map((c) => c.join(enc.subcomponentSeparator))
        : (components as string[]),
      repetitions,
    });
  }
  return { name: name as Hl7SegmentName, fields, raw: rawSeg, order };
}

// ============================================================
// 4. MSH 段字段读取(MSH-1 字段分隔符;MSH-2 编码字符;字段从 MSH-3 开始计数)
// ============================================================
function getMshField(seg: Hl7Segment, idx1Based: number): string {
  const f = seg.fields[idx1Based];
  return f ? f.raw : '';
}

function getComponentValue(seg: Hl7Segment, idx1Based: number, component: number): string {
  const f = seg.fields[idx1Based];
  if (!f) return '';
  const c = f.components[component];
  return c ?? '';
}

// ============================================================
// 5. 报文解析
// ============================================================
export function parse(message: string): Hl7ParsedMessage {
  if (!message || message.length === 0) {
    throw new Error('HL7 报文为空');
  }
  const segments = splitSegments(message);
  if (segments.length === 0) {
    throw new Error('HL7 报文无有效段');
  }
  const mshRaw = segments[0];
  if (!mshRaw || !mshRaw.startsWith('MSH')) {
    throw new Error('第一段必须为 MSH');
  }
  const encoding = parseEncodingFromMsh(mshRaw);
  const parsedSegments: Hl7Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i];
    if (!raw) continue;
    const seg = parseSegment(raw, encoding, i);
    if (seg) parsedSegments.push(seg);
  }
  if (parsedSegments.length === 0) {
    throw new Error('HL7 报文解析后无有效段');
  }
  const msh = parsedSegments[0];
  if (!msh) throw new Error('MSH 段丢失');
  const messageTypeField = getMshField(msh, 9);
  const [typeRaw, triggerRaw] = messageTypeField.split(encoding.componentSeparator);
  const messageType = typeRaw ?? '';
  const triggerEvent = triggerRaw ?? '';
  const messageControlId = getMshField(msh, 10);
  const sendingApplication = getComponentValue(msh, 3, 0);
  const sendingFacility = getComponentValue(msh, 4, 0);
  const receivingApplication = getComponentValue(msh, 5, 0);
  const receivingFacility = getComponentValue(msh, 6, 0);
  const timestamp = getMshField(msh, 7);
  const version = getMshField(msh, 12);
  const processingId = getMshField(msh, 11);
  const patient = parsedSegments.find((s) => s.name === 'PID');
  const visit = parsedSegments.find((s) => s.name === 'PV1');
  const order = parsedSegments.filter((s) => s.name === 'OBR' || s.name === 'ORC');
  const observations = parsedSegments.filter((s) => s.name === 'OBX');
  const notes = parsedSegments.filter((s) => s.name === 'NTE');
  return {
    raw: message,
    encoding,
    msh,
    segments: parsedSegments,
    messageType: `${messageType}^${triggerEvent}`,
    triggerEvent,
    messageControlId,
    sendingApplication,
    sendingFacility,
    receivingApplication,
    receivingFacility,
    timestamp,
    version: version || '2.5',
    processingId: processingId || 'P',
    patient,
    visit,
    order,
    observations,
    notes,
  };
}

// ============================================================
// 6. 报文序列化(对象 → 字符串)
// ============================================================
function escapeFieldValue(value: string, enc: Hl7EncodingCharacters): string {
  return value
    .split(enc.escapeCharacter).join(`${enc.escapeCharacter}E${enc.escapeCharacter}`)
    .split(enc.fieldSeparator).join(`${enc.escapeCharacter}F${enc.escapeCharacter}`)
    .split(enc.componentSeparator).join(`${enc.escapeCharacter}S${enc.escapeCharacter}`)
    .split(enc.subcomponentSeparator).join(`${enc.escapeCharacter}T${enc.escapeCharacter}`)
    .split(enc.repetitionSeparator).join(`${enc.escapeCharacter}R${enc.escapeCharacter}`);
}

export interface Hl7SegmentInput {
  name: Hl7SegmentName | string;
  fields: (string | { value: string; components?: string[] } | null | undefined)[];
}

export function serialize(msg: {
  encoding?: Hl7EncodingCharacters;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp?: string;
  messageType: string;
  messageControlId: string;
  processingId?: string;
  version?: string;
  segments: Hl7SegmentInput[];
}): string {
  const enc = msg.encoding ?? DEFAULT_ENCODING;
  const ts = msg.timestamp ?? formatHl7Timestamp(new Date());
  const mshFields: string[] = [
    enc.fieldSeparator,
    [enc.componentSeparator, enc.repetitionSeparator, enc.escapeCharacter, enc.subcomponentSeparator].join(''),
    msg.sendingApplication,
    msg.sendingFacility,
    msg.receivingApplication,
    msg.receivingFacility,
    ts,
    '',
    msg.messageType,
    msg.messageControlId,
    msg.processingId ?? 'P',
    msg.version ?? '2.5',
  ];
  const msh = 'MSH' + mshFields.map((f) => enc.fieldSeparator + escapeFieldValue(f, enc)).join('');
  const otherSegs = msg.segments
    .filter((s) => s.name !== 'MSH')
    .map((s) => {
      const head = `${s.name}`;
      const body = s.fields
        .slice(1)
        .map((f) => {
          if (f === null || f === undefined) return '';
          if (typeof f === 'string') return escapeFieldValue(f, enc);
          return escapeFieldValue(f.value, enc);
        })
        .join(enc.fieldSeparator);
      return head + enc.fieldSeparator + body;
    });
  return [msh, ...otherSegs].join('\r');
}

// ============================================================
// 7. 时间戳格式化 HL7 YYYYMMDDHHMMSS[.S+zzzz]
// ============================================================
export function formatHl7Timestamp(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}${hh}${mm}${ss}`;
}

export function parseHl7Timestamp(ts: string): Date | null {
  const cleaned = ts.replace(/[^0-9]/g, '').slice(0, 14);
  if (cleaned.length < 8) return null;
  const y = Number(cleaned.slice(0, 4));
  const m = Number(cleaned.slice(4, 6));
  const d = Number(cleaned.slice(6, 8));
  const hh = cleaned.length >= 10 ? Number(cleaned.slice(8, 10)) : 0;
  const mm = cleaned.length >= 12 ? Number(cleaned.slice(10, 12)) : 0;
  const ss = cleaned.length >= 14 ? Number(cleaned.slice(12, 14)) : 0;
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
}

// ============================================================
// 8. 验证
// ============================================================
export function validate(msg: Hl7ParsedMessage | string): Hl7ValidationResult {
  const issues: Hl7ValidationIssue[] = [];
  const parsed = typeof msg === 'string' ? parse(msg) : msg;
  // 1. MSH 必填
  if (!parsed.msh) {
    issues.push({ level: 'error', code: 'MSH001', message: 'MSH 段缺失' });
    return finalize(issues);
  }
  const msh = parsed.msh;
  if (msh.fields.length < 12) {
    issues.push({ level: 'error', code: 'MSH002', message: 'MSH 字段数不足 12', segment: 'MSH' });
  }
  const msgTypeField = getMshField(msh, 9);
  if (!msgTypeField) {
    issues.push({ level: 'error', code: 'MSH009', message: 'MSH-9 消息类型为空', segment: 'MSH', field: 9 });
  } else {
    const key = msgTypeField.replace(/[^A-Za-z0-9^]/g, '');
    if (!SUPPORTED_MESSAGE_TYPES.has(key) && !key.startsWith('ACK')) {
      issues.push({ level: 'warning', code: 'MSH009W', message: `不支持的报文类型 ${key}`, segment: 'MSH', field: 9 });
    }
  }
  if (!getMshField(msh, 10)) {
    issues.push({ level: 'error', code: 'MSH010', message: 'MSH-10 消息控制 ID 缺失', segment: 'MSH', field: 10 });
  }
  if (!getMshField(msh, 3)) {
    issues.push({ level: 'warning', code: 'MSH003W', message: 'MSH-3 发送应用为空', segment: 'MSH', field: 3 });
  }
  if (!getMshField(msh, 4)) {
    issues.push({ level: 'warning', code: 'MSH004W', message: 'MSH-4 发送设施为空', segment: 'MSH', field: 4 });
  }
  if (!getMshField(msh, 7)) {
    issues.push({ level: 'error', code: 'MSH007', message: 'MSH-7 时间戳为空', segment: 'MSH', field: 7 });
  } else {
    const d = parseHl7Timestamp(getMshField(msh, 7));
    if (!d || isNaN(d.getTime())) {
      issues.push({ level: 'warning', code: 'MSH007W', message: `MSH-7 时间戳格式异常: ${getMshField(msh, 7)}`, segment: 'MSH', field: 7 });
    }
  }
  const ver = getMshField(msh, 12);
  if (!ver) {
    issues.push({ level: 'warning', code: 'MSH012W', message: 'MSH-12 版本号为空,默认 2.5', segment: 'MSH', field: 12 });
  } else if (!/^2\.[3-8](\.[0-9])?$/.test(ver)) {
    issues.push({ level: 'warning', code: 'MSH012X', message: `MSH-12 版本号 ${ver} 不在 2.3-2.8 范围`, segment: 'MSH', field: 12 });
  }
  // 2. 报文类型特定校验
  if (parsed.messageType.startsWith('ADT^') && !parsed.patient) {
    issues.push({ level: 'error', code: 'PID001', message: 'ADT 报文缺少 PID 段' });
  }
  if (parsed.messageType.startsWith('ORM^') && (parsed.order?.length ?? 0) === 0) {
    issues.push({ level: 'error', code: 'ORC001', message: 'ORM 报文缺少 ORC/OBR 段' });
  }
  if (parsed.messageType.startsWith('ORU^')) {
    if ((parsed.order?.length ?? 0) === 0) issues.push({ level: 'error', code: 'OBR001', message: 'ORU 报文缺少 OBR 段' });
    if (parsed.observations && parsed.observations.length === 0) {
      issues.push({ level: 'warning', code: 'OBX001W', message: 'ORU 报文无 OBX 观察段' });
    }
  }
  if (parsed.messageType.startsWith('DFT^')) {
    const ft1 = parsed.segments.find((s) => s.name === 'FT1');
    if (!ft1) issues.push({ level: 'warning', code: 'FT1001W', message: 'DFT 报文缺少 FT1 财务段' });
  }
  if (parsed.messageType.startsWith('MDM^')) {
    const txa = parsed.segments.find((s) => s.name === 'TXA');
    if (!txa) issues.push({ level: 'error', code: 'TXA001', message: 'MDM 报文缺少 TXA 文档索引段' });
  }
  // 3. PID 校验
  if (parsed.patient) {
    const pid3 = parsed.patient.fields[3];
    if (!pid3 || !pid3.raw) {
      issues.push({ level: 'error', code: 'PID003', message: 'PID-3 患者 ID 列表为空', segment: 'PID', field: 3 });
    }
  }
  // 4. OBX 校验
  if (parsed.observations) {
    parsed.observations.forEach((obx, idx) => {
      const obx2 = obx.fields[2];
      if (!obx2 || !obx2.raw) {
        issues.push({ level: 'error', code: 'OBX002', message: `第 ${idx + 1} 个 OBX 段缺少观察标识`, segment: 'OBX', field: 2 });
      }
    });
  }
  return finalize(issues);
}

function finalize(issues: Hl7ValidationIssue[]): Hl7ValidationResult {
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  return { passed: errors === 0, issues, errors, warnings };
}

// ============================================================
// 9. 报文类型识别与构造器
// ============================================================
export type AdtTrigger = 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A08' | 'A11' | 'A12' | 'A13';

export function buildAdtMessage(opts: {
  trigger: AdtTrigger;
  sendingApp?: string;
  sendingFacility?: string;
  receivingApp?: string;
  receivingFacility?: string;
  patientId: string;
  patientName: string;
  birthDate?: string;
  sex?: 'M' | 'F' | 'O' | 'U';
  address?: string;
  phone?: string;
  attendingDoctor?: string;
  visitClass?: 'I' | 'O' | 'E' | 'P' | 'R';
  admitDateTime?: string;
  dischargeDateTime?: string;
  controlId?: string;
  timestamp?: string;
  version?: string;
}): string {
  const controlId = opts.controlId ?? `ADT-${Date.now()}`;
  const segments: Hl7SegmentInput[] = [
    { name: 'PID', fields: [
      null,
      '1',
      null,
      `${opts.patientId}^^^HOSPITAL^MR`,
      `${opts.patientId}^^^HOSPITAL^MR`,
      opts.patientName,
      null,
      opts.birthDate ?? '',
      opts.sex ?? 'O',
      null,
      null,
      opts.address ?? '',
      null,
      null,
      opts.phone ?? '',
    ] },
  ];
  if (opts.attendingDoctor || opts.visitClass || opts.admitDateTime) {
    segments.push({ name: 'PV1', fields: [
      null,
      opts.visitClass ?? 'O',
      null,
      null,
      null,
      null,
      null,
      null,
      opts.attendingDoctor ?? '',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      opts.admitDateTime ?? '',
      opts.dischargeDateTime ?? '',
    ] });
  }
  return serialize({
    sendingApplication: opts.sendingApp ?? 'RIS',
    sendingFacility: opts.sendingFacility ?? 'G005',
    receivingApplication: opts.receivingApp ?? 'RECEIVER',
    receivingFacility: opts.receivingFacility ?? 'FACILITY',
    timestamp: opts.timestamp,
    messageType: `ADT^${opts.trigger}`,
    messageControlId: controlId,
    version: opts.version ?? '2.5',
    segments,
  });
}

export function buildOrmMessage(opts: {
  patientId: string;
  patientName: string;
  orderId: string;
  procedureCode: string;
  procedureName: string;
  scheduledDate?: string;
  orderingProvider?: string;
  controlId?: string;
  version?: string;
}): string {
  return serialize({
    sendingApplication: 'RIS', sendingFacility: 'G005',
    receivingApplication: 'PACS', receivingFacility: 'FACILITY',
    messageType: 'ORM^O01',
    messageControlId: opts.controlId ?? `ORM-${Date.now()}`,
    version: opts.version ?? '2.5',
    segments: [
      { name: 'PID', fields: [null, '1', null, `${opts.patientId}^^^HOSPITAL^MR`, `${opts.patientId}^^^HOSPITAL^MR`, opts.patientName] },
      { name: 'ORC', fields: [null, 'NW', opts.orderId, null, null, null, null, null, null, null, null, null, opts.orderingProvider ?? ''] },
      { name: 'OBR', fields: [
        null, '1', opts.orderId, null,
        `${opts.procedureCode}^${opts.procedureName}`,
        null, null, null, null, null,
        opts.scheduledDate ?? '',
        null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      ] },
    ],
  });
}

export function buildOruMessage(opts: {
  patientId: string;
  patientName: string;
  accessionNumber: string;
  procedureCode: string;
  procedureName?: string;
  observations: { code: string; name: string; value: string; units?: string; valueType?: 'TX' | 'NM' | 'CE' | 'ST' }[];
  reportDate?: string;
  controlId?: string;
  version?: string;
}): string {
  const obxSegs: Hl7SegmentInput[] = opts.observations.map((o, i) => ({
    name: 'OBX', fields: [
      null,
      String(i + 1),
      o.valueType ?? 'TX',
      `${o.code}^${o.name}`,
      null,
      o.value,
      o.units ?? '',
      null, null, null,
    ],
  }));
  return serialize({
    sendingApplication: 'RIS', sendingFacility: 'G005',
    receivingApplication: 'EMR', receivingFacility: 'FACILITY',
    messageType: 'ORU^R01',
    messageControlId: opts.controlId ?? `ORU-${Date.now()}`,
    version: opts.version ?? '2.5',
    segments: [
      { name: 'PID', fields: [null, '1', null, `${opts.patientId}^^^HOSPITAL^MR`, `${opts.patientId}^^^HOSPITAL^MR`, opts.patientName] },
      { name: 'OBR', fields: [
        null, '1', opts.accessionNumber, null,
        `${opts.procedureCode}^${opts.procedureName ?? ''}`,
        null, null, null, null, null,
        opts.reportDate ?? formatHl7Timestamp(new Date()),
      ] },
      ...obxSegs,
    ],
  });
}

export function buildAckMessage(opts: {
  ackCode: 'AA' | 'AE' | 'AR';
  originalControlId: string;
  sendingApp?: string;
  sendingFacility?: string;
  receivingApp?: string;
  receivingFacility?: string;
  textMessage?: string;
  version?: string;
}): string {
  return serialize({
    sendingApplication: opts.sendingApp ?? 'RECEIVER',
    sendingFacility: opts.sendingFacility ?? 'FACILITY',
    receivingApplication: opts.receivingApp ?? 'RIS',
    receivingFacility: opts.receivingFacility ?? 'G005',
    messageType: 'ACK',
    messageControlId: `ACK-${Date.now()}`,
    version: opts.version ?? '2.5',
    segments: [
      { name: 'MSA', fields: [null, opts.ackCode, opts.originalControlId, null, null, null, null, null, opts.textMessage ?? ''] },
    ],
  });
}

// ============================================================
// 10. PID 段解析为患者对象
// ============================================================
export interface ParsedPatient {
  id: string;
  name: string;
  familyName: string;
  givenName: string;
  birthDate: string;
  sex: string;
  address: string;
  phone: string;
  identifiers: { value: string; assigningAuthority: string; type: string }[];
}

export function extractPatient(msg: Hl7ParsedMessage): ParsedPatient | null {
  if (!msg.patient) return null;
  const seg = msg.patient;
  const idField = seg.fields[3];
  const nameField = seg.fields[5];
  const dobField = seg.fields[7];
  const sexField = seg.fields[8];
  const addrField = seg.fields[11];
  const phoneField = seg.fields[14];
  const name = nameField ? nameField.raw : '';
  const [family, given] = name.split('^');
  const idVal = idField ? idField.components[0] ?? '' : '';
  return {
    id: idVal,
    name,
    familyName: family ?? '',
    givenName: given ?? '',
    birthDate: dobField ? dobField.raw : '',
    sex: sexField ? sexField.raw : '',
    address: addrField ? addrField.raw : '',
    phone: phoneField ? phoneField.raw : '',
    identifiers: idField
      ? idField.components
        .filter((_, i) => i % 4 === 0)
        .map((v, i) => ({
          value: v,
          assigningAuthority: idField.components[i * 4 + 3] ?? '',
          type: idField.components[i * 4 + 4] ?? 'MR',
        }))
      : [],
  };
}

// ============================================================
// 11. 报文统计
// ============================================================
export interface Hl7MessageStats {
  segmentCount: number;
  fieldCount: number;
  componentCount: number;
  repetitionCount: number;
  byteSize: number;
  obxCount: number;
  obrCount: number;
  nteCount: number;
  duration?: number;
}

export function computeStats(msg: Hl7ParsedMessage): Hl7MessageStats {
  let fieldCount = 0;
  let componentCount = 0;
  let repetitionCount = 0;
  let obxCount = 0;
  let obrCount = 0;
  let nteCount = 0;
  for (const seg of msg.segments) {
    fieldCount += seg.fields.length;
    for (const f of seg.fields) {
      if (f.repetitions.length > 1) repetitionCount += f.repetitions.length;
      if (f.components.length > 0) componentCount += f.components.length;
    }
    if (seg.name === 'OBX') obxCount++;
    if (seg.name === 'OBR') obrCount++;
    if (seg.name === 'NTE') nteCount++;
  }
  return {
    segmentCount: msg.segments.length,
    fieldCount,
    componentCount,
    repetitionCount,
    byteSize: new Blob([msg.raw]).size,
    obxCount,
    obrCount,
    nteCount,
  };
}

// ============================================================
// 12. 段查找器
// ============================================================
export function findSegment(msg: Hl7ParsedMessage, name: Hl7SegmentName | string): Hl7Segment | null {
  return msg.segments.find((s) => s.name === name) ?? null;
}

export function findAllSegments(msg: Hl7ParsedMessage, name: Hl7SegmentName | string): Hl7Segment[] {
  return msg.segments.filter((s) => s.name === name);
}
