# Playwright 200×200 测试报告 — v3.0.6.11-32

> 生成时间: 2026-07-25T11:56:28.957Z
> 项目: G005-RISv-3.0.0
> 浏览器: chromium

## 一、测试总览

| 指标 | 数值 |
|------|:----:|
| Sidebar 总路由 | 233 |
| 测试路由数 | **200** |
| 通过页数 | **0** |
| 失败页数 | **200** |
| 崩溃页数 (P0) | **0** |
| **通过率** | **0.0%** |
| 按钮总数 | 0 |
| 按钮点击成功 | 0 |
| 假按钮/死按钮 | 0 |
| Tab 总数 | 0 |
| Tab 点击成功 | 0 |
| Console errors | 397 |
| Page errors | 2 |

## 二、失败页面清单

| # | 路由 | 失败原因 | body | 状态 | 崩溃 |
|---|------|----------|:----:|:----:|:----:|
| 0 | `/` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 1 | `/worklist` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 2 | `/triage/worklist` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 3 | `/exams` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 4 | `/patients` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 5 | `/appointments` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 6 | `/appointment-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 7 | `/queue-call` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 8 | `/follow-up` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 9 | `/kiosk/check-in` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 10 | `/patient/self-service` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 11 | `/patient/service-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 12 | `/patients/:id/360` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 13 | `/write-report` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 14 | `/reports/v3-write` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 15 | `/reports` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 16 | `/critical-value` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 17 | `/consultation` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 18 | `/tele/conference` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 19 | `/tele-sign` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 20 | `/report-review` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 21 | `/report-revisions` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 22 | `/collaboration` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 23 | `/dual-read` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 24 | `/keyword-check` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 25 | `/report-score-rule` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 26 | `/report-defect-library` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 27 | `/ai-report-draft` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 28 | `/critical-value-rule` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 29 | `/critical-value-stats` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 30 | `/special-assessment` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 31 | `/report-export` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 32 | `/publish` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 33 | `/report-delivery` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 34 | `/patient-report-portal` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 35 | `/ca-signature` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 36 | `/nlp/spellcheck` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 37 | `/asr/transcribe` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 38 | `/snomed/encode` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 39 | `/blockchain-proof` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 40 | `/cds/management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 41 | `/cds/statistics` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 42 | `/cds/rule-config` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 43 | `/review-center` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 44 | `/quality-control` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 45 | `/critical-value-center` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 46 | `/defect-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 47 | `/qc-dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 48 | `/qc-image` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 49 | `/qc-radiologist-annual` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 50 | `/qc/image-ai` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 51 | `/cosign` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 52 | `/radpath/tracker` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 53 | `/workflow-designer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 54 | `/routing-rules` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 55 | `/workload-heatmap` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 56 | `/sla-policy` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 57 | `/smart-route` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 58 | `/orchestrator` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 59 | `/dicom-viewer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 60 | `/dicom-viewer-pro` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 61 | `/dicom/fusion` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 62 | `/dicom/fusion-v2` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 63 | `/dicom/volume-viewer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 64 | `/print-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 65 | `/ai-assist` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 66 | `/vna-dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 67 | `/dicom/web` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 68 | `/dicom/compress` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 69 | `/dicom/4d` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 70 | `/cross-modal-search` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 71 | `/dicom/sr-manager` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 72 | `/dicom/radiomics` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 73 | `/ai-qc` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 74 | `/ai-structured-report` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 75 | `/ai-medical-device` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 76 | `/ai-draft` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 77 | `/ai-cad` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 78 | `/ai/rads-scoring` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 79 | `/ai-marketplace` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 80 | `/qc` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 81 | `/equipment-efficiency` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 82 | `/typical-cases` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 83 | `/teach/lecture` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 84 | `/finding-library` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 85 | `/term-library` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 86 | `/template-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 87 | `/template-designer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 88 | `/template-inheritance` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 89 | `/template-category` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 90 | `/term-synonym-graph` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 91 | `/report-phrase-bank` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 92 | `/safety/adverse-events` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 93 | `/safety/cqi` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 94 | `/safety/patient-safety-goals` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 95 | `/safety/radiation-safety` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 96 | `/safety/rca-analysis` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 97 | `/safety/risk-management` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 98 | `/ihe/pix` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 99 | `/integration/fhir/bulk-export` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 100 | `/integration/fhir/bulk-export-detail` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 101 | `/regional-report` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 102 | `/schedule` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 103 | `/department` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 104 | `/hie/medical-alliance` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 105 | `/integration/fhir-server` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 106 | `/integration/ihe-connectathon` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 107 | `/integration/hl7-archive` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 108 | `/integration/hl7-builder` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 109 | `/hl7-siu` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 110 | `/ihe/pam` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 111 | `/ihe/visit` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 112 | `/integration/dimse` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 113 | `/integration/dimse/upload` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 114 | `/cancer-screen` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 115 | `/patient-portal` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 116 | `/clinical-data` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 117 | `/education/patient-education` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 118 | `/mobile/patient` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 119 | `/mobile/doctor` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 120 | `/mobile/nurse` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 121 | `/mobile/tech` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 122 | `/statistics` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 123 | `/green-it` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 124 | `/department-dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 125 | `/operations-center` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 126 | `/cost-analysis` | BODY_LEN=0, STUCK | 0 | 0 |  |
| 127 | `/stats-report` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 128 | `/nuclear-stats` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 129 | `/report-kpi-dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 130 | `/doctor-workload` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 131 | `/diagnosis-accuracy` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 132 | `/report-timeliness` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 133 | `/report-search` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 134 | `/operations/oee` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 135 | `/cardiac/database` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 136 | `/cardiac/operations` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 137 | `/cardiac/qc` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 138 | `/ops/devices` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 139 | `/ops/hr` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 140 | `/ops/dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 141 | `/operations/occupancy` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 142 | `/quality/department` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 143 | `/analytics/benchmark-v2` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 144 | `/analytics/benchmark-ai-diagnosis` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 145 | `/charge-items` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 146 | `/accounts-receivable` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 147 | `/revenue-analysis` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 148 | `/cost-accounting` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 149 | `/financial-reports` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 150 | `/national-report` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 151 | `/data-report-center` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 152 | `/insurance-audit` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 153 | `/enterprise-search` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 154 | `/eye` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 155 | `/eye/pacs` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 156 | `/eye/pacs/fundus` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 157 | `/eye/pacs/oct` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 158 | `/eye/pacs/oct-a` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 159 | `/eye/pacs/visual-field` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 160 | `/eye/pacs/topography` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 161 | `/eye/pacs/ffa` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 162 | `/eye/pacs/compare` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 163 | `/eye/pacs/montage` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 164 | `/eye/ris` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 165 | `/eye/report-write` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 166 | `/eye/ris/iol-calculator` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 167 | `/eye/ris/va` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 168 | `/eye/ris/iop` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 169 | `/eye/emr` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 170 | `/eye/ai` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 171 | `/eye/kpi-dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 172 | `/eye/pacs/real-viewer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 173 | `/eye/pacs/viewer` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 174 | `/eye/ai-report` | CONSOLE_ERR=3, BODY_LEN=11 | 11 | 200 |  |
| 175 | `/eye/toric-planner` | BODY_LEN=0, STUCK | 0 | 0 |  |
| 176 | `/eye/sub/strabismus` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 177 | `/eye/sub/neuro` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 178 | `/eye/sub/oncology` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 179 | `/eye/sub/cornea` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 180 | `/eye/sub/contact-lens` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 181 | `/eye/sub/low-vision` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 182 | `/eye/sub/cataract` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 183 | `/eye/sub/refractive` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 184 | `/eye/tele` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 185 | `/eye/case-library` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 186 | `/eye/optometry-loop` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 187 | `/dental` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 188 | `/dental/studies` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 189 | `/dental/chart` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 190 | `/dental/ai` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 191 | `/dental/treatment` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 192 | `/dental/implant` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 193 | `/dental/ortho` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 194 | `/dental/tele` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 195 | `/dental/inventory` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 196 | `/dental/dashboard` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 197 | `/dental/cad` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 198 | `/dental/implant-3d` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |
| 199 | `/dental/guide` | CONSOLE_ERR=2, BODY_LEN=11 | 11 | 200 |  |

## 三、失败按钮 / Tab 清单

**✅ 无失败按钮/Tab**

## 四、Console Error 统计

- Console errors 总数: **397**
- Page errors 总数: **2**

## 五、截图清单

| # | 路由 | 截图文件 |
|---|------|----------|
| 0 | `/` | `e2e/screenshots-200/000_root.png` |
| 1 | `/worklist` | `e2e/screenshots-200/001_worklist.png` |
| 2 | `/triage/worklist` | `e2e/screenshots-200/002_triage_worklist.png` |
| 3 | `/exams` | `e2e/screenshots-200/003_exams.png` |
| 4 | `/patients` | `e2e/screenshots-200/004_patients.png` |
| 5 | `/appointments` | `e2e/screenshots-200/005_appointments.png` |
| 6 | `/appointment-management` | `e2e/screenshots-200/006_appointment-management.png` |
| 7 | `/queue-call` | `e2e/screenshots-200/007_queue-call.png` |
| 8 | `/follow-up` | `e2e/screenshots-200/008_follow-up.png` |
| 9 | `/kiosk/check-in` | `e2e/screenshots-200/009_kiosk_check-in.png` |
| 10 | `/patient/self-service` | `e2e/screenshots-200/010_patient_self-service.png` |
| 11 | `/patient/service-management` | `e2e/screenshots-200/011_patient_service-management.png` |
| 12 | `/patients/:id/360` | `e2e/screenshots-200/012_patients__id_360.png` |
| 13 | `/write-report` | `e2e/screenshots-200/013_write-report.png` |
| 14 | `/reports/v3-write` | `e2e/screenshots-200/014_reports_v3-write.png` |
| 15 | `/reports` | `e2e/screenshots-200/015_reports.png` |
| 16 | `/critical-value` | `e2e/screenshots-200/016_critical-value.png` |
| 17 | `/consultation` | `e2e/screenshots-200/017_consultation.png` |
| 18 | `/tele/conference` | `e2e/screenshots-200/018_tele_conference.png` |
| 19 | `/tele-sign` | `e2e/screenshots-200/019_tele-sign.png` |
| 20 | `/report-review` | `e2e/screenshots-200/020_report-review.png` |
| 21 | `/report-revisions` | `e2e/screenshots-200/021_report-revisions.png` |
| 22 | `/collaboration` | `e2e/screenshots-200/022_collaboration.png` |
| 23 | `/dual-read` | `e2e/screenshots-200/023_dual-read.png` |
| 24 | `/keyword-check` | `e2e/screenshots-200/024_keyword-check.png` |
| 25 | `/report-score-rule` | `e2e/screenshots-200/025_report-score-rule.png` |
| 26 | `/report-defect-library` | `e2e/screenshots-200/026_report-defect-library.png` |
| 27 | `/ai-report-draft` | `e2e/screenshots-200/027_ai-report-draft.png` |
| 28 | `/critical-value-rule` | `e2e/screenshots-200/028_critical-value-rule.png` |
| 29 | `/critical-value-stats` | `e2e/screenshots-200/029_critical-value-stats.png` |
| 30 | `/special-assessment` | `e2e/screenshots-200/030_special-assessment.png` |
| 31 | `/report-export` | `e2e/screenshots-200/031_report-export.png` |
| 32 | `/publish` | `e2e/screenshots-200/032_publish.png` |
| 33 | `/report-delivery` | `e2e/screenshots-200/033_report-delivery.png` |
| 34 | `/patient-report-portal` | `e2e/screenshots-200/034_patient-report-portal.png` |
| 35 | `/ca-signature` | `e2e/screenshots-200/035_ca-signature.png` |
| 36 | `/nlp/spellcheck` | `e2e/screenshots-200/036_nlp_spellcheck.png` |
| 37 | `/asr/transcribe` | `e2e/screenshots-200/037_asr_transcribe.png` |
| 38 | `/snomed/encode` | `e2e/screenshots-200/038_snomed_encode.png` |
| 39 | `/blockchain-proof` | `e2e/screenshots-200/039_blockchain-proof.png` |
| 40 | `/cds/management` | `e2e/screenshots-200/040_cds_management.png` |
| 41 | `/cds/statistics` | `e2e/screenshots-200/041_cds_statistics.png` |
| 42 | `/cds/rule-config` | `e2e/screenshots-200/042_cds_rule-config.png` |
| 43 | `/review-center` | `e2e/screenshots-200/043_review-center.png` |
| 44 | `/quality-control` | `e2e/screenshots-200/044_quality-control.png` |
| 45 | `/critical-value-center` | `e2e/screenshots-200/045_critical-value-center.png` |
| 46 | `/defect-management` | `e2e/screenshots-200/046_defect-management.png` |
| 47 | `/qc-dashboard` | `e2e/screenshots-200/047_qc-dashboard.png` |
| 48 | `/qc-image` | `e2e/screenshots-200/048_qc-image.png` |
| 49 | `/qc-radiologist-annual` | `e2e/screenshots-200/049_qc-radiologist-annual.png` |
| 50 | `/qc/image-ai` | `e2e/screenshots-200/050_qc_image-ai.png` |
| 51 | `/cosign` | `e2e/screenshots-200/051_cosign.png` |
| 52 | `/radpath/tracker` | `e2e/screenshots-200/052_radpath_tracker.png` |
| 53 | `/workflow-designer` | `e2e/screenshots-200/053_workflow-designer.png` |
| 54 | `/routing-rules` | `e2e/screenshots-200/054_routing-rules.png` |
| 55 | `/workload-heatmap` | `e2e/screenshots-200/055_workload-heatmap.png` |
| 56 | `/sla-policy` | `e2e/screenshots-200/056_sla-policy.png` |
| 57 | `/smart-route` | `e2e/screenshots-200/057_smart-route.png` |
| 58 | `/orchestrator` | `e2e/screenshots-200/058_orchestrator.png` |
| 59 | `/dicom-viewer` | `e2e/screenshots-200/059_dicom-viewer.png` |
| 60 | `/dicom-viewer-pro` | `e2e/screenshots-200/060_dicom-viewer-pro.png` |
| 61 | `/dicom/fusion` | `e2e/screenshots-200/061_dicom_fusion.png` |
| 62 | `/dicom/fusion-v2` | `e2e/screenshots-200/062_dicom_fusion-v2.png` |
| 63 | `/dicom/volume-viewer` | `e2e/screenshots-200/063_dicom_volume-viewer.png` |
| 64 | `/print-management` | `e2e/screenshots-200/064_print-management.png` |
| 65 | `/ai-assist` | `e2e/screenshots-200/065_ai-assist.png` |
| 66 | `/vna-dashboard` | `e2e/screenshots-200/066_vna-dashboard.png` |
| 67 | `/dicom/web` | `e2e/screenshots-200/067_dicom_web.png` |
| 68 | `/dicom/compress` | `e2e/screenshots-200/068_dicom_compress.png` |
| 69 | `/dicom/4d` | `e2e/screenshots-200/069_dicom_4d.png` |
| 70 | `/cross-modal-search` | `e2e/screenshots-200/070_cross-modal-search.png` |
| 71 | `/dicom/sr-manager` | `e2e/screenshots-200/071_dicom_sr-manager.png` |
| 72 | `/dicom/radiomics` | `e2e/screenshots-200/072_dicom_radiomics.png` |
| 73 | `/ai-qc` | `e2e/screenshots-200/073_ai-qc.png` |
| 74 | `/ai-structured-report` | `e2e/screenshots-200/074_ai-structured-report.png` |
| 75 | `/ai-medical-device` | `e2e/screenshots-200/075_ai-medical-device.png` |
| 76 | `/ai-draft` | `e2e/screenshots-200/076_ai-draft.png` |
| 77 | `/ai-cad` | `e2e/screenshots-200/077_ai-cad.png` |
| 78 | `/ai/rads-scoring` | `e2e/screenshots-200/078_ai_rads-scoring.png` |
| 79 | `/ai-marketplace` | `e2e/screenshots-200/079_ai-marketplace.png` |
| 80 | `/qc` | `e2e/screenshots-200/080_qc.png` |
| 81 | `/equipment-efficiency` | `e2e/screenshots-200/081_equipment-efficiency.png` |
| 82 | `/typical-cases` | `e2e/screenshots-200/082_typical-cases.png` |
| 83 | `/teach/lecture` | `e2e/screenshots-200/083_teach_lecture.png` |
| 84 | `/finding-library` | `e2e/screenshots-200/084_finding-library.png` |
| 85 | `/term-library` | `e2e/screenshots-200/085_term-library.png` |
| 86 | `/template-management` | `e2e/screenshots-200/086_template-management.png` |
| 87 | `/template-designer` | `e2e/screenshots-200/087_template-designer.png` |
| 88 | `/template-inheritance` | `e2e/screenshots-200/088_template-inheritance.png` |
| 89 | `/template-category` | `e2e/screenshots-200/089_template-category.png` |
| 90 | `/term-synonym-graph` | `e2e/screenshots-200/090_term-synonym-graph.png` |
| 91 | `/report-phrase-bank` | `e2e/screenshots-200/091_report-phrase-bank.png` |
| 92 | `/safety/adverse-events` | `e2e/screenshots-200/092_safety_adverse-events.png` |
| 93 | `/safety/cqi` | `e2e/screenshots-200/093_safety_cqi.png` |
| 94 | `/safety/patient-safety-goals` | `e2e/screenshots-200/094_safety_patient-safety-goals.png` |
| 95 | `/safety/radiation-safety` | `e2e/screenshots-200/095_safety_radiation-safety.png` |
| 96 | `/safety/rca-analysis` | `e2e/screenshots-200/096_safety_rca-analysis.png` |
| 97 | `/safety/risk-management` | `e2e/screenshots-200/097_safety_risk-management.png` |
| 98 | `/ihe/pix` | `e2e/screenshots-200/098_ihe_pix.png` |
| 99 | `/integration/fhir/bulk-export` | `e2e/screenshots-200/099_integration_fhir_bulk-export.png` |
| 100 | `/integration/fhir/bulk-export-detail` | `e2e/screenshots-200/100_integration_fhir_bulk-export-detail.png` |
| 101 | `/regional-report` | `e2e/screenshots-200/101_regional-report.png` |
| 102 | `/schedule` | `e2e/screenshots-200/102_schedule.png` |
| 103 | `/department` | `e2e/screenshots-200/103_department.png` |
| 104 | `/hie/medical-alliance` | `e2e/screenshots-200/104_hie_medical-alliance.png` |
| 105 | `/integration/fhir-server` | `e2e/screenshots-200/105_integration_fhir-server.png` |
| 106 | `/integration/ihe-connectathon` | `e2e/screenshots-200/106_integration_ihe-connectathon.png` |
| 107 | `/integration/hl7-archive` | `e2e/screenshots-200/107_integration_hl7-archive.png` |
| 108 | `/integration/hl7-builder` | `e2e/screenshots-200/108_integration_hl7-builder.png` |
| 109 | `/hl7-siu` | `e2e/screenshots-200/109_hl7-siu.png` |
| 110 | `/ihe/pam` | `e2e/screenshots-200/110_ihe_pam.png` |
| 111 | `/ihe/visit` | `e2e/screenshots-200/111_ihe_visit.png` |
| 112 | `/integration/dimse` | `e2e/screenshots-200/112_integration_dimse.png` |
| 113 | `/integration/dimse/upload` | `e2e/screenshots-200/113_integration_dimse_upload.png` |
| 114 | `/cancer-screen` | `e2e/screenshots-200/114_cancer-screen.png` |
| 115 | `/patient-portal` | `e2e/screenshots-200/115_patient-portal.png` |
| 116 | `/clinical-data` | `e2e/screenshots-200/116_clinical-data.png` |
| 117 | `/education/patient-education` | `e2e/screenshots-200/117_education_patient-education.png` |
| 118 | `/mobile/patient` | `e2e/screenshots-200/118_mobile_patient.png` |
| 119 | `/mobile/doctor` | `e2e/screenshots-200/119_mobile_doctor.png` |
| 120 | `/mobile/nurse` | `e2e/screenshots-200/120_mobile_nurse.png` |
| 121 | `/mobile/tech` | `e2e/screenshots-200/121_mobile_tech.png` |
| 122 | `/statistics` | `e2e/screenshots-200/122_statistics.png` |
| 123 | `/green-it` | `e2e/screenshots-200/123_green-it.png` |
| 124 | `/department-dashboard` | `e2e/screenshots-200/124_department-dashboard.png` |
| 125 | `/operations-center` | `e2e/screenshots-200/125_operations-center.png` |
| 127 | `/stats-report` | `e2e/screenshots-200/127_stats-report.png` |
| 128 | `/nuclear-stats` | `e2e/screenshots-200/128_nuclear-stats.png` |
| 129 | `/report-kpi-dashboard` | `e2e/screenshots-200/129_report-kpi-dashboard.png` |
| 130 | `/doctor-workload` | `e2e/screenshots-200/130_doctor-workload.png` |
| 131 | `/diagnosis-accuracy` | `e2e/screenshots-200/131_diagnosis-accuracy.png` |
| 132 | `/report-timeliness` | `e2e/screenshots-200/132_report-timeliness.png` |
| 133 | `/report-search` | `e2e/screenshots-200/133_report-search.png` |
| 134 | `/operations/oee` | `e2e/screenshots-200/134_operations_oee.png` |
| 135 | `/cardiac/database` | `e2e/screenshots-200/135_cardiac_database.png` |
| 136 | `/cardiac/operations` | `e2e/screenshots-200/136_cardiac_operations.png` |
| 137 | `/cardiac/qc` | `e2e/screenshots-200/137_cardiac_qc.png` |
| 138 | `/ops/devices` | `e2e/screenshots-200/138_ops_devices.png` |
| 139 | `/ops/hr` | `e2e/screenshots-200/139_ops_hr.png` |
| 140 | `/ops/dashboard` | `e2e/screenshots-200/140_ops_dashboard.png` |
| 141 | `/operations/occupancy` | `e2e/screenshots-200/141_operations_occupancy.png` |
| 142 | `/quality/department` | `e2e/screenshots-200/142_quality_department.png` |
| 143 | `/analytics/benchmark-v2` | `e2e/screenshots-200/143_analytics_benchmark-v2.png` |
| 144 | `/analytics/benchmark-ai-diagnosis` | `e2e/screenshots-200/144_analytics_benchmark-ai-diagnosis.png` |
| 145 | `/charge-items` | `e2e/screenshots-200/145_charge-items.png` |
| 146 | `/accounts-receivable` | `e2e/screenshots-200/146_accounts-receivable.png` |
| 147 | `/revenue-analysis` | `e2e/screenshots-200/147_revenue-analysis.png` |
| 148 | `/cost-accounting` | `e2e/screenshots-200/148_cost-accounting.png` |
| 149 | `/financial-reports` | `e2e/screenshots-200/149_financial-reports.png` |
| 150 | `/national-report` | `e2e/screenshots-200/150_national-report.png` |
| 151 | `/data-report-center` | `e2e/screenshots-200/151_data-report-center.png` |
| 152 | `/insurance-audit` | `e2e/screenshots-200/152_insurance-audit.png` |
| 153 | `/enterprise-search` | `e2e/screenshots-200/153_enterprise-search.png` |
| 154 | `/eye` | `e2e/screenshots-200/154_eye.png` |
| 155 | `/eye/pacs` | `e2e/screenshots-200/155_eye_pacs.png` |
| 156 | `/eye/pacs/fundus` | `e2e/screenshots-200/156_eye_pacs_fundus.png` |
| 157 | `/eye/pacs/oct` | `e2e/screenshots-200/157_eye_pacs_oct.png` |
| 158 | `/eye/pacs/oct-a` | `e2e/screenshots-200/158_eye_pacs_oct-a.png` |
| 159 | `/eye/pacs/visual-field` | `e2e/screenshots-200/159_eye_pacs_visual-field.png` |
| 160 | `/eye/pacs/topography` | `e2e/screenshots-200/160_eye_pacs_topography.png` |
| 161 | `/eye/pacs/ffa` | `e2e/screenshots-200/161_eye_pacs_ffa.png` |
| 162 | `/eye/pacs/compare` | `e2e/screenshots-200/162_eye_pacs_compare.png` |
| 163 | `/eye/pacs/montage` | `e2e/screenshots-200/163_eye_pacs_montage.png` |
| 164 | `/eye/ris` | `e2e/screenshots-200/164_eye_ris.png` |
| 165 | `/eye/report-write` | `e2e/screenshots-200/165_eye_report-write.png` |
| 166 | `/eye/ris/iol-calculator` | `e2e/screenshots-200/166_eye_ris_iol-calculator.png` |
| 167 | `/eye/ris/va` | `e2e/screenshots-200/167_eye_ris_va.png` |
| 168 | `/eye/ris/iop` | `e2e/screenshots-200/168_eye_ris_iop.png` |
| 169 | `/eye/emr` | `e2e/screenshots-200/169_eye_emr.png` |
| 170 | `/eye/ai` | `e2e/screenshots-200/170_eye_ai.png` |
| 171 | `/eye/kpi-dashboard` | `e2e/screenshots-200/171_eye_kpi-dashboard.png` |
| 172 | `/eye/pacs/real-viewer` | `e2e/screenshots-200/172_eye_pacs_real-viewer.png` |
| 173 | `/eye/pacs/viewer` | `e2e/screenshots-200/173_eye_pacs_viewer.png` |
| 174 | `/eye/ai-report` | `e2e/screenshots-200/174_eye_ai-report.png` |
| 176 | `/eye/sub/strabismus` | `e2e/screenshots-200/176_eye_sub_strabismus.png` |
| 177 | `/eye/sub/neuro` | `e2e/screenshots-200/177_eye_sub_neuro.png` |
| 178 | `/eye/sub/oncology` | `e2e/screenshots-200/178_eye_sub_oncology.png` |
| 179 | `/eye/sub/cornea` | `e2e/screenshots-200/179_eye_sub_cornea.png` |
| 180 | `/eye/sub/contact-lens` | `e2e/screenshots-200/180_eye_sub_contact-lens.png` |
| 181 | `/eye/sub/low-vision` | `e2e/screenshots-200/181_eye_sub_low-vision.png` |
| 182 | `/eye/sub/cataract` | `e2e/screenshots-200/182_eye_sub_cataract.png` |
| 183 | `/eye/sub/refractive` | `e2e/screenshots-200/183_eye_sub_refractive.png` |
| 184 | `/eye/tele` | `e2e/screenshots-200/184_eye_tele.png` |
| 185 | `/eye/case-library` | `e2e/screenshots-200/185_eye_case-library.png` |
| 186 | `/eye/optometry-loop` | `e2e/screenshots-200/186_eye_optometry-loop.png` |
| 187 | `/dental` | `e2e/screenshots-200/187_dental.png` |
| 188 | `/dental/studies` | `e2e/screenshots-200/188_dental_studies.png` |
| 189 | `/dental/chart` | `e2e/screenshots-200/189_dental_chart.png` |
| 190 | `/dental/ai` | `e2e/screenshots-200/190_dental_ai.png` |
| 191 | `/dental/treatment` | `e2e/screenshots-200/191_dental_treatment.png` |
| 192 | `/dental/implant` | `e2e/screenshots-200/192_dental_implant.png` |
| 193 | `/dental/ortho` | `e2e/screenshots-200/193_dental_ortho.png` |
| 194 | `/dental/tele` | `e2e/screenshots-200/194_dental_tele.png` |
| 195 | `/dental/inventory` | `e2e/screenshots-200/195_dental_inventory.png` |
| 196 | `/dental/dashboard` | `e2e/screenshots-200/196_dental_dashboard.png` |
| 197 | `/dental/cad` | `e2e/screenshots-200/197_dental_cad.png` |
| 198 | `/dental/implant-3d` | `e2e/screenshots-200/198_dental_implant-3d.png` |
| 199 | `/dental/guide` | `e2e/screenshots-200/199_dental_guide.png` |

## 六、全部页面结果

| # | 路由 | pass | body | 按钮 | Tab | 用时 | 原因 |
|---|------|:----:|:----:|:----:|:---:|:----:|------|
| 0 | `/` | ❌ | 11 | undefined/0 | 0/0 | 3439ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 1 | `/worklist` | ❌ | 11 | undefined/0 | 0/0 | 1939ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 2 | `/triage/worklist` | ❌ | 11 | undefined/0 | 0/0 | 1948ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 3 | `/exams` | ❌ | 11 | undefined/0 | 0/0 | 1897ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 4 | `/patients` | ❌ | 11 | undefined/0 | 0/0 | 1909ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 5 | `/appointments` | ❌ | 11 | undefined/0 | 0/0 | 1926ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 6 | `/appointment-management` | ❌ | 11 | undefined/0 | 0/0 | 1884ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 7 | `/queue-call` | ❌ | 11 | undefined/0 | 0/0 | 1901ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 8 | `/follow-up` | ❌ | 11 | undefined/0 | 0/0 | 1876ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 9 | `/kiosk/check-in` | ❌ | 11 | undefined/0 | 0/0 | 1890ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 10 | `/patient/self-service` | ❌ | 11 | undefined/0 | 0/0 | 1913ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 11 | `/patient/service-management` | ❌ | 11 | undefined/0 | 0/0 | 1900ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 12 | `/patients/:id/360` | ❌ | 11 | undefined/0 | 0/0 | 1882ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 13 | `/write-report` | ❌ | 11 | undefined/0 | 0/0 | 1890ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 14 | `/reports/v3-write` | ❌ | 11 | undefined/0 | 0/0 | 2025ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 15 | `/reports` | ❌ | 11 | undefined/0 | 0/0 | 2024ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 16 | `/critical-value` | ❌ | 11 | undefined/0 | 0/0 | 2357ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 17 | `/consultation` | ❌ | 11 | undefined/0 | 0/0 | 2007ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 18 | `/tele/conference` | ❌ | 11 | undefined/0 | 0/0 | 2086ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 19 | `/tele-sign` | ❌ | 11 | undefined/0 | 0/0 | 1955ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 20 | `/report-review` | ❌ | 11 | undefined/0 | 0/0 | 1922ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 21 | `/report-revisions` | ❌ | 11 | undefined/0 | 0/0 | 1896ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 22 | `/collaboration` | ❌ | 11 | undefined/0 | 0/0 | 1872ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 23 | `/dual-read` | ❌ | 11 | undefined/0 | 0/0 | 1897ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 24 | `/keyword-check` | ❌ | 11 | undefined/0 | 0/0 | 1929ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 25 | `/report-score-rule` | ❌ | 11 | undefined/0 | 0/0 | 2019ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 26 | `/report-defect-library` | ❌ | 11 | undefined/0 | 0/0 | 2057ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 27 | `/ai-report-draft` | ❌ | 11 | undefined/0 | 0/0 | 2013ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 28 | `/critical-value-rule` | ❌ | 11 | undefined/0 | 0/0 | 1986ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 29 | `/critical-value-stats` | ❌ | 11 | undefined/0 | 0/0 | 1889ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 30 | `/special-assessment` | ❌ | 11 | undefined/0 | 0/0 | 1876ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 31 | `/report-export` | ❌ | 11 | undefined/0 | 0/0 | 1861ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 32 | `/publish` | ❌ | 11 | undefined/0 | 0/0 | 1843ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 33 | `/report-delivery` | ❌ | 11 | undefined/0 | 0/0 | 1831ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 34 | `/patient-report-portal` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 35 | `/ca-signature` | ❌ | 11 | undefined/0 | 0/0 | 1833ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 36 | `/nlp/spellcheck` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 37 | `/asr/transcribe` | ❌ | 11 | undefined/0 | 0/0 | 1847ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 38 | `/snomed/encode` | ❌ | 11 | undefined/0 | 0/0 | 1842ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 39 | `/blockchain-proof` | ❌ | 11 | undefined/0 | 0/0 | 1855ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 40 | `/cds/management` | ❌ | 11 | undefined/0 | 0/0 | 1840ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 41 | `/cds/statistics` | ❌ | 11 | undefined/0 | 0/0 | 1825ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 42 | `/cds/rule-config` | ❌ | 11 | undefined/0 | 0/0 | 1817ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 43 | `/review-center` | ❌ | 11 | undefined/0 | 0/0 | 1828ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 44 | `/quality-control` | ❌ | 11 | undefined/0 | 0/0 | 1836ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 45 | `/critical-value-center` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 46 | `/defect-management` | ❌ | 11 | undefined/0 | 0/0 | 1815ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 47 | `/qc-dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1831ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 48 | `/qc-image` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 49 | `/qc-radiologist-annual` | ❌ | 11 | undefined/0 | 0/0 | 1836ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 50 | `/qc/image-ai` | ❌ | 11 | undefined/0 | 0/0 | 1829ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 51 | `/cosign` | ❌ | 11 | undefined/0 | 0/0 | 1816ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 52 | `/radpath/tracker` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 53 | `/workflow-designer` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 54 | `/routing-rules` | ❌ | 11 | undefined/0 | 0/0 | 1850ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 55 | `/workload-heatmap` | ❌ | 11 | undefined/0 | 0/0 | 1831ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 56 | `/sla-policy` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 57 | `/smart-route` | ❌ | 11 | undefined/0 | 0/0 | 1837ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 58 | `/orchestrator` | ❌ | 11 | undefined/0 | 0/0 | 1828ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 59 | `/dicom-viewer` | ❌ | 11 | undefined/0 | 0/0 | 1833ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 60 | `/dicom-viewer-pro` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 61 | `/dicom/fusion` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 62 | `/dicom/fusion-v2` | ❌ | 11 | undefined/0 | 0/0 | 1833ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 63 | `/dicom/volume-viewer` | ❌ | 11 | undefined/0 | 0/0 | 1822ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 64 | `/print-management` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 65 | `/ai-assist` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 66 | `/vna-dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1949ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 67 | `/dicom/web` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 68 | `/dicom/compress` | ❌ | 11 | undefined/0 | 0/0 | 1847ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 69 | `/dicom/4d` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 70 | `/cross-modal-search` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 71 | `/dicom/sr-manager` | ❌ | 11 | undefined/0 | 0/0 | 1835ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 72 | `/dicom/radiomics` | ❌ | 11 | undefined/0 | 0/0 | 1836ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 73 | `/ai-qc` | ❌ | 11 | undefined/0 | 0/0 | 1828ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 74 | `/ai-structured-report` | ❌ | 11 | undefined/0 | 0/0 | 1856ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 75 | `/ai-medical-device` | ❌ | 11 | undefined/0 | 0/0 | 1824ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 76 | `/ai-draft` | ❌ | 11 | undefined/0 | 0/0 | 1832ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 77 | `/ai-cad` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 78 | `/ai/rads-scoring` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 79 | `/ai-marketplace` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 80 | `/qc` | ❌ | 11 | undefined/0 | 0/0 | 1815ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 81 | `/equipment-efficiency` | ❌ | 11 | undefined/0 | 0/0 | 1838ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 82 | `/typical-cases` | ❌ | 11 | undefined/0 | 0/0 | 1843ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 83 | `/teach/lecture` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 84 | `/finding-library` | ❌ | 11 | undefined/0 | 0/0 | 1815ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 85 | `/term-library` | ❌ | 11 | undefined/0 | 0/0 | 1837ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 86 | `/template-management` | ❌ | 11 | undefined/0 | 0/0 | 1812ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 87 | `/template-designer` | ❌ | 11 | undefined/0 | 0/0 | 1831ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 88 | `/template-inheritance` | ❌ | 11 | undefined/0 | 0/0 | 1849ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 89 | `/template-category` | ❌ | 11 | undefined/0 | 0/0 | 1838ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 90 | `/term-synonym-graph` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 91 | `/report-phrase-bank` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 92 | `/safety/adverse-events` | ❌ | 11 | undefined/0 | 0/0 | 1857ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 93 | `/safety/cqi` | ❌ | 11 | undefined/0 | 0/0 | 1842ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 94 | `/safety/patient-safety-goals` | ❌ | 11 | undefined/0 | 0/0 | 1853ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 95 | `/safety/radiation-safety` | ❌ | 11 | undefined/0 | 0/0 | 1843ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 96 | `/safety/rca-analysis` | ❌ | 11 | undefined/0 | 0/0 | 1833ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 97 | `/safety/risk-management` | ❌ | 11 | undefined/0 | 0/0 | 1853ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 98 | `/ihe/pix` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 99 | `/integration/fhir/bulk-export` | ❌ | 11 | undefined/0 | 0/0 | 1851ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 100 | `/integration/fhir/bulk-export-detail` | ❌ | 11 | undefined/0 | 0/0 | 1831ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 101 | `/regional-report` | ❌ | 11 | undefined/0 | 0/0 | 1829ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 102 | `/schedule` | ❌ | 11 | undefined/0 | 0/0 | 1838ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 103 | `/department` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 104 | `/hie/medical-alliance` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 105 | `/integration/fhir-server` | ❌ | 11 | undefined/0 | 0/0 | 1846ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 106 | `/integration/ihe-connectathon` | ❌ | 11 | undefined/0 | 0/0 | 1855ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 107 | `/integration/hl7-archive` | ❌ | 11 | undefined/0 | 0/0 | 1839ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 108 | `/integration/hl7-builder` | ❌ | 11 | undefined/0 | 0/0 | 1837ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 109 | `/hl7-siu` | ❌ | 11 | undefined/0 | 0/0 | 1841ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 110 | `/ihe/pam` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 111 | `/ihe/visit` | ❌ | 11 | undefined/0 | 0/0 | 1843ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 112 | `/integration/dimse` | ❌ | 11 | undefined/0 | 0/0 | 1850ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 113 | `/integration/dimse/upload` | ❌ | 11 | undefined/0 | 0/0 | 1830ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 114 | `/cancer-screen` | ❌ | 11 | undefined/0 | 0/0 | 1835ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 115 | `/patient-portal` | ❌ | 11 | undefined/0 | 0/0 | 1846ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 116 | `/clinical-data` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 117 | `/education/patient-education` | ❌ | 11 | undefined/0 | 0/0 | 1827ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 118 | `/mobile/patient` | ❌ | 11 | undefined/0 | 0/0 | 1836ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 119 | `/mobile/doctor` | ❌ | 11 | undefined/0 | 0/0 | 1850ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 120 | `/mobile/nurse` | ❌ | 11 | undefined/0 | 0/0 | 1847ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 121 | `/mobile/tech` | ❌ | 11 | undefined/0 | 0/0 | 1815ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 122 | `/statistics` | ❌ | 11 | undefined/0 | 0/0 | 1852ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 123 | `/green-it` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 124 | `/department-dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1858ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 125 | `/operations-center` | ❌ | 11 | undefined/0 | 0/0 | 1834ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 126 | `/cost-analysis` | ❌ | 0 | undefined/0 | 0/0 | 764ms | BODY_LEN=0, STUCK |
| 127 | `/stats-report` | ❌ | 11 | undefined/0 | 0/0 | 23068ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 128 | `/nuclear-stats` | ❌ | 11 | undefined/0 | 0/0 | 1908ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 129 | `/report-kpi-dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1905ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 130 | `/doctor-workload` | ❌ | 11 | undefined/0 | 0/0 | 1888ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 131 | `/diagnosis-accuracy` | ❌ | 11 | undefined/0 | 0/0 | 1906ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 132 | `/report-timeliness` | ❌ | 11 | undefined/0 | 0/0 | 1882ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 133 | `/report-search` | ❌ | 11 | undefined/0 | 0/0 | 1934ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 134 | `/operations/oee` | ❌ | 11 | undefined/0 | 0/0 | 1937ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 135 | `/cardiac/database` | ❌ | 11 | undefined/0 | 0/0 | 1934ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 136 | `/cardiac/operations` | ❌ | 11 | undefined/0 | 0/0 | 1928ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 137 | `/cardiac/qc` | ❌ | 11 | undefined/0 | 0/0 | 1943ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 138 | `/ops/devices` | ❌ | 11 | undefined/0 | 0/0 | 1919ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 139 | `/ops/hr` | ❌ | 11 | undefined/0 | 0/0 | 1924ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 140 | `/ops/dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1904ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 141 | `/operations/occupancy` | ❌ | 11 | undefined/0 | 0/0 | 1918ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 142 | `/quality/department` | ❌ | 11 | undefined/0 | 0/0 | 1951ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 143 | `/analytics/benchmark-v2` | ❌ | 11 | undefined/0 | 0/0 | 1966ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 144 | `/analytics/benchmark-ai-diagnosis` | ❌ | 11 | undefined/0 | 0/0 | 1935ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 145 | `/charge-items` | ❌ | 11 | undefined/0 | 0/0 | 1899ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 146 | `/accounts-receivable` | ❌ | 11 | undefined/0 | 0/0 | 1892ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 147 | `/revenue-analysis` | ❌ | 11 | undefined/0 | 0/0 | 1882ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 148 | `/cost-accounting` | ❌ | 11 | undefined/0 | 0/0 | 1920ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 149 | `/financial-reports` | ❌ | 11 | undefined/0 | 0/0 | 1942ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 150 | `/national-report` | ❌ | 11 | undefined/0 | 0/0 | 1931ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 151 | `/data-report-center` | ❌ | 11 | undefined/0 | 0/0 | 1928ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 152 | `/insurance-audit` | ❌ | 11 | undefined/0 | 0/0 | 1903ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 153 | `/enterprise-search` | ❌ | 11 | undefined/0 | 0/0 | 1895ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 154 | `/eye` | ❌ | 11 | undefined/0 | 0/0 | 1900ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 155 | `/eye/pacs` | ❌ | 11 | undefined/0 | 0/0 | 1897ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 156 | `/eye/pacs/fundus` | ❌ | 11 | undefined/0 | 0/0 | 1934ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 157 | `/eye/pacs/oct` | ❌ | 11 | undefined/0 | 0/0 | 2022ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 158 | `/eye/pacs/oct-a` | ❌ | 11 | undefined/0 | 0/0 | 2329ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 159 | `/eye/pacs/visual-field` | ❌ | 11 | undefined/0 | 0/0 | 2028ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 160 | `/eye/pacs/topography` | ❌ | 11 | undefined/0 | 0/0 | 2060ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 161 | `/eye/pacs/ffa` | ❌ | 11 | undefined/0 | 0/0 | 2117ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 162 | `/eye/pacs/compare` | ❌ | 11 | undefined/0 | 0/0 | 1972ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 163 | `/eye/pacs/montage` | ❌ | 11 | undefined/0 | 0/0 | 1937ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 164 | `/eye/ris` | ❌ | 11 | undefined/0 | 0/0 | 1925ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 165 | `/eye/report-write` | ❌ | 11 | undefined/0 | 0/0 | 1891ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 166 | `/eye/ris/iol-calculator` | ❌ | 11 | undefined/0 | 0/0 | 1871ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 167 | `/eye/ris/va` | ❌ | 11 | undefined/0 | 0/0 | 1882ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 168 | `/eye/ris/iop` | ❌ | 11 | undefined/0 | 0/0 | 1857ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 169 | `/eye/emr` | ❌ | 11 | undefined/0 | 0/0 | 1890ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 170 | `/eye/ai` | ❌ | 11 | undefined/0 | 0/0 | 1844ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 171 | `/eye/kpi-dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1880ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 172 | `/eye/pacs/real-viewer` | ❌ | 11 | undefined/0 | 0/0 | 1861ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 173 | `/eye/pacs/viewer` | ❌ | 11 | undefined/0 | 0/0 | 1866ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 174 | `/eye/ai-report` | ❌ | 11 | undefined/0 | 0/0 | 1835ms | CONSOLE_ERR=3, BODY_LEN=11 |
| 175 | `/eye/toric-planner` | ❌ | 0 | undefined/0 | 0/0 | 20007ms | BODY_LEN=0, STUCK |
| 176 | `/eye/sub/strabismus` | ❌ | 11 | undefined/0 | 0/0 | 2479ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 177 | `/eye/sub/neuro` | ❌ | 11 | undefined/0 | 0/0 | 1935ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 178 | `/eye/sub/oncology` | ❌ | 11 | undefined/0 | 0/0 | 1946ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 179 | `/eye/sub/cornea` | ❌ | 11 | undefined/0 | 0/0 | 1929ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 180 | `/eye/sub/contact-lens` | ❌ | 11 | undefined/0 | 0/0 | 1920ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 181 | `/eye/sub/low-vision` | ❌ | 11 | undefined/0 | 0/0 | 1918ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 182 | `/eye/sub/cataract` | ❌ | 11 | undefined/0 | 0/0 | 1925ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 183 | `/eye/sub/refractive` | ❌ | 11 | undefined/0 | 0/0 | 1945ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 184 | `/eye/tele` | ❌ | 11 | undefined/0 | 0/0 | 1964ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 185 | `/eye/case-library` | ❌ | 11 | undefined/0 | 0/0 | 1920ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 186 | `/eye/optometry-loop` | ❌ | 11 | undefined/0 | 0/0 | 1914ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 187 | `/dental` | ❌ | 11 | undefined/0 | 0/0 | 1921ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 188 | `/dental/studies` | ❌ | 11 | undefined/0 | 0/0 | 1906ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 189 | `/dental/chart` | ❌ | 11 | undefined/0 | 0/0 | 1952ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 190 | `/dental/ai` | ❌ | 11 | undefined/0 | 0/0 | 1942ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 191 | `/dental/treatment` | ❌ | 11 | undefined/0 | 0/0 | 1933ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 192 | `/dental/implant` | ❌ | 11 | undefined/0 | 0/0 | 1910ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 193 | `/dental/ortho` | ❌ | 11 | undefined/0 | 0/0 | 1912ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 194 | `/dental/tele` | ❌ | 11 | undefined/0 | 0/0 | 1896ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 195 | `/dental/inventory` | ❌ | 11 | undefined/0 | 0/0 | 1894ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 196 | `/dental/dashboard` | ❌ | 11 | undefined/0 | 0/0 | 1896ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 197 | `/dental/cad` | ❌ | 11 | undefined/0 | 0/0 | 1904ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 198 | `/dental/implant-3d` | ❌ | 11 | undefined/0 | 0/0 | 1900ms | CONSOLE_ERR=2, BODY_LEN=11 |
| 199 | `/dental/guide` | ❌ | 11 | undefined/0 | 0/0 | 1894ms | CONSOLE_ERR=2, BODY_LEN=11 |
