// [v3.0.6.11-79 W2-B] /api/v1/ca MSW handlers — 覆盖后端 ca.controller 全部 9 端点
//   GET/POST /certificates · DELETE /certificates/:id · POST /sign · GET /signatures
//   POST /verify · GET/PUT /config · GET /history
import { http, HttpResponse, delay } from 'msw';
import type {
  CACertificateDto,
  SignatureRecord,
  CaHistoryEntry,
  CaConfig,
  SignatureAlgorithm,
} from '../api/caApi';

const API = '/api/v1/ca';

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);

// ===== 会话内状态 (与后端 auditLog 语义一致: 操作均留痕 history) =====
let certificates: CACertificateDto[] = [
  {
    id: 'CERT-001', certId: 'CERT-001', holderName: '张建国', holderTitle: '放射科主任',
    holderIdNumber: '110101197203041234', algorithm: 'RSA-SHA256', issuer: 'CFCA 中国金融认证中心',
    validFrom: '2025-01-01', validTo: '2027-12-31', status: 'valid',
    serialNumber: '01:2A:3B:4C:5D:6E:7F:80:91:A2:B3:C4:D5:E6:F7:08',
    fingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F90123456789ABCDEF0123456789ABCDEF',
    usageCount: 128, lastUsedAt: '2026-08-01T10:24:00+08:00',
  },
  {
    id: 'CERT-002', certId: 'CERT-002', holderName: '李晓梅', holderTitle: '副主任医师',
    holderIdNumber: '110105198507093456', algorithm: 'SM2-SM3', issuer: 'GMCA 国密证书中心',
    validFrom: '2024-06-01', validTo: '2026-08-31', status: 'expiring',
    serialNumber: '09:87:65:43:21:0F:ED:CB:A9:87:65:43:21:0F:ED:CB',
    fingerprint: 'FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210',
    usageCount: 256, lastUsedAt: '2026-08-05T14:02:00+08:00',
  },
  {
    id: 'CERT-003', certId: 'CERT-003', holderName: '王海峰', holderTitle: '主治医师',
    holderIdNumber: '110108199011127890', algorithm: 'RSA-SHA256', issuer: 'CFCA 中国金融认证中心',
    validFrom: '2023-03-15', validTo: '2026-03-14', status: 'expired',
    serialNumber: '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
    fingerprint: '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
    usageCount: 512, lastUsedAt: '2026-03-10T09:00:00+08:00',
  },
  {
    id: 'CERT-004', certId: 'CERT-004', holderName: '赵丽华', holderTitle: '主管技师',
    holderIdNumber: '110101198809236789', algorithm: 'SM2-SM3', issuer: 'GMCA 国密证书中心',
    validFrom: '2026-02-01', validTo: '2029-01-31', status: 'valid',
    serialNumber: 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89',
    fingerprint: '0F1E2D3C4B5A69788796A5B4C3D2E1F001929384756A5B4C3D2E1F0',
    usageCount: 64, lastUsedAt: '2026-07-28T16:40:00+08:00',
  },
  {
    id: 'CERT-005', certId: 'CERT-005', holderName: '孙志强', holderTitle: '住院医师',
    holderIdNumber: '110105199509182345', algorithm: 'RSA-SHA256', issuer: 'CFCA 中国金融认证中心',
    validFrom: '2025-05-20', validTo: '2027-05-19', status: 'revoked',
    serialNumber: 'FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10',
    fingerprint: 'CAFEBABE00000000CAFEBABE00000000CAFEBABE00000000CAFEBABE00000000',
    usageCount: 32, lastUsedAt: '2026-06-01T11:30:00+08:00',
  },
];

let signatures: SignatureRecord[] = [
  {
    id: 'SIG-2026080101', reportId: 'RPT-2026-0801-001', certId: 'CERT-001',
    holderName: '张建国', algorithm: 'RSA-SHA256', signedAt: '2026-08-01T10:24:00+08:00',
    verificationCode: 'V8F3K2Q9W4M7X1',
  },
  {
    id: 'SIG-2026072801', reportId: 'RPT-2026-0728-005', certId: 'CERT-004',
    holderName: '赵丽华', algorithm: 'SM2-SM3', signedAt: '2026-07-28T16:40:00+08:00',
    verificationCode: 'V2N6B8H3J5K9P0',
  },
  {
    id: 'SIG-2026072101', reportId: 'RPT-2026-0721-012', certId: 'CERT-002',
    holderName: '李晓梅', algorithm: 'SM2-SM3', signedAt: '2026-07-21T09:15:00+08:00',
    verificationCode: 'V9T1Y4U7I2O6W3',
  },
];

let history: CaHistoryEntry[] = [
  { id: 'HIS-001', action: 'UPLOAD', operator: 'admin', target: 'CERT-004', detail: '上传用户证书 赵丽华 (SM2-SM3)', createdAt: '2026-02-01T09:00:00+08:00' },
  { id: 'HIS-002', action: 'SIGN', operator: '张建国', target: 'RPT-2026-0801-001', detail: 'RSA-SHA256 签名报告', createdAt: '2026-08-01T10:24:00+08:00' },
  { id: 'HIS-003', action: 'REVOKE', operator: 'admin', target: 'CERT-005', detail: '吊销证书 孙志强 (人员离职)', createdAt: '2026-06-01T11:30:00+08:00' },
];

let caConfig: CaConfig = {
  defaultAlgorithm: 'RSA-SHA256',
  autoTimestamp: true,
  requireCertChain: true,
  blockchainAnchor: true,
  maxSignaturesPerDay: 500,
};

const pushHistory = (action: string, operator: string, target: string, detail: string) => {
  history = [{
    id: `HIS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action, operator, target, detail,
    createdAt: new Date().toISOString(),
  }, ...history];
};

const formatFingerprint = (seed: string): string => {
  let s = seed;
  while (s.length < 64) s += s;
  return s.slice(0, 64).toUpperCase();
};

export const caHandlers = [
  // 1. 证书列表
  http.get(`${API}/certificates`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const algorithm = url.searchParams.get('algorithm');
    let items = certificates;
    if (status) items = items.filter(c => c.status === status);
    if (algorithm) items = items.filter(c => c.algorithm === algorithm);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // 2. 上传证书 (文件 + 元数据)
  http.post(`${API}/certificates`, async ({ request }) => {
    await delay(delayMs());
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = Object.fromEntries((await request.formData()).entries()) as Record<string, unknown>;
    }
    const holderName = String(body.holderName ?? body.name ?? '').trim();
    if (!holderName) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '证书持有者姓名不能为空' } },
        { status: 400 },
      );
    }
    const algorithm = (body.algorithm === 'SM2-SM3' ? 'SM2-SM3' : 'RSA-SHA256') as SignatureAlgorithm;
    const now = new Date();
    const id = `CERT-${Date.now().toString(36).toUpperCase()}`;
    const cert: CACertificateDto = {
      id,
      certId: id,
      holderName,
      holderTitle: String(body.holderTitle ?? '医生'),
      holderIdNumber: String(body.holderIdNumber ?? ''),
      algorithm,
      issuer: String(body.issuer ?? 'CFCA 中国金融认证中心'),
      validFrom: String(body.validFrom ?? now.toISOString().slice(0, 10)),
      validTo: String(body.validTo ?? new Date(now.getTime() + 2 * 365 * 86400_000).toISOString().slice(0, 10)),
      status: 'valid',
      serialNumber: String(body.serialNumber ?? `SN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`),
      fingerprint: String(body.fingerprint ?? formatFingerprint(Math.random().toString(36))),
      usageCount: 0,
      fileName: body.fileName ? String(body.fileName) : undefined,
    };
    certificates = [cert, ...certificates];
    pushHistory('UPLOAD', 'admin', cert.certId, `上传证书 ${holderName} (${algorithm})`);
    return HttpResponse.json({ success: true, data: cert }, { status: 201 });
  }),

  // 3. 吊销证书
  http.delete(`${API}/certificates/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = params.id as string;
    const cert = certificates.find(c => c.id === id || c.certId === id);
    if (!cert) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `证书不存在: ${id}` } },
        { status: 404 },
      );
    }
    if (cert.status === 'revoked') {
      return HttpResponse.json(
        { success: false, error: { code: 'CONFLICT', message: '证书已处于吊销状态' } },
        { status: 409 },
      );
    }
    const updated: CACertificateDto = { ...cert, status: 'revoked', lastUsedAt: new Date().toISOString() };
    certificates = certificates.map(c => (c.id === cert.id ? updated : c));
    pushHistory('REVOKE', 'admin', cert.certId, `吊销证书 ${cert.holderName} (${cert.algorithm})`);
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 4. 报告签名
  http.post(`${API}/sign`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { reportId?: string; certId?: string; algorithm?: string } | null;
    const reportId = String(body?.reportId ?? '').trim();
    const certId = String(body?.certId ?? '').trim();
    if (!reportId || !certId) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reportId / certId 为必填字段' } },
        { status: 400 },
      );
    }
    const cert = certificates.find(c => c.certId === certId || c.id === certId);
    if (!cert) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `证书不存在: ${certId}` } },
        { status: 404 },
      );
    }
    if (cert.status === 'expired' || cert.status === 'revoked') {
      return HttpResponse.json(
        { success: false, error: { code: 'INVALID_CERT', message: '证书已过期或吊销，无法签名' } },
        { status: 422 },
      );
    }
    const algorithm = body?.algorithm === 'SM2-SM3' ? 'SM2-SM3' : cert.algorithm;
    const verificationCode = `V${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const signedAt = new Date().toISOString();
    certificates = certificates.map(c =>
      c.id === cert.id
        ? { ...c, usageCount: c.usageCount + 1, lastUsedAt: signedAt }
        : c,
    );
    const record: SignatureRecord = {
      id: `SIG-${Date.now()}`, reportId, certId: cert.certId,
      holderName: cert.holderName, algorithm, signedAt, verificationCode,
    };
    signatures = [record, ...signatures];
    pushHistory('SIGN', cert.holderName, reportId, `${algorithm} 签名报告 ${reportId}`);
    return HttpResponse.json({
      success: true,
      data: { reportId, verificationCode, signedAt, algorithm },
    }, { status: 201 });
  }),

  // 5. 签名历史
  http.get(`${API}/signatures`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    let items = signatures;
    if (reportId) items = items.filter(s => s.reportId.includes(reportId));
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // 6. 签名验证
  http.post(`${API}/verify`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { reportId?: string; verificationCode?: string } | null;
    const reportId = String(body?.reportId ?? '').trim();
    const verificationCode = String(body?.verificationCode ?? '').trim();
    if (!reportId || !verificationCode) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reportId / verificationCode 为必填字段' } },
        { status: 400 },
      );
    }
    const record = signatures.find(
      s => s.reportId === reportId && s.verificationCode === verificationCode,
    );
    const cert = record ? certificates.find(c => c.certId === record.certId) : undefined;
    const result = {
      valid: Boolean(record),
      reportId,
      signerName: record?.holderName ?? '',
      signedAt: record?.signedAt ?? '',
      algorithm: (record?.algorithm ?? 'RSA-SHA256') as SignatureAlgorithm,
      certStatus: (cert?.status ?? 'unknown') as CACertificateDto['status'],
    };
    pushHistory(
      'VERIFY',
      'admin',
      reportId,
      result.valid ? `验签通过 (${result.signerName})` : `验签失败: 报告 ${reportId} 未匹配有效签名`,
    );
    return HttpResponse.json({ success: true, data: result }, { status: 201 });
  }),

  // 7. CA 配置
  http.get(`${API}/config`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: caConfig });
  }),

  // 8. 更新 CA 配置
  http.put(`${API}/config`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Partial<CaConfig> | null;
    if (body) caConfig = { ...caConfig, ...body };
    pushHistory('CONFIG', 'admin', 'ca-config', '更新 CA 全局配置');
    return HttpResponse.json({ success: true, data: caConfig });
  }),

  // 9. 操作历史
  http.get(`${API}/history`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    let items = history;
    if (action) items = items.filter(h => h.action === action.toUpperCase());
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
];
