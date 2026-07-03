/**
 * GradingScalePicker - 眼科分级量表选择器
 * 阶段 1：数据来源从 MOCK_GRADING_SCALES 切到 clinicalConfig
 * 行为完全保持不变。
 */
import React from "react";
import { Select, Tag, Space } from "antd";
import { useGradingScales } from "@/config/clinicalConfig/hooks/useGradingScales";

const GradingScalePicker: React.FC<{
  scaleId?: string;
  value?: string;
  onChange?: (v: string) => void;
}> = ({ scaleId, value, onChange }) => {
  const { scales } = useGradingScales();
  const scale = scales.find((s) => s.id === scaleId);
  if (!scale) return <Tag color="default">璇峰厛閫夋嫨妯℃澘</Tag>;
  return (
    <Space>
      <span style={{ fontSize: 12 }}>{scale.name}</span>
      <Select
        value={value || undefined}
        onChange={(v) => onChange && onChange(v)}
        placeholder="閫夋嫨鍒嗙骇"
        style={{ width: 200 }}
        optionLabelProp="label"
        options={scale.options.map((o) => ({
          value: o.grade,
          label: `${o.label} 鈥?${o.description.substring(0, 30)}`,
        }))}
      />
    </Space>
  );
};
export default GradingScalePicker;