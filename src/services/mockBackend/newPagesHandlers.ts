// [v3.0.6.8-77] 新页面后台 Handler 扩展
// 为 v67-v76 新页面提供 MSW 端点支持
// [Phase 2 MSW 降级] 已移除 7 个无前端调用端点: /audit/logs /terminology/concepts
//   /report-templates /ihe/endpoints /scheduling/resources /clinical-pathways /ai-fusion/insights
// [v3.0.6.16-8] 移除重复的 GET /dicom-sr:
//   本文件曾用一个与 SrDocument 形状不符的裸数组注册了同路径 handler, 且注册顺序早于
//   srHandlers —— 列表返回 SR-001 而 GET /dicom-sr/:id 在 srHandlers 的 store 里 404。
//   DICOM SR 端点现由 srHandlers 独占 (含种子文档)。
export const newPagesHandlers: [] = [];
