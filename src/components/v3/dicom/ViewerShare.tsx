/**
 * G005 放射RIS系统 v3.0.1 - 影像分享浮窗
 * 对标锐科 PACS — URL + 二维码 + 密码 + 有效期
 */
import React, { useState, useCallback } from 'react'
import { Modal, Input, Button, Select, Space, Tag, QRCode, message, Tooltip } from 'antd'
import { Share2, Link2, Copy, Lock, Clock } from 'lucide-react'

export type ShareExpiry = '1d' | '7d' | '30d' | 'permanent'

export interface ViewerShareProps {
  studyId?: string
  studyDescription?: string
  open: boolean
  onClose: () => void
  baseUrl?: string
  onGenerate?: (opts: { studyId: string; password?: string; expiry: ShareExpiry }) => Promise<{ url: string; token: string }>
}

const expiryLabel: Record<ShareExpiry, string> = {
  '1d': '1 天',
  '7d': '7 天',
  '30d': '30 天',
  permanent: '永久',
}

export const ViewerShare: React.FC<ViewerShareProps> = ({
  studyId,
  studyDescription,
  open,
  onClose,
  baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
  onGenerate,
}) => {
  const [password, setPassword] = useState('')
  const [expiry, setExpiry] = useState<ShareExpiry>('7d')
  const [generated, setGenerated] = useState<{ url: string; token: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!studyId) {
      message.warning('缺少 studyId')
      return
    }
    setLoading(true)
    try {
      const result = onGenerate
        ? await onGenerate({ studyId, password: password || undefined, expiry })
        : { url: `${baseUrl}/share/${studyId}?t=demo&exp=${expiry}`, token: '' }
      setGenerated(result)
      message.success('分享链接已生成')
    } catch {
      message.error('生成失败')
    } finally {
      setLoading(false)
    }
  }, [studyId, password, expiry, onGenerate, baseUrl])

  const handleCopy = useCallback(() => {
    if (!generated) return
    void navigator.clipboard.writeText(generated.url)
    message.success('已复制到剪贴板')
  }, [generated])

  const handleReset = useCallback(() => {
    setPassword('')
    setExpiry('7d')
    setGenerated(null)
  }, [])

  return (
    <Modal
      data-testid="viewer-share"
      title={
        <Space>
          <Share2 size={16} />
          <span>影像分享</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        handleReset()
        onClose()
      }}
      footer={null}
      width={520}
    >
      {studyDescription && (
        <div style={{ marginBottom: 12, color: '#64748b', fontSize: 13 }}>{studyDescription}</div>
      )}

      {!generated ? (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              <Lock size={12} style={{ verticalAlign: 'middle' }} /> 访问密码(可选)
            </label>
            <Input.Password
              data-testid="share-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则不设密码"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              <Clock size={12} style={{ verticalAlign: 'middle' }} /> 有效期
            </label>
            <Select
              data-testid="share-expiry"
              value={expiry}
              onChange={setExpiry}
              style={{ width: '100%' }}
              options={Object.entries(expiryLabel).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <Button
            type="primary"
            block
            loading={loading}
            onClick={handleGenerate}
            icon={<Link2 size={14} />}
            data-testid="share-generate"
          >
            生成分享链接
          </Button>
        </Space>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: 8, background: '#fff', borderRadius: 8, marginBottom: 12 }}>
            <QRCode value={generated.url} size={180} data-testid="share-qr" />
          </div>
          <Input.Group compact style={{ marginBottom: 8 }}>
            <Input
              data-testid="share-url"
              value={generated.url}
              readOnly
              style={{ width: 'calc(100% - 80px)' }}
            />
            <Tooltip title="复制">
              <Button icon={<Copy size={14} />} onClick={handleCopy} data-testid="share-copy" />
            </Tooltip>
          </Input.Group>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <Tag>{expiryLabel[expiry]}</Tag>
            {password && <Tag color="orange">已设密码</Tag>}
            <Tag color="blue">Token: {generated.token.slice(0, 8)}…</Tag>
          </div>
          <Button type="link" onClick={handleReset}>
            重新生成
          </Button>
        </div>
      )}
    </Modal>
  )
}

export default ViewerShare
