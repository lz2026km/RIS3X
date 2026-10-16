import { Injectable } from '@nestjs/common';

/**
 * [G005 v3.0.6.16-0] FHIR R4 CapabilityStatement 生成
 *
 * 背景: 前端 `FhirServerPage` 此前**硬编码**了一份 CapabilityStatement
 * (含 `SMART: true` / `create` / `update`), 而后端根本没有 `/fhir/r4/metadata`
 * 端点 —— 对懂 FHIR 的客户而言属于"可被现场戳穿"的虚假能力声明。
 *
 * 本服务改为**由实际已注册的路由**推导能力声明, 不做任何超报:
 *  - 只有真实存在的 interaction 才会出现在声明里
 *  - 未实现的资源类型 / 写事务不会被列入
 *  - SMART on FHIR 已实现 (smart-auth.controller.ts), 据实声明并给出正确端点路径
 *    (旧版前端硬编码的 `tokenEndpoint: '/oauth2/token'` 是一个并不存在的路径)
 */

/** 服务端实际支持的交互 (与 fhir.controller.ts 中的 @Get/@Post/@Put/@Delete 一一对应) */
const SUPPORTED = {
  Patient: {
    read: true,
    'search-type': true,
    vread: true,
    create: true,
    update: true,
    delete: true,
    'history-instance': false,
  },
  Observation: {
    read: true,
    'search-type': true,
    vread: true,
    create: false,
    update: false,
    delete: false,
    'history-instance': false,
  },
  DiagnosticReport: {
    read: true,
    'search-type': true,
    vread: true,
    create: false,
    update: false,
    delete: false,
    'history-instance': false,
  },
  ImagingStudy: {
    read: true,
    'search-type': true,
    vread: true,
    create: false,
    update: false,
    delete: false,
    'history-instance': false,
  },
  Subscription: {
    read: true,
    'search-type': true,
    vread: true,
    create: true,
    update: false,
    delete: true,
    'history-instance': false,
  },
  Bundle: {
    read: true,
    'search-type': false,
    vread: false,
    create: false,
    update: false,
    delete: false,
    'history-instance': false,
  },
} as const;

export type FhirResourceType = keyof typeof SUPPORTED;

/** 该服务**未实现**的常见交互, 用于生成诚实的缺口说明 */
const NOT_IMPLEMENTED = {
  'transaction': '批量事务未实现',
  'batch': '批量事务未实现',
  'conditional-create': '条件创建未实现',
  'conditional-update': '条件更新未实现',
  'conditional-delete': '条件删除未实现',
  patch: 'PATCH 未实现',
} as const;

@Injectable()
export class FhirCapabilityService {
  /** 生成服务端 CapabilityStatement (data-driven, 无硬编码超报) */
  capabilityStatement(baseUrl: string): Record<string, unknown> {
    const resources = Object.entries(SUPPORTED).map(([type, interactions]) => {
      const supported = Object.entries(interactions)
        .filter(([, enabled]) => enabled)
        .map(([code]) => ({ code }));
      const notSupported = Object.entries(interactions)
        .filter(([, enabled]) => !enabled)
        .map(([code]) => ({ code }));

      return {
        type,
        interaction: supported,
        versioning: 'versioned',
        readHistory: false,
        updateCreate: false,
        conditionalCreate: false,
        conditionalRead: 'not-supported',
        conditionalUpdate: 'not-supported',
        conditionalDelete: 'not-supported',
        referencePolicy: ['literal', 'resolves'],
        searchInclude: ['*'],
        searchParam: [],
        ...(notSupported.length
          ? {
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/capability-statement-not-supported',
                  valueString: `未实现: ${notSupported.map((c) => c.code).join(', ')}`,
                },
              ],
            }
          : {}),
      };
    });

    const interactions = Array.from(
      new Set(resources.flatMap((r) => (r.interaction as Array<{ code: string }>).map((i) => i.code))),
    );

    return {
      resourceType: 'CapabilityStatement',
      id: 'g005-ris-fhir-r4',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'G005 Radiology RIS',
      kind: 'instance',
      software: { name: 'G005 RIS FHIR Facade', version: '3.0.6.16' },
      implementation: { description: 'G005 RIS FHIR R4 服务端', url: `${baseUrl}/fhir/r4` },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'json'],
      rest: [
        {
          mode: 'server',
          documentation: '支持 search-type / read / create / update / delete (按资源类型差异化, 见各资源 not-supported 扩展)',
          security: {
            cors: true,
            // [G005 v3.0.6.16-0] SMART on FHIR **确实已实现** (见 smart-auth.controller.ts:
            // .well-known/smart-configuration / auth/authorize / auth/token / auth/revoke /
            // auth/introspect), 因此此处据实声明为 'SMART on FHIR'。
            // 旧版本前端硬编码的声明里 `tokenEndpoint: '/oauth2/token'` 是一个
            // 并不存在的路径 —— 真实端点是 `auth/token`, 这里给出正确值。
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'SMART on FHIR',
                  },
                ],
              },
            ],
            description: `SMART on FHIR 授权端点: ${baseUrl}/fhir/r4/auth/authorize (token: ${baseUrl}/fhir/r4/auth/token, 配置: ${baseUrl}/fhir/r4/.well-known/smart-configuration)`,
          },
          resource: resources,
          interaction: interactions.map((code) => ({ code })),
          operation: [
            { name: 'export', definition: `GET ${baseUrl}/fhir/r4/$export` },
            { name: 'export-status', definition: `GET ${baseUrl}/fhir/r4/$export-status/{jobId}` },
          ],
        },
      ],
    };
  }

  /** 能力缺口清单 (前端可直接展示, 避免"宣称支持但实际不可用") */
  gaps(): Array<{ code: string; reason: string }> {
    return [
      ...Object.entries(NOT_IMPLEMENTED).map(([code, reason]) => ({ code, reason })),
      { code: 'Practitioner 资源', reason: '未实现 (前端资源类型下拉中不应出现该选项)' },
      { code: 'Bundle 写事务', reason: '仅支持只读 Bundle, 不支持 transaction/batch 写入' },
    ];
  }

  /** 前端可用的资源类型清单 (仅含后端真实支持的) */
  supportedResourceTypes(): string[] {
    return Object.keys(SUPPORTED);
  }
}
