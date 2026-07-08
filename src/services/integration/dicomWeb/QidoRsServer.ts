/**
 * G005 放射RIS系统 v3.0.6.0 - DICOMweb QIDO-RS 服务
 * 30 升级点:Study/Series/Instance 三级查询 / DICOM JSON 输出
 *      模糊匹配 / 范围匹配 / 多 Key / 排序 / 分页
 */

import type { QidoRsQuery, QidoRsResult, DicomWebMetadata, DicomWebTransferSyntax } from '../../../types/integration';
import { listStudies, listSeries, listInstances } from './StowRsServer';

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function matches(meta: DicomWebMetadata, q: QidoRsQuery): boolean {
  if (q.PatientID && meta.patientID !== q.PatientID) return false;
  if (q.PatientName) {
    const needle = (q.fuzzymatching ? q.PatientName : q.PatientName.toLowerCase()).toLowerCase();
    if (!(meta.patientName ?? '').toLowerCase().includes(needle)) return false;
  }
  if (q.StudyDate) {
    if (q.StudyDate.includes('-')) {
      const [from, to] = q.StudyDate.split('-');
      if (from && (meta.studyDate ?? '') < from) return false;
      if (to && (meta.studyDate ?? '') > to) return false;
    } else if ((meta.studyDate ?? '') !== q.StudyDate) return false;
  }
  if (q.StudyDescription && !(meta.studyDescription ?? '').toLowerCase().includes(q.StudyDescription.toLowerCase())) return false;
  if (q.Modality && (meta.modality ?? '') !== q.Modality) return false;
  if (q.StudyInstanceUID && meta.studyInstanceUID !== q.StudyInstanceUID) return false;
  if (q.accessionNumber && (meta.studyInstanceUID ?? '').indexOf(q.accessionNumber) === -1) return false;
  return true;
}

function applyPagination<T>(items: T[], offset: number, limit: number): T[] {
  return items.slice(offset, offset + limit);
}

// ============================================================
// 1. Study 级别查询
// ============================================================
export async function qidoStudies(q: QidoRsQuery = {}): Promise<QidoRsResult> {
  await delay(80);
  const all = listStudies().filter((s) => matches(s, q));
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 20;
  const items = applyPagination(all, offset, limit);
  return wrapResult(items, all.length, q, '/studies');
}

// ============================================================
// 2. Series 级别查询
// ============================================================
export async function qidoSeries(studyUID: string | undefined, q: QidoRsQuery = {}): Promise<QidoRsResult> {
  await delay(60);
  const base = studyUID ? listSeries(studyUID) : listSeries('').length ? listSeries('') : flatAllSeries();
  const all = base.filter((s) => matches(s, q));
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 20;
  const items = applyPagination(all, offset, limit);
  return wrapResult(items, all.length, q, studyUID ? `/studies/${studyUID}/series` : '/series');
}

// ============================================================
// 3. Instance 级别查询
// ============================================================
export async function qidoInstances(studyUID: string | undefined, seriesUID: string | undefined, q: QidoRsQuery = {}): Promise<QidoRsResult> {
  await delay(60);
  const base = studyUID ? listInstances(studyUID, seriesUID) : flatAllInstances();
  const all = base.filter((s) => matches(s, q));
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 20;
  const items = applyPagination(all, offset, limit);
  return wrapResult(items, all.length, q,
    studyUID && seriesUID ? `/studies/${studyUID}/series/${seriesUID}/instances`
    : studyUID ? `/studies/${studyUID}/instances`
    : '/instances');
}

// ============================================================
// 4. DICOM JSON 输出
// ============================================================
export function toDicomJson(meta: DicomWebMetadata): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    '0020000D': { Value: [meta.studyInstanceUID], vr: 'UI' },
  };
  if (meta.seriesInstanceUID) obj['0020000E'] = { Value: [meta.seriesInstanceUID], vr: 'UI' };
  if (meta.sopInstanceUID) obj['00080018'] = { Value: [meta.sopInstanceUID], vr: 'UI' };
  if (meta.patientID) obj['00100020'] = { Value: [meta.patientID], vr: 'LO' };
  if (meta.patientName) obj['00100010'] = { Value: [meta.patientName], vr: 'PN' };
  if (meta.studyDate) obj['00080020'] = { Value: [meta.studyDate], vr: 'DA' };
  if (meta.studyDescription) obj['00081030'] = { Value: [meta.studyDescription], vr: 'LO' };
  if (meta.modality) obj['00080060'] = { Value: [meta.modality], vr: 'CS' };
  if (meta.sopClassUID) obj['00080016'] = { Value: [meta.sopClassUID], vr: 'UI' };
  if (meta.transferSyntaxUID) obj['00020010'] = { Value: [meta.transferSyntaxUID as string], vr: 'UI' };
  if (meta.instanceNumber !== undefined) obj['00200013'] = { Value: [meta.instanceNumber], vr: 'IS' };
  return obj;
}

// ============================================================
// 5. 元数据字段过滤
// ============================================================
export const STUDY_FIELDS = [
  '0020000D', '00080020', '00080030', '00080050', '00080054', '00080056', '00080060',
  '00081030', '0008103E', '00100010', '00100020', '00100030', '00100040', '00101010',
  '0020000D', '00200010', '00201200', '00201206', '00201208', '00080090', '00080080', '00080081',
];
export const SERIES_FIELDS = [
  '0020000E', '00080060', '00200011', '0020000E', '0008103E', '00080021', '00080031', '00080051',
];
export const INSTANCE_FIELDS = [
  '00080018', '00080016', '00200013', '0020000E', '0020000D', '00080023', '00080033', '0008002A',
];

// ---------------- 内部辅助 ----------------
function wrapResult(items: DicomWebMetadata[], total: number, q: QidoRsQuery, path: string): QidoRsResult {
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null) sp.set(k, String(v)); });
  const queryString = sp.toString();
  const transactionUID = `qido-${Date.now()}`;
  const url = `/dicom-web${path}${queryString ? `?${queryString}` : ''}`;
  return {
    results: items,
    total,
    link: [
      { relation: 'self', url },
      ...(q.limit !== undefined && (q.offset ?? 0) + (q.limit ?? 0) < total
        ? [{ relation: 'next' as const, url: `${url}${queryString ? '&' : '?'}_offset=${(q.offset ?? 0) + (q.limit ?? 0)}` }]
        : []),
    ],
    transactionUID,
  };
}

function flatAllSeries(): DicomWebMetadata[] {
  const all = listStudies();
  return all.flatMap((s) => listSeries(s.studyInstanceUID));
}
function flatAllInstances(): DicomWebMetadata[] {
  const all = listStudies();
  return all.flatMap((s) => listInstances(s.studyInstanceUID));
}
