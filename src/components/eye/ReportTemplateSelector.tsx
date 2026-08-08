import React from "react";
import { Select, Space, Tag } from "antd";
import { FileText } from "lucide-react";

const MODALITY_LABELS_LOCAL: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

import { MOCK_REPORT_TEMPLATES } from "../../data/eyeReportTemplatesMock";

const ReportTemplateSelector: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
}> = ({ value, onChange }) => (
  <Space>
    <FileText size={16} color="#2563eb" />
    <Select
      value={value || undefined}
      onChange={onChange}
      placeholder="选择报告模板"
      style={{ width: 280 }}
      allowClear
      options={MOCK_REPORT_TEMPLATES.map((t) => ({
        value: t.id,
        label: t.name,
      }))}
    />
    {value && (
      <Tag color="blue">
        {MODALITY_LABELS_LOCAL[MOCK_REPORT_TEMPLATES.find((t) => t.id === value)?.modality || ""] || MOCK_REPORT_TEMPLATES.find((t) => t.id === value)?.modality || "-"}
      </Tag>
    )}
  </Space>
);
export default ReportTemplateSelector;
