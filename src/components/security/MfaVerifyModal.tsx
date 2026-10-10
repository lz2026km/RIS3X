import React, { useState, useRef, useEffect } from 'react'
import { ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { message } from 'antd'
import { mfaService } from '../../services/security/mfa/MfaService'

export interface MfaVerifyModalProps {
  userId: string
  onVerified: (token: string) => void
  onCancel: () => void
  operation: string
}

export default function MfaVerifyModal({ userId, onVerified, onCancel, operation }: MfaVerifyModalProps) {
  const [token, setToken] = useState<string[]>(Array(6).fill(''))
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newToken = [...token]
    newToken[index] = value.slice(-1)
    setToken(newToken)
    setError('')
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !token[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  const handleVerify = async () => {
    const code = token.join('')
    if (code.length !== 6) {
      setError('请输入完整的6位验证码')
      return
    }
    setVerifying(true)
    setError('')

    const challenge = mfaService.issueChallenge({ userId, method: 'totp', ipAddress: 'client' })
    const result = await mfaService.verifyChallenge(challenge.challengeId, code)

    if (result.success) {
      message.success('MFA验证通过')
      onVerified(code)
    } else {
      setError(result.reason === 'invalid_code' ? '验证码错误，请重试' : `验证失败: ${result.reason}`)
      setToken(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    }
    setVerifying(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 16, width: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        }}>
          <ShieldCheck size={22} style={{ color: '#fff' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>MFA 验证</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>操作: {operation}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} style={{ color: '#fff' }} />
          </button>
        </div>

        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            请输入您的身份验证器应用中的 6 位数字验证码
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            {token.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                style={{
                  width: 44, height: 52, textAlign: 'center', fontSize: 22,
                  fontWeight: 700, border: `2px solid ${error ? '#dc2626' : digit ? '#1e40af' : '#e2e8f0'}`,
                  borderRadius: 8, background: error ? '#fef2f2' : '#fff',
                  color: '#1e40af', caretColor: '#1e40af',
                }}
              />
            ))}
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: '#dc2626', fontSize: 12, marginBottom: 16,
            }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 8,
              border: 'none', background: verifying ? '#94a3b8' : '#1e40af',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: verifying ? 'not-allowed' : 'pointer',
            }}
          >
            {verifying ? '验证中...' : '验证'}
          </button>

          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
            验证码有效期 5 分钟
          </div>
        </div>
      </div>
    </div>
  )
}
