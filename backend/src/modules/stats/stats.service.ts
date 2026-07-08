import { Injectable } from '@nestjs/common'

interface QualityScoreTrend {
  date: string
  avgScore: number
  passRate: number
}

interface WorkloadCell {
  doctor: string
  day: string
  hour: string
  count: number
}

interface TimelinessItem {
  name: string
  onTime: number
  late: number
}

interface AccuracyData {
  name: string
  value: number
  color: string
}

export interface StatsDashboardData {
  qualityTrend: QualityScoreTrend[]
  workload: WorkloadCell[]
  timeliness: TimelinessItem[]
  accuracy: {
    data: AccuracyData[]
    overallRate: number
    totalCases: number
  }
}

const DOCTORS = ['张医生', '李医生', '王医生', '赵医生', '陈医生']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

@Injectable()
export class StatsService {
  async getDashboardData(): Promise<StatsDashboardData> {
    return {
      qualityTrend: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 86400000).toISOString().slice(0, 10),
        avgScore: 85 + Math.round(Math.random() * 10 - 3),
        passRate: 92 + Math.round(Math.random() * 6 - 2),
      })),
      workload: DOCTORS.flatMap((doctor) =>
        DAYS.flatMap((day) =>
          Array.from({ length: 12 }, (_, i) => ({
            doctor,
            day,
            hour: `${i + 8}:00`,
            count: Math.round(Math.random() * 40),
          }))
        )
      ),
      timeliness: DOCTORS.map((name) => ({
        name,
        onTime: 80 + Math.round(Math.random() * 15),
        late: Math.round(Math.random() * 10),
      })),
      accuracy: {
        data: [
          { name: '准确', value: 88, color: '#10b981' },
          { name: '基本准确', value: 8, color: '#f59e0b' },
          { name: '需修正', value: 3, color: '#ef4444' },
          { name: '不准确', value: 1, color: '#6b7280' },
        ],
        overallRate: 88,
        totalCases: 1523,
      },
    }
  }
}
