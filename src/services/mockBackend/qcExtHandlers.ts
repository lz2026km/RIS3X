// [v3.0.6.11-7] /api/v1/qc MSW handlers
// [Phase 2 MSW 降级] 全部 6 个 handler 无前端调用(qcImageAiApi 使用 /qc/image-ai/*,
// 后端已有 /api/qc/image-ai 真实实现),已按 C 类清理。
// 保留空数组导出以兼容 handlers.ts 的 import;qc 扩展端点由真实后端提供。
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';(min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const qcExtHandlers = [
  // [Phase 2 MSW 降级] 已移除端点: /qc/dashboard /qc/image /qc/radiologist-annual
  //   /qc/defect (GET/POST) /qc/stats
];
