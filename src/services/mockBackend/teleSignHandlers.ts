// [G005 W1-C] /api/v1/tele-sign MSW handlers
// 对齐后端 (backend/src/modules/tele-sign/tele-sign.controller.ts):
//   GET  /tele-sign/sessions  · POST /tele-sign/session · POST /tele-sign/approve · POST /tele-sign/reject
import { http, HttpResponse, delay } from 'msw';
// [G005 demo-data] 15 个签署会话种子: reportId/patientId ← store.list('exams'),
//   签署医生 ← DOCTOR_MASTER, 含 2 个多方会签 + SLA 倒计时 + CA 签章哈希
import { list } from './store';
import { PATIENT_MASTER, PATIENT_BY_ID, DOCTOR_MASTER, type DoctorMaster } from '../../data/master';
import { EXAM_REPORT_PRE } from '../../data/_generators';

const API = '/api/v1/tele-sign';

// 确定性延迟抖动 (无模块级 Math.random)
let delayTick = 0;
const delayMs = (min = 50, max = 150) => min + ((delayTick++ * 37) % Math.max(1, max - min));

interface SignParty {
  signerId: string;
  signerName: string;
  title: string;
  role: string;
  status: 'signed' | 'pending' | 'rejected';
  signedAt?: string;
}

interface SignSla {
  priority: '急诊' | '加急' | '普通';
  limitMinutes: number;
  startedAt: string;
  dueAt: string;
  remainingMinutes: number;
  breached: boolean;
  state: 'running' | 'met' | 'breached';
}

interface SignSession {
  id: string
  reportId: string
  reportTitle: string
  patientId?: string
  patientName: string
  modality?: string
  bodyPart?: string
  signerId: string
  signerName: string
  signerTitle?: string
  coSigners?: SignParty[]
  partyCount?: number
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  caSignatureHash?: string
  comment?: string
  sla?: SignSla
  createdAt: string
  updatedAt?: string
}

interface SeedExamRef {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItem: string;
}

const SESSION_COUNT = 15;
const MINUTE_MS = 60000;
// 2 个多方会签 (双签) 会话
const MULTI_PARTY_INDEX = new Set([0, 6]);
// 状态配比: 已通过 7 / 待签 5 / 已退回 3
const SESSION_STATUS: Array<'approved' | 'pending' | 'rejected'> = [
  'approved', 'pending', 'approved', 'rejected', 'approved',
  'pending', 'approved', 'pending', 'rejected', 'approved',
  'pending', 'approved', 'pending', 'rejected', 'approved',
];
const SLA_PRIORITY: Array<'急诊' | '加急' | '普通'> = ['急诊', '加急', '普通'];
const SLA_LIMIT_MINUTES: Record<'急诊' | '加急' | '普通', number> = { 急诊: 60, 加急: 240, 普通: 1440 };
const REJECT_COMMENTS = [
  '需要补充影像学描述与测量数据',
  '结论与所见不一致, 请修改后再提交',
  '缺少对比片分析, 请补充后重新签发',
];
// 1×1 PNG 签名图片占位 (每会话唯一性由 caSignatureHash 保证)
const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 确定性 CA 签章哈希 (FNV-1a × 8 轮 → 64 hex, 无 Math.random)
function caSignatureHash(seedStr: string): string {
  let h = 0x811c9dc5;
  let out = '';
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

function normalizeSeedExam(row: unknown): SeedExamRef | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const reportId = String(r.reportId ?? r.id ?? '');
  const patientId = String(r.patientId ?? '');
  if (!reportId || !patientId) return null;
  const person = PATIENT_BY_ID[patientId];
  const patientName = String(r.patientName ?? person?.name ?? '');
  if (!patientName) return null;
  return {
    examId: String(r.id ?? reportId),
    reportId,
    patientId,
    patientName,
    modality: String(r.modality ?? 'CT'),
    bodyPart: String(r.bodyPart ?? '未知'),
    examItem: String(r.examItem ?? ''),
  };
}

function pickSeedExams(count: number, allowed: string[]): SeedExamRef[] {
  const allow = new Set(allowed);
  const out: SeedExamRef[] = [];
  const used = new Set<string>();
  const push = (row: unknown): void => {
    const normalized = normalizeSeedExam(row);
    if (!normalized || used.has(normalized.reportId)) return;
    used.add(normalized.reportId);
    out.push(normalized);
  };
  let raw: unknown[] = [];
  try { raw = list<unknown>('exams'); } catch { raw = []; }
  const pool = raw.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return allow.has(String((row as Record<string, unknown>).modality ?? ''));
  });
  if (pool.length > 0) {
    const strideCount = Math.min(count, pool.length);
    const step = pool.length / strideCount;
    for (let i = 0; i < strideCount; i++) push(pool[Math.floor(i * step)]);
  }
  if (out.length < count) for (const row of pool) { if (out.length >= count) break; push(row); }
  if (out.length < count) {
    const seen = new Set(used);
    for (const row of EXAM_REPORT_PRE) {
      if (out.length >= count) break;
      if (allow.has(row.modality) && !seen.has(row.reportId)) push(row);
    }
  }
  if (out.length < count) {
    // store + 生成器同时不可用: PATIENT_MASTER 兜底
    PATIENT_MASTER.forEach((p, i) => {
      if (out.length >= count) return;
      const seq = String(i + 1).padStart(5, '0');
      const reportId = `RPT-FALLBACK-${seq}`;
      if (used.has(reportId)) return;
      used.add(reportId);
      out.push({
        examId: `EXAM-FALLBACK-${seq}`,
        reportId,
        patientId: p.id,
        patientName: p.name,
        modality: p.modality,
        bodyPart: p.bodyPart,
        examItem: p.examItem,
      });
    });
  }
  return out;
}

function buildSeedSessions(): SignSession[] {
  const now = Date.now();
  const exams = pickSeedExams(SESSION_COUNT, ['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PET-CT']);
  const reportDocs = DOCTOR_MASTER.filter(
    (d) => d.title === '主治医师' || d.title === '副主任医师' || d.title === '主任医师',
  );
  const seniorDocs = DOCTOR_MASTER.filter((d) => d.title === '副主任医师' || d.title === '主任医师');

  return exams.map((exam, i) => {
    const status = SESSION_STATUS[i] ?? 'pending';
    const priority = SLA_PRIORITY[i % SLA_PRIORITY.length] ?? '普通';
    const limitMinutes = SLA_LIMIT_MINUTES[priority];
    // 待签会话: 0.4×/0.75×/1.1×/1.45× 限额 → 部分仍在倒计时, 部分已超时;
    // 已办结会话: ≤0.74× 限额内办结 (i===13 为超时办结样例)
    const factor = status === 'pending'
      ? 0.4 + (i % 5) * 0.35
      : (i === 13 ? 1.25 : 0.3 + ((i * 7) % 5) * 0.11);
    const elapsedMinutes = Math.max(1, Math.round(limitMinutes * factor));
    const createdAtMs = now - elapsedMinutes * MINUTE_MS;
    const dueAtMs = createdAtMs + limitMinutes * MINUTE_MS;
    const remainingMinutes = limitMinutes - elapsedMinutes;
    const breached = remainingMinutes < 0;

    const primary: DoctorMaster | undefined = reportDocs.length > 0
      ? reportDocs[(i * 3 + 1) % reportDocs.length]
      : undefined;
    const signerId = primary?.id ?? `D-${String(i + 1).padStart(3, '0')}`;
    const signerName = primary?.name ?? '演示医师';
    const signerTitle = primary?.title ?? '主治医师';

    const multiParty = MULTI_PARTY_INDEX.has(i);
    let coDoc: DoctorMaster | undefined = seniorDocs.length > 0
      ? seniorDocs[(i * 2 + 2) % seniorDocs.length]
      : undefined;
    if (coDoc && coDoc.id === signerId) coDoc = seniorDocs[(i * 2 + 3) % seniorDocs.length];

    const closed = status !== 'pending';
    const updatedAtMs = closed ? createdAtMs + elapsedMinutes * MINUTE_MS : undefined;
    const reportTitle = exam.examItem
      ? `${exam.examItem}报告`
      : `${exam.modality} ${exam.bodyPart}报告`;

    const session: SignSession = {
      id: `ts-${String(i + 1).padStart(3, '0')}`,
      reportId: exam.reportId,
      reportTitle,
      patientId: exam.patientId,
      patientName: exam.patientName,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      signerId,
      signerName,
      signerTitle,
      partyCount: multiParty ? 2 : 1,
      status,
      createdAt: new Date(createdAtMs).toISOString(),
      sla: {
        priority,
        limitMinutes,
        startedAt: new Date(createdAtMs).toISOString(),
        dueAt: new Date(dueAtMs).toISOString(),
        remainingMinutes,
        breached,
        state: breached ? 'breached' : (closed ? 'met' : 'running'),
      },
      caSignatureHash: caSignatureHash(`${exam.reportId}#${signerId}#${i}`),
    };

    if (status === 'approved') {
      session.signatureData = SIGNATURE_PNG;
      session.comment = multiParty ? '双签完成, 同意签发' : '审核通过, 同意签发';
    } else if (status === 'rejected') {
      session.comment = REJECT_COMMENTS[i % REJECT_COMMENTS.length];
    }
    if (updatedAtMs !== undefined) session.updatedAt = new Date(updatedAtMs).toISOString();

    if (multiParty && coDoc) {
      session.coSigners = [{
        signerId: coDoc.id,
        signerName: coDoc.name,
        title: coDoc.title,
        role: '上级医师复核',
        status: status === 'approved' ? 'signed' : status,
        signedAt: updatedAtMs !== undefined ? new Date(updatedAtMs - MINUTE_MS).toISOString() : undefined,
      }];
    }

    return session;
  });
}

let sessions: SignSession[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建 (store 为空则回落 PATIENT_MASTER / EXAM_REPORT_PRE)
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  sessions = buildSeedSessions();
}

// 路由入口统一入口: 先确保种子就绪, 再执行 msw delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

export const teleSignHandlers = [
  http.get(`${API}/sessions`, async ({ request }) => {
    await routeDelay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const signerId = url.searchParams.get('signerId');
    let items = sessions;
    if (status) items = items.filter(s => s.status === status);
    if (signerId) items = items.filter(s => s.signerId === signerId);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  http.post(`${API}/session`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body.reportId !== 'string' || !body.reportId.trim() || typeof body.reportTitle !== 'string' || !body.reportTitle.trim() || typeof body.patientName !== 'string' || !body.patientName.trim() || typeof body.signerId !== 'string' || !body.signerId.trim() || typeof body.signerName !== 'string' || !body.signerName.trim()) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reportId/reportTitle/patientName/signerId/signerName 为必填字段' } },
        { status: 400 },
      );
    }
    const session: SignSession = {
      id: `ts-${Date.now().toString(36).slice(-6)}`,
      reportId: body.reportId,
      reportTitle: body.reportTitle,
      patientName: body.patientName,
      signerId: body.signerId,
      signerName: body.signerName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    sessions = [session, ...sessions];
    return HttpResponse.json({ success: true, data: session }, { status: 201 });
  }),

  http.post(`${API}/approve`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const target = sessions.find(s => s.id === body?.id);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Session not found: ${body?.id}` } }, { status: 404 });
    if (typeof body?.signatureData !== 'string' || !body.signatureData) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'signatureData 为必填字段' } }, { status: 400 });
    }
    target.status = 'approved';
    target.signatureData = body.signatureData;
    target.comment = body.comment;
    target.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: target });
  }),

  http.post(`${API}/reject`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const target = sessions.find(s => s.id === body?.id);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Session not found: ${body?.id}` } }, { status: 404 });
    if (typeof body?.comment !== 'string' || !body.comment.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'comment 为必填字段' } }, { status: 400 });
    }
    target.status = 'rejected';
    target.comment = body.comment;
    target.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: target });
  }),
];
