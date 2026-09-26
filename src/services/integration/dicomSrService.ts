/**
 * G005 放射RIS系统 v3.0.6.5 - DICOM SR 集成 Service
 * v3.0.6.5: 增加 TID 1500 / 1501 / De-ID 桥接
 */

import type { DicomSrDocument, DicomContentSequence, DicomContentItem, DicomDataElement, DicomVrType } from '../../types/R3/R3.INTEGRATION';
import { DICOM_SR_MOCK, DICOM_SR_DOCUMENTS_MOCK } from '../../data/reportIntegrationMock';
import type { TrackedLesion, DeIdentifyConfig } from '../../types/measurement';
import { generateTid1500 as generateTid1500Report } from '../measurement/export/DicomSrTid1500';
import { generateTid1501 as generateTid1501Report, type ProcedureLogEntry } from '../measurement/export/DicomSrTid1501';
import { applyDeIdentify as applyDeId, defaultDeIdConfig } from './dicomDeId';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. DICOM 二进制数据集构造
// ============================================================
function encodeElement(tag: string, vr: DicomVrType, value: string | number | string[] | number[]): { tag: string; vr: DicomVrType; value: string | number | string[] | number[]; length: number } {
  const v = Array.isArray(value) ? value.join('\\') : value;
  return { tag, vr, value: v, length: String(v).length };
}

export function buildDicomSrDataset(input: {
  sopInstanceUID: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  contentSequence: DicomContentSequence[];
  patientName?: string;
  patientId?: string;
  patientBirthDate?: string;
  modality?: string;
}): DicomDataElement[] {
  const elements: DicomDataElement[] = [
    encodeElement('00080005', 'CS', 'ISO_IR 100') as DicomDataElement,
    { ...encodeElement('00080016', 'UI', '1.2.840.10008.5.1.4.1.1.88.11'), name: 'SOPClassUID', nameEn: 'SOP Class UID' },
    { ...encodeElement('00080018', 'UI', input.sopInstanceUID), name: 'SOPInstanceUID', nameEn: 'SOP Instance UID' },
    { ...encodeElement('00080020', 'DA', '20260915'), name: 'StudyDate', nameEn: 'Study Date' },
    { ...encodeElement('00080030', 'TM', '110000'), name: 'StudyTime', nameEn: 'Study Time' },
    { ...encodeElement('00080050', 'SH', `ACC${input.studyInstanceUID.slice(-10)}`), name: 'AccessionNumber', nameEn: 'Accession Number' },
    { ...encodeElement('00080060', 'CS', input.modality ?? 'SR'), name: 'Modality', nameEn: 'Modality' },
    { ...encodeElement('00080090', 'PN', '王医师^'), name: 'ReferringPhysicianName', nameEn: 'Referring Physician' },
    { ...encodeElement('00100010', 'PN', input.patientName ?? '张三^'), name: 'PatientName', nameEn: 'Patient Name' },
    { ...encodeElement('00100020', 'LO', input.patientId ?? 'p-038'), name: 'PatientID', nameEn: 'Patient ID' },
    { ...encodeElement('00100030', 'DA', input.patientBirthDate ?? '19680101'), name: 'PatientBirthDate', nameEn: 'Patient Birth Date' },
    { ...encodeElement('00100040', 'CS', 'M'), name: 'PatientSex', nameEn: 'Patient Sex' },
    { ...encodeElement('0020000D', 'UI', input.studyInstanceUID), name: 'StudyInstanceUID', nameEn: 'Study Instance UID' },
    { ...encodeElement('0020000E', 'UI', input.seriesInstanceUID), name: 'SeriesInstanceUID', nameEn: 'Series Instance UID' },
    { ...encodeElement('00200013', 'IS', 1), name: 'InstanceNumber', nameEn: 'Instance Number' },
    { ...encodeElement('0040A040', 'CS', 'VERIFIED'), name: 'VerificationFlag', nameEn: 'Verification Flag' },
    { ...encodeElement('0040A491', 'CS', 'COMPLETE'), name: 'CompletionFlag', nameEn: 'Completion Flag' },
    { ...encodeElement('0040A043', 'SQ', []), name: 'ConceptNameCodeSequence', nameEn: 'Concept Name Code Sequence' },
    { ...encodeElement('0040A730', 'SQ', []), name: 'ContentSequence', nameEn: 'Content Sequence' },
  ];
  return elements;
}

// ============================================================
// 2. SR 内容项构造
// ============================================================
export function buildContentItem(
  conceptCode: string, codeMeaning: string, codeMeaningEn: string,
  valueType: DicomContentItem['valueType'],
  payload: { text?: string; num?: number; unit?: string; code?: string; codeMeaning?: string } = {}
): DicomContentItem {
  return {
    relationshipType: 'CONTAINS',
    conceptCode: { code: conceptCode, codeSchemeDesignator: 'DCM', codeMeaning, codeMeaningEn },
    valueType,
    textValue: payload.text,
    numValue: payload.num,
    unitCode: payload.unit ? { code: payload.unit, codeSchemeDesignator: 'UCUM', codeMeaning: payload.unit, codeMeaningEn: payload.unit } : undefined,
    codeValue: payload.code ? { code: payload.code, codeSchemeDesignator: 'DCM', codeMeaning: payload.codeMeaning ?? '', codeMeaningEn: payload.codeMeaning ?? '' } : undefined,
  };
}

// ============================================================
// 3. SR 文本格式输出
// ============================================================
export function dumpDicomSr(sr: DicomSrDocument): string {
  const head = `# DICOM SR Document
# DICOM Standard: PS 3.3-2024
# Transfer Syntax: ${sr.transferSyntaxUID}
# SOP Class UID: ${sr.sopClassUID}
# SOP Instance UID: ${sr.sopInstanceUID}
# Study Instance UID: ${sr.studyInstanceUID}
# Series Instance UID: ${sr.seriesInstanceUID}
# Instance Number: ${sr.instanceNumber}
# Template: ${sr.templateId}
# Completion: ${sr.completionFlag}
# Verification: ${sr.verificationFlag}
# Generated: ${sr.generatedAt} by ${sr.generator}
# Size: ${sr.size} bytes

# ===== Data Elements =====
`;
  const elements = sr.dataElements.map((d) => `(${d.tag}) ${d.vr} [${d.length}] ${d.name} (${d.nameEn}) = ${Array.isArray(d.value) ? d.value.join('\\') : d.value}`).join('\n');
  const content = sr.contentSequence.map((seq) => `\n# ===== Content Sequence: ${seq.conceptCode.codeMeaning} (${seq.conceptCode.codeMeaningEn}) =====\n${seq.items.map((it) => `  >> [${it.relationshipType}] ${it.valueType} | ${it.conceptCode.code} (${it.conceptCode.codeMeaning}) ${it.textValue ?? it.numValue ?? it.codeValue?.code ?? ''}`).join('\n')}`).join('\n');
  return `${head}${elements}${content}\n\n# ===== Referenced SOP Instances =====\n${sr.referencedInstances.map((r) => `  -- ${r.purpose}: ${r.sopInstanceUID}`).join('\n')}\n`;
}

// ============================================================
// 4. DICOM SR 验证
// ============================================================
export function validateDicomSr(sr: DicomSrDocument): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sr.sopClassUID.startsWith('1.2.840.10008.5.1.4.1.1.88')) errors.push('SOP Class UID 不属于 SR 家族');
  if (!sr.sopInstanceUID) errors.push('缺少 SOP Instance UID');
  if (!sr.studyInstanceUID) errors.push('缺少 Study Instance UID');
  if (!sr.seriesInstanceUID) errors.push('缺少 Series Instance UID');
  if (sr.completionFlag === 'PARTIAL') warnings.push('SR 标记为部分完成');
  if (sr.contentSequence.length === 0) errors.push('Content Sequence 为空');
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 5. Service 接口
// ============================================================
export async function listDicomSr(): Promise<DicomSrDocument[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DICOM_SR_DOCUMENTS_MOCK;
}

export async function getDicomSr(id: string): Promise<DicomSrDocument | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DICOM_SR_DOCUMENTS_MOCK.find((s) => s.id === id) ?? null;
}

export async function generateDicomSr(input: {
  reportId: string;
  findings: string;
  impression: string;
  recommendation: string;
  patientId?: string;
  patientName?: string;
}): Promise<DicomSrDocument> {
  await new Promise((r) => setTimeout(r, 400));
  const ts = Date.now();
  const sopInstanceUID = `1.2.840.10008.5.1.4.1.1.88.11.1.${ts}`;
  const studyInstanceUID = `1.2.840.10008.5.1.4.1.1.2.1.${ts}`;
  const seriesInstanceUID = `1.2.840.10008.5.1.4.1.1.2.1.${ts}.99`;
  const contentSequence: DicomContentSequence[] = [
    {
      conceptCode: { code: '2000', codeSchemeDesignator: 'DCM', codeMeaning: '诊断性成像报告', codeMeaningEn: 'Diagnostic Imaging Report' },
      continuity: 'SEPARATE',
      items: [
        buildContentItem('121060', '历史发现', 'History', 'TEXT', { text: input.findings }),
        buildContentItem('121073', '印象', 'Impression', 'TEXT', { text: input.impression }),
        buildContentItem('121074', '建议', 'Recommendation', 'TEXT', { text: input.recommendation }),
      ],
    },
  ];
  const dataElements = buildDicomSrDataset({
    sopInstanceUID, studyInstanceUID, seriesInstanceUID,
    contentSequence, patientId: input.patientId, patientName: input.patientName,
  });
  const sr: DicomSrDocument = {
    id: sopInstanceUID,
    sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
    sopInstanceUID, studyInstanceUID, seriesInstanceUID,
    instanceNumber: 1, templateId: 'TID2000',
    completionFlag: 'COMPLETE', verificationFlag: 'VERIFIED',
    contentSequence, dataElements, referencedInstances: [],
    transferSyntaxUID: '1.2.840.10008.1.2.1',
    mediaStorageSOPInstanceUID: sopInstanceUID,
    generatedAt: new Date().toISOString(),
    generator: 'G005-DICOM-SR-Builder', size: 0,
    validation: { passed: true, errors: [], warnings: [] },
  };
  const text = dumpDicomSr(sr);
  sr.size = new Blob([text]).size;
  sr.validation = validateDicomSr(sr);
  return sr;
}

export async function downloadDicomSr(id: string): Promise<{ filename: string; content: string; mime: string } | null> {
  await new Promise((r) => setTimeout(r, 200));
  const doc = DICOM_SR_DOCUMENTS_MOCK.find((s) => s.id === id);
  if (!doc) return null;
  return { filename: `${id}.dcm`, content: dumpDicomSr(doc), mime: 'application/dicom' };
}

export async function sendDicomSr(_id: string, _destination: { aeTitle: string; host: string; port: number }): Promise<{ success: boolean; status: 'Success' | 'Failure'; statusCode: number; durationMs: number }> {
  await new Promise((r) => setTimeout(r, 1000));
  return { success: true, status: 'Success', statusCode: 0x0000, durationMs: 850 };
}

export const DICOM_SR_MOCK_REF = DICOM_SR_MOCK;

// ============================================================
// 6. TID 1500 - Imaging Measurement Report(v3.0.6.5)
// ============================================================
export interface GenerateTid1500Input {
  lesions: TrackedLesion[];
  patientId?: string;
  patientName?: string;
  patientBirthDate?: string;
  observer?: string;
  deIdentifyConfig?: DeIdentifyConfig;
}

export async function generateTid1500(input: GenerateTid1500Input): Promise<DicomSrDocument> {
  return generateTid1500Report(input);
}

// ============================================================
// 7. TID 1501 - Procedure Log(v3.0.6.5)
// ============================================================
export interface GenerateTid1501Input {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  entries: ProcedureLogEntry[];
  observer?: string;
  patientId?: string;
  patientName?: string;
}

export async function generateTid1501(input: GenerateTid1501Input): Promise<DicomSrDocument> {
  return generateTid1501Report(input);
}

// ============================================================
// 8. De-identification 桥接(v3.0.6.5)
// ============================================================
export function deIdentifyDataset(
  elements: DicomDataElement[],
  config: DeIdentifyConfig = defaultDeIdConfig,
): DicomDataElement[] {
  return applyDeId(elements, config);
}

export { defaultDeIdConfig };
