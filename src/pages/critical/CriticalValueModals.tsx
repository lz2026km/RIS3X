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
  background: 'var(--bg-card)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
}
const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}
const footerBtn = (primary?: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: primary ? `1px solid ${PRIMARY_COLOR}` : '1px solid var(--border-color)',
  background: primary ? PRIMARY_COLOR : 'var(--bg-card)',
  color: primary ? '#fff' : 'var(--text-muted)',
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={20} style={{ color: '#059669' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>处理危急值</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cv.id} · {cv.patientName}</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>危急值摘要</div>
            <div style={{ background: 'var(--color-error-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--color-error-border)', fontSize: 13, color: 'var(--text-primary)' }}>{cv.findingDetails.substring(0, 100)}...</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-dept" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>处理科室</label>
            <input id="cv-process-dept" type="text" defaultValue={cv.receivingDepartment} placeholder="请输入处理科室" aria-label="处理科室" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-action" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>处理措施</label>
            <textarea id="cv-process-action" placeholder="请输入处理措施..." aria-label="处理措施" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-process-result" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>处理结果</label>
            <textarea id="cv-process-result" placeholder="请输入处理结果..." aria-label="处理结果" rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <div id="cv-notify-method-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>通知方式</div>
            <div role="radiogroup" aria-labelledby="cv-notify-method-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {options.map((opt) => {
                const active = method === opt.value; const Icon = opt.icon
                return (
                  <button key={opt.value} onClick={() => onSetMethod(opt.value)}
                    role="radio" aria-checked={active} aria-label={`通知方式-${opt.label}`}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid ' + (active ? PRIMARY_COLOR : 'var(--border-color)'), background: active ? 'var(--color-info-bg)' : 'var(--bg-card)', color: active ? PRIMARY_COLOR : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon size={14} /> {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-notify-phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>联系电话</label>
            <input id="cv-notify-phone" type="text" value={phone} onChange={(e) => onSetPhone(e.target.value)} placeholder="请输入联系电话" aria-label="联系电话" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="cv-notify-notes" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>通知备注</label>
            <textarea id="cv-notify-notes" value={notes} onChange={(e) => onSetNotes(e.target.value)} placeholder="请输入通知备注" aria-label="通知备注" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <label htmlFor="cv-voicecall-phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>联系电话</label>
            <input id="cv-voicecall-phone" type="text" value={phone} onChange={(e) => onSetPhone(e.target.value)} placeholder="请输入临床联系电话" aria-label="联系电话" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: 'var(--color-warning-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--color-warning-border)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.6 }}>电话通知后，系统将自动记录通知时间及操作人，进入下一步"临床确认"流程。</div>
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <label htmlFor="cv-receipt-doctor" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>临床确认医生 *</label>
            <input id="cv-receipt-doctor" type="text" value={doctor} onChange={(e) => onSetDoctor(e.target.value)} placeholder="请输入确认医生姓名" aria-label="确认医生" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-receipt-comment" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>临床意见/备注</label>
            <textarea id="cv-receipt-comment" value={comment} onChange={(e) => onSetComment(e.target.value)} placeholder="请输入临床处理意见或备注" aria-label="临床意见" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>签名确认</div>
            <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '12px 16px', border: '2px dashed var(--color-success-border)', textAlign: 'center' }}>
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

// -------------- EscalateModal [W2-A] 升级操作: POST /criticals/escalate --------------
export const EscalateModal = ({ cv, to, dept, reason, onSetTo, onSetDept, onSetReason, onConfirm, onCancel }: {
  cv: CriticalValue | null; to: string; dept: string; reason: string
  onSetTo: (v: string) => void; onSetDept: (v: string) => void; onSetReason: (v: string) => void
  onConfirm: () => void; onCancel: () => void
}) => {
  useEffect(() => {
    if (!cv) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cv, onCancel])
  if (!cv) return null
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label="升级危急值" style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: 440 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowUp size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>升级危急值</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{cv.id} · {cv.patientName} · 未及时响应时逐级升级通知</div>
            </div>
          </div>
          <button onClick={onCancel} aria-label="关闭弹窗" style={headerBtnStyle}><X size={16} style={{ color: '#fff' }} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-escalate-to" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>升级对象 *</label>
            <input id="cv-escalate-to" type="text" value={to} onChange={(e) => onSetTo(e.target.value)} placeholder="如: 科主任 / 医务处值班" aria-label="升级对象" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-escalate-dept" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>升级科室</label>
            <input id="cv-escalate-dept" type="text" value={dept} onChange={(e) => onSetDept(e.target.value)} placeholder="如: 医务处" aria-label="升级科室" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="cv-escalate-reason" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>升级原因</label>
            <textarea id="cv-escalate-reason" value={reason} onChange={(e) => onSetReason(e.target.value)} placeholder="如: 电话通知后超时未确认" aria-label="升级原因" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: 'var(--color-error-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--color-error-border)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-error)', lineHeight: 1.6 }}>升级后原接收人超时未响应的危急值将转交升级对象处理,并记录升级时间与操作人。</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={footerBtn()}>取消</button>
            <button onClick={onConfirm} disabled={!to} style={{ ...footerBtn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: to ? 1 : 0.5, cursor: to ? 'pointer' : 'not-allowed' }}><ArrowUp size={14} /> 确认升级</button>
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
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertTriangle size={22} style={{ color: '#d97706' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-warning)' }}>确认操作</div>
          <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 2 }}>{message}</div>
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
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<CriticalValueRule | null>(null)
  const [ruleForm, setRuleForm] = useState({ modality: '', examItem: '', resultName: '', normalMin: '', normalMax: '', criticalMin: '', criticalMax: '', unit: '' })
  const [showEscForm, setShowEscForm] = useState(false)
  const [editingEsc, setEditingEsc] = useState<EscalationRule | null>(null)
  const [escForm, setEscForm] = useState({ level: 1, triggerCondition: '', escalateTo: '', escalateMethod: '系统通知', timeoutMinutes: 30 })
  const [savingSettings, setSavingSettings] = useState(false)
  const [notifyChannels, setNotifyChannels] = useState<Record<string, boolean>>({ SYSTEM: true, SMS: true, PHONE: false, WECHAT: false, EMAIL: false })

  // [Wave2A] 保存设置: 升级规则 → criticalExtApi.createRule/updateRule 真实同步; 通知通道 → criticalExtApi.saveChannels
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    let synced = 0
    const failed: string[] = []
    try {
      for (const rule of escalationRules) {
        try {
          const payload = {
            name: `升级-${rule.escalateTo}`,
            condition: rule.triggerCondition || '超时未确认',
            action: `ESCALATE_${rule.level}`,
            severity: 'CRITICAL' as const,
            enabled: rule.enabled,
          }
          const res = await criticalExtApi.createRule(payload)
          if (res.success) synced += 1
          else failed.push(rule.escalateTo)
        } catch { failed.push(rule.escalateTo) }
      }
      try {
        const channels = (Object.entries(notifyChannels) as Array<[string, boolean]>).map(([channel, enabled]) => ({
          channel: channel as 'SYSTEM' | 'SMS' | 'PHONE' | 'WECHAT' | 'EMAIL',
          label: channel,
          enabled,
        }))
        const chRes = await criticalExtApi.saveChannels(channels)
        if (chRes.success) synced += 1
      } catch { /* 通道保存失败不阻塞 */ }
    } finally {
      setSavingSettings(false)
    }
    const summary = failed.length > 0
      ? `规则设置已保存: ${synced} 项已同步至服务端, ${failed.length} 项失败 (${failed.join(', ')})`
      : `规则设置已保存: ${synced} 项已同步至服务端`
    showToast(summary, failed.length > 0 ? 'error' : 'success')
    if (failed.length === 0) onClose()
  }

  const openRuleForm = (rule: CriticalValueRule | null) => {
    setEditingRule(rule)
    setRuleForm(rule ? {
      modality: rule.modality, examItem: rule.examItem, resultName: rule.resultName,
      normalMin: rule.normalMin, normalMax: rule.normalMax,
      criticalMin: rule.criticalMin, criticalMax: rule.criticalMax, unit: rule.unit,
    } : { modality: '', examItem: '', resultName: '', normalMin: '', normalMax: '', criticalMin: '', criticalMax: '', unit: '' })
    setShowRuleForm(true)
  }

  const openEscForm = (rule: EscalationRule | null) => {
    setEditingEsc(rule)
    setEscForm(rule ? {
      level: rule.level, triggerCondition: rule.triggerCondition, escalateTo: rule.escalateTo,
      escalateMethod: rule.escalateMethod.join('、'), timeoutMinutes: rule.timeoutMinutes,
    } : { level: escalationRules.length + 1, triggerCondition: '', escalateTo: '', escalateMethod: '系统通知', timeoutMinutes: 30 })
    setShowEscForm(true)
  }

  const handleSaveRule = async () => {
    if (!ruleForm.modality.trim() || !ruleForm.examItem.trim() || !ruleForm.resultName.trim()) {
      showToast('请填写设备、检查项目和指标名称', 'error')
      return
    }
    const payload: CriticalValueRule = {
      id: editingRule?.id ?? `R${Date.now()}`,
      modality: ruleForm.modality, examItem: ruleForm.examItem, resultName: ruleForm.resultName,
      normalMin: ruleForm.normalMin, normalMax: ruleForm.normalMax,
      criticalMin: ruleForm.criticalMin, criticalMax: ruleForm.criticalMax,
      unit: ruleForm.unit, notifyTimeout: editingRule?.notifyTimeout ?? 30,
      notifyMethods: editingRule?.notifyMethods ?? ['系统通知'], enabled: true,
    }
    try {
      const res = editingRule
        ? await criticalExtApi.updateRule(editingRule.id, {
            name: `${ruleForm.examItem}-${ruleForm.resultName}`,
            condition: `${ruleForm.criticalMin}~${ruleForm.criticalMax}${ruleForm.unit}`,
            action: 'NOTIFY', severity: 'CRITICAL', enabled: true,
          })
        : await criticalExtApi.createRule({
            name: `${ruleForm.examItem}-${ruleForm.resultName}`,
            condition: `${ruleForm.criticalMin}~${ruleForm.criticalMax}${ruleForm.unit}`,
            action: 'NOTIFY', severity: 'CRITICAL', enabled: true,
          })
      if (res.success) {
        setRules(prev => editingRule ? prev.map(r => r.id === editingRule.id ? payload : r) : [...prev, payload])
        showToast(editingRule ? '规则已更新' : '规则已添加', 'success')
        setShowRuleForm(false)
      } else {
        showToast(res.error?.message ?? '保存失败，已本地更新', 'error')
      }
    } catch {
      setRules(prev => editingRule ? prev.map(r => r.id === editingRule.id ? payload : r) : [...prev, payload])
      showToast(editingRule ? '规则已更新（本地）' : '规则已添加（本地）', 'success')
      setShowRuleForm(false)
    }
  }

  const handleSaveEsc = async () => {
    if (!escForm.escalateTo.trim()) { showToast('请填写升级对象', 'error'); return }
    const payload: EscalationRule = {
      id: editingEsc?.id ?? `ES${String(escalationRules.length + 1).padStart(3, '0')}`,
      level: escForm.level,
      triggerCondition: escForm.triggerCondition || '超时未确认',
      escalateTo: escForm.escalateTo,
      escalateMethod: escForm.escalateMethod.split(/[、,，]/).filter(Boolean),
      timeoutMinutes: escForm.timeoutMinutes,
      enabled: true,
    }
    try {
      const res = await criticalExtApi.createRule({
        name: `升级-${escForm.escalateTo}`,
        condition: escForm.triggerCondition,
        action: `ESCALATE_${escForm.level}`,
        severity: 'CRITICAL', enabled: true,
      })
      if (!res.success) throw new Error(res.error?.message)
      setEscalationRules(prev => editingEsc ? prev.map(r => r.id === editingEsc.id ? payload : r) : [...prev, payload])
      showToast(editingEsc ? '升级规则已更新' : '升级规则已添加', 'success')
      setShowEscForm(false)
    } catch {
      setEscalationRules(prev => editingEsc ? prev.map(r => r.id === editingEsc.id ? payload : r) : [...prev, payload])
      showToast(editingEsc ? '升级规则已更新（本地）' : '升级规则已添加（本地）', 'success')
      setShowEscForm(false)
    }
  }

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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e40af', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Settings size={20} style={{ color: '#fff' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>危急值规则设置</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>配置各类检查结果的危急值范围及通知规则</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭弹窗" style={headerBtnStyle}><X size={18} style={{ color: '#fff' }} /></button>
        </div>

        <div role="tablist" aria-label="规则设置分类" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          {sections.map((sec) => {
            const Icon = sec.icon; const active = activeSection === sec.key
            return (
              <button key={sec.key} role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
                onClick={() => setActiveSection(sec.key as typeof activeSection)}
                style={{ flex: 1, padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: active ? 'var(--bg-card)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderBottom: active ? '2px solid #1e40af' : '2px solid transparent' }}>
                <Icon size={16} style={{ color: active ? PRIMARY_COLOR : 'var(--text-muted)' }} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? PRIMARY_COLOR : 'var(--text-muted)' }}>{sec.label}</span>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeSection === 'range' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => openRuleForm(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid ' + PRIMARY_COLOR, background: PRIMARY_COLOR, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={14} />添加规则
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card)' }}>
                    {['设备', '检查项目', '指标名称', '正常范围', '危急范围', '单位', '状态', '操作'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{rule.modality}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{rule.examItem}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{rule.resultName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#059669' }}>{rule.normalMin}~{rule.normalMax}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{rule.criticalMin}~{rule.criticalMax}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{rule.unit}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: rule.enabled ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: rule.enabled ? '#059669' : '#dc2626' }}>{rule.enabled ? '已启用' : '已禁用'}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => openRuleForm(rule)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: PRIMARY_COLOR, fontSize: 12, cursor: 'pointer' }}>编辑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === 'timeout' && (
            <div style={{ background: 'var(--color-info-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-info-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>超时提醒时间设置</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: '紧急提醒', minutes: 15, color: '#dc2626' },
                  { label: '危急提醒', minutes: 30, color: '#d97706' },
                  { label: '超时提醒', minutes: 60, color: '#2563eb' },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1, padding: 14, background: 'var(--bg-card)', borderRadius: 8, border: `1px solid ${item.color}` }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" defaultValue={item.minutes} aria-label={`${item.label}-分钟数`} style={{ width: 60, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14, fontWeight: 700, color: '#1e40af', textAlign: 'center' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>分钟</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'notify' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>通知方式配置</div>
              {[
                { name: '系统通知', desc: 'RIS系统内即时消息推送', icon: Bell, color: '#1e40af', key: 'SYSTEM' },
                { name: '短信通知', desc: '发送到临床医生手机号码', icon: MessageSquare, color: '#2563eb', key: 'SMS' },
                { name: '电话通知', desc: '自动拨打电话确认接收', icon: Phone, color: '#d97706', key: 'PHONE' },
              ].map((method) => {
                const Icon = method.icon
                const enabled = notifyChannels[method.key] ?? false
                return (
                  <div key={method.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: method.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} style={{ color: method.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{method.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{method.desc}</div>
                    </div>
                    <div
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${method.name}开关`}
                      onClick={() => setNotifyChannels(prev => ({ ...prev, [method.key]: !enabled }))}
                      style={{ width: 48, height: 24, borderRadius: 12, background: enabled ? PRIMARY_COLOR : 'var(--border-color)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 2, right: enabled ? 2 : 26, transition: 'right 0.2s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeSection === 'escalation' && (
            <div>
              <div style={{ background: 'var(--color-warning-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-warning-border)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ArrowUp size={16} style={{ color: '#d97706' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>升级规则说明</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>当危急值在规定时间内未得到确认或处理时，系统将自动按照以下规则逐级升级通知，确保危急值得到及时响应。升级规则按照紧急程度分为4个层级。</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => openEscForm(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #d97706', background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={14} />添加规则
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {escalationRules.map((rule) => {
                  const levelColors = ['#dc2626', '#d97706', '#2563eb', '#64748b']
                  return (
                    <div key={rule.id} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: `1px solid ${rule.enabled ? 'var(--color-success-border)' : 'var(--border-color)'}`, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: levelColors[rule.level - 1] }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: levelColors[rule.level - 1], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{rule.level}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>升级至：{rule.escalateTo}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: rule.enabled ? 'var(--color-success-bg)' : 'var(--border-light)', color: rule.enabled ? '#059669' : 'var(--text-muted)' }}>{rule.enabled ? '已启用' : '已禁用'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>触发条件：<span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{rule.triggerCondition}</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {rule.escalateMethod.map((m) => (
                                <span key={m} style={{ padding: '2px 8px', background: 'var(--border-color)', borderRadius: 4, fontSize: 12, color: 'var(--text-muted)' }}>{m}</span>
                              ))}
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                              超时 <span style={{ fontWeight: 700, color: '#1e40af' }}>{rule.timeoutMinutes}</span> 分钟触发
                            </div>
                          </div>
                        </div>
                        <button onClick={() => openEscForm(rule)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#d97706', fontSize: 12, cursor: 'pointer' }}>编辑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button onClick={() => void handleSaveSettings()} disabled={savingSettings} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #1e40af', background: '#1e40af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingSettings ? 0.6 : 1 }}>{savingSettings ? '保存中...' : '保存设置'}</button>
        </div>
      </div>

      {showRuleForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal, 600)' }} onClick={() => setShowRuleForm(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', marginBottom: 16 }}>{editingRule ? '编辑危急值规则' : '添加危急值规则'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([['modality', '设备'], ['examItem', '检查项目'], ['resultName', '指标名称'], ['unit', '单位']] as const).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>
                  <input value={ruleForm[key]} onChange={e => setRuleForm({ ...ruleForm, [key]: e.target.value })} placeholder={`请输入${label}`} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              ))}
              {([['normalMin', '正常下限'], ['normalMax', '正常上限'], ['criticalMin', '危急下限'], ['criticalMax', '危急上限']] as const).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>
                  <input value={ruleForm[key]} onChange={e => setRuleForm({ ...ruleForm, [key]: e.target.value })} placeholder={label} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowRuleForm(false)} style={footerBtn()}>取消</button>
              <button onClick={() => void handleSaveRule()} style={footerBtn(true)}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showEscForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal, 600)' }} onClick={() => setShowEscForm(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', marginBottom: 16 }}>{editingEsc ? '编辑升级规则' : '添加升级规则'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>升级层级</label>
                <select value={escForm.level} onChange={e => setEscForm({ ...escForm, level: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>第 {n} 级</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>超时触发(分钟)</label>
                <input type="number" value={escForm.timeoutMinutes} onChange={e => setEscForm({ ...escForm, timeoutMinutes: Number(e.target.value) })} min={5} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>升级对象 *</label>
                <input value={escForm.escalateTo} onChange={e => setEscForm({ ...escForm, escalateTo: e.target.value })} placeholder="如 科主任 / 医务处" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>通知方式</label>
                <input value={escForm.escalateMethod} onChange={e => setEscForm({ ...escForm, escalateMethod: e.target.value })} placeholder="用顿号分隔，如 电话、短信" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>触发条件</label>
                <input value={escForm.triggerCondition} onChange={e => setEscForm({ ...escForm, triggerCondition: e.target.value })} placeholder="如 电话通知后超时未确认" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEscForm(false)} style={footerBtn()}>取消</button>
              <button onClick={() => void handleSaveEsc()} style={footerBtn(true)}>保存</button>
            </div>
          </div>
        </div>
      )}
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
  // [W2-A] 升级操作
  showEscalateModal: boolean; escalateCV: CriticalValue | null
  escalateTo: string; escalateDept: string; escalateReason: string
  onSetEscalateTo: (v: string) => void; onSetEscalateDept: (v: string) => void; onSetEscalateReason: (v: string) => void
  onConfirmEscalate: () => void; onCancelEscalate: () => void
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
    {p.showConfirmModal && <ConfirmModal message={p.confirmMessage} onConfirm={p.onConfirm} onCancel={p.onCancelConfirm} />}
    {p.showEscalateModal && p.escalateCV && (
      <EscalateModal cv={p.escalateCV} to={p.escalateTo} dept={p.escalateDept} reason={p.escalateReason}
        onSetTo={p.onSetEscalateTo} onSetDept={p.onSetEscalateDept} onSetReason={p.onSetEscalateReason}
        onConfirm={p.onConfirmEscalate} onCancel={p.onCancelEscalate} />
    )}
    {p.showSettings && <RulesSettingsModal onClose={p.onCloseSettings} showToast={p.showToastFn} />}
    {p.showTransferModal && p.transferCV && (
      <TransferToFollowUpModal cv={p.transferCV} onClose={p.onCloseTransfer} onConfirm={p.onConfirmTransfer} />
    )}
  </>
)
