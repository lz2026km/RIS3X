/**
 * G005 RIS v3.0.6.5 - 临床计算面板
 * 50 升级点 - 10+ 计算器 / 单位换算 / 阈值高亮 / 趋势记录
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Card, Tabs, Form, InputNumber, Select, Row, Col, Button, Space,
  Statistic, Tag, Empty, Divider, Alert, message, Badge,
} from 'antd';
import { Calculator, RotateCcw, ChevronRight, AlertTriangle, Heart, Bone, Brain } from 'lucide-react';
import { calculationEngine } from '@services/templates/calculations/CalculationEngine';
import type {
  ClinicalCalcId, ClinicalCalcInput, ClinicalCalcOutput,
} from '@/types/templates/calculations';

interface Props {
  initialCalc?: ClinicalCalcId;
  onApply?: (id: ClinicalCalcId, output: ClinicalCalcOutput) => void;
}

const CalcIcon: React.FC<{ id: ClinicalCalcId; className?: string }> = ({ id, className }) => {
  if (['tavrSizing', 'ctr', 'lvMass', 'correctedQt'].includes(id)) return <Heart className={className} />;
  if (id === 'cobbAngle') return <Bone className={className} />;
  if (id === 'egfr') return <Brain className={className} />;
  return <Calculator className={className} />;
};

export const CalculationPanel: React.FC<Props> = ({ initialCalc = 'bmi', onApply }) => {
  const [activeId, setActiveId] = useState<ClinicalCalcId>(initialCalc);
  const [input, setInput] = useState<ClinicalCalcInput>({});
  const [output, setOutput] = useState<ClinicalCalcOutput | null>(null);

  const list = useMemo(() => calculationEngine.list(), []);
  const active = list.find((c) => c.id === activeId) ?? list[0]!;

  const handleCalc = useCallback(() => {
    try {
      const r = calculationEngine.run(activeId, input);
      setOutput(r);
      if (r.category === 'critical') message.warning('该指标处于危急范围,需紧急关注');
    } catch (e) {
      message.error(`计算失败:${(e as Error).message}`);
    }
  }, [activeId, input]);

  const handleReset = useCallback(() => {
    setInput({});
    setOutput(null);
  }, []);

  const handleApply = useCallback(() => {
    if (output) {
      onApply?.(activeId, output);
      message.success('已应用计算结果到报告');
    }
  }, [output, onApply, activeId]);

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={<><Calculator className="w-4 h-4 inline mr-1" />临床计算库</>}
    >
      <Tabs
        tabPosition="left"
        size="small"
        activeKey={activeId}
        onChange={(k) => { setActiveId(k as ClinicalCalcId); setOutput(null); setInput({}); }}
        tabBarExtraContent={
          <Badge
            count={list.length}
            title={`计算器 ${list.length} 个`}
            style={{ backgroundColor: '#1677ff' }}
          />
        }
        items={list.map((c) => ({
          key: c.id,
          label: (
            <Space>
              <CalcIcon id={c.id} className="w-3 h-3" />
              <span className="text-xs">{c.label}</span>
            </Space>
          ),
        }))}
        style={{ minHeight: 360 }}
      />

      <div className="ml-2">
        <div className="mb-2">
          <Tag color="blue">{active.labelEn}</Tag>
          <span className="text-sm text-slate-500">{active.label}</span>
        </div>

        <Form layout="vertical" size="small">
          {activeId === 'cobbAngle' && (
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item label="上端椎体终板角度 (°)">
                  <InputNumber value={input.cobbAngle?.upperEndplateDeg} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, cobbAngle: { ...(p.cobbAngle ?? { upperEndplateDeg: 0, lowerEndplateDeg: 0 }), upperEndplateDeg: Number(v ?? 0) } }))} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="下端椎体终板角度 (°)">
                  <InputNumber value={input.cobbAngle?.lowerEndplateDeg} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, cobbAngle: { ...(p.cobbAngle ?? { upperEndplateDeg: 0, lowerEndplateDeg: 0 }), lowerEndplateDeg: Number(v ?? 0) } }))} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}
          {activeId === 'efw' && (
            <>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="HC (mm)"><InputNumber value={input.efw?.hcMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, efw: { ...(p.efw ?? { hcMm: 0, acMm: 0, flMm: 0, gaWeeks: 0 }), hcMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="AC (mm)"><InputNumber value={input.efw?.acMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, efw: { ...(p.efw ?? { hcMm: 0, acMm: 0, flMm: 0, gaWeeks: 0 }), acMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="FL (mm)"><InputNumber value={input.efw?.flMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, efw: { ...(p.efw ?? { hcMm: 0, acMm: 0, flMm: 0, gaWeeks: 0 }), flMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item>
                </Col>
              </Row>
              <Form.Item label="孕周"><InputNumber value={input.efw?.gaWeeks} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, efw: { ...(p.efw ?? { hcMm: 0, acMm: 0, flMm: 0, gaWeeks: 0 }), gaWeeks: Number(v ?? 0) } }))} min={1} max={42} style={{ width: '100%' }} /></Form.Item>
            </>
          )}
          {activeId === 'egfr' && (
            <Row gutter={8}>
              <Col span={6}><Form.Item label="年龄"><InputNumber value={input.egfr?.age} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, egfr: { ...(p.egfr ?? { age: 0, sex: 'male', scrMgDl: 0 }), age: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={6}><Form.Item label="性别"><Select value={input.egfr?.sex ?? 'male'} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, egfr: { ...(p.egfr ?? { age: 0, sex: 'male', scrMgDl: 0 }), sex: v } }))} options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Scr (mg/dL)"><InputNumber value={input.egfr?.scrMgDl} step={0.1} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, egfr: { ...(p.egfr ?? { age: 0, sex: 'male', scrMgDl: 0 }), scrMgDl: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'tavrSizing' && (
            <Row gutter={8}>
              <Col span={8}><Form.Item label="瓣环面积 (mm²)"><InputNumber value={input.tavrSizing?.annulusAreaMm2} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tavrSizing: { ...(p.tavrSizing ?? { annulusAreaMm2: 0, perimeterMm: 0, perimeterDerivedDiameterMm: 0 }), annulusAreaMm2: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="周长 (mm)"><InputNumber value={input.tavrSizing?.perimeterMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tavrSizing: { ...(p.tavrSizing ?? { annulusAreaMm2: 0, perimeterMm: 0, perimeterDerivedDiameterMm: 0 }), perimeterMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="周长-衍生直径 (mm)"><InputNumber value={input.tavrSizing?.perimeterDerivedDiameterMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tavrSizing: { ...(p.tavrSizing ?? { annulusAreaMm2: 0, perimeterMm: 0, perimeterDerivedDiameterMm: 0 }), perimeterDerivedDiameterMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'ctr' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="心脏最大横径 (mm)"><InputNumber value={input.ctr?.heartDiameterMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, ctr: { ...(p.ctr ?? { heartDiameterMm: 0, thoraxDiameterMm: 0 }), heartDiameterMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="胸廓最大横径 (mm)"><InputNumber value={input.ctr?.thoraxDiameterMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, ctr: { ...(p.ctr ?? { heartDiameterMm: 0, thoraxDiameterMm: 0 }), thoraxDiameterMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'bmi' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="体重 (kg)"><InputNumber value={input.bmi?.weightKg} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, bmi: { ...(p.bmi ?? { weightKg: 0, heightCm: 0 }), weightKg: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="身高 (cm)"><InputNumber value={input.bmi?.heightCm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, bmi: { ...(p.bmi ?? { weightKg: 0, heightCm: 0 }), heightCm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'bsaMosteller' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="体重 (kg)"><InputNumber value={input.bsaMosteller?.weightKg} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, bsaMosteller: { ...(p.bsaMosteller ?? { weightKg: 0, heightCm: 0 }), weightKg: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="身高 (cm)"><InputNumber value={input.bsaMosteller?.heightCm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, bsaMosteller: { ...(p.bsaMosteller ?? { weightKg: 0, heightCm: 0 }), heightCm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'tdiIcVolume' && (
            <Row gutter={8}>
              <Col span={8}><Form.Item label="长 (mm)"><InputNumber value={input.tdiIcVolume?.lengthMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tdiIcVolume: { ...(p.tdiIcVolume ?? { lengthMm: 0, widthMm: 0, heightMm: 0 }), lengthMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="宽 (mm)"><InputNumber value={input.tdiIcVolume?.widthMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tdiIcVolume: { ...(p.tdiIcVolume ?? { lengthMm: 0, widthMm: 0, heightMm: 0 }), widthMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="高 (mm)"><InputNumber value={input.tdiIcVolume?.heightMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, tdiIcVolume: { ...(p.tdiIcVolume ?? { lengthMm: 0, widthMm: 0, heightMm: 0 }), heightMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'correctedQt' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="QT 间期 (ms)"><InputNumber value={input.correctedQt?.qtMs} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, correctedQt: { ...(p.correctedQt ?? { qtMs: 0, rrMs: 0 }), qtMs: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="RR 间期 (ms)"><InputNumber value={input.correctedQt?.rrMs} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, correctedQt: { ...(p.correctedQt ?? { qtMs: 0, rrMs: 0 }), rrMs: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'lvMass' && (
            <>
              <Row gutter={8}>
                <Col span={8}><Form.Item label="IVSd (mm)"><InputNumber value={input.lvMass?.ivsdMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, lvMass: { ...(p.lvMass ?? { ivsdMm: 0, lveddMm: 0, pwdMm: 0, sex: 'male', bsa: 1.7 }), ivsdMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item label="LVEDd (mm)"><InputNumber value={input.lvMass?.lveddMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, lvMass: { ...(p.lvMass ?? { ivsdMm: 0, lveddMm: 0, pwdMm: 0, sex: 'male', bsa: 1.7 }), lveddMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item label="PWD (mm)"><InputNumber value={input.lvMass?.pwdMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, lvMass: { ...(p.lvMass ?? { ivsdMm: 0, lveddMm: 0, pwdMm: 0, sex: 'male', bsa: 1.7 }), pwdMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Form.Item label="性别"><Select value={input.lvMass?.sex ?? 'male'} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, lvMass: { ...(p.lvMass ?? { ivsdMm: 0, lveddMm: 0, pwdMm: 0, sex: 'male', bsa: 1.7 }), sex: v } }))} options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item label="BSA (m²)"><InputNumber value={input.lvMass?.bsa} step={0.1} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, lvMass: { ...(p.lvMass ?? { ivsdMm: 0, lveddMm: 0, pwdMm: 0, sex: 'male', bsa: 1.7 }), bsa: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </>
          )}
          {activeId === 'aorticSizeIndex' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="主动脉最大径 (mm)"><InputNumber value={input.aorticSizeIndex?.maxAorticDiameterMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, aorticSizeIndex: { ...(p.aorticSizeIndex ?? { maxAorticDiameterMm: 0, bsa: 1.7 }), maxAorticDiameterMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="BSA (m²)"><InputNumber value={input.aorticSizeIndex?.bsa} step={0.1} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, aorticSizeIndex: { ...(p.aorticSizeIndex ?? { maxAorticDiameterMm: 0, bsa: 1.7 }), bsa: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
          {activeId === 'targetDiameter' && (
            <Row gutter={8}>
              <Col span={12}><Form.Item label="血管径 (mm)"><InputNumber value={input.targetDiameter?.vesselMm} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, targetDiameter: { ...(p.targetDiameter ?? { vesselMm: 0, bsa: 1.7 }), vesselMm: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="BSA (m²)"><InputNumber value={input.targetDiameter?.bsa} step={0.1} onChange={(v) => setInput((p: ClinicalCalcInput) => ({ ...p, targetDiameter: { ...(p.targetDiameter ?? { vesselMm: 0, bsa: 1.7 }), bsa: Number(v ?? 0) } }))} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          )}
        </Form>

        <Space>
          <Button type="primary" icon={<Calculator className="w-4 h-4" />} onClick={handleCalc}>计算</Button>
          <Button icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset}>重置</Button>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {output ? (
          <div>
            {output.category === 'critical' && (
              <Alert
                type="error"
                showIcon
                icon={<AlertTriangle className="w-4 h-4" />}
                message="该指标处于危急范围"
                className="mb-2"
              />
            )}
            <Row gutter={8}>
              <Col span={12}>
                <Statistic
                  title={active.label}
                  value={typeof output.value === 'number' ? output.value : JSON.stringify(output.value)}
                  precision={typeof output.value === 'number' ? 2 : 0}
                  suffix={output.meta.unit}
                  styles={{ content: { 
                    color: output.category === 'critical' ? '#dc2626' :
                      output.category === 'abnormal' ? '#f59e0b' : '#10b981',
                    fontSize: 22,
                   } }}
                />
              </Col>
              <Col span={12}>
                <div className="text-sm">
                  <div className="text-slate-500">公式</div>
                  <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{output.meta.formula}</code>
                </div>
              </Col>
            </Row>
            <div className="text-sm mt-2">
              <Tag color="blue">解读</Tag>
              {output.interpretation}
            </div>
            {output.meta.reference && (
              <div className="text-xs text-slate-500 mt-1">参考:{output.meta.reference}</div>
            )}
            {onApply && (
              <Button
                type="default"
                className="mt-2"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={handleApply}
                size="small"
              >
                应用到报告
              </Button>
            )}
          </div>
        ) : (
          <Empty description="输入参数后点击「计算」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </Card>
  );
};

export default CalculationPanel;
