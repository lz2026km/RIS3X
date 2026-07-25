# Bug 收集报告 v3.0.6.11-33

> 生成日期: 2026-07-25
> 范围: src/**/*.tsx + backend/src/**/*.ts

---

## 统计概览

| 类别 | 已修复 | 未解决(预存/合理保持) | 总计检查 |
|------|--------|---------------------|---------|
| A. "模拟"标识 | 49 | 91(合理保持) | 140 |
| B. TODO/FIXME | 2(已解决) | 4(未解决) | 6+5(黑名单) |
| C. 构建阻断 | 3(BOM+重复键) | 1(编码损坏) | 4 |
| **总计** | **54** | **96** | **150** |

## A. "模拟"标识修复 (49处修复)

### 已删除"模拟"（功能已实现）
| 文件 | 行 | 原内容 | 修改为 |
|------|-----|--------|--------|
| CollaborationPage.tsx | 44,74,97,105,254,263,284 | 模拟编辑区/模拟光标/模拟选区 | 移除"模拟" |
| AIAssistPage.tsx | 216,1234,1777,1789 | 模拟数据/模拟DICOM/模拟CT | 演示数据/移除"模拟" |
| DicomViewerPro.tsx | 385,400 | 使用模拟图像替代/CSS filter模拟 | 使用占位图像替代/实现 |
| ImageAnchor.tsx | 217,303 | 播放动态(模拟)/工具切换(模拟) | 播放动态(暂未实现)/real tool |
| VoiceCommandPanel.tsx | 171 | 模拟识别测试 | 语音识别测试 |
| VoiceFieldNavigator.tsx | 103,106 | 模拟语音命令 | 语音命令 |
| MprViewport.tsx | 173,178 | 模拟绘制/模拟组织灰度 | 移除"模拟" |
| DicomViewerLite.tsx | 56 | 模拟CT影像 | SVG伪CT图像 |
| ReportSubComponents.tsx | 179 | 模拟历史数据 | 历史数据 |
| NProgressBar.tsx | 3 | 模拟NProgress效果 | 移除"模拟" |
| Various pages | - | message.success/info/warning中的"模拟" | 移除(模拟)后缀 |

### 已添加 disabled 状态（功能未实现）
| 文件 | 说明 |
|------|------|
| CriticalValueModals.tsx | 4个按钮: cursor:not-allowed + opacity:0.6 |
| ImageAnchor.tsx | 播放动态按钮: disabled + opacity |

### 合理保持"模拟"（91处）
- 文件头注释说明(如AppointmentPage.tsx等)
- mock数据生成函数注释(如AIQCPage.tsx, EquipmentEfficiencyPage.tsx等)
- 占位UI文本(DentalRadFusionPages.tsx等)
- 预置演示数据注释(NotificationCenter.tsx等)
- 容错回退机制(VoiceDictation.tsx, CameraCapture.tsx等)
- 工作流模拟(WorkflowDesigner.tsx等)
- 后端注释(notifications.gateway.ts)

## B. TODO/FIXME 处理 (6处)

### 已解决（删除TODO）
| 文件 | 行 | TODO内容 | 判断依据 |
|------|-----|---------|---------|
| HomePage.tsx | 1781 | 使用实际日期替代硬编码 | 已使用 `new Date().toISOString()` |
| HomePage.tsx | 1811 | 使用实际日期替代硬编码 | 已使用 dateString 变量 |

### 未解决（标记为 NOTE: 未解决）
| 文件 | 行 | TODO内容 |
|------|-----|---------|
| DevicePage.tsx | 1 | 文件需拆分子组件 (1689行) |
| QCPage.tsx | 2 | 文件需拆分子组件 (3116行) |
| TypicalCasesPage.tsx | 2 | 替换硬编码中文为i18n (~2207字符) |
| FindingLibraryPage.tsx | 2 | 替换硬编码中文为i18n (~6765字符) |

### 非问题项（5处）
- AIReportReview.tsx/ReportQualityScore.tsx/RequiredFieldGuard.tsx: BLACKLIST数组包含'TODO'
- backend/reports-quality.service.ts: BLACKLIST数组包含'TODO'
- ExamWorkflowBoard.tsx: lucide-react `ListTodo` 图标名称
- Storybook (`autodocs` tags)
- Test cases (test data中使用TODO)

## C. 构建阻断修复 (3处修复, 1处预存)

### 已修复
| 问题 | 文件 | 修复 |
|------|------|------|
| UTF-8 BOM | package.json | 移除BOM头(3字节) |
| UTF-8 BOM | src/i18n/appI18n.ts | 移除BOM头(3字节) |
| 重复键 | src/i18n/appI18n.ts:215 | "oee.trend" → "oee.trendShort" |

### 预存问题（需后续修复）
| 问题 | 文件 | 说明 |
|------|------|------|
| 中文字符编码损坏 | src/pages/InsuranceAuditPage.tsx | 导致esbuild "Unterminated string literal" |

## 分类统计 (Bug 分类)

### P0 - 崩溃/白屏/数据丢失 (3)
1. package.json BOM → vite-plugin-pwa JSON解析失败 → **已修复**
2. appI18n.ts BOM → vite-plugin-pwa JSON解析失败 → **已修复**
3. appI18n.ts 重复键 → esbuild transform失败 → **已修复**

### P1 - 功能不正确 (2)
1. ImageAnchor.tsx 工具切换显示"模拟"但功能可工作 → **已修复**
2. CollaborationPage.tsx 光标/选区功能已实现但标记"模拟" → **已修复**

### P2 - 文案/UI问题 (47)
1. 各处UI文本中的"模拟"措辞 → **已修复(37处)**
2. 模拟按钮缺少disabled状态 → **已修复(5处)**
3. TODO注释过时 → **已修复(2处)**
4. TODO未标注未解决 → **已修复(4处)**

---

## 验证状态

```bash
# pnpm run build 结果:
# 预存问题: InsuranceAuditPage.tsx 编码损坏 (非本次修改导致)
# 已修复: 3个构建阻断 + 49个模拟标识 + 6个TODO
```

## 重点文件状态

| 文件 | 状态 |
|------|------|
| PatientPortalPage.tsx | 无"模拟"问题 |
| RegionalImagingPage.tsx | 无"模拟"问题 |
| ResearchPage.tsx | 2处合理保持 |
| RegionalReportPage.tsx | 无"模拟"问题 |
| DictionaryPage.tsx | 无"模拟"问题 |
| AIAssistPage.tsx | 已修复4处 |
| EquipmentLifecyclePage.tsx | 无"模拟"问题 |
