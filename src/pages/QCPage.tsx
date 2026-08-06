import { t } from '../i18n/appI18n'
// NOTE: 未解决 - 此文件超过 2000 行（2933行），需要拆分为子组件
// v3.0.4 重构目标：
// 1. 提取页面头部 (title + breadcrumb + actions)
// 2. 提取搜索/筛选栏为独立组件
// 3. 提取列表/表格为独立组件
// 4. 提取对话框/编辑面板为独立组件
// G005 放射科RIS系统 - 质量控制 v1.0.0
// v1.0.4 (R4) 集成：跳转至 KeywordCheckPage / ReportScoreRulePage / ReportDefectLibraryPage
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, AlertTriangle, CheckCircle, Search, Star,
  TrendingUp, TrendingDown, BarChart3, PieChart, Settings, Clock, Camera, Image, X, Eye, Edit3,
  Bell, Target, Award, FileText, Zap, ThumbsUp, Plus, Minus, Save, RotateCcw,
  Building2, Globe, Download, FileBarChart, ChevronDown,
  ChevronUp, BarChart2, ClipboardCheck, ClipboardList,
  Users, Activity, User
} from 'lucide-react'
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Line,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area
} from 'recharts'
import { examApi, consultationApi, userApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
// [v3.0.6.8-28] 主数据池 + 生成器
import {
  DOCTOR_MASTER, DOCTORS_BY_TITLE, DEVICE_MASTER,
} from '../data/master'
import {
  DOCTOR_PERFORMANCE_PRE, EXAM_REPORT_PRE, QUALITY_SCORE_PRE,
} from '../data/_generators'

const PRIMARY = '#1e40af'

const ACCENT = '#3b82f6'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const GRAY = '#64748b'
const LIGHT_BG = '#f8fafc'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'

// 甲乙丙丁等级颜色
const GRADE_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  '甲': { bg: '#d1fae5', color: '#059669', border: '#059669', label: '甲级（优秀）' },
  '乙': { bg: '#dbeafe', color: '#1e40af', border: '#1e40af', label: '乙级（良好）' },
  '丙': { bg: '#fef3c7', color: '#d97706', border: '#d97706', label: '丙级（合格）' },
  '丁': { bg: '#fee2e2', color: '#dc2626', border: '#dc2626', label: '丁级（不合格）' },
}

const TABS = [
  { key: 'report', label: '报告质量评分', icon: <FileText size={15} /> },
  { key: 'image', label: '影像质量控制', icon: <Image size={15} /> },
  { key: 'timeout', label: '超时报告统计', icon: <Clock size={15} /> },
  { key: 'inspection', label: '人工抽检', icon: <ClipboardCheck size={15} /> },
  { key: 'dashboard', label: '质控指标仪表盘', icon: <BarChart3 size={15} /> },
  { key: 'regional', label: '区域影像质控', icon: <Globe size={15} /> },
  { key: 'settings', label: '质控规则设置', icon: <Settings size={15} /> },
  { key: 'peerReview', label: '同行评审', icon: <Users size={15} /> },
  { key: 'ruleChecker', label: '规则检查', icon: <ClipboardCheck size={15} /> },
  { key: 'radPath', label: '病理对照', icon: <Activity size={15} /> },
  { key: 'acr', label: 'ACR认证', icon: <Award size={15} /> },
  { key: 'trendAnalysis', label: '趋势分析', icon: <TrendingUp size={15} /> },
]

// [v3.0.6.8-28] 报告质控数据 - 来源: EXAM_REPORT_PRE (600 报告) + DOCTOR_MASTER + QUALITY_SCORE_PRE
const reportQCData = (() => {
  // 取前 10 报告评分高/低样本
  return EXAM_REPORT_PRE.slice(0, 10).map((r, idx) => {
    const reportDoctor = DOCTOR_MASTER.find((d) => d.id === r.reportDoctorId);
    const reviewDoctor = DOCTORS_BY_TITLE['副主任医师'].concat(DOCTORS_BY_TITLE['主任医师'])[idx % 4];
    const score = r.qcScore;
    const grade = score >= 95 ? '甲' : score >= 85 ? '乙' : score >= 75 ? '丙' : '丁';
    const status = score >= 95 ? '优秀' : score >= 85 ? '良好' : score >= 75 ? '一般' : '差';
    return {
      id: r.reportId,
      patientName: r.patientName,
      reportDoctor: reportDoctor?.name || '未知',
      reviewDoctor: reviewDoctor?.name || '未知',
      score: Math.round(score),
      completeness: Math.round(score - 3),
      accuracy: Math.round(score + 1),
      standardization: Math.round(score - 5),
      timeliness: Math.round(score - 2),
      status,
      date: r.examAt.split('T')[0],
      grade,
    };
  });
})()

// 甲乙丙丁等级分布数据（国家卫健委2024年版质控指标）
// [v3.0.6.8-28] 来源: QUALITY_SCORE_PRE.grade 聚合
const gradeDistributionData = (() => {
  const counts = { '甲': 0, '乙': 0, '丙': 0, '丁': 0 };
  QUALITY_SCORE_PRE.forEach((q) => {
    if (q.grade === 'A+' || q.grade === 'A') counts['甲']++;
    else if (q.grade === 'B+' || q.grade === 'B') counts['乙']++;
    else if (q.grade === 'C') counts['丙']++;
    else counts['丁']++;
  });
  const total = QUALITY_SCORE_PRE.length || 1;
  return [
    { grade: '甲', label: '甲级（优秀）', count: counts['甲'], percentage: Math.round((counts['甲'] / total) * 100), color: '#059669', bg: '#d1fae5', description: '报告完整、规范、准确、及时' },
    { grade: '乙', label: '乙级（良好）', count: counts['乙'], percentage: Math.round((counts['乙'] / total) * 100), color: '#1e40af', bg: '#dbeafe', description: '报告完整、轻微软硬件问题' },
    { grade: '丙', label: '丙级（合格）', count: counts['丙'], percentage: Math.round((counts['丙'] / total) * 100), color: '#d97706', bg: '#fef3c7', description: '报告基本完整、存在漏项' },
    { grade: '丁', label: '丁级（不合格）', count: counts['丁'], percentage: Math.round((counts['丁'] / total) * 100), color: '#dc2626', bg: '#fee2e2', description: '报告不完整或不准确' },
  ];
})()

// 报告缺陷类型统计（国家卫健委2024年版）
const reportDefectData = [
  { defectType: '描述不完整/漏项', count: 28, percentage: 25, trend: '下降', color: '#f97316' },
  { defectType: '诊断结论不明确', count: 22, percentage: 20, trend: '上升', color: '#ef4444' },
  { defectType: '术语使用不规范', count: 18, percentage: 16, trend: '持平', color: '#eab308' },
  { defectType: '检查所见与结论不符', count: 12, percentage: 11, trend: '下降', color: '#22c55e' },
  { defectType: '危急值漏报/迟报', count: 8, percentage: 7, trend: '下降', color: '#3b82f6' },
  { defectType: '报告超时', count: 15, percentage: 14, trend: '持平', color: '#8b5cf6' },
  { defectType: '其他缺陷', count: 9, percentage: 7, trend: '持平', color: '#64748b' },
]

// 报告书写正确率指标（国家卫健委2024年版）


// [v3.0.6.8-28] 人工抽检记录数据 - 来源: EXAM_REPORT_PRE 前 7 报告
const inspectionRecordsData = (() => {
  return EXAM_REPORT_PRE.slice(0, 7).map((r, idx) => {
    const reportDoctor = DOCTOR_MASTER.find((d) => d.id === r.reportDoctorId);
    const inspector = DOCTORS_BY_TITLE['副主任医师'].concat(DOCTORS_BY_TITLE['主任医师'])[idx % 4];
    const score = Math.round(r.qcScore);
    const grade = score >= 95 ? '甲' : score >= 85 ? '乙' : score >= 75 ? '丙' : '丁';
    const defects = score >= 95 ? [] : score >= 85 ? [] : score >= 75 ? ['术语使用不规范'] : ['描述不完整/漏项', '诊断结论不明确', '危急值漏报/迟报'].slice(0, 2);
    const status = score >= 85 ? '已通过' : score >= 75 ? '需整改' : '不合格';
    const comments: Record<string, string> = {
      '甲': '报告规范完整，无缺陷',
      '乙': '报告质量良好',
      '丙': '术语使用需进一步规范',
      '丁': '报告存在严重缺陷，需重新书写',
    };
    return {
      id: `INS-${r.examAt.split('T')[0]?.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`,
      reportId: r.reportId,
      patientName: r.patientName,
      reportDoctor: reportDoctor?.name || '未知',
      inspector: inspector?.name || '未知',
      inspectionDate: r.examAt.split('T')[0],
      grade,
      score,
      defects,
      inspectorComment: comments[grade] || '良好',
      status,
    };
  });
})()

// 抽检统计汇总
const inspectionStats = {
  totalInspected: 156,      // 本月抽检总数
  passedCount: 131,         // 抽检通过数
  passedRate: 84.0,         // 抽检通过率
  excellentCount: 82,       // 抽检甲级数
  excellentRate: 52.6,      // 抽检甲级率
  needsImprovement: 18,     // 需整改数
  unqualified: 7,           // 不合格数
  avgScore: 88.5,           // 抽检平均分
  defectFoundCount: 43,     // 发现缺陷报告数
  defectRate: 27.6,        // 缺陷发现率
}

// [v3.0.6.8-28] 影像质控数据 - 来源: DEVICE_MASTER + EXAM_REPORT_PRE
const imageQCData = (() => {
  const issuePool = ['运动伪影', '曝光不当', '体位不正', '对比剂用量不足', '轻微运动伪影', '图像噪声', '金属伪影'];
  return DEVICE_MASTER.slice(0, 8).map((d, idx) => {
    const report = EXAM_REPORT_PRE[idx];
    const score = report ? Math.round(report.qcScore) : Math.round(85 + Math.random() * 10);
    const status = score >= 95 ? '优秀' : score >= 85 ? '良好' : score >= 75 ? '一般' : '差';
    const issues = score >= 95 ? [] : score >= 85 ? [issuePool[idx % 6]!] : score >= 75 ? [issuePool[idx % 6]!, issuePool[(idx + 2) % 6]!] : [issuePool[idx % 6]!];
    return {
      id: report?.reportId || `IMG-${idx + 1}`,
      patientName: report?.patientName || `患者${idx + 1}`,
      device: `${d.modality}-${d.id.split('-')[2]}（${d.brand} ${d.model}）`,
      score,
      issues,
      status,
    };
  });
})()

// Timeout reports
const timeoutData = [
  { id: 'RAD-EX002', patientName: '李秀英', examItem: '头颅MR平扫', scheduledTime: '10:00', actualReportTime: '14:30', delayMinutes: 270, reason: 'MR设备维护延迟', severity: '严重' },
  { id: 'RAD-EX003', patientName: '王建国', examItem: '胸部DR正侧位', scheduledTime: '11:00', actualReportTime: '12:15', delayMinutes: 75, reason: '体检报告高峰积压', severity: '一般' },
  { id: 'RAD-EX004', patientName: '赵晓敏', examItem: '头颅CT平扫', scheduledTime: '12:00', actualReportTime: '15:45', delayMinutes: 225, reason: '急诊优先处理', severity: '严重' },
  { id: 'RAD-EX006', patientName: '孙伟', examItem: '腰椎MR平扫', scheduledTime: '15:00', actualReportTime: '18:00', delayMinutes: 180, reason: '报告医师临时会议', severity: '中等' },
]

// ==================== 医生报告质量评分数据 ====================

// 评分维度权重


// 评分矩阵说明
const SCORE_MATRIX = [
  { dimension: '格式规范', weight: '30%', indicators: '报告完整性/模板使用/描述规范', color: '#3b82f6' },
  { dimension: '诊断准确', weight: '50%', indicators: '误诊率/漏诊率/修改次数', color: '#059669' },
  { dimension: '时效性', weight: '20%', indicators: '报告及时率/超时率', color: '#f59e0b' },
]

// 医生评分排行榜 - 10名医生
// [v3.0.6.8-28] 来源: DOCTOR_PERFORMANCE_PRE 当前月聚合 → 按 qcScore 降序
const doctorScoreData = (() => {
  const currentMonth = DOCTOR_PERFORMANCE_PRE.filter((p) => p.month === '2026-06');
  // 按医生聚合 (每月一份, 取 6 月或平均)
  const byDoctor: Record<string, { totalScore: number; formatScore: number; accuracyScore: number; timelinessScore: number; reportCount: number; id: string; name: string; }> = {};
  currentMonth.forEach((p) => {
    if (!byDoctor[p.doctorId]) {
      byDoctor[p.doctorId] = { totalScore: 0, formatScore: 0, accuracyScore: 0, timelinessScore: 0, reportCount: 0, id: p.doctorId, name: p.doctorName };
    }
    const d = byDoctor[p.doctorId]!;
    d.totalScore += p.qcScore;
    d.formatScore += p.qcScore - 2;
    d.accuracyScore += p.qcScore + 1;
    d.timelinessScore += p.qcScore - 1;
    d.reportCount += p.reportCount;
  });
  return Object.values(byDoctor)
    .map((d) => ({
      id: d.id, name: d.name,
      totalScore: Math.round(d.totalScore / 6),
      formatScore: Math.round(d.formatScore / 6),
      accuracyScore: Math.round(d.accuracyScore / 6),
      timelinessScore: Math.round(d.timelinessScore / 6),
      reportCount: d.reportCount,
      rank: 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map((d, idx) => ({ ...d, rank: idx + 1 }));
})()

// 质控问题分布数据
const qcIssueDistribution = [
  { issueType: '格式错误', count: 28, percentage: 32, color: '#3b82f6', trend: '下降' },
  { issueType: '描述不规范', count: 24, percentage: 28, color: '#f59e0b', trend: '下降' },
  { issueType: '疑似误诊', count: 18, percentage: 21, color: '#ef4444', trend: '上升' },
  { issueType: '超时', count: 17, percentage: 19, color: '#8b5cf6', trend: '持平' },
]

// 医生评分汇总统计
const doctorScoreStats = {
  avgTotalScore: 79.7,
  avgFormatScore: 80.1,
  avgAccuracyScore: 83.6,
  avgTimelinessScore: 79.4,
  totalDoctors: 10,
  excellentCount: 3,  // >=90分
  goodCount: 3,      // 80-89分
  fairCount: 2,      // 70-79分
  poorCount: 2,      // <70分
}

// Dashboard metrics
const dashboardData = {
  passRate: 92,
  excellentRate: 65,
  avgScore: 87.3,
  totalReviewed: 156,
  trend7days: [
    { date: '04-25', score: 85.2, count: 22 },
    { date: '04-26', score: 86.8, count: 25 },
    { date: '04-27', score: 84.5, count: 20 },
    { date: '04-28', score: 88.1, count: 28 },
    { date: '04-29', score: 87.5, count: 23 },
    { date: '04-30', score: 89.2, count: 26 },
    { date: '05-01', score: 87.3, count: 12 },
  ],
  trend30days: Array.from({ length: 30 }, (_, i) => ({
    date: `04-${String(i + 1).padStart(2, '0')}`,
    score: 82 + Math.random() * 10,
    count: 18 + Math.floor(Math.random() * 12 ),
  })),
  issueDistribution: [
    { name: '运动伪影', value: 28, color: '#ef4444' },
    { name: '曝光不当', value: 22, color: '#f97316' },
    { name: '体位不正', value: 18, color: '#eab308' },
    { name: '对比剂问题', value: 12, color: '#22c55e' },
    { name: '设备故障', value: 8, color: '#3b82f6' },
    { name: '其他', value: 12, color: '#94a3b8' },
  ],
  weakLinks: ['报告及时性', '描述规范性', '危急值追踪'],
}

// ==================== 区域影像质控数据 ====================

// 区域机构数据
const regionalInstitutions = [
  { id: 'HOSP001', name: '市第一人民医院', level: '三甲', joinedDate: '2024-01-15', status: 'active', reportsThisMonth: 4521, avgScore: 91.2, ranking: 1, contact: '张主任', phone: '0551-12345678', trend: 'up' as const },
  { id: 'HOSP002', name: '市第三医院', level: '三乙', joinedDate: '2024-03-20', status: 'active', reportsThisMonth: 3280, avgScore: 88.7, ranking: 3, contact: '李主任', phone: '0551-23456789', trend: 'down' as const },
  { id: 'HOSP003', name: '县人民医院', level: '二甲', joinedDate: '2024-06-01', status: 'active', reportsThisMonth: 2156, avgScore: 85.4, ranking: 5, contact: '王主任', phone: '0552-34567890', trend: 'same' as const },
  { id: 'HOSP004', name: '区中心医院', level: '二乙', joinedDate: '2024-09-15', status: 'active', reportsThisMonth: 1892, avgScore: 82.1, ranking: 7, contact: '赵主任', phone: '0553-45678901', trend: 'down' as const },
  { id: 'HOSP005', name: '市中医院', level: '三甲', joinedDate: '2024-02-10', status: 'active', reportsThisMonth: 2890, avgScore: 89.5, ranking: 2, contact: '刘主任', phone: '0551-56789012', trend: 'up' as const },
  { id: 'HOSP006', name: '矿工医院', level: '二甲', joinedDate: '2025-01-05', status: 'active', reportsThisMonth: 1234, avgScore: 80.3, ranking: 8, contact: '陈主任', phone: '0552-67890123', trend: 'down' as const },
  { id: 'HOSP007', name: '市妇幼保健院', level: '三甲', joinedDate: '2024-11-20', status: 'active', reportsThisMonth: 1567, avgScore: 87.2, ranking: 4, contact: '周主任', phone: '0551-78901234', trend: 'up' as const },
  { id: 'HOSP008', name: '乡镇卫生院', level: '一甲', joinedDate: '2025-03-01', status: 'active', reportsThisMonth: 456, avgScore: 76.8, ranking: 10, contact: '孙主任', phone: '0554-89012345', trend: 'up' as const },
]

// 区域排名数据
const regionalRanking = [
  { institution: '市第一人民医院', score: 91.2, imageQuality: 93, reportQuality: 90, timeliness: 88, criticalValueReport: 98, ranking: 1, trend: 'up', trendValue: 1.2 },
  { institution: '市中医院', score: 89.5, imageQuality: 91, reportQuality: 88, timeliness: 87, criticalValueReport: 96, ranking: 2, trend: 'up', trendValue: 0.8 },
  { institution: '市第三医院', score: 88.7, imageQuality: 89, reportQuality: 88, timeliness: 86, criticalValueReport: 95, ranking: 3, trend: 'down', trendValue: -0.5 },
  { institution: '市妇幼保健院', score: 87.2, imageQuality: 88, reportQuality: 86, timeliness: 85, criticalValueReport: 94, ranking: 4, trend: 'up', trendValue: 1.5 },
  { institution: '县人民医院', score: 85.4, imageQuality: 86, reportQuality: 84, timeliness: 83, criticalValueReport: 92, ranking: 5, trend: 'same', trendValue: 0 },
  { institution: '区中心医院', score: 82.1, imageQuality: 83, reportQuality: 81, timeliness: 80, criticalValueReport: 89, ranking: 7, trend: 'down', trendValue: -1.2 },
  { institution: '矿工医院', score: 80.3, imageQuality: 81, reportQuality: 79, timeliness: 78, criticalValueReport: 87, ranking: 8, trend: 'down', trendValue: -0.8 },
  { institution: '乡镇卫生院', score: 76.8, imageQuality: 77, reportQuality: 75, timeliness: 74, criticalValueReport: 82, ranking: 10, trend: 'up', trendValue: 2.1 },
]

// 质控标准数据
const qcStandards = {
  imageQuality: {
    excellent: { min: 90, desc: '图像清晰，对比度适中，无伪影' },
    good: { min: 80, desc: '图像清晰，轻微伪影不影响诊断' },
    fair: { min: 70, desc: '图像质量一般，存在伪影但可诊断' },
    poor: { min: 0, desc: '图像质量差，无法用于诊断' },
  },
  reportQuality: {
    excellent: { min: 90, desc: '报告完整、规范、准确' },
    good: { min: 80, desc: '报告完整，轻微不规范' },
    fair: { min: 70, desc: '报告基本完整，存在漏项' },
    poor: { min: 0, desc: '报告不完整或不准确' },
  },
  timeliness: {
    urgent: { minutes: 30, desc: '危急值立即通知，≤30分钟' },
    stat: { minutes: 60, desc: '急诊报告≤60分钟' },
    routine: { minutes: 120, desc: '常规报告≤2小时' },
    extended: { minutes: 240, desc: '特殊检查≤4小时' },
  },
  criticalValue: {
    required: { rate: 100, desc: '危急值10分钟内通知临床' },
    reported: { rate: 95, desc: '危急值登记完整率≥95%' },
    callback: { rate: 90, desc: '危急值回访确认率≥90%' },
  },
}

// 区域综合评分数据
const regionalOverallScores = [
  { month: '2025-07', avgScore: 82.5, excellentRate: 52, passRate: 88 },
  { month: '2025-08', avgScore: 83.2, excellentRate: 55, passRate: 89 },
  { month: '2025-09', avgScore: 84.1, excellentRate: 57, passRate: 90 },
  { month: '2025-10', avgScore: 83.8, excellentRate: 56, passRate: 89 },
  { month: '2025-11', avgScore: 85.2, excellentRate: 60, passRate: 91 },
  { month: '2025-12', avgScore: 85.8, excellentRate: 62, passRate: 92 },
  { month: '2026-01', avgScore: 86.1, excellentRate: 63, passRate: 92 },
  { month: '2026-02', avgScore: 85.5, excellentRate: 61, passRate: 91 },
  { month: '2026-03', avgScore: 86.8, excellentRate: 65, passRate: 93 },
  { month: '2026-04', avgScore: 87.2, excellentRate: 67, passRate: 94 },
]

// 机构详细评分
regionalInstitutions.map(inst => ({
  ...inst,
  imageQualityScore: 75 + Math.random() * 20,
  reportQualityScore: 75 + Math.random() * 20,
  timelinessScore: 75 + Math.random() * 20,
  criticalValueScore: 80 + Math.random() * 18,
}));

// 问题追踪数据
const issueTrackingData = [
  { id: 'IT001', institution: '县人民医院', issueType: '报告超时', description: '部分报告超过规定时限', severity: '中', status: '整改中', reportedDate: '2026-04-15', dueDate: '2026-05-15' },
  { id: 'IT002', institution: '乡镇卫生院', issueType: '图像质量问题', description: '部分图像质量不达标', severity: '高', status: '整改中', reportedDate: '2026-04-10', dueDate: '2026-05-10' },
  { id: 'IT003', institution: '矿工医院', issueType: '危急值漏报', description: '发现3例危急值未及时上报', severity: '高', status: '已整改', reportedDate: '2026-03-28', dueDate: '2026-04-28' },
  { id: 'IT004', institution: '区中心医院', issueType: '报告不规范', description: '报告格式不符合规范要求', severity: '低', status: '已整改', reportedDate: '2026-04-05', dueDate: '2026-04-20' },
]

// 不合格原因分析
const unqualifiedReasonData = [
  { reason: '图像伪影', count: 45, percentage: 32, trend: '下降' },
  { reason: '报告描述不完整', count: 32, percentage: 23, trend: '持平' },
  { reason: '超时未出报告', count: 24, percentage: 17, trend: '下降' },
  { reason: '危急值漏报', count: 12, percentage: 9, trend: '下降' },
  { reason: '诊断结论不明确', count: 18, percentage: 13, trend: '上升' },
  { reason: '其他', count: 9, percentage: 6, trend: '持平' },
]

// 月报/季报/年报数据
const reportSummaryData = {
  monthly: {
    period: '2026年4月',
    totalReports: 15620,
    avgScore: 87.2,
    excellentCount: 10153,
    passRate: 94.2,
    timeoutCount: 89,
    criticalValueReported: 245,
    criticalValueOnTime: 238,
    issues: [
      { type: '图像质量问题', count: 156, percentage: 42 },
      { type: '报告超时', count: 89, percentage: 24 },
      { type: '报告不规范', count: 78, percentage: 21 },
      { type: '危急值问题', count: 48, percentage: 13 },
    ],
  },
  quarterly: {
    period: '2026年Q1',
    totalReports: 45680,
    avgScore: 85.8,
    excellentCount: 28540,
    passRate: 92.5,
    timeoutCount: 312,
    criticalValueReported: 698,
    criticalValueOnTime: 672,
    trends: [
      { metric: '优良率', value: '62.5%', trend: 'up', change: '+2.3%' },
      { metric: '达标率', value: '92.5%', trend: 'up', change: '+1.5%' },
      { metric: '超时率', value: '0.68%', trend: 'down', change: '-0.15%' },
    ],
  },
  yearly: {
    period: '2025年度',
    totalReports: 178520,
    avgScore: 84.2,
    excellentCount: 102180,
    passRate: 90.8,
    timeoutCount: 1520,
    criticalValueReported: 2680,
    criticalValueOnTime: 2546,
    rankings: regionalRanking.slice(0, 3),
  },
}

// QC Rules Settings
const qcRulesDefault = {
  reportTimeoutMinutes: 30,
  imageScoreExcellent: 90,
  imageScoreGood: 80,
  reminderBeforeMinutes: 10,
  autoEscalateAfterMinutes: 60,
  dailyReviewQuota: 20,
  peerReviewRate: 0.3,
}

const SCORE_COLORS = {
  '优秀': SUCCESS,
  '良好': WARNING,
  '一般': '#f97316',
  '差': DANGER,
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  '优秀': { bg: '#d1fae5', color: '#059669' },
  '良好': { bg: '#fef3c7', color: '#d97706' },
  '一般': { bg: '#fed7aa', color: '#c2410c' },
  '差': { bg: '#fee2e2', color: '#dc2626' },
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#64748b']

// 区域排名颜色映射


export default function QCPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('report')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const [examRes, consRes, userRes] = await Promise.all([
        examApi.list({}),
        consultationApi.list(),
        userApi.list(),
      ])
      if (cancelled) return
      if (examRes.success || consRes.success || userRes.success) {
        setLoadError(null)
      } else {
        setLoadError('API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<typeof reportQCData[0] | null>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [qcRules, setQcRules] = useState({ ...qcRulesDefault })
  const [editingRules, setEditingRules] = useState(false)
  const [tempRules, setTempRules] = useState({ ...qcRulesDefault })
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d')
  const [filterStatus, setFilterStatus] = useState('全部')

  // 区域质控相关状态
  const [regionalReportType, setRegionalReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [regionalTab, setRegionalTab] = useState<'overview' | 'ranking' | 'standards' | 'reports' | 'tracking'>('overview')
  useState<string | null>(null)
  const [expandedInstitution, setExpandedInstitution] = useState<string | null>(null)

  // Peer Review 状态
  const [peerReviewTab, setPeerReviewTab] = useState<'assignment' | 'scoring' | 'reliability'>('assignment')
  
  const peerReviewAssignments = [
    { id: 'PR001', caseId: 'RAD-RPT011', patientName: '张伟', originalAuthor: '李明辉', reviewer: '王秀峰', blindedId: 'B-001', status: '待评分', accuracy: 0, completeness: 0, timeliness: 0, submittedAt: '2026-05-01' },
    { id: 'PR002', caseId: 'RAD-RPT012', patientName: '李娜', originalAuthor: '王秀峰', reviewer: '张海涛', blindedId: 'B-002', status: '已评分', accuracy: 92, completeness: 88, timeliness: 90, submittedAt: '2026-05-01' },
    { id: 'PR003', caseId: 'RAD-RPT013', patientName: '赵敏', originalAuthor: '张海涛', reviewer: '刘芳', blindedId: 'B-003', status: '已评分', accuracy: 85, completeness: 82, timeliness: 88, submittedAt: '2026-05-02' },
    { id: 'PR004', caseId: 'RAD-RPT014', patientName: '王磊', originalAuthor: '刘芳', reviewer: '李明辉', blindedId: 'B-004', status: '待评分', accuracy: 0, completeness: 0, timeliness: 0, submittedAt: '2026-05-02' },
    { id: 'PR005', caseId: 'RAD-RPT015', patientName: '周涛', originalAuthor: '陈志强', reviewer: '王秀峰', blindedId: 'B-005', status: '已评分', accuracy: 78, completeness: 80, timeliness: 75, submittedAt: '2026-05-03' },
  ]
  const kappaData = { kappaValue: 0.72, agreement: 'substantial', reviewer1: '王秀峰', reviewer2: '李明辉', totalCases: 50, agreedCases: 42 }

  // Rule-Based Report Checker 状态
  const [ruleCheckerTab, setRuleCheckerTab] = useState<'rules' | 'results'>('rules')
  const qcRulesConfig = [
    { id: 'R001', category: 'structure', name: '报告包含所有必需章节', description: '检查所见、诊断意见、建议等章节齐全', enabled: true, passed: true },
    { id: 'R002', category: 'content', name: '患者信息完整', description: '患者姓名、ID、年龄、性别与申请单一致', enabled: true, passed: true },
    { id: 'R003', category: 'terminology', name: '使用标准放射学术语', description: '禁止使用口语化、非标准缩写描述', enabled: true, passed: false },
    { id: 'R004', category: 'structure', name: '影像描述结构化', description: '按解剖部位分层描述，逻辑清晰', enabled: true, passed: true },
    { id: 'R005', category: 'compliance', name: '包含危急值标注', description: '若存在危急值必须在报告中标注并通知', enabled: true, passed: false },
    { id: 'R006', category: 'content', name: '诊断意见有证据支持', description: '诊断结论与影像所见描述一致', enabled: true, passed: true },
    { id: 'R007', category: 'terminology', name: 'BI-RADS/LU-RADS分级规范', description: '肿瘤筛查报告按相应标准分级', enabled: true, passed: false },
    { id: 'R008', category: 'compliance', name: '报告时效达标', description: '急诊≤30min，常规≤120min', enabled: true, passed: true },
  ]
  const overallQualityScore = 82

  // Rad-Path Correlation 状态
  const [radPathTab, setRadPathTab] = useState<'overview' | 'discordant'>('overview')
  // [v3.0.6.8-28] 放射-病理对照数据 - 来源: 抽样 8 例
  const radPathData = [
    { id: 'RP001', patientName: '张伟', radDiagnosis: '左肺上叶结节，LU-RADS 4A', pathResult: '肺腺癌', concordance: 'concordant' as const, date: '2026-04-20' },
    { id: 'RP002', patientName: '李娜', radDiagnosis: '右乳BI-RADS 4C', pathResult: '浸润性导管癌', concordance: 'concordant' as const, date: '2026-04-21' },
    { id: 'RP003', patientName: '王磊', radDiagnosis: '肝S8段结节，HCC可能', pathResult: '局灶性结节样增生', concordance: 'discordant' as const, date: '2026-04-22' },
    { id: 'RP004', patientName: '赵敏', radDiagnosis: '甲状腺左叶结节，TI-RADS 4', pathResult: '甲状腺乳头状癌', concordance: 'concordant' as const, date: '2026-04-23' },
    { id: 'RP005', patientName: '周涛', radDiagnosis: '胰腺体部占位', pathResult: '自身免疫性胰腺炎', concordance: 'discordant' as const, date: '2026-04-24' },
    { id: 'RP006', patientName: '吴静', radDiagnosis: '左肾下极肿块', pathResult: '肾透明细胞癌', concordance: 'concordant' as const, date: '2026-04-25' },
    { id: 'RP007', patientName: '郑强', radDiagnosis: '右肺下叶磨玻璃影', pathResult: '结果待定', concordance: 'indeterminate' as const, date: '2026-04-26' },
    { id: 'RP008', patientName: '钱琳', radDiagnosis: '子宫肌瘤', pathResult: '子宫平滑肌瘤', concordance: 'concordant' as const, date: '2026-04-27' },
  ]
  // [v3.0.6.8-28] 趋势 - 来源: QUALITY_SCORE_PRE (90天按月聚合, 模拟 rad-path 一致率)
  const radPathTrend = (() => {
    const months: { [k: string]: { total: number; concordant: number } } = {};
    QUALITY_SCORE_PRE.forEach((q, _idx) => {
      const m = q.reviewedAt?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { total: 0, concordant: 0 };
      months[m]!.total++;
      // 用 defectCount 与 critical 维度模拟一致率 (高分=一致)
      if (q.totalScore >= 80) months[m]!.concordant++;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, v]) => ({ month, rate: Math.round((v.concordant / Math.max(v.total, 1)) * 100), total: v.total, concordant: v.concordant }));
  })()
  const concordanceStats = { total: radPathData.length, concordant: radPathData.filter(d => d.concordance === 'concordant').length, discordant: radPathData.filter(d => d.concordance === 'discordant').length, indeterminate: radPathData.filter(d => d.concordance === 'indeterminate').length }

  // ACR Compliance 状态
  const [acrTab, setAcrTab] = useState<'requirements' | 'readiness'>('requirements')
  const acrRequirementsData = [
    { modality: 'CT', requirements: ['设备质控记录', '辐射剂量监控', '图像质量评估', '报告规范性', '人员资质'], completed: 4, total: 5, status: '部分达标' },
    { modality: 'MR', requirements: ['设备质控记录', '安全培训记录', '图像质量评估', '紧急预案演练', '对比剂管理'], completed: 3, total: 5, status: '部分达标' },
    { modality: 'DR', requirements: ['设备质控记录', '辐射剂量监控', '图像质量评估', '报告时效性', '人员继续教育'], completed: 5, total: 5, status: '已达标' },
    { modality: 'MG', requirements: ['MQSA合规', '设备质控', '报告标准', '剂量记录', '技师认证'], completed: 2, total: 5, status: '未达标' },
    { modality: 'DSA', requirements: ['设备质控', '辐射防护', '对比剂管理', '应急预案', '人员资质'], completed: 3, total: 5, status: '部分达标' },
  ]
  const readinessScore = 72
  const inspectionFindings = [
    { id: 'F001', date: '2025-10-15', inspector: '省质控中心', findings: 'DR图像归档不完整', severity: '中', status: '已整改' },
    { id: 'F002', date: '2025-10-15', inspector: '省质控中心', findings: 'CT辐射剂量记录不规范', severity: '高', status: '整改中' },
    { id: 'F003', date: '2025-07-20', inspector: '市卫健委', findings: '危急值报告流程不完善', severity: '高', status: '已整改' },
    { id: 'F004', date: '2025-04-10', inspector: '院内质控', findings: '报告术语使用不规范', severity: '低', status: '已整改' },
  ]

  // Trend Analysis 状态
  const [trendAnalysisTab, setTrendAnalysisTab] = useState<'department' | 'individual'>('department')
  // [v3.0.6.8-28] 月度质控数据 - 来源: QUALITY_SCORE_PRE 按月聚合
  const monthlyQualityData = (() => {
    const months: Record<string, { sum: number; count: number; indivSum: number; indivCount: number }> = {};
    QUALITY_SCORE_PRE.forEach((q) => {
      const m = q.reviewedAt?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { sum: 0, count: 0, indivSum: 0, indivCount: 0 };
      months[m]!.sum += q.totalScore;
      months[m]!.count++;
    });
    // 加 DOCTOR_PERFORMANCE_PRE 个体评分
    DOCTOR_PERFORMANCE_PRE.forEach((p) => {
      const m = p.month;
      if (!months[m]) months[m] = { sum: 0, count: 0, indivSum: 0, indivCount: 0 };
      months[m]!.indivSum += p.qcScore;
      months[m]!.indivCount++;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([month, v]) => ({
        month,
        deptAvg: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
        indivAvg: v.indivCount > 0 ? Math.round((v.indivSum / v.indivCount) * 10) / 10 : 0,
        upperControl: 89.5,
        lowerControl: 73.5,
        mean: 81.5,
      }));
  })()
  const controlAlerts = [
    { month: '2025-11', type: 'out_of_control_up', message: '全院评分超出控制上限 (84.2 > 89.5?)' },
    { month: '2026-03', type: 'warning_up', message: '全院评分接近上限警戒线' },
  ]
  const indivDoctorTrendData = doctorScoreData.slice(0, 4)

  // Toast状态
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' })
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }

  // 进度Modal状态
  const [progressModal, setProgressModal] = useState<{ show: boolean; title: string; message: string; complete: boolean }>({ show: false, title: '', message: '', complete: false })

  // 详情Modal状态
  const [detailModal, setDetailModal] = useState<{ show: boolean; title: string; content: string }>({ show: false, title: '', content: '' })

  // 表单Modal状态
  const [formModal, setFormModal] = useState<{ show: boolean; title: string }>({ show: false, title: '' })

  const filteredReports = reportQCData.filter(r => {
    const matchSearch = !search || r.patientName.includes(search) || r.id.includes(search)
    const matchStatus = filterStatus === '全部' || r.status === filterStatus
    return matchSearch && matchStatus
  })

  const imageFiltered = imageQCData.filter(i => {
    return !search || i.patientName.includes(search) || i.id.includes(search)
  })

  const handleOpenRating = (report: typeof reportQCData[0]) => {
    setSelectedReport(report)
    setShowRatingModal(true)
  }

  const handleSaveRules = () => {
    setQcRules({ ...tempRules })
    setEditingRules(false)
    showToast('质控规则已保存', 'success')
  }

  

  const handleExportPDF = (type: string) => {
    setProgressModal({ show: true, title: '报表生成', message: `正在生成${type}报表，请稍候...`, complete: false })
    setTimeout(() => {
      setProgressModal(p => ({ ...p, complete: true, message: `${type}报表已生成` }))
      setTimeout(() => setProgressModal(p => ({ ...p, show: false })), 2000)
    }, 1000)
  }

  const trendData = trendRange === '7d' ? dashboardData.trend7days : dashboardData.trend30days

  const statCardsReport = [
    { label: '今日审核数', value: reportQCData.filter(r => r.date === '2026-05-01').length, icon: <FileText size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
    { label: '平均评分', value: '87.3', icon: <Star size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
    { label: '超时审核数', value: timeoutData.length, icon: <Clock size={18} color={WARNING} />, bg: '#fef3c7', color: WARNING },
    { label: '优秀率', value: `${Math.round(reportQCData.filter(r => r.status === '优秀').length / reportQCData.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
  ]

  const statCardsImage = [
    { label: '今日采集数', value: imageQCData.length, icon: <Camera size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
    { label: '优秀率', value: `${Math.round(imageQCData.filter(i => i.status === '优秀').length / imageQCData.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
    { label: '废片率', value: `${Math.round(imageQCData.filter(i => i.status === '差').length / imageQCData.length * 100)}%`, icon: <AlertTriangle size={18} color={DANGER} />, bg: '#fee2e2', color: DANGER },
    { label: '平均评分', value: '87.2', icon: <Star size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
  ]

  

  const renderScoreBar = (value: number, max: number = 100) => {
    const pct = (value / max) * 100
    const color = pct >= 90 ? SUCCESS : pct >= 80 ? WARNING : pct >= 70 ? '#f97316' : DANGER
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{value}</span>
      </div>
    )
  }

  // 渲染区域质控子Tab
  const renderRegionalSubTabs = () => {
    const subTabs = [
      { key: 'overview', label: '区域总览', icon: <BarChart2 size={14} /> },
      { key: 'ranking', label: '机构排名', icon: <Award size={14} /> },
      { key: 'standards', label: '质控标准', icon: <Target size={14} /> },
      { key: 'reports', label: '质控报表', icon: <FileBarChart size={14} /> },
      { key: 'tracking', label: '问题追踪', icon: <AlertTriangle size={14} /> },
    ]
    return (
      <div style={{ background: WHITE, borderRadius: 10, padding: '4px', marginBottom: 16, display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
        {subTabs.map(tab => {
          const isActive = regionalTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setRegionalTab(tab.key as 'overview' | 'ranking' | 'standards' | 'reports' | 'tracking')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: isActive ? ACCENT : 'transparent',
                color: isActive ? WHITE : GRAY,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div data-testid="qc-page" style={{ padding: 24, maxWidth: 1600, margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
      {loading && <LoadingBanner message="正在从 API 加载质控数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: PRIMARY, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color='#fff' />
          </div>{t('qc.title')}<span style={{ fontSize: 12, fontWeight: 400, color: GRAY, marginLeft: 8 }}>质控中心</span>
        </h1>
        <p style={{ fontSize: 13, color: GRAY, margin: 0 }}>{t('qc.subtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: WHITE, borderRadius: 12, padding: '6px', marginBottom: 16, display: 'flex', gap: 4, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? PRIMARY : 'transparent',
                color: isActive ? WHITE : GRAY,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* [v1.0.4 R4] 升级入口横幅 */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dbeafe 100%)',
            border: '1px solid #86efac', borderRadius: 10, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 18 }}>🚀</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>
                v1.0.4 质量评分 + AI 增强子系统就绪
              </div>
              <div style={{ fontSize: 12, color: '#065f46', marginTop: 2 }}>
                5 维评分 · 17 类缺陷 · 6 AI 场景 · 关键字全量扫描 · 一键自动初稿
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => navigate('/keyword-check')} style={{ padding: '5px 10px', border: '1px solid #3b82f6', borderRadius: 4, background: '#fff', color: '#1e40af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>关键字扫描</button>
              <button onClick={() => navigate('/report-score-rule')} style={{ padding: '5px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: '#fff', color: '#5b21b6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>评分规则</button>
              <button onClick={() => navigate('/report-defect-library')} style={{ padding: '5px 10px', border: '1px solid #dc2626', borderRadius: 4, background: '#fff', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>缺陷字典</button>
              <button onClick={() => navigate('/ai-report-draft')} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>AI 初稿</button>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {statCardsReport.map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 评分系统三维矩阵 */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={16} color={PRIMARY} />报告质量评分三维矩阵<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>评分与绩效关联</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              {SCORE_MATRIX.map(item => (
                <div key={item.dimension} style={{ background: `${item.color}15`, borderRadius: 10, padding: '16px', border: `2px solid ${item.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>{item.weight}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.dimension}</span>
                  </div>
                  <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.5 }}>{item.indicators}</div>
                </div>
              ))}
            </div>
            <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={14} color={WHITE} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>评分计算公式</div>
                <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>总分 = 格式分×0.3 + 准确分×0.5 + 时效分×0.2</div>
              </div>
            </div>
          </div>

          {/* 医生评分排行榜 */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={16} color={PRIMARY} />医生报告质量评分排行榜<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>本月统计</span>
            </h3>
            {/* 排行榜统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: '平均总分', value: doctorScoreStats.avgTotalScore.toFixed(1), icon: <Star size={16} />, color: ACCENT, bg: '#eff6ff' },
                { label: '优秀医生', value: `${doctorScoreStats.excellentCount}人`, icon: <Award size={16} />, color: SUCCESS, bg: '#d1fae5' },
                { label: '良好医生', value: `${doctorScoreStats.goodCount}人`, icon: <ThumbsUp size={16} />, color: WARNING, bg: '#fef3c7' },
                { label: '合格医生', value: `${doctorScoreStats.fairCount}人`, icon: <CheckCircle size={16} />, color: '#f97316', bg: '#fed7aa' },
                { label: '待改进', value: `${doctorScoreStats.poorCount}人`, icon: <AlertTriangle size={16} />, color: DANGER, bg: '#fee2e2' },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: card.color, marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: card.color, marginTop: 2 }}>{card.label}</div>
                </div>
              ))}
            </div>
            {/* 排行榜表格 */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['排名', '医生姓名', '总分', '格式分(30%)', '准确分(50%)', '时效分(20%)', '报告数', '绩效等级'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctorScoreData.map((doctor, idx) => {
                  const isTop3 = doctor.rank <= 3
                  const rankBgColor = doctor.rank === 1 ? '#fef3c7' : doctor.rank === 2 ? '#f1f5f9' : doctor.rank === 3 ? '#fef3c7' : idx % 2 === 0 ? WHITE : '#fafbfc'
                  const rankColor = doctor.rank === 1 ? '#92400e' : doctor.rank === 2 ? '#475569' : doctor.rank === 3 ? '#92400e' : PRIMARY
                  const gradeColor = doctor.totalScore >= 90 ? SUCCESS : doctor.totalScore >= 80 ? WARNING : doctor.totalScore >= 70 ? '#f97316' : DANGER
                  const gradeLabel = doctor.totalScore >= 90 ? '优秀' : doctor.totalScore >= 80 ? '良好' : doctor.totalScore >= 70 ? '合格' : '待改进'
                  return (
                    <tr key={doctor.id} style={{ borderBottom: `1px solid ${BORDER}`, background: rankBgColor }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = rankBgColor}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {isTop3 ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Award size={16} color={doctor.rank === 1 ? '#fbbf24' : doctor.rank === 2 ? '#94a3b8' : '#cd7f32'} />
                            <span style={{ fontWeight: 800, fontSize: 14, color: rankColor }}>{doctor.rank}</span>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700, fontSize: 13, color: GRAY }}>{doctor.rank}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{doctor.name}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: gradeColor }}>{doctor.totalScore}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.formatScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.accuracyScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.timelinessScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: GRAY }}>{doctor.reportCount}份</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', background: doctor.totalScore >= 90 ? '#d1fae5' : doctor.totalScore >= 80 ? '#fef3c7' : doctor.totalScore >= 70 ? '#fed7aa' : '#fee2e2', color: gradeColor, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {gradeLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 质控问题分布 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 问题类型统计 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />质控问题分布<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>本月统计</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {qcIssueDistribution.map(item => (
                  <div key={item.issueType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{item.issueType}</span>
                    <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{item.count}例</span>
                    <span style={{ fontSize: 12, color: GRAY, minWidth: 32 }}>{item.percentage}%</span>
                    <span style={{ fontSize: 12, padding: '1px 5px', background: item.trend === '下降' ? '#d1fae5' : item.trend === '上升' ? '#fee2e2' : '#f1f5f9', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>
                      {item.trend === '下降' ? '↓' : item.trend === '上升' ? '↑' : '→'}
                    </span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width='100%' height={140}>
                <BarChart data={qcIssueDistribution} layout='vertical'>
                  <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                  <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                  <YAxis dataKey='issueType' type='category' tick={{ fontSize: 12, color: GRAY }} width={70} />
                  <Tooltip formatter={(v) => [`${v}例`, '数量']} />
                  <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                    {qcIssueDistribution.map((entry) => (
                      <Cell key={entry.issueType} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 各维度平均分 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={16} color={PRIMARY} />各维度平均得分<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>全体医生</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: '格式规范', score: doctorScoreStats.avgFormatScore, weight: '30%', color: '#3b82f6' },
                  { label: '诊断准确', score: doctorScoreStats.avgAccuracyScore, weight: '50%', color: '#059669' },
                  { label: '时效性', score: doctorScoreStats.avgTimelinessScore, weight: '20%', color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.label}</span>
                        <span style={{ padding: '1px 6px', background: `${item.color}20`, color: item.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{item.weight}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: item.score >= 85 ? SUCCESS : item.score >= 75 ? WARNING : DANGER }}>{item.score.toFixed(1)}分</span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                      <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: GRAY }}>综合加权平均分</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: PRIMARY }}>{doctorScoreStats.avgTotalScore.toFixed(1)}分</span>
                </div>
              </div>
            </div>
          </div>

          {/* 甲乙丙丁等级分布 */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={16} color={PRIMARY} />报告质量等级分布（甲乙丙丁）<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {gradeDistributionData.map(item => (
                <div key={item.grade} style={{ background: item.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `2px solid ${item.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.grade}</div>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.count}份</div>
                  <div style={{ fontSize: 12, color: item.color }}>{item.percentage}%</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width='100%' height={140}>
              <BarChart data={gradeDistributionData} layout='vertical'>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                <YAxis dataKey='grade' type='category' tick={{ fontSize: 12, color: GRAY }} width={20} />
                <Tooltip formatter={(v) => [`${v}份`, '数量']} />
                <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                  {gradeDistributionData.map((entry) => (
                    <Cell key={entry.grade} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Search & Filter */}
          <div style={{ background: WHITE, borderRadius: 10, padding: 12, border: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: LIGHT_BG, borderRadius: 8, padding: '8px 12px' }}>
              <Search size={14} color={GRAY} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者姓名、报告ID..." style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent', color: PRIMARY }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['全部', '优秀', '良好', '一般', '差'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${filterStatus === s ? ACCENT : BORDER}`, background: filterStatus === s ? ACCENT : WHITE, color: filterStatus === s ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Report List */}
          <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['报告ID', '患者姓名', '报告医生', '审核医生', '等级', '总分', '完整性', '准确性', '规范性', '及时性', '状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{r.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{r.reportDoctor}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{r.reviewDoctor}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: GRADE_COLORS[r.grade]?.bg, color: GRADE_COLORS[r.grade]?.color, fontWeight: 800, fontSize: 13, border: `2px solid ${GRADE_COLORS[r.grade]?.border}` }}>
                        {r.grade}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: SCORE_COLORS[r.status as keyof typeof SCORE_COLORS] }}>{r.score}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{renderScoreBar(r.completeness)}</td>
                    <td style={{ padding: '10px 12px' }}>{renderScoreBar(r.accuracy)}</td>
                    <td style={{ padding: '10px 12px' }}>{renderScoreBar(r.standardization)}</td>
                    <td style={{ padding: '10px 12px' }}>{renderScoreBar(r.timeliness)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 10px', background: STATUS_COLORS[r.status]?.bg, color: STATUS_COLORS[r.status]?.color, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => handleOpenRating(r)} style={{ padding: '4px 10px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                        <Eye size={12} />{t('qc.detail')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {statCardsImage.map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Image QC Table */}
          <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['检查号', '患者', '设备', '影像评分', '主要问题', '状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imageFiltered.map((img, idx) => (
                  <tr key={img.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{img.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{img.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{img.device.split('（')[0]}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: SCORE_COLORS[img.status as keyof typeof SCORE_COLORS] }}>{img.score}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {img.issues.length === 0 ? (
                          <span style={{ fontSize: 12, color: SUCCESS }}>{t('qcimage.noIssues')}</span>
                        ) : img.issues.map(issue => (
                          <span key={issue} style={{ padding: '2px 6px', background: '#fee2e2', color: DANGER, borderRadius: 4, fontSize: 12 }}>{issue}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 10px', background: STATUS_COLORS[img.status]?.bg, color: STATUS_COLORS[img.status]?.color, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                        {img.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => { setDetailModal({ show: true, title: `影像详情 ${img.id}`, content: `正在查看影像 ${img.id}` }) }} style={{ padding: '4px 10px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                        <Image size={12} />{t('qcimage.viewImage')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Waste Film Analysis Chart */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PieChart size={16} color={ACCENT} />{t('qcimage.rejectDistribution')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
              <ResponsiveContainer width='100%' height={220}>
                <RechartsPie>
                  <Pie data={dashboardData.issueDistribution} cx='50%' cy='50%' innerRadius={55} outerRadius={90} paddingAngle={3} dataKey='value' label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {dashboardData.issueDistribution.map((entry, _idx) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}例`} />
                </RechartsPie>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dashboardData.issueDistribution.map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                    <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{item.value}例</span>
                    <span style={{ fontSize: 12, color: GRAY }}>{Math.round(item.value / dashboardData.issueDistribution.reduce((s, i) => s + i.value, 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeout' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ background: WHITE, borderRadius: 10, padding: '16px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Clock size={18} color={WARNING} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.timeoutCount')}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: WARNING }}>{timeoutData.length}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>占今日报告 {(timeoutData.length / reportQCData.length * 100).toFixed(0)}%</div>
            </div>
            <div style={{ background: WHITE, borderRadius: 10, padding: '16px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={18} color={DANGER} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.severeTimeout')}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: DANGER }}>{timeoutData.filter(t => t.severity === '严重').length}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>延迟超过3小时</div>
            </div>
            <div style={{ background: WHITE, borderRadius: 10, padding: '16px 20px', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={18} color={ACCENT} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.avgDelay')}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: ACCENT }}>{Math.round(timeoutData.reduce((s, t) => s + t.delayMinutes, 0) / timeoutData.length)}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>分钟/例</div>
            </div>
          </div>

          {/* Timeout List */}
          <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['检查号', '患者', '检查项目', '计划时间', '实际报告', '延迟(分钟)', '超时原因', '严重程度'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeoutData.map((t, idx) => {
                  const severityColor = t.severity === '严重' ? DANGER : t.severity === '中等' ? WARNING : GRAY
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY }}>{t.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{t.examItem}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.scheduledTime}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.actualReportTime}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: t.delayMinutes > 180 ? DANGER : t.delayMinutes > 120 ? WARNING : GRAY }}>
                          {t.delayMinutes}′
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{t.reason}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', background: t.severity === '严重' ? '#fee2e2' : t.severity === '中等' ? '#fef3c7' : '#f1f5f9', color: severityColor, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {t.severity}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Reason Analysis & Suggestions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qc.timeoutAnalysis')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { reason: '设备维护/故障延迟', count: 1, pct: '25%' },
                  { reason: '报告医师临时会议/培训', count: 1, pct: '25%' },
                  { reason: '急诊优先导致积压', count: 1, pct: '25%' },
                  { reason: '体检高峰时段积压', count: 1, pct: '25%' },
                ].map(item => (
                  <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{item.reason}</div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                        <div style={{ width: item.pct, height: '100%', background: WARNING, borderRadius: 3 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, minWidth: 40, textAlign: 'right' }}>{item.count}例</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={16} color={SUCCESS} />{t('qcdefect.suggestions')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { suggestion: '建立设备预防性维护机制，减少突发故障', priority: '高' },
                  { suggestion: '会议/培训时间错开报告高峰时段', priority: '中' },
                  { suggestion: '增设体检报告快速通道', priority: '中' },
                  { suggestion: '优化急诊报告优先级调度算法', priority: '高' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: PRIMARY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{item.suggestion}</div>
                    </div>
                    <span style={{ padding: '1px 8px', background: item.priority === '高' ? '#fee2e2' : '#fef3c7', color: item.priority === '高' ? DANGER : WARNING, borderRadius: 10, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {item.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 抽检统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { label: '本月抽检总数', value: inspectionStats.totalInspected, icon: <ClipboardList size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
              { label: '抽检通过率', value: `${inspectionStats.passedRate}%`, icon: <CheckCircle size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
              { label: '抽检甲级率', value: `${inspectionStats.excellentRate}%`, icon: <Award size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
              { label: '缺陷发现率', value: `${inspectionStats.defectRate}%`, icon: <AlertTriangle size={18} color={WARNING} />, bg: '#fef3c7', color: WARNING },
              { label: '抽检平均分', value: inspectionStats.avgScore.toFixed(1), icon: <Star size={18} color={'#8b5cf6'} />, bg: '#ede9fe', color: '#8b5cf6' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 抽检结果等级分布 + 缺陷统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 抽检等级分布 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardCheck size={16} color={PRIMARY} />{t('qcdefect.gradeDistribution')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {gradeDistributionData.map(item => (
                  <div key={item.grade} style={{ background: item.bg, borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: `2px solid ${item.color}` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.grade}</div>
                    <div style={{ fontSize: 12, color: item.color, fontWeight: 600 }}>{item.label.split('（')[1]?.replace('）', '')}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.count}份</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width='100%' height={130}>
                <RechartsPie>
                  <Pie data={gradeDistributionData} cx='50%' cy='50%' innerRadius={40} outerRadius={65} paddingAngle={3} dataKey='count' label={({ grade, percent }) => `${grade}级 ${(percent * 100).toFixed(0)}%`}>
                    {gradeDistributionData.map(entry => (
                      <Cell key={entry.grade} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}份`} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* 抽检缺陷类型分布 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qcdefect.defectStats')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reportDefectData.map(item => (
                  <div key={item.defectType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{item.defectType}</span>
                    <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{item.count}例</span>
                    <span style={{ fontSize: 12, color: GRAY, minWidth: 32 }}>{item.percentage}%</span>
                    <span style={{ fontSize: 12, padding: '1px 5px', background: item.trend === '下降' ? '#d1fae5' : item.trend === '上升' ? '#fee2e2' : '#f1f5f9', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>
                      {item.trend === '下降' ? '↓' : item.trend === '上升' ? '↑' : '→'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 抽检记录列表 */}
          <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={16} color={ACCENT} />{t('qcdefect.inspectionList')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
              </h3>
              <button
                onClick={() => { setFormModal({ show: true, title: '新增抽检记录' }) }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${ACCENT}`,
                  background: ACCENT,
                  color: WHITE,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} />{t('qcdefect.newInspection')}</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['抽检ID', '报告ID', '患者', '报告医生', '抽检医生', '抽检日期', '等级', '评分', '缺陷', '审核意见', '状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspectionRecordsData.map((record, idx) => (
                  <tr key={record.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{record.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: ACCENT }}>{record.reportId}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{record.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{record.reportDoctor}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{record.inspector}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{record.inspectionDate}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: GRADE_COLORS[record.grade]?.bg, color: GRADE_COLORS[record.grade]?.color, fontWeight: 800, fontSize: 12, border: `2px solid ${GRADE_COLORS[record.grade]?.border}` }}>
                        {record.grade}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: record.score >= 90 ? SUCCESS : record.score >= 80 ? WARNING : DANGER }}>{record.score}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {record.defects.length === 0 ? (
                          <span style={{ fontSize: 12, color: SUCCESS }}>{t('qcdefect.none')}</span>
                        ) : record.defects.map(d => (
                          <span key={d} style={{ padding: '1px 5px', background: '#fee2e2', color: DANGER, borderRadius: 4, fontSize: 12 }}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155', maxWidth: 150 }}>{record.inspectorComment}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', background: record.status === '已通过' ? '#d1fae5' : record.status === '需整改' ? '#fef3c7' : '#fee2e2', color: record.status === '已通过' ? SUCCESS : record.status === '需整改' ? WARNING : DANGER, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => { setDetailModal({ show: true, title: `抽检详情 ${record.id}`, content: record.inspectorComment }) }} style={{ padding: '3px 8px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.detail')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 抽检问题汇总与改进建议 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qcdefect.issueSummary')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { issue: '描述不完整/漏项', count: inspectionRecordsData.filter(r => r.defects.includes('描述不完整/漏项')).length, severity: '高' },
                  { issue: '术语使用不规范', count: inspectionRecordsData.filter(r => r.defects.includes('术语使用不规范')).length, severity: '中' },
                  { issue: '诊断结论不明确', count: inspectionRecordsData.filter(r => r.defects.includes('诊断结论不明确')).length, severity: '高' },
                  { issue: '危急值漏报/迟报', count: inspectionRecordsData.filter(r => r.defects.includes('危急值漏报/迟报')).length, severity: '高' },
                ].map(item => (
                  <div key={item.issue} style={{ display: 'flex', alignItems: 'center', gap: 10, background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.severity === '高' ? DANGER : WARNING, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{item.issue}</span>
                    <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{item.count}例</span>
                    <span style={{ padding: '1px 6px', background: item.severity === '高' ? '#fee2e2' : '#fef3c7', color: item.severity === '高' ? DANGER : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {item.severity === '高' ? '严重' : '中等'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={16} color={SUCCESS} />{t('qcdefect.suggestions')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { suggestion: '针对描述不完整问题，组织报告规范书写培训', priority: '高' },
                  { suggestion: '建立常用医学术语库，减少不规范术语使用', priority: '中' },
                  { suggestion: '完善危急值报告制度，加强流程监管', priority: '高' },
                  { suggestion: '定期发布甲级报告示例，供医生学习参考', priority: '中' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: PRIMARY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{item.suggestion}</div>
                    </div>
                    <span style={{ padding: '1px 8px', background: item.priority === '高' ? '#fee2e2' : '#fef3c7', color: item.priority === '高' ? DANGER : WARNING, borderRadius: 10, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {item.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '达标率', value: `${dashboardData.passRate}%`, icon: <Target size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
              { label: '优良率', value: `${dashboardData.excellentRate}%`, icon: <Award size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
              { label: '总审核数', value: dashboardData.totalReviewed, icon: <FileText size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
              { label: '综合评分', value: dashboardData.avgScore.toFixed(1), icon: <Star size={18} color={'#8b5cf6'} />, bg: '#ede9fe', color: '#8b5cf6' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Pass Rate Ring */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>达标率 / 优良率</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ResponsiveContainer width='100%' height={180}>
                  <RechartsPie>
                    <Pie data={[{ name: '达标', value: dashboardData.passRate }, { name: '未达标', value: 100 - dashboardData.passRate }]} cx='50%' cy='50%' innerRadius={50} outerRadius={75} dataKey='value'>
                      <Cell fill={SUCCESS} /><Cell fill='#e2e8f0' />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </RechartsPie>
                </ResponsiveContainer>
                <ResponsiveContainer width='100%' height={180}>
                  <RechartsPie>
                    <Pie data={[{ name: '优良', value: dashboardData.excellentRate }, { name: '非优良', value: 100 - dashboardData.excellentRate }]} cx='50%' cy='50%' innerRadius={50} outerRadius={75} dataKey='value'>
                      <Cell fill={'#f59e0b'} /><Cell fill='#e2e8f0' />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SUCCESS }}>{dashboardData.passRate}%</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{t('qc.passRate')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{dashboardData.excellentRate}%</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{t('qc.excellentRate')}</div>
                </div>
              </div>
            </div>

            {/* Issue Distribution */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.imageIssueDist')}</h3>
              <ResponsiveContainer width='100%' height={200}>
                <BarChart data={dashboardData.issueDistribution} layout='vertical'>
                  <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                  <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                  <YAxis dataKey='name' type='category' tick={{ fontSize: 12, color: GRAY }} width={80} />
                  <Tooltip formatter={(v) => `${v}例`} />
                  <Bar dataKey='value' radius={[0, 4, 4, 0]}>
                    {dashboardData.issueDistribution.map((entry, _idx) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Chart */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0 }}>{t('qc.scoreTrend')}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setTrendRange('7d')} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${trendRange === '7d' ? ACCENT : BORDER}`, background: trendRange === '7d' ? ACCENT : WHITE, color: trendRange === '7d' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.sevenDays')}</button>
                <button onClick={() => setTrendRange('30d')} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${trendRange === '30d' ? ACCENT : BORDER}`, background: trendRange === '30d' ? ACCENT : WHITE, color: trendRange === '30d' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.thirtyDays')}</button>
              </div>
            </div>
            <ResponsiveContainer width='100%' height={240}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis dataKey='date' tick={{ fontSize: 12, color: GRAY }} />
                <YAxis domain={[75, 95]} tick={{ fontSize: 12, color: GRAY }} />
                <Tooltip formatter={(v, name) => [name === 'score' ? `${v}分` : `${v}份`, name === 'score' ? '评分' : '报告数']} />
                <Area type='monotone' dataKey='score' stroke={ACCENT} fill='#dbeafe' strokeWidth={2} name='score' />
                <Line type='monotone' dataKey='count' stroke={SUCCESS} strokeWidth={1.5} dot={false} name='count' />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Weak Links & Target Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qc.weakLinks')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dashboardData.weakLinks.map((link, _idx) => (
                  <div key={link} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef3c7', borderRadius: 8, padding: '10px 14px' }}>
                    <AlertTriangle size={16} color={WARNING} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#92400e' }}>{link}</span>
                    <span style={{ fontSize: 12, color: WARNING }}>{t('qc.needsImprove')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={16} color={ACCENT} />{t('qc.targetVsActual')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '报告及时率', target: '95%', actual: '88%', color: DANGER },
                  { label: '优良率', target: '70%', actual: '65%', color: WARNING },
                  { label: '废片率', target: '<2%', actual: '1.8%', color: SUCCESS },
                  { label: '危急值10min内通知', target: '100%', actual: '96%', color: WARNING },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#334155' }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: GRAY }}>目标: {item.target} | 实际: <span style={{ fontWeight: 700, color: item.color }}>{item.actual}</span></span>
                    </div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, position: 'relative' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: item.color, width: `${(parseFloat(item.actual.replace('%', '')) / parseFloat(item.target.replace('%', '').replace('<', ''))) * 100}%`, maxWidth: '100%', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 区域影像质控 Tab ==================== */}
      {activeTab === 'regional' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 区域质控子Tab */}
          {renderRegionalSubTabs()}

          {/* 区域总览 */}
          {regionalTab === 'overview' && (
            <>
              {/* 区域接入统计 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color={ACCENT} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{regionalInstitutions.length}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.institutionCount')}</div>
                  </div>
                </div>
                <div style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} color={SUCCESS} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{regionalInstitutions.reduce((sum, inst) => sum + inst.reportsThisMonth, 0).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.monthlyReportTotal')}</div>
                  </div>
                </div>
                <div style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={18} color='#f59e0b' />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{(regionalInstitutions.reduce((sum, inst) => sum + inst.avgScore, 0) / regionalInstitutions.length).toFixed(1)}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.regionalScore')}</div>
                  </div>
                </div>
                <div style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={18} color='#8b5cf6' />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{(regionalInstitutions.filter(i => i.level === '三甲').length + regionalInstitutions.filter(i => i.level === '三乙').length)}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.tertiaryHospitals')}</div>
                  </div>
                </div>
              </div>

              {/* 区域趋势图 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} color={ACCENT} />{t('qc.regionalTrend')}</h3>
                <ResponsiveContainer width='100%' height={260}>
                  <AreaChart data={regionalOverallScores}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[75, 95]} tick={{ fontSize: 12, color: GRAY }} />
                    <Tooltip formatter={(v, name) => {
                      if (name === 'avgScore') return [`${v}分`, '综合评分']
                      if (name === 'excellentRate') return [`${v}%`, '优良率']
                      if (name === 'passRate') return [`${v}%`, '达标率']
                      return [v, name]
                    }} />
                    <Area type='monotone' dataKey='avgScore' stroke={ACCENT} fill='#dbeafe' strokeWidth={2} name='avgScore' />
                    <Line type='monotone' dataKey='excellentRate' stroke={SUCCESS} strokeWidth={1.5} dot={false} name='excellentRate' />
                    <Line type='monotone' dataKey='passRate' stroke={WARNING} strokeWidth={1.5} dot={false} name='passRate' />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: ACCENT, borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{t('qc.compositeScore')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: SUCCESS, borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{t('qc.excellentRate')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: WARNING, borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{t('qc.passRate')}</span>
                  </div>
                </div>
              </div>

              {/* 机构列表 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={16} color={ACCENT} />{t('qc.regionalInstitutions')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {regionalInstitutions.slice(0, 4).map(inst => (
                    <div
                      key={inst.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: LIGHT_BG,
                        borderRadius: 8,
                        border: `1px solid ${BORDER}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedInstitution(expandedInstitution === inst.id ? null : inst.id)}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: inst.ranking <= 3 ? '#fef3c7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inst.ranking <= 3 ? (
                          <Award size={18} color={inst.ranking === 1 ? '#fbbf24' : inst.ranking === 2 ? '#94a3b8' : '#cd7f32'} />
                        ) : (
                          <Building2 size={18} color={ACCENT} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{inst.name}</span>
                          <span style={{ padding: '1px 6px', background: inst.level === '三甲' ? '#dbeafe' : inst.level === '三乙' ? '#d1fae5' : '#fef3c7', color: inst.level === '三甲' ? ACCENT : inst.level === '三乙' ? SUCCESS : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{inst.level}</span>
                          <span style={{ fontSize: 12, color: GRAY }}>第{inst.ranking}名</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: GRAY }}>本月报告: <span style={{ fontWeight: 600, color: PRIMARY }}>{inst.reportsThisMonth.toLocaleString()}</span></span>
                          <span style={{ fontSize: 12, color: GRAY }}>平均分: <span style={{ fontWeight: 600, color: inst.avgScore >= 85 ? SUCCESS : inst.avgScore >= 80 ? WARNING : DANGER }}>{inst.avgScore}</span></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {inst.trend === 'up' ? <TrendingUp size={14} color={SUCCESS} /> : inst.trend === 'down' ? <TrendingDown size={14} color={DANGER} /> : <Minus size={14} color={GRAY} />}
                        {expandedInstitution === inst.id ? <ChevronUp size={14} color={GRAY} /> : <ChevronDown size={14} color={GRAY} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 不合格原因分析 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color={WARNING} />{t('qc.unqualifiedAnalysis')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <ResponsiveContainer width='100%' height={200}>
                      <BarChart data={unqualifiedReasonData} layout='vertical'>
                        <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                        <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                        <YAxis dataKey='reason' type='category' tick={{ fontSize: 12, color: GRAY }} width={90} />
                        <Tooltip formatter={(v) => [`${v}例`, '数量']} />
                        <Bar dataKey='count' fill={WARNING} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {unqualifiedReasonData.map(item => (
                      <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{item.reason}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{item.count}例</span>
                        <span style={{ fontSize: 12, color: GRAY, minWidth: 36 }}>{item.percentage}%</span>
                        <span style={{ fontSize: 12, padding: '1px 6px', background: item.trend === '下降' ? '#d1fae5' : item.trend === '上升' ? '#fee2e2' : '#f1f5f9', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>{item.trend}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 机构排名 */}
          {regionalTab === 'ranking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={16} color={ACCENT} />{t('qc.regionalRanking')}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                      {['排名', '医疗机构', '综合评分', '图像质量', '报告质量', '时效性', '危急值报告', '趋势'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regionalRanking.map((r, idx) => (
                      <tr key={r.ranking} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc'}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: r.ranking === 1 ? '#fef3c7' : r.ranking === 2 ? '#f1f5f9' : r.ranking === 3 ? '#fef3c7' : '#eff6ff',
                            color: r.ranking === 1 ? '#92400e' : r.ranking === 2 ? '#475569' : r.ranking === 3 ? '#92400e' : ACCENT,
                            fontWeight: 800,
                            fontSize: 12,
                          }}>
                            {r.ranking}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                          <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{r.institution}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: r.score >= 85 ? SUCCESS : r.score >= 80 ? WARNING : DANGER }}>{r.score}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(r.imageQuality)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(r.reportQuality)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(r.timeliness)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: r.criticalValueReport >= 95 ? SUCCESS : r.criticalValueReport >= 90 ? WARNING : DANGER }}>{r.criticalValueReport}%</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {r.trend === 'up' ? <TrendingUp size={14} color={SUCCESS} /> : r.trend === 'down' ? <TrendingDown size={14} color={DANGER} /> : <Minus size={14} color={GRAY} />}
                            {r.trend !== 'same' && (
                              <span style={{ fontSize: 12, fontWeight: 600, color: r.trend === 'up' ? SUCCESS : DANGER }}>
                                {r.trend === 'up' ? '+' : ''}{r.trendValue}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 雷达图对比 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.top3Comparison')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <ResponsiveContainer width='100%' height={280}>
                    <RadarChart data={[
                      { subject: '图像质量', top1: 93, top2: 91, top3: 89 },
                      { subject: '报告质量', top1: 90, top2: 88, top3: 88 },
                      { subject: '时效性', top1: 88, top2: 87, top3: 86 },
                      { subject: '危急值报告', top1: 98, top2: 96, top3: 95 },
                    ]}>
                      <PolarGrid stroke='#e2e8f0' />
                      <PolarAngleAxis dataKey='subject' tick={{ fontSize: 12, color: GRAY }} />
                      <Radar name='市第一人民医院' dataKey='top1' stroke={PIE_COLORS[0]} fill={PIE_COLORS[0]} fillOpacity={0.2} />
                      <Radar name='市中医院' dataKey='top2' stroke={PIE_COLORS[1]} fill={PIE_COLORS[1]} fillOpacity={0.2} />
                      <Radar name='市第三医院' dataKey='top3' stroke={PIE_COLORS[2]} fill={PIE_COLORS[2]} fillOpacity={0.2} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { name: '市第一人民医院', score: 91.2, color: PIE_COLORS[0], rank: 1 },
                      { name: '市中医院', score: 89.5, color: PIE_COLORS[1], rank: 2 },
                      { name: '市第三医院', score: 88.7, color: PIE_COLORS[2], rank: 3 },
                    ].map(inst => (
                      <div key={inst.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: inst.rank <= 3 ? '#fef3c7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: '#92400e' }}>{inst.rank}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{inst.name}</div>
                          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 6 }}>
                            <div style={{ width: `${inst.score}%`, height: '100%', background: inst.color, borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: inst.color }}>{inst.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 质控标准管理 */}
          {regionalTab === 'standards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 图像质量标准 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Image size={16} color={ACCENT} />{t('qc.imageQualityStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { level: '优秀', min: '≥90分', desc: qcStandards.imageQuality.excellent.desc, color: SUCCESS, bg: '#d1fae5' },
                    { level: '良好', min: '80-89分', desc: qcStandards.imageQuality.good.desc, color: WARNING, bg: '#fef3c7' },
                    { level: '一般', min: '70-79分', desc: qcStandards.imageQuality.fair.desc, color: '#f97316', bg: '#fed7aa' },
                    { level: '差', min: '<70分', desc: qcStandards.imageQuality.poor.desc, color: DANGER, bg: '#fee2e2' },
                  ].map(item => (
                    <div key={item.level} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `2px solid ${item.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.level}</span>
                        <span style={{ padding: '2px 8px', background: item.color, color: WHITE, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{item.min}</span>
                      </div>
                      <div style={{ fontSize: 12, color: item.color, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 报告质量标准 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color={ACCENT} />{t('qc.reportQualityStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { level: '优秀', min: '≥90分', desc: qcStandards.reportQuality.excellent.desc, color: SUCCESS, bg: '#d1fae5' },
                    { level: '良好', min: '80-89分', desc: qcStandards.reportQuality.good.desc, color: WARNING, bg: '#fef3c7' },
                    { level: '一般', min: '70-79分', desc: qcStandards.reportQuality.fair.desc, color: '#f97316', bg: '#fed7aa' },
                    { level: '差', min: '<70分', desc: qcStandards.reportQuality.poor.desc, color: DANGER, bg: '#fee2e2' },
                  ].map(item => (
                    <div key={item.level} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `2px solid ${item.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.level}</span>
                        <span style={{ padding: '2px 8px', background: item.color, color: WHITE, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{item.min}</span>
                      </div>
                      <div style={{ fontSize: 12, color: item.color, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 检查时效标准 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color={ACCENT} />{t('qc.reportTimelinessStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { type: '危急值', minutes: '≤30分钟', desc: qcStandards.timeliness.urgent.desc, color: DANGER, bg: '#fee2e2', icon: <AlertTriangle size={16} /> },
                    { type: '急诊', minutes: '≤60分钟', desc: qcStandards.timeliness.stat.desc, color: WARNING, bg: '#fef3c7', icon: <Zap size={16} /> },
                    { type: '常规', minutes: '≤2小时', desc: qcStandards.timeliness.routine.desc, color: ACCENT, bg: '#eff6ff', icon: <Clock size={16} /> },
                    { type: '特殊', minutes: '≤4小时', desc: qcStandards.timeliness.extended.desc, color: '#8b5cf6', bg: '#ede9fe', icon: <FileText size={16} /> },
                  ].map(item => (
                    <div key={item.type} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `1px solid ${item.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ color: item.color }}>{item.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.type}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.color, marginBottom: 6 }}>{item.minutes}</div>
                      <div style={{ fontSize: 12, color: item.color, lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 危急值漏报标准 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color={DANGER} />{t('qc.criticalValueStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { type: '10min内通知', rate: '100%', desc: qcStandards.criticalValue.required.desc, color: SUCCESS, bg: '#d1fae5' },
                    { type: '登记完整率', rate: '≥95%', desc: qcStandards.criticalValue.reported.desc, color: SUCCESS, bg: '#d1fae5' },
                    { type: '回访确认率', rate: '≥90%', desc: qcStandards.criticalValue.callback.desc, color: WARNING, bg: '#fef3c7' },
                  ].map(item => (
                    <div key={item.type} style={{ background: item.bg, borderRadius: 10, padding: '16px', border: `1px solid ${item.color}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.type}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.rate}</div>
                      <div style={{ fontSize: 12, color: item.color, marginTop: 8, lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 质控报表 */}
          {regionalTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 报表类型切换 */}
              <div style={{ background: WHITE, borderRadius: 12, padding: 12, border: `1px solid ${BORDER}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginRight: 8 }}>{t('qc.reportType')}</span>
                {[
                  { key: 'monthly', label: '月报', icon: <FileBarChart size={14} /> },
                  { key: 'quarterly', label: '季报', icon: <BarChart2 size={14} /> },
                  { key: 'yearly', label: '年报', icon: <FileBarChart size={14} /> },
                ].map(type => (
                  <button
                    key={type.key}
                    onClick={() => setRegionalReportType(type.key as typeof regionalReportType)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: `1px solid ${regionalReportType === type.key ? ACCENT : BORDER}`,
                      background: regionalReportType === type.key ? ACCENT : WHITE,
                      color: regionalReportType === type.key ? WHITE : GRAY,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleExportPDF(regionalReportType === 'monthly' ? '月度质控报告' : regionalReportType === 'quarterly' ? '季度质控报告' : '年度质控报告')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: WHITE,
                      color: PRIMARY,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Download size={14} />{t('qc.exportPdf')}</button>
                </div>
              </div>

              {/* 月报内容 */}
              {regionalReportType === 'monthly' && (
                <>
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileBarChart size={16} color={ACCENT} />{reportSummaryData.monthly.period} 质控月报
                      </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: '报告总量', value: reportSummaryData.monthly.totalReports.toLocaleString(), icon: <FileText size={16} />, color: ACCENT, bg: '#eff6ff' },
                        { label: '平均评分', value: reportSummaryData.monthly.avgScore, icon: <Star size={16} />, color: '#f59e0b', bg: '#fef3c7' },
                        { label: '达标率', value: `${reportSummaryData.monthly.passRate}%`, icon: <Target size={16} />, color: SUCCESS, bg: '#d1fae5' },
                        { label: '超时报告', value: reportSummaryData.monthly.timeoutCount, icon: <Clock size={16} />, color: WARNING, bg: '#fef3c7' },
                      ].map(card => (
                        <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: card.color }}>{card.icon}</span>
                            <span style={{ fontSize: 12, color: card.color, fontWeight: 600 }}>{card.label}</span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>优秀报告数: {reportSummaryData.monthly.excellentCount.toLocaleString()}</h4>
                        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                          <div style={{ width: `${reportSummaryData.monthly.excellentCount / reportSummaryData.monthly.totalReports * 100}%`, height: '100%', background: SUCCESS, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: GRAY }}>优良率: {Math.round(reportSummaryData.monthly.excellentCount / reportSummaryData.monthly.totalReports * 100)}%</span>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>危急值报告: {reportSummaryData.monthly.criticalValueReported}</h4>
                        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                          <div style={{ width: `${reportSummaryData.monthly.criticalValueOnTime / reportSummaryData.monthly.criticalValueReported * 100}%`, height: '100%', background: ACCENT, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: GRAY }}>及时率: {Math.round(reportSummaryData.monthly.criticalValueOnTime / reportSummaryData.monthly.criticalValueReported * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 问题分布 */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px' }}>{t('qc.monthlyIssues')}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      <ResponsiveContainer width='100%' height={180}>
                        <PieChart>
                          <Pie data={reportSummaryData.monthly.issues} cx='50%' cy='50%' innerRadius={45} outerRadius={75} paddingAngle={3} dataKey='count' label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}>
                            {reportSummaryData.monthly.issues.map((entry, idx) => (
                              <Cell key={entry.type} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => `${v}例`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {reportSummaryData.monthly.issues.map((item, idx) => (
                          <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{item.type}</span>
                            <span style={{ fontWeight: 700, color: PRIMARY }}>{item.count}例</span>
                            <span style={{ fontSize: 12, color: GRAY }}>{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 季报内容 */}
              {regionalReportType === 'quarterly' && (
                <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={16} color={ACCENT} />{reportSummaryData.quarterly.period} 质控季报
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: '报告总量', value: reportSummaryData.quarterly.totalReports.toLocaleString(), color: ACCENT, bg: '#eff6ff' },
                      { label: '平均评分', value: reportSummaryData.quarterly.avgScore, color: '#f59e0b', bg: '#fef3c7' },
                      { label: '达标率', value: `${reportSummaryData.quarterly.passRate}%`, color: SUCCESS, bg: '#d1fae5' },
                      { label: '超时报告', value: reportSummaryData.quarterly.timeoutCount, color: WARNING, bg: '#fef3c7' },
                    ].map(card => (
                      <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, color: card.color, fontWeight: 600, marginBottom: 6 }}>{card.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>环比变化</h4>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {reportSummaryData.quarterly.trends.map(item => (
                        <div key={item.metric} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: GRAY }}>{item.metric}:</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{item.value}</span>
                          <span style={{ fontSize: 12, color: item.trend === 'up' ? SUCCESS : item.trend === 'down' ? DANGER : GRAY }}>
                            {item.trend === 'up' ? <TrendingUp size={12} /> : item.trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
                            {item.change}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 年报内容 */}
              {regionalReportType === 'yearly' && (
                <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileBarChart size={16} color={ACCENT} />{reportSummaryData.yearly.period} 质控年报
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: '报告总量', value: reportSummaryData.yearly.totalReports.toLocaleString(), color: ACCENT, bg: '#eff6ff' },
                      { label: '平均评分', value: reportSummaryData.yearly.avgScore, color: '#f59e0b', bg: '#fef3c7' },
                      { label: '达标率', value: `${reportSummaryData.yearly.passRate}%`, color: SUCCESS, bg: '#d1fae5' },
                      { label: '超时报告', value: reportSummaryData.yearly.timeoutCount, color: WARNING, bg: '#fef3c7' },
                    ].map(card => (
                      <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, color: card.color, fontWeight: 600, marginBottom: 6 }}>{card.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>年度优秀机构</h4>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {reportSummaryData.yearly.rankings.map((r, idx) => (
                        <div key={r.institution} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: idx === 0 ? '#fef3c7' : LIGHT_BG, borderRadius: 8, border: `1px solid ${idx === 0 ? '#fbbf24' : BORDER}` }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx === 0 ? '#fbbf24' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Award size={14} color={idx === 0 ? WHITE : GRAY} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{r.institution}</div>
                            <div style={{ fontSize: 12, color: GRAY }}>第{idx + 1}名 · {r.score}分</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 问题追踪与整改 */}
          {regionalTab === 'tracking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} color={WARNING} />{t('qc.issueTracking')}</h3>
                  <button
                    onClick={() => { setFormModal({ show: true, title: '新增问题记录' }) }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: `1px solid ${ACCENT}`,
                      background: ACCENT,
                      color: WHITE,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Plus size={14} />{t('qc.newRecord')}</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                      {['记录ID', '机构', '问题类型', '问题描述', '严重程度', '状态', '上报日期', '整改期限', '操作'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issueTrackingData.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{item.id}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: PRIMARY, fontSize: 12 }}>{item.institution}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', background: item.issueType.includes('危急值') ? '#fee2e2' : '#fef3c7', color: item.issueType.includes('危急值') ? DANGER : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{item.issueType}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155', maxWidth: 200 }}>{item.description}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', background: item.severity === '高' ? '#fee2e2' : item.severity === '中' ? '#fef3c7' : '#f1f5f9', color: item.severity === '高' ? DANGER : item.severity === '中' ? WARNING : GRAY, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{item.severity}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', background: item.status === '已整改' ? '#d1fae5' : '#fef3c7', color: item.status === '已整改' ? SUCCESS : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{item.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{item.reportedDate}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{item.dueDate}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => { setDetailModal({ show: true, title: `问题详情 ${item.id}`, content: `${item.issueType} - ${item.description}` }) }}
                            style={{ padding: '3px 8px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >{t('qc.detail')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 整改统计 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: '待整改', count: issueTrackingData.filter(i => i.status === '整改中').length, color: WARNING, bg: '#fef3c7' },
                  { label: '已整改', count: issueTrackingData.filter(i => i.status === '已整改').length, color: SUCCESS, bg: '#d1fae5' },
                  { label: '逾期未整改', count: 0, color: DANGER, bg: '#fee2e2' },
                ].map(item => (
                  <div key={item.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={18} color={item.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.count}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Peer Review Tab ==================== */}
      {activeTab === 'peerReview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: '4px', marginBottom: 8, display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
            {[
              { key: 'assignment', label: '随机分配', icon: <Users size={14} /> },
              { key: 'scoring', label: '评分标准', icon: <Star size={14} /> },
              { key: 'reliability', label: 'Cohen Kappa', icon: <BarChart3 size={14} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setPeerReviewTab(tab.key as 'assignment' | 'scoring' | 'reliability')} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
                background: peerReviewTab === tab.key ? ACCENT : 'transparent',
                color: peerReviewTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>
          {peerReviewTab === 'assignment' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0 }}>{t('qc.blindReviewAssignment')}</h3>
                <button onClick={() => showToast('已随机分配新案例', 'success')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={14} />{t('qc.randomAssign')}</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {['案例ID', '患者', '原作者', '评审人', '盲ID', '状态', '操作'].map(h => (<th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {peerReviewAssignments.map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{a.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{a.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{a.originalAuthor}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{a.reviewer}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{a.blindedId}</span></td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: a.status === '待评分' ? '#fef3c7' : '#d1fae5', color: a.status === '待评分' ? WARNING : SUCCESS }}>{a.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => showToast(a.status === '待评分' ? '评分已提交' : '查看评分详情', 'info')} style={{ padding: '4px 10px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.score')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {peerReviewTab === 'scoring' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.reviewCriteria')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { dim: '准确性 (Accuracy)', desc: '诊断结论与影像发现的一致性', weight: '40%', icon: <Target size={20} />, color: '#059669' },
                  { dim: '完整性 (Completeness)', desc: '报告涵盖所有必要描述要素', weight: '35%', icon: <FileText size={20} />, color: '#3b82f6' },
                  { dim: '及时性 (Timeliness)', desc: '报告在标准时限内完成', weight: '25%', icon: <Clock size={20} />, color: '#f59e0b' },
                ].map(item => (
                  <div key={item.dim} style={{ background: `${item.color}10`, borderRadius: 10, padding: 16, border: `2px solid ${item.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE }}>{item.icon}</div>
                      <div><div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.dim}</div><div style={{ fontSize: 12, color: item.color, opacity: 0.7 }}>权重 {item.weight}</div></div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {peerReviewTab === 'reliability' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.kappa')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: LIGHT_BG, borderRadius: 10, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, fontWeight: 800, color: kappaData.kappaValue >= 0.75 ? SUCCESS : kappaData.kappaValue >= 0.6 ? WARNING : DANGER }}>{kappaData.kappaValue.toFixed(2)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY, marginTop: 8 }}>Cohen's Kappa</div>
                  <div style={{ padding: '4px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'inline-block', marginTop: 8, background: kappaData.kappaValue >= 0.75 ? '#d1fae5' : kappaData.kappaValue >= 0.6 ? '#fef3c7' : '#fee2e2', color: kappaData.kappaValue >= 0.75 ? SUCCESS : kappaData.kappaValue >= 0.6 ? WARNING : DANGER }}>
                    {kappaData.agreement === 'substantial' ? '高度一致' : kappaData.agreement === 'moderate' ? '中度一致' : '需要改进'}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: '评审人1', value: kappaData.reviewer1, color: ACCENT },
                      { label: '评审人2', value: kappaData.reviewer2, color: SUCCESS },
                      { label: '总案例数', value: `${kappaData.totalCases}例`, color: PRIMARY },
                      { label: '一致案例数', value: `${kappaData.agreedCases}例`, color: SUCCESS },
                      { label: '一致率', value: `${(kappaData.agreedCases / kappaData.totalCases * 100).toFixed(1)}%`, color: WARNING },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }}>
                        <span style={{ fontSize: 12, color: GRAY }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Rule-Based Report Checker Tab ==================== */}
      {activeTab === 'ruleChecker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '质量评分', value: `${overallQualityScore}/100`, icon: <Star size={18} />, color: overallQualityScore >= 80 ? SUCCESS : overallQualityScore >= 60 ? WARNING : DANGER, bg: overallQualityScore >= 80 ? '#d1fae5' : overallQualityScore >= 60 ? '#fef3c7' : '#fee2e2' },
              { label: '总规则数', value: qcRulesConfig.length, icon: <ClipboardList size={18} />, color: ACCENT, bg: '#eff6ff' },
              { label: '通过数', value: qcRulesConfig.filter(r => r.passed).length, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#d1fae5' },
              { label: '失败数', value: qcRulesConfig.filter(r => !r.passed).length, icon: <AlertTriangle size={18} />, color: DANGER, bg: '#fee2e2' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div><div style={{ fontSize: 12, color: GRAY }}>{card.label}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: WHITE, borderRadius: 10, padding: '4px', display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
            {[
              { key: 'rules', label: '规则配置', icon: <Settings size={14} /> },
              { key: 'results', label: '检查结果', icon: <CheckCircle size={14} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setRuleCheckerTab(tab.key as 'rules' | 'results')} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
                background: ruleCheckerTab === tab.key ? ACCENT : 'transparent',
                color: ruleCheckerTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>
          {ruleCheckerTab === 'rules' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.configurableRules')}</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {['structure', 'content', 'terminology', 'compliance'].map(cat => (
                  <span key={cat} style={{ padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: GRAY }}>
                    {cat === 'structure' ? '结构' : cat === 'content' ? '内容' : cat === 'terminology' ? '术语' : '合规'}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {qcRulesConfig.map(rule => {
                  const catColor = rule.category === 'structure' ? '#3b82f6' : rule.category === 'content' ? '#059669' : rule.category === 'terminology' ? '#f59e0b' : '#7c3aed'
                  return (
                    <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: LIGHT_BG, borderRadius: 8, border: `1px solid ${rule.passed ? '#d1fae5' : '#fee2e2'}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{rule.name}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>{rule.description}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: `${catColor}15`, color: catColor }}>{rule.category === 'structure' ? '结构' : rule.category === 'content' ? '内容' : rule.category === 'terminology' ? '术语' : '合规'}</span>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: rule.passed ? '#d1fae5' : '#fee2e2', color: rule.passed ? SUCCESS : DANGER }}>{rule.passed ? '通过' : '未通过'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {ruleCheckerTab === 'results' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.scoreDashboard')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="200" height="120" viewBox="0 0 200 120">
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#dc2626" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${overallQualityScore * 1.6} 160`} />
                    </svg>
                    <div style={{ position: 'absolute', bottom: 20, fontSize: 32, fontWeight: 800, color: overallQualityScore >= 80 ? SUCCESS : overallQualityScore >= 60 ? WARNING : DANGER }}>{overallQualityScore}</div>
                  </div>
                  <div style={{ fontSize: 13, color: GRAY, marginTop: 8 }}>{t('qc.overallScore')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: '结构', value: 85, color: '#3b82f6' },
                    { label: '内容', value: 78, color: '#059669' },
                    { label: '术语', value: 72, color: '#f59e0b' },
                    { label: '合规', value: 88, color: '#7c3aed' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: GRAY }}>{item.label}</span>
                        <span style={{ fontWeight: 700, color: item.color }}>{item.value}%</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                        <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Rad-Path Correlation Tab ==================== */}
      {activeTab === 'radPath' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '总对照例数', value: concordanceStats.total, icon: <Activity size={18} />, color: ACCENT, bg: '#eff6ff' },
              { label: '一致', value: concordanceStats.concordant, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#d1fae5' },
              { label: '不一致', value: concordanceStats.discordant, icon: <AlertTriangle size={18} />, color: DANGER, bg: '#fee2e2' },
              { label: '一致率', value: `${concordanceStats.total > 0 ? Math.round(concordanceStats.concordant / concordanceStats.total * 100) : 0}%`, icon: <Target size={18} />, color: '#f59e0b', bg: '#fef3c7' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div><div style={{ fontSize: 12, color: GRAY }}>{card.label}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: WHITE, borderRadius: 10, padding: '4px', display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
            {[
              { key: 'overview', label: '对照总览', icon: <Activity size={14} /> },
              { key: 'discordant', label: '不一致案例', icon: <AlertTriangle size={14} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setRadPathTab(tab.key as 'overview' | 'discordant')} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
                background: radPathTab === tab.key ? ACCENT : 'transparent',
                color: radPathTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>
          {radPathTab === 'overview' && (
            <>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.concordanceTrend')}</h3>
                <ResponsiveContainer width='100%' height={240}>
                  <AreaChart data={radPathTrend}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} unit='%' />
                    <Tooltip formatter={(v) => [`${v}%`, '一致率']} />
                    <Area type='monotone' dataKey='rate' stroke={SUCCESS} fill='#d1fae5' strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: WHITE, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                <thead>
                  <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                    {['案例ID', '患者', '影像诊断', '病理结果', '一致性', '日期'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radPathData.filter(d => d.concordance === 'concordant').map((d, idx) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{d.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY }}>{d.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{d.radDiagnosis}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{d.pathResult}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: '#d1fae5', color: SUCCESS }}>
                          {d.concordance === 'concordant' ? '一致' : d.concordance === 'discordant' ? '不一致' : '待定'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {radPathTab === 'discordant' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={DANGER} />{t('qc.discordantAnalysis')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {radPathData.filter(d => d.concordance === 'discordant').map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={18} color={DANGER} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: PRIMARY }}>{d.patientName} ({d.id})</span>
                        <span style={{ fontSize: 12, color: GRAY }}>{d.date}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#dbeafe', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginBottom: 2 }}>{t('qc.radDiagnosis')}</div>
                          <div style={{ fontSize: 12, color: '#334155' }}>{d.radDiagnosis}</div>
                        </div>
                        <div style={{ background: '#fce7f3', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 12, color: '#be185d', fontWeight: 600, marginBottom: 2 }}>{t('qc.pathResult')}</div>
                          <div style={{ fontSize: 12, color: '#334155' }}>{d.pathResult}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <button onClick={() => showToast('已发起会诊讨论', 'success')} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.startConsultation')}</button>
                        <button onClick={() => showToast('已标记需复查', 'info')} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: WHITE, color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.markReview')}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== ACR Compliance Dashboard Tab ==================== */}
      {activeTab === 'acr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '文档准备就绪度', value: `${readinessScore}%`, icon: <FileText size={18} />, color: readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER, bg: readinessScore >= 80 ? '#d1fae5' : readinessScore >= 60 ? '#fef3c7' : '#fee2e2' },
              { label: '达标模态数', value: acrRequirementsData.filter(a => a.status === '已达标').length, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#d1fae5' },
              { label: '待整改模态', value: acrRequirementsData.filter(a => a.status !== '已达标').length, icon: <AlertTriangle size={18} />, color: WARNING, bg: '#fef3c7' },
              { label: '既往检查记录', value: inspectionFindings.length, icon: <ClipboardList size={18} />, color: ACCENT, bg: '#eff6ff' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div><div style={{ fontSize: 12, color: GRAY }}>{card.label}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: WHITE, borderRadius: 10, padding: '4px', display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
            {[
              { key: 'requirements', label: 'ACR要求清单', icon: <ClipboardList size={14} /> },
              { key: 'readiness', label: '就绪度与检查', icon: <FileText size={14} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setAcrTab(tab.key as 'requirements' | 'readiness')} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
                background: acrTab === tab.key ? ACCENT : 'transparent',
                color: acrTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>
          {acrTab === 'requirements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {acrRequirementsData.map(mod => {
                const statusColor = mod.status === '已达标' ? SUCCESS : mod.status === '部分达标' ? WARNING : DANGER
                const statusBg = mod.status === '已达标' ? '#d1fae5' : mod.status === '部分达标' ? '#fef3c7' : '#fee2e2'
                return (
                  <div key={mod.modality} style={{ background: WHITE, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{mod.modality}</span>
                        <span style={{ fontSize: 12, color: GRAY }}>{mod.completed}/{mod.total} 项达标</span>
                      </div>
                      <span style={{ padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: statusBg, color: statusColor }}>{mod.status}</span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginBottom: 12 }}>
                      <div style={{ width: `${(mod.completed / mod.total) * 100}%`, height: '100%', background: statusColor, borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                      {mod.requirements.map(req => (
                        <div key={req} style={{ fontSize: 12, padding: '6px 8px', background: LIGHT_BG, borderRadius: 6, textAlign: 'center', color: GRAY }}>{req}</div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {acrTab === 'readiness' && (
            <>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.readinessScoreTitle')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="55" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle cx="70" cy="70" r="55" fill="none" stroke={readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER} strokeWidth="10" strokeDasharray={`${readinessScore * 3.45} 345`} strokeLinecap="round" transform="rotate(-90 70 70)" />
                      <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="800" fill={readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER}>{readinessScore}</text>
                    </svg>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: '质控手册', value: 80, color: SUCCESS },
                      { label: '操作SOP', value: 75, color: WARNING },
                      { label: '培训记录', value: 60, color: WARNING },
                      { label: '设备维护日志', value: 85, color: SUCCESS },
                      { label: '应急演练报告', value: 55, color: DANGER },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: GRAY }}>{item.label}</span>
                          <span style={{ fontWeight: 700, color: item.color }}>{item.value}%</span>
                        </div>
                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3 }}>
                          <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.inspectionFindings')}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                    {['日期', '检查机构', '发现项', '严重程度', '状态'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {inspectionFindings.map((f, idx) => (
                      <tr key={f.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? WHITE : '#fafbfc' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{f.date}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PRIMARY }}>{f.inspector}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{f.findings}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: f.severity === '高' ? '#fee2e2' : f.severity === '中' ? '#fef3c7' : '#f1f5f9', color: f.severity === '高' ? DANGER : f.severity === '中' ? WARNING : GRAY }}>{f.severity}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: f.status === '已整改' ? '#d1fae5' : '#fef3c7', color: f.status === '已整改' ? SUCCESS : WARNING }}>{f.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== Quality Trend Analysis Tab ==================== */}
      {activeTab === 'trendAnalysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: '4px', display: 'flex', gap: 4, border: `1px solid ${BORDER}` }}>
            {[
              { key: 'department', label: '科室整体趋势', icon: <BarChart3 size={14} /> },
              { key: 'individual', label: '个人趋势', icon: <User size={14} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setTrendAnalysisTab(tab.key as 'department' | 'individual')} style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none',
                background: trendAnalysisTab === tab.key ? ACCENT : 'transparent',
                color: trendAnalysisTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>{tab.icon}{tab.label}</button>
            ))}
          </div>
          {trendAnalysisTab === 'department' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: '当前月均', value: monthlyQualityData[monthlyQualityData.length - 1].deptAvg, suffix: '分', color: ACCENT, bg: '#eff6ff' },
                  { label: '控制上限(UCL)', value: monthlyQualityData[0].upperControl, suffix: '分', color: SUCCESS, bg: '#d1fae5' },
                  { label: '控制下限(LCL)', value: monthlyQualityData[0].lowerControl, suffix: '分', color: WARNING, bg: '#fef3c7' },
                  { label: '整体均值(CL)', value: monthlyQualityData[0].mean, suffix: '分', color: '#8b5cf6', bg: '#ede9fe' },
                ].map(card => (
                  <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target size={18} color={card.color} />
                    </div>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}{card.suffix}</div><div style={{ fontSize: 12, color: GRAY }}>{card.label}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} color={ACCENT} />{t('qc.spcChart')}</h3>
                <ResponsiveContainer width='100%' height={280}>
                  <AreaChart data={monthlyQualityData}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area type='monotone' dataKey='upperControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='UCL' />
                    <Area type='monotone' dataKey='lowerControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='LCL' />
                    <Area type='monotone' dataKey='mean' stroke='#64748b' strokeDasharray='3 3' fill='none' name='CL' />
                    <Line type='monotone' dataKey='deptAvg' stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} name='全院评分' />
                    {monthlyQualityData.filter(d => d.deptAvg > d.upperControl || d.deptAvg < d.lowerControl).map((d, i) => (
                      <Line key={i} dataKey='deptAvg' data={[d]} stroke={DANGER} strokeWidth={0} dot={{ r: 6, fill: DANGER, stroke: WHITE, strokeWidth: 2 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {controlAlerts.length > 0 && (
                <div style={{ background: WHITE, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={16} color={DANGER} />{t('qc.controlAlerts')}</h3>
                  {controlAlerts.map((alert, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: alert.type.includes('out_of_control') ? '#fee2e2' : '#fef3c7', borderRadius: 6, marginBottom: 8 }}>
                      {alert.type.includes('out_of_control') ? <AlertTriangle size={14} color={DANGER} /> : <Bell size={14} color={WARNING} />}
                      <span style={{ fontSize: 12, color: '#334155' }}>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {trendAnalysisTab === 'individual' && (
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.doctorTrendComparison')}</h3>
              <ResponsiveContainer width='100%' height={280}>
                <AreaChart data={monthlyQualityData}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                  <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                  <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type='monotone' dataKey='upperControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='UCL' />
                  <Area type='monotone' dataKey='mean' stroke='#64748b' strokeDasharray='3 3' fill='none' name='CL' />
                  <Area type='monotone' dataKey='lowerControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='LCL' />
                  <Line type='monotone' dataKey='deptAvg' stroke={ACCENT} strokeWidth={2} dot={false} name='全院评分' />
                  <Line type='monotone' dataKey='indivAvg' stroke={SUCCESS} strokeWidth={2} dot={{ r: 4, fill: SUCCESS }} name='个人评分' />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 16 }}>
                {indivDoctorTrendData.map((doc, idx) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: idx % 2 === 0 ? '#eff6ff' : '#f0fdf4', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: doc.rank === 1 ? '#fbbf24' : doc.rank <= 3 ? '#94a3b8' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: WHITE }}>{doc.rank}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{doc.name}</div><div style={{ fontSize: 12, color: GRAY }}>报告 {doc.reportCount} 份</div></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: doc.totalScore >= 90 ? SUCCESS : doc.totalScore >= 80 ? WARNING : DANGER }}>{doc.totalScore}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>总分</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
          {/* Report Timeout Settings */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} color={ACCENT} />{t('qc.reviewTimeoutSettings')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.reportTimeoutLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.reportTimeoutMinutes} onChange={e => setTempRules({ ...tempRules, reportTimeoutMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.reportTimeoutMinutes} 分钟</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>超时未审核自动提醒</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.reminderLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.reminderBeforeMinutes} onChange={e => setTempRules({ ...tempRules, reminderBeforeMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.reminderBeforeMinutes} 分钟</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>超时前提醒</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.autoEscalateLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.autoEscalateAfterMinutes} onChange={e => setTempRules({ ...tempRules, autoEscalateAfterMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.autoEscalateAfterMinutes} 分钟</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>超时后自动升级</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.dailyQuotaLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.dailyReviewQuota} onChange={e => setTempRules({ ...tempRules, dailyReviewQuota: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.dailyReviewQuota} 份/医生</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>每人每日审核量</span>
                </div>
              </div>
            </div>
          </div>

          {/* Image Quality Standards */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Image size={16} color={ACCENT} />{t('qc.imageScoreStandard')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.excellentStandard')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.imageScoreExcellent} onChange={e => setTempRules({ ...tempRules, imageScoreExcellent: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.imageScoreExcellent} 分</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>≥此分数为优秀</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.goodStandard')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.imageScoreGood} onChange={e => setTempRules({ ...tempRules, imageScoreGood: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.imageScoreGood} 分</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>≥此分数为良好</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#fef3c7', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>{t('qc.gradeDescription')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { level: '优秀', range: `≥${qcRules.imageScoreExcellent}分`, color: SUCCESS, bg: '#d1fae5' },
                  { level: '良好', range: `${qcRules.imageScoreGood}-${qcRules.imageScoreExcellent - 1}分`, color: WARNING, bg: '#fef3c7' },
                  { level: '一般', range: '70-79分', color: '#c2410c', bg: '#fed7aa' },
                  { level: '差', range: '<70分', color: DANGER, bg: '#fee2e2' },
                ].map(item => (
                  <div key={item.level} style={{ background: item.bg, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.level}</div>
                    <div style={{ fontSize: 12, color: item.color, marginTop: 2 }}>{item.range}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* QC Reminder Rules */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={16} color={ACCENT} />{t('qc.reminderRules')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '报告超时提醒', enabled: true, desc: '报告超过设定时限未审核时自动提醒' },
                { label: '危急值追踪提醒', enabled: true, desc: '危急值报告发送后未确认时持续提醒' },
                { label: '质量评分预警', enabled: true, desc: '当评分低于阈值时向主管发送预警' },
                { label: '废片自动登记', enabled: false, desc: '影像质量评分低于70分时自动登记废片' },
                { label: '同行评审分配', enabled: true, desc: '按设定比例自动分配同行评审任务' },
              ].map((rule, _idx) => (
                <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{rule.label}</div>
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{rule.desc}</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: rule.enabled ? SUCCESS : BORDER, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: WHITE, position: 'absolute', top: 2, left: rule.enabled ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save / Reset Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {editingRules ? (
              <>
                <button onClick={() => { setEditingRules(false); setTempRules({ ...qcRules }); }} style={{ padding: '8px 20px', background: WHITE, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={14} />{t('dc.cancel')}</button>
                <button onClick={handleSaveRules} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Save size={14} />{t('qc.saveSettings')}</button>
              </>
            ) : (
              <button onClick={() => { setEditingRules(true); setTempRules({ ...qcRules }); }} style={{ padding: '8px 20px', background: ACCENT, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={14} />{t('qc.editRules')}</button>
            )}
          </div>
        </div>
      )}
      {/* 评分弹窗 */}
      {showRatingModal && selectedReport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRatingModal(false)}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: PRIMARY }}>{t('dc.qualityScore')}</h2>
              <button onClick={() => setShowRatingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, background: `${PRIMARY}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={28} color={PRIMARY} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{selectedReport.patientName}</div>
                <div style={{ fontSize: 12, color: GRAY }}>{selectedReport.id}</div>
                <div style={{ fontSize: 12, color: GRAY }}>报告医生: {selectedReport.reportDoctor}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { dimension: '完整性', score: selectedReport.completeness, key: 'completeness' },
                { dimension: '准确性', score: selectedReport.accuracy, key: 'accuracy' },
                { dimension: '规范性', score: selectedReport.standardization, key: 'standardization' },
                { dimension: '及时性', score: selectedReport.timeliness, key: 'timeliness' },
              ].map(item => (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{item.dimension}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: SCORE_COLORS[item.score >= 90 ? '优秀' : item.score >= 80 ? '良好' : '一般'] }}>{item.score}分</span>
                  </div>
                  {renderScoreBar(item.score)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRatingModal(false)} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('dcm.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {toast.show && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'success' ? SUCCESS : toast.type === 'error' ? DANGER : PRIMARY,
          color: WHITE, padding: '12px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <AlertTriangle size={16} /> : <Bell size={16} />}
          {toast.message}
        </div>
      )}

      {/* 进度Modal */}
      {progressModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 32, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            {!progressModal.complete ? (
              <>
                <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, marginBottom: 8 }}>{progressModal.title}</div>
                <div style={{ fontSize: 13, color: GRAY }}>{progressModal.message}</div>
              </>
            ) : (
              <>
                <CheckCircle size={48} color={SUCCESS} style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: SUCCESS, marginBottom: 8 }}>{progressModal.title}完成</div>
                <div style={{ fontSize: 13, color: GRAY }}>{progressModal.message}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 详情Modal */}
      {detailModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailModal(d => ({ ...d, show: false }))}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>{detailModal.title}</h2>
              <button onClick={() => setDetailModal(d => ({ ...d, show: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{detailModal.content}</div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetailModal(d => ({ ...d, show: false }))} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('dcm.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 表单Modal */}
      {formModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setFormModal(f => ({ ...f, show: false }))}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>{formModal.title}</h2>
              <button onClick={() => setFormModal(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ fontSize: 13, color: GRAY, textAlign: 'center', padding: '20px 0' }}>表单内容（模拟）</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setFormModal(f => ({ ...f, show: false }))} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', background: WHITE, color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('dc.cancel')}</button>
              <button onClick={() => { setFormModal(f => ({ ...f, show: false })); showToast(`${formModal.title}成功`, 'success') }} style={{ padding: '8px 20px', background: ACCENT, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('qc.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
