/**
 * G005 RIS v3.0.6.6 - 危急值接收端闭环确认 UI
 * 供临床医生/技师在移动端或工作站上快速确认接收、处理、关闭
 */

import React, { useMemo, useState } from 'react';
import {
  Card, Tag, Space, Button, Input, Modal, Steps, Statistic, Row, Col,
  message, Alert, Result, Timeline, Divider, Form,
} from 'antd';
import {
  CheckCircle2, Clock, Stethoscope, Phone,
  MessageSquare, ShieldCheck, X, User, Calendar, Hash,
} from 'lucide-react';
import type { CriticalEvent } from '../../types/R3/R3.CRITICAL';

export interface CloseLoopAcknowledgeProps {
  critical: CriticalEvent;
  currentUser: { id: string; name: string; title?: string };
  onAcknowledge?: (note?: string) => Promise<void> | void;
  onStartProcessing?: (note: string) => Promise<void> | void;
  onResolve?: (note: string) => Promise<void> | void;
  onReject?: (reason: string) => Promise<void> | void;
  onCallBack?: (phone: string) => void;
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatHM(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STEP_ITEMS = [
  { title: '发现', description: '影像检出危急值征象' },
  { title: '复核', description: '上级医师复核确认' },
  { title: '通知', description: '多渠道通知临床' },
  { title: '接收', description: '临床医师接收并处理' },
  { title: '闭环', description: '归档完成,关闭流程' },
];

export const CloseLoopAcknowledge: React.FC<CloseLoopAcknowledgeProps> = ({
  critical,
  currentUser,
  onAcknowledge,
  onStartProcessing,
  onResolve,
  onReject,
  onCallBack,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  const [startNote, setStartNote] = useState('');

  const elapsed = useMemo(() => minutesAgo(critical.reportedAt), [critical.reportedAt]);
  const slaBreached = useMemo(() => {
    const deadline = critical.level === 'critical' ? 5 : critical.level === 'urgent' ? 10 : 30;
    return elapsed > deadline;
  }, [critical.level, elapsed]);

  const stage = useMemo(() => {
    if (critical.status === 'resolved') return 4;
    if (critical.status === 'acknowledged' || critical.status === 'escalated') return 3;
    if (critical.status === 'notified') return 2;
    if (critical.status === 'pending') return 1;
    return 0;
  }, [critical.status]);

  const wrap = async (key: string, fn?: () => Promise<void> | void) => {
    if (!fn) return;
    setBusy(key);
    try {
      await fn();
      message.success('操作成功');
    } catch (e: any) {
      message.error(e?.message ?? '操作失败');
    } finally {
      setBusy(null);
    }
  };

  const acceptAndAcknowledge = async () => {
    await wrap('ack', () => onAcknowledge?.('临床医师已确认接收'));
  };

  return (
    <Card
      size="small"
      data-testid="close-loop-ack"
      title={
        <Space>
          <ShieldCheck size={16} color={slaBreached ? '#dc2626' : '#10b981'} />
          <strong>危急值闭环确认</strong>
          <Tag color={slaBreached ? 'red' : 'green'}>
            已耗时 {elapsed} 分钟
          </Tag>
          <Tag color="purple">接收人:{currentUser.name}({currentUser.title ?? '医师'})</Tag>
        </Space>
      }
    >
      {slaBreached && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={`SLA 超时:已耗时 ${elapsed} 分钟,推荐立即处理或升级`}
        />
      )}

      <Steps
        size="small"
        current={stage}
        items={STEP_ITEMS.map((s, i) => ({
          title: s.title,
          description: s.description,
          status: i < stage ? 'finish' : i === stage ? 'process' : 'wait',
        }))}
      />

      <Divider style={{ margin: '12px 0' }} />

      <Row gutter={12}>
        <Col span={14}>
          <Card size="small" type="inner" title="危急值信息">
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap>
                <Badge color="#7c3aed" />
                <strong>{critical.patientName}</strong>
                <Tag>{critical.gender} · {critical.age}岁</Tag>
                <Tag color="blue">{critical.modality}</Tag>
                <Tag color="cyan">{critical.bodyPart}</Tag>
              </Space>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                {critical.ruleCode} · {critical.ruleName}
              </div>
              <div style={{ fontSize: 12 }}>📋 {critical.detail}</div>
              <Space size={4} wrap>
                <Tag icon={<User size={10} />}>{critical.reportedByName}</Tag>
                <Tag icon={<Calendar size={10} />}>{formatHM(critical.reportedAt)}</Tag>
                <Tag icon={<Hash size={10} />}>{critical.id}</Tag>
                {critical.veto && <Tag color="red">一票否决</Tag>}
                {critical.dualReviewRequired && <Tag color="purple">需双审</Tag>}
              </Space>
            </Space>
          </Card>
        </Col>
        <Col span={10}>
          <Card size="small" type="inner" title="操作">
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              <Row gutter={6}>
                <Col span={12}>
                  <Statistic
                    title="报告→接收"
                    value={elapsed}
                    suffix="min"
                    styles={{ content: {  fontSize: 16, color: slaBreached ? '#dc2626' : '#10b981'  } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="状态"
                    value={critical.status}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
              </Row>
              {critical.status === 'pending' || critical.status === 'notified' ? (
                <Button
                  block
                  type="primary"
                  icon={<CheckCircle2 size={12} />}
                  loading={busy === 'ack'}
                  onClick={acceptAndAcknowledge}
                >
                  接收并确认
                </Button>
              ) : null}
              {critical.status === 'acknowledged' ? (
                <Button
                  block
                  type="primary"
                  icon={<Stethoscope size={12} />}
                  loading={busy === 'start'}
                  onClick={() => setStartOpen(true)}
                >
                  开始处理
                </Button>
              ) : null}
              {(critical.status === 'acknowledged' || critical.status === 'escalated') ? (
                <Button
                  block
                  icon={<CheckCircle2 size={12} />}
                  loading={busy === 'resolve'}
                  onClick={() => setResolveOpen(true)}
                >
                  处理完成·闭环
                </Button>
              ) : null}
              <Space.Compact style={{ width: '100%' }}>
                <Button
                  icon={<Phone size={12} />}
                  onClick={() => onCallBack?.(critical.receivingDoctorId ?? '')}
                  disabled={!onCallBack}
                >
                  回拨报告医生
                </Button>
                <Button
                  icon={<MessageSquare size={12} />}
                  onClick={() => message.info('短信功能由 SmsSender 提供')}
                >
                  短信回复
                </Button>
              </Space.Compact>
              <Button
                block
                danger
                icon={<X size={12} />}
                onClick={() => setRejectOpen(true)}
              >
                拒绝/转他人
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {critical.channelAttempts.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>通知尝试</div>
          <Timeline
            items={critical.channelAttempts.map((a) => ({
              color: a.success ? 'green' : 'red',
              children: (
                <span style={{ fontSize: 12 }}>
                  {a.channel} {a.success ? '✓' : '✗'} {formatHM(a.attemptedAt)}
                </span>
              ),
            }))}
          />
        </>
      )}

      <Modal
        title="开始处理"
        open={startOpen}
        onCancel={() => setStartOpen(false)}
        onOk={async () => {
          await wrap('start', () => onStartProcessing?.(startNote));
          setStartOpen(false);
        }}
      >
        <Form layout="vertical">
          <Form.Item label="处理方案">
            <Input.TextArea
              rows={3}
              value={startNote}
              onChange={(e) => setStartNote(e.target.value)}
              placeholder="如:通知急诊医生已评估,给予降压处理..."
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="闭环归档"
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        onOk={async () => {
          await wrap('resolve', () => onResolve?.(resolveNote));
          setResolveOpen(false);
        }}
      >
        <Form layout="vertical">
          <Form.Item label="处理结果">
            <Input.TextArea
              rows={3}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="如:患者已转ICU,复查 CT 出血未增加..."
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="拒绝 / 转他人"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (rejectReason.length < 5) {
            message.warning('请填写不少于 5 字符原因');
            return;
          }
          await wrap('reject', () => onReject?.(rejectReason));
          setRejectOpen(false);
        }}
      >
        <Form layout="vertical">
          <Form.Item label="原因">
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="如:非本科患者,转急诊神内..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {critical.status === 'resolved' && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Result
            status="success"
            title="闭环已完成"
            subTitle={`处理完成时间 ${formatHM(critical.resolvedTime)}`}
            icon={<ShieldCheck size={32} color="#10b981" />}
          />
        </>
      )}
    </Card>
  );
};

export default CloseLoopAcknowledge;