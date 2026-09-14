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
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { ChartContainer } from '../components/charts'
// [v3.0.6.8-28] 主数据池 + 生成器
import {
  DOCTOR_MASTER, DOCTORS_BY_TITLE, DEVICE_MASTER,
} from '../data/master'
import {
  DOCTOR_PERFORMANCE_PRE, EXAM_REPORT_PRE, QUALITY_SCORE_PRE,
} from '../data/_generators'
import { AppText } from '../components/common/AppText'
import { VirtualTable } from '../components/common/VirtualTable'
import { PageHeader } from '../components/common/PageHeader'
// [v3.0.6.11-103 Wave 10] 重复页合并: QualityControlPage(评分/危急值/缺陷/月报) + RadiologyQCDashboardPage(放射质控总览) 嵌入为 QCPage 新 Tab
import QualityControlPage from './QualityControlPage'
import RadiologyQCDashboardPage from './qc/RadiologyQCDashboardPage'
// [v3.0.6.11-104 Wave 5A] 质控收敛: AIQCPage(AI 智能质控) + DepartmentQualityPage(科室质量) 嵌入为 QCPage 新 Tab
import AIQCPage from './AIQCPage'
import DepartmentQualityPage from './quality/DepartmentQualityPage'

const PRIMARY = '#1e40af'

const ACCENT = '#3b82f6'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const GRAY = '#64748b'
const LIGHT_BG = 'var(--content-bg)'
const BORDER = 'var(--border-color)'
const WHITE = '#ffffff'

// 甲乙丙丁等级颜色
const GRADE_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  '甲': { bg: '#22c55e22', color: '#059669', border: '#059669', label: t("qcPage.gradeAExcellent") },
  '乙': { bg: '#3b82f622', color: '#1e40af', border: '#1e40af', label: t("qcPage.gradeBGood") },
  '丙': { bg: '#f59e0b22', color: '#f59e0b', border: '#d97706', label: t("qcPage.gradeCPass") },
  '丁': { bg: '#ef444422', color: '#ef4444', border: '#dc2626', label: t("qcPage.gradeDFail") },
}

const TABS = [
  { key: 'report', label: t("qcPage.reportQualityScore"), icon: <FileText size={15} /> },
  { key: 'image', label: t("qcPage.imageQc"), icon: <Image size={15} /> },
  { key: 'timeout', label: t("qcPage.overdueStats"), icon: <Clock size={15} /> },
  { key: 'inspection', label: t("qcPage.manualSampling"), icon: <ClipboardCheck size={15} /> },
  { key: 'dashboard', label: t("qcPage.qcDashboard"), icon: <BarChart3 size={15} /> },
  { key: 'regional', label: t("qcPage.regionalImageQc"), icon: <Globe size={15} /> },
  { key: 'settings', label: t("qcPage.qcRuleSettings"), icon: <Settings size={15} /> },
  { key: 'peerReview', label: t("qcPage.peerReview"), icon: <Users size={15} /> },
  { key: 'ruleChecker', label: t("qcPage.ruleCheck"), icon: <ClipboardCheck size={15} /> },
  { key: 'radPath', label: t("qcPage.pathologyCompare"), icon: <Activity size={15} /> },
  { key: 'acr', label: t("qcPage.acrAccreditation"), icon: <Award size={15} /> },
  { key: 'trendAnalysis', label: t("qcPage.trendAnalysis"), icon: <TrendingUp size={15} /> },
  // [v3.0.6.11-103 Wave 10] 重复页合并: 吸收 QualityControlPage / RadiologyQCDashboardPage 功能 (旧路由 /quality-control /qc-dashboard redirect → /qc)
  { key: 'v3', label: t("qcPage.qcManagement"), icon: <ClipboardList size={15} /> },
  { key: 'radDashboard', label: t("qcPage.radiologyQcOverview"), icon: <Activity size={15} /> },
  // [v3.0.6.11-104 Wave 5A] 质控收敛: 吸收 AIQCPage / DepartmentQualityPage (旧路由 /ai-qc /quality/department redirect → /qc?tab=...)
  { key: 'ai', label: t("qcPage.aiQc"), icon: <Zap size={15} /> },
  { key: 'deptQuality', label: t("qcPage.deptQuality"), icon: <Building2 size={15} /> },
]

// [v3.0.6.8-28] 报告质控数据 - 来源: EXAM_REPORT_PRE (600 报告) + DOCTOR_MASTER + QUALITY_SCORE_PRE
const reportQCData = (() => {
  // 取前 10 报告评分高/低样本
  return EXAM_REPORT_PRE.slice(0, 10).map((r, idx) => {
    const reportDoctor = DOCTOR_MASTER.find((d) => d.id === r.reportDoctorId);
    const reviewDoctor = DOCTORS_BY_TITLE['副主任医师'].concat(DOCTORS_BY_TITLE['主任医师'])[idx % 4];
    const score = r.qcScore;
    const grade = score >= 95 ? '甲' : score >= 85 ? '乙' : score >= 75 ? '丙' : '丁';
    const status = score >= 95 ? t("qcPage.excellent") : score >= 85 ? t("qcPage.good") : score >= 75 ? t("qcPage.fair") : t("qcPage.poor");
    return {
      id: r.reportId,
      patientName: r.patientName,
      reportDoctor: reportDoctor?.name || t("qcPage.unknown"),
      reviewDoctor: reviewDoctor?.name || t("qcPage.unknown"),
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
    { grade: '甲', label: t("qcPage.gradeAExcellent"), count: counts['甲'], percentage: Math.round((counts['甲'] / total) * 100), color: '#059669', bg: '#22c55e22', description: t("qcPage.descExcellent") },
    { grade: '乙', label: t("qcPage.gradeBGood"), count: counts['乙'], percentage: Math.round((counts['乙'] / total) * 100), color: '#1e40af', bg: '#3b82f622', description: t("qcPage.descGood") },
    { grade: '丙', label: t("qcPage.gradeCPass"), count: counts['丙'], percentage: Math.round((counts['丙'] / total) * 100), color: '#f59e0b', bg: '#f59e0b22', description: t("qcPage.descPass") },
    { grade: '丁', label: t("qcPage.gradeDFail"), count: counts['丁'], percentage: Math.round((counts['丁'] / total) * 100), color: '#ef4444', bg: '#ef444422', description: t("qcPage.descFail") },
  ];
})()

// 报告缺陷类型统计（国家卫健委2024年版）
const reportDefectData = [
  { defectType: t("qcPage.defectIncomplete"), count: 28, percentage: 25, trend: t("qcPage.down"), color: '#f97316' },
  { defectType: t("qcPage.defectUnclearDiagnosis"), count: 22, percentage: 20, trend: t("qcPage.up"), color: '#ef4444' },
  { defectType: t("qcPage.defectTerminology"), count: 18, percentage: 16, trend: t("qcPage.flat"), color: '#eab308' },
  { defectType: t("qcPage.defectMismatch"), count: 12, percentage: 11, trend: t("qcPage.down"), color: '#22c55e' },
  { defectType: t("qcPage.defectCriticalMissed"), count: 8, percentage: 7, trend: t("qcPage.down"), color: '#3b82f6' },
  { defectType: t("qcPage.defectOverdue"), count: 15, percentage: 14, trend: t("qcPage.flat"), color: '#8b5cf6' },
  { defectType: t("qcPage.defectOther"), count: 9, percentage: 7, trend: t("qcPage.flat"), color: 'var(--text-secondary)' },
]

// 报告书写正确率指标（国家卫健委2024年版）


// [v3.0.6.8-28] 人工抽检记录数据 - 来源: EXAM_REPORT_PRE 前 7 报告
const inspectionRecordsData = (() => {
  return EXAM_REPORT_PRE.slice(0, 7).map((r, idx) => {
    const reportDoctor = DOCTOR_MASTER.find((d) => d.id === r.reportDoctorId);
    const inspector = DOCTORS_BY_TITLE['副主任医师'].concat(DOCTORS_BY_TITLE['主任医师'])[idx % 4];
    const score = Math.round(r.qcScore);
    const grade = score >= 95 ? '甲' : score >= 85 ? '乙' : score >= 75 ? '丙' : '丁';
    const defects = score >= 95 ? [] : score >= 85 ? [] : score >= 75 ? [t("qcPage.defectTerminology")] : [t("qcPage.defectIncomplete"), t("qcPage.defectUnclearDiagnosis"), t("qcPage.defectCriticalMissed")].slice(0, 2);
    const status = score >= 85 ? t("qcPage.passed") : score >= 75 ? t("qcPage.needsCorrection") : t("qcPage.failed");
    const comments: Record<string, string> = {
      '甲': t("qcPage.reviewPassNote"),
      '乙': t("qcPage.reviewGoodNote"),
      '丙': t("qcPage.reviewTermNote"),
      '丁': t("qcPage.reviewFailNote"),
    };
    return {
      id: `INS-${r.examAt.split('T')[0]?.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`,
      reportId: r.reportId,
      patientName: r.patientName,
      reportDoctor: reportDoctor?.name || t("qcPage.unknown"),
      inspector: inspector?.name || t("qcPage.unknown"),
      inspectionDate: r.examAt.split('T')[0],
      grade,
      score,
      defects,
      inspectorComment: comments[grade] || t("qcPage.good"),
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
  const issuePool = [t("qcPage.imageArtifactMotion"), t("qcPage.imageExposure"), t("qcPage.imagePositioning"), t("qcPage.contrastInsufficient"), t("qcPage.imageMotionMinor"), t("qcPage.imageNoise"), t("qcPage.imageMetalArtifact")];
  return DEVICE_MASTER.slice(0, 8).map((d, idx) => {
    const report = EXAM_REPORT_PRE[idx];
    const score = report ? Math.round(report.qcScore) : Math.round(85 + Math.random() * 10);
    const status = score >= 95 ? t("qcPage.excellent") : score >= 85 ? t("qcPage.good") : score >= 75 ? t("qcPage.fair") : t("qcPage.poor");
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
  { id: 'RAD-EX002', patientName: '李秀英', examItem: t("qcPage.examHeadMr"), scheduledTime: '10:00', actualReportTime: '14:30', delayMinutes: 270, reason: t("qcPage.issueMrMaintenance"), severity: t("qcPage.severe") },
  { id: 'RAD-EX003', patientName: '王建国', examItem: t("qcPage.examChestDr"), scheduledTime: '11:00', actualReportTime: '12:15', delayMinutes: 75, reason: t("qcPage.issueCheckupBacklog"), severity: t("qcPage.fair") },
  { id: 'RAD-EX004', patientName: '赵晓敏', examItem: t("qcPage.examHeadCt"), scheduledTime: '12:00', actualReportTime: '15:45', delayMinutes: 225, reason: t("qcPage.issueEmergencyPriority"), severity: t("qcPage.severe") },
  { id: 'RAD-EX006', patientName: '孙伟', examItem: t("qcPage.examLumbarMr"), scheduledTime: '15:00', actualReportTime: '18:00', delayMinutes: 180, reason: t("qcPage.issueDoctorMeeting"), severity: t("qcPage.medium") },
]

// ==================== 医生报告质量评分数据 ====================

// 评分维度权重


// 评分矩阵说明
const SCORE_MATRIX = [
  { dimension: t("qcPage.dimFormat"), weight: '30%', indicators: t("qcPage.dimFormatDesc"), color: '#3b82f6' },
  { dimension: t("qcPage.dimAccuracy"), weight: '50%', indicators: t("qcPage.dimAccuracyDesc"), color: '#059669' },
  { dimension: t("qcPage.dimTimeliness"), weight: '20%', indicators: t("qcPage.dimTimelinessDesc"), color: '#f59e0b' },
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
  { issueType: t("qcPage.defectFormat"), count: 28, percentage: 32, color: '#3b82f6', trend: t("qcPage.down") },
  { issueType: t("qcPage.defectDescription"), count: 24, percentage: 28, color: '#d97706', trend: t("qcPage.down") },
  { issueType: t("qcPage.defectMisdiagnosis"), count: 18, percentage: 21, color: '#ef4444', trend: t("qcPage.up") },
  { issueType: t("qcPage.overdue"), count: 17, percentage: 19, color: '#7c3aed', trend: t("qcPage.flat") },
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
    { name: t("qcPage.imageArtifactMotion"), value: 28, color: '#ef4444' },
    { name: t("qcPage.imageExposure"), value: 22, color: '#f97316' },
    { name: t("qcPage.imagePositioning"), value: 18, color: '#eab308' },
    { name: t("qcPage.defectContrast"), value: 12, color: '#22c55e' },
    { name: t("qcPage.defectDevice"), value: 8, color: '#3b82f6' },
    { name: t("qcPage.other"), value: 12, color: 'var(--text-secondary)' },
  ],
  weakLinks: [t("qcPage.reportTimeliness"), t("qcPage.descriptionStandard"), t("qcPage.criticalTracking")],
}

// ==================== 区域影像质控数据 ====================

// 区域机构数据
const regionalInstitutions = [
  { id: 'HOSP001', name: t("qcPage.hospitalCity1"), level: t("qcPage.gradeTertiaryA"), joinedDate: '2024-01-15', status: 'active', reportsThisMonth: 4521, avgScore: 91.2, ranking: 1, contact: '张主任', phone: '0551-12345678', trend: 'up' as const },
  { id: 'HOSP002', name: t("qcPage.hospitalCity3"), level: t("qcPage.gradeTertiaryB"), joinedDate: '2024-03-20', status: 'active', reportsThisMonth: 3280, avgScore: 88.7, ranking: 3, contact: '李主任', phone: '0551-23456789', trend: 'down' as const },
  { id: 'HOSP003', name: t("qcPage.hospitalCounty"), level: t("qcPage.gradeSecondaryA"), joinedDate: '2024-06-01', status: 'active', reportsThisMonth: 2156, avgScore: 85.4, ranking: 5, contact: '王主任', phone: '0552-34567890', trend: 'same' as const },
  { id: 'HOSP004', name: t("qcPage.hospitalDistrict"), level: t("qcPage.gradeSecondaryB"), joinedDate: '2024-09-15', status: 'active', reportsThisMonth: 1892, avgScore: 82.1, ranking: 7, contact: '赵主任', phone: '0553-45678901', trend: 'down' as const },
  { id: 'HOSP005', name: t("qcPage.hospitalTcm"), level: t("qcPage.gradeTertiaryA"), joinedDate: '2024-02-10', status: 'active', reportsThisMonth: 2890, avgScore: 89.5, ranking: 2, contact: '刘主任', phone: '0551-56789012', trend: 'up' as const },
  { id: 'HOSP006', name: t("qcPage.hospitalMiner"), level: t("qcPage.gradeSecondaryA"), joinedDate: '2025-01-05', status: 'active', reportsThisMonth: 1234, avgScore: 80.3, ranking: 8, contact: '陈主任', phone: '0552-67890123', trend: 'down' as const },
  { id: 'HOSP007', name: t("qcPage.hospitalMaternal"), level: t("qcPage.gradeTertiaryA"), joinedDate: '2024-11-20', status: 'active', reportsThisMonth: 1567, avgScore: 87.2, ranking: 4, contact: '周主任', phone: '0551-78901234', trend: 'up' as const },
  { id: 'HOSP008', name: t("qcPage.hospitalTownship"), level: t("qcPage.gradeTertiaryA1"), joinedDate: '2025-03-01', status: 'active', reportsThisMonth: 456, avgScore: 76.8, ranking: 10, contact: '孙主任', phone: '0554-89012345', trend: 'up' as const },
]

// 区域排名数据
const regionalRanking = [
  { institution: t("qcPage.hospitalCity1"), score: 91.2, imageQuality: 93, reportQuality: 90, timeliness: 88, criticalValueReport: 98, ranking: 1, trend: 'up', trendValue: 1.2 },
  { institution: t("qcPage.hospitalTcm"), score: 89.5, imageQuality: 91, reportQuality: 88, timeliness: 87, criticalValueReport: 96, ranking: 2, trend: 'up', trendValue: 0.8 },
  { institution: t("qcPage.hospitalCity3"), score: 88.7, imageQuality: 89, reportQuality: 88, timeliness: 86, criticalValueReport: 95, ranking: 3, trend: 'down', trendValue: -0.5 },
  { institution: t("qcPage.hospitalMaternal"), score: 87.2, imageQuality: 88, reportQuality: 86, timeliness: 85, criticalValueReport: 94, ranking: 4, trend: 'up', trendValue: 1.5 },
  { institution: t("qcPage.hospitalCounty"), score: 85.4, imageQuality: 86, reportQuality: 84, timeliness: 83, criticalValueReport: 92, ranking: 5, trend: 'same', trendValue: 0 },
  { institution: t("qcPage.hospitalDistrict"), score: 82.1, imageQuality: 83, reportQuality: 81, timeliness: 80, criticalValueReport: 89, ranking: 7, trend: 'down', trendValue: -1.2 },
  { institution: t("qcPage.hospitalMiner"), score: 80.3, imageQuality: 81, reportQuality: 79, timeliness: 78, criticalValueReport: 87, ranking: 8, trend: 'down', trendValue: -0.8 },
  { institution: t("qcPage.hospitalTownship"), score: 76.8, imageQuality: 77, reportQuality: 75, timeliness: 74, criticalValueReport: 82, ranking: 10, trend: 'up', trendValue: 2.1 },
]

// 质控标准数据
const qcStandards = {
  imageQuality: {
    excellent: { min: 90, desc: t("qcPage.imageGradeADesc") },
    good: { min: 80, desc: t("qcPage.imageGradeBDesc") },
    fair: { min: 70, desc: t("qcPage.imageGradeCDesc") },
    poor: { min: 0, desc: t("qcPage.imageGradeDDesc") },
  },
  reportQuality: {
    excellent: { min: 90, desc: t("qcPage.reportGradeADesc") },
    good: { min: 80, desc: t("qcPage.reportGradeBDesc") },
    fair: { min: 70, desc: t("qcPage.reportGradeCDesc") },
    poor: { min: 0, desc: t("qcPage.descFail") },
  },
  timeliness: {
    urgent: { minutes: 30, desc: t("qcPage.ruleCritical30") },
    stat: { minutes: 60, desc: t("qcPage.ruleEmergency60") },
    routine: { minutes: 120, desc: t("qcPage.ruleRoutine2h") },
    extended: { minutes: 240, desc: t("qcPage.ruleSpecial4h") },
  },
  criticalValue: {
    required: { rate: 100, desc: t("qcPage.ruleCriticalNotify10") },
    reported: { rate: 95, desc: t("qcPage.ruleCriticalRegister95") },
    callback: { rate: 90, desc: t("qcPage.ruleCriticalFollowup90") },
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
  { id: 'IT001', institution: t("qcPage.hospitalCounty"), issueType: t("qcPage.defectOverdue"), description: t("qcPage.issueSomeOverdue"), severity: t("qcPage.medium2"), status: t("qcPage.correcting"), reportedDate: '2026-04-15', dueDate: '2026-05-15' },
  { id: 'IT002', institution: t("qcPage.hospitalTownship"), issueType: t("qcPage.issueImageQuality"), description: t("qcPage.issueImageBelowStandard"), severity: t("qcPage.high"), status: t("qcPage.correcting"), reportedDate: '2026-04-10', dueDate: '2026-05-10' },
  { id: 'IT003', institution: t("qcPage.hospitalMiner"), issueType: t("qcPage.issueCriticalMissed"), description: t("qcPage.issueCritical3Missed"), severity: t("qcPage.high"), status: t("qcPage.corrected"), reportedDate: '2026-03-28', dueDate: '2026-04-28' },
  { id: 'IT004', institution: t("qcPage.hospitalDistrict"), issueType: t("qcPage.issueReportNonStandard"), description: t("qcPage.issueReportFormat"), severity: t("qcPage.low"), status: t("qcPage.corrected"), reportedDate: '2026-04-05', dueDate: '2026-04-20' },
]

// 不合格原因分析
const unqualifiedReasonData = [
  { reason: t("qcPage.issueArtifact"), count: 45, percentage: 32, trend: t("qcPage.down") },
  { reason: t("qcPage.issueIncompleteDesc"), count: 32, percentage: 23, trend: t("qcPage.flat") },
  { reason: t("qcPage.issueNoReportInTime"), count: 24, percentage: 17, trend: t("qcPage.down") },
  { reason: t("qcPage.issueCriticalMissed"), count: 12, percentage: 9, trend: t("qcPage.down") },
  { reason: t("qcPage.defectUnclearDiagnosis"), count: 18, percentage: 13, trend: t("qcPage.up") },
  { reason: t("qcPage.other"), count: 9, percentage: 6, trend: t("qcPage.flat") },
]

// 月报/季报/年报数据
const reportSummaryData = {
  monthly: {
    period: t("qcPage.period2026Apr"),
    totalReports: 15620,
    avgScore: 87.2,
    excellentCount: 10153,
    passRate: 94.2,
    timeoutCount: 89,
    criticalValueReported: 245,
    criticalValueOnTime: 238,
    issues: [
      { type: t("qcPage.issueImageQuality"), count: 156, percentage: 42 },
      { type: t("qcPage.defectOverdue"), count: 89, percentage: 24 },
      { type: t("qcPage.issueReportNonStandard"), count: 78, percentage: 21 },
      { type: t("qcPage.issueCritical"), count: 48, percentage: 13 },
    ],
  },
  quarterly: {
    period: t("qcPage.period2026Q1"),
    totalReports: 45680,
    avgScore: 85.8,
    excellentCount: 28540,
    passRate: 92.5,
    timeoutCount: 312,
    criticalValueReported: 698,
    criticalValueOnTime: 672,
    trends: [
      { metric: t("qcPage.excellentGoodRate"), value: '62.5%', trend: 'up', change: '+2.3%' },
      { metric: t("qcPage.complianceRate"), value: '92.5%', trend: 'up', change: '+1.5%' },
      { metric: t("qcPage.overdueRate"), value: '0.68%', trend: 'down', change: '-0.15%' },
    ],
  },
  yearly: {
    period: t("qcPage.period2025"),
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
  '优秀': { bg: '#22c55e22', color: '#059669' },
  '良好': { bg: '#f59e0b22', color: '#f59e0b' },
  '一般': { bg: '#f9731622', color: '#c2410c' },
  '差': { bg: '#ef444422', color: '#ef4444' },
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#64748b']

// 区域排名颜色映射


export default function QCPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // [v3.0.6.11-104 Wave 5A] 支持 ?tab= 深链 (旧路由 /ai-qc → /qc?tab=ai, /quality/department → /qc?tab=deptQuality)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'report')
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [searchParams])
  const selectTab = (key: string) => {
    setActiveTab(key)
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }
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
        setLoadError(t("qcPage.apiUnavailableLocal"))
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
  const [filterStatus, setFilterStatus] = useState(t('qcPage.all'))

  // 区域质控相关状态
  const [regionalReportType, setRegionalReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [regionalTab, setRegionalTab] = useState<'overview' | 'ranking' | 'standards' | 'reports' | 'tracking'>('overview')
  useState<string | null>(null)
  const [expandedInstitution, setExpandedInstitution] = useState<string | null>(null)

  // Peer Review 状态
  const [peerReviewTab, setPeerReviewTab] = useState<'assignment' | 'scoring' | 'reliability'>('assignment')
  
  const [peerReviewAssignments, setPeerReviewAssignments] = useState([
    { id: 'PR001', caseId: 'RAD-RPT011', patientName: '张伟', originalAuthor: '李明辉', reviewer: '王秀峰', blindedId: 'B-001', status: t("qcPage.pendingScore"), accuracy: 0, completeness: 0, timeliness: 0, submittedAt: '2026-05-01' },
    { id: 'PR002', caseId: 'RAD-RPT012', patientName: '李娜', originalAuthor: '王秀峰', reviewer: '张海涛', blindedId: 'B-002', status: t("qcPage.scored"), accuracy: 92, completeness: 88, timeliness: 90, submittedAt: '2026-05-01' },
    { id: 'PR003', caseId: 'RAD-RPT013', patientName: '赵敏', originalAuthor: '张海涛', reviewer: '刘芳', blindedId: 'B-003', status: t("qcPage.scored"), accuracy: 85, completeness: 82, timeliness: 88, submittedAt: '2026-05-02' },
    { id: 'PR004', caseId: 'RAD-RPT014', patientName: '王磊', originalAuthor: '刘芳', reviewer: '李明辉', blindedId: 'B-004', status: t("qcPage.pendingScore"), accuracy: 0, completeness: 0, timeliness: 0, submittedAt: '2026-05-02' },
    { id: 'PR005', caseId: 'RAD-RPT015', patientName: '周涛', originalAuthor: '陈志强', reviewer: '王秀峰', blindedId: 'B-005', status: t("qcPage.scored"), accuracy: 78, completeness: 80, timeliness: 75, submittedAt: '2026-05-03' },
  ])
  const [peerReviewDetail, setPeerReviewDetail] = useState<typeof peerReviewAssignments[0] | null>(null)

  // [W3-C] 随机分配: 从候选池随机挑选案例并指派评审人
  const handleRandomAssign = () => {
    const reviewers = ['王秀峰', '李明辉', '张海涛', '刘芳', '陈志强']
    const candidates = [
      { caseId: 'RAD-RPT021', patientName: '孙丽' },
      { caseId: 'RAD-RPT022', patientName: '黄强' },
      { caseId: 'RAD-RPT023', patientName: '冯雪' },
      { caseId: 'RAD-RPT024', patientName: '蒋磊' },
      { caseId: 'RAD-RPT025', patientName: '沈婷' },
    ]
    const n = 2 + Math.floor(Math.random() * 3)
    const newItems = Array.from({ length: n }, (_, i) => {
      const c = candidates[Math.floor(Math.random() * candidates.length)]!
      const reviewer = reviewers[Math.floor(Math.random() * reviewers.length)]!
      return {
        id: `PR${String(Date.now() % 100000).padStart(3, '0')}-${i}`,
        caseId: c.caseId,
        patientName: c.patientName,
        originalAuthor: t("qcPage.system"),
        reviewer,
        blindedId: `B-${String(Math.floor(100 + Math.random() * 900))}`,
        status: t("qcPage.pendingScore"),
        accuracy: 0, completeness: 0, timeliness: 0,
        submittedAt: new Date().toISOString().slice(0, 10),
      }
    })
    setPeerReviewAssignments((prev) => [...newItems, ...prev])
    showToast(`已随机分配 ${n} 个新案例给盲审评审人`, 'success')
  }

  // [W3-C] 评分: 待评分 → 提交随机评分; 已评分 → 查看评分详情 Modal
  const handlePeerReviewScore = (a: typeof peerReviewAssignments[0]) => {
    if (a.status === '待评分') {
      const scores = { accuracy: 75 + Math.floor(Math.random() * 25), completeness: 75 + Math.floor(Math.random() * 25), timeliness: 75 + Math.floor(Math.random() * 25) }
      setPeerReviewAssignments((prev) => prev.map((x) => x.id === a.id ? { ...x, ...scores, status: t("qcPage.scored") } : x))
      showToast(`评分已提交 (${a.id})`, 'success')
    } else {
      setPeerReviewDetail(a)
    }
  }
  const kappaData = { kappaValue: 0.72, agreement: 'substantial', reviewer1: '王秀峰', reviewer2: '李明辉', totalCases: 50, agreedCases: 42 }

  // Rule-Based Report Checker 状态
  const [ruleCheckerTab, setRuleCheckerTab] = useState<'rules' | 'results'>('rules')
  const qcRulesConfig = [
    { id: 'R001', category: 'structure', name: t("qcPage.ruleAllSections"), description: t("qcPage.ruleSectionsDesc"), enabled: true, passed: true },
    { id: 'R002', category: 'content', name: t("qcPage.rulePatientInfo"), description: t("qcPage.rulePatientInfoConsistent"), enabled: true, passed: true },
    { id: 'R003', category: 'terminology', name: t("qcPage.ruleStandardTerms"), description: t("qcPage.ruleTermsDesc"), enabled: true, passed: false },
    { id: 'R004', category: 'structure', name: t("qcPage.ruleStructuredDesc"), description: t("qcPage.ruleStructuredDescNote"), enabled: true, passed: true },
    { id: 'R005', category: 'compliance', name: t("qcPage.ruleCriticalAnnotation"), description: t("qcPage.ruleCriticalMarkDesc"), enabled: true, passed: false },
    { id: 'R006', category: 'content', name: t("qcPage.ruleEvidenceBased"), description: t("qcPage.ruleEvidenceDesc"), enabled: true, passed: true },
    { id: 'R007', category: 'terminology', name: t("qcPage.ruleBiRads"), description: t("qcPage.ruleBiRadsDesc"), enabled: true, passed: false },
    { id: 'R008', category: 'compliance', name: t("qcPage.ruleTimely"), description: t("qcPage.ruleTimelyDesc"), enabled: true, passed: true },
  ]
  const overallQualityScore = 82

  // Rad-Path Correlation 状态
  const [radPathTab, setRadPathTab] = useState<'overview' | 'discordant'>('overview')
  // [v3.0.6.8-28] 放射-病理对照数据 - 来源: 抽样 8 例
  // [W3-C] 改为 state: 发起会诊/标记复查 为真实状态变更
  const [radPathData, setRadPathData] = useState([
    { id: 'RP001', patientName: '张伟', radDiagnosis: t("qcPage.caseLungNodule"), pathResult: t("qcPage.caseLungAdeno"), concordance: 'concordant' as const, date: '2026-04-20', consultationStarted: false, needsReview: false },
    { id: 'RP002', patientName: '李娜', radDiagnosis: t("qcPage.caseBreastBiRads"), pathResult: t("qcPage.caseInvasiveDuctal"), concordance: 'concordant' as const, date: '2026-04-21', consultationStarted: false, needsReview: false },
    { id: 'RP003', patientName: '王磊', radDiagnosis: t("qcPage.caseLiverNodule"), pathResult: t("qcPage.caseFnh"), concordance: 'discordant' as const, date: '2026-04-22', consultationStarted: false, needsReview: false },
    { id: 'RP004', patientName: '赵敏', radDiagnosis: t("qcPage.caseThyroidNodule"), pathResult: t("qcPage.caseThyroidPtc"), concordance: 'concordant' as const, date: '2026-04-23', consultationStarted: false, needsReview: false },
    { id: 'RP005', patientName: '周涛', radDiagnosis: t("qcPage.casePancreasMass"), pathResult: t("qcPage.caseAutoimmunePancreatitis"), concordance: 'discordant' as const, date: '2026-04-24', consultationStarted: false, needsReview: false },
    { id: 'RP006', patientName: '吴静', radDiagnosis: t("qcPage.caseKidneyMass"), pathResult: t("qcPage.caseRenalClearCell"), concordance: 'concordant' as const, date: '2026-04-25', consultationStarted: false, needsReview: false },
    { id: 'RP007', patientName: '郑强', radDiagnosis: t("qcPage.caseGgo"), pathResult: t("qcPage.casePending"), concordance: 'indeterminate' as const, date: '2026-04-26', consultationStarted: false, needsReview: false },
    { id: 'RP008', patientName: '钱琳', radDiagnosis: t("qcPage.caseUterineFibroid"), pathResult: t("qcPage.caseLeiomyoma"), concordance: 'concordant' as const, date: '2026-04-27', consultationStarted: false, needsReview: false },
  ])

  // [W3-C] 发起会诊: 标记该病例进入会诊流程
  const handleStartConsultation = (d: typeof radPathData[0]) => {
    setRadPathData((prev) => prev.map((x) => x.id === d.id ? { ...x, consultationStarted: true } : x))
    showToast(`已为 ${d.patientName} 发起会诊讨论 (状态已更新)`, 'success')
  }

  // [W3-C] 标记复查: 标记该病例需复查
  const handleMarkReview = (d: typeof radPathData[0]) => {
    setRadPathData((prev) => prev.map((x) => x.id === d.id ? { ...x, needsReview: true } : x))
    showToast(`已标记 ${d.patientName} 需复查`, 'info')
  }
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
    { modality: 'CT', requirements: [t("qcPage.acrDeviceQc"), t("qcPage.acrDoseMonitoring"), t("qcPage.acrImageQuality"), t("qcPage.acrReportStandard"), t("qcPage.acrStaffQualification")], completed: 4, total: 5, status: t("qcPage.partiallyCompliant") },
    { modality: 'MR', requirements: [t("qcPage.acrDeviceQc"), t("qcPage.acrSafetyTraining"), t("qcPage.acrImageQuality"), t("qcPage.acrEmergencyDrill"), t("qcPage.acrContrastManagement")], completed: 3, total: 5, status: t("qcPage.partiallyCompliant") },
    { modality: 'DR', requirements: [t("qcPage.acrDeviceQc"), t("qcPage.acrDoseMonitoring"), t("qcPage.acrImageQuality"), t("qcPage.acrReportTimeliness"), t("qcPage.acrContinuingEducation")], completed: 5, total: 5, status: t("qcPage.compliant") },
    { modality: 'MG', requirements: [t("qcPage.acrMqsa"), t("qcPage.acrDeviceQc2"), t("qcPage.acrReportStandard2"), t("qcPage.acrDoseRecords"), t("qcPage.acrTechCertification")], completed: 2, total: 5, status: t("qcPage.notCompliant") },
    { modality: 'DSA', requirements: [t("qcPage.acrDeviceQc2"), t("qcPage.acrRadiationProtection"), t("qcPage.acrContrastManagement"), t("qcPage.acrEmergencyPlan"), t("qcPage.acrStaffQualification")], completed: 3, total: 5, status: t("qcPage.partiallyCompliant") },
  ]
  const readinessScore = 72
  const inspectionFindings = [
    { id: 'F001', date: '2025-10-15', inspector: t("qcPage.issueProvincialQc"), findings: t("qcPage.issueDrArchive"), severity: t("qcPage.medium2"), status: t("qcPage.corrected") },
    { id: 'F002', date: '2025-10-15', inspector: t("qcPage.issueProvincialQc"), findings: t("qcPage.issueCtDose"), severity: t("qcPage.high"), status: t("qcPage.correcting") },
    { id: 'F003', date: '2025-07-20', inspector: t("qcPage.issueMunicipalHealth"), findings: t("qcPage.issueCriticalFlow"), severity: t("qcPage.high"), status: t("qcPage.corrected") },
    { id: 'F004', date: '2025-04-10', inspector: t("qcPage.issueInternalQc"), findings: t("qcPage.issueTerminology"), severity: t("qcPage.low"), status: t("qcPage.corrected") },
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
    { month: '2025-11', type: 'out_of_control_up', message: t("qcPage.alertScoreAboveUcl") },
    { month: '2026-03', type: 'warning_up', message: t("qcPage.alertScoreNearUcl") },
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
    const matchStatus = filterStatus === t('qcPage.all') || r.status === filterStatus
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
    showToast(t("qcPage.rulesSaved"), 'success')
  }

  

  const handleExportPDF = (type: string) => {
    setProgressModal({ show: true, title: t("qcPage.reportGeneration"), message: `正在生成${type}报表，请稍候...`, complete: false })
    setTimeout(() => {
      setProgressModal(p => ({ ...p, complete: true, message: `${type}报表已生成` }))
      setTimeout(() => setProgressModal(p => ({ ...p, show: false })), 2000)
    }, 1000)
  }

  const trendData = trendRange === '7d' ? dashboardData.trend7days : dashboardData.trend30days

  const statCardsReport = [
    { label: t("qcPage.todayReviews"), value: reportQCData.filter(r => r.date === '2026-05-01').length, icon: <FileText size={18} color={ACCENT} />, bg: '#3b82f622', color: ACCENT },
    { label: t("qcPage.avgScore"), value: '87.3', icon: <Star size={18} color={'#f59e0b'} />, bg: '#f59e0b22', color: '#f59e0b' },
    { label: t("qcPage.overdueReviews"), value: timeoutData.length, icon: <Clock size={18} color={WARNING} />, bg: '#f59e0b22', color: WARNING },
    { label: t("qcPage.excellentRate"), value: `${Math.round(reportQCData.filter(r => r.status === '优秀').length / reportQCData.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#22c55e22', color: SUCCESS },
  ]

  const statCardsImage = [
    { label: t("qcPage.todayCaptures"), value: imageQCData.length, icon: <Camera size={18} color={ACCENT} />, bg: '#3b82f622', color: ACCENT },
    { label: t("qcPage.excellentRate"), value: `${Math.round(imageQCData.filter(i => i.status === '优秀').length / imageQCData.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#22c55e22', color: SUCCESS },
    { label: t("qcPage.rejectRate"), value: `${Math.round(imageQCData.filter(i => i.status === '差').length / imageQCData.length * 100)}%`, icon: <AlertTriangle size={18} color={DANGER} />, bg: '#ef444422', color: DANGER },
    { label: t("qcPage.avgScore"), value: '87.2', icon: <Star size={18} color={'#f59e0b'} />, bg: '#f59e0b22', color: '#f59e0b' },
  ]

  

  const renderScoreBar = (value: number, max: number = 100) => {
    const pct = (value / max) * 100
    const color = pct >= 90 ? SUCCESS : pct >= 80 ? WARNING : pct >= 70 ? '#f97316' : DANGER
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{value}</span>
      </div>
    )
  }

  // 渲染区域质控子Tab
  const renderRegionalSubTabs = () => {
    const subTabs = [
      { key: 'overview', label: t("qcPage.regionalOverview"), icon: <BarChart2 size={14} /> },
      { key: 'ranking', label: t("qcPage.rankings"), icon: <Award size={14} /> },
      { key: 'standards', label: t("qcPage.qcStandards"), icon: <Target size={14} /> },
      { key: 'reports', label: t("qcPage.qcReports"), icon: <FileBarChart size={14} /> },
      { key: 'tracking', label: t("qcPage.issueTracking"), icon: <AlertTriangle size={14} /> },
    ]
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', marginBottom: 16, display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
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
    <div data-testid="qc-page" style={{ padding: 24, maxWidth: 1600, margin: '0 auto', background: 'var(--bg-card)', minHeight: '100vh' }}>
      {loading && <LoadingBanner message={t("qcPage.loading")} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Header */}
      <PageHeader
        as="h1"
        size="md"
        icon={<div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={18} color='#fff' /></div>}
        title={<>{t('qc.title')}<AppText size="xs" color="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>{t("qcPage.pageTitle")}</AppText></>}
        subtitle={<AppText size="sm" color="secondary" as="p" style={{ margin: 0 }}>{t('qc.subtitle')}</AppText>}
        style={{ marginBottom: 20 }}
      />

      {/* Tab Navigation */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '6px', marginBottom: 16, display: 'flex', gap: 4, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
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
                    background: 'linear-gradient(135deg, var(--color-success-bg) 0%, var(--color-info-bg) 100%)',
            border: '1px solid #86efac', borderRadius: 10, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 18 }}>🚀</div>
              <div style={{ flex: 1 }}>
              <AppText size="xs" weight={700} color="success" as="div">{t("qcPage.versionBadge")}</AppText>
              <AppText size="xs" color="success" as="div" style={{ marginTop: 2 }}>{t("qcPage.pageSubtitle2")}</AppText>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => navigate('/keyword-check')} style={{ padding: '5px 10px', border: '1px solid #3b82f6', borderRadius: 4, background: 'var(--bg-card)', color: '#1e40af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("qcPage.tabKeywordScan")}</button>
              <button onClick={() => navigate('/report-score-rule')} style={{ padding: '5px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: 'var(--bg-card)', color: '#5b21b6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("qcPage.tabScoreRules")}</button>
              <button onClick={() => navigate('/report-defect-library')} style={{ padding: '5px 10px', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-card)', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("qcPage.tabDefectLibrary")}</button>
              <button onClick={() => navigate('/ai-report-draft')} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("qcPage.tabAiDraft")}</button>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {statCardsReport.map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{card.value}</div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>

          {/* 评分系统三维矩阵 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={16} color={PRIMARY} />{t("qcPage.scoreMatrixTitle")}<AppText size="xs" color="secondary" style={{ fontWeight: 400 }}>{t("qcPage.scorePerfLink")}</AppText>
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
                  <AppText size="xs" color="secondary" as="div" style={{ lineHeight: 1.5 }}>{item.indicators}</AppText>
                </div>
              ))}
            </div>
            <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={14} color={WHITE} />
              </div>
              <div>
                <AppText size="sm" weight={700} as="div" style={{ color: PRIMARY }}>{t("qcPage.scoreFormula")}</AppText>
                <AppText size="xs" color="secondary" as="div" style={{ marginTop: 2 }}>{t("qcPage.scoreFormulaBody")}</AppText>
              </div>
            </div>
          </div>

          {/* 医生评分排行榜 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={16} color={PRIMARY} />{t("qcPage.doctorRanking")}<AppText size="xs" color="secondary" style={{ fontWeight: 400 }}>{t("qcPage.monthlyStats")}</AppText>
            </h3>
            {/* 排行榜统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: t("qcPage.avgTotal"), value: doctorScoreStats.avgTotalScore.toFixed(1), icon: <Star size={16} />, color: ACCENT, bg: '#3b82f622' },
                { label: t("qcPage.excellentDoctors"), value: `${doctorScoreStats.excellentCount}人`, icon: <Award size={16} />, color: SUCCESS, bg: '#22c55e22' },
                { label: t("qcPage.goodDoctors"), value: `${doctorScoreStats.goodCount}人`, icon: <ThumbsUp size={16} />, color: WARNING, bg: '#f59e0b22' },
                { label: t("qcPage.passDoctors"), value: `${doctorScoreStats.fairCount}人`, icon: <CheckCircle size={16} />, color: '#f97316', bg: '#f9731622' },
                { label: t("qcPage.needsImprovement"), value: `${doctorScoreStats.poorCount}人`, icon: <AlertTriangle size={16} />, color: DANGER, bg: '#ef444422' },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: card.color, marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <AppText size="xs" as="div" style={{ color: card.color, marginTop: 2 }}>{card.label}</AppText>
                </div>
              ))}
            </div>
            {/* 排行榜表格 */}
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.rank"), t("qcPage.doctorName"), t("qcPage.totalScore"), t("qcPage.formatScore"), t("qcPage.accuracyScore"), t("qcPage.timelinessScore"), t("qcPage.reportCount"), t("qcPage.perfGrade")].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctorScoreData.map((doctor, idx) => {
                  const isTop3 = doctor.rank <= 3
                  const rankBgColor = doctor.rank === 1 ? 'var(--color-warning-bg)' : doctor.rank === 2 ? 'var(--bg-card)' : doctor.rank === 3 ? 'var(--color-warning-bg)' : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'
                  const rankColor = doctor.rank === 1 ? '#92400e' : doctor.rank === 2 ? '#475569' : doctor.rank === 3 ? '#92400e' : PRIMARY
                  const gradeColor = doctor.totalScore >= 90 ? SUCCESS : doctor.totalScore >= 80 ? WARNING : doctor.totalScore >= 70 ? '#f97316' : DANGER
                  const gradeLabel = doctor.totalScore >= 90 ? t("qcPage.excellent") : doctor.totalScore >= 80 ? t("qcPage.good") : doctor.totalScore >= 70 ? t("qcPage.pass") : t("qcPage.needsImprovement")
                  return (
                    <tr key={doctor.id} style={{ borderBottom: `1px solid ${BORDER}`, background: rankBgColor }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-info-bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = rankBgColor}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {isTop3 ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Award size={16} color={doctor.rank === 1 ? '#fbbf24' : doctor.rank === 2 ? '#94a3b8' : '#cd7f32'} />
                            <span style={{ fontWeight: 800, fontSize: 14, color: rankColor }}>{doctor.rank}</span>
                          </div>
                        ) : (
                          <AppText size="sm" weight={700} color="secondary" as="span">{doctor.rank}</AppText>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <AppText size="sm" weight={700} as="span" style={{ color: PRIMARY }}>{doctor.name}</AppText>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: gradeColor }}>{doctor.totalScore}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.formatScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.accuracyScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderScoreBar(doctor.timelinessScore)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <AppText size="xs" color="secondary" as="span">{doctor.reportCount}{t("qcPage.reportUnit")}</AppText>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', background: doctor.totalScore >= 90 ? 'var(--color-success-bg)' : doctor.totalScore >= 80 ? 'var(--color-warning-bg)' : doctor.totalScore >= 70 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: gradeColor, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {gradeLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </div>

          {/* 质控问题分布 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 问题类型统计 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t("qcPage.issueDistribution")}<AppText size="xs" color="secondary" style={{ fontWeight: 400 }}>{t("qcPage.monthlyStats")}</AppText>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {qcIssueDistribution.map(item => (
                  <div key={item.issueType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <AppText size="xs" as="span" style={{ flex: 1 }}>{item.issueType}</AppText>
                    <AppText size="xs" weight={700} as="span" style={{ color: PRIMARY }}>{item.count}{t("qcPage.caseUnit")}</AppText>
                    <AppText size="xs" color="secondary" as="span" style={{ minWidth: 32 }}>{item.percentage}%</AppText>
                    <span style={{ fontSize: 12, padding: '1px 5px', background: item.trend === '下降' ? 'var(--color-success-bg)' : item.trend === '上升' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>
                      {item.trend === '下降' ? '↓' : item.trend === '上升' ? '↑' : '→'}
                    </span>
                  </div>
                ))}
              </div>
              <ChartContainer height={140}>
                <BarChart data={qcIssueDistribution} layout='vertical'>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                  <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                  <YAxis dataKey='issueType' type='category' tick={{ fontSize: 12, color: GRAY }} width={70} />
                  <Tooltip formatter={(v) => [`${v}例`, t("qcPage.quantity")]} />
                  <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                    {qcIssueDistribution.map((entry) => (
                      <Cell key={entry.issueType} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* 各维度平均分 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={16} color={PRIMARY} />{t("qcPage.dimAvgScores")}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t("qcPage.allDoctors")}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: t("qcPage.dimFormat"), score: doctorScoreStats.avgFormatScore, weight: '30%', color: '#3b82f6' },
                  { label: t("qcPage.dimAccuracy"), score: doctorScoreStats.avgAccuracyScore, weight: '50%', color: '#059669' },
                  { label: t("qcPage.dimTimeliness"), score: doctorScoreStats.avgTimelinessScore, weight: '20%', color: '#d97706' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                        <span style={{ padding: '1px 6px', background: `${item.color}20`, color: item.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{item.weight}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: item.score >= 85 ? SUCCESS : item.score >= 75 ? WARNING : DANGER }}>{item.score.toFixed(1)}{t("qcPage.scoreUnit")}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4 }}>
                      <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText size="xs" color="secondary" as="span">{t("qcPage.weightedAvg")}</AppText>
                  <span style={{ fontSize: 26, fontWeight: 700, color: PRIMARY }}>{doctorScoreStats.avgTotalScore.toFixed(1)}{t("qcPage.scoreUnit")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 甲乙丙丁等级分布 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={16} color={PRIMARY} />{t("qcPage.gradeDistribution")}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {gradeDistributionData.map(item => (
                <div key={item.grade} style={{ background: item.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `2px solid ${item.color}` }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.grade}</div>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.count}{t("qcPage.reportUnit")}</div>
                  <div style={{ fontSize: 12, color: item.color }}>{item.percentage}%</div>
                </div>
              ))}
            </div>
            <ChartContainer height={140}>
              <BarChart data={gradeDistributionData} layout='vertical'>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                <YAxis dataKey='grade' type='category' tick={{ fontSize: 12, color: GRAY }} width={20} />
                <Tooltip formatter={(v) => [`${v}份`, t("qcPage.quantity")]} />
                <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                  {gradeDistributionData.map((entry) => (
                    <Cell key={entry.grade} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Search & Filter */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 12, border: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: LIGHT_BG, borderRadius: 8, padding: '8px 12px' }}>
              <Search size={14} color={GRAY} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("qcPage.searchPlaceholder")} style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent', color: PRIMARY }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[t('qcPage.all'), t("qcPage.excellent"), t("qcPage.good"), t("qcPage.fair"), t("qcPage.poor")].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${filterStatus === s ? ACCENT : BORDER}`, background: filterStatus === s ? ACCENT : 'var(--bg-card)', color: filterStatus === s ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Report List */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.reportId"), t("qcPage.patientName"), t("qcPage.reportDoctor"), t("qcPage.reviewDoctor"), t("qcPage.grade"), t("qcPage.totalScore"), t("qcPage.completeness"), t("qcPage.accuracy"), t("qcPage.standardness"), t("qcPage.timeliness"), t("qcPage.status"), t("qcPage.actions")].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-info-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{r.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{r.reportDoctor}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{r.reviewDoctor}</td>
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
                      <button onClick={() => handleOpenRating(r)} style={{ padding: '4px 10px', background: 'var(--color-info-bg)', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                        <Eye size={14} />{t('qc.detail')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {activeTab === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat Cards [v3.0.6.11-96 Wave5A P2] imageQCData 为本地硬编码演示数据 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>{t("qcPage.demoData")}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {statCardsImage.map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{card.value}</div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>

          {/* Image QC Table */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.accessionNo"), t("qcPage.patient"), t("qcPage.device"), t("qcPage.imageScore"), t("qcPage.mainIssues"), t("qcPage.status"), t("qcPage.actions")].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imageFiltered.map((img, idx) => (
                  <tr key={img.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-info-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{img.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{img.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{img.device.split('（')[0]}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: SCORE_COLORS[img.status as keyof typeof SCORE_COLORS] }}>{img.score}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {img.issues.length === 0 ? (
                          <span style={{ fontSize: 12, color: SUCCESS }}>{t('qcimage.noIssues')}</span>
                        ) : img.issues.map(issue => (
                          <span key={issue} style={{ padding: '2px 6px', background: 'var(--color-error-bg)', color: DANGER, borderRadius: 4, fontSize: 12 }}>{issue}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 10px', background: STATUS_COLORS[img.status]?.bg, color: STATUS_COLORS[img.status]?.color, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                        {img.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => { setDetailModal({ show: true, title: `影像详情 ${img.id}`, content: `正在查看影像 ${img.id}` }) }} style={{ padding: '4px 10px', background: 'var(--color-info-bg)', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                        <Image size={14} />{t('qcimage.viewImage')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {/* Waste Film Analysis Chart */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{item.value}{t("qcPage.caseUnit")}</span>
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
          {/* Summary Cards [v3.0.6.11-96 Wave5A P2] timeoutData 为本地硬编码演示数据 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>{t("qcPage.demoData")}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Clock size={18} color={WARNING} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.timeoutCount')}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: WARNING }}>{timeoutData.length}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t("qcPage.shareOfToday")} {(timeoutData.length / reportQCData.length * 100).toFixed(0)}%</div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={18} color={DANGER} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.severeTimeout')}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: DANGER }}>{timeoutData.filter(t => t.severity === '严重').length}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t("qcPage.delayOver3h")}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={18} color={ACCENT} />
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{t('qc.avgDelay')}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>{Math.round(timeoutData.reduce((s, t) => s + t.delayMinutes, 0) / timeoutData.length)}</div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t("qcPage.minPerCase")}</div>
            </div>
          </div>

          {/* Timeout List */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.accessionNo"), t("qcPage.patient"), t("qcPage.examItem"), t("qcPage.plannedTime"), t("qcPage.actualReport"), t("qcPage.delayMinutes"), t("qcPage.overdueReason"), t("qcPage.severity")].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeoutData.map((t, idx) => {
                  const severityColor = t.severity === '严重' ? DANGER : t.severity === '中等' ? WARNING : GRAY
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY }}>{t.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{t.examItem}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.scheduledTime}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{t.actualReportTime}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: t.delayMinutes > 180 ? DANGER : t.delayMinutes > 120 ? WARNING : GRAY }}>
                          {t.delayMinutes}′
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{t.reason}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', background: t.severity === '严重' ? 'var(--color-error-bg)' : t.severity === '中等' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: severityColor, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {t.severity}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </div>

          {/* Reason Analysis & Suggestions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qc.timeoutAnalysis')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { reason: t("qcPage.reasonDeviceMaintenance"), count: 1, pct: '25%' },
                  { reason: t("qcPage.reasonDoctorMeeting"), count: 1, pct: '25%' },
                  { reason: t("qcPage.reasonEmergencyBacklog"), count: 1, pct: '25%' },
                  { reason: t("qcPage.reasonCheckupBacklog"), count: 1, pct: '25%' },
                ].map(item => (
                  <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{item.reason}</div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3 }}>
                        <div style={{ width: item.pct, height: '100%', background: WARNING, borderRadius: 3 }} />
                      </div>
                    </div>
                    <AppText size="xs" weight={700} as="span" style={{ color: PRIMARY, minWidth: 40, textAlign: 'right' }}>{item.count}{t("qcPage.caseUnit")}</AppText>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={16} color={SUCCESS} />{t('qcdefect.suggestions')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { suggestion: t("qcPage.actionDeviceMaintenance"), priority: t("qcPage.high") },
                  { suggestion: t("qcPage.actionMeetingScheduling"), priority: t("qcPage.medium2") },
                  { suggestion: t("qcPage.actionCheckupFastTrack"), priority: t("qcPage.medium2") },
                  { suggestion: t("qcPage.actionEmergencyScheduler"), priority: t("qcPage.high") },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: PRIMARY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{item.suggestion}</div>
                    </div>
                    <span style={{ padding: '1px 8px', background: item.priority === '高' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: item.priority === '高' ? DANGER : WARNING, borderRadius: 10, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
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
          {/* 抽检统计卡片 [v3.0.6.11-96 Wave5A P2] inspectionStats 为本地硬编码演示数据 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>{t("qcPage.demoData")}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { label: t("qcPage.samplingTotal"), value: inspectionStats.totalInspected, icon: <ClipboardList size={18} color={ACCENT} />, bg: '#3b82f622', color: ACCENT },
              { label: t("qcPage.samplingPassRate"), value: `${inspectionStats.passedRate}%`, icon: <CheckCircle size={18} color={SUCCESS} />, bg: '#22c55e22', color: SUCCESS },
              { label: t("qcPage.samplingGradeARate"), value: `${inspectionStats.excellentRate}%`, icon: <Award size={18} color={'#f59e0b'} />, bg: '#f59e0b22', color: '#f59e0b' },
              { label: t("qcPage.defectFoundRate"), value: `${inspectionStats.defectRate}%`, icon: <AlertTriangle size={18} color={WARNING} />, bg: '#f59e0b22', color: WARNING },
              { label: t("qcPage.samplingAvgScore"), value: inspectionStats.avgScore.toFixed(1), icon: <Star size={18} color={'#8b5cf6'} />, bg: '#8b5cf622', color: '#8b5cf6' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>

          {/* 抽检结果等级分布 + 缺陷统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 抽检等级分布 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardCheck size={16} color={PRIMARY} />{t('qcdefect.gradeDistribution')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {gradeDistributionData.map(item => (
                  <div key={item.grade} style={{ background: item.bg, borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: `2px solid ${item.color}` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.grade}</div>
                    <div style={{ fontSize: 12, color: item.color, fontWeight: 600 }}>{item.label.split('（')[1]?.replace('）', '')}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.count}{t("qcPage.reportUnit")}</div>
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qcdefect.defectStats')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span><span style={{ marginLeft: 6, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600, verticalAlign: 'middle' }}>{t("qcPage.demoData")}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reportDefectData.map(item => (
                  <div key={item.defectType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{item.defectType}</span>
                    <AppText size="xs" weight={700} as="span" style={{ color: PRIMARY }}>{item.count}{t("qcPage.caseUnit")}</AppText>
                    <AppText size="xs" color="secondary" as="span" style={{ minWidth: 32 }}>{item.percentage}%</AppText>
                    <span style={{ fontSize: 12, padding: '1px 5px', background: item.trend === '下降' ? 'var(--color-success-bg)' : item.trend === '上升' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>
                      {item.trend === '下降' ? '↓' : item.trend === '上升' ? '↑' : '→'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 抽检记录列表 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={16} color={ACCENT} />{t('qcdefect.inspectionList')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
              </h3>
              <button
                onClick={() => { setFormModal({ show: true, title: t("qcPage.newSample") }) }}
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
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.sampleId"), t("qcPage.reportId"), t("qcPage.patient"), t("qcPage.reportDoctor"), t("qcPage.sampleDoctor"), t("qcPage.sampleDate"), t("qcPage.grade"), t("qcPage.score"), t("qcPage.defect"), t("qcPage.reviewComment"), t("qcPage.status"), t("qcPage.actions")].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspectionRecordsData.map((record, idx) => (
                  <tr key={record.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-info-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{record.id}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: ACCENT }}>{record.reportId}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{record.patientName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{record.reportDoctor}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{record.inspector}</td>
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
                          <span key={d} style={{ padding: '1px 5px', background: 'var(--color-error-bg)', color: DANGER, borderRadius: 4, fontSize: 12 }}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)', maxWidth: 150 }}>{record.inspectorComment}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', background: record.status === '已通过' ? 'var(--color-success-bg)' : record.status === '需整改' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: record.status === '已通过' ? SUCCESS : record.status === '需整改' ? WARNING : DANGER, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => { setDetailModal({ show: true, title: `抽检详情 ${record.id}`, content: record.inspectorComment }) }} style={{ padding: '3px 8px', background: 'var(--color-info-bg)', color: ACCENT, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.detail')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {/* 抽检问题汇总与改进建议 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qcdefect.issueSummary')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { issue: t("qcPage.defectIncomplete"), count: inspectionRecordsData.filter(r => r.defects.includes(t("qcPage.defectIncomplete"))).length, severity: t("qcPage.high") },
                  { issue: t("qcPage.defectTerminology"), count: inspectionRecordsData.filter(r => r.defects.includes(t("qcPage.defectTerminology"))).length, severity: t("qcPage.medium2") },
                  { issue: t("qcPage.defectUnclearDiagnosis"), count: inspectionRecordsData.filter(r => r.defects.includes(t("qcPage.defectUnclearDiagnosis"))).length, severity: t("qcPage.high") },
                  { issue: t("qcPage.defectCriticalMissed"), count: inspectionRecordsData.filter(r => r.defects.includes(t("qcPage.defectCriticalMissed"))).length, severity: t("qcPage.high") },
                ].map(item => (
                  <div key={item.issue} style={{ display: 'flex', alignItems: 'center', gap: 10, background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.severity === '高' ? DANGER : WARNING, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{item.issue}</span>
                    <AppText size="xs" weight={700} as="span" style={{ color: PRIMARY }}>{item.count}{t("qcPage.caseUnit")}</AppText>
                    <span style={{ padding: '1px 6px', background: item.severity === '高' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: item.severity === '高' ? DANGER : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {item.severity === '高' ? t("qcPage.severe") : t("qcPage.medium")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={16} color={SUCCESS} />{t('qcdefect.suggestions')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { suggestion: t("qcPage.actionWritingTraining"), priority: t("qcPage.high") },
                  { suggestion: t("qcPage.actionTerminologyLibrary"), priority: t("qcPage.medium2") },
                  { suggestion: t("qcPage.actionCriticalFlow"), priority: t("qcPage.high") },
                  { suggestion: t("qcPage.actionGradeAExamples"), priority: t("qcPage.medium2") },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: PRIMARY, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{item.suggestion}</div>
                    </div>
                    <span style={{ padding: '1px 8px', background: item.priority === '高' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: item.priority === '高' ? DANGER : WARNING, borderRadius: 10, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
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
              { label: t("qcPage.complianceRate"), value: `${dashboardData.passRate}%`, icon: <Target size={18} color={SUCCESS} />, bg: '#22c55e22', color: SUCCESS },
              { label: t("qcPage.excellentGoodRate"), value: `${dashboardData.excellentRate}%`, icon: <Award size={18} color={'#f59e0b'} />, bg: '#f59e0b22', color: '#f59e0b' },
              { label: t("qcPage.totalReviews"), value: dashboardData.totalReviewed, icon: <FileText size={18} color={ACCENT} />, bg: '#3b82f622', color: ACCENT },
              { label: t("qcPage.compositeScore"), value: dashboardData.avgScore.toFixed(1), icon: <Star size={18} color={'#8b5cf6'} />, bg: '#8b5cf622', color: '#8b5cf6' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Pass Rate Ring */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t("qcPage.complianceExcellentRate2")}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ResponsiveContainer width='100%' height={180}>
                  <RechartsPie>
                    <Pie data={[{ name: t("qcPage.compliant"), value: dashboardData.passRate }, { name: t("qcPage.notCompliant"), value: 100 - dashboardData.passRate }]} cx='50%' cy='50%' innerRadius={50} outerRadius={75} dataKey='value'>
                      <Cell fill={SUCCESS} /><Cell fill='var(--border-color)' />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </RechartsPie>
                </ResponsiveContainer>
                <ResponsiveContainer width='100%' height={180}>
                  <RechartsPie>
                    <Pie data={[{ name: t("qcPage.excellentGood"), value: dashboardData.excellentRate }, { name: t("qcPage.notExcellentGood"), value: 100 - dashboardData.excellentRate }]} cx='50%' cy='50%' innerRadius={50} outerRadius={75} dataKey='value'>
                      <Cell fill={'#f59e0b'} /><Cell fill='var(--border-color)' />
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: SUCCESS }}>{dashboardData.passRate}%</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{t('qc.passRate')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{dashboardData.excellentRate}%</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{t('qc.excellentRate')}</div>
                </div>
              </div>
            </div>

            {/* Issue Distribution */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.imageIssueDist')}</h3>
              <ResponsiveContainer width='100%' height={200}>
                <BarChart data={dashboardData.issueDistribution} layout='vertical'>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('qc.scoreTrend')}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setTrendRange('7d')} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${trendRange === '7d' ? ACCENT : BORDER}`, background: trendRange === '7d' ? ACCENT : 'var(--bg-card)', color: trendRange === '7d' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.sevenDays')}</button>
                <button onClick={() => setTrendRange('30d')} style={{ padding: '4px 12px', borderRadius: 16, border: `1px solid ${trendRange === '30d' ? ACCENT : BORDER}`, background: trendRange === '30d' ? ACCENT : 'var(--bg-card)', color: trendRange === '30d' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.thirtyDays')}</button>
              </div>
            </div>
            <ResponsiveContainer width='100%' height={240}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                <XAxis dataKey='date' tick={{ fontSize: 12, color: GRAY }} />
                <YAxis domain={[75, 95]} tick={{ fontSize: 12, color: GRAY }} />
                <Tooltip formatter={(v, name) => [name === 'score' ? `${v}分` : `${v}份`, name === 'score' ? t("qcPage.score") : t("qcPage.reportCount")]} />
                <Area type='monotone' dataKey='score' stroke={ACCENT} fill='#3b82f622' strokeWidth={2} name='score' />
                <Line type='monotone' dataKey='count' stroke={SUCCESS} strokeWidth={1.5} dot={false} name='count' />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Weak Links & Target Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={WARNING} />{t('qc.weakLinks')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dashboardData.weakLinks.map((link, _idx) => (
                  <div key={link} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-warning-bg)', borderRadius: 8, padding: '10px 14px' }}>
                    <AlertTriangle size={16} color={WARNING} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#92400e' }}>{link}</span>
                    <span style={{ fontSize: 12, color: WARNING }}>{t('qc.needsImprove')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={16} color={ACCENT} />{t('qc.targetVsActual')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: t("qcPage.timelyRate"), target: '95%', actual: '88%', color: DANGER },
                  { label: t("qcPage.excellentGoodRate"), target: '70%', actual: '65%', color: WARNING },
                  { label: t("qcPage.rejectRate"), target: '<2%', actual: '1.8%', color: SUCCESS },
                  { label: t("qcPage.criticalNotify10min"), target: '100%', actual: '96%', color: WARNING },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.targetLabel")} {item.target} {t("qcPage.actualLabel")} <span style={{ fontWeight: 700, color: item.color }}>{item.actual}</span></span>
                    </div>
                      <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, position: 'relative' }}>
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
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color={ACCENT} />
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{regionalInstitutions.length}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.institutionCount')}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} color={SUCCESS} />
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{regionalInstitutions.reduce((sum, inst) => sum + inst.reportsThisMonth, 0).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.monthlyReportTotal')}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={18} color='#f59e0b' />
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{(regionalInstitutions.reduce((sum, inst) => sum + inst.avgScore, 0) / regionalInstitutions.length).toFixed(1)}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.regionalScore')}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#8b5cf622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={18} color='#8b5cf6' />
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{(regionalInstitutions.filter(i => i.level === '三甲').length + regionalInstitutions.filter(i => i.level === '三乙').length)}</div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('qc.tertiaryHospitals')}</div>
                  </div>
                </div>
              </div>

              {/* 区域趋势图 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} color={ACCENT} />{t('qc.regionalTrend')}</h3>
                <ResponsiveContainer width='100%' height={260}>
                  <AreaChart data={regionalOverallScores}>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[75, 95]} tick={{ fontSize: 12, color: GRAY }} />
                    <Tooltip formatter={(v, name) => {
                      if (name === 'avgScore') return [`${v}分`, t("qcPage.compositeScore")]
                      if (name === 'excellentRate') return [`${v}%`, t("qcPage.excellentGoodRate")]
                      if (name === 'passRate') return [`${v}%`, t("qcPage.complianceRate")]
                      return [v, name]
                    }} />
                    <Area type='monotone' dataKey='avgScore' stroke={ACCENT} fill='#3b82f622' strokeWidth={2} name='avgScore' />
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: inst.ranking <= 3 ? 'var(--color-warning-bg)' : 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inst.ranking <= 3 ? (
                          <Award size={18} color={inst.ranking === 1 ? '#fbbf24' : inst.ranking === 2 ? '#94a3b8' : '#cd7f32'} />
                        ) : (
                          <Building2 size={18} color={ACCENT} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{inst.name}</span>
                          <span style={{ padding: '1px 6px', background: inst.level === '三甲' ? 'var(--color-info-bg)' : inst.level === '三乙' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: inst.level === '三甲' ? ACCENT : inst.level === '三乙' ? SUCCESS : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{inst.level}</span>
                          <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.rankPrefix")}{inst.ranking}名</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.monthlyReports")} <span style={{ fontWeight: 600, color: PRIMARY }}>{inst.reportsThisMonth.toLocaleString()}</span></span>
                          <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.avgScoreLabel")} <span style={{ fontWeight: 600, color: inst.avgScore >= 85 ? SUCCESS : inst.avgScore >= 80 ? WARNING : DANGER }}>{inst.avgScore}</span></span>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color={WARNING} />{t('qc.unqualifiedAnalysis')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <ResponsiveContainer width='100%' height={200}>
                      <BarChart data={unqualifiedReasonData} layout='vertical'>
                        <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                        <XAxis type='number' tick={{ fontSize: 12, color: GRAY }} />
                        <YAxis dataKey='reason' type='category' tick={{ fontSize: 12, color: GRAY }} width={90} />
                        <Tooltip formatter={(v) => [`${v}例`, t("qcPage.quantity")]} />
                        <Bar dataKey='count' fill={WARNING} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {unqualifiedReasonData.map(item => (
                      <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{item.reason}</span>
                        <AppText size="xs" weight={700} as="span" style={{ color: PRIMARY }}>{item.count}{t("qcPage.caseUnit")}</AppText>
                        <span style={{ fontSize: 12, color: GRAY, minWidth: 36 }}>{item.percentage}%</span>
                        <span style={{ fontSize: 12, padding: '1px 6px', background: item.trend === '下降' ? 'var(--color-success-bg)' : item.trend === '上升' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: item.trend === '下降' ? SUCCESS : item.trend === '上升' ? DANGER : GRAY, borderRadius: 4 }}>{item.trend}</span>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={16} color={ACCENT} />{t('qc.regionalRanking')}</h3>
                <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                      {[t("qcPage.rank"), t("qcPage.institution"), t("qcPage.compositeScore"), t("qcPage.imageQuality"), t("qcPage.reportQuality"), t("qcPage.dimTimeliness"), t("qcPage.criticalReporting"), t("qcPage.trend")].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regionalRanking.map((r, idx) => (
                      <tr key={r.ranking} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-info-bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)'}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: r.ranking === 1 ? 'var(--color-warning-bg)' : r.ranking === 2 ? 'var(--bg-card)' : r.ranking === 3 ? 'var(--color-warning-bg)' : 'var(--color-info-bg)',
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
                </table></div>
              </div>

              {/* 雷达图对比 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.top3Comparison')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <ResponsiveContainer width='100%' height={280}>
                    <RadarChart data={[
                      { subject: t("qcPage.imageQuality"), top1: 93, top2: 91, top3: 89 },
                      { subject: t("qcPage.reportQuality"), top1: 90, top2: 88, top3: 88 },
                      { subject: t("qcPage.dimTimeliness"), top1: 88, top2: 87, top3: 86 },
                      { subject: t("qcPage.criticalReporting"), top1: 98, top2: 96, top3: 95 },
                    ]}>
                      <PolarGrid stroke='var(--border-color)' />
                      <PolarAngleAxis dataKey='subject' tick={{ fontSize: 12, color: GRAY }} />
                      <Radar name={t('qcPage.hospitalCity1')} dataKey='top1' stroke={PIE_COLORS[0]} fill={PIE_COLORS[0]} fillOpacity={0.2} />
                      <Radar name={t('qcPage.hospitalTcm')} dataKey='top2' stroke={PIE_COLORS[1]} fill={PIE_COLORS[1]} fillOpacity={0.2} />
                      <Radar name={t('qcPage.hospitalCity3')} dataKey='top3' stroke={PIE_COLORS[2]} fill={PIE_COLORS[2]} fillOpacity={0.2} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { name: t("qcPage.hospitalCity1"), score: 91.2, color: PIE_COLORS[0], rank: 1 },
                      { name: t("qcPage.hospitalTcm"), score: 89.5, color: PIE_COLORS[1], rank: 2 },
                      { name: t("qcPage.hospitalCity3"), score: 88.7, color: PIE_COLORS[2], rank: 3 },
                    ].map(inst => (
                      <div key={inst.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: inst.rank <= 3 ? 'var(--color-warning-bg)' : 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: '#92400e' }}>{inst.rank}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{inst.name}</div>
                          <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, marginTop: 6 }}>
                            <div style={{ width: `${inst.score}%`, height: '100%', background: inst.color, borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 26, fontWeight: 700, color: inst.color }}>{inst.score}</span>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Image size={16} color={ACCENT} />{t('qc.imageQualityStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { level: t("qcPage.excellent"), min: t("qcPage.score90plus"), desc: qcStandards.imageQuality.excellent.desc, color: SUCCESS, bg: '#22c55e22' },
                    { level: t("qcPage.good"), min: t("qcPage.score80to89"), desc: qcStandards.imageQuality.good.desc, color: WARNING, bg: '#f59e0b22' },
                    { level: t("qcPage.fair"), min: t("qcPage.score70to79"), desc: qcStandards.imageQuality.fair.desc, color: '#f97316', bg: '#f9731622' },
                    { level: t("qcPage.poor"), min: t("qcPage.scoreBelow70"), desc: qcStandards.imageQuality.poor.desc, color: DANGER, bg: '#ef444422' },
                  ].map(item => (
                    <div key={item.level} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `2px solid ${item.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.level}</span>
                        <span style={{ padding: '2px 8px', background: item.color, color: WHITE, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{item.min}</span>
                      </div>
                      <AppText size="xs" as="div" style={{ color: item.color, lineHeight: 1.5 }}>{item.desc}</AppText>
                    </div>
                  ))}
                </div>
              </div>

              {/* 报告质量标准 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color={ACCENT} />{t('qc.reportQualityStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { level: t("qcPage.excellent"), min: t("qcPage.score90plus"), desc: qcStandards.reportQuality.excellent.desc, color: SUCCESS, bg: '#22c55e22' },
                    { level: t("qcPage.good"), min: t("qcPage.score80to89"), desc: qcStandards.reportQuality.good.desc, color: WARNING, bg: '#f59e0b22' },
                    { level: t("qcPage.fair"), min: t("qcPage.score70to79"), desc: qcStandards.reportQuality.fair.desc, color: '#f97316', bg: '#f9731622' },
                    { level: t("qcPage.poor"), min: t("qcPage.scoreBelow70"), desc: qcStandards.reportQuality.poor.desc, color: DANGER, bg: '#ef444422' },
                  ].map(item => (
                    <div key={item.level} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `2px solid ${item.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.level}</span>
                        <span style={{ padding: '2px 8px', background: item.color, color: WHITE, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{item.min}</span>
                      </div>
                      <AppText size="xs" as="div" style={{ color: item.color, lineHeight: 1.5 }}>{item.desc}</AppText>
                    </div>
                  ))}
                </div>
              </div>

              {/* 检查时效标准 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color={ACCENT} />{t('qc.reportTimelinessStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { type: t("qcPage.criticalValue"), minutes: t("qcPage.emergency30Min"), desc: qcStandards.timeliness.urgent.desc, color: DANGER, bg: '#ef444422', icon: <AlertTriangle size={16} /> },
                    { type: t("qcPage.emergency"), minutes: t("qcPage.within60Min"), desc: qcStandards.timeliness.stat.desc, color: WARNING, bg: '#f59e0b22', icon: <Zap size={16} /> },
                    { type: t("qcPage.routine"), minutes: t("qcPage.routine2h"), desc: qcStandards.timeliness.routine.desc, color: ACCENT, bg: '#3b82f622', icon: <Clock size={16} /> },
                    { type: t("qcPage.special"), minutes: t("qcPage.special4h"), desc: qcStandards.timeliness.extended.desc, color: '#8b5cf6', bg: '#8b5cf622', icon: <FileText size={16} /> },
                  ].map(item => (
                    <div key={item.type} style={{ background: item.bg, borderRadius: 10, padding: '14px', border: `1px solid ${item.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ color: item.color }}>{item.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.type}</span>
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.minutes}</div>
                      <div style={{ fontSize: 12, color: item.color, lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 危急值漏报标准 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color={DANGER} />{t('qc.criticalValueStandard')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { type: t("qcPage.notify10Min"), rate: '100%', desc: qcStandards.criticalValue.required.desc, color: SUCCESS, bg: '#22c55e22' },
                    { type: t("qcPage.registerRate"), rate: '≥95%', desc: qcStandards.criticalValue.reported.desc, color: SUCCESS, bg: '#22c55e22' },
                    { type: t("qcPage.followupConfirmRate"), rate: '≥90%', desc: qcStandards.criticalValue.callback.desc, color: WARNING, bg: '#f59e0b22' },
                  ].map(item => (
                    <div key={item.type} style={{ background: item.bg, borderRadius: 10, padding: '16px', border: `1px solid ${item.color}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.type}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.rate}</div>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 12, border: '1px solid var(--border-color)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginRight: 8 }}>{t('qc.reportType')}</span>
                {[
                  { key: 'monthly', label: t("qcPage.monthlyReport"), icon: <FileBarChart size={14} /> },
                  { key: 'quarterly', label: t("qcPage.quarterlyReport"), icon: <BarChart2 size={14} /> },
                  { key: 'yearly', label: t("qcPage.annualReport"), icon: <FileBarChart size={14} /> },
                ].map(type => (
                  <button
                    key={type.key}
                    onClick={() => setRegionalReportType(type.key as typeof regionalReportType)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: `1px solid ${regionalReportType === type.key ? ACCENT : BORDER}`,
                      background: regionalReportType === type.key ? ACCENT : 'var(--bg-card)',
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
                    onClick={() => handleExportPDF(regionalReportType === 'monthly' ? t("qcPage.monthlyQcReport") : regionalReportType === 'quarterly' ? t("qcPage.quarterlyQcReport") : t("qcPage.annualQcReport"))}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: 'var(--bg-card)',
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
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileBarChart size={16} color={ACCENT} />{reportSummaryData.monthly.period} {t("qcPage.qcMonthlyReport")}
                      </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: t("qcPage.totalReports"), value: reportSummaryData.monthly.totalReports.toLocaleString(), icon: <FileText size={16} />, color: ACCENT, bg: '#3b82f622' },
                        { label: t("qcPage.avgScore"), value: reportSummaryData.monthly.avgScore, icon: <Star size={16} />, color: '#f59e0b', bg: '#f59e0b22' },
                        { label: t("qcPage.complianceRate"), value: `${reportSummaryData.monthly.passRate}%`, icon: <Target size={16} />, color: SUCCESS, bg: '#22c55e22' },
                        { label: t("qcPage.overdueReports"), value: reportSummaryData.monthly.timeoutCount, icon: <Clock size={16} />, color: WARNING, bg: '#f59e0b22' },
                      ].map(card => (
                        <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: card.color }}>{card.icon}</span>
                            <span style={{ fontSize: 12, color: card.color, fontWeight: 600 }}>{card.label}</span>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>{t("qcPage.excellentReportsLabel")} {reportSummaryData.monthly.excellentCount.toLocaleString()}</h4>
                        <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4 }}>
                          <div style={{ width: `${reportSummaryData.monthly.excellentCount / reportSummaryData.monthly.totalReports * 100}%`, height: '100%', background: SUCCESS, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.excellentGoodRateLabel")} {Math.round(reportSummaryData.monthly.excellentCount / reportSummaryData.monthly.totalReports * 100)}%</span>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>{t("qcPage.criticalReportsLabel")} {reportSummaryData.monthly.criticalValueReported}</h4>
                        <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4 }}>
                          <div style={{ width: `${reportSummaryData.monthly.criticalValueOnTime / reportSummaryData.monthly.criticalValueReported * 100}%`, height: '100%', background: ACCENT, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.timelyRateLabel")} {Math.round(reportSummaryData.monthly.criticalValueOnTime / reportSummaryData.monthly.criticalValueReported * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 问题分布 */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px' }}>{t('qc.monthlyIssues')}</h3>
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
                            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{item.type}</span>
                            <span style={{ fontWeight: 700, color: PRIMARY }}>{item.count}{t("qcPage.caseUnit")}</span>
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
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={16} color={ACCENT} />{reportSummaryData.quarterly.period} {t("qcPage.qcQuarterlyReport")}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: t("qcPage.totalReports"), value: reportSummaryData.quarterly.totalReports.toLocaleString(), color: ACCENT, bg: '#3b82f622' },
                      { label: t("qcPage.avgScore"), value: reportSummaryData.quarterly.avgScore, color: '#f59e0b', bg: '#f59e0b22' },
                      { label: t("qcPage.complianceRate"), value: `${reportSummaryData.quarterly.passRate}%`, color: SUCCESS, bg: '#22c55e22' },
                      { label: t("qcPage.overdueReports"), value: reportSummaryData.quarterly.timeoutCount, color: WARNING, bg: '#f59e0b22' },
                    ].map(card => (
                      <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                        <AppText size="xs" weight={600} as="div" style={{ color: card.color, marginBottom: 6 }}>{card.label}</AppText>
                        <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>{t("qcPage.momChange")}</h4>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {reportSummaryData.quarterly.trends.map(item => (
                        <div key={item.metric} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: GRAY }}>{item.metric}:</span>
                          <AppText size="sm" weight={700} as="span" style={{ color: PRIMARY }}>{item.value}</AppText>
                          <span style={{ fontSize: 12, color: item.trend === 'up' ? SUCCESS : item.trend === 'down' ? DANGER : GRAY }}>
                            {item.trend === 'up' ? <TrendingUp size={14} /> : item.trend === 'down' ? <TrendingDown size={14} /> : <Minus size={14} />}
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
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileBarChart size={16} color={ACCENT} />{reportSummaryData.yearly.period} {t("qcPage.qcAnnualReport")}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: t("qcPage.totalReports"), value: reportSummaryData.yearly.totalReports.toLocaleString(), color: ACCENT, bg: '#3b82f622' },
                      { label: t("qcPage.avgScore"), value: reportSummaryData.yearly.avgScore, color: '#f59e0b', bg: '#f59e0b22' },
                      { label: t("qcPage.complianceRate"), value: `${reportSummaryData.yearly.passRate}%`, color: SUCCESS, bg: '#22c55e22' },
                      { label: t("qcPage.overdueReports"), value: reportSummaryData.yearly.timeoutCount, color: WARNING, bg: '#f59e0b22' },
                    ].map(card => (
                      <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '12px 14px' }}>
                        <AppText size="xs" weight={600} as="div" style={{ color: card.color, marginBottom: 6 }}>{card.label}</AppText>
                        <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, margin: '0 0 10px' }}>{t("qcPage.annualExcellentInstitutions")}</h4>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {reportSummaryData.yearly.rankings.map((r, idx) => (
                        <div key={r.institution} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: idx === 0 ? 'var(--color-warning-bg)' : LIGHT_BG, borderRadius: 8, border: `1px solid ${idx === 0 ? '#fbbf24' : BORDER}` }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx === 0 ? '#fbbf24' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Award size={14} color={idx === 0 ? WHITE : GRAY} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{r.institution}</div>
                            <div style={{ fontSize: 12, color: GRAY }}>{t("qcPage.rankPrefix")}{idx + 1}{t("qcPage.doctorsDot")} {r.score}{t("qcPage.scoreUnit")}</div>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} color={WARNING} />{t('qc.issueTracking')}</h3>
                  <button
                    onClick={() => { setFormModal({ show: true, title: t("qcPage.newIssue") }) }}
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
                <VirtualTable
                  columns={[
                    { title: t("qcPage.recordId"), dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <span style={{ fontSize: 12, color: GRAY }}>{v}</span> },
                    { title: t("qcPage.institution2"), dataIndex: 'institution', key: 'institution', render: (v: string) => <span style={{ fontWeight: 600, color: PRIMARY, fontSize: 12 }}>{v}</span> },
                    {
                      title: t("qcPage.issueType"), dataIndex: 'issueType', key: 'issueType',
                      render: (v: string) => <span style={{ padding: '2px 8px', background: v.includes(t("qcPage.criticalValue")) ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: v.includes(t("qcPage.criticalValue")) ? DANGER : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{v}</span>,
                    },
                    { title: t("qcPage.issueDescription"), dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
                    {
                      title: t("qcPage.severity"), dataIndex: 'severity', key: 'severity', width: 90,
                      render: (v: string) => <span style={{ padding: '2px 8px', background: v === '高' ? 'var(--color-error-bg)' : v === '中' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: v === '高' ? DANGER : v === '中' ? WARNING : GRAY, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{v}</span>,
                    },
                    {
                      title: t("qcPage.status"), dataIndex: 'status', key: 'status', width: 90,
                      render: (v: string) => <span style={{ padding: '2px 8px', background: v === '已整改' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: v === '已整改' ? SUCCESS : WARNING, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{v}</span>,
                    },
                    { title: t("qcPage.reportedAt"), dataIndex: 'reportedDate', key: 'reportedDate', width: 110, render: (v: string) => <span style={{ fontSize: 12, color: GRAY }}>{v}</span> },
                    { title: t("qcPage.correctionDeadline"), dataIndex: 'dueDate', key: 'dueDate', width: 110, render: (v: string) => <span style={{ fontSize: 12, color: GRAY }}>{v}</span> },
                    {
                      title: t("qcPage.actions"), key: 'action', width: 90,
                      render: (_: unknown, item) => (
                        <button
                          onClick={() => { setDetailModal({ show: true, title: `问题详情 ${item.id}`, content: `${item.issueType} - ${item.description}` }) }}
                          style={{ padding: '3px 8px', background: 'var(--color-info-bg)', color: ACCENT, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >{t('qc.detail')}</button>
                      ),
                    },
                  ]}
                  dataSource={issueTrackingData}
                  rowKey="id"
                  height={380}
                  pageSize={10}
                />
              </div>

              {/* 整改统计 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: t("qcPage.pendingCorrection"), count: issueTrackingData.filter(i => i.status === '整改中').length, color: WARNING, bg: '#f59e0b22' },
                  { label: t("qcPage.corrected"), count: issueTrackingData.filter(i => i.status === '已整改').length, color: SUCCESS, bg: '#22c55e22' },
                  { label: t("qcPage.overdueCorrection"), count: 0, color: DANGER, bg: '#ef444422' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={18} color={item.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.count}</div>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', marginBottom: 8, display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
            {[
              { key: 'assignment', label: t("qcPage.randomAssign"), icon: <Users size={14} /> },
              { key: 'scoring', label: t("qcPage.scoringStandard"), icon: <Star size={14} /> },
              { key: 'reliability', label: t("qcPage.kappaAgreement"), icon: <BarChart3 size={14} /> },
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('qc.blindReviewAssignment')}</h3>
                <button onClick={handleRandomAssign} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={14} />{t('qc.randomAssign')}</button>
              </div>
              <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {[t("qcPage.caseId"), t("qcPage.patient"), t("qcPage.originalAuthor"), t("qcPage.reviewer"), t("qcPage.blindId"), t("qcPage.status"), t("qcPage.actions")].map(h => (<th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {peerReviewAssignments.map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{a.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{a.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{a.originalAuthor}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{a.reviewer}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{a.blindedId}</span></td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: a.status === '待评分' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', color: a.status === '待评分' ? WARNING : SUCCESS }}>{a.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => handlePeerReviewScore(a)} style={{ padding: '4px 10px', background: 'var(--color-info-bg)', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.score')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          {peerReviewTab === 'scoring' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.reviewCriteria')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { dim: t("qcPage.accuracyMetric2"), desc: t("qcPage.accuracyDesc"), weight: '40%', icon: <Target size={20} />, color: '#059669' },
                  { dim: t("qcPage.completenessMetric2"), desc: t("qcPage.completenessDesc"), weight: '35%', icon: <FileText size={20} />, color: '#3b82f6' },
                  { dim: t("qcPage.timelinessMetric2"), desc: t("qcPage.timelinessDesc"), weight: '25%', icon: <Clock size={20} />, color: '#f59e0b' },
                ].map(item => (
                  <div key={item.dim} style={{ background: `${item.color}10`, borderRadius: 10, padding: 16, border: `2px solid ${item.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE }}>{item.icon}</div>
                      <div><div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.dim}</div><div style={{ fontSize: 12, color: item.color, opacity: 0.7 }}>{t("qcPage.weight")} {item.weight}</div></div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {peerReviewTab === 'reliability' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.kappa')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: LIGHT_BG, borderRadius: 10, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, fontWeight: 800, color: kappaData.kappaValue >= 0.75 ? SUCCESS : kappaData.kappaValue >= 0.6 ? WARNING : DANGER }}>{kappaData.kappaValue.toFixed(2)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY, marginTop: 8 }}>Cohen's Kappa</div>
                  <div style={{ padding: '4px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'inline-block', marginTop: 8, background: kappaData.kappaValue >= 0.75 ? 'var(--color-success-bg)' : kappaData.kappaValue >= 0.6 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: kappaData.kappaValue >= 0.75 ? SUCCESS : kappaData.kappaValue >= 0.6 ? WARNING : DANGER }}>
                    {kappaData.agreement === 'substantial' ? t("qcPage.highlyConsistent") : kappaData.agreement === 'moderate' ? t("qcPage.moderatelyConsistent") : t("qcPage.needsImprovement2")}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: t("qcPage.reviewer1"), value: kappaData.reviewer1, color: ACCENT },
                      { label: t("qcPage.reviewer2"), value: kappaData.reviewer2, color: SUCCESS },
                      { label: t("qcPage.totalCases"), value: `${kappaData.totalCases}例`, color: PRIMARY },
                      { label: t("qcPage.consistentCases"), value: `${kappaData.agreedCases}例`, color: SUCCESS },
                      { label: t("qcPage.agreementRate"), value: `${(kappaData.agreedCases / kappaData.totalCases * 100).toFixed(1)}%`, color: WARNING },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6 }}>
                        <AppText size="xs" color="secondary">{item.label}</AppText>
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
              { label: t("qcPage.qualityScore"), value: `${overallQualityScore}/100`, icon: <Star size={18} />, color: overallQualityScore >= 80 ? SUCCESS : overallQualityScore >= 60 ? WARNING : DANGER, bg: overallQualityScore >= 80 ? 'var(--color-success-bg)' : overallQualityScore >= 60 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)' },
              { label: t("qcPage.totalRules"), value: qcRulesConfig.length, icon: <ClipboardList size={18} />, color: ACCENT, bg: '#3b82f622' },
              { label: t("qcPage.passCount"), value: qcRulesConfig.filter(r => r.passed).length, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#22c55e22' },
              { label: t("qcPage.failCount"), value: qcRulesConfig.filter(r => !r.passed).length, icon: <AlertTriangle size={18} />, color: DANGER, bg: '#ef444422' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div><AppText size="xs" color="secondary">{card.label}</AppText></div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
            {[
              { key: 'rules', label: t("qcPage.ruleConfig"), icon: <Settings size={14} /> },
              { key: 'results', label: t("qcPage.checkResult"), icon: <CheckCircle size={14} /> },
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.configurableRules')}</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {['structure', 'content', 'terminology', 'compliance'].map(cat => (
                  <span key={cat} style={{ padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'var(--bg-card)', color: GRAY }}>
                    {cat === 'structure' ? t("qcPage.structure") : cat === 'content' ? t("qcPage.content") : cat === 'terminology' ? t("qcPage.terminology") : t("qcPage.compliance")}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {qcRulesConfig.map(rule => {
                  const catColor = rule.category === 'structure' ? '#3b82f6' : rule.category === 'content' ? '#059669' : rule.category === 'terminology' ? '#f59e0b' : '#7c3aed'
                  return (
                    <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: LIGHT_BG, borderRadius: 8, border: `1px solid ${rule.passed ? 'var(--color-success-border)' : 'var(--color-error-border)'}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{rule.name}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>{rule.description}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: `${catColor}15`, color: catColor }}>{rule.category === 'structure' ? t("qcPage.structure") : rule.category === 'content' ? t("qcPage.content") : rule.category === 'terminology' ? t("qcPage.terminology") : t("qcPage.compliance")}</span>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: rule.passed ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: rule.passed ? SUCCESS : DANGER }}>{rule.passed ? t("qcPage.pass2") : t("qcPage.notPassed")}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {ruleCheckerTab === 'results' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.scoreDashboard')}</h3>
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
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--border-color)" strokeWidth="20" strokeLinecap="round" />
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${overallQualityScore * 1.6} 160`} />
                    </svg>
                    <div style={{ position: 'absolute', bottom: 20, fontSize: 28, fontWeight: 700, color: overallQualityScore >= 80 ? SUCCESS : overallQualityScore >= 60 ? WARNING : DANGER }}>{overallQualityScore}</div>
                  </div>
                  <div style={{ fontSize: 13, color: GRAY, marginTop: 8 }}>{t('qc.overallScore')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: t("qcPage.structure"), value: 85, color: '#3b82f6' },
                    { label: t("qcPage.content"), value: 78, color: '#059669' },
                    { label: t("qcPage.terminology"), value: 72, color: '#f59e0b' },
                    { label: t("qcPage.compliance"), value: 88, color: '#7c3aed' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: GRAY }}>{item.label}</span>
                        <span style={{ fontWeight: 700, color: item.color }}>{item.value}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3 }}>
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
              { label: t("qcPage.totalCompareCases"), value: concordanceStats.total, icon: <Activity size={18} />, color: ACCENT, bg: '#3b82f622' },
              { label: t("qcPage.consistent"), value: concordanceStats.concordant, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#22c55e22' },
              { label: t("qcPage.inconsistent"), value: concordanceStats.discordant, icon: <AlertTriangle size={18} />, color: DANGER, bg: '#ef444422' },
              { label: t("qcPage.agreementRate"), value: `${concordanceStats.total > 0 ? Math.round(concordanceStats.concordant / concordanceStats.total * 100) : 0}%`, icon: <Target size={18} />, color: '#f59e0b', bg: '#f59e0b22' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div><AppText size="xs" color="secondary">{card.label}</AppText></div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
            {[
              { key: 'overview', label: t("qcPage.compareOverview"), icon: <Activity size={14} /> },
              { key: 'discordant', label: t("qcPage.inconsistentCases"), icon: <AlertTriangle size={14} /> },
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.concordanceTrend')}</h3>
                <ResponsiveContainer width='100%' height={240}>
                  <AreaChart data={radPathTrend}>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} unit='%' />
                    <Tooltip formatter={(v) => [`${v}%`, t("qcPage.agreementRate")]} />
                    <Area type='monotone' dataKey='rate' stroke={SUCCESS} fill='var(--color-success-bg)' strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <thead>
                  <tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                    {[t("qcPage.caseId"), t("qcPage.patient"), t("qcPage.imagingDiagnosis"), t("qcPage.pathologyResult"), t("qcPage.consistency"), t("qcPage.date")].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radPathData.filter(d => d.concordance === 'concordant').map((d, idx) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{d.id}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY }}>{d.patientName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{d.radDiagnosis}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{d.pathResult}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--color-success-bg)', color: SUCCESS }}>
                          {d.concordance === 'concordant' ? t("qcPage.consistent") : d.concordance === 'discordant' ? t("qcPage.inconsistent") : t("qcPage.pending")}
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color={DANGER} />{t('qc.discordantAnalysis')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {radPathData.filter(d => d.concordance === 'discordant').map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--color-error-bg)', borderRadius: 8, border: '1px solid var(--color-error-border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={18} color={DANGER} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: PRIMARY }}>{d.patientName} ({d.id})</span>
                        <span style={{ fontSize: 12, color: GRAY }}>{d.date}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: 'var(--color-info-bg)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginBottom: 2 }}>{t('qc.radDiagnosis')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{d.radDiagnosis}</div>
                        </div>
                        <div style={{ background: '#ec489922', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 12, color: '#be185d', fontWeight: 600, marginBottom: 2 }}>{t('qc.pathResult')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{d.pathResult}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        {d.consultationStarted ? (
                          <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--color-info-bg)', color: ACCENT, fontSize: 12, fontWeight: 600 }}>{t("qcPage.consultationInitiated")}</span>
                        ) : (
                          <button onClick={() => handleStartConsultation(d)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.startConsultation')}</button>
                        )}
                        {d.needsReview ? (
                          <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--color-warning-bg)', color: WARNING, fontSize: 12, fontWeight: 600 }}>{t("qcPage.followupMarked")}</span>
                        ) : (
                          <button onClick={() => handleMarkReview(d)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('qc.markReview')}</button>
                        )}
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
              { label: t("qcPage.docReadiness"), value: `${readinessScore}%`, icon: <FileText size={18} />, color: readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER, bg: readinessScore >= 80 ? 'var(--color-success-bg)' : readinessScore >= 60 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)' },
              { label: t("qcPage.compliantModalities"), value: acrRequirementsData.filter(a => a.status === '已达标').length, icon: <CheckCircle size={18} />, color: SUCCESS, bg: '#22c55e22' },
              { label: t("qcPage.pendingModalities"), value: acrRequirementsData.filter(a => a.status !== '已达标').length, icon: <AlertTriangle size={18} />, color: WARNING, bg: '#f59e0b22' },
              { label: t("qcPage.historyChecklist"), value: inspectionFindings.length, icon: <ClipboardList size={18} />, color: ACCENT, bg: '#3b82f622' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div><AppText size="xs" color="secondary">{card.label}</AppText></div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
            {[
              { key: 'requirements', label: t("qcPage.acrChecklist"), icon: <ClipboardList size={14} /> },
              { key: 'readiness', label: t("qcPage.readinessCheck"), icon: <FileText size={14} /> },
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
                const statusBg = mod.status === '已达标' ? 'var(--color-success-bg)' : mod.status === '部分达标' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)'
                return (
                  <div key={mod.modality} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{mod.modality}</span>
                        <span style={{ fontSize: 12, color: GRAY }}>{mod.completed}/{mod.total} {t("qcPage.itemsCompliant")}</span>
                      </div>
                      <span style={{ padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: statusBg, color: statusColor }}>{mod.status}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, marginBottom: 12 }}>
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
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.readinessScoreTitle')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="55" fill="none" stroke="var(--border-color)" strokeWidth="10" />
                      <circle cx="70" cy="70" r="55" fill="none" stroke={readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER} strokeWidth="10" strokeDasharray={`${readinessScore * 3.45} 345`} strokeLinecap="round" transform="rotate(-90 70 70)" />
                      <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="800" fill={readinessScore >= 80 ? SUCCESS : readinessScore >= 60 ? WARNING : DANGER}>{readinessScore}</text>
                    </svg>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: t("qcPage.acrManual"), value: 80, color: SUCCESS },
                      { label: t("qcPage.acrSop"), value: 75, color: WARNING },
                      { label: t("qcPage.acrTrainingRecords"), value: 60, color: WARNING },
                      { label: t("qcPage.acrMaintenanceLog"), value: 85, color: SUCCESS },
                      { label: t("qcPage.acrDrillReport"), value: 55, color: DANGER },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: GRAY }}>{item.label}</span>
                          <span style={{ fontWeight: 700, color: item.color }}>{item.value}%</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--border-color)', borderRadius: 3 }}>
                          <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.inspectionFindings')}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: LIGHT_BG, borderBottom: `1px solid ${BORDER}` }}>
                    {[t("qcPage.date"), t("qcPage.checkInstitution"), t("qcPage.foundItems"), t("qcPage.severity"), t("qcPage.status")].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {inspectionFindings.map((f, idx) => (
                      <tr key={f.id} style={{ borderBottom: `1px solid ${BORDER}`, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{f.date}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PRIMARY }}>{f.inspector}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{f.findings}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: f.severity === '高' ? 'var(--color-error-bg)' : f.severity === '中' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: f.severity === '高' ? DANGER : f.severity === '中' ? WARNING : GRAY }}>{f.severity}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: f.status === '已整改' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: f.status === '已整改' ? SUCCESS : WARNING }}>{f.status}</span>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '4px', display: 'flex', gap: 4, border: '1px solid var(--border-color)' }}>
            {[
              { key: 'department', label: t("qcPage.deptOverallTrend"), icon: <BarChart3 size={14} /> },
              { key: 'individual', label: t("qcPage.personalTrend"), icon: <User size={14} /> },
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
                  { label: t("qcPage.currentMonthlyAvg"), value: monthlyQualityData[monthlyQualityData.length - 1].deptAvg, suffix: t("qcPage.scoreUnit"), color: ACCENT, bg: '#3b82f622' },
                  { label: t("qcPage.ucl"), value: monthlyQualityData[0].upperControl, suffix: t("qcPage.scoreUnit"), color: SUCCESS, bg: '#22c55e22' },
                  { label: t("qcPage.lcl"), value: monthlyQualityData[0].lowerControl, suffix: t("qcPage.scoreUnit"), color: WARNING, bg: '#f59e0b22' },
                  { label: t("qcPage.cl"), value: monthlyQualityData[0].mean, suffix: t("qcPage.scoreUnit"), color: '#8b5cf6', bg: '#8b5cf622' },
                ].map(card => (
                  <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target size={18} color={card.color} />
                    </div>
                    <div><div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}{card.suffix}</div><AppText size="xs" color="secondary">{card.label}</AppText></div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} color={ACCENT} />{t('qc.spcChart')}</h3>
                <ResponsiveContainer width='100%' height={280}>
                  <AreaChart data={monthlyQualityData}>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                    <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                    <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area type='monotone' dataKey='upperControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='UCL' />
                    <Area type='monotone' dataKey='lowerControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='LCL' />
                    <Area type='monotone' dataKey='mean' stroke='#64748b' strokeDasharray='3 3' fill='none' name='CL' />
                    <Line type='monotone' dataKey='deptAvg' stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} name={t('qcPage.hospitalAvgScore')} />
                    {monthlyQualityData.filter(d => d.deptAvg > d.upperControl || d.deptAvg < d.lowerControl).map((d, i) => (
                      <Line key={i} dataKey='deptAvg' data={[d]} stroke={DANGER} strokeWidth={0} dot={{ r: 6, fill: DANGER, stroke: WHITE, strokeWidth: 2 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {controlAlerts.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={16} color={DANGER} />{t('qc.controlAlerts')}</h3>
                  {controlAlerts.map((alert, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: alert.type.includes('out_of_control') ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', borderRadius: 6, marginBottom: 8 }}>
                      {alert.type.includes('out_of_control') ? <AlertTriangle size={14} color={DANGER} /> : <Bell size={14} color={WARNING} />}
                      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {trendAnalysisTab === 'individual' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>{t('qc.doctorTrendComparison')}</h3>
              <ResponsiveContainer width='100%' height={280}>
                <AreaChart data={monthlyQualityData}>
                  <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                  <XAxis dataKey='month' tick={{ fontSize: 12, color: GRAY }} />
                  <YAxis domain={[70, 95]} tick={{ fontSize: 12, color: GRAY }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type='monotone' dataKey='upperControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='UCL' />
                  <Area type='monotone' dataKey='mean' stroke='#64748b' strokeDasharray='3 3' fill='none' name='CL' />
                  <Area type='monotone' dataKey='lowerControl' stroke='#ef4444' strokeDasharray='5 5' fill='none' name='LCL' />
                  <Line type='monotone' dataKey='deptAvg' stroke={ACCENT} strokeWidth={2} dot={false} name={t('qcPage.hospitalAvgScore')} />
                  <Line type='monotone' dataKey='indivAvg' stroke={SUCCESS} strokeWidth={2} dot={{ r: 4, fill: SUCCESS }} name={t('qcPage.individualAvgScore')} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 16 }}>
                {indivDoctorTrendData.map((doc, idx) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: idx % 2 === 0 ? 'var(--color-info-bg)' : 'var(--color-success-bg)', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: doc.rank === 1 ? '#fbbf24' : doc.rank <= 3 ? '#94a3b8' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: WHITE }}>{doc.rank}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{doc.name}</div><div style={{ fontSize: 12, color: GRAY }}>{t("qcPage.report")} {doc.reportCount} {t("qcPage.reportUnit")}</div></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: doc.totalScore >= 90 ? SUCCESS : doc.totalScore >= 80 ? WARNING : DANGER }}>{doc.totalScore}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>{t("qcPage.totalScore")}</div>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} color={ACCENT} />{t('qc.reviewTimeoutSettings')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.reportTimeoutLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.reportTimeoutMinutes} onChange={e => setTempRules({ ...tempRules, reportTimeoutMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.reportTimeoutMinutes} {t("qcPage.minutes")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.ruleOverdueReminder")}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.reminderLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.reminderBeforeMinutes} onChange={e => setTempRules({ ...tempRules, reminderBeforeMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.reminderBeforeMinutes} {t("qcPage.minutes")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.ruleRemindBefore")}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.autoEscalateLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.autoEscalateAfterMinutes} onChange={e => setTempRules({ ...tempRules, autoEscalateAfterMinutes: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.autoEscalateAfterMinutes} {t("qcPage.minutes")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.ruleEscalateAfter")}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.dailyQuotaLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.dailyReviewQuota} onChange={e => setTempRules({ ...tempRules, dailyReviewQuota: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.dailyReviewQuota} {t("qcPage.reportsPerDoctor")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.dailyReviewPerDoctor2")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Image Quality Standards */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Image size={16} color={ACCENT} />{t('qc.imageScoreStandard')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.excellentStandard')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.imageScoreExcellent} onChange={e => setTempRules({ ...tempRules, imageScoreExcellent: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.imageScoreExcellent} {t("qcPage.scoreUnit")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.excellentThreshold")}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('qc.goodStandard')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRules ? (
                    <input type='number' value={tempRules.imageScoreGood} onChange={e => setTempRules({ ...tempRules, imageScoreGood: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <div style={{ flex: 1, padding: '8px 12px', background: LIGHT_BG, borderRadius: 8, fontSize: 13, fontWeight: 600, color: PRIMARY }}>{qcRules.imageScoreGood} {t("qcPage.scoreUnit")}</div>
                  )}
                  <span style={{ fontSize: 12, color: GRAY }}>{t("qcPage.goodThreshold")}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--color-warning-bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>{t('qc.gradeDescription')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { level: t("qcPage.excellent"), range: `≥${qcRules.imageScoreExcellent}分`, color: SUCCESS, bg: '#22c55e22' },
                  { level: t("qcPage.good"), range: `${qcRules.imageScoreGood}-${qcRules.imageScoreExcellent - 1}分`, color: WARNING, bg: '#f59e0b22' },
                  { level: t("qcPage.fair"), range: t("qcPage.score70to79"), color: '#c2410c', bg: '#f9731622' },
                  { level: t("qcPage.poor"), range: t("qcPage.scoreBelow70"), color: DANGER, bg: '#ef444422' },
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={16} color={ACCENT} />{t('qc.reminderRules')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: t("qcPage.alertOverdueReminder"), enabled: true, desc: t("qcPage.alertOverdueDesc") },
                { label: t("qcPage.alertCriticalTracking"), enabled: true, desc: t("qcPage.alertCriticalDesc") },
                { label: t("qcPage.alertScoreWarning"), enabled: true, desc: t("qcPage.alertScoreDesc") },
                { label: t("qcPage.alertRejectAuto"), enabled: false, desc: t("qcPage.alertRejectDesc") },
                { label: t("qcPage.alertPeerAssign"), enabled: true, desc: t("qcPage.alertPeerDesc") },
              ].map((rule, _idx) => (
                <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: LIGHT_BG, borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{rule.label}</div>
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{rule.desc}</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: rule.enabled ? SUCCESS : BORDER, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 2, left: rule.enabled ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save / Reset Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {editingRules ? (
              <>
                <button onClick={() => { setEditingRules(false); setTempRules({ ...qcRules }); }} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* [v3.0.6.11-103 Wave 10] 重复页合并: 嵌入 QualityControlPage (评分/危急值/缺陷/月报/实时仪表盘) */}
      {activeTab === 'v3' && (
        <div data-testid="qc-embedded-quality-control" style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border-color)' }}>
          <QualityControlPage />
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 10] 重复页合并: 嵌入 RadiologyQCDashboardPage (放射科质控总看板) */}
      {activeTab === 'radDashboard' && (
        <div data-testid="qc-embedded-rad-dashboard" style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border-color)' }}>
          <RadiologyQCDashboardPage />
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 5A] 质控收敛: 嵌入 AIQCPage (AI 智能质控, 旧路由 /ai-qc redirect → /qc?tab=ai) */}
      {activeTab === 'ai' && (
        <div data-testid="qc-embedded-ai-qc" style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border-color)' }}>
          <AIQCPage />
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 5A] 质控收敛: 嵌入 DepartmentQualityPage (科室质量, 旧路由 /quality/department redirect → /qc?tab=deptQuality) */}
      {activeTab === 'deptQuality' && (
        <div data-testid="qc-embedded-dept-quality" style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border-color)' }}>
          <DepartmentQualityPage />
        </div>
      )}

      {/* 评分弹窗 */}
      {showRatingModal && selectedReport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRatingModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: PRIMARY }}>{t('dc.qualityScore')}</h2>
              <button onClick={() => setShowRatingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, background: `${PRIMARY}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={28} color={PRIMARY} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{selectedReport.patientName}</div>
                <div style={{ fontSize: 12, color: GRAY }}>{selectedReport.id}</div>
                <div style={{ fontSize: 12, color: GRAY }}>{t("qcPage.reportDoctorLabel")} {selectedReport.reportDoctor}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { dimension: t("qcPage.completeness"), score: selectedReport.completeness, key: 'completeness' },
                { dimension: t("qcPage.accuracy"), score: selectedReport.accuracy, key: 'accuracy' },
                { dimension: t("qcPage.standardness"), score: selectedReport.standardization, key: 'standardization' },
                { dimension: t("qcPage.timeliness"), score: selectedReport.timeliness, key: 'timeliness' },
              ].map(item => (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{item.dimension}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: SCORE_COLORS[item.score >= 90 ? "优秀" : item.score >= 80 ? "良好" : "一般"] }}>{item.score}{t("qcPage.scoreUnit")}</span>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 32, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            {!progressModal.complete ? (
              <>
                <div style={{ width: 48, height: 48, border: '4px solid var(--border-color)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, marginBottom: 8 }}>{progressModal.title}</div>
                <AppText size="sm" color="secondary" as="div">{progressModal.message}</AppText>
              </>
            ) : (
              <>
                <CheckCircle size={48} color={SUCCESS} style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: SUCCESS, marginBottom: 8 }}>{progressModal.title}{t("qcPage.complete")}</div>
                <AppText size="sm" color="secondary" as="div">{progressModal.message}</AppText>
              </>
            )}
          </div>
        </div>
      )}

      {/* 详情Modal */}
      {detailModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailModal(d => ({ ...d, show: false }))}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: PRIMARY }}>{detailModal.title}</h2>
              <button onClick={() => setDetailModal(d => ({ ...d, show: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{detailModal.content}</div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetailModal(d => ({ ...d, show: false }))} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('dcm.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 表单Modal */}
      {formModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setFormModal(f => ({ ...f, show: false }))}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: PRIMARY }}>{formModal.title}</h2>
              <button onClick={() => setFormModal(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ fontSize: 13, color: GRAY, textAlign: 'center', padding: '20px 0' }}>{t("qcPage.formContentDemo")}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setFormModal(f => ({ ...f, show: false }))} style={{ padding: '8px 20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('dc.cancel')}</button>
              <button onClick={() => { setFormModal(f => ({ ...f, show: false })); showToast(`${formModal.title}成功`, 'success') }} style={{ padding: '8px 20px', background: ACCENT, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('qc.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 盲审评分详情 Modal (W3-C) */}
      {peerReviewDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPeerReviewDetail(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: PRIMARY }}>{t("qcPage.blindReviewDetail")} {peerReviewDetail.id}</h2>
              <button onClick={() => setPeerReviewDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: t("qcPage.case"), value: `${peerReviewDetail.caseId} · ${peerReviewDetail.patientName}` },
                { label: t("qcPage.blindId"), value: peerReviewDetail.blindedId },
                { label: t("qcPage.reviewer"), value: peerReviewDetail.reviewer },
                { label: t("qcPage.accuracy"), value: `${peerReviewDetail.accuracy} 分` },
                { label: t("qcPage.completeness"), value: `${peerReviewDetail.completeness} 分` },
                { label: t("qcPage.timeliness"), value: `${peerReviewDetail.timeliness} 分` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6 }}>
                  <AppText size="xs" color="secondary">{item.label}</AppText>
                  <AppText size="sm" weight={700} as="span" style={{ color: PRIMARY }}>{item.value}</AppText>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPeerReviewDetail(null)} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('dcm.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
