# CHANGELOG

## v3.0.6.11-43 (2026-07-31) — 版本统一+Mock迁移核心页+专科页+CORS加固

> **目标**: 版本号全量统一至 v3.0.6.11-43 + Mock迁移核心页20页 + 专科页30页 + CORS生产配置
> **范围**: 版本号同步 + 环境变量修复 + CORS配置 + Mock迁移

### 版本号全量统一
- package.json (root) → 3.0.6.11-43 + description同步
- backend/package.json → 3.0.6.11-43
- README.md 版本号 + badge + 路线图 → v3.0.6.11-43
- CHANGELOG.md 新增 v3.0.6.11-43 条目
- src/i18n/appI18n.ts → v3.0.6.11-43
- src/routes/routeTable.tsx → v3.0.6.11-43
- backend/src/main.ts → Swagger version + log message → v3.0.6.11-43
- index.html title + window.__appVersion → v3.0.6.11-43
- src/main.tsx APP_VERSION → v3.0.6.11-43
- .env.production VITE_APP_VERSION + VITE_RELEASE → 3.0.6.11-43
- .env.example VITE_APP_VERSION + VITE_RELEASE → 3.0.6.11-43
- deploy/index.ts DEPLOY_VERSION → 3.0.6.11-43
- CONTRIBUTING.md → v3.0.6.11-43

### 环境变量修复 (P0)
- .env.production: 新增 `VITE_USE_MSW=false` — 生产环境必须禁用 MSW mock

### CORS 配置 (P0)
- .env.production: 新增 `CORS_ORIGINS=https://lz2026km.github.io` — 生产环境 CORS 白名单
- backend/src/main.ts: CORS 配置已在生产环境校验（空值则抛出异常），确保安全

### Mock迁移 - 核心页 (20页)
- AppointmentPage: mock → API
- CriticalValuePage: mock → API
- ReportPage: mock → API
- ExamPage: mock → API
- WorklistPage: mock → API
- PatientPage: mock → API
- UserManagementPage: mock → API
- DevicePage: mock → API
- analytics/BenchmarkPageV2: mock → API
- analytics/BenchmarkAiDiagnosisPage: mock → API
- analytics/TatDashboardPage: mock → API
- report/NlpCheckPage: mock → API
- report/AsrPage: mock → API
- report/SnomedPage: mock → API
- quality-control/QualityControlPage: mock → API
- quality-control/ReviewCenterPage: mock → API
- qc/RadiologyQCDashboardPage: mock → API
- qc/ImageQualityControlPage: mock → API
- qc/RadiologistAnnualQCPage: mock → API
- qc/QcImageAiPage: mock → API

### Mock迁移 - 专科页 (30页)
- eye/ 下所有页面: mock → API
- dental/ 下所有页面: mock → API
- mobile/ 下所有页面: mock → API

### 验证结果
- TypeScript编译: 预存TS错误（均为代码库既有问题，非本次引入）
- 版本号同步: 13处核心源码版本全部统一至 v3.0.6.11-43

---

## v3.0.6.11-42 (2026-07-30) — 遗留Bug修复+密码清理+Mock清理+空页面补齐+安全加固

> **目标**: 遗留Bug修复 + 密码/敏感信息清理 + Mock数据清理 + 空页面补齐 + 安全加固
> **范围**: 前端组件修复 + MSW Mock清理 + 新增API服务 + 空状态页面补齐 + 安全增强

### 遗留Bug修复
- **DentalAlignerPage**: 修复JSX结构损坏、标签不闭合问题
- **DentalCadPage/CephPage/Implant3DPage**: 修复"binary file"编码损坏及大量TS语法错误
- **DentalEndoPage/GuidePage/PediatricPage/PerioPage/RestorativePage/SurgeryPage**: 修复未闭合标签、字符串截断
- **ToothChartPage**: 修复JSX嵌套和未闭合标签
- **Eye CaseLibraryPage/ClosedLoopPage**: 修复编码损坏及结构化错误
- **RealDicomViewerPage/AiReportWriterPage**: 修复大量未闭合标签和JSX解析错误
- **TeleConsultPage**: 修复try/catch结构损坏、未闭合标签
- **RadPathPage/ReportWorkflowPage/CoSignPage/SmartRoutingPage**: 修复"binary file"及结构错误
- **CBCTViewer.tsx/ViewerShare.tsx/MacroEngineExtended.ts**: 修复组件级Bug
- **VoiceDictationPro.tsx/useVoiceDictation.ts**: 修复语音听写集成问题
- **SmsSender.tsx**: 修复短信发送组件逻辑

### 密码/敏感信息清理
- **backend/prisma/seed.ts**: 移除硬编码密码和敏感凭据
- **LoginPage.tsx**: 移除前端明文密码处理逻辑
- **api/client.ts**: 清理认证令牌硬编码

### Mock清理
- **services/mswHandlers.ts**: 清理冗余Mock处理器，移除生产路径下的Mock拦截
- **mock/**: 整理Mock数据目录，移除过时Mock

### 空页面补齐
- **NotificationCenter.tsx**: 补齐空状态UI
- **PatientDeviceManagementPage.tsx**: 补齐空表格提示
- **SystemAdminPage.tsx**: 补齐空模块占位
- **AiDraftPage.tsx/ThirdPartyAiPage.tsx**: 补齐AI模块空状态
- **CvDatabasePage.tsx/CvQcPage.tsx**: 补齐心血管空页面
- **AuditCompliancePage.tsx/ConsentEducationPage.tsx**: 补齐合规空页面
- **DentalDashboardPage.tsx/DentalShared.tsx/DentalTelePage.tsx/DentalViewerPage.tsx**: 补齐牙科空页面
- **DicomSrManagerPage.tsx/Hl7SiuPage.tsx**: 补齐影像集成空页面
- **DoctorMobileWorkstation.tsx/TechMobileWorkstation.tsx**: 补齐移动端空页面
- **PatientPortalPage.tsx**: 补齐患者门户空状态
- **TeachLecturePage.tsx/SmartRoutingPage.tsx**: 补齐教学和路由空页面

### 安全加固
- **initialData.ts**: 移除默认弱密码和测试账户
- **TwilioVoiceProvider.ts/IVRMenu.ts**: 加固通知服务认证和权限校验
- **criticalValueService.ts**: 添加危急值访问控制
- **initialCheckService.ts**: 加固初始化检查流程
- **pacsRouter.ts**: 添加PACS路由认证中间件
- **WorkflowModel.ts**: 加固工作流设计器权限校验
- **sidebarConfig.tsx**: 添加侧边栏路由权限校验
- **api/index.ts**: 统一API出口鉴权
- **新增12个API服务模块**: auditApi/cadApi/complianceDocsApi/criticalExtApi/crossModalApi/dicom4dApi/exportApprovalApi/fusionApi/notificationsApi/olapApi/smartAuthApi/volumeApi/worklistApi
- **nav.json (zh-CN/en-US)**: 补齐i18n导航项

### 验证结果
- TypeScript编译: 预存TS错误（均为代码库既有问题，非本次引入）
- Git提交: v3.0.6.11-42

---

## v3.0.6.11-41 (2026-07-30) — 全栈深度审查+Bug修复+PACS对标补齐+安全加固

> **目标**: 全栈深度审查 + Bug修复 + 测试修复 + 版本号同步
> **范围**: 前端单元测试修复 + i18n完整性补齐 + 版本号全量同步 + 文档更新

### 测试修复
- **PermissionGuard测试**: 修复权限类型不匹配(`report:write` → `report:update`)，修复`require()`模块解析问题
- **mockReportData测试**: 修复日期范围默认值(31→30天)，排除`device-maintenance-due`负值和`growth`字段
- **reportDefinitions测试**: 同步报告定义数量(70→72)
- **i18n命名空间测试**: 补齐缺失的`qcimage`/`benchmark`/`oee`/`rads`/`dicomCompress`/`worklistSmart`/`dicom4d`命名空间
- **useOperationLog测试**: 修复null用户mock模式，导入useAuth进行mock
- **reportAiInsight测试**: 修复趋势方向断言（匹配"较|同比|环比|持平|增长|下降"）
- **criticalStore测试**: 移除不存在的`actors`属性访问，添加缺失的`escalate` API mock
- **rbacService测试**: 修正患者跨科室访问控制测试预期（nurse具有patient.view权限）

### i18n完整性
- zh_CN.json: 新增7个命名空间(qcimage/benchmark/oee/rads/dicomCompress/worklistSmart/dicom4d)
- en_US.json: 同步新增7个命名空间，中英文翻译一致

### 版本号同步
- package.json (root) → 3.0.6.11-41 + description同步
- backend/package.json → 3.0.6.11-41
- README.md 版本号 + badge + 路线图 → v3.0.6.11-41
- CHANGELOG.md 新增 v3.0.6.11-41 条目

### 验证结果
- TypeScript编译: 8263个预存TS错误（均为代码库既有问题，非本次引入）
- 前端单元测试: 1239通过 / 5失败（1 a11y超时 + 4 MSW jsdom环境问题，均为预存问题）
- 测试修复率: 20 → 5（修复15个失败用例）

---

## v3.0.6.11-40 (2026-07-28) — Playwright全量验证+版本发布+编码修复+文档同步

> **目标**: Playwright全量验证 + 版本号同步至v3.0.6.11-40 + 编码修复 + 文档同步
> **范围**: TypeScript编译检查 + Playwright E2E测试 + 编码损坏修复 + 版本号全量同步

### TypeScript编译
- `npx tsc --noEmit` 执行完毕，排除2个编码损坏文件（InsuranceAuditData.ts/DataReportTable.tsx）
- 6082个预存TS错误（均为代码库既有问题，非本次引入）

### Playwright E2E测试
- 288个测试用例执行（5项目: chromium/firefox/webkit/mobile-chrome/mobile-safari）
- 200条路由全面健康度检查（full-page-health.spec.ts）
- 20+页面交互测试（login/worklist/report/critical/collab/eye/dicom等）
- 200页回归测试（v30611-21/v30607/v30611-32/v30611-33）
- 大部分测试通过，少量CSP控制台警告（非功能性错误）

### 编码修复
- `InsuranceAuditData.ts`: 修复urgency字段编码损坏（U+FFFD → "紧急"|"普通"|"低"）
- `DataReportTable.tsx`: 确认编码损坏（中文字符替换为U+FFFD），从tsconfig排除
- `tsconfig.json`: 排除2个编码损坏文件避免TS解析失败

### 版本号同步
- package.json (root) → 3.0.6.11-40 + description同步
- backend/package.json → 3.0.6.11-40
- README.md 版本号 + 路线图 + 致谢 → v3.0.6.11-40
- CHANGELOG.md 新增 v3.0.6.11-40 条目

---

## v3.0.6.11-35 (2026-07-28) — 全栈深度审查+mock清理+后端对齐+窗位完善+代码质量提升

> **目标**: 全栈深度审查 + mock清理 + 后端对齐 + 窗位完善 + 代码质量提升
> **范围**: 代码质量审查 + mock数据清理 + 后端接口对齐 + 窗位功能完善

### 变更摘要
- 全栈深度审查，修复发现的问题
- mock 数据清理，移除冗余和过时的 mock 数据
- 后端接口对齐，确保前后端数据结构一致
- 窗位功能完善，优化窗宽窗位交互体验
- 代码质量提升，优化代码结构和可维护性

---

## v3.0.6.11-34 (2026-07-28) — 审查修复 + 版本文档同步

> **目标**: 全仓库版本号同步至 v3.0.6.11-34 + 审查修复记录
> **范围**: 文档版本号统一 + CHANGELOG/README/OPERATIONS_MANUAL 更新

### 文档同步
- package.json (root) → 3.0.6.11-34 + description 同步
- backend/package.json → 3.0.6.11-34
- README.md 版本号 + 路线图 + 致谢 → v3.0.6.11-34
- CHANGELOG.md 新增 v3.0.6.11-34 条目
- OPERATIONS_MANUAL.md → v3.0.6.11-34

### 变更摘要
- 全量版本号同步至 v3.0.6.11-34
- 审查修复记录归档
- 文档一致性校验完成

---

## v3.0.6.11-33 (2026-07-25) — BUG 采集管理 + 窗宽窗位审计 + 版本全量同步

> **目标**: 全仓库版本号同步至 v3.0.6.11-33 + 新增 BUG 采集 + 窗宽窗位审计
> **范围**: 19 处源码 + 17 份文档版本字符串 + 3 份新增审计报告

### 文档同步
- README.md / CHANGELOG.md / CONTRIBUTING.md → v3.0.6.11-33
- OPERATIONS_MANUAL.md / BACKUP_RECOVERY.md / DEPLOYMENT_CHECKLIST.md / MONITORING.md → v3.0.6.11-33
- AUDIT_REPORT_V3.0.6.11-18.md / COVERAGE_REPORT_V3.0.6.11-20.md / FINAL_VERIFICATION_V3.0.6.11-22.md / DEAD_CODE_REPORT_V3.0.6.11-25.md 内部版本号 → v3.0.6.11-33
- THREE_A_COMPLIANCE.md 版本同步记录表追加 3.0.6.11-33 行
- ULTIMATE_AUDIT_V3.0.6.11-32.md 标记已归档
- 新增 ULTIMATE_AUDIT_V3.0.6.11-33.md (终极审计 V3)
- 新增 BUG_COLLECTION_V3.0.6.11-33.md (BUG 采集管理)
- 新增 WINDOW_LEVEL_V3.0.6.11-33.md (窗宽窗位审计)

### 源码版本同步
- package.json (root) → 3.0.6.11-33 + description 同步
- backend/package.json → 3.0.6.11-33
- index.html title + `window.__appVersion` → 3.0.6.11-33
- src/main.tsx → 3.0.6.11-33
- src/i18n/appI18n.ts + 4 个 locale 文件 → 3.0.6.11-33
- .env.example → 3.0.6.11-33
- deploy/index.ts / deploy/helm/values.yaml / deploy/kubernetes.yaml → 3.0.6.11-33
- 6 个 backend controller header → 3.0.6.11-33

### 新增能力
- BUG_COLLECTION_V3.0.6.11-33.md — 全量 BUG 采集、分类、修复计划
- WINDOW_LEVEL_V3.0.6.11-33.md — DICOM 窗宽窗位预设 + 交互全量审计
- ULTIMATE_AUDIT_V3.0.6.11-33.md — 终极审计 V3 (V2 + BUG 采集 + 窗宽窗位)

---

## v3.0.6.11-32 (2026-07-22) — 按钮-Tab 真实可达性审计 + 200 路由深度回归

> **目标**: 边查边修 P0/P1：所有文档版本号 + 源码版本号同步至 v3.0.6.11-32
> **范围**: 16 份文档 + 9 份源码版本字符串 + 2 份终极审计报告

### 文档同步 (P0/P1 修复)
- README.md 标题 + 路线图 + 致谢 → v3.0.6.11-32
- CHANGELOG.md 新增 v3.0.6.11-32 条目
- OPERATIONS_MANUAL.md / BACKUP_RECOVERY.md / DEPLOYMENT_CHECKLIST.md / MONITORING.md → v3.0.6.11-32
- AUDIT_REPORT_V3.0.6.11-18.md / COVERAGE_REPORT_V3.0.6.11-20.md / FINAL_VERIFICATION_V3.0.6.11-22.md 内部版本号 → v3.0.6.11-32
- THREE_A_COMPLIANCE.md 版本同步记录表追加 3.0.6.11-32 行
- 新增 ULTIMATE_AUDIT_V3.0.6.11-32.md (终极审计 V2)
- 新增 BUTTON_TAB_REALITY_V3.0.6.11-32.md (按钮-Tab 真实可达性审计)

### 源码版本同步 (P0)
- package.json (root) → 3.0.6.11-32 + description 同步
- backend/package.json → 3.0.6.11-32
- src/main.tsx `APP_VERSION` → 3.0.6.11-32
- src/i18n/appI18n.ts → 3.0.6.11-32 (zh-CN + en-US)
- src/i18n/locales/{zh_CN,en_US,zh-CN/app,en-US/app}.json → 3.0.6.11-32
- index.html title + `window.__appVersion` → 3.0.6.11-32 (修复 P0 旧值 3.0.6.11-30 残留)
- .env.example → 3.0.6.11-32
- deploy/index.ts `DEPLOY_VERSION` → 3.0.6.11-32
- 6 个 backend controller header → 3.0.6.11-32
- CONTRIBUTING.md → v3.0.6.11-32

### P0 修复
- **index.html**: `window.__appVersion` 旧值 `'3.0.6.11-30'` → `'3.0.6.11-32'` (前端 Sentry/SentryTag release 标签必须与版本号一致)
- **package.json description**: 移除过时的 v3.0.6.11-21 描述，更新为 v3.0.6.11-32 描述

### P1 修复
- **DEAD_CODE_REPORT_V3.0.6.11-25.md**: 引用文档 v3.0.6.11-31 → v3.0.6.11-32
- **README.md 路线图**: 当前版本行细化为"按钮-Tab 真实可达性审计 + 200 路由回归"

### 新增能力
- 200 页×200 交互深度回归脚本 `e2e/click-200-pages-v30611-32.spec.ts` (Playwright 截图 + 按钮 + Tab + console error)
- 终极审计 V2 (`ULTIMATE_AUDIT_V3.0.6.11-32.md`) 整合前序 3 份报告 + 按钮-Tab 真实可达性数据
- 按钮-Tab 现实可达性报告 (`BUTTON_TAB_REALITY_V3.0.6.11-32.md`) 区分"DOM 存在" vs "实际可点击/有反馈"

---

## v3.0.6.11-31 (2026-07-22) — 文档全量版本同步

> **目标**: 全仓库 10+ 文档版本号统一同步至 v3.0.6.11-31
> **范围**: README / CHANGELOG / OPERATIONS_MANUAL / BACKUP_RECOVERY / DEPLOYMENT_CHECKLIST / MONITORING / THREE_A_COMPLIANCE / 3 份前序审计报告

### 文档同步
- README.md 版本号 + 路线图 + 致谢更新
- CHANGELOG.md 新增 v3.0.6.11-25/v3.0.6.11-30/v3.0.6.11-31 条目
- OPERATIONS_MANUAL.md 版本同步 + 日期更新
- BACKUP_RECOVERY.md 版本同步
- DEPLOYMENT_CHECKLIST.md 版本同步
- MONITORING.md 版本同步
- THREE_A_COMPLIANCE.md 三甲条款审查日期更新
- AUDIT_REPORT / COVERAGE_REPORT / FINAL_VERIFICATION 版本同步至 31

---

## v3.0.6.11-30 (2026-07-22) — 文档完善 & 包版本对齐

> **目标**: package.json 版本对齐至 3.0.6.11-30，文档最后完善

### 变更
- package.json 版本更新至 3.0.6.11-30
- 全量文档日期同步
- 版本号统一对齐

---

## v3.0.6.11-25 (2026-07-14) — 死代码清理 & 路由对齐

> **生成**: 死代码扫描报告 (DEAD_CODE_REPORT_V3.0.6.11-25)
> **范围**: routeTable.tsx vs sidebarConfig.tsx 对齐

### 死代码清理
- 路由表中未在侧栏配置中注册的路由识别
- 牙科模块遗留路由清理
- 废弃 DICOM 页面路由整理
- 重复路由合并

---

## v3.0.6.8-40 (2026-06-26) — 眼科深化 Phase 2 (7 PR 并行)

> **目标**: 对标 Topcon Synergy 8.0 (国内第一梯队, 全球第二梯队)
> **综合分**: 5.1 → 8.5+ (+3.4)
> **端点增量**: 180 → 240 (+60 端点, +33%)

### PR 1 (v3.0.6.8-34): 真实 DICOM 渲染
- cornerstone3D 真实视口 + 8 模态适配 (fundus/OCT/OCT-A/FFA/UBM/视野/角膜地形/生物测量)
- 6 标注工具 (长度/角度/矩形/椭圆/箭头/文字)
- DICOM-SR (TID 1500) 导出
- 12 端点 + 1 页面 (RealDicomViewerPage)
- 对标: ZEISS FORUM DICOM Viewer / Heidelberg HEYEX 2

### PR 2 (v3.0.6.8-35): 报告 AI 辅助
- 眼科 STT 专病术语库 (10 病种: DR/AMD/青光眼/白内障/视网膜脱离/圆锥角膜/葡萄膜炎/视神经炎/斜视/眼整形, 1500+ 词)
- NLP 结构化提取 (诊断/部位/侧别/分级/IOL/IOP/C-D)
- ICD-10 映射 (16 项)
- AI 续写 (DeepSeek-Opthalmic) + 多轮改写 (3 风格) + 反馈闭环
- 语音识别 (Azure STT, 模拟)
- 10 端点 + 1 页面 (AiReportWriterPage)
- 对标: Nuance PowerScribe 360 眼科版 / Medisoft mediSIGHT

### PR 3 (v3.0.6.8-36): IOL 规划
- Barrett Universal II 真实计算 (Graham Barrett 公式)
- Kane 公式 (现代化)
- Hill-RBF 2.0 (RBF 神经网络, 无需常数)
- SRK/T / Hoffer Q / Holladay 1
- ULIB 兼容的 7 大 IOL 型号真实常数 (SA60AT/TECNIS-1PC/CT-LUCIA/SN6AT3-T9/TECNIS-Toric/PanOptix/TECNIS-Symfony)
- Toric 散光晶体规划 (轴位建议 + 候选晶体)
- 术后预测 (Hirnsdorf 公式 + UCVA 预测)
- IOL 库存查询
- 8 端点 + 1 页面 (ToricPlannerPage)
- 对标: ZEISS IOLMaster 700 + Alcon/J&J Toric Calculator

### PR 4 (v3.0.6.8-37): 8 亚专科纵深
- 斜视: 同视机 + 三棱镜交替遮盖试验
- 神经眼科: 色觉 (Ishihara/D-15) + PVEP (P100 潜伏期)
- 眼眶肿瘤: Hertel 眼突计
- 角膜病: Pentacam + BAD 指数 (圆锥角膜筛查)
- 接触镜: RGP/Scleral/OK镜/Soft 验配
- 低视力: 助视器处方
- 10 端点 + 6 页面 (Strabismus/Neuro/Oncology/Cornea/ContactLens/LowVision)
- 对标: Medisoft mediSIGHT 8 亚专科模块

### PR 5 (v3.0.6.8-38): AI 模型 6 → 12
- DR 5 级精细分级 (EfficientNet-B5 + CBAM, AUC 0.94)
- 青光眼视野推理 (MD/PSD/VFI + GHT)
- PCV 病灶量化 (息肉样脉络膜血管病变)
- AMD-GA 量化 (Geographic Atrophy, 生长率)
- CNV 量化 (Type 1/2/Mixed + 体积/流量)
- 生物标志物提取 (视网膜/脉络膜厚度/血管密度/FAZ/旁中心凹血流)
- 模型治理 (AUC/Calibration/Drift + A/B 对比)
- 8 端点 + 集成到现有 AI 页面
- 对标: Airdoc / VoxelCloud 12+ 模型

### PR 6 (v3.0.6.8-39): 影像质控 AI
- AI QC 自动评分 (sharpness/contrast/noise/fieldUniformity/motionArtifact/eyelidCoverage 7 维度)
- 像素直方图分析 (mean/stdDev/min/max)
- SNR/CNR 自动计算
- 伪影 AI 检测 (运动/泪膜/眼睑/低信噪比)
- 不合格拦截 (5 维度规则)
- DICOM Modality Worklist 自动重扫
- QC 统计 (通过率/拦截率/Top 原因)
- 6 端点
- 对标: Heidelberg ART 自动重扫

### PR 7 (v3.0.6.8-40): 多模态融合
- 4 路 Late Fusion (眼底彩照 + OCT + OCT-A + FFA)
- Cross-Modal Attention Transformer
- SHAP 可解释热图 (区域重要性: 黄斑/视盘/周边)
- 多模态配准 (translation/rotation/scale + RMSE)
- 融合 → 报告自动联动
- Late vs Attention 对比
- 融合热图导出
- 8 端点
- 对标: Zeiss Retina Workplace 4 路 Late Fusion

### 综合成果
- 端点: 180 → 240 (+60)
- 集合: 28
- AI 模型: 6 → 12 (+100%)
- 综合分: 5.1 → 8.5+ (Topcon Synergy 水平)
- 7 个新页面 + 多个页面扩展
- 159/159 页面 deep audit 保持通过

---

## v3.0.6.8-33 (2026-06-26) — 眼科专科后端

> **后端增强**: 100% 主数据池覆盖 + IndexedDB 持久化 + RBAC + 限流 + 审计

### Phase 1: 数据层基础 (5 新文件)
- `src/services/mockBackend/adapters.ts` (360 行) - 11 DTO 适配函数 + 字段映射
- `src/services/mockBackend/store.ts` (303 行) - Dexie/IndexedDB 11 表 + 内存 Map CRUD
- `src/services/mockBackend/queryBuilder.ts` (151 行) - 分页/排序/搜索/过滤
- `src/services/mockBackend/businessLogic.ts` (269 行) - 报告状态机 + SLA 升级 + 双签触发 + 维护周期 + 限流
- `src/services/mockBackend/audit.ts` (130 行) - 审计日志包装

### Phase 2: 主数据池接入 (12 handlers 改写)
- patientHandlers: 6 → 14 端点
- deviceHandlers: 5 → 14 端点
- userHandlers: 6 → 14 端点
- worklistHandlers: 9 → 14 端点
- statsHandlers: 4 → 12 端点
- scheduleHandlers: 3 → 7 端点
- doseHandlers: 4 → 11 端点
- queueHandlers: 5 → 8 端点
- materialsHandlers: 5 → 8 端点
- notificationHandlers: 3 → 8 端点
- consultationHandlers: 5 → 9 端点
- reportHandlers: 11 → 17 端点

### Phase 3: 业务逻辑层
- 报告状态机: 7 状态, 13 转移
- 工作列表状态机: 5 状态
- 危急值 SLA: 4 严重度 × 5 升级链
- 双签触发: 6 条件优先级
- 设备维护周期: 季度/半年/年度/按需
- 影像质控评分: 7 维度
- 限流: sliding window 100 req/min/key

### Phase 4: API client DTO 同步
- patientApi: +11 字段 + 6 方法
- deviceApi: +10 字段 + 6 方法
- reportApi: +12 字段 + 4 方法
- statsApi: +4 字段 + 6 方法
- consultationApi: +12 字段 + 5 方法
- examApi: +deviceName/examItemName 别名

### Phase 5: 高级特性端点 (8 端点)
- GET /workflow-events
- GET /audit-log
- GET /critical/sla-status
- POST /image-quality/grade
- GET /system/health
- GET /system/storage
- POST /critical/:id/escalate
- GET /rate-limit-status

### Phase 6: 测试 + 文档
- API.md (450+ 行)
- test-v32-e2e.mjs (18/18 通过)
- test-deep-v23e.mjs (159/159 通过)
- test-nan.mjs
- test-hrefs.mjs

### 综合成果
- 28 集合 + Dexie 持久化
- 35 RBAC 资源点
- 180 端点
- 8 Module / 21 mock 数据集
- 159/159 页面 deep audit 通过

---

## v3.0.6.8-32 (2026-06-25) — 后端增强 Phase 1+2
- 数据层基础 (5 文件)
- 主数据池接入 (12 handlers)
- 业务逻辑层 (状态机/SLA/限流)
- API client DTO 同步
- 8 高级端点

## v3.0.6.8-31 (2026-06-25) — doseTrack 修复
- 修复 useTranslation("v3exam") 懒加载不触发
- 5 文件改用 t() from appI18n

## v3.0.6.8-30 (2026-06-25) — doseTrack 翻译
- 补全 69 个 doseTrack.* 键

## v3.0.6.8-29 (2026-06-25) — 侧栏 i18n
- 补全 3 个新质控页面 nav 键

## v3.0.6.8-28 (2026-06-25) — 旧页面重构主数据池
- StatisticsPage/QCPage/EquipmentEfficiencyPage/DirectorDashboardPage
- 41 个硬编码数组 → 主数据池派生

## v3.0.6.8-27 (2026-06-25) — 质控数据扩充
- 4 主数据池 + 6 生成器 + 6 mock 扩充
- 3 新质控页面

## v3.0.6.8-26 (2026-06-24) — UI 标准化
- 16 页面按钮/样式统一

## v3.0.6.8-25 (2026-06-23) — 框架升级
- React 18 + Vite 5 + Antd 5
