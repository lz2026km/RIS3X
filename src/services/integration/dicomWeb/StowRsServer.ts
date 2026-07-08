/**
 * G005 放射RIS系统 v3.0.6.0 - DICOMweb STOW-RS 服务器(浏览器 Mock)
 * 30 升级点:multipart/related 接收 / 单实例/多实例上传 / 验证 / 响应
 *      DICOM JSON 元数据解析
 */

import type {
  DicomWebMetadata, DicomWebTransferSyntax, StowRsUploadRequest, StowRsResult,
} from '../../../types/integration';

const MAX_INSTANCE_BYTES = 200 * 1024 * 1024;

interface StoredInstance {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  transferSyntaxUID: DicomWebTransferSyntax;
  size: number;
  content: ArrayBuffer | Blob;
  metadata: DicomWebMetadata;
  storedAt: string;
  hash: string;
  contentType: string;
}

const store: Map<string, StoredInstance> = new Map<string, StoredInstance>();

function key(study: string, series: string, sop: string): string {
  return `${study}^${series}^${sop}`;
}

function fakeHash(buf: ArrayBuffer | Blob): string {
  const sz = buf instanceof ArrayBuffer ? buf.byteLength : buf.size;
  return `sha256-${sz.toString(16).padStart(8, '0')}-${Date.now().toString(16)}`;
}

// ============================================================
// 1. 单/多实例 STOW
// ============================================================
export async function stowInstances(requests: StowRsUploadRequest[]): Promise<StowRsResult> {
  await delay(400);
  const result: StowRsResult = {
    status: 'success', storeCount: 0, failedCount: 0,
    referenceld: [], failedSopInstances: [], transactionUID: `stow-${Date.now()}`,
  };
  for (const r of requests) {
    try {
      validateInstance(r);
      const stored: StoredInstance = {
        studyInstanceUID: r.studyInstanceUID,
        seriesInstanceUID: r.seriesInstanceUID ?? `series-${Date.now()}`,
        sopInstanceUID: r.sopInstanceUID ?? `sop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        transferSyntaxUID: r.transferSyntaxUID ?? '1.2.840.10008.1.2.1',
        size: r.content instanceof ArrayBuffer ? r.content.byteLength : r.content.size,
        content: r.content,
        metadata: r.metadata ?? { studyInstanceUID: r.studyInstanceUID },
        storedAt: new Date().toISOString(),
        hash: fakeHash(r.content),
        contentType: 'application/dicom',
      };
      store.set(key(stored.studyInstanceUID, stored.seriesInstanceUID, stored.sopInstanceUID), stored);
      result.storeCount += 1;
      result.referenceld.push(`${stored.studyInstanceUID}/${stored.seriesInstanceUID}/${stored.sopInstanceUID}`);
    } catch (err) {
      result.failedCount += 1;
      result.failedSopInstances.push({
        sopInstanceUID: r.sopInstanceUID ?? 'unknown',
        reason: err instanceof Error ? err.message : String(err),
        statusCode: 415,
      });
    }
  }
  if (result.failedCount > 0) result.status = result.storeCount > 0 ? 'warning' : 'failure';
  return result;
}

// ============================================================
// 2. multipart/related 解析(简化)
// ============================================================
export interface ParsedMultipart {
  contentType: string;
  transferSyntaxUID: DicomWebTransferSyntax;
  body: ArrayBuffer;
  metadata?: DicomWebMetadata;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
}

export function parseMultipartRelated(blob: Blob, boundary: string): Promise<ParsedMultipart[]> {
  return new Promise((resolve, reject) => {
    const parts: ParsedMultipart[] = [];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const segs = text.split(`--${boundary}`);
        for (const seg of segs) {
          if (!seg.trim() || seg.includes('--')) continue;
          const headerEnd = seg.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const headers = seg.slice(0, headerEnd);
          const body = seg.slice(headerEnd + 4).replace(/\r\n$/, '');
          const ct = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1].trim() ?? 'application/dicom';
          parts.push({ contentType: ct, transferSyntaxUID: '1.2.840.10008.1.2.1', body: new TextEncoder().encode(body).buffer });
        }
        resolve(parts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// ============================================================
// 3. DICOM JSON Metadata 解析
// ============================================================
export function parseDicomJsonMetadata(json: Record<string, unknown>): DicomWebMetadata {
  const meta: DicomWebMetadata = { studyInstanceUID: '' };
  const get = (path: string): string | undefined => {
    const parts = path.split('.');
    let cur: unknown = json;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else return undefined;
    }
    if (Array.isArray(cur) && cur.length > 0) {
      const f = (cur[0] as Record<string, unknown>)?.Value;
      if (Array.isArray(f) && f.length > 0) return String(f[0]);
    } else if (cur && typeof cur === 'object') {
      const v = (cur as Record<string, unknown>).Value;
      if (Array.isArray(v) && v.length > 0) return String(v[0]);
    }
    return undefined;
  };
  meta.studyInstanceUID = get('0020000D') ?? '';
  meta.seriesInstanceUID = get('0020000E');
  meta.sopInstanceUID = get('00080018');
  meta.patientID = get('00100020');
  meta.patientName = get('00100010');
  meta.studyDate = get('00080020');
  meta.studyDescription = get('00081030');
  meta.modality = get('00080060');
  meta.sopClassUID = get('00080016');
  meta.transferSyntaxUID = (get('00020010') as DicomWebTransferSyntax) ?? '1.2.840.10008.1.2.1';
  meta.instanceNumber = Number(get('00200013') ?? '0') || undefined;
  return meta;
}

// ============================================================
// 4. 检索
// ============================================================
export function listStudies(): DicomWebMetadata[] {
  const seen = new Map<string, DicomWebMetadata>();
  for (const inst of store.values()) {
    if (!seen.has(inst.studyInstanceUID)) {
      seen.set(inst.studyInstanceUID, {
        studyInstanceUID: inst.studyInstanceUID,
        numberOfStudyRelatedInstances: countInstancesInStudy(inst.studyInstanceUID),
        numberOfSeriesRelatedInstances: countInstancesInSeries(inst.studyInstanceUID, inst.seriesInstanceUID),
        patientID: inst.metadata.patientID,
        patientName: inst.metadata.patientName,
        studyDate: inst.metadata.studyDate,
        studyDescription: inst.metadata.studyDescription,
        modality: inst.metadata.modality,
      });
    }
  }
  return Array.from(seen.values());
}

export function listSeries(studyUID: string): DicomWebMetadata[] {
  const seen = new Map<string, DicomWebMetadata>();
  for (const inst of store.values()) {
    if (inst.studyInstanceUID === studyUID && !seen.has(inst.seriesInstanceUID)) {
      seen.set(inst.seriesInstanceUID, {
        studyInstanceUID: inst.studyInstanceUID,
        seriesInstanceUID: inst.seriesInstanceUID,
        numberOfSeriesRelatedInstances: countInstancesInSeries(studyUID, inst.seriesInstanceUID),
        modality: inst.metadata.modality,
      });
    }
  }
  return Array.from(seen.values());
}

export function listInstances(studyUID: string, seriesUID?: string): DicomWebMetadata[] {
  return Array.from(store.values())
    .filter((s) => s.studyInstanceUID === studyUID && (!seriesUID || s.seriesInstanceUID === seriesUID))
    .map((s) => ({
      studyInstanceUID: s.studyInstanceUID,
      seriesInstanceUID: s.seriesInstanceUID,
      sopInstanceUID: s.sopInstanceUID,
      sopClassUID: s.metadata.sopClassUID,
      instanceNumber: s.metadata.instanceNumber,
      transferSyntaxUID: s.transferSyntaxUID,
    }));
}

export function retrieveInstance(studyUID: string, seriesUID: string, sopUID: string): StoredInstance | null {
  return store.get(key(studyUID, seriesUID, sopUID)) ?? null;
}

export function deleteStudy(studyUID: string): number {
  let n = 0;
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(`${studyUID}^`)) { store.delete(k); n += 1; }
  }
  return n;
}

export function countInstancesInStudy(studyUID: string): number {
  let n = 0;
  for (const s of store.values()) if (s.studyInstanceUID === studyUID) n += 1;
  return n;
}

export function countInstancesInSeries(studyUID: string, seriesUID: string): number {
  let n = 0;
  for (const s of store.values()) if (s.studyInstanceUID === studyUID && s.seriesInstanceUID === seriesUID) n += 1;
  return n;
}

export function stats() { return { totalInstances: store.size, totalBytes: Array.from(store.values()).reduce((a, b) => a + b.size, 0) }; }

function validateInstance(r: StowRsUploadRequest): void {
  if (!r.studyInstanceUID) throw new Error('缺少 StudyInstanceUID');
  if (!r.content) throw new Error('缺少 content');
  const size = r.content instanceof ArrayBuffer ? r.content.byteLength : r.content.size;
  if (size === 0) throw new Error('空实例');
  if (size > MAX_INSTANCE_BYTES) throw new Error(`实例超过 ${MAX_INSTANCE_BYTES} 字节`);
}

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export type { StoredInstance };
