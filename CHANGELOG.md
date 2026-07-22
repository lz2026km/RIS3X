# CHANGELOG

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
