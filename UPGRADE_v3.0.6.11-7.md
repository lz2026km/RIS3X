# v3.0.6.11-7 升级指南 / Upgrade Guide

## 版本变更 / Version Changes

- 升级自 / From: v3.0.6.11-6
- 目标 / Target: 前端后端全功能对齐 / Full-stack feature alignment

## 新增14后端模块 / 14 New Backend Modules

| Module         | Endpoints | Description                  |
| -------------- | --------- | ---------------------------- |
| dental         | 18        | 牙科检查/种植/预约/账单/库存 |
| workflow       | 15        | 工作流定义/SLA/路由规则      |
| finance        | 10        | 收费项/发票/收入分析         |
| data-report    | 9         | 国家报表/数据报表/医保审计   |
| regional       | 11        | 区域影像/医联体/HL7/FHIR     |
| patient-portal | 10        | 患者门户/临床数据/移动端     |
| cosign         | 8         | 会签待办/历史/规则/统计      |
| cds            | 10        | 指南/告警/剂量监测/规则      |
| critical-ext   | 12        | 危急值规则/统计/闭环         |
| qc-ext         | 11        | 质控看板/图像/年度/缺陷      |
| report-quality | 9         | 评分规则/缺陷库/AI草稿       |
| ca             | 9         | CA证书/签名/校验/配置        |
| device-mgmt    | 18        | 设备全生命周期/耗材/对比剂   |
| ai-platform    | 13        | AI模型/质控/结构化报告/编排  |

Total: 163 new endpoints (251 with MSW routes)

## 新增14 Prisma模型 / 14 New Prisma Models

DentalStudy, DentalAiFinding, DentalImplant, DentalAppointment, DentalInvoice, DentalInventoryItem, WorkflowDefinition, WorkflowStep, SlaPolicy, RoutingRule, ChargeItem, Invoice, NotificationTemplate, NotificationChannel

## 新增12前端Store / 12 New Frontend Stores

dentalStore, workflowStore, financeStore, dataReportStore, regionalStore, patientPortalStore, cosignStore, cdsStore, criticalExtStore, qcStore, deviceMgmtStore, aiPlatformStore

## 新增7全局组件 / 7 New Global Components

DataTable (虚拟滚动/列冻结/拖拽/内联编辑/CSV导出), FormBuilder (17字段类型/依赖联动), Chart (14图表/导出PNG-SVG), PermissionGuard (字段级权限), AuditTrail (审计追溯), DiffViewer (报告修订对比), SignaturePad (手写/CA双通道)

## 40+内置报表 / 40+ Built-in Reports

8大分类44个报表，含AI自动洞察文本。分类：日常统计/设备管理/报告质量/危急值/绩效分析/AI评估/患者服务/综合质控

## 按钮与批量操作升级 / Button & Batch Ops Upgrade

- 批量操作栏（选中后显示） / Batch action bar (appears on selection)
- 操作日志自动记录 / Automatic operation logging
- 键盘快捷键（g+r/g+w/Ctrl+Enter/Escape/?）/ Keyboard shortcuts
- 二次确认（危险操作） / Double confirmation on dangerous actions

## 测试覆盖 / Test Coverage

- 391 单元测试（18文件） / 391 unit tests (18 files)
- 20 E2E 测试 / 20 E2E tests
- 新增覆盖率目标: 70%→85% / Coverage target: 70%→85%

## 升级步骤 / Upgrade Steps

1. pnpm install
2. pnpm run build
3. npx vite preview --port 5191
4. npx playwright test e2e/v30607-comprehensive.spec.ts
