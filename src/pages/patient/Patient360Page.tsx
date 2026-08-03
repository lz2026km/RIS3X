import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Timeline, Table, Collapse, Button, Badge, Spin, Alert, Empty } from 'antd'
import {
  User, Phone, Calendar, Activity, Image, AlertTriangle,
  Clock, ShieldAlert, Eye,
} from 'lucide-react'
import { patientApi } from '../../services/api/patientApi'
import { examApi } from '../../services/api/examApi'
import { reportApi } from '../../services/api/reportApi'
import type { PatientDto } from '../../types/dto'
import type { ExamDto } from '../../types/dto'

interface ExamView {
  id: string
  examDate: string
  examItemName: string
  modality: string
  bodyPart?: string
  deviceName?: string
  status: string
  criticalFinding: boolean
  findings?: string
  diagnosis?: string
  radiologistName?: string
  reportId?: string
}

const examStatusColor: Record<string, string> = {
  '已完成': '#16a34a',
  '待出报告': '#d97706',
  '报告已发': '#2563eb',
  '检查中': '#8b5cf6',
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  submitted: '待出报告',
  reviewed: '审核中',
  cosigned: '已双签',
  published: '报告已发',
  completed: '已完成',
  in_progress: '检查中',
  pending: '待出报告',
}

function normalizeStatus(status: string): string {
  if (!status) return '未知'
  if (/[\u4e00-\u9fa5]/.test(status)) return status
  return STATUS_MAP[status.toLowerCase()] || status
}

function toExamView(exam: ExamDto, report?: { findings?: string; diagnosis?: string; impression?: string; doctorId?: string; id?: string }): ExamView {
  return {
    id: exam.id || exam.examId,
    examDate: exam.scheduledAt || '',
    examItemName: exam.examItem || '影像检查',
    modality: exam.modality,
    bodyPart: exam.bodyPart,
    deviceName: exam.deviceName || exam.deviceModel,
    status: normalizeStatus(exam.status),
    criticalFinding: exam.hasCriticalValue === true,
    findings: report?.findings,
    diagnosis: report?.diagnosis || report?.impression,
    radiologistName: report?.doctorId,
    reportId: report?.id || report?.reportId,
  }
}

export default function Patient360Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<PatientDto | null>(null)
  const [exams, setExams] = useState<ExamView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [patientRes, examRes, reportRes] = await Promise.all([
          patientApi.getById(id),
          patientApi.getExams(id),
          patientApi.getReports(id),
        ])
        if (cancelled) return
        if (patientRes.success && patientRes.data) {
          setPatient(patientRes.data as PatientDto)
        } else {
          setPatient(null)
        }
        const rawExams = examRes.success && Array.isArray(examRes.data) ? examRes.data as ExamDto[] : []
        const rawReports = reportRes.success && Array.isArray(reportRes.data) ? reportRes.data as any[] : []
        const reportByExam = new Map<string, any>()
        for (const r of rawReports) {
          if (r.examId) reportByExam.set(r.examId, r)
          if (r.id) reportByExam.set(r.id, r)
        }
        const views = rawExams.map(e => toExamView(e, reportByExam.get(e.id) || reportByExam.get(e.examId)))
        setExams(views)
        if (!patientRes.success && !examRes.success && !reportRes.success) {
          setError('患者数据加载失败，请稍后重试')
        }
      } catch {
        if (!cancelled) setError('患者数据加载失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  const stats = useMemo(() => {
    if (!exams.length) return null
    return {
      totalExams: exams.length,
      positiveCount: exams.filter(ex => ex.criticalFinding || (ex.findings && /异常|占位|肿瘤|癌|结节|梗死|骨折|夹层/.test(ex.findings))).length,
      negativeCount: exams.filter(ex => !ex.criticalFinding && (!ex.findings || !/异常|占位|肿瘤|癌|结节|梗死|骨折|夹层/.test(ex.findings))).length,
      firstExamDate: exams.length ? exams.map(e => e.examDate).filter(Boolean).sort()[0]?.slice(0, 10) || '-' : '-',
    }
  }, [exams])

  const timelineEvents = useMemo(() => {
    return [...exams]
      .sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime())
      .map((ex) => ({
        date: ex.examDate,
        type: ex.modality,
        title: ex.examItemName,
        description: `${ex.modality} · ${ex.bodyPart || ''} · ${ex.deviceName || ''}`,
        status: ex.status,
        isCritical: ex.criticalFinding,
      }))
  }, [exams])

  const criticalExams = useMemo(() => exams.filter((ex) => ex.criticalFinding), [exams])

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip="正在加载患者全景数据...">
          <div style={{ height: 60 }} />
        </Spin>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => navigate('/patients')}>返回患者列表</Button>} />
      </div>
    )
  }

  if (!patient) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        <User size={48} style={{ marginBottom: 16, color: '#cbd5e1' }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>患者不存在或暂无数据</div>
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/patients')}>
          返回患者列表
        </Button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f1f5f9', minHeight: '100vh' }}>
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}
          >
            {patient.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>
              {patient.name}
              {patient.patientType && <Tag color="blue" style={{ marginLeft: 12, fontSize: 12 }}>{patient.patientType}</Tag>}
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
              <span><User size={13} style={{ marginRight: 4 }} />{patient.gender} · {patient.age}岁</span>
              {patient.phone && <span><Phone size={13} style={{ marginRight: 4 }} />{patient.phone}</span>}
              <span><Calendar size={13} style={{ marginRight: 4 }} />ID: {patient.id}</span>
              {patient.birthDate && <span>出生：{patient.birthDate.slice(0, 10)}</span>}
            </div>
          </div>
          <Button
            type="default"
            icon={<Image size={14} />}
            onClick={() => navigate(`/fusion/prior-compare?patientId=${patient.id}`)}
          >
            影像对比
          </Button>
        </div>
      </Card>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: '总检查次数', value: stats.totalExams, color: '#1e40af', bg: '#eff6ff', icon: Activity },
            { label: '阳性/危急', value: stats.positiveCount, color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
            { label: '阴性/正常', value: stats.negativeCount, color: '#16a34a', bg: '#f0fdf4', icon: Clock },
            { label: '首次检查', value: stats.firstExamDate, color: '#64748b', bg: '#f8fafc', icon: Calendar },
          ].map((item) => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <item.icon size={22} style={{ color: item.color }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="历次检查时间线" style={{ borderRadius: 12 }}>
          {timelineEvents.length === 0 ? (
            <Empty description="暂无检查记录" style={{ padding: 24 }} />
          ) : (
            <Timeline
              items={timelineEvents.map((evt) => ({
                color: evt.isCritical ? '#dc2626' : '#3b82f6',
                dot: evt.isCritical ? <Badge dot color="#dc2626"><ShieldAlert size={14} color="#dc2626" /></Badge> : undefined,
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{evt.title}</span>
                      {evt.isCritical && <Tag color="red" style={{ fontSize: 11, lineHeight: '18px' }}>危急值</Tag>}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{evt.description}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <Calendar size={11} style={{ marginRight: 4 }} />
                      {evt.date}
                      <Tag color={examStatusColor[evt.status] || '#64748b'} style={{ marginLeft: 8, fontSize: 11 }}>
                        {evt.status}
                      </Tag>
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>

        <Card title="历次报告摘要" style={{ borderRadius: 12 }}>
          {exams.length === 0 ? (
            <Empty description="暂无报告记录" style={{ padding: 24 }} />
          ) : (
            <Collapse
              ghost
              items={exams.map((ex, idx) => ({
                key: String(idx),
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontWeight: 600, color: ex.criticalFinding ? '#dc2626' : '#1e3a5f' }}>
                      {ex.examItemName}
                      {ex.criticalFinding && <AlertTriangle size={12} style={{ marginLeft: 6, color: '#dc2626' }} />}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{ex.examDate}</span>
                  </div>
                ),
                extra: ex.criticalFinding ? <Tag color="red">危急</Tag> : null,
                children: (
                  <div>
                    <Descriptions size="small" column={1} style={{ fontSize: 13 }}>
                      <Descriptions.Item label="检查日期">{ex.examDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label="检查类型">{ex.modality || '-'}</Descriptions.Item>
                      <Descriptions.Item label="检查部位">{ex.bodyPart || '-'}</Descriptions.Item>
                      <Descriptions.Item label="设备">{ex.deviceName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="状态">{ex.status}</Descriptions.Item>
                      <Descriptions.Item label="影像所见">{ex.findings || '未见明显异常'}</Descriptions.Item>
                      <Descriptions.Item label="诊断意见">{ex.diagnosis || '-'}</Descriptions.Item>
                    </Descriptions>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <Button size="small" icon={<Eye size={12} />} onClick={() => navigate(`/dicom-viewer?examId=${ex.id}`)}>
                        查看影像
                      </Button>
                      {ex.reportId && (
                        <Button size="small" icon={<FileText size={12} />} onClick={() => navigate(`/reports?reportId=${ex.reportId}`)}>
                          查看报告
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </div>

      <Card title="危急值标记" style={{ marginTop: 16, borderRadius: 12 }}>
        {criticalExams.length === 0 ? (
          <Empty description="该患者暂无危急值记录" style={{ padding: 16 }} />
        ) : (
          <Table
            dataSource={criticalExams}
            columns={[
              { title: '检查日期', dataIndex: 'examDate', key: 'examDate', width: 120 },
              {
                title: '检查项目', dataIndex: 'examItemName', key: 'examItemName',
                render: (_, r) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.examItemName}</span>,
              },
              { title: '设备', dataIndex: 'deviceName', key: 'deviceName', width: 120 },
              { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart', width: 100 },
              {
                title: '危急值详情', key: 'criticalFindingDetails',
                render: (_, r) => r.findings || '有危急发现',
              },
              {
                title: '操作', key: 'action', width: 120,
                render: (_, r) => (
                  <Button type="link" danger size="small" onClick={() => navigate(`/critical-value?examId=${r.id}`)}>
                    查看处理
                  </Button>
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Card>
    </div>
  )
}

function FileText({ size }: { size?: number }) {
  return (
    <svg width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
