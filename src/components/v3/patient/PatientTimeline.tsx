/**
 * G005 放射RIS系统 v3.0.2.2 - 患者全院就诊时间轴
 * 汇总报告/检查/危急值/手术等所有事件
 */
import React, { useState, useMemo } from 'react'
import { Card, Tag, Space, Timeline, Empty, Button, Statistic, Row, Col } from 'antd'
import { History, FileText, ImageIcon, AlertOctagon, Calendar, Activity, Pill, Syringe, FileCheck } from 'lucide-react'

export type TimelineEventType = 'EXAM' | 'REPORT' | 'CRITICAL' | 'SURGERY' | 'MEDICATION' | 'ALLERGY' | 'NOTE' | 'ADMISSION'

export interface PatientTimelineEvent {
  id: string
  type: TimelineEventType
  at: string
  title: string
  description?: string
  actor?: string
  /** 关联资源 */
  link?: string
  /** 严重级(0-3) */
  severity?: number
}

export interface PatientTimelineProps {
  patientId: string
  events: PatientTimelineEvent[]
  /** 初始过滤器 */
  defaultFilter?: TimelineEventType[]
}

const TYPE_META: Record<TimelineEventType, { color: string; label: string; icon: React.ReactNode }> = {
  EXAM: { color: 'blue', label: '检查', icon: <ImageIcon size={12} /> },
  REPORT: { color: 'geekblue', label: '报告', icon: <FileText size={12} /> },
  CRITICAL: { color: 'red', label: '危急值', icon: <AlertOctagon size={12} /> },
  SURGERY: { color: 'magenta', label: '手术', icon: <Activity size={12} /> },
  MEDICATION: { color: 'cyan', label: '用药', icon: <Pill size={12} /> },
  ALLERGY: { color: 'orange', label: '过敏', icon: <Syringe size={12} /> },
  NOTE: { color: 'default', label: '备注', icon: <FileCheck size={12} /> },
  ADMISSION: { color: 'purple', label: '入院', icon: <Calendar size={12} /> },
}

export const PatientTimeline: React.FC<PatientTimelineProps> = ({ patientId, events, defaultFilter }) => {
  const [filter, setFilter] = useState<TimelineEventType[] | 'ALL'>(defaultFilter ?? 'ALL')

  const filtered = useMemo(() => {
    const list = filter === 'ALL' ? events : events.filter((e) => filter.includes(e.type))
    return [...list].sort((a, b) => b.at.localeCompare(a.at))
  }, [events, filter])

  const stats = useMemo(() => {
    return {
      total: events.length,
      exams: events.filter((e) => e.type === 'EXAM').length,
      reports: events.filter((e) => e.type === 'REPORT').length,
      critical: events.filter((e) => e.type === 'CRITICAL').length,
    }
  }, [events])

  const toggleFilter = (t: TimelineEventType) => {
    if (filter === 'ALL') {
      setFilter([t])
    } else {
      if (filter.includes(t)) {
        const next = filter.filter((x) => x !== t)
        setFilter(next.length === 0 ? 'ALL' : next)
      } else {
        setFilter([...filter, t])
      }
    }
  }

  return (
    <Card
      data-testid="patient-timeline-card"
      size="small"
      title={
        <Space>
          <History size={16} color="#1e3a5f" />
          <span>患者就诊时间轴</span>
          <Tag>{patientId}</Tag>
        </Space>
      }
    >
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="总事件" value={stats.total} styles={{ content: {  fontSize: 16  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="检查" value={stats.exams} styles={{ content: {  fontSize: 16, color: '#3b82f6'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="报告" value={stats.reports} styles={{ content: {  fontSize: 16, color: '#1e3a5f'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="危急值" value={stats.critical} styles={{ content: {  fontSize: 16, color: '#dc2626'  } }} />
        </Col>
      </Row>

      <Space wrap style={{ marginBottom: 8 }} data-testid="pt-filter">
        <Button
          size="small"
          type={filter === 'ALL' ? 'primary' : 'default'}
          onClick={() => setFilter('ALL')}
          data-testid="pt-filter-all"
        >
          全部
        </Button>
        {(Object.keys(TYPE_META) as TimelineEventType[]).map((t) => {
          const m = TYPE_META[t]
          const active = filter !== 'ALL' && filter.includes(t)
          return (
            <Button
              key={t}
              size="small"
              type={active ? 'primary' : 'default'}
              icon={m.icon}
              onClick={() => toggleFilter(t)}
              data-testid={`pt-filter-${t}`}
            >
              {m.label}
            </Button>
          )
        })}
      </Space>

      <div data-testid="pt-list" style={{ maxHeight: 360, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty description="无事件" />
        ) : (
          <Timeline
            items={filtered.map((e) => {
              const m = TYPE_META[e.type]
              return {
                key: e.id,
                color: m.color,
                dot: m.icon,
                children: (
                  <div data-testid={`pt-event-${e.id}`}>
                    <Space size={4} wrap>
                      <Tag color={m.color}>{m.label}</Tag>
                      {e.severity && e.severity >= 2 && <Tag color="red" icon={<AlertOctagon size={10} />}>高危</Tag>}
                      <span style={{ fontSize: 13 }}>{e.title}</span>
                    </Space>
                    {e.description && (
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{e.description}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      <Calendar size={10} /> {e.at}
                      {e.actor && <> · {e.actor}</>}
                    </div>
                  </div>
                ),
              }
            })}
          />
        )}
      </div>
    </Card>
  )
}

export default PatientTimeline
