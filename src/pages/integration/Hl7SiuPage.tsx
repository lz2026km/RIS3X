import React, { useState } from 'react'
import { Card, Form, Input, Select, Button, Space, Typography, DatePicker, message, Tabs, Drawer, Descriptions } from 'antd'
import { CalendarClock, Send, Eye, Code } from 'lucide-react'
import { hl7Api } from '../../services/api/hl7Api'
import { PageHeader } from '../../components/common/PageHeader'
import { t } from '../../i18n/appI18n'

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
  const [parsing, setParsing] = useState(false)
  const [lastValues, setLastValues] = useState<any>(null)

  const handleGenerate = async () => {
    if (!form.getFieldValue('patientId')) {
      message.warning(t('hl7Siu.patientRequired'))
      return
    }
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      message.warning(t('hl7Siu.completeRequired'))
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
    message.success(t('hl7Siu.generated'))
  }

  // 发送：调用后端 POST /hl7/siu 生成并投递 SIU 消息
  const handleSend = async () => {
    if (!siuResult || !lastValues) { message.warning(t('hl7Siu.generateFirst')); return }
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
        message.error(res.error?.message || t('hl7Siu.sendFail'))
      }
    } catch (e) {
      message.error(t('hl7Siu.sendRequestFail'))
    } finally {
      setSending(false)
    }
  }

  // 解析：调用后端 POST /hl7/siu/parse (backend hl7-siu module)
  const handleParse = async () => {
    if (!parseRaw.trim()) {
      message.warning(t('hl7Siu.pasteRequired'))
      return
    }
    setParsing(true)
    try {
      const res = await hl7Api.siuParse({ raw: parseRaw })
      if (res.success && res.data && typeof res.data === 'object') {
        setParsedResult(res.data as Record<string, string>)
        message.success(t('hl7Siu.parseDone'))
      } else {
        message.error(res.error?.message || t('hl7Siu.parseFail'))
      }
    } catch {
      message.error(t('hl7Siu.parseRequestFail'))
    } finally {
      setParsing(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
    <PageHeader icon={<CalendarClock size={20} color="#2563eb" />} title={t('hl7Siu.title')} />
      <Tabs items={[
        { key: 'generate', label: <span><Code size={14} /> {t('hl7Siu.tab.generate')}</span>, children: (
          <Card>
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <Form.Item name="patientId" label={t('hl7Siu.form.patientId')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="patientName" label={t('hl7Siu.form.patientName')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="sex" label={t('hl7Siu.form.sex')}><Select options={[{ value: 'M', label: t('hl7Siu.sex.M') }, { value: 'F', label: t('hl7Siu.sex.F') }, { value: 'O', label: t('hl7Siu.sex.O') }]} /></Form.Item>
              <Form.Item name="doctorId" label={t('hl7Siu.form.doctorId')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="doctorName" label={t('hl7Siu.form.doctorName')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="department" label={t('hl7Siu.form.department')} rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="timeRange" label={t('hl7Siu.form.timeRange')} rules={[{ required: true }]}><RangePicker showTime style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" icon={<Code size={14} />} onClick={handleGenerate}>{t('hl7Siu.generateBtn')}</Button>
            </Form>
            {siuResult && (
              <div style={{ marginTop: 24 }}>
                <Text strong>{t('hl7Siu.controlId')} </Text><Text>{siuResult.controlId}</Text><br />
                <Text strong>{t('hl7Siu.messageType')} </Text><Text>{siuResult.messageType}</Text><br />
                <Text strong>{t('hl7Siu.bytes')} </Text><Text>{siuResult.bytes}</Text><br />
                <Text strong>{t('hl7Siu.messageContent')}</Text>
                <TextArea rows={8} value={siuResult.message} readOnly style={{ marginTop: 8, fontFamily: 'monospace' }} />
                <Space style={{ marginTop: 16 }}>
                  <Button icon={<Eye size={14} />} onClick={() => setPreviewOpen(true)}>{t('hl7Siu.preview')}</Button>
                  <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={() => void handleSend()}>{t('hl7Siu.send')}</Button>
                </Space>
              </div>
            )}
          </Card>
        )},
        { key: 'parse', label: <span><Eye size={14} /> {t('hl7Siu.tab.parse')}</span>, children: (
          <Card>
            <TextArea rows={6} value={parseRaw} onChange={e => setParseRaw(e.target.value)} placeholder={t('hl7Siu.ph.parse')} style={{ fontFamily: 'monospace', marginBottom: 16 }} />
            <Button type="primary" loading={parsing} onClick={() => void handleParse()}>{t('hl7Siu.parse')}</Button>
            {parsedResult && (
              <div style={{ marginTop: 16 }}>
                <Text strong>{t('hl7Siu.parseResult')}</Text>
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
              <Descriptions.Item label={t('hl7Siu.controlId')}>{siuResult.controlId}</Descriptions.Item>
              <Descriptions.Item label={t('hl7Siu.messageType')}>{siuResult.messageType}</Descriptions.Item>
              <Descriptions.Item label={t('hl7Siu.bytes')}>{siuResult.bytes}</Descriptions.Item>
              {lastValues && (
                <>
                  <Descriptions.Item label={t('hl7Siu.desc.patient')}>{lastValues.patientName} ({lastValues.patientId})</Descriptions.Item>
                  <Descriptions.Item label={t('hl7Siu.desc.doctor')}>{lastValues.doctorName} ({lastValues.doctorId})</Descriptions.Item>
                  <Descriptions.Item label={t('hl7Siu.desc.department')}>{lastValues.department}</Descriptions.Item>
                  {lastValues.timeRange?.[0] && <Descriptions.Item label={t('hl7Siu.desc.startTime')}>{lastValues.timeRange[0].format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>}
                  {lastValues.timeRange?.[1] && <Descriptions.Item label={t('hl7Siu.desc.endTime')}>{lastValues.timeRange[1].format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>}
                </>
              )}
            </Descriptions>
            <Text strong>{t('hl7Siu.fullMessage')}</Text>
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
