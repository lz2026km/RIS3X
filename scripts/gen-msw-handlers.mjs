// Generate 14 MSW handler files for v3.0.6.11-7
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DIR = path.resolve(__dirname, '..', 'src', 'services', 'mockBackend');

const MODULE_HANDLERS = [
  {
    file: 'dentalNewHandlers.ts',
    importName: 'dentalNewHandlers',
    prefix: '/api/v1/dental',
    endpoints: [
      ['GET', 'implants', 'listImplants', [{id:'IMP001',patientId:'P001',toothNumber:'16',implantBrand:'Straumann',implantModel:'BLT',diameter:4.1,length:10,status:'PLANNED'},{id:'IMP002',patientId:'P001',toothNumber:'17',implantBrand:'Nobel Biocare',implantModel:'Active',diameter:3.75,length:11.5,status:'SURGERY_DONE'}],'implants'],
      ['POST', 'implants', 'createImplant', null, 'implant'],
      ['PUT', 'implants/:id', 'updateImplant', null, 'implant'],
      ['GET', 'appointments', 'listDentalAppointments', [{id:'DA001',patientId:'P001',dentistName:'李医生',modality:'检查',scheduledAt:'2026-07-10T09:00',state:'SCHEDULED'}],'appointments'],
      ['POST', 'appointments', 'createDentalAppointment', null, 'appointment'],
      ['GET', 'invoices', 'listDentalInvoices', [{id:'DI001',patientId:'P001',invoiceNumber:'INV-2026-001',totalAmount:3500,status:'UNPAID'}],'invoices'],
      ['POST', 'invoices', 'createDentalInvoice', null, 'invoice'],
      ['GET', 'inventory', 'listDentalInventory', [{id:'DINV001',code:'MAT-001',name:'种植体',category:'材料',quantity:50,unit:'件',unitPrice:800}],'inventory'],
      ['POST', 'inventory', 'addDentalInventory', null, 'item'],
      ['PUT', 'inventory/:id', 'updateDentalInventory', null, 'item'],
    ],
  },
  {
    file: 'workflowHandlers.ts',
    importName: 'workflowHandlers',
    prefix: '/api/v1/workflow',
    endpoints: [
      ['GET', 'definitions', 'listWfDefs', [{id:'WF001',name:'报告审核流程',description:'标准三级审核',version:1,active:true}],'definitions'],
      ['POST', 'definitions', 'createWfDef', null, 'definition'],
      ['GET', 'definitions/:id', 'getWfDef', null, 'definition'],
      ['DELETE', 'definitions/:id', 'deleteWfDef', null, null],
      ['POST', 'definitions/:id/activate', 'activateWfDef', null, null],
      ['GET', 'definitions/:id/steps', 'listWfSteps', [{id:'WFS001',workflowId:'WF001',name:'初写',stepType:'WRITING',orderIndex:0}],'steps'],
      ['GET', 'sla-policies', 'listSlaPolicies', [{id:'SLA001',name:'常规报告',modality:'CT',targetMinutes:120,warningMinutes:90}],'policies'],
      ['POST', 'sla-policies', 'createSlaPolicy', null, 'policy'],
      ['GET', 'routing-rules', 'listRoutingRules', [{id:'RR001',name:'急诊CT',modality:'CT',targetDept:'急诊科',priority:1}],'rules'],
      ['POST', 'routing-rules', 'createRoutingRule', null, 'rule'],
    ],
  },
  {
    file: 'financeHandlers.ts',
    importName: 'financeHandlers',
    prefix: '/api/v1/finance',
    endpoints: [
      ['GET', 'charge-items', 'listChargeItems', [{id:'CI001',code:'CHG-001',name:'CT平扫',category:'检查',unitPrice:300,active:true}],'items'],
      ['POST', 'charge-items', 'createChargeItem', null, 'item'],
      ['GET', 'invoices', 'listInvoices', [{id:'INV001',patientId:'P001',invoiceNumber:'INV-001',totalAmount:1200,status:'UNPAID'}],'invoices'],
      ['GET', 'invoices/:id', 'getInvoice', null, 'invoice'],
      ['POST', 'invoices', 'createInvoice', null, 'invoice'],
      ['POST', 'invoices/:id/pay', 'payInvoice', null, null],
      ['GET', 'revenue-analysis', 'getRevenueAnalysis', {daily:[{date:'2026-07-01',amount:45000}],monthly:[{month:'2026-07',amount:980000}]},null],
      ['GET', 'financial-reports', 'getFinancialReports', {reports:[{id:'FR001',type:'月度',period:'2026-07',totalRevenue:980000}]},null],
    ],
  },
  {
    file: 'dataReportHandlers.ts',
    importName: 'dataReportHandlers',
    prefix: '/api/v1/data-report',
    endpoints: [
      ['GET', 'national-reports', 'listNationalReports', [{id:'NR001',name:'国家质控月报',period:'2026-07',status:'DRAFT'}],'reports'],
      ['GET', 'national-reports/:id', 'getNationalReport', null, 'report'],
      ['GET', 'data-reports', 'listDataReports', [{id:'DR001',name:'检查量统计',category:'统计',createdAt:'2026-07-01'}],'reports'],
      ['GET', 'data-reports/:id', 'getDataReport', null, 'report'],
      ['GET', 'insurance-audits', 'listInsuranceAudits', [{id:'IA001',patientName:'张三',status:'PENDING',totalAmount:2500}],'audits'],
      ['GET', 'enterprise-search', 'enterpriseSearch', {results:[],total:0},null],
    ],
  },
  {
    file: 'regionalHandlers.ts',
    importName: 'regionalHandlers',
    prefix: '/api/v1/regional',
    endpoints: [
      ['GET', 'imaging', 'listRegionalImaging', [{id:'RI001',patientName:'李四',modality:'CT',sourceDept:'分院1'}],'studies'],
      ['GET', 'schedule', 'getDeptSchedule', [{id:'SCH001',department:'放射科',date:'2026-07-08',total:120}],'schedule'],
      ['GET', 'departments', 'listDepts', [{id:'DEPT001',name:'放射科',type:'医技',region:'本院'}],'departments'],
      ['GET', 'medical-alliance', 'listMedAlliance', [{id:'MA001',name:'医联体1',status:'ACTIVE'}],'alliances'],
      ['GET', 'integration/fhir', 'getFhirStatus', {status:'CONNECTED',lastSync:'2026-07-08T10:00'},null],
      ['GET', 'integration/mllp', 'getMllpStatus', {status:'ACTIVE',messages24h:1240},null],
    ],
  },
  {
    file: 'patientPortalHandlers.ts',
    importName: 'patientPortalHandlers',
    prefix: '/api/v1/patient-portal',
    endpoints: [
      ['GET', 'patients', 'listPortalPatients', [{id:'P001',name:'张三',phone:'13800138000'}],'patients'],
      ['GET', 'patients/:id', 'getPortalPatient', null, 'patient'],
      ['GET', 'clinical-data', 'listClinicalData', [{id:'CD001',patientId:'P001',type:'化验',value:'正常'}],'data'],
      ['GET', 'education', 'listEducation', [{id:'ED001',title:'CT检查注意事项',category:'检查准备'}],'materials'],
      ['GET', 'mobile/patients', 'getPatientMobile', {appVersion:'2.1.0',features:['预约','查询报告']},null],
      ['GET', 'mobile/doctors', 'getDoctorMobile', {appVersion:'2.1.0',features:['移动阅片','审批']},null],
    ],
  },
  {
    file: 'cosignNewHandlers.ts',
    importName: 'cosignNewHandlers',
    prefix: '/api/v1/cosign',
    endpoints: [
      ['GET', 'pending', 'listPendingCosigns', [{id:'CS001',reportId:'RPT001',requester:'李医生',status:'PENDING',createdAt:'2026-07-08'}],'items'],
      ['GET', 'pending/:id', 'getPendingCosign', null, 'item'],
      ['POST', 'pending/:id/approve', 'approveCosign', null, null],
      ['POST', 'pending/:id/reject', 'rejectCosign', null, null],
      ['GET', 'history', 'listCosignHistory', [{id:'CS002',reportId:'RPT002',approver:'张主任',status:'APPROVED',approvedAt:'2026-07-07'}],'items'],
      ['GET', 'rules', 'listCosignRules', [{id:'CR001',name:'疑难报告',trigger:'DIFFICULT'}],'rules'],
      ['GET', 'stats', 'getCosignStats', {total:156,pending:12,avgHours:4.5},null],
    ],
  },
  {
    file: 'cdsHandlers.ts',
    importName: 'cdsHandlers',
    prefix: '/api/v1/cds',
    endpoints: [
      ['GET', 'guidelines', 'listGuidelines', [{id:'GL001',name:'肺结节诊疗指南',category:'呼吸',version:'2025'}],'guidelines'],
      ['POST', 'guidelines', 'createGuideline', null, 'guideline'],
      ['GET', 'alerts', 'listCdsAlerts', [{id:'AL001',patientName:'王五',type:'剂量告警',severity:'HIGH'}],'alerts'],
      ['POST', 'alerts/:id/acknowledge', 'acknowledgeAlert', null, null],
      ['GET', 'dose-monitoring', 'getDoseMonitoring', {patients:[],avgDose:2.5,exceeded:3},null],
      ['GET', 'statistics', 'getCdsStatistics', {totalAlerts:89,acknowledged:76,escalated:5},null],
      ['GET', 'rules', 'listCdsRules', [{id:'CDR001',name:'辐射剂量超限',condition:'DOSE>1000'}],'rules'],
      ['POST', 'rules', 'createCdsRule', null, 'rule'],
    ],
  },
  {
    file: 'criticalExtHandlers.ts',
    importName: 'criticalExtHandlers',
    prefix: '/api/v1/critical',
    endpoints: [
      ['GET', 'rules', 'listCriticalRules', [{id:'CR001',name:'危急值规则1',condition:'WBC>30',severity:'URGENT'}],'rules'],
      ['POST', 'rules', 'createCriticalRule', null, 'rule'],
      ['DELETE', 'rules/:id', 'deleteCriticalRule', null, null],
      ['GET', 'stats', 'getCriticalStats', {total:45,pending:3,avgCloseTime:28},null],
      ['GET', 'stats/summary', 'getCriticalSummary', {bySeverity:{URGENT:5,HIGH:30,LOW:10},byDepartment:{}},null],
      ['GET', 'stats/timeline', 'getCriticalTimeline', {timeline:[{date:'2026-07-01',count:3}]},null],
      ['GET', 'center', 'listCriticalCenter', [{id:'CC001',patientName:'赵六',finding:'颅内出血',status:'ACKNOWLEDGED'}],'items'],
      ['POST', 'auto-detect', 'autoDetectCritical', {matched:true,ruleId:'CR001'},null],
      ['POST', 'close-loop', 'closeCriticalLoop', {success:true},null],
    ],
  },
  {
    file: 'qcExtHandlers.ts',
    importName: 'qcExtHandlers',
    prefix: '/api/v1/qc',
    endpoints: [
      ['GET', 'dashboard', 'getQcDashboard', {totalImages:1240,pendingReview:89,passRate:94.5,avgScore:92},null],
      ['GET', 'image', 'listQcImages', [{id:'IMG001',patientName:'张三',modality:'CT',score:95,status:'PASSED'}],'images'],
      ['GET', 'radiologist-annual', 'listRadiologistAnnual', [{id:'RA001',name:'李医生',total:1200,avgScore:93}],'items'],
      ['GET', 'defect', 'listQcDefects', [{id:'DEF001',type:'图像质量',description:'运动伪影',severity:'MINOR'}],'defects'],
      ['POST', 'defect', 'reportQcDefect', null, 'defect'],
      ['GET', 'stats', 'getQcStats', {byMonth:[{month:'2026-07',total:320,passed:302}]},null],
    ],
  },
  {
    file: 'reportQualityHandlers.ts',
    importName: 'reportQualityHandlers',
    prefix: '/api/v1/report-quality',
    endpoints: [
      ['GET', 'score-rules', 'listScoreRules', [{id:'SR001',name:'完整性评分',maxScore:30,category:'结构'}],'rules'],
      ['POST', 'score-rules', 'createScoreRule', null, 'rule'],
      ['GET', 'defect-library', 'listDefectLibrary', [{id:'DL001',name:'漏写部位',severity:'MAJOR',category:'遗漏'}],'entries'],
      ['POST', 'defect-library', 'createDefectEntry', null, 'entry'],
      ['GET', 'ai-report-drafts', 'listAiReportDrafts', [{id:'AID001',patientName:'张三',status:'DRAFT',createdAt:'2026-07-08'}],'drafts'],
      ['POST', 'ai-report-drafts', 'createAiReportDraft', null, 'draft'],
      ['GET', 'stats', 'getReportQualityStats', {total:450,avgScore:88,passRate:92},null],
    ],
  },
  {
    file: 'caHandlers.ts',
    importName: 'caHandlers',
    prefix: '/api/v1/ca',
    endpoints: [
      ['GET', 'certificates', 'listCertificates', [{id:'CERT001',subject:'放射科CA',issuer:'国家CA',validFrom:'2025-01-01',validTo:'2027-01-01'}],'certificates'],
      ['POST', 'certificates', 'uploadCertificate', null, 'certificate'],
      ['POST', 'sign', 'signDocument', {signatureId:'SIG001',signedAt:new Date().toISOString()},null],
      ['GET', 'signatures', 'listSignatures', [{id:'SIG001',documentType:'报告',signer:'张主任',signedAt:'2026-07-08T10:00'}],'signatures'],
      ['POST', 'verify', 'verifySignature', {valid:true,subject:'放射科CA',issuer:'国家CA'},null],
      ['GET', 'config', 'getCaConfig', {provider:'内部CA',algorithm:'SHA256withRSA'},null],
    ],
  },
  {
    file: 'deviceMgmtHandlers.ts',
    importName: 'deviceMgmtHandlers',
    prefix: '/api/v1/device-mgmt',
    endpoints: [
      ['GET', 'equipment-lifecycle', 'listEquipmentLifecycle', [{id:'EL001',deviceId:'DEV001',event:'安装',date:'2020-01-01',operator:'工程师A'}],'events'],
      ['GET', 'devices', 'listDevices', [{id:'DEV001',code:'CT-01',name:'CT 1号机',modality:'CT',state:'IN_USE',location:'1号检查室'}],'devices'],
      ['GET', 'faults', 'listDeviceFaults', [{id:'FA001',deviceId:'DEV001',description:'软件死机',severity:'MINOR',status:'RESOLVED'}],'faults'],
      ['POST', 'faults', 'reportDeviceFault', null, 'fault'],
      ['GET', 'materials', 'listMaterials', [{id:'MAT001',code:'MAT-001',name:'一次性针筒',quantity:200,unit:'支'}],'materials'],
      ['POST', 'materials', 'addMaterial', null, 'material'],
      ['GET', 'dose-tracking', 'getDoseTracking', {patients:[],totalExams:1240,avgDlp:450,exceeded:5},null],
      ['GET', 'contrast/adverse-reactions', 'listAdverseReactions', [{id:'AR001',patientName:'张三',reaction:'皮疹',severity:'MINOR'}],'reactions'],
      ['POST', 'contrast/adverse-reactions', 'reportAdverseReaction', null, 'reaction'],
      ['GET', 'contrast/inventory', 'getContrastInventory', [{id:'CI001',name:'碘海醇',volume:500,unit:'ml',quantity:30}],'items'],
    ],
  },
  {
    file: 'aiPlatformHandlers.ts',
    importName: 'aiPlatformHandlers',
    prefix: '/api/v1/ai-platform',
    endpoints: [
      ['GET', 'models', 'listAiModels', [{id:'AI001',name:'肺结节检测',version:'2.3',status:'DEPLOYED',accuracy:96.5}],'models'],
      ['GET', 'models/:id', 'getAiModel', null, 'model'],
      ['GET', 'qc', 'listAiQcResults', [{id:'AIQC001',patientName:'张三',aiScore:95,humanScore:93}],'results'],
      ['GET', 'structured-reports', 'listAiStructuredReports', [{id:'AISR001',patientName:'张三',status:'COMPLETED',createdAt:'2026-07-08'}],'reports'],
      ['POST', 'structured-reports', 'generateAiStructuredReport', null, 'report'],
      ['GET', 'orchestration', 'getAiOrchestration', {pipelines:[],activeCount:3},null],
      ['GET', 'fusion', 'getAiFusionWorkspace', {modalities:['CT','MRI','PET'],activeSessions:[]},null],
      ['GET', 'marketplace', 'getAiMarketplace', {apps:[{id:'APP001',name:'AI肺结节','vendor':'DeepHealth','price':50000}]},null],
    ],
  },
];

// Write all handler files
for (const mod of MODULE_HANDLERS) {
  let content = `// [v3.0.6.11-7] ${mod.prefix} MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '${mod.prefix}';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const ${mod.importName} = [
`;

  for (const ep of mod.endpoints) {
    const [method, epPath, handlerName, mockData, storeKey] = ep;
    
    if (method === 'GET' && mockData && !epPath.includes(':id')) {
      // list endpoint with data
      content += `  http.get(\`\${API}/${epPath}\`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('${storeKey}'); } catch {}
    if (!items.length) items = ${JSON.stringify(mockData)};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
`;
    } else if (method === 'GET' && epPath.includes(':id')) {
      content += `  http.get(\`\${API}/${epPath}\`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('${storeKey}', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
`;
    } else if (method === 'POST') {
      content += `  http.post(\`\${API}/${epPath}\`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('${storeKey}', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
`;
    } else if (method === 'PUT') {
      content += `  http.put(\`\${API}/${epPath}\`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    try { update('${storeKey}', params.id as string, body); } catch {}
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
`;
    } else if (method === 'DELETE') {
      content += `  http.delete(\`\${API}/${epPath}\`, async ({ params }) => {
    await delay(delayMs());
    try { remove('${storeKey}', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
`;
    } else if (method === 'GET' && mockData && !epPath.includes(':id')) {
      // Already handled above
    }
  }

  content += `];\n`;
  const filePath = path.join(MOCK_DIR, mod.file);
  fs.writeFileSync(filePath, content);
  console.log(`Wrote ${mod.file} (${mod.endpoints.length} endpoints)`);
}

// Now modify handlers.ts to include all new handlers
const handlersPath = path.join(MOCK_DIR, 'handlers.ts');
let handlers = fs.readFileSync(handlersPath, 'utf-8');

// Add imports - find the dentalHandlers import and insert after it
const importInsertPoint = handlers.indexOf('import { dentalHandlers }');
const newImports = MODULE_HANDLERS.map(m => `import { ${m.importName} } from './${m.file.replace('.ts', '')}';`).join('\n');
handlers = handlers.slice(0, importInsertPoint) + newImports + '\n' + handlers.slice(importInsertPoint);

// Add to handlers array - find the end of the spread array and insert before the last closing
const arrayEnd = handlers.lastIndexOf('];');
const arrayInsert = MODULE_HANDLERS.map(m => `  ...${m.importName},`).join('\n');
handlers = handlers.slice(0, arrayEnd) + arrayInsert + '\n' + handlers.slice(arrayEnd);

// Update comment counters
handlers = handlers.replace(/\/\/ 总计:.*\n/g, '');
const totalEp = MODULE_HANDLERS.reduce((s, m) => s + m.endpoints.length, 0);
handlers = handlers.replace('export const handlers = [', `// v3.0.6.11-7: ${totalEp} new endpoints from 14 modules
export const handlers = [`);

fs.writeFileSync(handlersPath, handlers);
console.log(`Updated handlers.ts with ${MODULE_HANDLERS.length} new module imports + array entries`);
