/**
 * G005 放射RIS系统 v3.0.2 - 报告修订历史
 * 对标:RIS 标准功能 — 报告修改履历
 */
import React, { useMemo, useState } from 'react'
import { Card, Timeline, Tag, Space, Button, Drawer, Descriptions, Empty, Tooltip, Input, Segmented, Statistic, Row, Col } from 'antd'
import { History, User, Edit, Plus, Trash2, GitCompare, RotateCcw, Eye, Search } from 'lucide-react'

export interface ReportRevision {
  id: string
  version: number
  author: string
  authorAt: string
  changeType: 'CREATED' | 'EDITED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'AMENDED' | 'SIGNED'
  fields: string[]
  before?: string
  after?: string
  comment?: string
  /** 关联报告 */
  reportId: string
}

export interface ReportRevisionHistoryProps {
  revisions: ReportRevision[]
  onRestore?: (revisionId: string) => void
  onView?: (revisionId: string) => void
}

const CHANGE_META = {
  CREATED: { color: 'blue', icon: <Plus size={12} />, label: '创建' },
  EDITED: { color: 'gold', icon: <Edit size={12} />, label: '编辑' },
  REVIEWED: { color: 'cyan', icon: <User size={12} />, label: '审核' },
  APPROVED: { color: 'green', icon: <User size={12} />, label: '通过' },
  REJECTED: { color: 'red', icon: <Trash2 size={12} />, label: '退回' },
  AMENDED: { color: 'purple', icon: <Edit size={12} />, label: '修订' },
  SIGNED: { color: 'magenta', icon: <User size={12} />, label: '签发' },
} as const

const diff = (a: string, b: string): { added: string[]; removed: string[] } => {
  const aw = new Set(a.split(/[,。.;; \n]+/).filter(Boolean))
  const bw = new Set(b.split(/[,。.;; \n]+/).filter(Boolean))
  const added = Array.from(bw).filter((w) => !aw.has(w))
  const removed = Array.from(aw).filter((w) => !bw.has(w))
  return { added, removed }
}

export const ReportRevisionHistory: React.FC<ReportRevisionHistoryProps> = ({
  revisions,
  onRestore,
  onCompare,
  onView,
}) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ReportRevision | null>(null)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])

  const sorted = useMemo(() => {
    return [...revisions].sort((a, b) => b.version - a.version)
  }, [revisions])

  const filtered = useMemo(() => {
    return sorted.filter((r) => {
      if (filterType !== 'ALL' && r.changeType !== filterType) return false
      if (keyword) {
        const k = keyword.toLowerCase()
        return (
          r.author.toLowerCase().includes(k) ||
          r.comment?.toLowerCase().includes(k) ||
          r.fields.some((f) => f.toLowerCase().includes(k))
        )
      }
      return true
    })
  }, [sorted, filterType, keyword])

  const stats = useMemo(() => {
    return {
      total: revisions.length,
      edits: revisions.filter((r) => r.changeType === 'EDITED' || r.changeType === 'AMENDED').length,
      approvals: revisions.filter((r) => r.changeType === 'APPROVED').length,
      rejections: revisions.filter((r) => r.changeType === 'REJECTED').length,
    }
  }, [revisions])

  const handleSelectForCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  return (
    <>
      <Button
        data-testid="revision-history-open"
        icon={<History size={14} />}
        onClick={() => setOpen(true)}
      >
        修订历史 ({revisions.length})
      </Button>
      <Drawer
        title={
          <Space>
            <History size={16} color="#1e3a5f" />
            <span>报告修订历史</span>
            <Tooltip title="对比模式:选择 2 个版本进行差异对比">
              <Button
                size="small"
                icon={<GitCompare size={12} />}
                onClick={() => {
                  setCompareMode((m) => !m)
                  setSelectedForCompare([])
                }}
                data-testid="revision-compare-mode"
              >
                对比模式
              </Button>
            </Tooltip>
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={760}
      >
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="总版本" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="编辑次数" value={stats.edits} styles={{ content: {  color: '#ca8a04'  } }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="通过次数" value={stats.approvals} styles={{ content: {  color: '#16a34a'  } }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="退回次数" value={stats.rejections} styles={{ content: {  color: '#dc2626'  } }} />
            </Card>
          </Col>
        </Row>

        <Space style={{ marginBottom: 12, width: '100%' }} orientation="vertical">
          <Input
            prefix={<Search size={12} />}
            placeholder="搜索修改人/字段/意见..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            data-testid="revision-search"
          />
          <Segmented
            value={filterType}
            onChange={(v) => setFilterType(v as string)}
            options={[
              { value: 'ALL', label: '全部' },
              { value: 'EDITED', label: '编辑' },
              { value: 'AMENDED', label: '修订' },
              { value: 'APPROVED', label: '通过' },
              { value: 'REJECTED', label: '退回' },
            ]}
          />
        </Space>

        {compareMode && selectedForCompare.length === 2 && (
          <Card
            size="small"
            title={
              <Space>
                <GitCompare size={14} /> 版本对比 · v{revisions.find((r) => r.id === selectedForCompare[0])?.version} ↔ v{revisions.find((r) => r.id === selectedForCompare[1])?.version}
              </Space>
            }
            style={{ marginBottom: 12, background: '#f0f9ff' }}
            data-testid="revision-compare-result"
          >
            {(() => {
              const a = revisions.find((r) => r.id === selectedForCompare[0])!
              const b = revisions.find((r) => r.id === selectedForCompare[1])!
              if (!a.after || !b.after) return <Empty description="无文本可对比" />
              const d = diff(a.after, b.after)
              return (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <div>
                    <Tag color="green">新增</Tag>
                    {d.added.length > 0 ? d.added.map((w) => <Tag key={w} color="green" style={{ margin: 2 }}>{w}</Tag>) : <span style={{ fontSize: 12, color: '#94a3b8' }}>无</span>}
                  </div>
                  <div>
                    <Tag color="red">删除</Tag>
                    {d.removed.length > 0 ? d.removed.map((w) => <Tag key={w} color="red" style={{ margin: 2 }}>{w}</Tag>) : <span style={{ fontSize: 12, color: '#94a3b8' }}>无</span>}
                  </div>
                </Space>
              )
            })()}
          </Card>
        )}

        {filtered.length === 0 ? (
          <Empty description="无历史记录" />
        ) : (
          <Timeline
            data-testid="revision-timeline"
            items={filtered.map((r) => {
              const meta = CHANGE_META[r.changeType]
              return {
                key: r.id,
                color: meta.color,
                dot: meta.icon,
                children: (
                  <Card
                    size="small"
                    hoverable
                    style={{ borderColor: compareMode && selectedForCompare.includes(r.id) ? '#3b82f6' : undefined }}
                    onClick={() => {
                      if (compareMode) {
                        handleSelectForCompare(r.id)
                      } else {
                        setSelected(r)
                        onView?.(r.id)
                      }
                    }}
                    data-testid={`revision-card-${r.id}`}
                  >
                    <Space size={4} wrap>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Tag>v{r.version}</Tag>
                      {r.fields.map((f) => (
                        <Tag key={f} style={{ fontSize: 12 }}>{f}</Tag>
                      ))}
                    </Space>
                    <div style={{ fontSize: 12, marginTop: 4, color: '#475569' }}>
                      <User size={10} /> {r.author} · {r.authorAt}
                    </div>
                    {r.comment && <div style={{ fontSize: 12, marginTop: 2, color: '#64748b' }}>备注:{r.comment}</div>}
                    <Space size={4} style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                      <Button size="small" type="text" icon={<Eye size={12} />} onClick={() => { setSelected(r); onView?.(r.id) }}>
                        查看
                      </Button>
                      {r.changeType === 'EDITED' && (
                        <Button size="small" type="text" icon={<RotateCcw size={12} />} onClick={() => onRestore?.(r.id)} data-testid={`restore-${r.id}`}>
                          恢复
                        </Button>
                      )}
                    </Space>
                  </Card>
                ),
              }
            })}
          />
        )}
      </Drawer>

      <Drawer
        title={selected ? `版本详情 · v${selected.version}` : '详情'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={580}
      >
        {selected && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="版本">v{selected.version}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={CHANGE_META[selected.changeType].color}>{CHANGE_META[selected.changeType].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="修改人">{selected.author}</Descriptions.Item>
              <Descriptions.Item label="时间">{selected.authorAt}</Descriptions.Item>
              <Descriptions.Item label="修改字段" span={2}>
                {selected.fields.map((f) => <Tag key={f}>{f}</Tag>)}
              </Descriptions.Item>
              {selected.comment && (
                <Descriptions.Item label="备注" span={2}>
                  {selected.comment}
                </Descriptions.Item>
              )}
            </Descriptions>
            {selected.before && (
              <Card size="small" title="修改前" data-testid="revision-before">
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fee2e2', padding: 8, borderRadius: 4 }}>
                  {selected.before}
                </pre>
              </Card>
            )}
            {selected.after && (
              <Card size="small" title="修改后" data-testid="revision-after">
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#dcfce7', padding: 8, borderRadius: 4 }}>
                  {selected.after}
                </pre>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </>
  )
}

export default ReportRevisionHistory
