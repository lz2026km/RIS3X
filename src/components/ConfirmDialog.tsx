/**
 * ConfirmDialog - E4: 删除/退回/作废等危险操作弹窗确认
 * E3: 错误信息显示在对应字段下方
 * G005 Radiology RIS System
 */
import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useFocusTrap } from '@/a11y/SkipLink'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 危险操作确认对话框
 * 用于删除、退回、作废等不可逆操作
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const containerRef = useFocusTrap(open)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const variantConfig = {
    danger: {
      iconBg: 'var(--color-error-bg)',
      iconColor: '#ef4444',
      confirmBg: '#ef4444',
      confirmHover: '#dc2626',
      icon: <AlertTriangle size={24} />,
    },
    warning: {
      iconBg: 'var(--color-warning-bg)',
      iconColor: '#f59e0b',
      confirmBg: '#f59e0b',
      confirmHover: '#d97706',
      icon: <AlertTriangle size={24} />,
    },
    info: {
      iconBg: 'var(--color-info-bg)',
      iconColor: '#3b82f6',
      confirmBg: '#3b82f6',
      confirmHover: '#2563eb',
      icon: <AlertTriangle size={24} />,
    },
  }
  const cfg = variantConfig[variant]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          animation: 'scaleIn 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: cfg.iconBg,
            color: cfg.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>{title}</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{message}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="关闭"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              display: 'flex',
              borderRadius: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              background: 'var(--bg-card)',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              border: 'none',
              borderRadius: 8,
              background: cfg.confirmBg,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = cfg.confirmHover}
            onMouseLeave={e => e.currentTarget.style.background = cfg.confirmBg}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/**
 * 字段级错误提示组件 - E3
 * 用于显示表单字段验证错误
 */
interface FieldErrorProps {
  message: string
}

export const FieldError = React.memo(function FieldError({ message }: FieldErrorProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      color: '#ef4444',
      fontSize: 12,
    }}>
      <AlertTriangle size={12} />
      <span>{message}</span>
    </div>
  )
})

/**
 * 表单字段包装器 - 带错误显示
 */
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export const FormField = React.memo(function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
        {label}
        {required && <span aria-label="必填" style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <FieldError message={error} />}
    </div>
  )
})

export default ConfirmDialog