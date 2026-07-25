import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Typography, Alert, Row, Col, Tag, Progress, Checkbox, Divider, message, Statistic } from 'antd';
import { ScanFace, Fingerprint, Mic, Eye, ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { BiometricModality, BiometricMultiModalResult } from '../../types/sign';
import { biometricService } from '../../services/sign/biometricService';

const { Title, Text } = Typography;

const MODALITY_META: Record<BiometricModality, { label: string; icon: React.ReactNode; color: string }> = {
  face: { label: '人脸识别', icon: <ScanFace size={16} />, color: '#3b82f6' },
  fingerprint: { label: '指纹识别', icon: <Fingerprint size={16} />, color: '#10b981' },
  voice: { label: '声纹识别', icon: <Mic size={16} />, color: '#8b5cf6' },
  iris: { label: '虹膜识别', icon: <Eye size={16} />, color: '#f59e0b' },
};

export interface MultiModalSignatureProps {
  userId: string;
  userName: string;
  onComplete?: (result: BiometricMultiModalResult) => void;
  onError?: (error: string) => void;
  requiredModalities?: BiometricModality[];
}

export const MultiModalSignature: React.FC<MultiModalSignatureProps> = ({
  userId,
  userName,
  onComplete,
  onError,
  requiredModalities = ['face'],
}) => {
  const [selected, setSelected] = useState<BiometricModality[]>(requiredModalities);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<BiometricMultiModalResult | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (progressRef.current !== null) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
  }, []);

  const toggleModality = (m: BiometricModality) => {
    setSelected((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const handleVerify = async () => {
    if (selected.length === 0) {
      message.warning('至少选择一种生物识别模态');
      return;
    }
    setVerifying(true);
    setProgress(0);
    setResult(null);
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 300);
    try {
      const samples = selected.map((m) => ({
        sampleId: `sample-${m}-${Date.now()}`,
        userId,
        modality: m,
        capturedAt: new Date().toISOString(),
        qualityScore: 0.9 + Math.random() * 0.1,
        payloadSize: Math.floor(8000 + Math.random() * 40000),
        deviceId: 'mock-device',
      }));
      const res = await biometricService.verifyMultiModal({
        userId,
        modalities: selected,
        samples,
        deviceId: 'mock-device',
      });
      setProgress(100);
      setResult(res);
      if (res.success) {
        message.success(`多模态验证通过 (融合分 ${(res.fusionScore * 100).toFixed(1)}%)`);
        onComplete?.(res);
      } else {
        message.error('多模态验证未通过');
        onError?.('多模态验证未通过');
      }
    } catch (e) {
      const msg = (e as Error).message;
      message.error(msg);
      onError?.(msg);
    } finally {
      if (progressRef.current !== null) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      setVerifying(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <ShieldCheck size={18} />
          <span>多模态生物识别</span>
          {result && (
            <Tag color={result.success ? 'green' : 'red'}>
              {result.success ? '通过' : '拒绝'}
            </Tag>
          )}
        </Space>
      }
      extra={<Tag icon={<ScanFace size={12} />}>{userName}</Tag>}
      style={{ width: '100%' }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Title level={5}>选择识别模态</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            {(Object.entries(MODALITY_META) as [BiometricModality, typeof MODALITY_META[BiometricModality]][]).map(([key, meta]) => (
              <Checkbox
                key={key}
                checked={selected.includes(key)}
                onChange={() => toggleModality(key)}
                disabled={verifying || (result?.success ?? false)}
              >
                <Space>
                  {meta.icon}
                  <Text>{meta.label}</Text>
                </Space>
              </Checkbox>
            ))}
          </Space>

          <Divider />

          <Button
            type="primary"
            block
            loading={verifying}
            disabled={result?.success ?? false}
            onClick={handleVerify}
            icon={verifying ? <Loader2 size={14} /> : <ShieldCheck size={14} />}
          >
            {verifying ? `验证中 ${progress}%` : result?.success ? '已验证' : '开始多模态验证'}
          </Button>

          {verifying && <Progress percent={progress} status="active" style={{ marginTop: 8 }} />}
        </Col>

        <Col span={12}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type={result.success ? 'success' : 'error'}
                showIcon
                message={result.success ? '验证通过' : '验证拒绝'}
                description={
                  result.success
                    ? `融合评分 ${(result.fusionScore * 100).toFixed(1)}%`
                    : (result as any).errorMessage ?? '未知错误'
                }
              />
              <Row gutter={8}>
                {selected.map((m) => (
                  <Col span={12} key={m}>
                    <Card size="small">
                      <Statistic
                        title={MODALITY_META[m].label}
                        value={((result.modalityScores[m] ?? 0) * 100).toFixed(1)}
                        suffix="%"
                        valueStyle={{
                          color: (result.modalityScores[m] ?? 0) >= (m === 'fingerprint' ? 0.9 : m === 'iris' ? 0.92 : m === 'face' ? 0.85 : 0.8) ? '#10b981' : '#ef4444',
                          fontSize: 18,
                        }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
              <Space>
                <Text type="secondary">活体检测:</Text>
                <Tag color={result.livenessPassed ? 'green' : 'red'}>
                  {result.livenessPassed ? '通过' : '未通过'}
                </Tag>
                <Text type="secondary">决策:</Text>
                <Tag color={result.decision === 'allow' ? 'green' : result.decision === 'challenge' ? 'orange' : 'red'}>
                  {result.decision === 'allow' ? '允许' : result.decision === 'challenge' ? '挑战' : '拒绝'}
                </Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>验证时间: {new Date(result.verifiedAt).toLocaleString('zh-CN')}</Text>
            </Space>
          ) : (
            <Alert
              type="info"
              showIcon
              message="多模态融合验证"
              description={
                <div>
                  <Text>选择至少一种模态进行验证, 系统将进行融合评分。</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 12 }}>
                    <li>人脸: 活体检测 + 人脸比对 (阈值 85%)</li>
                    <li>指纹: 特征点匹配 (阈值 90%)</li>
                    <li>声纹: 语音特征提取 (阈值 80%)</li>
                    <li>虹膜: 虹膜纹理分析 (阈值 92%)</li>
                  </ul>
                </div>
              }
            />
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default MultiModalSignature;
