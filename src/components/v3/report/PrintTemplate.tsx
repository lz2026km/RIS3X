/**
 * G005 放射RIS系统 v3.0.1 - 报告打印模板 (A4/A5/B5)
 * 对标飞利浦 / 卫宁 / 岱嘉 — 三种纸张 + 含影像 + 含医院章
 */
import React, { useState } from 'react'
import { Modal, Radio, Switch, Button, Space, Tag } from 'antd'
import { Printer, FileText, Stamp } from 'lucide-react'

export type PaperSize = 'A4' | 'A5' | 'B5'

export interface PrintTemplateProps {
  open: boolean
  onClose: () => void
  onPrint?: (opts: { paperSize: PaperSize; includeImage: boolean; includeSeal: boolean }) => void
  defaultPaperSize?: PaperSize
  reportTitle?: string
}

const paperSizePx: Record<PaperSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210×297mm)' },
  A5: { width: 148, height: 210, label: 'A5 (148×210mm)' },
  B5: { width: 176, height: 250, label: 'B5 (176×250mm)' },
}

export const PrintTemplate: React.FC<PrintTemplateProps> = ({
  open,
  onClose,
  onPrint,
  defaultPaperSize = 'A4',
  reportTitle = '医学影像诊断报告',
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultPaperSize)
  const [includeImage, setIncludeImage] = useState(true)
  const [includeSeal, setIncludeSeal] = useState(true)

  const handlePrint = () => {
    onPrint?.({ paperSize, includeImage, includeSeal })
    onClose()
  }

  return (
    <Modal
      data-testid="print-template"
      title={
        <Space>
          <Printer size={16} />
          <span>打印模板</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handlePrint}
      okText="打印"
      cancelText="取消"
      width={520}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
            <FileText size={12} /> 纸张规格
          </div>
          <Radio.Group
            data-testid="print-paper"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            options={Object.entries(paperSizePx).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600 }}>包含内容</div>
          <Space orientation="vertical">
            <Space>
              <Switch
                size="small"
                checked={includeImage}
                onChange={setIncludeImage}
                data-testid="print-include-image"
              />
              <span>含影像缩略图(每序列 1 张)</span>
            </Space>
            <Space>
              <Switch
                size="small"
                checked={includeSeal}
                onChange={setIncludeSeal}
                data-testid="print-include-seal"
              />
              <Stamp size={12} />
              <span>含医院电子章</span>
            </Space>
          </Space>
        </div>

        <div
          style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 4,
            padding: 12,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
          }}
        >
          预览:{paperSizePx[paperSize].label} · 影像 ×{includeImage ? 1 : 0} · 印章 {includeSeal ? '✓' : '✗'}
        </div>

        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          报告标题:<Tag>{reportTitle}</Tag>
        </div>
      </Space>
    </Modal>
  )
}

export default PrintTemplate
