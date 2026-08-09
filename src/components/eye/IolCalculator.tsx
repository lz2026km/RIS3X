import React, { useState, useMemo } from 'react';
import { Card, InputNumber, Select, Button, Table, Tag, Space, Tooltip } from 'antd';
import { Calculator, Info } from 'lucide-react';
import { calculateIol } from '@/services/eye/iolCalculator';
import type { IolInput, IolResult } from '@/types/eye';

const defaultInput: IolInput = {
  al: 23.5, k1: 43.0, k2: 44.5, km: 43.75, acd: 3.2, lt: 4.5, wtw: 11.8, cct: 540,
  gender: 'male', iolModel: 'SA60AT', aConstant: 118.4, pAcd: 4.0,
};

export interface IolCalculatorProps {
  /** 初始输入值,会覆盖 defaultInput 中的对应字段 */
  initialInput?: Partial<IolInput>;
}

const IolCalculator: React.FC<IolCalculatorProps> = ({ initialInput }) => {
  const merged = useMemo<IolInput>(() => ({ ...defaultInput, ...(initialInput ?? {}) }), [initialInput]);
  const [input, setInput] = useState<IolInput>(merged);

  const results = useMemo(() => {
    try { return calculateIol(input); }
    catch { return []; }
  }, [input]);

  const update = (key: keyof IolInput, value: number | string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const columns = [
    { title: '公式', dataIndex: 'formula', key: 'formula', width: 140,
      render: (v: string, r: IolResult) => (
        <Space>
          <span style={{ fontWeight: r.recommended ? 700 : 400 }}>{v}</span>
          {r.recommended && <Tag color="blue" style={{ fontSize: 12 }}>推荐</Tag>}
        </Space>
      ),
    },
    { title: '目标屈光度 (D)', dataIndex: 'targetRefraction', key: 'targetRefraction', width: 100 },
    { title: 'IOL 度数 (D)', dataIndex: 'iolPower', key: 'iolPower', width: 100,
      render: (v: number) => <span style={{ fontWeight: 600, fontSize: 15, color: '#2563eb' }}>{v?.toFixed(1)}</span>,
    },
    { title: '备注', dataIndex: 'note', key: 'note',
      render: (v: string) => v && <Tag color="orange" style={{ fontSize: 12 }}>{v}</Tag>,
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space>
          <Calculator className="v4-icon" style={{ color: '#2563eb' }} />
          <span>IOL 计算器 (8 公式)</span>
          <Tag color="blue">SRK/T</Tag>
          <Tag color="blue">Holladay I</Tag>
          <Tag color="blue">Hoffer Q</Tag>
          <Tag color="blue">Barrett II</Tag>
          <Tag color="blue">Hill-RBF</Tag>
          <Tag color="blue">Kane</Tag>
          <Tag color="blue">EVO</Tag>
          <Tag color="orange">Wang-Koch</Tag>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>眼轴 AL (mm)</span>
            <InputNumber size="small" value={input.al} onChange={(v) => update('al', v ?? 23.5)} min={18} max={35} step={0.01} style={{ width: 80 }} />
            <Tooltip title="IOL Master 测得的眼轴长度,正常 22-25mm">
              <Info className="v4-icon" style={{ width: 12, height: 12, color: '#94a3b8' }} />
            </Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>K1 (D)</span>
            <InputNumber size="small" value={input.k1} onChange={(v) => update('k1', v ?? 43)} min={30} max={60} step={0.01} style={{ width: 80 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>K2 (D)</span>
            <InputNumber size="small" value={input.k2} onChange={(v) => update('k2', v ?? 44.5)} min={30} max={60} step={0.01} style={{ width: 80 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>ACD (mm)</span>
            <InputNumber size="small" value={input.acd} onChange={(v) => update('acd', v ?? 3.2)} min={1} max={6} step={0.01} style={{ width: 80 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>LT (mm)</span>
            <InputNumber size="small" value={input.lt} onChange={(v) => update('lt', v ?? 4.5)} min={2} max={7} step={0.01} style={{ width: 80 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>WTW (mm)</span>
            <InputNumber size="small" value={input.wtw} onChange={(v) => update('wtw', v ?? 11.8)} min={10} max={14} step={0.1} style={{ width: 80 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>CCT (μm)</span>
            <InputNumber size="small" value={input.cct} onChange={(v) => update('cct', v ?? 540)} min={300} max={800} step={1} style={{ width: 80 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>A 常数</span>
            <InputNumber size="small" value={input.aConstant} onChange={(v) => update('aConstant', v ?? 118.4)} min={110} max={125} step={0.1} style={{ width: 80 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>性别</span>
            <Select size="small" value={input.gender} onChange={(v) => update('gender', v)} style={{ width: 80 }}
              options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
            <span style={{ minWidth: 80, fontSize: 12, color: '#475569' }}>IOL 型号</span>
            <Select size="small" value={input.iolModel} onChange={(v) => update('iolModel', v)} style={{ width: 80 }}
              options={[{ value: 'SA60AT', label: 'SA60AT' }, { value: 'SN60WF', label: 'SN60WF' }, { value: 'PCB00', label: 'PCB00' }]} />
          </div>
          {input.al >= 26 && (
            <Tag color="orange" style={{ marginTop: 4, fontSize: 12 }}>
              AL ≥ 26mm, 已自动应用 Wang-Koch 校正
            </Tag>
          )}
        </div>
      </div>

      <div style={{ margin: '12px 0', padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
        <strong>智能推荐公式:</strong>{' '}
        {input.al < 22 ? 'Hoffer Q (短眼最佳)' : input.al < 24.5 ? 'Barrett II + Kane (标准眼)' : input.al < 26 ? 'Barrett II + Kane (中等长眼)' : 'Wang-Koch 校正 (长眼)'}
        &nbsp;·&nbsp;当前 AL = {input.al}mm
      </div>

      <Table
        dataSource={results}
        columns={columns}
        rowKey="formula"
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setInput(defaultInput)}>重置</Button>
      </div>
    </Card>
  );
};

export default IolCalculator;
