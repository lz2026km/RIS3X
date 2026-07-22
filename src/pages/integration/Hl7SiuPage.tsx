import React, { useState } from 'react'
import { Card, Form, Input, Select, Button, Space, Typography, DatePicker, message, Tabs } from 'antd'
import { CalendarClock, Send, Eye, Code } from 'lucide-react'

const { Text, Title } = Typography
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

  const handleGenerate = () => {
    form.validateFields().then(values => {
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
      message.success('SIU^S12 消息已生成')
    })
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
      <Space style={{ marginBottom: 16 }}>
        <CalendarClock size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>HL7 SIU^S12 排班消息</span>
      </Space>
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
                  <Button icon={<Eye size={14} />} onClick={() => message.info('预览已就绪')}>预览</Button>
                  <Button type="primary" icon={<Send size={14} />} onClick={() => message.success('消息已发送')}>发送</Button>
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
    </div>
  )
}

export default Hl7SiuPage
