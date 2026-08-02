import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Alert, Descriptions, Row, Col, Statistic, Empty } from 'antd';
import { Clock, Hash, ShieldCheck, Building2, RefreshCw, Search } from 'lucide-react';
import { timeStampService } from '../../services/sign/TimeStampService';
import type { TimeStampToken, TimeStampVerifyResult } from '../../types/sign';

const { Text } = Typography;

const TRUST_META: Record<TimeStampToken['trustLevel'], { label: string; color: string }> = {
  national: { label: '国家级 TSA', color: 'green' },
  hospital: { label: '医院级 TSA', color: 'blue' },
  'self-signed': { label: '自签 TSA', color: 'orange' },
};

export interface TimeStampDisplayProps {
  reportId?: string;
  autoLoad?: boolean;
  onVerify?: (result: TimeStampVerifyResult) => void;
}

export const TimeStampDisplay: React.FC<TimeStampDisplayProps> = ({ reportId, autoLoad = true, onVerify }) => {
  const [tokens, setTokens] = useState<TimeStampToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<TimeStampVerifyResult | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await timeStampService.listTokens(reportId);
      setTokens(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (autoLoad) void load(); }, [autoLoad, reportId]);

  const handleVerify = async (token: TimeStampToken) => {
    const result = await timeStampService.verify(token, token.messageImprint);
    setVerifyResult(result);
    onVerify?.(result);
  };

  const columns = [
    {
      title: 'TSA',
      dataIndex: 'tsaName',
      key: 'tsaName',
      render: (_: unknown, r: TimeStampToken) => {
        const meta = TRUST_META[r.trustLevel];
        return <Tag color={meta.color}>{meta.label}<br /><small>{r.tsaName}</small></Tag>;
      },
    },
    {
      title: '序列号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
      render: (s: string) => <Text copyable style={{ fontSize: 12 }}>{s}</Text>,
    },
    {
      title: '算法',
      dataIndex: 'hashAlgo',
      key: 'hashAlgo',
      render: (a: string) => <Tag>{a.toUpperCase()}</Tag>,
    },
    {
      title: '生成时间',
      dataIndex: 'genTime',
      key: 'genTime',
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: TimeStampToken) => (
        <Button size="small" icon={<Search size={12} />} onClick={() => void handleVerify(r)}>验证</Button>
      ),
    },
  ];

  const national = tokens.filter((t) => t.trustLevel === 'national').length;
  const hospital = tokens.filter((t) => t.trustLevel === 'hospital').length;

  return (
    <Card
      title={
        <Space>
          <Clock size={18} />
          <span>时间戳服务 (RFC 3161)</span>
          {tokens.length > 0 && <Tag>{tokens.length} 条</Tag>}
        </Space>
      }
      extra={<Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>}
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic title="国家级 TSA" value={national} prefix={<ShieldCheck size={14} />} styles={{ content: {  color: '#10b981'  } }} />
        </Col>
        <Col span={8}>
          <Statistic title="医院级 TSA" value={hospital} prefix={<Building2 size={14} />} styles={{ content: {  color: '#2563eb'  } }} />
        </Col>
        <Col span={8}>
          <Statistic title="总计" value={tokens.length} prefix={<Clock size={14} />} />
        </Col>
      </Row>

      {verifyResult && (
        <Alert
          type={verifyResult.isValid ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 12 }}
          title={`验证 ${verifyResult.isValid ? '通过' : '失败'}`}
          description={verifyResult.failureReasons.join('; ') || '时间戳有效'}
          closable
          onClose={() => setVerifyResult(null)}
        />
      )}

      {tokens.length === 0 ? (
        <Empty description={loading ? '加载中...' : '暂无时间戳记录'} />
      ) : (
        <Table size="small" dataSource={tokens} columns={columns} rowKey="id" pagination={false} />
      )}
    </Card>
  );
};

export default TimeStampDisplay;
