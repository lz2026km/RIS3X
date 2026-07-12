import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  override componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info) }
  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>系统异常</h2>
          <p style={{ color: '#64748b' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ padding: '8px 24px', cursor: 'pointer' }}>
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
export default ErrorBoundary
