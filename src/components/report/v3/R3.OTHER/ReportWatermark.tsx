/**
 * G005 放射RIS系统 v3.0.5.1 - 报告水印
 * R3.OTHER 组:水印(可见/不可见)
 * 10 升级点
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Modal, Form, Input, Select, Switch, Slider,
  ColorPicker, Row, Col, Divider, Empty, InputNumber, Statistic,
} from 'antd';
import {
  Droplet, Eye, EyeOff, Type, Palette, RotateCw, Hash, Image as ImageIcon, Layers, Settings,
  FileText, RefreshCw, Plus, Trash2, Copy, Download, Activity, CheckCircle2,
} from 'lucide-react';

export type WatermarkType = 'text' | 'image' | 'qrcode' | 'pattern' | 'dynamic';
export type WatermarkLayer = 'header' | 'body' | 'footer' | 'background' | 'tile' | 'corner';

interface WatermarkConfig {
  id: string;
  name: string;
  nameEn: string;
  type: WatermarkType;
  layer: WatermarkLayer;
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  position: { x: number; y: number };
  tile: { enabled: boolean; gapX: number; gapY: number };
  scope: { reportTypes: string[]; allReports: boolean };
  createdBy: string;
  createdAt: string;
  description: string;
}

const DEFAULT_WATERMARKS: WatermarkConfig[] = [
  { id: 'w-1', name: '患者姓名/ID/时间', nameEn: 'Patient ID/Time', type: 'text', layer: 'tile', enabled: true, text: '患者:{{patientName}} 报告:{{reportId}} {{date}}', fontSize: 12, color: '#dc2626', opacity: 0.15, rotation: -30, position: { x: 50, y: 50 }, tile: { enabled: true, gapX: 200, gapY: 150 }, scope: { reportTypes: [], allReports: true }, createdBy: '系统', createdAt: '2026-01-15T08:00:00Z', description: '默认水印,显示在报告每页' },
  { id: 'w-2', name: '机密标识', nameEn: 'Confidential', type: 'text', layer: 'header', enabled: true, text: '医院内部资料 严禁外传', fontSize: 14, color: '#dc2626', opacity: 0.6, rotation: 0, position: { x: 50, y: 0 }, tile: { enabled: false, gapX: 0, gapY: 0 }, scope: { reportTypes: ['敏感'], allReports: false }, createdBy: '安全组', createdAt: '2026-02-01T08:00:00Z', description: '机密报告专用水印' },
  { id: 'w-3', name: '医院Logo', nameEn: 'Hospital Logo', type: 'image', layer: 'corner', enabled: true, text: '', fontSize: 0, color: '#3b82f6', opacity: 0.8, rotation: 0, position: { x: 90, y: 90 }, tile: { enabled: false, gapX: 0, gapY: 0 }, scope: { reportTypes: [], allReports: true }, createdBy: '管理员', createdAt: '2026-01-15T08:00:00Z', description: '右下角医院Logo' },
  { id: 'w-4', name: '审核者二维码', nameEn: 'Auditor QR', type: 'qrcode', layer: 'footer', enabled: false, text: 'https://verify.hospital.cn/{{reportId}}', fontSize: 0, color: '#000000', opacity: 1, rotation: 0, position: { x: 95, y: 95 }, tile: { enabled: false, gapX: 0, gapY: 0 }, scope: { reportTypes: [], allReports: true }, createdBy: '审核组', createdAt: '2026-03-01T08:00:00Z', description: '右下角二维码,扫码验证' },
];

interface Props {
  reportId?: string;
  onApply?: (wm: WatermarkConfig) => void;
  readOnly?: boolean;
}

export const ReportWatermark: React.FC<Props> = ({ reportId, onApply, readOnly = false }) => {
  const [watermarks, setWatermarks] = useState<WatermarkConfig[]>(DEFAULT_WATERMARKS);
  const [selectedId, setSelectedId] = useState<string | null>('w-1');
  const [showCreate, setShowCreate] = useState(false);
  const [previewMode, setPreviewMode] = useState<'tile' | 'corner' | 'header'>('tile');
  const [createForm, setCreateForm] = useState<WatermarkConfig>({
    id: '', name: '', nameEn: '', type: 'text', layer: 'tile', enabled: true, text: '示例水印 {{date}}',
    fontSize: 12, color: '#dc2626', opacity: 0.15, rotation: -30, position: { x: 50, y: 50 },
    tile: { enabled: true, gapX: 200, gapY: 150 }, scope: { reportTypes: [], allReports: true },
    createdBy: '陈医师', createdAt: new Date().toISOString(), description: '',
  });

  const selected = useMemo(() => watermarks.find((w) => w.id === selectedId) ?? null, [watermarks, selectedId]);

  const handleCreate = useCallback(() => {
    if (!createForm.name) { message.warning('请填写水印名称'); return; }
    const w: WatermarkConfig = { ...createForm, id: `w-${Date.now()}`, createdAt: new Date().toISOString() };
    setWatermarks((arr) => [w, ...arr]);
    setSelectedId(w.id);
    setShowCreate(false);
    message.success('水印已创建');
  }, [createForm]);

  const handleApply = useCallback((wm: WatermarkConfig) => {
    onApply?.(wm);
    message.success(`已应用水印: ${wm.name}`);
  }, [onApply]);

  const handleDelete = useCallback((id: string) => {
    Modal.confirm({
      title: '确认删除', content: '删除后无法恢复',
      onOk: () => {
        setWatermarks((arr) => arr.filter((w) => w.id !== id));
        message.success('已删除');
      },
    });
  }, []);

  const renderPreview = (wm: WatermarkConfig) => {
    if (!wm.enabled) return <div className="absolute inset-0 flex items-center justify-center text-slate-400">水印已禁用</div>;
    if (wm.type === 'text') {
      if (wm.layer === 'tile') {
        const cols = Math.ceil(800 / wm.tile.gapX);
        const rows = Math.ceil(600 / wm.tile.gapY);
        return (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: rows }).map((_, r) => (
              Array.from({ length: cols }).map((_, c) => (
                <div key={`${r}-${c}`} className="absolute font-semibold" style={{
                  left: `${c * (wm.tile.gapX / 8)}%`,
                  top: `${r * (wm.tile.gapY / 6)}%`,
                  fontSize: wm.fontSize,
                  color: wm.color,
                  opacity: wm.opacity,
                  transform: `rotate(${wm.rotation}deg)`,
                  whiteSpace: 'nowrap',
                }}>
                  {wm.text.replace('{{date}}', '2026-09-15').replace('{{patientName}}', '张三').replace('{{reportId}}', reportId ?? 'rpt-038')}
                </div>
              ))
            ))}
          </div>
        );
      }
      if (wm.layer === 'header' || wm.layer === 'footer') {
        return (
          <div className="absolute left-0 right-0 font-semibold text-center" style={{
            top: wm.layer === 'header' ? 4 : undefined,
            bottom: wm.layer === 'footer' ? 4 : undefined,
            fontSize: wm.fontSize, color: wm.color, opacity: wm.opacity,
          }}>
            {wm.text}
          </div>
        );
      }
      if (wm.layer === 'corner') {
        return (
          <div className="absolute font-semibold" style={{
            right: 8, bottom: 8, fontSize: wm.fontSize, color: wm.color, opacity: wm.opacity,
          }}>
            {wm.text}
          </div>
        );
      }
    }
    if (wm.type === 'image' || wm.type === 'qrcode') {
      return (
        <div className="absolute w-12 h-12 bg-slate-200 rounded flex items-center justify-center" style={{
          right: wm.position.x > 50 ? 8 : undefined,
          left: wm.position.x <= 50 ? 8 : undefined,
          bottom: wm.position.y > 50 ? 8 : undefined,
          top: wm.position.y <= 50 ? 8 : undefined,
          opacity: wm.opacity,
        }}>
          {wm.type === 'qrcode' ? <Hash className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="水印规则" value={watermarks.length} prefix={<Droplet className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已启用" value={watermarks.filter((w) => w.enabled).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="文字" value={watermarks.filter((w) => w.type === 'text').length} prefix={<Type className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="图像/QR" value={watermarks.filter((w) => w.type === 'image' || w.type === 'qrcode').length} prefix={<ImageIcon className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-3 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><Droplet className="w-4 h-4" /><span>水印列表</span></Space>} extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowCreate(true)} disabled={readOnly}>新建</Button>}>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {watermarks.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === w.id ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color={w.type === 'text' ? 'blue' : w.type === 'image' ? 'purple' : 'orange'}>{w.type}</Tag>
                  {w.enabled ? <Tag color="green" icon={<Eye className="w-3 h-3" />}>启用</Tag> : <Tag icon={<EyeOff className="w-3 h-3" />}>禁用</Tag>}
                </div>
                <div className="text-sm font-semibold">{w.name}</div>
                <div className="text-xs text-slate-500">{w.nameEn}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{w.layer}</span>
                  <span>不透明度 {w.opacity}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-2 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Layers className="w-4 h-4" /><span>水印配置</span>{selected && <Tag color="red">{selected.id}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<Settings className="w-3 h-3" />} onClick={() => message.info('已应用')}>应用</Button>
                <Button size="small" type="primary" icon={<CheckCircle2 className="w-3 h-3" />} onClick={() => handleApply(selected)}>应用并保存</Button>
                <Button size="small" danger icon={<Trash2 className="w-3 h-3" />} onClick={() => handleDelete(selected.id)}>删除</Button>
              </Space>
            )}
          </div>
        }>
          {selected ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">类型</div>
                  <Select value={selected.type} disabled={readOnly} style={{ width: '100%' }} options={[
                    { value: 'text', label: '文字' }, { value: 'image', label: '图像' }, { value: 'qrcode', label: '二维码' }, { value: 'pattern', label: '图案' }, { value: 'dynamic', label: '动态' },
                  ]} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, type: v as WatermarkType } : w))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">层</div>
                  <Select value={selected.layer} disabled={readOnly} style={{ width: '100%' }} options={[
                    { value: 'header', label: '页眉' }, { value: 'body', label: '正文' }, { value: 'footer', label: '页脚' },
                    { value: 'background', label: '背景' }, { value: 'tile', label: '平铺' }, { value: 'corner', label: '角落' },
                  ]} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, layer: v as WatermarkLayer } : w))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">内容</div>
                  <Input.TextArea rows={3} value={selected.text} disabled={readOnly} onChange={(e) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, text: e.target.value } : w))} placeholder="支持变量 {{patientName}} {{reportId}} {{date}}" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">字体大小: {selected.fontSize}px</div>
                  <Slider min={6} max={48} value={selected.fontSize} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, fontSize: v } : w))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">颜色</div>
                  <ColorPicker value={selected.color} onChange={(c) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, color: c.toHexString() } : w))} showText />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">不透明度: {selected.opacity.toFixed(2)}</div>
                  <Slider min={0} max={1} step={0.05} value={selected.opacity} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, opacity: v } : w))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">旋转: {selected.rotation}°</div>
                  <Slider min={-90} max={90} value={selected.rotation} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, rotation: v } : w))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">启用</span>
                  <Switch checked={selected.enabled} onChange={(v) => setWatermarks((arr) => arr.map((w) => w.id === selected.id ? { ...w, enabled: v } : w))} />
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">实时预览</div>
                <div className="bg-white border-2 border-dashed border-slate-200 rounded relative" style={{ height: 400, overflow: 'hidden' }}>
                  <div className="absolute inset-0 p-4 space-y-2 text-xs text-slate-400 pointer-events-none">
                    <div className="font-semibold">胸部 CT 增强检查报告</div>
                    <div>患者: 张三 (p-038)</div>
                    <div>报告 ID: {reportId ?? 'rpt-038'}</div>
                    <div className="text-slate-300">...此处为报告正文...</div>
                    <div className="text-slate-300">1. 右肺上叶周围型肺癌可能性大</div>
                    <div className="text-slate-300">2. 建议穿刺活检明确病理</div>
                  </div>
                  {renderPreview(selected)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-center">预览仅供参考,实际效果以 PDF 输出为准</div>
              </div>
            </div>
          ) : <Empty description="请选择水印" />}
        </Card>
      </div>

      <Modal title={<Space><Droplet className="w-4 h-4" /><span>新建水印</span></Space>} open={showCreate} onCancel={() => setShowCreate(false)} footer={null}>
        <Form layout="vertical">
          <Form.Item label="名称"><Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} /></Form.Item>
          <Form.Item label="英文名"><Input value={createForm.nameEn} onChange={(e) => setCreateForm((f) => ({ ...f, nameEn: e.target.value }))} /></Form.Item>
          <Form.Item label="类型">
            <Select value={createForm.type} onChange={(v) => setCreateForm((f) => ({ ...f, type: v as WatermarkType }))} options={[
              { value: 'text', label: '文字' }, { value: 'image', label: '图像' }, { value: 'qrcode', label: '二维码' },
            ]} />
          </Form.Item>
          <Form.Item label="内容"><Input.TextArea rows={2} value={createForm.text} onChange={(e) => setCreateForm((f) => ({ ...f, text: e.target.value }))} /></Form.Item>
          <Form.Item label="描述"><Input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} /></Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowCreate(false)}>取消</Button>
          <Button type="primary" onClick={handleCreate}>创建</Button>
        </div>
      </Modal>
    </div>
  );
};

export default ReportWatermark;
