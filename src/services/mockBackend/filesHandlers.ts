/**
 * G005 放射RIS系统 v3.0.6.11-79 - W1-A 文件管理 MSW Handlers
 * 4 端点: upload-url / upload (raw body) / upload-complete / download
 * 上传内容保存在内存 Map, 刷新页面即清空 (与后端 pending 30 分钟过期一致)
 */
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5191/api/v1'; }
})();

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/dicom',
  'application/pdf', 'application/octet-stream',
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.dcm', '.pdf', '.zip']);
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface MockUpload {
  id: string;
  token: string;
  name: string;
  contentType: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  buffer: Uint8Array;
}

const uploadsById = new Map<string, MockUpload>();
const idByToken = new Map<string, string>();

function randomHex(bytes: number): string {
  const out: string[] = [];
  const arr = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  for (const b of arr) out.push(b.toString(16).padStart(2, '0'));
  return out.join('');
}

/** SHA-256 hex, 无 WebCrypto 时回退简易哈希 */
async function mockChecksum(buffer: Uint8Array): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      );
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* fallthrough */
  }
  let h1 = 5381;
  let h2 = 52711;
  for (const c of buffer) {
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 31) ^ c;
  }
  return `fallback-${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`;
}

function badRequest(message: string) {
  return HttpResponse.json(
    { success: false, error: { code: 'BAD_REQUEST', message } },
    { status: 400 },
  );
}

function notFound(message: string) {
  return HttpResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 },
  );
}

function toDto(u: MockUpload) {
  return {
    id: u.id,
    url: `/api/v1/files/download/${u.id}/${encodeURIComponent(u.name)}`,
    size: u.size,
    checksum: u.checksum,
    uploadedAt: u.uploadedAt,
  };
}

export const filesHandlers = [
  // 1/3 预签名上传地址
  http.get(`${API_BASE}/files/upload-url`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename') ?? '';
    const contentType = url.searchParams.get('contentType') ?? 'application/octet-stream';
    const size = Number(url.searchParams.get('size') ?? '0');

    if (!filename) return badRequest('filename required');
    if (!ALLOWED_MIME.has(contentType) && contentType !== 'application/octet-stream') {
      return badRequest('不支持的文件类型');
    }
    const ext = (filename.match(/\.[^.]+$/) ?? [''])[0]?.toLowerCase() ?? '';
    if (ext && !ALLOWED_EXT.has(ext)) return badRequest('不支持的文件扩展名');
    if (Number.isFinite(size) && size > MAX_FILE_SIZE) {
      return badRequest('文件大小超过限制 (100MB)');
    }

    const token = randomHex(16);
    return HttpResponse.json({
      success: true,
      data: {
        uploadUrl: `${API_BASE}/files/upload/${token}?name=${encodeURIComponent(filename)}&ct=${encodeURIComponent(contentType)}`,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });
  }),

  // 2/3 raw body 上传
  http.post(`${API_BASE}/files/upload`, async ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const name = url.searchParams.get('name') ?? 'file.bin';
    const ct = url.searchParams.get('ct') ?? 'application/octet-stream';

    if (!token || token.length < 8) return badRequest('invalid token');
    const buffer = new Uint8Array(await request.arrayBuffer());
    if (buffer.length === 0) return badRequest('empty body');
    if (buffer.length > MAX_FILE_SIZE) return badRequest('文件大小超过限制 (100MB)');

    const safeName = decodeURIComponent(name).split('/').pop() ?? 'file.bin';
    const id = randomHex(12);
    const uploaded: MockUpload = {
      id,
      token,
      name: safeName,
      contentType: ct,
      size: buffer.length,
      checksum: await mockChecksum(buffer),
      uploadedAt: new Date().toISOString(),
      buffer,
    };
    uploadsById.set(id, uploaded);
    idByToken.set(token, id);
    return HttpResponse.json({ success: true, data: toDto(uploaded) });
  }),

  // 3/3 上传完成确认
  http.post(`${API_BASE}/files/upload-complete`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => null)) as
      | { token?: string; metadata?: { size?: number; checksum?: string; filename?: string } }
      | null;
    const token = body?.token ?? '';
    const metadata = body?.metadata;
    if (!token || !metadata?.filename) return badRequest('invalid');
    if (!metadata.checksum) return badRequest('checksum required');

    const id = idByToken.get(token);
    const existing = id ? uploadsById.get(id) : undefined;
    const result = existing
      ? {
          id,
          url: `/api/v1/files/download/${id}/${encodeURIComponent(existing.name)}`,
          size: metadata.size ?? existing.size,
          checksum: metadata.checksum,
          uploadedAt: existing.uploadedAt,
        }
      : {
          id: randomHex(12),
          url: `/api/v1/files/download/${randomHex(12)}/${encodeURIComponent(metadata.filename)}`,
          size: metadata.size ?? 0,
          checksum: metadata.checksum,
          uploadedAt: new Date().toISOString(),
        };
    return HttpResponse.json({ success: true, data: result });
  }),

  // 下载 (返回真实二进制)
  http.get(`${API_BASE}/files/download/:id/:name`, async ({ params }) => {
    await delay(120);
    const id = String(params.id);
    const name = String(params.name);
    const upload = uploadsById.get(id);
    if (!upload || (name && upload.name !== decodeURIComponent(name))) {
      return notFound(`File ${id} not found or upload session expired`);
    }
    return new HttpResponse(upload.buffer, {
      headers: {
        'Content-Type': upload.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(upload.name)}`,
      },
    });
  }),
];
