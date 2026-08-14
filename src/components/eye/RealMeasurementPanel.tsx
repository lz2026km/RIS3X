// [v3.0.6.8-34] PR 1: 真实 DICOM 测量面板
// 标注工具: 长度/角度/面积/矩形/椭圆/箭头/文字
// 测量结果保存到后端, 导出 DICOM-SR (TID 1500)
import React, { useState } from 'react';
import { Button, Space, Tag, Tooltip, Select, message, Divider, Empty } from 'antd';
import { Ruler, Triangle, Square, Circle, ArrowRight, Type, Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AnnotationTool } from '@/hooks/useCornerstone';

export interface MeasurementItem {
  id: string;
  type: AnnotationTool;
  value: number;
  unit: string;
  coordinates: any[];
  text?: string;
  createdAt: string;
  createdBy: string;
}

export interface MeasurementPanelProps {
  measurements: MeasurementItem[];
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onSave: (m: Omit<MeasurementItem, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onDelete: (id: string) => void;
  onExportSR: (m: MeasurementItem[]) => Promise<{ url: string; sopInstanceUID: string }>;
  studyId: string;
  currentUser?: { id: string; name: string };
}

const TOOL_DEFS: Array<{ key: AnnotationTool; label: string; icon: React.ReactNode; color: string }> = [
  { key: 'Length', label: '长度', icon: <Ruler size={14} />, color: '#2563eb' },
  { key: 'Angle', label: '角度', icon: <Triangle size={14} />, color: '#52c41a' },
  { key: 'Rectangle', label: '矩形', icon: <Square size={14} />, color: '#faad14' },
  { key: 'Ellipse', label: '椭圆', icon: <Circle size={14} />, color: '#eb2f96' },
  { key: 'Arrow', label: '箭头', icon: <ArrowRight size={14} />, color: '#722ed1' },
  { key: 'TextMarker', label: '文字', icon: <Type size={14} />, color: '#13c2c2' },
];

export const RealMeasurementPanel: React.FC<MeasurementPanelProps> = ({
  measurements,
  activeTool,
  onToolChange,
  onDelete,
  onExportSR,
}) => {
  const {  } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<AnnotationTool | 'all'>('all');

  const handleExport = async () => {
    if (measurements.length === 0) {
      message.warning('无测量结果可导出');
      return;
    }
    setBusy(true);
    try {
      const r = await onExportSR(measurements);
      message.success(`DICOM-SR 导出成功: ${r.sopInstanceUID.slice(-12)}`);
    } catch (e: any) {
      message.error(`导出失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const filtered = filter === 'all' ? measurements : measurements.filter(m => m.type === filter);

  const summary = {
    total: measurements.length,
    length: measurements.filter(m => m.type === 'Length').length,
    angle: measurements.filter(m => m.type === 'Angle').length,
    area: measurements.filter(m => ['Rectangle', 'Ellipse'].includes(m.type)).length,
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          {TOOL_DEFS.map(t => (
            <Tooltip key={t.key} title={t.label}>
              <Button
                size="small"
                type={activeTool === t.key ? 'primary' : 'default'}
                icon={t.icon}
                onClick={() => onToolChange(t.key)}
                style={activeTool === t.key ? { background: t.color, borderColor: t.color } : {}}
              >
                {t.label}
              </Button>
            </Tooltip>
          ))}
        </Space>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <Space size="small" style={{ marginBottom: 8 }}>
        <Tag color="blue">总 {summary.total}</Tag>
        <Tag color="green">长度 {summary.length}</Tag>
        <Tag color="cyan">角度 {summary.angle}</Tag>
        <Tag color="orange">面积 {summary.area}</Tag>
      </Space>

      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <Select
          size="small"
          value={filter}
          onChange={setFilter}
          style={{ width: 120 }}
          options={[
            { value: 'all', label: '全部' },
            ...TOOL_DEFS.map(t => ({ value: t.key, label: t.label })),
          ]}
        />
        <Button
          size="small"
          icon={<Download size={12} />}
          loading={busy}
          onClick={handleExport}
          disabled={measurements.length === 0}
        >
          导出 DICOM-SR
        </Button>
      </Space>

      {filtered.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测量" />
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.map(m => (
            <div
              key={m.id}
              style={{
                padding: 8,
                marginBottom: 6,
                background: 'var(--bg-card)',
                borderRadius: 4,
                border: '1px solid #f0f0f0',
              }}
            >
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Tag color={TOOL_DEFS.find(t => t.key === m.type)?.color}>
                    {TOOL_DEFS.find(t => t.key === m.type)?.label || m.type}
                  </Tag>
                  <span style={{ fontWeight: 600 }}>
                    {m.value} {m.unit}
                  </span>
                </Space>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={12} />}
                  onClick={() => onDelete(m.id)}
                />
              </Space>
              {m.text && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{m.text}</div>}
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleString('zh-CN')}
                {m.createdBy && ` · ${m.createdBy}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RealMeasurementPanel;
