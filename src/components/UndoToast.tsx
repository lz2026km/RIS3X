/**
 * UndoToast - E9: 删除/撤回等操作提供30秒Undo窗口
 * 操作历史Undo机制
 * G005 Radiology RIS System
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoItem {
  id: string
  message: string
  undoAction: () => void
  /** 多久后自动消失（ms），默认30秒 */
  expiresIn?: number
}

interface UndoContextType {
  /** 显示一个带撤销提示的消息 */
  showUndo: (message: string, undoAction: () => void, expiresIn?: number) => string
  /** 手动移除（不执行undo） */
  dismiss: (id: string) => void
  /** 执行undo并移除 */
  executeUndo: (id: string) => void
}

const UndoContext = createContext<UndoContextType | null>(null)

/** 无 Provider 时的安全回退: 撤销提示静默降级, 避免整页崩溃 (ErrorBoundary 兜底) */
const UNDO_FALLBACK: UndoContextType = {
  showUndo: () => "",
  dismiss: () => {},
  executeUndo: () => {},
}

/**
 * UndoToastProvider - 提供全局撤销提示能力
 * 用于删除、撤回、作废等操作后的短时撤销窗口
 */
export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UndoItem[]>([])
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const showUndo = useCallback((message: string, undoAction: () => void, expiresIn = 30000) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const item: UndoItem = { id, message, undoAction, expiresIn }
    
    setItems(prev => [...prev, item])
    
    // 自动消失
    timersRef.current[id] = setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id))
      delete timersRef.current[id]
    }, expiresIn)

    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const executeUndo = useCallback((id: string) => {
    const item = items.find(i => i.id === id)
    if (item) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
      item.undoAction()
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }, [items])

  return (
    <UndoContext.Provider value={{ showUndo, dismiss, executeUndo }}>
      {children}
      {/* Undo Toast Container */}
      <div
        role="region"
        aria-label="撤销提示"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2, 8px)',
          zIndex: 'var(--z-toast)' as unknown as number,
        }}
      >
        {items.map(item => (
          <div
            key={item.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3, 12px)',
              padding: '12px 16px',
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              minWidth: 300,
              maxWidth: 480,
            }}
          >
            <Undo2 size={18} color="#fff" style={{ flexShrink: 0 }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, color: '#fff' }}>{item.message}</span>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                <button
                  type="button"
                  style={{ color: '#818cf8', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                  onClick={() => executeUndo(item.id)}
                  aria-label={`撤销操作: ${item.message}`}
                >
                  撤销
                </button>
                <span style={{ marginLeft: 'var(--space-2, 8px)' }}>或忽略</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="关闭撤销提示"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: 'var(--space-1, 4px)',
                display: 'flex',
                borderRadius: 4,
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </UndoContext.Provider>
  )
}

export const useUndoToast = () => {
  const ctx = useContext(UndoContext)
  if (!ctx) return UNDO_FALLBACK
  return ctx
}

/**
 * 便捷Hook：在需要撤销的操作后调用
 * 示例：删除患者后 showUndoDelete('已删除患者 张三', () => restorePatient(id))
 */
export function useUndoActions() {
  const { showUndo, dismiss, executeUndo } = useUndoToast()

  const showUndoDelete = useCallback((itemName: string, undoAction: () => void) => {
    return showUndo(`已删除 "${itemName}"`, undoAction)
  }, [showUndo])

  const showUndoReject = useCallback((itemName: string, undoAction: () => void) => {
    return showUndo(`已退回 "${itemName}"`, undoAction)
  }, [showUndo])

  const showUndoCancel = useCallback((itemName: string, undoAction: () => void) => {
    return showUndo(`已作废 "${itemName}"`, undoAction)
  }, [showUndo])

  const showUndoRecall = useCallback((itemName: string, undoAction: () => void) => {
    return showUndo(`已撤回 "${itemName}"`, undoAction)
  }, [showUndo])

  return {
    showUndo,
    showUndoDelete,
    showUndoReject,
    showUndoCancel,
    showUndoRecall,
    dismiss,
    executeUndo,
  }
}

export default UndoToastProvider