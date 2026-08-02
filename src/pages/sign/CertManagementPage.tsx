import React, { useState } from 'react';
import { Tabs, Typography, Badge, Card, Row, Col, Statistic, Space } from 'antd';
import { Key, Clock, Ban, Shield, Server, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import CertManager from '../../components/sign/CertManager';
import TimeStampDisplay from '../../components/sign/TimeStampDisplay';
import RevocationList from '../../components/sign/RevocationList';
import { HsmConfigPanel } from '../../components/sign/HsmConfig';

const { Title, Text } = Typography;

const CertManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <Title level={3} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Key size={22} /> 证书管理 (CA / TSA / CRL)
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Badge
            count={3}
            title="证书管理 3 项"
            style={{ backgroundColor: '#0ea5e9' }}
          />
        }
        items={[
          {
            key: 'overview',
            label: <span><Shield size={14} /> 概览</span>,
            children: (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="有效证书" value="5" prefix={<CheckCircle size={16} />} styles={{ content: {  color: '#52c41a'  } }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="即将过期" value="2" prefix={<AlertTriangle size={16} />} styles={{ content: {  color: '#faad14'  } }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="已吊销" value="1" prefix={<Ban size={16} />} styles={{ content: {  color: '#ff4d4f'  } }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="时间戳服务" value="正常" prefix={<Clock size={16} />} styles={{ content: {  color: '#1677ff'  } }} />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="证书摘要" size="small">
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <Space><FileText size={14} /><Text>根 CA 证书: CN=G005 Root CA, O=G005-RIS, 有效期至 2035-12-31</Text></Space>
                        <Space><FileText size={14} /><Text>中间 CA: CN=G005 Intermediate CA, 有效期至 2030-12-31</Text></Space>
                        <Space><FileText size={14} /><Text>签名证书: CN=Dr. Zhang, 有效期至 2026-06-30</Text></Space>
                      </Space>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="HSM 状态" size="small">
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <Space><Server size={14} /><Text>硬件安全模块: 已连接 (Thales Luna 7)</Text></Space>
                        <Space><Key size={14} /><Text>密钥槽位: 3/4 已使用</Text></Space>
                        <Space><Shield size={14} /><Text>加密算法: RSA-4096 + ECDSA P-384</Text></Space>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              </Space>
            ),
          },
          {
            key: 'certs',
            label: <span><Key size={14} /> 证书列表</span>,
            children: <CertManager showActions />,
          },
          {
            key: 'hsm',
            label: <span><Server size={14} /> HSM 配置</span>,
            children: <HsmConfigPanel />,
          },
          {
            key: 'timestamps',
            label: <span><Clock size={14} /> 时间戳</span>,
            children: <TimeStampDisplay autoLoad />,
          },
          {
            key: 'revocation',
            label: <span><Ban size={14} /> CRL / OCSP</span>,
            children: <RevocationList autoLoad />,
          },
        ]}
      />
    </div>
  );
};

export default CertManagementPage;
