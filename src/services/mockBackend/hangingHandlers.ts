/**
 * v3.0.6.11-60: Auto-hanging 自动布局 MSW handlers
 * 与后端 backend/src/modules/hanging/ 对齐 (/api/v1/hanging/*)
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

interface MockLayout {
  rows: number
  cols: number
  seriesOrder: string[]
}

interface MockProtocol {
  id: string
  name: string
  modality: string
  bodyPart: string
  layout: MockLayout
  priority: number
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

let seq = 1000

const SEEDS: Omit<MockProtocol, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'CT 头颅 轴位标准', modality: 'CT', bodyPart: 'HEAD', layout: { rows: 1, cols: 1, seriesOrder: ['轴位'] }, priority: 100, description: 'CT 头颅常规: 单视野轴位', enabled: true },
  { name: 'CT 胸部 肺窗+纵隔窗', modality: 'CT', bodyPart: 'CHEST', layout: { rows: 2, cols: 2, seriesOrder: ['轴位-肺窗', '轴位-纵隔窗', '冠状位', '矢状位'] }, priority: 100, description: 'CT 胸部常规: 肺窗/纵隔窗双窗 2×2', enabled: true },
  { name: 'MR 头颅 多序列', modality: 'MR', bodyPart: 'HEAD', layout: { rows: 2, cols: 3, seriesOrder: ['T1', 'T2', 'FLAIR', 'DWI', 'T1增强', 'SWI'] }, priority: 100, description: 'MR 头颅: T1/T2/FLAIR/DWI 六序列 2×3', enabled: true },
  { name: 'DR 胸部 正侧位', modality: 'DR', bodyPart: 'CHEST', layout: { rows: 1, cols: 2, seriesOrder: ['正位', '侧位'] }, priority: 95, description: 'DR 胸部: 正位+侧位 1×2', enabled: true },
  { name: 'CT 腹部 平扫+增强', modality: 'CT', bodyPart: 'ABDOMEN', layout: { rows: 2, cols: 2, seriesOrder: ['平扫', '动脉期', '门脉期', '延迟期'] }, priority: 90, description: 'CT 腹部: 四期对比 2×2', enabled: true },
  { name: 'MR 脊柱 矢冠轴', modality: 'MR', bodyPart: 'SPINE', layout: { rows: 1, cols: 3, seriesOrder: ['矢状位', '冠状位', '轴位'] }, priority: 90, description: 'MR 脊柱: 矢状+冠状+轴位 1×3', enabled: true },
  { name: 'CT 颈椎 骨窗+软窗', modality: 'CT', bodyPart: 'NECK', layout: { rows: 1, cols: 2, seriesOrder: ['骨窗', '软组织窗'] }, priority: 85, description: 'CT 颈椎: 双窗对比 1×2', enabled: true },
  { name: 'MR 膝关节 多序列', modality: 'MR', bodyPart: 'KNEE', layout: { rows: 2, cols: 2, seriesOrder: ['矢状位 PD', '矢状位 T1', '冠状位 PD', '轴位 PD'] }, priority: 80, description: 'MR 膝关节: 矢冠轴四序列 2×2', enabled: true },
]

let protocols: MockProtocol[] = SEEDS.map((s) => ({
  ...s,
  id: `seed-${s.modality.toLowerCase()}-${s.bodyPart.toLowerCase()}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}))

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function findBest(
  protocolsList: MockProtocol[],
  input: { modality: string; bodyPart?: string; seriesCount?: number },
): { p: MockProtocol; score: number; reasons: string[] }[] {
  const modality = (input.modality ?? '').toUpperCase()
  const bodyPart = (input.bodyPart ?? '').toUpperCase()
  const seriesCount = input.seriesCount ?? 0
  return protocolsList
    .filter((p) => p.enabled)
    .map((p) => {
      const capacity = p.layout.rows * p.layout.cols
      let score = 0
      const reasons: string[] = []
      if (p.modality.toUpperCase() === modality && p.bodyPart.toUpperCase() === bodyPart) {
        score += 100
        reasons.push(`模态+部位完全匹配 (${p.modality}/${p.bodyPart})`)
      } else if (p.modality.toUpperCase() === modality) {
        score += 50
        reasons.push(`模态匹配 (${p.modality})`)
      } else if (p.bodyPart.toUpperCase() === bodyPart) {
        score += 40
        reasons.push(`部位匹配 (${p.bodyPart})`)
      } else {
        score += 5
        reasons.push('通用兜底协议')
      }
      if (seriesCount === 0 || seriesCount <= capacity) {
        score += 20
        reasons.push(`序列数 ${seriesCount} 适配 ${capacity} 格布局`)
      } else {
        score -= 10
        reasons.push(`序列数 ${seriesCount} 超出布局 ${capacity} 格, 需翻页`)
      }
      score += p.priority
      return { p, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

export const hangingHandlers = [
  http.get(`${API_BASE}/hanging/protocols`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const modality = url.searchParams.get('modality')?.toUpperCase()
    const bodyPart = url.searchParams.get('bodyPart')?.toUpperCase()
    let rows = clone(protocols)
    if (modality) rows = rows.filter((p) => p.modality.toUpperCase() === modality)
    if (bodyPart) rows = rows.filter((p) => p.bodyPart.toUpperCase() === bodyPart)
    rows.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    return HttpResponse.json({ success: true, data: rows })
  }),

  http.post(`${API_BASE}/hanging/protocols`, async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as Partial<MockProtocol>
    if (!body.name || !body.modality || !body.bodyPart) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: 'name/modality/bodyPart 必填' } }, { status: 400 })
    }
    const now = new Date().toISOString()
    const created: MockProtocol = {
      id: `hp-${++seq}`,
      name: body.name,
      modality: body.modality,
      bodyPart: body.bodyPart,
      layout: body.layout ?? { rows: 1, cols: 1, seriesOrder: [] },
      priority: body.priority ?? 0,
      description: body.description ?? '',
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    }
    protocols = [created, ...protocols]
    return HttpResponse.json({ success: true, data: created })
  }),

  http.put(`${API_BASE}/hanging/protocols/:id`, async ({ params, request }) => {
    await delay(120)
    const id = String(params.id)
    const body = (await request.json()) as Partial<MockProtocol>
    const index = protocols.findIndex((p) => p.id === id)
    if (index < 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Hanging protocol ${id} not found` } }, { status: 404 })
    }
    const updated: MockProtocol = {
      ...protocols[index]!,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    }
    protocols[index] = updated
    return HttpResponse.json({ success: true, data: updated })
  }),

  http.delete(`${API_BASE}/hanging/protocols/:id`, async ({ params }) => {
    await delay(100)
    const id = String(params.id)
    const index = protocols.findIndex((p) => p.id === id)
    if (index < 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Hanging protocol ${id} not found` } }, { status: 404 })
    }
    protocols.splice(index, 1)
    return HttpResponse.json({ success: true, data: { success: true } })
  }),

  http.post(`${API_BASE}/hanging/match`, async ({ request }) => {
    await delay(160)
    const body = (await request.json()) as {
      modality?: string
      bodyPart?: string
      seriesCount?: number
      series?: { description?: string; modality?: string; seriesNumber?: number }[]
    }
    const series = Array.isArray(body.series) ? body.series : []
    const seriesCount = Math.max(body.seriesCount ?? series.length, series.length)
    const scored = findBest(protocols, {
      modality: body.modality ?? '',
      bodyPart: body.bodyPart ?? '',
      seriesCount,
    })
    const best = scored[0]
    if (!best) {
      return HttpResponse.json({
        success: true,
        data: {
          protocol: null,
          layout: { rows: 1, cols: 1, seriesOrder: [] },
          score: 0,
          reasons: ['无可用协议'],
          cells: [],
          candidates: [],
        },
      })
    }
    const capacity = best.p.layout.rows * best.p.layout.cols
    const names = series.slice(0, capacity).map((s) => s.description ?? s.modality ?? `序列${s.seriesNumber ?? ''}`)
    const order = best.p.layout.seriesOrder.length > 0 ? best.p.layout.seriesOrder : names
    const cells = Array.from({ length: capacity }, (_, index) => ({
      index,
      series: order[index] ?? names[index],
      empty: !order[index] && !names[index],
    }))
    return HttpResponse.json({
      success: true,
      data: {
        protocol: best.p,
        layout: best.p.layout,
        score: best.score,
        reasons: best.reasons,
        cells,
        candidates: scored.slice(0, 3).map((c) => ({ id: c.p.id, name: c.p.name, score: c.score })),
      },
    })
  }),
]
