/**
 * G005 放射RIS系统 v3.0.2 - 患者档案 360 视图
 * 对标:飞利浦 IntelliSpace / 卫宁 HIS 患者主索引(MPI)
 */
import { Card, Tabs, Tag, Space, Button, Statistic, Row, Col, Empty, Timeline, Avatar, List } from 'antd'
import { User, Calendar, FileText, AlertOctagon, ImageIcon, Phone, MapPin, IdCard, Shield } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

export interface PatientProfile {
  id: string
  name: string
  gender: 'M' | 'F' | 'O'
  birthDate: string
  age: number
  idCard: string
  phone: string
  address: string
  bloodType?: string
  allergy?: string[]
  chronicDiseases?: string[]
  insurance?: string
  emergencyContact?: { name: string; phone: string; relation: string }
}

export interface PatientExam {
  id: string
  modality: string
  bodyPart: string
  studyDate: string
  studyTime: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  doctor?: string
  reportState?: 'PENDING' | 'IN_REVIEW' | 'APPROVED'
  critical?: boolean
}

export interface PatientReport {
  id: string
  examId: string
  modality: string
  bodyPart: string
  conclusion: string
  author: string
  reportDate: string
  verified: boolean
  radsCategory?: string
  reportState?: 'PENDING' | 'IN_REVIEW' | 'APPROVED'
}

export interface PatientTimelineEvent {
  id: string
  type: 'EXAM' | 'REPORT' | 'CRITICAL' | 'APPOINTMENT' | 'NOTE'
  at: string
  title: string
  description: string
  icon?: React.ReactNode
  color?: string
  link?: string
}

export interface PatientProfile360Props {
  patient: PatientProfile
  exams: PatientExam[]
  reports: PatientReport[]
  timeline: PatientTimelineEvent[]
  onSelectExam?: (id: string) => void
  onSelectReport?: (id: string) => void
}

const GENDER_META = { M: { color: 'blue', label: t('w9e.patientProfile360.genderM') }, F: { color: 'pink', label: t('w9e.patientProfile360.genderF') }, O: { color: 'default', label: t('w9e.patientProfile360.genderO') } } as const

const STATUS_META = {
  SCHEDULED: { color: 'blue', label: t('w9e.patientProfile360.statusScheduled') },
  IN_PROGRESS: { color: 'gold', label: t('w9e.patientProfile360.statusInProgress') },
  COMPLETED: { color: 'green', label: t('w9e.patientProfile360.statusCompleted') },
  CANCELLED: { color: 'red', label: t('w9e.patientProfile360.statusCancelled') },
} as const

const REPORT_STATE_META = {
  PENDING: { color: 'default', label: t('w9e.patientProfile360.reportPending') },
  IN_REVIEW: { color: 'gold', label: t('w9e.patientProfile360.reportInReview') },
  APPROVED: { color: 'green', label: t('w9e.patientProfile360.reportApproved') },
} as const

export const PatientProfile360: React.FC<PatientProfile360Props> = ({
  patient,
  exams,
  reports,
  timeline,
  onSelectExam,
  onSelectReport,
}) => {
  const [tab, setTab] = useState('overview')

  const stats = useMemo(() => {
    const criticalCount = timeline.filter((e) => e.type === 'CRITICAL').length
    return {
      totalExams: exams.length,
      totalReports: reports.length,
      criticalCount,
      chronicCount: patient.chronicDiseases?.length ?? 0,
    }
  }, [exams, reports, timeline, patient])

  return (
    <div data-testid="patient-profile-360">
      <Card style={{ marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col flex="80px">
            <Avatar size={64} icon={<User size={32} />} style={{ background: '#1e40af' }} data-testid="patient-avatar">
              {patient.name[0]}
            </Avatar>
          </Col>
          <Col flex="auto">
            <Space size={8} wrap>
              <h2 style={{ margin: 0 }}>{patient.name}</h2>
              <Tag color={GENDER_META[patient.gender].color}>{GENDER_META[patient.gender].label}</Tag>
              <Tag>{t('w9e.patientProfile360.ageSuffix', { age: patient.age })}</Tag>
              <Tag color="blue">ID: {patient.id}</Tag>
              {patient.bloodType && <Tag color="red">{t('w9e.patientProfile360.bloodType', { type: patient.bloodType })}</Tag>}
              {patient.allergy && patient.allergy.length > 0 && (
                <Tag color="orange" icon={<Shield size={10} />}>{t('w9e.patientProfile360.allergy', { list: patient.allergy.join('/') })}</Tag>
              )}
            </Space>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              <Space size={12} wrap>
                <span><IdCard size={10} /> {t('w9e.patientProfile360.idCard', { id: patient.idCard })}</span>
                <span><Phone size={10} /> {patient.phone}</span>
                <span><MapPin size={10} /> {patient.address}</span>
                {patient.insurance && <span>{t('w9e.patientProfile360.insurance', { name: patient.insurance })}</span>}
              </Space>
            </div>
          </Col>
          <Col flex="280px">
            <Row gutter={8}>
              <Col span={8}>
                <Statistic title={t('w9e.patientProfile360.statExams')} value={stats.totalExams} styles={{ content: {  fontSize: 18  } }} />
              </Col>
              <Col span={8}>
                <Statistic title={t('w9e.patientProfile360.statReports')} value={stats.totalReports} styles={{ content: {  fontSize: 18  } }} />
              </Col>
              <Col span={8}>
                <Statistic title={t('w9e.patientProfile360.statCritical')} value={stats.criticalCount} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: t('w9e.patientProfile360.tabOverview'),
            children: (
              <Row gutter={12}>
                <Col span={16}>
                  <Card size="small" title={t('w9e.patientProfile360.timelineTitle')} data-testid="patient-timeline">
                    {timeline.length === 0 ? (
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.patientProfile360.noVisit')} />
                    ) : (
                      <Timeline
                        items={timeline.map((e) => ({
                          key: e.id,
                          color: e.color,
                          dot: e.icon,
                          children: (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{e.title}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{e.description}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{e.at}</div>
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title={t('w9e.patientProfile360.chronicTitle')} style={{ marginBottom: 12 }}>
                    {patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
                      <Space wrap>
                        {patient.chronicDiseases.map((d) => <Tag key={d} color="orange">{d}</Tag>)}
                      </Space>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('w9e.patientProfile360.none')}</span>
                    )}
                  </Card>
                  <Card size="small" title={t('w9e.patientProfile360.allergyTitle')}>
                    {patient.allergy && patient.allergy.length > 0 ? (
                      <Space wrap>
                        {patient.allergy.map((a) => <Tag key={a} color="red">{a}</Tag>)}
                      </Space>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('w9e.patientProfile360.none')}</span>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'exams',
            label: t('w9e.patientProfile360.examsTab', { count: exams.length }),
            children: (
              <List
                dataSource={exams}
                renderItem={(e) => {
                  const s = STATUS_META[e.status]
                  return (
                    <List.Item
                      key={e.id}
                      data-testid={`exam-item-${e.id}`}
                      actions={onSelectExam ? [<Button key="open" size="small" onClick={() => onSelectExam(e.id)}>{t('w9e.patientProfile360.detail')}</Button>] : undefined}
                    >
                      <List.Item.Meta
                        avatar={<ImageIcon size={28} color="#3b82f6" />}
                        title={
                          <Space>
                            <Tag color="blue">{e.modality}</Tag>
                            <Tag>{e.bodyPart}</Tag>
                            <Tag color={s.color}>{s.label}</Tag>
                            {e.critical && <Tag color="red" icon={<AlertOctagon size={10} />}>{t('w9e.patientProfile360.critical')}</Tag>}
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <Calendar size={10} /> {e.studyDate} {e.studyTime} · {t('w9e.patientProfile360.examDoctor', { name: e.doctor ?? '-' })}
                          </div>
                        }
                      />
                    </List.Item>
                  )
                }}
                locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.patientProfile360.noExam')} /> }}
              />
            ),
          },
          {
            key: 'reports',
            label: t('w9e.patientProfile360.reportsTab', { count: reports.length }),
            children: (
              <List
                dataSource={reports}
                renderItem={(r) => (
                  <List.Item
                    key={r.id}
                    data-testid={`report-item-${r.id}`}
                    actions={onSelectReport ? [<Button key="open" size="small" onClick={() => onSelectReport(r.id)}>{t('w9e.patientProfile360.detail')}</Button>] : undefined}
                  >
                    <List.Item.Meta
                      avatar={<FileText size={28} color="#1e40af" />}
                      title={
                        <Space>
                          <Tag color="blue">{r.modality}</Tag>
                          <Tag>{r.bodyPart}</Tag>
                          {r.reportState && <Tag color={REPORT_STATE_META[r.reportState].color}>{REPORT_STATE_META[r.reportState].label}</Tag>}
                          {r.verified && <Tag color="green">{t('w9e.patientProfile360.verified')}</Tag>}
                          {r.radsCategory && <Tag color="purple">{r.radsCategory}</Tag>}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{r.conclusion.slice(0, 120)}{r.conclusion.length > 120 ? '...' : ''}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('w9e.patientProfile360.reportAuthor', { name: r.author })} · {r.reportDate}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.patientProfile360.noReport')} /> }}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

export default PatientProfile360
