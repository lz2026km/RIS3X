/**
 * G005 放射RIS系统 v3.0.5.1 - R3.SIGN 时间戳
 * A5-REPORT / 10 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Descriptions, Tag, Empty, Alert, Row, Col, Statistic } from 'antd';
import { Clock, Hash, ShieldCheck, Building2, Calendar } from 'lucide-react';
import type { SignatureTimestamp } from '../../../../types/R3/R3.SIGN';
import { signService } from '../../../../services/sign/signService';

const { Title, Text, Paragraph } = Typography;

export interface SignatureTimestampProps {
  reportId?: string;
  autoLoad?: boolean;
}

const TRUST_META: Record<SignatureTimestamp['trustLevel'], { label: string; color: string; icon: React.ReactNode }> = {
  national: { label: '国家级 TSA', color: 'green', icon: <ShieldCheck size={12} /> },
  hospital: { label: '医院级 TSA', color: 'blue', icon: <Building2 size={12} /> },
  'self-signed': { label: '自签 TSA', color: 'orange', icon: <Hash size={12} /> },
};

export const SignatureTimestampView: React.FC<SignatureTimestampProps> = ({ reportId, autoLoad = true }) => {
  const [timestamps, setTimestamps] = useState<SignatureTimestamp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad) return;
    setLoading(true);
    signService
      .listTimestamps()
      .then((list) => {
        const filtered = reportId ? list.filter((t) => t.reportId === reportId) : list;
        setTimestamps(filtered);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [autoLoad, reportId]);

  const national = timestamps.filter((t) => t.trustLevel === 'national').length;
  const hospital = timestamps.filter((t) => t.trustLevel === 'hospital').length;
  const valid = timestamps.filter((t) => t.isValid).length;

  return (
    <Card
      title={
        <Space>
          <Clock size={18} />
          <span>时间戳服务 (TSA)</span>
          {timestamps.length > 0 && <Tag color="green">{timestamps.length} 条记录</Tag>}
        </Space>
      }
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
          <Statistic title="有效率" value={timestamps.length ? Math.round((valid / timestamps.length) * 100) : 0} suffix="%" />
        </Col>
      </Row>

      {timestamps.length === 0 ? (
        <Empty description={loading ? '加载中...' : '暂无时间戳记录'} />
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }}>
          {timestamps.map((ts) => {
            const meta = TRUST_META[ts.trustLevel];
            return (
              <Card key={ts.id} size="small" type="inner">
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label={<Space>{meta.icon}<span>TSA 名称</span></Space>} span={2}>
                    <Space>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Text strong>{ts.tsaName}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="时间戳序列号">
                    <Text copyable>{ts.tsaSerial}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="时间">
                    <Space>
                      <Calendar size={12} />
                      <Text>{new Date(ts.timestamp).toLocaleString('zh-CN')}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="签章前 Hash" span={2}>
                    <Text style={{ fontFamily: 'monospace', fontSize: 12 }} copyable={{ text: ts.hashBefore }}>
                      {ts.hashBefore}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="签章后 Hash" span={2}>
                    <Text style={{ fontFamily: 'monospace', fontSize: 12 }} copyable={{ text: ts.hashAfter }}>
                      {ts.hashAfter}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="报告 ID">{ts.reportId}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {ts.isValid ? (
                      <Tag color="green" icon={<ShieldCheck size={12} />}>有效</Tag>
                    ) : (
                      <Tag color="red">无效</Tag>
                    )}
                  </Descriptions.Item>
                  {ts.nonce && (
                    <Descriptions.Item label="Nonce" span={2}>
                      <Text copyable>{ts.nonce}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            );
          })}
        </Space>
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12 }}
        title="时间戳说明"
        description={
          <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>
            本系统优先使用国家级 TSA (国家授时中心)，医院级 TSA 作为补充。所有时间戳均符合 RFC 3161 标准，具有法律效力。
          </Paragraph>
        }
      />
    </Card>
  );
};

export default SignatureTimestampView;