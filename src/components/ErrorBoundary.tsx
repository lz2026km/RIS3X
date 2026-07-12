import { Component, ErrorInfo, ReactNode, createContext, useContext, useState, useCallback } from 'react'
import { AlertCircle, RefreshCw, Home, FileQuestion } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  /** 重新挂载子树的 key 变化触发重试 */
  retryKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
    console.error('ErrorBoundary caught:', error.message)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = (): void => {
    this.handleRetry()
  }

  handleGoHome = (): void => {
    window.location.href = '/'
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24 }}>
          <div style={{ maxWidth: 440, width: '100%', background: '#1e293b', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 24px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>抱歉，出现了一些问题</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>系统遇到意外错误，请尝试刷新或返回首页</p>

            {this.props.showErrorDetails && this.state.error && (
              <div style={{ marginBottom: 24, padding: 16, background: '#0f172a', borderRadius: 8, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#ef4444', wordBreak: 'break-all' }}>{this.state.error.message}</div>
                {this.state.errorInfo && (
                  <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {this.state.errorInfo.componentStack?.split('\n')[0]}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={this.handleRetry} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                <RefreshCw size={16} /> 重试
              </button>
              <button onClick={this.handleReload} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, background: '#2563eb', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                <RefreshCw size={16} /> 刷新页面
              </button>
              <button onClick={this.handleGoHome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, background: '#334155', border: 'none', color: '#f1f5f9', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                <Home size={16} /> 返回首页
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, margin: '0 auto' }}>
                <FileQuestion size={14} /> 查看帮助文档
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

interface ErrorBoundaryProviderProps {
  children: ReactNode
}

interface ErrorBoundaryContextValue {
  captureError: (error: Error, errorInfo?: ErrorInfo) => void
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextValue>({
  captureError: () => {},
})

export function useErrorCapture(): ErrorBoundaryContextValue {
  return useContext(ErrorBoundaryContext)
}

export function ErrorBoundaryProvider({ children }: ErrorBoundaryProviderProps) {
  const [, setErrors] = useState<Array<{ error: Error; timestamp: number }>>([])

  const captureError = useCallback((error: Error, _errorInfo?: ErrorInfo) => {
    console.error('[ErrorBoundaryProvider]', error.message)
    setErrors((prev) => [...prev.slice(-9), { error, timestamp: Date.now() }])
  }, [])

  return (
    <ErrorBoundaryContext.Provider value={{ captureError }}>
      <ErrorBoundary onError={captureError}>{children}</ErrorBoundary>
    </ErrorBoundaryContext.Provider>
  )
}
