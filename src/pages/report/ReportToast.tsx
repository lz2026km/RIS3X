import React from 'react'
import { CheckCircle, AlertTriangle, Bell } from 'lucide-react'
import { PRIMARY, SUCCESS, DANGER, WHITE } from './reportUtils'

export interface ReportToastProps {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

export default function ReportToast({ show, message, type }: ReportToastProps) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? SUCCESS : type === 'error' ? DANGER : PRIMARY,
      color: WHITE, padding: '12px 20px', borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
    }}>
      {type === 'success' ? <CheckCircle size={16} /> : type === 'error' ? <AlertTriangle size={16} /> : <Bell size={16} />}
      {message}
    </div>
  )
}
