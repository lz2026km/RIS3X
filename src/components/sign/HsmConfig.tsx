import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Space, Typography, Button, Alert, Row, Col, Statistic, Table, Select, Input, InputNumber, Form, Modal, message, Empty } from 'antd';
import { Shield, RefreshCw, Key, Server, Wifi, WifiOff, Cpu, HardDrive, Activity } from 'lucide-react';
import { hsmAdapter } from '../../services/sign/HsmAdapter';
import type { HsmConfig, HsmSlot, HsmToken, HsmKeyHandle, HsmSession, HsmVendor, HsmKeyAlgo } from '../../types/sign';
import { HSM_VENDOR_PROFILES } from '../../types/sign';

const { Text, Title } = Typography;

export interface HsmConfigProps {
  onConfigChange?: (config: HsmConfig) => void;
}

export const HsmConfigPanel: React.FC<HsmConfigProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<HsmConfig | null>(null);
  const [slots, setSlots] = useState<HsmSlot[]>([]);
  const [tokens, setTokens] = useState<HsmToken[]>([]);
  const [keys, setKeys] = useState<HsmKeyHandle[]>([]);
  const [sessions, setSessions] = useState<HsmSession[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState(false);
  const [form] = Form.useForm();

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const init = await hsmAdapter.isInitialized();
      setInitialized(init);
      if (init) {
        const [cfg, slotList, tokenList, keyList, sessionList] = await Promise.all([
          hsmAdapter.getConfig(),
          hsmAdapter.listSlots(),
          hsmAdapter.getTokenInfo(1),
          hsmAdapter.findKeys(),
          hsmAdapter.listSessions(),
        ]);
        setConfig(cfg);
        setSlots(slotList);
        setTokens(tokenList ? [tokenList] : []);
        setKeys(keyList);
        setSessions(sessionList);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const handleInit = async () => {
    try {
      await hsmAdapter.initialize();
      message.success('HSM 初始化成功');
      void loadAll();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const vals = await form.validateFields();
      const updated = await hsmAdapter.updateConfig(vals);
      setConfig(updated);
      onConfigChange?.(updated);
      message.success('配置已更新');
      setConfigModal(false);
    } catch (e: any) {
      if (e.errorFields) return;
      message.error((e as Error).message);
    }
  };

  const handleSelfTest = async () => {
    const res = await hsmAdapter.selfTest();
    if (res.ok) {
      message.success('自检通过: ' + res.results.map((r) => r.test).join(', '));
    } else {
      message.error('自检未通过');
    }
  };

  const keyColumns = [
    { title: '标签', dataIndex: 'label', key: 'label' },
    { title: '算法', dataIndex: 'algo', key: 'algo', render: (a: string) => <Tag>{a}</Tag> },
    { title: '类', dataIndex: 'keyClass', key: 'keyClass', render: (c: string) => <Tag color="blue">{c}</Tag> },
    { title: '用法', dataIndex: 'usages', key: 'usages', render: (u: string[]) => u.map((x) => <Tag key={x} color="green">{x}</Tag>) },
    { title: '敏感', dataIndex: 'sensitive', key: 'sensitive', render: (s: boolean) => s ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
  ];

  return (
    <Card
      title={
        <Space>
          <Shield size={18} />
          <span>HSM 配置 (PKCS#11)</span>
          {initialized ? <Tag color="green" icon={<Wifi size={12} />}>已连接</Tag> : <Tag color="red" icon={<WifiOff size={12} />}>未连接</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void loadAll()} loading={loading}>刷新</Button>
          {!initialized && <Button type="primary" onClick={handleInit}>初始化 HSM</Button>}
          {initialized && <Button onClick={() => { form.setFieldsValue(config); setConfigModal(true); }}>配置</Button>}
          {initialized && <Button icon={<Activity size={14} />} onClick={() => void handleSelfTest()}>自检</Button>}
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {!initialized && (
        <Alert type="info" showIcon message="HSM 未初始化" description="点击「初始化 HSM」以连接 PKCS#11 设备" />
      )}

      {config && (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Statistic title="插槽数" value={slots.length} prefix={<Server size={14} />} />
            </Col>
            <Col span={6}>
              <Statistic title="密钥数" value={keys.length} prefix={<Key size={14} />} />
            </Col>
            <Col span={6}>
              <Statistic title="活跃会话" value={sessions.length} prefix={<Cpu size={14} />} />
            </Col>
            <Col span={6}>
              <Statistic title="FIPS 模式" value={config.fipsMode ? '启用' : '禁用'} prefix={<HardDrive size={14} />} />
            </Col>
          </Row>

          <Title level={5}>连接配置</Title>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="厂商">{HSM_VENDOR_PROFILES.find((v) => v.vendor === config.vendor)?.label ?? config.vendor}</Descriptions.Item>
            <Descriptions.Item label="FIPS">{HSM_VENDOR_PROFILES.find((v) => v.vendor === config.vendor)?.fipsLevel ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="库路径" span={2}><Text code>{config.libraryPath}</Text></Descriptions.Item>
            <Descriptions.Item label="插槽 ID">{config.slotId}</Descriptions.Item>
            <Descriptions.Item label="密钥算法">{config.keyAlgo}</Descriptions.Item>
            <Descriptions.Item label="超时 (ms)">{config.timeoutMs}</Descriptions.Item>
            <Descriptions.Item label="审计">{config.enableAudit ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}</Descriptions.Item>
            <Descriptions.Item label="FIPS">{config.fipsMode ? <Tag color="blue">启用</Tag> : <Tag>禁用</Tag>}</Descriptions.Item>
          </Descriptions>

          {keys.length > 0 && (
            <>
              <Title level={5}>密钥列表</Title>
              <Table size="small" dataSource={keys} columns={keyColumns} rowKey="handleId" pagination={false} locale={{ emptyText: <Empty description="暂无密钥" /> }} />
            </>
          )}
        </>
      )}

      <Modal title="HSM 配置" open={configModal} onOk={handleUpdateConfig} onCancel={() => setConfigModal(false)} width={480}>
        <Form form={form} layout="vertical">
          <Form.Item name="vendor" label="厂商" rules={[{ required: true }]}>
            <Select options={HSM_VENDOR_PROFILES.map((v) => ({ value: v.vendor, label: v.label }))} />
          </Form.Item>
          <Form.Item name="libraryPath" label="库路径" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slotId" label="插槽 ID"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="keyAlgo" label="密钥算法">
            <Select options={[
              { value: 'RSA-2048', label: 'RSA-2048' },
              { value: 'RSA-4096', label: 'RSA-4096' },
              { value: 'EC-P256', label: 'EC-P256' },
              { value: 'EC-P384', label: 'EC-P384' },
              { value: 'SM2-256', label: 'SM2-256' },
            ]} />
          </Form.Item>
          <Form.Item name="timeoutMs" label="超时 (ms)"><InputNumber min={1000} max={120000} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default HsmConfigPanel;
