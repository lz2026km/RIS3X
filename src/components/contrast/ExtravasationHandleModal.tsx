import { useEffect, useState } from "react";
import { Input, Modal, message } from "antd";
import { contrastSafetyApi } from "../../services/api/contrastSafetyApi";
import type { ExtravasationEvent } from "../../services/api/contrastSafetyApi";
import { AppSelectField } from "../common/AppSelectField";
import { t } from "../../i18n/appI18n";

interface Props {
  event: ExtravasationEvent | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const OUTCOME_OPTIONS = [
  { value: "resolved", label: t("contrast.extravasation.outcome.resolved") },
  { value: "stable", label: t("contrast.extravasation.outcome.stable") },
  { value: "follow_up", label: t("contrast.extravasation.outcome.followUp") },
];

export default function ExtravasationHandleModal({
  event,
  onClose,
  onSuccess,
}: Props) {
  const [measures, setMeasures] = useState("");
  const [outcome, setOutcome] = useState("resolved");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event) return;
    setMeasures(event.management ?? "");
    setOutcome(event.followUp ?? "resolved");
    setNote("");
  }, [event]);

  const submit = async () => {
    if (!event) return;
    if (!measures.trim()) {
      message.warning(t("contrast.extravasation.measuresRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await contrastSafetyApi.handleExtravasation(event.id, {
        management: measures.trim(),
        followUp: outcome,
        note: note.trim() || undefined,
        handledBy: "current-user",
      });
      if (res.success) {
        message.success(t("contrast.extravasation.handleSuccess"));
        onClose();
        onSuccess?.();
      } else {
        message.error(
          res.error?.message ?? t("contrast.extravasation.handleFailed"),
        );
      }
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("contrast.extravasation.handleFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={event !== null}
      title={t("contrast.extravasation.handleTitle")}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={busy}
      okText={t("contrast.extravasation.handle")}
      cancelText={t("w2d.cancel")}
      destroyOnClose
    >
      {event && (
        <div
          style={{
            display: "grid",
            gap: "var(--space-3, 12px)",
            paddingTop: "var(--space-1, 4px)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {event.patientId} · {event.site} · {event.severity} ·{" "}
            {event.estimatedVolumeMl} mL
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1, 4px)",
              }}
            >
              {t("contrast.extravasation.measures")}
            </div>
            <Input.TextArea
              rows={3}
              value={measures}
              onChange={(e) => setMeasures(e.target.value)}
              placeholder={t("contrast.extravasation.measures")}
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
              {t("contrast.extravasation.outcome")}
            </div>
            <AppSelectField
              value={outcome}
              onChange={(v) => setOutcome(String(v ?? "resolved"))}
              options={OUTCOME_OPTIONS}
              style={{ width: "100%" }}
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
              {t("contrast.extravasation.note")}
            </div>
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("contrast.extravasation.note")}
              maxLength={500}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
