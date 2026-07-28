import React, { useState, useEffect } from 'react'
import { Card, Input, Button, Space, Tag, message, Typography, Descriptions, Spin, Empty, Segmented } from 'antd'
import { FileText, Play, Eye, Copy, Download } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { dicomSrApi, type DicomSrTemplate, type DicomSrDocument } from '../../services/api/dicomApi'

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

  const selectedTemplate = templates.find(t => t.id === templateId)

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM SR Manager</span>
        <Tag color="cyan">TID 1500 / 2000</Tag>
      </Space>

      <Card title={t('dicomSr.templateConfig') || '模板配置'} size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>{t('dicomSr.selectTemplate') || '选择 SR 模板'}:</Text>
            <div style={{ marginTop: 8 }}>
              <Segmented
                value={templateId}
                onChange={(v) => setTemplateId(v as string)}
                options={templates.length > 0
                  ? templates.map(t => ({ label: t.labelEn, value: t.id }))
                  : [
                      { label: 'TID 1500 - Measurement Report', value: 'tid1500' },
                      { label: 'TID 2000 - CAD Document SR', value: 'tid2000' },
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
            <Text strong>{t('dicomSr.findings') || '影像所见 / Findings'}:</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={3}
              placeholder={t('dicomSr.findingsPlaceholder') || '输入影像所见内容...'}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>

          <div>
            <Text strong>{t('dicomSr.impression') || '诊断印象 / Impression'}:</Text>
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
              <Descriptions.Item label="Report ID">{srDoc.reportId}</Descriptions.Item>
              <Descriptions.Item label="TID">{srDoc.tid}</Descriptions.Item>
              <Descriptions.Item label="SOP Instance UID">
                <Text copyable style={{ fontSize: 12 }}>{srDoc.sopInstanceUID}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color="green">{srDoc.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Generated">{new Date(srDoc.generatedAt).toLocaleString()}</Descriptions.Item>
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
          <Empty description={t('dicomSr.noSr') || '尚未生成 SR'} />
        )}
      </Card>
    </div>
  )
}

export default DicomSrPage
