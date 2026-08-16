import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Tag, Space, Modal, Input, Typography, Row, Col, Statistic,
  message, Alert, List, Select, Empty, Divider, Timeline, Tooltip,
} from 'antd'
import {
  Users, MessageSquareText, Vote, FileCheck2, RefreshCw, PenLine,
  PlusCircle, PlayCircle, Download, Award, Crown,
} from 'lucide-react'
import {
  consultationV2Api,
  type ConsultationRoomV2,
  type VoteSummary,
  type VoteOpinion,
  type ConsultationV2Stats,
  type ExportRecord,
} from '../../services/api/consultationV2Api'
import { useAuth } from '../../hooks/useAuth'

const { Text } = Typography
const { TextArea } = Input

const roomStatusMap: Record<string, { color: string; label: string }> = {
  open: { color: 'default', label: '待开始' },
  in_progress: { color: 'processing', label: '讨论中' },
  voting: { color: 'warning', label: '投票中' },
  concluded: { color: 'success', label: '已结论' },
  cancelled: { color: 'default', label: '已取消' },
}

const opinionColor: Record<VoteOpinion, string> = { approve: 'green', reject: 'red', modify: 'orange' }

/** 解包后端 { success, data } 包装 (兼容裸数据) */
function unwrap<T>(res: { success: boolean; data?: unknown }): T | null {
  if (!res.success) return null
  const d = res.data as { data?: T } | T | null
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: unknown }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

/** [Wave 7C F6] 委员会会诊 V2 面板: 会诊室 + 发言流 + 投票 + 结论 + 导出 */
const ConsultationV2Panel: React.FC = () => {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<ConsultationRoomV2[]>([])
  const [stats, setStats] = useState<ConsultationV2Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<ConsultationRoomV2 | null>(null)
  const [summary, setSummary] = useState<VoteSummary | null>(null)
  const [messageText, setMessageText] = useState('')
  const [myMemberId, setMyMemberId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ reportId: '', reportTitle: '', patientName: '', modality: 'CT', memberCount: 5 })
  const [voteOpen, setVoteOpen] = useState(false)
  const [voteOpinion, setVoteOpinion] = useState<VoteOpinion>('approve')
  const [voteComment, setVoteComment] = useState('')
  const [concludeOpen, setConcludeOpen] = useState(false)
  const [finalOpinion, setFinalOpinion] = useState('')
  const [exportData, setExportData] = useState<ExportRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, s] = await Promise.all([consultationV2Api.listRooms(), consultationV2Api.getStats()])
      const list = unwrap<ConsultationRoomV2[]>(r) ?? []
      setRooms(list)
      setStats(unwrap<ConsultationV2Stats>(s) ?? null)
      if (!r.success) setError(r.error?.message ?? '加载失败')
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const refreshActive = useCallback(async (roomId: string) => {
    const res = await consultationV2Api.getRoom(roomId)
    if (res.success) {
      const room = unwrap<ConsultationRoomV2>(res)
      if (room) {
        setActive(room)
        setRooms(prev => prev.map(r => r.id === roomId ? room : r))
      }
    }
  }, [])

  const refreshSummary = useCallback(async (roomId: string) => {
    const res = await consultationV2Api.voteSummary(roomId)
    if (res.success) setSummary(unwrap<VoteSummary>(res))
  }, [])

  const openRoom = async (room: ConsultationRoomV2) => {
    setActive(room)
    const viewer = user?.name ?? '当前用户'
    const member = room.members.find(m => m.name === viewer) ?? room.members[0] ?? null
    setMyMemberId(member?.id ?? '')
    await refreshSummary(room.id)
  }

  const handleStart = async () => {
    if (!active) return
    setActionLoading(true)
    try {
      const res = await consultationV2Api.startRoom(active.id)
      if (res.success) {
        message.success('会诊已开始')
        await refreshActive(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? '开始失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '开始失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSend = async () => {
    if (!active || !myMemberId) { message.warning('请先在右侧选择发言成员'); return }
    if (!messageText.trim()) { message.warning('请输入发言内容'); return }
    setActionLoading(true)
    try {
      const res = await consultationV2Api.sendMessage(active.id, { memberId: myMemberId, content: messageText })
      if (res.success) {
        setMessageText('')
        await refreshActive(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? '发言失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '发言失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.reportId.trim()) { message.warning('请输入报告编号'); return }
    setActionLoading(true)
    try {
      const res = await consultationV2Api.createRoom({
        ...createForm,
        memberCount: createForm.memberCount,
        createdBy: user?.name ?? 'system',
      })
      if (res.success && unwrap<ConsultationRoomV2>(res)) {
        message.success('会诊室创建成功')
        setCreateOpen(false)
        setCreateForm({ reportId: '', reportTitle: '', patientName: '', modality: 'CT', memberCount: 5 })
        void loadData()
      } else {
        message.error(res.error?.message ?? '创建失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '创建失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVote = async () => {
    if (!active) return
    setActionLoading(true)
    try {
      const res = await consultationV2Api.vote(active.id, { memberId: myMemberId, opinion: voteOpinion, comment: voteComment })
      if (res.success) {
        message.success(`已投票: ${voteOpinion === 'approve' ? '通过' : voteOpinion === 'reject' ? '驳回' : '修改'}`)
        setVoteOpen(false)
        setVoteComment('')
        await refreshActive(active.id)
        await refreshSummary(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? '投票失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '投票失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConclude = async () => {
    if (!active) return
    setActionLoading(true)
    try {
      const res = await consultationV2Api.conclude(active.id, { finalOpinion: finalOpinion || undefined, generatedBy: user?.name ?? 'system' })
      if (res.success) {
        message.success('会诊结论已生成 (含签名列表)')
        setConcludeOpen(false)
        setFinalOpinion('')
        await refreshActive(active.id)
        await refreshSummary(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? '结论生成失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '结论生成失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleExport = async () => {
    if (!active) return
    setActionLoading(true)
    try {
      const res = await consultationV2Api.exportRecord(active.id)
      if (res.success) {
        setExportData(unwrap<ExportRecord>(res))
      } else {
        message.error(res.error?.message ?? '导出失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '导出失败')
    } finally {
      setActionLoading(false)
    }
  }

  const memberVoteOf = (room: ConsultationRoomV2, memberId: string) => room.votes.find(v => v.memberId === memberId)

  return (
    <div>
      <Card
        title={<Space><Users size={16} color="#2563eb" /><span>委员会会诊 V2</span><Tag color="blue">多人合议</Tag></Space>}
        extra={<Button type="primary" icon={<PlusCircle size={14} />} onClick={() => setCreateOpen(true)}>创建会诊室</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title="会诊室" value={stats?.totalRooms ?? 0} prefix={<Users size={14} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="讨论中" value={stats?.byStatus.in_progress ?? 0} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="投票中" value={stats?.byStatus.voting ?? 0} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已结论" value={stats?.concludedCount ?? 0} prefix={<Award size={14} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="总发言" value={stats?.totalMessages ?? 0} prefix={<MessageSquareText size={14} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="总投票" value={stats?.totalVotes ?? 0} prefix={<Vote size={14} />} /></Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={10}>
            <List
              size="small" loading={loading} dataSource={rooms}
              renderItem={room => (
                <List.Item
                  actions={[
                    <Button key="open" size="small" type={active?.id === room.id ? 'primary' : 'default'}
                      onClick={() => void openRoom(room)}>进入</Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Space>
                      <Text strong>{room.reportTitle}</Text>
                      <Tag color={roomStatusMap[room.status]?.color}>{roomStatusMap[room.status]?.label}</Tag>
                    </Space>}
                    description={`${room.reportId} | ${room.patientName} (${room.modality}) | 成员 ${room.members.length} | 发言 ${room.messages.length}`}
                  />
                </List.Item>
              )}
            />
          </Col>
          <Col span={14}>
            {!active ? (
              <Empty description="选择左侧会诊室进入" style={{ paddingTop: 40 }} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card size="small"
                  title={<Space>
                    <Text strong>{active.reportTitle}</Text>
                    <Tag color={roomStatusMap[active.status]?.color}>{roomStatusMap[active.status]?.label}</Tag>
                    {active.conclusion && <Tag color="success">已签名 {active.conclusion.signatures.length} 人</Tag>}
                  </Space>}
                  extra={<Space>
                    {active.status === 'open' && <Button size="small" icon={<PlayCircle size={13} />} onClick={() => void handleStart()}>开始会诊</Button>}
                    {active.status !== 'concluded' && active.status !== 'cancelled' && (
                      <>
                        <Button size="small" icon={<Vote size={13} />} onClick={() => setVoteOpen(true)}>投票</Button>
                        <Button size="small" type="primary" icon={<FileCheck2 size={13} />} onClick={() => setConcludeOpen(true)}>生成结论</Button>
                      </>
                    )}
                    <Button size="small" icon={<Download size={13} />} onClick={() => void handleExport()}>导出记录</Button>
                    <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { void refreshActive(active.id); void refreshSummary(active.id) }}>刷新</Button>
                  </Space>}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text strong>成员 ({active.members.length})</Text>
                      <List
                        size="small" dataSource={active.members}
                        renderItem={m => (
                          <List.Item>
                            <Space>
                              {m.role === 'chair' && <Crown size={13} color="#f59e0b" />}
                              <Text strong={m.id === myMemberId}>{m.name}</Text>
                              <Text type="secondary">{m.title}</Text>
                              {memberVoteOf(active, m.id) && (
                                <Tag color={opinionColor[memberVoteOf(active, m.id)!.opinion]}>
                                  {summary?.opinionLabel[memberVoteOf(active, m.id)!.opinion]}
                                </Tag>
                              )}
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Col>
                    <Col span={16}>
                      <Text strong>发言流 (时序)</Text>
                      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
                        {active.messages.length === 0 ? (
                          <Empty description="暂无发言" />
                        ) : (
                          <Timeline
                            items={[...active.messages].sort((a, b) => a.seq - b.seq).map(m => ({
                              children: (
                                <div>
                                  <Space size={6}>
                                    <Tag color={m.role === 'chair' ? 'gold' : 'blue'}>{`#${m.seq}`}</Tag>
                                    <Text strong>{m.memberName}</Text>
                                    <Text type="secondary">{m.role === 'chair' ? '主持' : '委员'}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{m.at.slice(11, 19)}</Text>
                                  </Space>
                                  <div style={{ marginTop: 2 }}>{m.content}</div>
                                </div>
                              ),
                            }))}
                          />
                        )}
                      </div>
                      <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                        <Select size="middle" style={{ width: 130 }}
                          value={myMemberId}
                          onChange={v => setMyMemberId(v)}
                          options={active.members.map(m => ({ value: m.id, label: `${m.name} (${m.title})` }))} />
                        <Input value={messageText} onChange={e => setMessageText(e.target.value)}
                          placeholder="输入发言内容..." onPressEnter={() => void handleSend()} />
                        <Button type="primary" icon={<PenLine size={14} />} loading={actionLoading} onClick={() => void handleSend()}>发言</Button>
                      </Space.Compact>
                    </Col>
                  </Row>
                  {summary && (
                    <Divider style={{ margin: '12px 0' }} />
                  )}
                  {summary && (
                    <Row gutter={16}>
                      <Col span={4}><Statistic title="已投票" value={summary.votedCount} suffix={`/ ${summary.totalMembers}`} /></Col>
                      <Col span={4}><Statistic title="通过" value={summary.approveCount} valueStyle={{ color: '#16a34a' }} /></Col>
                      <Col span={4}><Statistic title="驳回" value={summary.rejectCount} valueStyle={{ color: '#ef4444' }} /></Col>
                      <Col span={4}><Statistic title="修改" value={summary.modifyCount} valueStyle={{ color: '#f59e0b' }} /></Col>
                      <Col span={4}><Statistic title="通过率" value={summary.approveRate} suffix="%" /></Col>
                      <Col span={4}>
                        <Text type="secondary">待投票: {summary.pendingMembers.join('、') || '无'}</Text>
                      </Col>
                    </Row>
                  )}
                  {active.conclusion && (
                    <Alert type="success" showIcon style={{ marginTop: 8 }}
                      title="会诊结论 (最终意见)"
                      description={
                        <div>
                          <Text style={{ whiteSpace: 'pre-wrap' }}>{active.conclusion.finalOpinion}</Text>
                          <Divider style={{ margin: '8px 0' }} />
                          <Text strong>签名委员 ({active.conclusion.signatures.length}): </Text>
                          <Space wrap>
                            {active.conclusion.signatures.map(s => (
                              <Tooltip key={s.memberId} title={`${s.title} | ${s.signedAt.slice(0, 19).replace('T', ' ')}`}>
                                <Tag color="gold"><Award size={11} /> {s.name}</Tag>
                              </Tooltip>
                            ))}
                          </Space>
                          <div style={{ marginTop: 4 }}><Text type="secondary">生成人: {active.conclusion.generatedBy}</Text></div>
                        </div>
                      }
                    />
                  )}
                </Card>
              </Space>
            )}
          </Col>
        </Row>
      </Card>

      {/* 创建会诊室 */}
      <Modal title="创建委员会会诊室" open={createOpen} onOk={() => void handleCreate()} onCancel={() => setCreateOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="报告编号 (必填)" value={createForm.reportId} onChange={e => setCreateForm(p => ({ ...p, reportId: e.target.value }))} />
          <Input placeholder="会诊标题" value={createForm.reportTitle} onChange={e => setCreateForm(p => ({ ...p, reportTitle: e.target.value }))} />
          <Space style={{ width: '100%' }}>
            <Input placeholder="患者姓名" value={createForm.patientName} onChange={e => setCreateForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={createForm.modality} onChange={v => setCreateForm(p => ({ ...p, modality: v }))} style={{ width: 90 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <Space>
            <Text>成员数量: </Text>
            <Select value={createForm.memberCount} onChange={v => setCreateForm(p => ({ ...p, memberCount: v }))} style={{ width: 90 }}
              options={[3, 4, 5, 6].map(n => ({ value: n, label: `${n} 人` }))} />
          </Space>
          <Alert type="info" showIcon message="未指定成员时按报告编号确定性选取成员 (同报告恒同组合), 首位为主持。" />
        </Space>
      </Modal>

      {/* 投票 */}
      <Modal title="委员投票" open={voteOpen} onOk={() => void handleVote()} onCancel={() => { setVoteOpen(false); setVoteComment('') }} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={voteOpinion} onChange={v => setVoteOpinion(v)} style={{ width: 200 }}
            options={[
              { value: 'approve', label: '通过' },
              { value: 'reject', label: '驳回' },
              { value: 'modify', label: '修改' },
            ]} />
          <TextArea rows={3} placeholder="投票意见 (选填)" value={voteComment} onChange={e => setVoteComment(e.target.value)} />
          {summary && summary.votedCount > 0 && (
            <Text type="secondary">当前: 通过 {summary.approveCount} / 驳回 {summary.rejectCount} / 修改 {summary.modifyCount}, 通过率 {summary.approveRate}%</Text>
          )}
        </Space>
      </Modal>

      {/* 生成结论 */}
      <Modal title="生成会诊结论" open={concludeOpen} onOk={() => void handleConclude()} onCancel={() => { setConcludeOpen(false); setFinalOpinion('') }} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <TextArea rows={4} placeholder="最终意见 (留空则按多数投票自动归纳)" value={finalOpinion} onChange={e => setFinalOpinion(e.target.value)} />
          <Alert type="warning" showIcon message="结论将包含全部已投票成员的签名列表, 会诊状态置为已结论。" />
        </Space>
      </Modal>

      {/* 导出记录 */}
      <Modal title={`会诊记录导出 - ${exportData?.reportTitle ?? ''}`} open={!!exportData}
        onCancel={() => setExportData(null)} footer={null} width={720}>
        {exportData && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fafafa', padding: 12, borderRadius: 6, maxHeight: 480, overflowY: 'auto' }}>
            {exportData.content}
          </pre>
        )}
      </Modal>
    </div>
  )
}

export default ConsultationV2Panel
