import fs from 'node:fs';
const path = 'REVIEW.md';
const extra = `

---

## PHASE 3 — 2026-07-02 (本轮审计增量)

### 仓库同步
- 远端 main 从 \`2d46f83\` (v3.0.6.8-52) 推进到 \`4c05705\` (v3.0.6.8-106)
- 53 个新提交, 改动 237 个文件 +12500 / -537 (含 1375 行牙科 handlers, 149 行 eyeApi/dentalApi, 110+ 行 sidebar)
- 5 个 git 冲突已解决:
  - \`dist/index.html\`, \`index.html\`, \`package.json\` → accept theirs (远程已包含 14 个修复中的 1 和 3)
  - \`package-lock.json\`, \`src/a11y/__tests__/SkipLink.test.tsx\` → accept ours

### P0 修复: i18n 翻译全部生效

**\`src/i18n/index.ts\` 重写 (246 → 159 行)**
- 删除自定义 \`HttpBackend\` 类 (懒加载)
- 删除 \`LanguageDetector\` 插件
- 删除 \`partialBundledLanguages: true\` 模式
- 改为纯静态 \`resources: {zh_CN, en_US}\` + \`load: "currentOnly"\`
- \`ensureNamespaces\` 降级为 no-op (避免既有调用方 undefined)

**\`src/i18n/appI18n.ts\` 合并 5 个 namespace (zh + en 共 10 块)**
- worklist (101 keys)
- critical (27 keys)
- v3worklist (33 keys)
- v3report (539 keys)
- v3stats (27 keys)
- 来源: 聚合 \`zh_CN.json\` / \`en_US.json\`
- 补回之前 #8 修复: \`app.title\` = \`G005放射信息系统\`

**验证: 72 个页面扫描, 0 个 raw i18n key 显示**
- \`/statistics\` 全部 Tab 翻译: \`检查量统计 / 阳性率统计 / 工作量统计 / 经营分析 / 收入统计 / 质量控制 / 设备效能 / 患者分析\`
- \`/worklist\` 加载提示翻译: \`正在从 API 加载检查数据...\`
- \`worklist.loadingApi\`: ✅ 修复
- \`statistics.title\`, \`statistics.tabs.*\`, \`statistics.refresh\`, \`statistics.exportReport\`: ✅ 全部修复

### 路由修复
**\`src/routes/routeTable.tsx\` 补挂 \`/worklist\` 路由**
- line 513 新增: \`wrapped("/worklist", React.createElement(WorklistPage))\`
- 原因: sidebar 引用 \`/worklist\` 但 routeTable 缺失该 path, 导致 #9 RBAC 修复期望路径不可达
- 验证: 访问 \`/worklist\` URL 不再重定向到 \`/\`, 数据正常加载 (20 项检查, KPI 0 初始化)

### 状态显示修复
**\`src/pages/worklist/WorklistListView.tsx\` STATUS_CONFIG 补 \`published\`**
- 添加: \`published: { bg: '#ecfdf5', color: '#047857', label: '已发布', order: 5 }\`
- 原因: mock exam data 中存在 \`status: 'published'\` 但 STATUS_CONFIG 缺该 key, 显示英文
- 验证: \`published\` 状态全部转 \`已发布\`

### 依赖补齐
- \`onnxruntime-web@1.17.1\` (远程 v3.0.6.8-60 \`DentalAiOnnxPage\` 引入, 缺包导致 vite build 失败)
- \`playwright\` (dev dependency, 用于截图审计)
- 用 \`--legacy-peer-deps\` 解决 storybook peer dep 冲突 (远程 53 个新提交引入)

### 验证状态
- \`npm run build\`: ✅ 通过 (1m 11s, 1m 0s, 1m 6s 三次)
- \`npm run typecheck\`: ⚠️ 4809 个错误 (新代码引入, 不在本次回归范围; 95% 是 TS6133 未使用 import)
- Playwright 截图: \`screenshots-fix/\` 目录, 5 张关键页面
- 已知小问题: 21 个 console error 是 \`frame-ancestors\` CSP warning (与功能无关, 来自 index.html meta 标签)

### 未完成
- Top 10 RIS 对标审计 (GE/Siemens/Philips/Fujifilm/Carestream/Agfa/Canon/Hologic/Intelerad/Mach7)
- 4809 个 typecheck 错误清理
- UI 细节优化 (KPI 卡片裁切 / 页面大标题 / 表格空状态)
- 后端存在但前端未调用的端点补齐 (DRL 对比图 / AI biomarker / FHIR DiagnosticReport / Webhook 监控)
`;
const text = fs.readFileSync(path, 'utf8');
fs.writeFileSync(path, text + extra, 'utf8');
console.log('appended', extra.length, 'bytes; total now', (text + extra).length);
