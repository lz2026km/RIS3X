# Module 6.9: Structured Reports (15 points)

| # | Sub-module | Points | File | Status |
|---|-----------|--------|------|--------|
| 6.9 | Structured Reports | 15 | `src/templates/mammo/structuredReports.ts` | 完成 |

### 6.9 Structured Reports (15 pts)
- 3 BI-RADS report templates (Screening Mammography, Breast Ultrasound, Breast MRI)
- `MammoReportTemplate` - Sectioned template model (sections, fields, validation rules)
- `MammoReportField` - Field types: text, select, number, boolean, radio, multiselect, textarea
- BI-RADS categories table with risk percentages
- ACR breast density categories table
- `renderReportSection()` - Renders section with data interpolation
- `generateStructuredReport()` - Produces formatted markdown report from template + data
- `validateReportCompleteness()` - Checks required fields
