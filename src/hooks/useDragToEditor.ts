import { useCallback, type DragEvent } from 'react'
import type { Editor } from '@tiptap/react'

interface DragPayload {
  text: string
  label?: string
}

export function useDragToEditor(editor: Editor | null) {
  const handleDragStart = useCallback((e: DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData('text/plain', payload.text)
    e.dataTransfer.setData('application/x-template', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      const text = e.dataTransfer.getData('text/plain')
      if (!text || !editor) return
      editor.chain().focus().insertContent(text).run()
    },
    [editor]
  )

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDragStart, handleDrop, handleDragOver }
}
