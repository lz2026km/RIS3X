// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 SnomedPage (/snomed/encode 宿主) 作为 Tab; 旧路由 /snomed/auto-coding redirect 兼容。文件保留供回滚参考。
// [v3.0.6.11-103 Wave 17] SNOMED/ICD 自动编码 (PACS 对标): 报告文本 → 诊断词提取
// → SNOMED CT + ICD-10 建议 → 置信度 + 人工确认 → 一键写入报告结构化字段
import { useMemo, useState } from 'react'
import { t } from '@i18n/appI18n'
import { message } from 'antd'
import { Code, Sparkles, CheckCircle2, FileText, ClipboardCopy, ShieldCheck, Send } from 'lucide-react'
import { PageContainer } from '@components/common/PageContainer'
import { PageHeader } from '@components/common/PageHeader'
import { ActionButton } from '@components/common/ActionButton'
import { snomedApi, type AutoEncodeResult, type AutoEncodedTerm } from '@services/api/snomedApi'
import { reportApi } from '@services/api/reportApi'

const SECTION_COLORS: Record<string, string> = {
  findings: '#0ea5e9', impression: '#8b5cf6', conclusion: '#f43f5e', unknown: '#94a3b8',
}

const SAMPLE_REPORT = `【所见】右肺上叶见一磨玻璃结节影,大小约1.2cm×0.9cm,边缘见毛刺征,邻近胸膜牵拉。左肺下叶散在条索影。
【印象】右肺上叶磨玻璃结节,考虑早期肺癌可能,建议定期随访。
【结论】右肺上叶磨玻璃结节,建议3个月后复查CT。`

export default function AutoCodingPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<AutoEncodeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [reportId, setReportId] = useState('')
  const [written, setWritten] = useState(false)

  const handleEncode = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await snomedApi.autoEncode(text)
      if (res.success) {
        setResult(res.data)
        setConfirmed(new Set(res.data.terms.filter((term) => term.confidence >= 0.9).map((term) => term.keyword)))
        setWritten(false)
      } else {
        message.error(res.error?.message ?? t('w17.coding.encodeFailed'))
      }
    } catch {
      message.error(t('w17.coding.encodeFailed'))
    } finally {
      setLoading(false)
    }
  }

  const toggleConfirm = (keyword: string) => {
    setConfirmed((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  const confirmedTerms = useMemo(() => (result?.terms ?? []).filter((term) => confirmed.has(term.keyword)), [result, confirmed])

  const structuredPayload = useMemo(() => {
    const terms = confirmedTerms
    return {
      reportId: reportId.trim(),
      snomed: terms.flatMap((term) => term.snomed.map((c) => ({ code: c.conceptId, pt: c.pt, keyword: term.keyword, confidence: c.confidence }))),
      icd10: terms.flatMap((term) => term.icd10.map((c) => ({ code: c.code, title: c.title, keyword: term.keyword, confidence: c.confidence }))),
      extractedAt: new Date().toISOString(),
      engine: 'deterministic-dict',
    }
  }, [confirmedTerms, reportId])

  const handleWriteToReport = async () => {
    if (!reportId.trim()) {
      message.info(t('w17.coding.needReportId'))
      return
    }
    if (confirmedTerms.length === 0) {
      message.info(t('w17.coding.noConfirmed'))
      return
    }
    const icdCodes = structuredPayload.icd10.map((c) => c.code).join(',')
    const diagnosis = confirmedTerms.map((term) => term.keyword).join('；')
    try {
      const res = await reportApi.update(reportId.trim(), {
        icd10: icdCodes,
        diagnosis,
      })
      if (res.success) {
        setWritten(true)
        message.success(t('w17.coding.written'))
      } else {
        message.error(res.error?.message ?? t('w17.coding.writeFailed'))
      }
    } catch {
      message.error(t('w17.coding.writeFailed'))
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(structuredPayload, null, 2))
      message.success(t('w17.coding.copied'))
    } catch {
      message.info(JSON.stringify(structuredPayload, null, 2))
    }
  }

  const avgConfidence = useMemo(() => {
    const terms = result?.terms ?? []
    return terms.length > 0 ? Math.round((terms.reduce((s, term) => s + term.confidence, 0) / terms.length) * 100) : 0
  }, [result])

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Code size={20} color="var(--color-primary-500)" />} title={t('w17.coding.title')} subtitle={t('w17.coding.subtitle')} />
      <div style={{ padding: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
          {[
            { label: t('w17.coding.statsTerms'), value: result?.total ?? 0, color: 'var(--color-primary-500)' },
            { label: t('w17.coding.statsConfirmed'), value: confirmedTerms.length, color: '#10b981' },
            { label: t('w17.coding.statsAvgConfidence'), value: result ? `${avgConfidence}%` : '-', color: 'var(--color-warning-500)' },
            { label: t('w17.coding.statsSnomed'), value: structuredPayload.snomed.length, color: '#8b5cf6' },
            { label: t('w17.coding.statsIcd10'), value: structuredPayload.icd10.length, color: '#f43f5e' },
          ].map((card) => (
            <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-5, 20px)', flexWrap: 'wrap' }}>
          {/* 输入 */}
          <div style={{ flex: 1, minWidth: 320, background: 'var(--bg-card)', borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="var(--color-primary-500)" />{t('w17.coding.input')}
            </h3>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); setWritten(false) }}
              rows={10}
              style={{ width: '100%', padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.7, resize: 'vertical' }}
              placeholder={t('w17.coding.inputPlaceholder')}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center', flexWrap: 'wrap' }}>
              <ActionButton action="submit" loading={loading} disabled={!text.trim()} onClick={() => void handleEncode()} icon={<Sparkles size={14} />}>
                {loading ? t('w17.coding.encoding') : t('w17.coding.encode')}
              </ActionButton>
              <button
                onClick={() => setText(SAMPLE_REPORT)}
                style={{ padding: '7px 14px', background: 'var(--bg-card)', color: 'var(--text-secondary, #475569)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              >
                {t('w17.coding.sample')}
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{t('w17.coding.deterministic')}</span>
            </div>

            {result && result.terms.length > 0 && (
              <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>{t('w17.coding.termList')} ({result.terms.length})</span>
                  <button onClick={() => setConfirmed(new Set(result.terms.map((term) => term.keyword)))} style={{ fontSize: 11, color: 'var(--color-primary-700)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                    {t('w17.coding.confirmAll')}
                  </button>
                  <button onClick={() => setConfirmed(new Set())} style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', background: '#f1f5f9', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                    {t('w17.coding.clearAll')}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)', maxHeight: 420, overflowY: 'auto' }}>
                  {result.terms.map((term: AutoEncodedTerm, i: number) => {
                    const isConfirmed = confirmed.has(term.keyword)
                    return (
                      <div key={`${term.keyword}-${i}`} style={{ border: isConfirmed ? '1.5px solid #10b981' : '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: isConfirmed ? '#f0fdf4' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => toggleConfirm(term.keyword)}
                            style={{ border: 'none', background: isConfirmed ? '#10b981' : '#e2e8f0', color: isConfirmed ? '#fff' : '#64748b', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {isConfirmed && <CheckCircle2 size={14} />}
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{term.keyword}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: SECTION_COLORS[term.section] ?? '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border-color, #e2e8f0)' }}>
                            {t(`w17.coding.section.${term.section}`)}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: term.confidence >= 0.9 ? '#059669' : 'var(--color-warning-600)', background: term.confidence >= 0.9 ? '#d1fae5' : '#fef3c7', padding: '2px 8px', borderRadius: 10 }}>
                            {t('w17.coding.confidence')}: {(term.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap', fontSize: 12 }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6', marginBottom: 3 }}>SNOMED CT</div>
                            {term.snomed.length > 0 ? term.snomed.map((c) => (
                              <div key={c.conceptId} style={{ color: 'var(--text-secondary, #475569)', marginBottom: 2 }}>
                                <code style={{ background: '#ede9fe', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>{c.conceptId}</code> {c.pt}
                              </div>
                            )) : <span style={{ color: 'var(--text-muted, #94a3b8)' }}>—</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#f43f5e', marginBottom: 3 }}>ICD-10</div>
                            {term.icd10.length > 0 ? term.icd10.map((c) => (
                              <div key={c.code} style={{ color: 'var(--text-secondary, #475569)', marginBottom: 2 }}>
                                <code style={{ background: '#ffe4e6', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>{c.code}</code> {c.title}
                              </div>
                            )) : <span style={{ color: 'var(--text-muted, #94a3b8)' }}>—</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {result && result.terms.length === 0 && (
              <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-4, 16px)', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: 12, background: '#f8fafc', borderRadius: 8 }}>
                {t('w17.coding.noTerms')}
              </div>
            )}
          </div>

          {/* 结构化写入 */}
          <div style={{ flex: 1, minWidth: 320, background: 'var(--bg-card)', borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#10b981" />{t('w17.coding.writeTitle')}
            </h3>
            <label style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('w17.coding.reportId')}</label>
            <input
              value={reportId}
              onChange={(e) => { setReportId(e.target.value); setWritten(false) }}
              placeholder={t('w17.coding.reportIdPlaceholder')}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 6, fontSize: 12, marginBottom: 10,}}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 6 }}>
              {t('w17.coding.confirmedCount')}: <strong>{confirmedTerms.length}</strong>
            </div>
            <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 14, fontSize: 11, lineHeight: 1.7, minHeight: 240, maxHeight: 380, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(structuredPayload, null, 2)}
            </pre>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
              <ActionButton action="save" disabled={confirmedTerms.length === 0} onClick={() => void handleWriteToReport()} icon={<Send size={14} />}>
                {t('w17.coding.writeToReport')}
              </ActionButton>
              <ActionButton action="export" size="compact" onClick={() => void handleCopy()} icon={<ClipboardCopy size={13} />}>
                {t('w17.coding.copy')}
              </ActionButton>
              {written && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: '#059669', fontWeight: 600 }}>
                  <CheckCircle2 size={14} />{t('w17.coding.writtenFlag')}
                </span>
              )}
            </div>
            <div style={{ marginTop: 14, padding: 10, background: '#fffbeb', borderRadius: 6, fontSize: 11, color: '#92400e', lineHeight: 1.7, border: '1px solid #fde68a' }}>
              {t('w17.coding.note')}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
