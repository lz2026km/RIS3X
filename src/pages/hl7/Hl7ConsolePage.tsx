/**
 * [W-D3] HL7 消息控制台 - /hl7/console
 * 消息发送 (ORU/ORM/DFT) + MLLP 服务面板 + 白名单管理 + 消息日志 + 统计总览
 *
 * 真实后端对齐 (backend/src/hl7/hl7.controller.ts):
 *   POST /hl7/oru | /hl7/orm | /hl7/dft   消息构建发送 (前端解析 MSH/PID/ORC/OBR/OBX/FT1 段 → 结构化 payload)
 *   GET  /hl7/mllp/status · POST /hl7/mllp/start | /hl7/mllp/stop · POST /hl7/mllp/tls
 *   POST /hl7/mllp/whitelist/add | /hl7/mllp/whitelist/remove
 *   GET  /hl7/archive                     消息日志
 *   GET  /hl7/overview                    统计总览 (兼容 Hl7OverviewDto 与旧版 mock 两种形状)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  Activity,
  FileText,
  Play,
  Plus,
  Plug,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Square,
} from "lucide-react";
import {
  hl7Api,
  type Hl7ArchiveRecord,
  type Hl7DftTransaction,
  type Hl7OrmOrder,
  type Hl7Report,
  type MllpStatus,
} from "../../services/api/integrationApi";
import { invalidateApiCache } from "../../services/api/client";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { usePagination } from "../../hooks/usePagination";
import { t } from "../../i18n/appI18n";

type ComposerType = "ORU" | "ORM" | "DFT";

// ── 消息模板 (与 backend hl7.service 构建器字段对齐, 便于段解析回填) ──
const nowHl7 = () => new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

const TEMPLATE: Record<ComposerType, string> = {
  ORU: [
    "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|20260801090000||ORU^R01|G005-RPT-CONSOLE-001|P|2.5.1",
    "PID|1||P000001^^^G005^MR||张明远^张明远||19850615|M",
    "PV1|1|O||||||||||||ACC20260001^^G005^ACC",
    "OBR|1|ACC20260001^^G005^FILL|ACC20260001^^G005^FILL|CT^CT^DCM||||202608010900|||||||||D001^张医师^^^G005^DOC",
    "OBX|1|TX|18782-3^Radiology study observation^LN||右肺上叶见一枚实性结节，约 8mm，边界清。",
    "OBX|2|TX|19005-8^Radiology study conclusion^LN||考虑良性结节可能，建议 12 个月后随访复查。",
  ].join("\r"),
  ORM: [
    "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_ORDER|HIS|20260801080000||ORM^O01|ORM-G005-ACC20260001|P|2.5.1",
    "PID|1||P000001^^^G005^MR||张明远^张明远||19850615|M",
    "ORC|NW|ORD20260001^^G005^ORDER||||||20260801080000||||||||||李医师",
    "OBR|1|ACC20260001^^G005^FILL|ACC20260001^^G005^FILL|CT^CT^DCM||||202608010900||||||||||CHEST",
  ].join("\r"),
  DFT: [
    "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_FINANCE|HIS|20260801093000||DFT^P03|DFT-G005-INV20260001|P|2.5.1",
    "PID|1||P000001^^^G005^MR||张明远^张明远|||M",
    "FT1|1|20260801|RAD-CT-001|CT 检查费|INV20260001|||||150.00||150.00",
  ].join("\r"),
};

// ── HL7 段解析工具 ──────────────────────────────────────────────────────────
const splitSegments = (raw: string): string[][] =>
  raw
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|"));

const pickSeg = (segs: string[][], name: string): string[] | undefined =>
  segs.find((s) => (s[0] ?? "").trim().toUpperCase() === name);

const comp = (field: string | undefined, idx = 0): string =>
  (field ?? "").split("^")[idx] ?? "";

const lastNonEmpty = (fields: string[] | undefined): string => {
  if (!fields) return "";
  for (let i = fields.length - 1; i >= 0; i -= 1) {
    const v = (fields[i] ?? "").trim();
    if (v) return comp(v);
  }
  return "";
};

const yyyymmddToDate = (v: string): string => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

const yyyymmddToTime = (v: string): string => {
  const m = /^\d{8}(\d{2})(\d{2})/.exec(v ?? "");
  return m ? `${m[1]}:${m[2]}` : "";
};

const normalizeSex = (v: string | undefined): "M" | "F" | "O" | "" => {
  const s = (v ?? "").trim().toUpperCase();
  return s === "M" || s === "F" || s === "O" ? s : "O";
};

function parseOruPayload(raw: string, ts: string): Hl7Report {
  const segs = splitSegments(raw);
  const msh = pickSeg(segs, "MSH");
  const pid = pickSeg(segs, "PID");
  const obr = pickSeg(segs, "OBR");
  const obxList = segs.filter((s) => (s[0] ?? "").toUpperCase() === "OBX");
  const findingsObx = obxList.find((o) => (o[3] ?? "").startsWith("18782-3")) ?? obxList[0];
  const conclusionObx = obxList.find((o) => (o[3] ?? "").startsWith("19005-8")) ?? obxList[1];
  const obr7 = obr?.[7] ?? "";
  const author = obr?.[16] ?? "";
  const today = new Date().toISOString().slice(0, 10);
  return {
    accessionNumber: comp(obr?.[3]) || comp(obr?.[2]) || `ACC-CONSOLE-${ts}`,
    patientName: comp(pid?.[5]) || t("hl7Console.defaultPatient"),
    patientId: comp(pid?.[3]) || "P-CONSOLE",
    patientSex: normalizeSex(pid?.[8]),
    modality: comp(obr?.[4]) || "CT",
    studyDate: yyyymmddToDate(obr7) || today,
    studyTime: yyyymmddToTime(obr7) || "09:00",
    findings: findingsObx?.[5] || t("hl7Console.defaultFindings"),
    conclusion: conclusionObx?.[5] || t("hl7Console.defaultConclusion"),
    authorName: comp(author, 1) || t("hl7Console.defaultAuthor"),
    authorId: comp(author, 0) || "D-CONSOLE",
    reportId: msh?.[9] || `RPT-CONSOLE-${ts}`,
  };
}

function parseOrmPayload(raw: string, ts: string): Hl7OrmOrder {
  const segs = splitSegments(raw);
  const pid = pickSeg(segs, "PID");
  const orc = pickSeg(segs, "ORC");
  const obr = pickSeg(segs, "OBR");
  return {
    patientId: comp(pid?.[3]) || "P-CONSOLE",
    patientName: comp(pid?.[5]) || t("hl7Console.defaultPatient"),
    patientSex: normalizeSex(pid?.[8]),
    accessionNumber: comp(obr?.[3]) || comp(obr?.[2]) || `ACC-CONSOLE-${ts}`,
    modality: comp(obr?.[4]) || "CT",
    bodyPart: lastNonEmpty(obr) || "CHEST",
    orderNumber: comp(orc?.[2]) || `ORD-CONSOLE-${ts}`,
    orderingDoctor: lastNonEmpty(orc) || t("hl7Console.defaultAuthor"),
  };
}

function parseDftPayload(raw: string, ts: string): Hl7DftTransaction {
  const segs = splitSegments(raw);
  const pid = pickSeg(segs, "PID");
  const ft1 = pickSeg(segs, "FT1");
  return {
    patientId: comp(pid?.[3]) || "P-CONSOLE",
    patientName: comp(pid?.[5]) || t("hl7Console.defaultPatient"),
    patientSex: normalizeSex(pid?.[8]),
    invoiceNumber: ft1?.[5] || `INV-CONSOLE-${ts}`,
    totalAmount: ft1?.[10] || "150.00",
    paidAmount: ft1?.[12] || undefined,
    chargeCode: ft1?.[3] || "RAD-CT-001",
    chargeName: ft1?.[4] || t("hl7Console.defaultCharge"),
  };
}

// ── /hl7/overview 双形状归一化 ──────────────────────────────────────────────
interface OverviewNorm {
  total: number;
  today: number;
  failed: number;
  inbound: number;
  outbound: number;
  successRate: number;
  byType: Array<{ messageType: string; count: number; percent: number }>;
  ackBreakdown: Array<{ ackStatus: string; count: number }>;
}

function normalizeOverview(d: unknown): OverviewNorm | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.totalMessages === "number") {
    const byType = Array.isArray(o.byType)
      ? (o.byType as Array<Record<string, unknown>>)
          .map((x) => ({
            messageType: String(x.messageType ?? ""),
            count: Number(x.count ?? 0),
            percent: Number(x.percent ?? 0),
          }))
          .slice(0, 8)
      : [];
    const ackBreakdown = Array.isArray(o.ackStatusBreakdown)
      ? (o.ackStatusBreakdown as Array<Record<string, unknown>>)
          .map((x) => ({ ackStatus: String(x.ackStatus ?? ""), count: Number(x.count ?? 0) }))
      : [];
    return {
      total: Number(o.totalMessages ?? 0),
      today: Number(o.todayMessages ?? 0),
      failed: Number(o.failedCount ?? 0),
      inbound: Number(o.inboundCount ?? 0),
      outbound: Number(o.outboundCount ?? 0),
      successRate: Number(o.successRate ?? 100),
      byType,
      ackBreakdown,
    };
  }
  // 旧版 mock 形状: { inbound, outbound, failed, pending, successRate, last24h }
  const inbound = Number(o.inbound ?? 0);
  const outbound = Number(o.outbound ?? 0);
  return {
    total: inbound + outbound,
    today: Number(o.last24h ?? 0),
    failed: Number(o.failed ?? 0),
    inbound,
    outbound,
    successRate: Number(o.successRate ?? 100),
    byType: [],
    ackBreakdown: [],
  };
}

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

// ── 页面组件 ────────────────────────────────────────────────────────────────
export const Hl7ConsolePage: React.FC = () => {
  const [msgType, setMsgType] = useState<ComposerType>("ORU");
  const [raw, setRaw] = useState<string>(TEMPLATE.ORU);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    type: ComposerType;
    controlId: string;
    bytes: number;
    message: string;
  } | null>(null);

  const [status, setStatus] = useState<MllpStatus | null>(null);
  const [tlsOn, setTlsOn] = useState(false);
  const [operating, setOperating] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState("");

  const [overview, setOverview] = useState<OverviewNorm | null>(null);
  const [archive, setArchive] = useState<Hl7ArchiveRecord[]>([]);
  const [localLog, setLocalLog] = useState<Hl7ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, overviewRes, archiveRes] = await Promise.all([
        hl7Api.getMllpStatus(),
        hl7Api.getOverview(),
        hl7Api.getArchive(),
      ]);
      if (statusRes.success && statusRes.data) {
        setStatus(statusRes.data);
        setTlsOn(Boolean(statusRes.data.tlsEnabled));
      }
      if (overviewRes.success) setOverview(normalizeOverview(overviewRes.data));
      if (archiveRes.success && Array.isArray(archiveRes.data)) setArchive(archiveRes.data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("hl7Console.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const logRows = useMemo(() => [...localLog, ...archive], [localLog, archive]);
  const logPagination = usePagination(logRows, 10);

  const pushLocalLog = useCallback(
    (entry: { messageType: string; controlId: string; status: "SUCCESS" | "FAILED"; payload: string; at?: string }) => {
      setLocalLog((prev) => [
        {
          id: -(prev.length + 1),
          messageType: entry.messageType,
          controlId: entry.controlId,
          direction: "OUTBOUND",
          ackStatus: entry.status,
          retryCount: 0,
          rawMessage: entry.payload,
          createdAt: entry.at ?? new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
  );

  const handleTypeChange = (v: string | number) => {
    const next = String(v) as ComposerType;
    setMsgType(next);
    setRaw(TEMPLATE[next]);
    setLastResult(null);
  };

  const handleSend = async () => {
    const ts = nowHl7();
    setSending(true);
    try {
      const outcome = await (async () => {
        if (msgType === "ORU") {
          const payload = parseOruPayload(raw, ts);
          return { fallbackId: `G005-${payload.reportId}-${ts}`, res: await hl7Api.buildOru(payload) };
        }
        if (msgType === "ORM") {
          const payload = parseOrmPayload(raw, ts);
          return { fallbackId: `ORM-G005-${payload.accessionNumber}-${ts}`, res: await hl7Api.buildOrm(payload) };
        }
        const payload = parseDftPayload(raw, ts);
        return { fallbackId: `DFT-G005-${payload.invoiceNumber}-${ts}`, res: await hl7Api.buildDft(payload) };
      })();
      const { res, fallbackId } = outcome;
      if (res.success && res.data) {
        const data = res.data;
        message.success(t("hl7Console.sent", { type: msgType, controlId: data.controlId }));
        setLastResult({
          type: msgType,
          controlId: data.controlId,
          bytes: data.bytes,
          message: data.message,
        });
        pushLocalLog({
          messageType: data.messageType || `${msgType}`,
          controlId: data.controlId,
          status: "SUCCESS",
          payload: data.message,
          at: data.generatedAt,
        });
        await invalidateApiCache("/hl7/archive");
        await invalidateApiCache("/hl7/overview");
        void fetchData();
      } else {
        message.error(res.error?.message ?? t("hl7Console.sendFailed"));
        pushLocalLog({
          messageType: msgType,
          controlId: fallbackId,
          status: "FAILED",
          payload: raw,
        });
      }
    } catch {
      message.error(t("hl7Console.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleMllpToggle = async () => {
    setOperating(true);
    try {
      const res = status?.running ? await hl7Api.stopMllp() : await hl7Api.startMllp();
      if (res.success) {
        message.success(status?.running ? t("hl7Console.mllp.stopOk") : t("hl7Console.mllp.startOk"));
        await invalidateApiCache("/hl7/mllp/status");
        void fetchData();
      } else {
        message.error(res.error?.message ?? t("hl7Console.mllp.toggleFail"));
      }
    } catch {
      message.error(t("hl7Console.mllp.toggleFail"));
    } finally {
      setOperating(false);
    }
  };

  const handleTlsToggle = async (checked: boolean) => {
    const res = await hl7Api.toggleMllpTls(checked);
    if (res.success) {
      setTlsOn(checked);
      message.success(t("hl7Console.mllp.tlsOk"));
      await invalidateApiCache("/hl7/mllp/status");
      void fetchData();
    } else {
      message.error(res.error?.message ?? t("hl7Console.mllp.tlsFail"));
    }
  };

  const handleAddWhitelist = async () => {
    const cidr = whitelistInput.trim();
    if (!CIDR_RE.test(cidr)) {
      message.warning(t("hl7Console.whitelist.invalidCidr"));
      return;
    }
    const res = await hl7Api.addMllpWhitelist(cidr);
    if (res.success) {
      message.success(t("hl7Console.whitelist.addOk"));
      setWhitelistInput("");
      await invalidateApiCache("/hl7/mllp/status");
      void fetchData();
    } else {
      message.error(res.error?.message ?? t("hl7Console.whitelist.addFail"));
    }
  };

  const handleRemoveWhitelist = async (cidr: string) => {
    const res = await hl7Api.removeMllpWhitelist(cidr);
    if (res.success) {
      message.success(t("hl7Console.whitelist.removeOk"));
      await invalidateApiCache("/hl7/mllp/status");
      void fetchData();
    } else {
      message.error(res.error?.message ?? t("hl7Console.whitelist.removeFail"));
    }
  };

  const uptimeText = status
    ? `${Math.floor((status.uptimeMs ?? 0) / 3600000)}h ${Math.floor(((status.uptimeMs ?? 0) % 3600000) / 60000)}m`
    : "-";

  const errorRate = overview ? Math.max(0, 100 - overview.successRate) : 0;
  const whitelist = status?.whitelist ?? [];

  return (
    <PageContainer testId="hl7-console-page" padding={24}>
      {/* 页头 */}
      <Card size="small" className="shadow-sm" style={{ marginBottom: "var(--space-4, 16px)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-2, 8px)",
          }}
        >
          <Space>
            <Plug size={18} color="#7c3aed" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t("hl7Console.title")}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>{t("hl7Console.subtitle")}</div>
            </div>
          </Space>
          <Space wrap>
            <Badge
              status={status?.running ? "processing" : "default"}
              text={status?.running ? t("hl7Console.mllp.running") : t("hl7Console.mllp.stopped")}
            />
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()}>
              {t("hl7Console.refresh")}
            </Button>
          </Space>
        </div>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t("hl7Console.loadFailed")}
          description={error}
          style={{ marginBottom: "var(--space-4, 16px)" }}
          action={
            <Button size="small" onClick={() => void fetchData()}>
              <RefreshCw size={12} /> {t("hl7Console.retry")}
            </Button>
          }
        />
      )}

      {/* KPI */}
      <StatCardGrid style={{ marginBottom: "var(--space-4, 16px)" }} minWidth={200} gap={16}>
        <StatCard
          testId="hl7-console-kpi-mllp"
          title={t("hl7Console.stat.mllp")}
          value={status?.running ? t("hl7Console.mllp.running") : t("hl7Console.mllp.stopped")}
          sub={t("hl7Console.stat.mllpSub", { port: status?.port ?? 2575 })}
          color={status?.running ? "success" : "error"}
          loading={loading}
          icon={<Server size={18} />}
        />
        <StatCard
          testId="hl7-console-kpi-today"
          title={t("hl7Console.stat.sentToday")}
          value={overview?.today ?? 0}
          sub={t("hl7Console.stat.todaySub", { total: overview?.total ?? 0 })}
          color="primary"
          loading={loading}
          icon={<Send size={18} />}
        />
        <StatCard
          testId="hl7-console-kpi-error-rate"
          title={t("hl7Console.stat.errorRate")}
          value={`${errorRate.toFixed(1)}%`}
          sub={t("hl7Console.stat.errorRateSub", { failed: overview?.failed ?? 0 })}
          color={errorRate > 5 ? "error" : "success"}
          loading={loading}
          icon={<Activity size={18} />}
        />
        <StatCard
          testId="hl7-console-kpi-whitelist"
          title={t("hl7Console.stat.whitelist")}
          value={whitelist.length}
          sub={t("hl7Console.stat.whitelistSub")}
          color="info"
          loading={loading}
          icon={<ShieldCheck size={18} />}
        />
      </StatCardGrid>

      <Row gutter={[12, 12]}>
        {/* 消息发送器 */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <Space>
                <Send size={14} />
                {t("hl7Console.composer.title")}
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={msgType}
                onChange={handleTypeChange}
                options={[
                  { label: "ORU^R01", value: "ORU" },
                  { label: "ORM^O01", value: "ORM" },
                  { label: "DFT^P03", value: "DFT" },
                ]}
              />
            }
            style={{ marginBottom: "var(--space-3, 12px)" }}
          >
            <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginBottom: 'var(--space-2, 8px)' }}>
              {t("hl7Console.composer.hint")}
            </div>
            <Input.TextArea
              data-testid="hl7-console-composer-input"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={12}
              style={{ fontFamily: "var(--font-mono, Consolas, monospace)", fontSize: 12 }}
              placeholder={t("hl7Console.composer.ph")}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                flexWrap: "wrap",
                gap: 'var(--space-2, 8px)',
              }}
            >
              <Space size={4} wrap>
                <Button size="small" onClick={() => setRaw(TEMPLATE[msgType])}>
                  {t("hl7Console.composer.resetTemplate")}
                </Button>
                <span style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>
                  {t("hl7Console.composer.charCount", { count: raw.length })}
                </span>
              </Space>
              <Button
                data-testid="hl7-console-send"
                type="primary"
                icon={<Send size={14} />}
                loading={sending}
                onClick={() => void handleSend()}
              >
                {sending ? t("hl7Console.composer.sending") : t("hl7Console.composer.send")}
              </Button>
            </div>

            {lastResult && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 10 }}
                message={t("hl7Console.composer.resultTitle", {
                  type: lastResult.type,
                  controlId: lastResult.controlId,
                  bytes: lastResult.bytes,
                })}
                description={
                  <div>
                    <pre
                      data-testid="hl7-console-result"
                      style={{
                        margin: 0,
                        maxHeight: 120,
                        overflow: "auto",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {lastResult.message}
                    </pre>
                  </div>
                }
              />
            )}
          </Card>

          {/* 统计总览 */}
          <Card
            size="small"
            title={
              <Space>
                <FileText size={14} />
                {t("hl7Console.stats.title")}
              </Space>
            }
          >
            {overview ? (
              <div data-testid="hl7-console-stats">
                <StatCardGrid minWidth={140} gap={8} style={{ marginBottom: 10 }}>
                  <StatCard size="sm" variant="compact" title={t("hl7Console.stats.total")} value={overview.total} />
                  <StatCard size="sm" variant="compact" title={t("hl7Console.stats.today")} value={overview.today} />
                  <StatCard
                    size="sm"
                    variant="compact"
                    title={t("hl7Console.stats.successRate")}
                    value={`${overview.successRate.toFixed(1)}%`}
                    color={overview.successRate >= 95 ? "success" : "warning"}
                  />
                  <StatCard size="sm" variant="compact" title={t("hl7Console.stats.failed")} value={overview.failed} color={overview.failed > 0 ? "error" : "primary"} />
                </StatCardGrid>
                <Space size={4} wrap style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Tag color="green">
                    {t("hl7Console.stats.inbound")}: {overview.inbound}
                  </Tag>
                  <Tag color="purple">
                    {t("hl7Console.stats.outbound")}: {overview.outbound}
                  </Tag>
                  {overview.ackBreakdown.map((a) => (
                    <Tag
                      key={a.ackStatus}
                      color={a.ackStatus === "SUCCESS" ? "success" : a.ackStatus === "FAILED" ? "error" : "warning"}
                    >
                      ACK {a.ackStatus}: {a.count}
                    </Tag>
                  ))}
                </Space>
                {overview.byType.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {overview.byType.map((bt) => (
                      <div key={bt.messageType} style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                        <Tag color="blue" style={{ width: 96, textAlign: "center" }}>
                          {bt.messageType}
                        </Tag>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            background: "var(--bg-primary, #f8fafc)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, bt.percent || 0)}%`,
                              height: "100%",
                              background: "var(--color-primary-500)",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, width: 72, textAlign: "right" }}>
                          {bt.count} · {bt.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>{t("hl7Console.stats.empty")}</div>
            )}
          </Card>
        </Col>

        {/* MLLP + 白名单 */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={
              <Space>
                <Server size={14} />
                {t("hl7Console.mllp.title")}
              </Space>
            }
            extra={
              status?.running ? (
                <Button size="small" danger icon={<Square size={12} />} loading={operating} onClick={() => void handleMllpToggle()}>
                  {t("hl7Console.mllp.stop")}
                </Button>
              ) : (
                <Button size="small" type="primary" icon={<Play size={12} />} loading={operating} onClick={() => void handleMllpToggle()}>
                  {t("hl7Console.mllp.start")}
                </Button>
              )
            }
            style={{ marginBottom: "var(--space-3, 12px)" }}
          >
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  <Badge status={status?.running ? "processing" : "default"} text={status?.running ? t("hl7Console.mllp.running") : t("hl7Console.mllp.stopped")} />
                </span>
                <Space size={8}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary, #475569)" }}>{t("hl7Console.mllp.tls")}</span>
                  <Switch size="small" checked={tlsOn} onChange={(v) => void handleTlsToggle(v)} />
                </Space>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary, #475569)", width: 64 }}>
                  {t("hl7Console.mllp.port")}
                </span>
                <InputNumber
                  size="small"
                  min={1}
                  max={65535}
                  value={status?.port ?? 2575}
                  disabled
                  style={{ width: 140 }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>{t("hl7Console.mllp.portHint")}</span>
              </div>

              <StatCardGrid minWidth={110} gap={8}>
                <StatCard size="sm" variant="compact" title={t("hl7Console.mllp.connections")} value={status?.totalConnections ?? 0} />
                <StatCard size="sm" variant="compact" title={t("hl7Console.mllp.messages")} value={status?.totalMessages ?? 0} />
                <StatCard size="sm" variant="compact" title={t("hl7Console.mllp.uptime")} value={uptimeText} />
              </StatCardGrid>
            </Space>
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <ShieldCheck size={14} />
                {t("hl7Console.whitelist.title")}
                <Tag>{whitelist.length}</Tag>
              </Space>
            }
          >
            <Space.Compact style={{ width: "100%", marginBottom: 10 }}>
              <Input
                data-testid="hl7-console-whitelist-input"
                size="small"
                placeholder={t("hl7Console.whitelist.ph")}
                value={whitelistInput}
                onChange={(e) => setWhitelistInput(e.target.value)}
                onPressEnter={() => void handleAddWhitelist()}
              />
              <Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => void handleAddWhitelist()}>
                {t("hl7Console.whitelist.add")}
              </Button>
            </Space.Compact>
            {whitelist.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>{t("hl7Console.whitelist.empty")}</div>
            ) : (
              <Space size={[4, 8]} wrap>
                {whitelist.map((cidr) => (
                  <Tag
                    key={cidr}
                    color="geekblue"
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      void handleRemoveWhitelist(cidr);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
                  >
                    {cidr}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 消息日志 */}
      <Card
        size="small"
        style={{ marginTop: "var(--space-3, 12px)" }}
        title={
          <Space>
            <Activity size={14} />
            {t("hl7Console.log.title")}
            <Tag>{logRows.length}</Tag>
          </Space>
        }
        extra={
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()}>
            {t("hl7Console.refresh")}
          </Button>
        }
      >
        <DataTable
          rowKey={(r) => `${r.id}-${r.createdAt}`}
          dataSource={logPagination.pageData}
          pagination={logPagination.pagination}
          loading={loading}
          scroll={{ x: "max-content" }}
          emptyText={t("hl7Console.log.empty")}
          columns={[
            {
              title: t("hl7Console.log.colTime"),
              dataIndex: "createdAt",
              width: 160,
              render: (v: string) => new Date(v).toLocaleString("zh-CN"),
            },
            {
              title: t("hl7Console.log.colType"),
              dataIndex: "messageType",
              width: 110,
              render: (v: string) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: t("hl7Console.log.colDirection"),
              dataIndex: "direction",
              width: 90,
              render: (v: string) => (
                <Tag color={v === "INBOUND" ? "green" : v === "ACK" ? "orange" : "purple"}>
                  {v === "INBOUND"
                    ? t("hl7Console.dir.inbound")
                    : v === "ACK"
                      ? t("hl7Console.dir.ack")
                      : t("hl7Console.dir.outbound")}
                </Tag>
              ),
            },
            {
              title: t("hl7Console.log.colStatus"),
              dataIndex: "ackStatus",
              width: 90,
              render: (v: string) => (
                <Tag color={v === "SUCCESS" ? "success" : v === "FAILED" ? "error" : "warning"}>{v}</Tag>
              ),
            },
            {
              title: t("hl7Console.log.colControlId"),
              dataIndex: "controlId",
              width: 180,
              ellipsis: true,
              render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code>,
            },
            {
              title: t("hl7Console.log.colPayload"),
              dataIndex: "rawMessage",
              ellipsis: true,
              render: (v: string) => (
                <Tooltip title={v}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono, Consolas, monospace)" }}>
                    {(v ?? "").replace(/\r/g, " ⏎ ").slice(0, 120)}
                  </span>
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>

      <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>
        <Space size={6} wrap>
          <Tag color="purple">POST /hl7/oru · /hl7/orm · /hl7/dft</Tag>
          <Tag color="cyan">GET /hl7/mllp/status · POST start/stop</Tag>
          <Tag color="geekblue">POST /hl7/mllp/whitelist/add · remove</Tag>
          <Tag color="green">GET /hl7/archive · /hl7/overview</Tag>
        </Space>
      </div>
    </PageContainer>
  );
};

export default Hl7ConsolePage;
