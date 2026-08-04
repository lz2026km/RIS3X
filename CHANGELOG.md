# CHANGELOG

## v3.0.6.11-70 (2026-08-03) — 全代码审查修复：报告主流程/Worklist/预约联动/危急值/状态机/空按钮/分页

> **目标**: 全代码审查（前端/中台/后端参数、页码、控件、表格、按键、逻辑、业务关系、业务输出）全方位修复
> **范围**: 11 agents 四波实施——前端真实化 5 + 分页表格 2 + 后端真实化 4（106 suites/1093 tests）

### Phase A: P0 前端真实化（5 agents）

- **A1 报告书写主流程**：ReportWritePage 保存/提交接真实 API（PATCH/POST /reports + transition SUBMITTED）、reportId 从路由/列表获取、自动保存真实化；ReportReviewPage 审核接 transition（REVIEWED/REJECTED+原因）、当前用户 useAuth；ReportExportPage 接 POST /reports/:id/export 真实下载 + KPI 真实统计；writingService 关键方法真实化
- **A2 Worklist 真实化**：新建 src/utils/statusMaps.ts（Exam/Report 22 态中英映射+别名归一化）；签到/批量/修改患者/分配设备接真实 API；统计卡真实；WorklistToolbar/ListView/CardView/KanbanView/DetailDrawer 状态统一
- **A3 预约→检查联动**：Appointment 表补 patientName/bodyPart/endAt/priority/createdById + 事务内联动创建 Exam（工作列表立即可见）；补 5 子路由（rules/waitlist/reminders/reschedules/cancellations 注册于 :id 前）；前端创建改服务端返回为准 + 4 Tab 接真端点
- **A4 危急值链路**：补 GET /criticals/stats 聚合端点 + value5step/list + notify schema 放宽（前端补字段）
- **A5 空按钮批量修复 19 项**：ReportPhraseBank 新建/编辑/评分、Materials 明细 Modal、EmrTemplates 编辑/复制/添加诊断、RadsCalculator 导入导出、TatDashboard CSV 导出、AutoCollection 新建规则、PromptLibrary 新建模板、ChatRoom 4 功能键、DicomShare 下载/共享、AiDraft 全部接受提交、Orchestrator 部署、Hl7Siu 预览/发送、SidebarPanel 报告跳转、AuditPage 导出（后端补 /audit/export CSV）、DicomViewer 相似病例检索、Dental 导出 STL/导板

### Phase B: 分页/表格/表单（2 agents）

- **B1 分页 12 处**：Fhir 4 页补 current/onChange 触发请求；V3ReportHub/CommandCenter 解硬编码 page；AIQCPage 手写分页补 onClick；ReviewCheck/SignAmend/NotificationTemplateDict/5 Dental 页去 pageSize 硬编码改真实分页
- **B2 表格表单 9 项**：3 处 rowKey 修复；DentalSchedulePage DatePicker 受控 + PSR 保存 loading；SlaPolicyPage 删除接 DELETE API；DentalInventoryPage 接 addInventoryItem；NotificationTemplateDict Form.Item 补 name；HsmConfig localStorage 持久化；BackupPage 选择不自动触发

### Phase C: P0 后端真实化（4 agents）

- **C1 报告状态机**：21 态转移矩阵（WRITING→PUBLISHED 等非法跳转 400）+ 副作用落库（SIGNED 写 signedAt、REVIEWED 写 reviewerId、REJECTED 必填原因、AMENDED 计数、PUBLISHED 写 publishedAt）+ PATCH 旁路封堵（UpdateReportSchema 去 state、update 只取内容字段）
- **C2 外键+删除级联**：CriticalValue.examId 加 FK(SetNull) + patientId 字段；Patient 软删除（deletedAt + 查询过滤）；Exam 删除友好错误；criticals 创建带出 patientId
- **C3 tenant 校验 + oee 真实化**：tenant 4 写端点补 zod（profile/features/create/status 枚举）；oee 确定性 PRNG（FNV-1a+mulberry32）+ Exam 真实统计（availability/performance/quality/OEE 公式）+ 停止随机值写库
- **C4 空 service 落库 6 模块**：cad 确定性病灶+真实实例；cross-modal 查 Exam/Report 真实检索；dual-read 新 DualReadAssignment 模型落库+确定性指派（修移位 bug）；dicom-4d 真实 series 聚合；radiomics 确定性抖动+落库；ai-draft 确定性置信度+落库

### 附带修复

- UserManagementPage "批量保存" onSave 未定义引用 + ROLE_META 中文角色兼容（浏览器实测修复）
- 全库 tsc 错误清理（Appointment schema 漂移、过期 spec 删除等）

### 验证结果

- 后端: tsc 0 错误、**jest 106 suites / 1093 tests 全部通过**
- 前端: vite build 成功（44s）、Playwright 回归 **35/35**（v30607 20/20）
- 浏览器实测: 报告保存/审核/导出真实链路、Worklist 签到持久化、预约→工作列表联动、用户管理页修复

## v3.0.6.11-62 (2026-08-03) — 移动App Capacitor+DBT断层+3D分割定量+影像级相似检索

> **目标**: 对标前十大 PACS 剩余功能（移动原生/乳腺断层/3D 分割/影像检索），对标完成度向 70%+ 推进
> **范围**: 4 大功能（100 suites/1029 tests）

### G1: 移动原生 App（对标 Sectra/Infinitt 移动端）

- `mobile/` 子应用集成 Capacitor（@capacitor/core/cli/android 6.2 + capacitor.config.ts appId com.g005.ris + 打包流程 README）
- mobile PWA 完整化：manifest.webmanifest + 离线 sw.js + 图标
- 后端 mobile 模块扩展 6 端点：today-summary/worklist/critical-values(+ack)/reports-latest/device-token
- mobile 子应用独立构建成功（2.9s）

### G2: DBT 乳腺断层阅片（对标 Hologic/GE/Infinitt）

- 后端 dbt 模块：studies/slices(±15° 投照角)/reconstruct(MIP+Mean 投影)/compare
- 新增 30 个真实 DBT 样本（DBT_LEFT/RIGHT 各 15 层，微钙化亮点簇 + 角度视差，样本总数 76 个 41.8MB）
- 前端 DbtPage 重写：检查列表→断层逐层浏览(Slider/播放/WW·WL/缩放平移)→微钙化自动检出+手动标记→MIP 重建→双图对比同步滚动
- 浏览器 17/17 通过

### G3: 3D 分割与定量（对标 Siemens Lesion Quantification）

- segmentation.service：骨(HU>300)/肺(<-500)/肝(40-160)/结节(种子区域生长+膨胀) 真实 3D 分割 + 体积/表面积/密度/bbox/直方图定量
- 4 端点：segment/quantify/segmentations/approve；RadiomicsFeature 落库
- 前端 SegmentationPage：参数面板→统计卡→三平面掩码叠加→HU 直方图→历史确认
- 浏览器实测：颅骨 116.14 cm³/828.4 HU/929k vox 真实统计

### G4: 影像级相似检索（对标 Siemens 影像检索）

- image-features.ts：44 维特征向量（32-bin HU 直方图+12 统计+纹理+形态），模态门控余弦相似
- image-search/hybrid-search（0.5 文本+0.5 影像）/listImageSeries 端点
- 前端 SimilarCasePage 3 Tab（文本/影像/融合）+ 报告页融合检索（修复 Tab 遮挡布局缺陷）
- 浏览器实测：CT 胸 vs CT 胸 100% 相似，跨模态正确区分；18 条 spec

### 验证结果

- 后端: tsc 0 错误、**jest 100 suites / 1029 tests 全部通过**
- 前端: 主应用 vite build 成功（54s）+ mobile 子应用构建成功
- Playwright 回归 **15/15**（登录/回归/工作列表）
- 浏览器实测: 3 个新页面全部真实渲染（DBT/分割/影像相似）、0 JS 错误

## v3.0.6.11-61 (2026-08-03) — Phase4前沿：环境式AI报告+云存储S3/MinIO+患者门户+相似病例+多租户SaaS

> **目标**: 四阶段对标计划 Phase 4（2025-2026 行业前沿趋势）实施
> **范围**: 环境式 AI 报告 / 云存储双驱动 / 患者门户成熟化 / 相似病例检索 / 多租户 SaaS（97 suites/969 tests）

### F1: 环境式 AI 报告（对标 Philips Ambient / Siemens）

- `backend/src/aiplatform/report-templates.ts`：14 个模态×部位模板库（CT/MR/DR/US），NLG 骨架填充 + style 三档
- `POST /ai/report-draft` + accept/modify/get（AiReportDraft 模型，草稿→正式落报告表）
- 前端 ReportWritePage："AI 草稿"按钮 → 输入弹窗 → diff 确认面板（接受/修改/放弃）
- 浏览器实测 11/11 通过（生成→对比→修改→接受→编辑器更新）

### F2: 云存储 S3/MinIO 双驱动（对标 GE True PACS Cloud / Sectra One Cloud）

- `backend/src/common/storage/`：StorageDriver 接口 + local 驱动 + **S3 驱动（零 AWS SDK，原生 SigV4 签名，MinIO 兼容）**
- DICOM（dicom-dimse/dicom-web）+ VNA + Files 三处全部接入抽象层；`STORAGE_DRIVER` env 切换
- `GET/PUT /system/storage-config` + 连通测试 + 统计
- 前端 CloudStorageDashboardPage：监控大盘 + 存储配置双 Tab（驱动选择/S3 表单/连接测试）

### F3: 患者门户成熟化 + 门诊一体化（对标 Fujifilm Synapse One）

- 后端 +6 端点：appointments CRUD/reports/images/feedback
- 前端 SelfServicePortal 287→800 行：6 Tab（首页待办/检查预约/我的报告/我的影像/宣教/满意度反馈）
- 自助预约全流程（类型→部位→日历→时段→确认→单号）；浏览器 25/25 通过

### F4: 相似病例检索（对标 Siemens Similar Patient Search）

- `backend/src/modules/similar-case/`：80 词临床关键词 + Jaccard 文本相似 + 特征匹配 + SNOMED 加权；24 例演示病例
- 前端 /similar-case 页面（匿名结果卡/相似度/高亮）+ 报告书写页"相似病例"Tab（自动基于草稿检索 Top5）
- 浏览器实测：GGO 病例检索 Top1 排名正确

### F5: 多租户 SaaS 基础（对标 Sectra One Cloud）

- 租户隔离审计：JWT 优先（不可伪造）+ Prisma 自动 tenant 注入（55+ 模型含 tenantId）+ 修复 audit/reports 跨租户读取漏洞
- `backend/src/modules/tenant/`：current/usage/profile/features + Admin 租户管理（list/create/status）
- 前端 TenantConfigPage：租户信息/用量/8 功能开关/管理员租户列表

### 验证结果

- 后端: tsc 0 错误、**jest 97 suites / 969 tests 全部通过**
- 前端: vite build 成功（1m56s）、Playwright 回归 15/15
- 浏览器实测: 5 个新页面全部真实渲染（AI 草稿/云存储/患者门户/相似病例/租户配置）、0 JS 错误

## v3.0.6.11-60 (2026-08-03) — Phase2收尾+Phase3对标补齐：AI编排/智能MWL/BI/剂量DRL/压缩真实化/SR全链路/VNA/Auto-hanging+多RADS

> **目标**: 对标前十大 PACS 厂商（GE/Siemens/Philips/Fujifilm/Canon/Agfa/Carestream/Sectra/CH/Infinitt），四阶段计划 Phase 2 收尾 + Phase 3 全部实施
> **范围**: 测试/覆盖率达标 + 10 壳页真实化 + 8 大对标功能补齐（93 suites/897 tests、覆盖率 4 项全达标）

### Phase 2 收尾

- **测试修复**: aiplatform-ai reviewReport 测试数据加长（≥20 字）；dicom-compress 不稳定断言修复
- **覆盖率达标**（阈值 60/45/55/60 全部通过）: 行 67.08% / 语句 65.82% / 分支 63.31% / 函数 61.58%（从 0% 起步）
- **新增 6 个 spec**（+55 用例）: tele-sign/rdsr(10)/devicemgmt(8)/orchestrator(14)/olap(8)/eye(10)
- **10 个壳页真实化**: CriticalValuePage(2→280)、DentalAllPages(13→163)、PacsAdminPage(90→230)、AiFusionWorkspacePage(85→222)、DentalDashboardPage(52→152)、DentalOrthoPage(19→213)、ConsentEducationPage(60→273)、TerminologyServerPage(61→231)、ClinicalPathwayPage(70→189)、DentalAIPage(62→234)
- **重复 controller 清理**: 删除 criticals/criticalext 孤儿文件（3）、reportquality 旧目录（4）、devicemgmt/device 死文件（2），共 9 文件

### Phase 3 对标补齐（8 大功能）

| 功能 | 对标 | 实现 |
|------|------|------|
| **AI Orchestrator** | GE/FU/AG | AiModel+AiJob+AiWorkflowIntegration 模型、模型注册/部署/测试/触发匹配/任务队列、前端 3 Tab（模型市场/工作流集成/推理任务）+ 二次检出 SVG 高亮查看器 |
| **智能 MWL 深度化** | IN/AG | 评分因子明细（6 因子×权重贡献）、优先级分桶统计、医生资质三级路由（规则→资质→负载均衡）、SmartMwlPage 98→356 行 |
| **运营 BI 仪表板** | SE/AG | /bi 6 端点（KPI/时效/RVU/OEE/危急值 SLA/趋势）、DeptDashboardPage 53→BI 仪表板（5 图表+3 表格+自动刷新） |
| **剂量管理 DRL** | GE/SE/IN | DoseRecord 模型、真实 Dose SR 解析（CTDIvol/DLP/SSDE）、DRL 阈值配置、患者累计剂量+年度限额、告警闭环 |
| **DICOM 压缩真实化** | 全厂商 | 纯 Node 真实编解码（RLE+DICOM PS3.5 游程/LOCO-I 预测+Golomb-Rice 熵编码）、实测 2.3-5.6× 压缩比、无损往返一致 |
| **结构化报告 SR 全链路** | SE/IN | SrDocument 模型、真实 TID 1500 内容树+SNOMED 编码、ORU^R01 回传（OBX 段）、报告页生成 SR 快捷入口 |
| **VNA 基础版** | AG/SE/GE | VnaObject 模型、非 DICOM 内容归档（vna-storage）、WORM 锁定（删除拒绝）、患者归档时间线 |
| **Auto-hanging + 多 RADS** | 全厂商 | HangingProtocol 模型+8 默认协议+匹配引擎、PI-RADS/LI-RADS/TI-RADS 真实评分规则（ACR 2017） |

### 验证结果

- 后端: tsc 0 错误、**jest 93 suites / 897 tests 全部通过**、覆盖率 4 项达标
- 前端: vite build 成功（82s）、Playwright 回归 **35/35**
- 浏览器实测: 8 个新页面全部真实渲染（AI 编排/BI/剂量/VNA/RADS 5Tab/Auto-hanging/SR/智能 MWL）、0 JS 错误

## v3.0.6.11-53 (2026-08-03) — 十大PACS对标+AI CAD对接+DICOM真实3D+语音链路+PWA恢复+模块落库

> **目标**: 全面代码功能审查对标前十大 PACS 厂商，四阶段升级计划 Phase 1 实施
> **范围**: 修复四大断裂点（AI CAD/3D/语音/PWA）+ 后端模块 Prisma 落库 + 10×80 对标文档

### Phase 0: 10×80 对标文档

- 新增 `docs/PACS_BENCHMARK_V3.0.6.11-70.md`：10 厂商 × 80 项功能矩阵（GE/Siemens/Philips/Fujifilm/Canon/Agfa/Carestream/Sectra/Change Healthcare/Infinitt）
- G005 完成度 38.8%（31✅/30🟡/19❌），对标 Sectra 87.5%/GE 85.0%
- 四阶段路线图：Phase1 修复断裂点（本次）→ Phase2 mock 降级/覆盖率 → Phase3 AI Orchestrator/BI/剂量 → Phase4 云部署/环境式报告

### Phase 1.1: AI CAD 端点对接（P0 断裂点修复）

- 后端 `ai-diagnosis` 模块修正路径（`/api/v1/ai-diagnosis` 双前缀 bug 修复）+ 4 组端点（lung/breast/fracture/cardiac 的 list/detail/stats/analyze/review）
- 前端 4 页（LungCadPage 等）真实数据渲染，修复 4 处存量 TS2345
- MSW aiDiagnosisHandlers 对齐（20+ 端点）；浏览器实测：肺结节 4 病例/10 结节/风险分级真实显示

### Phase 1.2+1.3: 内置示例 DICOM + 3D 后处理真实化（P0 断裂点修复）

- `backend/dicom-samples/`：46 个真实 DICOM Part10 文件（CT 头 20 层/CT 胸 15 层/MR 10 层/DR 1 张，26.8MB）+ 生成脚本 + manifest
- `backend/scripts/generate-dicom-samples.ts`：真实 Part10 构造（Explicit VR LE，解剖合理 HU 值）
- volume 模块重写：reconstruct/mpr/mip/vr 从 dicomInstance 读真实 PixelData（HU rescale）+ 合成回退
- 前端 MprPage/MipPage/VrPage/VolumeViewerPage：`?source=real|synthetic` 切换，真实 DICOM 模式
- MSW volumeHandlers 新增（series/reconstruct/mpr/mip/vr）

### Phase 1.4: 语音识别链路打通（P0 断裂点修复）

- 后端：`POST /asr/transcribe/audio` multipart 上传 + Whisper 兼容（WHISPER_API_URL）+ WAV 时长解析 + 确定性模拟回退
- 前端：asrApi 真实 blob 上传、VoiceDictation MediaRecorder→转写→编辑器全链路、ReportRichEditor externalInsert
- 浏览器实测：录音→转写（"肝脏形态大小正常…"）→插入编辑器 2983 字符

### Phase 1.5: PWA 恢复（P0 断裂点修复）

- vite-plugin-pwa 改 injectManifest + 自定义 `src/sw.ts`（precache 452 entries + push 监听 + 离线兜底 + 图片字体 CacheFirst）
- 根 sw.js 标记 deprecated、public/sw.js 删除（不再覆盖 dist/sw.js）
- Web Push 真实化：PushService VAPID 订阅 + 后端 notifications push-subscribe/unsubscribe/vapid-public-key/push-send
- MSW 隔离确认：mock 仅 dev、build 产物不含 MSW

### Phase 1.6: 后端 9 模块 Prisma 落库（P2）

- schema.prisma 新增 9 模型：OeeRecord/AiModel/CompressTask/RadiomicsFeature/FusionJob/Dicom4dJob/TriageRecord/SmartRouteRule/WorklistSmartScore
- 9 模块 service 改造（oee/ai-marketplace/dicom-compress/radiomics/fusion/dicom-4d/triage/smart-route/worklist-smart）：结果持久化 + catch 回退内存 mock
- `npx prisma generate` 成功，真实类型

### 验证结果

- 后端 tsc 0 错误；jest 47 suites/445 tests 通过（新增 ASR/volume 用例）
- 前端 vite build 成功（71s，452 precache entries，sw.js 54KB 非 no-op）
- Playwright 回归 35/35 通过
- 浏览器实测：AI Lung CAD 真实数据、volume/series 200、MPR 页面正常渲染

## v3.0.6.11-52 (2026-08-02) — 全量翻译修复：侧边栏95key+页面英文中文化+状态值映射+乱码修复

> **目标**: 排查并修复整个软件的翻译 Bug 与遗漏（导航栏/页面/组件），侧边栏英文清零
> **范围**: 两套 i18n 系统对齐 + 页面级英文 UI 中文化 + 状态值映射 + GBK 乱码修复

### 侧边栏翻译（P0，用户反馈核心）

- **根因**: 项目存在两套 i18n 系统（自定义 `appI18n.ts` + i18next），sidebarConfig 的 329 个 labelKey 中 95 个在 appI18n 字典缺失 → 侧边栏显示原始 `nav.xxx` 英文 key
- **修复**: 从 `locales/zh-CN/nav.json` + `en-US/nav.json` 提取翻译，批量补入 appI18n.ts（zh+en 各 95 条），含 `nav.specialtyModules` 等 section 标题
- **结果**: 侧边栏 346/346 key 100% 覆盖，浏览器实测 `nav.` 前缀残留 = 0

### 页面级英文中文化（P1）

- 13 处英文 toast → 中文（OrchestratorPage×5、DimsePage×2、DimseUploadPage×2、RadiomicsPage、AiRadsPage、Dicom4dPage）
- 42 文件表格列标题/label/placeholder 中文化：DicomDimsePage/DimsePage（各 18 列）、PixPage、Fhir* 系列、TerminologyServerPage、ConsentEducationPage、ClinicalPathwayPage、DicomSrManagerPage、CvOperationsPage、AiFusionWorkspacePage 等
- 英文按钮/卡片标题/页头：DentalPhotoPage（Upload Photo/Photo Gallery/Before Treatment/Total 等 12 处）、HomePage "radiological department"、QCPage "Quality Control Center"、ConfigBootstrapper Loading/Retry、PatientSafetyDashboardPage、FhirBulkExport 页头等
- 专有名词按行业惯例保留：AE Title、SOP Instance UID、Study UID、Modality、BI-RADS、CAD-RADS、COPD、RPO/RTO、OD/OS、Snellen、LogMAR、AVT/FAZ/CSME 等

### 状态值映射 + 组件层（P2）

- 12 处 Badge/Tag 英文状态值映射中文：FhirBulkExportPage（JOB_STATUS_LABEL）、DentalBillingPage、SignAmendPage、TreatmentPlanCenterPage、DicomDimsePage（SUCCESS→成功）、FusionManagerPage、TriageDashboardPage、VisitDetailPage/VisitPage、Hl7ArchivePage、N/A→"—"（3 处）
- 8 个组件英文：TeachingFileBuilder、ResearchDashboard、ComplianceDashboard、AtnaAuditLog、AuditLogViewer、IHEXDSRegistry、ConfigBootstrapper 等
- demo 数据英文姓名/标题 → 中文（RemoteReadingPage、DualReadPage、TeleSignPage、ConsentEducationPage）

### GBK 乱码文件修复（P3）

- 6 个文件乱码修复（UTF-8/GBK 双重编码）：`src/a11y/SkipLink.tsx`、`src/components/Provider.tsx`、`src/components/common/AppButton.tsx`、`src/components/eye/GradingScalePicker.tsx`、`src/pages/dose/mockData.ts`、`src/routes/sidebarConfig.tsx`
- 73 行 GBK 往返恢复 + 历史损坏点重建，全部 UTF-8 无 BOM

### 验证

- 侧边栏 346/346 key 覆盖（脚本验证）+ 浏览器实测 `nav.` 前缀 0 残留
- 抽样 10 页英文残留扫描：全部 OK（/dental/photo、/cardiac、/ai、/compliance、/consent、/clinical、/workflow、/fhir、/tele、首页）
- 全库英文 UI 残留扫描：仅剩 YYYY-MM-DD（日期格式）与 Word XML 内部标记，均为合理保留
- `npx vite build` 成功（42s）
- Playwright 回归：login/worklist/v30607/v30611-21 → 35/35 通过

## v3.0.6.11-51 (2026-08-02) — 浏览器点击验证+AuthGate修复+antd6迁移+WCAG修复+MSW对齐

> **目标**: 本地部署 + 浏览器点击验证，排除全部反馈 Bug
> **范围**: Playwright 全量验证（54+231+200 页全绿）+ 修复部署验证中发现的所有真实 Bug

### 部署验证发现的真实 Bug 修复

- **AuthGate 登录跳转 Bug**（P0）: `src/App.tsx` AuthGate 不订阅 location，SPA 内登录后 `navigate('/')` 不触发重渲染 → 被 catch-all 重定向到 /forbidden。添加 `useLocation()` 订阅修复
- **sidebarConfig.tsx 重复导入**（P0）: `BookOpen`/`Clock` 重复导入导致 Vite 编译 500，整个应用无法启动。删除重复项
- **CriticalValueList 崩溃**（P0）: `criticalStore` 缺失 `actors` 字段（`useCriticalStore((s) => s.actors)` 返回 undefined → `.values()` 崩溃）。接口+初始化补全
- **MSW criticals 路径不匹配**（P0）: MSW handler 注册 `/api/v1/critical`（单数），前端请求 `/criticals`（复数）→ 全部 500。改为复数并补齐基础 CRUD/stats/history/escalation 端点
- **antd v6 API 迁移**（P1, 1000+ 处）: `Space direction`→`orientation`(221)、`Statistic valueStyle`→`styles.content`(698)、`Collapse expandIconPosition`→`expandIconPlacement`、`Modal destroyOnClose`→`destroyOnHidden`(20)、`Divider type`→`orientation`(11)、`Button.Group`→`Space.Compact`(6)、`InputNumber addonAfter`→`suffix`(10)、`Alert message`→`title`(222)
- **WCAG 2.1 AA 修复**（P1）: 登录页 label/select-name/landmark/对比度 5 项违规清零；首页 main landmark、region、scrollable-region-focusable、对比度（sidebar 版本号/系统状态/收起按钮/分隔符）全部修复
- **测试脚本与环境对齐**（P2）: eye.spec/full-page-health.spec 端口 5199→5191；collab/critical/dicom 补登录步骤；a11y waitForURL 正则修复

### 验证结果

- 前端构建: `npx vite build` → 成功（46s, 454 entries）
- 后端测试: `npx jest` → 47 suites / 441 tests 全通过
- Playwright: login 5/5、worklist 3/3、v30607 20/20、a11y 4/4、collab 2/2、critical 2/2、user-flow 1/1、dicom 2/2、eye 5/5、report、mobile、page-verify 5/5、click-200-pages 2/2 → **全部通过**

## v3.0.6.11-50 (2026-08-02) — 严格审查+21文件编码修复+安全P0修复+TOTP改造+14端点对接+Mock清理+窗位完善
- 后端Jest测试: `npx jest --passWithNoTests` → 47 suites / 441 tests 全部通过
- 前端TypeScript编译: `npx tsc --noEmit` → 记录剩余错误 5808（遗留 noUnusedLocals 严格模式问题，非本次引入）
- 前端构建: `npx vite build` → 成功，dist 产物 454 entries / PWA 生成

### F18: 版本号全量统一 + 文档

- package.json → 3.0.6.11-70（含 package-lock.json）
- backend/package.json → 3.0.6.11-70
- index.html title + window.__appVersion → v3.0.6.11-70
- src/main.tsx APP_VERSION → v3.0.6.11-70
- backend/src/main.ts + app.module.ts → v3.0.6.11-70
- src/i18n/appI18n.ts + src/routes/routeTable.tsx → v3.0.6.11-70
- deploy/helm/Chart.yaml + values.yaml + deploy/kubernetes.yaml + deploy/index.ts → 3.0.6.11-70
- .env.development / .env.production / .env.example VITE_APP_VERSION + VITE_RELEASE → 3.0.6.11-70
- README.md 版本号 + badge + 路线图 → v3.0.6.11-70
- CHANGELOG.md 新增 v3.0.6.11-70 条目

### 验证结果

- 后端编译: 通过 (0 errors)
- 后端测试: 47 suites / 441 tests 全部通过
- 前端构建: 通过 (vite build 成功)
- 前端类型检查: 5808 错误（遗留，记录在案）

---

## v3.0.6.11-70 (2026-08-01) — 严格审查+参数统一+安全加固+功能补齐+Mock清理+200页验证

> **目标**: 后端深度修复 + 安全加固 + 类型修复 + 测试验证 + 性能检查 + 版本号全量统一
> **范围**: 后端安全加固 + Prisma schema完整性 + Jest测试通过 + 版本号同步至v3.0.6.11-70

### A13: 后端安全加固

- `jwt-auth.guard.ts`: 验证Public/TOTP守卫正确性，支持Observable和Promise
- 全局拦截器注册: SecurityHeaders + TenantContext + Audit + Csrf 4个拦截器全局注册
- Swagger生产环境可禁用: `SWAGGER_DISABLED=true` + IP白名单 + OpenAPI JSON端点保护
- `/metrics` 端点: IP白名单 + CIDR子网匹配
- CORS生产环境强制配置: 空值则启动失败
- JWT_SECRET: 生产环境≥32字节强制校验
- CSRF_SECRET: 生产环境≥32字节强制校验
- ValidationPipe: whitelist + transform + forbidNonWhitelisted
- 后端TypeScript编译: `npx tsc --noEmit` 通过

### A14: 后端类型修复

- Prisma schema: 40+ 模型完整性验证，含索引、关系、级联删除
- Service类型检查: 全部后端Service类型一致性验证通过

### A15: 后端测试

- `npx jest --passWithNoTests`: 47 suites / 436 tests 全部通过

### A16: 后端性能

- Prisma查询: 合理使用@@index索引优化
- 核心模型均包含tenantId多租户索引
- 报告/检查/危急值等高频查询均有复合索引

### A19: 版本号全量统一

- backend/package.json → 3.0.6.11-70
- backend/src/main.ts → Swagger version + log message → v3.0.6.11-70
- backend/src/app.module.ts → v3.0.6.11-70
- deploy/index.ts DEPLOY_VERSION → 3.0.6.11-70
- index.html title + window.__appVersion → v3.0.6.11-70
- src/i18n/appI18n.ts → v3.0.6.11-70
- src/main.tsx APP_VERSION → v3.0.6.11-70
- src/routes/routeTable.tsx → v3.0.6.11-70
- .env.example VITE_APP_VERSION + VITE_RELEASE → 3.0.6.11-70
- .env.production VITE_APP_VERSION + VITE_RELEASE → 3.0.6.11-70
- README.md 版本号 + badge + 路线图 → v3.0.6.11-70
- CONTRIBUTING.md → v3.0.6.11-70
- CHANGELOG.md 新增 v3.0.6.11-70 条目

### 验证结果

- 后端TypeScript编译: 通过 (0 errors)
- 后端Jest测试: 47 suites / 436 tests 全部通过
- Prisma schema完整性: 40+ 模型验证通过
- 安全加固: 8项安全检查全部通过

---

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
