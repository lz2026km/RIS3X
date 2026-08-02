import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Form, InputNumber, Select, Button, Alert, Descriptions, Statistic, Tag, Space } from 'antd';
import { ArrowLeft, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import IolCalculator from '@/components/eye/IolCalculator';
import type { IolInput } from '@/types/eye';

const IolCalculatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // 解析 URL 参数 (eyeSide, axialLength/al, K1/k1, K2/k2, ACD/acd, LT/lt, WTW/wtw, CCT/cct, gender, model/iolModel, aConstant)
  const initialInput = useMemo<Partial<IolInput>>(() => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = searchParams.get(k);
        if (v != null && v !== '') return v;
      }
      return undefined;
    };
    const num = (...keys: string[]) => {
      const v = get(...keys);
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    // eyeSide (OD/OS) 只用于显示在侧栏, 不参与计算
    return {
      al: num('axialLength', 'al'),
      k1: num('K1', 'k1'),
      k2: num('K2', 'k2'),
      acd: num('acd', 'ACD'),
      lt: num('lt', 'LT'),
      wtw: num('wtw', 'WTW'),
      cct: num('cct', 'CCT'),
      aConstant: num('aConst', 'aConstant'),
      iolModel: get('model', 'iolModel'),
      gender: (get('gender') as 'male' | 'female' | undefined),
    };
  }, [searchParams, resetKey]);

  const eyeSide = searchParams.get('eyeSide');
  const patientId = searchParams.get('patientId');
  const hasAnyParam = Array.from(searchParams.keys()).length > 0;

  // 兜底:页面级记录最近一次结果
  const [lastSummary, setLastSummary] = useState<{ formula: string; iolPower: number } | null>(null);

  const handleSaveToPatient = (record: { formula: string; iolPower: number }) => {
    setLastSummary(record);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: 'calc(100vh - 56px)' }} data-testid="iol-calculator-page">
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Space style={{ marginBottom: 12 }}>
            <Button
              icon={<ArrowLeft size={14} />}
              onClick={() => window.history.back()}
              data-testid="iol-back"
            >
              返回
            </Button>
          </Space>

          <IolCalculator initialInput={initialInput} />

          <Card
            size="small"
            title={<Space><Save size={14} />提交计算</Space>}
            style={{ marginTop: 12 }}
          >
            <Form
              layout="inline"
              onFinish={(values) => {
                handleSaveToPatient({ formula: 'recommended', iolPower: Number(values.iolPower) || 0 });
              }}
            >
              <Form.Item name="surgeon" label="术者" rules={[{ required: true, message: '请选择术者' }]}>
                <Select
                  style={{ width: 160 }}
                  options={[
                    { value: 'dr-zhang', label: '张主任' },
                    { value: 'dr-li', label: '李医生' },
                    { value: 'dr-chen', label: '陈医生' },
                  ]}
                  placeholder="请选择"
                />
              </Form.Item>
              <Form.Item name="iolPower" label="目标 IOL 度数" rules={[{ required: true }]}>
                <InputNumber min={0} max={40} step={0.5} placeholder="如 21.0" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<CheckCircle2 size={14} />}>
                  提交到病历
                </Button>
              </Form.Item>
            </Form>
            {submitted && (
              <Alert
                style={{ marginTop: 8 }}
                type="success"
                showIcon
                title={`已提交${patientId ? `至患者 ${patientId}` : '计算结果'}`}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card size="small" title="参数来源">
            {hasAnyParam ? (
              <Descriptions column={1} size="small" bordered>
                {eyeSide && <Descriptions.Item label="术眼">{eyeSide === 'OD' ? '右眼 (OD)' : eyeSide === 'OS' ? '左眼 (OS)' : eyeSide}</Descriptions.Item>}
                {patientId && <Descriptions.Item label="患者 ID">{patientId}</Descriptions.Item>}
                {initialInput.al != null && <Descriptions.Item label="AL">{initialInput.al} mm</Descriptions.Item>}
                {initialInput.k1 != null && <Descriptions.Item label="K1">{initialInput.k1} D</Descriptions.Item>}
                {initialInput.k2 != null && <Descriptions.Item label="K2">{initialInput.k2} D</Descriptions.Item>}
                {initialInput.acd != null && <Descriptions.Item label="ACD">{initialInput.acd} mm</Descriptions.Item>}
                {initialInput.lt != null && <Descriptions.Item label="LT">{initialInput.lt} mm</Descriptions.Item>}
                {initialInput.wtw != null && <Descriptions.Item label="WTW">{initialInput.wtw} mm</Descriptions.Item>}
                {initialInput.cct != null && <Descriptions.Item label="CCT">{initialInput.cct} μm</Descriptions.Item>}
                {initialInput.aConstant != null && <Descriptions.Item label="A 常数">{initialInput.aConstant}</Descriptions.Item>}
                {initialInput.iolModel && <Descriptions.Item label="IOL 型号"><Tag color="blue">{initialInput.iolModel}</Tag></Descriptions.Item>}
                {initialInput.gender && <Descriptions.Item label="性别">{initialInput.gender === 'male' ? '男' : '女'}</Descriptions.Item>}
              </Descriptions>
            ) : (
              <Alert type="info" showIcon title="未指定 URL 参数,使用默认 8 公式测算" />
            )}
            <Button
              icon={<RotateCcw size={12} />}
              size="small"
              style={{ marginTop: 8 }}
              onClick={() => setResetKey(k => k + 1)}
            >
              清空并重置
            </Button>
          </Card>

          {lastSummary && (
            <Card size="small" title="最近提交" style={{ marginTop: 12 }}>
              <Statistic title="IOL 度数" value={lastSummary.iolPower} suffix="D" />
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                {patientId ? `患者 ${patientId}` : '未绑定患者'} · {eyeSide || 'OD/OS'}
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default IolCalculatorPage;
