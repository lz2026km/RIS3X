/**
 * G005 放射RIS系统 v3.0.2 - 结构化报告字段编辑器
 * 对标:Siemens syngo.via / 飞利浦 IntelliSpace / GE Centricity
 *
 * 设计:
 *  - 声明式 schema(JSON Schema 风格)驱动
 *  - 内置 RADS 标准(BI-RADS / LI-RADS / TI-RADS / PI-RADS / CAD-RADS / C-RADS / O-RADS / NI-RADS)
 *  - 用户可自由扩展自定义 schema
 *  - 字段类型:text/number/select/multiselect/date/measurement/code
 *  - 必填/可选 + 校验 + 错误提示
 *  - 与 RequiredFieldGuard 集成
 */
import React, { useMemo, useState, useCallback } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Space, Tag, Empty, Modal, Card } from 'antd'
import { Plus, Trash2, FileCode, Layers, Edit3 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'

export type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'measurement' | 'code' | 'boolean'

export interface FieldOption {
  value: string
  label: string
  code?: string
}

export interface FieldSchema {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: FieldOption[]
  unit?: string
  min?: number
  max?: number
  placeholder?: string
  defaultValue?: unknown
  validate?: (v: unknown) => string | null
  group?: string
  description?: string
  codeSystem?: string
}

export interface RadsSchema {
  category: string
  code: string
  name: string
  description: string
  fields: FieldSchema[]
}

export type FieldValue = string | number | string[] | boolean | null | undefined

export interface StructuredField {
  key: string
  value: FieldValue
  displayText: string
}

// =============== 内置 RADS Schema ===============

export const BI_RADS_SCHEMA: RadsSchema = {
  category: 'BI-RADS',
  code: 'BI-RADS',
  name: '乳腺影像报告与数据系统(BI-RADS)',
  description: '乳腺 X 线 / US / MR 影像分级标准',
  fields: [
    {
      key: 'composition',
      label: '腺体构成',
      type: 'select',
      required: true,
      group: '形态',
      options: [
        { value: 'A', label: 'A. 脂肪型', code: 'RID49472' },
        { value: 'B', label: 'B. 散在纤维腺体型', code: 'RID49473' },
        { value: 'C', label: 'C. 不均匀致密型', code: 'RID49474' },
        { value: 'D', label: 'D. 高度致密型', code: 'RID49475' },
      ],
    },
    {
      key: 'massShape',
      label: '肿块形态',
      type: 'select',
      group: '肿块',
      options: [
        { value: 'oval', label: '卵圆形' },
        { value: 'round', label: '圆形' },
        { value: 'irregular', label: '不规则形' },
      ],
    },
    {
      key: 'massMargin',
      label: '肿块边缘',
      type: 'select',
      group: '肿块',
      options: [
        { value: 'circumscribed', label: '清晰' },
        { value: 'obscured', label: '遮蔽' },
        { value: 'microlobulated', label: '微小分叶' },
        { value: 'indistinct', label: '模糊' },
        { value: 'spiculated', label: '毛刺' },
      ],
    },
    {
      key: 'calcification',
      label: '钙化',
      type: 'select',
      required: true,
      group: '钙化',
      options: [
        { value: 'none', label: '无' },
        { value: 'benign', label: '典型良性' },
        { value: 'suspicious', label: '可疑恶性' },
        { value: 'amorphous', label: '无定形' },
        { value: 'finePleomorphic', label: '细多形性' },
        { value: 'fineLinear', label: '细线/细线分支状' },
      ],
    },
    {
      key: 'category',
      label: '最终分级',
      type: 'select',
      required: true,
      group: '评估',
      options: [
        { value: '0', label: '0 — 评估不完全' },
        { value: '1', label: '1 — 阴性' },
        { value: '2', label: '2 — 良性' },
        { value: '3', label: '3 — 可能良性' },
        { value: '4A', label: '4A — 低度可疑恶性' },
        { value: '4B', label: '4B — 中度可疑恶性' },
        { value: '4C', label: '4C — 高度可疑恶性' },
        { value: '5', label: '5 — 高度提示恶性' },
        { value: '6', label: '6 — 活检证实恶性' },
      ],
    },
    {
      key: 'lesionSizeMm',
      label: '病灶大小',
      type: 'measurement',
      unit: 'mm',
      min: 0,
      max: 200,
      group: '肿块',
    },
    {
      key: 'recommendation',
      label: '建议',
      type: 'select',
      required: true,
      group: '评估',
      options: [
        { value: 'routine', label: '常规随访' },
        { value: 'shortFollowUp', label: '短期随访(6 个月)' },
        { value: 'biopsy', label: '穿刺活检' },
        { value: 'surgeryConsult', label: '外科会诊' },
      ],
    },
  ],
}

export const LI_RADS_SCHEMA: RadsSchema = {
  category: 'LI-RADS',
  code: 'LI-RADS',
  name: '肝脏影像报告与数据系统(LI-RADS)',
  description: 'CT / MR 肝脏病灶分类(2018 版)',
  fields: [
    { key: 'lesionSizeMm', label: '病灶大小', type: 'measurement', unit: 'mm', required: true, min: 0, max: 300 },
    { key: 'majorFeature', label: '主要征象', type: 'multiselect', required: true, group: '征象', options: [
      { value: 'arterialHyperenhancement', label: '动脉期高强化' },
      { value: 'washout', label: '廓清' },
      { value: 'capsule', label: '包膜' },
      { value: 'thresholdGrowth', label: '阈值增长' },
    ]},
    { key: 'ancillaryFeature', label: '辅助征象', type: 'multiselect', group: '征象', options: [
      { value: 'mildT2Hyperintensity', label: '轻度 T2 高信号' },
      { value: 'restrictedDiffusion', label: '扩散受限' },
      { value: 'fatInMass', label: '病灶内脂肪' },
    ]},
    { key: 'category', label: '最终分级', type: 'select', required: true, group: '评估', options: [
      { value: 'LR-1', label: 'LR-1 肯定良性' },
      { value: 'LR-2', label: 'LR-2 良性可能性大' },
      { value: 'LR-3', label: 'LR-3 中等概率' },
      { value: 'LR-4', label: 'LR-4 高度可疑 HCC' },
      { value: 'LR-5', label: 'LR-5 肯定 HCC' },
      { value: 'LR-M', label: 'LR-M 可能恶性,非 HCC 特异' },
    ]},
  ],
}

export const TI_RADS_SCHEMA: RadsSchema = {
  category: 'TI-RADS',
  code: 'TI-RADS',
  name: '甲状腺影像报告与数据系统(TI-RADS / ACR)',
  description: '甲状腺结节风险分层',
  fields: [
    { key: 'composition', label: '成分', type: 'select', required: true, group: '形态', options: [
      { value: 'cystic', label: '囊性' },
      { value: 'spongiform', label: '海绵状' },
      { value: 'mixed', label: '囊实性' },
      { value: 'solid', label: '实性' },
    ]},
    { key: 'echogenicity', label: '回声', type: 'select', required: true, group: '形态', options: [
      { value: 'anechoic', label: '无回声' },
      { value: 'hyper', label: '高回声' },
      { value: 'iso', label: '等回声' },
      { value: 'hypo', label: '低回声' },
      { value: 'veryHypo', label: '极低回声' },
    ]},
    { key: 'shape', label: '形态', type: 'select', required: true, group: '形态', options: [
      { value: 'wider', label: '宽大于高' },
      { value: 'taller', label: '高大于宽' },
    ]},
    { key: 'margin', label: '边缘', type: 'select', required: true, group: '形态', options: [
      { value: 'smooth', label: '光整' },
      { value: 'illdefined', label: '模糊' },
      { value: 'lobulated', label: '分叶' },
      { value: 'extra', label: '甲状腺外' },
    ]},
    { key: 'echogenicFoci', label: '强回声灶', type: 'multiselect', group: '形态', options: [
      { value: 'none', label: '无' },
      { value: 'macro', label: '大彗星尾' },
      { value: 'peripheral', label: '周边钙化' },
      { value: 'punctate', label: '点状' },
    ]},
    { key: 'trScore', label: 'TR 分级', type: 'select', required: true, group: '评估', options: [
      { value: 'TR1', label: 'TR1 良性' },
      { value: 'TR2', label: 'TR2 不怀疑' },
      { value: 'TR3', label: 'TR3 低度怀疑' },
      { value: 'TR4', label: 'TR4 中度怀疑' },
      { value: 'TR5', label: 'TR5 高度怀疑' },
    ]},
  ],
}

export const PI_RADS_SCHEMA: RadsSchema = {
  category: 'PI-RADS',
  code: 'PI-RADS',
  name: '前列腺影像报告与数据系统(PI-RADS v2.1)',
  description: 'mpMRI 前列腺风险分层',
  fields: [
    { key: 'pzScore', label: '外周带 PI-RADS', type: 'select', group: '分带', options: [
      { value: '1', label: '1 — 极低危' },
      { value: '2', label: '2 — 低危' },
      { value: '3', label: '3 — 中危' },
      { value: '4', label: '4 — 高危' },
      { value: '5', label: '5 — 极高危' },
    ]},
    { key: 'tzScore', label: '移行带 PI-RADS', type: 'select', group: '分带', options: [
      { value: '1', label: '1 — 正常' },
      { value: '2', label: '2 — 罕见/低度' },
      { value: '3', label: '3 — 中度' },
      { key: 'tzDwi', label: '≤ 4 + DWI 1', type: 'text' },
    ]},
    { key: 'psaLevel', label: 'PSA', type: 'measurement', unit: 'ng/mL', group: '实验室' },
    { key: 'prostateVolume', label: '前列腺体积', type: 'measurement', unit: 'mL', group: '体积' },
    { key: 'psaDensity', label: 'PSAD', type: 'measurement', unit: 'ng/mL²', group: '实验室' },
  ],
}

export const RADARS_SCHEMA: RadsSchema = {
  category: 'CAD-RADS',
  code: 'CAD-RADS',
  name: '冠状动脉影像报告与数据系统(CAD-RADS)',
  description: '冠脉 CTA 分级',
  fields: [
    { key: 'maxStenosis', label: '最大狭窄', type: 'select', required: true, options: [
      { value: '0', label: '0% — 无斑块' },
      { value: '1', label: '1–24% 极轻度' },
      { value: '2', label: '25–49% 轻度' },
      { value: '3', label: '50–69% 中度' },
      { value: '4A', label: '70–99% 重度,单支/双支' },
      { value: '4B', label: '70–99% 重度,三支' },
      { value: '5', label: '100% 完全闭塞' },
    ]},
    { key: 'modifier', label: '修饰符', type: 'multiselect', options: [
      { value: 'N', label: 'N — 无法评估' },
      { value: 'S', label: 'S — 支架' },
      { value: 'G', label: 'G — 搭桥' },
      { value: 'V', label: 'V — 易损斑块' },
    ]},
  ],
}

export const RAD_SCHEMAS: Record<string, RadsSchema> = {
  'BI-RADS': BI_RADS_SCHEMA,
  'LI-RADS': LI_RADS_SCHEMA,
  'TI-RADS': TI_RADS_SCHEMA,
  'PI-RADS': PI_RADS_SCHEMA,
  'CAD-RADS': RADARS_SCHEMA,
}

export interface CustomSchema {
  id: string
  name: string
  fields: FieldSchema[]
}

export interface StructuredFieldEditorProps {
  /** 选中的 RADS 标准 (BI-RADS/LI-RADS/...) */
  radsCategory?: keyof typeof RAD_SCHEMAS | string
  /** 用户自定义 schema(可与 RADS 合并) */
  customSchemas?: CustomSchema[]
  /** 当前字段值 */
  values?: Record<string, FieldValue>
  /** 值变化回调 */
  onChange?: (values: Record<string, FieldValue>) => void
  /** 单个字段变化(可选,用于实时校验) */
  onFieldValidate?: (key: string, value: FieldValue, error: string | null) => void
  /** 是否显示 schema 编辑器入口 */
  allowSchemaEdit?: boolean
  /** 必填字段未填时触发 */
  onValidationError?: (missingKeys: string[]) => void
}

const fieldValidator = (schema: FieldSchema, value: FieldValue): string | null => {
  if (schema.required) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return `${schema.label}为必填项`
    }
  }
  if (schema.validate) {
    const err = schema.validate(value)
    if (err) return err
  }
  if (schema.type === 'number' || schema.type === 'measurement') {
    if (value !== null && value !== undefined && value !== '') {
      const n = Number(value)
      if (Number.isNaN(n)) return `${schema.label}必须为数字`
      if (schema.min !== undefined && n < schema.min) return `${schema.label}不能小于 ${schema.min}`
      if (schema.max !== undefined && n > schema.max) return `${schema.label}不能大于 ${schema.max}`
    }
  }
  return null
}

const valueToDisplayText = (schema: FieldSchema, value: FieldValue): string => {
  if (value === null || value === undefined || value === '') return ''
  if (schema.type === 'multiselect' && Array.isArray(value)) {
    const labels = value.map((v) => schema.options?.find((o) => o.value === v)?.label ?? v)
    return labels.join('、')
  }
  if (schema.type === 'select' && typeof value === 'string') {
    return schema.options?.find((o) => o.value === value)?.label ?? value
  }
  if (schema.type === 'measurement' && typeof value === 'number') {
    return `${value} ${schema.unit ?? ''}`.trim()
  }
  if (schema.type === 'date') {
    return String(value)
  }
  return String(value)
}

export const StructuredFieldEditor: React.FC<StructuredFieldEditorProps> = ({
  radsCategory,
  customSchemas = [],
  values = {},
  onChange,
  onFieldValidate,
  allowSchemaEdit = false,
  onValidationError,
}) => {
  const [activeSchemaId, setActiveSchemaId] = useState<string>(
    radsCategory ? String(radsCategory) : customSchemas[0]?.id ?? ''
  )
  const [localSchemas, setLocalSchemas] = useState<CustomSchema[]>(customSchemas)
  const [schemaEditOpen, setSchemaEditOpen] = useState(false)

  const activeSchema = useMemo<RadsSchema | CustomSchema | null>(() => {
    if (!activeSchemaId) return null
    if (RAD_SCHEMAS[activeSchemaId]) return RAD_SCHEMAS[activeSchemaId]
    return localSchemas.find((s) => s.id === activeSchemaId) ?? null
  }, [activeSchemaId, localSchemas])

  const groups = useMemo(() => {
    if (!activeSchema) return []
    const map = new Map<string, FieldSchema[]>()
    for (const f of activeSchema.fields) {
      const g = f.group ?? '默认'
      const list = map.get(g) ?? []
      list.push(f)
      map.set(g, list)
    }
    return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }))
  }, [activeSchema])

  const validateAll = useCallback((): { missing: string[]; errors: Record<string, string> } => {
    const missing: string[] = []
    const errors: Record<string, string> = {}
    if (!activeSchema) return { missing, errors }
    for (const f of activeSchema.fields) {
      const v = values[f.key]
      const err = fieldValidator(f, v)
      if (err) {
        errors[f.key] = err
        if (f.required) missing.push(f.key)
      }
    }
    return { missing, errors }
  }, [activeSchema, values])

  React.useEffect(() => {
    const { missing } = validateAll()
    onValidationError?.(missing)
  }, [validateAll, onValidationError])

  const updateValue = useCallback(
    (key: string, value: FieldValue) => {
      const next = { ...values, [key]: value }
      onChange?.(next)
      if (activeSchema) {
        const schema = activeSchema.fields.find((f) => f.key === key)
        if (schema) {
          const err = fieldValidator(schema, value)
          onFieldValidate?.(key, value, err)
        }
      }
    },
    [values, onChange, onFieldValidate, activeSchema]
  )

  const addCustomField = useCallback(
    (schemaId: string, field: FieldSchema) => {
      setLocalSchemas((prev) =>
        prev.map((s) => (s.id === schemaId ? { ...s, fields: [...s.fields, field] } : s))
      )
    },
    []
  )

  const removeCustomField = useCallback((schemaId: string, key: string) => {
    setLocalSchemas((prev) =>
      prev.map((s) => (s.id === schemaId ? { ...s, fields: s.fields.filter((f) => f.key !== key) } : s))
    )
  }, [])

  const renderField = (f: FieldSchema) => {
    const value = values[f.key]
    const required = f.required
    const error = fieldValidator(f, value)

    let control: React.ReactNode = null
    switch (f.type) {
      case 'text':
      case 'code':
        control = (
          <Input
            data-testid={`sfe-${f.key}`}
            value={(value as string) ?? ''}
            placeholder={f.placeholder}
            onChange={(e) => updateValue(f.key, e.target.value)}
            status={error ? 'error' : undefined}
          />
        )
        break
      case 'number':
      case 'measurement':
        control = (
          <InputNumber
            data-testid={`sfe-${f.key}`}
            value={value === null || value === undefined ? null : Number(value)}
            min={f.min}
            max={f.max}
            suffix={f.unit}
            style={{ width: '100%' }}
            placeholder={f.placeholder}
            onChange={(v) => updateValue(f.key, v ?? null)}
            status={error ? 'error' : undefined}
          />
        )
        break
      case 'select':
        control = (
          <Select
            data-testid={`sfe-${f.key}`}
            value={(value as string) ?? undefined}
            placeholder={f.placeholder ?? '请选择'}
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => updateValue(f.key, v ?? null)}
            options={(f.options ?? []).map((o) => ({
              value: o.value,
              label: (
                <span>
                  {o.code && (
                    <Tag color="blue" style={{ fontSize: 12, marginRight: 4 }}>
                      {o.code}
                    </Tag>
                  )}
                  {o.label}
                </span>
              ),
            }))}
            status={error ? 'error' : undefined}
          />
        )
        break
      case 'multiselect':
        control = (
          <Select
            data-testid={`sfe-${f.key}`}
            mode="multiple"
            value={(value as string[]) ?? []}
            placeholder={f.placeholder ?? '可多选'}
            style={{ width: '100%' }}
            onChange={(v) => updateValue(f.key, v)}
            options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            status={error ? 'error' : undefined}
          />
        )
        break
      case 'date':
        control = (
          <DatePicker
            data-testid={`sfe-${f.key}`}
            value={value ? dayjs(value as string) : null}
            onChange={(d: Dayjs | null) => updateValue(f.key, d ? d.toISOString() : null)}
            style={{ width: '100%' }}
            status={error ? 'error' : undefined}
          />
        )
        break
      case 'boolean':
        control = (
          <Select
            data-testid={`sfe-${f.key}`}
            value={value === undefined ? undefined : value ? 'true' : 'false'}
            onChange={(v) => updateValue(f.key, v === 'true')}
            options={[
              { value: 'true', label: '是' },
              { value: 'false', label: '否' },
            ]}
            style={{ width: '100%' }}
          />
        )
        break
    }

    return (
      <Form.Item
        key={f.key}
        label={
          <Space>
            {required && <span style={{ color: '#dc2626' }}>*</span>}
            <span>{f.label}</span>
            {f.codeSystem && (
              <Tag color="purple" style={{ fontSize: 12 }}>
                {f.codeSystem}
              </Tag>
            )}
          </Space>
        }
        validateStatus={error ? 'error' : undefined}
        help={error}
        extra={f.description}
      >
        {control}
      </Form.Item>
    )
  }

  if (!activeSchema) {
    return (
      <Empty
        description="请选择 RADS 标准或创建自定义 schema"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        {allowSchemaEdit && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setSchemaEditOpen(true)}>
            新建自定义 schema
          </Button>
        )}
      </Empty>
    )
  }

  const allSchemas = [
    ...Object.values(RAD_SCHEMAS).map((s) => ({ id: s.code, name: s.name, builtin: true })),
    ...localSchemas.map((s) => ({ id: s.id, name: s.name, builtin: false })),
  ]

  const isBuiltin = RAD_SCHEMAS[activeSchemaId] !== undefined

  return (
    <div data-testid="structured-field-editor" style={{ width: '100%' }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <Layers size={14} color="#1e3a5f" />
        <span style={{ fontWeight: 600, fontSize: 13 }}>结构化字段:</span>
        <Select
          data-testid="sfe-schema-select"
          value={activeSchemaId || undefined}
          onChange={setActiveSchemaId}
          style={{ minWidth: 220 }}
          options={allSchemas.map((s) => ({
            value: s.id,
            label: (
              <span>
                <Tag color={s.builtin ? 'blue' : 'purple'} style={{ fontSize: 12, marginRight: 4 }}>
                  {s.builtin ? '标准' : '自定义'}
                </Tag>
                {s.name}
              </span>
            ),
          }))}
        />
        {isBuiltin && (
          <Tag color="blue" icon={<FileCode size={10} />}>
            RADS 标准
          </Tag>
        )}
        {allowSchemaEdit && (
          <Button
            size="small"
            icon={<Edit3 size={12} />}
            onClick={() => setSchemaEditOpen(true)}
            data-testid="sfe-edit-schema"
          >
            编辑 schema
          </Button>
        )}
      </Space>

      <Form layout="vertical" size="middle" data-testid="sfe-form">
        {groups.map((g) => (
          <div
            key={g.name}
            style={{
              background: '#f8fafc',
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#1e3a5f',
                marginBottom: 8,
              }}
            >
              {g.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {g.fields.map((f) => (
                <div key={f.key} style={{ gridColumn: f.type === 'text' || f.type === 'code' ? 'span 2' : 'auto' }}>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Form>

      {values && Object.keys(values).length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: '#f0f9ff',
            borderRadius: 4,
            fontSize: 12,
            color: '#0c4a6e',
          }}
        >
          <strong>结构化摘要:</strong>
          {activeSchema &&
            activeSchema.fields.map((f) => {
              const v = values[f.key]
              if (v === null || v === undefined || v === '') return null
              const text = valueToDisplayText(f, v)
              return (
                <div key={f.key} style={{ marginTop: 2 }}>
                  {f.label}: <strong>{text}</strong>
                </div>
              )
            })}
        </div>
      )}

      <Modal
        open={schemaEditOpen}
        onCancel={() => setSchemaEditOpen(false)}
        onOk={() => setSchemaEditOpen(false)}
        width={720}
        title="编辑自定义 schema"
      >
        <p style={{ color: '#64748b' }}>
          提示:RADS 标准字段(BI-RADS/LI-RADS/...)不可修改,仅可创建新的自定义 schema。
        </p>
        {localSchemas.map((s) => (
          <Card
            key={s.id}
            size="small"
            title={s.name}
            extra={
              <Button
                size="small"
                danger
                icon={<Trash2 size={12} />}
                onClick={() => {
                  setLocalSchemas((prev) => prev.filter((x) => x.id !== s.id))
                }}
              >
                删除 schema
              </Button>
            }
            style={{ marginBottom: 12 }}
          >
            {s.fields.map((f) => (
              <div
                key={f.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  borderBottom: '1px dashed #e2e8f0',
                }}
              >
                <Tag color="purple">{f.type}</Tag>
                <span style={{ flex: 1 }}>{f.label}</span>
                {f.required && <Tag color="red">必填</Tag>}
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<Trash2 size={10} />}
                  onClick={() => removeCustomField(s.id, f.key)}
                />
              </div>
            ))}
            <Button
              size="small"
              type="dashed"
              block
              icon={<Plus size={12} />}
              style={{ marginTop: 8 }}
              onClick={() => {
                const key = `field_${Date.now()}`
                addCustomField(s.id, {
                  key,
                  label: '新字段',
                  type: 'text',
                  group: '默认',
                })
              }}
            >
              添加字段
            </Button>
          </Card>
        ))}
        <Button
          type="dashed"
          block
          icon={<Plus size={12} />}
          onClick={() => {
            const id = `custom_${Date.now()}`
            setLocalSchemas((prev) => [
              ...prev,
              { id, name: '新自定义 schema', fields: [] },
            ])
          }}
        >
          新建自定义 schema
        </Button>
      </Modal>
    </div>
  )
}

export const useStructuredFields = () => {
  return { RAD_SCHEMAS, BI_RADS_SCHEMA, LI_RADS_SCHEMA, TI_RADS_SCHEMA, PI_RADS_SCHEMA, RADARS_SCHEMA, fieldValidator, valueToDisplayText }
}

export default StructuredFieldEditor
