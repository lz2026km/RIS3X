/**
 * G005 放射RIS系统 v3.0.6.1 - GE 定制结构化报告
 * 对标:GE Centricity Structured Reporting
 */
import React, { useState } from 'react'
import { Card, Tabs, Space, Button, Tag } from 'antd'
import { FileText, Save, Eye } from 'lucide-react'
import { TemplatePicker, type SRTemplateMeta } from './TemplatePicker'
import { FieldEditor, type SRField, type SRFieldValue } from './FieldEditor'
import { SRPreview } from './SRPreview'

const MOCK_TEMPLATE: SRTemplateMeta = {
  id: 'T-CT-CHEST',
  name: '胸部 CT 结构化模板',
  modality: 'CT',
  bodyPart: '胸部',
  version: 'v3.2',
  fields: [
    { id: 'clinical', label: '临床信息', type: 'multiline', required: true },
    { id: 'technique', label: '扫描技术', type: 'text', required: true, defaultValue: '平扫+增强' },
    { id: 'lung', label: '肺窗所见', type: 'multiline', required: true },
    { id: 'mediastinum', label: '纵隔窗所见', type: 'multiline' },
    { id: 'pleura', label: '胸膜', type: 'select', options: ['未见异常', '增厚', '积液', '钙化'] },
    { id: 'conclusion', label: '诊断结论', type: 'multiline', required: true },
    { id: 'rads', label: 'Lung-RADS 分级', type: 'select', options: ['1', '2', '3', '4A', '4B', '4X'] },
  ],
}

export interface StructuredReportProps {
  template?: SRTemplateMeta
  initialValues?: Record<string, SRFieldValue>
  onSave?: (data: Record<string, SRFieldValue>) => void
}

export const StructuredReport: React.FC<StructuredReportProps> = ({ template = MOCK_TEMPLATE, initialValues, onSave }) => {
  const [tpl, setTpl] = useState<SRTemplateMeta>(template)
  const [values, setValues] = useState<Record<string, SRFieldValue>>(
    initialValues ?? { technique: '平扫+增强' }
  )

  const setVal = (id: string, v: SRFieldValue) => setValues((s) => ({ ...s, [id]: v }))

  return (
    <div data-testid="structured-report">
      <Card
        size="small"
        title={<Space><FileText size={14} />结构化报告 - {tpl.name}</Space>}
        extra={
          <Space>
            <Tag color="blue">{tpl.modality}</Tag>
            <Tag color="purple">{tpl.bodyPart}</Tag>
            <Tag>v{tpl.version}</Tag>
          </Space>
        }
      >
        <Tabs
          size="small"
          items={[
            {
              key: 'edit',
              label: '编辑',
              children: (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <TemplatePicker value={tpl.id} onChange={(_id, tplMeta) => setTpl(tplMeta ?? MOCK_TEMPLATE)} />
                  <FieldEditor fields={tpl.fields as SRField[]} values={values} onChange={setVal} />
                  <Space>
                    <Button type="primary" icon={<Save size={12} />} onClick={() => onSave?.(values)}>保存草稿</Button>
                    <Button icon={<Eye size={12} />}>预览</Button>
                  </Space>
                </Space>
              ),
            },
            {
              key: 'preview',
              label: '预览',
              children: <SRPreview template={tpl} values={values} />,
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default StructuredReport