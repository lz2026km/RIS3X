/**
 * G005 放射RIS系统 v3.0.5.1 - FHIR R4 DiagnosticReport Service
 */

import type { FhirDiagnosticReport, FhirAttachment, FhirAnnotation, FhirReference, FhirIdentifier, FhirCodeableConcept, FhirCoding } from '../../types/R3/R3.INTEGRATION';
import { FHIR_DR_MOCK, FHIR_DR_DOCUMENTS_MOCK } from '../../data/reportIntegrationMock';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. FHIR R4 DiagnosticReport 构造器
// ============================================================
export function buildFhirDiagnosticReport(input: {
  id: string;
  status: FhirDiagnosticReport['status'];
  patientId: string;
  patientName: string;
  conclusion: string;
  modalityCode: string; modalityDisplay: string;
  loincCode: string; loincDisplay: string;
  performerId: string; performerName: string;
  effectiveDateTime: string;
  issuedAt: string;
  notes?: string;
}): FhirDiagnosticReport {
  const status = input.status;
  const code: FhirCodeableConcept = {
    coding: [{ system: 'http://loinc.org', code: input.loincCode, display: input.loincDisplay, displayEn: input.loincDisplay }],
    text: input.loincDisplay, textEn: input.loincDisplay,
  };
  const category: FhirCodeableConcept[] = [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: input.modalityCode, display: 'Radiology', displayEn: 'Radiology' }],
    text: '放射报告', textEn: 'Radiology',
  }];
  const identifier: FhirIdentifier[] = [{ use: 'official', system: 'urn:oid:2.16.840.1.113883.4.1', value: `RP${input.id}` }];
  const subject: FhirReference = { reference: `Patient/${input.patientId}`, type: 'Patient', display: input.patientName };
  const performer: FhirReference[] = [{ reference: `Practitioner/${input.performerId}`, type: 'Practitioner', display: input.performerName }];
  const presentedForm: FhirAttachment[] = [{ contentType: 'application/pdf', url: `/api/v1/dist/fhir/dr/${input.id}.pdf`, size: 256000, title: '报告 PDF', creation: input.issuedAt }];
  const note: FhirAnnotation[] = input.notes ? [{ authorString: input.performerName, time: input.issuedAt, text: input.notes }] : [];
  const dr: FhirDiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: input.id,
    meta: { versionId: '1', lastUpdated: new Date().toISOString(), profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'], tag: [] },
    identifier, basedOn: [], status, category, code, subject,
    encounter: { reference: `Encounter/enc-${input.id}`, type: 'Encounter' },
    effectiveDateTime: input.effectiveDateTime, issued: input.issuedAt,
    performer, resultsInterpreter: performer, specimen: [], result: [], imagingStudy: [],
    media: [{ comment: 'Key image', link: { reference: `Media/m-${input.id}`, type: 'Media' } }],
    conclusion: input.conclusion,
    presentedForm, note, json: '', generatedAt: new Date().toISOString(),
    generator: 'G005-FHIR-Builder', validation: { passed: true, errors: [], warnings: [] },
  };
  dr.json = JSON.stringify(dr, null, 2);
  return dr;
}

// ============================================================
// 2. FHIR Bundle 构造(transaction / collection)
// ============================================================
export function buildFhirBundle(resources: FhirDiagnosticReport[], type: 'transaction' | 'collection' = 'collection'): { resourceType: 'Bundle'; type: string; entry: unknown[]; total: number } {
  return {
    resourceType: 'Bundle',
    type,
    total: resources.length,
    entry: resources.map((r) => ({ resource: r, fullUrl: `DiagnosticReport/${r.id}` })),
  };
}

// ============================================================
// 3. FHIR 资源映射
// ============================================================
export function mapReportToFhir(report: { reportId: string; patientId: string; modality: string; bodyPart: string; findings: string; impression: string }): FhirDiagnosticReport {
  const loincMap: Record<string, { code: string; display: string }> = {
    CT: { code: '30746-2', display: 'CT Chest' },
    MR: { code: '18748-4', display: 'MR Brain' },
    DR: { code: '30746-2', display: 'XR Chest' },
    MG: { code: '46372-6', display: 'Mammography' },
  };
  const def = loincMap[report.modality] ?? { code: '18748-4', display: 'Diagnostic imaging study' };
  return buildFhirDiagnosticReport({
    id: `fhir-${report.reportId}`,
    status: 'final',
    patientId: report.patientId, patientName: 'Patient',
    conclusion: report.impression,
    modalityCode: report.modality, modalityDisplay: 'Radiology',
    loincCode: def.code, loincDisplay: def.display,
    performerId: 'u-001', performerName: '陈医师',
    effectiveDateTime: new Date().toISOString(), issuedAt: new Date().toISOString(),
    notes: report.findings,
  });
}

// ============================================================
// 4. FHIR 验证
// ============================================================
export function validateFhir(dr: FhirDiagnosticReport): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (dr.resourceType !== 'DiagnosticReport') errors.push('resourceType 必须为 DiagnosticReport');
  if (!dr.status) errors.push('缺少 status');
  if (!dr.code) errors.push('缺少 code');
  if (!dr.subject) errors.push('缺少 subject');
  if (!dr.effectiveDateTime && !dr.effectivePeriod) errors.push('缺少 effective[x]');
  if (dr.status === 'final' && !dr.issued) warnings.push('final 状态建议设置 issued 时间');
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 5. Service 接口
// ============================================================
export async function listFhirDiagnosticReports(): Promise<FhirDiagnosticReport[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return FHIR_DR_DOCUMENTS_MOCK;
}

export async function getFhirDiagnosticReport(id: string): Promise<FhirDiagnosticReport | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return FHIR_DR_DOCUMENTS_MOCK.find((d) => d.id === id) ?? null;
}

export async function generateFhirDr(input: { reportId: string; patientId: string; modality: string; bodyPart: string; findings: string; impression: string }): Promise<FhirDiagnosticReport> {
  await new Promise((r) => setTimeout(r, 300));
  const dr = mapReportToFhir(input);
  dr.id = `fhir-${input.reportId}-${Date.now()}`;
  dr.json = JSON.stringify(dr, null, 2);
  dr.validation = validateFhir(dr);
  return dr;
}

export async function downloadFhirDr(id: string): Promise<{ filename: string; content: string; mime: string } | null> {
  await new Promise((r) => setTimeout(r, 200));
  const dr = FHIR_DR_DOCUMENTS_MOCK.find((d) => d.id === id);
  if (!dr) return null;
  return { filename: `${id}.json`, content: dr.json, mime: 'application/fhir+json' };
}

export async function sendFhirDr(id: string, fhirServerUrl: string): Promise<{ success: boolean; statusCode: number; response: string; durationMs: number }> {
  await new Promise((r) => setTimeout(r, 800));
  return { success: true, statusCode: 201, response: 'Created', durationMs: 620 };
}

export const FHIR_DR_MOCK_REF = FHIR_DR_MOCK;
