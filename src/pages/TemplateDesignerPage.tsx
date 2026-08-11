// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板设计器
// Phase R2：拖拽式可视化模板设计器
// 左：字段库 / 中：画布 / 右：属性面板 / 顶：元数据
// ============================================================

import React, { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import { ChevronLeft, Save, Eye, Plus, Trash2, GripVertical, Type, Hash, Calendar, ToggleLeft, ListChecks, Sliders, Calculator, FileText, ChevronDown, Copy, Settings, Image as ImageIcon, Tag, ListOrdered, FileSpreadsheet, Code, Info, Check, X, Sparkles, Maximize2, Minimize2, GitMerge, Activity } from 'lucide-react';
import type { LucideIcon } from "lucide-react";
import {
  STRUCTURED_FIELD_TEMPLATES,
  type TemplateFieldDefinition,
} from "../data/structuredFieldTemplates";
import { v3WritingApi } from "../services/api/v3Api";
import { api } from "../services/api/client";

// ============================================================
// 字段类型配置
// ============================================================
interface FieldTypeMeta {
  type:
    | TemplateFieldDefinition["dataType"]
    | "length"
    | "area"
    | "volume"
    | "image"
    | "annotation"
    | "formula"
    | "snippet";
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  category: "basic" | "select" | "measure" | "special";
}

const FIELD_TYPE_META: FieldTypeMeta[] = [
  {
    type: "text",
    label: "文本",
    icon: Type,
    color: "#3b82f6",
    description: "单行文本描述",
    category: "basic",
  },
  {
    type: "number",
    label: "数值",
    icon: Hash,
    color: "#0891b2",
    description: "数字（带单位）",
    category: "basic",
  },
  {
    type: "date",
    label: "日期",
    icon: Calendar,
    color: "#7c3aed",
    description: "日期选择",
    category: "basic",
  },
  {
    type: "boolean",
    label: "布尔",
    icon: ToggleLeft,
    color: "#10b981",
    description: "是/否开关",
    category: "basic",
  },
  {
    type: "enum",
    label: "单选",
    icon: ListChecks,
    color: "#f59e0b",
    description: "从多个选项单选",
    category: "select",
  },
  {
    type: "multi-enum",
    label: "多选",
    icon: ListOrdered,
    color: "#f97316",
    description: "从多个选项多选",
    category: "select",
  },
  {
    type: "scale",
    label: "评分",
    icon: Sliders,
    color: "#a855f7",
    description: "0-5 评分量表",
    category: "select",
  },
  {
    type: "length",
    label: "长度测量",
    icon: Calculator,
    color: "#dc2626",
    description: "RECIST 长度",
    category: "measure",
  },
  {
    type: "area",
    label: "面积测量",
    icon: Calculator,
    color: "#dc2626",
    description: "面积 (mm²)",
    category: "measure",
  },
  {
    type: "volume",
    label: "体积测量",
    icon: Calculator,
    color: "#dc2626",
    description: "体积 (cm³)",
    category: "measure",
  },
  {
    type: "image",
    label: "图像引用",
    icon: ImageIcon,
    color: "#0ea5e9",
    description: "序列/图像",
    category: "special",
  },
  {
    type: "annotation",
    label: "标注",
    icon: Tag,
    color: "#0ea5e9",
    description: "箭头/文字/测量",
    category: "special",
  },
  {
    type: "formula",
    label: "公式",
    icon: Code,
    color: "#6366f1",
    description: "联动计算",
    category: "special",
  },
  {
    type: "snippet",
    label: "短语",
    icon: FileText,
    color: "var(--text-secondary)",
    description: "报告整段",
    category: "special",
  },
];

const FIELD_LIBRARY_GROUPS: Array<{
  key: string;
  label: string;
  types: string[];
}> = [
  {
    key: "basic",
    label: "基础字段",
    types: ["text", "number", "date", "boolean"],
  },
  { key: "select", label: "选择字段", types: ["enum", "multi-enum", "scale"] },
  { key: "measure", label: "测量字段", types: ["length", "area", "volume"] },
  {
    key: "special",
    label: "特殊字段",
    types: ["image", "annotation", "formula", "snippet"],
  },
];

const PRESET_SECTIONS = [
  { id: "sec-findings", name: "检查所见", order: 1, color: "#1e40af" },
  { id: "sec-impression", name: "诊断意见", order: 2, color: "#7c3aed" },
  { id: "sec-rec", name: "建议", order: 3, color: "#0891b2" },
  { id: "sec-comp", name: "对比", order: 4, color: "#f59e0b" },
  { id: "sec-tech", name: "检查技术", order: 5, color: "var(--text-secondary)" },
];

const PRESET_CATEGORIES = [
  "BI-RADS",
  "Lung-RADS",
  "PI-RADS",
  "CAD-RADS",
  "LI-RADS",
  "C-RADS",
  "TI-RADS",
  "O-RADS",
  "RECIST 1.1",
  "PERCIST",
  "Deauville",
  "Hopkins",
  "Mannheim",
];

// ---------- IHE RR / DICOM SR 模板 ----------
interface IheRRMapping {
  fieldId: string;
  fieldLabel: string;
  srTemplateId: string;
  srTemplateName: string;
  mappingPath: string;
  complianceStatus: "compliant" | "partial" | "non-compliant";
}

const IHE_RR_TEMPLATES = [
  { id: "SR-TID-1500", name: "TID 1500 - 报告正文" },
  { id: "SR-TID-1501", name: "TID 1501 - 测量群组" },
  { id: "SR-TID-1502", name: "TID 1502 - 成像观察" },
  { id: "SR-TID-1503", name: "TID 1503 - 图像库" },
  { id: "SR-TID-1504", name: "TID 1504 - 报告标题" },
  { id: "SR-TID-1400", name: "TID 1400 - CAD 观察" },
  { id: "SR-MR-RR-001", name: "IHE RR - 放射科报告" },
  { id: "SR-MR-RR-002", name: "IHE RR - CT 检查报告" },
  { id: "SR-MR-RR-003", name: "IHE RR - MR 检查报告" },
  { id: "SR-MR-RR-004", name: "IHE RR - X线检查报告" },
];

// ---------- 条件规则 ----------
interface ConditionalRule {
  id: string;
  fieldId: string;
  operator: "equals" | "not-equals" | "greater-than" | "less-than";
  value: string;
  targetFieldId: string;
  action: "show" | "hide" | "require";
}

// ============================================================
// 主组件
// ============================================================
export default function TemplateDesignerPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeRightTab, setActiveRightTab] = useState<
    "properties" | "conditional" | "sr-mapping"
  >("properties");

  const initialTemplate = id
    ? STRUCTURED_FIELD_TEMPLATES.find((t) => t.id === id) ||
      STRUCTURED_FIELD_TEMPLATES[0]
    : null;

  const [meta, setMeta] = useState({
    name: initialTemplate?.name || "新模板",
    code: initialTemplate?.id || "tpl-custom-001",
    modality: initialTemplate?.modality || "CT",
    bodyPart: initialTemplate?.bodyPart || "胸部",
    version: initialTemplate?.version || "v1.0",
    description: initialTemplate?.description || "",
    author: "当前医生",
    scope: "department" as "default" | "department" | "personal",
    minAge: 0,
    maxAge: 120,
    gender: "all" as "all" | "male" | "female",
  });

  const [sections, setSections] = useState<
    Array<{
      id: string;
      name: string;
      order: number;
      color: string;
      fields: TemplateFieldDefinition[];
    }>
  >(() => {
    if (initialTemplate) {
      const sectionMap = new Map<string, TemplateFieldDefinition[]>();
      for (const f of initialTemplate.fields) {
        if (!sectionMap.has(f.fieldGroup)) sectionMap.set(f.fieldGroup, []);
        sectionMap.get(f.fieldGroup)!.push(f);
      }
      const result: Array<any> = [];
      let idx = 0;
      for (const [groupName, fields] of sectionMap.entries()) {
        result.push({
          id: `sec-${idx}`,
          name: groupName,
          order: idx,
          color: PRESET_SECTIONS[idx % PRESET_SECTIONS.length].color,
          fields,
        });
        idx++;
      }
      return result;
    }
    return [
      { id: "sec-0", name: "检查所见", order: 0, color: "#1e40af", fields: [] },
      { id: "sec-1", name: "诊断意见", order: 1, color: "#7c3aed", fields: [] },
    ];
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [, setDraggedType] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---------- IHE RR / 条件规则状态 ----------
  const [srMappings, setSrMappings] = useState<IheRRMapping[]>([]);
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>(
    [],
  );
  const [selectedSrTemplate, setSelectedSrTemplate] = useState("SR-MR-RR-001");
  const [complianceScore, setComplianceScore] = useState(0);

  const selectedField = sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === selectedFieldId);
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  const allFields = sections.flatMap((s) => s.fields);

  const addField = (
    sectionId: string,
    type: TemplateFieldDefinition["dataType"] | string,
  ) => {
    const typeMeta = FIELD_TYPE_META.find((t) => t.type === type);
    if (!typeMeta) return;
    let storedType: TemplateFieldDefinition["dataType"] = "text";
    if (
      [
        "text",
        "number",
        "date",
        "boolean",
        "enum",
        "multi-enum",
        "scale",
      ].includes(type as string)
    ) {
      storedType = type as TemplateFieldDefinition["dataType"];
    } else if (["length", "area", "volume"].includes(type as string)) {
      storedType = "number";
    }
    const newField: TemplateFieldDefinition = {
      id: `f-${Date.now()}`,
      fieldKey: `field_${Date.now()}`,
      fieldLabel: typeMeta.label,
      fieldGroup: sections.find((s) => s.id === sectionId)?.name || "检查所见",
      dataType: storedType,
      required: false,
      order: sections.find((s) => s.id === sectionId)?.fields.length || 0,
      unit:
        type === "length"
          ? "mm"
          : type === "area"
            ? "mm²"
            : type === "volume"
              ? "cm³"
              : type === "density"
                ? "HU"
                : undefined,
    };
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, fields: [...s.fields, newField] } : s,
      ),
    );
    setSelectedFieldId(newField.id);
  };

  const removeField = (fieldId: string) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.id !== fieldId),
      })),
    );
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    setSrMappings((prev) => prev.filter((m) => m.fieldId !== fieldId));
    setConditionalRules((prev) =>
      prev.filter((r) => r.fieldId !== fieldId && r.targetFieldId !== fieldId),
    );
  };

  const updateField = (
    fieldId: string,
    patch: Partial<TemplateFieldDefinition>,
  ) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        fields: s.fields.map((f) =>
          f.id === fieldId ? { ...f, ...patch } : f,
        ),
      })),
    );
  };

  const addSection = () => {
    const newSection = {
      id: `sec-${Date.now()}`,
      name: `新章节 ${sections.length + 1}`,
      order: sections.length,
      color: PRESET_SECTIONS[sections.length % PRESET_SECTIONS.length].color,
      fields: [],
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      message.warning("至少需要保留 1 个章节");
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (selectedSectionId === sectionId) setSelectedSectionId(null);
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    setDraggedType(type);
    e.dataTransfer.setData("text/plain", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    const type = e.dataTransfer.getData(
      "text/plain",
    ) as TemplateFieldDefinition["dataType"];
    if (type) addField(sectionId, type);
    setDraggedType(null);
  };

  // ---------- 条件规则操作 ----------
  const addConditionalRule = () => {
    if (allFields.length < 2) {
      message.warning("至少需要 2 个字段才能创建条件规则");
      return;
    }
    const newRule: ConditionalRule = {
      id: `rule-${Date.now()}`,
      fieldId: allFields?.[0]?.id ?? '',
      operator: "equals",
      value: "",
      targetFieldId: allFields[1].id,
      action: "show",
    };
    setConditionalRules([...conditionalRules, newRule]);
  };

  const updateConditionalRule = (
    ruleId: string,
    patch: Partial<ConditionalRule>,
  ) => {
    setConditionalRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    );
  };

  const removeConditionalRule = (ruleId: string) => {
    setConditionalRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // ---------- IHE RR 映射 ----------
  const handleMapFieldToSr = (
    fieldId: string,
    srTemplateId: string,
    mappingPath: string,
  ) => {
    const field = allFields.find((f) => f.id === fieldId);
    if (!field) return;
    const existing = srMappings.findIndex((m) => m.fieldId === fieldId);
    const tpl = IHE_RR_TEMPLATES.find((t) => t.id === srTemplateId);
    const mapping: IheRRMapping = {
      fieldId,
      fieldLabel: field.fieldLabel,
      srTemplateId,
      srTemplateName: tpl?.name || srTemplateId,
      mappingPath,
      complianceStatus: mappingPath ? "compliant" : "partial",
    };
    if (existing >= 0) {
      setSrMappings((prev) =>
        prev.map((m, i) => (i === existing ? mapping : m)),
      );
    } else {
      setSrMappings((prev) => [...prev, mapping]);
    }
    const totalFields = allFields.length;
    const mappedCount =
      srMappings.filter((m) => allFields.some((f) => f.id === m.fieldId))
        .length + 1;
    setComplianceScore(
      Math.round((mappedCount / Math.max(totalFields, 1)) * 100),
    );
  };

  const removeSrMapping = (fieldId: string) => {
    setSrMappings((prev) => prev.filter((m) => m.fieldId !== fieldId));
    const totalFields = allFields.length;
    const mappedCount = srMappings.filter(
      (m) => m.fieldId !== fieldId && allFields.some((f) => f.id === m.fieldId),
    ).length;
    setComplianceScore(
      Math.round((mappedCount / Math.max(totalFields, 1)) * 100),
    );
  };

  const totalFields = sections.reduce((sum, s) => sum + s.fields.length, 0);
  const requiredFields = sections.reduce(
    (sum, s) => sum + s.fields.filter((f) => f.required).length,
    0,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)",
        background: "var(--content-bg)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/template-management")}
            style={{
              padding: 4,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={14} color="#7c3aed" /> 模板设计器 v1.0.2 (R2)
              <span
                style={{
                  fontSize: 12,
                  padding: "0 5px",
                  borderRadius: 3,
                  background: "#10b981",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                R2
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{meta.name}</span>
              <span>·</span>
              <span>
                {meta.modality} / {meta.bodyPart}
              </span>
              <span>·</span>
              <span>{totalFields} 字段</span>
              <span>·</span>
              <span
                style={{ color: requiredFields > 0 ? "#dc2626" : "#64748b" }}
              >
                {requiredFields} 必填
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            style={{
              padding: "4px 10px",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              background: previewMode ? "var(--color-info-bg)" : "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Eye size={12} /> {previewMode ? "编辑" : "预览"}
          </button>
          <button
            onClick={async () => {
              const sourceId = id ?? initialTemplate?.id ?? meta.code;
              if (!sourceId) {
                message.warning("当前模板未关联 ID，无法克隆");
                return;
              }
              try {
                const res = await api.post<{ id: string }>(
                  `/writing/templates/${sourceId}/clone`,
                );
                if (res.success) {
                  const newId = res.data?.id ?? `tpl-clone-${Date.now()}`;
                  message.success(`已克隆为新模板 ${newId}`);
                  navigate(`/template-designer/${newId}`);
                } else {
                  message.error(res.error?.message || "克隆失败");
                }
              } catch (e: any) {
                message.error("克隆失败: " + (e?.message || String(e)));
              }
            }}
            style={{
              padding: "4px 10px",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Copy size={12} /> 克隆
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              padding: 4,
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={async () => {
              const targetId = id ?? meta.code;
              try {
                const res = await v3WritingApi.updateTemplate(targetId, {
                  id: targetId,
                  name: meta.name,
                  modality: meta.modality,
                  bodyPart: meta.bodyPart,
                  version: meta.version,
                  description: meta.description,
                  author: meta.author,
                  scope: meta.scope,
                  gender: meta.gender,
                  minAge: meta.minAge,
                  maxAge: meta.maxAge,
                  sections: sections.map((s) => ({
                    id: s.id,
                    name: s.name,
                    order: s.order,
                    color: s.color,
                    fields: s.fields,
                  })),
                  srMappings,
                  conditionalRules,
                  complianceScore,
                });
                if (res.success) {
                  message.success(`模板 ${meta.name} 已保存 (${targetId})`);
                } else {
                  message.error(res.error?.message || "保存失败");
                }
              } catch (e: any) {
                message.error("保存失败: " + (e?.message || String(e)));
              }
            }}
            style={{
              padding: "4px 12px",
              border: "none",
              borderRadius: 6,
              background: "#10b981",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Save size={12} /> 保存模板
          </button>
        </div>
      </div>

      {!previewMode && !isFullscreen && (
        <div
          style={{
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border-color)",
            padding: "8px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <MetaField label="名称">
            <input
              type="text"
              value={meta.name}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              style={inputStyle}
            />
          </MetaField>
          <MetaField label="编码">
            <input
              type="text"
              value={meta.code}
              onChange={(e) => setMeta({ ...meta, code: e.target.value })}
              style={{ ...inputStyle, width: 140 }}
            />
          </MetaField>
          <MetaField label="设备">
            <select
              value={meta.modality}
              onChange={(e) => setMeta({ ...meta, modality: e.target.value })}
              style={selectStyle}
            >
              {["CT", "MR", "DR", "MG", "US", "PET-CT", "DSA"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </MetaField>
          <MetaField label="部位">
            <input
              type="text"
              value={meta.bodyPart}
              onChange={(e) => setMeta({ ...meta, bodyPart: e.target.value })}
              style={{ ...inputStyle, width: 100 }}
            />
          </MetaField>
          <MetaField label="范围">
            <select
              value={meta.scope}
              onChange={(e) =>
                setMeta({ ...meta, scope: e.target.value as typeof meta.scope })
              }
              style={selectStyle}
            >
              <option value="default">全院</option>
              <option value="department">科室</option>
              <option value="personal">个人</option>
            </select>
          </MetaField>
          <MetaField label="性别">
            <select
              value={meta.gender}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  gender: e.target.value as typeof meta.gender,
                })
              }
              style={selectStyle}
            >
              <option value="all">不限</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </MetaField>
          <MetaField label="年龄">
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                value={meta.minAge}
                onChange={(e) =>
                  setMeta({ ...meta, minAge: Number(e.target.value) })
                }
                style={{ ...inputStyle, width: 50 }}
              />
              <span>~</span>
              <input
                type="number"
                value={meta.maxAge}
                onChange={(e) =>
                  setMeta({ ...meta, maxAge: Number(e.target.value) })
                }
                style={{ ...inputStyle, width: 50 }}
              />
            </div>
          </MetaField>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: 0 }}>
        {!isFullscreen && !previewMode && (
          <div
            style={{
              width: 240,
              background: "var(--bg-card)",
              borderRight: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--border-color)",
                fontSize: 12,
                fontWeight: 700,
                color: "#1e40af",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FileSpreadsheet size={13} /> 字段库
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {FIELD_LIBRARY_GROUPS.map((group) => {
                const groupTypes = FIELD_TYPE_META.filter((t) =>
                  group.types.includes(t.type),
                );
                return (
                  <div key={group.key} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {group.label}
                    </div>
                    {groupTypes.map((meta) => {
                      const Icon = meta.icon;
                      return (
                        <div
                          key={meta.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, meta.type)}
                          style={{
                            padding: 6,
                            marginBottom: 3,
                            background: "var(--content-bg)",
                            borderRadius: 4,
                            border: `1px solid ${meta.color}30`,
                            cursor: "grab",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = `${meta.color}10`;
                            e.currentTarget.style.borderColor = meta.color;
                          }}
                          onMouseLeave={(e) => {
e.currentTarget.style.background = "var(--bg-card)";
e.currentTarget.style.borderColor = `${meta.color}30`;
                          }}
                        >
                          <GripVertical size={11} color="var(--text-secondary)" />
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              background: `${meta.color}15`,
                              color: meta.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={12} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {meta.label}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {meta.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div
                style={{
                  marginTop: 16,
                  padding: 8,
                  background: "var(--color-warning-bg)",
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#92400e",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  💡 拖拽提示
                </div>
                <div>将左侧字段拖拽到中间画布的章节中，即可添加到模板。</div>
              </div>
            </div>
          </div>
        )}

        <div
          ref={canvasRef}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "var(--content-bg)",
            overflow: "auto",
            padding: 12,
          }}
        >
          {previewMode ? (
            <PreviewCanvas meta={meta} sections={sections} />
          ) : (
            <>
              {sections.map((section) => (
                <div
                  key={section.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onClick={() => setSelectedSectionId(section.id)}
                  style={{
                    background: "var(--bg-card)",
                    border: `2px ${selectedSectionId === section.id ? "solid" : "dashed"} ${selectedSectionId === section.id ? section.color : "#cbd5e1"}`,
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      background: `${section.color}10`,
                      borderBottom: `1px solid ${section.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ChevronDown size={12} color={section.color} />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: section.color,
                        }}
                      >
                        {section.name}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        ({section.fields.length} 字段)
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSection(section.id);
                        }}
                        style={{
                          padding: "2px 6px",
                          border: "1px solid #dc2626",
                          borderRadius: 3,
                          background: "var(--bg-card)",
                          color: "#dc2626",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: 8, minHeight: 60 }}>
                    {section.fields.length === 0 ? (
                      <div
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "var(--text-secondary)",
                          fontSize: 12,
                          background: "var(--content-bg)",
                          borderRadius: 4,
                          border: "1px dashed var(--border-color)",
                        }}
                      >
                        📦 拖拽字段到此处添加
                      </div>
                    ) : (
                      section.fields.map((field) => {
                        const typeMeta = FIELD_TYPE_META.find(
                          (t) => t.type === field.dataType,
                        );
                        const isSelected = selectedFieldId === field.id;
                        const hasCondition = conditionalRules.find(
                          (r) => r.targetFieldId === field.id,
                        );
                        const hasMapping = srMappings.find(
                          (m) => m.fieldId === field.id,
                        );
                        return (
                          <div
                            key={field.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldId(field.id);
                            }}
                            style={{
                              padding: 8,
                              marginBottom: 4,
                              background: isSelected
                                ? `${typeMeta?.color}15`
                                : "var(--bg-card)",
                              border: `1px solid ${isSelected ? typeMeta?.color : "#e2e8f0"}`,
                              borderRadius: 4,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected)
e.currentTarget.style.background = "var(--bg-card)";
}}
onMouseLeave={(e) => {
if (!isSelected)
e.currentTarget.style.background = "var(--bg-card)";
}}
                          >
                            <GripVertical size={11} color="var(--text-secondary)" />
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                background: `${typeMeta?.color}20`,
                                color: typeMeta?.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {typeMeta && <typeMeta.icon size={12} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {field.required && (
                                  <span style={{ color: "#dc2626" }}>*</span>
                                )}
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {field.fieldLabel}
                                </span>
                                {field.unit && (
                                  <span
                                    style={{ fontSize: 12, color: "var(--text-secondary)" }}
                                  >
                                    ({field.unit})
                                  </span>
                                )}
                                {field.category && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      padding: "0 4px",
                                      background: "var(--color-info-bg)",
                                      color: "#1e40af",
                                      borderRadius: 3,
                                    }}
                                  >
                                    {field.category}
                                  </span>
                                )}
                                {hasCondition && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      padding: "0 4px",
                                      background: "var(--color-warning-bg)",
                                      color: "#92400e",
                                      borderRadius: 3,
                                    }}
                                  >
                                    条件
                                  </span>
                                )}
                                {hasMapping && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      padding: "0 4px",
                                      background: "var(--color-success-bg)",
                                      color: "#16a34a",
                                      borderRadius: 3,
                                    }}
                                  >
                                    SR
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-secondary)",
                                  marginTop: 1,
                                }}
                              >
                                {typeMeta?.label} · {field.fieldKey}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.id);
                              }}
                              style={{
                                padding: 2,
                                border: "none",
                                background: "transparent",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={addSection}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 4,
                  background: "var(--bg-card)",
                  border: "2px dashed var(--border-color)",
                  borderRadius: 8,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Plus size={14} /> 添加章节
              </button>
            </>
          )}
        </div>

        {!isFullscreen && !previewMode && (
          <div
            style={{
              width: 340,
              background: "var(--bg-card)",
              borderLeft: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 2,
                padding: "6px 8px",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--content-bg)",
              }}
            >
              {[
                {
                  key: "properties",
                  label: "属性",
                  icon: <Settings size={12} />,
                },
                {
                  key: "conditional",
                  label: "条件",
                  icon: <GitMerge size={12} />,
                },
                {
                  key: "sr-mapping",
                  label: "SR映射",
                  icon: <Activity size={12} />,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() =>
                    setActiveRightTab(tab.key as typeof activeRightTab)
                  }
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "6px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background:
                      activeRightTab === tab.key ? "#fff" : "transparent",
                    color: activeRightTab === tab.key ? "#1e40af" : "#64748b",
                    boxShadow:
                      activeRightTab === tab.key
                        ? "0 1px 3px rgba(0,0,0,0.1)"
                        : "none",
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {activeRightTab === "properties" && (
                <>
                  {!selectedField && !selectedSection && (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        padding: 30,
                        fontSize: 12,
                      }}
                    >
                      <Settings
                        size={32}
                        style={{
                          color: "#cbd5e1",
                          display: "block",
                          margin: "0 auto 8px",
                        }}
                      />
                      点击画布中的字段或章节，编辑其属性
                    </div>
                  )}
                  {selectedField && (
                    <FieldPropertyPanel
                      field={selectedField}
                      onChange={(patch) => updateField(selectedField.id, patch)}
                    />
                  )}
                  {selectedSection && !selectedField && (
                    <SectionPropertyPanel
                      section={selectedSection}
                      onChange={(patch) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === selectedSection.id
                              ? { ...s, ...patch }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                </>
              )}

              {activeRightTab === "conditional" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <GitMerge size={13} color="#f59e0b" />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      条件逻辑
                    </span>
                    <button
                      onClick={addConditionalRule}
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 8px",
                        background: "#f59e0b",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={10} /> 新增规则
                    </button>
                  </div>
                  {conditionalRules.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        padding: 20,
                        fontSize: 12,
                        background: "var(--content-bg)",
                        borderRadius: 8,
                      }}
                    >
                      <GitMerge
                        size={24}
                        style={{
                          color: "#cbd5e1",
                          display: "block",
                          margin: "0 auto 8px",
                        }}
                      />
                      暂无条件规则
                      <br />
                      点击「新增规则」创建
                    </div>
                  ) : (
                    conditionalRules.map((rule) => (
                      <div
                        key={rule.id}
                        style={{
                          background: "var(--color-warning-bg)",
                          border: "1px solid #fcd34d",
                          borderRadius: 6,
                          padding: 10,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#92400e",
                            }}
                          >
                            条件规则
                          </span>
                          <button
                            onClick={() => removeConditionalRule(rule.id)}
                            style={{
                              padding: 2,
                              border: "none",
                              background: "transparent",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                              如果
                            </span>
                            <select
                              value={rule.fieldId}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  fieldId: e.target.value,
                                })
                              }
                              style={{
                                padding: "2px 4px",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                fontSize: 12,
                                flex: 1,
                              }}
                            >
                              {allFields.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.fieldLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                            }}
                          >
                            <select
                              value={rule.operator}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  operator: e.target
                                    .value as ConditionalRule["operator"],
                                })
                              }
                              style={{
                                padding: "2px 4px",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                fontSize: 12,
                                flex: 1,
                              }}
                            >
                              <option value="equals">等于</option>
                              <option value="not-equals">不等于</option>
                              <option value="greater-than">大于</option>
                              <option value="less-than">小于</option>
                            </select>
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  value: e.target.value,
                                })
                              }
                              placeholder="值"
                              style={{
                                padding: "2px 4px",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                fontSize: 12,
                                width: 80,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                              则
                            </span>
                            <select
                              value={rule.action}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  action: e.target
                                    .value as ConditionalRule["action"],
                                })
                              }
                              style={{
                                padding: "2px 4px",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                fontSize: 12,
                              }}
                            >
                              <option value="show">显示</option>
                              <option value="hide">隐藏</option>
                              <option value="require">必填</option>
                            </select>
                            <select
                              value={rule.targetFieldId}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  targetFieldId: e.target.value,
                                })
                              }
                              style={{
                                padding: "2px 4px",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                fontSize: 12,
                                flex: 1,
                              }}
                            >
                              {allFields
                                .filter((f) => f.id !== rule.fieldId)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.fieldLabel}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    条件逻辑说明：当条件字段的值满足条件时，对目标字段执行显示/隐藏/必填操作。
                  </div>
                </div>
              )}

              {activeRightTab === "sr-mapping" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <Activity size={13} color="#0891b2" />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      IHE RR 结构化报告映射
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#06b6d422",
                      border: "1px solid #0891b2",
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#155e75",
                        fontWeight: 600,
                      }}
                    >
                      合规度
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "#e2e8f0",
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${complianceScore}%`,
                            height: 8,
                            background:
                              complianceScore > 80
                                ? "#16a34a"
                                : complianceScore > 50
                                  ? "#f59e0b"
                                  : "#dc2626",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color:
                            complianceScore > 80
                              ? "#16a34a"
                              : complianceScore > 50
                                ? "#d97706"
                                : "#dc2626",
                        }}
                      >
                        {complianceScore}%
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                        marginBottom: 3,
                        display: "block",
                      }}
                    >
                      IHE RR 模板选择
                    </label>
                    <select
                      value={selectedSrTemplate}
                      onChange={(e) => setSelectedSrTemplate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid var(--border-color)",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "var(--text-primary)",
                        background: "var(--bg-card)",
                      }}
                    >
                      {IHE_RR_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  {totalFields > 0 ? (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "var(--content-bg)" }}>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              borderBottom: "1px solid var(--border-color)",
                            }}
                          >
                            字段
                          </th>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              borderBottom: "1px solid var(--border-color)",
                            }}
                          >
                            SR模板
                          </th>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              borderBottom: "1px solid var(--border-color)",
                            }}
                          >
                            状态
                          </th>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "center",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              borderBottom: "1px solid var(--border-color)",
                            }}
                          >
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allFields.map((f) => {
                          const mapping = srMappings.find(
                            (m) => m.fieldId === f.id,
                          );
                          return (
                            <tr
                              key={f.id}
                              style={{ borderBottom: "1px solid var(--border-light)" }}
                            >
                              <td style={{ padding: "6px 8px" }}>
                                <span
                                  style={{ fontWeight: 600, color: "var(--text-primary)" }}
                                >
                                  {f.fieldLabel}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                {mapping ? (
                                  <span
                                    style={{ fontSize: 12, color: "#0891b2" }}
                                  >
                                    {mapping.srTemplateId}
                                  </span>
                                ) : (
                                  <select
                                    value=""
                                    onChange={(e) =>
                                      handleMapFieldToSr(
                                        f.id,
                                        e.target.value,
                                        "",
                                      )
                                    }
                                    style={{
                                      padding: "2px 4px",
                                      border: "1px solid var(--border-color)",
                                      borderRadius: 3,
                                      fontSize: 12,
                                      width: "100%",
                                    }}
                                  >
                                    <option value="">未映射</option>
                                    {IHE_RR_TEMPLATES.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.id}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                {mapping ? (
                                  <span
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 2,
                                      padding: "1px 4px",
                                      borderRadius: 3,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background:
                                        mapping.complianceStatus === "compliant"
                                          ? "var(--color-success-bg)"
                                          : "var(--color-warning-bg)",
                                      color:
                                        mapping.complianceStatus === "compliant"
                                          ? "#16a34a"
                                          : "#d97706",
                                    }}
                                  >
                                    {mapping.complianceStatus === "compliant"
                                      ? "合规"
                                      : "部分"}
                                  </span>
                                ) : (
                                  <span
                                    style={{ color: "var(--text-secondary)", fontSize: 12 }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "6px 8px",
                                  textAlign: "center",
                                }}
                              >
                                {mapping && (
                                  <button
                                    onClick={() => removeSrMapping(f.id)}
                                    style={{
                                      padding: 2,
                                      border: "none",
                                      background: "transparent",
                                      color: "#dc2626",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <X size={9} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        padding: 16,
                        fontSize: 12,
                      }}
                    >
                      请先添加字段
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    将模板字段映射到 DICOM SR 模板 ID，确保符合 IHE RR
                    规范要求。
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: 10,
                borderTop: "1px solid var(--border-color)",
                background: "var(--content-bg)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <button
                onClick={async () => {
                  const targetId = id ?? meta.code;
                  try {
                    const res = await v3WritingApi.updateTemplate(targetId, {
                      sections: sections.map((s) => ({
                        id: s.id,
                        name: s.name,
                        order: s.order,
                        color: s.color,
                        fields: s.fields,
                      })),
                      selectedFieldPatch: selectedFieldId
                        ? {
                            id: selectedFieldId,
                            field: sections
                              .flatMap((s) => s.fields)
                              .find((f) => f.id === selectedFieldId),
                          }
                        : null,
                      srMappings,
                    });
                    if (res.success) {
                      message.success(`已应用字段属性到模板 ${meta.name}`);
                    } else {
                      message.error(res.error?.message || "应用失败");
                    }
                  } catch (e: any) {
                    message.error("应用失败: " + (e?.message || String(e)));
                  }
                }}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 4,
                  background: "#3b82f6",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Check size={11} /> 应用属性
              </button>
              <button
                onClick={() => {
                  if (confirm("确认删除当前选中的字段？"))
                    removeField(selectedFieldId!);
                }}
                disabled={!selectedField}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #dc2626",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: selectedField ? "pointer" : "not-allowed",
                  opacity: selectedField ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Trash2 size={11} /> 删除字段
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--border-color)",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
  minWidth: 100,
};
const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--border-color)",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
  minWidth: 80,
};

const MetaField: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
      {label}:
    </span>
    {children}
  </div>
);

const FieldPropertyPanel: React.FC<{
  field: TemplateFieldDefinition;
  onChange: (patch: Partial<TemplateFieldDefinition>) => void;
}> = ({ field, onChange }) => (
  <div>
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#1e40af",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Info size={12} /> 字段属性
    </div>
    <PropRow label="显示标签">
      <input
        type="text"
        value={field.fieldLabel}
        onChange={(e) => onChange({ fieldLabel: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label="字段键名">
      <input
        type="text"
        value={field.fieldKey}
        onChange={(e) =>
          onChange({ fieldKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })
        }
        style={{ ...inputStyle, width: "100%", fontFamily: "monospace" }}
      />
    </PropRow>
    <PropRow label="数据类型">
      <select
        value={field.dataType}
        onChange={(e) =>
          onChange({
            dataType: e.target.value as TemplateFieldDefinition["dataType"],
          })
        }
        style={{ ...selectStyle, width: "100%" }}
      >
        {FIELD_TYPE_META.map((m) => (
          <option key={m.type} value={m.type}>
            {m.label}
          </option>
        ))}
      </select>
    </PropRow>
    <PropRow label="所在章节">
      <input
        type="text"
        value={field.fieldGroup}
        onChange={(e) => onChange({ fieldGroup: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label="单位">
      <input
        type="text"
        value={field.unit || ""}
        onChange={(e) => onChange({ unit: e.target.value })}
        placeholder="如 mm、HU、℃"
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label="必填">
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />{" "}
        是否必填
      </label>
    </PropRow>
    {field.dataType === "number" && (
      <>
        <PropRow label="最小值">
          <input
            type="number"
            value={field.validation?.min ?? ""}
            onChange={(e) =>
              onChange({
                validation: {
                  ...field.validation,
                  min: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            style={{ ...inputStyle, width: "100%" }}
          />
        </PropRow>
        <PropRow label="最大值">
          <input
            type="number"
            value={field.validation?.max ?? ""}
            onChange={(e) =>
              onChange({
                validation: {
                  ...field.validation,
                  max: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            style={{ ...inputStyle, width: "100%" }}
          />
        </PropRow>
      </>
    )}
    <PropRow label="占位提示">
      <input
        type="text"
        value={field.placeholder || ""}
        onChange={(e) => onChange({ placeholder: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label="关联分类">
      <select
        value={field.category || ""}
        onChange={(e) => onChange({ category: e.target.value || undefined })}
        style={{ ...selectStyle, width: "100%" }}
      >
        <option value="">无</option>
        {PRESET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </PropRow>
    <PropRow label="依赖字段">
      <input
        type="text"
        value={field.dependsOn || ""}
        onChange={(e) => onChange({ dependsOn: e.target.value || undefined })}
        placeholder="如 has_lesion"
        style={{ ...inputStyle, width: "100%", fontFamily: "monospace" }}
      />
    </PropRow>
    <PropRow label="描述说明">
      <textarea
        value={field.description || ""}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={2}
        style={{
          ...inputStyle,
          width: "100%",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </PropRow>
    {(field.dataType === "enum" ||
      field.dataType === "multi-enum" ||
      field.dataType === "scale") && (
      <PropRow label="选项 (label:value)">
        <textarea
          value={(field.options || [])
            .map((o) => `${o.label}:${o.value}`)
            .join("\n")}
          onChange={(e) => {
            const opts = e.target.value
              .split("\n")
              .filter((line) => line.includes(":"))
              .map((line) => {
                const [label, value] = line.split(":");
                return { label: label.trim(), value: value.trim() };
              });
            onChange({ options: opts });
          }}
          rows={5}
          placeholder="是:yes&#10;否:no"
          style={{
            ...inputStyle,
            width: "100%",
            resize: "vertical",
            fontFamily: "monospace",
          }}
        />
      </PropRow>
    )}
  </div>
);

const SectionPropertyPanel: React.FC<{
  section: { id: string; name: string; color: string; order: number };
  onChange: (patch: { name?: string; color?: string; order?: number }) => void;
}> = ({ section, onChange }) => (
  <div>
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#1e40af",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Info size={12} /> 章节属性
    </div>
    <PropRow label="章节名称">
      <input
        type="text"
        value={section.name}
        onChange={(e) => onChange({ name: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label="主题色">
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          "#1e40af",
          "#7c3aed",
          "#0891b2",
          "#f59e0b",
          "#dc2626",
          "#10b981",
          "#475569",
        ].map((c) => (
          <button
            key={c}
            onClick={() => onChange({ color: c })}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: c,
              border:
                section.color === c ? "2px solid #1e293b" : "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </PropRow>
    <PropRow label="排序">
      <input
        type="number"
        value={section.order}
        onChange={(e) => onChange({ order: Number(e.target.value) })}
        style={{ ...inputStyle, width: 80 }}
      />
    </PropRow>
  </div>
);

const PropRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ marginBottom: 10 }}>
    <div
      style={{
        fontSize: 12,
        color: "var(--text-secondary)",
        fontWeight: 600,
        marginBottom: 3,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

const PreviewCanvas: React.FC<{
  meta: any;
  sections: Array<{
    id: string;
    name: string;
    order: number;
    color: string;
    fields: TemplateFieldDefinition[];
  }>;
}> = ({ meta, sections }) => (
  <div
    style={{
      background: "var(--bg-card)",
      borderRadius: 8,
      padding: 20,
      maxWidth: 800,
      margin: "0 auto",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
  >
    <div
      style={{
        textAlign: "center",
        marginBottom: 20,
        borderBottom: "2px solid #1e40af",
        paddingBottom: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: "#1e40af" }}>{meta.name}</h2>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
        {meta.modality} · {meta.bodyPart} · {meta.version} · {meta.author}
      </div>
    </div>
    {sections.map((section) => (
      <div key={section.id} style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 14,
            color: section.color,
            marginBottom: 8,
            borderLeft: `3px solid ${section.color}`,
            paddingLeft: 8,
          }}
        >
          {section.name}{" "}
          {section.fields.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              ({section.fields.length} 项)
            </span>
          )}
        </h3>
        {section.fields.map((field) => (
          <div
            key={field.id}
            style={{
              padding: 8,
              marginBottom: 4,
              background: "var(--content-bg)",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {field.required && <span style={{ color: "#dc2626" }}>*</span>}
              {field.fieldLabel}
              {field.unit && (
                <span style={{ color: "var(--text-secondary)" }}> ({field.unit})</span>
              )}
            </span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 8, fontSize: 12 }}>
              [{field.dataType}]
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);
