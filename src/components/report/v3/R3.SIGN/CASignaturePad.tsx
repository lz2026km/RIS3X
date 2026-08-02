/**
 * G005 放射RIS系统 v3.0.5.1 - R3.SIGN CA 数字签章 Pad
 * A5-REPORT / 40 点
 *
 * 完整链路: selectCert -> password -> biometric -> computeHash -> rsaSign -> timestamp -> blockchain -> persist
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Steps, Alert, Space, Typography, Tag, Row, Col, Progress, Select, Input, Form, Divider, message, Tooltip, Badge } from 'antd';
import { Shield, Key, FileSignature, Hash, Clock, Link2, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { CertificateInfo, SignProgress, SignImageStyle } from '../../../../types/R3/R3.SIGN';
import type { BiometricModality } from '../../../../types/sign';
import { SIGN_IMAGE_TEMPLATES, QUALITY_GATE } from '../../../../types/R3/R3.SIGN';
import { signService } from '../../../../services/sign/signService';
import { blockchainService } from '../../../../services/sign/blockchainService';
import { biometricService } from '../../../../services/sign/biometricService';
import { useBreakpoint } from '../../../../hooks/useBreakpoint';

const { Title, Text, Paragraph } = Typography;

export interface CASignaturePadProps {
  reportId: string;
  content: string;
  qualityScore: number;
  authorId: string;
  authorName: string;
  authorTitle?: string;
  onSigned?: (result: { signatureId: string; contentHash: string; signatureValue: string; certificateSerial: string }) => void;
  onCancel?: () => void;
  defaultImageStyle?: SignImageStyle;
  includeTimestamp?: boolean;
  includeBlockchain?: boolean;
}

type Stage = 'select-cert' | 'auth' | 'biometric' | 'preview' | 'signing' | 'done';

const STAGE_LABEL: Record<Stage, string> = {
  'select-cert': '选择证书',
  auth: '签章密码',
  biometric: '二次校验',
  preview: '签章预览',
  signing: '执行签章',
  done: '完成',
};

export const CASignaturePad: React.FC<CASignaturePadProps> = ({
  reportId,
  content,
  qualityScore,
  authorId,
  authorName,
  authorTitle = '医师',
  onSigned,
  onCancel,
  defaultImageStyle = 'classic-red',
  includeTimestamp = true,
  includeBlockchain = true,
}) => {
  const [stage, setStage] = useState<Stage>('select-cert');
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [selectedCertId, setSelectedCertId] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imageStyle, setImageStyle] = useState<SignImageStyle>(defaultImageStyle);
  const [algorithm, setAlgorithm] = useState<'RSA-SHA256' | 'SM3-SM2'>('RSA-SHA256');
  const [includeTs, setIncludeTs] = useState(includeTimestamp);
  const [includeBc, setIncludeBc] = useState(includeBlockchain);
  const [signProgress, setSignProgress] = useState<SignProgress[]>([]);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<{ signatureId: string; contentHash: string; signatureValue: string; certificateSerial: string; signedAt: string } | null>(null);
  const [bioVerified, setBioVerified] = useState(false);
  const [bioVerifying, setBioVerifying] = useState(false);
  const [bioModality, setBioModality] = useState<BiometricModality>('face');
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    signService
      .listCertificates()
      .then((list) => {
        const userCerts = list.filter((c) => c.subject.userId === authorId);
        setCertificates(userCerts);
        if (userCerts.length === 1) setSelectedCertId(userCerts[0]!.id);
      })
      .catch((e) => setError((e as Error).message));
  }, [authorId]);

  const selectedCert = useMemo(
    () => certificates.find((c) => c.id === selectedCertId),
    [certificates, selectedCertId]
  );

  const gatePass = qualityScore >= QUALITY_GATE.minimumScore;
  const certDaysToExpiry = useMemo(() => {
    if (!selectedCert) return null;
    const ms = new Date(selectedCert.notAfter).getTime() - Date.now();
    return Math.floor(ms / (24 * 3600 * 1000));
  }, [selectedCert]);

  const goNext = () => {
    setError(null);
    if (stage === 'select-cert') {
      if (!selectedCertId) {
        message.warning('请选择证书');
        return;
      }
      setStage('auth');
    } else if (stage === 'auth') {
      if (password.length < 6) {
        message.warning('密码至少 6 字符');
        return;
      }
      setStage('biometric');
    } else if (stage === 'biometric') {
      if (!bioVerified) {
        message.warning('请先完成二次校验');
        return;
      }
      setStage('preview');
    } else if (stage === 'preview') {
      void doSign();
    }
  };

  const goBack = () => {
    setError(null);
    const order: Stage[] = ['select-cert', 'auth', 'biometric', 'preview', 'signing', 'done'];
    const idx = order.indexOf(stage);
    if (idx > 0) setStage(order[idx - 1]!);
  };

  const handleBiometric = async () => {
    setBioVerifying(true);
    try {
      const res = await biometricService.verify({ userId: authorId, method: bioModality as 'face' | 'fingerprint' | 'voice' });
      if (res.success) {
        setBioVerified(true);
        const label = bioModality === 'face' ? '人脸' : bioModality === 'fingerprint' ? '指纹' : bioModality === 'voice' ? '声纹' : '虹膜';
        message.success(`${label}识别成功 (置信度 ${(res.confidence * 100).toFixed(1)}%)`);
      } else {
        message.error(res.errorMessage ?? `${bioModality}识别失败`);
      }
    } finally {
      setBioVerifying(false);
    }
  };

  const doSign = async () => {
    if (!selectedCertId) return;
    setStage('signing');
    setSignProgress([]);
    setPercent(0);
    try {
      const signRes = await signService.signReport({
        reportId,
        content,
        certificateId: selectedCertId,
        password,
        algorithm,
        qualityScore,
        includeBlockchain: includeBc,
        includeTimestamp: includeTs,
      });
      setSignProgress(signRes.progress);
      setPercent(100);
      setResult({
        signatureId: signRes.signatureId,
        contentHash: signRes.contentHash,
        signatureValue: signRes.signatureValue,
        certificateSerial: signRes.certificateSerial,
        signedAt: signRes.signedAt,
      });
      if (includeBc && signRes.blockchainId) {
        await blockchainService.listProofs();
      }
      setStage('done');
      onSigned?.({
        signatureId: signRes.signatureId,
        contentHash: signRes.contentHash,
        signatureValue: signRes.signatureValue,
        certificateSerial: signRes.certificateSerial,
      });
      message.success('签章完成');
    } catch (e) {
      setError((e as Error).message);
      setStage('preview');
    }
  };

  const stageIndex = ['select-cert', 'auth', 'biometric', 'preview', 'signing', 'done'].indexOf(stage);

  return (
    <Card
      title={
        <Space>
          <Shield size={18} />
          <span>CA 数字签章</span>
          <Tag color={gatePass ? 'green' : 'red'}>{gatePass ? '门禁通过' : '门禁未通过'}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Text type="secondary">报告 {reportId}</Text>
          <Text type="secondary">|</Text>
          <Text>质量分 {qualityScore}</Text>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Steps
        size="small"
        current={stageIndex}
        items={[
          { title: STAGE_LABEL['select-cert'], icon: <Key size={14} /> },
          { title: STAGE_LABEL.auth, icon: <Shield size={14} /> },
          { title: STAGE_LABEL.biometric, icon: <Eye size={14} /> },
          { title: STAGE_LABEL.preview, icon: <FileSignature size={14} /> },
          { title: STAGE_LABEL.signing, icon: <Hash size={14} /> },
          { title: STAGE_LABEL.done, icon: <CheckCircle2 size={14} /> },
        ]}
        style={{ marginBottom: 16 }}
      />

      {!gatePass && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={`质量门禁未通过 (${qualityScore} < ${QUALITY_GATE.minimumScore})`}
          description="需先提升报告质量后再签发"
        />
      )}

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} title={error} closable onClose={() => setError(null)} />
      )}

      {stage === 'select-cert' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Form layout="vertical" form={form}>
            <Form.Item label="选择证书" required>
              <Select
                value={selectedCertId}
                onChange={setSelectedCertId}
                placeholder="请选择您的 CA 证书"
                style={{ width: '100%' }}
              >
                {certificates.map((c) => (
                  <Select.Option key={c.id} value={c.id} disabled={c.status !== 'active'}>
                    <Space>
                      <Badge color={c.status === 'active' ? 'green' : c.status === 'expired' ? 'orange' : 'red'} />
                      <span>{c.subject.commonName} ({c.subject.title})</span>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {c.serialNumber}
                      </Text>
                      {c.status !== 'active' && <Tag color="red">{c.status}</Tag>}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {certificates.length === 0 && (
              <Alert type="info" title={`未找到用户 ${authorName} (${authorId}) 的证书`} showIcon />
            )}
            <Form.Item label="签章算法">
              <Select value={algorithm} onChange={setAlgorithm} style={{ width: 200 }}>
                <Select.Option value="RSA-SHA256">RSA-SHA256</Select.Option>
                <Select.Option value="SM3-SM2">SM3-SM2 (国密)</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <label>
                  <input type="checkbox" checked={includeTs} onChange={(e) => setIncludeTs(e.target.checked)} /> TSA 时间戳
                </label>
                <label>
                  <input type="checkbox" checked={includeBc} onChange={(e) => setIncludeBc(e.target.checked)} /> 区块链存证
                </label>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      )}

      {stage === 'auth' && selectedCert && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title={`即将使用证书 ${selectedCert.serialNumber}`}
            description={`签发者: ${selectedCert.subject.commonName} | 有效期至 ${selectedCert.notAfter.slice(0, 10)}`}
          />
          <Form layout="vertical">
            <Form.Item label="签章密码 (6-32 字符)" required>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入证书密码"
                suffix={
                  <span style={{ cursor: 'pointer' }} onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                }
              />
            </Form.Item>
          </Form>
        </Space>
      )}

      {stage === 'biometric' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert
            type={bioVerified ? 'success' : 'warning'}
            showIcon
            title={bioVerified ? '二次校验已通过' : '请选择模态并完成二次校验'}
          />
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" title="选择校验方式">
                <Select
                  value={bioModality}
                  onChange={(v: BiometricModality) => { setBioModality(v); setBioVerified(false); }}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'face', label: '👤 人脸识别' },
                    { value: 'fingerprint', label: '🖐️ 指纹识别' },
                    { value: 'voice', label: '🎤 声纹识别' },
                  ]}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="执行校验">
                <Button
                  block
                  loading={bioVerifying}
                  disabled={bioVerified}
                  onClick={() => void handleBiometric()}
                  icon={<Eye size={14} />}
                >
                  {bioVerified ? '已校验' : `开始${bioModality === 'face' ? '人脸' : bioModality === 'fingerprint' ? '指纹' : '声纹'}校验`}
                </Button>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="多模态备选">
                <Alert type="info" showIcon title="支持 face / fingerprint / voice 三模态混合验证" style={{ fontSize: 12 }} />
              </Card>
            </Col>
          </Row>
        </Space>
      )}

      {stage === 'preview' && selectedCert && (
        <Row gutter={16}>
          <Col span={12}>
            <Title level={5}>签章图像预览</Title>
            <div
              style={{
                width: 120,
                height: 120,
                margin: '0 auto',
                border: `3px solid ${SIGN_IMAGE_TEMPLATES.find((t) => t.id === imageStyle)?.color ?? '#dc2626'}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 36, color: SIGN_IMAGE_TEMPLATES.find((t) => t.id === imageStyle)?.color, fontWeight: 700 }}>
                {SIGN_IMAGE_TEMPLATES.find((t) => t.id === imageStyle)?.preview}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{authorName}</div>
            </div>
            <Select
              value={imageStyle}
              onChange={setImageStyle}
              style={{ width: '100%', marginTop: 12 }}
              options={SIGN_IMAGE_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Col>
          <Col span={12}>
            <Title level={5}>签章元数据</Title>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text>报告 ID: {reportId}</Text>
              <Text>签章医师: {authorName} ({authorTitle})</Text>
              <Text>证书: {selectedCert.serialNumber}</Text>
              <Text>算法: {algorithm}</Text>
              <Text>质量分: <Tag color={gatePass ? 'green' : 'red'}>{qualityScore}</Tag></Text>
              <Text>时间戳: {includeTs ? <Tag color="blue" icon={<Clock size={12} />}>已启用</Tag> : '未启用'}</Text>
              <Text>区块链: {includeBc ? <Tag color="purple" icon={<Link2 size={12} />}>已启用</Tag> : '未启用'}</Text>
              {certDaysToExpiry !== null && (
                <Text>
                  证书剩余:
                  {certDaysToExpiry > 30 ? (
                    <Tag color="green">{certDaysToExpiry} 天</Tag>
                  ) : certDaysToExpiry > 0 ? (
                    <Tag color="orange" icon={<AlertTriangle size={12} />}>{certDaysToExpiry} 天</Tag>
                  ) : (
                    <Tag color="red">已过期</Tag>
                  )}
                </Text>
              )}
            </Space>
          </Col>
        </Row>
      )}

      {stage === 'signing' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Progress percent={percent} status="active" />
          {signProgress.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {p.percent >= 100 ? <CheckCircle2 size={14} color="#10b981" /> : <Loader2 size={14} className="spin" />}
              <Text>{p.message}</Text>
              <Tag>{p.percent}%</Tag>
            </div>
          ))}
        </Space>
      )}

      {stage === 'done' && result && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert type="success" showIcon title="签章完成" description={`签名 ${result.signatureId}`} />
          <Card size="small" title="签章结果">
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Text copyable>签名 ID: {result.signatureId}</Text>
              <Text copyable={{ text: result.contentHash }}>内容 Hash: {result.contentHash.slice(0, 32)}...</Text>
              <Text copyable={{ text: result.signatureValue }}>签名值: {result.signatureValue.slice(0, 32)}...</Text>
              <Text>证书序列号: {result.certificateSerial}</Text>
              <Text>签章时间: {result.signedAt}</Text>
            </Space>
          </Card>
        </Space>
      )}

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          {stage !== 'done' && stage !== 'signing' && (
            <Button onClick={goBack} disabled={stage === 'select-cert'}>
              上一步
            </Button>
          )}
          {onCancel && stage !== 'signing' && (
            <Button onClick={onCancel}>取消</Button>
          )}
        </Space>
        <Space>
          {stage !== 'done' && stage !== 'signing' && (
            <Tooltip title={!gatePass ? '质量门禁未通过' : ''}>
              <Button type="primary" onClick={goNext} disabled={!gatePass}>
                {stage === 'preview' ? '确认签章' : '下一步'}
              </Button>
            </Tooltip>
          )}
          {stage === 'done' && (
            <Button type="primary" onClick={onCancel}>
              完成
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );
};

export default CASignaturePad;