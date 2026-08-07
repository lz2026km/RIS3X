/**
 * G005 放射RIS系统 v3.0.6.11-79 - W1-A 文件管理 API
 * 对接后端 4 端点:
 *   GET  /files/upload-url           预签名上传地址 (返回 token)
 *   POST /files/upload?token=&name=&ct=  raw body 上传
 *   POST /files/upload-complete      上传完成确认 (校验和)
 *   GET  /files/download/:id/:name   下载 (blob)
 * 后端无文件列表端点 → 列表由本次会话上传记录维护 (sessionStorage)
 */
import { API_BASE } from "./client";
import { getToken } from "../../utils/auth";

export interface UploadUrlDto {
  uploadUrl: string;
  token: string;
  expiresAt: string;
}

export interface UploadResultDto {
  id: string;
  url: string;
  size: number;
  checksum: string;
  uploadedAt: string;
}

export interface UploadCompletePayload {
  token: string;
  metadata: {
    size: number;
    checksum: string;
    filename: string;
  };
}

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

/** 本次会话上传的文件记录 (后端无列表端点时的前端侧台账) */
export interface UploadedFileRecord {
  id: string;
  name: string;
  contentType: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  downloadUrl: string;
}

const SESSION_KEY = "ris_files_session";

/** 后端 upload-url 允许的 MIME/扩展名 (与 files.service.ts 保持一致) */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".dcm", ".pdf", ".zip",
]);

export function isSupportedFile(file: { name: string; type: string }): boolean {
  const ext = (file.name.match(/\.[^.]+$/) ?? [""])[0]?.toLowerCase() ?? "";
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) return false;
  const mime = file.type.toLowerCase();
  if (!mime || mime === "application/octet-stream") return true;
  return [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/dicom",
    "application/pdf", "application/octet-stream",
  ].includes(mime);
}

/** SHA-256 hex (crypto.subtle, 非安全上下文回退到简易校验) */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fallthrough */
  }
  const bytes = new Uint8Array(buffer);
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < bytes.length; i += 1) {
    const c = bytes[i]!;
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 31) ^ c;
  }
  return `fallback-${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const filesApi = {
  /**
   * 1/3 预签名上传地址: 校验类型并签发上传 token
   */
  getUploadUrl: (fileName: string, mimeType: string, size?: number) => {
    const qs = new URLSearchParams();
    qs.set("filename", fileName);
    qs.set("contentType", mimeType || "application/octet-stream");
    if (typeof size === "number" && size >= 0) qs.set("size", String(size));
    return fetch(`${API_BASE}/files/upload-url?${qs.toString()}`, {
      method: "GET",
      headers: authHeaders(),
    }).then(async (res) => {
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: UploadUrlDto; error?: { message?: string } }
        | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? `获取上传地址失败 (${res.status})`);
      }
      return body.data as UploadUrlDto;
    });
  },

  /**
   * 2/3 raw body 上传 (XHR 支持进度回调)
   */
  upload: (
    file: Blob,
    token: string,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResultDto> =>
    new Promise((resolve, reject) => {
      const name = file instanceof File ? file.name : "file.bin";
      const ct = file.type || "application/octet-stream";
      const qs = new URLSearchParams();
      qs.set("token", token);
      qs.set("name", name);
      qs.set("ct", ct);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/files/upload?${qs.toString()}`);
      const headers = authHeaders();
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.responseType = "json";
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable && e.total > 0) {
          onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        }
      };
      xhr.onload = () => {
        const body = xhr.response as
          | { success?: boolean; data?: UploadResultDto; error?: { message?: string } }
          | null;
        if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
          resolve(body.data as UploadResultDto);
          return;
        }
        reject(new Error(body?.error?.message ?? `上传失败 (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("网络错误，上传失败"));
      xhr.ontimeout = () => reject(new Error("上传超时"));
      xhr.send(file);
    }),

  /**
   * 3/3 上传完成确认 (校验和)
   */
  completeUpload: (payload: UploadCompletePayload) =>
    fetch(`${API_BASE}/files/upload-complete`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: UploadResultDto; error?: { message?: string } }
        | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? `上传确认失败 (${res.status})`);
      }
      return body.data as UploadResultDto;
    }),

  /**
   * 下载文件本体 (blob)
   */
  async download(id: string, name: string): Promise<DownloadResult | null> {
    const url = `${API_BASE}/files/download/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return null;
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = cd.match(/filename\*?=UTF-8''([^;]+)/i) ?? cd.match(/filename="?([^";]+)"?/i);
      let filename = name;
      if (m?.[1]) {
        try {
          filename = decodeURIComponent(m[1]);
        } catch {
          filename = m[1];
        }
      }
      return { blob, filename };
    } catch {
      return null;
    }
  },

  /**
   * 文件列表: 后端无列表端点 → 返回本次会话上传的记录
   */
  listFiles: (): UploadedFileRecord[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as UploadedFileRecord[]) : [];
    } catch {
      return [];
    }
  },

  saveSessionFile: (record: UploadedFileRecord): UploadedFileRecord[] => {
    if (typeof window === "undefined") return [record];
    const list = filesApi.listFiles();
    const next = [record, ...list.filter((f) => f.id !== record.id)];
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      /* 存储失败不影响本次会话内展示 */
    }
    return next;
  },

  clearSessionFiles: (): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* noop */
    }
  },
};
