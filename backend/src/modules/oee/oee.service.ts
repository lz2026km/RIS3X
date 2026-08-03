import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class OeeService {
  private readonly devices = [
    { id: 'CT-01', name: 'GE Revolution CT', model: 'Revolution CT', modality: 'CT' },
    { id: 'MR-01', name: 'Siemens Skyra', model: 'Skyra 3T', modality: 'MR' },
    { id: 'DR-01', name: 'Philips DigitalDiagnost', model: 'DigitalDiagnost 4', modality: 'DR' },
    { id: 'DR-02', name: 'Siemens Ysio', model: 'Ysio Max', modality: 'DR' },
    { id: 'CT-02', name: 'Canon Aquilion', model: 'Aquilion ONE', modality: 'CT' },
    { id: 'MG-01', name: 'Hologic Selenia', model: 'Selenia Dimensions', modality: 'MG' },
    { id: 'DSA-01', name: 'GE Innova', model: 'Innova IGS 5', modality: 'DSA' },
  ]

  constructor(private readonly prisma: PrismaService) {}

  private rand(min: number, max: number) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100
  }

  private randomTrend(): 'up' | 'down' | 'stable' {
    return (['up', 'down', 'stable'] as const)[Math.floor(Math.random() * 3)]
  }

  private computeMetrics(d: { id: string; modality: string }) {
    const availability = this.rand(70, 99)
    const performance = this.rand(75, 98)
    const quality = this.rand(85, 100)
    const oee = Math.round(availability * performance * quality / 10000 * 10) / 10
    return {
      ...d,
      oee,
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: Math.round(quality * 10) / 10,
      trend: this.randomTrend(),
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private async persistList(list: Array<ReturnType<typeof this.computeMetrics>>): Promise<void> {
    const date = this.today()
    await this.prisma.oeeRecord.createMany({
      data: list.map(d => ({
        deviceId: d.id,
        date,
        modality: d.modality,
        availability: d.availability,
        performance: d.performance,
        quality: d.quality,
        oee: d.oee,
      })),
      skipDuplicates: true,
    })
  }

  async getList() {
    try {
      const records = await this.prisma.oeeRecord.findMany({
        orderBy: { createdAt: 'desc' },
        distinct: ['deviceId'],
      })
      if (records.length > 0) {
        return records.map(r => {
          const meta = this.devices.find(d => d.id === r.deviceId)
          return {
            id: r.deviceId,
            name: meta?.name ?? r.deviceId,
            model: meta?.model ?? '',
            modality: r.modality,
            oee: r.oee,
            availability: r.availability,
            performance: r.performance,
            quality: r.quality,
            trend: this.randomTrend(),
          }
        })
      }
    } catch {
      // DB unavailable -> fallback to in-memory mock below
    }
    const list = this.devices.map(d => this.computeMetrics(d))
    void this.persistList(list).catch(() => undefined)
    return list
  }

  async getDetail(deviceId: string) {
    const list = await this.getList()
    const device = list.find(d => d.id === deviceId)
    if (!device) return null
    return { ...device, breakdownLoss: this.rand(1, 8), setupLoss: this.rand(1, 5), speedLoss: this.rand(1, 6), defectLoss: this.rand(0.5, 3) }
  }

  async getTrend(deviceId: string) {
    const days = ['1/1','1/2','1/3','1/4','1/5','1/6','1/7','1/8','1/9','1/10','1/11','1/12']
    const trend = days.map(d => {
      const availability = this.rand(75, 99)
      const performance = this.rand(70, 98)
      const quality = this.rand(85, 100)
      const oee = Math.round(availability * performance * quality / 10000 * 10) / 10
      return { date: `2025-${d}`, oee, availability: Math.round(availability * 10) / 10, performance: Math.round(performance * 10) / 10, quality: Math.round(quality * 10) / 10 }
    })
    try {
      await Promise.all(trend.map(p => this.prisma.oeeRecord.upsert({
        where: { deviceId_date: { deviceId, date: p.date } },
        create: {
          deviceId,
          date: p.date,
          modality: this.devices.find(d => d.id === deviceId)?.modality ?? 'UNKNOWN',
          availability: p.availability,
          performance: p.performance,
          quality: p.quality,
          oee: p.oee,
        },
        update: { oee: p.oee, availability: p.availability, performance: p.performance, quality: p.quality },
      })))
    } catch {
      // DB unavailable -> keep in-memory trend result
    }
    return trend
  }

  async getStats() {
    const list = await this.getList()
    const oees = list.map(d => d.oee)
    return { highest: Math.max(...oees), lowest: Math.min(...oees), average: Math.round(oees.reduce((a,b)=>a+b,0)/oees.length*10)/10, totalDevices: list.length }
  }
}
