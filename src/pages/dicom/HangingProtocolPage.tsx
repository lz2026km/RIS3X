/**
 * G005 RIS v3.0.6.11-60 - Auto-hanging 自动布局协议管理 (对标 GE/Siemens/Fujifilm)
 * 协议列表 + 新建/编辑 (布局网格可视化) + 匹配测试 (选检查→预览布局)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Radio, Switch, Tag, Space, message, Popconfirm, Typography, Alert,
} from 'antd'
import { Plus, RefreshCw, LayoutGrid, Search, Sparkles } from 'lucide-react'
import { hangingApi, type HangingProtocol, type HangingMatchResult, type HangingLayout } from '../../services/api/hangingApi'
import { usePagination } from '../../hooks/usePagination'

const { Title, Text } = Typography

const MODALITIES = ['CT', 'MR', 'DR', 'DX', 'MG', 'US', 'NM', 'PT', 'XA']
const BODY_PARTS = ['HEAD', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'NECK', 'KNEE', 'CARDIAC', 'BREAST', 'EXTREMITY', 'WHOLE BODY']
const LAYOUT_PRESETS: { label: string; layout: HangingLayout }[] = [
  { label: '1 × 1', layout: { rows: 1, cols: 1, seriesOrder: [] } },
  { label: '1 × 2', layout: { rows: 1, cols: 2, seriesOrder: [] } },
  { label: '2 × 2', layout: { rows: 2, cols: 2, seriesOrder: [] } },
  { label: '2 × 3', layout: { rows: 2, cols: 3, seriesOrder: [] } },
]

function GridPreview({ rows, cols, cells }: { rows: number; cols: number; cells?: (string | undefined)[] }) {
  const items = cells ?? Array.from({ length: rows * cols }, () => undefined)
  return (
    <div
      data-testid="hanging-grid-preview"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 6,
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: 8,
        background: '#fafafa',
        minWidth: 260,
      }}
    >
      {items.map((label, i) => (
        <div
          key={i}
          style={{
            border: `1px dashed ${label ? '#2563eb' : '#d9d9d9'}`,
            background: label ? '#e6f4ff' : '#fff',
            borderRadius: 6,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: label ? '#2563eb' : '#bfbfbf',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 4px',
          }}
        >
          {label ?? `视口 ${i + 1}`}
        </div>
      ))}
    </div>
  )
}

const layoutKey = (l: HangingLayout) => `${l.rows}x${l.cols}`

const HangingProtocolPage: React.FC = () => {
  const [protocols, setProtocols] = useState<HangingProtocol[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<HangingProtocol | null>(null)
  const [matchModalOpen, setMatchModalOpen] = useState(false)
  const [matchResult, setMatchResult] = useState<HangingMatchResult | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [form] = Form.useForm()
  const [matchForm] = Form.useForm()
  const { pageData: protocolPageData, pagination: protocolPagination } = usePagination(protocols, 10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hangingApi.list()
      if (res.success) setProtocols(res.data)
      else message.error(res.error?.message || '协议列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = useCallback(() => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ modality: 'CT', bodyPart: 'HEAD', priority: 50, enabled: true, layoutPreset: '1x1' })
    setModalOpen(true)
  }, [form])

  const openEdit = useCallback((p: HangingProtocol) => {
    setEditing(p)
    form.resetFields()
    form.setFieldsValue({
      name: p.name,
      modality: p.modality,
      bodyPart: p.bodyPart,
      priority: p.priority,
      description: p.description,
      enabled: p.enabled,
      layoutPreset: layoutKey(p.layout),
      seriesOrder: (p.layout.seriesOrder ?? []).join(' / '),
    })
    setModalOpen(true)
  }, [form])

  const handleSave = useCallback(async () => {
    const values = await form.validateFields()
    const preset = LAYOUT_PRESETS.find((p) => p.layout.rows === values.layoutRows && p.layout.cols === values.layoutCols)
    const base = preset?.layout ?? { rows: values.layoutRows, cols: values.layoutCols, seriesOrder: [] }
    const seriesOrder = String(values.seriesOrder ?? '')
      .split(/[\/,，、]/)
      .map((s: string) => s.trim())
      .filter(Boolean)
    const payload = {
      name: values.name,
      modality: values.modality,
      bodyPart: values.bodyPart,
      layout: { ...base, seriesOrder } as HangingLayout,
      priority: values.priority ?? 0,
      description: values.description ?? '',
      enabled: values.enabled ?? true,
    }
    const res = editing
      ? await hangingApi.update(editing.id, payload)
      : await hangingApi.create(payload)
    if (res.success) {
      message.success(editing ? '协议已更新' : '协议已创建')
      setModalOpen(false)
      void load()
    } else {
      message.error(res.error?.message || '保存失败')
    }
  }, [form, editing, load])

  const handleDelete = useCallback(async (id: string) => {
    const res = await hangingApi.remove(id)
    if (res.success) {
      message.success('协议已删除')
      void load()
    } else {
      message.error(res.error?.message || '删除失败')
    }
  }, [load])

  const handleMatch = useCallback(async () => {
    const values = await matchForm.validateFields()
    setMatchLoading(true)
    try {
      const res = await hangingApi.match({
        modality: values.matchModality,
        bodyPart: values.matchBodyPart,
        seriesCount: values.matchSeriesCount ?? 0,
        series: String(values.matchSeriesDesc ?? '')
          .split(/[\/,，、]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((description: string, i: number) => ({ description, modality: values.matchModality, seriesNumber: i + 1 })),
      })
      if (res.success) setMatchResult(res.data)
      else message.error(res.error?.message || '匹配失败')
    } finally {
      setMatchLoading(false)
    }
  }, [matchForm])

  const previewCells = useMemo(() => {
    const layout = matchResult?.layout
    if (!layout) return undefined
    return Array.from({ length: layout.rows * layout.cols }, (_, i) => matchResult?.cells[i]?.series ?? (matchResult.cells[i]?.empty ? undefined : undefined))
  }, [matchResult])

  const columns = [
    {
      title: '协议名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, r: HangingProtocol) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.name}</Text>
          {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
        </Space>
      ),
    },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 80, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart', width: 110 },
    {
      title: '布局',
      dataIndex: 'layout',
      key: 'layout',
      width: 160,
      render: (l: HangingLayout) => <Tag icon={<LayoutGrid size={12} />}>{l.rows} × {l.cols}{l.seriesOrder?.length ? ` (${l.seriesOrder.length}序列)` : ''}</Tag>,
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, r: HangingProtocol) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该协议?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <LayoutGrid size={20} color="#2563eb" />
        <Title level={4} style={{ margin: 0 }}>自动布局协议管理</Title>
        <Tag color="geekblue">对标 GE / Siemens / Fujifilm</Tag>
      </Space>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={<Space><RefreshCw size={14} />协议列表</Space>}
        extra={
          <Space>
            <Button icon={<Search size={14} />} onClick={() => setMatchModalOpen(true)}>匹配测试</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新建协议</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={protocolPageData}
          columns={columns}
          size="middle"
          pagination={protocolPagination}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editing ? '编辑悬挂协议' : '新建悬挂协议'}
        open={modalOpen}
        onOk={() => handleSave()}
        onCancel={() => setModalOpen(false)}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ layoutPreset: '1x1' }}>
          <Form.Item name="name" label="协议名称" rules={[{ required: true, message: '请输入协议名称' }]}>
            <Input placeholder="如: CT 头颅 轴位标准" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="modality" label="模态" rules={[{ required: true }]}>
              <Select options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="bodyPart" label="检查部位" rules={[{ required: true }]}>
              <Select options={BODY_PARTS.map((b) => ({ value: b, label: b }))} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <InputNumber min={0} max={999} style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Form.Item label="布局模板" required>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {LAYOUT_PRESETS.map((preset) => (
                <Radio
                  key={layoutKey(preset.layout)}
                  value={layoutKey(preset.layout)}
                  onChange={() => {
                    form.setFieldValue('layoutRows', preset.layout.rows)
                    form.setFieldValue('layoutCols', preset.layout.cols)
                  }}
                  checked={form.getFieldValue('layoutRows') === preset.layout.rows && form.getFieldValue('layoutCols') === preset.layout.cols}
                >
                  <Space direction="vertical" size={4}>
                    <GridPreview rows={preset.layout.rows} cols={preset.layout.cols} />
                    <Text style={{ fontSize: 12 }}>{preset.label}</Text>
                  </Space>
                </Radio>
              ))}
            </div>
          </Form.Item>
          <Form.Item name="layoutRows" hidden><InputNumber /></Form.Item>
          <Form.Item name="layoutCols" hidden><InputNumber /></Form.Item>
          <Form.Item name="seriesOrder" label="序列顺序 (用 / 分隔, 每格对应一个序列)">
            <Input placeholder="如: 轴位-肺窗 / 轴位-纵隔窗 / 冠状位 / 矢状位" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="协议说明" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="匹配测试: 检查 → 布局预览"
        open={matchModalOpen}
        onCancel={() => setMatchModalOpen(false)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        <Form form={matchForm} layout="vertical" initialValues={{ matchModality: 'CT', matchBodyPart: 'CHEST' }}>
          <Space size="large">
            <Form.Item name="matchModality" label="模态" rules={[{ required: true }]}>
              <Select options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="matchBodyPart" label="检查部位">
              <Select options={BODY_PARTS.map((b) => ({ value: b, label: b }))} style={{ width: 180 }} allowClear />
            </Form.Item>
            <Form.Item name="matchSeriesCount" label="序列数">
              <InputNumber min={0} max={30} style={{ width: 90 }} />
            </Form.Item>
          </Space>
          <Form.Item name="matchSeriesDesc" label="序列描述 (可选, / 分隔)">
            <Input placeholder="如: 轴位-肺窗 / 轴位-纵隔窗 / 冠状位" />
          </Form.Item>
          <Button type="primary" icon={<Sparkles size={14} />} onClick={() => handleMatch()} loading={matchLoading}>
            开始匹配
          </Button>
        </Form>

        {matchResult && (
          <div style={{ marginTop: 20 }}>
            <Alert
              type="success"
              showIcon
              message={
                <Space>
                  <span>匹配结果: <Tag color="geekblue">{matchResult.protocol?.name ?? '无匹配协议'}</Tag></span>
                  <span>匹配分: <Text strong>{matchResult.score}</Text></span>
                </Space>
              }
              description={
                <Space wrap>
                  {matchResult.reasons.map((r, i) => <Tag key={i} color="blue">{r}</Tag>)}
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              布局预览 ({matchResult.layout.rows} × {matchResult.layout.cols})
            </Text>
            <GridPreview rows={matchResult.layout.rows} cols={matchResult.layout.cols} cells={previewCells} />
            {matchResult.candidates.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">备选协议: </Text>
                {matchResult.candidates.map((c) => <Tag key={c.id} style={{ marginRight: 8 }}>{c.name} ({c.score}分)</Tag>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default HangingProtocolPage
