# Playwright 200 页 200 交互 测试报告 — v3.0.6.11-33

> 生成时间: 2026-07-25T12:36:02.617Z
> 项目: G005-RISv-3.0.0
> 浏览器: chromium
> 对比基线: v3.0.6.11-32

## 一、测试总览

| 指标 | v3.0.6.11-32 | v3.0.6.11-33 | 变化 |
|------|:----------:|:----------:|:----:|
| Sidebar 总路由 | 233 | 233 | — |
| 测试路由数 | 200 | **200** | — |
| 通过页数 | 0 | **0** | 0 |
| 失败页数 | 200 | **200** | +0 |
| 崩溃页数 (P0) | 0 | **0** | 0 |
| **通过率** | 0.0% | **0.0%** | 0.0% |
| 按钮总数 | 0 | 0 | 0 |
| 按钮点击成功 | 0 | 0 | 0 |
| 假按钮/死按钮 | 0 | 0 | +0 |
| Tab 总数 | 0 | 0 | 0 |
| Tab 点击成功 | 0 | 0 | 0 |
| Console errors | 397 | 35 | ✅ -362 |
| Page errors | 2 | 165 | 163 |
| Alert 弹窗 | — | 0 | — |

## 二、失败页面清单

| # | 路由 | 失败原因 | body | 状态 | v32 是否通过 | 新增? | Alert? |
|---|------|----------|:----:|:----:|:----------:|:----:|:-----:|
| 0 | `/` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 1 | `/worklist` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 2 | `/triage/worklist` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 3 | `/exams` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 4 | `/patients` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 5 | `/appointments` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 6 | `/appointment-management` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 7 | `/queue-call` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 8 | `/follow-up` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 9 | `/kiosk/check-in` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 10 | `/patient/self-service` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 11 | `/patient/service-management` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 12 | `/patients/:id/360` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 13 | `/write-report` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 14 | `/reports/v3-write` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 15 | `/reports` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 16 | `/critical-value` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 17 | `/consultation` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 18 | `/tele/conference` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 19 | `/tele-sign` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 20 | `/report-review` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 21 | `/report-revisions` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 22 | `/collaboration` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 23 | `/dual-read` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 24 | `/keyword-check` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 25 | `/report-score-rule` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 26 | `/report-defect-library` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 27 | `/ai-report-draft` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 28 | `/critical-value-rule` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 29 | `/critical-value-stats` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 30 | `/special-assessment` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 31 | `/report-export` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 32 | `/publish` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 33 | `/report-delivery` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 34 | `/patient-report-portal` | BODY_LEN=11 | 11 | 200 | false | 持续失败 |  |
| 35 | `/ca-signature` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 36 | `/nlp/spellcheck` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 37 | `/asr/transcribe` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 38 | `/snomed/encode` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 39 | `/blockchain-proof` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 40 | `/cds/management` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 41 | `/cds/statistics` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 42 | `/cds/rule-config` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 43 | `/review-center` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 44 | `/quality-control` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 45 | `/critical-value-center` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 46 | `/defect-management` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 47 | `/qc-dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 48 | `/qc-image` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 49 | `/qc-radiologist-annual` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 50 | `/qc/image-ai` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 51 | `/cosign` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 52 | `/radpath/tracker` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 53 | `/workflow-designer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 54 | `/routing-rules` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 55 | `/workload-heatmap` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 56 | `/sla-policy` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 57 | `/smart-route` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 58 | `/orchestrator` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 59 | `/dicom-viewer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 60 | `/dicom-viewer-pro` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 61 | `/dicom/fusion` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 62 | `/dicom/fusion-v2` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 63 | `/dicom/volume-viewer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 64 | `/print-management` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 65 | `/ai-assist` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 66 | `/vna-dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 67 | `/dicom/web` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 68 | `/dicom/compress` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 69 | `/dicom/4d` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 70 | `/cross-modal-search` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 71 | `/dicom/sr-manager` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 72 | `/dicom/radiomics` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 73 | `/ai-qc` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 74 | `/ai-structured-report` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 75 | `/ai-medical-device` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 76 | `/ai-draft` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 77 | `/ai-cad` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 78 | `/ai/rads-scoring` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 79 | `/ai-marketplace` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 80 | `/qc` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 81 | `/equipment-efficiency` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 82 | `/typical-cases` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 83 | `/teach/lecture` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 84 | `/finding-library` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 85 | `/term-library` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 86 | `/template-management` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 87 | `/template-designer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 88 | `/template-inheritance` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 89 | `/template-category` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 90 | `/term-synonym-graph` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 91 | `/report-phrase-bank` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 92 | `/safety/adverse-events` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 93 | `/safety/cqi` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 94 | `/safety/patient-safety-goals` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 95 | `/safety/radiation-safety` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 96 | `/safety/rca-analysis` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 97 | `/safety/risk-management` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 98 | `/ihe/pix` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 99 | `/integration/fhir/bulk-export` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 100 | `/integration/fhir/bulk-export-detail` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 101 | `/regional-report` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 102 | `/schedule` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 103 | `/department` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 104 | `/hie/medical-alliance` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 105 | `/integration/fhir-server` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 106 | `/integration/ihe-connectathon` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 107 | `/integration/hl7-archive` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 108 | `/integration/hl7-builder` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 109 | `/hl7-siu` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 110 | `/ihe/pam` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 111 | `/ihe/visit` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 112 | `/integration/dimse` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 113 | `/integration/dimse/upload` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 114 | `/cancer-screen` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 115 | `/patient-portal` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 116 | `/clinical-data` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 117 | `/education/patient-education` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 118 | `/mobile/patient` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 119 | `/mobile/doctor` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 120 | `/mobile/nurse` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 121 | `/mobile/tech` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 122 | `/statistics` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 123 | `/green-it` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 124 | `/department-dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 125 | `/operations-center` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 126 | `/cost-analysis` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 127 | `/stats-report` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 128 | `/nuclear-stats` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 129 | `/report-kpi-dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 130 | `/doctor-workload` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 131 | `/diagnosis-accuracy` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 132 | `/report-timeliness` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 133 | `/report-search` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 134 | `/operations/oee` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 135 | `/cardiac/database` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 136 | `/cardiac/operations` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 137 | `/cardiac/qc` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 138 | `/ops/devices` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 139 | `/ops/hr` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 140 | `/ops/dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 141 | `/operations/occupancy` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 142 | `/quality/department` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 143 | `/analytics/benchmark-v2` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 144 | `/analytics/benchmark-ai-diagnosis` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 145 | `/charge-items` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 146 | `/accounts-receivable` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 147 | `/revenue-analysis` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 148 | `/cost-accounting` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 149 | `/financial-reports` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 150 | `/national-report` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 151 | `/data-report-center` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 152 | `/insurance-audit` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 153 | `/enterprise-search` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 154 | `/eye` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 155 | `/eye/pacs` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 156 | `/eye/pacs/fundus` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 157 | `/eye/pacs/oct` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 158 | `/eye/pacs/oct-a` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 159 | `/eye/pacs/visual-field` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 160 | `/eye/pacs/topography` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 161 | `/eye/pacs/ffa` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 162 | `/eye/pacs/compare` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 163 | `/eye/pacs/montage` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 164 | `/eye/ris` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 165 | `/eye/report-write` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 166 | `/eye/ris/iol-calculator` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 167 | `/eye/ris/va` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 168 | `/eye/ris/iop` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 169 | `/eye/emr` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 170 | `/eye/ai` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 171 | `/eye/kpi-dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 172 | `/eye/pacs/real-viewer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 173 | `/eye/pacs/viewer` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 174 | `/eye/ai-report` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 175 | `/eye/toric-planner` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 176 | `/eye/sub/strabismus` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 177 | `/eye/sub/neuro` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 178 | `/eye/sub/oncology` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 179 | `/eye/sub/cornea` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 180 | `/eye/sub/contact-lens` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 181 | `/eye/sub/low-vision` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 182 | `/eye/sub/cataract` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 183 | `/eye/sub/refractive` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 184 | `/eye/tele` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 185 | `/eye/case-library` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 186 | `/eye/optometry-loop` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 187 | `/dental` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 188 | `/dental/studies` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 189 | `/dental/chart` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 190 | `/dental/ai` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 191 | `/dental/treatment` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 192 | `/dental/implant` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 193 | `/dental/ortho` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 194 | `/dental/tele` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 195 | `/dental/inventory` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 196 | `/dental/dashboard` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 197 | `/dental/cad` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 198 | `/dental/implant-3d` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |
| 199 | `/dental/guide` | BODY_LEN=0, STUCK | 0 | 0 | false | 持续失败 |  |

## 三、修复效果对比 (v32 vs v33)

| 类型 | 数量 |
|------|:----:|
| 已修复按钮 (v32 失败 → v33 成功) | **0** |
| 回归按钮 (v32 成功 → v33 失败) | **0** |
| Alert 弹窗页面数 | **0** |

## 四、失败按钮 / Tab 清单

**✅ 无失败按钮/Tab**

## 五、Console Error & Alert 统计

- Console errors 总数: **35**
- Page errors 总数: **165**
- Alert 弹窗页面: **0**

## 六、截图清单

| # | 路由 | 截图文件 |
|---|------|----------|
| 0 | `/` | `e2e/screenshots-33/000_root.png` |
| 1 | `/worklist` | `e2e/screenshots-33/001_worklist.png` |
| 2 | `/triage/worklist` | `e2e/screenshots-33/002_triage_worklist.png` |
| 3 | `/exams` | `e2e/screenshots-33/003_exams.png` |
| 4 | `/patients` | `e2e/screenshots-33/004_patients.png` |
| 5 | `/appointments` | `e2e/screenshots-33/005_appointments.png` |
| 6 | `/appointment-management` | `e2e/screenshots-33/006_appointment-management.png` |
| 7 | `/queue-call` | `e2e/screenshots-33/007_queue-call.png` |
| 8 | `/follow-up` | `e2e/screenshots-33/008_follow-up.png` |
| 9 | `/kiosk/check-in` | `e2e/screenshots-33/009_kiosk_check-in.png` |
| 10 | `/patient/self-service` | `e2e/screenshots-33/010_patient_self-service.png` |
| 11 | `/patient/service-management` | `e2e/screenshots-33/011_patient_service-management.png` |
| 12 | `/patients/:id/360` | `e2e/screenshots-33/012_patients__id_360.png` |
| 13 | `/write-report` | `e2e/screenshots-33/013_write-report.png` |
| 14 | `/reports/v3-write` | `e2e/screenshots-33/014_reports_v3-write.png` |
| 15 | `/reports` | `e2e/screenshots-33/015_reports.png` |
| 16 | `/critical-value` | `e2e/screenshots-33/016_critical-value.png` |
| 17 | `/consultation` | `e2e/screenshots-33/017_consultation.png` |
| 18 | `/tele/conference` | `e2e/screenshots-33/018_tele_conference.png` |
| 19 | `/tele-sign` | `e2e/screenshots-33/019_tele-sign.png` |
| 20 | `/report-review` | `e2e/screenshots-33/020_report-review.png` |
| 21 | `/report-revisions` | `e2e/screenshots-33/021_report-revisions.png` |
| 22 | `/collaboration` | `e2e/screenshots-33/022_collaboration.png` |
| 23 | `/dual-read` | `e2e/screenshots-33/023_dual-read.png` |
| 24 | `/keyword-check` | `e2e/screenshots-33/024_keyword-check.png` |
| 25 | `/report-score-rule` | `e2e/screenshots-33/025_report-score-rule.png` |
| 26 | `/report-defect-library` | `e2e/screenshots-33/026_report-defect-library.png` |
| 27 | `/ai-report-draft` | `e2e/screenshots-33/027_ai-report-draft.png` |
| 28 | `/critical-value-rule` | `e2e/screenshots-33/028_critical-value-rule.png` |
| 29 | `/critical-value-stats` | `e2e/screenshots-33/029_critical-value-stats.png` |
| 30 | `/special-assessment` | `e2e/screenshots-33/030_special-assessment.png` |
| 31 | `/report-export` | `e2e/screenshots-33/031_report-export.png` |
| 32 | `/publish` | `e2e/screenshots-33/032_publish.png` |
| 33 | `/report-delivery` | `e2e/screenshots-33/033_report-delivery.png` |
| 34 | `/patient-report-portal` | `e2e/screenshots-33/034_patient-report-portal.png` |

## 七、全部页面结果

| # | 路由 | pass | body | 按钮 | Tab | 用时 | Alert | v32 对比 |
|---|------|:----:|:----:|:----:|:---:|:----:|:----:|:---------:|
| 0 | `/` | ❌ | 11 | undefined/0 | 0/0 | 2638ms |  | 持续失败 |
| 1 | `/worklist` | ❌ | 11 | undefined/0 | 0/0 | 2157ms |  | 持续失败 |
| 2 | `/triage/worklist` | ❌ | 11 | undefined/0 | 0/0 | 2153ms |  | 持续失败 |
| 3 | `/exams` | ❌ | 11 | undefined/0 | 0/0 | 2148ms |  | 持续失败 |
| 4 | `/patients` | ❌ | 11 | undefined/0 | 0/0 | 2167ms |  | 持续失败 |
| 5 | `/appointments` | ❌ | 11 | undefined/0 | 0/0 | 2147ms |  | 持续失败 |
| 6 | `/appointment-management` | ❌ | 11 | undefined/0 | 0/0 | 2140ms |  | 持续失败 |
| 7 | `/queue-call` | ❌ | 11 | undefined/0 | 0/0 | 2152ms |  | 持续失败 |
| 8 | `/follow-up` | ❌ | 11 | undefined/0 | 0/0 | 2152ms |  | 持续失败 |
| 9 | `/kiosk/check-in` | ❌ | 11 | undefined/0 | 0/0 | 2161ms |  | 持续失败 |
| 10 | `/patient/self-service` | ❌ | 11 | undefined/0 | 0/0 | 2143ms |  | 持续失败 |
| 11 | `/patient/service-management` | ❌ | 11 | undefined/0 | 0/0 | 2141ms |  | 持续失败 |
| 12 | `/patients/:id/360` | ❌ | 11 | undefined/0 | 0/0 | 2139ms |  | 持续失败 |
| 13 | `/write-report` | ❌ | 11 | undefined/0 | 0/0 | 2156ms |  | 持续失败 |
| 14 | `/reports/v3-write` | ❌ | 11 | undefined/0 | 0/0 | 2133ms |  | 持续失败 |
| 15 | `/reports` | ❌ | 11 | undefined/0 | 0/0 | 2131ms |  | 持续失败 |
| 16 | `/critical-value` | ❌ | 11 | undefined/0 | 0/0 | 2140ms |  | 持续失败 |
| 17 | `/consultation` | ❌ | 11 | undefined/0 | 0/0 | 2126ms |  | 持续失败 |
| 18 | `/tele/conference` | ❌ | 11 | undefined/0 | 0/0 | 2130ms |  | 持续失败 |
| 19 | `/tele-sign` | ❌ | 11 | undefined/0 | 0/0 | 2113ms |  | 持续失败 |
| 20 | `/report-review` | ❌ | 11 | undefined/0 | 0/0 | 2127ms |  | 持续失败 |
| 21 | `/report-revisions` | ❌ | 11 | undefined/0 | 0/0 | 2119ms |  | 持续失败 |
| 22 | `/collaboration` | ❌ | 11 | undefined/0 | 0/0 | 2129ms |  | 持续失败 |
| 23 | `/dual-read` | ❌ | 11 | undefined/0 | 0/0 | 2123ms |  | 持续失败 |
| 24 | `/keyword-check` | ❌ | 11 | undefined/0 | 0/0 | 2147ms |  | 持续失败 |
| 25 | `/report-score-rule` | ❌ | 11 | undefined/0 | 0/0 | 2146ms |  | 持续失败 |
| 26 | `/report-defect-library` | ❌ | 11 | undefined/0 | 0/0 | 2132ms |  | 持续失败 |
| 27 | `/ai-report-draft` | ❌ | 11 | undefined/0 | 0/0 | 2111ms |  | 持续失败 |
| 28 | `/critical-value-rule` | ❌ | 11 | undefined/0 | 0/0 | 2120ms |  | 持续失败 |
| 29 | `/critical-value-stats` | ❌ | 11 | undefined/0 | 0/0 | 2134ms |  | 持续失败 |
| 30 | `/special-assessment` | ❌ | 11 | undefined/0 | 0/0 | 2168ms |  | 持续失败 |
| 31 | `/report-export` | ❌ | 11 | undefined/0 | 0/0 | 2150ms |  | 持续失败 |
| 32 | `/publish` | ❌ | 11 | undefined/0 | 0/0 | 2157ms |  | 持续失败 |
| 33 | `/report-delivery` | ❌ | 11 | undefined/0 | 0/0 | 2152ms |  | 持续失败 |
| 34 | `/patient-report-portal` | ❌ | 11 | undefined/0 | 0/0 | 2149ms |  | 持续失败 |
| 35 | `/ca-signature` | ❌ | 0 | undefined/0 | 0/0 | 1195ms |  | 持续失败 |
| 36 | `/nlp/spellcheck` | ❌ | 0 | undefined/0 | 0/0 | 242ms |  | 持续失败 |
| 37 | `/asr/transcribe` | ❌ | 0 | undefined/0 | 0/0 | 927ms |  | 持续失败 |
| 38 | `/snomed/encode` | ❌ | 0 | undefined/0 | 0/0 | 1243ms |  | 持续失败 |
| 39 | `/blockchain-proof` | ❌ | 0 | undefined/0 | 0/0 | 170ms |  | 持续失败 |
| 40 | `/cds/management` | ❌ | 0 | undefined/0 | 0/0 | 910ms |  | 持续失败 |
| 41 | `/cds/statistics` | ❌ | 0 | undefined/0 | 0/0 | 1274ms |  | 持续失败 |
| 42 | `/cds/rule-config` | ❌ | 0 | undefined/0 | 0/0 | 153ms |  | 持续失败 |
| 43 | `/review-center` | ❌ | 0 | undefined/0 | 0/0 | 933ms |  | 持续失败 |
| 44 | `/quality-control` | ❌ | 0 | undefined/0 | 0/0 | 1277ms |  | 持续失败 |
| 45 | `/critical-value-center` | ❌ | 0 | undefined/0 | 0/0 | 169ms |  | 持续失败 |
| 46 | `/defect-management` | ❌ | 0 | undefined/0 | 0/0 | 916ms |  | 持续失败 |
| 47 | `/qc-dashboard` | ❌ | 0 | undefined/0 | 0/0 | 1277ms |  | 持续失败 |
| 48 | `/qc-image` | ❌ | 0 | undefined/0 | 0/0 | 155ms |  | 持续失败 |
| 49 | `/qc-radiologist-annual` | ❌ | 0 | undefined/0 | 0/0 | 901ms |  | 持续失败 |
| 50 | `/qc/image-ai` | ❌ | 0 | undefined/0 | 0/0 | 1296ms |  | 持续失败 |
| 51 | `/cosign` | ❌ | 0 | undefined/0 | 0/0 | 155ms |  | 持续失败 |
| 52 | `/radpath/tracker` | ❌ | 0 | undefined/0 | 0/0 | 914ms |  | 持续失败 |
| 53 | `/workflow-designer` | ❌ | 0 | undefined/0 | 0/0 | 1287ms |  | 持续失败 |
| 54 | `/routing-rules` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 55 | `/workload-heatmap` | ❌ | 0 | undefined/0 | 0/0 | 918ms |  | 持续失败 |
| 56 | `/sla-policy` | ❌ | 0 | undefined/0 | 0/0 | 1290ms |  | 持续失败 |
| 57 | `/smart-route` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 58 | `/orchestrator` | ❌ | 0 | undefined/0 | 0/0 | 919ms |  | 持续失败 |
| 59 | `/dicom-viewer` | ❌ | 0 | undefined/0 | 0/0 | 1263ms |  | 持续失败 |
| 60 | `/dicom-viewer-pro` | ❌ | 0 | undefined/0 | 0/0 | 170ms |  | 持续失败 |
| 61 | `/dicom/fusion` | ❌ | 0 | undefined/0 | 0/0 | 904ms |  | 持续失败 |
| 62 | `/dicom/fusion-v2` | ❌ | 0 | undefined/0 | 0/0 | 1275ms |  | 持续失败 |
| 63 | `/dicom/volume-viewer` | ❌ | 0 | undefined/0 | 0/0 | 185ms |  | 持续失败 |
| 64 | `/print-management` | ❌ | 0 | undefined/0 | 0/0 | 901ms |  | 持续失败 |
| 65 | `/ai-assist` | ❌ | 0 | undefined/0 | 0/0 | 1295ms |  | 持续失败 |
| 66 | `/vna-dashboard` | ❌ | 0 | undefined/0 | 0/0 | 172ms |  | 持续失败 |
| 67 | `/dicom/web` | ❌ | 0 | undefined/0 | 0/0 | 890ms |  | 持续失败 |
| 68 | `/dicom/compress` | ❌ | 0 | undefined/0 | 0/0 | 1291ms |  | 持续失败 |
| 69 | `/dicom/4d` | ❌ | 0 | undefined/0 | 0/0 | 201ms |  | 持续失败 |
| 70 | `/cross-modal-search` | ❌ | 0 | undefined/0 | 0/0 | 871ms |  | 持续失败 |
| 71 | `/dicom/sr-manager` | ❌ | 0 | undefined/0 | 0/0 | 1291ms |  | 持续失败 |
| 72 | `/dicom/radiomics` | ❌ | 0 | undefined/0 | 0/0 | 202ms |  | 持续失败 |
| 73 | `/ai-qc` | ❌ | 0 | undefined/0 | 0/0 | 869ms |  | 持续失败 |
| 74 | `/ai-structured-report` | ❌ | 0 | undefined/0 | 0/0 | 1281ms |  | 持续失败 |
| 75 | `/ai-medical-device` | ❌ | 0 | undefined/0 | 0/0 | 184ms |  | 持续失败 |
| 76 | `/ai-draft` | ❌ | 0 | undefined/0 | 0/0 | 894ms |  | 持续失败 |
| 77 | `/ai-cad` | ❌ | 0 | undefined/0 | 0/0 | 1286ms |  | 持续失败 |
| 78 | `/ai/rads-scoring` | ❌ | 0 | undefined/0 | 0/0 | 170ms |  | 持续失败 |
| 79 | `/ai-marketplace` | ❌ | 0 | undefined/0 | 0/0 | 906ms |  | 持续失败 |
| 80 | `/qc` | ❌ | 0 | undefined/0 | 0/0 | 1274ms |  | 持续失败 |
| 81 | `/equipment-efficiency` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 82 | `/typical-cases` | ❌ | 0 | undefined/0 | 0/0 | 948ms |  | 持续失败 |
| 83 | `/teach/lecture` | ❌ | 0 | undefined/0 | 0/0 | 1261ms |  | 持续失败 |
| 84 | `/finding-library` | ❌ | 0 | undefined/0 | 0/0 | 152ms |  | 持续失败 |
| 85 | `/term-library` | ❌ | 0 | undefined/0 | 0/0 | 948ms |  | 持续失败 |
| 86 | `/template-management` | ❌ | 0 | undefined/0 | 0/0 | 1278ms |  | 持续失败 |
| 87 | `/template-designer` | ❌ | 0 | undefined/0 | 0/0 | 125ms |  | 持续失败 |
| 88 | `/template-inheritance` | ❌ | 0 | undefined/0 | 0/0 | 933ms |  | 持续失败 |
| 89 | `/template-category` | ❌ | 0 | undefined/0 | 0/0 | 1276ms |  | 持续失败 |
| 90 | `/term-synonym-graph` | ❌ | 0 | undefined/0 | 0/0 | 155ms |  | 持续失败 |
| 91 | `/report-phrase-bank` | ❌ | 0 | undefined/0 | 0/0 | 905ms |  | 持续失败 |
| 92 | `/safety/adverse-events` | ❌ | 0 | undefined/0 | 0/0 | 1281ms |  | 持续失败 |
| 93 | `/safety/cqi` | ❌ | 0 | undefined/0 | 0/0 | 157ms |  | 持续失败 |
| 94 | `/safety/patient-safety-goals` | ❌ | 0 | undefined/0 | 0/0 | 917ms |  | 持续失败 |
| 95 | `/safety/radiation-safety` | ❌ | 0 | undefined/0 | 0/0 | 1286ms |  | 持续失败 |
| 96 | `/safety/rca-analysis` | ❌ | 0 | undefined/0 | 0/0 | 155ms |  | 持续失败 |
| 97 | `/safety/risk-management` | ❌ | 0 | undefined/0 | 0/0 | 917ms |  | 持续失败 |
| 98 | `/ihe/pix` | ❌ | 0 | undefined/0 | 0/0 | 1271ms |  | 持续失败 |
| 99 | `/integration/fhir/bulk-export` | ❌ | 0 | undefined/0 | 0/0 | 171ms |  | 持续失败 |
| 100 | `/integration/fhir/bulk-export-detail` | ❌ | 0 | undefined/0 | 0/0 | 931ms |  | 持续失败 |
| 101 | `/regional-report` | ❌ | 0 | undefined/0 | 0/0 | 1256ms |  | 持续失败 |
| 102 | `/schedule` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 103 | `/department` | ❌ | 0 | undefined/0 | 0/0 | 951ms |  | 持续失败 |
| 104 | `/hie/medical-alliance` | ❌ | 0 | undefined/0 | 0/0 | 1258ms |  | 持续失败 |
| 105 | `/integration/fhir-server` | ❌ | 0 | undefined/0 | 0/0 | 139ms |  | 持续失败 |
| 106 | `/integration/ihe-connectathon` | ❌ | 0 | undefined/0 | 0/0 | 961ms |  | 持续失败 |
| 107 | `/integration/hl7-archive` | ❌ | 0 | undefined/0 | 0/0 | 1258ms |  | 持续失败 |
| 108 | `/integration/hl7-builder` | ❌ | 0 | undefined/0 | 0/0 | 155ms |  | 持续失败 |
| 109 | `/hl7-siu` | ❌ | 0 | undefined/0 | 0/0 | 925ms |  | 持续失败 |
| 110 | `/ihe/pam` | ❌ | 0 | undefined/0 | 0/0 | 1287ms |  | 持续失败 |
| 111 | `/ihe/visit` | ❌ | 0 | undefined/0 | 0/0 | 141ms |  | 持续失败 |
| 112 | `/integration/dimse` | ❌ | 0 | undefined/0 | 0/0 | 948ms |  | 持续失败 |
| 113 | `/integration/dimse/upload` | ❌ | 0 | undefined/0 | 0/0 | 1278ms |  | 持续失败 |
| 114 | `/cancer-screen` | ❌ | 0 | undefined/0 | 0/0 | 124ms |  | 持续失败 |
| 115 | `/patient-portal` | ❌ | 0 | undefined/0 | 0/0 | 936ms |  | 持续失败 |
| 116 | `/clinical-data` | ❌ | 0 | undefined/0 | 0/0 | 1294ms |  | 持续失败 |
| 117 | `/education/patient-education` | ❌ | 0 | undefined/0 | 0/0 | 122ms |  | 持续失败 |
| 118 | `/mobile/patient` | ❌ | 0 | undefined/0 | 0/0 | 948ms |  | 持续失败 |
| 119 | `/mobile/doctor` | ❌ | 0 | undefined/0 | 0/0 | 1307ms |  | 持续失败 |
| 120 | `/mobile/nurse` | ❌ | 0 | undefined/0 | 0/0 | 106ms |  | 持续失败 |
| 121 | `/mobile/tech` | ❌ | 0 | undefined/0 | 0/0 | 949ms |  | 持续失败 |
| 122 | `/statistics` | ❌ | 0 | undefined/0 | 0/0 | 1308ms |  | 持续失败 |
| 123 | `/green-it` | ❌ | 0 | undefined/0 | 0/0 | 93ms |  | 持续失败 |
| 124 | `/department-dashboard` | ❌ | 0 | undefined/0 | 0/0 | 955ms |  | 持续失败 |
| 125 | `/operations-center` | ❌ | 0 | undefined/0 | 0/0 | 1317ms |  | 持续失败 |
| 126 | `/cost-analysis` | ❌ | 0 | undefined/0 | 0/0 | 60ms |  | 持续失败 |
| 127 | `/stats-report` | ❌ | 0 | undefined/0 | 0/0 | 996ms |  | 持续失败 |
| 128 | `/nuclear-stats` | ❌ | 0 | undefined/0 | 0/0 | 1302ms |  | 持续失败 |
| 129 | `/report-kpi-dashboard` | ❌ | 0 | undefined/0 | 0/0 | 62ms |  | 持续失败 |
| 130 | `/doctor-workload` | ❌ | 0 | undefined/0 | 0/0 | 998ms |  | 持续失败 |
| 131 | `/diagnosis-accuracy` | ❌ | 0 | undefined/0 | 0/0 | 1292ms |  | 持续失败 |
| 132 | `/report-timeliness` | ❌ | 0 | undefined/0 | 0/0 | 45ms |  | 持续失败 |
| 133 | `/report-search` | ❌ | 0 | undefined/0 | 0/0 | 1013ms |  | 持续失败 |
| 134 | `/operations/oee` | ❌ | 0 | undefined/0 | 0/0 | 1278ms |  | 持续失败 |
| 135 | `/cardiac/database` | ❌ | 0 | undefined/0 | 0/0 | 61ms |  | 持续失败 |
| 136 | `/cardiac/operations` | ❌ | 0 | undefined/0 | 0/0 | 1012ms |  | 持续失败 |
| 137 | `/cardiac/qc` | ❌ | 0 | undefined/0 | 0/0 | 1290ms |  | 持续失败 |
| 138 | `/ops/devices` | ❌ | 0 | undefined/0 | 0/0 | 61ms |  | 持续失败 |
| 139 | `/ops/hr` | ❌ | 0 | undefined/0 | 0/0 | 1023ms |  | 持续失败 |
| 140 | `/ops/dashboard` | ❌ | 0 | undefined/0 | 0/0 | 1287ms |  | 持续失败 |
| 141 | `/operations/occupancy` | ❌ | 0 | undefined/0 | 0/0 | 60ms |  | 持续失败 |
| 142 | `/quality/department` | ❌ | 0 | undefined/0 | 0/0 | 1001ms |  | 持续失败 |
| 143 | `/analytics/benchmark-v2` | ❌ | 0 | undefined/0 | 0/0 | 1285ms |  | 持续失败 |
| 144 | `/analytics/benchmark-ai-diagnosis` | ❌ | 0 | undefined/0 | 0/0 | 61ms |  | 持续失败 |
| 145 | `/charge-items` | ❌ | 0 | undefined/0 | 0/0 | 1017ms |  | 持续失败 |
| 146 | `/accounts-receivable` | ❌ | 0 | undefined/0 | 0/0 | 1274ms |  | 持续失败 |
| 147 | `/revenue-analysis` | ❌ | 0 | undefined/0 | 0/0 | 62ms |  | 持续失败 |
| 148 | `/cost-accounting` | ❌ | 0 | undefined/0 | 0/0 | 1014ms |  | 持续失败 |
| 149 | `/financial-reports` | ❌ | 0 | undefined/0 | 0/0 | 1272ms |  | 持续失败 |
| 150 | `/national-report` | ❌ | 0 | undefined/0 | 0/0 | 61ms |  | 持续失败 |
| 151 | `/data-report-center` | ❌ | 0 | undefined/0 | 0/0 | 1045ms |  | 持续失败 |
| 152 | `/insurance-audit` | ❌ | 0 | undefined/0 | 0/0 | 1256ms |  | 持续失败 |
| 153 | `/enterprise-search` | ❌ | 0 | undefined/0 | 0/0 | 60ms |  | 持续失败 |
| 154 | `/eye` | ❌ | 0 | undefined/0 | 0/0 | 1059ms |  | 持续失败 |
| 155 | `/eye/pacs` | ❌ | 0 | undefined/0 | 0/0 | 1226ms |  | 持续失败 |
| 156 | `/eye/pacs/fundus` | ❌ | 0 | undefined/0 | 0/0 | 61ms |  | 持续失败 |
| 157 | `/eye/pacs/oct` | ❌ | 0 | undefined/0 | 0/0 | 1057ms |  | 持续失败 |
| 158 | `/eye/pacs/oct-a` | ❌ | 0 | undefined/0 | 0/0 | 1246ms |  | 持续失败 |
| 159 | `/eye/pacs/visual-field` | ❌ | 0 | undefined/0 | 0/0 | 76ms |  | 持续失败 |
| 160 | `/eye/pacs/topography` | ❌ | 0 | undefined/0 | 0/0 | 1053ms |  | 持续失败 |
| 161 | `/eye/pacs/ffa` | ❌ | 0 | undefined/0 | 0/0 | 1225ms |  | 持续失败 |
| 162 | `/eye/pacs/compare` | ❌ | 0 | undefined/0 | 0/0 | 94ms |  | 持续失败 |
| 163 | `/eye/pacs/montage` | ❌ | 0 | undefined/0 | 0/0 | 1058ms |  | 持续失败 |
| 164 | `/eye/ris` | ❌ | 0 | undefined/0 | 0/0 | 1213ms |  | 持续失败 |
| 165 | `/eye/report-write` | ❌ | 0 | undefined/0 | 0/0 | 93ms |  | 持续失败 |
| 166 | `/eye/ris/iol-calculator` | ❌ | 0 | undefined/0 | 0/0 | 1044ms |  | 持续失败 |
| 167 | `/eye/ris/va` | ❌ | 0 | undefined/0 | 0/0 | 1224ms |  | 持续失败 |
| 168 | `/eye/ris/iop` | ❌ | 0 | undefined/0 | 0/0 | 110ms |  | 持续失败 |
| 169 | `/eye/emr` | ❌ | 0 | undefined/0 | 0/0 | 1028ms |  | 持续失败 |
| 170 | `/eye/ai` | ❌ | 0 | undefined/0 | 0/0 | 1215ms |  | 持续失败 |
| 171 | `/eye/kpi-dashboard` | ❌ | 0 | undefined/0 | 0/0 | 106ms |  | 持续失败 |
| 172 | `/eye/pacs/real-viewer` | ❌ | 0 | undefined/0 | 0/0 | 1037ms |  | 持续失败 |
| 173 | `/eye/pacs/viewer` | ❌ | 0 | undefined/0 | 0/0 | 1212ms |  | 持续失败 |
| 174 | `/eye/ai-report` | ❌ | 0 | undefined/0 | 0/0 | 107ms |  | 持续失败 |
| 175 | `/eye/toric-planner` | ❌ | 0 | undefined/0 | 0/0 | 1027ms |  | 持续失败 |
| 176 | `/eye/sub/strabismus` | ❌ | 0 | undefined/0 | 0/0 | 1216ms |  | 持续失败 |
| 177 | `/eye/sub/neuro` | ❌ | 0 | undefined/0 | 0/0 | 136ms |  | 持续失败 |
| 178 | `/eye/sub/oncology` | ❌ | 0 | undefined/0 | 0/0 | 1009ms |  | 持续失败 |
| 179 | `/eye/sub/cornea` | ❌ | 0 | undefined/0 | 0/0 | 1226ms |  | 持续失败 |
| 180 | `/eye/sub/contact-lens` | ❌ | 0 | undefined/0 | 0/0 | 139ms |  | 持续失败 |
| 181 | `/eye/sub/low-vision` | ❌ | 0 | undefined/0 | 0/0 | 1007ms |  | 持续失败 |
| 182 | `/eye/sub/cataract` | ❌ | 0 | undefined/0 | 0/0 | 1215ms |  | 持续失败 |
| 183 | `/eye/sub/refractive` | ❌ | 0 | undefined/0 | 0/0 | 140ms |  | 持续失败 |
| 184 | `/eye/tele` | ❌ | 0 | undefined/0 | 0/0 | 1013ms |  | 持续失败 |
| 185 | `/eye/case-library` | ❌ | 0 | undefined/0 | 0/0 | 1197ms |  | 持续失败 |
| 186 | `/eye/optometry-loop` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 187 | `/dental` | ❌ | 0 | undefined/0 | 0/0 | 1006ms |  | 持续失败 |
| 188 | `/dental/studies` | ❌ | 0 | undefined/0 | 0/0 | 1196ms |  | 持续失败 |
| 189 | `/dental/chart` | ❌ | 0 | undefined/0 | 0/0 | 156ms |  | 持续失败 |
| 190 | `/dental/ai` | ❌ | 0 | undefined/0 | 0/0 | 1012ms |  | 持续失败 |
| 191 | `/dental/treatment` | ❌ | 0 | undefined/0 | 0/0 | 1181ms |  | 持续失败 |
| 192 | `/dental/implant` | ❌ | 0 | undefined/0 | 0/0 | 154ms |  | 持续失败 |
| 193 | `/dental/ortho` | ❌ | 0 | undefined/0 | 0/0 | 1018ms |  | 持续失败 |
| 194 | `/dental/tele` | ❌ | 0 | undefined/0 | 0/0 | 1182ms |  | 持续失败 |
| 195 | `/dental/inventory` | ❌ | 0 | undefined/0 | 0/0 | 140ms |  | 持续失败 |
| 196 | `/dental/dashboard` | ❌ | 0 | undefined/0 | 0/0 | 1042ms |  | 持续失败 |
| 197 | `/dental/cad` | ❌ | 0 | undefined/0 | 0/0 | 1181ms |  | 持续失败 |
| 198 | `/dental/implant-3d` | ❌ | 0 | undefined/0 | 0/0 | 138ms |  | 持续失败 |
| 199 | `/dental/guide` | ❌ | 0 | undefined/0 | 0/0 | 1042ms |  | 持续失败 |
