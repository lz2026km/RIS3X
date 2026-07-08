export interface DisplayCalibration {
  gamma: number
  luminanceMin: number
  luminanceMax: number
  ambientLight: number
  gsdfCompliant: boolean
}

export interface HdrToneMappingParams {
  method: 'reinhard' | 'aces' | 'filmic'
  exposure: number
  contrast: number
  saturation: number
}

export interface DisplayPipelineResult {
  data: Uint8ClampedArray
  width: number
  height: number
  bitsStored: number
}

export const DEFAULT_CALIBRATION: DisplayCalibration = {
  gamma: 2.2,
  luminanceMin: 0.5,
  luminanceMax: 400,
  ambientLight: 10,
  gsdfCompliant: true,
}

export function applyGsdfLut(
  pixelValue: number,
  bitsStored: number,
  calibration: DisplayCalibration = DEFAULT_CALIBRATION
): number {
  const maxVal = Math.pow(2, bitsStored) - 1
  const normalized = pixelValue / maxVal
  const j = normalized * (calibration.luminanceMax - calibration.luminanceMin) + calibration.luminanceMin
  const a = calibration.ambientLight
  const jMin = calibration.luminanceMin
  const jMax = calibration.luminanceMax
  const perceived = Math.log10((j + a) / (jMin + a)) / Math.log10((jMax + a) / (jMin + a))
  return Math.max(0, Math.min(255, Math.round(perceived * 255)))
}

export function applyHdrToneMapping(
  imageData: ImageData,
  params: HdrToneMappingParams
): DisplayPipelineResult {
  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data.length)
  const exposure = Math.pow(2, params.exposure)

  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] / 255) * exposure
    let g = (data[i + 1] / 255) * exposure
    let b = (data[i + 2] / 255) * exposure

    if (params.method === 'reinhard') {
      r = r / (1 + r)
      g = g / (1 + g)
      b = b / (1 + b)
    } else if (params.method === 'aces') {
      const a = 2.51, bC = 0.03, c = 2.43, d = 0.59, e = 0.14
      r = Math.max(0, Math.min(1, (r * (a * r + bC)) / (r * (c * r + d) + e)))
      g = Math.max(0, Math.min(1, (g * (a * g + bC)) / (g * (c * g + d) + e)))
      b = Math.max(0, Math.min(1, (b * (a * b + bC)) / (b * (c * b + d) + e)))
    } else {
      r = 1 - Math.exp(-r)
      g = 1 - Math.exp(-g)
      b = 1 - Math.exp(-b)
    }

    output[i] = Math.round(r * 255)
    output[i + 1] = Math.round(g * 255)
    output[i + 2] = Math.round(b * 255)
    output[i + 3] = data[i + 3]
  }

  return { data: output, width, height, bitsStored: 8 }
}

export function applyWindowLevel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  windowWidth: number,
  windowCenter: number,
  bitsStored: number = 12
): DisplayPipelineResult {
  const output = new Uint8ClampedArray(data.length)
  const maxVal = Math.pow(2, bitsStored) - 1
  const half = windowWidth / 2
  const low = windowCenter - half
  const high = windowCenter + half

  for (let i = 0; i < data.length; i += 4) {
    const pixel = (data[i] / 255) * maxVal
    let value = ((pixel - low) / (high - low)) * maxVal
    value = Math.max(0, Math.min(maxVal, value))
    const gray = Math.round((value / maxVal) * 255)
    output[i] = gray
    output[i + 1] = gray
    output[i + 2] = gray
    output[i + 3] = data[i + 3]
  }

  return { data: output, width, height, bitsStored }
}

export function getDisplayCalibration(): DisplayCalibration {
  try {
    const raw = localStorage.getItem('g005_display_calibration')
    if (raw) return { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_CALIBRATION
}

export function saveDisplayCalibration(cal: Partial<DisplayCalibration>): void {
  const current = getDisplayCalibration()
  localStorage.setItem('g005_display_calibration', JSON.stringify({ ...current, ...cal }))
}
