import { useState, useEffect } from 'react'

import {
  AlertTriangle, X, Phone, MessageSquare, Bell, Mail, Smartphone, MessageCircle,
  CheckCircle, Timer, ArrowUp, Settings, Plus, Edit3,
} from 'lucide-react'
import type { CriticalValue } from './types'
import { PRIMARY_COLOR, PRIMARY_LIGHT } from './types'
import type { NotificationMethod } from '../../services/api/criticalApi'
import { criticalExtApi } from '../../services/api'
import { TransferToFollowUpModal } from './CriticalValueFollowUp'

// ---------- shared modal parts ----------
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 'var(--z-modal, 500)',
}
const panelStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
}
const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}
const footerBtn = (primary?: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: primary ? `1px solid ${PRIMARY_COLOR}` : '1px solid #e2e8f0',
  background: primary ? PRIMARY_COLOR : '#fff',
  color: primary ? '#fff' : '#64748b',
})

// -------------- Toast --------------
export const Toast = ({ toast }: { toast: { show: boolean; message: string; type: 'success' | 'error' } }) => {
  if (!toast.show) return null
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
      background: toast.type === 'success' ? '#059669' : '#dc2626',
      color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 'var(--z-toast, 800)',
    }}>
      {toast.message}
    </div>
  )
}

// -------------- ProcessModal --------------
export const ProcessModal = ({ cv, onConfirm, onCancel }: {
  cv: CriticalValue | null; onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    if (!cv) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cv, onCancel])
  if (!cv) return null
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="处理危急值" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 500 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={20} style={{ color: '#059669' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>处理危急值</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{cv.id} · {cv.patientName}</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} style={{ color: '#64748b' }} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>危急值摘要</div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, border: '1px solid #fecaca', fontSize: 13, color: '#334155' }}>{cv.findingDetails.substring(0, 100)}...</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-dept" style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>处理科室</label>
            <input id="cv-process-dept" type="text" defaultValue={cv.receivingDepartment} placeholder="请输入处理科室" aria-label="处理科室" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-action" style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>处理措施</label>
            <textarea id="cv-process-action" placeholder="请输入处理措施..." aria-label="处理措施" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-result" style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>处理结果</label>
            <textarea id="cv-process-result" placeholder="请输入处理结果..." aria-label="处理结果" rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={footerBtn()}>取消</button>
            <button onClick={onConfirm} style={footerBtn(true)}>确认处理完成</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------- NotifyModal --------------
export const NotifyModal = ({ cv, phone, notes, method, onSetPhone, onSetNotes, onSetMethod, onConfirm, onCancel }: {
  cv: CriticalValue | null; phone: string; notes: string; method: string
  onSetPhone: (v: string) => void; onSetNotes: (v: string) => void; onSetMethod: (v: string) => void
  onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    if (!cv) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cv, onCancel])
  if (!cv) return null
  const options: { value: NotificationMethod; label: string; icon: any }[] = [
    { value: 'PHONE', label: '电话', icon: Phone }, { value: 'SMS', label: '短信', icon: MessageSquare },
    { value: 'SYSTEM', label: '系统', icon: Bell }, { value: 'EMAIL', label: '邮件', icon: Mail },
    { value: 'WECHAT', label: '微信', icon: Smartphone }, { value: 'DINGTALK', label: '钉钉', icon: MessageCircle },
  ]
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="通知临床" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 420 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Phone size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>通知临床</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{cv.patientName} · {cv.receivingDoctorName || '待通知'}</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={headerBtnStyle}><X size={16} style={{ color: '#fff' }} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div id="cv-notify-method-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>通知方式</div>
            <div role="radiogroup" aria-labelledby="cv-notify-method-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {options.map((opt) => {
                const active = method === opt.value; const Icon = opt.icon
                return (
                  <button key={opt.value} onClick={() => onSetMethod(opt.value)}
                    role="radio" aria-checked={active} aria-label={`通知方式-${opt.label}`}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid ' + (active ? PRIMARY_COLOR : '#e2e8f0'), background: active ? '#eff6ff' : '#fff', color: active ? PRIMARY_COLOR : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon size={14} /> {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-notify-phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>联系电话</label>
            <input id="cv-notify-phone" type="text" value={phone} onChange={(e) => onSetPhone(e.target.value)} placeholder="请输入联系电话" aria-label="联系电话" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="cv-notify-notes" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>通知备注</label>
            <textarea id="cv-notify-notes" value={notes} onChange={(e) => onSetNotes(e.target.value)} placeholder="请输入通知备注" aria-label="通知备注" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={footerBtn()}>取消</button>
            <button onClick={onConfirm} style={{ ...footerBtn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Phone size={14} /> 确认通知</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------- VoiceCallModal --------------
export const VoiceCallModal = ({ cv, phone, onSetPhone, onConfirm, onCancel }: {
  cv: CriticalValue | null; phone: string
  onSetPhone: (v: string) => void; onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    if (!cv) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cv, onCancel])
  if (!cv) return null
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="电话通知" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 420 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Phone size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>电话通知临床</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{cv.patientName} · 电话通知记录</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={headerBtnStyle}><X size={16} style={{ color: '#fff' }} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="cv-voicecall-phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>联系电话</label>
            <input id="cv-voicecall-phone" type="text" value={phone} onChange={(e) => onSetPhone(e.target.value)} placeholder="请输入临床联系电话" aria-label="联系电话" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', border: '1px solid #fed7aa', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#9a3412', lineHeight: 1.6 }}>电话通知后，系统将自动记录通知时间及操作人，进入下一步"临床确认"流程。</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={footerBtn()}>取消</button>
            <button onClick={onConfirm} disabled={!phone} style={{ ...footerBtn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: phone ? 1 : 0.5, cursor: phone ? 'pointer' : 'not-allowed' }}><Phone size={14} /> 确认电话通知</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------- ClinicalReceiptModal --------------
export const ClinicalReceiptModal = ({ cv, doctor, comment, onSetDoctor, onSetComment, onConfirm, onCancel }: {
  cv: CriticalValue | null; doctor: string; comment: string
  onSetDoctor: (v: string) => void; onSetComment: (v: string) => void; onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    if (!cv) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cv, onCancel])
  if (!cv) return null
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="临床回执" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Edit3 size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>临床回执</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{cv.patientName} · 临床确认签字回传</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={headerBtnStyle}><X size={16} style={{ color: '#fff' }} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-receipt-doctor" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>临床确认医生 *</label>
            <input id="cv-receipt-doctor" type="text" value={doctor} onChange={(e) => onSetDoctor(e.target.value)} placeholder="请输入确认医生姓名" aria-label="确认医生" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-receipt-comment" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>临床意见/备注</label>
            <textarea id="cv-receipt-comment" value={comment} onChange={(e) => onSetComment(e.target.value)} placeholder="请输入临床处理意见或备注" aria-label="临床意见" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>签名确认</div>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', border: '2px dashed #86efac', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>✍️</div>
              <div style={{ fontSize: 12, color: '#16a34a' }}>点击此处签名（模拟签名板）</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={footerBtn()}>取消</button>
            <button onClick={onConfirm} disabled={!doctor} style={{ ...footerBtn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: doctor ? 1 : 0.5, cursor: doctor ? 'pointer' : 'not-allowed' }}><Edit3 size={14} /> 确认回执</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------- ConfirmModal --------------
export const ConfirmModal = ({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])
  return (
  <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="确认操作" style={overlayStyle}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 400 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertTriangle size={22} style={{ color: '#d97706' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>确认操作</div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>{message}</div>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={footerBtn()}>取消</button>
        <button onClick={onConfirm} style={footerBtn(true)}>确认</button>
      </div>
    </div>
  </div>
  )
}

// -------------- RulesSettingsModal --------------
interface CriticalValueRule {
  id: string; modality: string; examItem: string; resultName: string
  normalMin: string; normalMax: string; criticalMin: string; criticalMax: string
  unit: string; notifyTimeout: number; notifyMethods: string[]; enabled: boolean
}

interface EscalationRule {
  id: string; level: number; triggerCondition: string; escalateTo: string
  escalateMethod: string[]; timeoutMinutes: number; enabled: boolean
}

export const RulesSettingsModal = ({ onClose, showToast }: {
  onClose: () => void; showToast: (msg: string, type?: 'success' | 'error') => void
}) => {
  const [activeSection, setActiveSection] = useState<'range' | 'timeout' | 'notify' | 'escalation'>('range')
  const [rules, setRules] = useState<CriticalValueRule[]>([])
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await criticalExtApi.listRules()
        const ruleList = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        if (!cancelled && res.success) {
          setRules(ruleList as unknown as CriticalValueRule[])
        }
      } catch { /* API not available */ }
      try {
        const res = await criticalExtApi.listRules()
        const ruleList = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        if (!cancelled && res.success) {
          const mapped = (ruleList as unknown[]).map((r: any, i: number) => ({
            id: r.id || `ES${String(i + 1).padStart(3, '0')}`,
            level: r.level || i + 1,
            triggerCondition: r.triggerCondition || r.trigger || '',
            escalateTo: r.escalateTo || r.role || '',
            escalateMethod: r.escalateMethod || r.methods || ['系统通知'],
            timeoutMinutes: r.timeoutMinutes || r.timeout || 30,
            enabled: r.enabled ?? true,
          }))
          setEscalationRules(mapped)
        }
      } catch { /* API not available */ }
    })()
    return () => { cancelled = true }
  }, [])

  const sections = [
    { key: 'range', label: '危急值范围', icon: AlertTriangle },
    { key: 'timeout', label: '超时提醒', icon: Timer },
    { key: 'notify', label: '通知方式', icon: Bell },
    { key: 'escalation', label: '升级规则', icon: ArrowUp },
  ]

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="危急值规则设置" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 800, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e3a5f', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Settings size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>危急值规则设置</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>配置各类检查结果的危急值范围及通知规则</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭弹窗" style={headerBtnStyle}><X size={18} style={{ color: '#fff' }} /></button>
        </div>

        <div role="tablist" aria-label="规则设置分类" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {sections.map((sec) => {
            const Icon = sec.icon; const active = activeSection === sec.key
            return (
              <button key={sec.key} role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
                onClick={() => setActiveSection(sec.key as typeof activeSection)}
                style={{ flex: 1, padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: active ? '#fff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderBottom: active ? '2px solid #1e3a5f' : '2px solid transparent' }}>
                <Icon size={16} style={{ color: active ? '#1e3a5f' : '#94a3b8' }} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#1e3a5f' : '#94a3b8' }}>{sec.label}</span>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeSection === 'range' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button disabled style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #94a3b8', background: '#94a3b8', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'not-allowed' }}>
                  <Plus size={14} />添加规则
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['设备', '检查项目', '指标名称', '正常范围', '危急范围', '单位', '状态', '操作'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#334155' }}>{rule.modality}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#334155' }}>{rule.examItem}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#334155' }}>{rule.resultName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#059669' }}>{rule.normalMin}~{rule.normalMax}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{rule.criticalMin}~{rule.criticalMax}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{rule.unit}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: rule.enabled ? '#d1fae5' : '#fee2e2', color: rule.enabled ? '#059669' : '#dc2626' }}>{rule.enabled ? '已启用' : '已禁用'}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button disabled style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#94a3b8', fontSize: 12, cursor: 'not-allowed' }}>编辑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === 'timeout' && (
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: 16, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>超时提醒时间设置</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: '紧急提醒', minutes: 15, color: '#dc2626' },
                  { label: '危急提醒', minutes: 30, color: '#d97706' },
                  { label: '超时提醒', minutes: 60, color: '#2563eb' },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1, padding: 14, background: '#fff', borderRadius: 8, border: `1px solid ${item.color}` }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" defaultValue={item.minutes} aria-label={`${item.label}-分钟数`} style={{ width: 60, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, fontWeight: 700, color: '#1e3a5f', textAlign: 'center' }} />
                      <span style={{ fontSize: 12, color: '#64748b' }}>分钟</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'notify' && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>通知方式配置</div>
              {[
                { name: '系统通知', desc: 'RIS系统内即时消息推送', icon: Bell, color: '#1e3a5f' },
                { name: '短信通知', desc: '发送到临床医生手机号码', icon: MessageSquare, color: '#2563eb' },
                { name: '电话通知', desc: '自动拨打电话确认接收', icon: Phone, color: '#d97706' },
              ].map((method) => {
                const Icon = method.icon
                return (
                  <div key={method.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: method.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} style={{ color: method.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>{method.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{method.desc}</div>
                    </div>
                    <div style={{ width: 48, height: 24, borderRadius: 12, background: '#1e3a5f', position: 'relative', cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, right: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeSection === 'escalation' && (
            <div>
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 16, border: '1px solid #fde68a', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ArrowUp size={16} style={{ color: '#d97706' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>升级规则说明</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>当危急值在规定时间内未得到确认或处理时，系统将自动按照以下规则逐级升级通知，确保危急值得到及时响应。升级规则按照紧急程度分为4个层级。</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button disabled style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #94a3b8', background: '#f1f5f9', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'not-allowed' }}>
                  <Plus size={14} />添加规则
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {escalationRules.map((rule) => {
                  const levelColors = ['#dc2626', '#d97706', '#2563eb', '#64748b']
                  return (
                    <div key={rule.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: `1px solid ${rule.enabled ? '#a7f3d0' : '#e2e8f0'}`, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: levelColors[rule.level - 1] }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: levelColors[rule.level - 1], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{rule.level}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>升级至：{rule.escalateTo}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: rule.enabled ? '#d1fae5' : '#f1f5f9', color: rule.enabled ? '#059669' : '#94a3b8' }}>{rule.enabled ? '已启用' : '已禁用'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>触发条件：<span style={{ color: '#334155', fontWeight: 600 }}>{rule.triggerCondition}</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {rule.escalateMethod.map((m) => (
                                <span key={m} style={{ padding: '2px 8px', background: '#e2e8f0', borderRadius: 4, fontSize: 12, color: '#64748b' }}>{m}</span>
                              ))}
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                              超时 <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{rule.timeoutMinutes}</span> 分钟触发
                            </div>
                          </div>
                        </div>
                        <button disabled style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#94a3b8', fontSize: 12, cursor: 'not-allowed' }}>编辑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button onClick={() => { showToast('规则设置已保存'); onClose() }} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #1e3a5f', background: '#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>保存设置</button>
        </div>
      </div>
    </div>
  )
}

// -------------- Combined Modals --------------
export interface CriticalValueModalsProps {
  toast: { show: boolean; message: string; type: 'success' | 'error' }
  showProcessModal: boolean; processCV: CriticalValue | null
  onConfirmProcess: () => void; onCancelProcess: () => void
  showNotifyModal: boolean; notifyCV: CriticalValue | null
  notifyPhone: string; notifyNotes: string; notifyMethod: string
  onSetNotifyPhone: (v: string) => void; onSetNotifyNotes: (v: string) => void
  onSetNotifyMethod: (v: string) => void; onConfirmNotify: () => void; onCancelNotify: () => void
  showVoiceCallModal: boolean; voiceCallCV: CriticalValue | null
  voiceCallPhone: string; onSetVoiceCallPhone: (v: string) => void
  onConfirmVoiceCall: () => void; onCancelVoiceCall: () => void
  showReceiptModal: boolean; receiptCV: CriticalValue | null
  receiptDoctor: string; receiptComment: string
  onSetReceiptDoctor: (v: string) => void; onSetReceiptComment: (v: string) => void
  onConfirmReceipt: () => void; onCancelReceipt: () => void
  showConfirmModal: boolean; confirmMessage: string
  onConfirm: () => void; onCancelConfirm: () => void
  showSettings: boolean; onCloseSettings: () => void; showToastFn: (msg: string, type?: 'success' | 'error') => void
  showTransferModal: boolean; transferCV: CriticalValue | null
  onCloseTransfer: () => void; onConfirmTransfer: (date: string) => void
}

export const CriticalValueModals = (p: CriticalValueModalsProps) => (
  <>
    <Toast toast={p.toast} />
    <ProcessModal cv={p.processCV} onConfirm={p.onConfirmProcess} onCancel={p.onCancelProcess} />
    <NotifyModal cv={p.notifyCV} phone={p.notifyPhone} notes={p.notifyNotes} method={p.notifyMethod}
      onSetPhone={p.onSetNotifyPhone} onSetNotes={p.onSetNotifyNotes} onSetMethod={p.onSetNotifyMethod}
      onConfirm={p.onConfirmNotify} onCancel={p.onCancelNotify} />
    {p.showVoiceCallModal && p.voiceCallCV && (
      <VoiceCallModal cv={p.voiceCallCV} phone={p.voiceCallPhone}
        onSetPhone={p.onSetVoiceCallPhone} onConfirm={p.onConfirmVoiceCall} onCancel={p.onCancelVoiceCall} />
    )}
    {p.showReceiptModal && p.receiptCV && (
      <ClinicalReceiptModal cv={p.receiptCV} doctor={p.receiptDoctor} comment={p.receiptComment}
        onSetDoctor={p.onSetReceiptDoctor} onSetComment={p.onSetReceiptComment}
        onConfirm={p.onConfirmReceipt} onCancel={p.onCancelReceipt} />
    )}
    <ConfirmModal message={p.confirmMessage} onConfirm={p.onConfirm} onCancel={p.onCancelConfirm} />
    {p.showSettings && <RulesSettingsModal onClose={p.onCloseSettings} showToast={p.showToastFn} />}
    {p.showTransferModal && p.transferCV && (
      <TransferToFollowUpModal cv={p.transferCV} onClose={p.onCloseTransfer} onConfirm={p.onConfirmTransfer} />
    )}
  </>
)
