// [G005 W3] AI 定量分析中心 (概念 UI, 确定性模拟输出)
// 所有结果由 quantEngine 基于 studyId 的种子生成, 刷新后保持一致。
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Tag,
} from "antd";
import {
  Bone,
  Brain,
  Cpu,
  Download,
  HeartPulse,
  RefreshCw,
  Scan,
  Sparkles,
  Stethoscope,
  Activity,
} from "lucide-react";
import { t, getCurrentLocale } from "../../i18n/appI18n";
import {
  QUANT_CATEGORIES,
  QUANT_STUDY_OPTIONS,
  type BodyCompositionResult,
  type BoneAgeResult,
  type BreastResult,
  type CarotidResult,
  type CoronaryResult,
  type CtrResult,
  type LiverResult,
  type NoduleResult,
  type QuantCategoryId,
  type QuantResult,
  type SpineQctResult,
  type StenosisSeverity,
  type StrokeResult,
} from "../../services/ai/quantEngine";
import { DataTable } from "../../components/common";

const isEn = (): boolean => getCurrentLocale() === "en-US";

/** 数据名称的中英切换 (引擎返回双语字段) */
const pick = (zh: string, en: string): string => (isEn() ? en : zh);

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const severityColor: Record<StenosisSeverity, string> = {
  normal: "#52c41a",
  mild: "#faad14",
  moderate: "#fa8c16",
  severe: "#f5222d",
  occlusion: "#a8071a",
};

const categoryIcon: Record<QuantCategoryId, React.ReactNode> = {
  cardiac: <HeartPulse size={16} />,
  neuro: <Brain size={16} />,
  abdomen: <Stethoscope size={16} />,
  musculoskeletal: <Bone size={16} />,
  chest: <Scan size={16} />,
  breast: <Activity size={16} />,
  body: <Cpu size={16} />,
};

function severityKey(s: StenosisSeverity): string {
  return `w3quant.severity.${s}`;
}

function patencyKey(p: "patent" | "stenosis" | "occluded"): string {
  return `w3quant.patency.${p}`;
}

const patencyColor: Record<"patent" | "stenosis" | "occluded", string> = {
  patent: "green",
  stenosis: "orange",
  occluded: "red",
};

/* ---------------------------------- 基础展示组件 ---------------------------------- */

const MetricCard: React.FC<{
  title: string;
  value: React.ReactNode;
  unit?: string;
  tone?: string;
  hint?: string;
}> = ({ title, value, unit, tone, hint }) => (
  <Card size="small" style={{ height: "100%" }}>
    <div style={{ fontSize: 12, color: "#8c8c8c" }}>{title}</div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.3,
        color: tone ?? "#1f1f1f",
      }}
    >
      {value}
      {unit ? (
        <span style={{ fontSize: 12, marginLeft: 4, color: "#8c8c8c" }}>
          {unit}
        </span>
      ) : null}
    </div>
    {hint ? (
      <div style={{ fontSize: 11, color: "#bfbfbf" }}>{hint}</div>
    ) : null}
  </Card>
);

const HeatBar: React.FC<{
  value: number;
  max?: number;
  color: string;
  height?: number;
}> = ({ value, max = 100, color, height = 12 }) => {
  const pct = clamp(Math.round((value / max) * 100), 0, 100);
  return (
    <div
      style={{
        background: "var(--bg-primary, #f8fafc)",
        borderRadius: 6,
        overflow: "hidden",
        height,
        width: "100%",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
};

const SectionTitle: React.FC<{ icon?: React.ReactNode; text: string }> = ({
  icon,
  text,
}) => (
  <Space size={6} style={{ marginBottom: 8 }}>
    {icon}
    <span style={{ fontWeight: 600 }}>{text}</span>
  </Space>
);

/* ---------------------------------- 各分析结果面板 ---------------------------------- */

const CoronaryPanel: React.FC<{ r: CoronaryResult }> = ({ r }) => {
  const culprit = r.segments.find((s) => s.id === r.culpritSegmentId);
  const ranked = [...r.segments].sort((a, b) => b.stenosis - a.stenosis);
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <SectionTitle icon={<HeartPulse size={15} color="#2563eb" />} text={t("w3quant.coronary.title")} />
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={6}>
            <MetricCard
              title={t("w3quant.coronary.agatston")}
              value={r.agatstonTotal}
              tone={r.agatstonTotal > 400 ? "#f5222d" : r.agatstonTotal > 100 ? "#fa8c16" : "#52c41a"}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricCard
              title="CAD-RADS"
              value={r.cadRads}
              tone={r.cadRads >= 4 ? "#f5222d" : r.cadRads === 3 ? "#fa8c16" : "#2563eb"}
              hint={pick("分级 0-5", "Category 0-5")}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricCard
              title={t("w3quant.coronary.ffr")}
              value={r.ffrCtLowest.toFixed(2)}
              tone={r.ffrCtLowest < 0.8 ? "#f5222d" : "#52c41a"}
              hint={r.ffrCtLowest < 0.8 ? pick("血流动力学显著", "Hemodynamically significant") : pick("未见缺血", "No ischemia")}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <MetricCard
              title={t("w3quant.coronary.culprit")}
              value={culprit ? pick(culprit.name, culprit.nameEn) : t("w3quant.coronary.none")}
              hint={culprit ? `${culprit.stenosis}% · ${pick("重构指数", "Remodeling")} ${culprit.remodelingIndex}` : ""}
              tone="#722ed1"
            />
          </Col>
        </Row>
      </div>

      <Card size="small" title={t("w3quant.coronary.vessels")}>
        <DataTable
          rowKey="vessel"
          pagination={false}
          dataSource={r.vessels}
          columns={[
            {
              title: t("w3quant.col.vessel"),
              dataIndex: "name",
              key: "name",
              render: (_: unknown, v: CoronaryResult["vessels"][number]) => pick(v.name, v.nameEn),
            },
            {
              title: t("w3quant.col.agatston"),
              dataIndex: "agatston",
              key: "agatston",
              render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
            },
            {
              title: t("w3quant.col.stenosis"),
              dataIndex: "maxStenosis",
              key: "maxStenosis",
              render: (v: number) => (
                <Space size={8} style={{ width: 160 }}>
                  <span style={{ width: 34, display: "inline-block" }}>{v}%</span>
                  <HeatBar value={v} color={severityColor[severityOf(v)]} />
                </Space>
              ),
            },
            {
              title: t("w3quant.col.ffr"),
              dataIndex: "ffrCt",
              key: "ffrCt",
              render: (v: number) => (
                <Tag color={v < 0.8 ? "red" : "green"}>{v.toFixed(2)}</Tag>
              ),
            },
          ]}
        />
      </Card>

      <Card size="small" title={t("w3quant.coronary.segments")}>
        <DataTable
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={r.segments}
          columns={[
            {
              title: t("w3quant.col.vessel"),
              dataIndex: "vessel",
              key: "vessel",
              render: (v: string) => v,
            },
            {
              title: t("w3quant.col.segment"),
              key: "segment",
              render: (_: unknown, s: CoronaryResult["segments"][number]) => pick(s.name, s.nameEn),
            },
            {
              title: t("w3quant.col.stenosis"),
              dataIndex: "stenosis",
              key: "stenosis",
              render: (v: number) => <span style={{ fontWeight: 600 }}>{v}%</span>,
            },
            {
              title: t("w3quant.col.severity"),
              dataIndex: "severity",
              key: "severity",
              render: (v: StenosisSeverity) => (
                <Tag color={severityColor[v]}>{t(severityKey(v))}</Tag>
              ),
            },
            {
              title: t("w3quant.col.plaque"),
              key: "plaque",
              render: (_: unknown, s: CoronaryResult["segments"][number]) =>
                s.stenosis > 0
                  ? `${s.plaque.calcified} / ${s.plaque.nonCalcified} / ${s.plaque.lowAttenuation} / ${s.plaque.fibrous}`
                  : "-",
            },
            {
              title: t("w3quant.col.lesionLength"),
              dataIndex: "lesionLengthMm",
              key: "lesionLengthMm",
              render: (v: number) => (v > 0 ? v : "-"),
            },
            {
              title: t("w3quant.col.remodeling"),
              dataIndex: "remodelingIndex",
              key: "remodelingIndex",
              render: (v: number) => (v > 0 ? v : "-"),
            },
          ]}
        />
      </Card>

      <Card size="small" title={t("w3quant.coronary.heat")}>
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          {ranked.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 150, fontSize: 12, color: "#595959" }}>
                {pick(s.name, s.nameEn)}
              </span>
              <div style={{ flex: 1 }}>
                <HeatBar value={s.stenosis} color={severityColor[s.severity]} />
              </div>
              <span style={{ width: 46, textAlign: "right", fontSize: 12 }}>
                {s.stenosis}%
              </span>
            </div>
          ))}
        </Space>
      </Card>
    </Space>
  );
};

function severityOf(v: number): StenosisSeverity {
  if (v <= 0) return "normal";
  if (v < 50) return "mild";
  if (v < 70) return "moderate";
  if (v < 100) return "severe";
  return "occlusion";
}

const StrokePanel: React.FC<{ r: StrokeResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <div>
      <SectionTitle icon={<Brain size={15} color="#2563eb" />} text={t("w3quant.stroke.title")} />
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={6}>
          <MetricCard
            title={t("w3quant.stroke.aspectsTotal")}
            value={r.aspectsTotal}
            unit="/ 10"
            tone={r.aspectsTotal <= 6 ? "#f5222d" : r.aspectsTotal <= 8 ? "#fa8c16" : "#52c41a"}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.stroke.collateral")} value={r.collateralScore} unit="0-3" tone="#2563eb" />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.stroke.core")} value={r.coreVolumeMl} unit="mL" tone={r.coreVolumeMl > 70 ? "#f5222d" : "#1f1f1f"} />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard
            title={t("w3quant.stroke.penumbra")}
            value={r.penumbraVolumeMl}
            unit="mL"
            hint={`${pick("不匹配比", "Mismatch")} ${r.mismatchRatio}`}
            tone="#fa8c16"
          />
        </Col>
      </Row>
    </div>
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={8}>
        <MetricCard
          title={t("w3quant.stroke.lvo")}
          value={r.lvo.present ? pick(r.lvo.site, r.lvo.siteEn) : t("w3quant.stroke.noLvo")}
          tone={r.lvo.present ? "#f5222d" : "#52c41a"}
          hint={`${t("w3quant.confidence")} ${r.lvo.confidence}%`}
        />
      </Col>
      <Col xs={12} sm={8}>
        <MetricCard title={t("w3quant.stroke.window")} value={r.treatmentWindow} tone="#2563eb" />
      </Col>
      <Col xs={12} sm={8}>
        <MetricCard
          title={t("w3quant.stroke.ich")}
          value={r.ich ? pick(r.ichSubtype, r.ichSubtypeEn) : t("w3quant.stroke.noIch")}
          tone={r.ich ? "#f5222d" : "#52c41a"}
        />
      </Col>
    </Row>
    <Card size="small" title={t("w3quant.stroke.aspects")}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
        }}
      >
        {r.aspects.map((a) => (
          <div
            key={a.key}
            style={{
              border: `1px solid ${a.involved ? "#ffa39e" : "#b7eb8f"}`,
              background: a.involved ? "#fff1f0" : "#f6ffed",
              borderRadius: 8,
              padding: "8px 6px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, color: a.involved ? "#cf1322" : "#389e0d" }}>
              {a.key}
            </div>
            <div style={{ fontSize: 11, color: "#595959" }}>{pick(a.name, a.nameEn)}</div>
            <Tag
              style={{ marginTop: 4, marginInlineEnd: 0 }}
              color={a.involved ? "red" : "green"}
            >
              {a.involved ? t("w3quant.aspects.involved") : t("w3quant.aspects.spared")}
            </Tag>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <HeatBar
          value={r.aspectsTotal}
          max={10}
          height={14}
          color={r.aspectsTotal <= 6 ? severityColor.severe : r.aspectsTotal <= 8 ? severityColor.mild : severityColor.normal}
        />
      </div>
    </Card>
  </Space>
);

const CarotidPanel: React.FC<{ r: CarotidResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <div>
      <SectionTitle icon={<Brain size={15} color="#2563eb" />} text={t("w3quant.carotid.title")} />
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8}>
          <MetricCard title={t("w3quant.carotid.maxStenosis")} value={r.maxStenosis} unit="%" tone={r.maxStenosis >= 70 ? "#f5222d" : "#1f1f1f"} />
        </Col>
        <Col xs={12} sm={8}>
          <MetricCard
            title={t("w3quant.carotid.dissection")}
            value={r.dissectionDetected ? t("w3quant.carotid.dissectionYes") : t("w3quant.carotid.dissectionNo")}
            tone={r.dissectionDetected ? "#f5222d" : "#52c41a"}
          />
        </Col>
      </Row>
    </div>
    <Card size="small" title={t("w3quant.carotid.willis")}>
      <DataTable
        rowKey="id"
        pagination={false}
        dataSource={r.vessels}
        columns={[
          {
            title: t("w3quant.col.vessel"),
            key: "vessel",
            render: (_: unknown, v: CarotidResult["vessels"][number]) => pick(v.name, v.nameEn),
          },
          {
            title: t("w3quant.col.stenosis"),
            dataIndex: "stenosis",
            key: "stenosis",
            render: (v: number) => (
              <Space size={8} style={{ width: 150 }}>
                <span style={{ width: 34, display: "inline-block" }}>{v}%</span>
                <HeatBar value={v} color={severityColor[severityOf(v)]} />
              </Space>
            ),
          },
          {
            title: t("w3quant.col.patency"),
            dataIndex: "patency",
            key: "patency",
            render: (v: "patent" | "stenosis" | "occluded") => (
              <Tag color={patencyColor[v]}>{t(patencyKey(v))}</Tag>
            ),
          },
          {
            title: t("w3quant.col.dissection"),
            dataIndex: "dissection",
            key: "dissection",
            render: (v: boolean) =>
              v ? <Tag color="red">{t("w3quant.yes")}</Tag> : <Tag>{t("w3quant.no")}</Tag>,
          },
        ]}
      />
    </Card>
  </Space>
);

const LiverPanel: React.FC<{ r: LiverResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <div>
      <SectionTitle icon={<Stethoscope size={15} color="#2563eb" />} text={t("w3quant.liver.title")} />
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.liver.totalVolume")} value={r.totalVolumeMl} unit="mL" tone="#2563eb" />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard
            title={t("w3quant.liver.fatFraction")}
            value={r.fatFractionPct}
            unit="%"
            tone={r.steatosisGrade >= 2 ? "#f5222d" : r.steatosisGrade === 1 ? "#fa8c16" : "#52c41a"}
            hint={pick(r.steatosisLabel, r.steatosisLabelEn)}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.liver.ironR2")} value={r.ironR2Star} unit="s⁻¹" tone="#722ed1" hint={`T2* ${r.ironT2StarMs} ms`} />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard
            title={t("w3quant.liver.liRads")}
            value={r.observation.present ? r.observation.category : "-"}
            tone={r.observation.present ? "#f5222d" : "#52c41a"}
            hint={r.observation.present ? `${r.observation.sizeMm} mm · ${pick(r.observation.segment, r.observation.segmentEn)}` : pick("未见占位", "No lesion")}
          />
        </Col>
      </Row>
    </div>
    {r.observation.present ? (
      <Alert
        type="warning"
        showIcon
        title={`${t("w3quant.liver.liRadsCategory")}: ${r.observation.category}`}
        description={`${t("w3quant.liver.liRadsSize")}: ${r.observation.sizeMm} mm · ${t("w3quant.liver.liRadsSegment")}: ${pick(r.observation.segment, r.observation.segmentEn)} · ${t("w3quant.liver.liRadsPattern")}: ${pick(r.observation.pattern, r.observation.patternEn)}`}
      />
    ) : null}
    <Card size="small" title={t("w3quant.liver.segments")}>
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        {r.segments.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 150, fontSize: 12, color: "#595959" }}>{pick(s.name, s.nameEn)}</span>
            <div style={{ flex: 1 }}>
              <HeatBar value={s.volumeMl} max={Math.max(...r.segments.map((x) => x.volumeMl))} color="#597ef7" />
            </div>
            <span style={{ width: 70, textAlign: "right", fontSize: 12 }}>{s.volumeMl} mL</span>
          </div>
        ))}
      </Space>
    </Card>
  </Space>
);

const BoneAgePanel: React.FC<{ r: BoneAgeResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <SectionTitle icon={<Bone size={15} color="#2563eb" />} text={t("w3quant.boneAge.title")} />
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.boneAge.boneAge")} value={r.boneAgeYears} unit="岁" tone="#2563eb" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.boneAge.chrono")} value={r.chronologicAgeYears} unit="岁" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard
          title={t("w3quant.boneAge.delta")}
          value={`${r.deltaYears > 0 ? "+" : ""}${r.deltaYears}`}
          unit="岁"
          tone={Math.abs(r.deltaYears) > 1 ? "#fa8c16" : "#52c41a"}
          hint={pick(r.interpretation, r.interpretationEn)}
        />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.boneAge.maturity")} value={r.maturityScore} unit="/ 100" tone="#722ed1" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.boneAge.gp")} value={r.gpEstimate} unit="岁" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.boneAge.tw3")} value={r.tw3Estimate} unit="岁" />
      </Col>
    </Row>
  </Space>
);

const NodulePanel: React.FC<{ r: NoduleResult }> = ({ r }) => {
  const maxVol = Math.max(1, ...r.nodules.map((n) => n.volumeMm3));
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <SectionTitle icon={<Scan size={15} color="#2563eb" />} text={t("w3quant.nodule.title")} />
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8}>
            <MetricCard title={t("w3quant.nodule.count")} value={r.noduleCount} tone="#2563eb" />
          </Col>
          <Col xs={12} sm={8}>
            <MetricCard
              title={t("w3quant.nodule.maxRads")}
              value={`Lung-RADS ${r.maxLungRads}`}
              tone={r.maxLungRads.startsWith("4") ? "#f5222d" : r.maxLungRads === "3" ? "#fa8c16" : "#52c41a"}
            />
          </Col>
        </Row>
      </div>
      <Card size="small" title={t("w3quant.nodule.timeline")}>
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          {r.nodules.map((n) => (
            <div key={n.id}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#595959" }}>
                <span>
                  {n.id} · {pick(n.lobe, n.lobeEn)} · {pick(n.densityLabel, n.densityLabelEn)} · {n.diameterMm} mm
                </span>
                <span>
                  {n.vdtDays == null
                    ? t("w3quant.nodule.vdtStable")
                    : `VDT ${n.vdtDays} ${t("w3quant.unit.days")}`}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <HeatBar value={n.volumeMm3} max={maxVol} color={n.density === "ggo" ? "#85a5ff" : n.density === "part-solid" ? "#ffc069" : "#ff7875"} />
              </div>
            </div>
          ))}
        </Space>
      </Card>
      <Card size="small" title={t("w3quant.nodule.list")}>
        <DataTable
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={r.nodules}
          columns={[
            { title: "ID", dataIndex: "id", key: "id" },
            {
              title: t("w3quant.col.lobe"),
              key: "lobe",
              render: (_: unknown, n: NoduleResult["nodules"][number]) => pick(n.lobe, n.lobeEn),
            },
            { title: t("w3quant.col.diameter"), dataIndex: "diameterMm", key: "diameterMm" },
            { title: t("w3quant.col.volume"), dataIndex: "volumeMm3", key: "volumeMm3" },
            {
              title: t("w3quant.col.density"),
              key: "density",
              render: (_: unknown, n: NoduleResult["nodules"][number]) => pick(n.densityLabel, n.densityLabelEn),
            },
            {
              title: t("w3quant.col.vdt"),
              key: "vdt",
              render: (_: unknown, n: NoduleResult["nodules"][number]) =>
                n.vdtDays == null ? t("w3quant.nodule.vdtStable") : `${n.vdtDays} ${t("w3quant.unit.days")}`,
            },
            {
              title: t("w3quant.col.lungRads"),
              dataIndex: "lungRads",
              key: "lungRads",
              render: (v: string) => (
                <Tag color={v.startsWith("4") ? "red" : v === "3" ? "orange" : "green"}>{v}</Tag>
              ),
            },
            {
              title: t("w3quant.col.malignancy"),
              dataIndex: "malignancyRiskPct",
              key: "malignancyRiskPct",
              render: (v: number) => `${v}%`,
            },
            {
              title: t("w3quant.col.followUp"),
              key: "followUp",
              render: (_: unknown, n: NoduleResult["nodules"][number]) => pick(n.followUp, n.followUpEn),
            },
          ]}
        />
      </Card>
    </Space>
  );
};

const BreastPanel: React.FC<{ r: BreastResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <div>
      <SectionTitle icon={<Activity size={15} color="#2563eb" />} text={t("w3quant.breast.title")} />
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={6}>
          <MetricCard
            title={t("w3quant.breast.density")}
            value={`${pick("型", "Type")} ${r.densityCategory}`}
            tone={r.densityCategory === "D" ? "#f5222d" : r.densityCategory === "C" ? "#fa8c16" : "#52c41a"}
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.breast.fibroglandular")} value={r.fibroglandularPct} unit="%" tone="#2563eb" />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.breast.leftPct")} value={r.leftVolumetricPct} unit="%" />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <MetricCard title={t("w3quant.breast.rightPct")} value={r.rightVolumetricPct} unit="%" />
        </Col>
      </Row>
    </div>
    <Card size="small" title={t("w3quant.breast.lesions")}>
      {r.lesions.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("w3quant.breast.noLesions")} />
      ) : (
        <DataTable
          rowKey="id"
          pagination={false}
          dataSource={r.lesions}
          columns={[
            {
              title: t("w3quant.col.side"),
              key: "side",
              render: (_: unknown, l: BreastResult["lesions"][number]) => pick(l.sideLabel, l.sideLabelEn),
            },
            {
              title: t("w3quant.col.quadrant"),
              key: "quadrant",
              render: (_: unknown, l: BreastResult["lesions"][number]) => pick(l.quadrant, l.quadrantEn),
            },
            {
              title: t("w3quant.col.kind"),
              key: "kind",
              render: (_: unknown, l: BreastResult["lesions"][number]) => pick(l.kind, l.kindEn),
            },
            { title: t("w3quant.col.size"), dataIndex: "sizeMm", key: "sizeMm" },
            {
              title: t("w3quant.col.biRads"),
              dataIndex: "biRads",
              key: "biRads",
              render: (v: string) => (
                <Tag color={v.startsWith("5") || v.startsWith("4") ? "red" : v === "3" ? "orange" : "green"}>
                  {`BI-RADS ${v}`}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </Card>
  </Space>
);

const CtrPanel: React.FC<{ r: CtrResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <SectionTitle icon={<HeartPulse size={15} color="#2563eb" />} text={t("w3quant.ctr.title")} />
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={8}>
        <MetricCard
          title={t("w3quant.ctr.ratio")}
          value={r.ctr.toFixed(2)}
          tone={r.cardiomegaly ? "#f5222d" : "#52c41a"}
          hint={r.cardiomegaly ? t("w3quant.ctr.cardiomegaly") : ""}
        />
      </Col>
      <Col xs={12} sm={8}>
        <MetricCard title={t("w3quant.ctr.cardiacWidth")} value={r.cardiacWidthMm} unit="mm" />
      </Col>
      <Col xs={12} sm={8}>
        <MetricCard title={t("w3quant.ctr.thoracicWidth")} value={r.thoracicWidthMm} unit="mm" />
      </Col>
    </Row>
    <HeatBar value={r.ctr * 100} max={70} color={r.cardiomegaly ? "#f5222d" : "#2563eb"} height={18} />
    <div style={{ fontSize: 12, color: "#8c8c8c" }}>
      {pick("参考阈值: 心胸比 > 0.50 提示心脏增大", "Threshold: CTR > 0.50 suggests cardiomegaly")}
    </div>
  </Space>
);

const SpineQctPanel: React.FC<{ r: SpineQctResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <div>
      <SectionTitle icon={<Bone size={15} color="#2563eb" />} text={t("w3quant.spine.title")} />
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8}>
          <MetricCard
            title={t("w3quant.spine.meanT")}
            value={r.meanTScore}
            tone={r.meanTScore <= -2.5 ? "#f5222d" : r.meanTScore <= -1 ? "#fa8c16" : "#52c41a"}
          />
        </Col>
        <Col xs={12} sm={8}>
          <MetricCard
            title={t("w3quant.spine.osteoporosis")}
            value={r.osteoporosis ? t("w3quant.yes") : t("w3quant.no")}
            tone={r.osteoporosis ? "#f5222d" : "#52c41a"}
          />
        </Col>
      </Row>
    </div>
    <Card size="small" title={t("w3quant.spine.levels")}>
      <DataTable
        rowKey="level"
        pagination={false}
        dataSource={r.levels}
        columns={[
          { title: t("w3quant.col.level"), dataIndex: "level", key: "level" },
          { title: t("w3quant.col.bmd"), dataIndex: "bmdMgCm3", key: "bmdMgCm3" },
          {
            title: t("w3quant.col.tScore"),
            dataIndex: "tScore",
            key: "tScore",
            render: (v: number) => (
              <Tag color={v <= -2.5 ? "red" : v <= -1 ? "orange" : "green"}>{v}</Tag>
            ),
          },
          {
            title: t("w3quant.col.zScore"),
            dataIndex: "zScore",
            key: "zScore",
            render: (v: number) => v,
          },
          {
            title: t("w3quant.col.genant"),
            dataIndex: "genantGrade",
            key: "genantGrade",
            render: (v: number) => (v > 0 ? <Tag color="orange">{v}</Tag> : "0"),
          },
        ]}
      />
    </Card>
  </Space>
);

const BodyPanel: React.FC<{ r: BodyCompositionResult }> = ({ r }) => (
  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
    <SectionTitle icon={<Cpu size={15} color="#2563eb" />} text={t("w3quant.body.title")} />
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={8} md={6}>
        <MetricCard
          title={t("w3quant.body.sex")}
          value={r.sex === "male" ? t("w3quant.body.male") : t("w3quant.body.female")}
          hint={`${pick("身高", "Height")} ${r.heightM} m`}
        />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard
          title={t("w3quant.body.smi")}
          value={r.smi}
          unit="cm²/m²"
          tone={r.sarcopenia ? "#f5222d" : "#52c41a"}
          hint={`${pick("骨骼肌面积", "Muscle area")} ${r.muscleAreaCm2} cm²`}
        />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.body.visceralFat")} value={r.visceralFatCm2} unit="cm²" tone="#fa8c16" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.body.subcutaneousFat")} value={r.subcutaneousFatCm2} unit="cm²" tone="#722ed1" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard title={t("w3quant.body.fatFraction")} value={r.fatFractionPct} unit="%" />
      </Col>
      <Col xs={12} sm={8} md={6}>
        <MetricCard
          title={t("w3quant.body.sarcopenia")}
          value={r.sarcopenia ? t("w3quant.yes") : t("w3quant.no")}
          tone={r.sarcopenia ? "#f5222d" : "#52c41a"}
        />
      </Col>
    </Row>
  </Space>
);

function ResultPanel({ result }: { result: QuantResult }): React.ReactElement {
  switch (result.kind) {
    case "coronary":
      return <CoronaryPanel r={result} />;
    case "stroke":
      return <StrokePanel r={result} />;
    case "carotid":
      return <CarotidPanel r={result} />;
    case "liver":
      return <LiverPanel r={result} />;
    case "boneAge":
      return <BoneAgePanel r={result} />;
    case "nodule":
      return <NodulePanel r={result} />;
    case "breast":
      return <BreastPanel r={result} />;
    case "ctr":
      return <CtrPanel r={result} />;
    case "spineQct":
      return <SpineQctPanel r={result} />;
    case "bodyComposition":
      return <BodyPanel r={result} />;
    default:
      return <Empty description={t("w3quant.empty")} />;
  }
}

/* ---------------------------------- 导出工具 ---------------------------------- */

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(results: QuantResult[]): string {
  const lines: string[] = ["section,field,value"];
  const push = (section: string, field: string, value: unknown): void => {
    const v = String(value).replace(/[\r\n]+/g, " ").replace(/,/g, ";");
    lines.push(`${section},${field},${v}`);
  };
  for (const r of results) {
    push(r.kind, "studyId", r.studyId);
    push(r.kind, "confidence", r.confidence);
    push(r.kind, "modelVersion", r.modelVersion);
    push(r.kind, "generatedAt", r.generatedAt);
    if (r.kind === "coronary") {
      push(r.kind, "agatstonTotal", r.agatstonTotal);
      push(r.kind, "cadRads", r.cadRads);
      push(r.kind, "ffrCtLowest", r.ffrCtLowest);
      r.segments.forEach((s) =>
        push(r.kind, `segment:${s.id}`, `${s.stenosis}%/${s.severity}`),
      );
    } else if (r.kind === "stroke") {
      push(r.kind, "aspectsTotal", r.aspectsTotal);
      push(r.kind, "collateralScore", r.collateralScore);
      push(r.kind, "coreVolumeMl", r.coreVolumeMl);
      push(r.kind, "penumbraVolumeMl", r.penumbraVolumeMl);
      push(r.kind, "mismatchRatio", r.mismatchRatio);
      push(r.kind, "lvo", r.lvo.present ? r.lvo.site : "none");
      push(r.kind, "treatmentWindow", r.treatmentWindow);
    } else if (r.kind === "carotid") {
      push(r.kind, "maxStenosis", r.maxStenosis);
      push(r.kind, "dissection", r.dissectionDetected);
      r.vessels.forEach((v) => push(r.kind, `vessel:${v.id}`, `${v.stenosis}%/${v.patency}`));
    } else if (r.kind === "liver") {
      push(r.kind, "totalVolumeMl", r.totalVolumeMl);
      push(r.kind, "fatFractionPct", r.fatFractionPct);
      push(r.kind, "steatosisGrade", r.steatosisGrade);
      push(r.kind, "ironR2Star", r.ironR2Star);
      r.segments.forEach((s) => push(r.kind, `segment:${s.key}`, s.volumeMl));
    } else if (r.kind === "boneAge") {
      push(r.kind, "boneAgeYears", r.boneAgeYears);
      push(r.kind, "chronologicAgeYears", r.chronologicAgeYears);
      push(r.kind, "deltaYears", r.deltaYears);
    } else if (r.kind === "nodule") {
      push(r.kind, "noduleCount", r.noduleCount);
      push(r.kind, "maxLungRads", r.maxLungRads);
      r.nodules.forEach((n) =>
        push(r.kind, `nodule:${n.id}`, `${n.diameterMm}mm/${n.density}/${n.lungRads}/VDT:${n.vdtDays ?? "stable"}`),
      );
    } else if (r.kind === "breast") {
      push(r.kind, "densityCategory", r.densityCategory);
      push(r.kind, "fibroglandularPct", r.fibroglandularPct);
      r.lesions.forEach((l) => push(r.kind, `lesion:${l.id}`, `${l.side}/${l.biRads}/${l.sizeMm}mm`));
    } else if (r.kind === "ctr") {
      push(r.kind, "ctr", r.ctr);
      push(r.kind, "cardiomegaly", r.cardiomegaly);
    } else if (r.kind === "spineQct") {
      push(r.kind, "meanTScore", r.meanTScore);
      push(r.kind, "osteoporosis", r.osteoporosis);
      r.levels.forEach((l) => push(r.kind, `level:${l.level}`, `${l.bmdMgCm3}/${l.tScore}`));
    } else if (r.kind === "bodyComposition") {
      push(r.kind, "smi", r.smi);
      push(r.kind, "visceralFatCm2", r.visceralFatCm2);
      push(r.kind, "sarcopenia", r.sarcopenia);
    }
  }
  return lines.join("\n");
}

/* ---------------------------------- 页面 ---------------------------------- */

const AiQuantCenterPage: React.FC = () => {
  const [category, setCategory] = useState<QuantCategoryId>("cardiac");
  const [studyId, setStudyId] = useState<string>(QUANT_STUDY_OPTIONS[0]?.id ?? "STU-2026-0001");
  const [running, setRunning] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [results, setResults] = useState<QuantResult[]>([]);

  const activeCategory = useMemo(
    () => QUANT_CATEGORIES.find((c) => c.id === category) ?? QUANT_CATEGORIES[0],
    [category],
  );

  useEffect(() => {
    const cat = QUANT_CATEGORIES.find((c) => c.id === category);
    if (!cat) return;
    let alive = true;
    setRunning(true);
    const timer = window.setTimeout(() => {
      if (!alive) return;
      const out = cat.analyses.map((a) => a.run(studyId));
      setResults(out);
      setRunning(false);
    }, 550);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [category, studyId, nonce]);

  const handleRefresh = useCallback(() => setNonce((n) => n + 1), []);

  const handleExportJson = useCallback(() => {
    download(
      `ai-quant-${studyId}.json`,
      JSON.stringify({ studyId, generatedBy: "quantEngine", results }, null, 2),
      "application/json",
    );
  }, [results, studyId]);

  const handleExportCsv = useCallback(() => {
    download(`ai-quant-${studyId}.csv`, toCsv(results), "text/csv;charset=utf-8");
  }, [results, studyId]);

  const header = results[0];
  const categoryLabel =
    activeCategory?.name && activeCategory?.nameEn
      ? pick(activeCategory.name, activeCategory.nameEn)
      : "";

  return (
    <div style={{ padding: 20 }} data-testid="ai-quant-center">
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Card size="small">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <Space size={8}>
              <Sparkles size={20} color="#2563eb" />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{t("w3quant.title")}</span>
              <Tag color="purple" data-testid="quant-badge">
                {t("w3quant.badge")}
              </Tag>
            </Space>
            <span style={{ color: "#8c8c8c", fontSize: 12 }}>{t("w3quant.subtitle")}</span>
            <div style={{ flex: 1 }} />
            <Select
              showSearch
              style={{ minWidth: 240 }}
              value={studyId}
              onChange={(v) => setStudyId(v)}
              options={QUANT_STUDY_OPTIONS.map((s) => ({
                value: s.id,
                label: `${s.id} · ${s.label}`,
              }))}
              placeholder={t("w3quant.selectStudy")}
              data-testid="quant-study"
            />
            <Button
              type="primary"
              icon={<Cpu size={14} />}
              loading={running}
              onClick={handleRefresh}
              data-testid="quant-run"
            >
              {running ? t("w3quant.running") : t("w3quant.run")}
            </Button>
            <Button icon={<RefreshCw size={14} />} onClick={handleRefresh} data-testid="quant-refresh">
              {t("w3quant.refresh")}
            </Button>
            <Button icon={<Download size={14} />} onClick={handleExportJson} data-testid="quant-export-json">
              JSON
            </Button>
            <Button icon={<Download size={14} />} onClick={handleExportCsv} data-testid="quant-export-csv">
              CSV
            </Button>
          </div>
          {header ? (
            <Space size={16} style={{ marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#595959" }}>
                {t("w3quant.studyId")}: <strong>{header.studyId}</strong>
              </span>
              <span style={{ fontSize: 12, color: "#595959" }}>
                {t("w3quant.modelVersion")}: <strong>{header.modelVersion}</strong>
              </span>
              <span style={{ fontSize: 12, color: "#595959" }}>
                {t("w3quant.generatedAt")}: <strong>{header.generatedAt}</strong>
              </span>
              <span style={{ fontSize: 12, color: "#595959" }}>
                {t("w3quant.confidence")}: <strong>{header.confidence}%</strong>
              </span>
            </Space>
          ) : null}
        </Card>

        <Row gutter={16}>
          <Col xs={24} md={5}>
            <Card size="small" title={t("w3quant.category")} style={{ position: "sticky", top: 12 }}>
              <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                {QUANT_CATEGORIES.map((c) => (
                  <Button
                    key={c.id}
                    block
                    type={c.id === category ? "primary" : "default"}
                    icon={categoryIcon[c.id]}
                    onClick={() => setCategory(c.id)}
                    data-testid={`quant-cat-${c.id}`}
                    style={{ textAlign: "left", justifyContent: "flex-start" }}
                  >
                    {pick(c.name, c.nameEn)}
                  </Button>
                ))}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={19}>
            <Spin spinning={running} description={t("w3quant.running")}>
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Alert
                  type="info"
                  showIcon
                  title={t("w3quant.simulatedNote")}
                  data-testid="quant-note"
                />
                {activeCategory ? (
                  <Card size="small">
                    <Space size={8} wrap>
                      {categoryIcon[activeCategory.id]}
                      <span style={{ fontWeight: 600 }}>{categoryLabel}</span>
                      <span style={{ color: "#8c8c8c", fontSize: 12 }}>
                        {t("w3quant.analyses")}: {activeCategory.analyses.map((a) => pick(a.name, a.nameEn)).join(" · ")}
                      </span>
                    </Space>
                  </Card>
                ) : null}
                {results.length === 0 && !running ? (
                  <Card>
                    <Empty description={t("w3quant.ready")} />
                  </Card>
                ) : (
                  results.map((r) => (
                    <Card key={r.kind} data-testid={`quant-result-${r.kind}`}>
                      <ResultPanel result={r} />
                    </Card>
                  ))
                )}
              </Space>
            </Spin>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default AiQuantCenterPage;
