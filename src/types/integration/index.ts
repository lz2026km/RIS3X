/**
 * G005 放射RIS系统 v3.0.6.0 - 集成模块共享类型
 * 涵盖 HL7 v2.x MLLP / HL7 V2 Parser / FHIR R4-R5 / IHE XDS.b-PIX-PDQ-PAM-ATNA / DICOMweb
 * 15 升级点:统一接口契约 / 类型安全
 */

import type { FhirResourceType } from '../R3/R3.INTEGRATION';

// ============================================================
// 1. HL7 v2.x 通用段 / 字段
// ============================================================
export type Hl7SegmentName =
  | 'MSH' | 'PID' | 'PV1' | 'PV2' | 'OBR' | 'OBX' | 'ORC' | 'AL1' | 'DG1'
  | 'NK1' | 'EVN' | 'PD1' | 'PR1' | 'IN1' | 'GT1' | 'MRG' | 'NTE' | 'MSA'
  | 'ERR' | 'QPD' | 'QAK' | 'RCP' | 'RDS' | 'RXA' | 'RXE' | 'RXO' | 'RXD'
  | 'SCH' | 'TXA' | 'PID' | 'PDC' | 'FT1' | 'CSP' | 'CSR' | 'CSS' | 'AIS'
  | 'AIG' | 'AIL' | 'AIP' | 'APR' | 'BHS' | 'FHS' | 'BTS' | 'FTS' | 'DSP';

export type Hl7MessageType =
  | 'ADT^A01' | 'ADT^A02' | 'ADT^A03' | 'ADT^A04' | 'ADT^A05' | 'ADT^A08' | 'ADT^A11' | 'ADT^A12' | 'ADT^A13'
  | 'ORM^O01' | 'ORU^R01' | 'DFT^P03' | 'MDM^T02' | 'ACK' | 'QRY^Q01' | 'QRY^Q02' | 'SIU^S12' | 'SIU^S13'
  | 'SIU^S14' | 'SIU^S15' | 'SIU^S22' | 'SIU^S23' | 'SIU^S26' | 'BAR^P01' | 'BAR^P02' | 'MFN^M01' | 'MFK^M01'
  | 'VXU^V04' | 'RSP^K11' | 'RSP^K21' | 'RSP^K23' | 'RSP^K25' | 'RSP^Q11' | 'RSP^Z82' | 'RDS^O13' | 'OMG^O19'
  | 'OML^O21' | 'OMP^O09' | 'OMS^O05' | 'ORL^O22' | 'ORM^O01' | 'ORN^O08' | 'ORP^O10' | 'ORU^R01' | 'OSQ^Q06'
  | 'OUL^R21' | 'PEX^P07' | 'PGL^PC6' | 'PIN^I07' | 'PMU^B01' | 'PPG^PCC' | 'PPP^PCB' | 'PPR^PC1' | 'PPT^PCL'
  | 'PPV^PPA' | 'PRR^PC5' | 'PTR^PCF' | 'QBP^Q11' | 'QBP^Q21' | 'QBP^Q22' | 'QBP^Q23' | 'QBP^Q24' | 'QBP^Q25'
  | 'QBP^Z73' | 'QCN^J01' | 'QRY^Q01' | 'QRY^Q02' | 'QSB^Q16' | 'QSX^J02' | 'QVR^Q17' | 'RAR^RAR' | 'RDR^RDR'
  | 'RDS^O13' | 'RDY^K15' | 'REF^I12' | 'RER^RER' | 'RGR^RGR' | 'RGV^O15' | 'ROR^ROR';

export type Hl7EncodingCharacters = {
  fieldSeparator: string;
  componentSeparator: string;
  repetitionSeparator: string;
  escapeCharacter: string;
  subcomponentSeparator: string;
};

export type Hl7FieldValue = string | Hl7Component | Hl7Component[];
export type Hl7Component = string | Hl7Subcomponent[];
export type Hl7Subcomponent = string;

export interface Hl7Field {
  index: number;
  raw: string;
  value: Hl7FieldValue;
  components: string[];
  repetitions: string[];
}

export interface Hl7Segment {
  name: Hl7SegmentName;
  fields: Hl7Field[];
  raw: string;
  order: number;
}

export interface Hl7ParsedMessage {
  raw: string;
  encoding: Hl7EncodingCharacters;
  msh: Hl7Segment;
  segments: Hl7Segment[];
  messageType: string;
  triggerEvent: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: string;
  version: string;
  processingId: string;
  patient?: Hl7Segment;
  visit?: Hl7Segment;
  order?: Hl7Segment[];
  observations?: Hl7Segment[];
  notes?: Hl7Segment[];
}

export interface Hl7ValidationIssue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  segment?: string;
  field?: number;
  location?: string;
}

export interface Hl7ValidationResult {
  passed: boolean;
  issues: Hl7ValidationIssue[];
  errors: number;
  warnings: number;
}

// ============================================================
// 2. MLLP
// ============================================================
export type MllpEvent =
  | { type: 'connect'; peer: string; ts: number }
  | { type: 'disconnect'; peer: string; ts: number; reason?: string }
  | { type: 'message'; peer: string; ts: number; message: Hl7ParsedMessage; raw: string; bytes: number }
  | { type: 'ack'; peer: string; ts: number; ack: string; controlId: string; ackCode: 'AA' | 'AE' | 'AR' }
  | { type: 'error'; peer?: string; ts: number; message: string; code?: string }
  | { type: 'start'; ts: number; port: number }
  | { type: 'stop'; ts: number };

export type MllpHandler = (event: MllpEvent) => void;

export interface MllpServerConfig {
  port: number;
  host?: string;
  encoding: 'UTF-8' | 'GBK' | 'GB18030';
  maxFrameBytes: number;
  keepAliveMs: number;
  autoAck: boolean;
  framingTimeoutMs: number;
}

export interface MllpConnection {
  id: string;
  remote: string;
  connectedAt: number;
  messages: number;
  lastActivity: number;
  status: 'connected' | 'idle' | 'closed';
}

export interface MllpServerStats {
  port: number;
  running: boolean;
  startedAt?: number;
  uptimeMs: number;
  connections: MllpConnection[];
  totalConnections: number;
  totalMessages: number;
  totalAckSent: number;
  totalError: number;
  bytesReceived: number;
  bytesSent: number;
}

// ============================================================
// 3. FHIR
// ============================================================
export type FhirVersion = 'R4' | 'R4B' | 'R5';

export interface FhirResourceEnvelope {
  resourceType: FhirResourceType | string;
  id: string;
  meta?: { versionId?: string; lastUpdated?: string; profile?: string[]; source?: string; tag?: { system: string; code: string; display?: string }[] };
  resource: Record<string, unknown>;
}

export interface FhirBundleEntry {
  fullUrl?: string;
  resource?: Record<string, unknown>;
  request?: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; ifNoneMatch?: string; ifMatch?: string };
  response?: { status: string; location?: string; etag?: string; lastModified?: string };
  search?: { mode: 'match' | 'include' | 'outcome'; score?: number };
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id?: string;
  meta?: { lastUpdated: string };
  type: 'searchset' | 'collection' | 'transaction' | 'transaction-response' | 'document' | 'batch' | 'batch-response' | 'history';
  total?: number;
  link?: { relation: string; url: string }[];
  entry: FhirBundleEntry[];
}

export interface FhirSearchParam {
  name: string;
  type: 'number' | 'date' | 'string' | 'token' | 'reference' | 'quantity' | 'uri' | 'composite';
  documentation: string;
  expression?: string;
}

export interface FhirSearchResult {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  link: { relation: 'self' | 'next' | 'previous'; url: string }[];
  entry: { fullUrl: string; resource: Record<string, unknown>; search: { mode: 'match'; score?: number } }[];
}

export interface FhirOperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  diagnostics?: string;
  expression?: string[];
  details?: { text: string; coding?: { system: string; code: string; display?: string }[] };
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  id?: string;
  meta?: { lastUpdated: string };
  issue: FhirOperationOutcomeIssue[];
}

export interface FhirCapabilityStatement {
  resourceType: 'CapabilityStatement';
  status: 'active' | 'draft' | 'retired' | 'unknown';
  date: string;
  publisher: string;
  kind: 'instance' | 'capability' | 'requirements';
  software: { name: string; version: string };
  fhirVersion: FhirVersion;
  format: ('json' | 'xml')[];
  rest: {
    mode: 'server' | 'client';
    security?: { cors: boolean; service: { coding: { system: string; code: string }[] }[] };
    resource: { type: FhirResourceType; interaction: { code: 'read' | 'search-type' | 'create' | 'update' | 'delete' }[]; searchParam?: FhirSearchParam[]; versioning?: 'no-version' | 'versioned' | 'versioned-update' }[];
  }[];
}

export interface FhirClientConfig {
  baseUrl: string;
  version: FhirVersion;
  auth?: { type: 'none' | 'bearer' | 'basic' | 'smart'; token?: string; clientId?: string };
  timeoutMs: number;
  retries: number;
  prefer: 'return=representation' | 'return=minimal' | 'return=OperationOutcome';
  pretty: boolean;
}

export interface FhirClientResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body?: T;
  etag?: string;
  lastModified?: string;
  location?: string;
  durationMs: number;
}

// ============================================================
// 4. IHE
// ============================================================
export type IheProfileId = 'XDS.b' | 'PIX' | 'PDQ' | 'ATNA' | 'PAM' | 'XDR' | 'XCA' | 'XDS-I' | 'BPPC' | 'XCF' | 'XCDR' | 'PDQm' | 'PIXm';

export interface IheAffinityDomain {
  homeCommunityId: string;
  name: string;
  nameEn: string;
  repositoryUniqueIds: string[];
  registryUniqueId: string;
  assigningAuthorityId: string;
  pixManagerEndpoint?: string;
  pdqSupplierEndpoint?: string;
  registryEndpoint?: string;
  repositoryEndpoint?: string;
  atnaEndpoint?: string;
}

export interface IheXdsDocument {
  entryUUID: string;
  uniqueId: string;
  patientId: string;
  repositoryUniqueId: string;
  classCode: string;
  typeCode: string;
  formatCode: string;
  size: number;
  hash: string;
  mimeType: string;
  title: string;
  creationTime: string;
  status: 'approved' | 'deprecated';
  availability: 'Online' | 'Offline' | 'Nearline';
}

export interface IheXdsSubmission {
  submissionSetId: string;
  patientId: string;
  sourceId: string;
  submissionTime: string;
  author: { person: string; institution: string; role: string; specialty: string };
  contentTypeCode: string;
  documentEntries: IheXdsDocument[];
}

export interface IheXdsQuery {
  patientId: string;
  status?: 'approved' | 'deprecated';
  classCode?: string;
  typeCode?: string;
  creationTimeFrom?: string;
  creationTimeTo?: string;
  formatCode?: string;
  limit?: number;
}

export interface IheXdsQueryResult {
  total: number;
  documents: IheXdsDocument[];
  registryObjectList: { id: string; status: string }[];
  queryTime: number;
}

export interface IhePixFeed {
  patientId: string;
  assigningAuthority: string;
  identifiers: { domain: string; value: string; assigningAuthority: string }[];
  name: { family: string; given: string[] };
  birthDate: string;
  gender: 'M' | 'F' | 'O' | 'U';
  address?: { line: string[]; city: string; state: string; postalCode: string; country: string };
  telecom?: { system: 'phone' | 'email' | 'sms'; value: string; use?: 'home' | 'work' | 'mobile' };
}

export interface IhePdqQuery {
  patientId?: string;
  familyName?: string;
  givenName?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O' | 'U';
  addressCity?: string;
  addressState?: string;
  assigningAuthority?: string;
}

export interface IhePdqResult {
  patientId: string;
  assigningAuthority: string;
  identifiers: { domain: string; value: string }[];
  name: { family: string; given: string[] };
  birthDate: string;
  gender: string;
  address?: string;
  phone?: string;
  confidence: number;
}

export interface IhePamMessage {
  messageType: 'ADT^A01' | 'ADT^A03' | 'ADT^A04' | 'ADT^A05' | 'ADT^A08' | 'ADT^A11' | 'ADT^A13';
  patientId: string;
  assigningAuthority: string;
  visitNumber?: string;
  accountNumber?: string;
  attendingDoctor?: string;
  classCode?: 'I' | 'O' | 'E' | 'P' | 'R';
  assignedLocation?: { facility: string; building?: string; floor?: string; pointOfCare?: string; room?: string; bed?: string };
  admitDateTime?: string;
  dischargeDateTime?: string;
}

// ============================================================
// 5. DICOMweb
// ============================================================
export type DicomWebTransferSyntax =
  | '1.2.840.10008.1.2'        // Implicit VR Little Endian
  | '1.2.840.10008.1.2.1'      // Explicit VR Little Endian
  | '1.2.840.10008.1.2.1.99'   // Deflated Explicit VR Little Endian
  | '1.2.840.10008.1.2.2'      // Explicit VR Big Endian
  | '1.2.840.10008.1.2.4.50'   // JPEG Baseline
  | '1.2.840.10008.1.2.4.70'   // JPEG Lossless
  | '1.2.840.10008.1.2.4.90'   // JPEG 2000 Lossless
  | '1.2.840.10008.1.2.4.91'   // JPEG 2000
  | '1.2.840.10008.1.2.5'      // RLE Lossless
  | 'application/dicom';

export interface DicomWebMetadata {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  patientID?: string;
  patientName?: string;
  studyDate?: string;
  studyDescription?: string;
  modality?: string;
  numberOfSeriesRelatedInstances?: number;
  numberOfStudyRelatedInstances?: number;
  transferSyntaxUID?: DicomWebTransferSyntax;
  sopClassUID?: string;
  instanceNumber?: number;
  contentSequence?: unknown[];
  bulkDataUUID?: string;
  thumbnail?: string;
}

export interface StowRsUploadRequest {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  content: ArrayBuffer | Blob;
  transferSyntaxUID?: DicomWebTransferSyntax;
  metadata?: DicomWebMetadata;
}

export interface StowRsResult {
  status: 'success' | 'warning' | 'failure';
  storeCount: number;
  failedCount: number;
  referenceld: string[];
  failedSopInstances: { sopInstanceUID: string; reason: string; statusCode: number }[];
  transactionUID: string;
  responseURL?: string;
}

export interface QidoRsQuery {
  PatientID?: string;
  PatientName?: string;
  StudyDate?: string;
  StudyDescription?: string;
  Modality?: string;
  StudyInstanceUID?: string;
  accessionNumber?: string;
  limit?: number;
  offset?: number;
  fuzzymatching?: boolean;
}

export interface QidoRsResult {
  results: DicomWebMetadata[];
  total: number;
  link: { relation: 'self' | 'next' | 'previous'; url: string }[];
  transactionUID: string;
}

export interface WadoRsRequest {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  transferSyntaxUID?: DicomWebTransferSyntax;
  frameNumber?: number;
  range?: string;
  contentType?: string;
  annotation?: 'png' | 'jpeg';
  quality?: number;
  viewport?: { rows: number; columns: number };
  window?: { center: number; width: number };
}

export interface WadoRsResult {
  contentType: string;
  body: ArrayBuffer | Blob;
  size: number;
  transferSyntaxUID: DicomWebTransferSyntax;
  contentLocation?: string;
  byteRange?: string;
}

// ============================================================
// 6. ATNA 审计
// ============================================================
export type AtnaEventOutcome = 'Success' | 'MinorFailure' | 'SeriousFailure' | 'MajorFailure';
export type AtnaEventAction = 'C' | 'R' | 'U' | 'D' | 'E';
export type AtnaEventId = {
  code: string;
  displayName: string;
  codeSystem: 'DCM' | 'IHE' | '99PERCENT';
};

export interface AtnaAuditMessage {
  eventId: AtnaEventId;
  eventDateTime: string;
  eventOutcome: AtnaEventOutcome;
  eventActionCode?: AtnaEventAction;
  userID: string;
  userName?: string;
  userIsRequestor: boolean;
  sourceType: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  sourceID: string;
  sourceAddress?: string;
  alternativeUserID?: string;
  auditSourceID: string;
  enterpriseSiteID?: string;
  participantObjects: AtnaParticipantObject[];
  messageType: 'AuditMessage' | 'AuditTrailMessage';
  messageId: string;
}

export interface AtnaParticipantObject {
  participantObjectType: '1' | '2' | '3' | '4';
  participantObjectTypeCodeRole: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23' | '24';
  participantObjectID: string;
  participantObjectIDTypeCode?: AtnaEventId;
  participantObjectName?: string;
  participantObjectDetail?: { type: string; value: string }[];
  participantObjectDescription?: string;
  participantObjectQuery?: string;
  sopClass?: { uid: string; name: string };
  participantObjectContainsStudy?: { studyInstanceUID: string; seriesInstanceUID?: string; sopInstanceUID?: string }[];
}

export interface AtnaAuditLogEntry extends AtnaAuditMessage {
  id: string;
  recordedAt: string;
  hash: string;
  previousHash?: string;
  sequence: number;
  retention: number;
  encrypted: boolean;
  signature?: string;
}

// ============================================================
// 7. IHE Connectathon
// ============================================================
export type IheTestStatus = 'pass' | 'fail' | 'skip' | 'pending' | 'running' | 'warning';
export type IheTestCategory = 'XDS' | 'PIX' | 'PDQ' | 'ATNA' | 'PAM' | 'XCA' | 'XDR' | 'IUA' | 'BPPC' | 'CSD' | 'DSUB' | 'SAML' | 'CON';

export interface IheTestStep {
  id: string;
  description: string;
  message?: string;
  expected?: string;
  actual?: string;
  status: IheTestStatus;
  durationMs: number;
  assertion?: { path: string; operator: 'eq' | 'ne' | 'contains' | 'exists' | 'regex' | 'gt' | 'lt'; value?: string };
}

export interface IheTestCase {
  id: string;
  profile: IheProfileId;
  category: IheTestCategory;
  actor: string;
  role: 'source' | 'consumer' | 'registry' | 'repository' | 'manager' | 'supplier' | 'consumer-pix' | 'source-pix';
  title: string;
  titleEn: string;
  description: string;
  precondition: string[];
  postcondition: string[];
  steps: IheTestStep[];
  status: IheTestStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
  options?: Record<string, string>;
}

export interface IheConnectathonSession {
  id: string;
  name: string;
  venue: string;
  track: string;
  monitor: string;
  startedAt: string;
  finishedAt?: string;
  status: 'planning' | 'running' | 'completed' | 'aborted';
  profiles: IheProfileId[];
  testCases: IheTestCase[];
  passCount: number;
  failCount: number;
  warnCount: number;
  skipCount: number;
  totalCount: number;
  systemUnderTest: { id: string; name: string; vendor: string; version: string };
}
