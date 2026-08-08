/**
 * [ClinicalConfig] 临床配置中心 - 阶段 3 admin UI (W3-B 持久化)
 * - 加载时 GET /system/clinical-config: 有则用, 无则本地默认并 seed 到后端
 * - 每模块 JSON 编辑 + 保存 (PUT /system/clinical-config/:module)
 * - 保留摘要 (summary) 只读展示
 */
import React, { useEffect, useMemo, useState } from "react";
import { Card, Tabs, Tag, Space, Typography, Empty, Statistic, Row, Col, Alert, Button, Input, Spin, message } from 'antd';
import { Sliders, Database, Save, RotateCcw, CloudDownload } from "lucide-react";
import { listModules, getConfig, getBootError, type ModuleKey } from "@/config/clinicalConfig/bootstrap";
import { clinicalConfigApi } from "@/services/api/systemApi";
import { PageContainer, PageHeader } from "@/components/common";

const { Text } = Typography;

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
    default: { return { count: 0, sample: null }; }
  }
}

const ClinicalConfigCenter: React.FC = () => {
  const modules = listModules();
  const [activeKey, setActiveKey] = useState<ModuleKey>(modules[0]?.id as ModuleKey);
  const bootError = getBootError();
  // undefined = 加载中; null = 后端无配置且 seed 失败
  const [serverConfig, setServerConfig] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // 本地 in-memory cache (启动 bootstrap 已加载)
  const localCache = useMemo(() => {
    try { return getConfig() as unknown as Record<string, unknown>; } catch { return null; }
  }, []);

  const merged = useMemo(() => ({ ...(localCache ?? {}), ...(serverConfig ?? {}) }), [localCache, serverConfig]);
  const serverSynced = serverConfig !== undefined && serverConfig !== null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await clinicalConfigApi.get();
      if (cancelled) return;
      if (res.success && res.data?.modules && typeof res.data.modules === "object") {
        setServerConfig(res.data.modules);
        return;
      }
      if (res.success && localCache) {
        // [W3-B] 后端无配置: 前端先 POST 本地默认值 seed, 保证后续 GET 有值
        const seed = await clinicalConfigApi.saveAll(localCache);
        if (cancelled) return;
        if (seed.success && seed.data?.modules && typeof seed.data.modules === "object") {
          setServerConfig(seed.data.modules);
        } else {
          setServerConfig(localCache);
          message.warning(seed.error?.message ?? "后端不可写, 当前展示本地默认值");
        }
        return;
      }
      setServerConfig(null);
      if (!res.success) message.error(res.error?.message ?? "加载临床配置失败");
    })();
    return () => { cancelled = true; };
  }, [localCache]);

  // 切换 tab 时初始化 draft (仅一次)
  useEffect(() => {
    const data = merged[activeKey];
    if (data === undefined) return;
    setDrafts((prev) =>
      prev[activeKey] === undefined ? { ...prev, [activeKey]: JSON.stringify(data, null, 2) } : prev,
    );
  }, [activeKey, merged]);

  const handleSave = async (key: ModuleKey) => {
    const draft = drafts[key];
    if (draft === undefined) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      message.error("JSON 格式错误, 无法保存: " + ((e as Error)?.message ?? String(e)));
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      message.error("模块内容必须是 JSON 对象");
      return;
    }
    setSavingKey(key);
    const res = await clinicalConfigApi.saveModule(key, parsed);
    setSavingKey(null);
    if (res.success) {
      setServerConfig((prev) => ({ ...(prev ?? {}), [key]: parsed }));
      message.success(`模块 "${key}" 已保存到后端`);
    } else {
      message.error(res.error?.message ?? `保存失败 (${key})`);
    }
  };

  const handleReset = (key: ModuleKey) => {
    const data = merged[key];
    setDrafts((prev) => ({ ...prev, [key]: JSON.stringify(data, null, 2) }));
  };

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
          title="临床配置加载失败"
          description={bootError.message}
        />
      </PageContainer>
    );
  }

  const items = modules.map((m) => {
    const data = merged[m.id as ModuleKey];
    const { count, sample } = summarize(m.id as ModuleKey, data);
    const draft = drafts[m.id as ModuleKey];
    const saving = savingKey === m.id;
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
                <Statistic title="模式版本" value={m.schemaVersion} />
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

            {serverConfig === undefined ? (
              <Spin tip="正在从后端加载配置…" style={{ display: "block", padding: 24 }}>
                <Empty description="加载中" />
              </Spin>
            ) : (
              <>
                {data === null ? (
                  <Empty description="此模块暂未加载,请等待启动加载完成" />
                ) : sample !== null && sample !== undefined ? (
                  <Card size="small" title="摘要 (示例)">
                    <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 4, overflow: "auto", maxHeight: 240 }}>
                      {JSON.stringify(sample, null, 2)}
                    </pre>
                  </Card>
                ) : <Empty description="无数据" />}

                <Card
                  size="small"
                  title={
                    <Space>
                      <span>完整 JSON (可编辑)</span>
                      {serverSynced ? (
                        <Tag color="green" icon={<CloudDownload size={12} />}>已保存到后端</Tag>
                      ) : (
                        <Tag color="orange">本地默认 (后端未保存)</Tag>
                      )}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        size="small"
                        icon={<RotateCcw size={12} />}
                        onClick={() => handleReset(m.id as ModuleKey)}
                      >
                        重置
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<Save size={12} />}
                        loading={saving}
                        onClick={() => handleSave(m.id as ModuleKey)}
                      >
                        保存
                      </Button>
                    </Space>
                  }
                >
                  <Input.TextArea
                    value={draft}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    rows={14}
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                    aria-label={`${m.label} JSON 编辑`}
                  />
                </Card>
              </>
            )}
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
          <Space>
            {serverConfig === undefined ? <Spin size="small" /> : null}
            <Tag color={serverSynced ? "green" : "orange"}>
              <Database size={12} style={{ marginRight: 4 }} />
              {serverSynced ? "后端已持久化" : "本地默认"}
            </Tag>
            <Tag color="blue">
              {modules.length} 个模块
            </Tag>
          </Space>
        }
      />
      <Alert
        type="info"
        showIcon
        title="阶段 3 管理界面 - 后端持久化"
        description="编辑 JSON 后点击「保存」即写入后端 SystemConfig (key=clinical_config); 重启/刷新后仍保留。保存前请确认 JSON 结构符合模块 schema。"
        style={{ marginBottom: 12 }}
      />
      <Tabs activeKey={activeKey} onChange={(k) => setActiveKey(k as ModuleKey)} items={items} />
    </PageContainer>
  );
};

export default ClinicalConfigCenter;
