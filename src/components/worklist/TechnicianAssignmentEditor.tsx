// [G005 v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 + 交接班 Modal
import { useEffect, useMemo, useState } from 'react'
import { Modal, Select, Input, message } from 'antd'
import { UserCog, ArrowRightLeft } from 'lucide-react'
import { userApi } from '../../services/api/userApi'
import { worklistApi } from '../../services/api/worklistApi'

export interface TechnicianOption {
  id: string
  fullName: string
}

interface Props {
  examId: string
  open: boolean
  mode: 'assign' | 'handover'
  /** 当前主/备技师 (详情页传入; 可为 null/undefined) */
  currentPrimary?: TechnicianOption | null
  currentBackup?: TechnicianOption | null
  onClose: () => void
  onSaved: () => void
}

/** 技师候选: 接口过滤 role=TECHNICIAN, 空时回退确定性 seed (与后端 seed 对齐) */
const FALLBACK_TECHS: TechnicianOption[] = [
  { id: 'tech-seed-1', fullName: '王技师' },
  { id: 'tech-seed-2', fullName: '李技师' },
  { id: 'tech-seed-3', fullName: '张技师' },
]

export default function TechnicianAssignmentEditor({
  examId, open, mode, currentPrimary, currentBackup, onClose, onSaved,
}: Props) {
  const [technicians, setTechnicians] = useState<TechnicianOption[]>(FALLBACK_TECHS)
  const [primaryId, setPrimaryId] = useState<string | undefined>(undefined)
  const [backupId, setBackupId] = useState<string | undefined>(undefined)
  const [fromId, setFromId] = useState<string | undefined>(undefined)
  const [toId, setToId] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // 打开时: 拉取技师列表 + 回填当前主备
  useEffect(() => {
    if (!open) return
    setPrimaryId(currentPrimary?.id)
    setBackupId(currentBackup?.id)
    setFromId(currentPrimary?.id ?? currentBackup?.id)
    setToId(undefined)
    setNote('')
    let cancelled = false
    userApi.list(0, 200)
      .then((res) => {
        if (cancelled || !res.success || !Array.isArray(res.data)) return
        const list = res.data
          .filter((u) => u.role === 'TECHNICIAN' || String(u.fullName ?? '').includes('技师'))
          .map((u) => ({ id: u.id, fullName: u.fullName || u.username }))
        if (list.length > 0) setTechnicians(list)
      })
      .catch(() => { /* 接口不可用保留 seed 回退 */ })
    return () => { cancelled = true }
  }, [open, currentPrimary, currentBackup])

  const options = useMemo(() => technicians.map((t) => ({ value: t.id, label: t.fullName })), [technicians])
  const nameOf = (id?: string) => technicians.find((t) => t.id === id)?.fullName ?? ''

  const handleSave = async () => {
    if (mode === 'assign' && !primaryId && !backupId) {
      message.warning('请至少选择一名技师')
      return
    }
    if (mode === 'handover' && (!fromId || !toId)) {
      message.warning('请选择交接双方')
      return
    }
    if (mode === 'handover' && fromId === toId) {
      message.warning('交接双方不能相同')
      return
    }
    setSaving(true)
    try {
      const res = mode === 'assign'
        ? await worklistApi.assignTechnicians(examId, { primaryId, backupId })
        : await worklistApi.handover(examId, { fromId: fromId!, toId: toId!, note: note.trim() || undefined })
      if (res.success) {
        message.success(mode === 'assign' ? '主备技师已保存' : '交接完成')
        onSaved()
        onClose()
      } else {
        message.error(res.error?.message ?? '保存失败')
      }
    } catch {
      message.error('保存失败')
    }
    setSaving(false)
  }

  return (
    <Modal
      title={mode === 'assign' ? '技师分配 (主备技师)' : '交接班'}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={420}
    >
      {mode === 'assign' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--space-2, 8px)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <UserCog size={12} /> 主技师
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择主技师"
              allowClear
              options={options}
              value={primaryId}
              onChange={setPrimaryId}
              data-testid="tech-assign-primary"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <UserCog size={12} /> 备技师
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择备技师 (可空)"
              allowClear
              options={options}
              value={backupId}
              onChange={setBackupId}
              data-testid="tech-assign-backup"
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 'var(--space-2, 8px)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <ArrowRightLeft size={12} /> 交接人 (当前)
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择交接人"
              options={options}
              value={fromId}
              onChange={setFromId}
              data-testid="tech-handover-from"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <ArrowRightLeft size={12} /> 接收人
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择接收技师"
              options={options}
              value={toId}
              onChange={setToId}
              data-testid="tech-handover-to"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>交接备注</div>
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="例如: 午休交接, 患者体位已固定, 扫描协议已核对"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="tech-handover-note"
            />
          </div>
          {currentPrimary && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              当前主技师: <b>{nameOf(currentPrimary.id) || currentPrimary.fullName}</b>
              {currentBackup && <> · 备技师: <b>{nameOf(currentBackup.id) || currentBackup.fullName}</b></>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
