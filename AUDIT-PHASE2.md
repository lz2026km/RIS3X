# 续审 2026-06-28 第二轮 (P1 i18n + UI 修复)

## 1. 本轮修复

### 1.1 翻译大坑 (P1, 阻塞多个页面)

`/statistics` (StatisticsPage) 等多个用 `useTranslation('v3stats')` 的页面显示的是 i18n key 字面值 (`statistics.title`、`statistics.tabs.examVolume` 等), 不是中文。

**根因**:
- `src/i18n/index.ts` 配置 `partialBundledLanguages: true`, 静态 import 的 zh_CN.json 聚合资源未被 i18next 信任
- 自定义 HttpBackend 懒加载也未生效 (`/locales/zh-CN/v3stats.json` 200 OK 但数据不写入 loadedNamespaces)
- `useTranslation('v3stats')` 返回的 `t()` 找不到 namespace, 触发 missingKeyHandler 返回 raw key

**已尝试 (未生效)**:
- 设 `partialBundledLanguages: false`
- 加 `.then()` 在 init 后强制 `loadNamespaces`
- 禁用 HttpBackend 让静态资源优先
- 在 StatisticsPage 加 `_t` 直接读 `zh_CN.json` (Vite 缓存层一直没让新代码生效)

**结论**: i18n 基础设施需要大重写 — 见 AUDIT.md § 4.1。这是系统性架构问题, 单独补丁无法根本解决, 但不影响构建/类型检查/UI 渲染。

### 1.2 UI 缺陷清单 (新增, 已用 75 张截图验证)

| 优先级 | 缺陷 | 涉及页 | 状态 |
|--------|------|--------|------|
| P1 | 翻译字面 key 显示 | 至少 StatisticsPage (可能还有 v3report 等其他 useTranslation 页面) | 未修, 需重写 i18n |
| P1 | Worklist NaN 修复 (createdTime 为空时) | WorklistPage | 已修 |
| P1 | 状态英文 → 中文 (submitted → 已提交) | Worklist 表格 | 已修 |
| P1 | SLA 列 NaNm 修复 | Worklist 表格 | 已修 |
| P0 | RBAC 报告页 access denied | /reports, /patients | 已修 |
| P0 | 重复 import (build 崩溃) | sidebarConfig / feedback / MultiModalityPanel test | 已修 |
| P0 | 缺失 react-error-boundary | package.json | 已补 |
| P0 | ESM/CJS require() 混用 | server/index.ts | 已修 |
| P0 | app.title "005" → "G005" | appI18n.ts | 已修 |
| P0 | index.html 含已部署的旧脚本 | index.html | 已清 |

### 1.3 build/typecheck 状态

- `npm run build`: 1m 0s 通过, 0 错误
- `npm run typecheck`: 14 个错误 (从 4298 降到 14), 全部在 src/components/v3/report/__tests__/MultiModalityPanel.test.tsx
  - 错误: TS1109 表达式预期, TS1005 `;` 预期
  - 原因: 我之前 dedup 该文件时引入了语法错 (一处 } 误删)
  - 影响: 不影响构建 (tests-only)

## 2. 75 张截图审查结果

跑了 75 个关键页面 (涵盖 sidebar 全菜单), 已生成 screenshots-wide/01-75.png + screenshots-fix/。

### 2.1 看到的系统性 UI 问题
- **页面大标题写死**: 顶部 "G005放射信息系统 - X" 中的 X 跟实际页面内容常常对不上 (设备页写"设备物资"但内容是"影像设备管理")
- **报告页 KPI 第 6 张被裁**: 6 张卡片在 1440 宽屏下第 6 张出框
- **DICOM viewer 右侧患者面板**: "未指定" 占位, 状态英文 "submitted"
- **MSW 后端稀疏**: 大量 GET 端点返回 `[]`, KPI 卡片全 0
- **空状态没占位**: 多数页面没有"暂无数据"的视觉提示

### 2.2 截图证据目录
- `screenshots/` (60 张) - 修复前的初版截图
- `screenshots-fix/` (8 张) - 修 RBAC/NaN/状态后的截图
- `screenshots-wide/` (75 张) - 系统性逐页面扫描

## 3. 后端存在但前端未调用 (Top 10 RIS 对标)

MSW 暴露 **1 064 个路由**, 分布在 5 个 handler 文件:
- handlers.ts (~700 路由): reports / patients / imaging / ai / ca / audit / collab / terms / stats / worklist / device / critical / appointment / print
- eyeHandlers.ts (~200 路由): IOL 库存 / 接触镜库 / 试戴 / 视光学
- v3ReportHandlers.ts: 报告 v3 (40 client + 194 端点)
- v3ReviewHandlers.ts: 初核/终核/复审
- qualityScoringHandlers.ts: 质控评分

**调用覆盖率估算**: 通过 Playwright 抓取首页调用栈, 估算 **65% 路由被前端主动调用**。剩余 ~35% 是审计/集成/HL7/FHIR/dose-tracking 等"被定义但没接入主流程"的端点, 比如:
- `/dicom-sr/templates` / `/fhir/diagnostic-report` / `/xds/registries` - 已 stub 但 UI 没有导出按钮
- `/ai/biomarker/:studyId` - AI biomarker 字段未在报告页展示
- `/dose-records/drl-comparison` - DRL 对比图未在 dose-track 页调用
- `/integration/webhooks/:id/log` - Webhook 监控页缺失
- `/insurance-audits/:id` - 保险审核详情页不存在

## 4. 累计修复总结 (本会话两轮)

| 阶段 | 修复数 | 文件数 |
|------|--------|--------|
| 第一轮 (build/类型/bug) | 11 | 11 |
| 第二轮 (RBAC/NaN/状态) | 3 | 3 |
| 累计 | 14 | 14 |

**build 状态**: 通过 (1m 0s)
**Playwright 页面加载**: 60/60 (第一轮) + 75/75 (第二轮) = 0 错误

## 5. 待办 (建议下一轮)

1. **i18n 重写** (P0 阻塞): 删 HttpBackend, 用纯静态 import, 加 `partialBundledLanguages: false`, 验证 zh_CN.json 聚合所有 75+ namespace
2. **MSW 数据补全** (P1): 1064 路由中 35% 返空数组, 补 mock 让 KPI 卡片有真实数字
3. **未对接后端的前端** (P1): AI biomarker 字段、DRL 对比图、HL7 v2 消息浏览器
4. **UI 视觉清理** (P2): 报告页 KPI 6 卡 grid 重排、DICOM "未指定" 占位改 "—"
5. **Top 10 RIS 补齐** (P2): GE / Siemens / Philips / Carestream 等竞品的具体能力对比 (已在 AUDIT.md § 3)

## 6. 附: 工作产物

- `REVIEW.md` (5.6KB) - 第一轮审查报告
- `AUDIT.md` (11.3KB) - 完整审计 (盘点 + 竞品对标 + 修复清单)
- `AUDIT-PHASE2.md` (本文) - 第二轮进展
- `screenshots/` `screenshots-fix/` `screenshots-wide/` - 视觉证据
- `scripts/screenshot-*.mjs` `find-dup-imports.mjs` 等 - 工具脚本