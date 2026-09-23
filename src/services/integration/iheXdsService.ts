/**
 * G005 放射RIS系统 v3.0.5.1 - IHE XDS.b Registry Service
 */

import type { XdsRegistry, XdsDocumentEntry, XdsFolder, XdsSubmissionSet, XdsAssociation, IntegrationExportEnvelope } from '../../types/R3/R3.INTEGRATION';
import { XDS_REGISTRY_MOCK, XDS_REGISTRIES_MOCK, INTEGRATION_ENVELOPES_MOCK } from '../../data/reportIntegrationMock';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. 完整 ebXML 2.1 提交(Submission Request)
// ============================================================
export function buildXdsSubmitTransactionRequest(registry: XdsRegistry): string {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const docEntries = registry.documentEntries.map((d) => `      <ExtrinsicObject id="${d.entryUUID}" objectType="urn:uuid:7edca82f-054d-47f2-a032-9b2a5b5186c1" mimeType="${d.mimetype}" status="${d.status}">
        <Slot name="creationTime">
          <ValueList><Value>${d.creationTime}</Value></ValueList>
        </Slot>
        <Slot name="languageCode">
          <ValueList><Value>${d.languageCode}</Value></ValueList>
        </Slot>
        <Slot name="legalAuthenticator">
          <ValueList><Value>${esc(d.legalAuthenticator)}</Value></ValueList>
        </Slot>
        <Slot name="serviceStartTime">
          <ValueList><Value>${d.serviceStartTime}</Value></ValueList>
        </Slot>
        <Slot name="serviceStopTime">
          <ValueList><Value>${d.serviceStopTime}</Value></ValueList>
        </Slot>
        <Slot name="sourcePatientId">
          <ValueList><Value>${d.sourcePatientId}</Value></ValueList>
        </Slot>
        <Slot name="sourcePatientInfo">
          <ValueList><Value>PID-3|${d.sourcePatientInfo.id}|PID-5|${esc(d.sourcePatientInfo.name)}|PID-7|${d.sourcePatientInfo.birthDate}|PID-8|${d.sourcePatientInfo.gender}</Value></ValueList>
        </Slot>
        <Slot name="repositoryUniqueId">
          <ValueList><Value>${d.repositoryUniqueId}</Value></ValueList>
        </Slot>
        <Slot name="size">
          <ValueList><Value>${d.size}</Value></ValueList>
        </Slot>
        <Slot name="hash">
          <ValueList><Value>${d.hash}</Value></ValueList>
        </Slot>
        <Slot name="availabilityStatus">
          <ValueList><Value>${d.availability}</Value></ValueList>
        </Slot>
        <Classification classificationScheme="urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a" nodeRepresentation="${d.classCode.code}" displayName="${esc(d.classCode.display)}" classifiedObject="${d.entryUUID}"/>
        <Classification classificationScheme="urn:uuid:f4f85eac-e6cb-4883-b524-f27018c4ffa4" nodeRepresentation="${d.typeCode.code}" displayName="${esc(d.typeCode.display)}" classifiedObject="${d.entryUUID}"/>
        <Classification classificationScheme="urn:uuid:a09d5840-386c-46f2-b5ad-9c9639f9d1a5" nodeRepresentation="${d.formatCode.code}" displayName="${esc(d.formatCode.display)}" classifiedObject="${d.entryUUID}"/>
        <Classification classificationScheme="urn:uuid:f33fb8ac-18af-42bd-a25d-fc1a86c1d4ed" nodeRepresentation="${d.healthcareFacilityType.code}" displayName="${esc(d.healthcareFacilityType.display)}" classifiedObject="${d.entryUUID}"/>
        <Classification classificationScheme="urn:uuid:cccf5598-8b07-4b77-a05e-ae952c785ead" nodeRepresentation="${d.practiceSetting.code}" displayName="${esc(d.practiceSetting.display)}" classifiedObject="${d.entryUUID}"/>
        ${d.eventCodeList.map((e) => `<Classification classificationScheme="urn:uuid:2c6b8cb7-8b5a-4241-8d04-7f2c4c5e6f7a" nodeRepresentation="${e.code}" displayName="${esc(e.display)}" classifiedObject="${d.entryUUID}"/>`).join('\n        ')}
        ${d.classifications.map((c) => `<Classification classificationScheme="${c.classificationScheme}" nodeRepresentation="${c.nodeRepresentation}" displayName="${esc(c.name)}" classifiedObject="${d.entryUUID}"/>`).join('\n        ')}
        <ExternalIdentifier identificationScheme="urn:uuid:6b5ae5d2-8b5a-4241-8d04-7f2c4c5e6f7a" value="${d.patientId}" displayName="XDSDocumentEntry.patientId" registryObject="${d.entryUUID}"/>
        <ExternalIdentifier identificationScheme="urn:uuid:58a6e8b0-2b5b-4251-b3f0-2a4c1a4f3b5d" value="${d.uniqueId}" displayName="XDSDocumentEntry.uniqueId" registryObject="${d.entryUUID}"/>
        <Name><LocalizedString value="${esc(d.titleEn)}"/></Name>
        <Description><LocalizedString value="${esc(d.comments)}"/></Description>
      </ExtrinsicObject>`).join('\n');
  const folders = registry.folders.map((f) => `      <RegistryPackage id="${f.entryUUID}" objectType="urn:uuid:d9d542f3-6cc4-48b6-8870-e2b1a98d2c0c" status="${f.status}">
        <Slot name="lastUpdateTime">
          <ValueList><Value>${f.lastUpdateTime}</Value></ValueList>
        </Slot>
        ${f.codeList.map((c) => `<Classification classificationScheme="urn:uuid:1ba97051-7806-41a8-a48b-8fce7af5c1f5" nodeRepresentation="${c.code}" displayName="${esc(c.display)}" classifiedObject="${f.entryUUID}"/>`).join('\n        ')}
        <Name><LocalizedString value="${esc(f.titleEn)}"/></Name>
        <Description><LocalizedString value="${esc(f.comments)}"/></Description>
      </RegistryPackage>`).join('\n');
  const associations = registry.associations.map((a) => `      <Association id="${a.entryUUID}" associationType="${a.associationType}" sourceObject="${a.sourceObject}" targetObject="${a.targetObject}" status="${a.availabilityStatus}">
        <Slot name="SubmissionSetStatus">
          <ValueList><Value>${a.submissionSetStatus}</Value></ValueList>
        </Slot>
      </Association>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <wsa:Action soapenv:mustUnderstand="1" xmlns:wsa="http://www.w3.org/2005/08/addressing">urn:ihe:iti:2007:ProvideAndRegisterDocumentSet-b</wsa:Action>
  </soapenv:Header>
  <soapenv:Body>
    <xds:ProvideAndRegisterDocumentSetRequest xmlns:xds="urn:ihe:iti:xds-b:2007">
      <lcm:SubmitObjectsRequest xmlns:lcm="urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0">
        <rim:RegistryObjectList xmlns:rim="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
          <rim:RegistryPackage id="${registry.submissionSet.entryUUID}" objectType="urn:uuid:a54d6aa5-d40d-43f9-88c5-b4633d5bcdcd" status="approved">
            <rim:Slot name="submissionTime">
              <rim:ValueList><rim:Value>${registry.submissionSet.submissionTime}</rim:Value></rim:ValueList>
            </rim:Slot>
            <rim:Classification classificationScheme="urn:uuid:aa543740-bdda-424e-8c96-df4873be8500" nodeRepresentation="${registry.submissionSet.contentTypeCode.code}" displayName="${esc(registry.submissionSet.contentTypeCode.display)}" classifiedObject="${registry.submissionSet.entryUUID}"/>
            <rim:ExternalIdentifier identificationScheme="urn:uuid:554ac39a-eaba-42fe-a35e-8d7c4d3f2c5d" value="${registry.submissionSet.uniqueId}" displayName="XDSSubmissionSet.uniqueId" registryObject="${registry.submissionSet.entryUUID}"/>
            <rim:ExternalIdentifier identificationScheme="urn:uuid:6b5ae5d2-8b5a-4241-8d04-7f2c4c5e6f7a" value="${registry.submissionSet.patientId}" displayName="XDSSubmissionSet.patientId" registryObject="${registry.submissionSet.entryUUID}"/>
            <rim:ExternalIdentifier identificationScheme="urn:uuid:96fdda7c-d067-4753-83ac-d2b4d3f9b2c7" value="${registry.submissionSet.sourceId}" displayName="XDSSubmissionSet.sourceId" registryObject="${registry.submissionSet.entryUUID}"/>
            <rim:Name><rim:LocalizedString value="${esc(registry.submissionSet.titleEn)}"/></rim:Name>
            <rim:Description><rim:LocalizedString value="${esc(registry.submissionSet.comments)}"/></rim:Description>
          </rim:RegistryPackage>
${docEntries}
${folders}
${associations}
        </rim:RegistryObjectList>
      </lcm:SubmitObjectsRequest>
    </xds:ProvideAndRegisterDocumentSetRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ============================================================
// 2. Stored Query 构造
// ============================================================
export function buildFindDocumentsQuery(patientId: string, status: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<query:AdhocQueryRequest xmlns:query="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0">
  <query:ResponseOption returnComposedObjects="true" returnType="LeafClass"/>
  <query:AdhocQuery id="urn:uuid:14d4debf-8f97-4251-9a74-fb0b3b2c4f7a">
    <query:Slot name="$XDSDocumentEntryPatientId">
      <query:ValueList><query:Value>'${patientId}'</query:Value></query:ValueList>
    </query:Slot>
    <query:Slot name="$XDSDocumentEntryStatus">
      <query:ValueList><query:Value>'${status}'</query:Value></query:ValueList>
    </query:Slot>
  </query:AdhocQuery>
</query:AdhocQueryRequest>`;
}

// ============================================================
// 3. XDS 验证
// ============================================================
export function validateXds(registry: XdsRegistry): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!registry.submissionSet) errors.push('缺少 SubmissionSet');
  if (registry.documentEntries.length === 0) errors.push('DocumentEntry 不能为空');
  if (!registry.repositoryUniqueIds || registry.repositoryUniqueIds.length === 0) errors.push('缺少 RepositoryUniqueId');
  registry.documentEntries.forEach((d, i) => {
    if (!d.entryUUID) errors.push(`第 ${i + 1} 个 DocumentEntry 缺少 entryUUID`);
    if (!d.patientId) errors.push(`第 ${i + 1} 个 DocumentEntry 缺少 patientId`);
    if (!d.uniqueId) errors.push(`第 ${i + 1} 个 DocumentEntry 缺少 uniqueId`);
  });
  if (!registry.homeCommunityId) warnings.push('缺少 homeCommunityId');
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 4. Service 接口
// ============================================================
export async function listXdsRegistries(): Promise<XdsRegistry[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return XDS_REGISTRIES_MOCK;
}

export async function getXdsRegistry(id: string): Promise<XdsRegistry | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return XDS_REGISTRIES_MOCK.find((r) => r.id === id) ?? null;
}

export async function registerToXds(input: {
  reportId: string; patientId: string; patientName: string; modality: string; bodyPart: string;
  sourceId: string; title: string; titleEn: string; comments: string;
  classCode: { code: string; display: string; scheme?: string };
  typeCode: { code: string; display: string; scheme?: string };
  formatCode: { code: string; display: string; scheme?: string };
}): Promise<XdsRegistry> {
  await new Promise((r) => setTimeout(r, 800));
  const id = `xds-${input.reportId}-${Date.now()}`;
  const entryUUID = `urn:uuid:${id}-entry`;
  const docEntry: XdsDocumentEntry = {
    id, entryUUID,
    patientId: input.patientId, uniqueId: `1.2.840.113556.1.8000.2554.${id}`,
    title: input.title, titleEn: input.titleEn,
    comments: input.comments, confidentiality: 'N',
    creationTime: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    languageCode: 'zh-CN',
    legalAuthenticator: '王主任^MD^^^汉东省人民医院',
    serviceStartTime: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    serviceStopTime: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    sourcePatientId: input.patientId,
    sourcePatientInfo: { name: input.patientName, gender: 'M', birthDate: '19680101', id: input.patientId },
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.1.100',
    size: 256000,
    hash: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
    mimetype: 'application/pdf',
    status: 'approved', availability: 'Online',
    classifications: [],
    externalIdentifiers: [
      { identificationScheme: 'urn:uuid:6b5ae5d2-8b5a-4241-8d04-7f2c4c5e6f7a', value: input.patientId, name: '患者 ID', nameEn: 'Patient ID' },
      { identificationScheme: 'urn:uuid:58a6e8b0-2b5b-4251-b3f0-2a4c1a4f3b5d', value: `RP${id}`, name: '报告 ID', nameEn: 'Report ID' },
    ],
    slots: [],
    formatCode: { ...input.formatCode, scheme: input.formatCode.scheme ?? '1.2.840.10008.2.16.4' },
    typeCode: { ...input.typeCode, scheme: input.typeCode.scheme ?? '2.16.840.1.113883.6.1' },
    classCode: { ...input.classCode, scheme: input.classCode.scheme ?? '1.2.840.10008.2.16.4' },
    healthcareFacilityType: { code: 'HOSP', display: '医院', scheme: '2.16.840.1.113883.5.11' },
    practiceSetting: { code: '394802001', display: '放射学', scheme: '2.16.840.1.113883.6.96' },
    eventCodeList: [],
  };
  const folder: XdsFolder = {
    id: `fld-${id}`, entryUUID: `urn:uuid:fld-${id}`,
    patientId: input.patientId, uniqueId: `1.2.840.113556.1.8000.2554.fld-${id}`,
    title: `${input.bodyPart} 影像`, titleEn: `${input.bodyPart} Imaging`,
    comments: '影像资料', codeList: [], lastUpdateTime: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    folderType: 'study', status: 'approved',
  };
  const submissionSet: XdsSubmissionSet = {
    id: `ss-${id}`, entryUUID: `urn:uuid:ss-${id}`,
    patientId: input.patientId, uniqueId: `1.2.840.113556.1.8000.2554.ss-${id}`,
    sourceId: input.sourceId,
    submissionTime: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    title: input.title, titleEn: input.titleEn, comments: input.comments,
    contentTypeCode: { ...input.classCode, scheme: input.classCode.scheme ?? '1.2.840.10008.2.16.4' },
    author: [{ authorPerson: '陈医师^MD', authorInstitution: ['汉东省人民医院'], authorRole: '主治医师', authorSpecialty: '放射学' }],
    intendedRecipient: [], submissionSetType: 'new',
  };
  const associations: XdsAssociation[] = [
    { id: `assoc-1-${id}`, entryUUID: `urn:uuid:assoc-1-${id}`, sourceObject: submissionSet.entryUUID, targetObject: docEntry.entryUUID, associationType: 'HASMEMBER', submissionSetStatus: 'approved', availabilityStatus: 'approved', slots: [] },
  ];
  const registry: XdsRegistry = {
    id, registryId: `REG-${Date.now()}`,
    patientId: input.patientId, sourceId: input.sourceId,
    submissionSet, documentEntries: [docEntry], folders: [folder], associations,
    registryStoredQuery: [], responses: [{ rs: 'Success', status: 200, timestamp: new Date().toISOString() }],
    registeredAt: new Date().toISOString(), registeredBy: 'G005-XDS-Registry-Node-1',
    repositoryUniqueIds: ['1.2.840.113556.1.8000.2554.1.100'],
    homeCommunityId: 'urn:oid:1.2.840.113556.1.8000.2554.1',
    size: 0, validation: { passed: true, errors: [], warnings: [] },
  };
  registry.size = new Blob([buildXdsSubmitTransactionRequest(registry)]).size;
  registry.validation = validateXds(registry);
  return registry;
}

export async function queryXdsRegistry(patientId: string): Promise<XdsDocumentEntry[]> {
  await new Promise((r) => setTimeout(r, 300));
  return XDS_REGISTRIES_MOCK.flatMap((r) => r.documentEntries.filter((d) => d.patientId === patientId));
}

export async function listIntegrationEnvelopes(): Promise<IntegrationExportEnvelope[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return INTEGRATION_ENVELOPES_MOCK;
}

export const XDS_REGISTRY_MOCK_REF = XDS_REGISTRY_MOCK;
