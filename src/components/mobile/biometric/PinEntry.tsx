import React, { useState, useRef, useEffect } from 'react'
import { Modal, Button, Space, Typography, Input, message } from 'antd'
import { Lock, KeyRound, AlertTriangle } from 'lucide-react'

const { Text } = Typography

interface PinEntryProps {
  open: boolean
  mode: 'create' | 'verify' | 'change'
  userId: string
  onSuccess: () => void
  onCancel: () => void
  onSwitchToBiometric?: () => void
  maxAttempts?: number
}

export const PinEntry: React.FC<PinEntryProps> = ({ open, mode, userId, onSuccess, onCancel, onSwitchToBiometric, maxAttempts = 5 }) => {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'input' | 'confirm'>(mode === 'change' ? 'input' : 'input')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPin('')
      setConfirmPin('')
      setStep('input')
      setAttempts(0)
      setLocked(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleDigit = (d: string) => {
    if (locked) return
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    if (next.length === 6 && step === 'confirm') {
      if (next === confirmPin) {
        import('../../../services/mobile/biometric/BiometricLogin').then(({ biometricLogin: b }) => b.setPin(userId, next))
        void message.success(mode === 'create' ? 'PIN 码设置成功' : 'PIN 码已更新')
        onSuccess()
      } else {
        void message.error('两次输入的 PIN 码不一致')
        setPin('')
        setConfirmPin('')
        setStep('input')
      }
    }
    if (next.length === 6 && step === 'input' && mode === 'verify') {
      import('../../../services/mobile/biometric/BiometricLogin').then(async ({ biometricLogin: b }) => {
        const ok = await b.verifyPin(userId, next)
        if (ok) {
          onSuccess()
        } else {
          setAttempts(a => {
            const nextA = a + 1
            if (nextA >= maxAttempts) {
              setLocked(true)
              void message.error('已达最大尝试次数')
              setTimeout(() => onCancel(), 3000)
            } else {
              void message.warning(`PIN 码错误，剩余 ${maxAttempts - nextA} 次`)
            }
            setPin('')
            return nextA
          })
        }
      })
    }
  }

  const handleDelete = () => {
    if (locked) return
    setPin(p => p.slice(0, -1))
  }

  const handleSubmitStep = () => {
    if (step === 'input' && pin.length === 6 && mode === 'create') {
      setConfirmPin(pin)
      setPin('')
      setStep('confirm')
    }
  }

  const handleClear = () => {
    setPin('')
    setConfirmPin('')
    setStep('input')
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      closable={false}
      centered
      width={320}
      destroyOnHidden
    >
      <Space orientation="vertical" align="center" style={{ width: '100%', padding: '16px 0' }} size={16}>
        <div style={{ color: '#3b82f6' }}><Lock size={36} /></div>
        <Text strong style={{ fontSize: 16 }}>
          {locked ? '已锁定' : step === 'confirm' ? '请再次输入 PIN 码确认' : mode === 'create' ? '设置 PIN 码' : mode === 'change' ? '输入新 PIN 码' : '输入 PIN 码'}
        </Text>
        {locked && <Text type="danger"><AlertTriangle size={14} /> 多次尝试失败，请稍后再试</Text>}

        <Input.Password
          ref={inputRef}
          value={pin}
          readOnly
          visibilityToggle={{ visible, onVisibleChange: setVisible }}
          style={{ width: 200, textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
          variant="borderless"
          size="large"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <Button key={d} shape="circle" size="large" onClick={() => handleDigit(String(d))} disabled={locked}
              style={{ width: 56, height: 56, fontSize: 20 }}>{d}</Button>
          ))}
          <Button shape="circle" size="large" onClick={handleClear} disabled={locked}
            style={{ width: 56, height: 56 }}><KeyRound size={18} /></Button>
          <Button shape="circle" size="large" onClick={() => handleDigit('0')} disabled={locked}
            style={{ width: 56, height: 56, fontSize: 20 }}>0</Button>
          <Button shape="circle" size="large" onClick={handleDelete} disabled={locked}
            style={{ width: 56, height: 56 }}>⌫</Button>
        </div>

        <Space size={12}>
          {onSwitchToBiometric && <Button type="link" size="small" onClick={onSwitchToBiometric}>使用生物识别</Button>}
          {mode !== 'create' && <Button type="link" size="small" onClick={onCancel}>取消</Button>}
          {step === 'input' && pin.length === 6 && mode === 'create' && (
            <Button type="primary" size="small" onClick={handleSubmitStep}>下一步</Button>
          )}
        </Space>
      </Space>
    </Modal>
  )
}

export default PinEntry
