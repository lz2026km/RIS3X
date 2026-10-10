/**
 * G005 RIS v3.0.6.11-60 - Auto-hanging 自动布局协议管理 (对标 GE/Siemens/Fujifilm)
 * 协议列表 + 新建/编辑 (布局网格可视化) + 匹配测试 (选检查→预览布局)
 * [G005 v3.0.6.11-85 Wave 4B (G-17)] 布局模板/匹配规则抽取到 src/constants/hangingProtocols.ts
 * 与阅片工作流 (DicomViewerPro 挂片协议下拉/自动挂片) 共享; 本页保持独立 + 「应用到阅片」入口
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Switch,
  Tag,
  Space,
  message,
  Popconfirm,
  Typography,
  Alert,
} from "antd";
import { Plus, RefreshCw, LayoutGrid, Search, Sparkles, Trash2, MonitorPlay } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hangingApi, type HangingProtocol, type HangingMatchResult, type HangingLayout } from '../../services/api/hangingApi'
import { usePagination } from '../../hooks/usePagination'
import { LAYOUT_PRESETS, layoutKey, HANGING_PROTOCOL_PRESETS, matchHangingProtocols } from '../../constants/hangingProtocols'
import { t } from '../../i18n/appI18n'

const { Title, Text } = Typography

const MODALITIES = ['CT', 'MR', 'DR', 'DX', 'MG', 'US', 'NM', 'PT', 'XA']
const BODY_PARTS = ['HEAD', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'NECK', 'KNEE', 'CARDIAC', 'BREAST', 'EXTREMITY', 'WHOLE BODY']
const BODY_PART_LABELS: Record<string, string> = {
  HEAD: t('hangProto.body.head'), CHEST: t('hangProto.body.chest'), ABDOMEN: t('hangProto.body.abdomen'), PELVIS: t('hangProto.body.pelvis'), SPINE: t('hangProto.body.spine'), NECK: t('hangProto.body.neck'), KNEE: t('hangProto.body.knee'),
  CARDIAC: t('hangProto.body.cardiac'), BREAST: t('hangProto.body.breast'), EXTREMITY: t('hangProto.body.extremity'), 'WHOLE BODY': t('hangProto.body.wholeBody'),
}

function GridPreview({ rows, cols, cells }: { rows: number; cols: number; cells?: (string | undefined)[] }) {
  const items = cells ?? Array.from({ length: rows * cols }, () => undefined)
  return (
    <div
      data-testid="hanging-grid-preview"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 6,
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 'var(--space-2, 8px)',
        background: 'var(--bg-card)',
        minWidth: 260,
      }}
    >
      {items.map((label, i) => (
        <div
          key={i}
          style={{
            border: `1px dashed ${label ? 'var(--color-primary-600)' : 'var(--border-color)'}`,
            background: label ? 'var(--color-info-bg)' : 'var(--bg-card)',
            borderRadius: 6,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: label ? 'var(--color-primary-600)' : '#bfbfbf',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 4px',
          }}
        >
          {label ?? t('w9d.hanging.viewport', { n: i + 1 })}
        </div>
      ))}
    </div>
  )
}

const HangingProtocolPage: React.FC = () => {
  const navigate = useNavigate()
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
  // [G005 Wave 4B] 阅片侧自动匹配示例 (CT 胸部)
  const ctChestTop = useMemo(() => matchHangingProtocols('CT', 'CHEST')[0], [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hangingApi.list()
      if (res.success) setProtocols(res.data)
      else message.error(res.error?.message || t('hangProto.listLoadFail'))
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
      message.success(editing ? t('hangProto.updated') : t('hangProto.created'))
      setModalOpen(false)
      void load()
    } else {
      message.error(res.error?.message || t('hangProto.saveFail'))
    }
  }, [form, editing, load])

  const handleDelete = useCallback(async (id: string) => {
    const res = await hangingApi.remove(id)
    if (res.success) {
      message.success(t('hangProto.deleted'))
      void load()
    } else {
      message.error(res.error?.message || t('hangProto.deleteFail'))
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
      else message.error(res.error?.message || t('hangProto.matchFail'))
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
      title: t('hangProto.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, r: HangingProtocol) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.name}</Text>
          {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
        </Space>
      ),
    },
    { title: t('hangProto.col.modality'), dataIndex: 'modality', key: 'modality', width: 80, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('hangProto.col.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 110, render: (v: string) => BODY_PART_LABELS[v] ?? v },
    {
      title: t('hangProto.col.layout'),
      dataIndex: 'layout',
      key: 'layout',
      width: 160,
      render: (l: HangingLayout) => <Tag icon={<LayoutGrid size={12} />}>{l.rows} × {l.cols}{l.seriesOrder?.length ? ` (${t('w9d.hanging.seriesCount', { n: l.seriesOrder.length })})` : ''}</Tag>,
    },
    { title: t('hangProto.col.priority'), dataIndex: 'priority', key: 'priority', width: 80 },
    {
      title: t('hangProto.col.status'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="green">{t('hangProto.enabled')}</Tag> : <Tag>{t('hangProto.disabled')}</Tag>),
    },
    {
      title: t('hangProto.col.action'),
      key: 'action',
      width: 140,
      render: (_: unknown, r: HangingProtocol) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>{t('hangProto.edit')}</Button>
          <Popconfirm title={t('hangProto.confirmDelete')} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />}>{t('hangProto.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} align="center">
        <LayoutGrid size={20} color="var(--color-primary-600)" />
        <Title level={4} style={{ margin: 0 }}>{t('hangProto.title')}</Title>
        <Tag color="geekblue">{t('w9d.hanging.benchmark')}</Tag>
      </Space>

      {/* [G005 Wave 4B] 应用到阅片入口说明 */}
      <Alert
        style={{ marginBottom: 'var(--space-4, 16px)' }}
        type="info"
        showIcon
        icon={<MonitorPlay size={14} />}
        message={t('hangProto.applyReading')}
        description={
          <Space direction="vertical" size={4}>
            <span>
              {t('hangProto.applyDesc')}
            </span>
            <span>
              {t('w9d.hanging.presetDesc', { count: HANGING_PROTOCOL_PRESETS.length, layouts: LAYOUT_PRESETS.map((p) => `${p.layout.rows}×${p.layout.cols}`).join(' / ') })}
            </span>
            {ctChestTop && (
              <span>{t('hangProto.autoMatchExample')} <Tag color="blue">{ctChestTop.name}</Tag> {ctChestTop.layout.rows}×{ctChestTop.layout.cols} {ctChestTop.layout.seriesOrder.join(' / ')}</span>
            )}
            <Button size="small" type="primary" icon={<MonitorPlay size={12} />} onClick={() => navigate('/dicom-viewer')}>
              {t('hangProto.openViewer')}
            </Button>
          </Space>
        }
      />

      <Card
        size="small"
        style={{ marginBottom: 'var(--space-4, 16px)' }}
        title={<Space><RefreshCw size={14} />{t('w9d.hanging.protocolList', { count: protocols.length })}</Space>}
        extra={
          <Space>
            <Button icon={<Search size={14} />} onClick={() => setMatchModalOpen(true)}>{t('hangProto.matchTest')}</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>{t('hangProto.newProtocol')}</Button>
          </Space>
        }
      >
        <DataTable
          rowKey="id"
          loading={loading}
          dataSource={protocolPageData}
          columns={columns}
          pagination={protocolPagination}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editing ? t('hangProto.editProtocol') : t('hangProto.newProtocolTitle')}
        open={modalOpen}
        onOk={() => handleSave()}
        onCancel={() => setModalOpen(false)}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ layoutPreset: '1x1' }}>
          <Form.Item name="name" label={t('hangProto.form.name')} rules={[{ required: true, message: t('hangProto.validate.name') }]}>
            <Input placeholder={t('hangProto.form.namePh')} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="modality" label={t('hangProto.form.modality')} rules={[{ required: true }]}>
              <Select options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="bodyPart" label={t('hangProto.form.bodyPart')} rules={[{ required: true }]}>
              <Select options={BODY_PARTS.map((b) => ({ value: b, label: BODY_PART_LABELS[b] ?? b }))} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="priority" label={t('hangProto.form.priority')}>
              <InputNumber min={0} max={999} style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Form.Item label={t('hangProto.form.layoutTemplate')} required>
            <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
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
          <Form.Item name="seriesOrder" label={t('hangProto.form.seriesOrder')}>
            <Input placeholder={t('hangProto.form.seriesOrderPh')} />
          </Form.Item>
          <Form.Item name="description" label={t('hangProto.form.description')}>
            <Input placeholder={t('hangProto.form.descriptionPh')} />
          </Form.Item>
          <Form.Item name="enabled" label={t('hangProto.form.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('hangProto.match.title')}
        open={matchModalOpen}
        onCancel={() => setMatchModalOpen(false)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        <Form form={matchForm} layout="vertical" initialValues={{ matchModality: 'CT', matchBodyPart: 'CHEST' }}>
          <Space size="large">
            <Form.Item name="matchModality" label={t('hangProto.form.modality')} rules={[{ required: true }]}>
              <Select options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="matchBodyPart" label={t('hangProto.form.bodyPart')}>
              <Select options={BODY_PARTS.map((b) => ({ value: b, label: BODY_PART_LABELS[b] ?? b }))} style={{ width: 180 }} allowClear />
            </Form.Item>
            <Form.Item name="matchSeriesCount" label={t('hangProto.match.seriesCount')}>
              <InputNumber min={0} max={30} style={{ width: 90 }} />
            </Form.Item>
          </Space>
          <Form.Item name="matchSeriesDesc" label={t('hangProto.match.seriesDesc')}>
            <Input placeholder={t('hangProto.match.seriesDescPh')} />
          </Form.Item>
          <Button type="primary" icon={<Sparkles size={14} />} onClick={() => handleMatch()} loading={matchLoading}>
            {t('hangProto.match.start')}
          </Button>
        </Form>

        {matchResult && (
          <div style={{ marginTop: 'var(--space-5, 20px)' }}>
            <Alert
              type="success"
              showIcon
              message={
                <Space>
                  <span>{t('hangProto.match.result')} <Tag color="geekblue">{matchResult.protocol?.name ?? t('hangProto.match.noMatch')}</Tag></span>
                  <span>{t('hangProto.match.score')} <Text strong>{matchResult.score}</Text></span>
                </Space>
              }
              description={
                <Space wrap>
                  {matchResult.reasons.map((r, i) => <Tag key={i} color="blue">{r}</Tag>)}
                </Space>
              }
              style={{ marginBottom: 'var(--space-4, 16px)' }}
            />
            <Text strong style={{ display: 'block', marginBottom: 'var(--space-2, 8px)' }}>
              {t('hangProto.match.layoutPreview', { rows: matchResult.layout.rows, cols: matchResult.layout.cols })}
            </Text>
            <GridPreview rows={matchResult.layout.rows} cols={matchResult.layout.cols} cells={previewCells} />
            {matchResult.candidates.length > 1 && (
              <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                <Text type="secondary">{t('hangProto.match.candidates')}</Text>
                {matchResult.candidates.map((c) => <Tag key={c.id} style={{ marginRight: 'var(--space-2, 8px)' }}>{c.name} ({c.score}{t('hangProto.match.points')})</Tag>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default HangingProtocolPage

import { DataTable } from "../../components/common";