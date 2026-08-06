import { api } from './client'


// HL7 API
// Auto-generated from NestJS @Controller('hl7')

export const hl7Api = {
  oru: (data: Record<string, unknown>) => api.post<unknown>('/hl7/oru', data),
  batch: (data: Record<string, unknown>) => api.post<unknown>('/hl7/batch', data),
  orm: (data: Record<string, unknown>) => api.post<unknown>('/hl7/orm', data),
  dft: (data: Record<string, unknown>) => api.post<unknown>('/hl7/dft', data),
  push_oru: (data: Record<string, unknown>) => api.post<unknown>('/hl7/push-oru', data),
  siu: (data: Record<string, unknown>) => api.post<unknown>('/hl7/siu', data),
  siuParse: (data: Record<string, unknown>) => api.post<unknown>('/hl7/siu/parse', data),
}

export default hl7Api
