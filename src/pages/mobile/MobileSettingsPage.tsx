import React, { useState, useEffect } from 'react'
import { Card, Space, Typography, Switch, Button, Divider, message, Select, Slider, Tag } from 'antd'
import { Bell, Fingerprint, Lock, Camera, Mic, Smartphone, Palette, Globe, Volume2, ChevronRight, Shield, Wifi, Sun, Moon } from 'lucide-react'
import { BiometricPrompt } from '../../components/mobile/biometric/BiometricPrompt'
import { PinEntry } from '../../components/mobile/biometric/PinEntry'
import { PushNotificationBanner } from '../../components/mobile/PushNotificationBanner'
import { biometricLogin } from '../../services/mobile/biometric/BiometricLogin'
import { pushService } from '../../services/mobile/push/PushService'
import { haptics } from '../../services/mobile/Haptics'
import { voiceActivation } from '../../services/mobile/VoiceActivation'
import type { MobileSettings } from '../../types/mobile'

const { Text, Title } = Typography

const DEFAULT_SETTINGS: MobileSettings = {
  userId: 'current',
  biometricEnabled: false,
  biometricType: 'none',
  pinEnabled: false,
  pushEnabled: false,
  pushCategories: ['report', 'critical', 'appointment'],
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  offlineMode: false,
  autoSync: true,
  syncOnWifiOnly: true,
  hapticsEnabled: true,
  voiceActivation: false,
  voiceWakeWord: '嘿 RIS',
  cameraQuality: 'medium',
  imageCacheLimitMB: 200,
  language: 'zh-CN',
  theme: 'auto',
  updatedAt: new Date().toISOString(),
}

export default function MobileSettingsPage() {
  const [settings, setSettings] = useState<MobileSettings>(DEFAULT_SETTINGS)
  const [showBiometric, setShowBiometric] = useState(false)
  const [showPinCreate, setShowPinCreate] = useState(false)
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [pushPerm, setPushPerm] = useState(pushService.permission)

  useEffect(() => {
    const stored = localStorage.getItem('g005-mobile-settings')
    if (stored) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }) } catch { /* ignore */ }
    }
    setPushPerm(pushService.permission)
  }, [])

  const save = (partial: Partial<MobileSettings>) => {
    const next = { ...settings, ...partial, updatedAt: new Date().toISOString() }
    setSettings(next)
    localStorage.setItem('g005-mobile-settings', JSON.stringify(next))
  }

  const renderSection = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Space><div style={{ color: '#3b82f6' }}>{icon}</div><Text strong>{title}</Text></Space>
        {children}
      </Space>
    </Card>
  )

  const renderToggle = (label: string, desc: string, value: boolean, onChange: (v: boolean) => void) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <div>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <div><Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text></div>
      </div>
      <Switch checked={value} onChange={onChange} size="small" />
    </div>
  )

  const handleBiometricSuccess = () => {
    save({ biometricEnabled: true, biometricType: biometricLogin.biometricType })
    setShowBiometric(false)
    void message.success('生物识别已开启')
  }

  const handlePinCreated = () => {
    save({ pinEnabled: true })
    setShowPinCreate(false)
    void message.success('PIN 码已设置')
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' }}>
      <Title level={4} style={{ marginBottom: 16 }}>移动端设置</Title>

      <PushNotificationBanner onEnable={() => { save({ pushEnabled: true }); setPushPerm('granted') }}
        onDisable={() => save({ pushEnabled: false })} />

      {renderSection('安全', <Shield size={16} />,
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {renderToggle('生物识别登录', '使用 Face ID / 指纹快速登录', settings.biometricEnabled,
            v => v ? setShowBiometric(true) : save({ biometricEnabled: false, biometricType: 'none' }))}
          {settings.biometricEnabled && (
            <Tag color="blue" style={{ margin: 0 }}>{settings.biometricType === 'face-id' ? 'Face ID' : settings.biometricType === 'touch-id' ? 'Touch ID' : settings.biometricType}</Tag>
          )}

          {renderToggle('PIN 码保护', '使用 6 位数字 PIN 码', settings.pinEnabled,
            v => v ? setShowPinCreate(true) : save({ pinEnabled: false }))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <div>
              <Text style={{ fontSize: 13 }}>更改 PIN 码</Text>
            </div>
            <Button size="small" type="link" onClick={() => setShowPinVerify(true)} disabled={!settings.pinEnabled}>修改</Button>
          </div>
        </Space>
      )}

      {renderSection('通知', <Bell size={16} />,
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {renderToggle('推送通知', '接收报告和危急值提醒', settings.pushEnabled,
            v => v ? save({ pushEnabled: true }) : save({ pushEnabled: false }))}

          <div style={{ padding: '4px 0' }}>
            <Text style={{ fontSize: 13 }}>推送分类</Text>
            <Select mode="multiple" value={settings.pushCategories} onChange={v => save({ pushCategories: v })}
              size="small" style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 'report', label: '报告' },
                { value: 'critical', label: '危急值' },
                { value: 'appointment', label: '预约' },
                { value: 'system', label: '系统' },
              ]} />
          </div>

          {renderToggle('免打扰', `${settings.quietHours.enabled ? `${settings.quietHours.start} - ${settings.quietHours.end}` : '关闭'}`,
            settings.quietHours.enabled,
            v => save({ quietHours: { ...settings.quietHours, enabled: v } }))}
        </Space>
      )}

      {renderSection('离线与同步', <Wifi size={16} />,
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {renderToggle('离线模式', '优先使用本地缓存', settings.offlineMode, v => save({ offlineMode: v }))}
          {renderToggle('自动同步', '连接网络后自动同步', settings.autoSync, v => save({ autoSync: v }))}
          {renderToggle('仅 Wi-Fi 同步', '仅在 Wi-Fi 下同步数据', settings.syncOnWifiOnly, v => save({ syncOnWifiOnly: v }))}

          <div style={{ padding: '4px 0' }}>
            <Text style={{ fontSize: 13 }}>图片缓存限制</Text>
            <Slider value={settings.imageCacheLimitMB} onChange={v => save({ imageCacheLimitMB: v })}
              min={50} max={1000} step={50} marks={{ 50: '50MB', 500: '500MB', 1000: '1GB' }} />
          </div>
        </Space>
      )}

      {renderSection('体验', <Smartphone size={16} />,
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {renderToggle('触觉反馈', '按键和操作时的振动反馈', settings.hapticsEnabled, v => {
            save({ hapticsEnabled: v })
            haptics.setEnabled(v)
          })}

          {renderToggle('语音唤醒', `"${settings.voiceWakeWord}" 唤醒`, settings.voiceActivation, v => {
            save({ voiceActivation: v })
            if (v) voiceActivation.start().catch((err) => { console.error('[F04]', err); })
            else voiceActivation.stop()
          })}

          <div style={{ padding: '4px 0' }}>
            <Text style={{ fontSize: 13 }}>相机质量</Text>
            <Select value={settings.cameraQuality} onChange={v => save({ cameraQuality: v as MobileSettings['cameraQuality'] })}
              size="small" style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 'low', label: '低 (节省空间)' },
                { value: 'medium', label: '中等' },
                { value: 'high', label: '高 (最佳质量)' },
              ]} />
          </div>
        </Space>
      )}

      {renderSection('外观', <Palette size={16} />,
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <div style={{ padding: '4px 0' }}>
            <Text style={{ fontSize: 13 }}>语言</Text>
            <Select value={settings.language} onChange={v => save({ language: v as 'zh-CN' | 'en-US' })}
              size="small" style={{ width: '100%', marginTop: 4 }}
              options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} />
          </div>
          <div style={{ padding: '4px 0' }}>
            <Text style={{ fontSize: 13 }}>主题</Text>
            <Select value={settings.theme} onChange={v => save({ theme: v as MobileSettings['theme'] })}
              size="small" style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 'light', label: <Space><Sun size={12} /> 浅色</Space> },
                { value: 'dark', label: <Space><Moon size={12} /> 深色</Space> },
                { value: 'auto', label: '跟随系统' },
              ]} />
          </div>
        </Space>
      )}

      <Divider style={{ margin: '12px 0', fontSize: 12, color: '#94a3b8' }} />

      <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
        G005 RIS v3.0.6.6 · 上次更新 {new Date(settings.updatedAt).toLocaleString()}
      </Text>

      <BiometricPrompt
        open={showBiometric}
        userId="current"
        mode="login"
        onSuccess={handleBiometricSuccess}
        onCancel={() => setShowBiometric(false)}
        onFallbackToPin={() => { setShowBiometric(false); setShowPinCreate(true) }}
      />

      <PinEntry
        open={showPinCreate}
        mode="create"
        userId="current"
        onSuccess={handlePinCreated}
        onCancel={() => setShowPinCreate(false)}
        onSwitchToBiometric={() => { setShowPinCreate(false); setShowBiometric(true) }}
      />

      <PinEntry
        open={showPinVerify}
        mode="verify"
        userId="current"
        onSuccess={() => { setShowPinVerify(false); setShowPinCreate(true) }}
        onCancel={() => setShowPinVerify(false)}
        maxAttempts={3}
      />
    </div>
  )
}
