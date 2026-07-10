import { mobileApi } from './api'

export interface WadoThumbnail {
  contentType: string
  body: Blob
  size: number
  width: number
  height: number
}

const thumbnailCache = new Map<string, string>()

function cacheKey(studyUID: string, seriesUID: string, sopUID: string): string {
  return `${studyUID}::${seriesUID}::${sopUID}`
}

export async function wadoRenderThumbnail(
  studyUID: string,
  seriesUID: string,
  sopUID: string,
  viewport: { rows: number; columns: number } = { rows: 128, columns: 128 }
): Promise<WadoThumbnail | null> {
  const token = mobileApi as unknown as { baseUrl: string }
  const baseUrl = token.baseUrl ?? '/api/v1'
  const url = `${baseUrl}/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/rendered?rows=${viewport.rows}&columns=${viewport.columns}`
  const response = await fetch(url, { headers: { Accept: 'image/png,image/jpeg,image/svg+xml' } })
  if (!response.ok) return null
  const body = await response.blob()
  return {
    contentType: response.headers.get('Content-Type') ?? body.type ?? 'image/png',
    body,
    size: body.size,
    width: viewport.columns,
    height: viewport.rows,
  }
}

export async function getThumbnailUrl(
  studyUID: string,
  seriesUID: string,
  sopUID: string,
  viewport?: { rows: number; columns: number }
): Promise<string | null> {
  const key = cacheKey(studyUID, seriesUID, sopUID)
  const cached = thumbnailCache.get(key)
  if (cached) return cached
  const result = await wadoRenderThumbnail(studyUID, seriesUID, sopUID, viewport)
  if (!result) return null
  const objectUrl = URL.createObjectURL(result.body)
  thumbnailCache.set(key, objectUrl)
  return objectUrl
}

export function clearThumbnailCache(): void {
  thumbnailCache.forEach(url => URL.revokeObjectURL(url))
  thumbnailCache.clear()
}

export interface DicomWebMetadata {
  studyInstanceUID?: string
  seriesInstanceUID?: string
  sopInstanceUID?: string
  modality?: string
  patientId?: string
  [key: string]: unknown
}

export async function listStudies(filter: { PatientID?: string; Modality?: string; limit?: number; offset?: number } = {}): Promise<DicomWebMetadata[]> {
  const params = new URLSearchParams()
  if (filter.PatientID) params.set('PatientID', filter.PatientID)
  if (filter.Modality) params.set('Modality', filter.Modality)
  params.set('limit', String(filter.limit ?? 50))
  params.set('offset', String(filter.offset ?? 0))
  return mobileApi.get<DicomWebMetadata[]>(`/dicom-web/studies?${params.toString()}`)
}

export async function listInstances(studyUID: string, seriesUID: string): Promise<DicomWebMetadata[]> {
  return mobileApi.get<DicomWebMetadata[]>(`/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances`)
}
