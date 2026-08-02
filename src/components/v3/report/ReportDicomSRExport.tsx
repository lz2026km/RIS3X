/**
 * G005 放射RIS系统 v3.0.2.1 - DICOM SR 导出 UI
 * TID 1500 完整实现 + Part 10 真实二进制序列化
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Button, Modal, Space, Tag, Card, Alert, Tabs, Radio, message, Statistic, Row, Col, Empty } from 'antd'
import { FileCheck, FileText, FileCode, Download, Eye, Layers } from 'lucide-react'
import {
  buildDicomSRDocument,
  serializeToJSON,
  serializeToXML,
  serializeToDicomPart10,
  validateSR,
  type ReportForSR,
  type DicomContentItem,
} from './dicomSR'

export interface ReportDicomSRExportProps {
  report: ReportForSR
  /** 默认导出格式 */
  defaultFormat?: 'json' | 'xml' | 'dcm'
  /** 文件名模板,支持 {id} {date} {patientId} */
  fileNameTemplate?: string
}

const FORMAT_META = {
  json: { icon: <FileCode size={14} />, label: 'JSON', mime: 'application/json', ext: '.json' },
  xml: { icon: <FileText size={14} />, label: 'XML', mime: 'application/xml', ext: '.xml' },
  dcm: { icon: <FileCheck size={14} />, label: 'DICOM SR', mime: 'application/dicom', ext: '.dcm' },
} as const

const renderItem = (item: DicomContentItem, depth: number = 0): React.ReactNode => {
  const colors: Record<string, string> = {
    TEXT: 'blue',
    NUM: 'purple',
    CODE: 'green',
    CONTAINER: 'geekblue',
    IMAGE: 'orange',
    UIDREF: 'cyan',
    COORD: 'magenta',
  }
  const color = colors[item.valueType] ?? 'default'
  return (
    <div
      key={item.id}
      data-testid={`sr-item-${item.id}`}
      style={{ marginLeft: depth * 18, padding: '4px 0', borderLeft: depth ? '1px dashed #e2e8f0' : 'none', paddingLeft: depth ? 8 : 0 }}
    >
      <Space size={4} wrap>
        <Tag color={color} style={{ fontSize: 12 }}>{item.valueType}</Tag>
        {item.relationship && (
          <Tag style={{ fontSize: 12 }} color="default">
            {item.relationship}
          </Tag>
        )}
        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.conceptName.CodeMeaning}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          ({item.conceptName.CodeValue}, {item.conceptName.CodingSchemeDesignator})
        </span>
        {item.valueType === 'NUM' && (
          <Tag color="purple" style={{ fontSize: 12 }}>
            {item.numericValue} {item.numericUnit?.CodeMeaning}
          </Tag>
        )}
        {item.valueType === 'TEXT' && item.textValue && (
          <span style={{ fontSize: 12, color: '#475569' }}>: {item.textValue.length > 60 ? item.textValue.slice(0, 60) + '...' : item.textValue}</span>
        )}
        {item.valueType === 'CODE' && item.conceptCodes?.[0] && (
          <Tag color="green" style={{ fontSize: 12 }}>{item.conceptCodes[0].CodeMeaning}</Tag>
        )}
        {item.valueType === 'IMAGE' && item.imageReference && (
          <Tag color="orange" style={{ fontSize: 12 }}>
            {item.imageReference.SOPClassUID.split('.').pop()}#{item.imageReference.SOPInstanceUID.split('.').slice(-2).join('.')}
          </Tag>
        )}
      </Space>
      {item.children && item.children.length > 0 && (
        <div>{item.children.map((c) => renderItem(c, depth + 1))}</div>
      )}
    </div>
  )
}

export const ReportDicomSRExport: React.FC<ReportDicomSRExportProps> = ({
  report,
  defaultFormat = 'json',
  fileNameTemplate = 'G005_SR_{id}_{date}',
}) => {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<typeof defaultFormat>(defaultFormat)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const sr = useMemo(() => buildDicomSRDocument(report), [report])
  const validation = useMemo(() => validateSR(sr), [sr])

  const fileName = useMemo(() => {
    return fileNameTemplate
      .replace('{id}', report.id)
      .replace('{date}', sr.General.InstanceCreationDate)
      .replace('{patientId}', report.patientId)
  }, [fileNameTemplate, report.id, report.patientId, sr.General.InstanceCreationDate])

  const doPreview = useCallback(() => {
    setPreviewing(true)
    setTimeout(() => {
      let out = ''
      if (format === 'json') out = serializeToJSON(sr)
      else if (format === 'xml') out = serializeToXML(sr)
      else {
        // v3.0.2.1: 真实 Part 10 二进制 — 以 hex + ASCII 形式显示
        const bin = serializeToDicomPart10(sr)
        const bytes = Array.from(bin.slice(0, 256))
        const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
        const ascii = bytes
          .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
          .join('')
        out = `# DICOM Part 10 Binary Preview\n# Total bytes: ${bin.length}\n# First 256 bytes (hex + ASCII):\n\n${hex}\n\n${ascii}\n\n# Use dcmtk/pydicom to parse full .dcm file`
      }
      setPreview(out)
      setPreviewing(false)
    }, 200)
  }, [format, sr])

  const doDownload = useCallback(() => {
    let blob: Blob
    if (format === 'json') blob = new Blob([serializeToJSON(sr)], { type: 'application/json' })
    else if (format === 'xml') blob = new Blob([serializeToXML(sr)], { type: 'application/xml' })
    else {
      // v3.0.2.1: 真实 Part 10 二进制(.dcm 可被 dcmtk / pydicom 解析)
      const bin = serializeToDicomPart10(sr)
      blob = new Blob([bin], { type: 'application/dicom' })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}${FORMAT_META[format].ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    void message.success(`已导出 ${fileName}${FORMAT_META[format].ext}`)
  }, [format, sr, fileName])

  const stats = useMemo(() => {
    let count = 0
    const walk = (items: DicomContentItem[]) => {
      for (const i of items) {
        count++
        if (i.children) walk(i.children)
      }
    }
    walk(sr.Specific.ContentSequence)
    return { items: count, refs: sr.Specific.ReferencedImageSequence.length }
  }, [sr])

  return (
    <>
      <Button
        data-testid="sr-export-open"
        icon={<FileCheck size={14} />}
        onClick={() => setOpen(true)}
      >
        导出 DICOM SR
      </Button>
      <Modal
        title={
          <Space>
            <FileCheck size={16} color="#1e3a5f" />
            <span>DICOM Structured Reporting · TID 1500</span>
            <Tag color="geekblue">2B-full</Tag>
          </Space>
        }
        open={open}
        onCancel={() => setOpen(false)}
        width={900}
        footer={null}
      >
        {!validation.valid && (
          <Alert
            type="error"
            showIcon
            title="SR 文档未通过验证"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            }
            style={{ marginBottom: 12 }}
          />
        )}
        {validation.warnings.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="SR 文档警告"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            }
            style={{ marginBottom: 12 }}
          />
        )}

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Statistic
              title="Content Items"
              value={stats.items}
              prefix={<Layers size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic title="图像引用" value={stats.refs} />
          </Col>
          <Col span={6}>
            <Statistic title="SOP Class" value={sr.General.SOPClassUID.split('.').pop()} />
          </Col>
          <Col span={6}>
            <Statistic
              title="Verification"
              valueRender={() => (
                <Tag color={sr.General.VerificationFlag === 'VERIFIED' ? 'green' : 'orange'} data-testid="sr-verification">
                  {sr.General.VerificationFlag}
                </Tag>
              )}
            />
          </Col>
        </Row>

        <Card size="small" style={{ marginBottom: 12 }}>
          <Row gutter={8}>
            <Col span={12}>
              <div style={{ fontSize: 12, color: '#64748b' }}>SOP Instance UID</div>
              <div data-testid="sr-sop-instance" style={{ fontFamily: 'monospace', fontSize: 12 }}>{sr.General.SOPInstanceUID}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Content Label</div>
              <Tag color="blue" data-testid="sr-content-label">{sr.General.ContentLabel}</Tag>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Completion</div>
              <Tag color={sr.General.CompletionFlag === 'COMPLETE' ? 'green' : 'orange'} data-testid="sr-completion">
                {sr.General.CompletionFlag}
              </Tag>
            </Col>
          </Row>
        </Card>

        <Tabs
          items={[
            {
              key: 'preview',
              label: '内容预览(树形)',
              children: (
                <div
                  data-testid="sr-tree-preview"
                  style={{ maxHeight: 360, overflow: 'auto', padding: 8, background: '#f8fafc', borderRadius: 6 }}
                >
                  {sr.Specific.ContentSequence.map((c) => renderItem(c))}
                </div>
              ),
            },
            {
              key: 'raw',
              label: '源文本',
              children: (
                <>
                  <Radio.Group
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    style={{ marginBottom: 8 }}
                  >
                    <Radio.Button value="json">{FORMAT_META.json.icon} JSON</Radio.Button>
                    <Radio.Button value="xml">{FORMAT_META.xml.icon} XML</Radio.Button>
                    <Radio.Button value="dcm">{FORMAT_META.dcm.icon} .dcm</Radio.Button>
                  </Radio.Group>
                  <Space style={{ marginBottom: 8 }}>
                    <Button
                      size="small"
                      icon={<Eye size={12} />}
                      onClick={doPreview}
                      loading={previewing}
                      data-testid="sr-preview"
                    >
                      生成预览
                    </Button>
                  </Space>
                  {preview ? (
                    <pre
                      data-testid="sr-raw-preview"
                      style={{
                        maxHeight: 360,
                        overflow: 'auto',
                        padding: 8,
                        background: '#0f172a',
                        color: '#e2e8f0',
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    >
                      {preview.length > 4000 ? preview.slice(0, 4000) + '\n...[truncated]...' : preview}
                    </pre>
                  ) : (
                    <Empty description="点击「生成预览」" />
                  )}
                </>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setOpen(false)}>关闭</Button>
            <Button
              type="primary"
              icon={<Download size={14} />}
              onClick={doDownload}
              disabled={!validation.valid}
              data-testid="sr-download"
            >
              下载 {fileName}
              {FORMAT_META[format].ext}
            </Button>
          </Space>
        </div>
      </Modal>
    </>
  )
}

export default ReportDicomSRExport
