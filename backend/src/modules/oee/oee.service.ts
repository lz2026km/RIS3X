import { Injectable } from '@nestjs/common'

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

  private rand(min: number, max: number) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100
  }

  getList() {
    return this.devices.map(d => {
      const availability = this.rand(70, 99)
      const performance = this.rand(75, 98)
      const quality = this.rand(85, 100)
      const oee = Math.round(availability * performance * quality / 10000 * 10) / 10
      const trend: ('up'|'down'|'stable') = (['up','down','stable'] as const)[Math.floor(Math.random() * 3)]
      return { ...d, oee, availability: Math.round(availability * 10) / 10, performance: Math.round(performance * 10) / 10, quality: Math.round(quality * 10) / 10, trend }
    })
  }

  getDetail(deviceId: string) {
    const list = this.getList()
    const device = list.find(d => d.id === deviceId)
    if (!device) return null
    return { ...device, breakdownLoss: this.rand(1, 8), setupLoss: this.rand(1, 5), speedLoss: this.rand(1, 6), defectLoss: this.rand(0.5, 3) }
  }

  getTrend(deviceId: string) {
    const days = ['1/1','1/2','1/3','1/4','1/5','1/6','1/7','1/8','1/9','1/10','1/11','1/12']
    return days.map(d => ({ date: `2025-${d}`, oee: this.rand(60, 95), availability: this.rand(75, 99), performance: this.rand(70, 98), quality: this.rand(85, 100) }))
  }

  getStats() {
    const list = this.getList()
    const oees = list.map(d => d.oee)
    return { highest: Math.max(...oees), lowest: Math.min(...oees), average: Math.round(oees.reduce((a,b)=>a+b,0)/oees.length*10)/10, totalDevices: list.length }
  }
}
