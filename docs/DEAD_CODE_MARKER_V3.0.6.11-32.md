# Dead Code Marker
> Generated: 2026-07-22
> Base: v3.0.6.11-25 → v3.0.6.11-32
> Action: Comment-only marking (no deletion)

## Summary

| Category | Marked | Tag |
|----------|--------|-----|
| Dead Routes (routeTable, no sidebar) | 50 | `// [DEAD]` |
| Unreferenced Pages | 32 | `// [UNREF] 2026-07-14 未被任何文件引用` |
| Unreferenced Components | 191 | `// [UNREF] 2026-07-14 未被任何文件引用` |
| New Dead Routes (since 11-25) | 0 | — |
| New Dead Files (since 11-25) | 0 | — |
| **Total Markers Added** | **273** | |

## 1. Dead Routes Marked with `// [DEAD]`

All 50 routes in `src/routes/routeTable.tsx` that exist in the route table but have no corresponding sidebar entry in `src/routes/sidebarConfig.tsx` have been prefixed with `// [DEAD] `.

| # | Route | Source |
|---|-------|--------|
| 1 | `/ai-fusion-workspace` | L862 |
| 2 | `/ai-orchestration` | L646 |
| 3 | `/audit-compliance` | L846 |
| 4 | `/clinical-calculators` | L866 |
| 5 | `/clinical-pathways` | L845 |
| 6 | `/command-center` | L840 |
| 7 | `/consent-education` | L867 |
| 8 | `/dental/ai-onnx` | L822 |
| 9 | `/dental/annotate` | L820 |
| 10 | `/dental/cbct-report` | L824 |
| 11 | `/dental/endo` | L809 |
| 12 | `/dental/pediatric` | L813 |
| 13 | `/dental/perio` | L810 |
| 14 | `/dental/rad-fusion` | L825 |
| 15 | `/dental/referral` | L823 |
| 16 | `/dental/restorative` | L811 |
| 17 | `/dental/surgery` | L812 |
| 18 | `/dental/viewer` | L818 |
| 19 | `/dental/viewer/mpr` | L821 |
| 20 | `/dental/viewer/scan-3d` | L819 |
| 21 | `/dicom-share` | L841 |
| 22 | `/dicom-sr-manager` | L847 |
| 23 | `/dicom-viewer-classic` | L634 |
| 24 | `/director-dashboard` | L708 |
| 25 | `/emr-templates` | L836 |
| 26 | `/ihe-integration` | L852 |
| 27 | `/ihe/visit-detail/:patientId/:visitNumber` | L858 |
| 28 | `/integration/mllp-config` | L779 |
| 29 | `/integration/mllp-monitor` | L776 |
| 30 | `/mammo/operations` | L762 |
| 31 | `/mammo/quality` | L763 |
| 32 | `/notif-tpl-dict` | L886 |
| 33 | `/patient-device-mgmt` | L885 |
| 34 | `/patient-safety` | L868 |
| 35 | `/patient-unified` | L839 |
| 36 | `/patient/:id` | L619 |
| 37 | `/radpath/detail/:reportId` | L915 |
| 38 | `/regional-imaging` | L700 |
| 39 | `/report-templates` | L851 |
| 40 | `/report-workflow` | L884 |
| 41 | `/research` | L710 |
| 42 | `/review-check` | L887 |
| 43 | `/scheduling-center` | L843 |
| 44 | `/sign-amend` | L888 |
| 45 | `/system-admin` | L837 |
| 46 | `/template-designer/:id` | L664 |
| 47 | `/terminology-server` | L850 |
| 48 | `/treatment-plans` | L838 |
| 49 | `/v3-report-hub` | L889 |
| 50 | `/workbench` | L616 |

## 2. Unreferenced Pages Marked with `// [UNREF]`

All 32 page files tagged.

## 3. Unreferenced Components Marked with `// [UNREF]`

All 191 component files tagged.

## 4. New Dead Code Since v3.0.6.11-25

No new dead routes or files identified between v3.0.6.11-25 and v3.0.6.11-30.

## 5. P0 Security Scan Results

Scanned all 223 dead files for hardcoded credentials, API keys, internal IPs, and PHI patterns.

| Severity | Count | Details |
|----------|-------|---------|
| P0 (Critical) | 0 | No hardcoded credentials/secrets found |
| P1 (High) | 0 | No exposed internal infrastructure |
| P2 (Medium) | 0 | No test data resembling PHI |

**Conclusion**: Dead files contain only React UI code; no sensitive data leakage risk identified.

---

*Marker file: version v3.0.6.11-32*
