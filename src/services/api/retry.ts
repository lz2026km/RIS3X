export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  shouldRetry?: (error: unknown) => boolean
  onUnauthorized?: () => Promise<boolean>
}

function isStatus(err: unknown, status: number): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === status
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error: unknown) => {
    if (isStatus(error, 429)) return true
    if (error instanceof TypeError) return true
    if (typeof error === 'object' && error !== null) {
      const e = error as { code?: string; status?: number }
      if (e.code === 'NETWORK_ERROR') return true
      if (e.status && e.status >= 500) return true
    }
    return false
  },
  onUnauthorized: async () => false,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry, onUnauthorized } = {
    ...defaultOptions,
    ...options,
  }

  let lastError: unknown
  let tokenRefreshed = false

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (isStatus(err, 401) && onUnauthorized && !tokenRefreshed) {
        tokenRefreshed = true
        const ok = await onUnauthorized()
        if (ok) {
          attempt--
          continue
        }
      }

      if (attempt < maxRetries && shouldRetry(err)) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        const jitter = delay * 0.1 * Math.random()
        await new Promise((r) => setTimeout(r, delay + jitter))
      } else {
        throw err
      }
    }
  }

  throw lastError
}
