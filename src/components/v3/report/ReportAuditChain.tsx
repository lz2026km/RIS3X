/**
 * G005 放射RIS系统 v3.0.2 - 报告审计链
 * 对标:医疗区块链审计 / 等保 2.0 三级要求
 *
 * 功能:
 *  - SHA-256 链式哈希(每条记录包含 prev hash)
 *  - 不可篡改验证
 *  - 操作追溯(谁/什么/何时/为什么)
 *  - 完整性校验
 *  - JSON 导出
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Card, Table, Tag, Space, Button, Drawer, Tooltip, Statistic, Row, Col, Alert, Empty, Switch, message } from 'antd'
import { Shield, Hash, CheckCircle, AlertTriangle, Eye, Download, GitBranch } from 'lucide-react'

export type AuditEventType =
  | 'REPORT_CREATE' | 'REPORT_EDIT' | 'REPORT_VIEW' | 'REPORT_DOWNLOAD'
  | 'REPORT_SIGN' | 'REPORT_APPROVE' | 'REPORT_REJECT' | 'REPORT_AMEND'
  | 'REPORT_LOCK' | 'REPORT_UNLOCK' | 'REPORT_DELETE' | 'REPORT_RESTORE'
  | 'CRITICAL_VALUE_TRIGGER' | 'CRITICAL_VALUE_NOTIFY' | 'AUTH_LOGIN' | 'AUTH_FAIL' | 'PERMISSION_DENY'

export interface AuditEvent {
  id: string
  timestamp: string
  actor: string
  actorRole: string
  ip?: string
  /** 操作 */
  action: AuditEventType
  /** 操作对象(报告 ID) */
  target: string
  /** 描述 */
  description: string
  /** 详细内容(可选 JSON) */
  detail?: Record<string, unknown>
  /** 前一条哈希 */
  prevHash: string
  /** 本条哈希(SHA-256) */
  hash: string
  /** 链状态 */
  verified?: boolean
}

export interface ReportAuditChainProps {
  events: AuditEvent[]
  onExport?: () => void
}

const ACTION_META: Record<AuditEventType, { color: string; label: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
  REPORT_CREATE: { color: 'blue', label: '创建报告', severity: 'low' },
  REPORT_EDIT: { color: 'gold', label: '编辑报告', severity: 'medium' },
  REPORT_VIEW: { color: 'default', label: '查看报告', severity: 'low' },
  REPORT_DOWNLOAD: { color: 'cyan', label: '下载报告', severity: 'low' },
  REPORT_SIGN: { color: 'green', label: '签发报告', severity: 'high' },
  REPORT_APPROVE: { color: 'green', label: '审核通过', severity: 'high' },
  REPORT_REJECT: { color: 'orange', label: '退回报告', severity: 'high' },
  REPORT_AMEND: { color: 'purple', label: '修订报告', severity: 'high' },
  REPORT_LOCK: { color: 'red', label: '锁定报告', severity: 'medium' },
  REPORT_UNLOCK: { color: 'red', label: '解锁报告', severity: 'medium' },
  REPORT_DELETE: { color: 'red', label: '删除报告', severity: 'critical' },
  REPORT_RESTORE: { color: 'cyan', label: '恢复报告', severity: 'high' },
  CRITICAL_VALUE_TRIGGER: { color: 'magenta', label: '触发危急值', severity: 'critical' },
  CRITICAL_VALUE_NOTIFY: { color: 'magenta', label: '通知危急值', severity: 'critical' },
  AUTH_LOGIN: { color: 'blue', label: '登录', severity: 'low' },
  AUTH_FAIL: { color: 'red', label: '登录失败', severity: 'medium' },
  PERMISSION_DENY: { color: 'red', label: '权限拒绝', severity: 'medium' },
}

const SEVERITY_COLORS = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
} as const

/** SHA-256 实现(浏览器) */
async function sha256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // 后备:简化 hash(仅用于开发)
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h).toString(16).padStart(16, '0').repeat(4).slice(0, 64)
}

/** 计算链上每条 hash(同步版本用于展示,异步版本用于校验) */
export function computeChainHash(events: AuditEvent[]): AuditEvent[] {
  return events.map((e, i) => ({
    ...e,
    prevHash: i === 0 ? '0'.repeat(64) : events[i - 1].hash,
    hash: '', // 占位,真实使用 computeChainHashAsync
  }))
}

export async function computeChainHashAsync(events: AuditEvent[]): Promise<AuditEvent[]> {
  const out: AuditEvent[] = []
  let prev = '0'.repeat(64)
  for (const e of events) {
    const payload = JSON.stringify({
      timestamp: e.timestamp,
      actor: e.actor,
      action: e.action,
      target: e.target,
      description: e.description,
      prevHash: prev,
    })
    const h = await sha256(payload)
    out.push({ ...e, prevHash: prev, hash: h })
    prev = h
  }
  return out
}

export async function verifyChainIntegrity(events: AuditEvent[]): Promise<{
  valid: boolean
  brokenAt?: number
  recomputed?: AuditEvent[]
  reason?: string
}> {
  const recomputed = await computeChainHashAsync(events)
  let prev = '0'.repeat(64)
  for (let i = 0; i < events.length; i++) {
    const re = recomputed[i]
    const ev = events[i]
    if (!re || !ev) break
    if (re.prevHash !== prev) {
      return { valid: false, brokenAt: i, recomputed, reason: `prevHash mismatch at index ${i}` }
    }
    if (re.hash !== ev.hash) {
      return { valid: false, brokenAt: i, recomputed, reason: `hash mismatch at index ${i}` }
    }
    prev = re.hash
  }
  return { valid: true, recomputed }
}

export const ReportAuditChain: React.FC<ReportAuditChainProps> = ({ events, onExport }) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; reason?: string; brokenAt?: number } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [showOnlyHigh, setShowOnlyHigh] = useState(false)

  const stats = useMemo(() => {
    return {
      total: events.length,
      critical: events.filter((e) => ACTION_META[e.action].severity === 'critical').length,
      high: events.filter((e) => ACTION_META[e.action].severity === 'high').length,
      uniqueActors: new Set(events.map((e) => e.actor)).size,
    }
  }, [events])

  const filtered = useMemo(() => {
    return showOnlyHigh
      ? events.filter((e) => ['high', 'critical'].includes(ACTION_META[e.action].severity))
      : events
  }, [events, showOnlyHigh])

  const doVerify = useCallback(async () => {
    setVerifying(true)
    try {
      const result = await verifyChainIntegrity(events)
      setVerifyResult({ valid: result.valid, reason: result.reason, brokenAt: result.brokenAt })
      if (result.valid) void message.success('审计链完整性验证通过')
    } catch (e: any) {
      setVerifyResult({ valid: false, reason: e?.message ?? '验证失败' })
    } finally {
      setVerifying(false)
    }
  }, [events])

  const handleExport = useCallback(() => {
    const data = JSON.stringify(events, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-chain-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    void message.success('审计链已导出')
    onExport?.()
  }, [events, onExport])

  return (
    <>
      <Button
        data-testid="audit-chain-open"
        icon={<Shield size={14} />}
        onClick={() => setOpen(true)}
      >
        审计链 ({events.length})
      </Button>
      <Drawer
        title={
          <Space>
            <Shield size={16} color="#1e3a5f" />
            <span>报告审计链</span>
            <Tag color="geekblue">SHA-256</Tag>
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={920}
      >
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="总事件" value={stats.total} prefix={<GitBranch size={14} />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="关键事件" value={stats.critical + stats.high} valueStyle={{ color: '#dc2626' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="操作人" value={stats.uniqueActors} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Button
                  size="small"
                  icon={<Hash size={12} />}
                  onClick={doVerify}
                  loading={verifying}
                  data-testid="audit-verify"
                  block
                >
                  验证链完整性
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        {verifyResult && (
          <Alert
            data-testid="audit-verify-result"
            type={verifyResult.valid ? 'success' : 'error'}
            showIcon
            icon={verifyResult.valid ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            message={verifyResult.valid ? '审计链完整无误' : '审计链存在异常'}
            description={verifyResult.reason}
            closable
            style={{ marginBottom: 12 }}
          />
        )}

        <Space style={{ marginBottom: 12, width: '100%' }} wrap>
          <Switch
            size="small"
            checked={showOnlyHigh}
            onChange={setShowOnlyHigh}
            checkedChildren="仅显示高危"
            unCheckedChildren="全部"
            data-testid="audit-filter-high"
          />
          <Button icon={<Download size={12} />} onClick={handleExport} data-testid="audit-export">
            导出 JSON
          </Button>
        </Space>

        <Table
          size="small"
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          data-testid="audit-table"
          columns={[
            {
              title: '时间',
              dataIndex: 'timestamp',
              width: 160,
              render: (v) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span>,
            },
            {
              title: '操作',
              dataIndex: 'action',
              width: 130,
              render: (a: AuditEventType) => {
                const m = ACTION_META[a]
                return (
                  <Tag color={m.color} data-testid={`audit-action-${a}`}>
                    {m.label}
                  </Tag>
                )
              },
            },
            {
              title: '严重级',
              dataIndex: 'action',
              width: 80,
              render: (a: AuditEventType) => {
                const sev = ACTION_META[a].severity
                return <Tag color={SEVERITY_COLORS[sev]}>{sev}</Tag>
              },
            },
            {
              title: '操作人',
              dataIndex: 'actor',
              width: 100,
              render: (v, r: AuditEvent) => (
                <Space size={2} direction="vertical">
                  <span style={{ fontSize: 12 }}>{v}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.actorRole}</span>
                </Space>
              ),
            },
            {
              title: '目标',
              dataIndex: 'target',
              width: 100,
            },
            {
              title: '描述',
              dataIndex: 'description',
              ellipsis: true,
            },
            {
              title: 'Hash',
              dataIndex: 'hash',
              width: 80,
              render: (v, r: AuditEvent) => (
                <Tooltip title={v}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748b' }}>
                    {v ? v.slice(0, 8) : r.id.slice(0, 8)}...
                  </span>
                </Tooltip>
              ),
            },
            {
              title: '操作',
              dataIndex: 'id',
              width: 60,
              render: (id) => (
                <Button
                  size="small"
                  type="text"
                  icon={<Eye size={12} />}
                  onClick={() => setSelected(events.find((e) => e.id === id) ?? null)}
                />
              ),
            },
          ]}
          locale={{ emptyText: <Empty description="无审计事件" /> }}
        />
      </Drawer>

      <Drawer
        title="审计事件详情"
        open={!!selected}
        onClose={() => setSelected(null)}
        width={600}
      >
        {selected && (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div>
                  <Tag color={ACTION_META[selected.action].color}>{ACTION_META[selected.action].label}</Tag>
                  <Tag color={SEVERITY_COLORS[ACTION_META[selected.action].severity]}>
                    {ACTION_META[selected.action].severity}
                  </Tag>
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>时间:</strong> {selected.timestamp}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>操作人:</strong> {selected.actor} ({selected.actorRole})
                </div>
                {selected.ip && (
                  <div style={{ fontSize: 12 }}>
                    <strong>IP:</strong> {selected.ip}
                  </div>
                )}
                <div style={{ fontSize: 12 }}>
                  <strong>目标:</strong> {selected.target}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>描述:</strong> {selected.description}
                </div>
              </Space>
            </Card>
            <Card size="small" title="Prev Hash" data-testid="audit-prev-hash">
              <pre style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', background: '#f1f5f9', padding: 6, borderRadius: 4 }}>
                {selected.prevHash}
              </pre>
            </Card>
            <Card size="small" title="本条 Hash" data-testid="audit-hash">
              <pre style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', background: '#f1f5f9', padding: 6, borderRadius: 4 }}>
                {selected.hash}
              </pre>
            </Card>
            {selected.detail && (
              <Card size="small" title="详细内容">
                <pre style={{ fontSize: 12, fontFamily: 'monospace', background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selected.detail, null, 2)}
                </pre>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </>
  )
}

export default ReportAuditChain
