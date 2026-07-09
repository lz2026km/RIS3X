import { useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Awareness } from 'y-protocols/awareness'

const DEFAULT_WS = 'ws://localhost:1234'

export interface CollaborativeUser {
  id: string
  name: string
  color: string
  avatar?: string
}

export interface UseCollaborativeYjsOptions {
  roomId: string
  user: CollaborativeUser
  wsUrl?: string
  autoConnect?: boolean
}

export interface UseCollaborativeYjsReturn {
  ydoc: Y.Doc | null
  ytext: Y.Text | null
  awareness: Awareness | null
  isConnected: boolean
  onlineUsers: CollaborativeUser[]
  initYjs: (roomId: string) => void
  bindEditor: (editorEl: HTMLElement | null) => void
  getAwareness: () => Awareness | null
  disconnect: () => void
}

const ONLINE_COLORS = [
  '#0891b2', '#7c3aed', '#dc2626', '#ea580c', '#16a34a',
  '#ca8a04', '#db2777', '#4f46e5', '#0d9488', '#9333ea',
]

export function useCollaborativeYjs(opts?: UseCollaborativeYjsOptions): UseCollaborativeYjsReturn {
  const wsUrl = opts?.wsUrl ?? DEFAULT_WS
  const autoConnect = opts?.autoConnect ?? true

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const ytextRef = useRef<Y.Text | null>(null)
  const editorRef = useRef<HTMLElement | null>(null)
  const boundRef = useRef(false)
  const userRef = useRef(opts?.user ?? { id: 'anon', name: 'Anonymous', color: '#94a3b8' })

  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<CollaborativeUser[]>([])

  const initYjs = useCallback((roomId: string) => {
    if (providerRef.current) {
      providerRef.current.disconnect()
    }
    if (ydocRef.current) {
      ydocRef.current.destroy()
    }

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const ytext = ydoc.getText('content')
    ytextRef.current = ytext

    const provider = new WebsocketProvider(wsUrl, `report:${roomId}`, ydoc, {
      connect: autoConnect,
    })
    providerRef.current = provider

    provider.on('status', (e: { status: string }) => {
      setIsConnected(e.status === 'connected')
    })

    const awareness = provider.awareness
    awareness.setLocalState({
      user: userRef.current,
      cursor: null,
    })

    awareness.on('change', () => {
      const states = awareness.getStates()
      const users: CollaborativeUser[] = []
      let idx = 0
      states.forEach((state: unknown) => {
        const s = state as { user?: CollaborativeUser }
        if (s.user) {
          users.push({ ...s.user, color: s.user.color || ONLINE_COLORS[idx % ONLINE_COLORS.length]! })
        }
        idx++
      })
      setOnlineUsers(users)
    })
  }, [wsUrl, autoConnect])

  const bindEditor = useCallback((editorEl: HTMLElement | null) => {
    editorRef.current = editorEl
    if (!editorEl || !ytextRef.current || boundRef.current) return

    boundRef.current = true
    const ytext = ytextRef.current

    const syncYjsToDom = () => {
      if (editorEl && document.activeElement !== editorEl) {
        editorEl.innerHTML = ytext.toString()
      }
    }

    const domMutation = new MutationObserver(() => {
      if (editorEl.innerHTML !== ytext.toString()) {
        ytext.delete(0, ytext.length)
        ytext.insert(0, editorEl.innerHTML)
      }
    })

    ytext.observe(syncYjsToDom)
    domMutation.observe(editorEl, { childList: true, subtree: true, characterData: true })
    syncYjsToDom()

    return () => {
      ytext.unobserve(syncYjsToDom)
      domMutation.disconnect()
      boundRef.current = false
    }
  }, [])

  useEffect(() => {
    if (opts?.roomId && autoConnect) {
      initYjs(opts.roomId)
    }
    return () => {
      boundRef.current = false
      if (providerRef.current) {
        providerRef.current.disconnect()
        providerRef.current = null
      }
      if (ydocRef.current) {
        ydocRef.current.destroy()
        ydocRef.current = null
      }
      ytextRef.current = null
    }
  }, [opts?.roomId])

  const getAwareness = useCallback(() => {
    return providerRef.current?.awareness ?? null
  }, [])

  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect()
    }
    setIsConnected(false)
  }, [])

  const awareness: Awareness | null = providerRef.current?.awareness ?? null

  return {
    ydoc: ydocRef.current,
    ytext: ytextRef.current,
    awareness,
  isConnected,
    onlineUsers,
    initYjs,
    bindEditor,
    getAwareness,
    disconnect,
  }
}

export default useCollaborativeYjs
