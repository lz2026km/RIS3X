# Playwright 200 页 200 交互 测试报告 — v3.0.6.11-33

> 生成时间: 2026-08-02T14:01:19.771Z
> 项目: G005-RISv-3.0.0
> 浏览器: chromium
> 对比基线: v3.0.6.11-32

## 一、测试总览

| 指标 | v3.0.6.11-32 | v3.0.6.11-33 | 变化 |
|------|:----------:|:----------:|:----:|
| Sidebar 总路由 | 233 | 325 | — |
| 测试路由数 | 200 | **200** | — |
| 通过页数 | 0 | **230** | ✅ +230 |
| 失败页数 | 200 | **170** | ✅ -30 |
| 崩溃页数 (P0) | 0 | **0** | 0 |
| **通过率** | 0.0% | **57.5%** | ✅ +57.5% |
| 按钮总数 | 0 | 8010 | 8010 |
| 按钮点击成功 | 0 | 1543 | ✅ +1543 |
| 假按钮/死按钮 | 0 | 6467 | +6467 |
| Tab 总数 | 0 | 124 | 124 |
| Tab 点击成功 | 0 | 108 | ✅ +108 |
| Console errors | 397 | 1233 | +836 |
| Page errors | 2 | 50 | 48 |
| Alert 弹窗 | — | 0 | — |

## 二、失败页面清单

| # | 路由 | 失败原因 | body | 状态 | v32 是否通过 | 新增? | Alert? |
|---|------|----------|:----:|:----:|:----------:|:----:|:-----:|
| 0 | `/` | CONSOLE_ERR=2 | 10888 | 200 | false | 持续失败 |  |
| 1 | `/worklist` | CONSOLE_ERR=6 | 4015 | 200 | false | 持续失败 |  |
| 1 | `/worklist` | CONSOLE_ERR=6 | 4015 | 200 | false | 持续失败 |  |
| 2 | `/triage/worklist` | CONSOLE_ERR=4 | 3797 | 200 | false | 持续失败 |  |
| 2 | `/triage/worklist` | CONSOLE_ERR=6 | 3797 | 200 | false | 持续失败 |  |
| 3 | `/triage/dashboard` | CONSOLE_ERR=5 | 3731 | 200 | false | 持续失败 |  |
| 3 | `/triage/dashboard` | CONSOLE_ERR=6 | 3731 | 200 | false | 持续失败 |  |
| 4 | `/exams` | CONSOLE_ERR=7 | 4759 | 200 | false | 持续失败 |  |
| 4 | `/exams` | CONSOLE_ERR=6 | 4759 | 200 | false | 持续失败 |  |
| 6 | `/appointments` | CONSOLE_ERR=10 | 4263 | 200 | false | 持续失败 |  |
| 6 | `/appointments` | CONSOLE_ERR=10 | 4254 | 200 | false | 持续失败 |  |
| 9 | `/follow-up` | CONSOLE_ERR=6 | 9600 | 200 | false | 持续失败 |  |
| 9 | `/follow-up` | CONSOLE_ERR=4 | 9600 | 200 | false | 持续失败 |  |
| 11 | `/patient/self-service` | CONSOLE_ERR=11 | 3708 | 200 | false | 持续失败 |  |
| 11 | `/patient/self-service` | CONSOLE_ERR=12 | 3708 | 200 | false | 持续失败 |  |
| 26 | `/report-score-rule` | CONSOLE_ERR=18 | 4216 | 200 | false | 持续失败 |  |
| 27 | `/report-defect-library` | CONSOLE_ERR=12 | 4549 | 200 | false | 持续失败 |  |
| 26 | `/report-score-rule` | CONSOLE_ERR=18 | 4216 | 200 | false | 持续失败 |  |
| 27 | `/report-defect-library` | CONSOLE_ERR=12 | 4549 | 200 | false | 持续失败 |  |
| 36 | `/ca-signature` | CONSOLE_ERR=8 | 119 | 200 | false | 持续失败 |  |
| 41 | `/blockchain-proof` | CONSOLE_ERR=4 | 4466 | 200 | false | 持续失败 |  |
| 42 | `/cds/management` | CONSOLE_ERR=6 | 3680 | 200 | false | 持续失败 |  |
| 36 | `/ca-signature` | CONSOLE_ERR=4 | 119 | 200 | false | 持续失败 |  |
| 43 | `/cds/statistics` | CONSOLE_ERR=8 | 119 | 200 | false | 持续失败 |  |
| 44 | `/cds/rule-config` | CONSOLE_ERR=11 | 3821 | 200 | false | 持续失败 |  |
| 45 | `/review-center` | CONSOLE_ERR=4 | 4165 | 200 | false | 持续失败 |  |
| 46 | `/quality-control` | CONSOLE_ERR=3 | 4266 | 200 | false | 持续失败 |  |
| 42 | `/cds/management` | CONSOLE_ERR=6 | 3680 | 200 | false | 持续失败 |  |
| 43 | `/cds/statistics` | CONSOLE_ERR=4 | 119 | 200 | false | 持续失败 |  |
| 49 | `/qc-dashboard` | CONSOLE_ERR=16 | 4202 | 200 | false | 持续失败 |  |
| 44 | `/cds/rule-config` | CONSOLE_ERR=12 | 3821 | 200 | false | 持续失败 |  |
| 50 | `/qc-image` | CONSOLE_ERR=7 | 5617 | 200 | false | 持续失败 |  |
| 51 | `/qc-radiologist-annual` | CONSOLE_ERR=6 | 4480 | 200 | false | 持续失败 |  |
| 45 | `/review-center` | CONSOLE_ERR=5 | 4165 | 200 | false | 持续失败 |  |
| 46 | `/quality-control` | CONSOLE_ERR=3 | 4266 | 200 | false | 持续失败 |  |
| 54 | `/radpath/tracker` | CONSOLE_ERR=4 | 3696 | 200 | false | 持续失败 |  |
| 49 | `/qc-dashboard` | CONSOLE_ERR=16 | 4202 | 200 | false | 持续失败 |  |
| 56 | `/workflow-designer` | CONSOLE_ERR=3 | 3729 | 200 | false | 持续失败 |  |
| 50 | `/qc-image` | CONSOLE_ERR=7 | 5617 | 200 | false | 持续失败 |  |
| 51 | `/qc-radiologist-annual` | CONSOLE_ERR=6 | 4480 | 200 | false | 持续失败 |  |
| 59 | `/sla-policy` | CONSOLE_ERR=2 | 3719 | 200 | false | 持续失败 |  |
| 61 | `/orchestrator` | CONSOLE_ERR=25 | 4021 | 200 | false | 持续失败 |  |
| 62 | `/smart-mwl` | CONSOLE_ERR=5 | 3707 | 200 | false | 持续失败 |  |
| 54 | `/radpath/tracker` | CONSOLE_ERR=4 | 3696 | 200 | false | 持续失败 |  |
| 63 | `/ai-triage` | CONSOLE_ERR=5, STUCK | 3629 | 200 | false | 持续失败 |  |
| 64 | `/smart-routing` | CONSOLE_ERR=9 | 3691 | 200 | false | 持续失败 |  |
| 56 | `/workflow-designer` | CONSOLE_ERR=3 | 3729 | 200 | false | 持续失败 |  |
| 66 | `/radpath` | CONSOLE_ERR=8 | 3699 | 200 | false | 持续失败 |  |
| 67 | `/critical-value-5step` | CONSOLE_ERR=6 | 3755 | 200 | false | 持续失败 |  |
| 61 | `/orchestrator` | CONSOLE_ERR=25 | 4021 | 200 | false | 持续失败 |  |
| 70 | `/dicom/fusion` | CONSOLE_ERR=4 | 3769 | 200 | false | 持续失败 |  |
| 62 | `/smart-mwl` | CONSOLE_ERR=8 | 3707 | 200 | false | 持续失败 |  |
| 71 | `/dicom/fusion-v2` | CONSOLE_ERR=5 | 3808 | 200 | false | 持续失败 |  |
| 63 | `/ai-triage` | CONSOLE_ERR=8 | 3715 | 200 | false | 持续失败 |  |
| 72 | `/dicom/volume-viewer` | CONSOLE_ERR=2 | 3727 | 200 | true | ❌ 回归 |  |
| 64 | `/smart-routing` | CONSOLE_ERR=13 | 3691 | 200 | false | 持续失败 |  |
| 75 | `/dicom/vr` | CONSOLE_ERR=5 | 3674 | 200 | false | 持续失败 |  |
| 66 | `/radpath` | CONSOLE_ERR=12 | 3699 | 200 | false | 持续失败 |  |
| 76 | `/dicom/post-processing` | CONSOLE_ERR=4 | 3693 | 200 | false | 持续失败 |  |
| 67 | `/critical-value-5step` | CONSOLE_ERR=3 | 3755 | 200 | false | 持续失败 |  |
| 77 | `/dicom/dbt` | CONSOLE_ERR=5 | 3731 | 200 | false | 持续失败 |  |
| 70 | `/dicom/fusion` | CONSOLE_ERR=4 | 3769 | 200 | false | 持续失败 |  |
| 82 | `/dicom/compress` | CONSOLE_ERR=17 | 3816 | 200 | false | 持续失败 |  |
| 71 | `/dicom/fusion-v2` | CONSOLE_ERR=5 | 3808 | 200 | false | 持续失败 |  |
| 83 | `/dicom/4d` | CONSOLE_ERR=12 | 3802 | 200 | false | 持续失败 |  |
| 84 | `/cross-modal-search` | CONSOLE_ERR=5 | 3623 | 200 | false | 持续失败 |  |
| 85 | `/dicom/sr-manager` | CONSOLE_ERR=7 | 3783 | 200 | false | 持续失败 |  |
| 86 | `/dicom/radiomics` | CONSOLE_ERR=3 | 3696 | 200 | false | 持续失败 |  |
| 87 | `/dicom/wado-rs` | CONSOLE_ERR=6 | 3679 | 200 | false | 持续失败 |  |
| 75 | `/dicom/vr` | CONSOLE_ERR=5 | 3674 | 200 | false | 持续失败 |  |
| 88 | `/dicom/stow-rs` | CONSOLE_ERR=6 | 3685 | 200 | false | 持续失败 |  |
| 89 | `/dicom/sr-report` | CONSOLE_ERR=4 | 3677 | 200 | false | 持续失败 |  |
| 76 | `/dicom/post-processing` | CONSOLE_ERR=4 | 3693 | 200 | false | 持续失败 |  |
| 90 | `/dicom/dimse` | CONSOLE_ERR=5 | 183 | 200 | false | 持续失败 |  |
| 77 | `/dicom/dbt` | CONSOLE_ERR=5 | 3731 | 200 | false | 持续失败 |  |
| 91 | `/dicom/sr-templates` | CONSOLE_ERR=5 | 3716 | 200 | false | 持续失败 |  |
| 95 | `/ai-structured-report` | CONSOLE_ERR=3 | 3936 | 200 | false | 持续失败 |  |
| 97 | `/ai-draft` | CONSOLE_ERR=8 | 3644 | 200 | false | 持续失败 |  |
| 82 | `/dicom/compress` | CONSOLE_ERR=13 | 3816 | 200 | false | 持续失败 |  |
| 98 | `/ai-cad` | CONSOLE_ERR=3 | 3720 | 200 | false | 持续失败 |  |
| 83 | `/dicom/4d` | CONSOLE_ERR=12 | 3802 | 200 | false | 持续失败 |  |
| 84 | `/cross-modal-search` | CONSOLE_ERR=5 | 3623 | 200 | false | 持续失败 |  |
| 101 | `/ai/providers` | CONSOLE_ERR=4 | 3726 | 200 | false | 持续失败 |  |
| 102 | `/ai/lung-cad` | CONSOLE_ERR=4 | 3680 | 200 | false | 持续失败 |  |
| 85 | `/dicom/sr-manager` | CONSOLE_ERR=6 | 3783 | 200 | false | 持续失败 |  |
| 103 | `/ai/breast-cad` | CONSOLE_ERR=4 | 3678 | 200 | false | 持续失败 |  |
| 86 | `/dicom/radiomics` | CONSOLE_ERR=3 | 3696 | 200 | false | 持续失败 |  |
| 104 | `/ai/fracture-cad` | CONSOLE_ERR=4 | 3673 | 200 | false | 持续失败 |  |
| 87 | `/dicom/wado-rs` | CONSOLE_ERR=4 | 3679 | 200 | false | 持续失败 |  |
| 105 | `/ai/cardiac-ai` | CONSOLE_ERR=2, STUCK | 3627 | 200 | false | 持续失败 |  |
| 88 | `/dicom/stow-rs` | CONSOLE_ERR=4 | 3685 | 200 | false | 持续失败 |  |
| 106 | `/ai-marketplace` | CONSOLE_ERR=4 | 3642 | 200 | false | 持续失败 |  |
| 89 | `/dicom/sr-report` | CONSOLE_ERR=4 | 3677 | 200 | false | 持续失败 |  |
| 107 | `/ai/third-party` | CONSOLE_ERR=4 | 3695 | 200 | false | 持续失败 |  |
| 90 | `/dicom/dimse` | CONSOLE_ERR=3 | 183 | 200 | false | 持续失败 |  |
| 108 | `/ai/dl-denoise` | STUCK | 3627 | 200 | false | 持续失败 |  |
| 91 | `/dicom/sr-templates` | CONSOLE_ERR=5 | 3716 | 200 | false | 持续失败 |  |
| 109 | `/qc` | CONSOLE_ERR=4, STUCK | 3611 | 200 | false | 持续失败 |  |
| 110 | `/equipment-efficiency` | CONSOLE_ERR=4 | 4772 | 200 | false | 持续失败 |  |
| 112 | `/teach/lecture` | CONSOLE_ERR=2 | 3622 | 200 | false | 持续失败 |  |
| 95 | `/ai-structured-report` | CONSOLE_ERR=3 | 3936 | 200 | false | 持续失败 |  |
| 97 | `/ai-draft` | CONSOLE_ERR=8 | 3644 | 200 | false | 持续失败 |  |
| 98 | `/ai-cad` | CONSOLE_ERR=3 | 3720 | 200 | false | 持续失败 |  |
| 101 | `/ai/providers` | CONSOLE_ERR=4 | 3726 | 200 | false | 持续失败 |  |
| 102 | `/ai/lung-cad` | CONSOLE_ERR=4 | 3680 | 200 | false | 持续失败 |  |
| 103 | `/ai/breast-cad` | CONSOLE_ERR=4 | 3678 | 200 | false | 持续失败 |  |
| 120 | `/report-phrase-bank` | CONSOLE_ERR=3 | 4957 | 200 | true | ❌ 回归 |  |
| 104 | `/ai/fracture-cad` | CONSOLE_ERR=4 | 3673 | 200 | false | 持续失败 |  |
| 105 | `/ai/cardiac-ai` | CONSOLE_ERR=4 | 3690 | 200 | false | 持续失败 |  |
| 106 | `/ai-marketplace` | CONSOLE_ERR=4 | 3642 | 200 | false | 持续失败 |  |
| 107 | `/ai/third-party` | CONSOLE_ERR=6 | 3695 | 200 | false | 持续失败 |  |
| 108 | `/ai/dl-denoise` | CONSOLE_ERR=4 | 3743 | 200 | false | 持续失败 |  |
| 109 | `/qc` | CONSOLE_ERR=4 | 3611 | 200 | false | 持续失败 |  |
| 110 | `/equipment-efficiency` | CONSOLE_ERR=4 | 4772 | 200 | false | 持续失败 |  |
| 130 | `/regional-report` | CONSOLE_ERR=44 | 4055 | 200 | false | 持续失败 |  |
| 131 | `/schedule` | STUCK | 3611 | 200 | true | ❌ 回归 |  |
| 133 | `/hie/medical-alliance` | CONSOLE_ERR=2 | 3742 | 200 | false | 持续失败 |  |
| 134 | `/integration/fhir-server` | CONSOLE_ERR=2 | 3948 | 200 | false | 持续失败 |  |
| 135 | `/fhir/patient` | CONSOLE_ERR=5 | 3712 | 200 | false | 持续失败 |  |
| 136 | `/fhir/observation` | CONSOLE_ERR=7 | 3708 | 200 | false | 持续失败 |  |
| 137 | `/fhir/diagnostic-report` | CONSOLE_ERR=7 | 3738 | 200 | false | 持续失败 |  |
| 138 | `/fhir/imaging-study` | CONSOLE_ERR=7 | 3746 | 200 | false | 持续失败 |  |
| 139 | `/fhir/subscription` | CONSOLE_ERR=7 | 3721 | 200 | false | 持续失败 |  |
| 141 | `/integration/hl7-archive` | CONSOLE_ERR=8 | 3782 | 200 | false | 持续失败 |  |
| 142 | `/integration/hl7-builder` | CONSOLE_ERR=4 | 3793 | 200 | false | 持续失败 |  |
| 144 | `/ihe/pam` | CONSOLE_ERR=3 | 3787 | 200 | false | 持续失败 |  |
| 146 | `/ihe/manager` | CONSOLE_ERR=8 | 3690 | 200 | false | 持续失败 |  |
| 147 | `/hl7/manager` | CONSOLE_ERR=6 | 3867 | 200 | false | 持续失败 |  |
| 148 | `/integration/dimse` | CONSOLE_ERR=7 | 3976 | 200 | false | 持续失败 |  |
| 130 | `/regional-report` | CONSOLE_ERR=44 | 4055 | 200 | false | 持续失败 |  |
| 152 | `/clinical-data` | STUCK | 3613 | 200 | false | 持续失败 |  |
| 154 | `/mobile/patient` | CONSOLE_ERR=8 | 3758 | 200 | false | 持续失败 |  |
| 155 | `/mobile/doctor` | CONSOLE_ERR=8 | 3688 | 200 | false | 持续失败 |  |
| 135 | `/fhir/patient` | CONSOLE_ERR=7 | 3712 | 200 | false | 持续失败 |  |
| 136 | `/fhir/observation` | CONSOLE_ERR=5 | 3708 | 200 | false | 持续失败 |  |
| 137 | `/fhir/diagnostic-report` | CONSOLE_ERR=5 | 3738 | 200 | false | 持续失败 |  |
| 138 | `/fhir/imaging-study` | CONSOLE_ERR=7 | 3746 | 200 | false | 持续失败 |  |
| 158 | `/mobile/push` | CONSOLE_ERR=3 | 3831 | 200 | false | 持续失败 |  |
| 139 | `/fhir/subscription` | CONSOLE_ERR=5 | 3721 | 200 | false | 持续失败 |  |
| 159 | `/statistics` | STUCK | 3611 | 200 | true | ❌ 回归 |  |
| 141 | `/integration/hl7-archive` | CONSOLE_ERR=6 | 3782 | 200 | false | 持续失败 |  |
| 160 | `/green-it` | CONSOLE_ERR=4 | 3996 | 200 | false | 持续失败 |  |
| 142 | `/integration/hl7-builder` | CONSOLE_ERR=4 | 3793 | 200 | false | 持续失败 |  |
| 144 | `/ihe/pam` | CONSOLE_ERR=3 | 3787 | 200 | false | 持续失败 |  |
| 146 | `/ihe/manager` | CONSOLE_ERR=12 | 3690 | 200 | false | 持续失败 |  |
| 147 | `/hl7/manager` | CONSOLE_ERR=6 | 3867 | 200 | false | 持续失败 |  |
| 148 | `/integration/dimse` | CONSOLE_ERR=8 | 3976 | 200 | false | 持续失败 |  |
| 172 | `/operations/oee` | CONSOLE_ERR=10 | 3684 | 200 | false | 持续失败 |  |
| 173 | `/cardiac/database` | CONSOLE_ERR=5 | 3813 | 200 | false | 持续失败 |  |
| 154 | `/mobile/patient` | CONSOLE_ERR=12 | 3758 | 200 | false | 持续失败 |  |
| 155 | `/mobile/doctor` | CONSOLE_ERR=12 | 3688 | 200 | false | 持续失败 |  |
| 179 | `/operations/occupancy` | CONSOLE_ERR=6 | 3737 | 200 | false | 持续失败 |  |
| 181 | `/quality/department` | CONSOLE_ERR=12 | 4356 | 200 | false | 持续失败 |  |
| 158 | `/mobile/push` | CONSOLE_ERR=3 | 3831 | 200 | false | 持续失败 |  |
| 183 | `/analytics/benchmark-ai-diagnosis` | CONSOLE_ERR=6 | 3671 | 200 | false | 持续失败 |  |
| 190 | `/national-report` | CONSOLE_ERR=18 | 4620 | 200 | false | 持续失败 |  |
| 191 | `/data-report-center` | CONSOLE_ERR=2 | 4617 | 200 | false | 持续失败 |  |
| 192 | `/insurance-audit` | CONSOLE_ERR=6 | 5793 | 200 | false | 持续失败 |  |
| 193 | `/enterprise-search` | CONSOLE_ERR=2 | 3774 | 200 | false | 持续失败 |  |
| 196 | `/eye/pacs/fundus` | CONSOLE_ERR=3 | 4129 | 200 | false | 持续失败 |  |
| 198 | `/eye/pacs/oct-a` | CONSOLE_ERR=9 | 96 | 200 | false | 持续失败 |  |
| 172 | `/operations/oee` | CONSOLE_ERR=10 | 3684 | 200 | false | 持续失败 |  |
| 173 | `/cardiac/database` | CONSOLE_ERR=6 | 3813 | 200 | false | 持续失败 |  |
| 179 | `/operations/occupancy` | CONSOLE_ERR=6 | 3737 | 200 | false | 持续失败 |  |
| 181 | `/quality/department` | CONSOLE_ERR=12 | 4356 | 200 | false | 持续失败 |  |
| 183 | `/analytics/benchmark-ai-diagnosis` | CONSOLE_ERR=6 | 3671 | 200 | false | 持续失败 |  |
| 190 | `/national-report` | CONSOLE_ERR=22 | 4620 | 200 | false | 持续失败 |  |
| 192 | `/insurance-audit` | CONSOLE_ERR=6 | 5793 | 200 | false | 持续失败 |  |
| 196 | `/eye/pacs/fundus` | CONSOLE_ERR=3 | 4130 | 200 | false | 持续失败 |  |
| 198 | `/eye/pacs/oct-a` | CONSOLE_ERR=5 | 96 | 200 | false | 持续失败 |  |

## 三、修复效果对比 (v32 vs v33)

| 类型 | 数量 |
|------|:----:|
| 已修复按钮 (v32 失败 → v33 成功) | **100** |
| 回归按钮 (v32 成功 → v33 失败) | **4** |
| Alert 弹窗页面数 | **0** |

### 3.1 已修复按钮清单 (100)

| 路由 | 修复项 |
|------|--------|
| `/` | THROW: 8书写报告 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/` | THROW: 14危急值管理 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/` | THROW: 统计分析 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/` | THROW: 设备状态 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/` | THROW: 预约管理 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/` | THROW: 报告管理 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/write-report` | DEAD-BUTTON: (no-text) |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | DEAD-BUTTON: (no-text) |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | DEAD-BUTTON: (no-text) |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/write-report` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | DEAD-BUTTON: (no-text) |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/reports/v3-write` | THROW: (no-text) | elementHandle.click: Protocol error (DOM.scrollIntoViewIfNeeded): Cannot find co |
| `/critical-value` | DEAD-BUTTON: (no-text) |
| `/critical-value` | DEAD-BUTTON: (no-text) |
| `/critical-value` | DEAD-BUTTON: 规则配置 |
| `/critical-value` | DEAD-BUTTON: 统计大屏 |
| `/critical-value` | DEAD-BUTTON: 8 大分类评估 |
| `/critical-value` | DEAD-BUTTON: 趋势 |
| `/critical-value` | DEAD-BUTTON: 设备分布 |
| `/critical-value` | DEAD-BUTTON: 处理时效 |
| `/critical-value` | DEAD-BUTTON: 10分钟通报 |
| `/critical-value` | DEAD-BUTTON: (no-text) |
| `/critical-value` | DEAD-BUTTON: (no-text) |
| `/critical-value` | DEAD-BUTTON: 规则配置 |
| `/critical-value` | DEAD-BUTTON: 统计大屏 |
| `/critical-value` | DEAD-BUTTON: 8 大分类评估 |
| `/critical-value` | DEAD-BUTTON: 趋势 |
| `/critical-value` | DEAD-BUTTON: 设备分布 |
| `/critical-value` | DEAD-BUTTON: 处理时效 |
| `/critical-value` | DEAD-BUTTON: 10分钟通报 |
| `/special-assessment` | DEAD-BUTTON: (no-text) |
| `/special-assessment` | THROW: A - 脂肪型 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: B - 散在纤维腺体型 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: C - 不均匀致密型 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: D - 极度致密型 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: 无 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: 有 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | DEAD-BUTTON: (no-text) |
| `/special-assessment` | THROW: A - 脂肪型 | elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a |
| `/special-assessment` | THROW: B - 散在纤维腺体型 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/special-assessment` | THROW: C - 不均匀致密型 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/special-assessment` | THROW: D - 极度致密型 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/special-assessment` | THROW: 无 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/special-assessment` | THROW: 有 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | DEAD-BUTTON: (no-text) |
| `/blockchain-proof` | THROW: (no-text) | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | THROW: (no-text) | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | THROW: (no-text) | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | THROW: (no-text) | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | THROW: 验证真伪 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/blockchain-proof` | THROW: 区块浏览器 | elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp |
| `/sla-policy` | DEAD-BUTTON: (no-text) |
| `/sla-policy` | SKIP-DANGEROUS: 删除 |
| `/vna-dashboard` | DEAD-BUTTON: (no-text) |
| `/fusion/manager` | DEAD-BUTTON: (no-text) |
| `/vna-dashboard` | DEAD-BUTTON: (no-text) |
| `/ai/rads-scoring` | DEAD-BUTTON: (no-text) |
| `/ai/rads-scoring` | DEAD-BUTTON: loadHistory |
| `/fusion/manager` | DEAD-BUTTON: (no-text) |
| `/ai/rads-scoring` | DEAD-BUTTON: (no-text) |
| `/ai/rads-scoring` | DEAD-BUTTON: loadHistory |
| `/ihe/pix` | DEAD-BUTTON: (no-text) |
| `/teach/lecture` | DEAD-BUTTON: (no-text) |
| `/teach/lecture` | DEAD-BUTTON: 新建录制 |
| `/ihe/pix` | DEAD-BUTTON: (no-text) |
| `/integration/dimse/upload` | DEAD-BUTTON: (no-text) |
| `/hie/medical-alliance` | DEAD-BUTTON: (no-text) |
| `/hie/medical-alliance` | DEAD-BUTTON: 成员管理 |
| `/integration/fhir-server` | DEAD-BUTTON: (no-text) |
| `/integration/fhir-server` | DEAD-TAB: CapabilityStatement |
| `/integration/dimse/upload` | DEAD-BUTTON: (no-text) |
| `/clinical-data` | DEAD-BUTTON: (no-text) |
| `/clinical-data` | DEAD-BUTTON: 患者360视图 |
| `/auto-collection` | DEAD-BUTTON: (no-text) |
| `/analytics/benchmark-v2` | DEAD-BUTTON: (no-text) |
| `/analytics/tat-dashboard` | DEAD-BUTTON: (no-text) |
| `/green-it` | DEAD-BUTTON: (no-text) |
| `/green-it` | DEAD-BUTTON: 无纸化率趋势 |

### 3.2 回归按钮清单 (4)

| 路由 | 回归项 |
|------|--------|
| `/dicom/volume-viewer` | PAGE_REGRESSION |
| `/report-phrase-bank` | PAGE_REGRESSION |
| `/schedule` | PAGE_REGRESSION |
| `/statistics` | PAGE_REGRESSION |

## 四、失败按钮 / Tab 清单

共 200 条:

| 路由 | 失败原因 | 类型 |
|------|----------|------|
| `/` | THROW: 8书写报告 / elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a | 异常 |
| `/` | THROW: 14危急值管理 / elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a | 异常 |
| `/` | THROW: 统计分析 / elementHandle.click: Element is not visible
Call log:
[2m  - attempting click a | 异常 |
| `/` | THROW: 设备状态 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/` | THROW: 预约管理 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/` | THROW: 报告管理 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/worklist` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/worklist` | THROW: 看板 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/worklist` | DEAD-BUTTON: 全部 | 假按钮 |
| `/worklist` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/worklist` | THROW: 看板 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/worklist` | DEAD-BUTTON: 待检查 | 假按钮 |
| `/triage/worklist` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/triage/worklist` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/triage/dashboard` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/triage/dashboard` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/triage/dashboard` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/triage/dashboard` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/exams` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/exams` | DEAD-BUTTON: 检查列表 | 假按钮 |
| `/exams` | THROW: 转科追踪0 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 完成 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 质量 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 查看 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 开始 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/exams` | DEAD-BUTTON: 检查列表 | 假按钮 |
| `/exams` | THROW: 转科追踪0 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 完成 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 质量 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 查看 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/exams` | THROW: 开始 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/appointments` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/appointments` | DEAD-BUTTON: 日历 | 假按钮 |
| `/appointments` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/appointments` | DEAD-BUTTON: 日历 | 假按钮 |
| `/follow-up` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/follow-up` | DEAD-BUTTON: 🔄 重置 | 假按钮 |
| `/follow-up` | DEAD-BUTTON: 全部 (100) | 假按钮 |
| `/follow-up` | THROW: 详情 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/follow-up` | THROW: 完成 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/follow-up` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/follow-up` | DEAD-BUTTON: 🔄 重置 | 假按钮 |
| `/follow-up` | DEAD-BUTTON: 全部 (100) | 假按钮 |
| `/follow-up` | THROW: 详情 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/follow-up` | THROW: 完成 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/patient/self-service` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/patient/self-service` | THROW: 生成下载凭证 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/patient/self-service` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/patient/self-service` | THROW: 生成下载凭证 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/report-score-rule` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/report-score-rule` | DEAD-BUTTON: 恢复默认 | 假按钮 |
| `/report-score-rule` | DEAD-BUTTON: 保存配置 | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: 编辑 | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: 触发记录 | 假按钮 |
| `/report-defect-library` | SKIP-DANGEROUS: 删除 | 异常 |
| `/report-score-rule` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/report-score-rule` | DEAD-BUTTON: 恢复默认 | 假按钮 |
| `/report-score-rule` | DEAD-BUTTON: 保存配置 | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: 编辑 | 假按钮 |
| `/report-defect-library` | DEAD-BUTTON: 触发记录 | 假按钮 |
| `/report-defect-library` | SKIP-DANGEROUS: 删除 | 异常 |
| `/ca-signature` | DEAD-BUTTON: 重试 | 假按钮 |
| `/ca-signature` | THROW: 刷新页面 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/ca-signature` | THROW: 返回首页 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/ca-signature` | THROW: 查看帮助文档 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/blockchain-proof` | THROW: (no-text) / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | THROW: (no-text) / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | THROW: (no-text) / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | THROW: (no-text) / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | THROW: 验证真伪 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/blockchain-proof` | THROW: 区块浏览器 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/management` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 临床路径 | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 造影剂协议 | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 药物交互 | 假按钮 |
| `/ca-signature` | DEAD-BUTTON: 重试 | 假按钮 |
| `/ca-signature` | THROW: 刷新页面 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/ca-signature` | THROW: 返回首页 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/ca-signature` | THROW: 查看帮助文档 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/statistics` | DEAD-BUTTON: 重试 | 假按钮 |
| `/cds/statistics` | THROW: 刷新页面 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/statistics` | THROW: 返回首页 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/statistics` | THROW: 查看帮助文档 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/rule-config` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/review-center` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/review-center` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/review-center` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/quality-control` | DEAD-TAB: 实时仪表盘 | 假按钮 |
| `/cds/management` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 临床路径 | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 造影剂协议 | 假按钮 |
| `/cds/management` | DEAD-BUTTON: 药物交互 | 假按钮 |
| `/cds/statistics` | DEAD-BUTTON: 重试 | 假按钮 |
| `/cds/statistics` | THROW: 刷新页面 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/statistics` | THROW: 返回首页 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/cds/statistics` | THROW: 查看帮助文档 / elementHandle.click: Element is not attached to the DOM
Call log:
[2m  - attemp | 异常 |
| `/qc-dashboard` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-dashboard` | DEAD-BUTTON: 本周 | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: - | 假按钮 |
| `/cds/rule-config` | DEAD-BUTTON: + | 假按钮 |
| `/qc-image` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-image` | DEAD-BUTTON: CT | 假按钮 |
| `/qc-image` | DEAD-BUTTON: MR | 假按钮 |
| `/qc-image` | DEAD-BUTTON: DR | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: 许
许俊
D002 · 主任医师 | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: 许
许俊
D005 · 副主任医师 | 假按钮 |
| `/review-center` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/review-center` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/radpath/tracker` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/radpath/tracker` | DEAD-BUTTON: 查询 | 假按钮 |
| `/qc-dashboard` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-dashboard` | DEAD-BUTTON: 本周 | 假按钮 |
| `/workflow-designer` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-image` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-image` | DEAD-BUTTON: CT | 假按钮 |
| `/qc-image` | DEAD-BUTTON: MR | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: 许
许俊
D002 · 主任医师 | 假按钮 |
| `/qc-radiologist-annual` | DEAD-BUTTON: 许
许俊
D005 · 副主任医师 | 假按钮 |
| `/sla-policy` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/sla-policy` | SKIP-DANGEROUS: 删除 | 异常 |
| `/orchestrator` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/orchestrator` | DEAD-TAB: orchestrator.executions | 假按钮 |
| `/smart-mwl` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/radpath/tracker` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/radpath/tracker` | DEAD-BUTTON: 查询 | 假按钮 |
| `/ai-triage` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/smart-routing` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/smart-routing` | DEAD-TAB: 路由规则 | 假按钮 |
| `/workflow-designer` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/workflow-designer` | DEAD-BUTTON: 激活 | 假按钮 |
| `/radpath` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/critical-value-5step` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/orchestrator` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/orchestrator` | DEAD-TAB: orchestrator.designer | 假按钮 |
| `/orchestrator` | DEAD-TAB: orchestrator.executions | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: PET/CT | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: 轴位 | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/smart-mwl` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/smart-mwl` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: PET/CT | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: 刚性配准 | 假按钮 |
| `/ai-triage` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/volume-viewer` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/volume-viewer` | DEAD-TAB: MIP | 假按钮 |
| `/smart-routing` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/smart-routing` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/smart-routing` | DEAD-TAB: 路由规则 | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: 默认 | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: 重置 | 假按钮 |
| `/radpath` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/radpath` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/dicom/post-processing` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/post-processing` | DEAD-BUTTON: 锐化 | 假按钮 |
| `/critical-value-5step` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/dbt` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/dbt` | DEAD-BUTTON: 1x | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: PET/CT | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: 轴位 | 假按钮 |
| `/dicom/fusion` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/compress` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/compress` | DEAD-BUTTON: card.compress.decompressBtn | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: PET/CT | 假按钮 |
| `/dicom/fusion-v2` | DEAD-BUTTON: 刚性配准 | 假按钮 |
| `/dicom/4d` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/4d` | DEAD-BUTTON: 1x | 假按钮 |
| `/cross-modal-search` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/sr-manager` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/radiomics` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/wado-rs` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/wado-rs` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: 默认 | 假按钮 |
| `/dicom/vr` | DEAD-BUTTON: 重置 | 假按钮 |
| `/dicom/stow-rs` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/stow-rs` | DEAD-BUTTON: 刷新 | 假按钮 |
| `/dicom/sr-report` | DEAD-BUTTON: (no-text) | 假按钮 |
| `/dicom/sr-report` | DEAD-BUTTON: 刷新 | 假按钮 |

## 五、Console Error & Alert 统计

- Console errors 总数: **1233**
- Page errors 总数: **50**
- Alert 弹窗页面: **0**

## 六、截图清单

| # | 路由 | 截图文件 |
|---|------|----------|
| 0 | `/` | `e2e/screenshots-33/000_root.png` |
| 0 | `/` | `e2e/screenshots-200/000_root.png` |
| 1 | `/worklist` | `e2e/screenshots-200/001_worklist.png` |
| 1 | `/worklist` | `e2e/screenshots-33/001_worklist.png` |
| 2 | `/triage/worklist` | `e2e/screenshots-200/002_triage_worklist.png` |
| 2 | `/triage/worklist` | `e2e/screenshots-33/002_triage_worklist.png` |
| 3 | `/triage/dashboard` | `e2e/screenshots-200/003_triage_dashboard.png` |
| 3 | `/triage/dashboard` | `e2e/screenshots-33/003_triage_dashboard.png` |
| 4 | `/exams` | `e2e/screenshots-200/004_exams.png` |
| 4 | `/exams` | `e2e/screenshots-33/004_exams.png` |
| 5 | `/patients` | `e2e/screenshots-200/005_patients.png` |
| 5 | `/patients` | `e2e/screenshots-33/005_patients.png` |
| 6 | `/appointments` | `e2e/screenshots-200/006_appointments.png` |
| 7 | `/appointment-management` | `e2e/screenshots-200/007_appointment-management.png` |
| 6 | `/appointments` | `e2e/screenshots-33/006_appointments.png` |
| 7 | `/appointment-management` | `e2e/screenshots-33/007_appointment-management.png` |
| 8 | `/queue-call` | `e2e/screenshots-200/008_queue-call.png` |
| 9 | `/follow-up` | `e2e/screenshots-200/009_follow-up.png` |
| 8 | `/queue-call` | `e2e/screenshots-33/008_queue-call.png` |
| 10 | `/kiosk/check-in` | `e2e/screenshots-200/010_kiosk_check-in.png` |
| 9 | `/follow-up` | `e2e/screenshots-33/009_follow-up.png` |
| 11 | `/patient/self-service` | `e2e/screenshots-200/011_patient_self-service.png` |
| 10 | `/kiosk/check-in` | `e2e/screenshots-33/010_kiosk_check-in.png` |
| 12 | `/patient/service-management` | `e2e/screenshots-200/012_patient_service-management.png` |
| 11 | `/patient/self-service` | `e2e/screenshots-33/011_patient_self-service.png` |
| 13 | `/patients/:id/360` | `e2e/screenshots-200/013_patients__id_360.png` |
| 12 | `/patient/service-management` | `e2e/screenshots-33/012_patient_service-management.png` |
| 14 | `/write-report` | `e2e/screenshots-200/014_write-report.png` |
| 15 | `/reports/v3-write` | `e2e/screenshots-200/015_reports_v3-write.png` |
| 13 | `/patients/:id/360` | `e2e/screenshots-33/013_patients__id_360.png` |
| 14 | `/write-report` | `e2e/screenshots-33/014_write-report.png` |
| 16 | `/reports` | `e2e/screenshots-200/016_reports.png` |
| 15 | `/reports/v3-write` | `e2e/screenshots-33/015_reports_v3-write.png` |
| 17 | `/critical-value` | `e2e/screenshots-200/017_critical-value.png` |
| 16 | `/reports` | `e2e/screenshots-33/016_reports.png` |
| 18 | `/consultation` | `e2e/screenshots-200/018_consultation.png` |
| 19 | `/tele/conference` | `e2e/screenshots-200/019_tele_conference.png` |
| 17 | `/critical-value` | `e2e/screenshots-33/017_critical-value.png` |
| 20 | `/tele-sign` | `e2e/screenshots-200/020_tele-sign.png` |
| 18 | `/consultation` | `e2e/screenshots-33/018_consultation.png` |
| 21 | `/report-review` | `e2e/screenshots-200/021_report-review.png` |
| 19 | `/tele/conference` | `e2e/screenshots-33/019_tele_conference.png` |
| 22 | `/report-revisions` | `e2e/screenshots-200/022_report-revisions.png` |
| 20 | `/tele-sign` | `e2e/screenshots-33/020_tele-sign.png` |
| 23 | `/collaboration` | `e2e/screenshots-200/023_collaboration.png` |
| 21 | `/report-review` | `e2e/screenshots-33/021_report-review.png` |
| 24 | `/dual-read` | `e2e/screenshots-200/024_dual-read.png` |
| 25 | `/keyword-check` | `e2e/screenshots-200/025_keyword-check.png` |
| 22 | `/report-revisions` | `e2e/screenshots-33/022_report-revisions.png` |
| 26 | `/report-score-rule` | `e2e/screenshots-200/026_report-score-rule.png` |
| 23 | `/collaboration` | `e2e/screenshots-33/023_collaboration.png` |
| 24 | `/dual-read` | `e2e/screenshots-33/024_dual-read.png` |
| 27 | `/report-defect-library` | `e2e/screenshots-200/027_report-defect-library.png` |
| 25 | `/keyword-check` | `e2e/screenshots-33/025_keyword-check.png` |
| 28 | `/ai-report-draft` | `e2e/screenshots-200/028_ai-report-draft.png` |
| 29 | `/critical-value-rule` | `e2e/screenshots-200/029_critical-value-rule.png` |
| 30 | `/critical-value-stats` | `e2e/screenshots-200/030_critical-value-stats.png` |
| 26 | `/report-score-rule` | `e2e/screenshots-33/026_report-score-rule.png` |
| 31 | `/special-assessment` | `e2e/screenshots-200/031_special-assessment.png` |
| 27 | `/report-defect-library` | `e2e/screenshots-33/027_report-defect-library.png` |
| 28 | `/ai-report-draft` | `e2e/screenshots-33/028_ai-report-draft.png` |
| 32 | `/report-export` | `e2e/screenshots-200/032_report-export.png` |
| 29 | `/critical-value-rule` | `e2e/screenshots-33/029_critical-value-rule.png` |
| 33 | `/publish` | `e2e/screenshots-200/033_publish.png` |
| 30 | `/critical-value-stats` | `e2e/screenshots-33/030_critical-value-stats.png` |
| 34 | `/report-delivery` | `e2e/screenshots-200/034_report-delivery.png` |
| 35 | `/patient-report-portal` | `e2e/screenshots-200/035_patient-report-portal.png` |
| 31 | `/special-assessment` | `e2e/screenshots-33/031_special-assessment.png` |
| 36 | `/ca-signature` | `e2e/screenshots-200/036_ca-signature.png` |
| 32 | `/report-export` | `e2e/screenshots-33/032_report-export.png` |
| 37 | `/nlp/spellcheck` | `e2e/screenshots-200/037_nlp_spellcheck.png` |
| 38 | `/asr/transcribe` | `e2e/screenshots-200/038_asr_transcribe.png` |
| 33 | `/publish` | `e2e/screenshots-33/033_publish.png` |
| 39 | `/snomed/encode` | `e2e/screenshots-200/039_snomed_encode.png` |
| 40 | `/snomed/encoder` | `e2e/screenshots-200/040_snomed_encoder.png` |
| 34 | `/report-delivery` | `e2e/screenshots-33/034_report-delivery.png` |
| 41 | `/blockchain-proof` | `e2e/screenshots-200/041_blockchain-proof.png` |
| 35 | `/patient-report-portal` | `e2e/screenshots-33/035_patient-report-portal.png` |
| 42 | `/cds/management` | `e2e/screenshots-200/042_cds_management.png` |
| 36 | `/ca-signature` | `e2e/screenshots-33/036_ca-signature.png` |
| 43 | `/cds/statistics` | `e2e/screenshots-200/043_cds_statistics.png` |
| 37 | `/nlp/spellcheck` | `e2e/screenshots-33/037_nlp_spellcheck.png` |
| 44 | `/cds/rule-config` | `e2e/screenshots-200/044_cds_rule-config.png` |
| 38 | `/asr/transcribe` | `e2e/screenshots-33/038_asr_transcribe.png` |
| 39 | `/snomed/encode` | `e2e/screenshots-33/039_snomed_encode.png` |
| 45 | `/review-center` | `e2e/screenshots-200/045_review-center.png` |
| 40 | `/snomed/encoder` | `e2e/screenshots-33/040_snomed_encoder.png` |
| 41 | `/blockchain-proof` | `e2e/screenshots-33/041_blockchain-proof.png` |
| 46 | `/quality-control` | `e2e/screenshots-200/046_quality-control.png` |
| 47 | `/critical-value-center` | `e2e/screenshots-200/047_critical-value-center.png` |
| 42 | `/cds/management` | `e2e/screenshots-33/042_cds_management.png` |
| 48 | `/defect-management` | `e2e/screenshots-200/048_defect-management.png` |
| 43 | `/cds/statistics` | `e2e/screenshots-33/043_cds_statistics.png` |
| 49 | `/qc-dashboard` | `e2e/screenshots-200/049_qc-dashboard.png` |
| 44 | `/cds/rule-config` | `e2e/screenshots-33/044_cds_rule-config.png` |
| 50 | `/qc-image` | `e2e/screenshots-200/050_qc-image.png` |
| 51 | `/qc-radiologist-annual` | `e2e/screenshots-200/051_qc-radiologist-annual.png` |
| 45 | `/review-center` | `e2e/screenshots-33/045_review-center.png` |
| 52 | `/qc/image-ai` | `e2e/screenshots-200/052_qc_image-ai.png` |
| 46 | `/quality-control` | `e2e/screenshots-33/046_quality-control.png` |
| 53 | `/cosign` | `e2e/screenshots-200/053_cosign.png` |
| 47 | `/critical-value-center` | `e2e/screenshots-33/047_critical-value-center.png` |
| 54 | `/radpath/tracker` | `e2e/screenshots-200/054_radpath_tracker.png` |
| 48 | `/defect-management` | `e2e/screenshots-33/048_defect-management.png` |
| 55 | `/critical-alert` | `e2e/screenshots-200/055_critical-alert.png` |
| 49 | `/qc-dashboard` | `e2e/screenshots-33/049_qc-dashboard.png` |
| 56 | `/workflow-designer` | `e2e/screenshots-200/056_workflow-designer.png` |
| 57 | `/routing-rules` | `e2e/screenshots-200/057_routing-rules.png` |
| 50 | `/qc-image` | `e2e/screenshots-33/050_qc-image.png` |
| 58 | `/workload-heatmap` | `e2e/screenshots-200/058_workload-heatmap.png` |
| 51 | `/qc-radiologist-annual` | `e2e/screenshots-33/051_qc-radiologist-annual.png` |
| 59 | `/sla-policy` | `e2e/screenshots-200/059_sla-policy.png` |
| 52 | `/qc/image-ai` | `e2e/screenshots-33/052_qc_image-ai.png` |
| 60 | `/smart-route` | `e2e/screenshots-200/060_smart-route.png` |
| 61 | `/orchestrator` | `e2e/screenshots-200/061_orchestrator.png` |
| 53 | `/cosign` | `e2e/screenshots-33/053_cosign.png` |
| 62 | `/smart-mwl` | `e2e/screenshots-200/062_smart-mwl.png` |
| 54 | `/radpath/tracker` | `e2e/screenshots-33/054_radpath_tracker.png` |
| 63 | `/ai-triage` | `e2e/screenshots-200/063_ai-triage.png` |
| 55 | `/critical-alert` | `e2e/screenshots-33/055_critical-alert.png` |
| 64 | `/smart-routing` | `e2e/screenshots-200/064_smart-routing.png` |
| 56 | `/workflow-designer` | `e2e/screenshots-33/056_workflow-designer.png` |
| 65 | `/cosign-review` | `e2e/screenshots-200/065_cosign-review.png` |
| 66 | `/radpath` | `e2e/screenshots-200/066_radpath.png` |
| 57 | `/routing-rules` | `e2e/screenshots-33/057_routing-rules.png` |
| 67 | `/critical-value-5step` | `e2e/screenshots-200/067_critical-value-5step.png` |
| 58 | `/workload-heatmap` | `e2e/screenshots-33/058_workload-heatmap.png` |
| 59 | `/sla-policy` | `e2e/screenshots-33/059_sla-policy.png` |
| 68 | `/dicom-viewer` | `e2e/screenshots-200/068_dicom-viewer.png` |
| 60 | `/smart-route` | `e2e/screenshots-33/060_smart-route.png` |
| 69 | `/dicom-viewer-pro` | `e2e/screenshots-200/069_dicom-viewer-pro.png` |
| 61 | `/orchestrator` | `e2e/screenshots-33/061_orchestrator.png` |
| 70 | `/dicom/fusion` | `e2e/screenshots-200/070_dicom_fusion.png` |
| 62 | `/smart-mwl` | `e2e/screenshots-33/062_smart-mwl.png` |
| 71 | `/dicom/fusion-v2` | `e2e/screenshots-200/071_dicom_fusion-v2.png` |
| 63 | `/ai-triage` | `e2e/screenshots-33/063_ai-triage.png` |
| 72 | `/dicom/volume-viewer` | `e2e/screenshots-200/072_dicom_volume-viewer.png` |
| 64 | `/smart-routing` | `e2e/screenshots-33/064_smart-routing.png` |
| 73 | `/dicom/mpr` | `e2e/screenshots-200/073_dicom_mpr.png` |
| 74 | `/dicom/mip` | `e2e/screenshots-200/074_dicom_mip.png` |
| 65 | `/cosign-review` | `e2e/screenshots-33/065_cosign-review.png` |
| 75 | `/dicom/vr` | `e2e/screenshots-200/075_dicom_vr.png` |
| 66 | `/radpath` | `e2e/screenshots-33/066_radpath.png` |
| 76 | `/dicom/post-processing` | `e2e/screenshots-200/076_dicom_post-processing.png` |
| 67 | `/critical-value-5step` | `e2e/screenshots-33/067_critical-value-5step.png` |
| 77 | `/dicom/dbt` | `e2e/screenshots-200/077_dicom_dbt.png` |
| 68 | `/dicom-viewer` | `e2e/screenshots-33/068_dicom-viewer.png` |
| 78 | `/print-management` | `e2e/screenshots-200/078_print-management.png` |
| 79 | `/ai-assist` | `e2e/screenshots-200/079_ai-assist.png` |
| 69 | `/dicom-viewer-pro` | `e2e/screenshots-33/069_dicom-viewer-pro.png` |
| 80 | `/vna-dashboard` | `e2e/screenshots-200/080_vna-dashboard.png` |
| 81 | `/dicom/web` | `e2e/screenshots-200/081_dicom_web.png` |
| 70 | `/dicom/fusion` | `e2e/screenshots-33/070_dicom_fusion.png` |
| 82 | `/dicom/compress` | `e2e/screenshots-200/082_dicom_compress.png` |
| 71 | `/dicom/fusion-v2` | `e2e/screenshots-33/071_dicom_fusion-v2.png` |
| 83 | `/dicom/4d` | `e2e/screenshots-200/083_dicom_4d.png` |
| 72 | `/dicom/volume-viewer` | `e2e/screenshots-33/072_dicom_volume-viewer.png` |
| 84 | `/cross-modal-search` | `e2e/screenshots-200/084_cross-modal-search.png` |
| 73 | `/dicom/mpr` | `e2e/screenshots-33/073_dicom_mpr.png` |
| 85 | `/dicom/sr-manager` | `e2e/screenshots-200/085_dicom_sr-manager.png` |
| 74 | `/dicom/mip` | `e2e/screenshots-33/074_dicom_mip.png` |
| 86 | `/dicom/radiomics` | `e2e/screenshots-200/086_dicom_radiomics.png` |
| 87 | `/dicom/wado-rs` | `e2e/screenshots-200/087_dicom_wado-rs.png` |
| 75 | `/dicom/vr` | `e2e/screenshots-33/075_dicom_vr.png` |
| 88 | `/dicom/stow-rs` | `e2e/screenshots-200/088_dicom_stow-rs.png` |
| 89 | `/dicom/sr-report` | `e2e/screenshots-200/089_dicom_sr-report.png` |
| 76 | `/dicom/post-processing` | `e2e/screenshots-33/076_dicom_post-processing.png` |
| 90 | `/dicom/dimse` | `e2e/screenshots-200/090_dicom_dimse.png` |
| 77 | `/dicom/dbt` | `e2e/screenshots-33/077_dicom_dbt.png` |
| 91 | `/dicom/sr-templates` | `e2e/screenshots-200/091_dicom_sr-templates.png` |
| 92 | `/fusion/manager` | `e2e/screenshots-200/092_fusion_manager.png` |
| 78 | `/print-management` | `e2e/screenshots-33/078_print-management.png` |
| 93 | `/radiomics/features` | `e2e/screenshots-200/093_radiomics_features.png` |
| 94 | `/ai-qc` | `e2e/screenshots-200/094_ai-qc.png` |
| 79 | `/ai-assist` | `e2e/screenshots-33/079_ai-assist.png` |
| 80 | `/vna-dashboard` | `e2e/screenshots-33/080_vna-dashboard.png` |
| 95 | `/ai-structured-report` | `e2e/screenshots-200/095_ai-structured-report.png` |
| 81 | `/dicom/web` | `e2e/screenshots-33/081_dicom_web.png` |
| 96 | `/ai-medical-device` | `e2e/screenshots-200/096_ai-medical-device.png` |
| 97 | `/ai-draft` | `e2e/screenshots-200/097_ai-draft.png` |
| 82 | `/dicom/compress` | `e2e/screenshots-33/082_dicom_compress.png` |
| 98 | `/ai-cad` | `e2e/screenshots-200/098_ai-cad.png` |
| 83 | `/dicom/4d` | `e2e/screenshots-33/083_dicom_4d.png` |
| 99 | `/ai/rads-scoring` | `e2e/screenshots-200/099_ai_rads-scoring.png` |
| 100 | `/ai/review` | `e2e/screenshots-200/100_ai_review.png` |
| 84 | `/cross-modal-search` | `e2e/screenshots-33/084_cross-modal-search.png` |
| 101 | `/ai/providers` | `e2e/screenshots-200/101_ai_providers.png` |
| 102 | `/ai/lung-cad` | `e2e/screenshots-200/102_ai_lung-cad.png` |
| 85 | `/dicom/sr-manager` | `e2e/screenshots-33/085_dicom_sr-manager.png` |
| 103 | `/ai/breast-cad` | `e2e/screenshots-200/103_ai_breast-cad.png` |
| 86 | `/dicom/radiomics` | `e2e/screenshots-33/086_dicom_radiomics.png` |
| 104 | `/ai/fracture-cad` | `e2e/screenshots-200/104_ai_fracture-cad.png` |
| 87 | `/dicom/wado-rs` | `e2e/screenshots-33/087_dicom_wado-rs.png` |
| 105 | `/ai/cardiac-ai` | `e2e/screenshots-200/105_ai_cardiac-ai.png` |
| 88 | `/dicom/stow-rs` | `e2e/screenshots-33/088_dicom_stow-rs.png` |
| 106 | `/ai-marketplace` | `e2e/screenshots-200/106_ai-marketplace.png` |
| 89 | `/dicom/sr-report` | `e2e/screenshots-33/089_dicom_sr-report.png` |
| 107 | `/ai/third-party` | `e2e/screenshots-200/107_ai_third-party.png` |
| 90 | `/dicom/dimse` | `e2e/screenshots-33/090_dicom_dimse.png` |
| 108 | `/ai/dl-denoise` | `e2e/screenshots-200/108_ai_dl-denoise.png` |
| 91 | `/dicom/sr-templates` | `e2e/screenshots-33/091_dicom_sr-templates.png` |
| 92 | `/fusion/manager` | `e2e/screenshots-33/092_fusion_manager.png` |
| 109 | `/qc` | `e2e/screenshots-200/109_qc.png` |
| 110 | `/equipment-efficiency` | `e2e/screenshots-200/110_equipment-efficiency.png` |
| 93 | `/radiomics/features` | `e2e/screenshots-33/093_radiomics_features.png` |
| 94 | `/ai-qc` | `e2e/screenshots-33/094_ai-qc.png` |
| 111 | `/typical-cases` | `e2e/screenshots-200/111_typical-cases.png` |
| 112 | `/teach/lecture` | `e2e/screenshots-200/112_teach_lecture.png` |
| 95 | `/ai-structured-report` | `e2e/screenshots-33/095_ai-structured-report.png` |
| 113 | `/finding-library` | `e2e/screenshots-200/113_finding-library.png` |
| 96 | `/ai-medical-device` | `e2e/screenshots-33/096_ai-medical-device.png` |
| 97 | `/ai-draft` | `e2e/screenshots-33/097_ai-draft.png` |
| 98 | `/ai-cad` | `e2e/screenshots-33/098_ai-cad.png` |
| 114 | `/term-library` | `e2e/screenshots-200/114_term-library.png` |
| 99 | `/ai/rads-scoring` | `e2e/screenshots-33/099_ai_rads-scoring.png` |
| 115 | `/template-management` | `e2e/screenshots-200/115_template-management.png` |
| 116 | `/template-designer` | `e2e/screenshots-200/116_template-designer.png` |
| 100 | `/ai/review` | `e2e/screenshots-33/100_ai_review.png` |
| 117 | `/template-inheritance` | `e2e/screenshots-200/117_template-inheritance.png` |
| 101 | `/ai/providers` | `e2e/screenshots-33/101_ai_providers.png` |
| 118 | `/template-category` | `e2e/screenshots-200/118_template-category.png` |
| 102 | `/ai/lung-cad` | `e2e/screenshots-33/102_ai_lung-cad.png` |
| 119 | `/term-synonym-graph` | `e2e/screenshots-200/119_term-synonym-graph.png` |
| 103 | `/ai/breast-cad` | `e2e/screenshots-33/103_ai_breast-cad.png` |
| 120 | `/report-phrase-bank` | `e2e/screenshots-200/120_report-phrase-bank.png` |
| 104 | `/ai/fracture-cad` | `e2e/screenshots-33/104_ai_fracture-cad.png` |
| 105 | `/ai/cardiac-ai` | `e2e/screenshots-33/105_ai_cardiac-ai.png` |
| 121 | `/safety/adverse-events` | `e2e/screenshots-200/121_safety_adverse-events.png` |
| 106 | `/ai-marketplace` | `e2e/screenshots-33/106_ai-marketplace.png` |
| 122 | `/safety/cqi` | `e2e/screenshots-200/122_safety_cqi.png` |
| 107 | `/ai/third-party` | `e2e/screenshots-33/107_ai_third-party.png` |
| 123 | `/safety/patient-safety-goals` | `e2e/screenshots-200/123_safety_patient-safety-goals.png` |
| 124 | `/safety/radiation-safety` | `e2e/screenshots-200/124_safety_radiation-safety.png` |
| 108 | `/ai/dl-denoise` | `e2e/screenshots-33/108_ai_dl-denoise.png` |
| 125 | `/safety/rca-analysis` | `e2e/screenshots-200/125_safety_rca-analysis.png` |
| 109 | `/qc` | `e2e/screenshots-33/109_qc.png` |
| 126 | `/safety/risk-management` | `e2e/screenshots-200/126_safety_risk-management.png` |
| 110 | `/equipment-efficiency` | `e2e/screenshots-33/110_equipment-efficiency.png` |
| 127 | `/ihe/pix` | `e2e/screenshots-200/127_ihe_pix.png` |
| 128 | `/integration/fhir/bulk-export` | `e2e/screenshots-200/128_integration_fhir_bulk-export.png` |
| 111 | `/typical-cases` | `e2e/screenshots-33/111_typical-cases.png` |
| 129 | `/integration/fhir/bulk-export-detail` | `e2e/screenshots-200/129_integration_fhir_bulk-export-detail.png` |
| 112 | `/teach/lecture` | `e2e/screenshots-33/112_teach_lecture.png` |
| 113 | `/finding-library` | `e2e/screenshots-33/113_finding-library.png` |
| 130 | `/regional-report` | `e2e/screenshots-200/130_regional-report.png` |
| 131 | `/schedule` | `e2e/screenshots-200/131_schedule.png` |
| 114 | `/term-library` | `e2e/screenshots-33/114_term-library.png` |
| 132 | `/department` | `e2e/screenshots-200/132_department.png` |
| 115 | `/template-management` | `e2e/screenshots-33/115_template-management.png` |
| 133 | `/hie/medical-alliance` | `e2e/screenshots-200/133_hie_medical-alliance.png` |
| 116 | `/template-designer` | `e2e/screenshots-33/116_template-designer.png` |
| 134 | `/integration/fhir-server` | `e2e/screenshots-200/134_integration_fhir-server.png` |
| 117 | `/template-inheritance` | `e2e/screenshots-33/117_template-inheritance.png` |
| 135 | `/fhir/patient` | `e2e/screenshots-200/135_fhir_patient.png` |
| 118 | `/template-category` | `e2e/screenshots-33/118_template-category.png` |
| 119 | `/term-synonym-graph` | `e2e/screenshots-33/119_term-synonym-graph.png` |
| 136 | `/fhir/observation` | `e2e/screenshots-200/136_fhir_observation.png` |
| 120 | `/report-phrase-bank` | `e2e/screenshots-33/120_report-phrase-bank.png` |
| 137 | `/fhir/diagnostic-report` | `e2e/screenshots-200/137_fhir_diagnostic-report.png` |
| 138 | `/fhir/imaging-study` | `e2e/screenshots-200/138_fhir_imaging-study.png` |
| 121 | `/safety/adverse-events` | `e2e/screenshots-33/121_safety_adverse-events.png` |
| 139 | `/fhir/subscription` | `e2e/screenshots-200/139_fhir_subscription.png` |
| 122 | `/safety/cqi` | `e2e/screenshots-33/122_safety_cqi.png` |
| 140 | `/integration/ihe-connectathon` | `e2e/screenshots-200/140_integration_ihe-connectathon.png` |
| 123 | `/safety/patient-safety-goals` | `e2e/screenshots-33/123_safety_patient-safety-goals.png` |
| 141 | `/integration/hl7-archive` | `e2e/screenshots-200/141_integration_hl7-archive.png` |
| 142 | `/integration/hl7-builder` | `e2e/screenshots-200/142_integration_hl7-builder.png` |
| 124 | `/safety/radiation-safety` | `e2e/screenshots-33/124_safety_radiation-safety.png` |
| 143 | `/hl7-siu` | `e2e/screenshots-200/143_hl7-siu.png` |
| 125 | `/safety/rca-analysis` | `e2e/screenshots-33/125_safety_rca-analysis.png` |
| 144 | `/ihe/pam` | `e2e/screenshots-200/144_ihe_pam.png` |
| 126 | `/safety/risk-management` | `e2e/screenshots-33/126_safety_risk-management.png` |
| 145 | `/ihe/visit` | `e2e/screenshots-200/145_ihe_visit.png` |
| 146 | `/ihe/manager` | `e2e/screenshots-200/146_ihe_manager.png` |
| 127 | `/ihe/pix` | `e2e/screenshots-33/127_ihe_pix.png` |
| 128 | `/integration/fhir/bulk-export` | `e2e/screenshots-33/128_integration_fhir_bulk-export.png` |
| 147 | `/hl7/manager` | `e2e/screenshots-200/147_hl7_manager.png` |
| 129 | `/integration/fhir/bulk-export-detail` | `e2e/screenshots-33/129_integration_fhir_bulk-export-detail.png` |
| 148 | `/integration/dimse` | `e2e/screenshots-200/148_integration_dimse.png` |
| 149 | `/integration/dimse/upload` | `e2e/screenshots-200/149_integration_dimse_upload.png` |
| 150 | `/cancer-screen` | `e2e/screenshots-200/150_cancer-screen.png` |
| 130 | `/regional-report` | `e2e/screenshots-33/130_regional-report.png` |
| 151 | `/patient-portal` | `e2e/screenshots-200/151_patient-portal.png` |
| 131 | `/schedule` | `e2e/screenshots-33/131_schedule.png` |
| 152 | `/clinical-data` | `e2e/screenshots-200/152_clinical-data.png` |
| 153 | `/education/patient-education` | `e2e/screenshots-200/153_education_patient-education.png` |
| 132 | `/department` | `e2e/screenshots-33/132_department.png` |
| 154 | `/mobile/patient` | `e2e/screenshots-200/154_mobile_patient.png` |
| 133 | `/hie/medical-alliance` | `e2e/screenshots-33/133_hie_medical-alliance.png` |
| 134 | `/integration/fhir-server` | `e2e/screenshots-33/134_integration_fhir-server.png` |
| 155 | `/mobile/doctor` | `e2e/screenshots-200/155_mobile_doctor.png` |
| 135 | `/fhir/patient` | `e2e/screenshots-33/135_fhir_patient.png` |
| 156 | `/mobile/nurse` | `e2e/screenshots-200/156_mobile_nurse.png` |
| 136 | `/fhir/observation` | `e2e/screenshots-33/136_fhir_observation.png` |
| 137 | `/fhir/diagnostic-report` | `e2e/screenshots-33/137_fhir_diagnostic-report.png` |
| 157 | `/mobile/tech` | `e2e/screenshots-200/157_mobile_tech.png` |
| 138 | `/fhir/imaging-study` | `e2e/screenshots-33/138_fhir_imaging-study.png` |
| 158 | `/mobile/push` | `e2e/screenshots-200/158_mobile_push.png` |
| 139 | `/fhir/subscription` | `e2e/screenshots-33/139_fhir_subscription.png` |
| 159 | `/statistics` | `e2e/screenshots-200/159_statistics.png` |
| 140 | `/integration/ihe-connectathon` | `e2e/screenshots-33/140_integration_ihe-connectathon.png` |
| 141 | `/integration/hl7-archive` | `e2e/screenshots-33/141_integration_hl7-archive.png` |
| 160 | `/green-it` | `e2e/screenshots-200/160_green-it.png` |
| 161 | `/dept-dashboard` | `e2e/screenshots-200/161_dept-dashboard.png` |
| 142 | `/integration/hl7-builder` | `e2e/screenshots-33/142_integration_hl7-builder.png` |
| 162 | `/remote-reading` | `e2e/screenshots-200/162_remote-reading.png` |
| 163 | `/operations-center` | `e2e/screenshots-200/163_operations-center.png` |
| 143 | `/hl7-siu` | `e2e/screenshots-33/143_hl7-siu.png` |
| 164 | `/cost-analysis` | `e2e/screenshots-200/164_cost-analysis.png` |
| 144 | `/ihe/pam` | `e2e/screenshots-33/144_ihe_pam.png` |
| 145 | `/ihe/visit` | `e2e/screenshots-33/145_ihe_visit.png` |
| 165 | `/stats-report` | `e2e/screenshots-200/165_stats-report.png` |
| 146 | `/ihe/manager` | `e2e/screenshots-33/146_ihe_manager.png` |
| 166 | `/nuclear-stats` | `e2e/screenshots-200/166_nuclear-stats.png` |
| 167 | `/report-kpi-dashboard` | `e2e/screenshots-200/167_report-kpi-dashboard.png` |
| 147 | `/hl7/manager` | `e2e/screenshots-33/147_hl7_manager.png` |
| 168 | `/doctor-workload` | `e2e/screenshots-200/168_doctor-workload.png` |
| 148 | `/integration/dimse` | `e2e/screenshots-33/148_integration_dimse.png` |
| 169 | `/diagnosis-accuracy` | `e2e/screenshots-200/169_diagnosis-accuracy.png` |
| 149 | `/integration/dimse/upload` | `e2e/screenshots-33/149_integration_dimse_upload.png` |
| 170 | `/report-timeliness` | `e2e/screenshots-200/170_report-timeliness.png` |
| 150 | `/cancer-screen` | `e2e/screenshots-33/150_cancer-screen.png` |
| 171 | `/report-search` | `e2e/screenshots-200/171_report-search.png` |
| 151 | `/patient-portal` | `e2e/screenshots-33/151_patient-portal.png` |
| 172 | `/operations/oee` | `e2e/screenshots-200/172_operations_oee.png` |
| 173 | `/cardiac/database` | `e2e/screenshots-200/173_cardiac_database.png` |
| 174 | `/cardiac/operations` | `e2e/screenshots-200/174_cardiac_operations.png` |
| 152 | `/clinical-data` | `e2e/screenshots-33/152_clinical-data.png` |
| 175 | `/cardiac/qc` | `e2e/screenshots-200/175_cardiac_qc.png` |
| 153 | `/education/patient-education` | `e2e/screenshots-33/153_education_patient-education.png` |
| 176 | `/ops/devices` | `e2e/screenshots-200/176_ops_devices.png` |
| 154 | `/mobile/patient` | `e2e/screenshots-33/154_mobile_patient.png` |
| 177 | `/ops/hr` | `e2e/screenshots-200/177_ops_hr.png` |
| 155 | `/mobile/doctor` | `e2e/screenshots-33/155_mobile_doctor.png` |
| 178 | `/ops/dashboard` | `e2e/screenshots-200/178_ops_dashboard.png` |
| 179 | `/operations/occupancy` | `e2e/screenshots-200/179_operations_occupancy.png` |
| 180 | `/auto-collection` | `e2e/screenshots-200/180_auto-collection.png` |
| 156 | `/mobile/nurse` | `e2e/screenshots-33/156_mobile_nurse.png` |
| 181 | `/quality/department` | `e2e/screenshots-200/181_quality_department.png` |
| 157 | `/mobile/tech` | `e2e/screenshots-33/157_mobile_tech.png` |
| 158 | `/mobile/push` | `e2e/screenshots-33/158_mobile_push.png` |
| 182 | `/analytics/benchmark-v2` | `e2e/screenshots-200/182_analytics_benchmark-v2.png` |
| 183 | `/analytics/benchmark-ai-diagnosis` | `e2e/screenshots-200/183_analytics_benchmark-ai-diagnosis.png` |
| 159 | `/statistics` | `e2e/screenshots-33/159_statistics.png` |
| 184 | `/analytics/tat-dashboard` | `e2e/screenshots-200/184_analytics_tat-dashboard.png` |
| 185 | `/charge-items` | `e2e/screenshots-200/185_charge-items.png` |
| 160 | `/green-it` | `e2e/screenshots-33/160_green-it.png` |
| 186 | `/accounts-receivable` | `e2e/screenshots-200/186_accounts-receivable.png` |
| 161 | `/dept-dashboard` | `e2e/screenshots-33/161_dept-dashboard.png` |
| 187 | `/revenue-analysis` | `e2e/screenshots-200/187_revenue-analysis.png` |
| 162 | `/remote-reading` | `e2e/screenshots-33/162_remote-reading.png` |
| 188 | `/cost-accounting` | `e2e/screenshots-200/188_cost-accounting.png` |
| 163 | `/operations-center` | `e2e/screenshots-33/163_operations-center.png` |
| 189 | `/financial-reports` | `e2e/screenshots-200/189_financial-reports.png` |
| 164 | `/cost-analysis` | `e2e/screenshots-33/164_cost-analysis.png` |
| 190 | `/national-report` | `e2e/screenshots-200/190_national-report.png` |
| 165 | `/stats-report` | `e2e/screenshots-33/165_stats-report.png` |
| 191 | `/data-report-center` | `e2e/screenshots-200/191_data-report-center.png` |
| 166 | `/nuclear-stats` | `e2e/screenshots-33/166_nuclear-stats.png` |
| 192 | `/insurance-audit` | `e2e/screenshots-200/192_insurance-audit.png` |
| 167 | `/report-kpi-dashboard` | `e2e/screenshots-33/167_report-kpi-dashboard.png` |
| 193 | `/enterprise-search` | `e2e/screenshots-200/193_enterprise-search.png` |
| 168 | `/doctor-workload` | `e2e/screenshots-33/168_doctor-workload.png` |
| 194 | `/eye` | `e2e/screenshots-200/194_eye.png` |
| 169 | `/diagnosis-accuracy` | `e2e/screenshots-33/169_diagnosis-accuracy.png` |
| 195 | `/eye/pacs` | `e2e/screenshots-200/195_eye_pacs.png` |
| 170 | `/report-timeliness` | `e2e/screenshots-33/170_report-timeliness.png` |
| 196 | `/eye/pacs/fundus` | `e2e/screenshots-200/196_eye_pacs_fundus.png` |
| 171 | `/report-search` | `e2e/screenshots-33/171_report-search.png` |
| 197 | `/eye/pacs/oct` | `e2e/screenshots-200/197_eye_pacs_oct.png` |
| 198 | `/eye/pacs/oct-a` | `e2e/screenshots-200/198_eye_pacs_oct-a.png` |
| 172 | `/operations/oee` | `e2e/screenshots-33/172_operations_oee.png` |
| 199 | `/eye/pacs/visual-field` | `e2e/screenshots-200/199_eye_pacs_visual-field.png` |
| 173 | `/cardiac/database` | `e2e/screenshots-33/173_cardiac_database.png` |
| 174 | `/cardiac/operations` | `e2e/screenshots-33/174_cardiac_operations.png` |
| 175 | `/cardiac/qc` | `e2e/screenshots-33/175_cardiac_qc.png` |
| 176 | `/ops/devices` | `e2e/screenshots-33/176_ops_devices.png` |
| 177 | `/ops/hr` | `e2e/screenshots-33/177_ops_hr.png` |
| 178 | `/ops/dashboard` | `e2e/screenshots-33/178_ops_dashboard.png` |
| 179 | `/operations/occupancy` | `e2e/screenshots-33/179_operations_occupancy.png` |
| 180 | `/auto-collection` | `e2e/screenshots-33/180_auto-collection.png` |
| 181 | `/quality/department` | `e2e/screenshots-33/181_quality_department.png` |
| 182 | `/analytics/benchmark-v2` | `e2e/screenshots-33/182_analytics_benchmark-v2.png` |
| 183 | `/analytics/benchmark-ai-diagnosis` | `e2e/screenshots-33/183_analytics_benchmark-ai-diagnosis.png` |
| 184 | `/analytics/tat-dashboard` | `e2e/screenshots-33/184_analytics_tat-dashboard.png` |
| 185 | `/charge-items` | `e2e/screenshots-33/185_charge-items.png` |
| 186 | `/accounts-receivable` | `e2e/screenshots-33/186_accounts-receivable.png` |
| 187 | `/revenue-analysis` | `e2e/screenshots-33/187_revenue-analysis.png` |
| 188 | `/cost-accounting` | `e2e/screenshots-33/188_cost-accounting.png` |
| 189 | `/financial-reports` | `e2e/screenshots-33/189_financial-reports.png` |
| 190 | `/national-report` | `e2e/screenshots-33/190_national-report.png` |
| 191 | `/data-report-center` | `e2e/screenshots-33/191_data-report-center.png` |
| 192 | `/insurance-audit` | `e2e/screenshots-33/192_insurance-audit.png` |
| 193 | `/enterprise-search` | `e2e/screenshots-33/193_enterprise-search.png` |
| 194 | `/eye` | `e2e/screenshots-33/194_eye.png` |
| 195 | `/eye/pacs` | `e2e/screenshots-33/195_eye_pacs.png` |
| 196 | `/eye/pacs/fundus` | `e2e/screenshots-33/196_eye_pacs_fundus.png` |
| 197 | `/eye/pacs/oct` | `e2e/screenshots-33/197_eye_pacs_oct.png` |
| 198 | `/eye/pacs/oct-a` | `e2e/screenshots-33/198_eye_pacs_oct-a.png` |
| 199 | `/eye/pacs/visual-field` | `e2e/screenshots-33/199_eye_pacs_visual-field.png` |

## 七、全部页面结果

| # | 路由 | pass | body | 按钮 | Tab | 用时 | Alert | v32 对比 |
|---|------|:----:|:----:|:----:|:---:|:----:|:----:|:---------:|
| 0 | `/` | ✅ | 10888 | undefined/13 | 0/0 | 10496ms |  | 🆕修复 |
| 0 | `/` | ❌ | 10888 | undefined/13 | 0/0 | 9788ms |  | 持续失败 |
| 1 | `/worklist` | ❌ | 4015 | undefined/20 | 0/0 | 10452ms |  | 持续失败 |
| 1 | `/worklist` | ❌ | 4015 | undefined/20 | 0/0 | 11594ms |  | 持续失败 |
| 2 | `/triage/worklist` | ❌ | 3797 | undefined/3 | 0/0 | 4353ms |  | 持续失败 |
| 2 | `/triage/worklist` | ❌ | 3797 | undefined/3 | 0/0 | 5006ms |  | 持续失败 |
| 3 | `/triage/dashboard` | ❌ | 3731 | undefined/4 | 0/0 | 4764ms |  | 持续失败 |
| 3 | `/triage/dashboard` | ❌ | 3731 | undefined/4 | 0/0 | 5459ms |  | 持续失败 |
| 4 | `/exams` | ❌ | 4759 | undefined/20 | 0/0 | 8593ms |  | 持续失败 |
| 4 | `/exams` | ❌ | 4759 | undefined/20 | 0/0 | 9310ms |  | 持续失败 |
| 5 | `/patients` | ✅ | 5259 | undefined/93 | 0/0 | 11090ms |  | 稳定 |
| 5 | `/patients` | ✅ | 5277 | undefined/93 | 0/0 | 12367ms |  | 稳定 |
| 6 | `/appointments` | ❌ | 4263 | undefined/19 | 0/0 | 9710ms |  | 持续失败 |
| 7 | `/appointment-management` | ✅ | 4636 | undefined/47 | 0/0 | 5162ms |  | 稳定 |
| 6 | `/appointments` | ❌ | 4254 | undefined/19 | 0/0 | 11055ms |  | 持续失败 |
| 7 | `/appointment-management` | ✅ | 4636 | undefined/47 | 0/0 | 6310ms |  | 稳定 |
| 8 | `/queue-call` | ✅ | 4522 | undefined/5 | 0/0 | 8038ms |  | 稳定 |
| 9 | `/follow-up` | ❌ | 9600 | undefined/183 | 0/0 | 5902ms |  | 持续失败 |
| 8 | `/queue-call` | ✅ | 4522 | undefined/5 | 0/0 | 8889ms |  | 稳定 |
| 10 | `/kiosk/check-in` | ✅ | 3721 | undefined/3 | 0/0 | 4103ms |  | 稳定 |
| 9 | `/follow-up` | ❌ | 9600 | undefined/183 | 0/0 | 6754ms |  | 持续失败 |
| 11 | `/patient/self-service` | ❌ | 3708 | undefined/5 | 0/0 | 7163ms |  | 持续失败 |
| 10 | `/kiosk/check-in` | ✅ | 3721 | undefined/3 | 0/0 | 4590ms |  | 稳定 |
| 12 | `/patient/service-management` | ✅ | 3771 | undefined/7 | 0/0 | 5036ms |  | 稳定 |
| 11 | `/patient/self-service` | ❌ | 3708 | undefined/5 | 0/0 | 7934ms |  | 持续失败 |
| 13 | `/patients/:id/360` | ✅ | 3625 | undefined/4 | 0/0 | 7425ms |  | 稳定 |
| 12 | `/patient/service-management` | ✅ | 3771 | undefined/7 | 0/0 | 5992ms |  | 稳定 |
| 14 | `/write-report` | ✅ | 5587 | undefined/83 | 0/0 | 5570ms |  | 🆕修复 |
| 15 | `/reports/v3-write` | ✅ | 5597 | undefined/83 | 0/0 | 5342ms |  | 🆕修复 |
| 13 | `/patients/:id/360` | ✅ | 3625 | undefined/4 | 0/0 | 8080ms |  | 稳定 |
| 14 | `/write-report` | ✅ | 5587 | undefined/83 | 0/0 | 6641ms |  | 🆕修复 |
| 16 | `/reports` | ✅ | 5053 | undefined/75 | 0/0 | 11437ms |  | 稳定 |
| 15 | `/reports/v3-write` | ✅ | 5597 | undefined/83 | 0/0 | 6017ms |  | 🆕修复 |
| 17 | `/critical-value` | ✅ | 7191 | undefined/97 | 0/0 | 12438ms |  | 🆕修复 |
| 16 | `/reports` | ✅ | 5048 | undefined/75 | 0/0 | 12235ms |  | 稳定 |
| 18 | `/consultation` | ✅ | 5381 | undefined/10 | 0/0 | 9527ms |  | 稳定 |
| 19 | `/tele/conference` | ✅ | 3884 | undefined/3 | 0/0 | 3964ms |  | 稳定 |
| 17 | `/critical-value` | ✅ | 7191 | undefined/97 | 0/0 | 13591ms |  | 🆕修复 |
| 20 | `/tele-sign` | ✅ | 3777 | undefined/7 | 0/0 | 5378ms |  | 稳定 |
| 18 | `/consultation` | ✅ | 5383 | undefined/10 | 0/0 | 10144ms |  | 稳定 |
| 21 | `/report-review` | ✅ | 4945 | undefined/15 | 0/0 | 6965ms |  | 稳定 |
| 19 | `/tele/conference` | ✅ | 3884 | undefined/3 | 0/0 | 4769ms |  | 稳定 |
| 22 | `/report-revisions` | ✅ | 4358 | undefined/9 | 0/0 | 10840ms |  | 稳定 |
| 20 | `/tele-sign` | ✅ | 3777 | undefined/7 | 0/0 | 6701ms |  | 稳定 |
| 23 | `/collaboration` | ✅ | 4326 | undefined/14 | 0/0 | 6115ms |  | 稳定 |
| 21 | `/report-review` | ✅ | 4945 | undefined/15 | 0/0 | 8221ms |  | 稳定 |
| 24 | `/dual-read` | ✅ | 3816 | undefined/5 | 0/0 | 4415ms |  | 稳定 |
| 25 | `/keyword-check` | ✅ | 5145 | undefined/4 | 0/0 | 4406ms |  | 稳定 |
| 22 | `/report-revisions` | ✅ | 4358 | undefined/9 | 0/0 | 10968ms |  | 稳定 |
| 26 | `/report-score-rule` | ❌ | 4216 | undefined/6 | 0/0 | 9395ms |  | 持续失败 |
| 23 | `/collaboration` | ✅ | 4326 | undefined/14 | 0/0 | 7283ms |  | 稳定 |
| 24 | `/dual-read` | ✅ | 3816 | undefined/5 | 0/0 | 5945ms |  | 稳定 |
| 27 | `/report-defect-library` | ❌ | 4549 | undefined/7 | 0/0 | 9603ms |  | 持续失败 |
| 25 | `/keyword-check` | ✅ | 5145 | undefined/4 | 0/0 | 5123ms |  | 稳定 |
| 28 | `/ai-report-draft` | ✅ | 4173 | undefined/4 | 0/0 | 4464ms |  | 稳定 |
| 29 | `/critical-value-rule` | ✅ | 4482 | undefined/9 | 0/0 | 4656ms |  | 稳定 |
| 30 | `/critical-value-stats` | ✅ | 4868 | undefined/5 | 0/0 | 3962ms |  | 稳定 |
| 26 | `/report-score-rule` | ❌ | 4216 | undefined/6 | 0/0 | 9696ms |  | 持续失败 |
| 31 | `/special-assessment` | ✅ | 4142 | undefined/35 | 0/0 | 8525ms |  | 🆕修复 |
| 27 | `/report-defect-library` | ❌ | 4549 | undefined/7 | 0/0 | 9724ms |  | 持续失败 |
| 28 | `/ai-report-draft` | ✅ | 4173 | undefined/4 | 0/0 | 5499ms |  | 稳定 |
| 32 | `/report-export` | ✅ | 4602 | undefined/12 | 2/5 | 7119ms |  | 稳定 |
| 29 | `/critical-value-rule` | ✅ | 4482 | undefined/9 | 0/0 | 5774ms |  | 稳定 |
| 33 | `/publish` | ✅ | 3657 | undefined/3 | 0/0 | 9288ms |  | 稳定 |
| 30 | `/critical-value-stats` | ✅ | 4868 | undefined/5 | 0/0 | 5371ms |  | 稳定 |
| 34 | `/report-delivery` | ✅ | 3942 | undefined/5 | 2/5 | 5953ms |  | 稳定 |
| 35 | `/patient-report-portal` | ✅ | 4126 | undefined/11 | 0/0 | 5960ms |  | 稳定 |
| 31 | `/special-assessment` | ✅ | 4142 | undefined/35 | 0/0 | 10776ms |  | 🆕修复 |
| 36 | `/ca-signature` | ❌ | 119 | undefined/4 | 0/0 | 4451ms |  | 持续失败 |
| 32 | `/report-export` | ✅ | 4602 | undefined/12 | 2/5 | 7672ms |  | 稳定 |
| 37 | `/nlp/spellcheck` | ✅ | 3678 | undefined/5 | 0/0 | 4795ms |  | 稳定 |
| 38 | `/asr/transcribe` | ✅ | 3684 | undefined/4 | 0/0 | 4627ms |  | 稳定 |
| 33 | `/publish` | ✅ | 3657 | undefined/3 | 0/0 | 8801ms |  | 稳定 |
| 39 | `/snomed/encode` | ✅ | 3693 | undefined/4 | 0/0 | 4550ms |  | 稳定 |
| 40 | `/snomed/encoder` | ✅ | 3757 | undefined/4 | 0/0 | 4632ms |  | 稳定 |
| 34 | `/report-delivery` | ✅ | 3942 | undefined/5 | 2/5 | 6159ms |  | 稳定 |
| 41 | `/blockchain-proof` | ❌ | 4466 | undefined/10 | 0/0 | 4709ms |  | 持续失败 |
| 35 | `/patient-report-portal` | ✅ | 4126 | undefined/11 | 0/0 | 8056ms |  | 稳定 |
| 42 | `/cds/management` | ❌ | 3680 | undefined/10 | 0/0 | 6961ms |  | 持续失败 |
| 36 | `/ca-signature` | ❌ | 119 | undefined/4 | 0/0 | 4462ms |  | 持续失败 |
| 43 | `/cds/statistics` | ❌ | 119 | undefined/4 | 0/0 | 3899ms |  | 持续失败 |
| 37 | `/nlp/spellcheck` | ✅ | 3678 | undefined/5 | 0/0 | 5668ms |  | 稳定 |
| 44 | `/cds/rule-config` | ❌ | 3821 | undefined/12 | 0/0 | 6501ms |  | 持续失败 |
| 38 | `/asr/transcribe` | ✅ | 3684 | undefined/4 | 0/0 | 5115ms |  | 稳定 |
| 39 | `/snomed/encode` | ✅ | 3693 | undefined/4 | 0/0 | 5620ms |  | 稳定 |
| 45 | `/review-center` | ❌ | 4165 | undefined/9 | 5/6 | 9802ms |  | 持续失败 |
| 40 | `/snomed/encoder` | ✅ | 3757 | undefined/4 | 0/0 | 5293ms |  | 稳定 |
| 41 | `/blockchain-proof` | ✅ | 4466 | undefined/10 | 0/0 | 5441ms |  | 🆕修复 |
| 46 | `/quality-control` | ❌ | 4266 | undefined/4 | 5/6 | 9001ms |  | 持续失败 |
| 47 | `/critical-value-center` | ✅ | 4056 | undefined/3 | 0/0 | 4182ms |  | 稳定 |
| 42 | `/cds/management` | ❌ | 3680 | undefined/10 | 0/0 | 8546ms |  | 持续失败 |
| 48 | `/defect-management` | ✅ | 4481 | undefined/21 | 0/0 | 4438ms |  | 稳定 |
| 43 | `/cds/statistics` | ❌ | 119 | undefined/4 | 0/0 | 4398ms |  | 持续失败 |
| 49 | `/qc-dashboard` | ❌ | 4202 | undefined/23 | 0/0 | 6930ms |  | 持续失败 |
| 44 | `/cds/rule-config` | ❌ | 3821 | undefined/12 | 0/0 | 7821ms |  | 持续失败 |
| 50 | `/qc-image` | ❌ | 5617 | undefined/13 | 0/0 | 6829ms |  | 持续失败 |
| 51 | `/qc-radiologist-annual` | ❌ | 4480 | undefined/45 | 0/0 | 6842ms |  | 持续失败 |
| 45 | `/review-center` | ❌ | 4165 | undefined/9 | 5/6 | 11291ms |  | 持续失败 |
| 52 | `/qc/image-ai` | ✅ | 4946 | undefined/10 | 0/0 | 6757ms |  | 稳定 |
| 46 | `/quality-control` | ❌ | 4266 | undefined/4 | 5/6 | 10252ms |  | 持续失败 |
| 53 | `/cosign` | ✅ | 4154 | undefined/17 | 0/0 | 8973ms |  | 稳定 |
| 47 | `/critical-value-center` | ✅ | 4056 | undefined/3 | 0/0 | 4527ms |  | 稳定 |
| 54 | `/radpath/tracker` | ❌ | 3696 | undefined/4 | 0/0 | 4616ms |  | 持续失败 |
| 48 | `/defect-management` | ✅ | 4481 | undefined/21 | 0/0 | 5379ms |  | 稳定 |
| 55 | `/critical-alert` | ✅ | 3903 | undefined/5 | 0/0 | 4791ms |  | 稳定 |
| 49 | `/qc-dashboard` | ❌ | 4202 | undefined/23 | 0/0 | 8136ms |  | 持续失败 |
| 56 | `/workflow-designer` | ❌ | 3729 | undefined/8 | 0/0 | 6601ms |  | 持续失败 |
| 57 | `/routing-rules` | ✅ | 3720 | undefined/7 | 0/0 | 6089ms |  | 稳定 |
| 50 | `/qc-image` | ❌ | 5617 | undefined/13 | 0/0 | 8125ms |  | 持续失败 |
| 58 | `/workload-heatmap` | ✅ | 4683 | undefined/3 | 0/0 | 4954ms |  | 稳定 |
| 51 | `/qc-radiologist-annual` | ❌ | 4480 | undefined/45 | 0/0 | 8133ms |  | 持续失败 |
| 59 | `/sla-policy` | ❌ | 3719 | undefined/8 | 0/0 | 6165ms |  | 持续失败 |
| 52 | `/qc/image-ai` | ✅ | 4946 | undefined/10 | 0/0 | 8305ms |  | 稳定 |
| 60 | `/smart-route` | ✅ | 3857 | undefined/11 | 3/3 | 8019ms |  | 稳定 |
| 61 | `/orchestrator` | ❌ | 4021 | undefined/5 | 3/3 | 7160ms |  | 持续失败 |
| 53 | `/cosign` | ✅ | 4151 | undefined/17 | 0/0 | 13026ms |  | 稳定 |
| 62 | `/smart-mwl` | ❌ | 3707 | undefined/6 | 0/0 | 5217ms |  | 持续失败 |
| 54 | `/radpath/tracker` | ❌ | 3696 | undefined/4 | 0/0 | 5076ms |  | 持续失败 |
| 63 | `/ai-triage` | ❌ | 3629 | undefined/3 | 0/0 | 4797ms |  | 持续失败 |
| 55 | `/critical-alert` | ✅ | 3903 | undefined/5 | 0/0 | 6053ms |  | 稳定 |
| 64 | `/smart-routing` | ❌ | 3691 | undefined/5 | 2/2 | 6198ms |  | 持续失败 |
| 56 | `/workflow-designer` | ❌ | 3729 | undefined/8 | 0/0 | 7214ms |  | 持续失败 |
| 65 | `/cosign-review` | ✅ | 4147 | undefined/15 | 0/0 | 7465ms |  | 稳定 |
| 66 | `/radpath` | ❌ | 3699 | undefined/5 | 0/0 | 4328ms |  | 持续失败 |
| 57 | `/routing-rules` | ✅ | 3720 | undefined/7 | 0/0 | 6401ms |  | 稳定 |
| 67 | `/critical-value-5step` | ❌ | 3755 | undefined/4 | 0/0 | 4946ms |  | 持续失败 |
| 58 | `/workload-heatmap` | ✅ | 4683 | undefined/3 | 0/0 | 6034ms |  | 稳定 |
| 59 | `/sla-policy` | ✅ | 3719 | undefined/8 | 0/0 | 7959ms |  | 🆕修复 |
| 68 | `/dicom-viewer` | ✅ | 6090 | undefined/21 | 0/0 | 12543ms |  | 稳定 |
| 60 | `/smart-route` | ✅ | 3857 | undefined/11 | 3/3 | 9260ms |  | 稳定 |
| 69 | `/dicom-viewer-pro` | ✅ | 6092 | undefined/21 | 0/0 | 6933ms |  | 稳定 |
| 61 | `/orchestrator` | ❌ | 4021 | undefined/5 | 3/3 | 7634ms |  | 持续失败 |
| 70 | `/dicom/fusion` | ❌ | 3769 | undefined/12 | 0/0 | 6914ms |  | 持续失败 |
| 62 | `/smart-mwl` | ❌ | 3707 | undefined/6 | 0/0 | 6571ms |  | 持续失败 |
| 71 | `/dicom/fusion-v2` | ❌ | 3808 | undefined/22 | 0/0 | 6926ms |  | 持续失败 |
| 63 | `/ai-triage` | ❌ | 3715 | undefined/5 | 0/0 | 6245ms |  | 持续失败 |
| 72 | `/dicom/volume-viewer` | ❌ | 3727 | undefined/6 | 3/3 | 7341ms |  | ❌回归 |
| 64 | `/smart-routing` | ❌ | 3691 | undefined/5 | 2/2 | 6322ms |  | 持续失败 |
| 73 | `/dicom/mpr` | ✅ | 3678 | undefined/5 | 0/0 | 5252ms |  | 稳定 |
| 74 | `/dicom/mip` | ✅ | 3676 | undefined/4 | 0/0 | 4617ms |  | 稳定 |
| 65 | `/cosign-review` | ✅ | 4160 | undefined/15 | 0/0 | 9022ms |  | 稳定 |
| 75 | `/dicom/vr` | ❌ | 3674 | undefined/9 | 0/0 | 6736ms |  | 持续失败 |
| 66 | `/radpath` | ❌ | 3699 | undefined/5 | 0/0 | 5998ms |  | 持续失败 |
| 76 | `/dicom/post-processing` | ❌ | 3693 | undefined/10 | 0/0 | 6634ms |  | 持续失败 |
| 67 | `/critical-value-5step` | ❌ | 3755 | undefined/4 | 0/0 | 5298ms |  | 持续失败 |
| 77 | `/dicom/dbt` | ❌ | 3731 | undefined/9 | 0/0 | 6269ms |  | 持续失败 |
| 68 | `/dicom-viewer` | ✅ | 6090 | undefined/21 | 0/0 | 12131ms |  | 稳定 |
| 78 | `/print-management` | ✅ | 4458 | undefined/19 | 0/0 | 9524ms |  | 稳定 |
| 79 | `/ai-assist` | ✅ | 3832 | undefined/12 | 0/0 | 5879ms |  | 稳定 |
| 69 | `/dicom-viewer-pro` | ✅ | 6092 | undefined/21 | 0/0 | 8398ms |  | 稳定 |
| 80 | `/vna-dashboard` | ✅ | 4906 | undefined/3 | 0/0 | 4187ms |  | 🆕修复 |
| 81 | `/dicom/web` | ✅ | 3670 | undefined/4 | 0/0 | 4485ms |  | 稳定 |
| 70 | `/dicom/fusion` | ❌ | 3769 | undefined/12 | 0/0 | 8133ms |  | 持续失败 |
| 82 | `/dicom/compress` | ❌ | 3816 | undefined/5 | 0/0 | 5637ms |  | 持续失败 |
| 71 | `/dicom/fusion-v2` | ❌ | 3808 | undefined/22 | 0/0 | 8313ms |  | 持续失败 |
| 83 | `/dicom/4d` | ❌ | 3802 | undefined/8 | 0/0 | 6068ms |  | 持续失败 |
| 72 | `/dicom/volume-viewer` | ✅ | 3727 | undefined/6 | 3/3 | 8160ms |  | 稳定 |
| 84 | `/cross-modal-search` | ❌ | 3623 | undefined/4 | 0/0 | 7423ms |  | 持续失败 |
| 73 | `/dicom/mpr` | ✅ | 3678 | undefined/5 | 0/0 | 6048ms |  | 稳定 |
| 85 | `/dicom/sr-manager` | ❌ | 3783 | undefined/4 | 0/0 | 4705ms |  | 持续失败 |
| 74 | `/dicom/mip` | ✅ | 3676 | undefined/4 | 0/0 | 5123ms |  | 稳定 |
| 86 | `/dicom/radiomics` | ❌ | 3696 | undefined/5 | 0/0 | 5082ms |  | 持续失败 |
| 87 | `/dicom/wado-rs` | ❌ | 3679 | undefined/4 | 0/0 | 4903ms |  | 持续失败 |
| 75 | `/dicom/vr` | ❌ | 3674 | undefined/9 | 0/0 | 7985ms |  | 持续失败 |
| 88 | `/dicom/stow-rs` | ❌ | 3685 | undefined/5 | 0/0 | 4941ms |  | 持续失败 |
| 89 | `/dicom/sr-report` | ❌ | 3677 | undefined/4 | 0/0 | 4625ms |  | 持续失败 |
| 76 | `/dicom/post-processing` | ❌ | 3693 | undefined/10 | 0/0 | 7995ms |  | 持续失败 |
| 90 | `/dicom/dimse` | ❌ | 183 | undefined/4 | 0/0 | 4522ms |  | 持续失败 |
| 77 | `/dicom/dbt` | ❌ | 3731 | undefined/9 | 0/0 | 7846ms |  | 持续失败 |
| 91 | `/dicom/sr-templates` | ❌ | 3716 | undefined/5 | 0/0 | 7891ms |  | 持续失败 |
| 92 | `/fusion/manager` | ✅ | 3684 | undefined/4 | 0/0 | 4354ms |  | 🆕修复 |
| 78 | `/print-management` | ✅ | 4458 | undefined/19 | 0/0 | 13491ms |  | 稳定 |
| 93 | `/radiomics/features` | ✅ | 3706 | undefined/7 | 0/0 | 6050ms |  | 稳定 |
| 94 | `/ai-qc` | ✅ | 5012 | undefined/24 | 0/0 | 5261ms |  | 稳定 |
| 79 | `/ai-assist` | ✅ | 3832 | undefined/12 | 0/0 | 7615ms |  | 稳定 |
| 80 | `/vna-dashboard` | ✅ | 4906 | undefined/3 | 0/0 | 5498ms |  | 🆕修复 |
| 95 | `/ai-structured-report` | ❌ | 3936 | undefined/14 | 0/0 | 6965ms |  | 持续失败 |
| 81 | `/dicom/web` | ✅ | 3670 | undefined/4 | 0/0 | 5808ms |  | 稳定 |
| 96 | `/ai-medical-device` | ✅ | 5213 | undefined/28 | 0/0 | 6270ms |  | 稳定 |
| 97 | `/ai-draft` | ❌ | 3644 | undefined/3 | 0/0 | 3753ms |  | 持续失败 |
| 82 | `/dicom/compress` | ❌ | 3816 | undefined/5 | 0/0 | 7013ms |  | 持续失败 |
| 98 | `/ai-cad` | ❌ | 3720 | undefined/6 | 0/0 | 6032ms |  | 持续失败 |
| 83 | `/dicom/4d` | ❌ | 3802 | undefined/8 | 0/0 | 7863ms |  | 持续失败 |
| 99 | `/ai/rads-scoring` | ✅ | 3764 | undefined/6 | 0/0 | 5792ms |  | 🆕修复 |
| 100 | `/ai/review` | ✅ | 3688 | undefined/3 | 0/0 | 3691ms |  | 稳定 |
| 84 | `/cross-modal-search` | ❌ | 3623 | undefined/4 | 0/0 | 9727ms |  | 持续失败 |
| 101 | `/ai/providers` | ❌ | 3726 | undefined/4 | 0/0 | 4853ms |  | 持续失败 |
| 102 | `/ai/lung-cad` | ❌ | 3680 | undefined/4 | 0/0 | 4085ms |  | 持续失败 |
| 85 | `/dicom/sr-manager` | ❌ | 3783 | undefined/4 | 0/0 | 4917ms |  | 持续失败 |
| 103 | `/ai/breast-cad` | ❌ | 3678 | undefined/4 | 0/0 | 4379ms |  | 持续失败 |
| 86 | `/dicom/radiomics` | ❌ | 3696 | undefined/5 | 0/0 | 5495ms |  | 持续失败 |
| 104 | `/ai/fracture-cad` | ❌ | 3673 | undefined/4 | 0/0 | 4027ms |  | 持续失败 |
| 87 | `/dicom/wado-rs` | ❌ | 3679 | undefined/4 | 0/0 | 5211ms |  | 持续失败 |
| 105 | `/ai/cardiac-ai` | ❌ | 3627 | undefined/3 | 0/0 | 4418ms |  | 持续失败 |
| 88 | `/dicom/stow-rs` | ❌ | 3685 | undefined/5 | 0/0 | 5239ms |  | 持续失败 |
| 106 | `/ai-marketplace` | ❌ | 3642 | undefined/4 | 0/0 | 4258ms |  | 持续失败 |
| 89 | `/dicom/sr-report` | ❌ | 3677 | undefined/4 | 0/0 | 4854ms |  | 持续失败 |
| 107 | `/ai/third-party` | ❌ | 3695 | undefined/5 | 0/0 | 5379ms |  | 持续失败 |
| 90 | `/dicom/dimse` | ❌ | 183 | undefined/4 | 0/0 | 4613ms |  | 持续失败 |
| 108 | `/ai/dl-denoise` | ❌ | 3627 | undefined/3 | 0/0 | 3717ms |  | 持续失败 |
| 91 | `/dicom/sr-templates` | ❌ | 3716 | undefined/5 | 0/0 | 8412ms |  | 持续失败 |
| 92 | `/fusion/manager` | ✅ | 3684 | undefined/4 | 0/0 | 4917ms |  | 🆕修复 |
| 109 | `/qc` | ❌ | 3611 | undefined/3 | 0/0 | 13217ms |  | 持续失败 |
| 110 | `/equipment-efficiency` | ❌ | 4772 | undefined/11 | 0/0 | 5587ms |  | 持续失败 |
| 93 | `/radiomics/features` | ✅ | 3706 | undefined/7 | 0/0 | 5847ms |  | 稳定 |
| 94 | `/ai-qc` | ✅ | 5022 | undefined/24 | 0/0 | 5068ms |  | 稳定 |
| 111 | `/typical-cases` | ✅ | 8407 | undefined/13 | 0/0 | 6152ms |  | 稳定 |
| 112 | `/teach/lecture` | ❌ | 3622 | undefined/4 | 0/0 | 3955ms |  | 持续失败 |
| 95 | `/ai-structured-report` | ❌ | 3936 | undefined/14 | 0/0 | 7316ms |  | 持续失败 |
| 113 | `/finding-library` | ✅ | 28782 | undefined/1454 | 0/0 | 7279ms |  | 稳定 |
| 96 | `/ai-medical-device` | ✅ | 5213 | undefined/28 | 0/0 | 6206ms |  | 稳定 |
| 97 | `/ai-draft` | ❌ | 3644 | undefined/3 | 0/0 | 4311ms |  | 持续失败 |
| 98 | `/ai-cad` | ❌ | 3720 | undefined/6 | 0/0 | 5630ms |  | 持续失败 |
| 114 | `/term-library` | ✅ | 5231 | undefined/109 | 0/0 | 12931ms |  | 稳定 |
| 99 | `/ai/rads-scoring` | ✅ | 3764 | undefined/6 | 0/0 | 6684ms |  | 🆕修复 |
| 115 | `/template-management` | ✅ | 3836 | undefined/17 | 0/0 | 5160ms |  | 稳定 |
| 116 | `/template-designer` | ✅ | 4036 | undefined/15 | 0/0 | 4218ms |  | 稳定 |
| 100 | `/ai/review` | ✅ | 3688 | undefined/3 | 0/0 | 4366ms |  | 稳定 |
| 117 | `/template-inheritance` | ✅ | 4390 | undefined/15 | 0/0 | 4204ms |  | 稳定 |
| 101 | `/ai/providers` | ❌ | 3726 | undefined/4 | 0/0 | 4809ms |  | 持续失败 |
| 118 | `/template-category` | ✅ | 4342 | undefined/25 | 0/0 | 4275ms |  | 稳定 |
| 102 | `/ai/lung-cad` | ❌ | 3680 | undefined/4 | 0/0 | 4809ms |  | 持续失败 |
| 119 | `/term-synonym-graph` | ✅ | 4651 | undefined/3 | 0/0 | 3733ms |  | 稳定 |
| 103 | `/ai/breast-cad` | ❌ | 3678 | undefined/4 | 0/0 | 4763ms |  | 持续失败 |
| 120 | `/report-phrase-bank` | ❌ | 4957 | undefined/9 | 0/0 | 5477ms |  | ❌回归 |
| 104 | `/ai/fracture-cad` | ❌ | 3673 | undefined/4 | 0/0 | 4701ms |  | 持续失败 |
| 105 | `/ai/cardiac-ai` | ❌ | 3690 | undefined/4 | 0/0 | 4757ms |  | 持续失败 |
| 121 | `/safety/adverse-events` | ✅ | 3922 | undefined/9 | 0/0 | 7507ms |  | 稳定 |
| 106 | `/ai-marketplace` | ❌ | 3642 | undefined/4 | 0/0 | 4778ms |  | 持续失败 |
| 122 | `/safety/cqi` | ✅ | 3972 | undefined/12 | 0/0 | 6085ms |  | 稳定 |
| 107 | `/ai/third-party` | ❌ | 3695 | undefined/5 | 0/0 | 7946ms |  | 持续失败 |
| 123 | `/safety/patient-safety-goals` | ✅ | 4332 | undefined/13 | 0/0 | 6295ms |  | 稳定 |
| 124 | `/safety/radiation-safety` | ✅ | 3910 | undefined/8 | 0/0 | 5603ms |  | 稳定 |
| 108 | `/ai/dl-denoise` | ❌ | 3743 | undefined/7 | 0/0 | 7171ms |  | 持续失败 |
| 125 | `/safety/rca-analysis` | ✅ | 3855 | undefined/13 | 0/0 | 5613ms |  | 稳定 |
| 109 | `/qc` | ❌ | 3611 | undefined/3 | 0/0 | 9341ms |  | 持续失败 |
| 126 | `/safety/risk-management` | ✅ | 3862 | undefined/11 | 0/0 | 6390ms |  | 稳定 |
| 110 | `/equipment-efficiency` | ❌ | 4772 | undefined/11 | 0/0 | 6187ms |  | 持续失败 |
| 127 | `/ihe/pix` | ✅ | 3818 | undefined/4 | 4/4 | 5724ms |  | 🆕修复 |
| 128 | `/integration/fhir/bulk-export` | ✅ | 3715 | undefined/4 | 0/0 | 4016ms |  | 稳定 |
| 111 | `/typical-cases` | ✅ | 8407 | undefined/13 | 0/0 | 7532ms |  | 稳定 |
| 129 | `/integration/fhir/bulk-export-detail` | ✅ | 3713 | undefined/4 | 0/0 | 4052ms |  | 稳定 |
| 112 | `/teach/lecture` | ✅ | 3622 | undefined/4 | 0/0 | 4779ms |  | 🆕修复 |
| 113 | `/finding-library` | ✅ | 28777 | undefined/1454 | 0/0 | 8774ms |  | 稳定 |
| 130 | `/regional-report` | ❌ | 4055 | undefined/20 | 0/0 | 12593ms |  | 持续失败 |
| 131 | `/schedule` | ❌ | 3611 | undefined/3 | 0/0 | 8994ms |  | ❌回归 |
| 114 | `/term-library` | ✅ | 5245 | undefined/109 | 0/0 | 14482ms |  | 稳定 |
| 132 | `/department` | ✅ | 4002 | undefined/21 | 0/0 | 8453ms |  | 稳定 |
| 115 | `/template-management` | ✅ | 3836 | undefined/17 | 0/0 | 6228ms |  | 稳定 |
| 133 | `/hie/medical-alliance` | ❌ | 3742 | undefined/6 | 0/0 | 6511ms |  | 持续失败 |
| 116 | `/template-designer` | ✅ | 4036 | undefined/15 | 0/0 | 6150ms |  | 稳定 |
| 134 | `/integration/fhir-server` | ❌ | 3948 | undefined/3 | 4/4 | 6682ms |  | 持续失败 |
| 117 | `/template-inheritance` | ✅ | 4390 | undefined/15 | 0/0 | 4988ms |  | 稳定 |
| 135 | `/fhir/patient` | ❌ | 3712 | undefined/6 | 0/0 | 4992ms |  | 持续失败 |
| 118 | `/template-category` | ✅ | 4342 | undefined/25 | 0/0 | 5045ms |  | 稳定 |
| 119 | `/term-synonym-graph` | ✅ | 4651 | undefined/3 | 0/0 | 4394ms |  | 稳定 |
| 136 | `/fhir/observation` | ❌ | 3708 | undefined/5 | 0/0 | 5847ms |  | 持续失败 |
| 120 | `/report-phrase-bank` | ✅ | 4957 | undefined/9 | 0/0 | 6395ms |  | 稳定 |
| 137 | `/fhir/diagnostic-report` | ❌ | 3738 | undefined/5 | 0/0 | 5798ms |  | 持续失败 |
| 138 | `/fhir/imaging-study` | ❌ | 3746 | undefined/5 | 0/0 | 5922ms |  | 持续失败 |
| 121 | `/safety/adverse-events` | ✅ | 3922 | undefined/9 | 0/0 | 7244ms |  | 稳定 |
| 139 | `/fhir/subscription` | ❌ | 3721 | undefined/5 | 0/0 | 5854ms |  | 持续失败 |
| 122 | `/safety/cqi` | ✅ | 3972 | undefined/12 | 0/0 | 8470ms |  | 稳定 |
| 140 | `/integration/ihe-connectathon` | ✅ | 3840 | undefined/5 | 0/0 | 5298ms |  | 稳定 |
| 123 | `/safety/patient-safety-goals` | ✅ | 4332 | undefined/13 | 0/0 | 7594ms |  | 稳定 |
| 141 | `/integration/hl7-archive` | ❌ | 3782 | undefined/5 | 0/0 | 5850ms |  | 持续失败 |
| 142 | `/integration/hl7-builder` | ❌ | 3793 | undefined/5 | 4/4 | 7174ms |  | 持续失败 |
| 124 | `/safety/radiation-safety` | ✅ | 3910 | undefined/8 | 0/0 | 7719ms |  | 稳定 |
| 143 | `/hl7-siu` | ✅ | 3674 | undefined/4 | 2/2 | 5696ms |  | 稳定 |
| 125 | `/safety/rca-analysis` | ✅ | 3855 | undefined/13 | 0/0 | 6387ms |  | 稳定 |
| 144 | `/ihe/pam` | ❌ | 3787 | undefined/4 | 3/3 | 6297ms |  | 持续失败 |
| 126 | `/safety/risk-management` | ✅ | 3862 | undefined/11 | 0/0 | 8990ms |  | 稳定 |
| 145 | `/ihe/visit` | ✅ | 3634 | undefined/4 | 0/0 | 5046ms |  | 稳定 |
| 146 | `/ihe/manager` | ❌ | 3690 | undefined/3 | 4/4 | 5068ms |  | 持续失败 |
| 127 | `/ihe/pix` | ✅ | 3818 | undefined/4 | 4/4 | 7880ms |  | 🆕修复 |
| 128 | `/integration/fhir/bulk-export` | ✅ | 3715 | undefined/4 | 0/0 | 4777ms |  | 稳定 |
| 147 | `/hl7/manager` | ❌ | 3867 | undefined/4 | 4/4 | 7520ms |  | 持续失败 |
| 129 | `/integration/fhir/bulk-export-detail` | ✅ | 3713 | undefined/4 | 0/0 | 4699ms |  | 稳定 |
| 148 | `/integration/dimse` | ❌ | 3976 | undefined/6 | 4/4 | 6629ms |  | 持续失败 |
| 149 | `/integration/dimse/upload` | ✅ | 3740 | undefined/4 | 0/0 | 3989ms |  | 🆕修复 |
| 150 | `/cancer-screen` | ✅ | 4519 | undefined/41 | 0/0 | 7165ms |  | 稳定 |
| 130 | `/regional-report` | ❌ | 4055 | undefined/20 | 0/0 | 14676ms |  | 持续失败 |
| 151 | `/patient-portal` | ✅ | 3650 | undefined/4 | 0/0 | 4057ms |  | 稳定 |
| 131 | `/schedule` | ✅ | 3611 | undefined/3 | 0/0 | 9259ms |  | 稳定 |
| 152 | `/clinical-data` | ❌ | 3613 | undefined/3 | 0/0 | 8731ms |  | 持续失败 |
| 153 | `/education/patient-education` | ✅ | 3790 | undefined/6 | 0/0 | 4737ms |  | 稳定 |
| 132 | `/department` | ✅ | 3611 | undefined/21 | 0/0 | 8596ms |  | 稳定 |
| 154 | `/mobile/patient` | ❌ | 3758 | undefined/3 | 0/0 | 5699ms |  | 持续失败 |
| 133 | `/hie/medical-alliance` | ✅ | 3742 | undefined/6 | 0/0 | 5623ms |  | 🆕修复 |
| 134 | `/integration/fhir-server` | ✅ | 3948 | undefined/3 | 4/4 | 7614ms |  | 🆕修复 |
| 155 | `/mobile/doctor` | ❌ | 3688 | undefined/3 | 0/0 | 9392ms |  | 持续失败 |
| 135 | `/fhir/patient` | ❌ | 3712 | undefined/6 | 0/0 | 7221ms |  | 持续失败 |
| 156 | `/mobile/nurse` | ✅ | 3681 | undefined/3 | 0/0 | 8063ms |  | 稳定 |
| 136 | `/fhir/observation` | ❌ | 3708 | undefined/5 | 0/0 | 5229ms |  | 持续失败 |
| 137 | `/fhir/diagnostic-report` | ❌ | 3738 | undefined/5 | 0/0 | 5207ms |  | 持续失败 |
| 157 | `/mobile/tech` | ✅ | 3664 | undefined/3 | 0/0 | 9825ms |  | 稳定 |
| 138 | `/fhir/imaging-study` | ❌ | 3746 | undefined/5 | 0/0 | 6630ms |  | 持续失败 |
| 158 | `/mobile/push` | ❌ | 3831 | undefined/12 | 0/0 | 6159ms |  | 持续失败 |
| 139 | `/fhir/subscription` | ❌ | 3721 | undefined/5 | 0/0 | 5234ms |  | 持续失败 |
| 159 | `/statistics` | ❌ | 3611 | undefined/3 | 0/0 | 9342ms |  | ❌回归 |
| 140 | `/integration/ihe-connectathon` | ✅ | 3840 | undefined/5 | 0/0 | 5979ms |  | 稳定 |
| 141 | `/integration/hl7-archive` | ❌ | 3782 | undefined/5 | 0/0 | 5119ms |  | 持续失败 |
| 160 | `/green-it` | ❌ | 3996 | undefined/12 | 0/0 | 7358ms |  | 持续失败 |
| 161 | `/dept-dashboard` | ✅ | 3749 | undefined/3 | 0/0 | 3886ms |  | 稳定 |
| 142 | `/integration/hl7-builder` | ❌ | 3793 | undefined/5 | 4/4 | 7994ms |  | 持续失败 |
| 162 | `/remote-reading` | ✅ | 3923 | undefined/3 | 0/0 | 4048ms |  | 稳定 |
| 163 | `/operations-center` | ✅ | 4523 | undefined/3 | 0/0 | 4335ms |  | 稳定 |
| 143 | `/hl7-siu` | ✅ | 3674 | undefined/4 | 2/2 | 6286ms |  | 稳定 |
| 164 | `/cost-analysis` | ✅ | 4285 | undefined/21 | 0/0 | 7278ms |  | 稳定 |
| 144 | `/ihe/pam` | ❌ | 3787 | undefined/4 | 3/3 | 6935ms |  | 持续失败 |
| 145 | `/ihe/visit` | ✅ | 3634 | undefined/4 | 0/0 | 5594ms |  | 稳定 |
| 165 | `/stats-report` | ✅ | 4206 | undefined/11 | 0/0 | 6871ms |  | 稳定 |
| 146 | `/ihe/manager` | ❌ | 3690 | undefined/3 | 4/4 | 6962ms |  | 持续失败 |
| 166 | `/nuclear-stats` | ✅ | 4029 | undefined/11 | 0/0 | 6921ms |  | 稳定 |
| 167 | `/report-kpi-dashboard` | ✅ | 4245 | undefined/6 | 0/0 | 5759ms |  | 稳定 |
| 147 | `/hl7/manager` | ❌ | 3867 | undefined/4 | 4/4 | 7755ms |  | 持续失败 |
| 168 | `/doctor-workload` | ✅ | 4121 | undefined/7 | 0/0 | 5611ms |  | 稳定 |
| 148 | `/integration/dimse` | ❌ | 3976 | undefined/6 | 4/4 | 8202ms |  | 持续失败 |
| 169 | `/diagnosis-accuracy` | ✅ | 4062 | undefined/3 | 0/0 | 4148ms |  | 稳定 |
| 149 | `/integration/dimse/upload` | ✅ | 3740 | undefined/4 | 0/0 | 5459ms |  | 🆕修复 |
| 170 | `/report-timeliness` | ✅ | 4147 | undefined/14 | 0/0 | 6735ms |  | 稳定 |
| 150 | `/cancer-screen` | ✅ | 4516 | undefined/41 | 0/0 | 7721ms |  | 稳定 |
| 171 | `/report-search` | ✅ | 4931 | undefined/27 | 0/0 | 6465ms |  | 稳定 |
| 151 | `/patient-portal` | ✅ | 3650 | undefined/4 | 0/0 | 5370ms |  | 稳定 |
| 172 | `/operations/oee` | ❌ | 3684 | undefined/7 | 0/0 | 5598ms |  | 持续失败 |
| 173 | `/cardiac/database` | ❌ | 3813 | undefined/4 | 0/0 | 4975ms |  | 持续失败 |
| 174 | `/cardiac/operations` | ✅ | 4255 | undefined/7 | 0/0 | 5544ms |  | 稳定 |
| 152 | `/clinical-data` | ✅ | 4342 | undefined/9 | 0/0 | 12269ms |  | 🆕修复 |
| 175 | `/cardiac/qc` | ✅ | 4139 | undefined/3 | 0/0 | 4094ms |  | 稳定 |
| 153 | `/education/patient-education` | ✅ | 3790 | undefined/6 | 0/0 | 6300ms |  | 稳定 |
| 176 | `/ops/devices` | ✅ | 4263 | undefined/9 | 0/0 | 6373ms |  | 稳定 |
| 154 | `/mobile/patient` | ❌ | 3758 | undefined/3 | 0/0 | 5702ms |  | 持续失败 |
| 177 | `/ops/hr` | ✅ | 3909 | undefined/11 | 0/0 | 5292ms |  | 稳定 |
| 155 | `/mobile/doctor` | ❌ | 3688 | undefined/3 | 0/0 | 8631ms |  | 持续失败 |
| 178 | `/ops/dashboard` | ✅ | 3996 | undefined/6 | 0/0 | 5900ms |  | 稳定 |
| 179 | `/operations/occupancy` | ❌ | 3737 | undefined/4 | 0/0 | 5213ms |  | 持续失败 |
| 180 | `/auto-collection` | ✅ | 3827 | undefined/7 | 0/0 | 5565ms |  | 🆕修复 |
| 156 | `/mobile/nurse` | ✅ | 8463 | undefined/223 | 0/0 | 11656ms |  | 稳定 |
| 181 | `/quality/department` | ❌ | 4356 | undefined/4 | 0/0 | 9265ms |  | 持续失败 |
| 157 | `/mobile/tech` | ✅ | 3664 | undefined/3 | 0/0 | 9106ms |  | 稳定 |
| 158 | `/mobile/push` | ❌ | 3831 | undefined/12 | 0/0 | 8465ms |  | 持续失败 |
| 182 | `/analytics/benchmark-v2` | ✅ | 4048 | undefined/5 | 0/0 | 9361ms |  | 🆕修复 |
| 183 | `/analytics/benchmark-ai-diagnosis` | ❌ | 3671 | undefined/4 | 0/0 | 5160ms |  | 持续失败 |
| 159 | `/statistics` | ✅ | 4225 | undefined/22 | 0/0 | 13781ms |  | 稳定 |
| 184 | `/analytics/tat-dashboard` | ✅ | 3884 | undefined/5 | 0/0 | 8550ms |  | 🆕修复 |
| 185 | `/charge-items` | ✅ | 4214 | undefined/22 | 0/0 | 7052ms |  | 稳定 |
| 160 | `/green-it` | ✅ | 3996 | undefined/12 | 0/0 | 8519ms |  | 🆕修复 |
| 186 | `/accounts-receivable` | ✅ | 4319 | undefined/4 | 0/0 | 4517ms |  | 稳定 |
| 161 | `/dept-dashboard` | ✅ | 3749 | undefined/3 | 0/0 | 4873ms |  | 稳定 |
| 187 | `/revenue-analysis` | ✅ | 3844 | undefined/8 | 0/0 | 6072ms |  | 稳定 |
| 162 | `/remote-reading` | ✅ | 3923 | undefined/3 | 0/0 | 4781ms |  | 稳定 |
| 188 | `/cost-accounting` | ✅ | 3800 | undefined/7 | 0/0 | 4965ms |  | 稳定 |
| 163 | `/operations-center` | ✅ | 4523 | undefined/3 | 0/0 | 5146ms |  | 稳定 |
| 189 | `/financial-reports` | ✅ | 4047 | undefined/7 | 0/0 | 5667ms |  | 稳定 |
| 164 | `/cost-analysis` | ✅ | 4285 | undefined/21 | 0/0 | 8570ms |  | 稳定 |
| 190 | `/national-report` | ❌ | 4620 | undefined/10 | 0/0 | 7663ms |  | 持续失败 |
| 165 | `/stats-report` | ✅ | 4206 | undefined/11 | 0/0 | 7476ms |  | 稳定 |
| 191 | `/data-report-center` | ❌ | 4617 | undefined/11 | 0/0 | 8270ms |  | 持续失败 |
| 166 | `/nuclear-stats` | ✅ | 4029 | undefined/11 | 0/0 | 8198ms |  | 稳定 |
| 192 | `/insurance-audit` | ❌ | 5793 | undefined/50 | 0/0 | 7340ms |  | 持续失败 |
| 167 | `/report-kpi-dashboard` | ✅ | 4245 | undefined/6 | 0/0 | 6614ms |  | 稳定 |
| 193 | `/enterprise-search` | ❌ | 3774 | undefined/10 | 0/0 | 6921ms |  | 持续失败 |
| 168 | `/doctor-workload` | ✅ | 4121 | undefined/7 | 0/0 | 6455ms |  | 稳定 |
| 194 | `/eye` | ✅ | 3849 | undefined/4 | 0/0 | 6125ms |  | 🆕修复 |
| 169 | `/diagnosis-accuracy` | ✅ | 4062 | undefined/3 | 0/0 | 4965ms |  | 稳定 |
| 195 | `/eye/pacs` | ✅ | 5106 | undefined/23 | 0/0 | 6388ms |  | 🆕修复 |
| 170 | `/report-timeliness` | ✅ | 4147 | undefined/14 | 0/0 | 8060ms |  | 稳定 |
| 196 | `/eye/pacs/fundus` | ❌ | 4129 | undefined/6 | 0/0 | 5994ms |  | 持续失败 |
| 171 | `/report-search` | ✅ | 4931 | undefined/27 | 0/0 | 7819ms |  | 稳定 |
| 197 | `/eye/pacs/oct` | ✅ | 3859 | undefined/3 | 0/0 | 4753ms |  | 🆕修复 |
| 198 | `/eye/pacs/oct-a` | ❌ | 96 | undefined/4 | 0/0 | 4445ms |  | 持续失败 |
| 172 | `/operations/oee` | ❌ | 3684 | undefined/7 | 0/0 | 6348ms |  | 持续失败 |
| 199 | `/eye/pacs/visual-field` | ✅ | 3623 | undefined/3 | 0/0 | 4877ms |  | 🆕修复 |
| 173 | `/cardiac/database` | ❌ | 3813 | undefined/4 | 0/0 | 5704ms |  | 持续失败 |
| 174 | `/cardiac/operations` | ✅ | 4255 | undefined/7 | 0/0 | 5907ms |  | 稳定 |
| 175 | `/cardiac/qc` | ✅ | 4139 | undefined/3 | 0/0 | 4553ms |  | 稳定 |
| 176 | `/ops/devices` | ✅ | 4263 | undefined/9 | 0/0 | 7313ms |  | 稳定 |
| 177 | `/ops/hr` | ✅ | 3909 | undefined/11 | 0/0 | 5964ms |  | 稳定 |
| 178 | `/ops/dashboard` | ✅ | 3996 | undefined/6 | 0/0 | 6231ms |  | 稳定 |
| 179 | `/operations/occupancy` | ❌ | 3737 | undefined/4 | 0/0 | 5260ms |  | 持续失败 |
| 180 | `/auto-collection` | ✅ | 3827 | undefined/7 | 0/0 | 6334ms |  | 🆕修复 |
| 181 | `/quality/department` | ❌ | 4356 | undefined/4 | 0/0 | 8173ms |  | 持续失败 |
| 182 | `/analytics/benchmark-v2` | ✅ | 4045 | undefined/5 | 0/0 | 8905ms |  | 🆕修复 |
| 183 | `/analytics/benchmark-ai-diagnosis` | ❌ | 3671 | undefined/4 | 0/0 | 5244ms |  | 持续失败 |
| 184 | `/analytics/tat-dashboard` | ✅ | 3884 | undefined/5 | 0/0 | 8265ms |  | 🆕修复 |
| 185 | `/charge-items` | ✅ | 4214 | undefined/22 | 0/0 | 7680ms |  | 稳定 |
| 186 | `/accounts-receivable` | ✅ | 4319 | undefined/4 | 0/0 | 5038ms |  | 稳定 |
| 187 | `/revenue-analysis` | ✅ | 3844 | undefined/8 | 0/0 | 6884ms |  | 稳定 |
| 188 | `/cost-accounting` | ✅ | 3854 | undefined/7 | 0/0 | 6396ms |  | 稳定 |
| 189 | `/financial-reports` | ✅ | 4047 | undefined/7 | 0/0 | 6369ms |  | 稳定 |
| 190 | `/national-report` | ❌ | 4620 | undefined/10 | 0/0 | 9954ms |  | 持续失败 |
| 191 | `/data-report-center` | ✅ | 4617 | undefined/11 | 0/0 | 9189ms |  | 🆕修复 |
| 192 | `/insurance-audit` | ❌ | 5793 | undefined/50 | 0/0 | 8231ms |  | 持续失败 |
| 193 | `/enterprise-search` | ✅ | 3774 | undefined/10 | 0/0 | 7870ms |  | 🆕修复 |
| 194 | `/eye` | ✅ | 3849 | undefined/4 | 0/0 | 6455ms |  | 🆕修复 |
| 195 | `/eye/pacs` | ✅ | 5126 | undefined/23 | 0/0 | 6773ms |  | 🆕修复 |
| 196 | `/eye/pacs/fundus` | ❌ | 4130 | undefined/6 | 0/0 | 6642ms |  | 持续失败 |
| 197 | `/eye/pacs/oct` | ✅ | 3859 | undefined/3 | 0/0 | 5156ms |  | 🆕修复 |
| 198 | `/eye/pacs/oct-a` | ❌ | 96 | undefined/4 | 0/0 | 4297ms |  | 持续失败 |
| 199 | `/eye/pacs/visual-field` | ✅ | 3623 | undefined/3 | 0/0 | 5127ms |  | 🆕修复 |
