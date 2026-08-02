/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens Cardiac CT/MR 分析
 * 对标:Siemens syngo.via Cardiac - 冠脉/心功能/瓣膜
 */
import React, { useState } from 'react'
import { Card, Tabs, Row, Col, Statistic } from 'antd'
import { Heart, Activity } from 'lucide-react'
import { EjectionFraction } from './EjectionFraction'
import { WallMotion } from './WallMotion'

export interface CardiacAnalysisData {
  patientId: string
  lv_ef: number
  lv_edv_ml: number
  lv_esv_ml: number
  sv_ml: number
  co_lpm: number
  wallMotionAbnormalities: number
}

const MOCK: CardiacAnalysisData = {
  patientId: 'P001',
  lv_ef: 58,
  lv_edv_ml: 142,
  lv_esv_ml: 60,
  sv_ml: 82,
  co_lpm: 5.4,
  wallMotionAbnormalities: 2,
}

export interface CardiacAnalysisProps {
  data?: CardiacAnalysisData
}

export const CardiacAnalysis: React.FC<CardiacAnalysisProps> = ({ data = MOCK }) => {
  const [tab, setTab] = useState('ef')
  return (
    <div data-testid="cardiac-analysis">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="LVEF"
              value={data.lv_ef}
              suffix="%"
              prefix={<Heart size={14} color="#dc2626" />}
              styles={{ content: {  color: data.lv_ef < 50 ? '#dc2626' : '#16a34a', fontSize: 18  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="EDV" value={data.lv_edv_ml} suffix="mL" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="ESV" value={data.lv_esv_ml} suffix="mL" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="CO" value={data.co_lpm} suffix="L/min" prefix={<Activity size={14} />} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={`心脏分析 - ${data.patientId}`}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'ef', label: '射血分数', children: <EjectionFraction data={data} /> },
            { key: 'wm', label: '室壁运动', children: <WallMotion data={data} /> },
          ]}
        />
      </Card>
    </div>
  )
}

export default CardiacAnalysis