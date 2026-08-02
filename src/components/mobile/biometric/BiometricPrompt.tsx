import React, { useState, useEffect } from 'react'
import { Modal, Button, Space, Typography, Spin, Result } from 'antd'
import { Fingerprint, ScanFace, Shield, ShieldOff, Lock } from 'lucide-react'
import type { BiometricType, BiometricAuthResult } from '../../../types/mobile'
import { biometricLogin } from '../../../services/mobile/biometric/BiometricLogin'

const { Text, Title } = Typography

interface BiometricPromptProps {
  open: boolean
  userId: string
  onSuccess: (result: BiometricAuthResult) => void
  onCancel: () => void
  onFallbackToPin?: () => void
  mode?: 'login' | 'verify-action'
  actionLabel?: string
}

const BIOMETRIC_ICONS: Record<BiometricType, React.ReactNode> = {
  'face-id': <ScanFace size={40} />,
  'touch-id': <Fingerprint size={40} />,
  'fingerprint': <Fingerprint size={40} />,
  'iris': <ScanFace size={40} />,
  'voice': <ScanFace size={40} />,
  'none': <Lock size={40} />,
}

const BIOMETRIC_LABELS: Record<BiometricType, string> = {
  'face-id': '面容 ID',
  'touch-id': '触控 ID',
  'fingerprint': '指纹',
  'iris': '虹膜',
  'voice': '声纹',
  'none': '生物识别',
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({ open, userId, onSuccess, onCancel, onFallbackToPin, mode = 'login', actionLabel }) => {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [bioType, setBioType] = useState<BiometricType>('none')
  const [attempts, setAttempts] = useState(5)

  useEffect(() => {
    if (open) {
      setStatus('idle')
      setErrorMsg('')
      setBioType(biometricLogin.biometricType)
      setAttempts(biometricLogin.getAttemptsRemaining())
    }
  }, [open])

  const handleAuthenticate = async () => {
    setStatus('authenticating')
    setErrorMsg('')
    const result = await biometricLogin.authenticate()
    setAttempts(biometricLogin.getAttemptsRemaining())

    if (result.success) {
      setStatus('success')
      setTimeout(() => onSuccess(result), 600)
    } else {
      setStatus('error')
      setErrorMsg(result.errorMessage ?? '验证失败')
      if (result.errorCode === 'lockout') {
        setTimeout(() => onFallbackToPin?.(), 2000)
      }
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      closable={false}
      centered
      width={340}
      destroyOnHidden
    >
      <Space orientation="vertical" align="center" style={{ width: '100%', padding: '24px 0' }} size={16}>
        {status === 'success' ? (
          <Result status="success" title="验证成功" />
        ) : status === 'error' ? (
          <Result
            status="error"
            title="验证失败"
            subTitle={errorMsg}
            extra={
              <Space orientation="vertical" size={8}>
                {attempts > 0 && <Button type="primary" onClick={handleAuthenticate}>重试 ({attempts})</Button>}
                {onFallbackToPin && <Button onClick={onFallbackToPin}>使用 PIN 码</Button>}
                <Button onClick={onCancel}>取消</Button>
              </Space>
            }
          />
        ) : (
          <>
            <div style={{ color: '#3b82f6' }}>
              {status === 'authenticating' ? <Spin size="large" /> : BIOMETRIC_ICONS[bioType]}
            </div>
            <Title level={4} style={{ margin: 0 }}>
              {mode === 'verify-action' ? `验证身份${actionLabel ? `: ${actionLabel}` : ''}` : BIOMETRIC_LABELS[bioType]}
            </Title>
            <Text type="secondary">{mode === 'verify-action' ? '请验证身份以继续此操作' : `使用${BIOMETRIC_LABELS[bioType]}快速登录`}</Text>
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <Button type="primary" size="large" block icon={<Shield size={16} />} onClick={handleAuthenticate} loading={status === 'authenticating'}>
                {status === 'authenticating' ? '验证中...' : `验证${BIOMETRIC_LABELS[bioType]}`}
              </Button>
              {onFallbackToPin && (
                <Button block icon={<Lock size={16} />} onClick={onFallbackToPin}>使用 PIN 码</Button>
              )}
              <Button block type="text" icon={<ShieldOff size={16} />} onClick={onCancel}>取消</Button>
            </Space>
          </>
        )}
      </Space>
    </Modal>
  )
}

export default BiometricPrompt
