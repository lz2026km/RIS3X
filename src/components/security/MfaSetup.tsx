import React, { useState } from 'react'
import { Card, Steps, Button, Typography, Alert, Input, Space, Tag, Descriptions, Divider, List, Modal } from 'antd'
import { Smartphone, Shield, Key, QrCode, CheckCircle, Copy, RefreshCw, Mail, MessageSquare } from 'lucide-react'
import { mfaService, displaySecret } from '../../services/security'
import type { MfaMethod, MfaEnrollment } from '../../types/security'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const { Title, Text, Paragraph } = Typography

interface MfaSetupProps {
  userId: string
  userName: string
  onComplete?: (enrollment: MfaEnrollment) => void
}

export default function MfaSetup({ userId, userName, onComplete }: MfaSetupProps) {
  // A9-A7-P1-4/5: 窄屏自动 vertical Steps
  const bp = useBreakpoint()
  const isNarrow = bp === 'xs' || bp === 'sm' || bp === 'md'
  const [step, setStep] = useState(0)
  const [method, setMethod] = useState<MfaMethod>('totp')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const startEnroll = () => {
    const s = secret || (mfaService as any).generateSecret?.() ?? 'JBSWY3DPEHPK3PXP'
    setSecret(s)
    setStep(1)
  }

  const enroll = () => {
    try {
      const e = mfaService.enroll({ userId, primaryMethod: method })
      setEnrollment(e)
      setStep(2)
    } catch (err: unknown) {
      setResult({ success: false, message: String(err) })
    }
  }

  const verifyCode = async () => {
    const challenge = mfaService.issueChallenge({ userId, method, ipAddress: '127.0.0.1' })
    const r = await mfaService.verifyChallenge(challenge.challengeId, code)
    setResult(r.success
      ? { success: true, message: 'MFA 设置成功!' }
      : { success: false, message: r.reason ?? '验证失败' })
    if (r.success && enrollment) {
      onComplete?.(enrollment)
      setStep(3)
    }
  }

  const copyBackupCodes = () => {
    if (enrollment) navigator.clipboard.writeText(enrollment.backupCodes.join('\n'))
  }

  return (
    <Card>
      <Title level={4}><Shield style={{ marginRight: 8 }} />多因素认证 (MFA) 设置</Title>
      <Steps
        current={step}
        direction={isNarrow ? 'vertical' : 'horizontal'}
        items={[
          { title: '选择方法', icon: <Shield size={16} />, description: isNarrow ? '选择 MFA 方式' : undefined },
          { title: '配置', icon: <Key size={16} />, description: isNarrow ? '配置密钥' : undefined },
          { title: '验证', icon: <CheckCircle size={16} />, description: isNarrow ? '输入验证码' : undefined },
          { title: '完成', icon: <Smartphone size={16} />, description: isNarrow ? '启用成功' : undefined },
        ]}
        style={{ marginBottom: 24 }}
      />

      {step === 0 && (
        <div>
          <Paragraph>选择一个 MFA 方法以增强账户安全性</Paragraph>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button size="large" block type={method === 'totp' ? 'primary' : 'default'} icon={<QrCode size={16} />}
              onClick={() => setMethod('totp')}>TOTP 验证器 (Google Authenticator / Microsoft Authenticator)</Button>
            <Button size="large" block type={method === 'sms' ? 'primary' : 'default'} icon={<MessageSquare size={16} />}
              onClick={() => setMethod('sms')}>短信验证码</Button>
            <Button size="large" block type={method === 'email' ? 'primary' : 'default'} icon={<Mail size={16} />}
              onClick={() => setMethod('email')}>邮件验证码</Button>
          </Space>
          <Divider />
          <Button type="primary" onClick={startEnroll}>下一步</Button>
        </div>
      )}

      {step === 1 && (
        <div>
          <Alert title="使用 TOTP 验证器扫描下方密钥, 或手动输入" type="info" showIcon style={{ marginBottom: 16 }} />
          {method === 'totp' && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Paragraph copyable={{ text: secret }}><Text code style={{ fontSize: 16 }}>{displaySecret(secret)}</Text></Paragraph>
              <Paragraph><Text type="secondary">在验证器中输入此密钥</Text></Paragraph>
            </div>
          )}
          <Space>
            <Input placeholder="输入 6 位验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
            <Button type="primary" onClick={enroll}>保存并验证</Button>
          </Space>
        </div>
      )}

      {step === 2 && (
        <div>
          <Input placeholder="输入验证码" value={code} onChange={e => setCode(e.target.value)} maxLength={6} style={{ width: 200 }} />
          <Button type="primary" onClick={verifyCode} style={{ marginLeft: 8 }}>验证</Button>
          {result && <Alert type={result.success ? 'success' : 'error'} title={result.message} showIcon style={{ marginTop: 16 }} />}
        </div>
      )}

      {step === 3 && enrollment && (
        <div>
          <Alert title="MFA 已成功启用" type="success" showIcon icon={<CheckCircle size={16} />} style={{ marginBottom: 16 }} />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="方法">{enrollment.primaryMethod}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color="green">已启用</Tag></Descriptions.Item>
            <Descriptions.Item label="注册时间">{new Date(enrollment.enrolledAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Title level={5}>备用恢复码 <Tag>请妥善保管</Tag></Title>
          <Paragraph><Text type="secondary">每个代码只能使用一次</Text></Paragraph>
          <List size="small" bordered dataSource={enrollment.backupCodes} renderItem={c => <List.Item><Text code>{c}</Text></List.Item>} style={{ maxWidth: 400 }} />
          <Space style={{ marginTop: 16 }}>
            <Button icon={<Copy size={14} />} onClick={copyBackupCodes}>复制</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => mfaService.regenerateBackupCodes(userId)}>重新生成</Button>
          </Space>
        </div>
      )}
    </Card>
  )
}
