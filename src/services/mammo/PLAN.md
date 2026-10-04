# Module 6: Mammography & Women's Imaging (210 points)

## Sub-modules

| # | Sub-module | Points | File | Status |
|---|-----------|--------|------|--------|
| 6.1 | Mammography Workflow | 35 | `src/services/mammo/mammoWorkflow.ts` | 完成 |
| 6.2 | Breast Ultrasound | 25 | `src/services/mammo/breastUltrasound.ts` | 完成 |
| 6.3 | Breast MRI | 25 | `src/services/mammo/breastMri.ts` | 完成 |
| 6.4 | Breast Cancer Screening | 30 | `src/services/mammo/breastCancerScreening.ts` | 完成 |
| 6.5 | Breast Biopsy & Pathology | 20 | `src/services/mammo/breastBiopsy.ts` | 完成 |
| 6.6 | Post-Op Follow-up | 20 | `src/services/mammo/postOpFollowUp.ts` | 完成 |

## Implementation Details

### 6.1 Mammography Workflow (35 pts)
- `MammogramExam` - Full exam model (laterality, breast density, indications, menopausal status, implants)
- `MammoAcquisition` - Per-view acquisition (view position, dose, compression metrics, quality score)
- `MammoWorkflowConfig` - Configurable defaults (views, tomo, AEC, compression limit, dose target)
- Functions: `createMammogramExam`, `recordMammoAcquisition`, `calculateAcquisitionQuality`, `advanceMammoWorkflow`, `classifyBreastDensity`

### 6.2 Breast Ultrasound (25 pts)
- `BUSLesion` - Full BI-RADS lesion descriptors (shape, orientation, margin, echo, posterior features, calcifications, vascularity, elasticity)
- `BUSExam` - Exam with lesions, BI-RADS, axilla assessment
- `BUSFindingSummary` - Aggregated finding summary
- Functions: `createBUSLesion`, `calculateBiRadsFromLesions`, `summarizeBUSFindings`, `calculateElasticityScore`

### 6.3 Breast MRI (25 pts)
- `MRILesion` - Mass/NME/focus lesion descriptors (kinetics, ADC, T2 signal, enhancement patterns)
- `BreastMRIExam` - Full MRI exam (sequences, BPE, contrast, lesions)
- `MRIPerfusionMetrics` - Kinetic curve analysis (peak enhancement, TTP, washout rate, AUC)
- Functions: `createBreastMRIExam`, `classifyKineticCurve`, `calculateAdcValue`, `assessBackgroundParenchymalEnhancement`, `calculatePerfusionMetrics`

### 6.4 Breast Cancer Screening (30 pts)
- `ScreeningPatient` - Risk profile (BRCA, family history, Gail/Tyrer-Cuzick risk)
- `ScreeningSchedule` - Modality/interval recommendation per risk level
- `ScreeningSession` - Screening outcome with BI-RADS
- `ScreeningDashboard` - ACR metrics (recall rate, CDR, PPV, interval cancer rate)
- Functions: `assessRiskLevel`, `generateScreeningSchedule`, `calculateScreeningMetrics`, `comparePriorScreens`, `estimateGailRisk`

### 6.5 Breast Biopsy & Pathology (20 pts)
- `BiopsyProcedure` - Procedure details (modality, technique, needle gauge, clips, specimen radiograph)
- `PathologyResult` - Full pathology (histological type, grade, ER/PR/HER2/Ki67, molecular subtype, margins, nodes)
- `BiopsyReport` - Combined procedure + pathology report
- Functions: `createBiopsyProcedure`, `determineMolecularSubtype`, `calculateNottinghamGrade`, `assessMarginStatus`, `generateBiopsyReport`

### 6.6 Post-Op Follow-up (20 pts)
- `PostOpRecord` - Surgery details (type, tumor size, nodes, margins, reconstruction)
- `FollowUpVisit` - Per-visit record (modality, findings, BI-RADS, recommendation)
- `FollowUpTimeline` - Aggregated timeline with recurrence tracking
- Functions: `createPostOpRecord`, `scheduleFollowUpVisit`, `getRecommendedSchedule`, `assessPostOpVisit`, `buildFollowUpTimeline`, `calculateSurvivalMetrics`
