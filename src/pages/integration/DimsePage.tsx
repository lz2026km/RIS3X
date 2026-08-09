import React, { useState } from 'react';
import { Card, Tabs, Table, Button, Form, Input, Select, DatePicker, Upload, message, Tag, Space, Alert, InputNumber } from 'antd';
import { UploadOutlined, SendOutlined, SearchOutlined, ForwardOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../../services/api/client';
import { usePagination } from '../../hooks/usePagination';

const { RangePicker } = DatePicker;

const ECHO_COLUMNS: any[] = [
  { title: '应用实体名', dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: '设备', dataIndex: 'modality', key: 'modality' },
  { title: '连通性', dataIndex: 'pingMs', key: 'pingMs', render: (v: number | null) => v != null ? `${v} ms` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string | null) => v ? <Tag color={v === 'SUCCESS' ? 'green' : 'red'} icon={v === 'SUCCESS' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>{v}</Tag> : '-' },
];

const MWL_COLUMNS = [
  { title: '患者姓名', dataIndex: 'patientName', key: 'patientName' },
  { title: '患者 ID', dataIndex: 'patientId', key: 'patientId' },
  { title: '检查号', dataIndex: 'accessionNumber', key: 'accessionNumber' },
  { title: '设备', dataIndex: 'modality', key: 'modality' },
  { title: '检查日期', dataIndex: 'studyDate', key: 'studyDate' },
  { title: '状态', dataIndex: 'status', key: 'status' },
];

const C_STORE_COLUMNS = [
  { title: 'SOP 实例 UID', dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true },
  { title: '存储路径', dataIndex: 'storagePath', key: 'storagePath', ellipsis: true },
  { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{v}</Tag> },
];

const C_MOVE_COLUMNS = [
  { title: '检查 UID', dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: '目标 AE', dataIndex: 'destAe', key: 'destAe' },
  { title: '传输数', dataIndex: 'transferredCount', key: 'transferredCount' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{v}</Tag> },
];

const MOCK_DEVICES = [
  { aeTitle: 'CT_SCANNER_01', ip: '192.168.1.101', port: 11112, modality: 'CT', pingMs: null as number | null, status: null as string | null, _echoing: false },
  { aeTitle: 'MR_SCANNER_02', ip: '192.168.1.102', port: 11113, modality: 'MR', pingMs: null as number | null, status: null as string | null, _echoing: false },
  { aeTitle: 'XA_LAB_01', ip: '192.168.1.103', port: 11114, modality: 'XA', pingMs: null as number | null, status: null as string | null, _echoing: false },
];

export const DimsePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('echo');
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [mwlResults, setMwlResults] = useState<any[]>([]);
  const [mwlLoading, setMwlLoading] = useState(false);
  const [mwlForm] = Form.useForm();
  const [storeResults, setStoreResults] = useState<any[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [moveForm] = Form.useForm();
  const [moveResults, setMoveResults] = useState<any[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  // [W3-C] 受控分页: MWL 结果表
  const mwlPagination = usePagination(mwlResults, 10);
  // [G005 2B] 受控分页: C-STORE / C-MOVE 结果表 (数据可增长)
  const storePagination = usePagination(storeResults, 10);
  const movePagination = usePagination(moveResults, 10);

  const handleEcho = async (device: any) => {
    setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, _echoing: true } : d));
    const start = performance.now();
    const res = await api.post<{ pingMs: number; status: string }>('/dicom-dimse/echo', { aeTitle: device.aeTitle, ip: device.ip, port: device.port });
    const elapsed = Math.round(performance.now() - start);
    if (res.success) {
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: res.data!.pingMs ?? elapsed, status: 'SUCCESS', _echoing: false } : d));
    } else {
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: elapsed, status: 'FAIL', _echoing: false } : d));
    }
  };

  const handleMwlQuery = async (values: any) => {
    setMwlLoading(true);
    const params: any = {};
    if (values.patientName) params.patientName = values.patientName;
    if (values.patientId) params.patientId = values.patientId;
    if (values.accessionNumber) params.accessionNumber = values.accessionNumber;
    if (values.modality) params.modality = values.modality;
    if (values.dateRange) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    const res = await api.post<any[]>('/dicom-dimse/find', params);
    if (res.success) {
      setMwlResults(res.data!);
    } else {
      message.error(res.error?.message || '查询失败');
    }
    setMwlLoading(false);
  };

  const handleStore = async (file: File) => {
    setStoreLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<any>('/dicom-dimse/store', formData);
    if (res.success) {
      setStoreResults(prev => [...prev, { ...res.data, status: 'SUCCESS' }]);
      message.success('存储成功');
    } else {
      setStoreResults(prev => [...prev, { fileName: file.name, status: 'FAIL', sopInstanceUid: '-', storagePath: '-', sizeBytes: file.size }]);
      message.error(res.error?.message || '存储失败');
    }
    setStoreLoading(false);
  };

  const handleMove = async (values: any) => {
    setMoveLoading(true);
    const res = await api.post<{ transferredCount: number }>('/dicom-dimse/move', {
      studyUid: values.studyUid,
      destAe: values.destAe,
      destHost: values.destHost,
      destPort: values.destPort,
    });
    if (res.success) {
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: res.data!.transferredCount, status: 'SUCCESS' }]);
      message.success(`移动完成：${res.data!.transferredCount} 个实例已传输`);
    } else {
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: 0, status: 'FAIL' }]);
      message.error(res.error?.message || '移动失败');
    }
    setMoveLoading(false);
  };

  const tabItems = [
    {
      key: 'echo',
      label: <Space><SendOutlined />C-ECHO</Space>,
      children: (
        <Card size="small" title="DICOM 设备列表">
          <Table scroll={{ x: 'max-content' }}
            dataSource={devices}
            rowKey="aeTitle"
            pagination={false}
            columns={[
              ...ECHO_COLUMNS,
              {
                title: '操作',
                key: 'action',
                render: (_: any, record: any) => (
                  <Button type="primary" size="small" icon={<SendOutlined />} loading={record._echoing} onClick={() => handleEcho(record)}>ECHO 测试</Button>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'mwl',
      label: <Space><SearchOutlined />MWL (C-FIND)</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form form={mwlForm} layout="inline" onFinish={handleMwlQuery} initialValues={{ modality: undefined }}>
              <Form.Item name="patientName" label="名称"><Input placeholder="患者姓名" allowClear /></Form.Item>
              <Form.Item name="patientId" label="编号"><Input placeholder="患者 ID" allowClear /></Form.Item>
              <Form.Item name="accessionNumber" label="检查号"><Input placeholder="检查号" allowClear /></Form.Item>
              <Form.Item name="modality" label="设备">
                <Select allowClear placeholder="全部" style={{ width: 100 }}>
                  <Select.Option value="CT">CT</Select.Option>
                  <Select.Option value="MR">MR</Select.Option>
                  <Select.Option value="XA">XA</Select.Option>
                  <Select.Option value="US">US</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="dateRange" label="日期"><RangePicker /></Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={mwlLoading}>查询</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title="Worklist 条目">
            <Table scroll={{ x: 'max-content' }} dataSource={mwlPagination.pageData} rowKey={(r, i) => r.accessionNumber || `${i}`} columns={MWL_COLUMNS} loading={mwlLoading} pagination={mwlPagination.pagination}/>
          </Card>
        </>
      ),
    },
    {
      key: 'cstore',
      label: <Space><UploadOutlined />C-STORE</Space>,
      children: (
        <Card size="small" title="DICOM 文件上传">
          <Upload
            accept=".dcm"
            showUploadList={false}
            beforeUpload={(file) => { handleStore(file); return false; }}
            disabled={storeLoading}
          >
            <Button icon={<UploadOutlined />} loading={storeLoading} disabled={storeLoading}>选择 .dcm 文件</Button>
          </Upload>
          <Alert title="支持 DICOM .dcm 文件上传，系统将解析并存储至 PACS" type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }} />
          <Table scroll={{ x: 'max-content' }} dataSource={storePagination.pageData} rowKey={(r, i) => r.sopInstanceUid || `${i}`} columns={C_STORE_COLUMNS} pagination={storePagination.pagination} />
        </Card>
      ),
    },
    {
      key: 'cmove',
      label: <Space><ForwardOutlined />C-MOVE</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form form={moveForm} layout="inline" onFinish={handleMove}>
              <Form.Item name="studyUid" label="检查 UID" rules={[{ required: true, message: '请输入检查 UID' }]}>
                <Input placeholder="1.2.840.xxxxx" style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="destAe" label="目标 AE" rules={[{ required: true }]}>
                <Input placeholder="DEST_AE" />
              </Form.Item>
              <Form.Item name="destHost" label="主机">
                <Input placeholder="192.168.1.200" />
              </Form.Item>
              <Form.Item name="destPort" label="端口">
                <InputNumber placeholder="11112" min={1} max={65535} />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<ForwardOutlined />} loading={moveLoading}>转发</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title="转存记录">
            <Table scroll={{ x: 'max-content' }} dataSource={movePagination.pageData} rowKey={(r, i) => `${r.studyUid}-${i}`} columns={C_MOVE_COLUMNS} pagination={movePagination.pagination} />
          </Card>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM DIMSE 设备集成</span>
        <Tag color="blue">v3.0</Tag>
      </Space>
      <Alert title="DIMSE (DICOM Message Service Element) 设备集成测试与管理工作台，支持 C-ECHO、C-FIND (MWL)、C-STORE、C-MOVE 四种服务" type="info" showIcon style={{ marginBottom: 16 }} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
};

export default DimsePage;
