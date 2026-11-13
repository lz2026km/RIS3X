import { Button, message } from "antd";
import { Copy } from "lucide-react";
import { t } from "../../i18n/appI18n";

export interface UidCopyFieldProps {
  label: string;
  value?: string | null;
  compact?: boolean;
}

export function UidCopyField({ label, value, compact }: UidCopyFieldProps) {
  const text = value?.trim() ? value.trim() : "--";
  const canCopy = text !== "--";

  const handleCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(text);
      message.success(t("common.copied"));
    } catch {
      message.error(t("common.copyFailed"));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? 0 : "6px 8px",
        background: compact ? "transparent" : "var(--bg-primary)",
        borderRadius: 6,
        border: compact ? "none" : "1px solid var(--border-color)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-muted, #64748b)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={text}
      >
        {text}
      </span>
      <Button
        size="small"
        type="text"
        icon={<Copy size={12} />}
        onClick={() => void handleCopy()}
        disabled={!canCopy}
        aria-label={t("common.copy")}
        title={t("common.copy")}
      />
    </div>
  );
}

export default UidCopyField;
