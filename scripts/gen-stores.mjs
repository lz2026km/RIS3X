import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.resolve(__dirname, '..', 'src', 'store');

const storeDefs = [
  { file:'dentalStore.ts', title:'Dental', type:'Dental', fields:['studies','implants','appointments','invoices','inventoryItems'],
    loadFields:[
      ['studies','studies','studies'],
      ['implants','implants','implants'],
      ['appointments','appointments','appointments'],
      ['invoices','invoices','invoices'],
      ['inventoryItems','inventory','inventory-items'],
    ]
  },
  { file:'workflowStore.ts', title:'Workflow', type:'Workflow', fields:['definitions','slaPolicies','routingRules'],
    loadFields:[
      ['definitions','definitions','definitions'],
      ['slaPolicies','sla-policies','sla-policies'],
      ['routingRules','routing-rules','routing-rules'],
    ]
  },
  { file:'financeStore.ts', title:'Finance', type:'Finance', fields:['chargeItems','invoices','revenueAnalysis','financialReports'],
    loadFields:[
      ['chargeItems','charge-items','charge-items'],
      ['invoices','invoices','invoices'],
      ['revenueAnalysis','revenue-analysis',null],
      ['financialReports','financial-reports',null],
    ]
  },
  { file:'dataReportStore.ts', title:'DataReport', type:'DataReport', fields:['nationalReports','dataReports','insuranceAudits'],
    loadFields:[
      ['nationalReports','national-reports','national-reports'],
      ['dataReports','data-reports','data-reports'],
      ['insuranceAudits','insurance-audits','insurance-audits'],
    ]
  },
  { file:'regionalStore.ts', title:'Regional', type:'Regional', fields:['imagingStudies','schedule','departments','medicalAlliances','integrationStatus'],
    loadFields:[
      ['imagingStudies','imaging','imaging'],
      ['schedule','schedule',null],
      ['departments','departments','departments'],
      ['medicalAlliances','medical-alliance','medical-alliance'],
      ['integrationStatus','integration/fhir',null],
    ]
  },
  { file:'patientPortalStore.ts', title:'PatientPortal', type:'PatientPortal', fields:['portalPatients','clinicalData','educationMaterials','mobileConfig'],
    loadFields:[
      ['portalPatients','patients','patients'],
      ['clinicalData','clinical-data','clinical-data'],
      ['educationMaterials','education','education'],
      ['mobileConfig','mobile/patients',null],
    ]
  },
  { file:'cosignStore.ts', title:'Cosign', type:'Cosign', fields:['pendingCosigns','cosignHistory','cosignRules','cosignStats'],
    loadFields:[
      ['pendingCosigns','pending','items'],
      ['cosignHistory','history','items'],
      ['cosignRules','rules','rules'],
      ['cosignStats','stats',null],
    ]
  },
  { file:'cdsStore.ts', title:'Cds', type:'Cds', fields:['guidelines','alerts','doseMonitoring','cdsStatistics','cdsRules'],
    loadFields:[
      ['guidelines','guidelines','guidelines'],
      ['alerts','alerts','alerts'],
      ['doseMonitoring','dose-monitoring',null],
      ['cdsStatistics','statistics',null],
      ['cdsRules','rules','rules'],
    ]
  },
  { file:'criticalExtStore.ts', title:'CriticalExt', type:'CriticalExt', fields:['criticalRules','criticalStats','criticalCenterItems'],
    loadFields:[
      ['criticalRules','rules','rules'],
      ['criticalStats','stats/summary',null],
      ['criticalCenterItems','center','items'],
    ]
  },
  { file:'qcStore.ts', title:'Qc', type:'Qc', fields:['qcDashboard','qcImages','radiologistAnnual','qcDefects','qcStats'],
    loadFields:[
      ['qcDashboard','dashboard',null],
      ['qcImages','image','images'],
      ['radiologistAnnual','radiologist-annual','items'],
      ['qcDefects','defect','defects'],
      ['qcStats','stats',null],
    ]
  },
  { file:'deviceMgmtStore.ts', title:'DeviceMgmt', type:'DeviceMgmt', fields:['equipmentLifecycle','devices','faults','materials','doseTracking','contrastReactions','contrastInventory'],
    loadFields:[
      ['equipmentLifecycle','equipment-lifecycle','events'],
      ['devices','devices','devices'],
      ['faults','faults','faults'],
      ['materials','materials','materials'],
      ['doseTracking','dose-tracking',null],
      ['contrastReactions','contrast/adverse-reactions','reactions'],
      ['contrastInventory','contrast/inventory','items'],
    ]
  },
  { file:'aiPlatformStore.ts', title:'AiPlatform', type:'AiPlatform', fields:['aiModels','aiQcResults','aiStructuredReports','aiOrchestration','aiMarketplace'],
    loadFields:[
      ['aiModels','models','models'],
      ['aiQcResults','qc','results'],
      ['aiStructuredReports','structured-reports','reports'],
      ['aiOrchestration','orchestration',null],
      ['aiMarketplace','marketplace',null],
    ]
  },
];

for (const s of storeDefs) {
  const prefix = s.title.toLowerCase() === 'dental' ? 'dental' : 
    s.title.toLowerCase() === 'workflow' ? 'workflow' : 
    s.title.toLowerCase() === 'finance' ? 'finance' : 
    s.title.toLowerCase() === 'datareport' ? 'data-report' : 
    s.title.toLowerCase() === 'regional' ? 'regional' : 
    s.title.toLowerCase() === 'patientportal' ? 'patient-portal' : 
    s.title.toLowerCase() === 'cosign' ? 'cosign' : 
    s.title.toLowerCase() === 'cds' ? 'cds' : 
    s.title.toLowerCase() === 'criticalext' ? 'critical' : 
    s.title.toLowerCase() === 'qc' ? 'qc' : 
    s.title.toLowerCase() === 'devicemgmt' ? 'device-mgmt' : 
    s.title.toLowerCase() === 'aiplatform' ? 'ai-platform' : '';

  const loadActions = s.loadFields.map(([field, apiPath, dataKey]) =>
    `  fetch${field.charAt(0).toUpperCase()+field.slice(1)}: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch('/api/v1/${prefix}/${apiPath}');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const data = ${dataKey ? `json.data || json.${dataKey}` : 'json.data || json'};
      set({ ${field}: Array.isArray(data) ? data : (data ? [data] : []), loading: false });
    } catch (err) { set({ error: String(err), loading: false }); }
  },`
  ).join('\n');

  const initFields = s.fields.map(f => `${f}: [],`).join('\n  ');
  const loadDecls = s.loadFields.map(([f]) =>
    `  fetch${f.charAt(0).toUpperCase()+f.slice(1)}: () => Promise<void>;`
  ).join('\n');

  const content = `// v3.0.6.11-7: ${s.title} Store
import { create } from 'zustand';

interface ${s.title}State {
  ${s.fields.map(f => `${f}: any[];`).join('\n  ')}
  loading: boolean;
  error: string | null;
${loadDecls}
}

export const use${s.title}Store = create<${s.title}State>((set) => ({
  ${initFields}
  loading: false,
  error: null,

${loadActions}
}));

export default use${s.title}Store;
`;
  const fp = path.join(STORE_DIR, s.file);
  fs.writeFileSync(fp, content);
  console.log(`Wrote ${s.file}`);
}

console.log(`Generated ${storeDefs.length} stores`);
