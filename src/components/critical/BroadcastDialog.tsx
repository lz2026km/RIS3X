/**
 * G005 RIS v3.0.6.6 - 群体广播对话框
 * 大规模/科室/全院级别的危急值通知
 */

import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, Radio, Switch, Space, Button, Tag, Alert,
  Statistic, Row, Col, Card, Result, message, Divider, Progress,
} from 'antd';
import {
  Megaphone, Users, Building2, Send, MessageSquare, Phone,
  CheckCircle2, Volume2, ListChecks,
} from 'lucide-react';
import { broadcaster } from '../../services/critical/broadcast/Broadcaster';
import type { BroadcastInput, BroadcastResult } from '../../services/critical/broadcast/Broadcaster';

interface BroadcastDialogProps {
  open: boolean;
  onClose: () => void;
  criticalId?: string;
  defaultTitle?: string;
  defaultMessage?: string;
  onCompleted?: (result: BroadcastResult) => void;
}

type ScopeKind = 'department' | 'hospital' | 'role' | 'phones';

export const BroadcastDialog: React.FC<BroadcastDialogProps> = ({
  open,
  onClose,
  criticalId,
  defaultTitle = '',
  defaultMessage = '',
  onCompleted,
}) => {
  const [form] = Form.useForm();
  const [scopeKind, setScopeKind] = useState<ScopeKind>('department');
  const [channels, setChannels] = useState<Array<'sms' | 'voice' | 'inApp' | 'email' | 'wechat'>>(['sms', 'inApp']);
  const [withIvr, setWithIvr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const previewPhones = (): string[] => {
    const values = form.getFieldsValue();
    const input: BroadcastInput = {
      criticalId,
      title: values.title ?? '',
      message: values.message ?? '',
      channels,
      withIvr,
      ivrMenuId: 'ivr-cv-broadcast-v1',
      scope:
        scopeKind === 'department'
          ? { kind: 'department', department: values.department ?? '放射科' }
          : scopeKind === 'hospital'
            ? { kind: 'hospital' }
            : scopeKind === 'role'
              ? { kind: 'role', roles: values.roles ?? ['attending'] }
              : { kind: 'phones', phones: (values.phones ?? '').split(/[,\s]+/).filter(Boolean) },
    };
    return broadcaster.preview(input).phones;
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const input: BroadcastInput = {
      criticalId,
      title: values.title,
      message: values.message,
      channels,
      withIvr,
      ivrMenuId: 'ivr-cv-broadcast-v1',
      scope:
        scopeKind === 'department'
          ? { kind: 'department', department: values.department ?? '放射科' }
          : scopeKind === 'hospital'
            ? { kind: 'hospital' }
            : scopeKind === 'role'
              ? { kind: 'role', roles: values.roles ?? ['attending'] }
              : { kind: 'phones', phones: (values.phones ?? '').split(/[,\s]+/).filter(Boolean) },
    };
    setBusy(true);
    try {
      const r = await broadcaster.broadcast(input);
      setResult(r);
      message.success(`广播完成: ${r.totalRecipients} 人, 耗时 ${r.durationMs}ms`);
      onCompleted?.(r);
    } catch (e: any) {
      message.error(e?.message ?? '广播失败');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setResult(null);
    setChannels(['sms', 'inApp']);
    setWithIvr(true);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={640}
      title={
        <Space>
          <Megaphone size={16} color="#dc2626" />
          <strong>群体广播</strong>
          <Tag color="red">紧急</Tag>
        </Space>
      }
      destroyOnHidden
    >
      {result ? (
        <Result
          status="success"
          icon={<CheckCircle2 size={32} color="#10b981" />}
          title="广播完成"
          subTitle={`已通知 ${result.totalRecipients} 人,耗时 ${result.durationMs} ms`}
          extra={
            <Space orientation="vertical" style={{ width: '100%' }}>
              {Object.entries(result.perChannel).map(([ch, list]) => {
                const ok = list.filter((r) => r.success).length;
                return (
                  <Row key={ch} gutter={6}>
                    <Col span={6}><Tag color="blue">{ch}</Tag></Col>
                    <Col span={12}><Progress percent={list.length === 0 ? 0 : Math.round((ok / list.length) * 100)} size="small" /></Col>
                    <Col span={6} style={{ textAlign: 'right' }}>{ok}/{list.length}</Col>
                  </Row>
                );
              })}
              <Button type="primary" onClick={handleClose}>关闭</Button>
            </Space>
          }
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            title: defaultTitle,
            message: defaultMessage,
            department: '急诊科',
            roles: ['attending'],
            phones: '',
          }}
        >
          <Form.Item name="title" label="广播标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input prefix={<Megaphone size={12} />} placeholder="如:ICU 多例急性脑卒中" />
          </Form.Item>
          <Form.Item name="message" label="广播正文" rules={[{ required: true, message: '请填写正文' }]}>
            <Input.TextArea rows={3} placeholder="如:今日 14:00 起,ICU 出现 3 例急性脑卒中,请相关医师立即会诊" />
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} />

          <Form.Item label="广播范围">
            <Radio.Group value={scopeKind} onChange={(e) => setScopeKind(e.target.value)}>
              <Radio.Button value="department"><Building2 size={12} /> 科室</Radio.Button>
              <Radio.Button value="hospital"><Users size={12} /> 全院</Radio.Button>
              <Radio.Button value="role"><ListChecks size={12} /> 角色</Radio.Button>
              <Radio.Button value="phones">📞 指定号码</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {scopeKind === 'department' && (
            <Form.Item name="department" label="目标科室">
              <Select
                options={[
                  { value: '急诊科', label: '急诊科' },
                  { value: 'ICU', label: '重症医学科(ICU)' },
                  { value: '神经内科', label: '神经内科' },
                  { value: '心内科', label: '心内科' },
                  { value: '呼吸科', label: '呼吸科' },
                  { value: '放射科', label: '放射科' },
                ]}
              />
            </Form.Item>
          )}
          {scopeKind === 'role' && (
            <Form.Item name="roles" label="目标角色">
              <Select mode="multiple" options={[
                { value: 'attending', label: '首诊医师' },
                { value: 'associateChief', label: '主诊' },
                { value: 'chief', label: '科主任' },
                { value: 'director', label: '医务处' },
              ]} />
            </Form.Item>
          )}
          {scopeKind === 'phones' && (
            <Form.Item name="phones" label="号码(逗号/空格分隔)">
              <Input.TextArea rows={2} placeholder="13800001111, 13800002222" />
            </Form.Item>
          )}

          <Form.Item label="通知通道">
            <Select
              mode="multiple"
              value={channels}
              onChange={(v) => setChannels(v as typeof channels)}
              options={[
                { value: 'sms', label: <Space><MessageSquare size={12} />短信</Space> },
                { value: 'voice', label: <Space><Phone size={12} />语音</Space> },
                { value: 'inApp', label: <Space><Volume2 size={12} />应用内</Space> },
                { value: 'email', label: '邮件' },
                { value: 'wechat', label: '微信' },
              ]}
            />
          </Form.Item>

          <Form.Item label="同步 IVR 语音菜单">
            <Switch checked={withIvr} onChange={setWithIvr} checkedChildren="启用" unCheckedChildren="关闭" />
          </Form.Item>

          <Card size="small" type="inner" title="预览">
            <Row gutter={8}>
              <Col span={12}>
                <Statistic
                  title="预计收件人"
                  value={previewPhones().length}
                  prefix={<Users size={14} />}
                  styles={{ content: {  fontSize: 18  } }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="预计费用"
                  value={previewPhones().length * 0.05 * channels.length}
                  prefix="¥"
                  precision={2}
                  styles={{ content: {  fontSize: 18  } }}
                />
              </Col>
            </Row>
            {channels.includes('voice') && (
              <Alert
                style={{ marginTop: 8 }}
                type="info"
                title="语音通道将触发 Twilio / 讯飞听见 自动外呼,DTMF 按键 '2' = 确认知悉"
              />
            )}
          </Card>

          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" icon={<Send size={12} />} onClick={handleSubmit} loading={busy}>
              立即广播
            </Button>
          </Space>
        </Form>
      )}
    </Modal>
  );
};

export default BroadcastDialog;