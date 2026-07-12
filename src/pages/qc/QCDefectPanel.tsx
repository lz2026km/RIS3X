import { t } from '../../i18n/appI18n'
import { Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { qcextApi, type QcDefectDto, type QcStatsDto } from '../../services/api/qcextApi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, PieChart as RechartsPie, Pie,
} from 'recharts'

const PRIMARY = '#1e40af'
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

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#64748b']

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

interface InspectionRecord {
  id: string
  reportId: string
  patientName: string
  reportDoctor: string
  inspector: string
  inspectionDate: string
  grade: string
  score: number
  defects: string[]
  inspectorComment: string
  status: string
}

interface InspectionStats {
  totalInspected: number
  passedRate: number
  excellentRate: number
  defectRate: number
  avgScore: number
}

interface QCDefectPanelProps {
  gradeDistributionData: GradeData[]
  reportDefectData: DefectData[]
  onViewDetail: (title: string, content: string) => void
  onNewRecord: (title: string) => void
}

const inspectionRecordsData: InspectionRecord[] = [
  { id: 'INS-20260501-001', reportId: 'RAD-RPT001', patientName: '张志刚', reportDoctor: '李明辉', inspector: '王秀峰', inspectionDate: '2026-05-01', grade: '甲', score: 95, defects: [], inspectorComment: '报告规范完整，无缺陷', status: '已通过' },
  { id: 'INS-20260501-002', reportId: 'RAD-RPT005', patientName: '周玉芬', reportDoctor: '李明辉', inspector: '王秀峰', inspectionDate: '2026-05-01', grade: '丙', score: 72, defects: ['描述不完整/漏项', '术语使用不规范'], inspectorComment: '部分检查所见描述不完整，术语需规范', status: '需整改' },
  { id: 'INS-20260501-003', reportId: 'RAD-RPT009', patientName: '陈大军', reportDoctor: '李明辉', inspector: '张海涛', inspectionDate: '2026-05-01', grade: '丁', score: 58, defects: ['描述不完整/漏项', '诊断结论不明确', '危急值漏报/迟报'], inspectorComment: '报告存在严重缺陷，需重新书写', status: '不合格' },
  { id: 'INS-20260430-001', reportId: 'RAD-RPT004', patientName: '王建国', reportDoctor: '刘芳', inspector: '李明辉', inspectionDate: '2026-04-30', grade: '甲', score: 92, defects: [], inspectorComment: '优秀报告', status: '已通过' },
  { id: 'INS-20260430-002', reportId: 'RAD-RPT006', patientName: '孙伟', reportDoctor: '王秀峰', inspector: '刘芳', inspectionDate: '2026-04-30', grade: '甲', score: 90, defects: [], inspectorComment: '报告质量良好', status: '已通过' },
  { id: 'INS-20260429-001', reportId: 'RAD-RPT010', patientName: '刘海燕', reportDoctor: '张海涛', inspector: '王秀峰', inspectionDate: '2026-04-29', grade: '丙', score: 74, defects: ['术语使用不规范'], inspectorComment: '术语使用需进一步规范', status: '需整改' },
  { id: 'INS-20260428-001', reportId: 'RAD-RPT007', patientName: '吴婷', reportDoctor: '张海涛', inspector: '李明辉', inspectionDate: '2026-04-28', grade: '乙', score: 85, defects: [], inspectorComment: '良好', status: '已通过' },
]

const inspectionStats: InspectionStats = {
  totalInspected: 156,
  passedRate: 84.0,
  excellentRate: 52.6,
  defectRate: 27.6,
  avgScore: 88.5,
}

export default function QCDefectPanel({ gradeDistributionData, reportDefectData, onViewDetail, onNewRecord }: QCDefectPanelProps) {
  const [defects, setDefects] = useState<QcDefectDto[]>([]);
  const [stats, setStats] = useState<QcStatsDto | null>(null);
  useEffect(() => {
    qcextApi.listQcDefects().then(res => { if (res.success) setDefects(res.data); }).catch(() => {});
    qcextApi.getQcStats().then(res => { if (res.success) setStats(res.data); }).catch(() => {});
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: '本月抽检总数', value: inspectionStats.totalInspected, icon: <span style={{ fontSize: 18 }}>📋</span>, bg: '#eff6ff', color: ACCENT },
          { label: '抽检通过率', value: `${inspectionStats.passedRate}%`, icon: <span style={{ fontSize: 18 }}>✅</span>, bg: '#d1fae5', color: SUCCESS },
          { label: '抽检甲级率', value: `${inspectionStats.excellentRate}%`, icon: <span style={{ fontSize: 18 }}>🏆</span>, bg: '#fef3c7', color: '#f59e0b' },
          { label: '缺陷发现率', value: `${inspectionStats.defectRate}%`, icon: <span style={{ fontSize: 18 }}>⚠️</span>, bg: '#fef3c7', color: WARNING },
          { label: '抽检平均分', value: inspectionStats.avgScore.toFixed(1), icon: <span style={{ fontSize: 18 }}>⭐</span>, bg: '#ede9fe', color: '#8b5cf6' },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📋</span>{t('qcdefect.gradeDistribution')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
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
              <Pie data={gradeDistributionData} cx='50%' cy='50%' innerRadius={40} outerRadius={65} paddingAngle={3} dataKey='count' label={({ grade, percent }: { grade: string; percent: number }) => `${grade}级 ${(percent * 100).toFixed(0)}%`}>
                {gradeDistributionData.map(entry => (
                  <Cell key={entry.grade} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}份`} />
            </RechartsPie>
          </ResponsiveContainer>
        </div>

        <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠️</span>{t('qcdefect.defectStats')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
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

      <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📋</span>{t('qcdefect.inspectionList')}<span style={{ fontSize: 12, color: GRAY, fontWeight: 400 }}>{t('qcdefect.nhc2024')}</span>
          </h3>
          <button
            onClick={() => onNewRecord('新增抽检记录')}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${ACCENT}`, background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
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
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc' }}
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
                  <button onClick={() => onViewDetail(`抽检详情 ${record.id}`, record.inspectorComment)} style={{ padding: '3px 8px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠️</span>{t('qcdefect.issueSummary')}</h3>
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
            <span>⚡</span>{t('qcdefect.suggestions')}</h3>
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
  )
}
