/**
 * G005 放射RIS系统 v3.0.2 - 模板继承管理 UI
 * 对标:创业 / 东软 — 子模板继承父模板,改父不影响子,版本管理
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Card, Tree, Tag, Button, Space, Tooltip, Modal, Form, Input, Select, Empty } from 'antd'
import { GitBranch, Plus, Trash2, Edit3, FileText, FolderOpen } from 'lucide-react'
import { REPORT_TEMPLATES, getInheritanceChain, findTemplate, type ReportTemplate, type TemplateCategory } from '@data/reportTemplates'

const CATEGORIES: { value: TemplateCategory; label: string; color: string }[] = [
  { value: 'CT', label: 'CT', color: 'blue' },
  { value: 'MR', label: 'MR', color: 'purple' },
  { value: 'DR', label: 'DR', color: 'cyan' },
  { value: 'US', label: 'US', color: 'green' },
  { value: 'MG', label: 'MG', color: 'magenta' },
  { value: 'DSA', label: 'DSA', color: 'volcano' },
  { value: 'CRITICAL', label: '危急值', color: 'red' },
  { value: 'CUSTOM', label: '自定义', color: 'gold' },
]

export interface TemplateInheritanceManagerProps {
  onSelect?: (template: ReportTemplate) => void
  onEdit?: (template: ReportTemplate) => void
  onDelete?: (template: ReportTemplate) => void
}

interface TreeNode {
  key: string
  title: React.ReactNode
  children?: TreeNode[]
  isLeaf?: boolean
}

const buildTree = (templates: ReportTemplate[]): TreeNode[] => {
  const grouped = new Map<TemplateCategory, ReportTemplate[]>()
  for (const t of templates) {
    const list = grouped.get(t.category) ?? []
    list.push(t)
    grouped.set(t.category, list)
  }
  const nodes: TreeNode[] = []
  for (const [cat, list] of grouped.entries()) {
    const meta = CATEGORIES.find((c) => c.value === cat)!
    const children: TreeNode[] = list.map((t) => {
      const chain = getInheritanceChain(t.id)
      const title = (
        <Space size={4}>
          <FileText size={12} />
          <span style={{ fontWeight: t.parentId ? 400 : 600 }}>{t.name}</span>
          {t.parentId && (
            <Tooltip title={`继承自:${findTemplate(t.parentId)?.name}`}>
              <Tag color="purple" style={{ fontSize: 12, padding: '0 4px' }}>
                继承 v{t.version}
              </Tag>
            </Tooltip>
          )}
          {chain.length > 1 && (
            <Tooltip title={`继承链:${chain.map((c) => c.name).join(' → ')}`}>
              <Tag style={{ fontSize: 12, padding: '0 4px' }}>{chain.length} 层</Tag>
            </Tooltip>
          )}
        </Space>
      )
      return { key: t.id, title, isLeaf: true }
    })
    nodes.push({
      key: `cat-${cat}`,
      title: (
        <Space>
          <FolderOpen size={14} color="#1e3a5f" />
          <strong>{meta.label}</strong>
          <Tag color={meta.color}>{list.length}</Tag>
        </Space>
      ),
      children,
    })
  }
  return nodes
}

export const TemplateInheritanceManager: React.FC<TemplateInheritanceManagerProps> = ({
  onSelect,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState<string[]>(CATEGORIES.map((c) => `cat-${c.value}`))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const treeData = useMemo(() => buildTree(REPORT_TEMPLATES), [])
  const selected = useMemo(() => (selectedId ? findTemplate(selectedId) : null), [selectedId])
  const chain = useMemo(() => (selectedId ? getInheritanceChain(selectedId) : []), [selectedId])

  const handleSelect = useCallback(
    (keys: React.Key[]) => {
      const id = String(keys[0] ?? '')
      if (!id.startsWith('cat-')) {
        setSelectedId(id)
        const t = findTemplate(id)
        if (t) onSelect?.(t)
      }
    },
    [onSelect]
  )

  const handleCreate = useCallback(
    (values: { name: string; category: TemplateCategory; parentId?: string; bodyPart: string }) => {
      const newT: ReportTemplate = {
        id: `t-custom-${Date.now()}`,
        name: values.name,
        category: values.category,
        bodyPart: values.bodyPart,
        description: '用户自定义模板',
        body: `{{#if patient.age >= 18}}成人{{#else}}未成年{{/if}}检查所见:...`,
        parentId: values.parentId,
        version: 1,
        createdBy: '当前用户',
        createdAt: new Date().toISOString().split('T')[0]!,
        tags: ['自定义'],
      }
      REPORT_TEMPLATES.push(newT)
      setCreateOpen(false)
      form.resetFields()
      setSelectedId(newT.id)
    },
    [form]
  )

  return (
    <Card
      data-testid="template-inheritance-manager"
      size="small"
      title={
        <Space>
          <GitBranch size={16} color="#1e3a5f" />
          <span>报告模板继承管理</span>
          <Tag color="blue">{REPORT_TEMPLATES.length} 个模板</Tag>
        </Space>
      }
      extra={
        <Button
          size="small"
          type="primary"
          icon={<Plus size={12} />}
          onClick={() => setCreateOpen(true)}
          data-testid="tim-create"
        >
          新建模板
        </Button>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ display: 'flex', height: 480 }}>
        <div style={{ flex: 1, borderRight: '1px solid #f0f0f0', overflow: 'auto', padding: 8 }}>
          <Tree
            treeData={treeData}
            expandedKeys={expanded}
            onExpand={setExpanded}
            selectedKeys={selectedId ? [selectedId] : []}
            onSelect={handleSelect}
            showLine
            blockNode
            defaultExpandAll
          />
        </div>
        <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
          {!selected ? (
            <Empty description="请选择左侧模板查看详情" />
          ) : (
            <div data-testid="tim-detail">
              <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <Space>
                    <FileText size={20} color="#1e3a5f" />
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{selected.name}</span>
                    <Tag color="blue">v{selected.version}</Tag>
                    <Tag>{selected.category}</Tag>
                    {selected.parentId && <Tag color="purple">继承</Tag>}
                  </Space>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{selected.description}</div>
                </div>

                {chain.length > 1 && (
                  <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>继承链(子→根)</div>
                    {chain.map((t, i) => (
                      <div
                        key={t.id}
                        style={{
                          fontSize: 12,
                          padding: '2px 0',
                          fontWeight: i === 0 ? 600 : 400,
                        }}
                      >
                        {i > 0 && '↑ 继承自: '}
                        {t.name} <Tag style={{ fontSize: 12 }}>v{t.version}</Tag>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>模板正文</div>
                  <pre
                    style={{
                      background: '#f8fafc',
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      lineHeight: 1.6,
                      maxHeight: 200,
                      overflow: 'auto',
                      fontFamily: 'inherit',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selected.body}
                  </pre>
                </div>

                <Space>
                  <Button
                    size="small"
                    icon={<Edit3 size={12} />}
                    onClick={() => onEdit?.(selected)}
                    data-testid="tim-edit"
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除该模板?"
                    onConfirm={() => {
                      onDelete?.(selected)
                      setSelectedId(null)
                    }}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      data-testid="tim-delete"
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        title="新建报告模板"
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如:CT 胸部增强(自定义)" />
          </Form.Item>
          <Form.Item name="category" label="类别" initialValue="CUSTOM" rules={[{ required: true }]}>
            <Select
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
          </Form.Item>
          <Form.Item name="bodyPart" label="部位" rules={[{ required: true }]}>
            <Input placeholder="如 CHEST / ABDOMEN" />
          </Form.Item>
          <Form.Item name="parentId" label="继承自(可选)">
            <Select
              allowClear
              showSearch
              placeholder="不填则不继承"
              options={REPORT_TEMPLATES.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

import { Popconfirm } from 'antd'

export default TemplateInheritanceManager
