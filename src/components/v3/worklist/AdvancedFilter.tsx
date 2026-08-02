/**
 * G005 放射RIS系统 v3.0.1 - 高级筛选抽屉 (≥8 维)
 * 对标东软 / 卫宁 / 英飞达 PACS
 */
import React, { useState, useCallback } from 'react'
import { Drawer, Form, Select, DatePicker, Input, Button, Space, Tag, Divider, Row, Col } from 'antd'
import { Filter, RotateCcw, Check } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

export interface AdvancedFilterValue {
  priority?: string[]
  modality?: string[]
  status?: string[]
  dateRange?: [string, string]
  doctor?: string[]
  room?: string[]
  source?: string[]
  keyword?: string
  patientName?: string
  ageMin?: number
  ageMax?: number
  isStat?: boolean
  isCritical?: boolean
  isPregnant?: boolean
}

export interface AdvancedFilterProps {
  open: boolean
  onClose: () => void
  onApply: (value: AdvancedFilterValue) => void
  onReset?: () => void
  initial?: AdvancedFilterValue
  doctors?: { id: string; name: string }[]
  rooms?: { id: string; name: string }[]
}

const PRIORITY_OPTIONS = [
  { value: 'routine', label: '常规' },
  { value: 'urgent', label: '加急' },
  { value: 'emergency', label: '急诊' },
  { value: 'stat', label: '特诊' },
]

const MODALITY_OPTIONS = [
  { value: 'CT', label: 'CT' },
  { value: 'MR', label: 'MR' },
  { value: 'DR', label: 'DR' },
  { value: 'CR', label: 'CR' },
  { value: 'DSA', label: 'DSA' },
  { value: 'US', label: '超声' },
  { value: 'MG', label: '钼靶' },
  { value: 'PET', label: 'PET' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: '待开始' },
  { value: 'inProgress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'urgent', label: '加急' },
  { value: 'critical', label: '危急值' },
]

const SOURCE_OPTIONS = [
  { value: 'outpatient', label: '门诊' },
  { value: 'inpatient', label: '住院' },
  { value: 'emergency', label: '急诊' },
  { value: 'physical', label: '体检' },
  { value: 'regional', label: '区域协同' },
]

export const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  open,
  onClose,
  onApply,
  onReset,
  initial,
  doctors = [],
  rooms = [],
}) => {
  const [form] = Form.useForm()
  const [value, setValue] = useState<AdvancedFilterValue>(initial ?? {})

  const handleApply = useCallback(() => {
    onApply(value)
    onClose()
  }, [value, onApply, onClose])

  const handleReset = useCallback(() => {
    form.resetFields()
    setValue({})
    onReset?.()
  }, [form, onReset])

  const update = (patch: Partial<AdvancedFilterValue>) => {
    setValue((v) => ({ ...v, ...patch }))
  }

  return (
    <Drawer
      data-testid="advanced-filter"
      title={
        <Space>
          <Filter size={16} />
          <span>高级筛选</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={560}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button icon={<RotateCcw size={12} />} onClick={handleReset} data-testid="filter-reset">
            重置
          </Button>
          <Button type="primary" icon={<Check size={12} />} onClick={handleApply} data-testid="filter-apply">
            应用
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="关键字">
              <Input
                data-testid="filter-keyword"
                placeholder="患者/检查 ID/姓名"
                value={value.keyword}
                onChange={(e) => update({ keyword: e.target.value })}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="患者姓名">
              <Input
                placeholder="模糊匹配"
                value={value.patientName}
                onChange={(e) => update({ patientName: e.target.value })}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0' }}>分类</Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="优先级">
              <Select
                data-testid="filter-priority"
                mode="multiple"
                placeholder="可多选"
                value={value.priority}
                onChange={(v) => update({ priority: v })}
                options={PRIORITY_OPTIONS}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="设备类型">
              <Select
                mode="multiple"
                placeholder="可多选"
                value={value.modality}
                onChange={(v) => update({ modality: v })}
                options={MODALITY_OPTIONS}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="状态">
              <Select
                mode="multiple"
                placeholder="可多选"
                value={value.status}
                onChange={(v) => update({ status: v })}
                options={STATUS_OPTIONS}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="来源">
              <Select
                mode="multiple"
                placeholder="可多选"
                value={value.source}
                onChange={(v) => update({ source: v })}
                options={SOURCE_OPTIONS}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0' }}>人员 / 地点</Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="申请医生">
              <Select
                mode="multiple"
                placeholder="可多选"
                value={value.doctor}
                onChange={(v) => update({ doctor: v })}
                options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                allowClear
                showSearch
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="检查室">
              <Select
                mode="multiple"
                placeholder="可多选"
                value={value.room}
                onChange={(v) => update({ room: v })}
                options={rooms.map((r) => ({ value: r.id, label: r.name }))}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0' }}>时间 / 范围</Divider>

        <Form.Item label="检查日期范围">
          <RangePicker
            data-testid="filter-date"
            style={{ width: '100%' }}
            value={
              value.dateRange
                ? ([dayjs(value.dateRange[0]), dayjs(value.dateRange[1])] as [Dayjs, Dayjs])
                : null
            }
            onChange={(d) =>
              update({
                dateRange: d ? ([d[0]!.toISOString(), d[1]!.toISOString()] as [string, string]) : undefined,
              })
            }
            presets={[
              { label: '今天', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
              { label: '本周', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
              { label: '本月', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
              { label: '近 30 天', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="年龄(岁)">
              <Input.Group compact>
                <Input
                  style={{ width: '50%' }}
                  type="number"
                  placeholder="最小"
                  value={value.ageMin}
                  onChange={(e) => update({ ageMin: e.target.value ? Number(e.target.value) : undefined })}
                />
                <Input
                  style={{ width: '50%' }}
                  type="number"
                  placeholder="最大"
                  value={value.ageMax}
                  onChange={(e) => update({ ageMax: e.target.value ? Number(e.target.value) : undefined })}
                />
              </Input.Group>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="特殊标记">
              <Space orientation="vertical" size={4}>
                <Tag.CheckableTag checked={!!value.isStat} onChange={(c) => update({ isStat: c })}>
                  特诊床边
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={!!value.isCritical} onChange={(c) => update({ isCritical: c })}>
                  危急值
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={!!value.isPregnant} onChange={(c) => update({ isPregnant: c })}>
                  孕妇/哺乳
                </Tag.CheckableTag>
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  )
}

export default AdvancedFilter
