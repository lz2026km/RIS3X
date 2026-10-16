/**
 * [G005 v3.0.6.16-0] 隐私 / DICOM 去标识化 API
 *
 * 此前「研究/科研 - DICOM 脱敏」是前端 setTimeout 伪造的假功能(1.5 秒后弹
 * "脱敏完成(本地模拟)"), 属于医院采购评审会当场戳穿的合规风险点。
 * 现在改为调用后端真实的 DICOM PS3.15 去标识化实现。
 */
import { api } from './client'

export type DeidProfileId = 'basic' | 'hipaa' | 'expert'

export interface DeidProfileOption {
  id: DeidProfileId
  label: string
  description: string
}

export interface DeidProfileInfo {
  standard: string
  profiles: DeidProfileOption[]
  guarantees: string[]
  limitations: string[]
  defaultDateShiftDays: number
}

export interface DeidTagAction {
  tag: string
  keyword: string
  action: 'empty' | 'uid' | 'date-shift' | 'time-normalize' | 'flag'
}

export interface DeidFileReport {
  fileName: string
  sopInstanceUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  bytesIn: number
  bytesOut: number
  actions: DeidTagAction[]
  pixelDataPreserved: boolean
  transferSyntax: string
}

export interface DeidResultDto {
  profile: DeidProfileId
  dateShiftDays: number
  files: DeidFileReport[]
  totalBytesIn: number
  totalBytesOut: number
  cleanedTagCount: number
}

export interface DeidOutputFile {
  name: string
  dataBase64: string
}

/** 读取配置能力说明 (含免责声明, 前端据此渲染) */
export function getDeidProfileInfo() {
  return api.get<DeidProfileInfo>('/privacy/de-identify/profile')
}

/**
 * 执行批量去标识化。
 *
 * @param files 待脱敏的 DICOM 文件 (浏览器 File / ArrayBuffer)
 * @param profile 配置文件, 默认 basic
 * @param dateShiftDays 日期偏移天数, 默认后端配置
 */
export async function deidentifyFiles(
  files: Array<{ name: string; bytes: Uint8Array }>,
  profile: DeidProfileId = 'basic',
  dateShiftDays?: number,
): Promise<{ result: DeidResultDto; files: DeidOutputFile[] }> {
  const payload = {
    profile,
    ...(dateShiftDays !== undefined ? { dateShiftDays } : {}),
    files: files.map((f) => ({
      name: f.name,
      dataBase64: toBase64(f.bytes),
    })),
  }
  const res = await api.post<{ result: DeidResultDto; files: DeidOutputFile[] }>(
    '/privacy/de-identify',
    payload,
  )
  return { result: res.data.result, files: res.data.files ?? [] }
}

/** Uint8Array -> base64 (分块避免大文件 apply 爆栈) */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** base64 -> Blob, 供浏览器下载 */
export function base64ToBlob(dataBase64: string, mime = 'application/dicom'): Blob {
  const binary = atob(dataBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** 读取浏览器 File 为 Uint8Array */
export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}
