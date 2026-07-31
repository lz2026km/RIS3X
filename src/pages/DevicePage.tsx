// NOTE: 未解决 - 此文件超过 2000 行（2827行），需要拆分为子组件
// v3.0.4 重构目标：
// 1. 提取页面头部 (title + breadcrumb + actions)
// 2. 提取搜索/筛选栏为独立组件
// 3. 提取列表/表格为独立组件
// 4. 提取对话框/编辑面板为独立组件
// G005 放射科RIS系统 - 设备管理页面 v3.0.4-refactored
import { useState, useEffect } from 'react'
import {
  Monitor, Wrench, AlertCircle, CheckCircle, Clock, Activity,
  Settings, TrendingUp, BarChart2, Calendar, AlertTriangle, Timer,
  Plus, X, Bell, Shield, Pause, Play, Download,
  Settings2, DollarSign, Power, Gauge, PieChart as PieChartIcon,
  FileText, CalendarDays
} from 'lucide-react'
import {
  BarChart as ChartBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts'
import { initialModalityDevices, initialExamRooms } from '../data/initialData'
import { simulateApiCall } from '../data/simulationStore'
import { deviceApi, deviceMgmtApi } from '../services/api'
import { replayDeviceEvent, validateDeviceStatus } from '../utils/deviceStateAdapter'
import type { DeviceModality, DeviceState } from '../components/v3/admin/DeviceManagement'
import {
  C, ModalityBadge, PIE_COLORS,
  DeviceFilter, DeviceList,
  DeviceDetailPanel, MaintenanceHistoryTable, MaintenancePlanTable,
} from './device'
import type { DeviceData } from './device'


// ==================== 按钮反馈Hook ====================
const useButtonFeedback = () => {
  const [feedback, setFeedback] = useState<{ visible: boolean; type: 'loading' | 'success' | 'error'; message: string } | null>(null)

  const showFeedback = (type: 'loading' | 'success' | 'error', message: string) => {
    setFeedback({ visible: true, type, message })
    if (type !== 'loading') {
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const withFeedback = async (operation: () => void, successMsg = '✓ 成功') => {
    showFeedback('loading', '处理中...')
    try {
      await simulateApiCall(null, { delay: 1500 })
      operation()
      showFeedback('success', successMsg)
    } catch {
      showFeedback('error', '✗ 失败')
    }
  }

  return { feedback, withFeedback, showFeedback }
}

// AE Title 配置数据 - status 通过 deviceMachine 校验,只接受 machine 可达的状态
const AE_TITLE_CONFIGS = [
  { id: 'AE001', deviceName: 'CT-1（GE Revolution CT）', aeTitle: 'CT_SCANNER_01', ip: '192.168.1.101', port: 104, modality: 'CT', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 08:30:00' },
  { id: 'AE002', deviceName: 'MR-1（西门子MAGNETOM Vida）', aeTitle: 'MR_SCANNER_01', ip: '192.168.1.102', port: 104, modality: 'MR', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 08:25:00' },
  { id: 'AE003', deviceName: 'DR-1（飞利浦DigitalDiagnost）', aeTitle: 'DR_SCANNER_01', ip: '192.168.1.103', port: 105, modality: 'DR', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 08:20:00' },
  { id: 'AE004', deviceName: 'DSA-1（飞利浦Azurion 7）', aeTitle: 'DSA_SCANNER_01', ip: '192.168.1.104', port: 104, modality: 'DSA', status: replayDeviceEvent('idle', { type: 'GO_OFFLINE', reason: 'ae-title-unreachable', by: 'system' }), lastCecho: '2026-05-01 16:30:00' },
  { id: 'AE005', deviceName: 'CT-2（西门子SOMATOM Force）', aeTitle: 'CT_SCANNER_02', ip: '192.168.1.105', port: 106, modality: 'CT', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 07:45:00' },
  { id: 'AE006', deviceName: 'MR-2（飞利浦Ingenia）', aeTitle: 'MR_SCANNER_02', ip: '192.168.1.106', port: 104, modality: 'MR', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 08:10:00' },
  { id: 'AE007', deviceName: 'DR-2（GE Optima）', aeTitle: 'DR_SCANNER_02', ip: '192.168.1.107', port: 105, modality: 'DR', status: validateDeviceStatus('online') ? 'online' : 'idle', lastCecho: '2026-05-02 06:50:00' },
  { id: 'AE008', deviceName: '乳腺钼靶（GE Senographe）', aeTitle: 'MG_SCANNER_01', ip: '192.168.1.108', port: 104, modality: 'MG', status: replayDeviceEvent('idle', { type: 'GO_OFFLINE', reason: 'scheduled-maintenance', by: 'system' }), lastCecho: '2026-04-30 10:15:00' },
]

// QA/QC 测试计划数据
const QA_TEST_PLANS = [
  { id: 'QA001', deviceName: 'CT-1', testType: 'CT值准确性', frequency: '每日', lastResult: 'pass', lastDate: '2026-05-02', nextDate: '2026-05-03', trend: [95, 96, 94, 97, 98, 96, 97], compliance: 96 },
  { id: 'QA002', deviceName: 'CT-1', testType: '层厚精度', frequency: '每周', lastResult: 'pass', lastDate: '2026-04-28', nextDate: '2026-05-05', trend: [92, 93, 95, 94, 96, 95, 97], compliance: 94 },
  { id: 'QA003', deviceName: 'CT-1', testType: '空间分辨率', frequency: '每月', lastResult: 'pass', lastDate: '2026-04-15', nextDate: '2026-05-15', trend: [88, 90, 89, 91, 93, 92, 94], compliance: 91 },
  { id: 'QA004', deviceName: 'MR-1', testType: 'SNR信噪比', frequency: '每日', lastResult: 'pass', lastDate: '2026-05-02', nextDate: '2026-05-03', trend: [90, 91, 89, 92, 93, 91, 94], compliance: 92 },
  { id: 'QA005', deviceName: 'MR-1', testType: '均匀性', frequency: '每周', lastResult: 'fail', lastDate: '2026-04-30', nextDate: '2026-05-03', trend: [85, 86, 84, 82, 80, 78, 75], compliance: 78 },
  { id: 'QA006', deviceName: 'DR-1', testType: '剂量线性', frequency: '每日', lastResult: 'pass', lastDate: '2026-05-02', nextDate: '2026-05-03', trend: [97, 98, 96, 97, 99, 98, 97], compliance: 98 },
  { id: 'QA007', deviceName: 'DR-1', testType: '对比度分辨率', frequency: '每月', lastResult: 'pass', lastDate: '2026-04-20', nextDate: '2026-05-20', trend: [90, 91, 92, 90, 93, 91, 94], compliance: 93 },
  { id: 'QA008', deviceName: 'DSA-1', testType: '图像均匀性', frequency: '每日', lastResult: 'pass', lastDate: '2026-04-29', nextDate: '2026-05-03', trend: [88, 86, 87, 85, 86, 84, 83], compliance: 85 },
]

// 故障代码分类数据
const FAULT_CODES = [
  { code: 'F001', category: 'X线系统', description: '球管灯丝断路', severity: 'critical', mtbf: 180, count: 3, devices: ['CT-1', 'CT-2'] },
  { code: 'F002', category: 'X线系统', description: '高压发生器故障', severity: 'critical', mtbf: 240, count: 2, devices: ['DR-1', 'DR-2'] },
  { code: 'F003', category: '探测器', description: '平板探测器无响应', severity: 'major', mtbf: 150, count: 4, devices: ['DR-1'] },
  { code: 'F004', category: '探测器', description: '闪烁体老化', severity: 'major', mtbf: 200, count: 2, devices: ['CT-1', 'CT-2'] },
  { code: 'F005', category: '机械系统', description: 'C型臂驱动电机故障', severity: 'critical', mtbf: 300, count: 1, devices: ['DSA-1'] },
  { code: 'F006', category: '机械系统', description: '检查床升降异常', severity: 'minor', mtbf: 400, count: 2, devices: ['MR-1', 'CT-2'] },
  { code: 'F007', category: '冷却系统', description: '冷水机组报警', severity: 'major', mtbf: 350, count: 2, devices: ['MR-1', 'MR-2'] },
  { code: 'F008', category: '冷却系统', description: '液氦压力异常', severity: 'critical', mtbf: 500, count: 1, devices: ['MR-2'] },
  { code: 'F009', category: '电气系统', description: '电源模块故障', severity: 'major', mtbf: 280, count: 3, devices: ['CT-1', 'MR-1', 'DSA-1'] },
  { code: 'F010', category: '网络系统', description: 'DICOM通信超时', severity: 'minor', mtbf: 600, count: 5, devices: ['DR-1', 'DR-2', 'CT-2'] },
]

const FAULT_TREND_DATA = [
  { month: '1月', critical: 2, major: 3, minor: 4 },
  { month: '2月', critical: 1, major: 2, minor: 3 },
  { month: '3月', critical: 3, major: 4, minor: 2 },
  { month: '4月', critical: 2, major: 3, minor: 5 },
  { month: '5月', critical: 1, major: 2, minor: 3 },
  { month: '6月', critical: 2, major: 1, minor: 2 },
]

// ROI 计算数据
const ROI_DEVICE_DATA = [
  { deviceName: 'CT-1', purchaseCost: 8000000, annualRevenue: 35000000, annualMaintCost: 480000, annualOtherCost: 1200000, usefulLife: 8, depreciationMethod: 'straight', installDate: '2021-03-15' },
  { deviceName: 'MR-1', purchaseCost: 12000000, annualRevenue: 22000000, annualMaintCost: 360000, annualOtherCost: 1800000, usefulLife: 8, depreciationMethod: 'straight', installDate: '2020-06-01' },
  { deviceName: 'DR-1', purchaseCost: 2500000, annualRevenue: 15000000, annualMaintCost: 180000, annualOtherCost: 600000, usefulLife: 10, depreciationMethod: 'accelerated', installDate: '2021-01-10' },
  { deviceName: 'DSA-1', purchaseCost: 15000000, annualRevenue: 42000000, annualMaintCost: 600000, annualOtherCost: 2500000, usefulLife: 8, depreciationMethod: 'straight', installDate: '2022-09-01' },
  { deviceName: 'CT-2', purchaseCost: 9000000, annualRevenue: 28000000, annualMaintCost: 960000, annualOtherCost: 1000000, usefulLife: 10, depreciationMethod: 'accelerated', installDate: '2023-01-15' },
]

// ============================================================
// 模拟扩展数据
// ============================================================
const generateDeviceStats = () => {
  const deviceUsageMap: Record<string, number[]> = {}
  const dates = ['04-25', '04-26', '04-27', '04-28', '04-29', '04-30', '05-01']
  const devices = initialModalityDevices

  devices.forEach(d => {
    const base = d.modality === 'CT' ? 120 : d.modality === 'MR' ? 60 : d.modality === 'DR' ? 200 : 15
    deviceUsageMap[d.id] = dates.map((_, i) => Math.max(0, base + Math.floor((Math.random() - 0.3) * 30) - i * 2))
  })
  return { dates, deviceUsageMap }
}

const deviceStatsData = generateDeviceStats()

const MAINTENANCE_RECORDS = [
  { id: 'M001', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', date: '2026-04-15', type: '定期保养', engineer: '张工', cost: 2800, content: '更换球管滤线栅，清洁滑环，校正成像参数', result: '合格', nextDate: '2026-07-15' },
  { id: 'M002', deviceId: 'DEV-MR-02', deviceName: 'MR-2（飞利浦Ingenia）', date: '2026-04-20', type: '故障维修', engineer: '李工', cost: 15000, content: '更换梯度放大器模块，补充液氦', result: '合格', nextDate: '2026-10-20' },
  { id: 'M003', deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', date: '2026-03-28', type: '定期保养', engineer: '王工', cost: 1500, content: '探测器校准，X线管训练', result: '合格', nextDate: '2026-06-28' },
  { id: 'M004', deviceId: 'DEV-CT-02', deviceName: 'CT-2（西门子SOMATOM Force）', date: '2026-04-10', type: '定期保养', engineer: '张工', cost: 3200, content: '更换X线管，探测器校准，系统综合测试', result: '合格', nextDate: '2026-07-10' },
  { id: 'M005', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', date: '2026-03-15', type: '定期保养', engineer: '李工', cost: 2000, content: '磁体冷头维护，梯度线圈检测', result: '合格', nextDate: '2026-06-15' },
  { id: 'M006', deviceId: 'DEV-DSA-01', deviceName: 'DSA-1（飞利浦Azurion 7）', date: '2026-04-05', type: '故障维修', engineer: '赵工', cost: 22000, content: '更换C型臂驱动马达，校正机械精度', result: '合格', nextDate: '2026-10-05' },
  { id: 'M007', deviceId: 'DEV-DR-02', deviceName: 'DR-2（GE Optima）', date: '2026-02-20', type: '定期保养', engineer: '王工', cost: 1800, content: '平板探测器检测，X线系统综合校准', result: '合格', nextDate: '2026-05-20' },
  { id: 'M008', deviceId: 'DEV-MG-01', deviceName: '乳腺钼靶（GE Senographe）', date: '2026-03-10', type: '定期保养', engineer: '陈工', cost: 1200, content: '压迫器校准，乳腺工作站图像质量检测', result: '合格', nextDate: '2026-06-10' },
]

const MAINTENANCE_PLANS = [
  { id: 'MP001', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', planDate: '2026-07-15', type: '定期保养', content: '球管衰减检测，系统综合保养', estimatedCost: 3000, assignee: '张工' },
  { id: 'MP002', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', planDate: '2026-06-15', type: '定期保养', content: '液氦补充，滑环清洁，梯度测试', estimatedCost: 2500, assignee: '李工' },
  { id: 'MP003', deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', planDate: '2026-06-28', type: '定期保养', content: '探测器校准，X线管训练', estimatedCost: 1800, assignee: '王工' },
  { id: 'MP004', deviceId: 'DEV-DR-02', deviceName: 'DR-2（GE Optima）', planDate: '2026-05-20', type: '定期保养', content: '系统全面检查，易损件更换', estimatedCost: 2000, assignee: '王工' },
  { id: 'MP005', deviceId: 'DEV-MG-01', deviceName: '乳腺钼靶（GE Senographe）', planDate: '2026-06-10', type: '定期保养', content: '压迫器校准，图像质量检测', estimatedCost: 1500, assignee: '陈工' },
  { id: 'MP006', deviceId: 'DEV-RF-01', deviceName: '胃肠造影（岛津Flexavision）', planDate: '2026-05-25', type: '定期保养', content: 'X线系统校准，影像增强器维护', estimatedCost: 2200, assignee: '张工' },
  { id: 'MP007', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', planDate: '2026-10-15', type: '年度保养', content: '全面系统检测，球管衰减评估', estimatedCost: 8000, assignee: '张工' },
  { id: 'MP008', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', planDate: '2026-09-15', type: '半年保养', content: '磁体冷头维护，氦压机检查', estimatedCost: 4500, assignee: '李工' },
]

// 维保费用年度统计
const MAINTENANCE_COST_DATA = [
  { month: '1月', ct: 12000, mr: 8000, dr: 4500, dsa: 22000, other: 3000, total: 49500 },
  { month: '2月', ct: 8000, mr: 15000, dr: 3000, dsa: 5000, other: 2500, total: 33500 },
  { month: '3月', ct: 15000, mr: 6000, dr: 1800, dsa: 8000, other: 4000, total: 34800 },
  { month: '4月', ct: 22000, mr: 2000, dr: 1500, dsa: 35000, other: 2800, total: 63300 },
  { month: '5月', ct: 10000, mr: 9000, dr: 2200, dsa: 6000, other: 3200, total: 30400 },
  { month: '6月', ct: 6000, mr: 7000, dr: 1800, dsa: 4000, other: 2500, total: 21300 },
]

// 效益分析模拟数据
const REVENUE_DATA = [
  { month: '1月', ct: 2800000, mr: 1800000, dr: 1200000, dsa: 3500000, mg: 450000, rf: 380000, total: 10110000 },
  { month: '2月', ct: 2400000, mr: 1600000, dr: 1100000, dsa: 3200000, mg: 420000, rf: 350000, total: 9070000 },
  { month: '3月', ct: 3000000, mr: 2000000, dr: 1300000, dsa: 3800000, mg: 480000, rf: 420000, total: 11000000 },
  { month: '4月', ct: 3200000, mr: 2200000, dr: 1400000, dsa: 4000000, mg: 500000, rf: 440000, total: 11740000 },
  { month: '5月', ct: 2900000, mr: 1900000, dr: 1250000, dsa: 3600000, mg: 460000, rf: 400000, total: 10510000 },
  { month: '6月', ct: 3100000, mr: 2100000, dr: 1350000, dsa: 3900000, mg: 490000, rf: 430000, total: 11370000 },
]

// 故障停机损失数据
const DOWNTIME_DATA = [
  { deviceName: 'CT-1', faultCount: 2, downtimeHours: 16, lossAmount: 48000, mtbf: 180, description: '球管故障' },
  { deviceName: 'MR-1', faultCount: 1, downtimeHours: 48, lossAmount: 72000, mtbf: 220, description: '梯度放大器故障' },
  { deviceName: 'DR-1', faultCount: 3, downtimeHours: 8, lossAmount: 12000, mtbf: 150, description: '平板探测器故障' },
  { deviceName: 'DSA-1', faultCount: 1, downtimeHours: 72, lossAmount: 144000, mtbf: 200, description: 'C型臂驱动故障' },
  { deviceName: 'CT-2', faultCount: 0, downtimeHours: 0, lossAmount: 0, mtbf: 280, description: '无故障' },
]

// 今日检查量排名
const TODAY_RANKING = [
  { rank: 1, deviceName: 'DR-2（GE Optima）', modality: 'DR', examCount: 186, waitingCount: 12, avgWaitTime: 8 },
  { rank: 2, deviceName: 'CT-1（GE Revolution）', modality: 'CT', examCount: 142, waitingCount: 8, avgWaitTime: 15 },
  { rank: 3, deviceName: 'DR-1（飞利浦）', modality: 'DR', examCount: 138, waitingCount: 6, avgWaitTime: 6 },
  { rank: 4, deviceName: 'MR-1（西门子）', modality: 'MR', examCount: 58, waitingCount: 5, avgWaitTime: 22 },
  { rank: 5, deviceName: 'CT-2（西门子Force）', modality: 'CT', examCount: 52, waitingCount: 3, avgWaitTime: 18 },
  { rank: 6, deviceName: 'MG', modality: 'MG', examCount: 28, waitingCount: 2, avgWaitTime: 10 },
  { rank: 7, deviceName: 'GI', modality: 'GI', examCount: 15, waitingCount: 1, avgWaitTime: 25 },
  { rank: 8, deviceName: 'DSA-1（飞利浦）', modality: 'DSA', examCount: 8, waitingCount: 0, avgWaitTime: 0 },
]

// 开机率统计数据
const UPTIME_STATS = [
  { deviceName: 'CT-1', uptimeRate: 96.5, runtimeHours: 216, downtimeHours: 8, reason: '保养' },
  { deviceName: 'MR-1', uptimeRate: 94.2, runtimeHours: 212, downtimeHours: 12, reason: '故障' },
  { deviceName: 'DR-1', uptimeRate: 98.1, runtimeHours: 220, downtimeHours: 4, reason: '保养' },
  { deviceName: 'DR-2', uptimeRate: 99.2, runtimeHours: 224, downtimeHours: 0, reason: '-' },
  { deviceName: 'CT-2', uptimeRate: 97.8, runtimeHours: 221, downtimeHours: 3, reason: '校准' },
  { deviceName: 'MR-2', uptimeRate: 95.5, runtimeHours: 216, downtimeHours: 8, reason: '保养' },
  { deviceName: 'DSA-1', uptimeRate: 92.0, runtimeHours: 208, downtimeHours: 16, reason: '故障' },
  { deviceName: 'MG', uptimeRate: 98.8, runtimeHours: 223, downtimeHours: 1, reason: '校准' },
]

// 设备详细扩展信息（含序列号、购买日期、保修截止等）
const DEVICE_EXTENDED_INFO = initialModalityDevices.map(d => {
  const purchaseYear = (d as Record<string, unknown>).acquisitionYear as number || 2020
  const warrantyYears = [3, 5, 5, 3, 3, 5, 5, 3][Math.floor(Math.random() * 8)] || 3
  const serialPrefix = { CT: 'CT', MR: 'MR', DR: 'DR', DSA: 'DS', MG: 'MG', RF: 'RF' }[d.modality] || 'DV'
  return {
    ...d,
    serialNumber: `${serialPrefix}-${purchaseYear}-${String(Math.floor(Math.random() * 9000 + 1000))}`,
    purchaseDate: `${purchaseYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    warrantyExpiry: `${purchaseYear + warrantyYears}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    purchasePrice: Math.floor(Math.random() * 8000000 + 2000000),
    installationDate: `${purchaseYear + 1}-01-15`,
    installationLocation: `${d.location || '放射科'}`,
    assetCode: `ZYCZ-${purchaseYear}-${String(Math.floor(Math.random() * 900 + 100))}`,
    contactEngineer: ['张工', '李工', '王工', '赵工', '陈工'][Math.floor(Math.random() * 5)],
    contactTel: `138-${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}`,
  }
})

// ============================================================
// 模拟扩展数据

export interface DeviceEfficiencyData {
  id: string; name: string; modality: string; manufacturer: string; model: string;
  location: string; status: string; seriesCount: number; acquisitionStation: string;
  acquisitionYear?: number; todayBookings: number; capacity: number;
  utilization: number; uptime: number; mtbf: number; age: number;
  healthScore: number; avgExamTime: number; maxExamTime: number; minExamTime: number;
  totalRuntime: string; faultCount: number; maintCount: number;
  [key: string]: unknown;
}

const DEVICE_EFFICIENCY: DeviceEfficiencyData[] = initialModalityDevices.map((_d, _i) => {
  const d = _d as Record<string, unknown>
  const room = initialExamRooms.find(r => r.deviceId === d.id as string)
  const todayBookings = (room?.todaysBookings as number) || 0
  const capacity = d.modality === 'CT' ? 150 : d.modality === 'MR' ? 80 : d.modality === 'DR' ? 250 : 20
  const utilization = Math.round((todayBookings / capacity) * 100)
  const uptime = 95 + Math.floor(Math.random() * 5)
  const mtbf = 180 + Math.floor(Math.random() * 120)
  const age = 2026 - ((d.acquisitionYear as number) || 2020)
  return {
    ...d,
    todayBookings, capacity, utilization, uptime, mtbf, age,
    healthScore: Math.min(100, Math.max(60, 100 - age * 3 - (100 - uptime))),
    avgExamTime: d.modality === 'CT' ? 18 : d.modality === 'MR' ? 35 : d.modality === 'DR' ? 6 : 45,
    maxExamTime: d.modality === 'CT' ? 35 : d.modality === 'MR' ? 70 : d.modality === 'DR' ? 12 : 90,
    minExamTime: d.modality === 'CT' ? 8 : d.modality === 'MR' ? 15 : d.modality === 'DR' ? 3 : 20,
    totalRuntime: (age * 365 * 8).toLocaleString() + ' 小时',
    faultCount: Math.floor(Math.random() * 4),
    maintCount: Math.floor(Math.random() * 6) + 1,
  } as DeviceEfficiencyData
})

// 7天检查量趋势数据
const WEEKLY_TREND_DATA = deviceStatsData.dates.map((date, i) => {
  const entry: Record<string, string | number> = { date }
  initialModalityDevices.forEach(d => {
    const val = deviceStatsData.deviceUsageMap[d.id]?.[i]
    if (val !== undefined) entry[d.id] = val
  })
  return entry
})

// 使用时段热力图数据
const HEATMAP_DATA = Array.from({ length: 7 }, (_, dayIdx) => {
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
  const entry: Record<string, string | number> = { day: dayNames[dayIdx] ?? '' }
  for (let h = 8; h <= 18; h++) {
    entry[`h${h}`] = Math.floor(Math.random() * 100)
  }
  return entry
})

// ============================================================

/** 维保合同管理面板 */
// ============================================================
// AE Title 配置面板
// ============================================================
function AETitleConfigPanel() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ aeTitle: '', ip: '', port: 104 })
  const [cechoResults, setCechoResults] = useState<Record<string, 'idle' | 'testing' | 'success' | 'fail'>>({})

  const handleEdit = (ae: typeof AE_TITLE_CONFIGS[0]) => {
    setEditingId(ae.id)
    setEditForm({ aeTitle: ae.aeTitle, ip: ae.ip, port: ae.port })
  }

  const handleSave = (_id: string) => {
    setEditingId(null)
  }

  const handleCecho = async (ae: typeof AE_TITLE_CONFIGS[0]) => {
    setCechoResults(prev => ({ ...prev, [ae.id]: 'testing' }))
    await new Promise(r => setTimeout(r, 1000))
    setCechoResults(prev => ({ ...prev, [ae.id]: 'success' }))
    setTimeout(() => setCechoResults(prev => ({ ...prev, [ae.id]: 'idle' })), 3000)
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* AE 列表 */}
        <div style={{
          background: C.white, borderRadius: 12, padding: 16,
          border: `1px solid ${C.border}`, maxHeight: 520, overflowY: 'auto'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} style={{ color: C.accent }} /> AE Title 列表（{AE_TITLE_CONFIGS.length}）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AE_TITLE_CONFIGS.map(ae => (
              <div key={ae.id} style={{
                background: '#f8fafc', borderRadius: 8, padding: '10px 12px',
                border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {editingId === ae.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={editForm.aeTitle} onChange={e => setEditForm(f => ({ ...f, aeTitle: e.target.value }))} style={{
                      padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.accent}`, fontSize: 12, outline: 'none'
                    }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input value={editForm.ip} onChange={e => setEditForm(f => ({ ...f, ip: e.target.value }))} style={{
                        flex: 1, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none'
                      }} />
                      <input type="number" value={editForm.port} onChange={e => setEditForm(f => ({ ...f, port: Number(e.target.value) }))} style={{
                        width: 60, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none'
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleSave(ae.id)} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: C.success, color: '#fff', fontSize: 12, cursor: 'pointer' }}>保存</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, fontSize: 12, cursor: 'pointer' }}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textDark }}>{ae.deviceName.split('（')[0]}</span>
                        <span style={{
                          padding: '1px 6px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          background: ae.status === 'online' ? `${C.success}15` : `${C.danger}15`,
                          color: ae.status === 'online' ? C.success : C.danger
                        }}>{ae.status === 'online' ? '在线' : '离线'}</span>
                      </div>
                      <button onClick={() => handleEdit(ae)} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textLight, fontSize: 12 }}>编辑</button>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace' }}>{ae.aeTitle}</div>
                    <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 2 }}>{ae.ip}:{ae.port} · 最后C-ECHO: {ae.lastCecho}</div>
                    <div style={{ marginTop: 6 }}>
                      {cechoResults[ae.id] === 'idle' || !cechoResults[ae.id] ? (
                        <button onClick={() => handleCecho(ae)} style={{
                          padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.accent}40`,
                          background: `${C.accent}10`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}>C-ECHO 测试</button>
                      ) : cechoResults[ae.id] === 'testing' ? (
                        <span style={{ fontSize: 12, color: C.warning }}>⏳ 测试中...</span>
                      ) : (
                        <span style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>✓ C-ECHO 成功</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 配置概览 */}
        <div style={{
          background: C.white, borderRadius: 12, padding: 16,
          border: `1px solid ${C.border}`
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings2 size={14} style={{ color: C.accent }} /> AE Title 配置概览
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: '在线设备', value: AE_TITLE_CONFIGS.filter(a => a.status === 'online').length, color: C.success },
              { label: '离线设备', value: AE_TITLE_CONFIGS.filter(a => a.status === 'offline').length, color: C.danger },
              { label: '默认端口', value: '104', color: C.info },
              { label: 'DICOM协议', value: 'SCU/SCP', color: C.accent },
            ].map(item => (
              <div key={item.label} style={{
                background: `${item.color}0d`, borderRadius: 8, padding: '10px 12px',
                border: `1px solid ${item.color}25`, textAlign: 'center'
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>常见故障排查</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'C-ECHO失败：检查网络连通性',
              '关联失败：确认AE Title唯一性',
              '传输超时：调整PDV大小',
              '连接拒绝：检查端口号/ACL',
            ].map((hint, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.textMid, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={10} color={C.warning} /> {hint}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// QA/QC 质控计划面板
// ============================================================
function QATestPlannerPanel() {
  const [activeQATab, setActiveQATab] = useState<'plans' | 'calendar' | 'compliance'>('plans')

  const complianceData = [
    { name: 'CT-1', value: 94, color: '#7c3aed' },
    { name: 'MR-1', value: 85, color: '#2563eb' },
    { name: 'DR-1', value: 96, color: '#059669' },
    { name: 'DSA-1', value: 83, color: '#dc2626' },
  ]

  return (
    <div style={{ marginTop: 20 }}>
      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[
          { id: 'plans', label: '测试计划', icon: <FileText size={12} /> },
          { id: 'calendar', label: '测试日历', icon: <CalendarDays size={12} /> },
          { id: 'compliance', label: '合格率统计', icon: <Activity size={12} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveQATab(tab.id as any)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: activeQATab === tab.id ? 700 : 500,
            background: activeQATab === tab.id ? C.primary : '#f0f4f8',
            color: activeQATab === tab.id ? '#fff' : C.textMid,
            transition: 'all 0.2s'
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeQATab === 'plans' && (
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} style={{ color: C.accent }} /> QA/QC 测试计划列表
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                  {['设备', '测试项目', '频率', '上次结果', '上次日期', '下次日期', '7次趋势'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QA_TEST_PLANS.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: C.textDark }}>{p.deviceName}</td>
                    <td style={{ padding: '8px 10px', color: C.textMid }}>{p.testType}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: C.textLight }}>{p.frequency}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: p.lastResult === 'pass' ? `${C.success}15` : `${C.danger}15`,
                        color: p.lastResult === 'pass' ? C.success : C.danger
                      }}>{p.lastResult === 'pass' ? 'PASS' : 'FAIL'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: C.textMid }}>{p.lastDate}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: C.textMid }}>{p.nextDate}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
                        {p.trend.map((v, j) => (
                          <div key={j} style={{
                            flex: 1, height: `${v}%`, minHeight: 4,
                            background: v >= 90 ? C.success : v >= 80 ? C.warning : C.danger,
                            borderRadius: '2px 2px 0 0', opacity: 0.8
                          }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeQATab === 'calendar' && (
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={14} style={{ color: C.warning }} /> QA/QC 测试日历
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {['一', '二', '三', '四', '五', '六', '日'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: C.textLight, padding: 4 }}>{d}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const dayTests = QA_TEST_PLANS.filter(p => {
                const d = parseInt(p.nextDate.split('-')[2])
                return d === day
              })
              return (
                <div key={day} style={{
                  minHeight: 44, borderRadius: 8, padding: 4,
                  background: dayTests.length > 0 ? `${C.warning}10` : '#f8fafc',
                  border: `1px solid ${dayTests.length > 0 ? `${C.warning}30` : C.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
                }}>
                  <span style={{ fontSize: 12, fontWeight: day === 2 ? 700 : 400, color: C.textDark }}>{day}</span>
                  {dayTests.slice(0, 2).map(t => (
                    <span key={t.id} style={{
                      fontSize: 7, fontWeight: 700, padding: '0 3px', borderRadius: 3,
                      background: t.lastResult === 'pass' ? `${C.success}20` : `${C.danger}20`,
                      color: t.lastResult === 'pass' ? C.success : C.danger,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%'
                    }}>{t.testType.slice(0, 3)}</span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeQATab === 'compliance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} style={{ color: C.accent }} /> 设备合格率
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <RePieChart>
                <Pie
                  data={complianceData} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {complianceData.map((_, i) => <Cell key={i} fill={complianceData[i].color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} style={{ color: C.accent }} /> 合格率详情
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {complianceData.map(d => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: C.textDark }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.value >= 90 ? C.success : d.value >= 80 ? C.warning : C.danger }}>{d.value}%</span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${d.value}%`, borderRadius: 3, background: d.color, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
              <span style={{ fontSize: 12.5, color: C.textMid }}>总体合格率: <strong style={{ color: C.success }}>{(complianceData.reduce((s, d) => s + d.value, 0) / complianceData.length).toFixed(1)}%</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function DevicePage() {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedDevice, setSelectedDevice] = useState<DeviceEfficiencyData | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('全部')
  const [filterStatus, setFilterStatus] = useState('全部')
  const [filterMfg, setFilterMfg] = useState('全部')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // 维保管理 state
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintForm, setMaintForm] = useState({ deviceId: '', planDate: '', type: '定期保养', content: '', estimatedCost: '', assignee: '' })

  const { withFeedback, showFeedback } = useButtonFeedback()

  // API 加载设备今日统计
  const [, setDeviceStats] = useState<{ totalDevices: number; inUse: number; idle: number; maintenance: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deviceFaults, setDeviceFaults] = useState<any[]>([])
  const [equipmentLifecycle, setEquipmentLifecycle] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await deviceApi.getTodayStats()
      if (cancelled) return
      if (res.success && res.data) {
        setDeviceStats(res.data)
        setLoadError(null)
      } else {
        setLoadError(res.error?.message ?? 'API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // 加载 device-mgmt 模块数据
  useEffect(() => {
    deviceMgmtApi.listDeviceFaults().then(res => {
      if (res.success && res.data) setDeviceFaults(res.data);
    }).catch((err) => { console.error('[F04]', err); });
    deviceMgmtApi.listEquipmentLifecycle().then(res => {
      if (res.success && res.data) setEquipmentLifecycle(res.data);
    }).catch((err) => { console.error('[F04]', err); });
  }, [])

  const TABS = [
    { label: '设备状态总览', icon: <Monitor size={14} /> },
    { label: '设备列表', icon: <BarChart2 size={14} /> },
    { label: '设备详情', icon: <Activity size={14} /> },
    { label: '维保管理', icon: <Wrench size={14} /> },
    { label: '效能分析', icon: <TrendingUp size={14} /> },
    { label: '效益分析', icon: <DollarSign size={14} /> },
    { label: 'AE配置', icon: <Shield size={14} /> },
    { label: '质控计划', icon: <Activity size={14} /> },
  ]

  // 统计数据
  const stats = {
    total: DEVICE_EFFICIENCY.length,
    inUse: DEVICE_EFFICIENCY.filter(d => d.status === '使用中').length,
    idle: DEVICE_EFFICIENCY.filter(d => d.status === '空闲').length,
    maint: DEVICE_EFFICIENCY.filter(d => ['维护中', '维修中'].includes(d.status)).length,
    fault: DEVICE_EFFICIENCY.filter(d => d.status === '维修中').length,
    avgUtil: Math.round(DEVICE_EFFICIENCY.reduce((s, d) => s + d.utilization, 0) / DEVICE_EFFICIENCY.length),
    totalTodayExams: DEVICE_EFFICIENCY.reduce((s, d) => s + d.todayBookings, 0),
    pendingMaint: MAINTENANCE_PLANS.length,
    alertDevices: DEVICE_EFFICIENCY.filter(d => d.age > 6).length,
  }

  // 设备列表筛选 + 排序
  const manufacturers = ['全部', ...Array.from(new Set(DEVICE_EFFICIENCY.map(d => d.manufacturer)))]
  const filteredDevices = DEVICE_EFFICIENCY
    .filter(d => {
      const matchSearch = !search || d.name.includes(search) || d.model.includes(search) || d.manufacturer.includes(search)
      const matchType = filterType === '全部' || d.modality === filterType
      const matchStatus = filterStatus === '全部' || d.status === filterStatus
      const matchMfg = filterMfg === '全部' || d.manufacturer === filterMfg
      return matchSearch && matchType && matchStatus && matchMfg
    })
    .sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0
      switch (sortKey) {
        case 'id': av = a.id; bv = b.id; break
        case 'name': av = a.name; bv = b.name; break
        case 'modality': av = a.modality; bv = b.modality; break
        case 'status': av = a.status; bv = b.status; break
        case 'utilization': av = a.utilization; bv = b.utilization; break
        case 'todayBookings': av = a.todayBookings; bv = b.todayBookings; break
        case 'capacity': av = a.capacity; bv = b.capacity; break
        default: av = a.id; bv = b.id
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })

  const handleDetail = (device: DeviceData) => {
    setSelectedDevice(device as DeviceEfficiencyData)
    setShowDetail(true)
  }

  const handleExam = (device: DeviceData) => {
    withFeedback(() => {}, `已为 ${device.name} 开始检查流程`)
  }

  const handleMaintenance = (device: DeviceData) => {
    setActiveTab(3)
    setMaintForm(f => ({ ...f, deviceId: device.id }))
  }

  const handleMaintSubmit = () => {
    if (!maintForm.deviceId || !maintForm.planDate) {
      showFeedback('error', '请填写必填项'); return
    }
    withFeedback(() => {
      setShowMaintForm(false)
      setMaintForm({ deviceId: '', planDate: '', type: '定期保养', content: '', estimatedCost: '', assignee: '' })
    }, `维保计划已创建：${maintForm.deviceId}，计划日期 ${maintForm.planDate}`)
  }

  // ============================================================
  // 效益分析数据准备
  // ============================================================

  // 设备利用率饼图数据（按设备类型汇总）
  const utilizationPieData = [
    { name: 'CT', value: DEVICE_EFFICIENCY.filter(d => d.modality === 'CT').reduce((s, d) => s + d.utilization, 0) },
    { name: 'MR', value: DEVICE_EFFICIENCY.filter(d => d.modality === 'MR').reduce((s, d) => s + d.utilization, 0) },
    { name: 'DR', value: DEVICE_EFFICIENCY.filter(d => d.modality === 'DR').reduce((s, d) => s + d.utilization, 0) },
    { name: 'DSA', value: DEVICE_EFFICIENCY.filter(d => d.modality === 'DSA').reduce((s, d) => s + d.utilization, 0) },
    { name: '其他', value: DEVICE_EFFICIENCY.filter(d => !['CT', 'MR', 'DR', 'DSA'].includes(d.modality)).reduce((s, d) => s + d.utilization, 0) },
  ]

  // 检查量趋势数据（按月份汇总）
  const examTrendData = [
    { month: '1月', ct: 280, mr: 120, dr: 850, dsa: 28 },
    { month: '2月', ct: 245, mr: 105, dr: 780, dsa: 22 },
    { month: '3月', ct: 310, mr: 140, dr: 920, dsa: 32 },
    { month: '4月', ct: 330, mr: 155, dr: 980, dsa: 35 },
    { month: '5月', ct: 295, mr: 130, dr: 890, dsa: 29 },
    { month: '6月', ct: 318, mr: 148, dr: 950, dsa: 33 },
  ]

  // 故障停机统计汇总
  const totalDowntimeLoss = DOWNTIME_DATA.reduce((s, d) => s + d.lossAmount, 0)
  const totalDowntimeHours = DOWNTIME_DATA.reduce((s, d) => s + d.downtimeHours, 0)
  const totalFaultCount = DOWNTIME_DATA.reduce((s, d) => s + d.faultCount, 0)

  // ============================================================
  // Tab 0: 设备状态实时监控
  // ============================================================
  const renderDeviceStatusOverview = () => (
    <div>
      {/* 顶部4个统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <div style={{
          background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
          boxShadow: '0 1px 4px rgba(30,58,95,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.success}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={22} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.textDark }}>{stats.inUse}</div>
              <div style={{ fontSize: 12.5, color: C.textLight }}>使用中设备</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
          boxShadow: '0 1px 4px rgba(30,58,95,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={22} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.textDark }}>{stats.idle}</div>
              <div style={{ fontSize: 12.5, color: C.textLight }}>空闲设备</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
          boxShadow: '0 1px 4px rgba(30,58,95,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.warning}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color={C.warning} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.textDark }}>{stats.maint + stats.fault}</div>
              <div style={{ fontSize: 12.5, color: C.textLight }}>维护/故障中</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
          boxShadow: '0 1px 4px rgba(30,58,95,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.info}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={22} color={C.info} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.textDark }}>{stats.totalTodayExams}</div>
              <div style={{ fontSize: 12.5, color: C.textLight }}>今日检查量</div>
            </div>
          </div>
        </div>
      </div>

      {/* 实时状态概览 + 使用时长 + 故障率 + 开机率 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 实时状态看板 */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Monitor size={14} style={{ color: C.accent }} /> 设备运行状态看板
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '使用中', count: stats.inUse, color: C.success, icon: <Play size={14} /> },
              { label: '空闲', count: stats.idle, color: C.accent, icon: <Pause size={14} /> },
              { label: '维护中', count: stats.maint, color: C.warning, icon: <Settings size={14} /> },
              { label: '故障', count: stats.fault, color: C.danger, icon: <AlertCircle size={14} /> },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: `${item.color}0d`, borderRadius: 8, padding: '10px 14px',
                border: `1px solid ${item.color}20`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: item.color }}>{item.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 使用时长统计 */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Timer size={14} style={{ color: C.info }} /> 使用时长统计
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <ChartBar data={[
              { device: 'CT-1', hours: 216 },
              { device: 'MR-1', hours: 212 },
              { device: 'DR-1', hours: 220 },
              { device: 'DR-2', hours: 224 },
              { device: 'CT-2', hours: 221 },
              { device: 'MR-2', hours: 216 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="device" tick={{ fontSize: 12, fill: C.textLight }} />
              <YAxis tick={{ fontSize: 12, fill: C.textLight }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Bar dataKey="hours" fill={C.accent} radius={[4, 4, 0, 0]} />
            </ChartBar>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 故障率统计 */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: C.danger }} /> 故障率统计
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOWNTIME_DATA.slice(0, 5).map(item => (
              <div key={item.deviceName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark, width: 50 }}>{item.deviceName}</span>
                <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.min(100, (item.faultCount / 4) * 100)}%`,
                    background: item.faultCount >= 3 ? C.danger : item.faultCount >= 2 ? C.warning : C.success
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.faultCount >= 3 ? C.danger : item.faultCount >= 2 ? C.warning : C.success, width: 40, textAlign: 'right' }}>
                  {item.faultCount}次
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 开机率统计 */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Power size={14} style={{ color: C.success }} /> 开机率统计
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {UPTIME_STATS.slice(0, 5).map(item => (
              <div key={item.deviceName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark, width: 50 }}>{item.deviceName}</span>
                <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 4, width: `${item.uptimeRate}%`,
                    background: item.uptimeRate >= 98 ? C.success : item.uptimeRate >= 95 ? C.warning : C.danger
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.uptimeRate >= 98 ? C.success : item.uptimeRate >= 95 ? C.warning : C.danger, width: 40, textAlign: 'right' }}>
                  {item.uptimeRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 今日检查量排名 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} style={{ color: C.accent }} /> 今日检查量排名
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                {['排名', '设备名称', '类型', '今日检查', '等待人数', '平均等待'].map(h => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TODAY_RANKING.map((item, i) => (
                <tr key={item.rank} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: '50%',
                      background: i === 0 ? C.warning : i === 1 ? C.accent : i === 2 ? C.info : C.textLight,
                      color: '#fff', fontWeight: 800, fontSize: 12
                    }}>{item.rank}</span>
                  </td>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: C.textDark }}>{item.deviceName.split('（')[0]}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><ModalityBadge modality={item.modality} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.accent }}>{item.examCount}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: item.waitingCount > 8 ? C.warning : C.textMid }}>{item.waitingCount}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: item.avgWaitTime > 20 ? C.danger : item.avgWaitTime > 10 ? C.warning : C.success }}>{item.avgWaitTime}分钟</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // Tab 1: 设备列表
  // ============================================================
  const renderDeviceList = () => (
    <div>
      <DeviceFilter
        search={search}
        onSearchChange={setSearch}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterMfg={filterMfg}
        onFilterMfgChange={setFilterMfg}
        manufacturers={manufacturers}
        deviceCount={filteredDevices.length}
      />
      <DeviceList
        devices={filteredDevices}
        examRooms={initialExamRooms}
        onDetail={handleDetail}
        onExam={handleExam}
        onMaintenance={handleMaintenance}
      />
    </div>
  )

  // ============================================================
  // Tab 3: 维保管理（完整版）
  // ============================================================
  const renderMaintenanceTab = () => (
    <div>
      {/* 顶部4个统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(30,58,95,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.warning}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} color={C.warning} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{MAINTENANCE_PLANS.length}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>待执行计划</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(30,58,95,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.danger}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color={C.danger} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>
                {MAINTENANCE_PLANS.filter(p => { const d = new Date(p.planDate); const n = new Date('2026-05-02'); return Math.floor((d.getTime() - n.getTime()) / 86400000) <= 30 }).length}
              </div>
              <div style={{ fontSize: 12, color: C.textLight }}>30天内到期</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(30,58,95,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={20} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{MAINTENANCE_RECORDS.length}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>维保记录</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(30,58,95,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.success}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>
                ¥{(MAINTENANCE_RECORDS.reduce((s, r) => s + r.cost, 0) / 10000).toFixed(1)}万
              </div>
              <div style={{ fontSize: 12, color: C.textLight }}>累计维保费用</div>
            </div>
          </div>
        </div>
      </div>

      {/* 维保到期提醒卡片 */}
      <div style={{
        background: `${C.danger}08`, borderRadius: 12, padding: 16,
        border: `1px solid ${C.danger}25`, marginBottom: 18
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color={C.danger} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>维保到期提醒</span>
          </div>
          <span style={{ fontSize: 12, color: C.danger }}>共 {MAINTENANCE_PLANS.filter(p => { const d = new Date(p.planDate); const n = new Date('2026-05-02'); return Math.floor((d.getTime() - n.getTime()) / 86400000) <= 30 }).length} 项待执行</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {MAINTENANCE_PLANS
            .filter(p => { const d = new Date(p.planDate); const n = new Date('2026-05-02'); const days = Math.floor((d.getTime() - n.getTime()) / 86400000); return days >= 0 && days <= 30; })
            .map(plan => {
              const daysLeft = Math.floor((new Date(plan.planDate).getTime() - new Date('2026-05-02').getTime()) / 86400000)
              return (
                <div key={plan.id} style={{
                  background: C.white, borderRadius: 8, padding: '10px 12px',
                  border: `1px solid ${daysLeft <= 7 ? `${C.danger}40` : `${C.warning}40`}`
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 2 }}>{plan.deviceName.split('（')[0]}</div>
                  <div style={{ fontSize: 12.5, color: C.textMid, marginBottom: 3 }}>{plan.content}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.textLight }}>{plan.planDate}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: daysLeft <= 7 ? C.danger : C.warning,
                      background: `${daysLeft <= 7 ? C.danger : C.warning}15`, padding: '2px 6px', borderRadius: 8
                    }}>
                      {daysLeft <= 0 ? '今天' : `${daysLeft}天后`}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <MaintenanceHistoryTable records={MAINTENANCE_RECORDS} />
      <MaintenancePlanTable plans={MAINTENANCE_PLANS} onAddPlan={() => setShowMaintForm(true)} />

      {/* 维保费用统计 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <DollarSign size={14} style={{ color: C.success }} /> 维保费用统计（月度）
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ChartBar data={MAINTENANCE_COST_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textLight }} />
            <YAxis tick={{ fontSize: 12, fill: C.textLight }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ct" name="CT" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="mr" name="MR" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="dr" name="DR" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="dsa" name="DSA" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </ChartBar>
        </ResponsiveContainer>
      </div>
    </div>
  )

  // ============================================================
  // Tab 4: 效能分析
  // ============================================================
  const renderEfficiencyTab = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gauge size={20} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{stats.avgUtil}%</div>
              <div style={{ fontSize: 12, color: C.textLight }}>平均利用率</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.success}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Power size={20} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>96.1%</div>
              <div style={{ fontSize: 12, color: C.textLight }}>平均开机率</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.warning}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color={C.warning} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{stats.fault}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>故障设备</div>
            </div>
          </div>
        </div>
      </div>

      {/* 7天检查量趋势 LineChart */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} style={{ color: C.accent }} /> 7天检查量趋势
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={WEEKLY_TREND_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: C.textLight }} />
            <YAxis tick={{ fontSize: 12, fill: C.textLight }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {initialModalityDevices.slice(0, 4).map((d, i) => (
              <Line key={d.id} type="monotone" dataKey={d.id} name={d.name.split('（')[0]} stroke={PIE_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 使用时段热力图 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={14} style={{ color: C.info }} /> 使用时段分布（周一~周日，8-18时）
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(11, 1fr)', gap: 3, minWidth: 500 }}>
            {/* 表头 */}
            <div />
            {Array.from({ length: 11 }, (_, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 12, color: C.textLight, padding: '2px 0' }}>{8 + i}:00</div>
            ))}
            {/* 数据行 */}
            {HEATMAP_DATA.map(row => (
              <div key={row.day} style={{ display: 'contents' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center' }}>{row.day}</div>
                {Array.from({ length: 11 }, (_, i) => {
                  const hourKey = 'h' + (8 + i)
                  const val = Number(row[hourKey])
                  const intensity = Math.floor(val / 100 * 5)
                  const bgAlpha = (0.1 + intensity * 0.18).toFixed(2)
                  return (
                    <div key={i} style={{
                      height: 28, borderRadius: 4,
                      background: 'rgba(59, 130, 246, ' + bgAlpha + ')',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: intensity >= 3 ? '#fff' : C.textDark
                    }}>{val}</div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 故障代码分类 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={14} style={{ color: C.danger }} /> 故障代码分类与MTBF分析
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* 故障趋势图 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>故障趋势（近6月）</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={FAULT_TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textLight }} />
                <YAxis tick={{ fontSize: 12, fill: C.textLight }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="critical" name="严重" stroke={C.danger} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="major" name="主要" stroke={C.warning} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="minor" name="轻微" stroke={C.info} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Top5 故障柱状图 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>Top 5 故障类型</div>
            <ResponsiveContainer width="100%" height={160}>
              <ChartBar data={FAULT_CODES.sort((a, b) => b.count - a.count).slice(0, 5).map(f => ({ name: f.description.length > 8 ? f.description.slice(0, 8) + '...' : f.description, count: f.count }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis type="number" tick={{ fontSize: 12, fill: C.textLight }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: C.textLight }} width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Bar dataKey="count" fill={C.danger} radius={[0, 4, 4, 0]} />
              </ChartBar>
            </ResponsiveContainer>
          </div>
        </div>
        {/* 故障代码树表格 */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                {['故障代码', '分类', '描述', '严重级别', 'MTBF(天)', '发生次数', '涉及设备'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAULT_CODES.map((f, i) => (
                <tr key={f.code} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12.5, color: C.textMid }}>{f.code}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: `${C.primary}10`, color: C.primary
                    }}>{f.category}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: C.textDark, fontWeight: 600, fontSize: 12 }}>{f.description}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                      background: f.severity === 'critical' ? `${C.danger}15` : f.severity === 'major' ? `${C.warning}15` : `${C.info}15`,
                      color: f.severity === 'critical' ? C.danger : f.severity === 'major' ? C.warning : C.info
                    }}>{f.severity === 'critical' ? '严重' : f.severity === 'major' ? '主要' : '轻微'}</span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: C.textMid }}>{f.mtbf}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: f.count >= 4 ? C.danger : f.count >= 2 ? C.warning : C.success }}>{f.count}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: C.textMid }}>{f.devices.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
          <span style={{ fontSize: 12.5, color: C.textMid }}>平均MTBF: <strong style={{ color: C.info }}>{Math.round(FAULT_CODES.reduce((s, f) => s + f.mtbf, 0) / FAULT_CODES.length)}天</strong></span>
          <span style={{ fontSize: 12.5, color: C.textMid }}>总故障次数: <strong style={{ color: C.danger }}>{FAULT_CODES.reduce((s, f) => s + f.count, 0)}次</strong></span>
          <span style={{ fontSize: 12.5, color: C.textMid }}>严重故障占比: <strong style={{ color: C.danger }}>{(FAULT_CODES.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0) / FAULT_CODES.reduce((s, f) => s + f.count, 0) * 100).toFixed(0)}%</strong></span>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // Tab 5: 效益分析（新增完整版）
  // ============================================================
  const renderBenefitAnalysisTab = () => (
    <div>
      {/* 顶部4个统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.success}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>¥{(REVENUE_DATA.reduce((s, d) => s + d.total, 0) / 100000000).toFixed(2)}亿</div>
              <div style={{ fontSize: 12, color: C.textLight }}>半年总收入</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{examTrendData.reduce((s, d) => s + d.ct + d.mr + d.dr + d.dsa, 0)}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>半年总检查量</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.danger}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} color={C.danger} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>{totalFaultCount}次</div>
              <div style={{ fontSize: 12, color: C.textLight }}>故障次数</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.warning}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} color={C.warning} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.textDark }}>¥{(totalDowntimeLoss / 10000).toFixed(0)}万</div>
              <div style={{ fontSize: 12, color: C.textLight }}>故障停机损失</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 检查量趋势图 LineChart */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} style={{ color: C.accent }} /> 检查量趋势（近6月）
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={examTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textLight }} />
              <YAxis tick={{ fontSize: 12, fill: C.textLight }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ct" name="CT" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mr" name="MR" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="dr" name="DR" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="dsa" name="DSA" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 设备利用率饼图 PieChart */}
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PieChartIcon size={14} style={{ color: C.warning }} /> 设备利用率分布（按类型）
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RePieChart>
              <Pie
                data={utilizationPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {utilizationPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 故障停机损失统计 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={14} style={{ color: C.danger }} /> 故障停机损失统计
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: '故障设备数', value: `${DOWNTIME_DATA.filter(d => d.faultCount > 0).length} 台`, color: C.danger },
            { label: '总停机时长', value: `${totalDowntimeHours} 小时`, color: C.warning },
            { label: '总损失金额', value: `¥${(totalDowntimeLoss / 10000).toFixed(1)} 万`, color: C.danger },
            { label: '平均MTBF', value: `${Math.round(DOWNTIME_DATA.reduce((s, d) => s + d.mtbf, 0) / DOWNTIME_DATA.length)} 天`, color: C.info },
          ].map(item => (
            <div key={item.label} style={{
              background: `${item.color}0d`, borderRadius: 10, padding: '12px 14px',
              border: `1px solid ${item.color}25`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                {['设备名称', '故障次数', '停机时长', '损失金额', 'MTBF', '故障描述'].map(h => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOWNTIME_DATA.map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: C.textDark }}>{item.deviceName}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: item.faultCount >= 3 ? C.danger : C.textMid }}>{item.faultCount}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: item.downtimeHours > 24 ? C.danger : C.textMid }}>{item.downtimeHours}h</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.warning }}>¥{item.lossAmount.toLocaleString()}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{item.mtbf}天</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROI 投资回报率计算器 */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <DollarSign size={14} style={{ color: C.success }} /> ROI 投资回报率分析
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                {['设备', '购置成本', '年收入', '年维保', '年其他', '年利润', '折旧方式', '年折旧', 'ROI', '回收期'].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: C.primary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROI_DEVICE_DATA.map((d, i) => {
                const annualDepr = d.depreciationMethod === 'straight' ? d.purchaseCost / d.usefulLife : d.purchaseCost * 0.2
                const annualProfit = d.annualRevenue - d.annualMaintCost - d.annualOtherCost - annualDepr
                const roi = d.purchaseCost > 0 ? ((annualProfit / d.purchaseCost) * 100) : 0
                const payback = annualProfit > 0 ? d.purchaseCost / annualProfit : 99
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 600, color: C.textDark }}>{d.deviceName}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textMid }}>¥{(d.purchaseCost / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: C.success }}>¥{(d.annualRevenue / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: C.warning }}>¥{(d.annualMaintCost / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textMid }}>¥{(d.annualOtherCost / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: annualProfit > 0 ? C.success : C.danger }}>¥{(annualProfit / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: C.textMid }}>{d.depreciationMethod === 'straight' ? '直线法' : '加速法'}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textMid }}>¥{(annualDepr / 10000).toFixed(0)}万</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: roi > 50 ? `${C.success}15` : roi > 20 ? `${C.warning}15` : `${C.danger}15`,
                        color: roi > 50 ? C.success : roi > 20 ? C.warning : C.danger
                      }}>{roi.toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: C.textMid }}>{payback < 1 ? '<1年' : `${payback.toFixed(1)}年`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: C.textMid }}>平均ROI: <strong style={{ color: C.success }}>{ROI_DEVICE_DATA.reduce((s, d) => s + (d.annualRevenue - d.annualMaintCost - d.annualOtherCost - (d.depreciationMethod === 'straight' ? d.purchaseCost / d.usefulLife : d.purchaseCost * 0.2)) / d.purchaseCost * 100, 0) / ROI_DEVICE_DATA.length}%</strong></span>
          <span style={{ fontSize: 12, color: C.textMid }}>最短回收期: <strong style={{ color: C.info }}>{Math.min(...ROI_DEVICE_DATA.filter(d => d.annualRevenue - d.annualMaintCost - d.annualOtherCost - (d.depreciationMethod === 'straight' ? d.purchaseCost / d.usefulLife : d.purchaseCost * 0.2) > 0).map(d => d.purchaseCost / (d.annualRevenue - d.annualMaintCost - d.annualOtherCost - (d.depreciationMethod === 'straight' ? d.purchaseCost / d.usefulLife : d.purchaseCost * 0.2)))).toFixed(1)}年</strong></span>
          <span style={{ fontSize: 12, color: C.textMid }}>总投资: <strong style={{ color: C.textDark }}>¥{(ROI_DEVICE_DATA.reduce((s, d) => s + d.purchaseCost, 0) / 100000000).toFixed(2)}亿</strong></span>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // Tab 6: AE Title 配置
  // ============================================================
  const renderAETitleConfig = () => <AETitleConfigPanel />

  // ============================================================
  // Tab 7: QA/QC 质控计划
  // ============================================================
  const renderQATestPlanner = () => <QATestPlannerPanel />

  // ============================================================
  // Tab 2: 设备详情
  // ============================================================
  const renderDeviceDetailTab = () => (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textLight }}>
      <Activity size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
      <div style={{ fontSize: 14 }}>请从「设备列表」选择一个设备查看详情</div>
    </div>
  )

  // ============================================================
  // 添加维保记录表单弹窗
  // ============================================================
  const renderMaintenanceFormModal = () => {
    if (!showMaintForm) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}>
        <div style={{
          background: C.white, borderRadius: 16, width: '100%', maxWidth: 500,
          boxShadow: '0 20px 60px rgba(30,58,95,0.25)'
        }}>
          <div style={{
            padding: '16px 20px', background: C.primary, color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderRadius: '16px 16px 0 0'
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> 添加维保计划
            </div>
            <button onClick={() => setShowMaintForm(false)} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
              padding: 6, cursor: 'pointer', color: '#fff', display: 'flex'
            }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>设备 *</label>
                <select value={maintForm.deviceId} onChange={e => setMaintForm(f => ({ ...f, deviceId: e.target.value }))} style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none'
                }}>
                  <option value="">请选择设备</option>
                  {DEVICE_EFFICIENCY.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>计划日期 *</label>
                <input type="date" value={maintForm.planDate} onChange={e => setMaintForm(f => ({ ...f, planDate: e.target.value }))} style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none', boxSizing: 'border-box'
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>保养类型</label>
                <select value={maintForm.type} onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))} style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none'
                }}>
                  <option>定期保养</option>
                  <option>季度保养</option>
                  <option>半年保养</option>
                  <option>年度保养</option>
                  <option>故障维修</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>保养内容</label>
                <textarea value={maintForm.content} onChange={e => setMaintForm(f => ({ ...f, content: e.target.value }))} placeholder="请输入保养内容..." style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none', minHeight: 60, resize: 'vertical', boxSizing: 'border-box'
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>预计费用</label>
                <input type="number" value={maintForm.estimatedCost} onChange={e => setMaintForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="请输入预计费用" style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none', boxSizing: 'border-box'
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDark, display: 'block', marginBottom: 4 }}>负责人</label>
                <input value={maintForm.assignee} onChange={e => setMaintForm(f => ({ ...f, assignee: e.target.value }))} placeholder="请输入负责人" style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textDark, outline: 'none', boxSizing: 'border-box'
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowMaintForm(false)} style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.white, color: C.textMid, fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>取消</button>
              <button onClick={handleMaintSubmit} style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
                background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>确认添加</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 渲染入口
  // ============================================================
  return (
    <div style={{ padding: '0 24px 24px', minHeight: '100vh', background: C.bg }}>
      {loading && (
        <div style={{ padding: 8, margin: 12, background: '#dbeafe', color: '#1e40af', borderRadius: 6, fontSize: 13 }}>
          ⏳ 正在从 API 加载设备统计...
        </div>
      )}
      {loadError && !loading && (
        <div style={{ padding: 8, margin: 12, background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 13 }}>
          ⚠️ {loadError}
        </div>
      )}
      {/* 页面标题 */}
      <div style={{ padding: '20px 0 16px', borderBottom: `2px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.primary, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={22} /> 影像设备管理
            </h1>
            <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>
              设备总数 {stats.total} 台 · 使用中 {stats.inUse} 台 · 空闲 {stats.idle} 台 · 维护 {stats.maint} 台
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.white, color: C.textMid, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }} onClick={async (evt) => {
              const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
              btn.disabled = true;
              const orig = btn.innerHTML;
              btn.innerHTML = '⏳ 导出中...';
              await new Promise(r => setTimeout(r, 1500));
              localStorage.setItem('g005_device_export', JSON.stringify({ timestamp: new Date().toISOString(), deviceCount: 8 }));
              btn.innerHTML = '✅ 导出成功';
              btn.style.color = C.success;
              setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; btn.style.color = ''; }, 2000);
            }}>
              <Download size={13} /> 导出报表
            </button>
            <button
              onClick={() => { setActiveTab(3); setShowMaintForm(true) }}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: C.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <Plus size={13} /> 添加维保
            </button>
          </div>
        </div>
      </div>

      {/* 标签页切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `2px solid ${C.border}`, paddingBottom: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
              background: 'transparent',
              color: activeTab === i ? C.primary : C.textMid,
              borderBottom: `3px solid ${activeTab === i ? C.primary : 'transparent'}`,
              marginBottom: -2, transition: 'all 0.2s'
            }}
          >
            {tab.icon}
            {tab.label}
            {i === 3 && <span style={{
              background: C.warning, color: '#fff', fontSize: 12, fontWeight: 800,
              padding: '1px 5px', borderRadius: 10, marginLeft: 2
            }}>{MAINTENANCE_PLANS.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div>
        {activeTab === 0 && renderDeviceStatusOverview()}
        {activeTab === 1 && renderDeviceList()}
        {activeTab === 2 && renderDeviceDetailTab()}
        {activeTab === 3 && renderMaintenanceTab()}
        {activeTab === 4 && renderEfficiencyTab()}
        {activeTab === 5 && renderBenefitAnalysisTab()}
        {activeTab === 6 && renderAETitleConfig()}
        {activeTab === 7 && renderQATestPlanner()}
      </div>

      {/* 设备详情弹窗 */}
      {showDetail && selectedDevice && (
        <DeviceDetailPanel
          device={selectedDevice}
          onClose={() => setShowDetail(false)}
          maintRecords={MAINTENANCE_RECORDS.filter(m => m.deviceId === selectedDevice.id)}
          deviceStatsData={deviceStatsData}
          examRooms={initialExamRooms}
          extInfo={(DEVICE_EXTENDED_INFO.find(e => e.id === selectedDevice.id) || selectedDevice) as DeviceEfficiencyData}
        />
      )}

      {/* 维保记录表单弹窗 */}
      {renderMaintenanceFormModal()}
    </div>
  )
}

