/**
 * [ClinicalConfig] 临床配置中心 - 阶段 3 admin UI
 * 范围: 只读 7 个模块的内容展示 (从 in-memory cache 读)
 * 阶段 3+ 后续: 编辑表单 + diff preview + 保存
 */
import React, { useState } from "react";
import { Card, Tabs, Table, Tag, Space, Typography, Empty, Statistic, Row, Col, Alert } from "antd";
import { Sliders, Database } from "lucide-react";
import { listModules, getConfig, getBootError, type ModuleKey } from "@/config/clinicalConfig/bootstrap";
import { PageContainer, PageHeader } from "@/components/common";

const { Text, Paragraph } = Typography;

/** 拿到一个模块的当前内容 (in-memory cache) */
function readModule(key: ModuleKey): unknown {
  try {
    const cache = getConfig();
    switch (key) {
      case "gradingScales": return cache.gradingScales;
      case "aiModels": return cache.aiModels;
      case "imagingDevices": return cache.imagingDevices;
      case "kpiThresholds": return cache.kpiThresholds;
      case "reportTemplates": return cache.reportTemplates;
      case "findingsLexicon": return cache.findingsLexicon;
      case "iolFormulas": return cache.iolFormulas;
      default: { const _: never = key; return undefined; }
    }
  } catch {
    return null;
  }
}

/** 模块概览：count + 几个示例 */
function summarize(key: ModuleKey, data: any): { count: number; sample: any } {
  if (!data) return { count: 0, sample: null };
  switch (key) {
    case "gradingScales": {
      const scales = data.scales ?? [];
      const meta = data.metadata ?? [];
      return { count: scales.length + meta.length, sample: { scales: scales.length, metadata: meta.length } };
    }
    case "aiModels": {
      const models = data.models ?? [];
      const diagnoses = data.diagnoses ?? [];
      return { count: models.length + diagnoses.length, sample: { models: models.length, diagnoses: diagnoses.length } };
    }
    case "imagingDevices": {
      const devices = data.devices ?? [];
      const byModality: Record<string, number> = {};
      devices.forEach((d: any) => { byModality[d.modality] = (byModality[d.modality] || 0) + 1; });
      return { count: devices.length, sample: byModality };
    }
    case "kpiThresholds": {
      const metrics = data.metrics ?? [];
      return { count: metrics.length, sample: { categories: [...new Set(metrics.map((m: any) => m.category))] } };
    }
    case "reportTemplates": {
      const templates = data.templates ?? [];
      return { count: templates.length, sample: { by_modality: templates.map((t: any) => `${t.modality}:${t.sections.length}s`) } };
    }
    case "findingsLexicon": {
      const entries = data.entries ?? [];
      const byCat: Record<string, number> = {};
      entries.forEach((e: any) => { byCat[e.category] = (byCat[e.category] || 0) + 1; });
      return { count: entries.length, sample: byCat };
    }
    case "iolFormulas": {
      const formulas = data.formulas ?? [];
      const bands = data.alBands ?? [];
      return { count: formulas.length + bands.length, sample: { formulas: formulas.length, alBands: bands.length, wangKochThreshold: data.wangKochThreshold } };
    }
    default: { const _: never = key; return { count: 0, sample: null }; }
  }
}

const ClinicalConfigCenter: React.FC = () => {
  const modules = listModules();
  const [activeKey, setActiveKey] = useState<ModuleKey>(modules[0]?.id as ModuleKey);
  const bootError = getBootError();

  // 当配置尚未加载完成或加载失败时,渲染占位/错误,不抛出
  if (bootError) {
    return (
      <PageContainer background="slate" maxWidth="full" padding={16} testId="clinical-config-center">
        <PageHeader
          title="临床配置中心"
          icon={<Sliders size={24} color="#ff4d4f" />}
          variant="inline"
        />
        <Alert
          type="error"
          showIcon
          title="Clinical Configuration 加载失败"
          description={bootError.message}
        />
      </PageContainer>
    );
  }

  const items = modules.map((m) => {
    const data = readModule(m.id as ModuleKey);
    const { count, sample } = summarize(m.id as ModuleKey, data);
    return {
      key: m.id,
      label: (
        <Space>
          <Tag color={m.category === "clinical" ? "blue" : m.category === "device" ? "purple" : m.category === "operational" ? "green" : m.category === "reporting" ? "orange" : "default"}>
            {m.category}
          </Tag>
          {m.label}
        </Space>
      ),
      children: (
        <Card>
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="条目数" value={count} suffix="项" />
              </Col>
              <Col span={8}>
                <Statistic title="Schema 版本" value={m.schemaVersion} />
              </Col>
              <Col span={8}>
                <Statistic title="分类" value={m.category} />
              </Col>
            </Row>

            <Alert
              type="info"
              showIcon
              title={m.description}
              description={<Text code style={{ fontSize: 12 }}>{m.defaultPath}</Text>}
            />

            {data === null ? (
              <Empty description="此模块暂未加载,请等待启动加载完成" />
            ) : sample !== null && sample !== undefined ? (
              <Card size="small" title="摘要 (sample)">
                <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 4, overflow: "auto", maxHeight: 240 }}>
                  {JSON.stringify(sample, null, 2)}
                </pre>
              </Card>
            ) : <Empty description="无数据" />}

            <Card size="small" title="完整 JSON (只读)">
              <pre style={{ background: "#fafafa", padding: 12, borderRadius: 4, overflow: "auto", maxHeight: 480, fontSize: 12 }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </Card>
          </Space>
        </Card>
      ),
    };
  });

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="clinical-config-center">
      <PageHeader
        title="临床配置中心"
        icon={<Sliders size={24} color="#1677ff" />}
        variant="inline"
        actions={
          <Tag color="blue">
            <Database size={12} style={{ marginRight: 4 }} />
            {modules.length} 个模块
          </Tag>
        }
      />
      <Alert
        type="warning"
        showIcon
        title="阶段 3 admin UI - 只读"
        description="当前只读视图显示 7 个临床配置模块的当前内容。后续阶段会加入编辑表单 + diff preview + 保存。修改任一 JSON 需重新启动 dev server (阶段 5 HMR)。"
        style={{ marginBottom: 12 }}
      />
      <Tabs activeKey={activeKey} onChange={(k) => setActiveKey(k as ModuleKey)} items={items} />
    </PageContainer>
  );
};

export default ClinicalConfigCenter;