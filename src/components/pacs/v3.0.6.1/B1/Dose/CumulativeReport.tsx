/**
 * G005 放射RIS系统 v3.0.6.1 - 累计剂量报告
 */
import React, { useMemo } from 'react'
import { Row, Col, Statistic, Progress, Tag } from 'antd'
import type { DoseRecord } from './DoseTracker'

export interface CumulativeReportProps {
  records: DoseRecord[]
}

export const CumulativeReport: React.FC<CumulativeReportProps> = ({ records }) => {
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; totalDose: number }>()
    records.forEach((r) => {
      const key = `${r.patientId}|${r.patientName}`
      const e = map.get(key) ?? { count: 0, totalDose: 0 }
      e.count += 1
      e.totalDose = Math.round((e.totalDose + r.effectiveDose_mSv) * 100) / 100
      map.set(key, e)
    })
    return Array.from(map.entries()).map(([k, v]) => {
      const [id, name] = k.split('|')
      return { patientId: id, patientName: name, ...v }
    }).sort((a, b) => b.totalDose - a.totalDose)
  }, [records])

  return (
    <div data-testid="cumulative-report">
      <Row gutter={8} style={{ marginBottom: 8 }}>
        <Col span={8}><Statistic title="累计患者" value={grouped.length} styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={8}><Statistic title="累计剂量" value={records.reduce((s, r) => s + r.effectiveDose_mSv, 0).toFixed(1)} suffix="mSv" styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={8}><Statistic title="高累积" value={grouped.filter((g) => g.totalDose > 20).length} styles={{ content: {  fontSize: 14, color: '#dc2626'  } }} /></Col>
      </Row>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {grouped.map((g) => (
          <div key={g.patientId} style={{ marginBottom: 6, padding: 6, background: '#f8fafc', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{g.patientName} <Tag>{g.patientId}</Tag></span>
              <span>{g.count} 次 · {g.totalDose} mSv</span>
            </div>
            <Progress
              percent={Math.min((g.totalDose / 50) * 100, 100)}
              showInfo={false}
              size="small"
              strokeColor={g.totalDose > 20 ? '#dc2626' : g.totalDose > 10 ? '#f59e0b' : '#16a34a'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default CumulativeReport