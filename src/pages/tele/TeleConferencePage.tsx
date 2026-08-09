import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Card, Row, Col, Typography, Empty, Button, Input, Space, message, Spin, Tag } from 'antd'
import { Search, Video, LogOut, Users, Loader2, Inbox } from 'lucide-react'
import { RemoteViewer } from '../../components/tele/RemoteViewer'
import { teleApi, type TeleSession } from '../../services/api'
import { useTranslation } from 'react-i18next'

const { Title, Text } = Typography

interface StudyInfo {
  uid: string
  patientName: string
  patientId: string
  modality: string
  date: string
  description: string
}

const mockStudies: StudyInfo[] = [
  { uid: '1.2.3.4.5.1', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', date: '2026-07-10', description: '胸部CT' },
  { uid: '1.2.3.4.5.2', patientName: 'Li Si', patientId: 'P002', modality: 'MR', date: '2026-07-11', description: '脑部MRI' },
  { uid: '1.2.3.4.5.3', patientName: 'Wang Wu', patientId: 'P003', modality: 'DX', date: '2026-07-12', description: '胸部X光' },
]

export const TeleConferencePage: React.FC = () => {
  const { t } = useTranslation('tele')
  const [initialUrlSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('session') ?? ''
  })
  const [sessionId, setSessionId] = useState(initialUrlSessionId)
  const [session, setSession] = useState<TeleSession | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [activeStudy, setActiveStudy] = useState<StudyInfo | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [conferenceStarted, setConferenceStarted] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinSessionId, setJoinSessionId] = useState(initialUrlSessionId)
  const [joinName, setJoinName] = useState('')
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [identity] = useState(() => ({
    userId: `user-${Math.random().toString(36).slice(2, 8)}`,
    userName: `Dr. ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  }))

  const filteredStudies = mockStudies.filter(s =>
    s.patientName.toLowerCase().includes(searchText.toLowerCase()) ||
    s.patientId.toLowerCase().includes(searchText.toLowerCase())
  )

  // 有 ?session= 参数时自动查询会话状态
  useEffect(() => {
    if (!initialUrlSessionId) return
    const check = async () => {
      const res = await teleApi.getSession(initialUrlSessionId)
      if (res.success && res.data && (res.data as { status?: string }).status !== 'not_found') {
        setSession(res.data)
      }
    }
    void check()
  }, [initialUrlSessionId])

  // 会议进行中轮询会话状态
  useEffect(() => {
    if (!conferenceStarted || !sessionId) return
    if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    statusTimerRef.current = setInterval(async () => {
      const res = await teleApi.getSession(sessionId)
      if (res.success && res.data && (res.data as { status?: string }).status !== 'not_found') {
        setSession(prev => (prev && res.data!.id === prev.id ? { ...prev, status: res.data!.status } : prev))
      }
    }, 4000)
    return () => {
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    }
  }, [conferenceStarted, sessionId])

  const handleStartConference = useCallback(async () => {
    if (selectedStudies.length === 0) return
    setCreating(true)
    setSessionError(null)
    try {
      const res = await teleApi.createSession({
        hostId: identity.userId,
        hostName: identity.userName,
        studyUids: selectedStudies,
      })
      if (!res.success || !res.data) {
        setSessionError(res.error?.message ?? t('createFailed', '创建会议失败'))
        message.error(res.error?.message ?? t('createFailed', '创建会议失败'))
        return
      }
      setSession(res.data)
      setSessionId(res.data.id)
      setActiveStudy(mockStudies.find(s => s.uid === selectedStudies[0]) ?? null)
      setConferenceStarted(true)
    } catch (e) {
      setSessionError((e as Error)?.message ?? t('createFailed', '创建会议失败'))
      message.error(t('createFailed', '创建会议失败'))
    } finally {
      setCreating(false)
    }
  }, [selectedStudies, identity, t])

  const handleJoin = useCallback(async () => {
    const target = joinSessionId.trim()
    if (!target) {
      message.warning(t('joinIdRequired', '请输入会话 ID'))
      return
    }
    setJoining(true)
    setSessionError(null)
    try {
      const res = await teleApi.joinSession({
        sessionId: target,
        guestId: identity.userId,
        guestName: joinName.trim() || identity.userName,
      })
      if (!res.success || !res.data) {
        setSessionError(res.error?.message ?? t('joinFailed', '加入会议失败'))
        message.error(res.error?.message ?? t('joinFailed', '加入会议失败'))
        return
      }
      setSession(res.data)
      setSessionId(res.data.id)
      setConferenceStarted(true)
      message.success(t('joined', '已加入会议'))
    } catch (e) {
      setSessionError((e as Error)?.message ?? t('joinFailed', '加入会议失败'))
      message.error(t('joinFailed', '加入会议失败'))
    } finally {
      setJoining(false)
    }
  }, [joinSessionId, joinName, identity, t])

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await teleApi.endSession(sessionId)
      if (res.success) message.success(t('ended', '会议已结束'))
    } catch (e) {
      console.warn('[tele] endSession failed:', e)
    }
    setConferenceStarted(false)
    setSession(null)
    setSessionId('')
    setJoinSessionId('')
  }, [sessionId, t])

  if (!conferenceStarted) {
    return (
      <div style={{ padding: 24, height: '100%', background: '#0f172a', color: '#e2e8f0' }}>
        <Title level={4} style={{ color: '#e2e8f0', marginBottom: 8 }}>{t('conferenceRoom', '远程会议室')}</Title>
        <Text style={{ color: '#94a3b8', display: 'block', marginBottom: 24 }}>
          {t('conferenceDesc', '搜索患者，选择检查，开始实时协同阅片。')}
        </Text>

        <Row gutter={16}>
          <Col span={10}>
            <Card
              title={<span style={{ color: '#e2e8f0' }}>{t('patientSearch', '患者与检查搜索')}</span>}
              style={{ background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}
              headStyle={{ borderBottom: '1px solid #334155' }}
            >
              <Input
                prefix={<Search size={14} color="#64748b" />}
                placeholder={t('searchPlaceholder', '按患者姓名/ID 搜索...')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ marginBottom: 12, background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
              />
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredStudies.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={<Text style={{ color: '#64748b' }}>{t('noStudies', '未找到检查')}</Text>} />
                ) : (
                  filteredStudies.map(s => (
                    <div
                      key={s.uid}
                      onClick={() => setSelectedStudies(prev => prev.includes(s.uid) ? prev.filter(u => u !== s.uid) : [...prev, s.uid])}
                      style={{
                        padding: '8px 12px',
                        marginBottom: 4,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: selectedStudies.includes(s.uid) ? '#334155' : 'transparent',
                        border: '1px solid #334155',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => { if (!selectedStudies.includes(s.uid)) e.currentTarget.style.background = '#1e293b' }}
                      onMouseLeave={e => { if (!selectedStudies.includes(s.uid)) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{s.patientName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.modality} | {s.date} | {s.description}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>ID: {s.patientId} | UID: {s.uid.slice(0, 20)}...</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Col>
          <Col span={14}>
            <Card
              title={<span style={{ color: '#e2e8f0' }}>{t('sessionSetup', '会话设置')}</span>}
              style={{ background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}
              headStyle={{ borderBottom: '1px solid #334155' }}
            >
              {sessionError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca', borderRadius: 4, fontSize: 12 }}>
                  {sessionError}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>{t('selectedStudies', '已选检查')}</Text>
                  {selectedStudies.length === 0 ? (
                    <Text style={{ color: '#64748b', fontSize: 12 }}>{t('noSelection', '请从左侧选择检查')}</Text>
                  ) : (
                    selectedStudies.map(uid => {
                      const s = mockStudies.find(st => st.uid === uid)
                      return s ? (
                        <div key={uid} style={{ padding: '4px 8px', background: '#0f172a', borderRadius: 4, marginBottom: 4, fontSize: 12, color: '#cbd5e1' }}>
                          {s.patientName} - {s.description} ({s.modality})
                        </div>
                      ) : null
                    })
                  )}
                </div>
                <Button
                  type="primary"
                  icon={creating ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                  onClick={handleStartConference}
                  disabled={selectedStudies.length === 0 || creating}
                  loading={creating}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('startConference', '开始会议')}
                </Button>

                <div style={{ borderTop: '1px solid #334155', paddingTop: 16 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>{t('joinDesc', '作为受邀嘉宾加入已有会议')}</Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder={t('sessionId', '会话 ID')}
                      value={joinSessionId}
                      onChange={e => setJoinSessionId(e.target.value)}
                      style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                    />
                    <Input
                      placeholder={t('guestName', '嘉宾姓名(可选)')}
                      value={joinName}
                      onChange={e => setJoinName(e.target.value)}
                      style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0', width: 160 }}
                    />
                    <Button
                      type="default"
                      icon={joining ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                      onClick={handleJoin}
                      loading={joining}
                      style={{ color: '#e2e8f0', borderColor: '#334155', background: '#1e293b' }}
                    >
                      {t('joinConference', '加入')}
                    </Button>
                  </Space.Compact>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space size={12}>
          <Title level={5} style={{ color: '#e2e8f0', margin: 0 }}>{t('activeConference', '进行中会议')}</Title>
          {(() => {
            const raw = session as unknown as { status?: string; id?: string; hostName?: string; guestName?: string } | null
            const sStatus = raw?.status ?? '...'
            return (
              <>
                <Tag color={sStatus === 'connected' ? 'green' : sStatus === 'waiting' ? 'blue' : 'default'} style={{ margin: 0, fontFamily: 'monospace' }}>
                  {sStatus}
                </Tag>
                {session && (
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                    ID: {raw?.id} · 主持: {raw?.hostName}{raw?.guestName ? ` · 嘉宾: ${raw.guestName}` : ' · 等待嘉宾...'}
                  </Text>
                )}
              </>
            )
          })()}
          {activeStudy && (
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>
              {activeStudy.patientName} | {activeStudy.modality} | {activeStudy.date}
            </Text>
          )}
        </Space>
        <Space size={8}>
          <Button size="small" icon={<LogOut size={12} />} onClick={handleEndSession} style={{ color: '#f87171' }}>
            {t('endConference', '结束会议')}
          </Button>
          <Button size="small" onClick={() => setConferenceStarted(false)} style={{ color: '#94a3b8' }}>
            {t('backToSetup', '返回设置')}
          </Button>
        </Space>
      </div>
      {!sessionId ? (
        <Spin spinning style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <RemoteViewer
              sessionId={sessionId}
              userId={identity.userId}
              userName={identity.userName}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default TeleConferencePage
