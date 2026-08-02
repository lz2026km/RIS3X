/**
 * G005 RIS v3.0.6.6 - SMS 发送按钮 + 模板
 * 集成 SmsGateway,默认走阿里云短信
 */

import React, { useState } from 'react';
import { Button, Tooltip, Modal, Form, Input, Select, Space, message, Statistic, Tag, Alert, Divider } from 'antd';
import { MessageSquare, Send, Hash, DollarSign } from 'lucide-react';
import { defaultSmsRouter } from '../../services/notification/SmsGateway';

interface SmsSenderProps {
  /** 模板 ID (default: 'critical-v2') */
  templateId?: string;
  /** 默认号码(多个逗号分隔) */
  phones?: string[];
  /** 模板变量 */
  vars?: Record<string, string | number>;
  /** 触发短信类型 */
  criticalKind?: 'critical' | 'urgent' | 'warning' | 'info';
  /** 患者姓名 */
  patientName?: string;
  /** 规则名 */
  ruleName?: string;
  /** 报告医生姓名 */
  reportedBy?: string;
  /** 接收医生 */
  receivingDoctor?: string;
  /** 按钮形态 */
  type?: 'default' | 'primary' | 'link';
  size?: 'small' | 'middle' | 'large';
  text?: string;
  onSent?: (count: number, cost: number) => void;
}

const TEMPLATES: Record<string, { label: string; content: string; required: string[] }> = {
  'critical-v2': {
    label: '危急值通知 v2',
    content: '【G005 RIS】{reportedBy} 报告:{patientName}({ruleName}),请 {receivingDoctor} 立即接收处理。',
    required: ['reportedBy', 'patientName', 'ruleName', 'receivingDoctor'],
  },
  'critical-reminder': {
    label: '危急值升级提醒',
    content: '【G005 RIS】{patientName} 危急值({ruleName})已 {minutes} 分钟未确认,请立即处理。',
    required: ['patientName', 'ruleName', 'minutes'],
  },
  'critical-close': {
    label: '闭环确认',
    content: '【G005 RIS】{patientName} 危急值已闭环:{conclusion}。',
    required: ['patientName', 'conclusion'],
  },
};

export const SmsSender: React.FC<SmsSenderProps> = ({
  templateId = 'critical-v2',
  phones: defaultPhones = [],
  vars,
  criticalKind = 'critical',
  patientName = '',
  ruleName = '',
  reportedBy = '张明远',
  receivingDoctor = '李医生',
  type = 'default',
  size = 'small',
  text = '短信通知',
  onSent,
}) => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [tplId, setTplId] = useState(templateId);

  const tpl = TEMPLATES[tplId];

  const renderPreview = () => {
    const merged = {
      patientName,
      ruleName,
      reportedBy,
      receivingDoctor,
      minutes: 5,
      conclusion: '已转 ICU 监护',
      ...vars,
    };
    return Object.entries(merged).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), String(v)),
      tpl?.content ?? '',
    );
  };

  const handleSend = async () => {
    const values = await form.validateFields();
    const list = (values.phones as string).split(/[,\s]+/).filter(Boolean);
    if (list.length === 0) {
      message.warning('请填写至少一个号码');
      return;
    }
    setBusy(true);
    const results = await defaultSmsRouter.dispatch({
      recipients: list.map((p) => ({ phone: p })),
      templateId: tplId,
      content: renderPreview(),
      signature: '【G005 RIS】',
      priority: criticalKind === 'critical' ? 'urgent' : criticalKind === 'urgent' ? 'high' : 'normal',
      metadata: { tplId, kind: criticalKind },
    });
    const success = results.filter((r) => r.success).length;
    const cost = results.reduce((a, b) => a + (b.cost ?? 0), 0);
    setBusy(false);
    setOpen(false);
    message.success(`已发送 ${success}/${list.length} 条,费用 ¥${cost.toFixed(3)}`);
    onSent?.(success, cost);
  };

  return (
    <>
      <Tooltip title={`通过 ${defaultSmsRouter.pick()?.displayName ?? 'SMS 通道'} 发送`}>
        <Button
          size={size}
          type={type}
          icon={<MessageSquare size={12} />}
          onClick={() => setOpen(true)}
          data-testid="sms-sender-btn"
        >
          {text}
        </Button>
      </Tooltip>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        title={
          <Space>
            <MessageSquare size={16} color="#3b82f6" />
            <strong>短信通知</strong>
            <Tag color="blue">{defaultSmsRouter.pick()?.displayName}</Tag>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ phones: defaultPhones.join(', ') }}>
          <Form.Item label="模板">
            <Select value={tplId} onChange={setTplId} options={Object.entries(TEMPLATES).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Form.Item label="号码(逗号或空格分隔)" name="phones" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="13800001111, 13800002222" />
          </Form.Item>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            <Hash size={10} /> 预览
          </div>
          <Alert type="info" title={renderPreview()} />
          <Space size={20} style={{ marginTop: 12 }}>
            <Statistic
              title="预计费用"
              value={(defaultPhones.length || 1) * 0.045}
              prefix={<DollarSign size={12} />}
              precision={3}
              suffix="元"
              styles={{ content: {  fontSize: 14  } }}
            />
            <Statistic
              title="字符"
              value={renderPreview().length}
              styles={{ content: {  fontSize: 14  } }}
            />
          </Space>
          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button type="primary" icon={<Send size={12} />} loading={busy} onClick={handleSend}>
              立即发送
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default SmsSender;