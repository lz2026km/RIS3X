import React, { useState, useCallback } from "react";
import {
  Card, Space, Tag, Button, Tabs, Form, Input, message,
} from "antd";
import { Code, Eye, Send, Hammer, FileText } from "lucide-react";
import { hl7Api } from "../../services/api/integrationApi";
import type { Hl7Report } from "../../services/api/integrationApi";

interface BuilderForm {
  patientId: string;
  examId: string;
  reportFinding: string;
  reportImpression: string;
  accessionNumber: string;
  procedureCode: string;
  patientName: string;
}

const defaultForm: BuilderForm = {
  patientId: "",
  examId: "",
  reportFinding: "",
  reportImpression: "",
  accessionNumber: "",
  procedureCode: "",
  patientName: "",
};

const messageTypes = [
  { key: "ORU^R01", label: "ORU^R01" },
  { key: "ORM^O01", label: "ORM^O01" },
  { key: "DFT^P03", label: "DFT^P03" },
  { key: "ACK", label: "ACK" },
];

export const Hl7BuilderPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("ORU^R01");
  const [form] = Form.useForm<BuilderForm>();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState({ preview: false, send: false });

  const getValues = useCallback((): BuilderForm => {
    const v = form.getFieldsValue();
    return { ...defaultForm, ...v };
  }, [form]);

  const handlePreview = async () => {
    setLoading((p) => ({ ...p, preview: true }));
    setPreview(null);
    const values = getValues();
    const payload: Hl7Report = {
      accessionNumber: values.accessionNumber,
      patientName: values.patientName,
      patientId: values.patientId,
      patientSex: '',
      modality: '',
      studyDate: '',
      studyTime: '',
      findings: values.reportFinding,
      conclusion: values.reportImpression,
      authorName: '',
      authorId: '',
      reportId: values.examId,
    };
    const res = activeTab === 'ORM^O01'
      ? await hl7Api.buildOrm({ ...payload, bodyPart: '', orderNumber: '', orderingDoctor: '' })
      : activeTab === 'DFT^P03'
        ? await hl7Api.buildDft({ ...payload, invoiceNumber: '', totalAmount: '', chargeCode: '', chargeName: '' })
        : await hl7Api.buildOru(payload);
    if (res.success) {
      setPreview(res.data.message);
    } else {
      message.error("生成预览失败");
    }
    setLoading((p) => ({ ...p, preview: false }));
  };

  const handleSend = async () => {
    setLoading((p) => ({ ...p, send: true }));
    const values = getValues();
    const res = await hl7Api.pushOru(values.examId, values.examId);
    if (res.success) {
      message.success("消息已发送到远端");
    } else {
      message.error("发送失败");
    }
    setLoading((p) => ({ ...p, send: false }));
  };

  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Hammer className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-base font-semibold">HL7 消息构造器</div>
              <div className="text-xs text-slate-500">ORU^R01 / ORM^O01 / DFT^P03 / ACK 消息构建</div>
            </div>
          </Space>
          <Tag color="amber">构造器</Tag>
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={messageTypes.map((mt) => ({
          key: mt.key,
          label: <Space size={4}><FileText className="w-3 h-3" />{mt.label}</Space>,
          children: (
            <div className="space-y-3">
              <Card size="small" className="shadow-sm" title={<Space><Code className="w-4 h-4" /><span>表单</span></Space>}>
                <Form form={form} layout="vertical" size="small" initialValues={defaultForm}>
                  <div className="grid grid-cols-3 gap-4">
                    <Form.Item label="患者 ID" name="patientId">
                      <Input placeholder="P00123456" />
                    </Form.Item>
                    <Form.Item label="患者姓名" name="patientName">
                      <Input placeholder="张三" />
                    </Form.Item>
                    <Form.Item label="检查 ID" name="examId">
                      <Input placeholder="E2026001" />
                    </Form.Item>
                    <Form.Item label="Accession Number" name="accessionNumber">
                      <Input placeholder="ACC20260001" />
                    </Form.Item>
                    <Form.Item label="Procedure Code" name="procedureCode">
                      <Input placeholder="CTCHEST" />
                    </Form.Item>
                  </div>
                  <Form.Item label="报告所见 (Finding)" name="reportFinding">
                    <Input.TextArea rows={3} placeholder="双肺纹理清晰，未见实变..." />
                  </Form.Item>
                  <Form.Item label="报告结论 (Impression)" name="reportImpression">
                    <Input.TextArea rows={2} placeholder="未见明显异常" />
                  </Form.Item>
                </Form>
              </Card>

              <div className="flex gap-2">
                <Button
                  type="primary"
                  icon={<Eye className="w-3 h-3" />}
                  onClick={handlePreview}
                  loading={loading.preview}
                >
                  生成预览
                </Button>
                <Button
                  icon={<Send className="w-3 h-3" />}
                  onClick={handleSend}
                  loading={loading.send}
                >
                  发送到远端
                </Button>
              </div>

              {preview && (
                <Card
                  size="small"
                  className="shadow-sm"
                  title={<Space><Code className="w-4 h-4" /><span>HL7 原始消息</span></Space>}
                >
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap">
                    {preview}
                  </pre>
                </Card>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
};

export default Hl7BuilderPage;
