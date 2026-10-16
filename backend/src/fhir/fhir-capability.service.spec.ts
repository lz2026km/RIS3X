import { FhirCapabilityService } from './fhir-capability.service';

/**
 * [G005 v3.0.6.16-0] CapabilityStatement 生成测试
 *
 * 核心目的: **防止再次对客户超报能力**。
 * 旧实现里前端硬编码了一份 CapabilityStatement, 宣称 SMART on FHIR / create /
 * update 支持 Practitioner 等, 而后端当时根本没有 /fhir/r4/metadata 端点,
 * 且 tokenEndpoint 指向一个并不存在的 /oauth2/token。
 * 这里锁死"声明必须与实际注册路由一致"。
 */
describe('FhirCapabilityService', () => {
  const svc = new FhirCapabilityService();
  const cs = svc.capabilityStatement('https://ris.example.com') as any;

  it('返回合法的 CapabilityStatement 文档', () => {
    expect(cs.resourceType).toBe('CapabilityStatement');
    expect(cs.status).toBe('active');
    expect(cs.fhirVersion).toBe('4.0.1');
    expect(Array.isArray(cs.format)).toBe(true);
    expect(cs.rest?.[0]?.mode).toBe('server');
  });

  it('implementation.url 反映真实 baseUrl', () => {
    expect(cs.implementation.url).toBe('https://ris.example.com/fhir/r4');
  });

  it('据实声明 SMART on FHIR, 且给出**真实存在**的授权端点', () => {
    const security = cs.rest[0].security;
    const codes = security.service.map((s: any) => s.coding[0].code);
    expect(codes).toContain('SMART on FHIR');
    // 真实端点是 auth/token (smart-auth.controller.ts), 不是 /oauth2/token
    expect(security.description).toContain('/fhir/r4/auth/token');
    expect(security.description).not.toContain('/oauth2/token');
  });

  it('不宣称未实现的 Practitioner 资源', () => {
    const types = cs.rest[0].resource.map((r: any) => r.type);
    expect(types).not.toContain('Practitioner');
    expect(types).toEqual(expect.arrayContaining(['Patient', 'Observation', 'DiagnosticReport', 'ImagingStudy']));
  });

  it('Patient 声明了 create/update/delete (后端确有这些路由)', () => {
    const patient = cs.rest[0].resource.find((r: any) => r.type === 'Patient');
    const codes = patient.interaction.map((i: any) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['read', 'search-type', 'vread', 'create', 'update', 'delete']));
  });

  it('Observation 不宣称 create/update/delete (后端无这些路由)', () => {
    const obs = cs.rest[0].resource.find((r: any) => r.type === 'Observation');
    const codes = obs.interaction.map((i: any) => i.code);
    expect(codes).toContain('read');
    expect(codes).not.toContain('create');
    expect(codes).not.toContain('update');
    expect(codes).not.toContain('delete');
  });

  it('未支持的交互以 capability-statement-not-supported 扩展暴露', () => {
    const obs = cs.rest[0].resource.find((r: any) => r.type === 'Observation');
    expect(obs.extension?.[0]?.url).toBe(
      'http://hl7.org/fhir/StructureDefinition/capability-statement-not-supported',
    );
    expect(obs.extension[0].valueString).toContain('create');
  });

  it('声明 $export 操作', () => {
    const ops = cs.rest[0].operation.map((o: any) => o.name);
    expect(ops).toContain('export');
    expect(ops).toContain('export-status');
  });

  it('gaps() 如实列出已知能力缺口', () => {
    const gaps = svc.gaps();
    expect(gaps.length).toBeGreaterThan(0);
    const codes = gaps.map((g) => g.code);
    expect(codes).toContain('transaction');
    expect(codes).toContain('batch');
    expect(codes).toContain('patch');
    expect(codes).toContain('Practitioner 资源');
    for (const g of gaps) {
      expect(typeof g.reason).toBe('string');
      expect(g.reason.length).toBeGreaterThan(0);
    }
  });

  it('supportedResourceTypes 与 gaps 中的 Practitioner 声明相互一致', () => {
    expect(svc.supportedResourceTypes()).not.toContain('Practitioner');
    expect(svc.gaps().some((g) => g.code.includes('Practitioner'))).toBe(true);
  });
});
