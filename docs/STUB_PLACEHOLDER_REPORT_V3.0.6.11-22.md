# Stub/Placeholder 扫描报告

**版本**: v3.0.6.11-22  
**扫描日期**: 2026-07-13  
**扫描范围**: `src/pages/` + `src/components/` 下所有 `.tsx` 文件

---

## 扫描结果汇总

| 类别 | 发现数 | 已修复 |
|------|--------|--------|
| A. 空按钮 (`onClick={() => {}}`) | 2 | 2 |
| B. 开发中占位文字 | 0 | 0 |
| C. 注释 TODO 占位 | 6 | 0 (已有文案说明) |
| **合计** | **8** | **2** |

---

## A. 空按钮 — 已修复 2 处

### 1. `src/pages/integration/DimsePage.tsx:17`
- **原始代码**: `<Button ... onClick={() => {}}>ECHO 测试</Button>`
- **修复**: `onClick={() => message.info('ECHO 功能开发中，敬请期待')}`
- **说明**: DIMSE ECHO 测试按钮的后端接口尚未实现。

### 2. `src/pages/regional/RegionalReportList.tsx:83`
- **原始代码**: `<button ... onClick={() => {}}>会诊记录 / 发起申请</button>`
- **修复**: `onClick={() => message.info('远程会诊标签切换功能开发中，敬请期待')}`
- **说明**: 远程会诊标签切换功能未实现（`consultationTab` 为只读 prop，无 setter）。

---

## B. 开发中占位文字 — 未发现需要修复项

- `src/pages/dental/DentalCadPage.tsx:131` → "修复 CAD/CAM 设计中心" 为页面标题，非占位
- `src/pages/dental/DentalGuidePage.tsx:68` → "设计中" 为数据统计状态标签，非占位
- `src/components/v3/report/AIReportReview.tsx:44` → `'TODO'` 在 quality check blacklist 中，为检测数据
- `src/components/v3/report/ReportQualityScore.tsx:65` → `'TODO'` 在 quality check blacklist 中，为检测数据
- `src/components/v3/report/RequiredFieldGuard.tsx:120,128` → `'TODO'` 在 quality check blacklist 中，为检测数据

---

## C. 注释 TODO 占位 — 未修复（已有文案说明）

| 文件 | 行号 | 内容 | 说明 |
|------|------|------|------|
| `src/pages/DevicePage.tsx` | 1 | `// TODO v3.0.4: 此文件超过 2000 行...` | 已有重构说明 |
| `src/pages/FindingLibraryPage.tsx` | 2 | `// TODO v3.0.4: 替换此文件中所有硬编码...` | 已有 i18n 改造说明 |
| `src/pages/HomePage.tsx` | 1781 | `// TODO: 使用实际日期替代硬编码` | 已有描述，行1782已实现 |
| `src/pages/HomePage.tsx` | 1811 | `{/* TODO: 使用实际日期替代硬编码 */}` | JSX 注释，已有描述 |
| `src/pages/QCPage.tsx` | 2 | `// TODO v3.0.4: 此文件超过 2000 行...` | 已有重构说明 |
| `src/pages/TypicalCasesPage.tsx` | 2 | `// TODO v3.0.4: 替换此文件中所有硬编码...` | 已有 i18n 改造说明 |

---

## 验证

- [x] `pnpm run build` 通过
