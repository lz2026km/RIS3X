// [G005 W1-Controls] P0 无效果按钮真实化 MSW 兜底 (确定性数据)
//   - POST /eye/emr/records            新建眼科病历 (后端无创建端点 → MSW)
//   - GET  /regional/imaging/document-registry/:id/retrieve  IHE XDS-I 文档调阅 (后端无 Retrieve 数据源 → MSW)
//   - POST /self-registration/voucher  自助机影像领取凭证 (后端无 voucher 端点 → MSW)
//   - POST /reports/:id/signature      报告电子签名记录 (report-signing 流程 MSW 兜底)
// 注册位置: handlers.ts 最前置 (静态子路径需先于既有通配/参数路由)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

const ok = (data: unknown, status = 200) => HttpResponse.json({ success: true, data }, { status });
const bad = (message: string, status = 400) =>
  HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message } }, { status });

/** 确定性字符串散列 (FNV-1a 变体) — 同一输入始终得到同一序列 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const w1ControlsHandlers = [
  // ── 1. 眼科 EMR 新建 (P0-1) ──
  http.post(`${API_BASE}/eye/emr/records`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patientName = String(body.patientName ?? '').trim();
    if (!patientName) return bad('患者姓名不能为空');
    const seed = hashStr(patientName + String(Date.now()));
    const suffix = String((seed % 900000) + 100000);
    const record = {
      id: `EMR-${suffix}`,
      patientId: String(body.patientId ?? `P${suffix}`),
      patientName,
      doctorName: String(body.doctorName ?? '当前用户'),
      chiefComplaint: String(body.chiefComplaint ?? ''),
      hpi: String(body.hpi ?? ''),
      pastHistory: [],
      systemicHistory: [],
      medicationHistory: [],
      allergyHistory: [],
      familyHistory: [],
      socialHistory: [],
      visionOd: ['1.0', '1.0'],
      visionOs: ['1.0', '1.0'],
      iopOd: [{ od: '16', os: '16' }],
      refraction: { od: { sph: '-', cyl: '-', axis: '-' }, os: { sph: '-', cyl: '-', axis: '-' } },
      slitLamp: {},
      fundus: {},
      gonioscopy: '',
      icdCodes: [],
      diagnosis: body.diagnosis ? [String(body.diagnosis)] : ['待诊断'],
      plan: String(body.plan ?? ''),
      followUpDays: body.followUpDays ?? null,
      createdAt: new Date().toISOString(),
    };
    return ok(record, 201);
  }),

  // ── 2. IHE XDS-I 文档调阅 (P0-2) ──
  http.get(`${API_BASE}/regional/imaging/document-registry/:id/retrieve`, async ({ params }) => {
    await delay(220);
    const id = String(params.id);
    const h = hashStr(id);
    const doc = {
      id: `DOC-${id}`,
      documentId: id,
      patientId: `P0000${(h % 200) + 1}`,
      patientName: ['张伟', '王芳', '李强', '刘敏'][h % 4],
      studyUid: `1.2.840.113619.2.55.3.${h % 100000}`,
      title: '外院影像检查报告 (XDS-I Retrieve)',
      contentType: 'text/plain',
      institution: ['东华区第一医院', '西城区人民医院', '高新区中心医院'][h % 3],
      reportDate: new Date(Date.now() - (h % 90) * 86400000).toISOString().slice(0, 10),
      sizeBytes: 2048 + (h % 8192),
      content: `【检查所见】\n双肺纹理清晰, 未见明显实质性病变。\n\n【诊断意见】\n本次影像未见明显异常, 建议结合临床定期随访。\n\n【报告医师】 ${['王建华', '李慧敏', '张明远'][h % 3]}\n【审核医师】 赵国强 主任医师`,
      retrievedAt: new Date().toISOString(),
      source: 'doc-registry',
    };
    return ok(doc);
  }),

  // ── 3. 自助机影像领取凭证 (P0-5) ──
  http.post(`${API_BASE}/self-registration/voucher`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const h = hashStr(String(body.patientId ?? body.idCard ?? body.phone ?? 'DEMO') + Date.now());
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let x = h || 1;
    for (let i = 0; i < 16; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      code += alphabet[x % alphabet.length];
    }
    const record = {
      id: `VCH-${String((h % 900000) + 100000)}`,
      code,
      patientId: body.patientId ?? null,
      patientName: body.patientName ?? null,
      type: 'IMAGE_PICKUP',
      typeLabel: '影像胶片/光盘领取凭证',
      status: 'ACTIVE',
      validHours: 24,
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      issuedAt: new Date().toISOString(),
      booth: `自助机-${1 + (h % 4)}`,
      instructions: '请凭此凭证码于 24 小时内至医院影像科自助机或服务台领取影像资料。',
    };
    return ok(record, 201);
  }),

  // ── 4. 报告电子签名 (P0-4) ──
  http.post(`${API_BASE}/reports/:id/signature`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reportId = String(params.id) || 'DEMO-REPORT';
    const signer = String(body.signerName ?? body.signedBy ?? '当前用户');
    const algorithm = body.algorithm === 'SM3' ? 'SM3' : 'SHA-256';
    const digest = (
      hashStr(reportId + signer).toString(16).padStart(8, '0') +
      hashStr(signer + reportId).toString(16).padStart(8, '0') +
      hashStr(reportId).toString(16).padStart(8, '0') +
      hashStr(signer).toString(16).padStart(8, '0')
    ).slice(0, 64).padEnd(64, '0');
    const signature = {
      reportId,
      signatureId: `SIG-${String((hashStr(reportId + signer) % 900000) + 100000)}`,
      algorithm,
      digest,
      signature: digest.slice(0, 32).toUpperCase(),
      signedById: String(body.signedById ?? 'u-001'),
      signedBy: signer,
      signedAt: new Date().toISOString(),
      tsaToken: `TSA-${hashStr(reportId + signer).toString(16)}`,
      certificateSerial: `SN-${String((hashStr(signer) % 9000000) + 1000000)}`,
      status: 'valid' as const,
    };
    return ok({ reportId, signed: true, signature, history: [signature] }, 201);
  }),
];
