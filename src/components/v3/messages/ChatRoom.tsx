/**
 * G005 放射RIS系统 v3.0.1 - 站内消息
 * 对标飞利浦 / 联影协同 — 文本/图片/文件/语音 4 类消息
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { List, Input, Button, Space, Avatar, Tag, Tooltip, Empty, message } from 'antd'
import { Send, Paperclip, Image as ImageIcon, Mic, Smile } from 'lucide-react'
import { MentionPicker, type MentionUser, SAMPLE_USERS } from '../messages/MentionPicker'

export type MessageType = 'text' | 'image' | 'file' | 'voice'

export interface ChatMessage {
  id: string
  type: MessageType
  author: MentionUser
  content: string
  mentions?: MentionUser[]
  timestamp: number
}

export interface ChatRoomProps {
  roomId: string
  roomName: string
  currentUser: MentionUser
  messages: ChatMessage[]
  onSend?: (msg: ChatMessage) => void
  onTyping?: (text: string) => void
}

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  const now = Date.now()
  if (now - ts < 60_000) return '刚刚'
  if (now - ts < 3_600_000) return `${Math.floor((now - ts) / 60_000)} 分钟前`
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const parseMentions = (text: string, allUsers: MentionUser[]): { cleanText: string; mentions: MentionUser[] } => {
  const names = Array.from(text.matchAll(/@([^\s@]+)/g)).map((m) => m[1] ?? '')
  const mentions: MentionUser[] = []
  for (const n of names) {
    const u = allUsers.find((x) => x.name === n)
    if (u) mentions.push(u)
  }
  return { cleanText: text, mentions }
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  roomId,
  roomName,
  currentUser,
  messages,
  onSend,
  onTyping,
}) => {
  const [draft, setDraft] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLInputElement | null>(null)

  const EMOJIS = ['😀', '😄', '😂', '😊', '😍', '🤔', '👍', '👏', '🙏', '💯', '✅', '⚠️', '❤️', '🎉', '📋', '🏥', '🧑‍⚕️', '🩻']

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    const { mentions } = parseMentions(text, SAMPLE_USERS)
    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      author: currentUser,
      content: text,
      mentions,
      timestamp: Date.now(),
    }
    onSend?.(msg)
    setDraft('')
  }, [draft, currentUser, onSend])

  // 附件：选择本地文件并发送 file 消息
  const handleFilePick = useCallback((file: File) => {
    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'file',
      author: currentUser,
      content: file.name,
      mentions: [],
      timestamp: Date.now(),
    }
    onSend?.(msg)
    message.success(`已发送附件: ${file.name}`)
  }, [currentUser, onSend])

  // 图片：本地预览 + 发送 image 消息
  const handleImagePick = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'image',
      author: currentUser,
      content: url,
      mentions: [],
      timestamp: Date.now(),
    }
    onSend?.(msg)
    message.success(`已发送图片: ${file.name}`)
  }, [currentUser, onSend])

  // 表情：插入输入框
  const handleEmojiPick = useCallback((emoji: string) => {
    setDraft((prev) => prev + emoji)
  }, [])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div data-testid={`chat-room-${roomId}`} style={{ display: 'flex', flexDirection: 'column', height: 480, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{roomName}</div>
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {messages.length === 0 ? (
          <Empty description="暂无消息" />
        ) : (
          <List
            dataSource={messages}
            renderItem={(m) => {
              const mine = m.author.id === currentUser.id
              return (
                <List.Item
                  key={m.id}
                  data-testid={`msg-${m.id}`}
                  style={{
                    border: 'none',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    padding: '6px 0',
                  }}
                >
                  <Space orientation={mine ? 'horizontal-reverse' : 'horizontal'} align="start">
                    <Avatar style={{ background: m.author.avatarColor }}>{m.author.name.slice(0, 1)}</Avatar>
                    <div
                      style={{
                        maxWidth: 360,
                        background: mine ? '#1e3a5f' : '#f1f5f9',
                        color: mine ? '#fff' : '#1e293b',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>
                        {m.author.name} · {formatTime(m.timestamp)}
                      </div>
                      {m.type === 'image' ? (
                        <img
                          src={m.content}
                          alt="chat-image"
                          style={{ maxWidth: 260, maxHeight: 200, borderRadius: 6, display: 'block' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.4' }}
                        />
                      ) : m.type === 'file' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📎</span>
                          <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{m.content}</span>
                          <Tag color="blue" style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(m.content); message.success('附件名已复制') }}>复制</Tag>
                        </div>
                      ) : m.type === 'voice' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🎤</span>
                          <span>{m.content}</span>
                          <Tag style={{ fontSize: 11 }}>语音</Tag>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      )}
                      {m.mentions && m.mentions.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {m.mentions.map((u) => (
                            <Tag key={u.id} color={mine ? 'blue' : 'purple'} style={{ fontSize: 12 }}>
                              @{u.name}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Space>
                </List.Item>
              )
            }}
          />
        )}
      </div>
      <div style={{ padding: 8, borderTop: '1px solid #e2e8f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Tooltip title="附件">
            <Button icon={<Paperclip size={14} />} onClick={() => fileRef.current?.click()} data-testid="chat-attach" />
          </Tooltip>
          <Tooltip title="图片">
            <Button icon={<ImageIcon size={14} />} onClick={() => imageRef.current?.click()} data-testid="chat-image" />
          </Tooltip>
          <Tooltip title="语音">
            <Button icon={<Mic size={14} />} onClick={() => message.warning('语音消息需连接音频设备')} data-testid="chat-voice" />
          </Tooltip>
          <Tooltip title="表情">
            <Button icon={<Smile size={14} />} onClick={() => setEmojiOpen(o => !o)} data-testid="chat-emoji" />
          </Tooltip>
        </Space.Compact>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFilePick(f)
            e.target.value = ''
          }}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImagePick(f)
            e.target.value = ''
          }}
        />
        {emojiOpen && (
          <div
            data-testid="chat-emoji-panel"
            style={{
              marginTop: 8,
              padding: 8,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              background: '#fff',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              maxWidth: 280,
            }}
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handleEmojiPick(e)}
                style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', padding: 2 }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <Input.TextArea
          data-testid="chat-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onTyping?.(e.target.value)
          }}
          onKeyDown={handleKey}
          placeholder="输入消息... Shift+Enter 换行 / @ 提及"
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ marginTop: 8 }}
        />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <Button size="small" onClick={() => setMentionOpen(true)} data-testid="chat-mention">
            @ 提及
          </Button>
          <Button type="primary" size="small" icon={<Send size={12} />} onClick={handleSend} data-testid="chat-send">
            发送(Enter)
          </Button>
        </div>
      </div>
      <MentionPicker
        open={mentionOpen}
        onClose={() => setMentionOpen(false)}
        onSelect={(users) => {
          const newText = draft + (draft ? ' ' : '') + users.map((u) => `@${u.name}`).join(' ')
          setDraft(newText)
        }}
      />
    </div>
  )
}

export default ChatRoom
