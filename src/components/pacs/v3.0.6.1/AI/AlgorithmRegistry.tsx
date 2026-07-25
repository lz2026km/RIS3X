/**
 * G005 放射RIS系统 v3.0.6.1 - AI 算法注册中心
 */
import React, { useState } from 'react'
import { Card, Table, Tag, Space, Button, Input, Modal, Form, Select, InputNumber, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Code, GitBranch } from 'lucide-react'

export interface AIAlgorithm {
  id: string
  name: string
  version: string
  vendor: string
  task: 'DETECTION' | 'SEGMENTATION' | 'CLASSIFICATION' | 'REGRESSION'
  modality: string
  bodyPart: string
  accuracy: number
  recall: number
  precision: number
  registeredAt: string
  status: 'PROD' | 'STAGING' | 'DEPRECATED'
}

const MOCK: AIAlgorithm[] = [
  { id: 'ALG001', name: 'CT-Lung-Nodule', version: 'v3.2', vendor: 'Internal', task: 'DETECTION', modality: 'CT', bodyPart: '胸部', accuracy: 0.94, recall: 0.91, precision: 0.89, registeredAt: '2024-01-12', status: 'PROD' },
  { id: 'ALG002', name: 'MR-Stroke-Triage', version: 'v2.1', vendor: 'Siemens', task: 'CLASSIFICATION', modality: 'MR', bodyPart: '头颅', accuracy: 0.91, recall: 0.88, precision: 0.92, registeredAt: '2024-02-08', status: 'PROD' },
  { id: 'ALG003', name: 'Mammo-BIRADS', version: 'v5.0', vendor: 'GE', task: 'CLASSIFICATION', modality: 'MG', bodyPart: '乳腺', accuracy: 0.88, recall: 0.85, precision: 0.90, registeredAt: '2024-03-15', status: 'PROD' },
  { id: 'ALG004', name: 'CT-Pneumothorax', version: 'v1.4', vendor: 'Philips', task: 'DETECTION', modality: 'CT', bodyPart: '胸部', accuracy: 0.96, recall: 0.93, precision: 0.94, registeredAt: '2024-04-22', status: 'PROD' },
  { id: 'ALG005', name: 'MR-Cardiac-Seg', version: 'v2.5', vendor: 'Internal', task: 'SEGMENTATION', modality: 'MR', bodyPart: '心脏', accuracy: 0.92, recall: 0.90, precision: 0.93, registeredAt: '2024-05-10', status: 'STAGING' },
]

export interface AlgorithmRegistryProps {
  algorithms?: AIAlgorithm[]
}

export const AlgorithmRegistry: React.FC<AlgorithmRegistryProps> = ({ algorithms = MOCK }) => {
  const [keyword, setKeyword] = useState('')
  const [regOpen, setRegOpen] = useState(false)
  const filtered = algorithms.filter((a) => a.name.toLowerCase().includes(keyword.toLowerCase()) || a.vendor.toLowerCase().includes(keyword.toLowerCase()))

  const columns: ColumnsType<AIAlgorithm> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '名称', dataIndex: 'name', render: (n: string, r) => <Space><Code size={12} />{n}<Tag>v{r.version}</Tag></Space> },
    { title: '厂商', dataIndex: 'vendor', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '任务', dataIndex: 'task', width: 110, render: (t: string) => <Tag>{t}</Tag> },
    { title: '设备/部位', width: 130, render: (_, r) => <Tag color="purple">{r.modality} {r.bodyPart}</Tag> },
    { title: '准确率', dataIndex: 'accuracy', width: 80, render: (v: number) => `${(v * 100).toFixed(0)}%` },
    { title: '召回', dataIndex: 'recall', width: 70, render: (v: number) => `${(v * 100).toFixed(0)}%` },
    { title: '精度', dataIndex: 'precision', width: 70, render: (v: number) => `${(v * 100).toFixed(0)}%` },
    { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={s === 'PROD' ? 'green' : s === 'STAGING' ? 'blue' : 'default'}>{s}</Tag> },
  ]

  return (
    <div data-testid="algorithm-registry">
      <Card
        size="small"
        title={<Space><GitBranch size={14} />算法注册中心</Space>}
        extra={
          <Space>
            <Input size="small" prefix={<Search size={12} />} placeholder="搜索" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setRegOpen(true)}>注册</Button>
          </Space>
        }
      >
        <Table<AIAlgorithm>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无匹配算法" /> }}
        />
      </Card>

      <Modal
        title="注册新算法"
        open={regOpen}
        onCancel={() => setRegOpen(false)}
        onOk={() => setRegOpen(false)}
        okText="注册"
        cancelText="取消"
      >
        <Form layout="vertical" size="small">
          <Form.Item label="名称" required><Input /></Form.Item>
          <Form.Item label="版本"><Input placeholder="v1.0" /></Form.Item>
          <Form.Item label="厂商">
            <Select options={[{ value: 'Internal', label: '自研' }, { value: 'GE', label: 'GE' }, { value: 'Siemens', label: 'Siemens' }, { value: 'Philips', label: 'Philips' }]} />
          </Form.Item>
          <Form.Item label="任务类型">
            <Select options={[{ value: 'DETECTION', label: '检测' }, { value: 'SEGMENTATION', label: '分割' }, { value: 'CLASSIFICATION', label: '分类' }]} />
          </Form.Item>
          <Form.Item label="准确率"><InputNumber min={0} max={1} step={0.01} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AlgorithmRegistry