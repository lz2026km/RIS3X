/**
 * [v3.0.6.11-104 Wave 3D] 检查流程模板面板 (EXAM_WORKFLOW_TEMPLATES)
 * 供登记/预约/技师工作台复用: 登记核对、妊娠询问、摆位/扫描、质控等流程指引。
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { ListChecks, AlertTriangle, Timer } from 'lucide-react'
import { EXAM_WORKFLOW_TEMPLATES } from '../../data/workflowTemplates'
import { t } from '../../i18n/appI18n'

export interface WorkflowTemplatePanelProps {
  /** 过滤模态 (CT/MR/超声/MG/PET-CT 等), 缺省显示全部 */
  modality?: string
  /** 紧凑模式 (仅步骤, 隐藏质控/错误) */
  compact?: boolean
  style?: CSSProperties
}

const panel: CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16,
}

export default function WorkflowTemplatePanel({ modality, compact, style }: WorkflowTemplatePanelProps) {
  const list = useMemo(() => {
    if (!modality) return EXAM_WORKFLOW_TEMPLATES
    const hit = EXAM_WORKFLOW_TEMPLATES.filter((w) => w.modality === modality || w.modality.includes(modality))
    return hit.length > 0 ? hit : EXAM_WORKFLOW_TEMPLATES
  }, [modality])
  const [selected, setSelected] = useState(0)
  const current = list[Math.min(selected, list.length - 1)]
  if (!current) return null

  return (
    <div style={{ ...panel, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <ListChecks size={16} color="#1e40af" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('w3d.workflow.title')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Timer size={12} />{t('w3d.workflow.estimated', { min: current.estimatedTotalMin })}
        </span>
      </div>

      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, marginBottom: 12 }}
      >
        {list.map((w, i) => (
          <option key={w.code} value={i}>{w.code} · {w.name} ({w.modality})</option>
        ))}
      </select>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {current.phases.map((phase) => (
          <div key={phase.name} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{phase.name}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{phase.responsible} · {phase.durationMin}min</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {phase.steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s}</li>)}
            </ul>
            {phase.checkpoints && phase.checkpoints.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {phase.checkpoints.map((c, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(30,64,175,0.1)', color: '#1e40af' }}>{t('w3d.workflow.checkpoints')}: {c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>{t('w3d.workflow.qualityChecks')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{current.qualityChecks.map((q, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q}</li>)}</ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} />{t('w3d.workflow.commonErrors')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{current.commonErrors.map((q, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q}</li>)}</ul>
          </div>
        </div>
      )}
    </div>
  )
}
