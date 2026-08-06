export interface WorkloadPoint {
  date: string
  exams: number
  previousExams: number
}

export interface ModalityUtilization {
  modality: string
  utilizationPercent: number
  availableHours: number
  bookedHours: number
  trend: 'up' | 'down' | 'stable'
}

export interface TatPercentile {
  p25: number
  p50: number
  p75: number
  p95: number
  period: string
}

export interface HourlyDistribution {
  hour: number
  examCount: number
  label: string
}

export interface OperatorProductivity {
  operatorId: string
  operatorName: string
  examsCompleted: number
  avgExamTimeMin: number
  utilizationRate: number
  comparison: number
}

export interface PeakHourAnalysis {
  hourlyData: HourlyDistribution[]
  peakHour: number
  peakCount: number
  averagePerHour: number
}

export interface IOpsAnalyticsService {
  getWorkloadTrend(days: number): Promise<WorkloadPoint[]>
  getModalityUtilization(): Promise<ModalityUtilization[]>
  getTurnaroundTimeStats(period: string): Promise<TatPercentile>
  getPeakHourAnalysis(): Promise<PeakHourAnalysis>
  getOperatorProductivity(period: string): Promise<OperatorProductivity[]>
}

function generateWorkloadData(days: number): WorkloadPoint[] {
  const data: WorkloadPoint[] = []
  const base = 280 + Math.floor(Math.random() * 60)
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const examCount = base + Math.floor(Math.random() * 80 - 40)
    const prevCount = base - 15 + Math.floor(Math.random() * 80 - 40)
    data.push({ date, exams: examCount, previousExams: Math.max(prevCount, 150) })
  }
  return data
}

class MockOpsAnalyticsService implements IOpsAnalyticsService {
  async getWorkloadTrend(days: number): Promise<WorkloadPoint[]> {
    return generateWorkloadData(days)
  }

  async getModalityUtilization(): Promise<ModalityUtilization[]> {
    return [
      { modality: 'CT', utilizationPercent: 91, availableHours: 480, bookedHours: 437, trend: 'up' },
      { modality: 'MRI', utilizationPercent: 84, availableHours: 480, bookedHours: 403, trend: 'up' },
      { modality: 'X-Ray', utilizationPercent: 72, availableHours: 360, bookedHours: 259, trend: 'down' },
      { modality: 'Mammo', utilizationPercent: 65, availableHours: 240, bookedHours: 156, trend: 'stable' },
      { modality: 'Ultrasound', utilizationPercent: 78, availableHours: 360, bookedHours: 281, trend: 'up' },
    ]
  }

  async getTurnaroundTimeStats(period: string): Promise<TatPercentile> {
    return {
      p25: 18, p50: 32, p75: 58, p95: 120,
      period,
    }
  }

  async getPeakHourAnalysis(): Promise<PeakHourAnalysis> {
    const modHours = Array.from({ length: 13 }, (_, i) => i + 8)
    const peakIdx = 6
    const peakVal = 62
    const hourlyData = modHours.map((h, i) => ({
      hour: h,
      examCount: i === peakIdx ? peakVal : 18 + Math.floor(Math.random() * 35),
      label: `${h}:00`,
    }))
    return {
      hourlyData,
      peakHour: 14,
      peakCount: peakVal,
      averagePerHour: Math.round(hourlyData.reduce((s, d) => s + d.examCount, 0) / hourlyData.length),
    }
  }

  async getOperatorProductivity(_period: string): Promise<OperatorProductivity[]> {
    return [
      { operatorId: 'op1', operatorName: '张伟', examsCompleted: 48, avgExamTimeMin: 22, utilizationRate: 92, comparison: 5.2 },
      { operatorId: 'op2', operatorName: '李静', examsCompleted: 45, avgExamTimeMin: 24, utilizationRate: 88, comparison: 2.1 },
      { operatorId: 'op3', operatorName: '王强', examsCompleted: 42, avgExamTimeMin: 26, utilizationRate: 85, comparison: -1.3 },
      { operatorId: 'op4', operatorName: '赵敏', examsCompleted: 38, avgExamTimeMin: 28, utilizationRate: 80, comparison: -4.8 },
      { operatorId: 'op5', operatorName: '刘洋', examsCompleted: 50, avgExamTimeMin: 20, utilizationRate: 95, comparison: 7.6 },
    ]
  }
}

let _instance: IOpsAnalyticsService | null = null

export function getOpsAnalyticsService(): IOpsAnalyticsService {
  if (!_instance) _instance = new MockOpsAnalyticsService()
  return _instance
}
