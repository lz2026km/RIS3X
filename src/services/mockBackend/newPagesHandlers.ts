// [v3.0.6.8-77] 新页面后端 Handler 扩展
// 为 v67-v76 新页面提供 MSW 端点支持
import { http, HttpResponse } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

const auditLogs = Array.from({length:20},(_,i)=>({
  id:'AUD-'+String(i+1).padStart(3,'0'),
  user:['Dr. Wang','Nurse Li','Dr. Zhang','Admin Liu','Ext-API'][i%5],
  action:['VIEW_STUDY','EXPORT_IMAGE','MODIFY_REPORT','USER_ROLE_CHANGE','API_ACCESS'][i%5],
  target:['CBCT-20260628-0'+i,'CT-20260627-0'+i,'RPT-20260626-0'+i,'user: nurse_zhao','/api/patients/search'][i%5],
  ip:'192.168.1.'+(100+i),
  timestamp:'2026-06-28 '+(9+Math.floor(i/2))+':'+String(i*3%60).padStart(2,'0')+':'+String(i*7%60).padStart(2,'0'),
  result:i%4===0?'denied':'allowed',
  reason:['Clinical care','No export permission','Report revision','Role upgrade','Rate limit exceeded'][i%5]
}));

export const newPagesHandlers = [
  http.get(`${API_BASE}/audit/logs`, ({request}) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')||'1');
    const limit = parseInt(url.searchParams.get('limit')||'10');
    const start = (page-1)*limit;
    return HttpResponse.json({data: auditLogs.slice(start,start+limit), total: auditLogs.length});
  }),
  http.get(`${API_BASE}/terminology/concepts`, ({request}) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')||'';
    const concepts = [
      {code:'D0140',system:'SNOMED-CT',display:'Periapical radiolucency',conceptId:'122750008',semanticTag:'finding',active:true},
      {code:'K08.8',system:'ICD-11',display:'Disorder of tooth development',conceptId:'',active:true},
      {code:'245-6',system:'LOINC',display:'CT Abdomen WO contrast',conceptId:'',active:true},
    ].filter(c => !q || c.code.includes(q) || c.display.includes(q));
    return HttpResponse.json(concepts);
  }),
  http.get(`${API_BASE}/report-templates`, () => HttpResponse.json([
    {id:'TP-1',name:'CT Chest Routine',category:'Structured',modality:'CT',version:3,usage:147,status:'published',shared:true},
    {id:'TP-2',name:'CBCT Dental Implant',category:'Structured',modality:'CBCT',version:2,usage:89,status:'published',shared:true},
    {id:'TP-3',name:'OCT Macula',category:'Free-text',modality:'OCT',version:1,usage:234,status:'published',shared:true},
  ])),
  http.get(`${API_BASE}/ihe/endpoints`, () => HttpResponse.json([
    {id:'EP-1',name:'Hospital B - XDS Registry',type:'XDS Registry',url:'https://hosp-b/ihe/xds/registry',status:'online'},
    {id:'EP-2',name:'Hospital B - XDS Repository',type:'XDS Repository',url:'https://hosp-b/ihe/xds/repository',status:'online'},
    {id:'EP-3',name:'Clinic C - PIX Manager',type:'PIX Manager',url:'https://clinic-c/ihe/pix',status:'online'},
  ])),
  http.get(`${API_BASE}/scheduling/resources`, () => HttpResponse.json([
    {id:'CBCT-01',name:'CBCT 1',type:'device',dept:'Radiology',usage:85,status:'online',bookings:['09:00-10:00','13:00-14:00']},
    {id:'OP-01',name:'OR 1',type:'room',dept:'Oral Surgery',usage:60,status:'available',bookings:['10:00-12:00']},
  ])),
  http.get(`${API_BASE}/clinical-pathways`, () => HttpResponse.json([
    {id:'PW-01',name:'Cataract surgery CP',dept:'Ophthalmology',phase:'Pre-op eval',progress:60,status:'active',patients:12},
    {id:'PW-02',name:'CBCT implant CP',dept:'Oral Surgery',phase:'Placement',progress:85,status:'active',patients:8},
  ])),
  http.get(`${API_BASE}/ai-fusion/insights`, () => HttpResponse.json([
    {id:'AI-1',type:'lesion',finding:'Periapical lesion #36',confidence:0.92,modality:'CBCT',source:'AI-Detector v3',actionable:true},
    {id:'AI-2',type:'vessel',finding:'Tortuous vessels OD',confidence:0.88,modality:'OCT-A',source:'RetinaAI v2',actionable:true},
  ])),
  http.get(`${API_BASE}/dicom-sr`, () => HttpResponse.json([
    {id:'SR-001',studyId:'CBCT-0628-01',type:'Measurement',modality:'CBCT',findings:12,status:'final',author:'Dr. Wang'},
    {id:'SR-002',studyId:'CT-0627-03',type:'AI Finding',modality:'CT',findings:5,status:'preliminary',author:'AI v2'},
  ])),
];
