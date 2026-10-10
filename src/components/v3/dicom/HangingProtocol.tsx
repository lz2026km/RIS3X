/**
 * G005 放射RIS系统 v3.0.1 - 摆位协议 (Hanging Protocol)
 * 对标 Siemens syngo.plaza 协议注册表
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { Select, Button, Tooltip, Modal, Form, Input, InputNumber, Space, Card, Popconfirm, message } from 'antd'
import { Settings, Plus, Trash2, Star } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

export interface HangingProtocolView {
  id: string
  layout: '1x1' | '2x1' | '1x2' | '2x2' | '3x3'
  seriesMatcher?: { modality?: string; bodyPart?: string }
  initialWw?: number
  initialWl?: number
}

export interface HangingProtocol {
  id: string
  name: string
  description: string
  builtin?: boolean
  views: HangingProtocolView[]
  modality?: string
  bodyPart?: string
  priority?: number
}

const BUILTIN_PROTOCOLS: HangingProtocol[] = [
  {
    id: 'ct-default',
    name: 'CT 默认',
    description: 'CT 常规:1×1 + 纵隔窗',
    builtin: true,
    modality: 'CT',
    priority: 100,
    views: [{ id: 'v1', layout: '1x1', initialWw: 400, initialWl: 40 }],
  },
  {
    id: 'mr-default',
    name: 'MR 默认',
    description: 'MR 常规:1×1 + 脑窗',
    builtin: true,
    modality: 'MR',
    priority: 100,
    views: [{ id: 'v1', layout: '1x1', initialWw: 80, initialWl: 40 }],
  },
  {
    id: 'cta-emergency',
    name: '急诊 CTA',
    description: '急诊冠脉 CTA:2×1 矢状/冠状 + 血管窗',
    builtin: true,
    modality: 'CT',
    bodyPart: 'CHEST',
    priority: 200,
    views: [
      { id: 'v1', layout: '2x1', initialWw: 300, initialWl: 100, seriesMatcher: { modality: 'CT' } },
    ],
  },
  {
    id: 'msk-bone',
    name: '骨肌关节',
    description: '骨科:2×1 矢状/冠状 + 骨窗',
    builtin: true,
    modality: 'CT',
    bodyPart: 'EXTREMITY',
    priority: 150,
    views: [{ id: 'v1', layout: '2x1', initialWw: 2000, initialWl: 500 }],
  },
]

interface HangingProtocolContextValue {
  protocols: HangingProtocol[]
  active: HangingProtocol | null
  setActive: (id: string) => void
  addProtocol: (p: HangingProtocol) => void
  removeProtocol: (id: string) => void
  applyProtocol: (id: string) => HangingProtocol | null
  suggestProtocol: (modality?: string, bodyPart?: string) => HangingProtocol | null
}

const HangingProtocolContext = createContext<HangingProtocolContextValue | null>(null)

export const HangingProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [protocols, setProtocols] = useState<HangingProtocol[]>(BUILTIN_PROTOCOLS)
  const [activeId, setActiveId] = useState<string | null>('ct-default')

  const active = useMemo(
    () => protocols.find((p) => p.id === activeId) ?? null,
    [protocols, activeId]
  )

  const addProtocol = useCallback((p: HangingProtocol) => {
    setProtocols((prev) => [...prev, p])
  }, [])

  const removeProtocol = useCallback((id: string) => {
    setProtocols((prev) => prev.filter((p) => p.id !== id || p.builtin))
  }, [])

  const applyProtocol = useCallback(
    (id: string) => {
      const p = protocols.find((x) => x.id === id) ?? null
      if (p) setActiveId(id)
      return p
    },
    [protocols]
  )

  const suggestProtocol = useCallback(
    (modality?: string, bodyPart?: string) => {
      const candidates = protocols.filter((p) => {
        const m = !p.modality || p.modality === modality
        const b = !p.bodyPart || p.bodyPart === bodyPart
        return m && b
      })
      if (candidates.length === 0) return null
      return candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null
    },
    [protocols]
  )

  const value = useMemo(
    () => ({ protocols, active, setActive: applyProtocol, addProtocol, removeProtocol, applyProtocol, suggestProtocol }),
    [protocols, active, applyProtocol, addProtocol, removeProtocol, suggestProtocol]
  )

  return <HangingProtocolContext.Provider value={value}>{children}</HangingProtocolContext.Provider>
}

export const useHangingProtocol = (): HangingProtocolContextValue => {
  const ctx = useContext(HangingProtocolContext)
  if (!ctx) throw new Error('useHangingProtocol must be used within HangingProtocolProvider')
  return ctx
}

export interface HangingProtocolSwitcherProps {
  onApply?: (protocol: HangingProtocol) => void
  showManager?: boolean
}

export const HangingProtocolSwitcher: React.FC<HangingProtocolSwitcherProps> = ({
  onApply,
  showManager = false,
}) => {
  const { protocols, active, applyProtocol, removeProtocol } = useHangingProtocol()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const handleDeleteProtocol = useCallback(
    (p: HangingProtocol) => {
      removeProtocol(p.id)
      message.success(t('w1Buttons.hanging.deleted', { name: p.name }))
    },
    [removeProtocol]
  )

  const handleApply = useCallback(
    (id: string) => {
      const p = applyProtocol(id)
      if (p) onApply?.(p)
    },
    [applyProtocol, onApply]
  )

  return (
    <div data-testid="hanging-protocol-switcher" style={{ display: 'inline-flex', gap: 'var(--space-1, 4px)' }}>
      <Select
        value={active?.id}
        onChange={handleApply}
        size="small"
        style={{ minWidth: 140 }}
        data-testid="hp-select"
        options={protocols.map((p) => ({
          value: p.id,
          label: (
            <span>
              {p.builtin && <Star size={10} style={{ marginRight: 'var(--space-1, 4px)', color: 'var(--color-warning-500)' }} />}
              {p.name}
            </span>
          ),
        }))}
      />
      {showManager && (
        <Tooltip title={t('w9e.hangingProtocol.managerTip')}>
          <Button aria-label="设置" size="small" icon={<Settings size={12} />} onClick={() => setOpen(true)} data-testid="hp-manage" />
        </Tooltip>
      )}

      <Modal
        title={t('w9e.hangingProtocol.manageTitle')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => setOpen(false)}
        width={720}
        footer={null}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          {protocols.map((p) => (
            <Card
              key={p.id}
              size="small"
              title={
                <span>
                  {p.name}
                  {p.builtin && <Star size={12} style={{ marginLeft: 'var(--space-1, 4px)', color: 'var(--color-warning-500)' }} />}
                </span>
              }
              extra={
                !p.builtin && (
                  <Popconfirm
                    title={t('w1Buttons.hanging.deleteConfirm', { name: p.name })}
                    okText={t('w1Buttons.hanging.ok')}
                    cancelText={t('w1Buttons.hanging.cancel')}
                    onConfirm={() => handleDeleteProtocol(p)}
                  >
                    <Button danger size="small" icon={<Trash2 size={12} />}>
                      {t('w9e.hangingProtocol.delete')}
                    </Button>
                  </Popconfirm>
                )
              }
            >
              <div style={{ fontSize: 12, color: '#64748b' }}>{p.description}</div>
              <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.views.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      background: '#eef2ff',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {v.layout} {v.initialWw ? `WW=${v.initialWw} WL=${v.initialWl}` : ''}
                  </span>
                ))}
              </div>
            </Card>
          ))}
          <Button
            type="dashed"
            block
            icon={<Plus size={12} />}
            onClick={() => {
              Modal.confirm({
                title: t('w9e.hangingProtocol.newProtocol'),
                content: (
                  <Form form={form} layout="vertical">
                    <Form.Item label={t('w9e.hangingProtocol.formName')} name="name" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label={t('w9e.hangingProtocol.formDescription')} name="description">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item label={t('w9e.hangingProtocol.formModality')} name="modality">
                      <Input placeholder="CT / MR / DR" />
                    </Form.Item>
                    <Form.Item label={t('w9e.hangingProtocol.formPriority')} name="priority" initialValue={50}>
                      <InputNumber min={0} max={1000} />
                    </Form.Item>
                  </Form>
                ),
              })
            }}
          >
            {t('w9e.hangingProtocol.newProtocol')}
          </Button>
        </Space>
      </Modal>
    </div>
  )
}

export default HangingProtocolSwitcher
