# 窗宽窗位预设重构 — W/L Presets Refactoring

## 变更摘要

将所有硬编码窗宽窗位(W/L)值统一为 `modalityPresets` 常量引用，消除重复定义，新增 CBCT 等 modality 的预设支持。

---

## 修改文件清单 (8 files)

### 1. `src/services/dicomWeb.ts`
- `WINDOW_PRESETS_DETAILED` 新增 `DR_ABDOMEN`、`CBCT_BONE`、`CBCT_SOFT` 三个预设

### 2. `src/utils/modalityPresets.ts`
- **CT fallback**: 新增 `脑窗`(ww:80, wl:40)、`软组织`(ww:400, wl:40)
- **MR fallback**: 新增 `DWI`
- **DR/XR**: 新增 `DR 腹部`
- **CBCT**: 新增独立分支 (CBCT 骨窗 2500/1200, CBCT 软组织 800/400)
- **XA/DSA**: 新增独立分支 (血管窗 400/100)
- **通用 fallback**: 扩展为 骨窗/软组织/肺窗 三项
- 导出常量: `CT_DEFAULT_WW/WL`, `FUSION_CT_WW/WL`, `FUSION_PET_WW/WL`, `MR_DEFAULT_WW/WL`

### 3. `src/utils/index.ts`
- 新增导出 `modalityPresets` (getPresetsForModality, 所有常量, SimpleWindowPreset)
- 新增导出 `windowingStorage` (DEFAULT_WINDOWING, loadWindowingState, saveWindowingState, useWindowingState, WindowingState)

### 4. `src/pages/dicom/DicomViewerTypes.ts`
- `WINDOW_PRESETS` 标记为 `@deprecated`，提示改用 `getPresetsForModality`

### 5. `src/pages/dicom/ViewportArea.tsx`
- 移除 `WINDOW_PRESETS` 导入，改用 `currentPresets` (由 `getPresetsForModality` 生成)
- 两处 `WINDOW_PRESETS[activePresetIdx]` → `currentPresets[activePresetIdx]`
- 重置按钮 400/40 → `CT_DEFAULT_WW` / `CT_DEFAULT_WL`

### 6. `src/pages/DicomViewerPage.tsx`
- `useState(400)` → `useState(CT_DEFAULT_WW)`
- `useState(40)` → `useState(CT_DEFAULT_WL)`
- reset handler: 400/40 → `CT_DEFAULT_WW` / `CT_DEFAULT_WL`
- 移除未使用的 `WINDOW_PRESETS` 导入

### 7. `src/pages/dicom/FusionPage.tsx`
- `{ww:1200, wl:400}` → `{ww:FUSION_CT_WW, wl:FUSION_CT_WL}`
- `{ww:800, wl:200}` → `{ww:FUSION_PET_WW, wl:FUSION_PET_WL}`
- 重置函数同步更新

### 8. `src/pages/dicom/FusionV2Page.tsx`
- 同上，两处 default + reset 全部替换为命名常量

---

## 预设覆盖矩阵

| Modality | 预设数 | 预设名称 |
|----------|--------|----------|
| CT       | 5      | 肺窗(1500/-600), 纵隔窗(400/40), 骨窗(2000/400), 脑窗(80/40), 软组织(400/40) |
| MR       | 4      | T1(800/400), T2(1500/750), FLAIR(1500/750), DWI(1500/750) |
| DR/XR    | 3      | DR 胸片(2500/1250), DR 骨窗(2000/500), DR 腹部(1800/900) |
| MG       | 1      | MG 乳腺(2500/1250) |
| US       | 1      | US 腹部(255/128) |
| PT       | 1      | PET 默认(5000/2500) |
| CBCT     | 2      | CBCT 骨窗(2500/1200), CBCT 软组织(800/400) |
| XA/DSA   | 1      | 血管窗(400/100) |
| Fallback | 3      | 骨窗(2000/400), 软组织(400/40), 肺窗(1500/-600) |

---

## 修复统计

- **硬编码 W/L 值替换**: 12 处
- **新增强制 modality 分支**: 8 个 (CT/MR/DR/XR/MG/US/PT/CBCT/XA/DSA + fallback)
- **新增导出常量**: 7 个
- **废弃/移除重复定义**: 1 处 (DicomViewerTypes.WINDOW_PRESETS → @deprecated)

---

## 使用指引

```ts
import { getPresetsForModality } from '../utils/modalityPresets'
const presets = getPresetsForModality('CT') // => [{name:'肺窗',ww:1500,wl:-600}, ...]

// 也可以直接使用 dicomWeb 层定义的全量预设
import { WINDOW_PRESETS_LIST } from '../services/dicomWeb'
```

如需持久化用户窗宽窗位偏好，使用:
```ts
import { useWindowingState, loadWindowingState, saveWindowingState } from '../utils/windowingStorage'
```
