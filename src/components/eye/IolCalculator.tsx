import React, { useState, useMemo, useEffect } from 'react';
import { Card, InputNumber, Select, Button, Table, Tag, Space, Tooltip, Alert } from 'antd';
import { Calculator, Info } from 'lucide-react';
import { calculateIol } from '@/services/eye/iolCalculator';
// [G005 Wave1B] IOL 常数表 + 在线计算优先 (eyeApi.getIolConstants / calculateIol), 失败回退本地
import { eyeApi } from '@/services/api/eyeApi';
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

  // [G005 Wave1B] 常数表: eyeApi.getIolConstants (GET /eye/iol/lenses, ULIB 派生镜头库), 失败保留本地默认
  const [constants, setConstants] = useState<any[]>([]);
  const [constantsSource, setConstantsSource] = useState<'api' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await eyeApi.getIolConstants(merged.iolModel);
        if (cancelled) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setConstants(res.data);
          setConstantsSource('api');
          const mine = res.data.find((l: any) => l.model === merged.iolModel);
          if (mine && typeof mine.aConst === 'number' && mine.aConst > 0) {
            setInput(prev => ({ ...prev, aConstant: mine.aConst, pAcd: mine.pACd ?? mine.pACD ?? prev.pAcd }));
          }
        }
      } catch { /* 后端/演示接口不可用, 保留本地常数 */ }
    })();
    return () => { cancelled = true; };
  }, [merged.iolModel]);

  // [G005 Wave1B] 在线计算优先: Barrett / Kane 走 eyeApi.calculateIol, 失败回退本地 8 公式
  const [remoteResults, setRemoteResults] = useState<Record<string, number> | null>(null);
  const [calcSource, setCalcSource] = useState<'api' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const [b, k] = await Promise.all([
          eyeApi.calculateIol({
            model: input.iolModel, formula: 'BarrettUniversalII',
            axialLength: input.al, k1: input.k1, k2: input.k2, acd: input.acd, targetRefraction: 0,
          }),
          eyeApi.calculateIol({
            model: input.iolModel, formula: 'Kane',
            axialLength: input.al, k1: input.k1, k2: input.k2, acd: input.acd, targetRefraction: 0,
          }),
        ]);
        if (cancelled) return;
        const mergedPower: Record<string, number> = {};
        const pick = (r: any): number | null => {
          const p = r?.data?.result ?? r?.data?.power;
          return typeof p === 'number' && Number.isFinite(p) ? p : null;
        };
        const bp = b.success ? pick(b) : null;
        const kp = k.success ? pick(k) : null;
        if (bp != null) mergedPower['Barrett II'] = bp;
        if (kp != null) mergedPower['Kane'] = kp;
        setRemoteResults(Object.keys(mergedPower).length > 0 ? mergedPower : null);
        setCalcSource(Object.keys(mergedPower).length > 0 ? 'api' : 'local');
      } catch {
        if (!cancelled) { setRemoteResults(null); setCalcSource('local'); }
      }
    }, 300);
    return () => { clearTimeout(t); cancelled = true; };
  }, [input.al, input.k1, input.k2, input.acd, input.iolModel]);

  const results = useMemo(() => {
    let base: IolResult[] = [];
    try { base = calculateIol(input); } catch { return []; }
    if (!remoteResults) return base;
    return base.map(r => {
      const apiPower = remoteResults[r.formula];
      if (apiPower == null) return r;
      return { ...r, iolPower: Math.round(apiPower * 10) / 10, note: r.note ? `${r.note} · 在线` : '在线计算' };
    });
  }, [input, remoteResults]);

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
      render: (v: number) => <span style={{ fontWeight: 600, fontSize: 14, color: '#2563eb' }}>{v?.toFixed(1)}</span>,
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

      <div style={{ margin: '12px 0', padding: 8, background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
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

      {calcSource === 'api' && (
        <Alert
          style={{ marginTop: 8 }}
          type="success"
          showIcon
          message="Barrett II / Kane 已使用在线计算 (eyeApi.calculateIol), 其余公式为本地计算"
        />
      )}

      {constants.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
            IOL 常数表 ({constantsSource === 'api' ? 'ULIB 2024 · 在线常数库' : '本地'})
            <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>A 常数已同步</Tag>
          </div>
          <Table
            dataSource={constants.slice(0, 12)}
            rowKey="model"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            onRow={(l: any) => ({
              style: { background: l.model === input.iolModel ? 'var(--color-info-bg)' : undefined, fontWeight: l.model === input.iolModel ? 700 : 400 },
            })}
            columns={[
              { title: '型号', dataIndex: 'model', width: 140 },
              { title: '厂商', dataIndex: 'manufacturer', width: 130 },
              { title: 'A 常数', dataIndex: 'aConst', width: 80 },
              { title: 'pACD', dataIndex: 'pACD', width: 70 },
              { title: 'SF', dataIndex: 'sf', width: 70 },
            ]}
          />
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setInput(defaultInput)}>重置</Button>
      </div>
    </Card>
  );
};

export default IolCalculator;
