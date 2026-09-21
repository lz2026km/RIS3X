// [W6] 检查前核对 (Time-Out) 通用门禁弹窗
// 用于 WorklistPage / ExamDetailView / ExamDetailPage / 移动端技师站在调用
// POST /worklist/:id/start 之前完成核对 (后端要求 timeoutVerified=true 才放行)。
import { useCallback, useEffect, useState } from 'react'
import { Alert, Checkbox, Modal, Spin, message } from 'antd'
import { worklistApi, type TimeoutChecklistDto, type TimeoutChecklistKey } from '../../services/api/worklistApi'
import { t } from '../../i18n/appI18n'
import { getCurrentUser } from '../../utils/auth'

const ITEM_LABEL: Record<TimeoutChecklistKey, string> = {
  identity: 'w6Workflow.timeout.identity',
  bodyPart: 'w6Workflow.timeout.bodyPart',
  allergy: 'w6Workflow.timeout.allergy',
  pregnancy: 'w6Workflow.timeout.pregnancy',
  isolation: 'w6Workflow.timeout.isolation',
  consent: 'w6Workflow.timeout.consent',
}

export interface TimeoutVerifyModalProps {
  open: boolean
  examId: string | null
  onCancel: () => void
  /** 核对通过后回调 (调用方此时可安全调用 start) */
  onVerified: () => void
}

export default function TimeoutVerifyModal({ open, examId, onCancel, onVerified }: TimeoutVerifyModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<TimeoutChecklistDto | null>(null)
  const [checks, setChecks] = useState<Partial<Record<TimeoutChecklistKey, boolean>>>({})

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await worklistApi.getTimeoutChecklist(id)
      if (res.success && res.data) {
        setData(res.data)
        const next: Partial<Record<TimeoutChecklistKey, boolean>> = {}
        res.data.items.forEach((i) => { next[i.key] = !i.required })
        setChecks(next)
      } else {
        setData(null)
        message.error(res.error?.message ?? t('w6Workflow.timeout.loadFailed'))
      }
    } catch (err) {
      setData(null)
      message.error(err instanceof Error ? err.message : t('w6Workflow.timeout.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && examId) {
      setData(null)
      setChecks({})
      void load(examId)
    }
  }, [open, examId, load])

  const submit = useCallback(async () => {
    if (!data || !examId) return
    const missing = data.items.filter((i) => i.required && checks[i.key] !== true)
    if (missing.length > 0) {
      message.warning(t('w6Workflow.timeout.confirmAll'))
      return
    }
    setSubmitting(true)
    try {
      const res = await worklistApi.verifyTimeout(examId, {
        verifiedBy: getCurrentUser()?.name ?? 'current-user',
        checklist: checks,
      })
      if (!res.success) {
        message.error(res.error?.message ?? t('w6Workflow.timeout.failed'))
        return
      }
      message.success(t('w6Workflow.timeout.success'))
      onVerified()
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('w6Workflow.timeout.failed'))
    } finally {
      setSubmitting(false)
    }
  }, [data, examId, checks, onVerified])

  const itemDetail = (key: TimeoutChecklistKey): string => {
    if (!data) return '--'
    switch (key) {
      case 'identity':
        return `${data.patient.name} · ${data.patient.identitySecondary ?? '--'}`
      case 'bodyPart':
        return data.exam.bodyPart ?? '--'
      case 'allergy':
        return data.patient.allergyHistory ?? t('w6Workflow.timeout.noAllergy')
      case 'pregnancy':
        return t(`w6Workflow.timeout.preg_${data.patient.pregnancyStatus}`)
      case 'isolation':
        return data.patient.isolationFlag ? t('w6Workflow.timeout.isolationYes') : t('w6Workflow.timeout.isolationNo')
      case 'consent':
        return t(`w6Workflow.timeout.consent_${data.consent.status}`)
      default:
        return '--'
    }
  }

  return (
    <Modal
      open={open}
      title={t('w6Workflow.timeout.title')}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={t('w6Workflow.timeout.submit')}
      cancelText={t('w6Workflow.timeout.cancel')}
      okButtonProps={{ disabled: loading || submitting }}
      confirmLoading={submitting}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /> <div style={{ marginTop: 8 }}>{t('w6Workflow.timeout.loading')}</div></div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert type="warning" showIcon message={t('w6Workflow.timeout.subtitle')} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <div><b>{t('w6Workflow.timeout.patient')}</b>: {data.patient.name} · {data.patient.identitySecondary ?? '--'}</div>
            <div><b>{t('w6Workflow.timeout.exam')}</b>: {data.exam.modality} · {data.exam.bodyPart ?? '--'} · {data.exam.accessionNumber ?? '--'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.items.map((item) => (
              <Checkbox
                key={item.key}
                checked={checks[item.key] === true}
                onChange={(e) => setChecks((prev) => ({ ...prev, [item.key]: e.target.checked }))}
              >
                <span style={{ fontWeight: 600 }}>{t(ITEM_LABEL[item.key])}</span>
                <span style={{ color: item.required ? '#dc2626' : 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                  {item.required ? t('w6Workflow.timeout.required') : t('w6Workflow.timeout.optional')}
                </span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{itemDetail(item.key)}</span>
              </Checkbox>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
