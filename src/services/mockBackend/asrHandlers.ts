/**
 * G005 RIS - ASR 语音识别 Mock 端点 (Phase 1.4)
 *  - POST /asr/transcribe        : JSON (base64/duration) 转写
 *  - POST /asr/transcribe/audio  : multipart 音频上传转写
 *  - POST /asr/feedback          : 转写纠错反馈
 */
import { http, HttpResponse, delay } from 'msw'
import { API_BASE } from '../api/client'

const MOCK_RESPONSES = [
  '双肺纹理清晰，肺野透亮度正常，未见明确实变影及结节影。心影大小正常，纵隔无增宽，膈面光滑，肋膈角锐利。',
  '肝脏形态大小正常，包膜光滑，实质回声均匀，血管纹理清晰，门静脉主干内径约1.0cm。胆囊大小正常，壁薄光滑，腔内透亮。',
  '双侧侧脑室对称，中线结构居中。各叶脑沟回显示清晰，脑实质内未见异常信号灶。蝶鞍形态正常，垂体显示清晰。',
  '左肺上叶尖后段见一约2.3cm×1.8cm结节影，边缘呈分叶状，可见毛刺征及胸膜牵拉征象。右肺中叶及双肺下叶散在斑片状高密度影。',
]

function mockResult(duration: number) {
  const d = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 30
  const text = MOCK_RESPONSES[d % MOCK_RESPONSES.length] ?? MOCK_RESPONSES[0]!
  const confidence = +(0.85 + (d % 10) / 100).toFixed(2)
  const sentences = text.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean)
  const step = d / sentences.length
  return {
    success: true,
    data: {
      id: `asr-${Date.now()}`,
      text,
      confidence,
      segments: sentences.map((sentence: string, i: number) => ({
        start: Math.round(i * step * 10) / 10,
        end: Math.round((i + 1) * step * 10) / 10,
        text: sentence,
        confidence: +(confidence - (i % 3) * 0.02).toFixed(2),
      })),
      engine: 'mock',
      duration: d,
    },
  }
}

export const asrHandlers = [
  http.post(`${API_BASE}/asr/transcribe/audio`, async ({ request }) => {
    await delay(900)
    let duration = 30
    try {
      const form = await request.formData()
      const raw = form.get('duration')
      if (typeof raw === 'string' && raw) duration = Number(raw)
    } catch {
      /* ignore */
    }
    return HttpResponse.json(mockResult(duration))
  }),

  http.post(`${API_BASE}/asr/transcribe`, async ({ request }) => {
    await delay(700)
    let duration = 30
    try {
      const body = (await request.json()) as { duration?: number }
      if (typeof body?.duration === 'number' && Number.isFinite(body.duration)) duration = body.duration
    } catch {
      /* ignore */
    }
    return HttpResponse.json(mockResult(duration))
  }),

  http.post(`${API_BASE}/asr/feedback`, async () => {
    await delay(150)
    return HttpResponse.json({ success: true })
  }),
]
