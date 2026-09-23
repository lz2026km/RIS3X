/**
 * G005 放射RIS系统 v3.0.5.1 - R3.INTEGRATION 集成模块类型定义
 * A5-REPORT 报告子系统 80 升级点
 *
 * 跨状态机:HIS / PACS / EHR / CDR / BI / Webhook / 区域平台
 * 涵盖 HL7 CDA R2 / DICOM SR / FHIR R4 DiagnosticReport / IHE XDS.b
 */

// ---------- 1. HL7 CDA R2 ----------
export type CdaSectionCode =
  | '10164-2' | '29545-1' | '18776-5' | '10160-0' | '11369-6'
  | '51852-2' | '29762-2' | '42349-1' | '8716-3' | '11369-6';

export interface CdaCode {
  code: string;
  codeSystem: string;
  codeSystemName: string;
  displayName: string;
}

export interface CdaEntry {
  type: 'observation' | 'act' | 'procedure' | 'substanceAdministration';
  code: CdaCode;
  value?: string | number;
  unit?: string;
  text: string;
  effectiveTime?: string;
  performerName?: string;
}

export interface CdaSection {
  code: CdaSectionCode;
  title: string;
  titleEn: string;
  text: string;
  entries: CdaEntry[];
  order: number;
}

export interface CdaActor {
  id: string;
  type: 'doctor' | 'patient' | 'organization' | 'device' | 'custodian';
  name: string;
  nameEn: string;
  idRoot: string;
  idExtension: string;
  telecom?: string;
  addr?: string;
  representedOrganization?: { name: string; nameEn: string; idRoot: string; idExtension: string };
}

export interface CdaDocument {
  id: string;
  typeId: { root: string; extension: string };
  templateId: { root: string; extension: string }[];
  title: string;
  titleEn: string;
  effectiveTime: string;
  confidentialityCode: 'N' | 'R' | 'V';
  languageCode: 'zh-CN' | 'en-US';
  recordTarget: CdaActor;
  author: CdaActor;
  custodian: CdaActor;
  legalAuthenticator: CdaActor;
  participants: CdaActor[];
  relatedDocuments: { typeCode: string; id: string; setId: string; version: number }[];
  sections: CdaSection[];
  version: number;
  setId: string;
  xml: string;
  size: number;
  generatedAt: string;
  generator: string;
  validation: { passed: boolean; errors: string[]; warnings: string[] };
}

// ---------- 2. DICOM SR ----------
export type DicomSrTemplateId = 'TID2000' | 'TID2010' | 'TID1500' | 'TID5000';
export type DicomVrType =
  | 'AE' | 'AS' | 'AT' | 'CS' | 'DA' | 'DS' | 'DT' | 'FL' | 'FD'
  | 'IS' | 'LO' | 'LT' | 'OB' | 'OD' | 'OF' | 'OL' | 'OV' | 'OW'
  | 'PN' | 'SH' | 'SL' | 'SQ' | 'SS' | 'ST' | 'SV' | 'TM' | 'UC'
  | 'UI' | 'UL' | 'UN' | 'UR' | 'US' | 'UT';

export interface DicomDataElement {
  tag: string;
  vr: DicomVrType;
  name: string;
  nameEn: string;
  value: string | number | string[] | number[];
  length: number;
  children?: DicomDataElement[];
}

export interface DicomContentItem {
  relationshipType: 'CONTAINS' | 'HAS PROPERTIES' | 'HAS OBS CONTEXT' | 'INFERRED FROM' | 'SELECTED FROM' | 'HAS CONCEPT MOD';
  conceptCode: { code: string; codeSchemeDesignator: string; codeMeaning: string; codeMeaningEn: string };
  valueType: 'TEXT' | 'NUM' | 'CODE' | 'DATE' | 'TIME' | 'DATETIME' | 'UIDREF' | 'IMAGE' | 'CONTAINER' | 'PNAME' | 'COMPOSITE' | 'WAVEFORM';
  textValue?: string;
  numValue?: number;
  unitCode?: { code: string; codeSchemeDesignator: string; codeMeaning: string; codeMeaningEn: string };
  codeValue?: { code: string; codeSchemeDesignator: string; codeMeaning: string; codeMeaningEn: string };
  dateValue?: string;
  timeValue?: string;
  dateTimeValue?: string;
  uidRefValue?: string;
  imageRefValue?: { sopClassUID: string; sopInstanceUID: string };
  children?: DicomContentItem[];
}

export interface DicomContentSequence {
  conceptCode: { code: string; codeSchemeDesignator: string; codeMeaning: string; codeMeaningEn: string };
  continuity: 'CONTINUOUS' | 'SEPARATE';
  items: DicomContentItem[];
}

export interface DicomSrDocument {
  id: string;
  sopClassUID: string;
  sopInstanceUID: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  templateId: DicomSrTemplateId;
  completionFlag: 'PARTIAL' | 'COMPLETE';
  verificationFlag: 'UNVERIFIED' | 'VERIFIED';
  contentSequence: DicomContentSequence[];
  dataElements: DicomDataElement[];
  referencedInstances: { sopClassUID: string; sopInstanceUID: string; purpose: string }[];
  transferSyntaxUID: string;
  mediaStorageSOPInstanceUID: string;
  generatedAt: string;
  generator: string;
  size: number;
  validation: { passed: boolean; errors: string[]; warnings: string[] };
}

// ---------- 3. FHIR R4 DiagnosticReport ----------
export type FhirResourceType =
  | 'DiagnosticReport' | 'Patient' | 'Observation' | 'Practitioner'
  | 'Organization' | 'ServiceRequest' | 'ImagingStudy' | 'Media'
  | 'Encounter'
  | 'Composition' | 'DocumentReference' | 'Bundle' | 'OperationOutcome';

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
  displayEn: string;
}
export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text: string;
  textEn: string;
}
export interface FhirReference {
  reference: string;
  type: FhirResourceType;
  display?: string;
  identifier?: { system: string; value: string };
}
export interface FhirAttachment {
  contentType: string;
  url?: string;
  data?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}
export interface FhirPeriod {
  start: string;
  end?: string;
}
export interface FhirIdentifier {
  use: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  system: string;
  value: string;
  type?: FhirCodeableConcept;
}
export interface FhirAnnotation {
  authorString?: string;
  authorReference?: FhirReference;
  time: string;
  text: string;
}
export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  meta: { versionId: string; lastUpdated: string; profile: string[]; tag: { system: string; code: string; display: string }[] };
  identifier: FhirIdentifier[];
  basedOn: FhirReference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime: string;
  effectivePeriod?: FhirPeriod;
  issued: string;
  performer: FhirReference[];
  resultsInterpreter: FhirReference[];
  specimen: FhirReference[];
  result: FhirReference[];
  imagingStudy: FhirReference[];
  media: { comment: string; link: FhirReference }[];
  conclusion?: string;
  conclusionCode?: FhirCodeableConcept[];
  presentedForm: FhirAttachment[];
  note: FhirAnnotation[];
  json: string;
  generatedAt: string;
  generator: string;
  validation: { passed: boolean; errors: string[]; warnings: string[] };
}

// ---------- 4. IHE XDS.b ----------
export type XdsFolderType = 'episode' | 'study' | 'series' | 'patient' | 'institution';
export type XdsSubmissionSetType = 'new' | 'amendment' | 'replacement' | 'transform' | 'addendum';
export type XdsClassificationCode = 'department' | 'class' | 'type' | 'confidentiality' | 'format' | 'healthcareFacility' | 'practiceSetting' | 'eventCodeList';
export type XdsAssociationType = 'APND' | 'XFRM' | 'RPLC' | 'SIGN' | 'HASMEMBER' | 'ISMEMBEROF';
export type XdsStatus = 'approved' | 'deprecated';
export type XdsDocumentAvailability = 'Online' | 'Offline' | 'Nearline' | 'Unavailable';

export interface XdsClassification {
  classificationScheme: string;
  nodeRepresentation: string;
  name: string;
  nameEn: string;
  slot?: { name: string; value: string }[];
}
export interface XdsExternalIdentifier {
  identificationScheme: string;
  value: string;
  name: string;
  nameEn: string;
}
export interface XdsSlot {
  name: string;
  value: string;
}
export interface XdsDocumentEntry {
  id: string;
  entryUUID: string;
  patientId: string;
  uniqueId: string;
  title: string;
  titleEn: string;
  comments: string;
  confidentiality: 'N' | 'R' | 'V';
  creationTime: string;
  languageCode: 'zh-CN' | 'en-US';
  legalAuthenticator: string;
  serviceStartTime: string;
  serviceStopTime: string;
  sourcePatientId: string;
  sourcePatientInfo: { name: string; gender: string; birthDate: string; id: string };
  repositoryUniqueId: string;
  size: number;
  hash: string;
  mimetype: 'application/pdf' | 'text/xml' | 'application/cda+xml' | 'application/fhir+json' | 'application/dicom';
  status: XdsStatus;
  availability: XdsDocumentAvailability;
  classifications: XdsClassification[];
  externalIdentifiers: XdsExternalIdentifier[];
  slots: XdsSlot[];
  formatCode: { code: string; display: string; scheme: string };
  typeCode: { code: string; display: string; scheme: string };
  classCode: { code: string; display: string; scheme: string };
  healthcareFacilityType: { code: string; display: string; scheme: string };
  practiceSetting: { code: string; display: string; scheme: string };
  eventCodeList: { code: string; display: string; scheme: string }[];
}
export interface XdsFolder {
  id: string;
  entryUUID: string;
  patientId: string;
  uniqueId: string;
  title: string;
  titleEn: string;
  comments: string;
  codeList: { code: string; display: string; scheme: string }[];
  lastUpdateTime: string;
  folderType: XdsFolderType;
  status: XdsStatus;
}
export interface XdsSubmissionSet {
  id: string;
  entryUUID: string;
  patientId: string;
  uniqueId: string;
  sourceId: string;
  submissionTime: string;
  title: string;
  titleEn: string;
  comments: string;
  contentTypeCode: { code: string; display: string; scheme: string };
  author: { authorPerson: string; authorInstitution: string[]; authorRole: string; authorSpecialty: string }[];
  intendedRecipient: { id: string; display: string }[];
  submissionSetType: XdsSubmissionSetType;
}
export interface XdsAssociation {
  id: string;
  entryUUID: string;
  sourceObject: string;
  targetObject: string;
  associationType: XdsAssociationType;
  submissionSetStatus: XdsStatus;
  originalStatus?: XdsStatus;
  newStatus?: XdsStatus;
  availabilityStatus: XdsStatus;
  slots: XdsSlot[];
}
export interface XdsRegistry {
  id: string;
  registryId: string;
  patientId: string;
  sourceId: string;
  submissionSet: XdsSubmissionSet;
  documentEntries: XdsDocumentEntry[];
  folders: XdsFolder[];
  associations: XdsAssociation[];
  registryStoredQuery: { queryId: string; queryType: 'FindDocuments' | 'GetDocuments' | 'FindFolders' | 'GetFolderAndContents'; parameters: Record<string, string> }[];
  responses: {
    rs: 'Success' | 'Failure' | 'PartialSuccess';
    status: number;
    timestamp: string;
    errors?: { codeContext: string; errorCode: string; severity: 'error' | 'warning' };
  }[];
  registeredAt: string;
  registeredBy: string;
  repositoryUniqueIds: string[];
  homeCommunityId: string;
  size: number;
  validation: { passed: boolean; errors: string[]; warnings: string[] };
}

// ---------- 5. 通用响应 ----------
export interface IntegrationExportEnvelope {
  id: string;
  reportId: string;
  format: 'hl7-cda' | 'dicom-sr' | 'fhir-dr' | 'ihe-xds';
  formatLabel: string;
  formatLabelEn: string;
  filename: string;
  size: number;
  hash: string;
  generatedAt: string;
  generatedBy: string;
  expiresAt?: string;
  validation: { passed: boolean; errors: string[]; warnings: string[] };
  storageUri: string;
  byteCount: number;
  signatureAlgorithm: 'SM2' | 'SHA256withRSA' | 'SHA512withECDSA';
  signedBy?: string;
  signedAt?: string;
}

// ---------- 6. 测试桩 ----------
export type IntegrationTestId = 'I001' | 'I014' | 'I030' | 'I039' | 'I060' | 'I077' | 'I080';

export const CDA_TEMPLATE_ROOTS = {
  diagnosticImaging: '2.16.840.1.113883.10.20.22.1.1',
  imaging: '1.2.840.10008.9.1',
  dischargeSummary: '2.16.840.1.113883.10.20.22.1.8',
  continuityOfCare: '2.16.840.1.113883.10.20.22.1.2',
};
