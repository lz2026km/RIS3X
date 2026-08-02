import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Alert, Row, Col, Statistic, Descriptions, Tabs, Empty } from 'antd';
import { Ban, RefreshCw, ShieldOff, Search, AlertTriangle } from 'lucide-react';
import { revokeService } from '../../services/sign/RevokeService';
import type { CrlSnapshot, OcspResponse, CrlEntry } from '../../types/sign';

const { Text } = Typography;

export interface RevocationListProps {
  autoLoad?: boolean;
}

export const RevocationList: React.FC<RevocationListProps> = ({ autoLoad = true }) => {
  const [crlFull, setCrlFull] = useState<CrlSnapshot | null>(null);
  const [crlDelta, setCrlDelta] = useState<CrlSnapshot | null>(null);
  const [ocspCache, setOcspCache] = useState<OcspResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serialQuery, setSerialQuery] = useState('');
  const [ocspResult, setOcspResult] = useState<OcspResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const full = await revokeService.getFullCrl();
      const delta = await revokeService.getDeltaCrl();
      setCrlFull(full);
      setCrlDelta(delta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (autoLoad) void load(); }, [autoLoad]);

  const handleOcspQuery = async () => {
    if (!serialQuery.trim()) return;
    const res = await revokeService.queryOcsp({ serialNumber: serialQuery.trim(), issuerCommonName: 'G005 医院 CA 中心' });
    setOcspResult(res);
    setOcspCache((prev) => {
      const exists = prev.find((r) => r.serialNumber === res.serialNumber);
      return exists ? prev.map((r) => r.serialNumber === res.serialNumber ? res : r) : [...prev, res];
    });
  };

  const isRevokedColor = (r: CrlEntry['reason']): string => {
    const critical: Array<CrlEntry['reason']> = ['key-compromise', 'ca-compromise', 'aa-compromise'];
    return critical.includes(r) ? 'red' : 'orange';
  };

  const crlColumns = [
    { title: '序列号', dataIndex: 'serialNumber', key: 'serialNumber', render: (s: string) => <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{s}</Text> },
    { title: '吊销时间', dataIndex: 'revocationDate', key: 'revocationDate', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '原因', dataIndex: 'reason', key: 'reason', render: (r: CrlEntry['reason']) => <Tag color={isRevokedColor(r)}>{r}</Tag> },
    { title: '颁发者', dataIndex: 'issuerCommonName', key: 'issuerCommonName' },
  ];

  return (
    <Card
      title={
        <Space>
          <Ban size={18} />
          <span>证书吊销列表 (CRL / OCSP)</span>
          {crlFull && <Tag>{crlFull.entries.length} 条吊销</Tag>}
        </Space>
      }
      extra={<Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>}
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      {crlFull && (
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Statistic title="吊销总数" value={crlFull.entries.length} prefix={<Ban size={14} />} />
          </Col>
          <Col span={6}>
            <Statistic title="CRL 编号" value={crlFull.crlNumber} />
          </Col>
          <Col span={6}>
            <Statistic title="本次更新" value={new Date(crlFull.thisUpdate).toLocaleDateString('zh-CN')} />
          </Col>
          <Col span={6}>
            <Statistic title="下次更新" value={new Date(crlFull.nextUpdate).toLocaleDateString('zh-CN')} />
          </Col>
        </Row>
      )}

      <Tabs
        items={[
          {
            key: 'crl-full',
            label: '完整 CRL',
            children: crlFull ? (
              <Table size="small" dataSource={crlFull.entries} columns={crlColumns} rowKey="serialNumber" pagination={false} />
            ) : <Empty description="加载中..." />,
          },
          {
            key: 'crl-delta',
            label: '增量 CRL',
            children: crlDelta ? (
              crlDelta.entries.length > 0 ? (
                <Table size="small" dataSource={crlDelta.entries} columns={crlColumns} rowKey="serialNumber" pagination={false} />
              ) : <Empty description="无增量吊销" />
            ) : <Empty description="加载中..." />,
          },
          {
            key: 'ocsp',
            label: 'OCSP 查询',
            children: (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Space>
                  <input
                    placeholder="输入证书序列号"
                    value={serialQuery}
                    onChange={(e) => setSerialQuery(e.target.value)}
                    style={{ width: 280, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleOcspQuery(); }}
                  />
                  <Button type="primary" icon={<Search size={14} />} onClick={() => void handleOcspQuery()}>查询</Button>
                </Space>
                {ocspResult && (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="序列号">{ocspResult.serialNumber}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={ocspResult.status === 'good' ? 'green' : ocspResult.status === 'revoked' ? 'red' : 'orange'}>{ocspResult.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="响应时间">{new Date(ocspResult.thisUpdate).toLocaleString('zh-CN')}</Descriptions.Item>
                    <Descriptions.Item label="下次更新">{new Date(ocspResult.nextUpdate).toLocaleString('zh-CN')}</Descriptions.Item>
                    <Descriptions.Item label="响应方">{ocspResult.responderId}</Descriptions.Item>
                    <Descriptions.Item label="签名算法">{ocspResult.signatureAlgorithm}</Descriptions.Item>
                    {ocspResult.revocationReason && (
                      <Descriptions.Item label="吊销原因" span={2}>
                        <Tag color="red">{ocspResult.revocationReason}</Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default RevocationList;
