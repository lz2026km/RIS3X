/**
 * G005 放射RIS系统 v3.0.6.1 - 危急值确认弹窗
 */
import React, { useState } from 'react'
import { Modal, Input, Form, Select, Space, Tag } from 'antd'
import { Phone, MessageSquare, Mail, User } from 'lucide-react'
import type { CriticalFlowItem } from './CriticalFlow'

export interface AcknowledgeModalProps {
  open: boolean
  item?: CriticalFlowItem
  onCancel: () => void
  onConfirm: (payload: { acker: string; comment: string; notifMethod: string }) => void
}

export const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({ open, item, onCancel, onConfirm }) => {
  const [acker, setAcker] = useState('')
  const [comment, setComment] = useState('')
  const [method, setMethod] = useState<string>('PHONE')

  const handleOk = () => {
    if (!acker) return
    onConfirm({ acker, comment, notifMethod: method })
    setAcker('')
    setComment('')
  }

  return (
    <Modal
      title={item ? `确认危急值 - ${item.patientName}` : '确认危急值'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确认"
      cancelText="取消"
      okButtonProps={{ disabled: !acker }}
      data-testid="ack-modal"
    >
      {item && (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <div><Tag color="red">{item.finding}</Tag></div>
          <Form layout="vertical" size="small">
            <Form.Item label="确认人" required>
              <Input
                prefix={<User size={12} />}
                value={acker}
                onChange={(e) => setAcker(e.target.value)}
                placeholder="医师姓名"
                data-testid="ack-acker"
              />
            </Form.Item>
            <Form.Item label="通知方式">
              <Select value={method} onChange={setMethod} data-testid="ack-method"
                options={[
                  { value: 'PHONE', label: <span><Phone size={12} /> 电话</span> },
                  { value: 'SMS', label: <span><MessageSquare size={12} /> 短信</span> },
                  { value: 'EMAIL', label: <span><Mail size={12} /> 邮件</span> },
                  { value: 'APP', label: <span><MessageSquare size={12} /> APP</span> },
                ]}
              />
            </Form.Item>
            <Form.Item label="说明">
              <Input.TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="已通知临床医师..."
                rows={3}
                data-testid="ack-comment"
              />
            </Form.Item>
          </Form>
        </Space>
      )}
    </Modal>
  )
}

export default AcknowledgeModal