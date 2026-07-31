import {
  ShieldCheck, AlertTriangle, CheckCircle, Star,
  TrendingUp, TrendingDown, BarChart3, Clock, Image, Eye,
  Target, Award, FileText, Zap, ThumbsUp, Plus,
  Building2, Globe, Download, FileBarChart, ChevronDown,
  ChevronUp, BarChart2, ClipboardCheck, ClipboardList,
  Users, Activity, User, Search,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts'
import QCFilter from './QCFilter'
import { useState, useEffect } from 'react'
import { qcextApi, type QcScoreDto, type QcStatsDto } from '../../services/api/qcextApi'

const PRIMARY = '#1e40af'
const PRIMARY_LIGHT = '#2563eb'
const ACCENT = '#3b82f6'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const GRAY = '#64748b'
const LIGHT_BG = '#f8fafc'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'

const GRADE_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  '甲': { bg: '#d1fae5', color: '#059669', border: '#059669', label: '甲级（优秀）' },
  '乙': { bg: '#dbeafe', color: '#1e40af', border: '#1e40af', label: '乙级（良好）' },
  '丙': { bg: '#fef3c7', color: '#d97706', border: '#d97706', label: '丙级（合格）' },
  '丁': { bg: '#fee2e2', color: '#dc2626', border: '#dc2626', label: '丁级（不合格）' },
}

const SCORE_MATRIX = [
  { dimension: '格式规范', weight: '30%', indicators: '报告完整性/模板使用/描述规范', color: '#3b82f6' },
  { dimension: '诊断准确', weight: '50%', indicators: '误诊率/漏诊率/修改次数', color: '#059669' },
  { dimension: '时效性', weight: '20%', indicators: '报告及时率/超时率', color: '#f59e0b' },
]

const SCORE_WEIGHTS = { format: 0.3, accuracy: 0.5, timeliness: 0.2 }

const SCORE_COLORS: Record<string, string> = {
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

const reportQCData = [
  { id: 'RAD-RPT001', patientName: '张志刚', reportDoctor: '李明辉', reviewDoctor: '王秀峰', score: 95, completeness: 95, accuracy: 98, standardization: 92, timeliness: 94, status: '优秀', date: '2026-05-01', grade: '甲' },
  { id: 'RAD-RPT002', patientName: '李秀英', reportDoctor: '王秀峰', reviewDoctor: '李明辉', score: 88, completeness: 90, accuracy: 85, standardization: 88, timeliness: 90, status: '良好', date: '2026-05-01', grade: '乙' },
  { id: 'RAD-RPT003', patientName: '赵晓敏', reportDoctor: '张海涛', reviewDoctor: '刘芳', score: 82, completeness: 80, accuracy: 85, standardization: 80, timeliness: 85, status: '良好', date: '2026-05-01', grade: '乙' },
  { id: 'RAD-RPT004', patientName: '王建国', reportDoctor: '刘芳', reviewDoctor: '王秀峰', score: 92, completeness: 90, accuracy: 95, standardization: 90, timeliness: 92, status: '优秀', date: '2026-04-30', grade: '甲' },
  { id: 'RAD-RPT005', patientName: '周玉芬', reportDoctor: '李明辉', reviewDoctor: '张海涛', score: 78, completeness: 75, accuracy: 80, standardization: 78, timeliness: 80, status: '一般', date: '2026-04-30', grade: '丙' },
  { id: 'RAD-RPT006', patientName: '孙伟', reportDoctor: '王秀峰', reviewDoctor: '李明辉', score: 90, completeness: 88, accuracy: 92, standardization: 90, timeliness: 90, status: '优秀', date: '2026-04-30', grade: '甲' },
  { id: 'RAD-RPT007', patientName: '吴婷', reportDoctor: '张海涛', reviewDoctor: '刘芳', score: 85, completeness: 85, accuracy: 85, standardization: 85, timeliness: 85, status: '良好', date: '2026-04-29', grade: '乙' },
  { id: 'RAD-RPT008', patientName: '郑丽', reportDoctor: '刘芳', reviewDoctor: '王秀峰', score: 91, completeness: 90, accuracy: 92, standardization: 90, timeliness: 92, status: '优秀', date: '2026-04-29', grade: '甲' },
  { id: 'RAD-RPT009', patientName: '陈大军', reportDoctor: '李明辉', reviewDoctor: '王秀峰', score: 68, completeness: 65, accuracy: 70, standardization: 68, timeliness: 70, status: '差', date: '2026-04-28', grade: '丁' },
  { id: 'RAD-RPT010', patientName: '刘海燕', reportDoctor: '张海涛', reviewDoctor: '刘芳', score: 76, completeness: 75, accuracy: 78, standardization: 74, timeliness: 78, status: '一般', date: '2026-04-28', grade: '丙' },
]

const doctorScoreData = [
  { id: 'D001', name: '李明辉', totalScore: 96, formatScore: 94, accuracyScore: 98, timelinessScore: 94, reportCount: 152, rank: 1 },
  { id: 'D002', name: '王秀峰', totalScore: 94, formatScore: 92, accuracyScore: 96, timelinessScore: 92, reportCount: 148, rank: 2 },
  { id: 'D003', name: '张海涛', totalScore: 91, formatScore: 88, accuracyScore: 94, timelinessScore: 88, reportCount: 135, rank: 3 },
  { id: 'D004', name: '刘芳', totalScore: 88, formatScore: 90, accuracyScore: 86, timelinessScore: 90, reportCount: 128, rank: 4 },
  { id: 'D005', name: '陈志强', totalScore: 85, formatScore: 84, accuracyScore: 86, timelinessScore: 84, reportCount: 118, rank: 5 },
  { id: 'D006', name: '周玉芬', totalScore: 82, formatScore: 80, accuracyScore: 84, timelinessScore: 82, reportCount: 112, rank: 6 },
  { id: 'D007', name: '吴婷', totalScore: 78, formatScore: 76, accuracyScore: 80, timelinessScore: 78, reportCount: 98, rank: 7 },
  { id: 'D008', name: '郑丽', totalScore: 74, formatScore: 72, accuracyScore: 76, timelinessScore: 74, reportCount: 89, rank: 8 },
  { id: 'D009', name: '孙伟', totalScore: 68, formatScore: 65, accuracyScore: 70, timelinessScore: 70, reportCount: 76, rank: 9 },
  { id: 'D010', name: '赵晓敏', totalScore: 63, formatScore: 60, accuracyScore: 66, timelinessScore: 62, reportCount: 65, rank: 10 },
]

const doctorScoreStats = {
  avgTotalScore: 79.7,
  avgFormatScore: 80.1,
  avgAccuracyScore: 83.6,
  avgTimelinessScore: 79.4,
  totalDoctors: 10,
  excellentCount: 3,
  goodCount: 3,
  fairCount: 2,
  poorCount: 2,
}

const qcIssueDistribution = [
  { issueType: '格式错误', count: 28, percentage: 32, color: '#3b82f6', trend: '下降' },
  { issueType: '描述不规范', count: 24, percentage: 28, color: '#f59e0b', trend: '下降' },
  { issueType: '疑似误诊', count: 18, percentage: 21, color: '#ef4444', trend: '上升' },
  { issueType: '超时', count: 17, percentage: 19, color: '#8b5cf6', trend: '持平' },
]

const reportWritingAccuracyData = {
  overallAccuracy: 94.2,
  detailAccuracy: {
    anatomy: 96.5,
    pathology: 93.8,
    diagnosis: 94.7,
    terminology: 92.1,
    completeness: 95.3,
  },
  monthlyTrend: [
    { month: '2025-07', accuracy: 91.2 },
    { month: '2025-08', accuracy: 92.1 },
    { month: '2025-09', accuracy: 92.8 },
    { month: '2025-10', accuracy: 93.1 },
    { month: '2025-11', accuracy: 93.5 },
    { month: '2025-12', accuracy: 93.8 },
    { month: '2026-01', accuracy: 94.0 },
    { month: '2026-02', accuracy: 93.7 },
    { month: '2026-03', accuracy: 94.1 },
    { month: '2026-04', accuracy: 94.2 },
  ],
  writingErrors: [
    { errorType: '错别字/笔误', count: 45, rate: '2.8%' },
    { errorType: '单位/数值错误', count: 28, rate: '1.7%' },
    { errorType: '时间/日期错误', count: 15, rate: '0.9%' },
    { errorType: '患者信息错误', count: 8, rate: '0.5%' },
  ],
}

interface GradeData {
  grade: string
  label: string
  count: number
  percentage: number
  color: string
  bg: string
  description: string
}

interface DefectData {
  defectType: string
  count: number
  percentage: number
  trend: string
  color: string
}

interface TimeoutItem {
  id: string
  patientName: string
  examItem: string
  scheduledTime: string
  actualReportTime: string
  delayMinutes: number
  reason: string
  severity: string
}

interface QCScorePanelProps {
  navigate: (path: string) => void
  search: string
  setSearch: (value: string) => void
  filterStatus: string
  setFilterStatus: (value: string) => void
  timeoutData: TimeoutItem[]
  gradeDistributionData: GradeData[]
  reportDefectData: DefectData[]
  setSelectedReport: (r: typeof reportQCData[0] | null) => void
  setShowRatingModal: (v: boolean) => void
  setDetailModal: (v: { show: boolean; title: string; content: string }) => void
}

function renderScoreBar(value: number) {
  const pct = value
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

function renderStars(score: number, size: number = 14) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size} fill={s <= score ? '#f59e0b' : 'none'} color={s <= score ? '#f59e0b' : '#d1d5db'} />
      ))}
    </div>
  )
}

export default function QCScorePanel({
  navigate,
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  timeoutData,
  gradeDistributionData,
  reportDefectData,
  setSelectedReport,
  setShowRatingModal,
  setDetailModal,
}: QCScorePanelProps) {
  const [scores, setScores] = useState<QcScoreDto[]>([]);
  const [qcStats, setQcStats] = useState<QcStatsDto | null>(null);
  useEffect(() => {
    qcextApi.listQcScores().then(res => { if (res.success) setScores(res.data); }).catch((err) => { console.error('[F04]', err); });
    qcextApi.getQcStats().then(res => { if (res.success) setQcStats(res.data); }).catch((err) => { console.error('[F04]', err); });
  }, []);
  const statCardsReport = [
    { label: '今日审核数', value: reportQCData.filter(r => r.date === '2026-05-01').length, icon: <FileText size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
    { label: '平均评分', value: '87.3', icon: <Star size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
    { label: '超时审核数', value: timeoutData.length, icon: <Clock size={18} color={WARNING} />, bg: '#fef3c7', color: WARNING },
    { label: '优秀率', value: `${Math.round(reportQCData.filter(r => r.status === '优秀').length / reportQCData.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
  ]

  const filteredReports = reportQCData.filter(r => {
    const matchSearch = !search || r.patientName.includes(search) || r.id.includes(search)
    const matchStatus = filterStatus === '全部' || r.status === filterStatus
    return matchSearch && matchStatus
  })

  const handleOpenRating = (report: typeof reportQCData[0]) => {
    setSelectedReport(report)
    setShowRatingModal(true)
  }

  return (
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
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = rankBgColor }}
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
              <Tooltip formatter={(v: number) => [`${v}例`, '数量']} />
              <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                {qcIssueDistribution.map((entry) => (
                  <Cell key={entry.issueType} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

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
          <Award size={16} color={PRIMARY} />报告质量等级分布（甲乙丙丁）<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>国家卫健委2024年版</span>
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
            <Tooltip formatter={(v: number) => [`${v}份`, '数量']} />
            <Bar dataKey='count' radius={[0, 4, 4, 0]}>
              {gradeDistributionData.map((entry) => (
                <Cell key={entry.grade} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Search & Filter */}
      <QCFilter
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

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
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc' }}
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
                  <span style={{ fontWeight: 800, fontSize: 14, color: SCORE_COLORS[r.status] }}>{r.score}</span>
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
                    <Eye size={12} />详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
