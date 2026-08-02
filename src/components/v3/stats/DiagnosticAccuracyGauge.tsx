import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { Card, Statistic, Row, Col } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { CHART_COLORS } from '../../../utils/chartColors'
import { ChartContainer } from '../../charts'

export interface AccuracyData {
  name: string
  value: number
  color: string
}

interface DiagnosticAccuracyGaugeProps {
  data: AccuracyData[]
  overallRate: number
  totalCases: number
}

export default function DiagnosticAccuracyGauge({ data, overallRate, totalCases }: DiagnosticAccuracyGaugeProps) {
  const { t } = useTranslation()

  return (
    <Card title={t('v3statsV2.diagnosticAccuracy')}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic
            title={t('v3statsV2.accuracyRate')}
            value={overallRate}
            suffix="%"
            prefix={<CheckCircleOutlined style={{ color: CHART_COLORS.success }} />}
            styles={{ content: {  color: CHART_COLORS.success  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={t('v3statsV2.totalReports')}
            value={totalCases}
            prefix={<WarningOutlined style={{ color: CHART_COLORS.primary }} />}
          />
        </Col>
      </Row>
      <ChartContainer
        height={250}
        state={data.length === 0 ? 'empty' : 'ready'}
        emptyDescription="暂无诊断数据"
      >
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" align="center" />
        </PieChart>
      </ChartContainer>
    </Card>
  )
}
