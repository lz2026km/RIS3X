import React, { useState, useEffect } from 'react'
import { Alert, Button, Space, Typography, Switch, Tooltip } from 'antd'
import { Bell, BellOff, BellRing, X } from 'lucide-react'
import type { PushPayload } from '../../types/mobile'
import { pushService } from '../../services/mobile/push/PushService'

const { Text } = Typography

interface PushNotificationBannerProps {
  onEnable?: () => void
  onDisable?: () => void
  onNotificationClick?: (payload: PushPayload) => void
  dismissable?: boolean
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({ onEnable, onDisable, onNotificationClick, dismissable = true }) => {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(pushService.permission)
  const [enabled, setEnabled] = useState(pushService.permission === 'granted')
  const [dismissed, setDismissed] = useState(false)
  const [lastNotification, setLastNotification] = useState<PushPayload | null>(null)

  useEffect(() => {
    const unsub = pushService.on({
      onNotification: (payload) => {
        setLastNotification(payload)
        setTimeout(() => setLastNotification(null), 6000)
      },
    })
    return unsub
  }, [])

  useEffect(() => {
    setPermission(pushService.permission)
  }, [])

  const handleToggle = async (v: boolean) => {
    if (v) {
      const perm = await pushService.requestPermission()
      setPermission(perm)
      if (perm === 'granted') {
        setEnabled(true)
        onEnable?.()
      } else {
        setEnabled(false)
      }
    } else {
      await pushService.unsubscribe()
      setEnabled(false)
      onDisable?.()
    }
  }

  if (dismissed) return null

  if (lastNotification && onNotificationClick) {
    return (
      <Alert
        title={
          <Space>
            <BellRing size={14} color="#3b82f6" />
            <Text strong>{lastNotification.title}</Text>
          </Space>
        }
        description={lastNotification.body}
        type="info"
        closable
        onClick={() => onNotificationClick(lastNotification)}
        style={{ cursor: 'pointer', marginBottom: 8 }}
        action={
          <Button size="small" type="text" icon={<X size={12} />} onClick={(e) => { e.stopPropagation(); setLastNotification(null) }} />
        }
      />
    )
  }

  if (permission === 'unsupported') return null

  if (permission === 'denied') {
    return (
      <Alert
        title={<Space><BellOff size={14} /> 推送通知已被禁用</Space>}
        type="warning"
        showIcon={false}
        style={{ marginBottom: 8, fontSize: 12 }}
        action={dismissable ? <Button size="small" type="text" icon={<X size={12} />} onClick={() => setDismissed(true)} /> : null}
      />
    )
  }

  if (permission === 'default') {
    return (
      <Alert
        title={<Space><Bell size={14} /> 开启推送通知以接收报告和危急值提醒</Space>}
        type="info"
        showIcon={false}
        style={{ marginBottom: 8, fontSize: 12 }}
        action={
          <Space size={8}>
            <Switch checked={enabled} onChange={handleToggle} size="small" />
            {dismissable && <Button size="small" type="text" icon={<X size={12} />} onClick={() => setDismissed(true)} />}
          </Space>
        }
      />
    )
  }

  return (
    <Alert
      title={
        <Space>
          <Bell size={14} color="#16a34a" />
          <Text style={{ fontSize: 12 }}>推送通知已开启</Text>
        </Space>
      }
      type="success"
      showIcon={false}
      style={{ marginBottom: 8 }}
      action={
        <Space size={8}>
          <Tooltip title="关闭推送">
            <Switch checked={enabled} onChange={handleToggle} size="small" />
          </Tooltip>
          {dismissable && <Button size="small" type="text" icon={<X size={12} />} onClick={() => setDismissed(true)} />}
        </Space>
      }
    />
  )
}

export default PushNotificationBanner
