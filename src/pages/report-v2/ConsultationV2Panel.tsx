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
import { StatCard, StatCardGrid } from '../../components/common'
import { useAuth } from '../../hooks/useAuth'
import { t } from '../../i18n/appI18n'

const { Text } = Typography
const { TextArea } = Input

const roomStatusMap: Record<string, { color: string; labelKey: string }> = {
  open: { color: 'default', labelKey: 'consultationV2.statusOpen' },
  in_progress: { color: 'processing', labelKey: 'consultationV2.statusInProgress' },
  voting: { color: 'warning', labelKey: 'consultationV2.statusVoting' },
  concluded: { color: 'success', labelKey: 'consultationV2.statusConcluded' },
  cancelled: { color: 'default', labelKey: 'consultationV2.statusCancelled' },
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
      if (!r.success) setError(r.error?.message ?? t('consultationV2.loadFailed'))
    } catch (e) {
      setError((e as Error)?.message ?? t('consultationV2.networkError'))
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
    const viewer = user?.name ?? t('consultationV2.currentUser')
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
        message.success(t('consultationV2.started'))
        await refreshActive(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('consultationV2.startFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.startFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleSend = async () => {
    if (!active || !myMemberId) { message.warning(t('consultationV2.selectSpeaker')); return }
    if (!messageText.trim()) { message.warning(t('consultationV2.enterContent')); return }
    setActionLoading(true)
    try {
      const res = await consultationV2Api.sendMessage(active.id, { memberId: myMemberId, content: messageText })
      if (res.success) {
        setMessageText('')
        await refreshActive(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('consultationV2.sendFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.sendFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.reportId.trim()) { message.warning(t('consultationV2.enterReportId')); return }
    setActionLoading(true)
    try {
      const res = await consultationV2Api.createRoom({
        ...createForm,
        memberCount: createForm.memberCount,
        createdBy: user?.name ?? 'system',
      })
      if (res.success && unwrap<ConsultationRoomV2>(res)) {
        message.success(t('consultationV2.createSuccess'))
        setCreateOpen(false)
        setCreateForm({ reportId: '', reportTitle: '', patientName: '', modality: 'CT', memberCount: 5 })
        void loadData()
      } else {
        message.error(res.error?.message ?? t('consultationV2.createFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.createFailed'))
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
        message.success(t('consultationV2.voteSuccess', { opinion: voteOpinion === 'approve' ? t('consultationV2.opinionApprove') : voteOpinion === 'reject' ? t('consultationV2.opinionReject') : t('consultationV2.opinionModify') }))
        setVoteOpen(false)
        setVoteComment('')
        await refreshActive(active.id)
        await refreshSummary(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('consultationV2.voteFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.voteFailed'))
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
        message.success(t('consultationV2.concludeSuccess'))
        setConcludeOpen(false)
        setFinalOpinion('')
        await refreshActive(active.id)
        await refreshSummary(active.id)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('consultationV2.concludeFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.concludeFailed'))
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
        message.error(res.error?.message ?? t('consultationV2.exportFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('consultationV2.exportFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const memberVoteOf = (room: ConsultationRoomV2, memberId: string) => room.votes.find(v => v.memberId === memberId)

  return (
    <div>
      <Card
        title={<Space><Users size={16} color="var(--color-primary-600)" /><span>{t('consultationV2.panelTitle')}</span><Tag color="blue">{t('consultationV2.multiPartyTag')}</Tag></Space>}
        extra={<Button type="primary" icon={<PlusCircle size={14} />} onClick={() => setCreateOpen(true)}>{t('consultationV2.createRoom')}</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <StatCardGrid minWidth={160} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t('consultationV2.statRooms')} value={stats?.totalRooms ?? 0} icon={<Users size={14} />} />
          <StatCard title={t('consultationV2.statusInProgress')} value={stats?.byStatus.in_progress ?? 0} />
          <StatCard title={t('consultationV2.statusVoting')} value={stats?.byStatus.voting ?? 0} />
          <StatCard title={t('consultationV2.statusConcluded')} value={stats?.concludedCount ?? 0} icon={<Award size={14} />} />
          <StatCard title={t('consultationV2.statMessages')} value={stats?.totalMessages ?? 0} icon={<MessageSquareText size={14} />} />
          <StatCard title={t('consultationV2.statVotes')} value={stats?.totalVotes ?? 0} icon={<Vote size={14} />} />
        </StatCardGrid>
        <Row gutter={16}>
          <Col span={10}>
            <List
              size="small" loading={loading} dataSource={rooms}
              renderItem={room => (
                <List.Item
                  actions={[
                    <Button key="open" size="small" type={active?.id === room.id ? 'primary' : 'default'}
                      onClick={() => void openRoom(room)}>{t('consultationV2.enter')}</Button>,
                    ]}
                  >
                  <List.Item.Meta
                    title={<Space>
                      <Text strong>{room.reportTitle}</Text>
                      <Tag color={roomStatusMap[room.status]?.color}>{t(roomStatusMap[room.status]?.labelKey ?? room.status)}</Tag>
                    </Space>}
                    description={t('consultationV2.roomDesc', { reportId: room.reportId, patientName: room.patientName, modality: room.modality, members: room.members.length, messages: room.messages.length })}
                  />
                </List.Item>
              )}
            />
          </Col>
          <Col span={14}>
            {!active ? (
              <Empty description={t('consultationV2.selectRoomHint')} style={{ paddingTop: 40 }} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card size="small"
                  title={<Space>
                    <Text strong>{active.reportTitle}</Text>
                    <Tag color={roomStatusMap[active.status]?.color}>{t(roomStatusMap[active.status]?.labelKey ?? active.status)}</Tag>
                    {active.conclusion && <Tag color="success">{t('consultationV2.signedCount', { count: active.conclusion.signatures.length })}</Tag>}
                  </Space>}
                  extra={<Space>
                    {active.status === 'open' && <Button size="small" icon={<PlayCircle size={13} />} onClick={() => void handleStart()}>{t('consultationV2.startConsultation')}</Button>}
                    {active.status !== 'concluded' && active.status !== 'cancelled' && (
                      <>
                        <Button size="small" icon={<Vote size={13} />} onClick={() => setVoteOpen(true)}>{t('consultationV2.vote')}</Button>
                        <Button size="small" type="primary" icon={<FileCheck2 size={13} />} onClick={() => setConcludeOpen(true)}>{t('consultationV2.generateConclusion')}</Button>
                      </>
                    )}
                    <Button size="small" icon={<Download size={13} />} onClick={() => void handleExport()}>{t('consultationV2.exportRecord')}</Button>
                    <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { void refreshActive(active.id); void refreshSummary(active.id) }}>{t('consultationV2.refresh')}</Button>
                  </Space>}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text strong>{t('consultationV2.membersTitle', { count: active.members.length })}</Text>
                      <List
                        size="small" dataSource={active.members}
                        renderItem={m => (
                          <List.Item>
                            <Space>
                              {m.role === 'chair' && <Crown size={13} color="var(--color-warning-500)" />}
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
                      <Text strong>{t('consultationV2.messageStream')}</Text>
                      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-default, rgba(0,0,0,0.12))', borderRadius: 6, padding: 8 }}>
                        {active.messages.length === 0 ? (
                          <Empty description={t('consultationV2.noMessages')} />
                        ) : (
                          <Timeline
                            items={[...active.messages].sort((a, b) => a.seq - b.seq).map(m => ({
                              children: (
                                <div>
                                  <Space size={6}>
                                    <Tag color={m.role === 'chair' ? 'gold' : 'blue'}>{`#${m.seq}`}</Tag>
                                    <Text strong>{m.memberName}</Text>
                                    <Text type="secondary">{m.role === 'chair' ? t('consultationV2.chair') : t('consultationV2.committeeMember')}</Text>
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
                          placeholder={t('consultationV2.inputPlaceholder')} onPressEnter={() => void handleSend()} />
                        <Button type="primary" icon={<PenLine size={14} />} loading={actionLoading} onClick={() => void handleSend()}>{t('consultationV2.speak')}</Button>
                      </Space.Compact>
                    </Col>
                  </Row>
                  {summary && (
                    <Divider style={{ margin: '12px 0' }} />
                  )}
                  {summary && (
                    <Row gutter={16}>
                      <Col span={4}><Statistic title={t('consultationV2.statVoted')} value={summary.votedCount} suffix={`/ ${summary.totalMembers}`} /></Col>
                      <Col span={4}><Statistic title={t('consultationV2.statApprove')} value={summary.approveCount} valueStyle={{ color: 'var(--color-success-600)' }} /></Col>
                      <Col span={4}><Statistic title={t('consultationV2.statReject')} value={summary.rejectCount} valueStyle={{ color: 'var(--color-error-500)' }} /></Col>
                      <Col span={4}><Statistic title={t('consultationV2.statModify')} value={summary.modifyCount} valueStyle={{ color: 'var(--color-warning-500)' }} /></Col>
                      <Col span={4}><Statistic title={t('consultationV2.approveRate')} value={summary.approveRate} suffix="%" /></Col>
                      <Col span={4}>
                        <Text type="secondary">{t('consultationV2.pendingVote', { members: summary.pendingMembers.join('、') || t('consultationV2.noPending') })}</Text>
                      </Col>
                    </Row>
                  )}
                  {active.conclusion && (
                    <Alert type="success" showIcon style={{ marginTop: 8 }}
                      title={t('consultationV2.conclusionTitle')}
                      description={
                        <div>
                          <Text style={{ whiteSpace: 'pre-wrap' }}>{active.conclusion.finalOpinion}</Text>
                          <Divider style={{ margin: '8px 0' }} />
                          <Text strong>{t('consultationV2.signatureMembers', { count: active.conclusion.signatures.length })}</Text>
                          <Space wrap>
                            {active.conclusion.signatures.map(s => (
                              <Tooltip key={s.memberId} title={`${s.title} | ${s.signedAt.slice(0, 19).replace('T', ' ')}`}>
                                <Tag color="gold"><Award size={11} /> {s.name}</Tag>
                              </Tooltip>
                            ))}
                          </Space>
                          <div style={{ marginTop: 4 }}><Text type="secondary">{t('consultationV2.generatedBy', { name: active.conclusion.generatedBy })}</Text></div>
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
      <Modal title={t('consultationV2.createModalTitle')} open={createOpen} onOk={() => void handleCreate()} onCancel={() => setCreateOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder={t('consultationV2.reportIdPlaceholder')} value={createForm.reportId} onChange={e => setCreateForm(p => ({ ...p, reportId: e.target.value }))} />
          <Input placeholder={t('consultationV2.reportTitlePlaceholder')} value={createForm.reportTitle} onChange={e => setCreateForm(p => ({ ...p, reportTitle: e.target.value }))} />
          <Space style={{ width: '100%' }}>
            <Input placeholder={t('consultationV2.patientNamePlaceholder')} value={createForm.patientName} onChange={e => setCreateForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={createForm.modality} onChange={v => setCreateForm(p => ({ ...p, modality: v }))} style={{ width: 90 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <Space>
            <Text>{t('consultationV2.memberCountLabel')}</Text>
            <Select value={createForm.memberCount} onChange={v => setCreateForm(p => ({ ...p, memberCount: v }))} style={{ width: 90 }}
              options={[3, 4, 5, 6].map(n => ({ value: n, label: t('consultationV2.memberCountOption', { count: n }) }))} />
          </Space>
          <Alert type="info" showIcon message={t('consultationV2.createInfo')} />
        </Space>
      </Modal>

      {/* 投票 */}
      <Modal title={t('consultationV2.voteModalTitle')} open={voteOpen} onOk={() => void handleVote()} onCancel={() => { setVoteOpen(false); setVoteComment('') }} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={voteOpinion} onChange={v => setVoteOpinion(v)} style={{ width: 200 }}
            options={[
              { value: 'approve', label: t('consultationV2.opinionApprove') },
              { value: 'reject', label: t('consultationV2.opinionReject') },
              { value: 'modify', label: t('consultationV2.opinionModify') },
            ]} />
          <TextArea rows={3} placeholder={t('consultationV2.voteCommentPlaceholder')} value={voteComment} onChange={e => setVoteComment(e.target.value)} />
          {summary && summary.votedCount > 0 && (
            <Text type="secondary">{t('consultationV2.currentVote', { approve: summary.approveCount, reject: summary.rejectCount, modify: summary.modifyCount, rate: summary.approveRate })}</Text>
          )}
        </Space>
      </Modal>

      {/* 生成结论 */}
      <Modal title={t('consultationV2.concludeModalTitle')} open={concludeOpen} onOk={() => void handleConclude()} onCancel={() => { setConcludeOpen(false); setFinalOpinion('') }} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <TextArea rows={4} placeholder={t('consultationV2.finalOpinionPlaceholder')} value={finalOpinion} onChange={e => setFinalOpinion(e.target.value)} />
          <Alert type="warning" showIcon message={t('consultationV2.concludeInfo')} />
        </Space>
      </Modal>

      {/* 导出记录 */}
      <Modal title={t('consultationV2.exportModalTitle', { title: exportData?.reportTitle ?? '' })} open={!!exportData}
        onCancel={() => setExportData(null)} footer={null} width={720}>
        {exportData && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--bg-primary, #f8fafc)', padding: 12, borderRadius: 6, maxHeight: 480, overflowY: 'auto' }}>
            {exportData.content}
          </pre>
        )}
      </Modal>
    </div>
  )
}

export default ConsultationV2Panel
