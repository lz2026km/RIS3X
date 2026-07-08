import { type ReactNode, type CSSProperties } from 'react'
import { useAuth } from '@/hooks/useAuth'

type PermissionMode = 'hide' | 'disable'

export interface PermissionGuardProps {
  roles: string[]
  mode?: PermissionMode
  children: ReactNode
  logic?: 'AND' | 'OR'
}

const disabledStyle: CSSProperties = {
  opacity: 0.4,
  pointerEvents: 'none',
  cursor: 'not-allowed',
}

export function PermissionGuard({
  roles,
  mode = 'hide',
  children,
  logic = 'OR',
}: PermissionGuardProps) {
  const { user } = useAuth()

  if (!user) {
    if (mode === 'disable') return <div style={disabledStyle}>{children}</div>
    return null
  }

  const hasRole = logic === 'AND'
    ? roles.every((r) => user.role === r)
    : roles.some((r) => user.role === r)

  if (!hasRole) {
    if (mode === 'disable') return <div style={disabledStyle}>{children}</div>
    return null
  }

  return <>{children}</>
}

export default PermissionGuard
