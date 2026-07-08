/**
 * G005 放射RIS系统 v3.0.5.1 - HL7 CDA R2 集成 Service
 */

import type { CdaDocument, CdaSection, CdaSectionCode } from '../../types/R3/R3.INTEGRATION';
import { CDA_DOCUMENTS_MOCK, CDA_DEMO } from '../../data/reportIntegrationMock';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. 完整 XML 构造器(HL7 CDA R2 标准)
// ============================================================
export function buildCdaXml(cda: Omit<CdaDocument, 'xml' | 'size'>): string {
  const escape = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:voc="urn:hl7-org:v3/voc" xmlns:sdtc="urn:hl7-org:sdtc">
  <realmCode code="CN"/>
  <typeId root="${cda.typeId.root}" extension="${cda.typeId.extension}"/>
  ${cda.templateId.map((t) => `<templateId root="${t.root}" extension="${t.extension}"/>`).join('\n  ')}
  <id root="${cda.id}" extension="${cda.id}"/>
  <code code="51848-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Radiology Report"/>
  <title>${escape(cda.title)}</title>
  <effectiveTime value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
  <confidentialityCode code="${cda.confidentialityCode}" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="${cda.languageCode}"/>
  <setId root="${cda.setId}"/>
  <versionNumber value="${cda.version}"/>
  <recordTarget typeCode="RCT" contextControlCode="OP">
    <patientRole classCode="PAT">
      <id root="${cda.recordTarget.idRoot}" extension="${cda.recordTarget.idExtension}"/>
      <addr use="HP">
        <streetAddressLine>${escape(cda.recordTarget.addr ?? '')}</streetAddressLine>
      </addr>
      <telecom value="${escape(cda.recordTarget.telecom ?? '')}" use="HP"/>
      <patient classCode="PSN" determinerCode="INSTANCE">
        <name use="L">
          <given>${escape(cda.recordTarget.nameEn.split(' ')[0] ?? cda.recordTarget.nameEn)}</given>
          <family>${escape(cda.recordTarget.nameEn.split(' ').slice(1).join(' ') || 'Patient')}</family>
        </name>
        <administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="19680101"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author typeCode="AUT" contextControlCode="OP">
    <time value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
    <assignedAuthor classCode="ASSIGNED">
      <id root="${cda.author.idRoot}" extension="${cda.author.idExtension}"/>
      <addr><streetAddressLine>汉东省京州市</streetAddressLine></addr>
      <telecom value="${escape(cda.author.telecom ?? '')}" use="WP"/>
      <assignedPerson classCode="PSN" determinerCode="INSTANCE">
        <name><given>${escape(cda.author.name)}</given></name>
      </assignedPerson>
      <representedOrganization classCode="ORG" determinerCode="INSTANCE">
        <id root="${cda.author.representedOrganization?.idRoot ?? '2.16.840.1.113883.19.5.99999'}"/>
        <name>${escape(cda.author.representedOrganization?.name ?? '汉东省人民医院')}</name>
      </representedOrganization>
    </assignedAuthor>
  </author>
  <custodian typeCode="CST">
    <assignedCustodian classCode="ASSIGNED">
      <representedCustodianOrganization classCode="ORG" determinerCode="INSTANCE">
        <id root="${cda.custodian.idRoot}" extension="${cda.custodian.idExtension}"/>
        <name>${escape(cda.custodian.name)}</name>
        <telecom value="021-12345678" use="WP"/>
        <addr use="WP">
          <streetAddressLine>汉东省京州市</streetAddressLine>
          <city>京州市</city>
          <state>汉东省</state>
          <postalCode>200000</postalCode>
          <country>CN</country>
        </addr>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <legalAuthenticator typeCode="LA" contextControlCode="OP">
    <time value="${cda.effectiveTime.replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
    <signatureCode code="S"/>
    <assignedEntity classCode="ASSIGNED">
      <id root="${cda.legalAuthenticator.idRoot}" extension="${cda.legalAuthenticator.idExtension}"/>
      <assignedPerson classCode="PSN" determinerCode="INSTANCE">
        <name><given>${escape(cda.legalAuthenticator.name)}</given></name>
      </assignedPerson>
    </assignedEntity>
  </legalAuthenticator>
  <relatedDocument typeCode="RPLC">
    <parentDocument>
      <id root="${cda.setId}" extension="1"/>
      <setId root="${cda.setId}"/>
      <versionNumber value="${cda.version}"/>
    </parentDocument>
  </relatedDocument>
  <componentOf typeCode="COMP">
    <encompassingEncounter classCode="ENC" moodCode="EVN">
      <id root="2.16.840.1.113883.19.5.99999" extension="enc-038"/>
      <code code="AMB" codeSystem="2.16.840.1.113883.5.4"/>
      <effectiveTime>
        <low value="20260915100000"/>
        <high value="20260915110000"/>
      </effectiveTime>
    </encompassingEncounter>
  </componentOf>
  <component>
    <structuredBody classCode="DOCBODY" moodCode="EVN">
      ${cda.sections.map((s) => `      <component>
        <section>
          <code code="${s.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${escape(s.titleEn)}"/>
          <title>${escape(s.title)}</title>
          <text mediaType="text/x-hl7-text/xml">
            <paragraph>${escape(s.text)}</paragraph>
          </text>
          ${s.entries.map((e) => `          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <code code="${e.code.code}" codeSystem="${e.code.codeSystem}" codeSystemName="${e.code.codeSystemName}" displayName="${escape(e.code.displayName)}"/>
              ${e.value !== undefined ? `<value xsi:type="${typeof e.value === 'number' ? 'PQ' : 'ST'}">${escape(String(e.value))}${e.unit ? ` ${e.unit}` : ''}</value>` : ''}
              <text>${escape(e.text)}</text>
              <effectiveTime value="${(e.effectiveTime ?? cda.effectiveTime).replace(/[-:TZ.]/g, '').slice(0, 14)}"/>
              ${e.performerName ? `<performer><assignedEntity><assignedPerson><name>${escape(e.performerName)}</name></assignedPerson></assignedEntity></performer>` : ''}
            </observation>
          </entry>`).join('\n')}
        </section>
      </component>`).join('\n')}
    </structuredBody>
  </component>
</ClinicalDocument>`;
  return xml;
}

// ============================================================
// 2. CDA 解析器
// ============================================================
export function parseCda(xml: string): { id: string; title: string; sections: { code: string; title: string; text: string }[] } {
  const idMatch = xml.match(/<id root="([^"]+)" extension="([^"]+)"/);
  const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
  const sections: { code: string; title: string; text: string }[] = [];
  const sectionRegex = /<section>([\s\S]*?)<\/section>/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(xml)) !== null) {
    const block = m[1]!;
    const codeMatch = block.match(/<code code="([^"]+)"/);
    const titleSec = block.match(/<title>([^<]+)<\/title>/);
    const textSec = block.match(/<text[^>]*>([\s\S]*?)<\/text>/);
    sections.push({
      code: codeMatch?.[1] ?? '',
      title: titleSec?.[1] ?? '',
      text: (textSec?.[1] ?? '').replace(/<[^>]+>/g, '').trim(),
    });
  }
  return {
    id: idMatch ? `${idMatch[1]}^^${idMatch[2]}` : '',
    title: titleMatch?.[1] ?? '',
    sections,
  };
}

// ============================================================
// 3. CDA 验证
// ============================================================
export function validateCda(xml: string): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!xml.includes('<ClinicalDocument')) errors.push('缺少根元素 ClinicalDocument');
  if (!xml.includes('<recordTarget>')) errors.push('缺少 recordTarget');
  if (!xml.includes('<author>')) errors.push('缺少 author');
  if (!xml.includes('<custodian>')) errors.push('缺少 custodian');
  if (!xml.includes('<legalAuthenticator>')) errors.push('缺少 legalAuthenticator');
  if (!xml.includes('<component>')) errors.push('缺少 component');
  if (xml.length < 1000) warnings.push('CDA 文档长度过短,可能缺失内容');
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 4. CDA 服务
// ============================================================
export async function listCdaDocuments(): Promise<CdaDocument[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return CDA_DOCUMENTS_MOCK;
}

export async function getCdaDocument(id: string): Promise<CdaDocument | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return CDA_DOCUMENTS_MOCK.find((c) => c.id === id) ?? null;
}

export async function generateCda(input: { reportId: string; patientName: string; patientId: string; sections: CdaSection[]; title: string; titleEn: string; effectiveTime: string }): Promise<CdaDocument> {
  await new Promise((r) => setTimeout(r, 300));
  const id = `cda-${input.reportId}-${Date.now()}`;
  const partial: Omit<CdaDocument, 'xml' | 'size'> = {
    id,
    setId: `cda-set-${input.reportId}`,
    version: 1,
    typeId: { root: '2.16.840.1.113883.1.3', extension: 'POCD_HD000040' },
    templateId: [
      { root: '2.16.840.1.113883.10.20.22.1.1', extension: '2015-08-01' },
    ],
    title: input.title, titleEn: input.titleEn,
    effectiveTime: input.effectiveTime,
    confidentialityCode: 'N', languageCode: 'zh-CN',
    recordTarget: { id: 'pat', type: 'patient', name: input.patientName, nameEn: input.patientName, idRoot: '2.16.840.1.113883.19.5.99999', idExtension: input.patientId },
    author: { id: 'u-001', type: 'doctor', name: '陈医师', nameEn: 'Chen', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'u-001' },
    custodian: { id: 'org', type: 'organization', name: '汉东省人民医院', nameEn: 'Handong', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'org-001' },
    legalAuthenticator: { id: 'u-002', type: 'doctor', name: '王主任', nameEn: 'Wang', idRoot: '2.16.840.1.113883.19.5.99999', idExtension: 'u-002' },
    participants: [], relatedDocuments: [], sections: input.sections,
    generatedAt: new Date().toISOString(), generator: 'G005-CDA-Builder',
    validation: { passed: true, errors: [], warnings: [] },
  };
  const xml = buildCdaXml(partial);
  const validation = validateCda(xml);
  return { ...partial, xml, size: new Blob([xml]).size, validation };
}

export async function downloadCda(id: string): Promise<{ filename: string; content: string; mime: string } | null> {
  await new Promise((r) => setTimeout(r, 200));
  const doc = CDA_DOCUMENTS_MOCK.find((c) => c.id === id);
  if (!doc) return null;
  return { filename: `${id}.xml`, content: doc.xml, mime: 'application/cda+xml' };
}

export const CDA_SECTION_CODES: { code: CdaSectionCode; title: string; titleEn: string }[] = [
  { code: '10164-2', title: '病史', titleEn: 'History of Illness' },
  { code: '29545-1', title: '体检报告', titleEn: 'Physical Examination' },
  { code: '18776-5', title: '计划', titleEn: 'Plan of Care' },
  { code: '10160-0', title: '用药史', titleEn: 'Medication History' },
  { code: '11369-6', title: '当前用药', titleEn: 'Current Medications' },
  { code: '51852-2', title: '评估与计划', titleEn: 'Assessment and Plan' },
  { code: '29762-2', title: '社会史', titleEn: 'Social History' },
  { code: '42349-1', title: '用药方案', titleEn: 'Medication Plan' },
  { code: '8716-3', title: '生命体征', titleEn: 'Vital Signs' },
];

export const CDA_DEMO_REF = CDA_DEMO;
