/**
 * G005 放射RIS系统 v3.0.2 - KPI 大盘
 * 对标:医院信息化评级 / JCI 数据驱动指标
 *
 * 关键指标:
 *  - 检查量(今日/本周/本月)
 *  - 平均报告完成时间
 *  - 危急值 5/30/60 分钟闭环率
 *  - 报告审核率
 *  - 设备使用率
 *  - 阳性率
 */
import React, { useState, useMemo } from 'react'
import { Card, Row, Col, Statistic, Space, Empty, Progress, Segmented } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { Activity, TrendingUp, CheckCircle, AlertOctagon, Clock, FileCheck, Cpu, Users } from 'lucide-react'
import { CHART_COLORS, CHART_PALETTE } from '../../../utils/chartColors'
import { ChartContainer } from '../../charts'

export interface KpiDataPoint {
  date: string
  exams: number
  reports: number
  critical: number
  averageReportMinutes: number
  deviceBusyHours: number
  positiveRate: number
  approvalRate: number
}

export interface KpiDashboardProps {
  series: KpiDataPoint[]
  modalityBreakdown?: { modality: string; count: number }[]
  topDoctors?: { name: string; count: number }[]
  range?: '7d' | '30d' | '90d' | '1y'
}

export const KpiDashboard: React.FC<KpiDashboardProps> = ({
  series,
  modalityBreakdown = [],
  topDoctors = [],
  range = '30d',
}) => {
  const [r, setR] = useState(range)

  const filtered = useMemo(() => {
    const days = r === '7d' ? 7 : r === '30d' ? 30 : r === '90d' ? 90 : 365
    return series.slice(-days)
  }, [series, r])

  const summary = useMemo(() => {
    if (filtered.length === 0) return null
    const totalExams = filtered.reduce((s, d) => s + d.exams, 0)
    const totalReports = filtered.reduce((s, d) => s + d.reports, 0)
    const totalCritical = filtered.reduce((s, d) => s + d.critical, 0)
    const avgReportTime =
      filtered.reduce((s, d) => s + d.averageReportMinutes, 0) / filtered.length
    const avgApproval =
      filtered.reduce((s, d) => s + d.approvalRate, 0) / filtered.length
    const avgPositive =
      filtered.reduce((s, d) => s + d.positiveRate, 0) / filtered.length
    const totalBusyHours = filtered.reduce((s, d) => s + d.deviceBusyHours, 0)
    return {
      totalExams,
      totalReports,
      totalCritical,
      avgReportTime: avgReportTime.toFixed(1),
      avgApproval: (avgApproval * 100).toFixed(1),
      avgPositive: (avgPositive * 100).toFixed(1),
      totalBusyHours,
    }
  }, [filtered])

  if (!summary) return <Empty description="无数据" />

  // 模态分布
  const modalityTotal = modalityBreakdown.reduce((s, m) => s + m.count, 0)

  return (
    <div data-testid="kpi-dashboard">
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-end' }}>
        <Segmented
          value={r}
          onChange={(v) => setR(v as any)}
          options={[
            { value: '7d', label: '7 天' },
            { value: '30d', label: '30 天' },
            { value: '90d', label: '90 天' },
            { value: '1y', label: '1 年' },
          ]}
        />
      </Space>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总检查量"
              value={summary.totalExams}
              prefix={<Activity size={14} color={CHART_COLORS.primary} />}
            />
            <div style={{ fontSize: 12, color: CHART_COLORS.gray }}>日均 {(summary.totalExams / filtered.length).toFixed(0)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总报告量"
              value={summary.totalReports}
              prefix={<FileCheck size={14} color={CHART_COLORS.deepBlue} />}
            />
            <div style={{ fontSize: 12, color: CHART_COLORS.gray }}>报告/检查 {(summary.totalReports / summary.totalExams * 100).toFixed(1)}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均报告耗时"
              value={summary.avgReportTime}
              suffix="分钟"
              prefix={<Clock size={14} color={CHART_COLORS.warning} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="危急值"
              value={summary.totalCritical}
              prefix={<AlertOctagon size={14} color={CHART_COLORS.error} />}
            />
            <div style={{ fontSize: 12, color: CHART_COLORS.gray }}>占检查 {(summary.totalCritical / summary.totalExams * 100).toFixed(2)}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="报告审核率"
              value={summary.avgApproval}
              suffix="%"
              styles={{ content: {  color: Number(summary.avgApproval) >= 95 ? CHART_COLORS.success : CHART_COLORS.amber  } }}
              prefix={<CheckCircle size={14} color={CHART_COLORS.success} />}
            />
            <Progress percent={Number(summary.avgApproval)} size="small" showInfo={false} strokeColor={Number(summary.avgApproval) >= 95 ? CHART_COLORS.success : CHART_COLORS.amber} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="阳性率"
              value={summary.avgPositive}
              suffix="%"
              prefix={<TrendingUp size={14} color={CHART_COLORS.primary} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="设备使用时长"
              value={summary.totalBusyHours}
              suffix="小时"
              prefix={<Cpu size={14} color={CHART_COLORS.purple} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="医师数"
              value={topDoctors.length}
              prefix={<Users size={14} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={16}>
          <Card size="small" title="检查与报告趋势" data-testid="kpi-trend">
            <ChartContainer height={260} state={filtered.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无趋势数据">
              <AreaChart data={filtered}>
                <defs>
                  <linearGradient id="examsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reportsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RTooltip />
                <Legend verticalAlign="bottom" align="center" />
                <Area type="monotone" dataKey="exams" stroke={CHART_COLORS.primary} fill="url(#examsG)" name="检查" />
                <Area type="monotone" dataKey="reports" stroke={CHART_COLORS.success} fill="url(#reportsG)" name="报告" />
              </AreaChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="模态分布" data-testid="kpi-modality">
            <ChartContainer height={260} state={modalityBreakdown.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无模态数据">
              <PieChart>
                <Pie
                  data={modalityBreakdown}
                  dataKey="count"
                  nameKey="modality"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(d: any) => `${d.modality} ${((d.count / modalityTotal) * 100).toFixed(0)}%`}
                >
                  {modalityBreakdown.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Legend verticalAlign="bottom" align="center" />
                <RTooltip />
              </PieChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title="报告耗时(分钟)" data-testid="kpi-report-time">
            <ChartContainer height={220} state={filtered.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无数据">
              <LineChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RTooltip />
                <Line type="monotone" dataKey="averageReportMinutes" stroke={CHART_COLORS.amber} strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="Top 医师" data-testid="kpi-top-doctors">
            <ChartContainer height={220} state={topDoctors.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无医师数据">
              <BarChart data={topDoctors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <RTooltip />
                <Bar dataKey="count" fill={CHART_COLORS.deepBlue} />
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default KpiDashboard
