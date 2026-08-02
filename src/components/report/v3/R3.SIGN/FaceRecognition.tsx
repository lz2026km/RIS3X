/**
 * G005 放射RIS系统 v3.0.5.1 - R3.SIGN 人脸识别 (mock)
 * A5-REPORT / 20 点
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Typography, Alert, Progress, Row, Col, Tag, Statistic, List } from 'antd';
import { ScanFace, Camera, CheckCircle2, XCircle, Loader2, Shield, User } from 'lucide-react';
import { biometricService } from '../../../../services/sign/biometricService';
import type { BiometricVerifyResult } from '../../../../types/R3/R3.SIGN';

const { Title, Text, Paragraph } = Typography;

export interface FaceRecognitionProps {
  userId: string;
  userName: string;
  onVerified?: (result: BiometricVerifyResult) => void;
  onFailed?: (result: BiometricVerifyResult) => void;
  requiredConfidence?: number;
}

const STEPS = [
  { key: 'init', label: '初始化摄像头', duration: 600 },
  { key: 'capture', label: '采集人脸', duration: 800 },
  { key: 'liveness', label: '活体检测', duration: 1200 },
  { key: 'match', label: '人脸比对', duration: 800 },
  { key: 'done', label: '完成', duration: 0 },
];

export const FaceRecognition: React.FC<FaceRecognitionProps> = ({
  userId,
  userName,
  onVerified,
  onFailed,
  requiredConfidence = 0.85,
}) => {
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BiometricVerifyResult | null>(null);
  const [history, setHistory] = useState<BiometricVerifyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void biometricService
      .listByUser(userId)
      .then(setHistory)
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  useEffect(() => {
    if (stepIndex < 0 || stepIndex >= STEPS.length) return;
    const step = STEPS[stepIndex]!;
    if (step.duration === 0) return;
    let pct = 0;
    const interval = setInterval(() => {
      pct += 10;
      setProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, step.duration / 10);
    const timer = setTimeout(() => {
      if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    }, step.duration);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [stepIndex]);

  const drawFaceBox = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 60, 80, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy - 30);
    ctx.lineTo(cx - 15, cy - 30);
    ctx.moveTo(cx + 25, cy - 30);
    ctx.lineTo(cx + 15, cy - 30);
    ctx.moveTo(cx, cy + 10);
    ctx.arc(cx, cy + 10, 15, 0, Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${userName}`, cx - 25, cy + 100);
  };

  useEffect(() => {
    drawFaceBox();
  }, [userName, stepIndex]);

  const handleStart = async () => {
    setError(null);
    setRunning(true);
    setResult(null);
    setProgress(0);
    setStepIndex(0);
    try {
      for (let i = 0; i < STEPS.length; i++) {
        setStepIndex(i);
        const step = STEPS[i]!;
        await new Promise((r) => setTimeout(r, step.duration));
        setProgress(100);
      }
      const res = await biometricService.verify({ userId, method: 'face' });
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 20));
      if (res.success) onVerified?.(res);
      else onFailed?.(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const isSuccess = result?.success ?? false;
  const confidencePct = ((result?.confidence ?? 0) * 100).toFixed(1);
  const livenessPct = ((result?.livenessScore ?? 0) * 100).toFixed(1);

  return (
    <Card
      title={
        <Space>
          <ScanFace size={18} />
          <span>人脸识别 (Face Recognition)</span>
          {result && (
            <Tag color={isSuccess ? 'green' : 'red'} icon={isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}>
              {isSuccess ? '通过' : '失败'}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Tag icon={<User size={12} />}>{userName}</Tag>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <div
            style={{
              width: '100%',
              aspectRatio: '4/3',
              background: '#0f172a',
              borderRadius: 8,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              style={{ width: '100%', height: '100%' }}
            />
            {running && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                }}
              >
                <Loader2 size={32} className="spin" color="#fff" />
              </div>
            )}
          </div>

          {stepIndex >= 0 && stepIndex < STEPS.length && (
            <div style={{ marginTop: 8 }}>
              <Text>{STEPS[stepIndex]!.label}...</Text>
              <Progress percent={progress} showInfo={false} status={running ? 'active' : 'success'} />
            </div>
          )}

          <Space style={{ marginTop: 12, width: '100%' }}>
            <Button type="primary" icon={<Camera size={14} />} onClick={handleStart} loading={running} block>
              {running ? '识别中...' : '开始人脸识别'}
            </Button>
          </Space>
        </Col>

        <Col span={12}>
          {result ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Alert
                type={isSuccess ? 'success' : 'error'}
                showIcon
                title={isSuccess ? `识别通过 (置信度 ${confidencePct}%)` : `识别失败: ${result.errorMessage ?? '未知错误'}`}
              />
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic
                    title="人脸置信度"
                    value={Number(confidencePct)}
                    suffix="%"
                    styles={{ content: {  color: isSuccess ? '#10b981' : '#ef4444'  } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="活体评分"
                    value={Number(livenessPct)}
                    suffix="%"
                    styles={{ content: {  color: Number(livenessPct) >= 80 ? '#10b981' : '#f59e0b'  } }}
                  />
                </Col>
              </Row>
              <Text type="secondary">设备指纹: {result.deviceFingerprint}</Text>
              <Text type="secondary">验证时间: {new Date(result.verifiedAt).toLocaleString('zh-CN')}</Text>
              {!isSuccess && (
                <Alert type="warning" title="请重新调整姿势或光线后再次识别" showIcon />
              )}
            </Space>
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                title="使用说明"
                description={
                  <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>
                    <Shield size={12} /> 请正对摄像头，光线充足，不要佩戴口罩/墨镜。识别过程约 3-5 秒。
                  </Paragraph>
                }
              />
              <Text type="secondary">最低置信度要求: {(requiredConfidence * 100).toFixed(0)}%</Text>
            </Space>
          )}

          {error && <Alert type="error" showIcon title={error} />}
        </Col>
      </Row>

      {history.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 16 }}>历史记录</Title>
          <List
            size="small"
            dataSource={history.slice(0, 5)}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  {item.success ? <CheckCircle2 size={12} color="#10b981" /> : <XCircle size={12} color="#ef4444" />}
                  <Text style={{ fontSize: 12 }}>{item.method}</Text>
                  <Text style={{ fontSize: 12 }}>{(item.confidence * 100).toFixed(1)}%</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.verifiedAt).toLocaleString('zh-CN')}</Text>
                </Space>
              </List.Item>
            )}
          />
        </>
      )}
    </Card>
  );
};

export default FaceRecognition;