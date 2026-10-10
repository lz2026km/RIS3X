// [v3.0.6.11-103 Wave 17] 结构化报告编辑器 V3 页面 (四区结构化 + 锁定 + 宏命令 + 子模板)
import { useRef, useState } from 'react'
import { t } from '@i18n/appI18n'
import { Alert, Button, Modal, message } from 'antd'
import { FileCheck2, Save, CheckCircle2, ShieldCheck } from 'lucide-react'
import { PageContainer } from '@components/common/PageContainer'
import { PageHeader } from '@components/common/PageHeader'
import { ActionButton } from '@components/common/ActionButton'
import StructuredReportEditorV3, {
  type StructuredReportEditorHandle,
  type StructuredSectionKey,
} from '@components/report/v4/StructuredReportEditorV3'
import { reportApi, type ReportFieldValidationResult } from '@services/api/reportApi'
import { useSearchParams } from 'react-router-dom'

export default function StructuredReportV3Page() {
  const [searchParams] = useSearchParams()
  const [reportId, setReportId] = useState(searchParams.get('reportId') ?? searchParams.get('examId') ?? '')
  const editorRef = useRef<StructuredReportEditorHandle | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [unlockLog, setUnlockLog] = useState<Array<{ section: StructuredSectionKey; at: string }>>([])
  // [G005 W4A] 预签结构化字段校验
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ReportFieldValidationResult | null>(null)
  const [validateOpen, setValidateOpen] = useState(false)

  const handleSave = async () => {
    const doc = editorRef.current?.getDoc()
    if (!doc) return
    if (!reportId.trim()) {
      message.info(t('w17.srPage.needReportId'))
      return
    }
    setSaving(true)
    try {
      const res = await reportApi.update(reportId.trim(), {
        findings: doc.sections.findings,
        impression: doc.sections.impression,
        recommendations: doc.sections.recommendation,
        conclusion: doc.sections.conclusion,
        htmlContent: doc.html,
      })
      if (res.success) {
        setSaved(true)
        message.success(t('w17.srPage.saved'))
      } else {
        message.error(res.error?.message ?? t('w17.srPage.saveFailed'))
      }
    } catch {
      message.error(t('w17.srPage.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // [G005 W4A] 预签校验: POST /reports/:id/validate-fields
  const handleValidate = async () => {
    if (!reportId.trim()) {
      message.info(t('w4a.validate.needReportId'))
      return
    }
    setValidating(true)
    try {
      const doc = editorRef.current?.getDoc()
      const values = doc
        ? {
            findings: doc.sections.findings,
            impression: doc.sections.impression,
            recommendations: doc.sections.recommendation,
            conclusion: doc.sections.conclusion,
          }
        : undefined
      const res = await reportApi.validateFields(reportId.trim(), values)
      if (res.success && res.data) {
        setValidation(res.data)
        setValidateOpen(true)
      } else {
        message.error(res.error?.message ?? t('w4a.validate.failed'))
      }
    } catch {
      message.error(t('w4a.validate.failed'))
    } finally {
      setValidating(false)
    }
  }

  const handleUnlockRequest = (section: StructuredSectionKey) => {
    setUnlockLog((prev) => [...prev, { section, at: new Date().toLocaleTimeString() }])
    message.info(`${t('w17.srPage.unlockRequested')}【${section}】`)
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<FileCheck2 size={20} color="var(--color-primary-600)" />} title={t('w17.srPage.title')} subtitle={t('w17.srPage.subtitle')} />
      <div style={{ padding: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)' }}>{t('w17.srPage.reportIdLabel')}</label>
          <input
            value={reportId}
            onChange={(e) => { setReportId(e.target.value); setSaved(false) }}
            placeholder={t('w17.srPage.reportIdPlaceholder')}
            style={{ flex: 1, minWidth: 260, maxWidth: 420, padding: '8px 12px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 6, fontSize: 12,}}
          />
          <Button
            loading={validating}
            disabled={!reportId.trim()}
            onClick={() => void handleValidate()}
            icon={<ShieldCheck size={14} />}
          >
            {t('w4a.validate.button')}
          </Button>
          <ActionButton action="save" loading={saving} disabled={!reportId.trim()} onClick={() => void handleSave()} icon={<Save size={14} />}>
            {t('w17.srPage.saveToReport')}
          </ActionButton>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: '#059669', fontWeight: 600 }}>
              <CheckCircle2 size={14} />{t('w17.srPage.savedFlag')}
            </span>
          )}
        </div>

        <StructuredReportEditorV3
          ref={editorRef}
          reportId={reportId.trim() || 'draft'}
          onSave={() => {
            setSaved(false)
            void handleSave()
          }}
          onUnlockRequest={handleUnlockRequest}
        />

        {unlockLog.length > 0 && (
          <div style={{ marginTop: 14, background: 'var(--bg-card)', borderRadius: 10, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)', marginBottom: 'var(--space-2, 8px)' }}>{t('w17.srPage.unlockLogTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
              {unlockLog.map((entry, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                  {entry.at} · 【{entry.section}】→ {t('w17.srPage.unlockRequested')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* [G005 W4A] 预签字段校验结果 */}
      <Modal
        title={t('w4a.validate.title')}
        open={validateOpen}
        onCancel={() => setValidateOpen(false)}
        footer={<Button onClick={() => setValidateOpen(false)}>{t('w4a.peer.close')}</Button>}
        width={620}
      >
        {validation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            <Alert
              type={validation.valid ? 'success' : 'error'}
              showIcon
              message={validation.valid ? t('w4a.validate.valid') : t('w4a.validate.invalid')}
            />
            {validation.errors.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>{t('w4a.validate.errors')} ({validation.errors.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
                  {validation.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#7f1d1d' }}>• {e.label}: {e.message}</div>
                  ))}
                </div>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b45309', marginBottom: 6 }}>{t('w4a.validate.warnings')} ({validation.warnings.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
                  {validation.warnings.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#92400e' }}>• {e.label}: {e.message}</div>
                  ))}
                </div>
              </div>
            )}
            {validation.valid && validation.warnings.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('w4a.validate.noIssues')}</div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
