import { t } from '../../i18n/appI18n'
import { dicomSrApi, type DicomSrTemplate, type DicomSrDocument } from '../../services/api/dicomApi'
import { encapsulatedPdfApi, type EncapsulatedPdf } from '../../services/api/dicomApi'
import { srDocumentApi, type SrDocument, type MeasurementTemplate, type MeasurementTemplateCategory } from '../../services/api/srReportApi'
import {
  Card,
  Input,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Descriptions,
  Spin,
  Empty,
  Segmented,
  Badge,
  Select,
  Modal,
  Divider,
} from "antd";
import { FileText, Play, Eye, Copy, Download, FilePlus2, Database, GitBranch, BarChart3, RefreshCcw, Link2, FolderTree, Library, Search } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'

const { TextArea } = Input
const { Text } = Typography

export const DicomSrPage: React.FC = () => {
  const [templateId, setTemplateId] = useState<string>('tid1500')
  const [reportId, setReportId] = useState<string>('')
  const [findings, setFindings] = useState<string>('')
  const [impression, setImpression] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [srDoc, setSrDoc] = useState<DicomSrDocument | null>(null)
  const [templates, setTemplates] = useState<DicomSrTemplate[]>([])

  // [G005 Wave4B] G-01 Encapsulated PDF 封装
  const [pdfReportId, setPdfReportId] = useState<string>('')
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [pdfBase64, setPdfBase64] = useState<string>('')
  const [encapsulating, setEncapsulating] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<EncapsulatedPdf | null>(null)

  // [v3.0.6.11-99 Wave10B] 本会话 SR 生成历史
  const [genHistory, setGenHistory] = useState<Array<{ id: string; reportId: string; tid: string; status: string; generatedAt: string }>>([])
  const [pdfHistory, setPdfHistory] = useState<Array<{ id: string; reportId: string; size: number; generatedAt: string }>>([])

  // [v3.0.6.11-103 Wave 2B] 测量模板库 (GET /dicom-sr/measurement-templates*)
  const [mtCategories, setMtCategories] = useState<MeasurementTemplateCategory[]>([])
  const [mtTemplates, setMtTemplates] = useState<MeasurementTemplate[]>([])
  const [mtFilter, setMtFilter] = useState<{ modality?: string; category?: string }>({})
  const [mtLoading, setMtLoading] = useState(false)
  const [mtDetail, setMtDetail] = useState<MeasurementTemplate | null>(null)
  const [mtDetailOpen, setMtDetailOpen] = useState(false)
  const [mtDetailLoading, setMtDetailLoading] = useState(false)

  // [v3.0.6.11-103 Wave 2B] 已封装 PDF 查询 (GET /dicom-sr/encapsulated/:id)
  const [pdfLookupId, setPdfLookupId] = useState('')
  const [pdfLookupLoading, setPdfLookupLoading] = useState(false)
  const [pdfLookupResult, setPdfLookupResult] = useState<EncapsulatedPdf | null>(null)
  const [pdfLookupState, setPdfLookupState] = useState<'idle' | 'ok' | 'none' | 'err'>('idle')

  // 测量模板库: 分类统计 + 列表 (可按模态/分类过滤)
  const loadMtCategories = useCallback(async () => {
    try {
      const res = await srDocumentApi.listMeasurementTemplateCategories()
      if (res.success && Array.isArray(res.data)) setMtCategories(res.data)
    } catch {
      /* 后端不可达: 保持空态 */
    }
  }, [])

  const loadMtTemplates = useCallback(async () => {
    setMtLoading(true)
    try {
      const res = await srDocumentApi.listMeasurementTemplates(mtFilter.modality || mtFilter.category ? mtFilter : undefined)
      if (res.success && Array.isArray(res.data)) setMtTemplates(res.data)
    } catch {
      setMtTemplates([])
    } finally {
      setMtLoading(false)
    }
  }, [mtFilter])

  useEffect(() => { void loadMtCategories() }, [loadMtCategories])
  useEffect(() => { void loadMtTemplates() }, [loadMtTemplates])

  const openMtDetail = async (id: string) => {
    setMtDetailOpen(true)
    setMtDetail(null)
    setMtDetailLoading(true)
    try {
      const res = await srDocumentApi.getMeasurementTemplate(id)
      if (res.success && res.data) setMtDetail(res.data)
    } catch {
      /* 保持空态 */
    } finally {
      setMtDetailLoading(false)
    }
  }

  const handlePdfLookup = async () => {
    const id = pdfLookupId.trim()
    if (!id) {
      message.warning(t('dicomSr.enterReportId') || '请输入报告ID')
      return
    }
    setPdfLookupLoading(true)
    setPdfLookupState('idle')
    setPdfLookupResult(null)
    try {
      const res = await encapsulatedPdfApi.findById(id)
      if (res.success && res.data) {
        setPdfLookupResult(res.data)
        setPdfLookupState('ok')
      } else {
        setPdfLookupState('none')
      }
    } catch {
      setPdfLookupState('err')
    } finally {
      setPdfLookupLoading(false)
    }
  }

  useEffect(() => {
    dicomSrApi.getTemplates().then(res => {
      if (res.success && res.data) {
        setTemplates(res.data)
      }
    })
  }, [])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深化: SR 统计 / 模板结构树预览 / 报告关联
  // srDocumentApi.listDocuments + getDocumentByReport (真实 API, 失败回退演示)
  // ============================================================
  const [srDocs, setSrDocs] = useState<SrDocument[]>([])
  const [statsSource, setStatsSource] = useState<'real' | 'demo'>('demo')
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  // 报告关联查询
  const [linkReportId, setLinkReportId] = useState('')
  const [linkedDoc, setLinkedDoc] = useState<SrDocument | null>(null)
  const [linking, setLinking] = useState(false)
  const [linkResult, setLinkResult] = useState<'ok' | 'none' | 'err' | null>(null)

  // TID 模板结构树 (DICOM SR 标准 TID 1500 / TID 2000)
  const TID_TREE: Record<string, Array<{ code: string; label: string; children?: Array<{ code: string; label: string }> }>> = {
    tid1500: [
      { code: 'TID 1500', label: t('dicomSrPage.tid1500Tree'), children: [
        { code: '121111', label: t('dicomSrPage.patientCharacteristics') },
        { code: '111028', label: t('dicomSrPage.examProtocol') },
        { code: '111029', label: t('dicomSrPage.imageMeasurementGroup') },
        { code: '121139', label: t('dicomSrPage.measurementContext') },
        { code: '121038', label: t('dicomSrPage.conclusion') },
      ] },
      { code: 'TID 1410', label: t('dicomSrPage.tid1410Tree'), children: [
        { code: '121206', label: t('dicomSrPage.measurementGroupLabel') },
        { code: '121207', label: t('dicomSrPage.target') },
        { code: '121208', label: t('dicomSrPage.imageRegion') },
      ] },
      { code: 'TID 1501', label: t('dicomSrPage.tid1501Tree'), children: [
        { code: '121206', label: t('dicomSrPage.measurementValue') },
        { code: '121207', label: t('dicomSrPage.measurementMethod') },
        { code: '121208', label: t('dicomSrPage.measurementDirection') },
      ] },
    ],
    tid2000: [
      { code: 'TID 2000', label: t('dicomSrPage.tid2000Tree'), children: [
        { code: '111031', label: t('dicomSrPage.patientCharacteristics') },
        { code: '121119', label: t('dicomSrPage.cadImageLibrary') },
        { code: '121120', label: t('dicomSrPage.cadResults') },
      ] },
      { code: 'TID 2001', label: t('dicomSrPage.tid2001Tree'), children: [
        { code: '121134', label: t('dicomSrPage.referenceImage') },
        { code: '121136', label: t('dicomSrPage.comparisonImage') },
      ] },
      { code: 'TID 2002', label: t('dicomSrPage.tid2002Tree'), children: [
        { code: '121116', label: t('dicomSrPage.findingsLabel') },
        { code: '121124', label: t('dicomSrPage.imageLocation') },
        { code: '121125', label: t('dicomSrPage.descriptionLabel') },
      ] },
    ],
  }

  const loadSrStats = () => {
    setStatsLoading(true)
    setStatsError('')
    srDocumentApi.listDocuments().then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSrDocs(res.data)
        setStatsSource('real')
      } else {
        setStatsSource('demo')
        setStatsError(t('dicomSrPage.statsError'))
      }
    }).catch(() => {
      setStatsSource('demo')
      setStatsError(t('dicomSrPage.statsError'))
    }).finally(() => setStatsLoading(false))
  }

  useEffect(() => { loadSrStats() }, [])

  // 统计: 按模板类型 / 模态 / 状态
  interface SrStatsShape {
    total: number
    byTid: Array<[string, number]>
    byModality: Array<[string, number]>
    byStatus: Array<[string, number]>
    draft: number
    finalized: number
    pushed: number
  }
  const srStats: SrStatsShape = React.useMemo(() => {
    if (srDocs.length > 0) {
      const byTid: Record<string, number> = {}
      const byModality: Record<string, number> = {}
      const byStatus: Record<string, number> = {}
      srDocs.forEach(d => {
        const tid = String(d.tid ?? d.templateId ?? '未知')
        byTid[tid] = (byTid[tid] || 0) + 1
        const mod = String(d.modality ?? '未知')
        byModality[mod] = (byModality[mod] || 0) + 1
        const st = String(d.status ?? 'draft')
        byStatus[st] = (byStatus[st] || 0) + 1
      })
      return {
        total: srDocs.length,
        byTid: Object.entries(byTid).sort((a, b) => b[1] - a[1]),
        byModality: Object.entries(byModality).sort((a, b) => b[1] - a[1]),
        byStatus: Object.entries(byStatus).sort((a, b) => b[1] - a[1]),
        draft: byStatus['draft'] ?? 0,
        finalized: (byStatus['finalized'] ?? 0) + (byStatus['pushed'] ?? 0),
        pushed: byStatus['pushed'] ?? 0,
      }
    }
    // 演示回退统计
    return {
      total: 6,
      byTid: [['tid1500', 4], ['tid2000', 2]] as Array<[string, number]>,
      byModality: [['CT', 3], ['MR', 2], ['DR', 1]],
      byStatus: [['draft', 2], ['finalized', 3], ['pushed', 1]],
      draft: 2,
      finalized: 3,
      pushed: 1,
    }
  }, [srDocs])

  // 报告 → SR 关联查询 (GET /dicom-sr/by-report/:reportId)
  const handleLinkLookup = async () => {
    if (!linkReportId.trim()) {
      message.warning(t('dicomSrPage.enterReportId'))
      return
    }
    setLinking(true)
    setLinkResult(null)
    setLinkedDoc(null)
    try {
      const res = await srDocumentApi.getDocumentByReport(linkReportId.trim())
      if (res.success && res.data) {
        setLinkedDoc(res.data)
        setLinkResult('ok')
      } else {
        setLinkResult('none')
      }
    } catch {
      setLinkResult('err')
    } finally {
      setLinking(false)
    }
  }

  const handleGenerate = async () => {
    if (!reportId.trim()) {
      message.warning(t('dicomSr.enterReportId') || '请输入报告ID')
      return
    }
    setGenerating(true)
    setSrDoc(null)
    const res = await dicomSrApi.generate({
      reportId: reportId.trim(),
      templateId: templateId as 'tid1500' | 'tid2000',
      findings: findings || undefined,
      impression: impression || undefined,
    })
    setGenerating(false)
    if (res.success) {
      setSrDoc(res.data)
      setGenHistory(h => [{
        id: String(res.data?.id ?? Date.now()),
        reportId: res.data?.reportId ?? reportId.trim(),
        tid: res.data?.tid ?? templateId,
        status: res.data?.status ?? 'draft',
        generatedAt: res.data?.generatedAt ?? new Date().toISOString(),
      }, ...h].slice(0, 10))
      message.success(t('dicomSr.generateSuccess') || 'SR 生成成功')
    } else {
      message.error(res.error?.message || t('dicomSrPage.generateFail'))
    }
  }

  const copyContent = () => {
    if (!srDoc) return
    navigator.clipboard.writeText(srDoc.content)
    message.success(t('dicomSr.copied') || '已复制')
  }

  // [G005 W4B] 从服务器下载生成的 SR (GET /dicom-sr/:id/download, application/dicom)
  const [serverDownloading, setServerDownloading] = useState(false)
  const downloadSrFromServer = async () => {
    if (!srDoc) return
    setServerDownloading(true)
    try {
      const dl = await srDocumentApi.downloadDocument(srDoc.id)
      if (!dl || !dl.blob) {
        message.error(t('w4b.sr.downloadFailed'))
        return
      }
      const { blob, filename } = dl
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `${srDoc.id}.dcm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success(t('w4b.sr.downloaded'))
    } catch {
      message.error(t('w4b.sr.downloadFailed'))
    } finally {
      setServerDownloading(false)
    }
  }

  const downloadSr = () => {
    if (!srDoc) return
    const blob = new Blob([srDoc.content], { type: 'application/dicom+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${srDoc.id}.sr`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success(t('dicomSr.downloaded') || 'SR 文件已下载')
  }

  // [G005 Wave4B] G-01 DICOM PDF 封装
  const handleEncapsulate = async () => {
    if (!pdfReportId.trim()) {
      message.warning(t('dicomSrPage.enterReportOrStudyId'))
      return
    }
    setEncapsulating(true)
    setPdfDoc(null)
    const res = await encapsulatedPdfApi.encapsulate({
      reportId: pdfReportId.trim(),
      pdfUrl: pdfUrl.trim() || undefined,
      pdfBase64: pdfBase64.trim() || undefined,
    })
    setEncapsulating(false)
    if (res.success && res.data) {
      setPdfDoc(res.data)
      setPdfHistory(h => [{
        id: res.data?.id ?? String(Date.now()),
        reportId: res.data?.reportId ?? pdfReportId.trim(),
        size: res.data?.size ?? 0,
        generatedAt: res.data?.generatedAt ?? new Date().toISOString(),
      }, ...h].slice(0, 10))
      message.success(t('dicomSrPage.encapSuccess'))
    } else {
      message.error(res.error?.message || t('dicomSrPage.encapFail'))
    }
  }

  const downloadPdf = () => {
    if (!pdfDoc) return
    if (pdfDoc.pdfEmbedded.startsWith('url:')) {
      window.open(pdfDoc.pdfEmbedded.slice(4), '_blank')
      return
    }
    try {
      const binary = atob(pdfDoc.pdfEmbedded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pdfDoc.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success(t('dicomSrPage.encapDownloaded'))
    } catch {
      message.warning(t('dicomSrPage.pdfTextStream'))
    }
  }

  const selectedTemplate = templates.find(t => t.id === templateId)

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)',}}>
    <PageHeader
      icon={<FileText size={20} color="#2563eb" />}
      title={t('dicomSrPage.title')}
      actions={<Tag color="cyan">TID 1500 / 2000</Tag>}
    />

      <Card title={t('dicomSr.templateConfig') || '模板配置'} size="small" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>{t('dicomSr.selectTemplate') || '选择 SR 模板'}:</Text>
            <div style={{ marginTop: 8 }}>
              <Segmented
                value={templateId}
                onChange={(v) => setTemplateId(v as string)}
                options={templates.length > 0
                  ? templates.map(t => ({ label: t.labelEn, value: t.id }))
                  : [
                      { label: t('dicomSrPage.tid1500Label'), value: 'tid1500' },
                      { label: t('dicomSrPage.tid2000Label'), value: 'tid2000' },
                    ]
                }
              />
            </div>
            {selectedTemplate && (
              <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                {selectedTemplate.description}
              </Text>
            )}
          </div>

          <div>
            <Text strong>{t('dicomSr.reportId') || '报告 ID'}:</Text>
            <Input
              style={{ width: 320, marginTop: 4 }}
              placeholder={t('dicomSr.reportIdPlaceholder') || '输入报告 ID...'}
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            />
          </div>

          <div>
            <Text strong>{t('dicomSr.findings') || '影像所见'}:</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={3}
              placeholder={t('dicomSr.findingsPlaceholder') || '输入影像所见内容...'}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>

          <div>
            <Text strong>{t('dicomSr.impression') || '诊断印象'}:</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={2}
              placeholder={t('dicomSr.impressionPlaceholder') || '输入诊断印象...'}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
            />
          </div>

          <Button
            type="primary"
            icon={<Play size={14} />}
            onClick={handleGenerate}
            loading={generating}
          >
            {t('dicomSr.generate') || '生成 SR'}
          </Button>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <Eye size={14} />
            <span>{t('dicomSr.srPreview') || 'SR 预览'}</span>
          </Space>
        }
        size="small"
        extra={
          srDoc && (
            <Space>
              <Button size="small" icon={<Copy size={12} />} onClick={copyContent}>
                {t('dicomSr.copyContent') || '复制内容'}
              </Button>
              <Button size="small" icon={<Download size={12} />} onClick={downloadSr}>
                {t('dicomSr.download') || '下载 SR'}
              </Button>
              {/* [G005 W4B] 服务器下载 (GET /dicom-sr/:id/download) */}
              <Button size="small" type="primary" ghost icon={<Download size={12} />} loading={serverDownloading} onClick={() => void downloadSrFromServer()}>
                {t('w4b.sr.downloadServer')}
              </Button>
            </Space>
          )
        }
      >
        {generating ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip={t('dicomSr.generating') || '正在生成 SR...'} />
          </div>
        ) : srDoc ? (
          <div>
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="ID">{srDoc.id}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.reportId')}>{srDoc.reportId}</Descriptions.Item>
              <Descriptions.Item label="TID">{srDoc.tid}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.sopInstanceUid')}>
                <Text copyable style={{ fontSize: 12 }}>{srDoc.sopInstanceUID}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.status')}>
                <Tag color={srDoc.status === 'draft' ? 'orange' : 'green'}>{srDoc.status === 'draft' ? t('dicomSrPage.draft') : srDoc.status === 'finalized' ? t('dicomSrPage.finalized') : srDoc.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.generated')}>{new Date(srDoc.generatedAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <pre style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: 16,
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.6,
              overflow: 'auto',
              maxHeight: 400,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
            }}>
              {srDoc.content}
            </pre>
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dicomSr.noSr') || '尚未生成 SR'} />
        )}
      </Card>

      {/* [v3.0.6.11-99 Wave10B] 本会话生成记录 (SR + PDF) */}
      {(genHistory.length > 0 || pdfHistory.length > 0) && (
        <Card
          title={<span><FileText size={14} /> {t('dicomSrPage.sessionHistory')}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                {t('dicomSrPage.srDocuments')} ({genHistory.length})
              </div>
              {genHistory.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid var(--border-color)', fontSize: 12,
                }}>
                  <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{h.tid}</Tag>
                  <span style={{ color: '#334155', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('dicomSrPage.report')} {h.reportId}
                  </span>
                  <Tag color={h.status === 'draft' ? 'orange' : 'green'} style={{ fontSize: 10, margin: 0 }}>
                    {h.status === 'draft' ? t('dicomSrPage.draft') : h.status === 'finalized' ? t('dicomSrPage.finalized') : h.status}
                  </Tag>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{String(h.generatedAt || '').slice(5, 16).replace('T', ' ')}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                {t('dicomSrPage.pdfEncapsulation')} ({pdfHistory.length})
              </div>
              {pdfHistory.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid var(--border-color)', fontSize: 12,
                }}>
                  <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>PDF</Tag>
                  <span style={{ color: '#334155', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('dicomSrPage.report')} {h.reportId}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{h.size} B</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{String(h.generatedAt || '').slice(5, 16).replace('T', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* [G005 Wave4B] G-01 DICOM PDF 封装 (Encapsulated PDF Storage) */}
      <Card
        title={
          <Space>
            <FilePlus2 size={14} />
            <span>{t('dicomSrPage.pdfEncapsulation')} (G-01)</span>
            <Tag color="purple">1.2.840.10008.5.1.4.1.1.104.1</Tag>
          </Space>
        }
        size="small"
        extra={
          pdfDoc && (
            <Button size="small" icon={<Download size={12} />} onClick={downloadPdf}>
              {t('dicomSrPage.downloadPdf')}
            </Button>
          )
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>{t('dicomSrPage.reportOrStudyId')}:</Text>
            <Input
              style={{ width: 320, marginTop: 4 }}
              placeholder={t('dicomSrPage.reportOrStudyIdPlaceholder')}
              value={pdfReportId}
              onChange={(e) => setPdfReportId(e.target.value)}
            />
          </div>
          <div>
            <Text strong>PDF URL ({t('dicomSrPage.optional')}):</Text>
            <Input
              style={{ width: 480, marginTop: 4 }}
              placeholder={t('dicomSrPage.pdfUrlPlaceholder')}
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
            />
          </div>
          <div>
            <Text strong>PDF Base64 ({t('dicomSrPage.optional')}):</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={2}
              placeholder={t('dicomSrPage.pdfBase64Placeholder')}
              value={pdfBase64}
              onChange={(e) => setPdfBase64(e.target.value)}
            />
          </div>
          <Button
            type="primary"
            icon={<FilePlus2 size={14} />}
            onClick={() => void handleEncapsulate()}
            loading={encapsulating}
          >
            {t('dicomSrPage.encapsulatePdf')}
          </Button>
          {pdfDoc && (
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="ID">{pdfDoc.id}</Descriptions.Item>
              <Descriptions.Item label="SOP Class UID">{pdfDoc.sopClassUid}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.reportId')}>{pdfDoc.reportId}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.sopInstanceUid')}>
                <Text copyable style={{ fontSize: 12 }}>{pdfDoc.sopInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Study UID">
                <Text copyable style={{ fontSize: 12 }}>{pdfDoc.studyInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.size')}>{pdfDoc.size} {t('dicomSrPage.bytes')}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.source')}>
                <Tag color={pdfDoc.generatedFrom === 'input' ? 'green' : pdfDoc.generatedFrom === 'url' ? 'blue' : 'orange'}>
                  {pdfDoc.generatedFrom === 'input' ? t('dicomSrPage.sourceBase64') : pdfDoc.generatedFrom === 'url' ? t('dicomSrPage.sourceUrl') : t('dicomSrPage.sourceFallback')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.generatedAt')}>{new Date(pdfDoc.generatedAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          )}

          {/* [v3.0.6.11-103 Wave 2B] 已封装 PDF 查询 (GET /dicom-sr/encapsulated/:id) */}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
            {t('dicomSr.pdfLookup') || '查询已封装 PDF'} <Tag color="purple" style={{ fontSize: 10 }}>GET /dicom-sr/encapsulated/:id</Tag>
          </div>
          <Space>
            <Input
              style={{ width: 300 }}
              placeholder={t('dicomSr.pdfLookupPlaceholder') || '输入封装 PDF ID...'}
              value={pdfLookupId}
              onChange={(e) => setPdfLookupId(e.target.value)}
              onPressEnter={() => void handlePdfLookup()}
            />
            <Button icon={<Search size={13} />} onClick={() => void handlePdfLookup()} loading={pdfLookupLoading}>
              {t('dicomSr.pdfLookupBtn') || '查询'}
            </Button>
          </Space>
          {pdfLookupState === 'ok' && pdfLookupResult && (
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="ID">{pdfLookupResult.id}</Descriptions.Item>
              <Descriptions.Item label="SOP Class UID">{pdfLookupResult.sopClassUid}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.reportId')}>{pdfLookupResult.reportId}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.sopInstanceUid')}>
                <Text copyable style={{ fontSize: 12 }}>{pdfLookupResult.sopInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Study UID">
                <Text copyable style={{ fontSize: 12 }}>{pdfLookupResult.studyInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.size')}>{pdfLookupResult.size} {t('dicomSrPage.bytes')}</Descriptions.Item>
            </Descriptions>
          )}
          {pdfLookupState === 'none' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#92400e', background: 'var(--color-warning-bg)', padding: '8px 12px', borderRadius: 6 }}>
              {t('dicomSr.pdfNotFound') || '未找到该封装 PDF'}
            </div>
          )}
          {pdfLookupState === 'err' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', background: 'var(--color-error-bg)', padding: '8px 12px', borderRadius: 6 }}>
              {t('dicomSr.pdfLookupFailed') || '封装 PDF 查询失败'}
            </div>
          )}
        </Space>
      </Card>

      {/* ============================================================
          [v3.0.6.11-99 Wave10B] 深化: SR 统计 / 模板结构树 / 报告关联
          ============================================================ */}
      {/* 数据源徽标 + 刷新 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: statsSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          color: statsSource === 'real' ? '#065f46' : '#92400e',
          border: `1px solid ${statsSource === 'real' ? '#bbf7d0' : '#fcd34d'}`,
        }}>
          <Database size={12} />
          SR {t('dicomSrPage.statsSource')}: {statsSource === 'real' ? t('dicomSrPage.sourceReal') : t('dicomSrPage.sourceDemo')}
        </span>
        {statsLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('dicomSrPage.syncing')}</span>}
        <Button size="small" icon={<RefreshCcw size={12} />} onClick={loadSrStats}>{t('dicomSrPage.refresh')}</Button>
        {statsError && <span style={{ fontSize: 11, color: '#d97706' }}>{statsError}</span>}
      </div>

      {/* 1. SR 统计 (按模板类型/模态/状态) */}
      <Card
        title={<span><BarChart3 size={14} /> {t('dicomSrPage.srDocStats')}</span>}
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Tag color="blue">{t('dicomSrPage.totalPrefix')} {srStats.total} {t('dicomSrPage.copies')}</Tag>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {/* 按模板类型 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{t('dicomSrPage.byTemplateType')} (TID)</div>
            {srStats.byTid.map((entry: [string, number]) => {
              const [tid, count] = entry
              const cnt = Number(count ?? 0)
              const maxTid = Math.max(1, ...srStats.byTid.map(([, c]) => Number(c)))
              return (
                <div key={tid} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{tid}</span>
                    <span style={{ color: '#1e40af', fontWeight: 700 }}>{cnt}</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(cnt / maxTid) * 100}%`, height: '100%', background: '#1e40af', borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* 按模态 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{t('dicomSrPage.byModality')}</div>
            {srStats.byModality.map((entry: [string, number]) => {
              const [mod, count] = entry
              const cnt = Number(count ?? 0)
              const maxMod = Math.max(1, ...srStats.byModality.map(([, c]) => Number(c)))
              const colors: Record<string, string> = { CT: '#3b82f6', MR: '#8b5cf6', DR: '#22c55e', DSA: '#f59e0b', MG: '#ec4899' }
              return (
                <div key={mod} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{mod}</span>
                    <span style={{ color: colors[mod] || '#64748b', fontWeight: 700 }}>{cnt}</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(cnt / maxMod) * 100}%`, height: '100%', background: colors[mod] || '#64748b', borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {/* 按状态 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{t('dicomSrPage.byStatus')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{srStats.draft}</div>
                <div style={{ fontSize: 11, color: '#92400e' }}>{t('dicomSrPage.draft')}</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--color-info-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>{srStats.finalized}</div>
                <div style={{ fontSize: 11, color: '#1e40af' }}>{t('dicomSrPage.finalized')}</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--color-success-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{srStats.pushed}</div>
                <div style={{ fontSize: 11, color: '#065f46' }}>{t('dicomSrPage.pushedOru')}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
              {t('w9d.dicomSr.rateLine', { finalized: srStats.total > 0 ? Math.round((srStats.finalized / srStats.total) * 100) : 0, pushed: srStats.total > 0 ? Math.round((srStats.pushed / srStats.total) * 100) : 0 })}
            </div>
          </div>
        </div>
        {/* 文档明细表 */}
        {srDocs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <DataTable
              dataSource={srDocs.slice(0, 10)}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: t('dicomSrPage.patient'), dataIndex: 'patientName', key: 'patientName', width: 110, render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
                { title: t('dicomSrPage.modality'), dataIndex: 'modality', key: 'modality', width: 70 },
                { title: 'TID', dataIndex: 'tid', key: 'tid', width: 90, render: (v: string, r: SrDocument) => <Tag color="purple">{r.templateId ?? v}</Tag> },
                { title: t('dicomSrPage.reportId'), dataIndex: 'reportId', key: 'reportId', width: 130, ellipsis: true },
                {
                  title: t('dicomSrPage.status'), dataIndex: 'status', key: 'status', width: 90,
                  render: (v: string) => <Tag color={v === 'pushed' ? 'green' : v === 'finalized' ? 'blue' : 'orange'}>{v === 'pushed' ? t('dicomSrPage.pushed') : v === 'finalized' ? t('dicomSrPage.finalized') : t('dicomSrPage.draft')}</Tag>,
                },
                { title: t('dicomSrPage.generatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v: string) => String(v || '').slice(0, 19).replace('T', ' ') },
              ]}
            />
          </div>
        )}
      </Card>

      {/* 2. SR 模板预览卡 (TID 结构树) */}
      <Card
        title={<span><FolderTree size={14} /> {t('dicomSrPage.srTemplateTree')}</span>}
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Tag color="cyan">{t('dicomSrPage.tidStandardStructure')}</Tag>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(['tid1500', 'tid2000'] as const).map(tidKey => (
            <div key={tidKey} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <GitBranch size={13} />
                {tidKey === 'tid1500' ? t('dicomSrPage.tid1500Label') : t('dicomSrPage.tid2000Label')}
                {templates.find(t => t.id === tidKey) && (
                  <Tag color="blue" style={{ fontSize: 10 }}>{templates.find(t => t.id === tidKey)?.labelEn}</Tag>
                )}
              </div>
              {(TID_TREE[tidKey] ?? []).map(node => (
                <div key={node.code} style={{ marginBottom: 8 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                    background: '#f1f5f9', color: '#334155', borderLeft: '3px solid #1e40af',
                  }}>
                    {node.label}
                    <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6, fontFamily: 'monospace' }}>{node.code}</span>
                  </div>
                  {node.children && (
                    <div style={{ marginTop: 4, paddingLeft: 16 }}>
                      {node.children.map(child => (
                        <div key={child.code} style={{
                          fontSize: 11, color: '#64748b', padding: '3px 8px', marginBottom: 2,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                          {child.label}
                          <span style={{ fontSize: 10, color: '#b0b7c3', fontFamily: 'monospace' }}>{child.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
          {t('dicomSrPage.tidExplanation')}
        </div>
      </Card>

      {/* 3. SR 与报告关联显示 */}
      <Card
        title={<span><Link2 size={14} /> {t('dicomSrPage.srReportLink')}</span>}
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Tag color="geekblue">GET /dicom-sr/by-report/:reportId</Tag>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Input
              style={{ width: 300 }}
              placeholder={t('dicomSrPage.linkSearchPlaceholder')}
              value={linkReportId}
              onChange={e => setLinkReportId(e.target.value)}
              onPressEnter={() => void handleLinkLookup()}
            />
            <Button type="primary" icon={<Link2 size={14} />} onClick={() => void handleLinkLookup()} loading={linking}>
              {t('dicomSrPage.queryLink')}
            </Button>
          </Space>
          {linkResult === 'ok' && linkedDoc && (
            <div style={{
              padding: 14, borderRadius: 8, border: '1px solid #bbf7d0',
              background: 'var(--color-success-bg)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge status="success" /> {t('dicomSrPage.linkedFound')}
              </div>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="SR ID">{linkedDoc.id}</Descriptions.Item>
                <Descriptions.Item label={t('dicomSrPage.reportId')}>{linkedDoc.reportId}</Descriptions.Item>
                <Descriptions.Item label="TID">
                  <Tag color="purple">{linkedDoc.templateId ?? linkedDoc.tid}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('dicomSrPage.patient')}>{linkedDoc.patientName} ({linkedDoc.patientId})</Descriptions.Item>
                <Descriptions.Item label={t('dicomSrPage.modality')}>{linkedDoc.modality}</Descriptions.Item>
                <Descriptions.Item label={t('dicomSrPage.status')}>
                  <Tag color={linkedDoc.status === 'pushed' ? 'green' : linkedDoc.status === 'finalized' ? 'blue' : 'orange'}>
                    {linkedDoc.status === 'pushed' ? t('dicomSrPage.pushed') : linkedDoc.status === 'finalized' ? t('dicomSrPage.finalized') : t('dicomSrPage.draft')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Study UID">
                  <Text copyable style={{ fontSize: 11 }}>{linkedDoc.studyInstanceUid}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="SOP UID">
                  <Text copyable style={{ fontSize: 11 }}>{linkedDoc.sopInstanceUid}</Text>
                </Descriptions.Item>
              </Descriptions>
              {linkedDoc.hl7ControlId && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#065f46' }}>
                  ORU {t('dicomSrPage.callback')}: <span style={{ fontFamily: 'monospace' }}>{linkedDoc.hl7ControlId}</span>
                  {linkedDoc.pushedAt && ` @ ${String(linkedDoc.pushedAt).slice(0, 19).replace('T', ' ')}`}
                </div>
              )}
            </div>
          )}
          {linkResult === 'none' && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-warning-bg)', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
              {t('dicomSrPage.linkNotFound')}
            </div>
          )}
          {linkResult === 'err' && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-error-bg)', border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c' }}>
              {t('dicomSrPage.linkQueryFailed')}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {t('dicomSrPage.linkHint')}
          </div>
        </Space>
      </Card>

      {/* ============================================================
          [v3.0.6.11-103 Wave 2B] 测量模板库 (TID 1500/2000, 20 模板 seed)
          GET /dicom-sr/measurement-templates/categories | /measurement-templates | /measurement-templates/:id
          ============================================================ */}
      <Card
        title={
          <Space>
            <Library size={14} />
            <span>{t('dicomSr.mtLib') || '测量模板库 (TID 1500/2000)'}</span>
            <Tag color="cyan" style={{ fontSize: 10 }}>20 {t('dicomSrPage.templateSeed')}</Tag>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
        extra={<Tag color="geekblue">GET /dicom-sr/measurement-templates*</Tag>}
      >
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          {t('dicomSr.mtSub') || '20 个完整测量模板 (SNOMED 编码 + 单位 + 正常参考范围 + 测量说明), 覆盖 CT 胸腹 / MR 脑脊柱 / DR 骨折 / MG 乳腺'}
        </div>

        {/* 分类统计 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
          {t('dicomSr.mtCategories') || '模板分类'}
        </div>
        <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
          {mtCategories.map((c) => (
            <Tag
              key={c.category}
              color={mtFilter.category === c.category ? 'blue' : 'default'}
              style={{ cursor: 'pointer', padding: '2px 10px' }}
              onClick={() => setMtFilter((f) => ({ ...f, category: f.category === c.category ? undefined : c.category }))}
            >
              {c.category} ({c.count ?? 0}) · {Array.isArray(c.modalities) && c.modalities.length > 0 ? c.modalities.join('/') : '-'}
            </Tag>
          ))}
        </Space>

        {/* 过滤 + 刷新 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('dicomSr.mtModality') || '模态'}:</span>
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder={t('dicomSr.mtAll') || '全部'}
            value={mtFilter.modality}
            onChange={(v) => setMtFilter((f) => ({ ...f, modality: v ?? undefined }))}
            options={['CT', 'MR', 'DR', 'MG'].map((m) => ({ value: m, label: m }))}
          />
          <Button size="small" icon={<RefreshCcw size={12} />} onClick={() => void loadMtTemplates()}>
            {t('dicomSr.mtSearch') || '查询模板'}
          </Button>
        </Space>

        {mtLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : mtTemplates.length > 0 ? (
          <DataTable
            dataSource={mtTemplates}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id', width: 200, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
              { title: t('dicomSrPage.templateName'), dataIndex: 'templateName', key: 'templateName', width: 220 },
              { title: 'TID', dataIndex: 'templateId', key: 'templateId', width: 80, render: (v: string) => <Tag color="purple">{v}</Tag> },
              { title: t('dicomSrPage.modality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: t('dicomSrPage.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 80 },
              { title: t('dicomSrPage.category'), dataIndex: 'category', key: 'category', width: 100 },
              { title: t('dicomSrPage.measurementsTitle'), dataIndex: 'measurements', key: 'measurements', width: 120, render: (v: MeasurementTemplate['measurements']) => t('w9d.dicomSr.itemCount', { n: Array.isArray(v) ? v.length : 0 }) },
              {
                title: t('dicomSr.mtView') || '查看',
                key: 'action',
                width: 90,
                render: (_: unknown, r: MeasurementTemplate) => (
                  <Button size="small" icon={<Eye size={12} />} onClick={() => void openMtDetail(r.id)}>{t('dicomSrPage.detail')}</Button>
                ),
              },
            ]}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dicomSr.mtNoData') || '暂无模板 (可按模态/分类过滤)'} />
        )}
      </Card>

      {/* 测量模板详情 Modal */}
      <Modal
        title={mtDetail ? mtDetail.templateName : (t('dicomSr.mtDetail') || '模板详情')}
        open={mtDetailOpen}
        onCancel={() => setMtDetailOpen(false)}
        footer={<Button onClick={() => setMtDetailOpen(false)}>{t('dicomSrPage.close')}</Button>}
        width={640}
      >
        {mtDetailLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : mtDetail ? (
          <div>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="ID" span={2}><code style={{ fontSize: 11 }}>{mtDetail.id}</code></Descriptions.Item>
              <Descriptions.Item label="TID"><Tag color="purple">{mtDetail.templateId}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.modality')}><Tag color="blue">{mtDetail.modality}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.bodyPart')}>{mtDetail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSrPage.category')}>{mtDetail.category}</Descriptions.Item>
              <Descriptions.Item label={t('dicomSr.mtPurpose') || '用途'} span={2}>{mtDetail.purpose}</Descriptions.Item>
            </Descriptions>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
              {t('dicomSr.mtMeasurements') || '测量项'} ({mtDetail.measurements?.length ?? 0})
            </div>
            <DataTable
              dataSource={mtDetail.measurements ?? []}
              rowKey={(r) => `${r.code}-${r.meaning}`}
              pagination={false}
              columns={[
                { title: t('dicomSrPage.code'), dataIndex: 'code', key: 'code', width: 90, render: (v: string) => <code style={{ fontSize: 10 }}>{v}</code> },
                { title: t('dicomSrPage.scheme'), dataIndex: 'scheme', key: 'scheme', width: 60 },
                { title: t('dicomSrPage.measurementsTitle'), dataIndex: 'meaning', key: 'meaning', width: 160 },
                { title: t('dicomSrPage.unit'), dataIndex: 'unit', key: 'unit', width: 60 },
                {
                  title: t('dicomSr.mtNormalRange') || '正常范围',
                  key: 'normalRange',
                  width: 130,
                  render: (_: unknown, r: MeasurementTemplate['measurements'][number]) =>
                    r.normalRange?.label ?? (r.normalRange?.min !== undefined || r.normalRange?.max !== undefined
                      ? `${r.normalRange.min ?? '−∞'} ~ ${r.normalRange.max ?? '+∞'}`
                      : '-'),
                },
                { title: t('dicomSrPage.description'), dataIndex: 'description', key: 'description' },
              ]}
            />
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{t('dicomSr.mtSnomed') || 'SNOMED 发现编码'}:</span>
              <Space wrap size={4} style={{ marginTop: 4 }}>
                {(mtDetail.snomedFindings ?? []).map((c) => <Tag key={c} style={{ fontSize: 10, fontFamily: 'monospace' }}>{c}</Tag>)}
              </Space>
            </div>
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dicomSrPage.noData')} />
        )}
      </Modal>
    </div>
  )
}

export default DicomSrPage

import { DataTable } from "../../components/common";