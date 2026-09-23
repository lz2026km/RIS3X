// [G005 W8-Dose] 剂量监测页面真实化新增文案
// 由 appI18n.ts 通过 import.meta.glob 自动合并。
export default {
  zh: {
    'w8Dose.demoBadge': '演示数据',
    'w8Dose.sourceApi': '数据来源：接口',
    'w8Dose.sourceDemo': '数据来源：演示数据',
    'w8Dose.staffDemo': '演示数据：rdsrApi /rdsr/staff 不可用或返回空，工作人员剂量为本地模拟',
    'w8Dose.controlDemo': '演示数据：控制图基于 /rdsr/stats 趋势派生；端点不可用时回退本地模拟',
    'w8Dose.breastDemo': '演示数据：rdsrApi /rdsr/breast 不可用或返回空，AGD 记录为本地模拟',
    'w8Dose.pediatricProtocolDemo': '演示数据：由 /rdsr/pediatric 记录派生；端点不可用时回退本地模拟',
    'w8Dose.deviceHistoryDemo': '演示数据（模拟 7 日历史）',
    'w8Dose.doseTrackDemo': '演示数据：/rdsr/overview 不可用或返回空，趋势为本地模拟',
    'w8Dose.mprDemo': '演示数据：dentalApi MPR 端点不可用，重建参数为本地模拟',
    'w8Dose.benchmarkDemo': '演示数据：benchmarkApi 不可用或返回空，图表为本地模拟',
    'w8Dose.dicomLocalParse': '接口不可用，已回退本地 DICOM 解析（仅读取文件内 CTDIvol/DLP 字段）',
  },
  en: {
    'w8Dose.demoBadge': 'Demo data',
    'w8Dose.sourceApi': 'Source: API',
    'w8Dose.sourceDemo': 'Source: demo data',
    'w8Dose.staffDemo': 'Demo data: rdsrApi /rdsr/staff unavailable or empty; staff dose is locally simulated',
    'w8Dose.controlDemo': 'Demo data: control chart derived from /rdsr/stats trend; falls back to local simulation',
    'w8Dose.breastDemo': 'Demo data: rdsrApi /rdsr/breast unavailable or empty; AGD records are locally simulated',
    'w8Dose.pediatricProtocolDemo': 'Demo data: derived from /rdsr/pediatric; falls back to local simulation',
    'w8Dose.deviceHistoryDemo': 'Demo data (simulated 7-day history)',
    'w8Dose.doseTrackDemo': 'Demo data: /rdsr/overview unavailable or empty; trends are locally simulated',
    'w8Dose.mprDemo': 'Demo data: dentalApi MPR endpoint unavailable; reconstruction parameters are locally simulated',
    'w8Dose.benchmarkDemo': 'Demo data: benchmarkApi unavailable or empty; charts are locally simulated',
    'w8Dose.dicomLocalParse': 'API unavailable; fell back to local DICOM parsing (reads CTDIvol/DLP from the file)',
  },
}
