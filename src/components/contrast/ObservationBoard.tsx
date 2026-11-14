import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  message,
} from "antd";
import { Clock, Plus, RefreshCw, Siren } from "lucide-react";
import DataTable from "../common/DataTable";
import { AppSelectField } from "../common/AppSelectField";
import { ErrorBanner } from "../feedback";
import {
  contrastSafetyApi,
  type ContrastObservation,
  type ContrastObservationSource,
} from "../../services/api/contrastSafetyApi";
import { t } from "../../i18n/appI18n";

interface ObservationBoardProps {
  patientId?: string;
}

type StatusFilter = "all" | "observing" | "discharged" | "reaction";

const panelStyle = {
  background: "var(--bg-card, #161b22)",
  border: "1px solid var(--border-default, #30363d)",
  borderRadius: 8,
  padding: "var(--space-4, 16px)",
};

function toSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function elapsedSecondsOf(item: ContrastObservation, now: number): number {
  return Math.max(
    0,
    Math.floor((now - new Date(item.startedAt).getTime()) / 1000),
  );
}

function remainingSecondsOf(item: ContrastObservation, now: number): number {
  if (item.status === "discharged") return 0;
  const durationSeconds =
    (item.durationMinutes > 0 ? item.durationMinutes : 30) * 60;
  return Math.max(0, durationSeconds - elapsedSecondsOf(item, now));
}

function formatClock(totalSeconds: number): string {
  const seconds = toSeconds(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

function latestSymptomOf(item: ContrastObservation): string {
  const last = item.records[item.records.length - 1];
  return last?.symptoms?.trim() || last?.action?.trim() || "";
}

function statusLabel(status: ContrastObservation["status"]): string {
  if (status === "discharged") return t("contrastObservation.statusDischarged");
  if (status === "reaction") return t("contrastObservation.statusReaction");
  return t("contrastObservation.statusObserving");
}

function statusColor(status: ContrastObservation["status"]): string {
  if (status === "discharged") return "green";
  if (status === "reaction") return "red";
  return "blue";
}

export default function ObservationBoard({ patientId }: ObservationBoardProps) {
  const [items, setItems] = useState<ContrastObservation[]>([]);
  const [source, setSource] = useState<ContrastObservationSource>("db");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nowTick, setNowTick] = useState(Date.now());
  const [recordTarget, setRecordTarget] = useState<ContrastObservation | null>(
    null,
  );
  const [recordForm, setRecordForm] = useState({ symptoms: "", action: "" });
  const [dischargeTarget, setDischargeTarget] =
    useState<ContrastObservation | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState("");
  const [doctorRelease, setDoctorRelease] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contrastSafetyApi.listObservations(patientId);
      if (res.success && res.data) {
        setItems(res.data.items ?? []);
        setSource(res.data.source === "seed" ? "seed" : "db");
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? t("contrastObservation.loadFailed"));
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : t("contrastObservation.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    let observing = 0;
    let discharged = 0;
    let reaction = 0;
    let overdue = 0;
    for (const item of items) {
      if (item.status === "discharged") {
        discharged += 1;
      } else {
        if (item.status === "reaction") reaction += 1;
        else observing += 1;
        if (remainingSecondsOf(item, nowTick) === 0) {
          overdue += 1;
        }
      }
    }
    return { observing, discharged, reaction, overdue };
  }, [items, nowTick]);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) => statusFilter === "all" || item.status === statusFilter,
      ),
    [items, statusFilter],
  );

  const openRecord = (item: ContrastObservation) => {
    setRecordTarget(item);
    setRecordForm({ symptoms: "", action: "" });
  };

  const openDischarge = (item: ContrastObservation) => {
    setDischargeTarget(item);
    setDischargeNotes("");
    setDoctorRelease(false);
  };

  const submitRecord = async () => {
    if (!recordTarget) return;
    if (!recordForm.symptoms.trim()) {
      message.warning(t("contrastObservation.symptomsRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await contrastSafetyApi.addObservationRecord(
        recordTarget.id,
        {
          symptoms: recordForm.symptoms.trim(),
          action: recordForm.action.trim() || undefined,
          recordedBy: "current-user",
        },
      );
      if (res.success && res.data) {
        message.success(t("contrastObservation.recorded"));
        setRecordTarget(null);
        setRecordForm({ symptoms: "", action: "" });
        await load();
      } else {
        message.error(res.error?.message ?? t("contrastObservation.failed"));
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("contrastObservation.failed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitDischarge = async () => {
    if (!dischargeTarget) return;
    setSubmitting(true);
    try {
      const res = await contrastSafetyApi.dischargeObservation(
        dischargeTarget.id,
        {
          notes: dischargeNotes.trim() || undefined,
          doctorRelease,
          dischargedBy: "current-user",
        },
      );
      if (res.success && res.data) {
        message.success(t("contrastObservation.discharged"));
        setDischargeTarget(null);
        setDischargeNotes("");
        setDoctorRelease(false);
        await load();
      } else {
        message.error(res.error?.message ?? t("contrastObservation.failed"));
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("contrastObservation.failed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t("contrastObservation.colPatient"),
        key: "patient",
        width: 180,
        render: (_: unknown, item: ContrastObservation) => (
          <div>
            <div style={{ fontWeight: 600 }}>
              {item.patientName || item.patientId}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted, #8b949e)",
              }}
            >
              {item.patientId}
            </div>
          </div>
        ),
      },
      {
        title: t("contrastObservation.colStartedAt"),
        dataIndex: "startedAt",
        key: "startedAt",
        width: 170,
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: t("contrastObservation.colElapsed"),
        key: "elapsed",
        width: 120,
        render: (_: unknown, item: ContrastObservation) =>
          item.status === "discharged"
            ? "--"
            : formatClock(elapsedSecondsOf(item, nowTick)),
      },
      {
        title: t("contrastObservation.colRemaining"),
        key: "remaining",
        width: 150,
        render: (_: unknown, item: ContrastObservation) => {
          if (item.status === "discharged") {
            return (
              <span style={{ color: "var(--text-muted, #8b949e)" }}>--</span>
            );
          }
          const remaining = remainingSecondsOf(item, nowTick);
          const overdue = remaining === 0;
          return (
            <Space size={4}>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                  color: overdue
                    ? "var(--color-error-500, #ef4444)"
                    : "var(--color-info-600, #0891b2)",
                }}
              >
                {formatClock(remaining)}
              </span>
              {overdue && (
                <Tag color="red">
                  {t("contrastObservation.readyToDischarge")}
                </Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: t("contrastObservation.colStatus"),
        key: "status",
        width: 130,
        render: (_: unknown, item: ContrastObservation) => {
          const overdue =
            item.status !== "discharged" &&
            remainingSecondsOf(item, nowTick) === 0;
          return (
            <Space size={4}>
              <Tag color={statusColor(item.status)}>
                {statusLabel(item.status)}
              </Tag>
              {overdue && item.status === "observing" && (
                <Tag color="orange">{t("contrastObservation.overdue")}</Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: t("contrastObservation.colSymptom"),
        key: "symptom",
        width: 220,
        render: (_: unknown, item: ContrastObservation) =>
          latestSymptomOf(item) || (
            <span style={{ color: "var(--text-muted, #8b949e)" }}>
              {t("contrastObservation.noSymptom")}
            </span>
          ),
      },
      {
        title: t("contrastObservation.colActions"),
        key: "action",
        width: 220,
        render: (_: unknown, item: ContrastObservation) => (
          <Space size={4} wrap>
            <Button
              size="small"
              icon={<Plus size={13} />}
              disabled={item.status === "discharged"}
              onClick={() => openRecord(item)}
            >
              {t("contrastObservation.record")}
            </Button>
            <Button
              size="small"
              type="primary"
              danger={
                item.status !== "discharged" &&
                remainingSecondsOf(item, nowTick) === 0
              }
              disabled={item.status === "discharged"}
              onClick={() => openDischarge(item)}
            >
              {t("contrastObservation.discharge")}
            </Button>
          </Space>
        ),
      },
    ],
    [nowTick],
  );

  const dischargeRemaining = dischargeTarget
    ? remainingSecondsOf(dischargeTarget, nowTick)
    : 0;
  const dischargeReady =
    dischargeTarget?.status === "discharged" || dischargeRemaining === 0;

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3, 12px)",
          marginBottom: "var(--space-3, 12px)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2, 8px)",
          }}
        >
          <Clock size={16} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {t("contrastObservation.title")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted, #8b949e)",
              }}
            >
              {t("contrastObservation.subtitle")}
            </div>
          </div>
          <Tag color={source === "seed" ? "orange" : "blue"}>
            {t(
              source === "seed"
                ? "contrastObservation.sourceSeed"
                : "contrastObservation.sourceDb",
            )}
          </Tag>
        </div>
        <Space wrap>
          <AppSelectField
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter((value as StatusFilter) ?? "all")
            }
            style={{ width: 160 }}
            options={[
              { value: "all", label: t("contrastObservation.filterAll") },
              {
                value: "observing",
                label: t("contrastObservation.filterObserving"),
              },
              {
                value: "discharged",
                label: t("contrastObservation.filterDischarged"),
              },
              {
                value: "reaction",
                label: t("contrastObservation.filterReaction"),
              },
            ]}
          />
          <Button
            size="small"
            icon={<RefreshCw size={13} />}
            onClick={() => void load()}
          >
            {t("contrastObservation.refresh")}
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: "var(--space-3, 12px)" }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t("contrastObservation.statObserving")}
              value={stats.observing}
              valueStyle={{ color: "var(--color-info-600, #0891b2)" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t("contrastObservation.statDischarged")}
              value={stats.discharged}
              valueStyle={{ color: "var(--color-success-500, #22c55e)" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t("contrastObservation.statReaction")}
              value={stats.reaction}
              prefix={<Siren size={14} />}
              valueStyle={{ color: "var(--color-error-500, #ef4444)" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t("contrastObservation.statOverdue")}
              value={stats.overdue}
              valueStyle={{ color: "var(--color-warning-500, #f59e0b)" }}
            />
          </Card>
        </Col>
      </Row>

      {loadError && !loading && <ErrorBanner message={loadError} />}

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        emptyText={t("contrastObservation.empty")}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        layoutWidth={960}
      />

      <Modal
        open={recordTarget !== null}
        title={t("contrastObservation.recordTitle")}
        onCancel={() => setRecordTarget(null)}
        onOk={() => void submitRecord()}
        confirmLoading={submitting}
        okText={t("contrastObservation.recordSubmit")}
        cancelText={t("w2d.cancel")}
        destroyOnClose
      >
        {recordTarget && (
          <div
            style={{
              display: "grid",
              gap: "var(--space-3, 12px)",
              paddingTop: "var(--space-1, 4px)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {recordTarget.patientName || recordTarget.patientId} ·{" "}
              {new Date(recordTarget.startedAt).toLocaleString()}
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-1, 4px)",
                }}
              >
                {t("contrastObservation.symptoms")}
              </div>
              <Input.TextArea
                rows={3}
                value={recordForm.symptoms}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, symptoms: e.target.value })
                }
                placeholder={t("contrastObservation.symptomsPlaceholder")}
                maxLength={500}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-1, 4px)",
                }}
              >
                {t("contrastObservation.actions")}
              </div>
              <Input.TextArea
                rows={2}
                value={recordForm.action}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, action: e.target.value })
                }
                placeholder={t("contrastObservation.actionsPlaceholder")}
                maxLength={500}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={dischargeTarget !== null}
        title={t("contrastObservation.dischargeTitle")}
        onCancel={() => setDischargeTarget(null)}
        onOk={() => void submitDischarge()}
        confirmLoading={submitting}
        okText={t("contrastObservation.dischargeSubmit")}
        cancelText={t("w2d.cancel")}
        okButtonProps={{ disabled: !dischargeReady && !doctorRelease }}
        destroyOnClose
      >
        {dischargeTarget && (
          <div
            style={{
              display: "grid",
              gap: "var(--space-3, 12px)",
              paddingTop: "var(--space-1, 4px)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {dischargeTarget.patientName || dischargeTarget.patientId} ·{" "}
              {t("contrastObservation.remainingLabel")}{" "}
              {formatClock(dischargeRemaining)}
            </div>
            {!dischargeReady && (
              <div style={{ fontSize: 12, color: "var(--color-warning-500)" }}>
                {t("contrastObservation.durationNotMet")}
              </div>
            )}
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-1, 4px)",
                }}
              >
                {t("contrastObservation.dischargeNotes")}
              </div>
              <Input.TextArea
                rows={2}
                value={dischargeNotes}
                onChange={(e) => setDischargeNotes(e.target.value)}
                placeholder={t("contrastObservation.dischargeNotesPlaceholder")}
                maxLength={500}
              />
            </div>
            {!dischargeReady && (
              <Checkbox
                checked={doctorRelease}
                onChange={(e) => setDoctorRelease(e.target.checked)}
              >
                {t("contrastObservation.doctorRelease")}
              </Checkbox>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
