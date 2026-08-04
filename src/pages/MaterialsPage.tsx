// @ts-nocheck
// G005 放射科RIS系统 - 物资耗材管理页面 v3.0.2.17 (Phase 4a)
import { useState, useEffect } from 'react'
import {
  Package, Boxes, AlertTriangle, CheckCircle, Clock, Search, Activity,
  Settings, TrendingUp, BarChart2, Calendar, User, Filter, ChevronUp,
  ChevronDown, RefreshCw, Plus, X, Check, Eye, DollarSign,
  BarChart as MatBarChart, PieChart as MatPieChart, TrendingDown, FileText, CreditCard, CalendarDays,
  Truck, ClipboardList, FileCheck, History, Download,
  Edit2, Trash2, ArrowDownUp, RefreshCcw, Send,
  CheckCheck, XCircle, AlertCircle, ArrowRight, PackageCheck, PackageX,
  QrCode, Timer, Award, Star, BarChart3, Percent, Wallet, ShoppingCart,
  UserCheck, AlertOctagon, BadgePercent, Gauge, ScanLine, Bell, FileSpreadsheet,
  Droplet
} from 'lucide-react'
import {
  BarChart as ChartBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts'

// ============================================================
// 样式常量 - WIN10风格
// ============================================================
const C = {
  primary: '#1e40af',        // 深蓝主色
  primaryLight: '#3b82f6',   // 浅蓝
  primaryLighter: '#dbeafe', // 淡蓝背景
  accent: '#0891b2',         // 青色辅色
  accentLight: '#06b6d4',    // 浅青
  white: '#ffffff',          // 白色卡片
  bg: '#e8e8e8',             // 浅灰背景
  border: '#d1d5db',         // 边框色
  textDark: '#1f2937',       // 深色文字
  textMid: '#4b5563',        // 中色文字
  textLight: '#9ca3af',      // 浅色文字
  success: '#059669',        // 成功绿
  warning: '#d97706',        // 警告橙
  danger: '#dc2626',         // 危险红
  info: '#2563eb',           // 信息蓝
}

// 库存分类
export const MATERIAL_CATEGORIES = ['全部', '胶片', '造影剂', '注射器', '对比剂', '针筒', '导管', '其他耗材']

// 库存状态
const STOCK_STATUS = {
  NORMAL: 'normal',
  LOW: 'low',
  OUT: 'out'
}

// 预警阈值配置
const ALERT_THRESHOLDS: Record<string, number> = {
  '胶片': 100,
  '造影剂': 50,
  '注射器': 200,
  '对比剂': 30,
  '针筒': 500,
  '导管': 100,
  '其他耗材': 50
}

// ============================================================
// 模拟数据
// ============================================================

// 物资库存数据
const INITIAL_MATERIALS = [
  { id: 'M001', name: 'GE DR胶片', category: '胶片', spec: '35cm×43cm(14"×17")', unit: '张', stock: 450, minStock: 100, price: 12.5, supplier: 'GE医疗', lastIn: '2026-04-20', lastOut: '2026-05-01' },
  { id: 'M002', name: '柯尼卡CR胶片', category: '胶片', spec: '35cm×43cm(14"×17")', unit: '张', stock: 380, minStock: 100, price: 10.8, supplier: '柯尼卡美能达', lastIn: '2026-04-18', lastOut: '2026-05-01' },
  { id: 'M003', name: '欧乃影造影剂', category: '造影剂', spec: '20ml/支', unit: '支', stock: 120, minStock: 50, price: 85.0, supplier: 'GE医疗', lastIn: '2026-04-15', lastOut: '2026-04-30' },
  { id: 'M004', name: '碘佛醇注射液', category: '造影剂', spec: '100ml:35g(I)', unit: '瓶', stock: 85, minStock: 50, price: 220.0, supplier: '恒瑞医药', lastIn: '2026-04-22', lastOut: '2026-05-01' },
  { id: 'M005', name: '一次性注射器', category: '注射器', spec: '20ml', unit: '支', stock: 1500, minStock: 200, price: 1.8, supplier: '山东威高', lastIn: '2026-04-25', lastOut: '2026-05-01' },
  { id: 'M006', name: '一次性注射器', category: '注射器', spec: '50ml', unit: '支', stock: 320, minStock: 100, price: 3.2, supplier: '山东威高', lastIn: '2026-04-25', lastOut: '2026-04-29' },
  { id: 'M007', name: '碘克沙醇注射液', category: '对比剂', spec: '100ml', unit: '瓶', stock: 45, minStock: 30, price: 380.0, supplier: '拜耳医药', lastIn: '2026-04-10', lastOut: '2026-04-28' },
  { id: 'M008', name: '钆特酸葡胺注射液', category: '对比剂', spec: '15ml', unit: '支', stock: 28, minStock: 30, price: 450.0, supplier: 'GE医疗', lastIn: '2026-04-08', lastOut: '2026-04-25' },
  { id: 'M009', name: '一次性使用输液器', category: '导管', spec: '0.7×25mm', unit: '支', stock: 180, minStock: 100, price: 4.5, supplier: '贝朗医疗', lastIn: '2026-04-20', lastOut: '2026-05-01' },
  { id: 'M010', name: '静脉留置针', category: '导管', spec: '22G', unit: '支', stock: 95, minStock: 100, price: 18.0, supplier: 'BD医疗', lastIn: '2026-04-18', lastOut: '2026-04-30' },
  { id: 'M011', name: 'CT高压注射器针筒', category: '针筒', spec: '200ml双筒', unit: '套', stock: 65, minStock: 50, price: 120.0, supplier: '拜耳医药', lastIn: '2026-04-12', lastOut: '2026-04-27' },
  { id: 'M012', name: 'MR高压注射器针筒', category: '针筒', spec: '65ml单筒', unit: '套', stock: 42, minStock: 30, price: 95.0, supplier: '拜耳医药', lastIn: '2026-04-12', lastOut: '2026-04-25' },
]

// 供应商数据
const INITIAL_SUPPLIERS = [
  { id: 'S001', name: 'GE医疗', contact: '王经理', phone: '010-12345678', email: 'wang@ge.com', address: '北京市经济技术开发区', categories: ['胶片', '造影剂', '对比剂'], rating: 4.8 },
  { id: 'S002', name: '柯尼卡美能达', contact: '李经理', phone: '021-87654321', email: 'li@konica.com', address: '上海市浦东新区', categories: ['胶片'], rating: 4.5 },
  { id: 'S003', name: '恒瑞医药', contact: '张经理', phone: '0518-1234567', email: 'zhang@hengrui.com', address: '江苏省连云港市', categories: ['造影剂', '对比剂'], rating: 4.7 },
  { id: 'S004', name: '山东威高', contact: '赵经理', phone: '0631-1234567', email: 'zhao@weigao.com', address: '山东省威海市', categories: ['注射器', '针筒', '导管'], rating: 4.6 },
  { id: 'S005', name: '拜耳医药', contact: '刘经理', phone: '010-98765432', email: 'liu@bayer.com', address: '北京市朝阳区', categories: ['对比剂', '针筒'], rating: 4.9 },
  { id: 'S006', name: '贝朗医疗', contact: '陈经理', phone: '021-65432109', email: 'chen@bbraun.com', address: '上海市闵行区', categories: ['导管'], rating: 4.4 },
  { id: 'S007', name: 'BD医疗', contact: '周经理', phone: '010-34567890', email: 'zhou@bd.com', address: '北京市海淀区', categories: ['导管', '注射器'], rating: 4.7 },
]

// 入库记录
const INITIAL_IN_RECORDS = [
  { id: 'IN001', materialId: 'M001', materialName: 'GE DR胶片', spec: '35cm×43cm(14"×17")', quantity: 500, date: '2026-04-20', operator: '张三', supplier: 'GE医疗', note: '季度采购' },
  { id: 'IN002', materialId: 'M003', materialName: '欧乃影造影剂', spec: '20ml/支', quantity: 200, date: '2026-04-15', operator: '李四', supplier: 'GE医疗', note: '常规补货' },
  { id: 'IN003', materialId: 'M004', materialName: '碘佛醇注射液', spec: '100ml:35g(I)', quantity: 100, date: '2026-04-22', operator: '张三', supplier: '恒瑞医药', note: '月度采购' },
  { id: 'IN004', materialId: 'M005', materialName: '一次性注射器', spec: '20ml', quantity: 2000, date: '2026-04-25', operator: '王五', supplier: '山东威高', note: '大批量采购' },
  { id: 'IN005', materialId: 'M007', materialName: '碘克沙醇注射液', spec: '100ml', quantity: 80, date: '2026-04-10', operator: '李四', supplier: '拜耳医药', note: '季度采购' },
]

// 出库记录
const INITIAL_OUT_RECORDS = [
  { id: 'OUT001', materialId: 'M001', materialName: 'GE DR胶片', spec: '35cm×43cm(14"×17")', quantity: 50, date: '2026-05-01', department: 'CT室', applicant: '赵技师', useFor: 'CT检查' },
  { id: 'OUT002', materialId: 'M004', materialName: '碘佛醇注射液', spec: '100ml:35g(I)', quantity: 15, date: '2026-05-01', department: 'CT室', applicant: '钱技师', useFor: '冠脉CTA' },
  { id: 'OUT003', materialId: 'M005', materialName: '一次性注射器', spec: '20ml', quantity: 500, date: '2026-05-01', department: 'CT室', applicant: '孙技师', useFor: 'CT增强检查' },
  { id: 'OUT004', materialId: 'M003', materialName: '欧乃影造影剂', spec: '20ml/支', quantity: 30, date: '2026-04-30', department: 'MR室', applicant: '周技师', useFor: 'MR检查' },
  { id: 'OUT005', materialId: 'M001', materialName: 'GE DR胶片', spec: '35cm×43cm(14"×17")', quantity: 80, date: '2026-04-29', department: 'DR室', applicant: '吴技师', useFor: '胸片检查' },
  { id: 'OUT006', materialId: 'M008', materialName: '钆特酸葡胺注射液', spec: '15ml', quantity: 12, date: '2026-04-25', department: 'MR室', applicant: '郑技师', useFor: 'MR增强检查' },
]

// 采购申请
const INITIAL_PURCHASE_REQUESTS = [
  { id: 'PR001', materialId: 'M008', materialName: '钆特酸葡胺注射液', spec: '15ml', quantity: 50, estimatedCost: 22500, applicant: '李主任', department: 'MR室', date: '2026-04-28', status: 'pending', reason: '库存不足，低于最小库存量' },
  { id: 'PR002', materialId: 'M010', materialName: '静脉留置针', spec: '22G', quantity: 200, estimatedCost: 3600, applicant: '张护士', department: 'CT室', date: '2026-04-27', status: 'approved', reason: '日常消耗补充' },
  { id: 'PR003', materialId: 'M007', materialName: '碘克沙醇注射液', spec: '100ml', quantity: 60, estimatedCost: 22800, applicant: '王主任', department: '导管室', date: '2026-04-26', status: 'pending', reason: '库存偏低，需补充' },
  { id: 'PR004', materialId: 'M002', materialName: '柯尼卡CR胶片', spec: '35cm×43cm(14"×17")', quantity: 300, estimatedCost: 3240, applicant: '刘技师', department: 'CR室', date: '2026-04-25', status: 'completed', reason: '胶片库存不足' },
]

// 采购历史
const INITIAL_PURCHASE_HISTORY = [
  { id: 'PH001', materialId: 'M001', materialName: 'GE DR胶片', spec: '35cm×43cm(14"×17")', quantity: 500, actualCost: 6250, supplier: 'GE医疗', orderDate: '2026-04-15', receiveDate: '2026-04-20', status: 'completed', purchaser: '张三' },
  { id: 'PH002', materialId: 'M004', materialName: '碘佛醇注射液', spec: '100ml:35g(I)', quantity: 100, actualCost: 22000, supplier: '恒瑞医药', orderDate: '2026-04-18', receiveDate: '2026-04-22', status: 'completed', purchaser: '李四' },
  { id: 'PH003', materialId: 'M005', materialName: '一次性注射器', spec: '20ml', quantity: 2000, actualCost: 3600, supplier: '山东威高', orderDate: '2026-04-20', receiveDate: '2026-04-25', status: 'completed', purchaser: '王五' },
  { id: 'PH004', materialId: 'M007', materialName: '碘克沙醇注射液', spec: '100ml', quantity: 80, actualCost: 30400, supplier: '拜耳医药', orderDate: '2026-04-05', receiveDate: '2026-04-10', status: 'completed', purchaser: '张三' },
]

// 消耗统计数据 - 按检查项目
const CONSUMPTION_BY_EXAM = [
  { name: 'CT平扫', film: 120, contrast: 0, syringe: 0, catheter: 0, total: 1440 },
  { name: 'CT增强', film: 150, contrast: 180, syringe: 150, catheter: 30, total: 11910 },
  { name: 'MR平扫', film: 60, contrast: 0, syringe: 0, catheter: 0, total: 720 },
  { name: 'MR增强', film: 80, contrast: 120, syringe: 80, catheter: 20, total: 15880 },
  { name: 'DR胸片', film: 300, contrast: 0, syringe: 0, catheter: 0, total: 3600 },
  { name: 'DSA介入', film: 40, contrast: 200, syringe: 60, catheter: 100, total: 35680 },
]

// 月度消耗报表数据
const MONTHLY_CONSUMPTION = [
  { month: '2026-01', film: 3200, contrast: 850, syringe: 4200, catheter: 680, totalCost: 186500 },
  { month: '2026-02', film: 2800, contrast: 720, syringe: 3800, catheter: 590, totalCost: 165200 },
  { month: '2026-03', film: 3500, contrast: 920, syringe: 4500, catheter: 750, totalCost: 210800 },
  { month: '2026-04', film: 3800, contrast: 1050, syringe: 4800, catheter: 820, totalCost: 234500 },
]

// ============================================================
// Phase 4a 新增模拟数据
// ============================================================

// 有效期跟踪数据
const INITIAL_EXPIRY_ITEMS = [
  { id: 'E001', materialId: 'M003', materialName: '欧乃影造影剂', spec: '20ml/支', batchNo: 'B20251001', quantity: 40, manufactureDate: '2025-10-01', expiryDate: '2026-07-01', daysToExpiry: 16, supplier: 'GE医疗' },
  { id: 'E002', materialId: 'M007', materialName: '碘克沙醇注射液', spec: '100ml', batchNo: 'B20250915', quantity: 20, manufactureDate: '2025-09-15', expiryDate: '2026-06-15', daysToExpiry: 0, supplier: '拜耳医药' },
  { id: 'E003', materialId: 'M008', materialName: '钆特酸葡胺注射液', spec: '15ml', batchNo: 'B20251120', quantity: 15, manufactureDate: '2025-11-20', expiryDate: '2026-07-20', daysToExpiry: 35, supplier: 'GE医疗' },
  { id: 'E004', materialId: 'M004', materialName: '碘佛醇注射液', spec: '100ml:35g(I)', batchNo: 'B20251005', quantity: 30, manufactureDate: '2025-10-05', expiryDate: '2026-06-05', daysToExpiry: -10, supplier: '恒瑞医药' },
  { id: 'E005', materialId: 'M011', materialName: 'CT高压注射器针筒', spec: '200ml双筒', batchNo: 'B20251201', quantity: 10, manufactureDate: '2025-12-01', expiryDate: '2026-08-01', daysToExpiry: 47, supplier: '拜耳医药' },
]

// ABC分类数据
const INITIAL_ABC_CLASSIFICATION = [
  { id: 'M001', name: 'GE DR胶片', category: '胶片', stock: 450, unitPrice: 12.5, stockValue: 5625, annualUsageValue: 182500, class: 'B' as const },
  { id: 'M002', name: '柯尼卡CR胶片', category: '胶片', stock: 380, unitPrice: 10.8, stockValue: 4104, annualUsageValue: 142000, class: 'B' as const },
  { id: 'M003', name: '欧乃影造影剂', category: '造影剂', stock: 120, unitPrice: 85.0, stockValue: 10200, annualUsageValue: 340000, class: 'A' as const },
  { id: 'M004', name: '碘佛醇注射液', category: '造影剂', stock: 85, unitPrice: 220.0, stockValue: 18700, annualUsageValue: 620000, class: 'A' as const },
  { id: 'M005', name: '一次性注射器', category: '注射器', stock: 1500, unitPrice: 1.8, stockValue: 2700, annualUsageValue: 86000, class: 'C' as const },
  { id: 'M006', name: '一次性注射器', category: '注射器', stock: 320, unitPrice: 3.2, stockValue: 1024, annualUsageValue: 42000, class: 'C' as const },
  { id: 'M007', name: '碘克沙醇注射液', category: '对比剂', stock: 45, unitPrice: 380.0, stockValue: 17100, annualUsageValue: 580000, class: 'A' as const },
  { id: 'M008', name: '钆特酸葡胺注射液', category: '对比剂', stock: 28, unitPrice: 450.0, stockValue: 12600, annualUsageValue: 480000, class: 'A' as const },
  { id: 'M009', name: '一次性使用输液器', category: '导管', stock: 180, unitPrice: 4.5, stockValue: 810, annualUsageValue: 32000, class: 'C' as const },
  { id: 'M010', name: '静脉留置针', category: '导管', stock: 95, unitPrice: 18.0, stockValue: 1710, annualUsageValue: 68000, class: 'C' as const },
  { id: 'M011', name: 'CT高压注射器针筒', category: '针筒', stock: 65, unitPrice: 120.0, stockValue: 7800, annualUsageValue: 260000, class: 'B' as const },
  { id: 'M012', name: 'MR高压注射器针筒', category: '针筒', stock: 42, unitPrice: 95.0, stockValue: 3990, annualUsageValue: 160000, class: 'B' as const },
]

// 供应商评分卡数据
const INITIAL_SUPPLIER_SCORES = [
  { id: 'S001', name: 'GE医疗', quality: 92, delivery: 88, price: 78, service: 85, overall: 86, contracts: 5, spend: 1250000 },
  { id: 'S002', name: '柯尼卡美能达', quality: 85, delivery: 82, price: 75, service: 70, overall: 78, contracts: 2, spend: 350000 },
  { id: 'S003', name: '恒瑞医药', quality: 90, delivery: 85, price: 80, service: 82, overall: 84, contracts: 3, spend: 880000 },
  { id: 'S004', name: '山东威高', quality: 82, delivery: 90, price: 85, service: 78, overall: 84, contracts: 4, spend: 620000 },
  { id: 'S005', name: '拜耳医药', quality: 95, delivery: 92, price: 72, service: 90, overall: 87, contracts: 3, spend: 1600000 },
  { id: 'S006', name: '贝朗医疗', quality: 88, delivery: 80, price: 82, service: 75, overall: 81, contracts: 2, spend: 420000 },
  { id: 'S007', name: 'BD医疗', quality: 93, delivery: 88, price: 76, service: 85, overall: 86, contracts: 3, spend: 750000 },
]

// 库存估值数据 (FIFO & 加权平均)
const INITIAL_VALUATION_DATA = {
  fifo: { totalValue: 89650, batches: [
    { date: '2026-01', inValue: 42500, outValue: 38200, balance: 4300 },
    { date: '2026-02', inValue: 51200, outValue: 46500, balance: 9000 },
    { date: '2026-03', inValue: 48300, outValue: 50100, balance: 7200 },
    { date: '2026-04', inValue: 55600, outValue: 47800, balance: 15000 },
  ]},
  weightedAvg: { avgCost: 78.5, totalValue: 84200 },
  valuationTrend: [
    { month: '2026-01', fifo: 86200, weighted: 81800, market: 89000 },
    { month: '2026-02', fifo: 87800, weighted: 83200, market: 90500 },
    { month: '2026-03', fifo: 85100, weighted: 80900, market: 87800 },
    { month: '2026-04', fifo: 89650, weighted: 84200, market: 92500 },
  ]
}

// 采购订单工作流数据
const INITIAL_PURCHASE_ORDERS = [
  { id: 'PO-001', items: [{ materialId: 'M008', name: '钆特酸葡胺注射液', quantity: 50, unitPrice: 450 }], totalAmount: 22500, applicant: '李主任', dept: 'MR室', submitDate: '2026-04-28', status: 'pending' as const, approver: '', approveDate: '', receiver: '', receiveDate: '' },
  { id: 'PO-002', items: [{ materialId: 'M010', name: '静脉留置针', quantity: 200, unitPrice: 18 }, { materialId: 'M005', name: '一次性注射器', quantity: 500, unitPrice: 1.8 }], totalAmount: 4500, applicant: '张护士', dept: 'CT室', submitDate: '2026-04-27', status: 'approved' as const, approver: '王主任', approveDate: '2026-04-28', receiver: '', receiveDate: '' },
  { id: 'PO-003', items: [{ materialId: 'M007', name: '碘克沙醇注射液', quantity: 60, unitPrice: 380 }], totalAmount: 22800, applicant: '王主任', dept: '导管室', submitDate: '2026-04-26', status: 'received' as const, approver: '赵院长', approveDate: '2026-04-27', receiver: '刘仓管', receiveDate: '2026-04-29' },
]

// ============================================================
// 辅助函数
// ============================================================

// 获取库存状态
const getStockStatus = (stock: number, minStock: number, category: string): { status: string; color: string; label: string } => {
  const threshold = ALERT_THRESHOLDS[category] || minStock
  if (stock === 0) return { status: STOCK_STATUS.OUT, color: C.danger, label: '缺货' }
  if (stock <= threshold * 0.5) return { status: STOCK_STATUS.LOW, color: C.warning, label: '库存紧张' }
  return { status: STOCK_STATUS.NORMAL, color: C.success, label: '正常' }
}

// 格式化金额
const formatCurrency = (amount: number): string => {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ============================================================
// 子组件
// ============================================================

// Tab标签组件
interface TabItem {
  key: string
  label: string
  icon: React.ReactNode
}

const TabNav = ({ tabs, activeTab, onTabChange }: { tabs: TabItem[]; activeTab: string; onTabChange: (key: string) => void }) => (
  <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.white, padding: '0 16px' }}>
    {tabs.map(tab => (
      <button
        key={tab.key}
        onClick={() => onTabChange(tab.key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          borderBottom: activeTab === tab.key ? `2px solid ${C.primary}` : '2px solid transparent',
          color: activeTab === tab.key ? C.primary : C.textMid,
          fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400, transition: 'all 0.2s'
        }}
      >
        {tab.icon} {tab.label}
      </button>
    ))}
  </div>
)

// 统计卡片组件
const StatCard = ({ title, value, subValue, icon, color }: {
  title: string; value: string; subValue?: string; icon: React.ReactNode; color: string
}) => (
  <div style={{
    background: C.white, borderRadius: 8, padding: 20, display: 'flex', alignItems: 'center',
    gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`
  }}>
    <div style={{ width: 48, height: 48, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{value}</div>
      {subValue && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{subValue}</div>}
    </div>
  </div>
)

// 库存预警列表组件
const LowStockAlert = ({ materials }: { materials: typeof INITIAL_MATERIALS }) => {
  const lowStockItems = materials.filter(m => {
    const threshold = ALERT_THRESHOLDS[m.category] || m.minStock
    return m.stock <= threshold
  })

  if (lowStockItems.length === 0) {
    return (
      <div style={{ background: C.white, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color={C.success} /> 库存预警
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#f0fdf4', borderRadius: 6 }}>
          <CheckCircle size={18} color={C.success} />
          <span style={{ color: C.success, fontSize: 13 }}>所有物资库存充足</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: C.white, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={16} color={C.warning} /> 库存预警 ({lowStockItems.length}项)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lowStockItems.map(item => {
          const threshold = ALERT_THRESHOLDS[item.category] || item.minStock
          const stockRate = item.stock / threshold
          return (
            <div key={item.id} style={{ padding: 10, background: stockRate === 0 ? '#fef2f2' : '#fffbeb', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{item.name}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>{item.spec} · 当前库存{item.stock}{item.unit}</div>
              </div>
              <div style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                background: stockRate === 0 ? C.danger : C.warning, color: C.white
              }}>
                {stockRate === 0 ? '缺货' : '库存紧张'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 设备扫描快速查询结果
const ScanResultPopup = ({ material, onClose }: { material: typeof INITIAL_MATERIALS[0] | null; onClose: () => void }) => {
  if (!material) return null
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{material.name}</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textLight }}><X size={16} /></button>
      </div>
      <div style={{ fontSize: 12, color: C.textMid, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>规格: {material.spec}</div>
        <div>库存: <strong style={{ color: material.stock <= material.minStock ? C.danger : C.success }}>{material.stock} {material.unit}</strong></div>
        <div>单价: {formatCurrency(material.price)}</div>
        <div>供应商: {material.supplier}</div>
      </div>
    </div>
  )
}

// 有效期警告组件
const ExpiryAlertSection = ({ items, onNotify }: { items: typeof INITIAL_EXPIRY_ITEMS; onNotify?: () => void }) => {
  const expired = items.filter(i => i.daysToExpiry < 0)
  const within7 = items.filter(i => i.daysToExpiry >= 0 && i.daysToExpiry <= 7)
  const within30 = items.filter(i => i.daysToExpiry > 7 && i.daysToExpiry <= 30)

  const renderGroup = (label: string, list: typeof INITIAL_EXPIRY_ITEMS, bg: string, border: string, dot: string) => {
    if (list.length === 0) return null
    return (
      <div style={{ background: bg, borderRadius: 6, padding: 12, border: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: dot, fontWeight: 600, fontSize: 13 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
          {label} ({list.length}项)
        </div>
        {list.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${border}40`, fontSize: 12 }}>
            <div>
              <span style={{ color: C.textDark, fontWeight: 500 }}>{item.materialName}</span>
              <span style={{ color: C.textLight, marginLeft: 8 }}>{item.batchNo}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.textMid }}>剩余{item.quantity}{INITIAL_MATERIALS.find(m => m.id === item.materialId)?.unit || '件'}</span>
              <span style={{ color: dot, fontWeight: 600, fontSize: 12 }}>
                {item.daysToExpiry < 0 ? `已过期${Math.abs(item.daysToExpiry)}天` : `还有${item.daysToExpiry}天`}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (expired.length === 0 && within7.length === 0 && within30.length === 0) {
    return (
      <div style={{ background: C.white, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Timer size={16} color={C.success} /> 有效期监控
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#f0fdf4', borderRadius: 6 }}>
          <CheckCircle size={18} color={C.success} />
          <span style={{ color: C.success, fontSize: 13 }}>无临近过期物资</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: C.white, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Timer size={16} color={C.warning} /> 有效期监控 ({items.length}项需关注)
        </div>
        <button onClick={() => onNotify?.()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: C.primary, color: C.white, border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
          <Bell size={14} /> 发送通知
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {renderGroup('已过期', expired, '#fef2f2', '#fecaca', C.danger)}
        {renderGroup('7天内过期', within7, '#fff7ed', '#fed7aa', C.warning)}
        {renderGroup('30天内过期', within30, '#fefce8', '#fef08a', '#ca8a04')}
      </div>
    </div>
  )
}

// ABC分类标签
const ABCTag = ({ class: cls }: { class: 'A' | 'B' | 'C' }) => {
  const colors = { A: { bg: '#fef2f2', color: C.danger }, B: { bg: '#fefce8', color: '#ca8a04' }, C: { bg: '#f0fdf4', color: C.success } }
  const labels = { A: 'A类-高价值', B: 'B类-中价值', C: 'C类-低价值' }
  const c = colors[cls]
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{labels[cls]}</span>
}

// 采购订单工作流状态机
const OrderStatusBadge = ({ status }: { status: 'pending' | 'approved' | 'received' }) => {
  const config = {
    pending: { bg: `${C.warning}15`, color: C.warning, label: '待审批' },
    approved: { bg: `${C.primary}15`, color: C.primary, label: '已批准-待收货' },
    received: { bg: `${C.success}15`, color: C.success, label: '已收货' },
  }
  const c = config[status]
  return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{c.label}</span>
}

// ============================================================
// 主组件
// ============================================================
export default function MaterialsPage() {
  // 当前选中tab
  const [activeTab, setActiveTab] = useState('inventory')

  // 搜索和筛选
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  // 物资库存数据
  const [materials, setMaterials] = useState(INITIAL_MATERIALS)

  // Toast提示
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({ show: false, type: 'success', message: '' })
  useEffect(() => { if (toast.show) { const t = setTimeout(() => setToast(v => ({ ...v, show: false })), 3000); return () => clearTimeout(t) } }, [toast.show])

  // 导出弹窗
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType] = useState('')

  // 库存不足警告弹窗
  const [showLowStockModal, setShowLowStockModal] = useState(false)

  // 入库弹窗
  const [showInModal, setShowInModal] = useState(false)
  const [inForm, setInForm] = useState({ materialId: '', quantity: '', date: new Date().toISOString().split('T')[0], operator: '', supplier: '', note: '' })

  // 出库弹窗
  const [showOutModal, setShowOutModal] = useState(false)
  const [outForm, setOutForm] = useState({ materialId: '', quantity: '', date: new Date().toISOString().split('T')[0], department: '', applicant: '', useFor: '' })

  // 采购申请弹窗
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({ materialId: '', quantity: '', estimatedCost: '', applicant: '', department: '', reason: '' })

  // 采购审批弹窗
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<typeof INITIAL_PURCHASE_REQUESTS[0] | null>(null)
  const [approveConfirm, setApproveConfirm] = useState(false)

  // 详情/编辑弹窗
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailType, setDetailType] = useState('')
  const [detailData, setDetailData] = useState<any>(null)

  // 库存明细弹窗
  const [materialDetail, setMaterialDetail] = useState<any>(null)

  // Phase 4a 新状态
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<typeof INITIAL_MATERIALS[0] | null>(null)
  const [showScanResult, setShowScanResult] = useState(false)
  const [abcFilter, setAbcFilter] = useState<string>('全部')
  const [expiryItems] = useState(INITIAL_EXPIRY_ITEMS)
  const [supplierScores] = useState(INITIAL_SUPPLIER_SCORES)
  const [valuationData] = useState(INITIAL_VALUATION_DATA)
  const [purchaseOrders, setPurchaseOrders] = useState(INITIAL_PURCHASE_ORDERS)
  const [showPOModal, setShowPOModal] = useState(false)
  const [poForm, setPoForm] = useState<{ items: { materialId: string; name: string; quantity: string; unitPrice: string }[]; applicant: string; dept: string }>({ items: [], applicant: '', dept: '' })
  const [scorecardTab, setScorecardTab] = useState<'table' | 'chart'>('table')

  // 刷新数据
  const handleRefresh = () => {
    setMaterials(INITIAL_MATERIALS)
    setToast({ show: true, type: 'success', message: '数据已刷新' })
  }

  // 扫码处理
  const handleScan = (value: string) => {
    const trimmed = value.trim().toUpperCase()
    const lookup = (id: string) => materials.find(m => m.id.toUpperCase() === id || m.name.toUpperCase().includes(id))
    const found = lookup(trimmed) || lookup(trimmed.replace('MAT-', 'M'))
    if (found) {
      setScanResult(found)
      setShowScanResult(true)
      setToast({ show: true, type: 'success', message: `扫码识别: ${found.name}` })
    } else {
      setScanResult(null)
      setShowScanResult(false)
      setToast({ show: true, type: 'error', message: `未识别: ${trimmed}` })
    }
    setScanInput('')
  }

  // 打开详情弹窗
  const handleOpenDetail = (type: string, data: any) => {
    setDetailType(type)
    setDetailData(data)
    setShowDetailModal(true)
  }

  // 导出功能
  const handleExport = (type: string) => {
    setExportType(type)
    setShowExportModal(true)
  }

  // Tab配置
  const tabs: TabItem[] = [
    { key: 'inventory', label: '物资库存', icon: <Package size={16} /> },
    { key: 'purchase', label: '采购管理', icon: <ClipboardList size={16} /> },
    { key: 'consumption', label: '消耗统计', icon: <BarChart2 size={16} /> },
    { key: 'supplier', label: '供应商', icon: <Truck size={16} /> },
    { key: 'valuation', label: '库存估值', icon: <DollarSign size={16} /> },
    { key: 'scorecard', label: '供应商评分', icon: <Award size={16} /> },
  ]

  // 筛选后的物资
  const filteredMaterials = materials.filter(m => {
    const matchKeyword = m.name.includes(searchKeyword) || m.spec.includes(searchKeyword) || m.supplier.includes(searchKeyword)
    const matchCategory = selectedCategory === '全部' || m.category === selectedCategory
    const threshold = ALERT_THRESHOLDS[m.category] || m.minStock
    const matchLowStock = !showLowStockOnly || m.stock <= threshold
    const abc = INITIAL_ABC_CLASSIFICATION.find(a => a.id === m.id)
    const matchABC = abcFilter === '全部' || (abc?.class === abcFilter)
    return matchKeyword && matchCategory && matchLowStock && matchABC
  })

  // 入库处理
  const handleInSubmit = () => {
    if (!inForm.materialId || !inForm.quantity) return
    const material = materials.find(m => m.id === inForm.materialId)
    if (material) {
      setMaterials(prev => prev.map(m =>
        m.id === inForm.materialId ? { ...m, stock: m.stock + parseInt(inForm.quantity), lastIn: inForm.date } : m
      ))
    }
    setShowInModal(false)
    setInForm({ materialId: '', quantity: '', date: new Date().toISOString().split('T')[0], operator: '', supplier: '', note: '' })
  }

  // 出库处理
  const handleOutSubmit = () => {
    if (!outForm.materialId || !outForm.quantity) return
    const material = materials.find(m => m.id === outForm.materialId)
    if (material) {
      const qty = parseInt(outForm.quantity)
      if (qty > material.stock) {
        setShowLowStockModal(true)
        return
      }
      setMaterials(prev => prev.map(m =>
        m.id === outForm.materialId ? { ...m, stock: m.stock - qty, lastOut: outForm.date } : m
      ))
    }
    setShowOutModal(false)
    setOutForm({ materialId: '', quantity: '', date: new Date().toISOString().split('T')[0], department: '', applicant: '', useFor: '' })
  }

  // 采购申请提交
  const handlePurchaseSubmit = () => {
    if (!purchaseForm.materialId || !purchaseForm.quantity) return
    setShowPurchaseModal(false)
    setPurchaseForm({ materialId: '', quantity: '', estimatedCost: '', applicant: '', department: '', reason: '' })
  }

  // 审批通过
  const handleApprove = (purchase: typeof INITIAL_PURCHASE_REQUESTS[0]) => {
    setSelectedPurchase(purchase)
    setShowApproveModal(true)
  }

  // 统计汇总
  const totalMaterials = materials.length
  const totalValue = materials.reduce((sum, m) => sum + m.stock * m.price, 0)
  const lowStockCount = materials.filter(m => {
    const threshold = ALERT_THRESHOLDS[m.category] || m.minStock
    return m.stock <= threshold
  }).length
  const outOfStockCount = materials.filter(m => m.stock === 0).length

  // ============================================================
  // 渲染各Tab内容
  // ============================================================

  // 物资库存Tab
  const renderInventoryTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textLight }} />
            <input
              type="text"
              placeholder="搜索物资名称、规格、供应商..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{ width: 280, padding: '8px 12px 8px 34px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
            />
          </div>
          {/* 分类筛选 */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            {MATERIAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          {/* ABC分类筛选 */}
          <select
            value={abcFilter}
            onChange={e => setAbcFilter(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="全部">ABC分类(全部)</option>
            <option value="A">A类-高价值</option>
            <option value="B">B类-中价值</option>
            <option value="C">C类-低价值</option>
          </select>
          {/* 仅显示预警 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={e => setShowLowStockOnly(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            仅显示预警
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowInModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            <PackageCheck size={16} /> 入库
          </button>
          <button
            onClick={() => setShowOutModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.accent, color: C.white, border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            <PackageX size={16} /> 出库
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard title="物资种类" value={totalMaterials.toString()} subValue="种分类物资" icon={<Package size={24} />} color={C.primary} />
        <StatCard title="库存总值" value={formatCurrency(totalValue)} subValue="当前库存总价值" icon={<DollarSign size={24} />} color={C.accent} />
        <StatCard title="库存预警" value={lowStockCount.toString()} subValue="项需要关注" icon={<AlertTriangle size={24} />} color={C.warning} />
        <StatCard title="缺货物资" value={outOfStockCount.toString()} subValue="项已缺货" icon={<XCircle size={24} />} color={C.danger} />
      </div>

      {/* 库存预警 */}
      <LowStockAlert materials={materials} />

      {/* 有效期监控 */}
      <ExpiryAlertSection items={expiryItems} onNotify={() => setToast({ show: true, type: 'info', message: '已发送过期通知至相关部门' })} />

      {/* 库存列表 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark }}>
          物资库存列表 ({filteredMaterials.length}项)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>物资名称</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>分类</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>规格</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>库存量</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>单价</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>供应商</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>ABC</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>状态</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((m, idx) => {
              const stockStatus = getStockStatus(m.stock, m.minStock, m.category)
              return (
                <tr key={m.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>
                    <span style={{ padding: '2px 8px', background: C.primaryLighter, color: C.primary, borderRadius: 4 }}>{m.category}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{m.spec}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: stockStatus.color, fontWeight: 600 }}>
                    {m.stock} {m.unit}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textDark }}>{formatCurrency(m.price)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{m.supplier}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <ABCTag class={(INITIAL_ABC_CLASSIFICATION.find(a => a.id === m.id)?.class || 'C') as 'A' | 'B' | 'C'} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                      background: `${stockStatus.color}15`, color: stockStatus.color
                    }}>
                      {stockStatus.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => setMaterialDetail(m)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid, marginRight: 4 }}>
                      <Filter size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> 明细
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 入库记录和出库记录 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 入库记录 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PackageCheck size={16} color={C.success} /> 最近入库记录
            </div>
            <button onClick={() => setActiveTab('purchase')} style={{ fontSize: 12, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer' }}>查看全部</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {INITIAL_IN_RECORDS.slice(0, 5).map(record => (
              <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: C.bg, borderRadius: 6, fontSize: 12 }}>
                <div>
                  <div style={{ color: C.textDark, fontWeight: 500 }}>{record.materialName}</div>
                  <div style={{ color: C.textLight }}>{record.date} · {record.operator}</div>
                </div>
                <div style={{ color: C.success, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  +{record.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 出库记录 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PackageX size={16} color={C.danger} /> 最近出库记录
            </div>
            <button onClick={() => setActiveTab('consumption')} style={{ fontSize: 12, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer' }}>查看全部</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {INITIAL_OUT_RECORDS.slice(0, 5).map(record => (
              <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: C.bg, borderRadius: 6, fontSize: 12 }}>
                <div>
                  <div style={{ color: C.textDark, fontWeight: 500 }}>{record.materialName}</div>
                  <div style={{ color: C.textLight }}>{record.date} · {record.department}</div>
                </div>
                <div style={{ color: C.danger, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  -{record.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // 采购管理Tab
  const renderPurchaseTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: C.textMid }}>
          <span style={{ marginRight: 16 }}>待审批: <strong style={{ color: C.warning }}>{INITIAL_PURCHASE_REQUESTS.filter(p => p.status === 'pending').length}</strong> 项</span>
          <span style={{ marginRight: 16 }}>已通过: <strong style={{ color: C.success }}>{INITIAL_PURCHASE_REQUESTS.filter(p => p.status === 'approved').length}</strong> 项</span>
          <span>已完成: <strong style={{ color: C.info }}>{INITIAL_PURCHASE_REQUESTS.filter(p => p.status === 'completed').length}</strong> 项</span>
        </div>
        <button
          onClick={() => setShowPurchaseModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        >
          <Plus size={16} /> 新增采购申请
        </button>
      </div>

      {/* 采购申请列表 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark }}>
          采购申请列表
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>申请单号</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>物资名称</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>数量</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>预估金额</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>申请部门</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>申请人</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>状态</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_PURCHASE_REQUESTS.map((pr, idx) => (
              <tr key={pr.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{pr.id}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{pr.materialName}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{pr.quantity}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.textDark }}>{formatCurrency(pr.estimatedCost)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{pr.department}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{pr.applicant}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                    background: pr.status === 'pending' ? `${C.warning}15` : pr.status === 'approved' ? `${C.info}15` : `${C.success}15`,
                    color: pr.status === 'pending' ? C.warning : pr.status === 'approved' ? C.info : C.success
                  }}>
                    {pr.status === 'pending' ? '待审批' : pr.status === 'approved' ? '已通过' : '已完成'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {pr.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(pr)}
                      style={{ padding: '4px 10px', border: `1px solid ${C.success}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.success, marginRight: 4 }}
                    >
                      审批
                    </button>
                  )}
                  <button onClick={() => handleOpenDetail('purchase', pr)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid }}>
                    查看
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 采购历史 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={16} color={C.primary} /> 采购历史
          </div>
          <button onClick={() => handleExport('采购历史')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Download size={14} /> 导出
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: C.textMid }}>订单号</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: C.textMid }}>物资名称</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>数量</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textMid }}>实际金额</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: C.textMid }}>供应商</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>下单日期</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>到货日期</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>采购员</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_PURCHASE_HISTORY.map((ph, idx) => (
              <tr key={ph.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '8px 10px', fontSize: 12, color: C.textMid }}>{ph.id}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, color: C.textDark }}>{ph.materialName}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{ph.quantity}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textDark }}>{formatCurrency(ph.actualCost)}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, color: C.textMid }}>{ph.supplier}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{ph.orderDate}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{ph.receiveDate}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{ph.purchaser}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 采购订单工作流 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingCart size={16} color={C.primary} /> 采购订单工作流
          </div>
          <button
            onClick={() => setShowPOModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: C.primary, color: C.white, border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
          >
            <Plus size={14} /> 新建订单
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>订单号</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>物资明细</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>金额</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>申请人</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>状态</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po, idx) => (
              <tr key={po.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{po.id}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textDark }}>
                  {po.items.map(item => (
                    <div key={item.materialId}>{item.name} × {item.quantity}</div>
                  ))}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: C.textDark, fontWeight: 600 }}>{formatCurrency(po.totalAmount)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid }}>{po.applicant}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><OrderStatusBadge status={po.status} /></td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {po.status === 'pending' && (
                    <button onClick={() => { setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'approved' as const, approver: '王主任', approveDate: new Date().toISOString().split('T')[0] } : p)); setToast({ show: true, type: 'success', message: '订单已批准' }) }}
                      style={{ padding: '4px 10px', border: `1px solid ${C.success}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.success, marginRight: 4 }}>批准</button>
                  )}
                  {po.status === 'approved' && (
                    <button onClick={() => { setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'received' as const, receiver: '刘仓管', receiveDate: new Date().toISOString().split('T')[0] } : p)); setToast({ show: true, type: 'success', message: '订单已收货' }) }}
                      style={{ padding: '4px 10px', border: `1px solid ${C.primary}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.primary }}>收货</button>
                  )}
                  {po.status === 'received' && <CheckCircle size={16} color={C.success} style={{ verticalAlign: 'middle' }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // 消耗统计Tab
  const renderConsumptionTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 统计概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard
          title="本月胶片消耗"
          value="3800张"
          subValue="较上月 +8.6%"
          icon={<Package size={24} />}
          color={C.primary}
        />
        <StatCard
          title="本月造影剂消耗"
          value="1050支"
          subValue="较上月 +14.1%"
          icon={<Droplet size={24} />}
          color={C.accent}
        />
        <StatCard
          title="本月采购支出"
          value="¥234,500"
          subValue="较上月 +11.3%"
          icon={<DollarSign size={24} />}
          color={C.success}
        />
        <StatCard
          title="累计物资种类"
          value="156种"
          subValue="在用供应商7家"
          icon={<Boxes size={24} />}
          color={C.warning}
        />
      </div>

      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 检查项目消耗量 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 16 }}>各检查项目物资消耗量</div>
          <ResponsiveContainer width="100%" height={250}>
            <ChartBar data={CONSUMPTION_BY_EXAM}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMid }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMid }} />
              <Tooltip
                contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                formatter={(value: number) => [value, '']}
              />
              <Bar dataKey="film" name="胶片" fill={C.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="contrast" name="造影剂" fill={C.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="syringe" name="注射器" fill={C.success} radius={[4, 4, 0, 0]} />
            </ChartBar>
          </ResponsiveContainer>
        </div>

        {/* 月度消耗趋势 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 16 }}>月度物资消耗费用趋势</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={MONTHLY_CONSUMPTION}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMid }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMid }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                formatter={(value: number) => [formatCurrency(value), '']}
              />
              <Area type="monotone" dataKey="totalCost" name="消耗费用" stroke={C.primary} fill={C.primaryLighter} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 消耗明细表格 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark }}>
          各检查项目消耗明细
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>检查项目</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>胶片(张)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>造影剂(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>注射器(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>导管(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>预估费用(元)</th>
            </tr>
          </thead>
          <tbody>
            {CONSUMPTION_BY_EXAM.map((item, idx) => (
              <tr key={item.name} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{item.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.film}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.contrast}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.syringe}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.catheter}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.primary, fontWeight: 600 }}>{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 月度消耗报表 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>月度消耗报表</span>
          <button onClick={() => handleExport('月度消耗报表')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Download size={14} /> 导出报表
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>月份</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>胶片(张)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>造影剂(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>注射器(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>导管(支)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>总费用(元)</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_CONSUMPTION.map((item, idx) => (
              <tr key={item.month} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{item.month}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.film}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.contrast}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.syringe}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: C.textMid }}>{item.catheter}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: C.primary, fontWeight: 600 }}>{formatCurrency(item.totalCost)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <button onClick={() => handleOpenDetail('consumption', item)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid }}>
                    查看明细
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // 供应商Tab
  const renderSupplierTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 供应商统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard title="供应商总数" value={INITIAL_SUPPLIERS.length.toString()} subValue="家合作供应商" icon={<Truck size={24} />} color={C.primary} />
        <StatCard title="本月采购额" value="¥234,500" subValue="来自采购统计" icon={<DollarSign size={24} />} color={C.accent} />
        <StatCard title="平均响应时间" value="24h" subValue="供应商平均交期" icon={<Clock size={24} />} color={C.success} />
        <StatCard title="质量评分" value="4.7" subValue="综合平均评分" icon={<CheckCircle size={24} />} color={C.warning} />
      </div>

      {/* 供应商列表 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark }}>
          供应商列表
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>供应商名称</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>联系人</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>联系电话</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>主营分类</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>评分</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_SUPPLIERS.map((supplier, idx) => (
              <tr key={supplier.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{supplier.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{supplier.contact}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>{supplier.phone}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textMid }}>
                  {supplier.categories.map((cat, i) => (
                    <span key={i} style={{ marginRight: 4 }}>
                      <span style={{ padding: '2px 6px', background: C.primaryLighter, color: C.primary, borderRadius: 3, fontSize: 12 }}>{cat}</span>
                    </span>
                  ))}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ color: C.warning, fontWeight: 600 }}>{supplier.rating}</span>
                  <span style={{ color: C.textLight, fontSize: 12 }}> / 5.0</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <button onClick={() => handleOpenDetail('supplier-edit', supplier)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid, marginRight: 4 }}>
                    编辑
                  </button>
                  <button onClick={() => handleOpenDetail('supplier-detail', supplier)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid }}>
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // 库存估值Tab
  const renderValuationTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard title="FIFO估值" value={formatCurrency(valuationData.fifo.totalValue)} subValue="先进先出法" icon={<DollarSign size={24} />} color={C.primary} />
        <StatCard title="加权平均估值" value={formatCurrency(valuationData.weightedAvg.totalValue)} subValue={`平均成本 ¥${valuationData.weightedAvg.avgCost}`} icon={<Wallet size={24} />} color={C.accent} />
        <StatCard title="差异" value={formatCurrency(valuationData.fifo.totalValue - valuationData.weightedAvg.totalValue)} subValue="FIFO - 加权平均" icon={<TrendingUp size={24} />} color={C.warning} />
        <StatCard title="库存总数量" value={materials.reduce((s, m) => s + m.stock, 0).toString()} subValue="所有物资合计" icon={<Package size={24} />} color={C.success} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* FIFO批次明细 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>FIFO月度批次流动</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>月份</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>入库金额</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>出库金额</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.textMid, fontWeight: 500 }}>余额</th>
              </tr>
            </thead>
            <tbody>
              {valuationData.fifo.batches.map((b, idx) => (
                <tr key={b.date} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: C.textDark }}>{b.date}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.success }}>{formatCurrency(b.inValue)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.danger }}>{formatCurrency(b.outValue)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: C.primary, fontWeight: 600 }}>{formatCurrency(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 估值趋势 */}
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 16 }}>估值方法对比趋势</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={valuationData.valuationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMid }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMid }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), '']} />
              <Legend />
              <Line type="monotone" dataKey="fifo" name="FIFO" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="weighted" name="加权平均" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="market" name="市场价值" stroke={C.warning} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ABC分类分布 */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>ABC分类价值分布</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {(['A', 'B', 'C'] as const).map(cls => {
            const items = INITIAL_ABC_CLASSIFICATION.filter(a => a.class === cls)
            const totalValue = items.reduce((s, i) => s + i.stockValue, 0)
            const colors = { A: { bg: '#fef2f2', text: C.danger }, B: { bg: '#fefce8', text: '#ca8a04' }, C: { bg: '#f0fdf4', text: C.success } }
            const c = colors[cls]
            return (
              <div key={cls} style={{ background: c.bg, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 8 }}>
                  {cls === 'A' ? 'A类 - 高价值 (70%成本)' : cls === 'B' ? 'B类 - 中价值 (20%成本)' : 'C类 - 低价值 (10%成本)'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.text }}>{formatCurrency(totalValue)}</div>
                <div style={{ fontSize: 12, color: c.text, marginTop: 4 }}>{items.length}种物资 · 占总量{((totalValue / INITIAL_ABC_CLASSIFICATION.reduce((s, i) => s + i.stockValue, 0)) * 100).toFixed(0)}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // 供应商评分卡Tab
  const renderScorecardTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: C.textMid }}>
          综合评分排名 · 基于质量/交付/价格/服务四项指标
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['table', 'chart'] as const).map(t => (
            <button key={t} onClick={() => setScorecardTab(t)}
              style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: scorecardTab === t ? C.primary : C.white, color: scorecardTab === t ? C.white : C.textMid }}>
              {t === 'table' ? '表格视图' : '图表视图'}
            </button>
          ))}
        </div>
      </div>

      {scorecardTab === 'chart' && (
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 16 }}>供应商评分对比</div>
          <ResponsiveContainer width="100%" height={320}>
            <ChartBar data={supplierScores.map(s => ({ name: s.name, 质量: s.quality, 交付: s.delivery, 价格: s.price, 服务: s.service }))} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMid }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: C.textMid }} />
              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
              <Legend />
              <Bar dataKey="质量" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="交付" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="价格" fill="#d97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="服务" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </ChartBar>
          </ResponsiveContainer>
        </div>
      )}

      {scorecardTab === 'table' && (
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.textDark }}>
            供应商评分明细
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: C.textMid, fontWeight: 500 }}>供应商</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>质量</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>交付</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>价格</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>服务</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>综合评分</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: C.textMid, fontWeight: 500 }}>年采购额</th>
              </tr>
            </thead>
            <tbody>
              {supplierScores.sort((a, b) => b.overall - a.overall).map((s, idx) => (
                <tr key={s.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: C.textDark, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <div style={{ width: 50, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${s.quality}%`, height: '100%', background: s.quality >= 90 ? C.success : s.quality >= 80 ? C.warning : C.danger, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textDark }}>{s.quality}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <div style={{ width: 50, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${s.delivery}%`, height: '100%', background: s.delivery >= 90 ? C.success : s.delivery >= 80 ? C.warning : C.danger, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textDark }}>{s.delivery}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <div style={{ width: 50, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${s.price}%`, height: '100%', background: s.price >= 90 ? C.success : s.price >= 80 ? C.warning : C.danger, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textDark }}>{s.price}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <div style={{ width: 50, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${s.service}%`, height: '100%', background: s.service >= 90 ? C.success : s.service >= 80 ? C.warning : C.danger, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textDark }}>{s.service}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                      background: s.overall >= 85 ? '#f0fdf4' : s.overall >= 80 ? '#fffbeb' : '#fef2f2',
                      color: s.overall >= 85 ? C.success : s.overall >= 80 ? C.warning : C.danger
                    }}>
                      {s.overall}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: C.textDark }}>{formatCurrency(s.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 供应商排名榜 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>🏆 优质供应商 Top 3</div>
          {supplierScores.sort((a, b) => b.overall - a.overall).slice(0, 3).map((s, idx) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < 2 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e0e7ff' : '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{['🥇', '🥈', '🥉'][idx]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>合同数: {s.contracts} · 年采购额: {formatCurrency(s.spend)}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>{s.overall}</div>
            </div>
          ))}
        </div>
        <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>综合评分分布</div>
          <ResponsiveContainer width="100%" height={180}>
            <RePieChart>
              <Pie data={[
                { name: '优秀(≥85)', value: supplierScores.filter(s => s.overall >= 85).length, color: C.success },
                { name: '良好(80-84)', value: supplierScores.filter(s => s.overall >= 80 && s.overall < 85).length, color: C.warning },
                { name: '待改进(<80)', value: supplierScores.filter(s => s.overall < 80).length, color: C.danger },
              ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {[
                  { name: '优秀(≥85)', value: supplierScores.filter(s => s.overall >= 85).length, color: C.success },
                  { name: '良好(80-84)', value: supplierScores.filter(s => s.overall >= 80 && s.overall < 85).length, color: C.warning },
                  { name: '待改进(<80)', value: supplierScores.filter(s => s.overall < 80).length, color: C.danger },
                ].map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // 弹窗渲染
  // ============================================================
  
  // 入库弹窗
  const renderInModal = () => {
    if (!showInModal) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setShowInModal(false)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 480 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>物资入库</div>
            <button onClick={() => setShowInModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>选择物资 *</label>
              <select
                value={inForm.materialId}
                onChange={e => setInForm({ ...inForm, materialId: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">请选择物资</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.spec})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>入库数量 *</label>
              <input
                type="number"
                placeholder="请输入数量"
                value={inForm.quantity}
                onChange={e => setInForm({ ...inForm, quantity: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>入库日期</label>
              <input
                type="date"
                value={inForm.date}
                onChange={e => setInForm({ ...inForm, date: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>操作员</label>
              <input
                type="text"
                placeholder="请输入操作员姓名"
                value={inForm.operator}
                onChange={e => setInForm({ ...inForm, operator: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>供应商</label>
              <input
                type="text"
                placeholder="请输入供应商名称"
                value={inForm.supplier}
                onChange={e => setInForm({ ...inForm, supplier: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>备注</label>
              <input
                type="text"
                placeholder="选填备注信息"
                value={inForm.note}
                onChange={e => setInForm({ ...inForm, note: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleInSubmit}
                style={{ flex: 1, padding: '10px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                确认入库
              </button>
              <button
                onClick={() => setShowInModal(false)}
                style={{ flex: 1, padding: '10px 16px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 出库弹窗
  const renderOutModal = () => {
    if (!showOutModal) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setShowOutModal(false)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 480 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>物资出库</div>
            <button onClick={() => setShowOutModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>选择物资 *</label>
              <select
                value={outForm.materialId}
                onChange={e => setOutForm({ ...outForm, materialId: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">请选择物资</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.spec}) - 库存{m.stock}{m.unit}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>出库数量 *</label>
              <input
                type="number"
                placeholder="请输入数量"
                value={outForm.quantity}
                onChange={e => setOutForm({ ...outForm, quantity: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>出库日期</label>
              <input
                type="date"
                value={outForm.date}
                onChange={e => setOutForm({ ...outForm, date: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>领用部门</label>
              <select
                value={outForm.department}
                onChange={e => setOutForm({ ...outForm, department: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">请选择部门</option>
                <option value="CT室">CT室</option>
                <option value="MR室">MR室</option>
                <option value="DR室">DR室</option>
                <option value="导管室">导管室</option>
                <option value="CR室">CR室</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>领用人</label>
              <input
                type="text"
                placeholder="请输入领用人姓名"
                value={outForm.applicant}
                onChange={e => setOutForm({ ...outForm, applicant: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>用途</label>
              <input
                type="text"
                placeholder="如：CT增强检查"
                value={outForm.useFor}
                onChange={e => setOutForm({ ...outForm, useFor: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleOutSubmit}
                style={{ flex: 1, padding: '10px 16px', background: C.accent, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                确认出库
              </button>
              <button
                onClick={() => setShowOutModal(false)}
                style={{ flex: 1, padding: '10px 16px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 采购申请弹窗
  const renderPurchaseModal = () => {
    if (!showPurchaseModal) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setShowPurchaseModal(false)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 480 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>新建采购申请</div>
            <button onClick={() => setShowPurchaseModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>选择物资 *</label>
              <select
                value={purchaseForm.materialId}
                onChange={e => setPurchaseForm({ ...purchaseForm, materialId: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">请选择物资</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.spec})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>采购数量 *</label>
              <input
                type="number"
                placeholder="请输入采购数量"
                value={purchaseForm.quantity}
                onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>预估金额(元)</label>
              <input
                type="number"
                placeholder="请输入预估金额"
                value={purchaseForm.estimatedCost}
                onChange={e => setPurchaseForm({ ...purchaseForm, estimatedCost: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>申请部门</label>
              <select
                value={purchaseForm.department}
                onChange={e => setPurchaseForm({ ...purchaseForm, department: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">请选择部门</option>
                <option value="CT室">CT室</option>
                <option value="MR室">MR室</option>
                <option value="DR室">DR室</option>
                <option value="导管室">导管室</option>
                <option value="CR室">CR室</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>申请人</label>
              <input
                type="text"
                placeholder="请输入申请人姓名"
                value={purchaseForm.applicant}
                onChange={e => setPurchaseForm({ ...purchaseForm, applicant: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>申请原因</label>
              <input
                type="text"
                placeholder="请输入申请原因"
                value={purchaseForm.reason}
                onChange={e => setPurchaseForm({ ...purchaseForm, reason: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handlePurchaseSubmit}
                style={{ flex: 1, padding: '10px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                提交申请
              </button>
              <button
                onClick={() => setShowPurchaseModal(false)}
                style={{ flex: 1, padding: '10px 16px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 审批弹窗
  const renderApproveModal = () => {
    if (!showApproveModal || !selectedPurchase) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setShowApproveModal(false)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 440 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>采购审批</div>
            <button onClick={() => setShowApproveModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>申请单号</span>
              <span style={{ color: C.textDark, fontWeight: 500 }}>{selectedPurchase.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>物资名称</span>
              <span style={{ color: C.textDark }}>{selectedPurchase.materialName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>规格</span>
              <span style={{ color: C.textDark }}>{selectedPurchase.spec}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>申请数量</span>
              <span style={{ color: C.textDark, fontWeight: 500 }}>{selectedPurchase.quantity}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>预估金额</span>
              <span style={{ color: C.primary, fontWeight: 600 }}>{formatCurrency(selectedPurchase.estimatedCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>申请部门</span>
              <span style={{ color: C.textDark }}>{selectedPurchase.department}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid }}>申请人</span>
              <span style={{ color: C.textDark }}>{selectedPurchase.applicant}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              <div style={{ color: C.textMid, marginBottom: 4 }}>申请原因</div>
              <div style={{ color: C.textDark, padding: 8, background: C.bg, borderRadius: 6 }}>{selectedPurchase.reason}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => { setApproveConfirm(true) }}
                style={{ flex: 1, padding: '10px 16px', background: C.success, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                <CheckCheck size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 批准
              </button>
              <button
                onClick={() => { setApproveConfirm(true) }}
                style={{ flex: 1, padding: '10px 16px', background: C.danger, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                <XCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 拒绝
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 详情弹窗
  const renderDetailModal = () => {
    if (!showDetailModal || !detailData) return null
    const titles: Record<string, string> = {
      'purchase': '采购申请详情',
      'consumption': '消耗明细',
      'supplier-edit': '编辑供应商',
      'supplier-detail': '供应商详情'
    }
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setShowDetailModal(false)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 500 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{titles[detailType] || '详情'}</div>
            <button onClick={() => setShowDetailModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {Object.entries(detailData).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMid }}>{key}</span>
                <span style={{ color: C.textDark, fontWeight: 500 }}>{String(value)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setShowDetailModal(false)}
              style={{ flex: 1, padding: '10px 16px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 库存明细弹窗
  const renderMaterialDetailModal = () => {
    if (!materialDetail) return null
    const m = materialDetail
    const relatedIn = INITIAL_IN_RECORDS.filter(r => r.materialId === m.id || r.materialName === m.name)
    const relatedOut = INITIAL_OUT_RECORDS.filter(r => r.materialId === m.id || r.materialName === m.name)
    const stockStatus = getStockStatus(m.stock, m.minStock, m.category)
    const rows: [string, string][] = [
      ['物资ID', m.id],
      ['物资名称', m.name],
      ['分类', m.category],
      ['规格', m.spec],
      ['单位', m.unit],
      ['当前库存', `${m.stock} ${m.unit}`],
      ['最小库存', `${m.minStock} ${m.unit}`],
      ['库存状态', stockStatus.label],
      ['单价', `¥${m.price}`],
      ['供应商', m.supplier],
      ['最近入库', m.lastIn || '-'],
      ['最近出库', m.lastOut || '-'],
    ]
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={() => setMaterialDetail(null)}>
        <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 560, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={18} color={C.primary} /> 库存明细: {m.name}
            </div>
            <button onClick={() => setMaterialDetail(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.textMid }}>{k}</span>
                <span style={{ color: C.textDark, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>入库记录 ({relatedIn.length})</div>
            {relatedIn.length === 0 ? <div style={{ fontSize: 12, color: C.textLight }}>暂无入库记录</div> : relatedIn.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.textMid }}>{r.date} · {r.operator} · {r.supplier}</span>
                <span style={{ color: C.success, fontWeight: 600 }}>+{r.quantity} {m.unit}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>出库记录 ({relatedOut.length})</div>
            {relatedOut.length === 0 ? <div style={{ fontSize: 12, color: C.textLight }}>暂无出库记录</div> : relatedOut.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.textMid }}>{r.date} · {r.department} · {r.useFor}</span>
                <span style={{ color: C.danger, fontWeight: 600 }}>-{r.quantity} {m.unit}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setMaterialDetail(null)}
            style={{ width: '100%', marginTop: 16, padding: '10px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* 页面头部 */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: C.textDark, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Package size={24} color={C.primary} /> 物资耗材管理
            </h1>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>管理医疗物资库存、采购和消耗统计</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              <RefreshCw size={14} /> 刷新数据
            </button>
          </div>
        </div>
      </div>

      {/* 扫码输入栏 */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMid, fontSize: 13 }}>
          <ScanLine size={18} color={C.primary} />
          <span style={{ fontWeight: 500 }}>扫码/搜索:</span>
        </div>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <input
            type="text"
            placeholder="输入物资ID或名称 (如 MAT-001 或 M001)..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && scanInput.trim()) handleScan(scanInput) }}
            style={{ width: '100%', padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}
          />
          {showScanResult && scanResult && <ScanResultPopup material={scanResult} onClose={() => setShowScanResult(false)} />}
        </div>
        <button onClick={() => { if (scanInput.trim()) handleScan(scanInput) }} style={{ padding: '7px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <QrCode size={16} /> 扫描
        </button>
      </div>

      {/* Tab导航 */}
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab内容 */}
      <div style={{ padding: 20 }}>
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'purchase' && renderPurchaseTab()}
        {activeTab === 'consumption' && renderConsumptionTab()}
        {activeTab === 'supplier' && renderSupplierTab()}
        {activeTab === 'valuation' && renderValuationTab()}
        {activeTab === 'scorecard' && renderScorecardTab()}
      </div>

      {/* Toast 提示 */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          background: toast.type === 'success' ? C.success : toast.type === 'error' ? C.danger : C.info,
          color: C.white, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertTriangle size={16} />}
          {toast.type === 'info' && <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* 导出Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowExportModal(false)}>
          <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>导出数据</div>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Download size={48} color={C.primary} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: C.textMid, marginBottom: 8 }}>正在导出</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{exportType}数据</div>
            </div>
            <button
              onClick={() => { setShowExportModal(false); setToast({ show: true, type: 'success', message: `${exportType}数据导出成功！` }) }}
              style={{ width: '100%', padding: '10px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
            >
              确定导出
            </button>
          </div>
        </div>
      )}

      {/* 库存不足警告Modal */}
      {showLowStockModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowLowStockModal(false)}>
          <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.danger }}>库存不足</div>
              <button onClick={() => setShowLowStockModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <AlertTriangle size={48} color={C.danger} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: C.textMid, marginBottom: 8 }}>出库数量超过当前库存！</div>
              <div style={{ fontSize: 13, color: C.textLight }}>请调整出库数量或先进行入库操作</div>
            </div>
            <button
              onClick={() => setShowLowStockModal(false)}
              style={{ width: '100%', padding: '10px 16px', background: C.danger, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 审批确认Modal */}
      {approveConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setApproveConfirm(false)}>
          <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>确认审批</div>
              <button onClick={() => setApproveConfirm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} color={C.success} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: C.textMid, marginBottom: 8 }}>审批操作已确认执行</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setApproveConfirm(false); setShowApproveModal(false); setToast({ show: true, type: 'success', message: '已通过审批' }) }}
                style={{ flex: 1, padding: '10px 16px', background: C.success, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                批准
              </button>
              <button
                onClick={() => { setApproveConfirm(false); setShowApproveModal(false); setToast({ show: true, type: 'info', message: '已拒绝' }) }}
                style={{ flex: 1, padding: '10px 16px', background: C.danger, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO订单弹窗 */}
      {showPOModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowPOModal(false)}>
          <div style={{ background: C.white, borderRadius: 12, padding: 24, width: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>新建采购订单</div>
              <button onClick={() => setShowPOModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMid }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>申请人</label>
                <input type="text" placeholder="姓名" value={poForm.applicant} onChange={e => setPoForm({ ...poForm, applicant: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>申请部门</label>
                <select value={poForm.dept} onChange={e => setPoForm({ ...poForm, dept: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}>
                  <option value="">请选择</option>
                  <option value="CT室">CT室</option>
                  <option value="MR室">MR室</option>
                  <option value="DR室">DR室</option>
                  <option value="导管室">导管室</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: C.textMid, marginBottom: 4, display: 'block' }}>选择物资</label>
                <select onChange={e => { if (e.target.value) { const m = materials.find(x => x.id === e.target.value); if (m) setPoForm({ ...poForm, items: [...poForm.items, { materialId: m.id, name: m.name, quantity: '', unitPrice: m.price.toString() }] }) } }} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}>
                  <option value="">添加物资...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.spec})</option>)}
                </select>
              </div>
              {poForm.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: C.bg, borderRadius: 6 }}>
                  <span style={{ flex: 1, fontSize: 12, color: C.textDark }}>{item.name}</span>
                  <input type="number" placeholder="数量" value={item.quantity} onChange={e => { const newItems = [...poForm.items]; newItems[idx] = { materialId: newItems[idx].materialId, name: newItems[idx].name, quantity: e.target.value, unitPrice: newItems[idx].unitPrice }; setPoForm({ ...poForm, items: newItems }) }} style={{ width: 80, padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, outline: 'none' }} />
                  <button onClick={() => setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.danger }}><X size={16} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => { if (poForm.items.length > 0) { setPurchaseOrders(prev => [...prev, { id: `PO-${String(prev.length + 1).padStart(3, '0')}`, items: poForm.items.map(it => ({ materialId: it.materialId, name: it.name, quantity: parseInt(it.quantity) || 0, unitPrice: parseFloat(it.unitPrice) || 0 })), totalAmount: poForm.items.reduce((s, it) => s + ((parseInt(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)), 0), applicant: poForm.applicant, dept: poForm.dept, submitDate: new Date().toISOString().split('T')[0], status: 'pending' as const, approver: '', approveDate: '', receiver: '', receiveDate: '' }]); setShowPOModal(false); setPoForm({ items: [], applicant: '', dept: '' }); setToast({ show: true, type: 'success', message: '订单已提交' }) }} } style={{ flex: 1, padding: '10px 16px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>提交订单</button>
                <button onClick={() => setShowPOModal(false)} style={{ flex: 1, padding: '10px 16px', background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗 */}
      {renderInModal()}
      {renderOutModal()}
      {renderPurchaseModal()}
      {renderApproveModal()}
      {renderDetailModal()}
      {renderMaterialDetailModal()}
    </div>
  )
}
