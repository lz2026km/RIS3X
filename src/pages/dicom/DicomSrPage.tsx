import { t } from '../../i18n/appI18n'
import { dicomSrApi, type DicomSrTemplate, type DicomSrDocument } from '../../services/api/dicomApi'
import { encapsulatedPdfApi, type EncapsulatedPdf } from '../../services/api/dicomApi'
import { Card, Input, Button, Space, Tag, message, Typography, Descriptions, Spin, Empty, Segmented } from 'antd'
import { FileText, Play, Eye, Copy, Download, FilePlus2 } from 'lucide-react'
import React, { useState, useEffect } from 'react'
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
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // [G005 Wave4B] G-01 Encapsulated PDF 封装
  const [pdfReportId, setPdfReportId] = useState<string>('')
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [pdfBase64, setPdfBase64] = useState<string>('')
  const [encapsulating, setEncapsulating] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<EncapsulatedPdf | null>(null)

  useEffect(() => {
    setLoadingTemplates(true)
    dicomSrApi.getTemplates().then(res => {
      if (res.success && res.data) {
        setTemplates(res.data)
      }
    }).finally(() => setLoadingTemplates(false))
  }, [])

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
      message.success(t('dicomSr.generateSuccess') || 'SR 生成成功')
    } else {
      message.error(res.error?.message || 'SR 生成失败')
    }
  }

  const copyContent = () => {
    if (!srDoc) return
    navigator.clipboard.writeText(srDoc.content)
    message.success(t('dicomSr.copied') || '已复制')
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
      message.warning('请输入报告 ID 或检查 ID')
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
      message.success('PDF 封装成功')
    } else {
      message.error(res.error?.message || 'PDF 封装失败')
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
      message.success('封装 PDF 已下载')
    } catch {
      message.warning('PDF 内容为文本流 (报告兜底), 无有效 PDF 二进制')
    }
  }

  const selectedTemplate = templates.find(t => t.id === templateId)

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
    <PageHeader
      icon={<FileText size={20} color="#2563eb" />}
      title="DICOM SR 管理平台"
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
                      { label: 'TID 1500 - 测量报告', value: 'tid1500' },
                      { label: 'TID 2000 - CAD 文档 SR', value: 'tid2000' },
                    ]
                }
                loading={loadingTemplates}
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
              <Descriptions.Item label="报告 ID">{srDoc.reportId}</Descriptions.Item>
              <Descriptions.Item label="TID">{srDoc.tid}</Descriptions.Item>
              <Descriptions.Item label="SOP 实例 UID">
                <Text copyable style={{ fontSize: 12 }}>{srDoc.sopInstanceUID}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={srDoc.status === 'draft' ? 'orange' : 'green'}>{srDoc.status === 'draft' ? '草稿' : srDoc.status === 'finalized' ? '已定稿' : srDoc.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="已生成">{new Date(srDoc.generatedAt).toLocaleString()}</Descriptions.Item>
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

      {/* [G005 Wave4B] G-01 DICOM PDF 封装 (Encapsulated PDF Storage) */}
      <Card
        title={
          <Space>
            <FilePlus2 size={14} />
            <span>PDF 封装 (G-01)</span>
            <Tag color="purple">1.2.840.10008.5.1.4.1.1.104.1</Tag>
          </Space>
        }
        size="small"
        extra={
          pdfDoc && (
            <Button size="small" icon={<Download size={12} />} onClick={downloadPdf}>
              下载封装 PDF
            </Button>
          )
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>报告 ID / 检查 ID:</Text>
            <Input
              style={{ width: 320, marginTop: 4 }}
              placeholder="输入报告 ID 或检查 ID (studyId)..."
              value={pdfReportId}
              onChange={(e) => setPdfReportId(e.target.value)}
            />
          </div>
          <div>
            <Text strong>PDF URL (可选):</Text>
            <Input
              style={{ width: 480, marginTop: 4 }}
              placeholder="https://.../report.pdf — 提供后按引用封装"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
            />
          </div>
          <div>
            <Text strong>PDF Base64 (可选):</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={2}
              placeholder="粘贴 PDF 的 base64 内容 — 不填则由报告内容生成文本流兜底"
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
            封装 PDF
          </Button>
          {pdfDoc && (
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="ID">{pdfDoc.id}</Descriptions.Item>
              <Descriptions.Item label="SOP Class UID">{pdfDoc.sopClassUid}</Descriptions.Item>
              <Descriptions.Item label="报告 ID">{pdfDoc.reportId}</Descriptions.Item>
              <Descriptions.Item label="SOP 实例 UID">
                <Text copyable style={{ fontSize: 12 }}>{pdfDoc.sopInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Study UID">
                <Text copyable style={{ fontSize: 12 }}>{pdfDoc.studyInstanceUid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="大小">{pdfDoc.size} 字节</Descriptions.Item>
              <Descriptions.Item label="来源">
                <Tag color={pdfDoc.generatedFrom === 'input' ? 'green' : pdfDoc.generatedFrom === 'url' ? 'blue' : 'orange'}>
                  {pdfDoc.generatedFrom === 'input' ? 'Base64 输入' : pdfDoc.generatedFrom === 'url' ? 'URL 引用' : '报告文本流兜底'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="生成时间">{new Date(pdfDoc.generatedAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default DicomSrPage
