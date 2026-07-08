import { useState, useMemo, useCallback, type ReactNode } from 'react'
import {
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Switch,
  Radio,
  Checkbox,
  InputNumber,
  Upload,
  ColorPicker,
  Button,
  Space,
  Row,
  Col,
} from 'antd'
import type { Rule } from 'antd/es/form'
import { UploadOutlined } from '@ant-design/icons'

type FieldType =
  | 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'dateRange' | 'time'
  | 'switch' | 'radio' | 'checkbox' | 'textarea' | 'email' | 'phone' | 'url'
  | 'color' | 'file' | 'json'

type LayoutType = 'single' | '2-column' | '3-column'

interface SelectOption {
  label: string
  value: string | number
}

interface FieldDependency {
  field: string
  value: unknown
}

interface FieldValidation {
  required?: boolean
  min?: number
  max?: number
  pattern?: string
  custom?: (value: unknown, formValues: Record<string, unknown>) => boolean | string
}

interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  defaultValue?: unknown
  options?: SelectOption[]
  validation?: FieldValidation
  dependency?: FieldDependency
  span?: number
  props?: Record<string, unknown>
}

export interface FormBuilderProps {
  fields: FieldDefinition[]
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>
  initialValues?: Record<string, unknown>
  layout?: LayoutType
  submitLabel?: string
  loading?: boolean
}

const { TextArea } = Input

const layoutMap: Record<LayoutType, number> = {
  single: 1,
  '2-column': 2,
  '3-column': 3,
}

function isFieldVisible(field: FieldDefinition, formValues: Record<string, unknown>): boolean {
  if (!field.dependency) return true
  return formValues[field.dependency.field] === field.dependency.value
}

function buildRules(field: FieldDefinition): Rule[] {
  const rules: Rule[] = []
  const v = field.validation
  if (!v) return rules
  if (v.required) rules.push({ required: true, message: `${field.label}为必填项` })
  if (v.min !== undefined) {
    if (field.type === 'number' || field.type === 'text') {
      rules.push({ type: field.type === 'number' ? 'number' : 'string', min: v.min, message: `最小值为${v.min}` })
    }
  }
  if (v.max !== undefined) {
    if (field.type === 'number' || field.type === 'text') {
      rules.push({ type: field.type === 'number' ? 'number' : 'string', max: v.max, message: `最大值为${v.max}` })
    }
  }
  if (v.pattern) rules.push({ pattern: new RegExp(v.pattern), message: `格式不正确` })
  if (v.custom) {
    rules.push({
      validator: (_, value) => {
        const result = v.custom!(value, {})
        if (typeof result === 'string') return Promise.reject(new Error(result))
        return result ? Promise.resolve() : Promise.reject(new Error('校验失败'))
      },
    })
  }
  return rules
}

function renderField(field: FieldDefinition): ReactNode {
  const placeholder = field.placeholder
  switch (field.type) {
    case 'text':
      return <Input placeholder={placeholder} {...field.props} />
    case 'number':
      return <InputNumber style={{ width: '100%' }} placeholder={placeholder} {...field.props} />
    case 'select':
      return (
        <Select placeholder={placeholder} {...field.props}>
          {field.options?.map((o) => (
            <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
          ))}
        </Select>
      )
    case 'multiSelect':
      return (
        <Select mode="multiple" placeholder={placeholder} {...field.props}>
          {field.options?.map((o) => (
            <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
          ))}
        </Select>
      )
    case 'date':
      return <DatePicker style={{ width: '100%' }} placeholder={placeholder} {...field.props} />
    case 'dateRange':
      return <DatePicker.RangePicker style={{ width: '100%' }} {...field.props} />
    case 'time':
      return <TimePicker style={{ width: '100%' }} {...field.props} />
    case 'switch':
      return <Switch {...field.props} />
    case 'radio':
      return (
        <Radio.Group {...field.props}>
          {field.options?.map((o) => (
            <Radio key={o.value} value={o.value}>{o.label}</Radio>
          ))}
        </Radio.Group>
      )
    case 'checkbox':
      return <Checkbox {...field.props} />
    case 'textarea':
      return <TextArea rows={4} placeholder={placeholder} {...field.props} />
    case 'email':
      return <Input type="email" placeholder={placeholder} {...field.props} />
    case 'phone':
      return <Input type="tel" placeholder={placeholder} {...field.props} />
    case 'url':
      return <Input type="url" placeholder={placeholder} {...field.props} />
    case 'color':
      return <ColorPicker {...field.props} />
    case 'file':
      return (
        <Upload {...field.props} beforeUpload={() => false}>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      )
    case 'json':
      return <TextArea rows={6} placeholder="输入JSON" {...field.props} />
    default:
      return <Input placeholder={placeholder} {...field.props} />
  }
}

export function FormBuilder({
  fields,
  onSubmit,
  initialValues = {},
  layout = '2-column',
  submitLabel = '提交',
  loading = false,
}: FormBuilderProps) {
  const [form] = Form.useForm<Record<string, unknown>>()
  const [formValues, setFormValues] = useState<Record<string, unknown>>(initialValues)
  void formValues

  const cols = layoutMap[layout]
  const visibleFields = useMemo(
    () => fields.filter((f) => isFieldVisible(f, formValues)),
    [fields, formValues],
  )

  const handleValuesChange = useCallback((changedValues: Record<string, unknown>) => {
    setFormValues((prev) => ({ ...prev, ...changedValues }))
  }, [])

  const handleFinish = useCallback(async (values: Record<string, unknown>) => {
    await onSubmit(values)
  }, [onSubmit])

  const isFullWidth = (type: FieldType): boolean =>
    ['textarea', 'json', 'file', 'dateRange'].includes(type)

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onValuesChange={handleValuesChange}
      onFinish={handleFinish}
      style={{ width: '100%' }}
    >
      <Row gutter={[16, 0]}>
        {visibleFields.map((field) => {
          const span = field.span ?? (isFullWidth(field.type) ? 24 : Math.floor(24 / cols))
          return (
            <Col key={field.name} span={span}>
              <Form.Item
                name={field.name}
                label={field.label}
                rules={buildRules(field)}
                valuePropName={field.type === 'switch' ? 'checked' : field.type === 'checkbox' ? 'checked' : 'value'}
              >
                {renderField(field)}
              </Form.Item>
            </Col>
          )
        })}
      </Row>
      <Form.Item style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {submitLabel}
          </Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default FormBuilder
