import { t } from '../../i18n/appI18n'
import { Camera, Award, AlertTriangle, Star, Image, PieChart } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { qcextApi, type QcImageDto, type QcStatsDto } from '../../services/api/qcextApi'

const PRIMARY = '#1e40af'
const ACCENT = '#3b82f6'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const GRAY = '#64748b'
const LIGHT_BG = '#f8fafc'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'

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

interface ImageQCItem {
  id: string
  patientName: string
  device: string
  score: number
  issues: string[]
  status: string
}

interface IssueDistributionItem {
  name: string
  value: number
  color: string
}

interface QCImagePanelProps {
  data: ImageQCItem[]
  issueDistribution: IssueDistributionItem[]
  onViewDetail: (id: string) => void
}

export default function QCImagePanel({ data, issueDistribution, onViewDetail }: QCImagePanelProps) {
  const [images, setImages] = useState<QcImageDto[]>([]);
  useEffect(() => {
    qcextApi.listQcImages().then(res => { if (res.success) setImages(res.data); }).catch((err) => { console.error('[F04]', err); });
  }, []);
  const imageFiltered = data

  const statCardsImage = [
    { label: '今日采集数', value: data.length, icon: <Camera size={18} color={ACCENT} />, bg: '#eff6ff', color: ACCENT },
    { label: '优秀率', value: `${Math.round(data.filter(i => i.status === '优秀').length / data.length * 100)}%`, icon: <Award size={18} color={SUCCESS} />, bg: '#d1fae5', color: SUCCESS },
    { label: '废片率', value: `${Math.round(data.filter(i => i.status === '差').length / data.length * 100)}%`, icon: <AlertTriangle size={18} color={DANGER} />, bg: '#fee2e2', color: DANGER },
    { label: '平均评分', value: '87.2', icon: <Star size={18} color={'#f59e0b'} />, bg: '#fef3c7', color: '#f59e0b' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f7ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc' }}
              >
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{img.id}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{img.patientName}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#334155' }}>{img.device.split('（')[0]}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: SCORE_COLORS[img.status] }}>{img.score}</span>
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
                  <button onClick={() => onViewDetail(img.id)} style={{ padding: '4px 10px', background: '#eff6ff', color: ACCENT, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                    <Image size={12} />{t('qcimage.viewImage')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <PieChart size={16} color={ACCENT} />{t('qcimage.rejectDistribution')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
          <ResponsiveContainer width='100%' height={220}>
            <RechartsPie>
              <Pie data={issueDistribution} cx='50%' cy='50%' innerRadius={55} outerRadius={90} paddingAngle={3} dataKey='value' label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {issueDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value}例`} />
            </RechartsPie>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {issueDistribution.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>{item.name}</span>
                <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{item.value}例</span>
                <span style={{ fontSize: 12, color: GRAY }}>{Math.round(item.value / issueDistribution.reduce((s, i) => s + i.value, 0) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
