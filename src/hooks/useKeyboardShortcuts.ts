import { useEffect, useCallback, useRef, useState } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: () => void
  description?: string
  ignoreOn?: string[]
}

interface SequenceShortcut {
  sequence: string[]
  action: () => void
  description?: string
}

const DEFAULT_IGNORE_ON = ['INPUT', 'TEXTAREA', 'SELECT', 'CONTENTEDITABLE']

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (DEFAULT_IGNORE_ON.includes(target.tagName) && !target.dataset.enableShortcuts) {
        return
      }

      for (const shortcut of shortcutsRef.current) {
        const matchCtrl = shortcut.ctrlKey ? e.ctrlKey : !shortcut.ctrlKey
        const matchShift = shortcut.shiftKey ? e.shiftKey : !shortcut.shiftKey
        const matchAlt = shortcut.altKey ? e.altKey : !shortcut.altKey
        const matchMeta = shortcut.metaKey ? e.metaKey : !shortcut.metaKey
        const matchKey = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (matchKey && matchCtrl && matchShift && matchAlt && matchMeta) {
          e.preventDefault()
          e.stopPropagation()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [enabled])
}

export function useNavigationShortcuts(
  navShortcuts: SequenceShortcut[],
  enabled = true
) {
  const [buffer, setBuffer] = useState<string[]>([])
  const bufferTimer = useRef<ReturnType<typeof setTimeout>>()
  const navRef = useRef(navShortcuts)
  navRef.current = navShortcuts

  const clearBuffer = useCallback(() => {
    setBuffer([])
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (DEFAULT_IGNORE_ON.includes(target.tagName) && !target.dataset.enableShortcuts) {
        clearBuffer()
        return
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const key = e.key.toLowerCase()
      if (key === 'Escape') {
        clearBuffer()
        return
      }

      const next = [...buffer, key]

      for (const nav of navRef.current) {
        const seq = nav.sequence
        if (next.length > seq.length) continue
        const match = seq.every((s, i) => s === next[i])
        if (!match) continue

        if (next.length === seq.length) {
          e.preventDefault()
          e.stopPropagation()
          nav.action()
          clearBuffer()
          return
        }

        setBuffer(next)
        if (bufferTimer.current) clearTimeout(bufferTimer.current)
        bufferTimer.current = setTimeout(clearBuffer, 1000)
        return
      }

      clearBuffer()
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
    }
  }, [buffer, clearBuffer, enabled])
}

export function getShortcutHint(shortcut: KeyboardShortcut): string {
  return getKeyboardShortcutHint(shortcut);
}

export function getKeyboardShortcutHint(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  if (shortcut.ctrlKey) parts.push('Ctrl')
  if (shortcut.shiftKey) parts.push('Shift')
  if (shortcut.altKey) parts.push('Alt')
  if (shortcut.metaKey) parts.push('Meta')
  parts.push(shortcut.key.toUpperCase())
  return parts.join('+')
}

export function getSequenceHint(seq: SequenceShortcut): string {
  return seq.sequence.join(' + ')
}

export const NAV_SHORTCUTS: SequenceShortcut[] = [
  { sequence: ['g', 'r'], action: () => window.location.href = '/reports', description: '导航到报告' },
  { sequence: ['g', 'w'], action: () => window.location.href = '/worklist', description: '导航到工作列表' },
  { sequence: ['g', 'd'], action: () => window.location.href = '/workbench', description: '导航到仪表盘' },
  { sequence: ['g', 'p'], action: () => window.location.href = '/patients', description: '导航到患者' },
]

export const SHORTCUTS = {
  SAVE: (action: () => void) => ({
    key: 's',
    ctrlKey: true,
    action,
    description: '保存',
  }),
  SUBMIT: (action: () => void) => ({
    key: 'Enter',
    ctrlKey: true,
    action,
    description: '提交',
  }),
  CANCEL: (action: () => void) => ({
    key: 'Escape',
    action,
    description: '取消',
  }),
  SEARCH: (action: () => void) => ({
    key: 'f',
    ctrlKey: true,
    action,
    description: '搜索',
  }),
  QUICK_ADD: (action: () => void) => ({
    key: 'n',
    ctrlKey: true,
    action,
    description: '新建',
  }),
  REFRESH: (action: () => void) => ({
    key: 'r',
    ctrlKey: true,
    action,
    description: '刷新',
  }),
  EXPORT: (action: () => void) => ({
    key: 'e',
    ctrlKey: true,
    action,
    description: '导出',
  }),
  PRINT: (action: () => void) => ({
    key: 'p',
    ctrlKey: true,
    action,
    description: '打印',
  }),
  UNDO: (action: () => void) => ({
    key: 'z',
    ctrlKey: true,
    action,
    description: '撤销',
  }),
  REDO: (action: () => void) => ({
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    action,
    description: '重做',
  }),
  HELP: (action: () => void) => ({
    key: '?',
    action,
    description: '快捷键帮助',
  }),
} as const

export default useKeyboardShortcuts
