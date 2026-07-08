/**
 * G005 放射RIS系统 v3.0.6.0 - DICOMweb WADO-RS 服务
 * 30 升级点:Study/Series/Instance 多帧 / 单帧 / 元数据 / 缩略图
 *      Transfer Syntax 协商 / Accept 头 / HTTP Range / 渲染
 */

import type { WadoRsRequest, WadoRsResult, DicomWebMetadata } from '../../../types/integration';
import { retrieveInstance, listStudies, listSeries, listInstances } from './StowRsServer';

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================
// 1. Instance 检索
// ============================================================
export async function wadoRetrieveInstance(req: WadoRsRequest): Promise<WadoRsResult | null> {
  await delay(120);
  const inst = retrieveInstance(req.studyInstanceUID, req.seriesInstanceUID ?? '', req.sopInstanceUID ?? '');
  if (!inst) return null;
  return {
    contentType: req.contentType ?? 'application/dicom',
    body: inst.content,
    size: inst.size,
    transferSyntaxUID: req.transferSyntaxUID ?? inst.transferSyntaxUID,
    contentLocation: `${req.studyInstanceUID}/${inst.seriesInstanceUID}/${inst.sopInstanceUID}`,
  };
}

// ============================================================
// 2. Series 检索(多 part multipart/related)
// ============================================================
export async function wadoRetrieveSeries(studyUID: string, seriesUID: string, opts: { transferSyntaxUID?: string; contentType?: string } = {}): Promise<{ contentType: string; body: Blob; parts: number; size: number } | null> {
  await delay(180);
  const parts = listInstances(studyUID, seriesUID);
  if (parts.length === 0) return null;
  const instances = parts.map((p) => retrieveInstance(studyUID, seriesUID, p.sopInstanceUID ?? '')).filter(Boolean);
  if (instances.length === 0) return null;
  const boundary = `WADO-RS-${Date.now()}`;
  const ct = `multipart/related; type="application/dicom"; boundary=${boundary}`;
  const chunks: BlobPart[] = [];
  let totalSize = 0;
  for (const inst of instances) {
    if (!inst) continue;
    const head = `--${boundary}\r\nContent-Type: ${opts.contentType ?? 'application/dicom'}\r\n\r\n`;
    const buf = inst.content instanceof ArrayBuffer ? inst.content : await inst.content.arrayBuffer();
    chunks.push(new TextEncoder().encode(head));
    chunks.push(buf);
    chunks.push(new TextEncoder().encode('\r\n'));
    totalSize += buf.byteLength;
  }
  chunks.push(new TextEncoder().encode(`--${boundary}--\r\n`));
  return { contentType: ct, body: new Blob(chunks, { type: ct }), parts: instances.length, size: totalSize };
}

// ============================================================
// 3. Study 检索
// ============================================================
export async function wadoRetrieveStudy(studyUID: string, opts: { transferSyntaxUID?: string; contentType?: string } = {}): Promise<{ contentType: string; body: Blob; series: number; size: number } | null> {
  await delay(200);
  const seriesList = listSeries(studyUID);
  if (seriesList.length === 0) return null;
  const boundary = `WADO-RS-${Date.now()}`;
  const ct = `multipart/related; type="application/dicom"; boundary=${boundary}`;
  const chunks: BlobPart[] = [];
  let totalSize = 0;
  for (const s of seriesList) {
    if (!s.seriesInstanceUID) continue;
    const sub = await wadoRetrieveSeries(studyUID, s.seriesInstanceUID, opts);
    if (!sub) continue;
    const head = `--${boundary}\r\nContent-Type: ${sub.contentType.split(';')[0]?.trim() ?? 'application/dicom'}\r\n\r\n`;
    chunks.push(new TextEncoder().encode(head));
    chunks.push(await sub.body.arrayBuffer());
    chunks.push(new TextEncoder().encode('\r\n'));
    totalSize += sub.size;
  }
  chunks.push(new TextEncoder().encode(`--${boundary}--\r\n`));
  return { contentType: ct, body: new Blob(chunks, { type: ct }), series: seriesList.length, size: totalSize };
}

// ============================================================
// 4. 元数据(WADO-RS metadata)
// ============================================================
export async function wadoRetrieveMetadata(studyUID: string, seriesUID?: string): Promise<DicomWebMetadata[]> {
  await delay(50);
  if (seriesUID) return listInstances(studyUID, seriesUID);
  const all = listStudies();
  const study = all.find((s) => s.studyInstanceUID === studyUID);
  if (!study) return [];
  return [study, ...listSeries(studyUID)];
}

// ============================================================
// 5. 缩略图(WADO-RS render)
// ============================================================
export async function wadoRenderThumbnail(studyUID: string, seriesUID: string, sopUID: string, viewport: { rows: number; columns: number } = { rows: 128, columns: 128 }): Promise<{ contentType: string; body: Blob; size: number; width: number; height: number } | null> {
  await delay(150);
  const inst = retrieveInstance(studyUID, seriesUID, sopUID);
  if (!inst) return null;
  // Mock:在浏览器中生成一个 SVG 占位图作为缩略图
  const w = viewport.columns, h = viewport.rows;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <text x="50%" y="50%" text-anchor="middle" fill="#7dd3fc" font-family="monospace" font-size="10">${sopUID.slice(-6)}</text>
    <text x="50%" y="65%" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="8">${inst.studyInstanceUID.slice(-6)}</text>
  </svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return { contentType: 'image/svg+xml', body: blob, size: blob.size, width: w, height: h };
}

// ============================================================
// 6. 帧检索(多帧)
// ============================================================
export async function wadoRetrieveFrame(studyUID: string, seriesUID: string, sopUID: string, frameNumber: number): Promise<WadoRsResult | null> {
  await delay(80);
  const inst = retrieveInstance(studyUID, seriesUID, sopUID);
  if (!inst) return null;
  // 模拟:从二进制中切出 frameNumber 部分(若存在)
  const buf = inst.content instanceof ArrayBuffer ? inst.content : await inst.content.arrayBuffer();
  const sliceSize = Math.max(1, Math.floor(buf.byteLength / 8));
  const start = (frameNumber - 1) * sliceSize;
  const end = Math.min(start + sliceSize, buf.byteLength);
  const slice = buf.slice(start, end);
  return {
    contentType: 'application/dicom',
    body: slice,
    size: slice.byteLength,
    transferSyntaxUID: inst.transferSyntaxUID,
    contentLocation: `${studyUID}/${seriesUID}/${sopUID}/frames/${frameNumber}`,
  };
}

// ============================================================
// 7. Accept 头协商
// ============================================================
export function negotiateContentType(acceptHeader: string, supported: string[] = ['application/dicom', 'image/jpeg', 'image/png', 'image/svg+xml', 'application/octet-stream']): string {
  if (!acceptHeader) return supported[0] ?? 'application/dicom';
  const tokens = acceptHeader.split(',').map((s) => s.trim().split(';')[0]?.trim() ?? '').filter(Boolean);
  for (const t of tokens) if (supported.includes(t)) return t;
  return supported[0] ?? 'application/dicom';
}
