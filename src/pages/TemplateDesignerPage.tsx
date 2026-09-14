// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板设计器
// Phase R2：拖拽式可视化模板设计器
// 左：字段库 / 中：画布 / 右：属性面板 / 顶：元数据
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import { StatCard } from "../components/common/StatCard";
import { AppText } from "../components/common/AppText";
import { ChevronLeft, Save, Eye, Plus, Trash2, GripVertical, Type, Hash, Calendar, ToggleLeft, ListChecks, Sliders, Calculator, FileText, ChevronDown, Copy, Settings, Image as ImageIcon, Tag, ListOrdered, FileSpreadsheet, Code, Info, Check, X, Sparkles, Maximize2, Minimize2, GitMerge, Activity, ArrowUp, ArrowDown, Braces, Layers } from 'lucide-react';
import type { LucideIcon } from "lucide-react";
import {
  STRUCTURED_FIELD_TEMPLATES,
  type TemplateFieldDefinition,
} from "../data/structuredFieldTemplates";
import { v3WritingApi } from "../services/api/v3Api";
import { api } from "../services/api/client";
// [v3.0.6.11-99 Wave2B P1] 可视化设计器: 变量面板 (templateVariables) + 结构化内容保存 (templatesApi)
import { TEMPLATE_VARIABLES } from "../utils/templateVariables";
import {
  templatesApi,
  type TemplateBlock,
  type TemplateStructure,
} from "../services/api/templatesApi";
import { t } from "../i18n/appI18n";

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
    label: t("templateDesigner.field.text"),
    icon: Type,
    color: "#3b82f6",
    description: t("templateDesigner.field.textDesc"),
    category: "basic",
  },
  {
    type: "number",
    label: t("templateDesigner.field.number"),
    icon: Hash,
    color: "#0891b2",
    description: t("templateDesigner.field.numberDesc"),
    category: "basic",
  },
  {
    type: "date",
    label: t("templateDesigner.field.date"),
    icon: Calendar,
    color: "#7c3aed",
    description: t("templateDesigner.field.dateDesc"),
    category: "basic",
  },
  {
    type: "boolean",
    label: t("templateDesigner.field.boolean"),
    icon: ToggleLeft,
    color: "#10b981",
    description: t("templateDesigner.field.booleanDesc"),
    category: "basic",
  },
  {
    type: "enum",
    label: t("templateDesigner.field.enum"),
    icon: ListChecks,
    color: "#f59e0b",
    description: t("templateDesigner.field.enumDesc"),
    category: "select",
  },
  {
    type: "multi-enum",
    label: t("templateDesigner.field.multiEnum"),
    icon: ListOrdered,
    color: "#f97316",
    description: t("templateDesigner.field.multiEnumDesc"),
    category: "select",
  },
  {
    type: "scale",
    label: t("templateDesigner.field.scale"),
    icon: Sliders,
    color: "#a855f7",
    description: t("templateDesigner.field.scaleDesc"),
    category: "select",
  },
  {
    type: "length",
    label: t("templateDesigner.field.length"),
    icon: Calculator,
    color: "#dc2626",
    description: t("templateDesigner.field.lengthDesc"),
    category: "measure",
  },
  {
    type: "area",
    label: t("templateDesigner.field.area"),
    icon: Calculator,
    color: "#dc2626",
    description: t("templateDesigner.field.areaDesc"),
    category: "measure",
  },
  {
    type: "volume",
    label: t("templateDesigner.field.volume"),
    icon: Calculator,
    color: "#dc2626",
    description: t("templateDesigner.field.volumeDesc"),
    category: "measure",
  },
  {
    type: "image",
    label: t("templateDesigner.field.image"),
    icon: ImageIcon,
    color: "#0ea5e9",
    description: t("templateDesigner.field.imageDesc"),
    category: "special",
  },
  {
    type: "annotation",
    label: t("templateDesigner.field.annotation"),
    icon: Tag,
    color: "#0ea5e9",
    description: t("templateDesigner.field.annotationDesc"),
    category: "special",
  },
  {
    type: "formula",
    label: t("templateDesigner.field.formula"),
    icon: Code,
    color: "#6366f1",
    description: t("templateDesigner.field.formulaDesc"),
    category: "special",
  },
  {
    type: "snippet",
    label: t("templateDesigner.field.snippet"),
    icon: FileText,
    color: "var(--text-secondary)",
    description: t("templateDesigner.field.snippetDesc"),
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
    label: t("templateDesigner.group.basic"),
    types: ["text", "number", "date", "boolean"],
  },
  { key: "select", label: t("templateDesigner.group.select"), types: ["enum", "multi-enum", "scale"] },
  { key: "measure", label: t("templateDesigner.group.measure"), types: ["length", "area", "volume"] },
  {
    key: "special",
    label: t("templateDesigner.group.special"),
    types: ["image", "annotation", "formula", "snippet"],
  },
];

const PRESET_SECTIONS = [
  { id: "sec-findings", name: t("templateDesigner.section.findings"), order: 1, color: "#1e40af" },
  { id: "sec-impression", name: t("templateDesigner.section.impression"), order: 2, color: "#7c3aed" },
  { id: "sec-rec", name: t("templateDesigner.section.recommendation"), order: 3, color: "#0891b2" },
  { id: "sec-comp", name: t("templateDesigner.section.comparison"), order: 4, color: "#f59e0b" },
  { id: "sec-tech", name: t("templateDesigner.section.technique"), order: 5, color: "var(--text-secondary)" },
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

// [v3.0.6.11-99 Wave2B (模板设计器 P1)] 可视化模式 — 结构化字段面板 (RECIST/RADS 等)
const STRUCTURED_FIELD_PRESETS: Array<{
  fieldKey: string;
  label: string;
  desc: string;
  color: string;
}> = [
  { fieldKey: "RECIST", label: t("templateDesigner.structured.recist"), desc: t("templateDesigner.structured.recistDesc"), color: "#dc2626" },
  { fieldKey: "lungRads", label: "Lung-RADS", desc: t("templateDesigner.structured.lungRadsDesc"), color: "#0891b2" },
  { fieldKey: "biRads", label: "BI-RADS", desc: t("templateDesigner.structured.biRadsDesc"), color: "#7c3aed" },
  { fieldKey: "piRads", label: "PI-RADS", desc: t("templateDesigner.structured.piRadsDesc"), color: "#f59e0b" },
  { fieldKey: "liRads", label: "LI-RADS", desc: t("templateDesigner.structured.liRadsDesc"), color: "#10b981" },
  { fieldKey: "tiRads", label: "TI-RADS", desc: t("templateDesigner.structured.tiRadsDesc"), color: "#f97316" },
  { fieldKey: "cadRads", label: "CAD-RADS", desc: t("templateDesigner.structured.cadRadsDesc"), color: "#dc2626" },
  { fieldKey: "lesionSize", label: t("templateDesigner.structured.lesionSize"), desc: t("templateDesigner.structured.lesionSizeDesc"), color: "#6366f1" },
  { fieldKey: "lymphNodes", label: t("templateDesigner.structured.lymphNodes"), desc: t("templateDesigner.structured.lymphNodesDesc"), color: "#0ea5e9" },
  { fieldKey: "effusion", label: t("templateDesigner.structured.effusion"), desc: t("templateDesigner.structured.effusionDesc"), color: "#0ea5e9" },
];

// 可视化模式段落预设 (所见/印象/结论 等)
const VISUAL_SECTION_PRESETS = [
  { name: t("templateDesigner.section.findings"), color: "#1e40af" },
  { name: t("templateDesigner.section.impression"), color: "#7c3aed" },
  { name: t("templateDesigner.section.recommendation"), color: "#0891b2" },
  { name: t("templateDesigner.section.conclusion"), color: "#f59e0b" },
  { name: t("templateDesigner.section.comparison"), color: "#475569" },
];

const defaultVisualBlocks = (): TemplateStructure => [
  { type: "text", content: t("templateDesigner.defaultFindings") },
  { type: "text", content: "" },
  { type: "text", content: t("templateDesigner.defaultImpression") },
  { type: "text", content: "" },
  { type: "text", content: t("templateDesigner.defaultRecommendation") },
  { type: "text", content: "" },
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
  { id: "SR-TID-1500", name: t("templateDesigner.sr.tid1500") },
  { id: "SR-TID-1501", name: t("templateDesigner.sr.tid1501") },
  { id: "SR-TID-1502", name: t("templateDesigner.sr.tid1502") },
  { id: "SR-TID-1503", name: t("templateDesigner.sr.tid1503") },
  { id: "SR-TID-1504", name: t("templateDesigner.sr.tid1504") },
  { id: "SR-TID-1400", name: t("templateDesigner.sr.tid1400") },
  { id: "SR-MR-RR-001", name: t("templateDesigner.sr.rr001") },
  { id: "SR-MR-RR-002", name: t("templateDesigner.sr.rr002") },
  { id: "SR-MR-RR-003", name: t("templateDesigner.sr.rr003") },
  { id: "SR-MR-RR-004", name: t("templateDesigner.sr.rr004") },
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
    ? STRUCTURED_FIELD_TEMPLATES.find((tpl) => tpl.id === id) ||
      STRUCTURED_FIELD_TEMPLATES[0]
    : null;

  const [meta, setMeta] = useState({
    name: initialTemplate?.name || t("templateDesigner.newTemplate"),
    code: initialTemplate?.id || "tpl-custom-001",
    modality: initialTemplate?.modality || "CT",
    bodyPart: initialTemplate?.bodyPart || t("templateDesigner.defaultBodyPart"),
    version: initialTemplate?.version || "v1.0",
    description: initialTemplate?.description || "",
    author: t("templateDesigner.currentDoctor"),
    scope: "department" as "default" | "department" | "personal",
    minAge: 0,
    maxAge: 120,
    gender: "all" as "all" | "male" | "female",
    // [v3.0.6.11-100 Wave2C P2] 模板类型: 全文/段落/短语 (保存时写入, 模板库分类展示)
    templateType: "SECTION" as "FULL" | "SECTION" | "PHRASE",
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
      { id: "sec-0", name: t("templateDesigner.section.findings"), order: 0, color: "#1e40af", fields: [] },
      { id: "sec-1", name: t("templateDesigner.section.impression"), order: 1, color: "#7c3aed", fields: [] },
    ];
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [, setDraggedType] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---------- [v3.0.6.11-99 Wave2B P1] 可视化模式: 段落块画布 ----------
  const [designerMode, setDesignerMode] = useState<"fields" | "visual">("fields");
  const [visualApiId, setVisualApiId] = useState<string | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualBlocks, setVisualBlocks] = useState<TemplateStructure>(() => defaultVisualBlocks());
  const [selectedVisualIdx, setSelectedVisualIdx] = useState<number | null>(null);

  // 进入可视化模式且带模板 id 时读取已保存的 structure, 失败(无/不存在)回退默认段落
  useEffect(() => {
    if (designerMode !== "visual" || !id) return;
    let cancelled = false;
    setVisualLoading(true);
    templatesApi
      .getStructure(id)
      .then((res) => {
        if (cancelled || !res.success) return;
        if (Array.isArray(res.data?.structure) && res.data.structure.length > 0) {
          setVisualBlocks(res.data.structure);
          setVisualApiId(id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setVisualLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [designerMode, id]);

  const insertVisualBlock = (block: TemplateBlock, idx?: number | null) => {
    const at = idx != null && idx >= 0 ? idx + 1 : visualBlocks.length;
    setVisualBlocks((prev) => [...prev.slice(0, at), block, ...prev.slice(at)]);
    setSelectedVisualIdx(at);
  };

  const moveVisualBlock = (idx: number, dir: -1 | 1) => {
    setVisualBlocks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp: TemplateBlock = next[idx] ?? { type: "text", content: "" };
      next[idx] = next[target] ?? tmp;
      next[target] = tmp;
      return next;
    });
    setSelectedVisualIdx(idx + dir);
  };

  const removeVisualBlock = (idx: number) => {
    setVisualBlocks((prev) => prev.filter((_, i) => i !== idx));
    setSelectedVisualIdx(null);
  };

  const changeVisualBlockContent = (idx: number, content: string) => {
    setVisualBlocks((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, content } : b)),
    );
  };

  const visualContent = visualBlocks
    .map((b) => b.content)
    .filter((c) => c && c.trim() !== "")
    .join("\n");

  // 保存可视化模板: 有 id → PATCH structure; 无 id → 先 create 再写入 structure
  // [v3.0.6.11-100 Wave2C P2] 保存时写入 templateType (全文/段落/短语), 模板库分类 Tab 区分展示
  const saveVisualTemplate = async () => {
    const content = visualContent;
    const targetId = visualApiId ?? id ?? null;
    try {
      if (targetId) {
        const res = await templatesApi.saveStructure(targetId, visualBlocks, content);
        if (res.success) {
          await templatesApi.update(targetId, { templateType: meta.templateType }).catch(() => { /* 类型字段更新失败不阻塞 */ });
          setVisualApiId(targetId);
          message.success(`可视化模板已保存 (${targetId}, ${meta.templateType})`);
        } else {
          message.error(res.error?.message || t("templateDesigner.saveFailed"));
        }
      } else {
        const res = await templatesApi.create({
          name: meta.name || t("templateDesigner.visualTemplate"),
          category: meta.modality || "CT",
          modality: meta.modality,
          bodyPart: meta.bodyPart || t("templateDesigner.general"),
          templateType: meta.templateType,
          body: content || t("templateDesigner.toEdit"),
          structure: visualBlocks,
          createdById: "u-current",
        });
        if (res.success && res.data?.id) {
          setVisualApiId(res.data.id);
          message.success(`已创建模板 ${res.data.id}, 段落结构已保存 (${meta.templateType})`);
        } else {
          message.error(res.error?.message || t("templateDesigner.createFailed"));
        }
      }
    } catch (e: any) {
      message.error("可视化保存失败: " + (e?.message || String(e)));
    }
  };

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
    const typeMeta = FIELD_TYPE_META.find((ftMeta) => ftMeta.type === type);
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
      fieldGroup: sections.find((s) => s.id === sectionId)?.name || t("templateDesigner.section.findings"),
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
      message.warning(t("templateDesigner.needOneSection"));
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
      message.warning(t("templateDesigner.needTwoFields"));
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
              <Sparkles size={14} color="#7c3aed" /> {t("templateDesigner.headerTitle")}
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
              <span>{totalFields} {t("templateDesigner.fieldsUnit")}</span>
              <span>·</span>
              <span
                style={{ color: requiredFields > 0 ? "#dc2626" : "#64748b" }}
              >
                {requiredFields} {t("templateDesigner.requiredUnit")}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setDesignerMode(designerMode === "visual" ? "fields" : "visual")}
            style={{
              padding: "4px 10px",
              border: "1px solid #7c3aed",
              borderRadius: 6,
              background: designerMode === "visual" ? "#7c3aed" : "var(--bg-card)",
              color: designerMode === "visual" ? "#fff" : "#7c3aed",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Layers size={12} />{" "}
            {designerMode === "visual" ? t("templateDesigner.visualMode") : t("templateDesigner.fieldsMode")}
          </button>
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
            <Eye size={12} /> {previewMode ? t("templateDesigner.edit") : t("templateDesigner.preview")}
          </button>
          <button
            onClick={async () => {
              const sourceId = id ?? initialTemplate?.id ?? meta.code;
              if (!sourceId) {
                message.warning(t("templateDesigner.noIdClone"));
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
                  message.error(res.error?.message || t("templateDesigner.cloneFailed"));
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
            <Copy size={12} /> {t("templateDesigner.clone")}
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
            title={isFullscreen ? t("templateDesigner.exitFullscreen") : t("templateDesigner.fullscreen")}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={async () => {
              // [v3.0.6.11-99 Wave2B P1] 可视化模式 → 保存 structure JSON + content 预览文本
              if (designerMode === "visual") {
                await saveVisualTemplate();
                return;
              }
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
                  message.error(res.error?.message || t("templateDesigner.saveFailed"));
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
            <Save size={12} /> {t("templateDesigner.saveTemplate")}
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
          <MetaField label={t("templateDesigner.meta.name")}>
            <input
              type="text"
              value={meta.name}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              style={inputStyle}
            />
          </MetaField>
          <MetaField label={t("templateDesigner.meta.code")}>
            <input
              type="text"
              value={meta.code}
              onChange={(e) => setMeta({ ...meta, code: e.target.value })}
              style={{ ...inputStyle, width: 140 }}
            />
          </MetaField>
          <MetaField label={t("templateDesigner.meta.modality")}>
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
          <MetaField label={t("templateDesigner.meta.bodyPart")}>
            <input
              type="text"
              value={meta.bodyPart}
              onChange={(e) => setMeta({ ...meta, bodyPart: e.target.value })}
              style={{ ...inputStyle, width: 100 }}
            />
          </MetaField>
          {/* [v3.0.6.11-100 Wave2C P2] 模板类型: 全文/段落/短语 (保存时写入, 模板库分类 Tab 展示) */}
          <MetaField label={t("templateDesigner.meta.templateType")}>
            <select
              value={meta.templateType}
              onChange={(e) => setMeta({ ...meta, templateType: e.target.value as typeof meta.templateType })}
              style={selectStyle}
            >
              <option value="FULL">{t("templateDesigner.templateTypeFull")}</option>
              <option value="SECTION">{t("templateDesigner.templateTypeSection")}</option>
              <option value="PHRASE">{t("templateDesigner.templateTypePhrase")}</option>
            </select>
          </MetaField>
          <MetaField label={t("templateDesigner.meta.scope")}>
            <select
              value={meta.scope}
              onChange={(e) =>
                setMeta({ ...meta, scope: e.target.value as typeof meta.scope })
              }
              style={selectStyle}
            >
              <option value="default">{t("templateDesigner.scopeDefault")}</option>
              <option value="department">{t("templateDesigner.scopeDepartment")}</option>
              <option value="personal">{t("templateDesigner.scopePersonal")}</option>
            </select>
          </MetaField>
          <MetaField label={t("templateDesigner.meta.gender")}>
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
              <option value="all">{t("templateDesigner.genderAll")}</option>
              <option value="male">{t("templateDesigner.genderMale")}</option>
              <option value="female">{t("templateDesigner.genderFemale")}</option>
            </select>
          </MetaField>
          <MetaField label={t("templateDesigner.meta.age")}>
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
        {designerMode === "visual" ? (
          <VisualDesignerBody
            blocks={visualBlocks}
            loading={visualLoading}
            selectedIdx={selectedVisualIdx}
            onSelect={setSelectedVisualIdx}
            onInsertBlock={insertVisualBlock}
            onMoveBlock={moveVisualBlock}
            onRemoveBlock={removeVisualBlock}
            onChangeBlockContent={changeVisualBlockContent}
          />
        ) : (
          <>
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
              <FileSpreadsheet size={13} /> {t("templateDesigner.fieldLibrary")}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {FIELD_LIBRARY_GROUPS.map((group) => {
                const groupTypes = FIELD_TYPE_META.filter((ftMeta) =>
                  group.types.includes(ftMeta.type),
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
                            <AppText size="xs" color="secondary" as="div">
                              {meta.description}
                            </AppText>
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
                  💡 {t("templateDesigner.dragTipTitle")}
                </div>
                <div>{t("templateDesigner.dragTipBody")}</div>
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
                      <AppText size="xs" color="secondary" as="span">
                        ({section.fields.length} {t("templateDesigner.fieldsUnit")})
                      </AppText>
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
                        📦 {t("templateDesigner.dropHere")}
                      </div>
                    ) : (
                      section.fields.map((field) => {
                        const typeMeta = FIELD_TYPE_META.find(
                          (ftMeta) => ftMeta.type === field.dataType,
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
                                    {t("templateDesigner.conditionalTag")}
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
                <Plus size={14} /> {t("templateDesigner.addSection")}
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
                  label: t("templateDesigner.tab.properties"),
                  icon: <Settings size={12} />,
                },
                {
                  key: "conditional",
                  label: t("templateDesigner.tab.conditional"),
                  icon: <GitMerge size={12} />,
                },
                {
                  key: "sr-mapping",
                  label: t("templateDesigner.tab.srMapping"),
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
                      {t("templateDesigner.clickToEdit")}
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
                      {t("templateDesigner.conditionalLogic")}
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
                      <Plus size={10} /> {t("templateDesigner.addRule")}
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
                      {t("templateDesigner.noConditionalRules")}
                      <br />
                      {t("templateDesigner.clickAddRule")}
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
                            {t("templateDesigner.conditionalRule")}
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
                            <AppText size="xs" color="secondary" as="span">
                              {t("templateDesigner.if")}
                            </AppText>
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
                              <option value="equals">{t("templateDesigner.op.equals")}</option>
                              <option value="not-equals">{t("templateDesigner.op.notEquals")}</option>
                              <option value="greater-than">{t("templateDesigner.op.greaterThan")}</option>
                              <option value="less-than">{t("templateDesigner.op.lessThan")}</option>
                            </select>
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) =>
                                updateConditionalRule(rule.id, {
                                  value: e.target.value,
                                })
                              }
                              placeholder={t("templateDesigner.valuePlaceholder")}
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
                              {t("templateDesigner.then")}
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
                              <option value="show">{t("templateDesigner.action.show")}</option>
                              <option value="hide">{t("templateDesigner.action.hide")}</option>
                              <option value="require">{t("templateDesigner.action.require")}</option>
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
                    {t("templateDesigner.conditionalNote")}
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
                      {t("templateDesigner.srMappingTitle")}
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
                    <StatCard
                      title={t("templateDesigner.complianceScore")}
                      value={complianceScore}
                      suffix="%"
                      color={
                        complianceScore > 80
                          ? "success"
                          : complianceScore > 50
                            ? "warning"
                            : "error"
                      }
                      variant="compact"
                      size="sm"
                      style={{ marginBottom: 12, padding: "8px 10px" }}
                    />
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
                      {t("templateDesigner.srTemplateSelect")}
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
                      {IHE_RR_TEMPLATES.map((sr) => (
                        <option key={sr.id} value={sr.id}>
                          {sr.name} ({sr.id})
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
                            {t("templateDesigner.colField")}
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
                            {t("templateDesigner.colSrTemplate")}
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
                            {t("templateDesigner.colStatus")}
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
                            {t("templateDesigner.colActions")}
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
                                    <option value="">{t("templateDesigner.unmapped")}</option>
                                    {IHE_RR_TEMPLATES.map((sr) => (
                                      <option key={sr.id} value={sr.id}>
                                        {sr.id}
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
                                      ? t("templateDesigner.compliant")
                                      : t("templateDesigner.partial")}
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
                      {t("templateDesigner.addFieldFirst")}
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
                    {t("templateDesigner.srMappingNote")}
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
                      message.error(res.error?.message || t("templateDesigner.applyFailed"));
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
                <Check size={11} /> {t("templateDesigner.applyProps")}
              </button>
              <button
                onClick={() => {
                  if (confirm(t("templateDesigner.confirmDeleteField")))
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
                <Trash2 size={11} /> {t("templateDesigner.deleteField")}
              </button>
            </div>
          </div>
        )}
          </>
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
    <AppText size="xs" color="secondary" as="span" style={{ fontWeight: 600 }}>
      {label}:
    </AppText>
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
      <Info size={12} /> {t("templateDesigner.fieldProps")}
    </div>
    <PropRow label={t("templateDesigner.prop.displayLabel")}>
      <input
        type="text"
        value={field.fieldLabel}
        onChange={(e) => onChange({ fieldLabel: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.fieldKey")}>
      <input
        type="text"
        value={field.fieldKey}
        onChange={(e) =>
          onChange({ fieldKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })
        }
        style={{ ...inputStyle, width: "100%", fontFamily: "monospace" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.dataType")}>
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
    <PropRow label={t("templateDesigner.prop.section")}>
      <input
        type="text"
        value={field.fieldGroup}
        onChange={(e) => onChange({ fieldGroup: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.unit")}>
      <input
        type="text"
        value={field.unit || ""}
        onChange={(e) => onChange({ unit: e.target.value })}
        placeholder={t("templateDesigner.unitPlaceholder")}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.required")}>
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
        {t("templateDesigner.isRequired")}
      </label>
    </PropRow>
    {field.dataType === "number" && (
      <>
        <PropRow label={t("templateDesigner.prop.min")}>
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
        <PropRow label={t("templateDesigner.prop.max")}>
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
    <PropRow label={t("templateDesigner.prop.placeholder")}>
      <input
        type="text"
        value={field.placeholder || ""}
        onChange={(e) => onChange({ placeholder: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.category")}>
      <select
        value={field.category || ""}
        onChange={(e) => onChange({ category: e.target.value || undefined })}
        style={{ ...selectStyle, width: "100%" }}
      >
        <option value="">{t("templateDesigner.none")}</option>
        {PRESET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </PropRow>
    <PropRow label={t("templateDesigner.prop.dependsOn")}>
      <input
        type="text"
        value={field.dependsOn || ""}
        onChange={(e) => onChange({ dependsOn: e.target.value || undefined })}
        placeholder={t("templateDesigner.dependsOnPlaceholder")}
        style={{ ...inputStyle, width: "100%", fontFamily: "monospace" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.description")}>
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
      <PropRow label={t("templateDesigner.prop.options")}>
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
          placeholder={t("templateDesigner.optionsPlaceholder")}
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
      <Info size={12} /> {t("templateDesigner.sectionProps")}
    </div>
    <PropRow label={t("templateDesigner.prop.sectionName")}>
      <input
        type="text"
        value={section.name}
        onChange={(e) => onChange({ name: e.target.value })}
        style={{ ...inputStyle, width: "100%" }}
      />
    </PropRow>
    <PropRow label={t("templateDesigner.prop.themeColor")}>
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
    <PropRow label={t("templateDesigner.prop.order")}>
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
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1e40af" }}>{meta.name}</h2>
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
              ({section.fields.length} {t("templateDesigner.itemsUnit")})
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

// ═══════════════════════════════════════════════════════════════════
// [v3.0.6.11-99 Wave2B (模板设计器 P1)] 可视化模式主体
// 左: 变量面板 + 结构化字段面板 / 中: 段落块画布 (上移/下移/删除) / 右: 实时预览 ({{变量}} 高亮)
// ═══════════════════════════════════════════════════════════════════
const VARIABLE_PLACEHOLDER_RE = /(\{\{[^}]*\}\})/g;

const VisualDesignerBody: React.FC<{
  blocks: TemplateStructure;
  loading: boolean;
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
  onInsertBlock: (block: TemplateBlock, idx?: number | null) => void;
  onMoveBlock: (idx: number, dir: -1 | 1) => void;
  onRemoveBlock: (idx: number) => void;
  onChangeBlockContent: (idx: number, content: string) => void;
}> = ({
  blocks,
  loading,
  selectedIdx,
  onSelect,
  onInsertBlock,
  onMoveBlock,
  onRemoveBlock,
  onChangeBlockContent,
}) => {
  const content = blocks
    .map((b) => b.content)
    .filter((c) => c && c.trim() !== "")
    .join("\n");
  const varCount = (content.match(/[{}]\s*[\w\u4e00-\u9fa5]+\s*[{}]/g) || []).filter((m) => m.includes("{{")).length;

  return (
    <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>
      {/* 左: 变量面板 + 结构化字段面板 */}
      <div
        style={{
          width: 250,
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-color)",
            fontSize: 12,
            fontWeight: 700,
            color: "#0891b2",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Braces size={13} /> {t("templateDesigner.variablePanel")}
        </div>
        <div style={{ padding: 8, borderBottom: "1px solid var(--border-color)" }}>
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() =>
                onInsertBlock(
                  { type: "variable", content: `{{${v.key}}}`, variable: v.key },
                  selectedIdx,
                )
              }
              title={v.auto ? t("templateDesigner.autoFill") : t("templateDesigner.manualFill")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "5px 8px",
                marginBottom: 3,
                border: "1px solid #0891b260",
                borderRadius: 4,
                background: "var(--content-bg)",
                color: "var(--text-primary)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <code style={{ color: "#0891b2", fontSize: 12 }}>{"{{" + v.key + "}}"}</code>
              <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
                {v.label}
              </span>
            </button>
          ))}
        </div>
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-color)",
            fontSize: 12,
            fontWeight: 700,
            color: "#7c3aed",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Layers size={13} /> {t("templateDesigner.structuredFields")}
        </div>
        <div style={{ padding: 8 }}>
          {STRUCTURED_FIELD_PRESETS.map((f) => (
            <button
              key={f.fieldKey}
              onClick={() =>
                onInsertBlock(
                  {
                    type: "field",
                    content: `{{field:${f.fieldKey}}}`,
                    fieldKey: f.fieldKey,
                  },
                  selectedIdx,
                )
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "5px 8px",
                marginBottom: 3,
                border: `1px solid ${f.color}40`,
                borderRadius: 4,
                background: `${f.color}08`,
                color: "var(--text-primary)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: f.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600 }}>{f.label}</span>
              <span
                style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: 12 }}
              >
                {f.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 中: 段落块画布 */}
      <div
        style={{
          flex: 1,
          background: "var(--content-bg)",
          overflowY: "auto",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <AppText size="xs" weight={700} as="span" style={{ color: "#1e40af" }}>
            {t("templateDesigner.blockCanvas")} ({blocks.length})
          </AppText>
          <AppText size="xs" color="secondary" as="span">
            {t("templateDesigner.insertHint")}
          </AppText>
          <AppText size="xs" color="secondary" as="span" style={{ marginLeft: "auto" }}>
            {varCount} {t("templateDesigner.variablePlaceholders")}
          </AppText>
        </div>
        {loading && (
          <AppText size="xs" color="secondary" as="div" style={{ padding: 20 }}>
            {t("templateDesigner.loadingStructured")}
          </AppText>
        )}
        {blocks.map((block, idx) => {
          const selected = selectedIdx === idx;
          return (
            <div
              key={idx}
              onClick={() => onSelect(selected ? null : idx)}
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${selected ? "#7c3aed" : "var(--border-color)"}`,
                borderRadius: 6,
                marginBottom: 8,
                padding: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                {block.type === "text" && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "0 5px",
                      borderRadius: 3,
                      background: "#3b82f610",
                      color: "#3b82f6",
                      fontWeight: 600,
                    }}
                  >
                    {t("templateDesigner.blockText")}
                  </span>
                )}
                {block.type === "variable" && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "0 5px",
                      borderRadius: 3,
                      background: "#0891b210",
                      color: "#0891b2",
                      fontWeight: 600,
                    }}
                  >
                    {t("templateDesigner.blockVariable")} {block.variable && `· ${block.variable}`}
                  </span>
                )}
                {block.type === "field" && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "0 5px",
                      borderRadius: 3,
                      background: "#7c3aed10",
                      color: "#7c3aed",
                      fontWeight: 600,
                    }}
                  >
                    {t("templateDesigner.blockField")} {block.fieldKey && `· ${block.fieldKey}`}
                  </span>
                )}
                {block.type === "structured" && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "0 5px",
                      borderRadius: 3,
                      background: "#f59e0b15",
                      color: "#d97706",
                      fontWeight: 600,
                    }}
                  >
                    {t("templateDesigner.blockStructured")}
                  </span>
                )}
                <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveBlock(idx, -1);
                    }}
                    disabled={idx === 0}
                    title={t("templateDesigner.moveUp")}
                    style={blockBtnStyle}
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveBlock(idx, 1);
                    }}
                    disabled={idx === blocks.length - 1}
                    title={t("templateDesigner.moveDown")}
                    style={blockBtnStyle}
                  >
                    <ArrowDown size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBlock(idx);
                    }}
                    title={t("templateDesigner.deleteBlock")}
                    style={{ ...blockBtnStyle, color: "#dc2626" }}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>
              {block.type === "text" ? (
                <textarea
                  value={block.content}
                  onChange={(e) => onChangeBlockContent(idx, e.target.value)}
                  onFocus={() => onSelect(idx)}
                  rows={block.content.includes("\n") ? 3 : 2}
                  placeholder={t("templateDesigner.paragraphPlaceholder")}
                  style={{
                    width: "100%",
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    padding: "6px 8px",
                    fontSize: 12,
                    lineHeight: 1.6,
                    resize: "vertical",
                    outline: "none",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                />
              ) : (
                <code
                  style={{
                    display: "block",
                    padding: "6px 8px",
                    borderRadius: 4,
                    background: block.type === "field" ? "#7c3aed0d" : "#0891b20d",
                    color: block.type === "field" ? "#7c3aed" : "#0891b2",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                >
                  {block.content}
                </code>
              )}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => onInsertBlock({ type: "text", content: "" })}
            style={{
              padding: "6px 12px",
              border: "2px dashed var(--border-color)",
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
            <Plus size={12} /> {t("templateDesigner.addParagraph")}
          </button>
          {VISUAL_SECTION_PRESETS.map((s) => (
            <button
              key={s.name}
              onClick={() =>
                onInsertBlock({ type: "text", content: `${s.name}:` })
              }
              style={{
                padding: "6px 12px",
                border: `1px solid ${s.color}40`,
                borderRadius: 6,
                background: `${s.color}08`,
                color: s.color,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 右: 实时预览 */}
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
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-color)",
            fontSize: 12,
            fontWeight: 700,
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Eye size={13} /> {t("templateDesigner.livePreview")} {"{{变量}} 高亮"}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {content ? (
            <div
              style={{
                background: "var(--content-bg)",
                borderRadius: 6,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
                color: "var(--text-primary)",
              }}
            >
              {content.split(VARIABLE_PLACEHOLDER_RE).map((part, i) =>
                part.startsWith("{{") ? (
                  <mark
                    key={i}
                    style={{
                      background: "#10b98122",
                      color: "#0d9488",
                      borderRadius: 3,
                      padding: "0 3px",
                      fontWeight: 600,
                    }}
                  >
                    {part}
                  </mark>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                padding: 30,
                fontSize: 12,
              }}
            >
              <Eye size={28} style={{ color: "#cbd5e1", display: "block", margin: "0 auto 8px" }} />
              {t("templateDesigner.previewEmpty1")}
              <br />
              {t("templateDesigner.previewEmpty2")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const blockBtnStyle: React.CSSProperties = {
  padding: 2,
  border: "1px solid var(--border-color)",
  borderRadius: 3,
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};
