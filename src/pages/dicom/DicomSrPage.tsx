import React, { useState } from 'react'
import { Card, Select, Input, Button, Space, Tag, message, Typography, Descriptions, Spin, Empty, Segmented } from 'antd'
import { FileText, Play, Eye, Copy } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

interface TemplateInfo {
  id: string
  label: string
  labelEn: string
  description: string
  tid: string
}

interface SrDocument {
  id: string
  reportId: string
  templateId: string
  tid: string
  content: string
  status: string
  generatedAt: string
  sopInstanceUID: string
}

export const DicomSrPage: React.FC = () => {
  const [templateId, setTemplateId] = useState<string>('tid1500')
  const [reportId, setReportId] = useState<string>('')
  const [findings, setFindings] = useState<string>('')
  const [impression, setImpression] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [srDoc, setSrDoc] = useState<SrDocument | null>(null)
  const [templates, setTemplates] = useState<TemplateInfo[]>([
    { id: 'tid1500', label: 'TID 1500 - 测量报告', labelEn: 'TID 1500 - Measurement Report', description: 'Imaging Measurement Report (DICOM PS 3.3 TID 1500)', tid: '1500' },
    { id: 'tid2000', label: 'TID 2000 - CAD SR', labelEn: 'TID 2000 - CAD Document SR', description: 'Computer-Aided Detection/Diagnosis SR (DICOM PS 3.3 TID 2000)', tid: '2000' },
  ])

  const handleGenerate = async () => {
    if (!reportId.trim()) {
      message.warning(t('dicomSr.enterReportId') || '请输入报告ID')
      return
    }
    setGenerating(true)
    setSrDoc(null)
    try {
      const res = await fetch('/api/dicom-sr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: reportId.trim(), templateId, findings, impression }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc: SrDocument = await res.json()
      setSrDoc(doc)
      message.success(t('dicomSr.generateSuccess') || 'SR 生成成功')
    } catch {
      const id = `sr-${Date.now()}`
      const content = buildMockSr(templateId, reportId, findings, impression)
      const doc: SrDocument = { id, reportId, templateId, tid: templateId === 'tid1500' ? '1500' : '2000', content, status: 'GENERATED', generatedAt: new Date().toISOString(), sopInstanceUID: `1.2.840.10008.5.1.4.1.1.88.11.1.${Date.now()}` }
      setSrDoc(doc)
      message.info(t('dicomSr.offlineMode') || '离线模式: 已生成本地 SR')
    } finally {
      setGenerating(false)
    }
  }

  const copyContent = () => {
    if (!srDoc) return
    navigator.clipboard.writeText(srDoc.content)
    message.success(t('dicomSr.copied') || '已复制')
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
                options={templates.map(t => ({ label: t.labelEn, value: t.id }))}
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
            <Button size="small" icon={<Copy size={12} />} onClick={copyContent}>
              {t('dicomSr.copyContent') || '复制内容'}
            </Button>
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

function buildMockSr(templateId: string, reportId: string, findings: string, impression: string): string {
  const ts = Date.now()
  const sopUID = `1.2.840.10008.5.1.4.1.1.88.11.1.${ts}`
  const studyUID = `1.2.840.10008.5.1.4.1.1.2.1.${ts}`
  const seriesUID = `${sopUID}.99`
  const now = new Date()
  const studyDate = now.toISOString().slice(0, 10).replace(/-/g, '')
  const studyTime = now.toISOString().slice(11, 19).replace(/:/g, '')

  const tidLabel = templateId === 'tid1500' ? 'Imaging Measurement Report' : 'CAD Document SR'
  const tidCode = templateId === 'tid1500' ? 'TID 1500' : 'TID 2000'

  const items = templateId === 'tid1500'
    ? [
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121060\n      (00080104) LO = History / 历史发现\n    (0040A160) UT = ${findings || '(empty)'}`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121073\n      (00080104) LO = Impression / 印象\n    (0040A160) UT = ${impression || '(empty)'}`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 125007\n      (00080104) LO = Measurement Group / 测量组\n    (0040A160) UT = (empty)`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 112040\n      (00080104) LO = Tracking Identifier / 追踪标识\n    (0040A160) UT = ${reportId}`,
      ]
    : [
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121071\n      (00080104) LO = CAD Finding / CAD 发现\n    (0040A160) UT = ${findings || '(empty)'}`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121073\n      (00080104) LO = Impressions / 印象\n    (0040A160) UT = ${impression || '(empty)'}`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121074\n      (00080104) LO = Recommendation / 建议\n    (0040A160) UT = (empty)`,
        `  (0040A010) SQ (Content Item)\n    (0040A040) CS = CONTAINS\n    (0040A043) SQ (Concept Name Code Sequence)\n      (00080100) SH = DCM\n      (00080102) SH = 121120\n      (00080104) LO = CAD Processing and Findings Summary / CAD 处理总结\n    (0040A160) UT = (empty)`,
      ]

  return `# DICOM Structured Report
# DICOM Standard: PS 3.3-2024
# SOP Class: ${tidLabel} (${tidCode})
# SOP Instance UID: ${sopUID}
# Study Instance UID: ${studyUID}
# Series Instance UID: ${seriesUID}
# Study Date: ${studyDate}
# Study Time: ${studyTime}
# Report ID: ${reportId}
# Generated: ${now.toISOString()}
#
(00080005) CS = ISO_IR 100
(00080016) UI = 1.2.840.10008.5.1.4.1.1.88.11
(00080018) UI = ${sopUID}
(00080020) DA = ${studyDate}
(00080030) TM = ${studyTime}
(00080060) CS = SR
(0020000D) UI = ${studyUID}
(0020000E) UI = ${seriesUID}
(0040A040) CS = VERIFIED
(0040A491) CS = COMPLETE
(0040A504) SQ (Template Identifier)
  (0040DB00) CS = ${tidCode}
  (0040DB01) LO = ${tidLabel}
(0040A730) SQ (Content Sequence)
${items.join('\n')}
# ===== End of SR =====`
}

export default DicomSrPage
