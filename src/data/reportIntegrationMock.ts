/**
 * G005 放射RIS系统 v3.0.5.1 - R3.INTEGRATION 集成模块 Mock 数据
 * 80 升级点 mock:HL7 CDA / DICOM SR / FHIR R4 / IHE XDS.b
 */

import type { CdaDocument, CdaSection, CdaActor, DicomSrDocument, DicomContentItem, DicomDataElement, FhirDiagnosticReport, FhirAttachment, FhirIdentifier, FhirReference, FhirAnnotation, XdsRegistry, XdsDocumentEntry, XdsFolder, XdsSubmissionSet, XdsAssociation, IntegrationExportEnvelope } from '../types/R3/R3.INTEGRATION';

// ============================================================
// 1. HL7 CDA R2 Mock(完整 XML)
// ============================================================
function buildCdaXml(cda: CdaDocument): string {
  const escape = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <typeId root="${cda.typeId.root}" extension="${cda.typeId.extension}"/>
  ${cda.templateId.map((t) => `<templateId root="${t.root}" extension="${t.extension}"/>`).join('\n  ')}
  <id root="${cda.id}" extension="${cda.id}"/>
  <code code="51848-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Radiology Report"/>
  <title>${escape(cda.title)}</title>
  <effectiveTime value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
  <confidentialityCode code="${cda.confidentialityCode}" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="${cda.languageCode}"/>
  <recordTarget>
    <patientRole>
      <id root="${cda.recordTarget.idRoot}" extension="${cda.recordTarget.idExtension}"/>
      <patient>
        <name><given>${escape(cda.recordTarget.nameEn.split(' ')[0] ?? cda.recordTarget.nameEn)}</given><family>${escape(cda.recordTarget.nameEn.split(' ').slice(1).join(' ') || 'Patient')}</family></name>
        <administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
    <assignedAuthor>
      <id root="${cda.author.idRoot}" extension="${cda.author.idExtension}"/>
      <assignedPerson><name>${escape(cda.author.name)}</name></assignedPerson>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="${cda.custodian.idRoot}"/>
        <name>${escape(cda.custodian.name)}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <legalAuthenticator>
    <time value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
    <signatureCode code="S"/>
    <assignedEntity>
      <id root="${cda.legalAuthenticator.idRoot}" extension="${cda.legalAuthenticator.idExtension}"/>
      <assignedPerson><name>${escape(cda.legalAuthenticator.name)}</name></assignedPerson>
    </assignedEntity>
  </legalAuthenticator>
  <relatedDocument typeCode="RPLC">
    <parentDocument>
      <id root="${cda.setId}" extension="1"/>
      <setId root="${cda.setId}"/>
      <versionNumber value="${cda.version}"/>
    </parentDocument>
  </relatedDocument>
  <component>
    <structuredBody>
      ${cda.sections.map((s) => `      <component>
        <section>
          <code code="${s.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${escape(s.titleEn)}"/>
          <title>${escape(s.title)}</title>
          <text>${escape(s.text)}</text>
          ${s.entries.map((e) => `          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <code code="${e.code.code}" codeSystem="${e.code.codeSystem}" codeSystemName="${e.code.codeSystemName}" displayName="${escape(e.code.displayName)}"/>
              <value xsi:type="ST">${escape(String(e.value ?? e.text))}</value>
              <effectiveTime value="${(e.effectiveTime ?? cda.effectiveTime).replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
            </observation>
          </entry>`).join('\n')}
        </section>
      </component>`).join('\n')}
    </structuredBody>
  </component>
</ClinicalDocument>`;
}

const CDA_DEMO_SECTIONS: CdaSection[] = [
  {
    code: '29545-1', title: '体检报告', titleEn: 'Physical Examination', order: 1,
    text: '患者一般情况良好,生命体征平稳。',
    entries: [
      { type: 'observation', code: { code: '8302-2', codeSystem: '2.16.840.1.113883.6.1', codeSystemName: 'LOINC', displayName: '身高' }, value: 170, unit: 'cm', text: '身高 170cm' },
      { type: 'observation', code: { code: '29463-7', codeSystem: '2.16.840.1.113883.6.1', codeSystemName: 'LOINC', displayName: '体重' }, value: 68, unit: 'kg', text: '体重 68kg' },
    ],
  },
  {
    code: '18776-5', title: '计划', titleEn: 'Plan of Care', order: 2,
    text: '3-6 个月后 CT 复查,动态观察病灶变化。',
    entries: [
      { type: 'act', code: { code: 'OPEUR-001', codeSystem: '2.16.840.1.113883.5.4', codeSystemName: 'ActCode', displayName: 'CT 随访' }, text: 'CT 随访', effectiveTime: '2026-12-15T09:00:00+08:00' },
    ],
  },
  {
    code: '10160-0', title: '用药史', titleEn: 'Medication History', order: 3,
    text: '无特殊用药史。',
    entries: [],
  },
  {
    code: '11369-6', title: '当前用药', titleEn: 'Current Medications', order: 4,
    text: '无当前用药。',
    entries: [],
  },
  {
    code: '51852-2', title: '评估与计划', titleEn: 'Assessment and Plan', order: 5,
    text: '右肺上叶周围型肺癌可能性大,建议穿刺活检明确病理。',
    entries: [
      { type: 'observation', code: { code: 'RID4948', codeSystem: '2.16.840.1.113883.6.1', codeSystemName: 'LOINC', displayName: '右肺上叶结节' }, text: '右肺上叶结节 18mm×15mm', effectiveTime: '2026-09-15T10:00:00+08:00' },
    ],
  },
  {
    code: '29762-2', title: '社会史', titleEn: 'Social History', order: 6,
    text: '无吸烟史,无饮酒史。',
    entries: [],
  },
  {
    code: '10164-2', title: '病史', titleEn: 'History of Illness', order: 7,
    text: '患者 1 周前体检发现右肺结节,无明显症状。',
    entries: [],
  },
  {
    code: '8716-3', title: '生命体征', titleEn: 'Vital Signs', order: 8,
    text: 'T 36.5℃, P 78 次/分, R 18 次/分, BP 130/80 mmHg。',
    entries: [],
  },
];

const cdaActors = (): { recordTarget: CdaActor; author: CdaActor; custodian: CdaActor; legalAuthenticator: CdaActor } => ({
  recordTarget: { id: 'pat-038', type: 'patient', name: '张三', nameEn: 'Zhang San', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'p-038', telecom: '13800138000', addr: '汉东省京州市' },
  author: { id: 'u-001', type: 'doctor', name: '陈医师', nameEn: 'Dr. Chen', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'u-001', telecom: '13900139000' },
  custodian: { id: 'org-001', type: 'organization', name: '汉东省人民医院', nameEn: 'Handong Provincial People Hospital', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'org-001' },
  legalAuthenticator: { id: 'u-002', type: 'doctor', name: '王主任', nameEn: 'Dr. Wang', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'u-002' },
});

const buildCdaBase = (id: string, setId: string, version: number, title: string, titleEn: string, sections: CdaSection[]): CdaDocument => {
  const actors = cdaActors();
  const cda: CdaDocument = {
    id, setId, version,
    typeId: { root: '2.16.840.1.113883.1.3', extension: 'POCD_HD000040' },
    templateId: [
      { root: '2.16.840.1.113883.10.20.22.1.1', extension: '2015-08-01' },
      { root: '2.16.840.1.113883.10.20.22.1.1', extension: 'DiagnosticImaging' },
    ],
    title, titleEn,
    effectiveTime: '2026-09-15T11:00:00+08:00',
    confidentialityCode: 'N',
    languageCode: 'zh-CN',
    recordTarget: actors.recordTarget,
    author: actors.author,
    custodian: actors.custodian,
    legalAuthenticator: actors.legalAuthenticator,
    participants: [],
    relatedDocuments: [],
    sections,
    generatedAt: new Date().toISOString(),
    generator: 'G005-RIS-CDA-Builder-v3.0.5.1',
    size: 0, xml: '',
    validation: { passed: true, errors: [], warnings: [] },
  };
  cda.xml = buildCdaXml(cda);
  cda.size = new Blob([cda.xml]).size;
  return cda;
};

export const CDA_DEMO: CdaDocument = buildCdaBase('cda-rpt-038', 'cda-set-038', 1, '胸部 CT 增强检查报告', 'Chest CT Enhanced Report', CDA_DEMO_SECTIONS);

export const CDA_DOCUMENTS_MOCK: CdaDocument[] = [
  CDA_DEMO,
  buildCdaBase('cda-rpt-039', 'cda-set-039', 1, '头颅 MR 平扫报告', 'Brain MR Report', [CDA_DEMO_SECTIONS[0]!, CDA_DEMO_SECTIONS[4]!]),
  buildCdaBase('cda-rpt-040', 'cda-set-040', 1, '上腹部 CT 增强报告', 'Abdomen CT Report', CDA_DEMO_SECTIONS),
  buildCdaBase('cda-rpt-041', 'cda-set-041', 1, '腰椎 MR 平扫报告', 'Lumbar Spine MR', [CDA_DEMO_SECTIONS[0]!]),
  buildCdaBase('cda-rpt-042', 'cda-set-042', 1, '乳腺钼靶报告', 'Mammography Report', CDA_DEMO_SECTIONS.slice(0, 3)),
];

// ============================================================
// 2. DICOM SR Mock(完整 DataSet)
// ============================================================
function buildDicomSrDataSet(sr: DicomSrDocument): string {
  const head = `# DICOM-File-Format
# DICOM Version: 3.0
# Generated by G005-RIS DICOM SR Builder v3.0.5.1
# Transfer Syntax UID: ${sr.transferSyntaxUID}
# SOP Class UID: ${sr.sopClassUID}
# SOP Instance UID: ${sr.sopInstanceUID}
# Study Instance UID: ${sr.studyInstanceUID}
# Series Instance UID: ${sr.seriesInstanceUID}
# Instance Number: ${sr.instanceNumber}
# Completion Flag: ${sr.completionFlag}
# Verification Flag: ${sr.verificationFlag}
# Template ID: ${sr.templateId}
# Generated: ${sr.generatedAt}
# Size: ${sr.size} bytes
`;
  const body = sr.dataElements.map((d) => `(${d.tag}) ${d.vr} [${d.length}] ${Array.isArray(d.value) ? d.value.join('\\') : d.value}`).join('\n');
  const content = sr.contentSequence.map((seq) => `> SEQ [${seq.conceptCode.code} - ${seq.conceptCode.codeMeaning}]\n${seq.items.map((it) => `  >> ${it.relationshipType} | ${it.valueType} | ${it.conceptCode.codeMeaning} ${it.textValue ?? it.numValue ?? ''}`).join('\n')}`).join('\n');
  return `${head}\n# === DATA ELEMENTS ===\n${body}\n\n# === CONTENT SEQUENCE ===\n${content}\n`;
}

const dicomContentItems = (_findings: string, impression: string): DicomContentItem[] => [
  { relationshipType: 'CONTAINS', conceptCode: { code: '121060', codeSchemeDesignator: 'DCM', codeMeaning: '历史发现', codeMeaningEn: 'History' }, valueType: 'TEXT', textValue: '右肺结节 1 周余,无明显症状' },
  { relationshipType: 'CONTAINS', conceptCode: { code: '121071', codeSchemeDesignator: 'DCM', codeMeaning: '发现', codeMeaningEn: 'Finding' }, valueType: 'CONTAINER', children: [
    { relationshipType: 'CONTAINS', conceptCode: { code: 'RID4948', codeSchemeDesignator: 'RID', codeMeaning: '右肺上叶', codeMeaningEn: 'RUL' }, valueType: 'TEXT', textValue: '右肺上叶尖段' },
    { relationshipType: 'CONTAINS', conceptCode: { code: 'RID3832', codeSchemeDesignator: 'RID', codeMeaning: '结节', codeMeaningEn: 'Nodule' }, valueType: 'CODE', codeValue: { code: 'RID3832', codeSchemeDesignator: 'RID', codeMeaning: '结节', codeMeaningEn: 'Nodule' } },
    { relationshipType: 'CONTAINS', conceptCode: { code: 'RID3924', codeSchemeDesignator: 'RID', codeMeaning: '长径', codeMeaningEn: 'Long diameter' }, valueType: 'NUM', numValue: 18, unitCode: { code: 'mm', codeSchemeDesignator: 'UCUM', codeMeaning: '毫米', codeMeaningEn: 'millimeter' } },
    { relationshipType: 'CONTAINS', conceptCode: { code: 'RID3925', codeSchemeDesignator: 'RID', codeMeaning: '短径', codeMeaningEn: 'Short diameter' }, valueType: 'NUM', numValue: 15, unitCode: { code: 'mm', codeSchemeDesignator: 'UCUM', codeMeaning: '毫米', codeMeaningEn: 'millimeter' } },
    { relationshipType: 'CONTAINS', conceptCode: { code: 'RID5804', codeSchemeDesignator: 'RID', codeMeaning: '毛刺征', codeMeaningEn: 'Spiculation' }, valueType: 'CODE', codeValue: { code: 'RID5804', codeSchemeDesignator: 'RID', codeMeaning: '毛刺征', codeMeaningEn: 'Spiculation' } },
  ] },
  { relationshipType: 'CONTAINS', conceptCode: { code: '121073', codeSchemeDesignator: 'DCM', codeMeaning: '印象', codeMeaningEn: 'Impression' }, valueType: 'TEXT', textValue: impression },
];

const buildDicomSrBase = (_id: string, studyUID: string, seriesUID: string, sopInstanceUID: string, findings: string, impression: string): DicomSrDocument => {
  const dataElements: DicomDataElement[] = [
    { tag: '00080005', vr: 'CS', name: 'SpecificCharacterSet', nameEn: 'Specific Character Set', value: 'ISO_IR 100', length: 10 },
    { tag: '00080016', vr: 'UI', name: 'SOPClassUID', nameEn: 'SOP Class UID', value: '1.2.840.10008.5.1.4.1.1.88.11', length: 26 },
    { tag: '00080018', vr: 'UI', name: 'SOPInstanceUID', nameEn: 'SOP Instance UID', value: sopInstanceUID, length: sopInstanceUID.length },
    { tag: '00080020', vr: 'DA', name: 'StudyDate', nameEn: 'Study Date', value: '20260915', length: 8 },
    { tag: '00080030', vr: 'TM', name: 'StudyTime', nameEn: 'Study Time', value: '110000', length: 6 },
    { tag: '00080050', vr: 'SH', name: 'AccessionNumber', nameEn: 'Accession Number', value: 'ACC20260915001', length: 14 },
    { tag: '00080060', vr: 'CS', name: 'Modality', nameEn: 'Modality', value: 'SR', length: 2 },
    { tag: '00080090', vr: 'PN', name: 'ReferringPhysicianName', nameEn: 'Referring Physician', value: '王医师^', length: 7 },
    { tag: '00100010', vr: 'PN', name: 'PatientName', nameEn: 'Patient Name', value: '张三^', length: 5 },
    { tag: '00100020', vr: 'LO', name: 'PatientID', nameEn: 'Patient ID', value: 'p-038', length: 5 },
    { tag: '00100030', vr: 'DA', name: 'PatientBirthDate', nameEn: 'Patient Birth Date', value: '19680101', length: 8 },
    { tag: '00100040', vr: 'CS', name: 'PatientSex', nameEn: 'Patient Sex', value: 'M', length: 1 },
    { tag: '0020000D', vr: 'UI', name: 'StudyInstanceUID', nameEn: 'Study Instance UID', value: studyUID, length: studyUID.length },
    { tag: '0020000E', vr: 'UI', name: 'SeriesInstanceUID', nameEn: 'Series Instance UID', value: seriesUID, length: seriesUID.length },
    { tag: '00200013', vr: 'IS', name: 'InstanceNumber', nameEn: 'Instance Number', value: 1, length: 1 },
    { tag: '0040A040', vr: 'CS', name: 'VerificationFlag', nameEn: 'Verification Flag', value: 'VERIFIED', length: 8 },
    { tag: '0040A491', vr: 'CS', name: 'CompletionFlag', nameEn: 'Completion Flag', value: 'COMPLETE', length: 9 },
    { tag: '0040A043', vr: 'SQ', name: 'ConceptNameCodeSequence', nameEn: 'Concept Name Code Sequence', value: [], length: 0 },
    { tag: '0040A730', vr: 'SQ', name: 'ContentSequence', nameEn: 'Content Sequence', value: [], length: 0 },
  ];
  const sr: DicomSrDocument = {
    id: _id,
    sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
    sopInstanceUID,
    studyInstanceUID: studyUID,
    seriesInstanceUID: seriesUID,
    instanceNumber: 1,
    templateId: 'TID2000',
    completionFlag: 'COMPLETE',
    verificationFlag: 'VERIFIED',
    contentSequence: [
      { conceptCode: { code: '2000', codeSchemeDesignator: 'DCM', codeMeaning: '诊断性成像报告', codeMeaningEn: 'Diagnostic Imaging Report' }, continuity: 'SEPARATE', items: dicomContentItems(findings, impression) },
    ],
    dataElements,
    referencedInstances: [
      { sopClassUID: '1.2.840.10008.5.1.4.1.1.2.1', sopInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1.1.1', purpose: 'Reference CT Image' },
    ],
    transferSyntaxUID: '1.2.840.10008.1.2.1',
    mediaStorageSOPInstanceUID: sopInstanceUID,
    generatedAt: new Date().toISOString(),
    generator: 'G005-RIS-DICOM-SR-Builder-v3.0.5.1',
    size: 0,
    validation: { passed: true, errors: [], warnings: [] },
  };
  const ds = buildDicomSrDataSet(sr);
  sr.size = new Blob([ds]).size;
  return sr;
};

export const DICOM_SR_MOCK: DicomSrDocument = buildDicomSrBase(
  'sr-rpt-038',
  '1.2.840.10008.5.1.4.1.1.2.1.1',
  '1.2.840.10008.5.1.4.1.1.2.1.1.99',
  '1.2.840.10008.5.1.4.1.1.88.11.1.20260915.110000.1',
  '右肺上叶尖段不规则结节 18mm×15mm,伴毛刺征及胸膜牵拉。',
  '右肺上叶周围型肺癌可能性大,建议穿刺活检。'
);

export const DICOM_SR_DOCUMENTS_MOCK: DicomSrDocument[] = [
  DICOM_SR_MOCK,
  buildDicomSrBase('sr-rpt-039', '1.2.840.10008.5.1.4.1.1.4.1.1', '1.2.840.10008.5.1.4.1.1.4.1.1.99', '1.2.840.10008.5.1.4.1.1.88.11.1.20260915.120000.1', '颅脑 MR 平扫未见明显异常。', '颅脑 MR 平扫未见明显异常。'),
  buildDicomSrBase('sr-rpt-040', '1.2.840.10008.5.1.4.1.1.2.1.2', '1.2.840.10008.5.1.4.1.1.2.1.2.99', '1.2.840.10008.5.1.4.1.1.88.11.1.20260915.130000.1', '肝脏形态正常,肝内多发低密度灶,考虑囊肿。', '肝囊肿,建议年度随访。'),
];

// ============================================================
// 3. FHIR R4 DiagnosticReport Mock
// ============================================================
function buildFhirJson(dr: FhirDiagnosticReport): string {
  return JSON.stringify(dr, null, 2);
}

const buildFhirDrBase = (id: string, status: FhirDiagnosticReport['status'], conclusion: string): FhirDiagnosticReport => {
  const fhir = {
    resourceType: 'DiagnosticReport' as const,
    id,
    meta: { versionId: '1', lastUpdated: new Date().toISOString(), profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'], tag: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'TREAT', display: 'Treatment' }] },
    identifier: [{ use: 'official' as const, system: 'urn:oid:2.16.840.1.113883.4.1', value: `RP${id}` }] as FhirIdentifier[],
    basedOn: [{ reference: 'ServiceRequest/sr-038', type: 'ServiceRequest' as const, display: 'Chest CT Order' }] as FhirReference[],
    status,
    category: [{
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD', display: 'Radiology', displayEn: 'Radiology' },
      ],
      text: '放射报告', textEn: 'Radiology',
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: '30746-2', display: 'CT Chest', displayEn: 'CT Chest' }],
      text: '胸部 CT', textEn: 'CT Chest',
    },
    subject: { reference: 'Patient/p-038', type: 'Patient' as const, display: 'Zhang San' },
    encounter: { reference: 'Encounter/enc-038', type: 'Encounter' as const },
    effectiveDateTime: '2026-09-15T10:00:00+08:00',
    issued: '2026-09-15T11:00:00+08:00',
    performer: [{ reference: 'Practitioner/u-001', type: 'Practitioner' as const, display: '陈医师' }] as FhirReference[],
    resultsInterpreter: [{ reference: 'Practitioner/u-001', type: 'Practitioner' as const, display: '陈医师' }] as FhirReference[],
    specimen: [],
    result: [{ reference: 'Observation/obs-038', type: 'Observation' as const }] as FhirReference[],
    imagingStudy: [{ reference: 'ImagingStudy/imgst-038', type: 'ImagingStudy' as const }] as FhirReference[],
    media: [{ comment: 'Key image', link: { reference: 'Media/m-038', type: 'Media' as const } }],
    conclusion,
    conclusionCode: [{
      coding: [{ system: 'http://snomed.info/sct', code: '254637007', display: 'Lung cancer', displayEn: 'Lung cancer' }],
      text: '右肺上叶周围型肺癌', textEn: 'RUL peripheral lung cancer',
    }],
    presentedForm: [{ contentType: 'application/pdf', url: `/api/v1/dist/fhir/dr/${id}.pdf`, size: 256000, title: '报告 PDF', creation: '2026-09-15T11:00:00+08:00' }] as FhirAttachment[],
    note: [{ authorString: '陈医师', time: '2026-09-15T11:00:00+08:00', text: '建议穿刺活检明确病理。' }] as FhirAnnotation[],
    json: '',
    generatedAt: new Date().toISOString(),
    generator: 'G005-RIS-FHIR-Builder-v3.0.5.1',
    validation: { passed: true, errors: [], warnings: [] },
  };
  fhir.json = buildFhirJson(fhir);
  return fhir;
};

export const FHIR_DR_MOCK: FhirDiagnosticReport = buildFhirDrBase('fhir-rpt-038', 'final', '右肺上叶周围型肺癌可能性大,建议穿刺活检。');
export const FHIR_DR_DOCUMENTS_MOCK: FhirDiagnosticReport[] = [
  FHIR_DR_MOCK,
  buildFhirDrBase('fhir-rpt-039', 'final', '颅脑 MR 平扫未见明显异常。'),
  buildFhirDrBase('fhir-rpt-040', 'final', '肝囊肿,建议年度随访。'),
  buildFhirDrBase('fhir-rpt-041', 'preliminary', '腰椎间盘膨出 L4-5, 待最终审签。'),
];

// ============================================================
// 4. IHE XDS.b Mock
// ============================================================
const buildXdsBase = (id: string, registryId: string, patientId: string, sourceId: string): XdsRegistry => {
  const docEntry: XdsDocumentEntry = {
    id, entryUUID: `urn:uuid:${id}-entry`,
    patientId, uniqueId: `1.2.840.113556.1.8000.2554.${id}`,
    title: '胸部 CT 增强报告', titleEn: 'Chest CT Enhanced Report',
    comments: '常规放射学检查报告',
    confidentiality: 'N',
    creationTime: '20260915110000',
    languageCode: 'zh-CN',
    legalAuthenticator: '王主任^MD^^^汉东省人民医院',
    serviceStartTime: '20260915100000',
    serviceStopTime: '20260915103000',
    sourcePatientId: patientId,
    sourcePatientInfo: { name: '张三', gender: 'M', birthDate: '19680101', id: patientId },
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.1.100',
    size: 256000,
    hash: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
    mimetype: 'application/pdf',
    status: 'approved',
    availability: 'Online',
    classifications: [
      { classificationScheme: 'urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a', nodeRepresentation: '51852-2', name: '评估与计划', nameEn: 'Assessment and Plan' },
      { classificationScheme: 'urn:uuid:f4f85eac-e6cb-4883-b524-f27018c4ffa4', nodeRepresentation: 'RAD', name: '放射学', nameEn: 'Radiology' },
      { classificationScheme: 'urn:uuid:2c6b8cb7-8b5a-4241-8d04-7f2c4c5e6f7a', nodeRepresentation: '11369-6', name: '当前用药', nameEn: 'Current Medications' },
    ],
    externalIdentifiers: [
      { identificationScheme: 'urn:uuid:6b5ae5d2-8b5a-4241-8d04-7f2c4c5e6f7a', value: patientId, name: '患者 ID', nameEn: 'Patient ID' },
      { identificationScheme: 'urn:uuid:58a6e8b0-2b5b-4251-b3f0-2a4c1a4f3b5d', value: `RP${id}`, name: '报告 ID', nameEn: 'Report ID' },
    ],
    slots: [
      { name: 'sourcePatientInfo', value: 'PID-3|p-038|PID-5|张三|PID-7|19680101|PID-8|M' },
      { name: 'size', value: '256000' },
    ],
    formatCode: { code: 'urn:ihe:rad:XDSDCM:1.2.840.10008.5.1.4.1.1.88.11', display: 'DICOM SR', scheme: '1.2.840.10008.2.6.1' },
    typeCode: { code: '51848-0', display: '放射学报告', scheme: '2.16.840.1.113883.6.1' },
    classCode: { code: '51852-2', display: '评估与计划', scheme: '2.16.840.1.113883.6.1' },
    healthcareFacilityType: { code: 'HOSP', display: '医院', scheme: '2.16.840.1.113883.5.11' },
    practiceSetting: { code: '394802001', display: '放射学', scheme: '2.16.840.1.113883.6.96' },
    eventCodeList: [{ code: 'IHE-RAD-001', display: '胸部 CT 增强', scheme: '1.3.6.1.4.1.21367.13.21' }],
  };
  const folder: XdsFolder = {
    id: `fld-${id}`, entryUUID: `urn:uuid:fld-${id}`,
    patientId, uniqueId: `1.2.840.113556.1.8000.2554.fld-${id}`,
    title: '胸部影像', titleEn: 'Chest Imaging',
    comments: '胸部影像资料汇总', codeList: [{ code: 'FOLDER-001', display: '按部位', scheme: '1.2.840.10008.2.6.1' }],
    lastUpdateTime: '20260915110000', folderType: 'study', status: 'approved',
  };
  const submissionSet: XdsSubmissionSet = {
    id: `ss-${id}`, entryUUID: `urn:uuid:ss-${id}`,
    patientId, uniqueId: `1.2.840.113556.1.8000.2554.ss-${id}`,
    sourceId,
    submissionTime: '20260915110000',
    title: '常规提交', titleEn: 'Routine Submission',
    comments: '胸部 CT 报告提交', contentTypeCode: { code: '51852-2', display: '评估与计划', scheme: '2.16.840.1.113883.6.1' },
    author: [{ authorPerson: '陈医师^MD', authorInstitution: ['汉东省人民医院'], authorRole: '主治医师', authorSpecialty: '放射学' }],
    intendedRecipient: [{ id: 'Practitioner/u-001', display: '陈医师' }],
    submissionSetType: 'new',
  };
  const associations: XdsAssociation[] = [
    { id: `assoc-1-${id}`, entryUUID: `urn:uuid:assoc-1-${id}`, sourceObject: submissionSet.entryUUID, targetObject: docEntry.entryUUID, associationType: 'HASMEMBER', submissionSetStatus: 'approved', availabilityStatus: 'approved', slots: [] },
    { id: `assoc-2-${id}`, entryUUID: `urn:uuid:assoc-2-${id}`, sourceObject: folder.entryUUID, targetObject: docEntry.entryUUID, associationType: 'HASMEMBER', submissionSetStatus: 'approved', availabilityStatus: 'approved', slots: [] },
  ];
  return {
    id, registryId, patientId, sourceId,
    submissionSet,
    documentEntries: [docEntry],
    folders: [folder],
    associations,
    registryStoredQuery: [
      { queryId: 'urn:uuid:14d4debf-8f97-4251-9a74-fb0b3b2c4f7a', queryType: 'FindDocuments', parameters: { '$XDSDocumentEntryPatientId': patientId, '$XDSDocumentEntryStatus': 'urn:ihe:iti:2017:Status:Approved' } },
    ],
    responses: [{ rs: 'Success', status: 200, timestamp: '2026-09-15T11:00:05+08:00' }],
    registeredAt: '2026-09-15T11:00:00+08:00',
    registeredBy: 'G005-RIS-XDS-Registry-Node-1',
    repositoryUniqueIds: ['1.2.840.113556.1.8000.2554.1.100'],
    homeCommunityId: 'urn:oid:1.2.840.113556.1.8000.2554.1',
    size: 0,
    validation: { passed: true, errors: [], warnings: [] },
  };
};

export const XDS_REGISTRY_MOCK: XdsRegistry = buildXdsBase('xds-rpt-038', 'REGISTRY-001', 'p-038', '1.2.840.113556.1.8000.2554.1.1');
export const XDS_REGISTRIES_MOCK: XdsRegistry[] = [
  XDS_REGISTRY_MOCK,
  buildXdsBase('xds-rpt-039', 'REGISTRY-001', 'p-039', '1.2.840.113556.1.8000.2554.1.2'),
  buildXdsBase('xds-rpt-040', 'REGISTRY-001', 'p-040', '1.2.840.113556.1.8000.2554.1.3'),
];

// ============================================================
// 5. 导出信封
// ============================================================
export const INTEGRATION_ENVELOPES_MOCK: IntegrationExportEnvelope[] = [
  { id: 'env-001', reportId: 'rpt-038', format: 'hl7-cda', formatLabel: 'HL7 CDA R2', formatLabelEn: 'HL7 CDA R2', filename: 'rpt-038-cda.xml', size: CDA_DEMO.size, hash: 'sha256-001', generatedAt: new Date().toISOString(), generatedBy: '陈医师', validation: { passed: true, errors: [], warnings: [] }, storageUri: '/storage/cda/2026/09/15/rpt-038-cda.xml', byteCount: CDA_DEMO.size, signatureAlgorithm: 'SM2', signedBy: '王主任', signedAt: '2026-09-15T11:05:00+08:00' },
  { id: 'env-002', reportId: 'rpt-038', format: 'dicom-sr', formatLabel: 'DICOM SR', formatLabelEn: 'DICOM SR', filename: 'rpt-038-sr.dcm', size: DICOM_SR_MOCK.size, hash: 'sha256-002', generatedAt: new Date().toISOString(), generatedBy: '陈医师', validation: { passed: true, errors: [], warnings: [] }, storageUri: '/storage/dicomsr/2026/09/15/rpt-038-sr.dcm', byteCount: DICOM_SR_MOCK.size, signatureAlgorithm: 'SHA256withRSA' },
  { id: 'env-003', reportId: 'rpt-038', format: 'fhir-dr', formatLabel: 'FHIR R4 DiagnosticReport', formatLabelEn: 'FHIR R4 DiagnosticReport', filename: 'rpt-038-fhir.json', size: FHIR_DR_MOCK.json.length, hash: 'sha256-003', generatedAt: new Date().toISOString(), generatedBy: '陈医师', validation: { passed: true, errors: [], warnings: [] }, storageUri: '/storage/fhir/2026/09/15/rpt-038-fhir.json', byteCount: FHIR_DR_MOCK.json.length, signatureAlgorithm: 'SHA256withRSA' },
  { id: 'env-004', reportId: 'rpt-038', format: 'ihe-xds', formatLabel: 'IHE XDS.b Registry', formatLabelEn: 'IHE XDS.b Registry', filename: 'rpt-038-xds.xml', size: 4096, hash: 'sha256-004', generatedAt: new Date().toISOString(), generatedBy: '陈医师', validation: { passed: true, errors: [], warnings: [] }, storageUri: '/storage/xds/2026/09/15/rpt-038-xds.xml', byteCount: 4096, signatureAlgorithm: 'SM2', signedBy: '王主任', signedAt: '2026-09-15T11:10:00+08:00' },
];
