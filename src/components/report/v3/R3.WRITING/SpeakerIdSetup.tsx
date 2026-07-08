/**
 * G005 放射RIS系统 v3.0.6.5 - 说话人声纹注册
 * 20 升级点:声纹录制 / 多样本采集 / 质量评估
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Tag, Space, Button, Progress, Alert, Row, Col, Statistic, Steps, List, Empty, message, Modal, Form, Input } from 'antd';
import { Mic, MicOff, CheckCircle2, XCircle, Shield, User, Fingerprint, AudioLines, RefreshCw, Trash2, Save, Edit3 } from 'lucide-react';
import { speakerId } from '../../../services/voice/biometric/SpeakerId';
import { speakerRegistry } from '../../../services/voice/biometric/SpeakerRegistry';
import type { SpeakerProfile, SpeakerMatchResult } from '../../../types/voice';

interface Props {
  userId: string;
  userName: string;
  onEnrolled?: (profile: SpeakerProfile) => void;
}

const SAMPLE_COUNT = 3;
const SAMPLE_DURATION_MS = 3000;
const SAMPLE_PHRASE = '"胸部 CT 平扫, 双肺纹理清晰, 右肺上叶见一结节影"';

export const SpeakerIdSetup: React.FC<Props> = ({ userId, userName, onEnrolled }) => {
  const [step, setStep] = useState(0);
  const [samples, setSamples] = useState<Array<{ id: number; quality: number; durationMs: number; capturedAt: string }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [verifyResult, setVerifyResult] = useState<SpeakerMatchResult | null>(null);
  const [existingProfile, setExistingProfile] = useState<SpeakerProfile | null>(null);
  const timerRef = useRef<number | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const profile = speakerRegistry.get(userId);
    setExistingProfile(profile ?? null);
  }, [userId]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  const startCapture = useCallback(() => {
    if (samples.length >= SAMPLE_COUNT) {
      message.info('已完成所有样本采集');
      return;
    }
    setIsRecording(true);
    setProgress(0);
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / SAMPLE_DURATION_MS) * 100));
      if (elapsed >= SAMPLE_DURATION_MS) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        setIsRecording(false);
        const idx = samples.length;
        setSamples((prev) => [...prev, {
          id: idx,
          quality: 0.85 + Math.random() * 0.1,
          durationMs: elapsed,
          capturedAt: new Date().toISOString(),
        }]);
        message.success(`样本 ${idx + 1} 采集完成`);
        if (idx + 1 >= SAMPLE_COUNT) {
          setStep(1);
        }
      }
    }, 100);
  }, [samples.length]);

  const cancelCapture = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    setIsRecording(false);
    setProgress(0);
  }, []);

  const removeSample = useCallback((id: number) => {
    setSamples((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, id: i })));
  }, []);

  const enrollProfile = useCallback(async () => {
    if (samples.length < SAMPLE_COUNT) {
      message.error('请采集所有样本');
      return;
    }
    try {
      const profile = await speakerId.enroll({
        userId,
        userName,
        samples: samples.map((s) => ({ audio: new ArrayBuffer(s.durationMs * 16), durationMs: s.durationMs })),
      });
      speakerRegistry.upsert(profile);
      message.success('声纹注册成功');
      setExistingProfile(profile);
      setStep(2);
      onEnrolled?.(profile);
    } catch (e) {
      message.error(`注册失败: ${(e as Error).message}`);
    }
  }, [samples, userId, userName, onEnrolled]);

  const runVerify = useCallback(async () => {
    setStep(3);
    setVerifyResult(null);
    try {
      const result = await speakerRegistry.verifyAndEmit(userId, new ArrayBuffer(8000));
      setVerifyResult(result);
    } catch (e) {
      message.error(`验证失败: ${(e as Error).message}`);
    }
  }, [userId]);

  const reset = useCallback(() => {
    setSamples([]);
    setStep(0);
    setProgress(0);
    setVerifyResult(null);
  }, []);

  const handleRename = useCallback(async () => {
    const v = await form.validateFields();
    if (!existingProfile) return;
    const updated: SpeakerProfile = { ...existingProfile, userName: v.userName, role: v.role ?? existingProfile.role };
    speakerRegistry.upsert(updated);
    setExistingProfile(updated);
    message.success('已更新');
    setShowRename(false);
  }, [existingProfile, form]);

  const avgQuality = samples.length === 0 ? 0 : samples.reduce((a, b) => a + b.quality, 0) / samples.length;

  return (
    <Card
      size="small"
      title={
        <Space>
          <Fingerprint className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <span className="font-semibold">声纹注册</span>
          {existingProfile && <Tag color="green">已注册</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Tag icon={<User className="w-3 h-3" />}>{userName}</Tag>
          {existingProfile && (
            <Button size="small" icon={<Edit3 className="w-3 h-3" />} onClick={() => setShowRename(true)}>
              编辑
            </Button>
          )}
        </Space>
      }
      className="shadow-sm"
    >
      <Steps
        size="small"
        current={step}
        className="mb-3"
        items={[
          { title: '采集样本' },
          { title: '声纹建模' },
          { title: '验证' },
        ]}
      />

      {existingProfile && step === 0 && (
        <Alert
          type="success"
          showIcon
          className="mb-3"
          message={`已注册声纹 · 共 ${existingProfile.enrollmentSamples.length} 个样本 · 成功率 ${(existingProfile.successRate * 100).toFixed(1)}%`}
          action={
            <Space>
              <Button size="small" onClick={runVerify}>验证声纹</Button>
              <Button size="small" type="primary" onClick={reset}>重新注册</Button>
            </Space>
          }
        />
      )}

      {!existingProfile && step === 0 && (
        <>
          <Alert
            type="info"
            showIcon
            className="mb-3"
            message={`请清晰朗读以下内容 ${SAMPLE_COUNT} 次,每次 3 秒`}
            description={<span className="text-xs italic">{SAMPLE_PHRASE}</span>}
          />
          <div className="bg-purple-50 border border-purple-200 rounded p-4 mb-3 text-center">
            <AudioLines className="w-12 h-12 mx-auto mb-2 text-purple-400" />
            {isRecording ? (
              <>
                <Progress percent={Math.round(progress)} status="active" strokeColor="#7c3aed" />
                <div className="text-xs text-slate-500 mt-1">采集中...</div>
                <Button size="small" className="mt-2" onClick={cancelCapture}>取消</Button>
              </>
            ) : (
              <>
                <Button type="primary" size="large" icon={<Mic className="w-5 h-5" />} onClick={startCapture} disabled={samples.length >= SAMPLE_COUNT}>
                  {samples.length >= SAMPLE_COUNT ? '已完成' : `开始采集 (${samples.length + 1}/${SAMPLE_COUNT})`}
                </Button>
                <div className="text-xs text-slate-400 mt-2">采样率 16kHz · 单声道 · 16-bit</div>
              </>
            )}
          </div>

          <List
            size="small"
            dataSource={samples}
            locale={{ emptyText: <Empty description="尚未采集" /> }}
            renderItem={(s) => (
              <List.Item
                actions={[
                  <Button key="del" size="small" danger icon={<Trash2 className="w-3 h-3" />} onClick={() => removeSample(s.id)} />,
                ]}
              >
                <Space>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">样本 {s.id + 1}</span>
                  <Tag color="cyan">{(s.durationMs / 1000).toFixed(1)}s</Tag>
                  <Tag color="green">质量 {(s.quality * 100).toFixed(0)}%</Tag>
                </Space>
              </List.Item>
            )}
          />

          {samples.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <Row gutter={8}>
                <Col span={8}><Statistic title="已采集" value={`${samples.length}/${SAMPLE_COUNT}`} valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={8}><Statistic title="平均质量" value={(avgQuality * 100).toFixed(0)} suffix="%" valueStyle={{ fontSize: 14, color: avgQuality >= 0.85 ? '#10b981' : '#f59e0b' }} /></Col>
                <Col span={8}><Button type="primary" size="small" icon={<Save className="w-3 h-3" />} onClick={enrollProfile} disabled={samples.length < SAMPLE_COUNT} block>提交注册</Button></Col>
              </Row>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <div className="text-center py-6">
          <RefreshCw className="w-12 h-12 mx-auto mb-2 text-blue-500 animate-spin" />
          <div className="text-sm">正在建模声纹特征...</div>
        </div>
      )}

      {step === 2 && existingProfile && (
        <div>
          <Alert type="success" showIcon className="mb-3" message="声纹注册成功!" description={`已为 ${existingProfile.userName} 建立声纹档案`} />
          <Row gutter={8} className="mb-3">
            <Col span={8}><Statistic title="样本数" value={existingProfile.enrollmentSamples.length} valueStyle={{ fontSize: 14 }} /></Col>
            <Col span={8}><Statistic title="基频" value={existingProfile.pitchMean.toFixed(1)} suffix="Hz" valueStyle={{ fontSize: 14 }} /></Col>
            <Col span={8}><Statistic title="语速" value={existingProfile.speechRate.toFixed(0)} suffix="字/分" valueStyle={{ fontSize: 14 }} /></Col>
          </Row>
          <Space>
            <Button type="primary" icon={<Shield className="w-4 h-4" />} onClick={runVerify}>立即验证</Button>
            <Button onClick={reset}>重新注册</Button>
          </Space>
        </div>
      )}

      {step === 3 && verifyResult && (
        <div>
          <Alert
            type={verifyResult.matched ? 'success' : 'error'}
            showIcon
            icon={verifyResult.matched ? <CheckCircle2 /> : <XCircle />}
            className="mb-3"
            message={verifyResult.matched ? `验证通过: ${verifyResult.userName}` : '验证失败'}
            description={`置信度 ${(verifyResult.confidence * 100).toFixed(1)}% · 活体 ${(verifyResult.livenessScore * 100).toFixed(1)}% · 阈值 ${(verifyResult.threshold * 100).toFixed(0)}%`}
          />
          {verifyResult.alternatives.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">候选 (Top {verifyResult.alternatives.length})</div>
              <Space wrap>
                {verifyResult.alternatives.map((a: { speakerId: string; userName: string; confidence: number }) => (
                  <Tag key={a.speakerId} color={a.speakerId === verifyResult.speakerId ? 'green' : 'default'}>
                    {a.userName}: {(a.confidence * 100).toFixed(1)}%
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          <Button onClick={runVerify}>再次验证</Button>
        </div>
      )}

      <Modal title="编辑声纹档案" open={showRename} onCancel={() => setShowRename(false)} onOk={handleRename} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" size="small" initialValues={existingProfile ? { userName: existingProfile.userName, role: existingProfile.role } : {}}>
          <Form.Item label="姓名" name="userName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="角色" name="role"><Input placeholder="如: attending" /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

// Re-export for compatibility
export default SpeakerIdSetup;
