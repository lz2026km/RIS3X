import React, { useState } from 'react'
import { Card, Form, Input, Select, Button, Space, Typography, DatePicker, message, Tabs, Drawer, Descriptions } from 'antd'
import { CalendarClock, Send, Eye, Code } from 'lucide-react'
import { hl7Api } from '../../services/api/hl7Api'
import { PageHeader } from '../../components/common/PageHeader'

const { Text } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

interface SiuResult {
  controlId: string
  messageType: string
  message: string
  bytes: number
}

const Hl7SiuPage: React.FC = () => {
  const [form] = Form.useForm()
  const [siuResult, setSiuResult] = useState<SiuResult | null>(null)
  const [parseRaw, setParseRaw] = useState('')
  const [parsedResult, setParsedResult] = useState<Record<string, string> | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [lastValues, setLastValues] = useState<any>(null)

  const handleGenerate = async () => {
    if (!form.getFieldValue('patientId')) {
      message.warning('请输入患者ID')
      return
    }
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      message.warning('请完善必填信息（患者ID/姓名/医生/科室/排班时间）')
      return
    }
    const [start, end] = values.timeRange || []
    const msg = [
      'MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '||SIU^S12|SIU-' + Date.now() + '|P|2.5',
      'PID|1||' + values.patientId + '^^^HOSPITAL||' + values.patientName + '||' + (values.sex || 'M') + '||||||',
      'SCH|1||' + values.doctorId + '^^^HOSPITAL^DR||' + values.doctorName + '|' + values.department + '|||' + (start ? start.format('YYYYMMDDHHmmss') : '') + '|' + (end ? end.format('YYYYMMDDHHmmss') : ''),
    ].filter(Boolean).join('\r')
    setSiuResult({
      controlId: 'SIU-' + Date.now(),
      messageType: 'SIU^S12',
      message: msg,
      bytes: Buffer.byteLength ? Buffer.byteLength(msg, 'utf8') : msg.length,
    })
    setLastValues(values)
    message.success('SIU^S12 消息已生成')
  }

  // 发送：调用后端 POST /hl7/siu 生成并投递 SIU 消息
  const handleSend = async () => {
    if (!siuResult || !lastValues) { message.warning('请先生成消息'); return }
    const [start, end] = lastValues.timeRange || []
    setSending(true)
    try {
      const res = await hl7Api.siu({
        patientId: lastValues.patientId,
        patientName: lastValues.patientName,
        patientSex: lastValues.sex || 'M',
        doctorId: lastValues.doctorId,
        doctorName: lastValues.doctorName,
        department: lastValues.department,
        startDateTime: start ? start.format('YYYY-MM-DDTHH:mm:ss') : '',
        endDateTime: end ? end.format('YYYY-MM-DDTHH:mm:ss') : '',
        note: 'SIU^S12 appointment scheduling',
      })
      if (res.success) {
        message.success(`SIU^S12 已发送 (控制ID: ${siuResult.controlId})`)
      } else {
        message.error(res.error?.message || '发送失败')
      }
    } catch (e) {
      message.error('发送请求失败')
    } finally {
      setSending(false)
    }
  }

  const handleParse = () => {
    const result: Record<string, string> = {}
    parseRaw.split('\r').forEach(line => {
      if (line.startsWith('MSH')) {
        const s = line.split('|')
        result['发送应用'] = s[2] || ''
        result['发送机构'] = s[3] || ''
        result['接收应用'] = s[4] || ''
        result['接收机构'] = s[5] || ''
        result['消息时间'] = s[6] || ''
        result['消息类型'] = s[8] || ''
        result['控制ID'] = s[9] || ''
      } else if (line.startsWith('PID')) {
        const s = line.split('|')
        result['患者ID'] = s[3]?.split('^')[0] || ''
        result['患者姓名'] = s[5]?.split('^')[0] || ''
        result['性别'] = s[8] || ''
      } else if (line.startsWith('SCH')) {
        const s = line.split('|')
        result['医生ID'] = s[3]?.split('^')[0] || ''
        result['医生姓名'] = s[4] || ''
        result['科室'] = s[5] || ''
        result['开始时间'] = s[7] || ''
        result['结束时间'] = s[8] || ''
      }
    })
    setParsedResult(result)
  }

  return (
    <div style={{ padding: 24 }}>
    <PageHeader icon={<CalendarClock size={20} color="#2563eb" />} title="HL7 SIU^S12 排队信息" />
      <Tabs items={[
        { key: 'generate', label: <span><Code size={14} /> 生成消息</span>, children: (
          <Card>
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <Form.Item name="patientId" label="患者ID" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="sex" label="性别"><Select options={[{ value: 'M', label: '男' }, { value: 'F', label: '女' }, { value: 'O', label: '其他' }]} /></Form.Item>
              <Form.Item name="doctorId" label="医生ID" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="doctorName" label="医生姓名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="department" label="科室" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="timeRange" label="排班时间" rules={[{ required: true }]}><RangePicker showTime style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" icon={<Code size={14} />} onClick={handleGenerate}>生成 SIU^S12</Button>
            </Form>
            {siuResult && (
              <div style={{ marginTop: 24 }}>
                <Text strong>控制ID: </Text><Text>{siuResult.controlId}</Text><br />
                <Text strong>消息类型: </Text><Text>{siuResult.messageType}</Text><br />
                <Text strong>字节数: </Text><Text>{siuResult.bytes}</Text><br />
                <Text strong>消息内容:</Text>
                <TextArea rows={8} value={siuResult.message} readOnly style={{ marginTop: 8, fontFamily: 'monospace' }} />
                <Space style={{ marginTop: 16 }}>
                  <Button icon={<Eye size={14} />} onClick={() => setPreviewOpen(true)}>预览</Button>
                  <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={() => void handleSend()}>发送</Button>
                </Space>
              </div>
            )}
          </Card>
        )},
        { key: 'parse', label: <span><Eye size={14} /> 解析消息</span>, children: (
          <Card>
            <TextArea rows={6} value={parseRaw} onChange={e => setParseRaw(e.target.value)} placeholder="粘贴HL7 SIU消息..." style={{ fontFamily: 'monospace', marginBottom: 16 }} />
            <Button type="primary" onClick={handleParse}>解析</Button>
            {parsedResult && (
              <div style={{ marginTop: 16 }}>
                <Text strong>解析结果:</Text>
                {Object.entries(parsedResult).map(([k, v]) => v ? <p key={k}><Text strong>{k}: </Text><Text>{v}</Text></p> : null)}
              </div>
            )}
          </Card>
        )},
      ]} />

      <Drawer
        title={`SIU^S12 消息预览 - ${siuResult?.controlId ?? ''}`}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={560}
      >
        {siuResult && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="控制ID">{siuResult.controlId}</Descriptions.Item>
              <Descriptions.Item label="消息类型">{siuResult.messageType}</Descriptions.Item>
              <Descriptions.Item label="字节数">{siuResult.bytes}</Descriptions.Item>
              {lastValues && (
                <>
                  <Descriptions.Item label="患者">{lastValues.patientName} ({lastValues.patientId})</Descriptions.Item>
                  <Descriptions.Item label="医生">{lastValues.doctorName} ({lastValues.doctorId})</Descriptions.Item>
                  <Descriptions.Item label="科室">{lastValues.department}</Descriptions.Item>
                  {lastValues.timeRange?.[0] && <Descriptions.Item label="开始时间">{lastValues.timeRange[0].format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>}
                  {lastValues.timeRange?.[1] && <Descriptions.Item label="结束时间">{lastValues.timeRange[1].format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>}
                </>
              )}
            </Descriptions>
            <Text strong>完整消息:</Text>
            <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto', marginTop: 8 }}>
              {siuResult.message}
            </pre>
          </>
        )}
      </Drawer>
    </div>
  )
}

export default Hl7SiuPage
