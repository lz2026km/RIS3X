# Module 15: Incident Reporting & Patient Safety (140 points)

## Sub-module Overview

| # | Sub-module | Points | Pages | Services | Status |
|---|-----------|--------|-------|----------|--------|
| 15.1 | Adverse Event Reporting | 30 | `AdverseEventPage.tsx` | `adverseEventService.ts` | 完成 |
| 15.2 | Radiation Safety & Protection | 30 | `RadiationSafetyPage.tsx` | `radiationSafetyService.ts` | 完成 |
| 15.3 | Patient Safety Goals | 25 | `PatientSafetyGoalsPage.tsx` | — | 完成 |
| 15.4 | RCA Analysis | 20 | `RCAAnalysisPage.tsx` | `rcaService.ts` | 完成 |
| 15.5 | Risk Management | 20 | `RiskManagementPage.tsx` | `riskManagementService.ts` | 完成 |
| 15.6 | CQI | 15 | `CQIPage.tsx` | `cqiService.ts` | 完成 |

## Implementation Details

### 15.1 Adverse Event Reporting (30 pts)
- Report adverse events form (type, severity, description, patient involvement, contributing factors)
- Event severity classification (near miss, minor, moderate, severe, catastrophic)
- Trend analysis dashboard with charts (events by type, severity, time trends)
- Event management workflow (reported → investigating → resolved → closed)
- Root cause linking for adverse events

### 15.2 Radiation Safety & Protection (30 pts)
- Radiation dose monitoring dashboard (CTDI, DLP, KAP by modality/procedure)
- Dose alert threshold configuration and management
- Patient-specific dose tracking and cumulative dose estimation
- ALARA principle compliance monitoring
- Protocol optimization recommendations based on dose trends

### 15.3 Patient Safety Goals (25 pts)
- Patient safety goal setting and tracking (falls, contrast reactions, ID errors, etc.)
- Goal progress visualization with trend charts
- Compliance rate by department/modality
- Goal achievement scorecards
- Safety goal target management

### 15.4 RCA Analysis (20 pts)
- Root Cause Analysis (RCA) investigation workflow
- Fishbone (Ishikawa) diagram data management
- 5 Whys analysis tracking
- CAPA (Corrective and Preventive Action) plan management
- RCA effectiveness tracking and closure verification

### 15.5 Risk Management (20 pts)
- Risk register with probability × impact matrix
- FMEA (Failure Mode and Effects Analysis) support
- Risk scoring and prioritization (RPN calculation)
- Risk mitigation plan tracking
- Risk trend dashboard

### 15.6 CQI (15 pts)
- CQI project lifecycle management
- PDSA (Plan-Do-Study-Act) cycle tracking
- CQI indicator dashboard with targets
- Improvement project portfolio view
- Outcome measurement and sustainability tracking

## Barrel Export — `index.ts`
Named exports: `AdverseEventPage`, `RadiationSafetyPage`, `PatientSafetyGoalsPage`, `RCAAnalysisPage`, `RiskManagementPage`, `CQIPage`
