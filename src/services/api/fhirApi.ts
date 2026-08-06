import { api } from './client'


export interface FhirPatient {
  id?: string
  resourceType: 'Patient'
  identifier?: { system?: string; value: string }[]
  name?: { use?: string; family: string; given: string[] }[]
  gender?: string
  birthDate?: string
  telecom?: { system?: string; value: string }[]
  address?: { line?: string[]; city?: string; district?: string }[]
  photo?: { contentType?: string; data?: string }[]
  generalPractitioner?: { reference?: string; display?: string }[]
  managingOrganization?: { reference?: string; display?: string }[]
  extension?: { url: string; valueString?: string; valueCode?: string }[]
}

export interface FhirObservation {
  id?: string
  resourceType: 'Observation'
  status: string
  category?: { coding: { system?: string; code: string }[] }[]
  code: { coding: { system?: string; code: string; display?: string }[]; text?: string }
  subject?: { reference?: string }
  effectiveDateTime?: string
  valueQuantity?: { value: number; unit?: string; system?: string; code?: string }
  interpretation?: { coding: { system?: string; code: string }[] }[]
  referenceRange?: { low?: { value: number }; high?: { value: number } }[]
}

export interface FhirDiagnosticReport {
  id?: string
  resourceType: 'DiagnosticReport'
  status: string
  category?: { coding: { system?: string; code: string }[] }[]
  code: { coding: { system?: string; code: string; display?: string }[]; text?: string }
  subject?: { reference?: string }
  effectiveDateTime?: string
  issued?: string
  performer?: { reference?: string }[]
  result?: { reference?: string }[]
  presentedForm?: { contentType?: string; data?: string; url?: string }[]
}

export interface FhirImagingStudy {
  id?: string
  resourceType: 'ImagingStudy'
  identifier?: { system?: string; value: string }[]
  status: string
  subject?: { reference?: string }
  started?: string
  numberOfSeries?: number
  numberOfInstances?: number
  procedureCode?: { coding: { system?: string; code: string; display?: string }[] }[]
  location?: { reference?: string }
  reasonCode?: { coding: { system?: string; code: string; display?: string }[] }[]
  series?: {
    uid: string
    number?: number
    modality: { coding: { system?: string; code: string }[] }
    description?: string
    numberOfInstances?: number
    bodySite?: { coding: { system?: string; code: string }[] }
  }[]
}

export interface FhirSubscription {
  id?: string
  resourceType: 'Subscription'
  status: string
  end?: string
  reason: string
  criteria: string
  channel: {
    type: 'rest-hook' | 'websocket' | 'email' | 'sms' | 'message'
    endpoint?: string
    payload?: string
    header?: string[]
  }
}

export interface BulkExportParams {
  _outputFormat?: string
  _since?: string
  _type?: string
}

export interface BulkExportJob {
  jobId: string
  status: 'running' | 'completed' | 'failed'
  output?: { type: string; url: string }[]
  error?: string
  transactionTime?: string
}

export interface SmartConfiguration {
  authorization_endpoint: string
  token_endpoint: string
  capabilities: string[]
  response_types_supported?: string[]
  scopes_supported?: string[]
  [key: string]: unknown
}

export interface FhirSearchResult {
  resourceType: 'Bundle'
  type: 'searchset'
  total?: number
  entry?: { resource: FhirPatient | FhirObservation | FhirDiagnosticReport | FhirImagingStudy; search?: { mode?: string } }[]
}

export const fhirApi = {
  // ════════════════════════════════════════ Patient ════════════════════════
  readPatient: (id: string) => api.get<FhirPatient>(`/fhir/r4/Patient/${id}`),

  searchPatient: (params?: { name?: string; identifier?: string; birthdate?: string; _count?: string; page?: string }) => {
    const qs = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) }) }
    return api.get<FhirSearchResult>(`/fhir/r4/Patient?${qs.toString()}`)
  },

  createPatient: (body: Partial<FhirPatient>) =>
    api.post<FhirPatient>('/fhir/r4/Patient', body),

  updatePatient: (id: string, body: Partial<FhirPatient>) =>
    api.put<FhirPatient>(`/fhir/r4/Patient/${id}`, body),

  deletePatient: (id: string) =>
    api.delete<{ success: boolean }>(`/fhir/r4/Patient/${id}`),

  patientEverything: (id: string) =>
    api.get<FhirSearchResult>(`/fhir/r4/Patient/${id}/$everything`),

  // ════════════════════════════════════ Observation ════════════════════════
  readObservation: (id: string) => api.get<FhirObservation>(`/fhir/r4/Observation/${id}`),

  searchObservation: (params?: { patient?: string; _count?: string; page?: string }) => {
    const qs = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) }) }
    return api.get<FhirSearchResult>(`/fhir/r4/Observation?${qs.toString()}`)
  },

  // ══════════════════════════════════ DiagnosticReport ═════════════════════
  readDiagnosticReport: (id: string) =>
    api.get<FhirDiagnosticReport>(`/fhir/r4/DiagnosticReport/${id}`),

  searchDiagnosticReport: (params?: { patient?: string; status?: string; _count?: string; page?: string }) => {
    const qs = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) }) }
    return api.get<FhirSearchResult>(`/fhir/r4/DiagnosticReport?${qs.toString()}`)
  },

  // ══════════════════════════════════ ImagingStudy ═════════════════════════
  readImagingStudy: (id: string) =>
    api.get<FhirImagingStudy>(`/fhir/r4/ImagingStudy/${id}`),

  searchImagingStudy: (params?: { patient?: string; modality?: string; _count?: string; page?: string }) => {
    const qs = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) }) }
    return api.get<FhirSearchResult>(`/fhir/r4/ImagingStudy?${qs.toString()}`)
  },

  // ══════════════════════════════════ Subscription ═════════════════════════
  createSubscription: (body: Partial<FhirSubscription>) =>
    api.post<FhirSubscription>('/fhir/r4/Subscription', body),

  getSubscription: (id: string) =>
    api.get<FhirSubscription>(`/fhir/r4/Subscription/${id}`),

  searchSubscription: () =>
    api.get<FhirSubscription[]>('/fhir/r4/Subscription'),

  deleteSubscription: (id: string) =>
    api.delete<{ success: boolean }>(`/fhir/r4/Subscription/${id}`),

  // ═══════════════════════════════════ Bulk Export ═════════════════════════
  bulkExport: (params?: BulkExportParams) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) })
    }
    return api.get<{ jobId: string }>(`/fhir/r4/$export?${qs.toString()}`)
  },

  bulkExportStatus: (jobId: string) =>
    api.get<BulkExportJob>(`/fhir/r4/$export-status/${jobId}`),

  // ═══════════════════════════════════ Smart Auth ══════════════════════════
  smartConfiguration: () =>
    api.get<SmartConfiguration>('/fhir/r4/.well-known/smart-configuration'),

  authorize: (params: { client_id: string; redirect_uri: string; scope: string; state: string; patient?: string; encounter?: string; user_id?: string }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v) })
    return api.get<{ redirectUrl: string }>(`/fhir/r4/auth/authorize?${qs.toString()}`)
  },

  token: (code: string, clientId: string) =>
    api.post<{ access_token: string; token_type: string; expires_in: number; scope: string }>('/fhir/r4/auth/token', { code, client_id: clientId }),
}
