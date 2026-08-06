/**
 * G005 RIS v3.0.6.6 - 语音呼叫按钮
 * 触发 Twilio / 讯飞听见 IVR 自动外呼
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button, Tooltip, Modal, Input, Space, message, Form, Statistic, Alert, Tag, Result } from 'antd';
import { PhoneCall, Phone, Volume2, Clock } from 'lucide-react';
import { defaultVoiceRouter } from '../../services/notification/VoiceGateway';
import { ivrMenuService, DEFAULT_IVR_MENU_ID } from '../../services/notification/IVRMenu';

interface VoiceCallButtonProps {
  /** 缺省号码 */
  phone?: string;
  /** 患者姓名(注入 IVR 模板) */
  patientName?: string;
  /** 危急值规则名 */
  ruleName?: string;
  /** 检查方式 */
  modality?: string;
  /** 检查部位 */
  bodyPart?: string;
  /** IVR 菜单(默认危急值确认) */
  ivrMenuId?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮文本 */
  text?: string;
  /** 按钮形态 */
  type?: 'default' | 'primary' | 'link';
  /** 尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 启动后回调 */
  onStarted?: (providerCallId: string) => void;
}

interface CallState {
  providerCallId?: string;
  status: 'idle' | 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed';
  startedAt?: string;
  durationSec?: number;
  dtmfDigits?: string[];
}

export const VoiceCallButton: React.FC<VoiceCallButtonProps> = ({
  phone: defaultPhone,
  patientName = '未知患者',
  ruleName = '危急值',
  modality = 'CT',
  bodyPart = '胸部',
  ivrMenuId = DEFAULT_IVR_MENU_ID,
  disabled,
  text = '语音呼叫',
  type = 'default',
  size = 'small',
  onStarted,
}) => {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [calling, setCalling] = useState(false);
  const [call, setCall] = useState<CallState>({ status: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current !== null) clearInterval(pollRef.current);
  }, []);

  const trigger = async () => {
    const values = await form.validateFields();
    setCalling(true);
    const gateway = defaultVoiceRouter.getGateways()[0];
    if (!gateway) {
      message.error('无可用语音通道');
      setCalling(false);
      return;
    }
    const r = await gateway.playIvr(ivrMenuId, values.phone, {
      patientName,
      ruleName,
      modality,
      bodyPart,
    });
    if (r.success) {
      setCall({
        providerCallId: r.providerMessageId,
        status: 'initiated',
        startedAt: new Date().toISOString(),
      });
      message.success('语音呼叫已发起');
      onStarted?.(r.providerMessageId ?? '');
      // 模拟轮询状态
      pollStatus(r.providerMessageId ?? '');
    } else {
      message.error(r.errorMessage ?? '呼叫失败');
    }
    setCalling(false);
  };

  const pollStatus = async (id: string) => {
    const gateway = defaultVoiceRouter.getGateways()[0];
    if (!gateway) return;
    let attempts = 0;
    const stopPoll = () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        stopPoll();
        return;
      }
      let status;
      try {
        status = await gateway.queryCall(id);
      } catch {
        stopPoll();
        return;
      }
      setCall({
        providerCallId: id,
        status: status.status,
        startedAt: call.startedAt,
        durationSec: status.durationSec,
        dtmfDigits: status.dtmfDigits,
      });
      if (['completed', 'failed', 'no-answer', 'busy', 'dtmf-collected'].includes(status.status)) {
        stopPoll();
      }
    }, 1500);
  };

  const renderStatus = (s: CallState['status']) => {
    const meta: Record<CallState['status'], { color: string; text: string }> = {
      idle: { color: 'default', text: '空闲' },
      initiated: { color: 'blue', text: '已发起' },
      ringing: { color: 'cyan', text: '响铃中' },
      answered: { color: 'green', text: '已接听' },
      completed: { color: 'green', text: '已完成' },
      failed: { color: 'red', text: '失败' },
    };
    return <Tag color={meta[s].color}>{meta[s].text}</Tag>;
  };

  const menu = ivrMenuService.get(ivrMenuId);

  return (
    <>
      <Tooltip title={`通过 ${defaultVoiceRouter.pick()?.displayName ?? '语音通道'} 发起呼叫`}>
        <Button
          size={size}
          type={type}
          icon={<PhoneCall size={12} />}
          disabled={disabled}
          onClick={() => setOpen(true)}
          data-testid="voice-call-btn"
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
            <Volume2 size={16} color="#10b981" />
            <strong>语音呼叫</strong>
          </Space>
        }
      >
        {call.status === 'idle' || call.status === 'initiated' ? (
          <Form form={form} layout="vertical" initialValues={{ phone: defaultPhone }}>
            <Form.Item label="被叫号码" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
              <Input prefix={<Phone size={12} />} placeholder="13800001111" />
            </Form.Item>
            {menu && (
              <Alert
                type="info"
                showIcon
                title={
                  <span>
                    <strong>IVR 菜单:{menu.name}</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}>"{menu.greeting}"</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      {menu.items.map((it) => (
                        <Tag key={it.digit} color="blue">{it.digit}. {it.label}</Tag>
                      ))}
                    </div>
                  </span>
                }
              />
            )}
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button type="primary" icon={<PhoneCall size={12} />} onClick={trigger} loading={calling}>
                发起呼叫
              </Button>
            </Space>
          </Form>
        ) : (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Result
              status={call.status === 'failed' || call.status === 'no-answer' ? 'warning' : 'success'}
              icon={<PhoneCall size={36} color={call.status === 'failed' ? '#dc2626' : '#10b981'} />}
              title={renderStatus(call.status)}
              subTitle={call.startedAt ? <><Clock size={10} /> 发起于 {new Date(call.startedAt).toLocaleTimeString()}</> : undefined}
            />
            {call.durationSec !== undefined && (
              <Statistic title="通话时长" value={call.durationSec} suffix="s" />
            )}
            {call.dtmfDigits && call.dtmfDigits.length > 0 && (
              <Alert type="success" title={`医生按键: ${call.dtmfDigits.join(', ')} → 自动确认接收`} />
            )}
            <Button block onClick={() => setOpen(false)}>关闭</Button>
          </Space>
        )}
      </Modal>
    </>
  );
};

export default VoiceCallButton;