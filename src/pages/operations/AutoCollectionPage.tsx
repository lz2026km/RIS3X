import { autoCollectionApi, type AutoCollectionRule, type AutoCollectionTask, type AutoCollectionConfig, type AutoCollectionStats } from '../../services/api/autoCollectionApi'
import { Card, Table, Switch, Space, Row, Col, Statistic, Button, Tag, message, Modal, Form, Input, Select, Alert, Popconfirm, Descriptions, Spin } from 'antd'
import { Settings, Play, Edit3, Trash2, RefreshCw, Eye, History } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'

// 数据来源说明: 后端无 auto-collection controller,
// 由 MSW handler (src/services/mockBackend/autoCollectionHandlers.ts) 提供演示数据。
const DEMO_SOURCE_NOTE = '数据来源：演示数据（MSW，后端暂无 /auto-collection 接口）'

interface AutoCollectionRuleItem {
  id: string
  name: string
  triggerType: string
  action: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: string
  updatedAt?: string
}

const toItem = (r: AutoCollectionRule): AutoCollectionRuleItem => ({
  id: r.id,
  name: r.name,
  triggerType: r.triggerType,
  action: r.action,
  enabled: r.enabled,
  status: r.enabled ? 'active' : 'inactive',
  updatedAt: r.updatedAt,
})

const AutoCollectionPage: React.FC = () => {
  const [rules, setRules] = useState<AutoCollectionRuleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()
  // [G005 Wave1B] 统计 / 任务 / 配置 / 规则编辑删除 (getStats / listTasks·getTask·rerunTask / getConfig·updateConfig / getRule·updateRule·deleteRule)
  const [stats, setStats] = useState<AutoCollectionStats | null>(null)
  const [tasks, setTasks] = useState<AutoCollectionTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskDetail, setTaskDetail] = useState<AutoCollectionTask | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rerunningId, setRerunningId] = useState<string | null>(null)
  const [configs, setConfigs] = useState<AutoCollectionConfig[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<AutoCollectionRuleItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await autoCollectionApi.listRules()
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '规则加载失败')
      setRules(res.data.map(toItem))
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await autoCollectionApi.getStats()
      if (res.success && res.data) setStats(res.data)
    } catch { /* 统计接口不可用时保持空 */ }
  }, [])

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await autoCollectionApi.listTasks()
      if (res.success && Array.isArray(res.data)) setTasks(res.data)
    } catch { /* 任务接口不可用时保持空 */ }
    setTasksLoading(false)
  }, [])

  const fetchConfigs = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await autoCollectionApi.getConfig()
      if (res.success && Array.isArray(res.data)) {
        setConfigs(res.data)
        setConfigValues(prev => {
          const next = { ...prev }
          res.data.forEach(c => { next[c.key] = c.value })
          return next
        })
      }
    } catch { /* 配置接口不可用时保持空 */ }
    setConfigLoading(false)
  }, [])

  useEffect(() => {
    fetchRules()
    fetchStats()
    fetchTasks()
    fetchConfigs()
  }, [fetchRules, fetchStats, fetchTasks, fetchConfigs])

  // [G005 Wave1B] 编辑规则: 优先 getRule 拉取最新, 失败回退行数据
  const handleEditRule = async (r: AutoCollectionRuleItem) => {
    setEditingRule(r)
    setCreateOpen(true)
    form.setFieldsValue({ name: r.name, triggerType: r.triggerType, action: r.action, enabled: r.enabled })
    try {
      const res = await autoCollectionApi.getRule(r.id)
      if (res.success && res.data) {
        form.setFieldsValue({ name: res.data.name, triggerType: res.data.triggerType, action: res.data.action, enabled: res.data.enabled })
      }
    } catch { /* 详情接口不可用, 使用行数据 */ }
  }

  // [G005 Wave1B] 删除规则: deleteRule
  const handleDeleteRule = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await autoCollectionApi.deleteRule(id)
      if (res.success) {
        setRules(prev => prev.filter(r => r.id !== id))
        message.success('规则已删除')
      } else {
        message.error(res.error?.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
    setDeletingId(null)
  }

  // [G005 Wave1B] 任务详情: getTask, 失败回退列表行
  const handleViewTask = async (t: AutoCollectionTask) => {
    setDetailLoading(true)
    setTaskDetail(t)
    try {
      const res = await autoCollectionApi.getTask(t.id)
      if (res.success && res.data) setTaskDetail(res.data)
    } catch { /* 详情接口不可用, 使用行数据 */ }
    setDetailLoading(false)
  }

  // [G005 Wave1B] 任务重跑: rerunTask
  const handleRerunTask = async (id: string) => {
    setRerunningId(id)
    try {
      const res = await autoCollectionApi.rerunTask(id)
      if (res.success) {
        message.success(`任务 ${id} 已重新执行`)
        await fetchTasks()
        if (stats) await fetchStats()
      } else {
        message.warning(res.error?.message ?? '重跑接口不可用')
      }
    } catch {
      message.warning('重跑接口不可用')
    }
    setRerunningId(null)
  }

  // [G005 Wave1B] 配置保存: updateConfig
  const handleSaveConfig = async (key: string) => {
    const value = configValues[key] ?? ''
    setSavingConfigKey(key)
    try {
      const res = await autoCollectionApi.updateConfig(key, value)
      if (res.success) {
        message.success(`配置已保存: ${key}`)
        await fetchConfigs()
      } else {
        message.error(res.error?.message ?? '配置保存失败')
      }
    } catch {
      message.error('配置保存失败')
    }
    setSavingConfigKey(null)
  }

  const handleToggle = async (id: string, checked: boolean) => {
    const prev = rules
    setRules(prev2 => prev2.map(r => r.id === id ? { ...r, enabled: checked, status: checked ? 'active' : 'inactive' } : r))
    const res = await autoCollectionApi.toggleRule(id, checked)
    if (!res.success) {
      setRules(prev)
      message.error('状态切换失败，已还原')
      return
    }
    setRules(prev2 => prev2.map(r => r.id === id ? { ...toItem(res.data), lastRun: r.lastRun, nextRun: r.nextRun } : r))
    message.success(checked ? '规则已启用' : '规则已禁用')
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    setCreating(true)
    try {
      if (editingRule) {
        // [G005 Wave1B] 编辑保存: updateRule
        const res = await autoCollectionApi.updateRule(editingRule.id, {
          name: values.name,
          triggerType: values.triggerType,
          action: values.action,
          enabled: values.enabled !== false,
        })
        if (!res.success) throw new Error((res.error as { message?: string })?.message || '更新失败')
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...toItem(res.data), lastRun: r.lastRun, nextRun: r.nextRun } : r))
        message.success(`规则已更新: ${res.data.name}`)
      } else {
        const res = await autoCollectionApi.createRule({
          name: values.name,
          description: '',
          triggerType: values.triggerType,
          triggerConfig: { mode: values.triggerType },
          action: values.action,
          actionConfig: {},
          enabled: values.enabled !== false,
        })
        if (!res.success) throw new Error((res.error as { message?: string })?.message || '创建失败')
        setRules(prev => [toItem(res.data), ...prev])
        message.success(`规则已创建: ${res.data.name}`)
      }
      setCreateOpen(false)
      setEditingRule(null)
      form.resetFields()
      await fetchStats()
    } catch (e) {
      message.error((e as Error)?.message || '保存失败')
    } finally {
      setCreating(false)
    }
  }

  const columns = [
    { title: '规则名', dataIndex: 'name', key: 'name' },
    { title: '触发方式', dataIndex: 'triggerType', key: 'triggerType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '启用', key: 'enabled', render: (_: unknown, r: AutoCollectionRuleItem) => <Switch checked={r.enabled} onChange={(c) => handleToggle(r.id, c)} /> },
    {
      title: '操作', key: 'actions', width: 140,
      render: (_: unknown, r: AutoCollectionRuleItem) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<Edit3 size={12} />} onClick={() => void handleEditRule(r)}>编辑</Button>
          <Popconfirm title="删除该规则?" onConfirm={() => void handleDeleteRule(r.id)}>
            <Button size="small" type="link" danger icon={<Trash2 size={12} />} loading={deletingId === r.id}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 auto-collection controller, 数据由 MSW 提供 */}
      <Alert
        type="warning"
        showIcon
        banner
        message="演示数据（后端待实现）"
        description={DEMO_SOURCE_NOTE}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>自动采集管理</span>
      </Space>
      {error && <Alert type="warning" showIcon message="加载失败" description={error} action={<Button size="small" onClick={fetchRules}><RefreshCw size={14} /> 重试</Button>} style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总规则" value={rules.length} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="已启用" value={rules.filter(r => r.enabled).length} styles={{ content: { color: '#52c41a' } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="已禁用" value={rules.filter(r => !r.enabled).length} loading={loading} /></Card></Col>
        {/* [G005 Wave1B] 统计卡: autoCollectionApi.getStats */}
        <Col span={4}><Card><Statistic title="总任务" value={stats?.totalTasks ?? tasks.length} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="已完成" value={stats?.completedTasks ?? 0} styles={{ content: { color: '#52c41a' } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="失败" value={stats?.failedTasks ?? 0} styles={{ content: { color: '#ff4d4f' } }} loading={loading} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Play size={14} />} onClick={() => { setEditingRule(null); form.resetFields(); setCreateOpen(true); }}>新建规则</Button>}>
        <Table rowKey="id" dataSource={rules} columns={columns} pagination={false} size="small" loading={loading} scroll={{ x: 'max-content' }}/>
      </Card>

      {/* [G005 Wave1B] 任务列表: listTasks + getTask 详情 + rerunTask 重跑 */}
      <Card
        title={<Space><History size={14} />采集任务</Space>}
        size="small"
        style={{ marginTop: 12 }}
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => { fetchTasks(); fetchStats(); }}>刷新</Button>}
      >
        <Table
          rowKey="id"
          dataSource={tasks}
          size="small"
          loading={tasksLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '暂无任务记录 (GET /auto-collection/tasks)' }}
          columns={[
            { title: '任务 ID', dataIndex: 'id', key: 'id', width: 110 },
            { title: '规则', dataIndex: 'ruleName', key: 'ruleName', width: 160 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === 'completed' ? 'green' : v === 'failed' ? 'red' : v === 'running' ? 'blue' : 'orange'}>{v}</Tag> },
            { title: '触发时间', dataIndex: 'triggeredAt', key: 'triggeredAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
            { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
            {
              title: '操作', key: 'actions', width: 140,
              render: (_: unknown, t: AutoCollectionTask) => (
                <Space size={4}>
                  <Button size="small" type="link" icon={<Eye size={12} />} onClick={() => void handleViewTask(t)}>详情</Button>
                  <Button size="small" type="link" icon={<RefreshCw size={12} />} loading={rerunningId === t.id} onClick={() => void handleRerunTask(t.id)}>重跑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* [G005 Wave1B] 配置: getConfig + updateConfig */}
      <Card title={<Space><Settings size={14} />采集配置</Space>} size="small" style={{ marginTop: 12 }}>
        <Spin spinning={configLoading}>
          <Table
            rowKey="key"
            dataSource={configs}
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: '暂无配置 (GET /auto-collection/config)' }}
            columns={[
              { title: '配置项', dataIndex: 'key', key: 'key', width: 220, render: (v: string) => <code>{v}</code> },
              { title: '描述', dataIndex: 'description', key: 'description' },
              { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
              {
                title: '值', key: 'value', width: 260,
                render: (_: unknown, c: AutoCollectionConfig) => (
                  <Input
                    size="small"
                    value={configValues[c.key] ?? c.value ?? ''}
                    onChange={e => setConfigValues(prev => ({ ...prev, [c.key]: e.target.value }))}
                    suffix={<Button size="small" type="link" loading={savingConfigKey === c.key} onClick={() => void handleSaveConfig(c.key)}>保存</Button>}
                  />
                ),
              },
            ]}
          />
        </Spin>
      </Card>

      <Modal
        title={editingRule ? `编辑采集规则 - ${editingRule.name}` : "新建采集规则"}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); setEditingRule(null); }}
        onOk={handleCreate}
        okText={editingRule ? "保存" : "创建"}
        cancelText="取消"
        confirmLoading={creating}
        width={480}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }} initialValues={{ triggerType: 'event', action: 'archive', enabled: true }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="如：DICOM 自动归档" />
          </Form.Item>
          <Form.Item name="triggerType" label="触发方式" rules={[{ required: true }]}>
            <Select options={[
              { value: 'event', label: '事件触发 (event)' },
              { value: 'schedule', label: '定时触发 (schedule)' },
              { value: 'threshold', label: '阈值触发 (threshold)' },
            ]} />
          </Form.Item>
          <Form.Item name="action" label="动作" rules={[{ required: true }]}>
            <Select options={[
              { value: 'archive', label: '自动归档' },
              { value: 'notify', label: '通知' },
              { value: 'report', label: '生成报告' },
              { value: 'transfer', label: '转储' },
            ]} />
          </Form.Item>
          <Form.Item name="enabled" label="创建后立即启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* [G005 Wave1B] 任务详情 Modal: getTask */}
      <Modal
        title={`任务详情 - ${taskDetail?.id ?? ''}`}
        open={!!taskDetail}
        onCancel={() => setTaskDetail(null)}
        footer={<Button onClick={() => setTaskDetail(null)}>关闭</Button>}
        width={460}
      >
        <Spin spinning={detailLoading}>
          {taskDetail && (
            <Descriptions bordered column={1} size="small" style={{ marginTop: 8 }}>
              <Descriptions.Item label="任务 ID">{taskDetail.id}</Descriptions.Item>
              <Descriptions.Item label="规则">{taskDetail.ruleName} ({taskDetail.ruleId})</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={taskDetail.status === 'completed' ? 'green' : taskDetail.status === 'failed' ? 'red' : taskDetail.status === 'running' ? 'blue' : 'orange'}>{taskDetail.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="触发时间">{taskDetail.triggeredAt ? new Date(taskDetail.triggeredAt).toLocaleString() : '-'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{taskDetail.completedAt ? new Date(taskDetail.completedAt).toLocaleString() : '-'}</Descriptions.Item>
              {taskDetail.error && <Descriptions.Item label="错误信息"><span style={{ color: '#ff4d4f' }}>{taskDetail.error}</span></Descriptions.Item>}
              {taskDetail.result && <Descriptions.Item label="结果">{JSON.stringify(taskDetail.result)}</Descriptions.Item>}
            </Descriptions>
          )}
        </Spin>
      </Modal>
    </div>
  )
}

export default AutoCollectionPage
