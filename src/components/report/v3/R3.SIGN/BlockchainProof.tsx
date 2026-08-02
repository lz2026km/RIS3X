/**
 * G005 放射RIS系统 v3.0.5.1 - R3.SIGN 区块链存证
 * A5-REPORT / 30 点
 *
 * 展示签章哈希已上链的存证记录，含区块号 / 交易 hash / 验证链接 / 确认数
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Tooltip, Descriptions, Row, Col, Progress, Empty, Alert, message } from 'antd';
import { Link2, ExternalLink, Hash, Box, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import type { BlockchainProof } from '../../../../types/R3/R3.SIGN';
import { blockchainService } from '../../../../services/sign/blockchainService';

const { Title, Text, Paragraph } = Typography;

export interface BlockchainProofProps {
  reportId: string;
  contentHash?: string;
  autoLoad?: boolean;
  onAnchor?: (proof: BlockchainProof) => void;
}

const NETWORK_META: Record<BlockchainProof['network'], { label: string; color: string; explorerUrl: string }> = {
  'hospital-chain': { label: 'G005 医院链', color: 'blue', explorerUrl: 'https://chain.g005-hospital.local' },
  'national-health-chain': { label: '国家健康链', color: 'purple', explorerUrl: 'https://health-chain.nhc.gov.cn' },
  'ethereum-testnet': { label: '以太坊测试网', color: 'green', explorerUrl: 'https://sepolia.etherscan.io' },
};

export const BlockchainProofView: React.FC<BlockchainProofProps> = ({
  reportId,
  contentHash,
  autoLoad = true,
  onAnchor,
}) => {
  const [proofs, setProofs] = useState<BlockchainProof[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await blockchainService.listByReport(reportId);
      setProofs(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, reportId]);

  const handleAnchor = async () => {
    if (!contentHash) {
      message.warning('缺少 contentHash，无法上链');
      return;
    }
    setAnchoring(true);
    try {
      const proof = await blockchainService.anchorToBlockchain({
        reportId,
        contentHash,
        signerId: 'current-user',
        certificateSerial: 'mock-serial',
      });
      setProofs((prev) => [...prev, proof]);
      onAnchor?.(proof);
    } finally {
      setAnchoring(false);
    }
  };

  const handleVerify = async (txHash: string) => {
    const res = await blockchainService.verify(txHash);
    if (res.found) {
      message.success(`区块链验证通过 · 区块号: ${res.proof?.blockNumber} · 确认数: ${res.proof?.confirmations}`);
    } else {
      message.error('未找到该交易记录');
    }
  };

  const isImmutable = proofs.every((p) => p.isImmutable);
  const avgConfirmations = useMemo(() => {
    if (proofs.length === 0) return 0;
    return Math.floor(proofs.reduce((acc, p) => acc + p.confirmations, 0) / proofs.length);
  }, [proofs]);

  const columns = [
    {
      title: '网络',
      dataIndex: 'network',
      key: 'network',
      render: (n: BlockchainProof['network']) => (
        <Tag color={NETWORK_META[n].color}>{NETWORK_META[n].label}</Tag>
      ),
    },
    {
      title: '交易 Hash',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (h: string) => (
        <Text copyable={{ text: h }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {h.slice(0, 16)}...{h.slice(-8)}
        </Text>
      ),
    },
    {
      title: '区块号',
      dataIndex: 'blockNumber',
      key: 'blockNumber',
      render: (n: number) => (
        <Space>
          <Box size={12} />
          <Text>{n.toLocaleString()}</Text>
        </Space>
      ),
    },
    {
      title: '确认数',
      dataIndex: 'confirmations',
      key: 'confirmations',
      render: (c: number) => (
        <Tag color={c >= 12 ? 'green' : c >= 6 ? 'blue' : 'orange'}>{c}</Tag>
      ),
    },
    {
      title: '存证时间',
      dataIndex: 'anchoredAt',
      key: 'anchoredAt',
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: BlockchainProof) => (
        <Space>
          <Tooltip title="区块链浏览器">
            <Button size="small" icon={<ExternalLink size={12} />} onClick={() => window.open(r.verifyUrl, '_blank')} />
          </Tooltip>
          <Tooltip title="验证存证">
            <Button size="small" icon={<ShieldCheck size={12} />} onClick={() => void handleVerify(r.txHash)}>
              验证
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <Link2 size={18} />
          <span>区块链存证</span>
          {proofs.length > 0 && (
            <Tag color={isImmutable ? 'green' : 'orange'} icon={isImmutable ? <CheckCircle2 size={12} /> : <Loader2 size={12} />}>
              {isImmutable ? '不可篡改' : '存证中'}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          {contentHash && (
            <Button type="primary" onClick={() => void handleAnchor()} loading={anchoring}>
              {contentHash ? '立即上链' : '需 contentHash'}
            </Button>
          )}
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={0}>
              <Text type="secondary">存证数</Text>
              <Title level={3} style={{ margin: 0 }}>{proofs.length}</Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={0}>
              <Text type="secondary">平均确认</Text>
              <Title level={3} style={{ margin: 0 }}>{avgConfirmations}</Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={0}>
              <Text type="secondary">内容 Hash</Text>
              <Text style={{ fontFamily: 'monospace', fontSize: 12 }} copyable={{ text: contentHash ?? '-' }}>
                {contentHash ? contentHash.slice(0, 18) + '...' : '-'}
              </Text>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={0}>
              <Text type="secondary">不可篡改</Text>
              <Tag color={isImmutable ? 'green' : 'orange'} style={{ fontSize: 16, padding: '4px 12px' }}>
                {isImmutable ? '✓ 已确认' : '⏳ 存证中'}
              </Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      {proofs.length === 0 ? (
        <Empty description={loading ? '加载中...' : '暂无存证记录'} />
      ) : (
        <Table
          size="small"
          dataSource={proofs}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      )}

      {proofs.length > 0 && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 12 }}
          title="存证验证提示"
          description={
            <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>
              <Hash size={12} /> 区块确认数 ≥ 12 时视为最终确认；本系统已通过 SHA-256 算法将报告内容哈希写入区块，任何篡改都会导致哈希不匹配。
            </Paragraph>
          }
        />
      )}
    </Card>
  );
};

export default BlockchainProofView;