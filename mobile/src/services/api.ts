import { useMobileStore } from '../store/mobileStore'

const BASE_URL = '/api/v1'

interface RequestConfig {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

class MobileApiClient {
  private baseUrl: string

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl
  }

  private getAuthHeaders(): Record<string, string> {
    const token = useMobileStore.getState().authToken
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = { ...this.getAuthHeaders(), ...config.headers }
    const response = await fetch(url, {
      method: config.method || 'GET',
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: config.signal,
    })
    if (!response.ok) {
      if (response.status === 401) {
        useMobileStore.getState().logout()
      }
      throw new ApiError(response.status, await response.text())
    }
    return response.json() as Promise<T>
  }

  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { signal })
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = useMobileStore.getState().authToken
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }
    return response.json() as Promise<T>
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(`API Error ${status}: ${message}`)
    this.name = 'ApiError'
  }
}

export const mobileApi = new MobileApiClient()

export interface OfflineQueueItem {
  id: string
  endpoint: string
  method: string
  body: unknown
  createdAt: number
  retries: number
}

const offlineQueue: OfflineQueueItem[] = []

export async function enqueueOfflineRequest(endpoint: string, method: string, body: unknown): Promise<void> {
  const item: OfflineQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    endpoint,
    method,
    body,
    createdAt: Date.now(),
    retries: 0,
  }
  offlineQueue.push(item)
  try {
    await syncOfflineQueue()
  } catch {
    // Will retry on next sync
  }
}

export async function syncOfflineQueue(): Promise<void> {
  while (offlineQueue.length > 0) {
    const item = offlineQueue[0]
    try {
      await mobileApi.request(item.endpoint, { method: item.method, body: item.body })
      offlineQueue.shift()
    } catch {
      item.retries++
      if (item.retries >= 5) {
        offlineQueue.shift()
      }
      break
    }
  }
}
