import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Form, InputNumber, Select, Button, Alert, Descriptions, Statistic, Tag, Space } from 'antd';
import { ArrowLeft, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import IolCalculator from '@/components/eye/IolCalculator';
import type { IolInput } from '@/types/eye';
import { t } from '../../../i18n/appI18n';

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // [v3.0.6.11-88 P0] 提交到病历: 真实 POST /eye/iol/calculations, 失败回退本地记录 + 提示
  const handleSaveToPatient = async (record: { formula: string; iolPower: number }, surgeon?: string) => {
    setLastSummary(record);
    setSaveError(null);
    setSaving(true);
    try {
      const { eyeApi } = await import('@/services/api/eyeApi');
      const res = await eyeApi.saveIolCalculation({
        patientId: patientId ?? undefined,
        patientName: undefined,
        eyeSide: eyeSide ?? undefined,
        surgeon: surgeon ?? undefined,
        formula: record.formula,
        iolPower: record.iolPower,
        iolModel: initialInput.iolModel,
        al: initialInput.al,
        k1: initialInput.k1,
        k2: initialInput.k2,
        acd: initialInput.acd,
        lt: initialInput.lt,
        wtw: initialInput.wtw,
        cct: initialInput.cct,
        aConstant: initialInput.aConstant,
      });
      if (!res.success) throw new Error(t('iolCalc.apiSaveFailed'));
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } catch {
      setSaveError(t('iolCalc.saveFailedLocal'));
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }} data-testid="iol-calculator-page">
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Space style={{ marginBottom: 'var(--space-3, 12px)' }}>
            <Button
              icon={<ArrowLeft size={14} />}
              onClick={() => window.history.back()}
              data-testid="iol-back"
            >
              {t('iolCalc.back')}
            </Button>
          </Space>

          <IolCalculator initialInput={initialInput} />

          <Card
            size="small"
            title={<Space><Save size={14} />{t('iolCalc.submitCalc')}</Space>}
            style={{ marginTop: 'var(--space-3, 12px)' }}
          >
            <Form
              layout="inline"
              onFinish={(values) => {
                void handleSaveToPatient({ formula: 'recommended', iolPower: Number(values.iolPower) || 0 }, values.surgeon);
              }}
            >
              <Form.Item name="surgeon" label={t('iolCalc.surgeon')} rules={[{ required: true, message: t('iolCalc.selectSurgeon') }]}>
                <Select
                  style={{ width: 160 }}
                  options={[
                    { value: 'dr-zhang', label: '张主任' },
                    { value: 'dr-li', label: '李医生' },
                    { value: 'dr-chen', label: '陈医生' },
                  ]}
                  placeholder={t('common.placeholder.select')}
                />
              </Form.Item>
              <Form.Item name="iolPower" label={t('iolCalc.targetIolPower')} rules={[{ required: true }]}>
                <InputNumber min={0} max={40} step={0.5} placeholder={t('iolCalc.examplePower')} style={{ width: 120 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<CheckCircle2 size={14} />} loading={saving}>
                  {t('iolCalc.submitToRecord')}
                </Button>
              </Form.Item>
            </Form>
            {submitted && (
              <Alert
                style={{ marginTop: 'var(--space-2, 8px)' }}
                type={saveError ? 'warning' : 'success'}
                showIcon
                title={saveError ?? (patientId ? t('w9d.iolCalc.submittedToPatient', { patientId }) : t('w9d.iolCalc.submittedResult'))}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card size="small" title={t('iolCalc.paramSource')}>
            {hasAnyParam ? (
              <Descriptions column={1} size="small" bordered>
                {eyeSide && <Descriptions.Item label={t('iolCalc.eyeSide')}>{eyeSide === 'OD' ? t('iolCalc.rightEye') : eyeSide === 'OS' ? t('iolCalc.leftEye') : eyeSide}</Descriptions.Item>}
                {patientId && <Descriptions.Item label={t('iolCalc.patientId')}>{patientId}</Descriptions.Item>}
                {initialInput.al != null && <Descriptions.Item label="AL">{initialInput.al} mm</Descriptions.Item>}
                {initialInput.k1 != null && <Descriptions.Item label="K1">{initialInput.k1} D</Descriptions.Item>}
                {initialInput.k2 != null && <Descriptions.Item label="K2">{initialInput.k2} D</Descriptions.Item>}
                {initialInput.acd != null && <Descriptions.Item label="ACD">{initialInput.acd} mm</Descriptions.Item>}
                {initialInput.lt != null && <Descriptions.Item label="LT">{initialInput.lt} mm</Descriptions.Item>}
                {initialInput.wtw != null && <Descriptions.Item label="WTW">{initialInput.wtw} mm</Descriptions.Item>}
                {initialInput.cct != null && <Descriptions.Item label="CCT">{initialInput.cct} μm</Descriptions.Item>}
                {initialInput.aConstant != null && <Descriptions.Item label={t('iolCalc.aConstant')}>{initialInput.aConstant}</Descriptions.Item>}
                {initialInput.iolModel && <Descriptions.Item label={t('iolCalc.iolModel')}><Tag color="blue">{initialInput.iolModel}</Tag></Descriptions.Item>}
                {initialInput.gender && <Descriptions.Item label={t('iolCalc.gender')}>{initialInput.gender === 'male' ? t('iolCalc.male') : t('iolCalc.female')}</Descriptions.Item>}
              </Descriptions>
            ) : (
              <Alert type="info" showIcon title={t('iolCalc.noUrlParams')} />
            )}
            <Button
              icon={<RotateCcw size={12} />}
              size="small"
              style={{ marginTop: 'var(--space-2, 8px)' }}
              onClick={() => setResetKey(k => k + 1)}
            >
              {t('iolCalc.reset')}
            </Button>
          </Card>

          {lastSummary && (
            <Card size="small" title={t('iolCalc.recentSubmit')} style={{ marginTop: 'var(--space-3, 12px)' }}>
              <Statistic title={t('iolCalc.iolPower')} value={lastSummary.iolPower} suffix="D" />
              <div style={{ marginTop: 'var(--space-1, 4px)', color: 'var(--text-secondary)', fontSize: 12 }}>
                {patientId ? `${t('w9d.octa.patient')} ${patientId}` : t('iolCalc.unboundPatient')} · {eyeSide || 'OD/OS'}
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default IolCalculatorPage;
