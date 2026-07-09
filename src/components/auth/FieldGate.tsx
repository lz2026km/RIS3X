import { type ReactNode, type CSSProperties } from 'react'
import { useRBAC } from '@/hooks/useRBAC'
import type { FieldPermission } from '@/hooks/useRBAC'

type FieldGateMode = 'hide' | 'disable' | 'mask'

export interface FieldGateProps {
  permission: string
  resourceType: string
  field: FieldPermission
  children: ReactNode
  mode?: FieldGateMode
}

const disabledStyle: CSSProperties = {
  opacity: 0.4,
  pointerEvents: 'none',
  cursor: 'not-allowed',
}

const maskStyle: CSSProperties = {
  filter: 'blur(4px)',
  userSelect: 'none',
  position: 'relative',
}

export function FieldGate({
  field,
  children,
  mode = 'hide',
}: FieldGateProps) {
  const { canField } = useRBAC()
  const hasAccess = canField(field)

  if (!hasAccess) {
    if (mode === 'disable') return <div style={disabledStyle}>{children}</div>
    if (mode === 'mask') return <div style={maskStyle}>{children}<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94a3b8' }}>无权限</div></div>
    return null
  }

  return <>{children}</>
}

export default FieldGate
