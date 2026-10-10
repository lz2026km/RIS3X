import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  message,
  Tag,
  Space,
  Alert,
  InputNumber,
} from "antd";
import { Upload as UploadIcon, Send, Search, Forward, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../services/api/client';
import { usePagination } from '../../hooks/usePagination';
import { t } from '../../i18n/appI18n';
import { DataTable } from "../../components/common";

const { RangePicker } = DatePicker;

const DIMSE_STATUS_LABEL: Record<string, string> = { SUCCESS: t('w9e.dimse.statusSuccess'), FAIL: t('w9e.dimse.statusFail') };

const ECHO_COLUMNS: any[] = [
  { title: t('dimse.colAeTitle'), dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: t('dimse.colIp'), dataIndex: 'ip', key: 'ip' },
  { title: t('dimse.colPort'), dataIndex: 'port', key: 'port' },
  { title: t('dimse.colModality'), dataIndex: 'modality', key: 'modality' },
  { title: t('dimse.colConnectivity'), dataIndex: 'pingMs', key: 'pingMs', render: (v: number | null) => v != null ? `${v} ms` : '-' },
  { title: t('dimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string | null) => v ? <Tag color={v === 'SUCCESS' ? 'green' : 'red'} icon={v === 'SUCCESS' ? <CheckCircle2 /> : <XCircle />}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> : '-' },
];

const MWL_COLUMNS = [
  { title: t('dimse.colPatientName'), dataIndex: 'patientName', key: 'patientName' },
  { title: t('dimse.colPatientId'), dataIndex: 'patientId', key: 'patientId' },
  { title: t('dimse.colAccession'), dataIndex: 'accessionNumber', key: 'accessionNumber' },
  { title: t('dimse.colModality'), dataIndex: 'modality', key: 'modality' },
  { title: t('dimse.colStudyDate'), dataIndex: 'studyDate', key: 'studyDate' },
  { title: t('dimse.colStatus'), dataIndex: 'status', key: 'status' },
];

const C_STORE_COLUMNS = [
  { title: t('dimse.colSopInstanceUid'), dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true },
  { title: t('dimse.colStoragePath'), dataIndex: 'storagePath', key: 'storagePath', ellipsis: true },
  { title: t('dimse.colSize'), dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: t('dimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
];

const C_MOVE_COLUMNS = [
  { title: t('dimse.colStudyUid'), dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: t('dimse.colDestAe'), dataIndex: 'destAe', key: 'destAe' },
  { title: t('dimse.colTransferredCount'), dataIndex: 'transferredCount', key: 'transferredCount' },
  { title: t('dimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
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
      message.error(res.error?.message || t('dimse.errQuery'));
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
      message.success(t('dimse.storeSuccess'));
    } else {
      setStoreResults(prev => [...prev, { fileName: file.name, status: 'FAIL', sopInstanceUid: '-', storagePath: '-', sizeBytes: file.size }]);
      message.error(res.error?.message || t('dimse.errStore'));
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
      message.success(t('w9e.dimse.moveDone', { count: res.data!.transferredCount }));
    } else {
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: 0, status: 'FAIL' }]);
      message.error(res.error?.message || t('dimse.errMove'));
    }
    setMoveLoading(false);
  };

  const tabItems = [
    {
      key: 'echo',
      label: <Space><Send />C-ECHO</Space>,
      children: (
        <Card size="small" title={t('dimse.deviceList')}>
          <DataTable scroll={{ x: 'max-content' }}
            dataSource={devices}
            rowKey="aeTitle"
            pagination={false}
            columns={[
              ...ECHO_COLUMNS,
              {
                title: t('dimse.colAction'),
                key: 'action',
                render: (_: any, record: any) => (
                  <Button type="primary" size="small" icon={<Send />} loading={record._echoing} onClick={() => handleEcho(record)}>{t('dimse.echoTest')}</Button>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'mwl',
      label: <Space><Search />MWL (C-FIND)</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Form form={mwlForm} layout="inline" onFinish={handleMwlQuery} initialValues={{ modality: undefined }}>
              <Form.Item name="patientName" label={t('dimse.labelName')}><Input placeholder={t('dimse.placeholderPatientName')} allowClear /></Form.Item>
              <Form.Item name="patientId" label={t('dimse.labelNumber')}><Input placeholder={t('dimse.placeholderPatientId')} allowClear /></Form.Item>
              <Form.Item name="accessionNumber" label={t('dimse.labelAccession')}><Input placeholder={t('dimse.placeholderAccession')} allowClear /></Form.Item>
              <Form.Item name="modality" label={t('dimse.labelModality')}>
                <Select allowClear placeholder={t('dimse.placeholderAll')} style={{ width: 100 }}>
                  <Select.Option value="CT">CT</Select.Option>
                  <Select.Option value="MR">MR</Select.Option>
                  <Select.Option value="XA">XA</Select.Option>
                  <Select.Option value="US">US</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="dateRange" label={t('dimse.labelDate')}><RangePicker /></Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<Search />} loading={mwlLoading}>{t('dimse.query')}</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title={t('dimse.worklistEntries')}>
            <DataTable scroll={{ x: 'max-content' }} dataSource={mwlPagination.pageData} rowKey={(r, i) => r.accessionNumber || `${i}`} columns={MWL_COLUMNS} loading={mwlLoading} pagination={mwlPagination.pagination}/>
          </Card>
        </>
      ),
    },
    {
      key: 'cstore',
      label: <Space><UploadIcon />C-STORE</Space>,
      children: (
        <Card size="small" title={t('dimse.fileUpload')}>
          <Upload
            accept=".dcm"
            showUploadList={false}
            beforeUpload={(file) => { handleStore(file); return false; }}
            disabled={storeLoading}
          >
            <Button icon={<UploadIcon />} loading={storeLoading} disabled={storeLoading}>{t('dimse.selectDcm')}</Button>
          </Upload>
          <Alert title={t('dimse.uploadHint')} type="info" showIcon style={{ marginTop: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }} />
          <DataTable scroll={{ x: 'max-content' }} dataSource={storePagination.pageData} rowKey={(r, i) => r.sopInstanceUid || `${i}`} columns={C_STORE_COLUMNS} pagination={storePagination.pagination} />
        </Card>
      ),
    },
    {
      key: 'cmove',
      label: <Space><Forward />C-MOVE</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Form form={moveForm} layout="inline" onFinish={handleMove}>
              <Form.Item name="studyUid" label={t('dimse.labelStudyUid')} rules={[{ required: true, message: t('dimse.enterStudyUid') }]}>
                <Input placeholder="1.2.840.xxxxx" style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="destAe" label={t('dimse.labelDestAe')} rules={[{ required: true }]}>
                <Input placeholder="DEST_AE" />
              </Form.Item>
              <Form.Item name="destHost" label={t('dimse.labelHost')}>
                <Input placeholder="192.168.1.200" />
              </Form.Item>
              <Form.Item name="destPort" label={t('dimse.labelPort')}>
                <InputNumber placeholder="11112" min={1} max={65535} />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<Forward />} loading={moveLoading}>{t('dimse.forward')}</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title={t('dimse.transferRecords')}>
            <DataTable scroll={{ x: 'max-content' }} dataSource={movePagination.pageData} rowKey={(r, i) => `${r.studyUid}-${i}`} columns={C_MOVE_COLUMNS} pagination={movePagination.pagination} />
          </Card>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dimse.title')}</span>
        <Tag color="blue">v3.0</Tag>
        <Tag color="gold">{t('dimse.demoData')}</Tag>
      </Space>
      <Alert title={t('dimse.demoAlert')} type="warning" showIcon style={{ marginBottom: 'var(--space-4, 16px)' }} />
      <Alert title={t('dimse.introAlert')} type="info" showIcon style={{ marginBottom: 'var(--space-4, 16px)' }} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
};

export default DimsePage;
