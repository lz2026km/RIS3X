// Generate 14 NestJS modules for v3.0.6.11-7
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(__dirname, '..', 'backend', 'src');

const MODULES = [
  {
    name: 'dental',
    endpoints: [
      { method: 'GET', path: 'studies', handler: 'listStudies' },
      { method: 'GET', path: 'studies/:id', handler: 'getStudy' },
      { method: 'POST', path: 'studies', handler: 'createStudy' },
      { method: 'PUT', path: 'studies/:id', handler: 'updateStudy' },
      { method: 'DELETE', path: 'studies/:id', handler: 'deleteStudy' },
      { method: 'GET', path: 'ai-findings', handler: 'listAiFindings' },
      { method: 'POST', path: 'ai-findings', handler: 'createAiFinding' },
      { method: 'GET', path: 'implants', handler: 'listImplants' },
      { method: 'POST', path: 'implants', handler: 'createImplant' },
      { method: 'PUT', path: 'implants/:id', handler: 'updateImplant' },
      { method: 'GET', path: 'appointments', handler: 'listAppointments' },
      { method: 'POST', path: 'appointments', handler: 'createAppointment' },
      { method: 'PUT', path: 'appointments/:id', handler: 'updateAppointment' },
      { method: 'GET', path: 'invoices', handler: 'listInvoices' },
      { method: 'POST', path: 'invoices', handler: 'createInvoice' },
      { method: 'GET', path: 'inventory', handler: 'listInventory' },
      { method: 'POST', path: 'inventory', handler: 'addInventoryItem' },
      { method: 'PUT', path: 'inventory/:id', handler: 'updateInventoryItem' },
    ],
  },
  {
    name: 'workflow',
    endpoints: [
      { method: 'GET', path: 'definitions', handler: 'listDefinitions' },
      { method: 'POST', path: 'definitions', handler: 'createDefinition' },
      { method: 'GET', path: 'definitions/:id', handler: 'getDefinition' },
      { method: 'PUT', path: 'definitions/:id', handler: 'updateDefinition' },
      { method: 'DELETE', path: 'definitions/:id', handler: 'deleteDefinition' },
      { method: 'POST', path: 'definitions/:id/activate', handler: 'activateDefinition' },
      { method: 'GET', path: 'definitions/:id/steps', handler: 'listSteps' },
      { method: 'POST', path: 'definitions/:id/steps', handler: 'addStep' },
      { method: 'GET', path: 'sla-policies', handler: 'listSlaPolicies' },
      { method: 'POST', path: 'sla-policies', handler: 'createSlaPolicy' },
      { method: 'PUT', path: 'sla-policies/:id', handler: 'updateSlaPolicy' },
      { method: 'GET', path: 'routing-rules', handler: 'listRoutingRules' },
      { method: 'POST', path: 'routing-rules', handler: 'createRoutingRule' },
      { method: 'PUT', path: 'routing-rules/:id', handler: 'updateRoutingRule' },
      { method: 'DELETE', path: 'routing-rules/:id', handler: 'deleteRoutingRule' },
    ],
  },
  {
    name: 'finance',
    endpoints: [
      { method: 'GET', path: 'charge-items', handler: 'listChargeItems' },
      { method: 'POST', path: 'charge-items', handler: 'createChargeItem' },
      { method: 'PUT', path: 'charge-items/:id', handler: 'updateChargeItem' },
      { method: 'GET', path: 'invoices', handler: 'listInvoices' },
      { method: 'POST', path: 'invoices', handler: 'createInvoice' },
      { method: 'GET', path: 'invoices/:id', handler: 'getInvoice' },
      { method: 'POST', path: 'invoices/:id/pay', handler: 'payInvoice' },
      { method: 'GET', path: 'revenue-analysis', handler: 'getRevenueAnalysis' },
      { method: 'GET', path: 'cost-accounting', handler: 'getCostAccounting' },
      { method: 'GET', path: 'financial-reports', handler: 'getFinancialReports' },
    ],
  },
  {
    name: 'data-report',
    endpoints: [
      { method: 'GET', path: 'national-reports', handler: 'listNationalReports' },
      { method: 'GET', path: 'national-reports/:id', handler: 'getNationalReport' },
      { method: 'POST', path: 'national-reports', handler: 'createNationalReport' },
      { method: 'GET', path: 'data-reports', handler: 'listDataReports' },
      { method: 'GET', path: 'data-reports/:id', handler: 'getDataReport' },
      { method: 'POST', path: 'data-reports', handler: 'createDataReport' },
      { method: 'GET', path: 'insurance-audits', handler: 'listInsuranceAudits' },
      { method: 'GET', path: 'insurance-audits/:id', handler: 'getInsuranceAudit' },
      { method: 'GET', path: 'enterprise-search', handler: 'enterpriseSearch' },
    ],
  },
  {
    name: 'regional',
    endpoints: [
      { method: 'GET', path: 'imaging', handler: 'listRegionalImaging' },
      { method: 'GET', path: 'imaging/:id', handler: 'getRegionalImaging' },
      { method: 'GET', path: 'reports', handler: 'listRegionalReports' },
      { method: 'GET', path: 'reports/:id', handler: 'getRegionalReport' },
      { method: 'GET', path: 'schedule', handler: 'getDepartmentSchedule' },
      { method: 'PUT', path: 'schedule/:id', handler: 'updateSchedule' },
      { method: 'GET', path: 'departments', handler: 'listDepartments' },
      { method: 'GET', path: 'medical-alliance', handler: 'listMedicalAlliance' },
      { method: 'GET', path: 'integration/fhir', handler: 'getFhirStatus' },
      { method: 'GET', path: 'integration/ihe', handler: 'getIheStatus' },
      { method: 'GET', path: 'integration/mllp', handler: 'getMllpStatus' },
    ],
  },
  {
    name: 'patient-portal',
    endpoints: [
      { method: 'GET', path: 'patients', handler: 'listPortalPatients' },
      { method: 'GET', path: 'patients/:id', handler: 'getPortalPatient' },
      { method: 'GET', path: 'clinical-data', handler: 'listClinicalData' },
      { method: 'GET', path: 'clinical-data/:id', handler: 'getClinicalData' },
      { method: 'GET', path: 'education', handler: 'listEducation' },
      { method: 'GET', path: 'education/:id', handler: 'getEducation' },
      { method: 'GET', path: 'mobile/patients', handler: 'getPatientMobile' },
      { method: 'GET', path: 'mobile/doctors', handler: 'getDoctorMobile' },
      { method: 'GET', path: 'mobile/nurses', handler: 'getNurseMobile' },
      { method: 'GET', path: 'mobile/techs', handler: 'getTechMobile' },
    ],
  },
  {
    name: 'cosign',
    endpoints: [
      { method: 'GET', path: 'pending', handler: 'listPendingCosigns' },
      { method: 'GET', path: 'pending/:id', handler: 'getPendingCosign' },
      { method: 'POST', path: 'pending/:id/approve', handler: 'approveCosign' },
      { method: 'POST', path: 'pending/:id/reject', handler: 'rejectCosign' },
      { method: 'GET', path: 'history', handler: 'listCosignHistory' },
      { method: 'GET', path: 'rules', handler: 'listCosignRules' },
      { method: 'POST', path: 'rules', handler: 'createCosignRule' },
      { method: 'GET', path: 'stats', handler: 'getCosignStats' },
    ],
  },
  {
    name: 'cds',
    endpoints: [
      { method: 'GET', path: 'guidelines', handler: 'listGuidelines' },
      { method: 'GET', path: 'guidelines/:id', handler: 'getGuideline' },
      { method: 'POST', path: 'guidelines', handler: 'createGuideline' },
      { method: 'GET', path: 'alerts', handler: 'listAlerts' },
      { method: 'POST', path: 'alerts/:id/acknowledge', handler: 'acknowledgeAlert' },
      { method: 'GET', path: 'dose-monitoring', handler: 'getDoseMonitoring' },
      { method: 'GET', path: 'statistics', handler: 'getCdsStatistics' },
      { method: 'GET', path: 'rules', handler: 'listCdsRules' },
      { method: 'POST', path: 'rules', handler: 'createCdsRule' },
      { method: 'GET', path: 'management', handler: 'getCdsManagement' },
    ],
  },
  {
    name: 'critical-ext',
    endpoints: [
      { method: 'GET', path: 'rules', handler: 'listCriticalRules' },
      { method: 'POST', path: 'rules', handler: 'createCriticalRule' },
      { method: 'PUT', path: 'rules/:id', handler: 'updateCriticalRule' },
      { method: 'DELETE', path: 'rules/:id', handler: 'deleteCriticalRule' },
      { method: 'GET', path: 'stats', handler: 'getCriticalStats' },
      { method: 'GET', path: 'stats/summary', handler: 'getCriticalSummary' },
      { method: 'GET', path: 'stats/timeline', handler: 'getCriticalTimeline' },
      { method: 'GET', path: 'center', handler: 'listCriticalCenter' },
      { method: 'GET', path: 'center/:id', handler: 'getCriticalCenterItem' },
      { method: 'POST', path: 'auto-detect', handler: 'autoDetectCritical' },
      { method: 'POST', path: 'close-loop', handler: 'closeCriticalLoop' },
      { method: 'GET', path: 'receiver', handler: 'getReceiverPortal' },
    ],
  },
  {
    name: 'qc-ext',
    endpoints: [
      { method: 'GET', path: 'dashboard', handler: 'getQcDashboard' },
      { method: 'GET', path: 'dashboard/:id', handler: 'getQcDashboardItem' },
      { method: 'GET', path: 'image', handler: 'listQcImages' },
      { method: 'GET', path: 'image/:id', handler: 'getQcImage' },
      { method: 'POST', path: 'image/:id/rate', handler: 'rateQcImage' },
      { method: 'GET', path: 'radiologist-annual', handler: 'listRadiologistAnnual' },
      { method: 'GET', path: 'radiologist-annual/:id', handler: 'getRadiologistAnnual' },
      { method: 'GET', path: 'defect', handler: 'listQcDefects' },
      { method: 'POST', path: 'defect', handler: 'reportQcDefect' },
      { method: 'GET', path: 'stats', handler: 'getQcStats' },
      { method: 'GET', path: 'scores', handler: 'listQcScores' },
    ],
  },
  {
    name: 'report-quality',
    endpoints: [
      { method: 'GET', path: 'score-rules', handler: 'listScoreRules' },
      { method: 'POST', path: 'score-rules', handler: 'createScoreRule' },
      { method: 'PUT', path: 'score-rules/:id', handler: 'updateScoreRule' },
      { method: 'GET', path: 'defect-library', handler: 'listDefectLibrary' },
      { method: 'POST', path: 'defect-library', handler: 'createDefectEntry' },
      { method: 'PUT', path: 'defect-library/:id', handler: 'updateDefectEntry' },
      { method: 'GET', path: 'ai-report-drafts', handler: 'listAiReportDrafts' },
      { method: 'POST', path: 'ai-report-drafts', handler: 'createAiReportDraft' },
      { method: 'GET', path: 'stats', handler: 'getReportQualityStats' },
    ],
  },
  {
    name: 'ca',
    endpoints: [
      { method: 'GET', path: 'certificates', handler: 'listCertificates' },
      { method: 'POST', path: 'certificates', handler: 'uploadCertificate' },
      { method: 'DELETE', path: 'certificates/:id', handler: 'revokeCertificate' },
      { method: 'POST', path: 'sign', handler: 'signDocument' },
      { method: 'GET', path: 'signatures', handler: 'listSignatures' },
      { method: 'POST', path: 'verify', handler: 'verifySignature' },
      { method: 'GET', path: 'config', handler: 'getCaConfig' },
      { method: 'PUT', path: 'config', handler: 'updateCaConfig' },
      { method: 'GET', path: 'history', handler: 'getCaHistory' },
    ],
  },
  {
    name: 'device-mgmt',
    endpoints: [
      { method: 'GET', path: 'equipment-lifecycle', handler: 'listEquipmentLifecycle' },
      { method: 'GET', path: 'equipment-lifecycle/:id', handler: 'getEquipmentLifecycle' },
      { method: 'PUT', path: 'equipment-lifecycle/:id', handler: 'updateEquipmentLifecycle' },
      { method: 'GET', path: 'devices', handler: 'listDevices' },
      { method: 'GET', path: 'devices/:id', handler: 'getDevice' },
      { method: 'PUT', path: 'devices/:id', handler: 'updateDevice' },
      { method: 'GET', path: 'faults', handler: 'listDeviceFaults' },
      { method: 'POST', path: 'faults', handler: 'reportDeviceFault' },
      { method: 'GET', path: 'materials', handler: 'listMaterials' },
      { method: 'POST', path: 'materials', handler: 'addMaterial' },
      { method: 'GET', path: 'dose-tracking', handler: 'getDoseTracking' },
      { method: 'POST', path: 'dose-tracking', handler: 'recordDose' },
      { method: 'GET', path: 'contrast/adverse-reactions', handler: 'listAdverseReactions' },
      { method: 'POST', path: 'contrast/adverse-reactions', handler: 'reportAdverseReaction' },
      { method: 'GET', path: 'contrast/injection', handler: 'getInjectionWorkstation' },
      { method: 'GET', path: 'contrast/inventory', handler: 'getContrastInventory' },
      { method: 'PUT', path: 'contrast/inventory/:id', handler: 'updateContrastInventory' },
      { method: 'GET', path: 'contrast/quality', handler: 'getContrastQuality' },
    ],
  },
  {
    name: 'ai-platform',
    endpoints: [
      { method: 'GET', path: 'models', handler: 'listAiModels' },
      { method: 'GET', path: 'models/:id', handler: 'getAiModel' },
      { method: 'POST', path: 'models/:id/deploy', handler: 'deployAiModel' },
      { method: 'GET', path: 'qc', handler: 'listAiQcResults' },
      { method: 'GET', path: 'qc/:id', handler: 'getAiQcResult' },
      { method: 'GET', path: 'structured-reports', handler: 'listAiStructuredReports' },
      { method: 'POST', path: 'structured-reports', handler: 'generateStructuredReport' },
      { method: 'GET', path: 'medical-devices', handler: 'listAiMedicalDevices' },
      { method: 'GET', path: 'orchestration', handler: 'getAiOrchestration' },
      { method: 'POST', path: 'orchestration', handler: 'createAiOrchestration' },
      { method: 'GET', path: 'fusion', handler: 'getAiFusionWorkspace' },
      { method: 'GET', path: 'assist', handler: 'getAiAssist' },
      { method: 'GET', path: 'marketplace', handler: 'getAiMarketplace' },
    ],
  },
];

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function kebabToPascal(kebab) {
  return kebab.split('/').map(s => s.split('-').map(capitalize).join('')).join('');
}

// Generate each module
for (const mod of MODULES) {
  const dir = path.join(BACKEND, mod.name.replace(/-/g, ''));
  const name = mod.name;
  const Name = capitalize(name);
  const prefix = `api/${name}`;

  fs.mkdirSync(dir, { recursive: true });

  // --- module.ts ---
  const moduleContent = `import { Module } from '@nestjs/common';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';

@Module({
  controllers: [${Name}Controller],
  providers: [${Name}Service],
  exports: [${Name}Service],
})
export class ${Name == 'Ca' ? 'Ca' : Name}Module {}
`;
  fs.writeFileSync(path.join(dir, `${name}.module.ts`), moduleContent);

  // --- service.ts ---
  const endpoints = mod.endpoints.map(ep => `  ${ep.handler}(...) { return { data: [] }; }`).join('\n');
  const serviceContent = `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${Name}Service {
${mod.endpoints.map(ep => {
  const params = [];
  if (ep.path.includes(':id')) params.push('id: string');
  if (ep.method === 'POST' || ep.method === 'PUT') params.push('body: any');
  if (ep.path.includes('?')) params.push('query: any');
  const paramStr = params.join(', ');
  return `  async ${ep.handler}(${paramStr}) {
    // TODO: implement with Prisma
    return { data: [] };
  }`;
}).join('\n\n')}
}
`;
  fs.writeFileSync(path.join(dir, `${name}.service.ts`), serviceContent);

  // --- controller.ts ---
  const ctrlImports = `import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ${Name}Service } from './${name}.service';
`;
  const ctrlDecorators = `@ApiTags('${name}')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('${prefix}')
export class ${Name}Controller {
  constructor(private readonly svc: ${Name}Service) {}
`;
  const ctrlMethods = mod.endpoints.map(ep => {
    const hasBody = ep.method === 'POST' || ep.method === 'PUT';
    const hasQuery = ep.path.includes('?');
    const hasParam = ep.path.includes(':id');
    let fullPath = `'${ep.path}'`;
    
    if (ep.method === 'GET') return `  @Get(${fullPath})
  ${ep.handler}(@Param('id') id: string${hasQuery ? ', @Query() query: any' : ''}) {
    return this.svc.${ep.handler}(id${hasQuery ? ', query' : ''});
  }`;
    if (ep.method === 'POST') return `  @Post(${fullPath})
  ${ep.handler}(@Body() body: any) {
    return this.svc.${ep.handler}(body);
  }`;
    if (ep.method === 'PUT') return `  @Put(${fullPath})
  ${ep.handler}(@Param('id') id: string, @Body() body: any) {
    return this.svc.${ep.handler}(id, body);
  }`;
    if (ep.method === 'DELETE') return `  @Delete(${fullPath})
  ${ep.handler}(@Param('id') id: string) {
    return this.svc.${ep.handler}(id);
  }`;
  }).join('\n\n');

  const ctrlContent = ctrlImports + ctrlDecorators + ctrlMethods + '\n}\n';
  fs.writeFileSync(path.join(dir, `${name}.controller.ts`), ctrlContent);
}

// Update app.module.ts
const appModulePath = path.resolve(BACKEND, 'app.module.ts');
let appModule = fs.readFileSync(appModulePath, 'utf-8');

const imports = MODULES.map(m => {
  const Name = capitalize(m.name);
  return `import { ${Name == 'Ca' ? 'Ca' : Name}Module } from './${m.name.replace(/-/g, '')}/${m.name}.module';`;
}).join('\n');

const moduleNames = MODULES.map(m => `${capitalize(m.name) == 'Ca' ? 'Ca' : capitalize(m.name)}Module`);

// Find the last import line
const lastImportIdx = appModule.lastIndexOf(`import { EyeModule } from './eye/eye.module';`);
appModule = appModule.slice(0, lastImportIdx) + imports + '\n' + appModule.slice(lastImportIdx);

// Add to imports array (before EyeModule)
const importArrayIdx = appModule.indexOf('    EyeModule,');
appModule = appModule.slice(0, importArrayIdx) + moduleNames.map(n => `    ${n},
`).join('') + appModule.slice(importArrayIdx);

fs.writeFileSync(appModulePath, appModule);

console.log(`Generated ${MODULES.length} modules with ${MODULES.reduce((s, m) => s + m.endpoints.length, 0)} endpoints`);
