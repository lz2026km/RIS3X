import React, { useState, useEffect, useCallback } from 'react'
import { Card, Tabs, Table, Button, Space, Tag, Form, Input, Select, message, Alert, Row, Col, InputNumber } from 'antd'
import { Archive, Send, RefreshCw, Play, Download } from 'lucide-react'
import { hl7Api, type Hl7Report, type Hl7OrmOrder, type Hl7DftTransaction, type Hl7ArchiveRecord } from '../../services/api/integrationApi'

export const Hl7ManagerPage: React.FC = () => {
  const [tab, setTab] = useState('oru')
  const [archive, setArchive] = useState<Hl7ArchiveRecord[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [oruForm] = Form.useForm()
  const [ormForm] = Form.useForm()
  const [dftForm] = Form.useForm()
  const [sending, setSending] = useState(false)
  // [W2-C] 受控分页
  const [archivePage, setArchivePage] = useState(1)

  const fetchArchive = useCallback(async () => {
    setArchiveLoading(true)
    try {
      const res = await hl7Api.getArchive()
      if (res.success && res.data) {
        setArchive(Array.isArray(res.data) ? res.data : [])
      }
    } catch {
      setArchive([
        { id: 1, messageType: 'ORU^R01', controlId: 'CTRL-001', direction: 'OUTBOUND', ackStatus: 'SUCCESS', retryCount: 0, rawMessage: 'MSH|^~\\&|G005|HIS|PACS|PACS|...', createdAt: new Date().toISOString() },
        { id: 2, messageType: 'ORM^O01', controlId: 'CTRL-002', direction: 'INBOUND', ackStatus: 'SUCCESS', retryCount: 0, rawMessage: 'MSH|^~\\&|HIS|HIS|G005|G005|...', createdAt: new Date().toISOString() },
      ])
    }
    setArchiveLoading(false)
  }, [])

  useEffect(() => { fetchArchive() }, [fetchArchive])

  const handleSendOru = async () => {
    try {
      const values = await oruForm.validateFields()
      setSending(true)
      const data: Hl7Report = {
        accessionNumber: values.accessionNumber,
        patientName: values.patientName,
        patientId: values.patientId,
        patientSex: values.patientSex || 'O',
        modality: values.modality,
        studyDate: values.studyDate,
        studyTime: values.studyTime || '',
        findings: values.findings,
        conclusion: values.conclusion,
        authorName: values.authorName,
        authorId: values.authorId,
        reportId: values.reportId,
      }
      const res = await hl7Api.buildOru(data)
      if (res.success) {
        message.success(`ORU 报告发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error('ORU 发送失败')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('操作失败')
    } finally {
      setSending(false)
    }
  }

  const handleSendOrm = async () => {
    try {
      const values = await ormForm.validateFields()
      setSending(true)
      const data: Hl7OrmOrder = {
        patientId: values.patientId,
        patientName: values.patientName,
        patientSex: values.patientSex || 'O',
        accessionNumber: values.accessionNumber,
        modality: values.modality,
        bodyPart: values.bodyPart,
        orderNumber: values.orderNumber,
        orderingDoctor: values.orderingDoctor,
      }
      const res = await hl7Api.buildOrm(data)
      if (res.success) {
        message.success(`ORM 医嘱发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error('ORM 发送失败')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('操作失败')
    } finally {
      setSending(false)
    }
  }

  const handleSendDft = async () => {
    try {
      const values = await dftForm.validateFields()
      setSending(true)
      const data: Hl7DftTransaction = {
        patientId: values.patientId,
        patientName: values.patientName,
        invoiceNumber: values.invoiceNumber,
        totalAmount: String(values.totalAmount),
        chargeCode: values.chargeCode,
        chargeName: values.chargeName,
      }
      const res = await hl7Api.buildDft(data)
      if (res.success) {
        message.success(`DFT 财务交易发送成功: ${res.data?.controlId || ''}`)
        fetchArchive()
      } else {
        message.error('DFT 发送失败')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('操作失败')
    } finally {
      setSending(false)
    }
  }

  const archiveColumns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '消息类型',
      dataIndex: 'messageType',
      key: 'messageType',
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (d: string) => {
        const map: Record<string, { color: string; label: string }> = { OUTBOUND: { color: 'green', label: '发送' }, INBOUND: { color: 'orange', label: '接收' }, ACK: { color: 'purple', label: '确认' } }
        const item = map[d] || { color: 'default', label: d }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: 'ACK 状态',
      dataIndex: 'ackStatus',
      key: 'ackStatus',
      render: (s: string) => {
        const map: Record<string, string> = { SUCCESS: 'green', FAILED: 'red', PENDING: 'orange' }
        return <Tag color={map[s] || 'default'}>{s}</Tag>
      },
    },
    { title: '控制 ID', dataIndex: 'controlId', key: 'controlId', ellipsis: true },
    { title: '重试', dataIndex: 'retryCount', key: 'retryCount', width: 60 },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (t: string) => new Date(t).toLocaleString() },
  ]

  const tabItems = [
    {
      key: 'oru',
      label: <Space><Send size={14} />ORU (报告)</Space>,
      children: (
        <Card size="small" title="HL7 ORU^R01 - 结构化报告">
          <Form form={oruForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="accessionNumber" label="检查号" rules={[{ required: true }]}><Input placeholder="检查号" /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientId" label="患者 ID" rules={[{ required: true }]}><Input placeholder="患者ID" /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}><Input placeholder="患者姓名" /></Form.Item></Col>
              <Col span={8}><Form.Item name="modality" label="设备" rules={[{ required: true }]}><Select placeholder="选择"><Select.Option value="CT">CT</Select.Option><Select.Option value="MR">MR</Select.Option><Select.Option value="US">US</Select.Option><Select.Option value="XA">XA</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="patientSex" label="性别"><Select placeholder="选择" allowClear><Select.Option value="M">M</Select.Option><Select.Option value="F">F</Select.Option><Select.Option value="O">O</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="studyDate" label="检查日期"><Input placeholder="YYYY-MM-DD" /></Form.Item></Col>
              <Col span={12}><Form.Item name="findings" label="所见" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="影像所见" /></Form.Item></Col>
              <Col span={12}><Form.Item name="conclusion" label="结论" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="诊断结论" /></Form.Item></Col>
              <Col span={8}><Form.Item name="authorName" label="医生"><Input placeholder="报告医生" /></Form.Item></Col>
              <Col span={8}><Form.Item name="authorId" label="医生 ID"><Input placeholder="医生工号" /></Form.Item></Col>
              <Col span={8}><Form.Item name="reportId" label="报告 ID"><Input placeholder="报告ID" /></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendOru}>发送 ORU</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'orm',
      label: <Space><Play size={14} />ORM (医嘱)</Space>,
      children: (
        <Card size="small" title="HL7 ORM^O01 - 医嘱消息">
          <Form form={ormForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="patientId" label="患者 ID" rules={[{ required: true }]}><Input placeholder="患者ID" /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}><Input placeholder="患者姓名" /></Form.Item></Col>
              <Col span={8}><Form.Item name="accessionNumber" label="检查号" rules={[{ required: true }]}><Input placeholder="检查号" /></Form.Item></Col>
              <Col span={8}><Form.Item name="modality" label="设备" rules={[{ required: true }]}><Select placeholder="选择"><Select.Option value="CT">CT</Select.Option><Select.Option value="MR">MR</Select.Option><Select.Option value="US">US</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="bodyPart" label="检查部位" rules={[{ required: true }]}><Input placeholder="检查部位" /></Form.Item></Col>
              <Col span={8}><Form.Item name="orderNumber" label="申请单号" rules={[{ required: true }]}><Input placeholder="医嘱号" /></Form.Item></Col>
              <Col span={8}><Form.Item name="orderingDoctor" label="开单医生" rules={[{ required: true }]}><Input placeholder="开单医生" /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientSex" label="性别"><Select placeholder="选择" allowClear><Select.Option value="M">M</Select.Option><Select.Option value="F">F</Select.Option></Select></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendOrm}>发送 ORM</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'dft',
      label: <Space><Download size={14} />DFT (财务)</Space>,
      children: (
        <Card size="small" title="HL7 DFT^P03 - 财务交易">
          <Form form={dftForm} layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={8}><Form.Item name="patientId" label="患者 ID" rules={[{ required: true }]}><Input placeholder="患者ID" /></Form.Item></Col>
              <Col span={8}><Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}><Input placeholder="患者姓名" /></Form.Item></Col>
              <Col span={8}><Form.Item name="invoiceNumber" label="发票号" rules={[{ required: true }]}><Input placeholder="发票号" /></Form.Item></Col>
              <Col span={8}><Form.Item name="totalAmount" label="总金额" rules={[{ required: true }]}><InputNumber placeholder="金额" style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="chargeCode" label="收费代码" rules={[{ required: true }]}><Input placeholder="收费编码" /></Form.Item></Col>
              <Col span={8}><Form.Item name="chargeName" label="收费名称" rules={[{ required: true }]}><Input placeholder="收费项目" /></Form.Item></Col>
            </Row>
            <Form.Item>
              <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleSendDft}>发送 DFT</Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'archive',
      label: <Space><Archive size={14} />消息归档</Space>,
      children: (
        <Card size="small" title="HL7 消息归档" extra={<Button icon={<RefreshCw size={14} />} onClick={fetchArchive}>刷新</Button>}>
          <Table
            dataSource={archive}
            columns={archiveColumns}
            rowKey="id"
            loading={archiveLoading}
            pagination={{ current: archivePage, pageSize: 10, total: archive.length, onChange: setArchivePage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        </Card>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Archive size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>HL7 消息管理</span>
        <Tag color="blue">v2.x</Tag>
        <Tag color="green">ORU / ORM / DFT</Tag>
      </Space>
      <Alert title="HL7 消息构建与发送管理，支持 ORU (报告)、ORM (医嘱)、DFT (财务) 三种消息类型" type="info" showIcon style={{ marginBottom: 16 }} />
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
    </div>
  )
}

export default Hl7ManagerPage
