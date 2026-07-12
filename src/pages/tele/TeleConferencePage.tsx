import React, { useState, useCallback } from 'react'
import { Card, Row, Col, Typography, Spin, Empty, Button, Select, Input, Space } from 'antd'
import { Search, Video, UserPlus } from 'lucide-react'
import { RemoteViewer } from '../../components/tele/RemoteViewer'
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
  { uid: '1.2.3.4.5.1', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', date: '2026-07-10', description: 'Chest CT' },
  { uid: '1.2.3.4.5.2', patientName: 'Li Si', patientId: 'P002', modality: 'MR', date: '2026-07-11', description: 'Brain MRI' },
  { uid: '1.2.3.4.5.3', patientName: 'Wang Wu', patientId: 'P003', modality: 'DX', date: '2026-07-12', description: 'Chest X-Ray' },
]

export const TeleConferencePage: React.FC = () => {
  const { t } = useTranslation('tele')
  const [sessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('session') ?? `tele-${Date.now().toString(36)}`
  })
  const [activeStudy, setActiveStudy] = useState<StudyInfo | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [conferenceStarted, setConferenceStarted] = useState(false)

  const userId = `user-${Math.random().toString(36).slice(2, 8)}`
  const userName = `Dr. ${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const filteredStudies = mockStudies.filter(s =>
    s.patientName.toLowerCase().includes(searchText.toLowerCase()) ||
    s.patientId.toLowerCase().includes(searchText.toLowerCase())
  )

  const handleStartConference = useCallback(() => {
    if (selectedStudies.length === 0) return
    setActiveStudy(mockStudies.find(s => s.uid === selectedStudies[0]) ?? null)
    setConferenceStarted(true)
  }, [selectedStudies])

  if (!conferenceStarted) {
    return (
      <div style={{ padding: 24, height: '100%', background: '#0f172a', color: '#e2e8f0' }}>
        <Title level={4} style={{ color: '#e2e8f0', marginBottom: 8 }}>{t('conferenceRoom', 'Tele-Conference Room')}</Title>
        <Text style={{ color: '#94a3b8', display: 'block', marginBottom: 24 }}>
          {t('conferenceDesc', 'Search patients, select exams, and start a real-time collaborative review session.')}
        </Text>

        <Row gutter={16}>
          <Col span={10}>
            <Card
              title={<span style={{ color: '#e2e8f0' }}>{t('patientSearch', 'Patient & Study Search')}</span>}
              style={{ background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}
              headStyle={{ borderBottom: '1px solid #334155' }}
            >
              <Input
                prefix={<Search size={14} color="#64748b" />}
                placeholder={t('searchPlaceholder', 'Search patient name / ID...')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ marginBottom: 12, background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
              />
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredStudies.length === 0 ? (
                  <Empty description={<Text style={{ color: '#64748b' }}>{t('noStudies', 'No studies found')}</Text>} />
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
              title={<span style={{ color: '#e2e8f0' }}>{t('sessionSetup', 'Session Setup')}</span>}
              style={{ background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}
              headStyle={{ borderBottom: '1px solid #334155' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>{t('sessionId', 'Session ID')}</Text>
                  <Input value={sessionId} readOnly style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>{t('selectedStudies', 'Selected Studies')}</Text>
                  {selectedStudies.length === 0 ? (
                    <Text style={{ color: '#64748b', fontSize: 12 }}>{t('noSelection', 'No studies selected. Click on studies from the left panel.')}</Text>
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
                  icon={<Video size={14} />}
                  onClick={handleStartConference}
                  disabled={selectedStudies.length === 0}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('startConference', 'Start Conference')}
                </Button>
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
          <Title level={5} style={{ color: '#e2e8f0', margin: 0 }}>{t('activeConference', 'Active Conference')}</Title>
          {activeStudy && (
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>
              {activeStudy.patientName} | {activeStudy.modality} | {activeStudy.date}
            </Text>
          )}
        </Space>
        <Button size="small" onClick={() => setConferenceStarted(false)} style={{ color: '#94a3b8' }}>
          {t('backToSetup', 'Back to Setup')}
        </Button>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RemoteViewer
            sessionId={sessionId}
            userId={userId}
            userName={userName}
          />
        </div>
      </div>
    </div>
  )
}

export default TeleConferencePage
