import React from 'react';
import { InputNumber, Select, Tag } from 'antd';
import { toAllNotations, visionGrade } from '@/services/eye/visionConverter';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const NOTATION_OPTIONS = [
  { value: 'decimal', label: '小数' },
  { value: 'snellen', label: 'Snellen' },
  { value: 'five', label: '5分' },
  { value: 'logmar', label: 'LogMAR' },
];

const VisionAcuityInput: React.FC<Props> = ({ label, value, onChange }) => {
  const notations = toAllNotations(value);
  const grade = visionGrade(value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '4px 0' }}>
      <span style={{ minWidth: 60, fontSize: 12, color: '#475569' }}>{label}</span>
      <InputNumber
        value={value}
        onChange={(v) => onChange(v ?? 0)}
        min={0}
        max={2.0}
        step={0.1}
        size="small"
        style={{ width: 80 }}
      />
      <Select
        value="decimal"
        size="small"
        style={{ width: 80 }}
        options={NOTATION_OPTIONS}
      />
      <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
        Snellen: {notations.snellen} / 5分: {notations.five} / LogMAR: {notations.logmar}
      </span>
      <Tag color={grade === '正常' ? 'success' : 'warning'} style={{ margin: 0, fontSize: 12 }}>
        {grade}
      </Tag>
    </div>
  );
};

export default VisionAcuityInput;
