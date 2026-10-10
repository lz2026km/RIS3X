/**
 * [v3.0.6.11-104 Wave 3D] 对比剂注射工作站 - 临床资料接入区块
 * 独立子组件 (避免与 Wave 3B 的过敏试验/留观区块冲突):
 *  - eGFR 肾功评估 (30-59 警告)
 *  - CONTRAST_SCREENING_ITEMS 注射前安全核查清单 (妊娠哺乳/过敏/肾功能/知情同意)
 *  - SURGERY_CHECKLISTS 介入操作核查清单 (术前/术中/术后 + 风险处置 + 耗材)
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { ShieldAlert, ListChecks, Stethoscope } from 'lucide-react'
import { CONTRAST_SCREENING_ITEMS } from '../../data/contrastProtocols'
import { SURGERY_CHECKLISTS } from '../../data/surgeryChecklists'
import { t } from '../../i18n/appI18n'

const panel: CSSProperties = { background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }

export interface ContrastDataSectionsProps {
  /** 当前录入的 eGFR (mL/min)，用于 30-59 警告 */
  egfr?: number
  /** 过滤介入核查清单的模态 (如 DSA/CT/US)，缺省显示全部 */
  modality?: string
}

const TYPE_LABEL: Record<string, string> = {
  询问: 'w3d.screening.type.ask',
  检查: 'w3d.screening.type.check',
  告知: 'w3d.screening.type.tell',
}

/** eGFR 30-59 中度肾功能不全警告 (<30 阻断由 Wave 3B 注射门禁处理) */
export function EgfrWarning({ egfr }: { egfr?: number }) {
  if (egfr === undefined || Number.isNaN(egfr)) return null
  if (egfr >= 30 && egfr < 60) {
    return (
      <div style={{ marginTop: 10, padding: '8px 12px', background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 6, fontSize: 12, color: 'var(--color-warning-400)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
        <ShieldAlert size={14} />
        <span>{t('w3d.egfr.warning', { value: egfr })}</span>
      </div>
    )
  }
  if (egfr >= 60) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-success-500)' }}>{t('w3d.egfr.normal', { value: egfr })}</div>
    )
  }
  return null
}

/** 注射前安全核查清单 (CONTRAST_SCREENING_ITEMS: 妊娠哺乳/过敏/肾功能/知情同意等) */
export function ContrastScreeningChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const done = CONTRAST_SCREENING_ITEMS.filter((i) => checked[i.id]).length
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1, 4px)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <ListChecks size={16} color="#22d3ee" />
          {t('w3d.screening.title')}
        </div>
        <span style={{ fontSize: 12, color: done === CONTRAST_SCREENING_ITEMS.length ? 'var(--color-success-500)' : 'var(--text-muted, #8b949e)' }}>
          {done}/{CONTRAST_SCREENING_ITEMS.length}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#6e7681', marginBottom: 10 }}>{t('w3d.screening.subtitle')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CONTRAST_SCREENING_ITEMS.map((item) => (
          <label key={item.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: checked[item.id] ? '#22c55e12' : 'var(--bg-primary, #0d1117)', border: `1px solid ${checked[item.id] ? '#22c55e40' : 'var(--bg-secondary, #21262d)'}`, borderRadius: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checked[item.id]} onChange={(e) => setChecked((p) => ({ ...p, [item.id]: e.target.checked }))} style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{item.item}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: '#0891b220', color: '#22d3ee' }}>
                  {t(TYPE_LABEL[item.type] ?? 'w3d.screening.type.ask')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginTop: 2 }}>{item.detail}</div>
              <div style={{ fontSize: 12, color: 'var(--color-warning-500)', marginTop: 2 }}>→ {item.action}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/** 介入操作核查清单 (SURGERY_CHECKLISTS: 分阶段核查 + 风险处置 + 耗材) */
export function SurgeryChecklistPanel({ modality }: { modality?: string }) {
  const list = useMemo(() => {
    if (!modality) return SURGERY_CHECKLISTS
    const hit = SURGERY_CHECKLISTS.filter((c) => c.modality.includes(modality))
    return hit.length > 0 ? hit : SURGERY_CHECKLISTS
  }, [modality])
  const [selected, setSelected] = useState(0)
  const current = list[Math.min(selected, list.length - 1)]
  if (!current) return null
  return (
    <div style={panel}>
      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
        <Stethoscope size={16} color="#22d3ee" />
        {t('w3d.surgery.title')}
      </div>
      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginBottom: 'var(--space-3, 12px)' }}
      >
        {list.map((c, i) => (
          <option key={c.procedure} value={i}>{c.procedure} · {c.modality}</option>
        ))}
      </select>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {current.phases.map((phase) => (
          <div key={phase.name} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', marginBottom: 6 }}>{t('w3d.surgery.phase')}: {phase.name}</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {phase.checks.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)' }}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {current.adverseEvents.length > 0 && (
        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>{t('w3d.surgery.adverse')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
            {current.adverseEvents.map((a, i) => (
              <div key={i} style={{ fontSize: 12, background: '#ef444410', border: '1px solid #ef444430', borderRadius: 4, padding: '6px 8px' }}>
                <span style={{ color: '#f87171', fontWeight: 600 }}>{a.event}</span>
                <span style={{ color: 'var(--text-muted, #8b949e)' }}> — {a.management}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {current.supplies.length > 0 && (
        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('w3d.surgery.supplies')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {current.supplies.map((s, i) => (
              <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#0891b218', color: '#22d3ee', border: '1px solid #0891b230' }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 组合区块 (供页面直接渲染) */
export default function ContrastDataSections({ egfr, modality }: ContrastDataSectionsProps) {
  return (
    <>
      <EgfrWarning egfr={egfr} />
      <ContrastScreeningChecklist />
      <SurgeryChecklistPanel modality={modality} />
    </>
  )
}
