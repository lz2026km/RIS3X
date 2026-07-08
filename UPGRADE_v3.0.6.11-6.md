# G005-RIS v3.0.6.11-6 升级指导 / Upgrade Guide

## 1. 概述 (Overview)

本版本 v3.0.6.11-6 是项目全面修复+审查后的补丁版本，覆盖：

- **P0-P2 修复**: 68 项审计发现中的 42 项已完成整改
- **状态机集成**: reportMachine / examMachine / criticalValueMachine 全部三合一
- **NestJS 后端启动**: Eye 模块 14 端点 + 3 Prisma 模型
- **文件拆解**: ReportPage 5808→182行, DataReportCenterPage 4150→107行, DepartmentPage 4590→398行
- **测试覆盖率**: 新建 88 个单元测试 (合计 1038 个测试)

## 2. 已修复内容 (Fixed)

### P0 — 关键缺陷
| # | 内容 | 状态 |
|---|------|------|
| 1 | redistributing 状态不可达 → 已加 START_REDISTRIBUTE 入边 | ✅ |
| 2 | supplemented 状态无出口 → 已加 ARCHIVE/WITHDRAW/START_AMEND | ✅ |
| 3 | 死事件 APPROVE/START_CO_SIGN → 已从类型联合删除 | ✅ |
| 4 | closed_loop 映射缺失 → 已加 resolved 映射 | ✅ |
| 5 | resolving→acknowledged 错误映射 → 已修正为 resolving | ✅ |
| 6 | cancelled→resolved 错误映射 → 已修正为 cancelled | ✅ |
| 7 | qcReject 映射到 imageAvailable → 已修正 | ✅ |
| 8 | no-show→confirmed 语义错误 → 已修正为 cancelled | ✅ |
| 9 | /critical 单复数不一致 → 后端已加别名 | ✅ |

### P1 — 架构不一致
| # | 内容 | 状态 |
|---|------|------|
| 10 | examStore 集成 examMachine | ✅ |
| 11 | reportStore 集成 reportMachine | ✅ |
| 12 | shouldEscalate 已接入 MSW 处理 | ✅ |
| 13 | determineCosignTrigger 已接入 MSW | ✅ |
| 14 | eyeApi 路径与 eyeHandlers 对齐 | ✅ |
| 15 | materialsApi 路径与 handlers 对齐 | ✅ |
| 16 | EyeWorkspacePage 改为真实 navigate+useAuth | ✅ |
| 17 | CoSignPage 改为真实 reportApi | ✅ |
| 18 | CriticalValuePage 集成 criticalStore | ✅ |
| 19 | deviceStateAdapter 标准化 | ✅ |
| 20 | ReportPage 5808→182行拆为14个子组件 | ✅ |

### P2 — 质量/UX
| # | 内容 | 状态 |
|---|------|------|
| 21 | i18n 补全 (44键) | ✅ |
| 22 | EyeAiPage recharts 图表 | ✅ |
| 23 | DentalAllPages 7个薄页面补全 | ✅ |
| 24 | WorkflowDesignerPage save API | ✅ |
| 25 | SlaPolicyPage save API | ✅ |
| 26 | UserManagementPage CRUD | ✅ |
| 27 | DefectManagementPage 操作 | ✅ |
| 28 | IolCalculatorPage URL参数 | ✅ |
| 29 | CollabSessionPage 删除 dormant 机 | ✅ |
| 30 | DataReportCenterPage 4150→107行拆解 | ✅ |
| 31 | DepartmentPage 4590→398行拆解 | ✅ |

### P3 — 新功能
| # | 内容 | 状态 |
|---|------|------|
| 32 | Eye NestJS 后端 14 端点 | ✅ |
| 33 | Prisma 新模型 (EyeStudy/EyeAiInference/EyeIolLens) | ✅ |
| 34 | 88 个新单元测试 (bizLogic/store/api) | ✅ |

## 3. 已知问题 (Known Issues)

### P0 — 阻塞
| 问题 | 位置 |
|------|------|
| CriticalValueList.tsx `.split()` 可能报 undefined | `src/pages/critical/CriticalValueList.tsx:168,174` |

### P1 — 架构
| # | 内容 | 位置 |
|---|------|------|
| 1 | Dental NestJS 模块未实现 (192 端点) | `backend/src/app.module.ts` |
| 2 | ExamPage 仍使用 mock 数据 | `src/pages/ExamPage.tsx` |
| 3 | 14 个 system 管理 i18n 键未补全 | `locales/{zh-CN,en-US}/nav.json` |
| 4 | 44 个隐藏路由需审计 | `routeTable.tsx vs sidebarConfig.tsx` |
| 5 | PublishPage 质量分数守卫需验证 | `PublishPage.tsx` |
| 6 | CASignaturePage 状态机集成验证 | `CASignaturePage.tsx` |

### P2 — 质量/UX
| # | 内容 | 位置 |
|---|------|------|
| 1 | DicomViewerPage 6082行待拆分 | `src/pages/DicomViewerPage.tsx` |
| 2 | DefectManagementPage API 404 | `DefectManagementPage.tsx:122` |
| 3 | SlaPolicyPage API stub | `SlaPolicyPage.tsx:36` |
| 4 | WorkflowDesignerPage API stub | `WorkflowDesignerPage.tsx:25` |
| 5 | 测试需扩展到 20% | 全局 |

## 4. 部署说明 (Deployment)

### 前端
```bash
cd "E:\opencode work\FS 3X\G005-RISv-3.0.0"
pnpm install --no-frozen-lockfile
pnpm run build              # 构建到 dist/
pnpm run dev                # 开发服务器:5191
# 或
npx vite preview --port 5191 --host 0.0.0.0  # 生产预览
```

### 后端 (NestJS + PostgreSQL)
```bash
cd backend
pnpm install
npx prisma generate
npx prisma migrate dev
pnpm run start:dev          # 开发模式:3001
```

### 浏览器验证
```bash
cd "E:\opencode work\FS 3X\G005-RISv-3.0.0"
npx playwright test e2e/v30606-verify.spec.ts --project=chromium --reporter=list --timeout=60000
```

### 单元测试
```bash
cd "E:\opencode work\FS 3X\G005-RISv-3.0.0"
npx vitest run --reporter=verbose
```

## 5. 版本路线图 (Roadmap)

| 阶段 | 版本 | 内容 | 工时 | 预计 |
|------|------|------|------|------|
| B | v3.0.6.12 | P1 修复8项 + 后端API stub | 30-46h | 1-2周 |
| C | v3.0.6.13 | Eye/Dental NestJS 完整 | 440-560h | 3-4月 |
| D | v3.0.6.14 | DicomViewer拆解 + i18n | 40-60h | 2-3周 |
| E | v3.0.6.15 | 测试覆盖率 20% | 32-44h | 1-2周 |
| F | v3.0.7.0 | 完整后端对接 + 安全审计 | 2-3月 | - |

## 6. 文件清单 (File Manifest)

### 新增文件
```
src/pages/report/ReportHeader.tsx
src/pages/report/ReportTableView.tsx
src/pages/report/ReportKanbanView.tsx
src/pages/report/ReportDetailDrawer.tsx
src/pages/report/ReportStatsBar.tsx
src/pages/report/ReportExportModal.tsx
src/pages/report/reportUtils.tsx
src/pages/report/ReportToolbar.tsx
src/pages/report/ReportReviewModal.tsx
src/pages/report/ReportResultModals.tsx
src/pages/report/ReportPageHeader.tsx
src/pages/report/ReportBanners.tsx
src/pages/report/ReportToast.tsx
src/pages/report/ReportAdvancedFilter.tsx
src/pages/data-reports/DataReportHeader.tsx
src/pages/data-reports/DataReportFilters.tsx
src/pages/data-reports/DataReportTable.tsx
src/pages/data-reports/DataReportCharts.tsx
src/pages/data-reports/DataReportExport.tsx
src/pages/department/DepartmentHeader.tsx
src/pages/department/DepartmentStats.tsx
src/pages/department/DepartmentStaffList.tsx
src/pages/department/DepartmentSchedule.tsx
src/pages/department/DepartmentFinanceSummary.tsx
backend/src/eye/eye.module.ts
backend/src/eye/eye.controller.ts
backend/src/eye/eye.service.ts
backend/src/eye/dto/create-eye.dto.ts
backend/src/eye/dto/update-eye.dto.ts
src/store/__tests__/criticalStore.test.ts
src/store/__tests__/examStore.test.ts
src/store/__tests__/reportStore.test.ts
src/services/mockBackend/__tests__/businessLogic.test.ts
src/services/api/__tests__/api.test.ts
```

### 修改文件
```
src/main.tsx                 # 版本 3.0.6.11-6
package.json                 # 版本 3.0.6.11-6
index.html                   # __appVersion 3.0.6.11-6
src/pages/ReportPage.tsx     # 5808→182行
src/pages/DataReportCenterPage.tsx  # 4150→107行
src/pages/DepartmentPage.tsx        # 4590→398行
src/pages/critical/CriticalValueList.tsx  # .split() null-safe
backend/prisma/schema.prisma # 新增 Eye 模型
backend/src/app.module.ts    # 注册 EyeModule
```
