// [v3.0.6.8-77] 新页面后端 Handler 扩展
// 为 v67-v76 新页面提供 MSW 端点支持
// [Phase 2 MSW 降级] 已移除 7 个无前端调用端点: /audit/logs /terminology/concepts
//   /report-templates /ihe/endpoints /scheduling/resources /clinical-pathways /ai-fusion/insights
import { http, HttpResponse } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

export const newPagesHandlers = [
  http.get(`${API_BASE}/dicom-sr`, () => HttpResponse.json([
    {id:'SR-001',studyId:'CBCT-0628-01',type:'Measurement',modality:'CBCT',findings:12,status:'final',author:'Dr. Wang'},
    {id:'SR-002',studyId:'CT-0627-03',type:'AI Finding',modality:'CT',findings:5,status:'preliminary',author:'AI v2'},
  ])),
];
