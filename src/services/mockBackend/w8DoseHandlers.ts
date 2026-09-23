// [G005 W8-Dose] 剂量监测页面真实化 MSW handlers
//
// 覆盖后端 rdsr.controller 本次新增端点 (mock 模式下与后端 seed 一致, 确定性):
//   GET /rdsr/staff                工作人员个人剂量监测 (StaffDoseMonitoring)
//   GET /rdsr/breast               乳腺摄影 AGD 剂量 (BreastDoseTracking)
//   GET /rdsr/device/:id/history   设备近 7 日剂量历史 (DeviceHistoryModal)
//   GET /rdsr/overview             剂量总览 (DoseTrackPage overview)
//
// 注册于 handlers.ts 最前, 避免被既有 /rdsr 参数/通配路由拦截。
import { http, HttpResponse, delay } from 'msw'

const API_BASE = (() => {
  try {
    return window.location.origin + '/api/v1'
  } catch {
    return 'http://localhost/api/v1'
  }
})()

const STAFF_DOSE = [
  { id: 'S001', staffName: '李明', department: '放射科', role: '放射技师', monthlyDose: 0.85, annualDose: 4.2, annualLimit: 20, doseUnit: 'mSv', complianceRate: 79, readings: [{ month: '1月', dose: 0.45 }, { month: '2月', dose: 0.38 }, { month: '3月', dose: 0.52 }, { month: '4月', dose: 0.48 }, { month: '5月', dose: 0.42 }] },
  { id: 'S002', staffName: '王芳', department: '放射科', role: '放射医师', monthlyDose: 0.62, annualDose: 3.1, annualLimit: 20, doseUnit: 'mSv', complianceRate: 84.5, readings: [{ month: '1月', dose: 0.32 }, { month: '2月', dose: 0.28 }, { month: '3月', dose: 0.35 }, { month: '4月', dose: 0.31 }, { month: '5月', dose: 0.28 }] },
  { id: 'S003', staffName: '张伟', department: '介入科', role: '介入医师', monthlyDose: 1.85, annualDose: 9.2, annualLimit: 20, doseUnit: 'mSv', complianceRate: 54, readings: [{ month: '1月', dose: 1.2 }, { month: '2月', dose: 0.95 }, { month: '3月', dose: 1.45 }, { month: '4月', dose: 1.1 }, { month: '5月', dose: 1.05 }] },
  { id: 'S004', staffName: '陈静', department: '放射科', role: '护士', monthlyDose: 0.18, annualDose: 0.9, annualLimit: 20, doseUnit: 'mSv', complianceRate: 95.5, readings: [{ month: '1月', dose: 0.08 }, { month: '2月', dose: 0.06 }, { month: '3月', dose: 0.1 }, { month: '4月', dose: 0.09 }, { month: '5月', dose: 0.07 }] },
  { id: 'S005', staffName: '刘敏', department: '放射科', role: '护师', monthlyDose: 0.42, annualDose: 2.1, annualLimit: 20, doseUnit: 'mSv', complianceRate: 89.5, readings: [{ month: '1月', dose: 0.22 }, { month: '2月', dose: 0.18 }, { month: '3月', dose: 0.25 }, { month: '4月', dose: 0.2 }, { month: '5月', dose: 0.18 }] },
  { id: 'S006', staffName: '赵强', department: '介入科', role: '介入技师', monthlyDose: 0.55, annualDose: 2.8, annualLimit: 20, doseUnit: 'mSv', complianceRate: 86, readings: [{ month: '1月', dose: 0.28 }, { month: '2月', dose: 0.24 }, { month: '3月', dose: 0.3 }, { month: '4月', dose: 0.26 }, { month: '5月', dose: 0.22 }] },
]

const BREAST_DOSE = [
  { id: 'B001', patientId: 'RAD-P007', patientName: '王芳', age: 42, examDate: '2026-05-01', agd: 4.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B002', patientId: 'RAD-P012', patientName: '患者T', age: 38, examDate: '2026-05-01', agd: 5.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'warning', recallStatus: 'none', device: 'MG-1' },
  { id: 'B003', patientId: 'RAD-P016', patientName: '患者A', age: 48, examDate: '2026-04-30', agd: 6.5, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'critical', recallStatus: 'recalled', device: 'MG-1' },
  { id: 'B004', patientId: 'RAD-P020', patientName: '患者B', age: 52, examDate: '2026-04-29', agd: 3.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B005', patientId: 'RAD-P021', patientName: '患者C', age: 45, examDate: '2026-04-29', agd: 4.5, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B006', patientId: 'RAD-P022', patientName: '患者D', age: 55, examDate: '2026-04-28', agd: 5.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B007', patientId: 'RAD-P023', patientName: '刘芳', age: 40, examDate: '2026-04-28', agd: 4.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B008', patientId: 'RAD-P024', patientName: '患者E', age: 50, examDate: '2026-04-27', agd: 6.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'critical', recallStatus: 'completed', device: 'MG-1' },
]

const DEVICE_HISTORY = [
  { date: '04-25', DLP: 820, CTDIvol: 22.5, DAP: 820, examCount: 25 },
  { date: '04-26', DLP: 780, CTDIvol: 21.2, DAP: 780, examCount: 23 },
  { date: '04-27', DLP: 950, CTDIvol: 25.8, DAP: 950, examCount: 28 },
  { date: '04-28', DLP: 690, CTDIvol: 18.5, DAP: 690, examCount: 20 },
  { date: '04-29', DLP: 850, CTDIvol: 23.2, DAP: 850, examCount: 26 },
  { date: '04-30', DLP: 920, CTDIvol: 24.5, DAP: 920, examCount: 27 },
  { date: '05-01', DLP: 850, CTDIvol: 22.5, DAP: 850, examCount: 28 },
]

const DEVICE_DOSE = [
  { device: 'CT-1', todayDLP: 850, todayCTDI: 22.5, todayDAP: 850, alertCount: 2, status: 'normal', examCount: 28, utilizationRate: 85, avgCTDI: 21.2, maxCTDI: 28.5 },
  { device: 'CT-2', todayDLP: 620, todayCTDI: 18.2, todayDAP: 620, alertCount: 0, status: 'normal', examCount: 22, utilizationRate: 72, avgCTDI: 17.5, maxCTDI: 22.3 },
  { device: 'DR-1', todayDLP: 95, todayCTDI: 0.8, todayDAP: 95, alertCount: 0, status: 'normal', examCount: 45, utilizationRate: 90, avgCTDI: 0.75, maxCTDI: 1.2 },
  { device: 'DR-2', todayDLP: 78, todayCTDI: 0.6, todayDAP: 78, alertCount: 0, status: 'normal', examCount: 38, utilizationRate: 78, avgCTDI: 0.62, maxCTDI: 0.95 },
  { device: 'DSA-1', todayDLP: 4200, todayCTDI: 35.8, todayDAP: 4200, alertCount: 3, status: 'warning', examCount: 8, utilizationRate: 45, avgCTDI: 32.5, maxCTDI: 48.2 },
  { device: 'MG-1', todayDLP: 8, todayCTDI: 0.4, todayDAP: 8, alertCount: 0, status: 'normal', examCount: 18, utilizationRate: 65, avgCTDI: 0.38, maxCTDI: 0.52 },
]

const DOSE_HISTORY = [
  { date: '04-25', CT: 1250, MR: 0, DR: 180, DSA: 420, MG: 8 },
  { date: '04-26', CT: 1180, MR: 0, DR: 195, DSA: 380, MG: 6 },
  { date: '04-27', CT: 1320, MR: 0, DR: 210, DSA: 450, MG: 10 },
  { date: '04-28', CT: 1190, MR: 0, DR: 175, DSA: 0, MG: 4 },
  { date: '04-29', CT: 980, MR: 0, DR: 120, DSA: 400, MG: 8 },
  { date: '04-30', CT: 1100, MR: 0, DR: 160, DSA: 390, MG: 12 },
  { date: '05-01', CT: 850, MR: 0, DR: 95, DSA: 200, MG: 4 },
]

const CTDIVOL_TREND = [
  { date: '04-25', CT1: 22.5, CT2: 18.2, threshold: 50 },
  { date: '04-26', CT1: 21.8, CT2: 17.5, threshold: 50 },
  { date: '04-27', CT1: 24.2, CT2: 19.8, threshold: 50 },
  { date: '04-28', CT1: 20.5, CT2: 16.8, threshold: 50 },
  { date: '04-29', CT1: 18.9, CT2: 15.2, threshold: 50 },
  { date: '04-30', CT1: 23.1, CT2: 18.9, threshold: 50 },
  { date: '05-01', CT1: 19.5, CT2: 14.8, threshold: 50 },
]

const DEVICE_DAP = [
  { device: 'CT-1', DAP: 850, threshold: 1000, avgDAP: 720 },
  { device: 'CT-2', DAP: 620, threshold: 1000, avgDAP: 680 },
  { device: 'DR-1', DAP: 95, threshold: 300, avgDAP: 85 },
  { device: 'DR-2', DAP: 78, threshold: 300, avgDAP: 72 },
  { device: 'DSA-1', DAP: 4200, threshold: 3000, avgDAP: 3500 },
  { device: 'MG-1', DAP: 8, threshold: 10, avgDAP: 7.2 },
]

export const w8DoseHandlers = [
  http.get(`${API_BASE}/rdsr/staff`, async () => {
    await delay(60)
    return HttpResponse.json({ success: true, data: STAFF_DOSE })
  }),
  http.get(`${API_BASE}/rdsr/breast`, async () => {
    await delay(60)
    return HttpResponse.json({ success: true, data: BREAST_DOSE })
  }),
  http.get(`${API_BASE}/rdsr/device/:id/history`, async () => {
    await delay(60)
    return HttpResponse.json({ success: true, data: DEVICE_HISTORY })
  }),
  http.get(`${API_BASE}/rdsr/overview`, async () => {
    await delay(60)
    return HttpResponse.json({
      success: true,
      data: {
        deviceDose: DEVICE_DOSE,
        doseHistory: DOSE_HISTORY,
        ctdivolTrend: CTDIVOL_TREND,
        deviceDap: DEVICE_DAP,
      },
    })
  }),
]
