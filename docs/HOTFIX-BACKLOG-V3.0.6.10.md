# G005-RIS v3.0.6.10 — 可落地 Hotfix Backlog (去重版)

> **范围声明**:本文档**不重复**已有 backlog / 调研 / 厂商 PRD 中已列项,只补**当前项目状态可立即落地**的事项,并按 P0/P1/P2 + 模块归类。
> 已存在的相关文档(本轮不重做):
>
> | 已有 | 覆盖 | 来源 |
> |---|---|---|
> | `docs/v3.0.1-COMPARISON.md` §6.2 | 5 项 v3.2+ 差距(国密/字段级 SM4/HL7/Orthanc/实时音视频) | 6 维度对标结论 |
> | `docs/v3.0.6.1/v3.0.6.1-B[1-8]-*.md` | 8 家厂商 300 升级点 × N | 厂商 PRD |
> | `docs/放射RIS竞品深度调研-20260501.md` §2.2 | P0 8 项 / P1 8 项 / P2 4 项 | 调研 |
> | `docs/REPORT_SYSTEM_PLAN.md` | 报告 8 phase 升级 (R0-R8) | 报告域 |
> | `REVIEW.md` PHASE 3-6 | i18n / page-crash / defensive UI 已交付 | 历史 |
>
> **本文档新增**:
> - v3.0.6.10-1 之后的 P0 12 项(可立即落地的)
> - P1 18 项(v3.0.7 路线)
> - P2 12 项(v3.0.8+ 路线)
> - 每项带:**G5 现状 / 行动 / 验收 / 估时 / 涉及文件**
>
> **生成日期**:2026-07-03 | **基线**:G5 v3.0.6.10-1

---

## 0. 已有 backlog 一览(去重时不要重复)

| 文档 | P0 数 | P1 数 | P2 数 | 与本表关系 |
|---|---|---|---|---|
| v3.0.1-COMPARISON §6.2 关键差距 | 5 | — | — | 本表 P0-6 / P0-8 覆盖 |
| 调研-20260501 §2.2 | 8 | 8 | 4 | 本表 P0-3 / P0-7 / P1-7 等覆盖 |
| 厂商 PRD B1-B8 | — | — | — | 单独跟踪,本表不收 |
| REPORT_SYSTEM_PLAN | — | — | — | 报告 8 phase 单独跟踪 |
| REVIEW.md PHASE 3-6 | — | — | — | 已交付,仅 reference |

> **本表共 42 项**(P0 12 / P1 18 / P2 12),每项都是**当前未实现且本轮可立即动**的状态。

---

## 1. P0 — 核心缺失 (12 项,v3.0.7 必交付)

> 入选条件:法律法规硬性 / 客户招标必问 / 严重缺失使产品无法演示

### P0-1 互联互通总线 HL7 v2.x 双向监听

- **背景**:调研-20260501 缺失, v3.0.1 §6.2 已列 HL7 全双工为 v3.2+ 计划
- **G5 现状**:`src/services/integration/hl7-stub.ts` 仅生成 5 条样例消息,无真实监听
- **行动**:
  1. 新增 `src/server/hl7/listener.ts` (Node.js net.MLLP 监听 2575 端口)
  2. ORM 入站 → 自动创建 worklist 行
  3. ORU 出站 → 报告签发时 POST 到上游 EHR (URL 配置化)
  4. ADT 入站 → 患者主索引更新
- **验收**:`npm run hl7:simulate` 双向联通通过;`netstat -an | find 2575` LISTENING
- **估时**:3 周 (1 后端 + 1 联调 + 1 测试)
- **涉及**:`src/server/hl7/`、`src/services/integration/`、`MSW handlers`

### P0-2 VNA / 分层存储 (热-温-冷)

- **背景**:7+ 年保留的医院会爆盘;D7 / D12 完全缺
- **G5 现状**:所有 DICOM 走 IndexedDB mock,无分层
- **行动**:
  1. `src/services/vna/storageTier.ts` — 3 层 (Hot IndexedDB 90d / Warm OPFS 1y / Cold IndexedDB 7y)
  2. `src/services/vna/migrationPolicy.ts` — LRU 自动降级
  3. `src/pages/admin/VnaManagement.tsx` — 容量监控 + 手动迁移
- **验收**:在 dev tools 模拟 200 例 DICOM,90 天后自动从 Hot 迁到 Warm;Storage 大小可视化
- **估时**:3 周
- **涉及**:`src/services/vna/` (新)

### P0-3 AI 报告辅助 (典型所见/结论)

- **背景**:调研-20260501 P0-1 已列,目前为 stub
- **G5 现状**:`src/data/aiReportMock.ts` 12 条样例
- **行动**:
  1. 扩充到 **50 个检查类型 × 200 典型所见** (按部位/疾病分类)
  2. `src/services/ai/reportAssistant.ts` 基于检查类型 + 历史模板的关键词推荐
  3. 报告编辑器加 **AI 续写侧栏** (现仅编辑器 inline,有缺口)
- **验收**:写「胸部 CT 平扫」检查时,所见栏自动出 ≥ 5 条候选,点击插入
- **估时**:2 周
- **涉及**:`src/data/aiReportMock.ts` (扩展)、`src/pages/report/ReportWritePage.tsx`

### P0-4 DICOM SR TID 1500 结构化报告

- **背景**:互联互通 4 级硬性要求;v3.0.1 §10 DICOM 域未列
- **G5 现状**:报告 → PDF/A-1,无 SR
- **行动**:
  1. 引入 `dicom-parser` + 自写 SR builder (~5KB)
  2. `src/services/dicom/srBuilder.ts` TID 1500 (胸部 X 线) + TID 2000 (基础)
  3. 报告编辑器侧栏加「导出为 DICOM SR」按钮
- **验收**:点击导出 → 生成 `.dcm` 文件 → 用 MicroDicom 打开字段对应
- **估时**:2 周
- **涉及**:`src/services/dicom/srBuilder.ts` (新)

### P0-5 设备清单 (DICOM Modality Worklist 服务端)

- **背景**:D5 缺 MWL;P0-2 调研-20260501 没列
- **G5 现状**:设备数据静态,无 DICOM C-FIND 监听
- **行动**:
  1. `src/server/dicom/mwl.ts` (Node.js dcmtk 绑定) C-FIND 监听 11112
  2. `src/services/devices/mwlProvider.ts` 把 worklist 翻译为 DICOM dataset
  3. 设备页加「DICOM 节点」Tab
- **验收**:`dcmsend` 工具 C-FIND 查询,返回 worklist 项
- **估时**:4 周
- **涉及**:`src/server/dicom/` (新)

### P0-6 FHIR R4 ImagingStudy / DiagnosticReport 资源

- **背景**:互联互通 4 级 + Epic 集成硬性
- **G5 现状**:无 FHIR
- **行动**:
  1. `src/server/fhir/server.ts` (使用 `fhir.js` ~80KB) 暴露 REST 端点
  2. `GET /fhir/ImagingStudy?patient=...` (返回 G5 检查)
  3. `GET /fhir/DiagnosticReport?study=...` (返回 G5 报告)
  4. `POST /fhir/Bundle` (批量提交)
- **验收**:`curl http://localhost:5191/fhir/ImagingStudy?patient=P001` 返回有效 FHIR JSON,通过 `fhir-validator` 校验
- **估时**:4 周
- **涉及**:`src/server/fhir/` (新)

### P0-7 AI 模型治理中心 (AI Registry)

- **背景**:D1;调研 P0-2 / P0-3 AI 影像质控 同源
- **G5 现状**:`src/data/eyeAiMock.ts` 5 厂 12 模态硬编码
- **行动**:
  1. `src/config/clinicalConfig/modules/aiModels.json` (替换 mock,做配置化)
  2. `src/pages/admin/AiModelRegistry.tsx` AI 模型 CRUD (超管可见)
  3. `src/services/ai/orchestrator.ts` 决策可追溯日志 (写入 `ai_audit_log`)
  4. 失败回退:AI 超时 5s → 降级为人工
- **验收**:超管在 admin UI 改 AI 模型 approval,工作列表上 AI 徽章实时变;AI 决策日志可查
- **估时**:4 周
- **涉及**:`src/config/clinicalConfig/` (新)、`src/pages/admin/AiModelRegistry.tsx` (新)

### P0-8 国密 CA (SM2/SM3/SM4) 实装

- **背景**:v3.0.1 §6.2 列为 v3.2+ 计划,法规合规硬性
- **G5 现状**:`src/security/crypto.ts` 仅 SHA-256 stub
- **行动**:
  1. 引入 `@noble/sm-crypto` (~30KB,纯 JS,无需 native)
  2. SM2 签名 / 验签(报告签发)
  3. SM3 杂凑(文件指纹)
  4. SM4 CBC 字段级加密(患者隐私字段)
  5. 与现有 SHA-256 双轨,配置切换
- **验收**:报告签发时用 SM2,导出时用 SM4 加密 PHI,可用国密工具验签
- **估时**:3 周
- **涉及**:`src/security/smCrypto.ts` (新)

### P0-9 种植体规格库扩充 (50+ 厂商规格)

- **背景**:D3;调研 P0-3 典型病例库同源(教学)
- **G5 现状**:`src/data/dental/dentalImplant3dMock.ts` 12 个 mock
- **行动**:
  1. 收集 Nobel Biocare / Straumann / Dentsply / Zimmer / MIS / BEGO / 国产 (威高/康德莱/百康特) 50+ 规格
  2. 写 `src/config/clinicalConfig/modules/implantCatalog.json`
  3. 种植体规划页加「规格筛选」(长度/直径/平台/连接方式)
- **验收**:种植体规划页可选 ≥ 50 个规格,显示真实尺寸
- **估时**:2 周
- **涉及**:`src/data/dental/dentalImplant3dMock.ts`、`src/pages/dental/ImplantPlannerPage.tsx`

### P0-10 iPad Pro 12.9″ 视网膜适配

- **背景**:D9;移动端招标必问
- **G5 现状**:CSS 用 px 硬编码,无 iPad 适配
- **行动**:
  1. `src/styles/responsive.css` 加 `@media (min-width: 1024px) and (max-width: 1366px)` (iPad Pro)
  2. 影像查看器 2×3 棋盘格自适应
  3. 报告编辑器 1x 字号提升到 16px
  4. 工作列表 4 列展示
- **验收**:iPad Pro 12.9″ Safari 打开,无横向滚动,影像/报告/工作列表都可点
- **估时**:2 周
- **涉及**:`src/styles/responsive.css` (新)、`src/components/viewer/`

### P0-11 离线模式 (PWA + Service Worker)

- **背景**:D9;移动/急救场景硬性
- **G5 现状**:`vite-plugin-pwa` 未启用
- **行动**:
  1. `vite.config.ts` 引入 `vite-plugin-pwa` 配 Workbox
  2. `manifest.webmanifest` 配置
  3. 离线缓存:app shell + MSW mock handlers + IndexedDB 数据
  4. 离线报告:本地签名,联机后同步
- **验收**:DevTools → Network → Offline 模式,刷新仍可工作;恢复后数据自动同步
- **估时**:2 周
- **涉及**:`vite.config.ts`、`public/manifest.webmanifest` (新)

### P0-12 微信小程序 (报告查询)

- **背景**:D11;客户招标必问
- **G5 现状**:`src/pages/mobile/WechatMiniStubPage.tsx` 仅占位
- **行动**:
  1. 单独 mini-program 仓库 (本仓库仅出 API)
  2. `/api/v1/mobile/patient/:id/reports` 端点 (鉴权:微信 code → openid)
  3. 报告 PDF 链接 (临时 URL,30min 失效)
  4. 简易 H5 兜底 (无 native 也能用)
- **验收**:微信开发者工具打开,扫码登录 → 看到患者报告 PDF
- **估时**:3 周
- **涉及**:`src/services/mobile/wechatApi.ts` (新)、`docs/api/wechat-api.md`

---

## 2. P1 — 重要功能 (18 项,v3.0.7 - v3.0.8 交付)

> 入选条件:竞品都有 / 客户有但非硬性 / 商业化关键

### P1-1 DICOMWeb (QIDO-RS / WADO-RS / STOW-RS)

- **背景**:D12;VNA 配套
- **G5 现状**:仅 DICOMweb 概念
- **行动**:`src/server/dicomweb/` 暴露 3 类端点;测试用 `dcm4che` 工具
- **估时**:3 周

### P1-2 等保 2.0 三级合规 (差 8 项)

- **背景**:D8;法规
- **G5 现状**:2 级
- **行动**:差 8 项:日志审计/数据加密/漏洞扫描/容灾/密码策略/访问控制/边界防护/集中管控
- **估时**:6 周 (合规咨询 + 整改)

### P1-3 骨密度 Hounsfield 自动分段 (CBCT 像素 → HU)

- **背景**:D3;种植体规划前置
- **G5 现状**:无
- **行动**:`src/services/dental/hounsfieldSegment.ts` 接 Cornerstone.js 像素读取
- **估时**:2 周

### P1-4 VITA 3D-Master 完整 29 色板 + CAD/CAM 铣削参数

- **背景**:D4
- **G5 现状**:VITA Classical 16 色
- **行动**:加 3D-Master 29 色 + 玻璃陶瓷/氧化锆铣削参数 (e.max 厚度/烧结收缩率/Zenostar 挠曲强度)
- **估时**:2 周

### P1-5 移动危急值 push (Web Push API + Service Worker)

- **背景**:D9
- **G5 现状**:仅 toast
- **行动**:`src/services/mobile/push.ts` Web Push + VAPID key;危急值升级时 push
- **估时**:1 周

### P1-6 医师 RVU 计费 + 设备 OEE 自动采集

- **背景**:D6
- **G5 现状**:无
- **行动**:
  1. 引入 wRVU 2025 表 (~2800 编码)
  2. `src/services/analytics/rvu.ts` 按报告自动累计
  3. `src/services/analytics/oee.ts` 接 DICOM MPPS 计算
- **估时**:4 周

### P1-7 IHE XDS-I.b 注册中心 (跨院共享)

- **背景**:D7;P0-1/6 上层
- **G5 现状**:无
- **行动**:`src/server/xds/` Document Registry + Repository + Registry 3 actor
- **估时**:8 周

### P1-8 DICOM SR TID 2000 (基础)+ KOS (Key Object Selection)

- **背景**:D10
- **G5 现状**:P0-4 已做 TID 1500
- **行动**:扩展 TID 2000 + KOS,影像标注存为 KOS
- **估时**:2 周

### P1-9 患者 PHR 报告推送 (PHR + 影像云)

- **背景**:D11
- **G5 现状**:无
- **行动**:`src/services/patientPortal/phr.ts` 推送到微信 + 支付宝;影像走 DICOMWeb WADO
- **估时**:4 周

### P1-10 IOL Olsen 2023 + Castrop 2024 公式

- **背景**:D2
- **G5 现状**:8 公式
- **行动**:`src/services/eye/iolCalculator.ts` 加 2 个公式,加常数组
- **估时**:1 周

### P1-11 STL/PLY 口扫预览器 (3D 预览 + 测量)

- **背景**:D5
- **G5 现状**:无
- **行动**:`src/components/dental/StlViewer.tsx` Three.js STL 加载器
- **估时**:2 周

### P1-12 报告多级审核流 (一审/二审/签发) + 召回

- **背景**:调研 P0-4;v3.0.1 §三 报告 16 细项已有痕迹/锁定/CA,但**多级审核流未明**
- **G5 现状**:`status: published`,无 multi-stage
- **行动**:`src/state/report.machine.ts` 加 `review_level` 状态;`ReportWritePage` 顶部加审核链
- **估时**:2 周

### P1-13 典型病例库 / 教学病例库 (50+ 真实病例)

- **背景**:调研 P0-3
- **G5 现状**:`TypicalCasesPage` 静态
- **行动**:扩充 50+ 真实病例数据(部位/疾病/影像/报告/讨论),加教学标注
- **估时**:4 周

### P1-14 AI 影像质控 (分辨率/伪影/摆位评分)

- **背景**:调研 P0-2;v3.0.6.1/B1 模块 8
- **G5 现状**:无
- **行动**:`src/services/ai/imageQc.ts` 规则引擎 + 5 个预训练模型 mock
- **估时**:3 周

### P1-15 医保物价对照 + DRG 入组预测 (v3.1.0 起)

- **背景**:D6 商业
- **G5 现状**:无
- **行动**:`src/services/billing/priceMapping.ts` 接医保 API
- **估时**:6 周

### P1-16 IHE ATNA 审计日志 (syslog TLS)

- **背景**:D7 / D8
- **G5 现状**:无 TLS syslog
- **行动**:`src/security/atna.ts` syslog TLS 1.2 推送到审计服务器
- **估时**:2 周

### P1-17 CAD/CAM 嵌套排版 (Nesting) + STL/PLY 双格式导出

- **背景**:D4
- **G5 现状**:无
- **行动**:`src/services/dental/nesting.ts` 矩形 bin-packing;导出 ASCII + binary STL
- **估时**:3 周

### P1-18 设备维保提醒 + 检查项目配置

- **背景**:调研 P2-19 / P2-20
- **G5 现状**:`设备管理` 有维保,但提醒无
- **行动**:`src/services/maintenance/scheduler.ts` cron-like 提醒
- **估时**:1 周

---

## 3. P2 — 增强功能 (12 项,v3.0.8+ 交付)

> 入选条件:可锦上添花 / 教学/培训用 / 第三方集成

### P2-1 DRG 入组预测 (CHGS-DRG / CN-DRG)

- **背景**:D6 商业
- **估时**:8 周

### P2-2 财务应收 (AR) 跟踪 + 报表导出

- **背景**:D6 商业
- **估时**:4 周

### P2-3 BI 看板嵌入 (Tableau / PowerBI iframe)

- **背景**:D6
- **估时**:2 周

### P2-4 DICOM Print (传统相机打印)

- **背景**:D10
- **估时**:4 周

### P2-5 海外 PHR (Apple Health / CommonHealth)

- **背景**:D11
- **估时**:6 周

### P2-6 IHE XCA (跨域) 联邦查询

- **背景**:D7
- **估时**:8 周

### P2-7 临床路径 (Pathway) — 髋关节置换/PCI/白内障

- **背景**:扩展
- **估时**:12 周

### P2-8 教学版 PACS (PACS-Training) — DICOM 模拟器

- **背景**:D11 教育
- **估时**:6 周

### P2-9 AI 偏见审计 (Bias Report) — 人口学差异

- **背景**:D1
- **估时**:4 周

### P2-10 GDPR 合规 — 数据删除权 / 跨境传输

- **背景**:D8
- **估时**:4 周

### P2-11 ISO 27001 + 第三方安全渗透测试

- **背景**:D8
- **估时**:12 周 (含认证)

### P2-12 Apple Watch / 手环危急值推送

- **背景**:D9
- **估时**:8 周 (低优先)

---

## 4. 跨厂商协同项 (v3.0.6 系列横向,3 项)

| 编号 | 场景 | 涉及 | 估时 |
|---|---|---|---|
| CX-1 | GE AI Triage → Siemens CAD 编排 | B1+B2 | 6 周 |
| CX-2 | Philips AI Manager → Canon Vitrea VR 数据交换 | B3+B7 | 4 周 |
| CX-3 | Carestream Vue PACS + Agfa VNA 双向 | B5+B6 | 6 周 |

---

## 5. 估时汇总

| 阶段 | P0 | P1 | P2 | CX | 总周 |
|---|---|---|---|---|---|
| v3.0.7 (Q4 2026) | 12 项 / 32 周 → 6 人并行 8 周 | 5 项 / 12 周 | — | 1 项 / 6 周 | 14 周 |
| v3.0.8 (Q1 2027) | — | 8 项 / 22 周 | 4 项 / 18 周 | 1 项 / 4 周 | 22 周 |
| v3.0.9 (Q2 2027) | — | 5 项 / 12 周 | 4 项 / 22 周 | 1 项 / 6 周 | 22 周 |
| v3.1.0 (H2 2027) | — | — | 4 项 / 28 周 | — | 28 周 |

**首期 v3.0.7 关键路径**:`P0-1 (HL7)` → `P0-6 (FHIR)` → `P0-7 (AI Registry)` → `P0-5 (MWL)` → `P0-2 (VNA)`

---

## 6. 验收 Checklist (P0 单项)

| ID | 验收标准 | 测试方法 |
|---|---|---|
| P0-1 | `netstat -an \| find 2575` LISTENING;ORM 入站自动建 worklist;ORU 出站到达 mock EHR | 集成测试 + 手测 |
| P0-2 | 200 例 DICOM,90 天后自动降级;Storage 监控可视化 | 集成 + 时间模拟 |
| P0-3 | 50 类型 × 200 所见,编辑器内 ≥ 5 候选 | 手测 5 个类型 |
| P0-4 | `.dcm` 文件 MicroDicom 打开字段对应 | 单元 + 工具验 |
| P0-5 | `dcmsend` C-FIND 返回 worklist | 工具测 |
| P0-6 | `fhir-validator` 校验通过 | 自动化 |
| P0-7 | admin 改 approval → 列表徽章实时变 | Playwright |
| P0-8 | 国密工具验签通过 | 工具测 |
| P0-9 | 50+ 规格可筛,显示真实尺寸 | 手测 + 截图 |
| P0-10 | iPad Pro 12.9″ Safari 无横滚,4 列 | Playwright iPad viewport |
| P0-11 | Network Offline 模式刷新仍工作 | Playwright |
| P0-12 | 微信开发者工具打开可看 PDF | 手测 |

---

## 7. 不在本 backlog 的项(其他文档已覆盖)

- 报告 8 phase 升级 (R0-R8) — `docs/REPORT_SYSTEM_PLAN.md`
- 8 家厂商 300 升级点 × 8 — `docs/v3.0.6.1/v3.0.6.1-B[1-8]-*.md`
- v3.0.1 §6.2 5 项 v3.2+ 差距 — `docs/v3.0.1-COMPARISON.md`
- 已交付的 i18n / page-crash / defensive UI — `REVIEW.md` PHASE 3-6
- 业务/部署/计费 — `docs/BUSINESS_MODEL.md` / `docs/DEPLOYMENT.md` / `docs/PRICING.md`

---

## 8. 引用

- 12 维度 × 10 厂商对标: [`docs/COMPETITIVE-ANALYSIS-V3.0.6.10.md`](./COMPETITIVE-ANALYSIS-V3.0.6.10.md)
- 调研 P0/P1/P2: `docs/放射RIS竞品深度调研-20260501.md`
- 现有 6 维度对标: `docs/v3.0.1-COMPARISON.md`
- 报告 8 phase: `docs/REPORT_SYSTEM_PLAN.md`
- 历史 review: `REVIEW.md` PHASE 3-6

---

*文档生成时间:2026-07-03*
*版本:v3.0.6.10 backlog (去重版)*
*作者:Codex 持续集成*
