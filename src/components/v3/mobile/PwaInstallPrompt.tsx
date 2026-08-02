import React, { useEffect, useState } from 'react'
import { Button, Card, Space, Typography } from 'antd'
import { Smartphone, Download, X } from 'lucide-react'

const { Text } = Typography

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setInstalled(true)
      setShowPrompt(false)
    }
    window.addEventListener('appinstalled', installedHandler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (installed || !showPrompt) return null

  return (
    <Card
      size="small"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 360,
        margin: '0 auto',
        zIndex: 1050,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
      data-testid="pwa-install-prompt"
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <Smartphone size={20} color="#1e3a5f" />
            <Text strong>安装 G005 RIS</Text>
          </Space>
          <Button
            type="text"
            size="small"
            icon={<X size={14} />}
            onClick={() => setShowPrompt(false)}
            data-testid="pwa-install-dismiss"
          />
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          安装到主屏幕，获得更好的移动端体验
        </Text>
        <Button
          type="primary"
          block
          icon={<Download size={14} />}
          onClick={() => void handleInstall()}
          data-testid="pwa-install-button"
        >
          安装
        </Button>
      </Space>
    </Card>
  )
}
