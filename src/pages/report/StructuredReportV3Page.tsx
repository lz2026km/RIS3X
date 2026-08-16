// [v3.0.6.11-103 Wave 17] 结构化报告编辑器 V3 页面 (四区结构化 + 锁定 + 宏命令 + 子模板)
import { useRef, useState } from 'react'
import { t } from '@i18n/appI18n'
import { message } from 'antd'
import { FileCheck2, Save, CheckCircle2 } from 'lucide-react'
import { PageContainer } from '@components/common/PageContainer'
import { PageHeader } from '@components/common/PageHeader'
import { ActionButton } from '@components/common/ActionButton'
import StructuredReportEditorV3, {
  type StructuredReportEditorHandle,
  type StructuredSectionKey,
} from '@components/report/v4/StructuredReportEditorV3'
import { reportApi } from '@services/api/reportApi'
import { useSearchParams } from 'react-router-dom'

export default function StructuredReportV3Page() {
  const [searchParams] = useSearchParams()
  const [reportId, setReportId] = useState(searchParams.get('reportId') ?? searchParams.get('examId') ?? '')
  const editorRef = useRef<StructuredReportEditorHandle | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [unlockLog, setUnlockLog] = useState<Array<{ section: StructuredSectionKey; at: string }>>([])

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

  const handleUnlockRequest = (section: StructuredSectionKey) => {
    setUnlockLog((prev) => [...prev, { section, at: new Date().toLocaleTimeString() }])
    message.info(`${t('w17.srPage.unlockRequested')}【${section}】`)
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<FileCheck2 size={20} color="#2563eb" />} title={t('w17.srPage.title')} subtitle={t('w17.srPage.subtitle')} />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{t('w17.srPage.reportIdLabel')}</label>
          <input
            value={reportId}
            onChange={(e) => { setReportId(e.target.value); setSaved(false) }}
            placeholder={t('w17.srPage.reportIdPlaceholder')}
            style={{ flex: 1, minWidth: 260, maxWidth: 420, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none' }}
          />
          <ActionButton action="save" loading={saving} disabled={!reportId.trim()} onClick={() => void handleSave()} icon={<Save size={14} />}>
            {t('w17.srPage.saveToReport')}
          </ActionButton>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}>
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{t('w17.srPage.unlockLogTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unlockLog.map((entry, i) => (
                <div key={i} style={{ fontSize: 12, color: '#64748b' }}>
                  {entry.at} · 【{entry.section}】→ {t('w17.srPage.unlockRequested')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
