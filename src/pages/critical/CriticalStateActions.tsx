import { Button, Popconfirm } from "antd";
import {
  Send,
  Phone,
  CheckCircle,
  FileSignature,
  PlayCircle,
  Archive,
  ArrowUp,
  Ban,
  Trash2,
} from "lucide-react";
import type { CriticalValue } from "./types";
import { t } from "../../i18n/appI18n";

// [v3.0.6.11-107] 来源: backend/src/criticals/criticals.service.ts CRITICAL_TRANSITIONS
//   (10 态闭环状态机, 前端只渲染当前态合法下一步)
export const CRITICAL_TRANSITIONS: Record<string, string[]> = {
  FOUND: ["NOTIFIED", "ESCALATED", "CANCELLED"],
  NOTIFIED: ["VOICE_CALLED", "ACKNOWLEDGED", "ESCALATED", "CANCELLED"],
  VOICE_CALLED: ["ACKNOWLEDGED", "ESCALATED", "CANCELLED"],
  ACKNOWLEDGED: ["RECEIPTED", "RESOLVING", "ESCALATED"],
  RECEIPTED: ["RESOLVING", "ESCALATED"],
  RESOLVING: ["RESOLVED", "ESCALATED"],
  RESOLVED: ["CLOSED_LOOP", "CANCELLED"],
  CLOSED_LOOP: [],
  ESCALATED: ["ACKNOWLEDGED", "CANCELLED"],
  CANCELLED: [],
};

export const STATUS_TO_STATE: Record<string, string> = {
  pending: "FOUND",
  notified: "NOTIFIED",
  voice_called: "VOICE_CALLED",
  acknowledged: "ACKNOWLEDGED",
  receipted: "RECEIPTED",
  resolving: "RESOLVING",
  resolved: "RESOLVED",
  closed_loop: "CLOSED_LOOP",
  escalated: "ESCALATED",
  cancelled: "CANCELLED",
};

export const STATE_TO_STATUS: Record<string, string> = {
  FOUND: "pending",
  NOTIFIED: "notified",
  VOICE_CALLED: "voice_called",
  ACKNOWLEDGED: "acknowledged",
  RECEIPTED: "receipted",
  RESOLVING: "resolving",
  RESOLVED: "resolved",
  CLOSED_LOOP: "closed_loop",
  ESCALATED: "escalated",
  CANCELLED: "cancelled",
};

export function toCriticalState(
  cv: Pick<CriticalValue, "state" | "status">,
): string {
  const raw = String(cv.state ?? "").toUpperCase();
  if (CRITICAL_TRANSITIONS[raw]) return raw;
  return STATUS_TO_STATE[String(cv.status ?? "").toLowerCase()] ?? "FOUND";
}

export interface CriticalActionHandlers {
  onNotify: () => void;
  onVoiceCall: () => void;
  onAcknowledge: () => void;
  onClinicalReceipt: () => void;
  onResolving: () => void;
  onResolved: () => void;
  onCloseLoop: () => void;
  onEscalate: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

interface CriticalStateActionsProps {
  cv: Pick<CriticalValue, "state" | "status">;
  handlers: CriticalActionHandlers;
  busy?: boolean;
}

const actionBtnStyle: React.CSSProperties = { fontSize: 12 };

export const CriticalStateActions = ({
  cv,
  handlers,
  busy = false,
}: CriticalStateActionsProps) => {
  const state = toCriticalState(cv);
  const allowed = CRITICAL_TRANSITIONS[state] ?? [];
  return (
    <div
      style={{ display: "flex", gap: "var(--space-1, 4px)", flexWrap: "wrap" }}
    >
      {allowed.includes("NOTIFIED") && (
        <Button
          size="small"
          type="primary"
          style={actionBtnStyle}
          icon={<Send size={12} />}
          disabled={busy}
          onClick={handlers.onNotify}
        >
          {t("cvList.action.notify")}
        </Button>
      )}
      {allowed.includes("VOICE_CALLED") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<Phone size={12} />}
          disabled={busy}
          onClick={handlers.onVoiceCall}
        >
          {t("cvList.action.voiceCall")}
        </Button>
      )}
      {allowed.includes("ACKNOWLEDGED") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<CheckCircle size={12} />}
          disabled={busy}
          onClick={handlers.onAcknowledge}
        >
          {t("cvList.action.acknowledge")}
        </Button>
      )}
      {allowed.includes("RECEIPTED") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<FileSignature size={12} />}
          disabled={busy}
          onClick={handlers.onClinicalReceipt}
        >
          {t("cvList.action.receipt")}
        </Button>
      )}
      {allowed.includes("RESOLVING") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<PlayCircle size={12} />}
          disabled={busy}
          onClick={handlers.onResolving}
        >
          {t("cvList.action.resolving")}
        </Button>
      )}
      {allowed.includes("RESOLVED") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<CheckCircle size={12} />}
          disabled={busy}
          onClick={handlers.onResolved}
        >
          {t("cvList.action.resolved")}
        </Button>
      )}
      {allowed.includes("CLOSED_LOOP") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<Archive size={12} />}
          disabled={busy}
          onClick={handlers.onCloseLoop}
        >
          {t("cvList.action.closeLoop")}
        </Button>
      )}
      {allowed.includes("ESCALATED") && (
        <Button
          size="small"
          style={actionBtnStyle}
          icon={<ArrowUp size={12} />}
          disabled={busy}
          onClick={handlers.onEscalate}
        >
          {t("cvList.action.escalate")}
        </Button>
      )}
      {allowed.includes("CANCELLED") && (
        <Popconfirm
          title={t("cvList.cancelTitle")}
          description={t("cvList.cancelDesc")}
          onConfirm={handlers.onCancel}
          okText={t("cvList.cancelOk")}
          cancelText={t("cvList.deleteCancel")}
        >
          <Button
            size="small"
            style={actionBtnStyle}
            icon={<Ban size={12} />}
            disabled={busy}
          >
            {t("cvList.action.cancel")}
          </Button>
        </Popconfirm>
      )}
      {state === "FOUND" && (
        <Popconfirm
          title={t("cvList.deleteMisentryTitle")}
          description={t("cvList.deleteMisentryDesc")}
          onConfirm={handlers.onDelete}
          okText={t("cvList.deleteOk")}
          cancelText={t("cvList.deleteCancel")}
          okButtonProps={{ danger: true }}
        >
          <Button
            size="small"
            danger
            style={actionBtnStyle}
            icon={<Trash2 size={12} />}
            disabled={busy}
          >
            {t("cvList.action.deleteMisentry")}
          </Button>
        </Popconfirm>
      )}
    </div>
  );
};

export default CriticalStateActions;
