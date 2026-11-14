import { useEffect, useMemo, useState } from "react";
import { Descriptions, Drawer, Space, Tag } from "antd";
import { t } from "../../i18n/appI18n";
import { hl7Api } from "../../services/api/integrationApi";

export interface Hl7ArchiveMessage {
  id: number;
  messageType: string;
  controlId: string;
  rawMessage: string;
  createdAt?: string;
}

interface Hl7OruDetailDrawerProps {
  record: Hl7ArchiveMessage | null;
  onClose: () => void;
}

interface ParsedSegment {
  name: string;
  fields: string[];
}

function parseSegments(raw: string): ParsedSegment[] {
  const normalized = String(raw ?? "")
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r");
  return normalized
    .split("\r")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const fields = line.split("|");
      return { name: fields[0] ?? "", fields };
    });
}

function field(segment: ParsedSegment | undefined, index: number): string {
  const value = segment?.fields[index];
  return value && value.trim().length > 0 ? value.trim() : "--";
}

function displayName(value: string): string {
  if (!value || value === "--") return "--";
  return value.replace(/\^/g, " ").trim() || "--";
}

export default function Hl7OruDetailDrawer({
  record,
  onClose,
}: Hl7OruDetailDrawerProps) {
  const isOru = String(record?.messageType ?? "").startsWith("ORU");
  const [detailRaw, setDetailRaw] = useState<string | null>(null);
  useEffect(() => {
    setDetailRaw(null);
    if (!record || !isOru) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await hl7Api.getOruMessageByControlId(record.controlId);
        if (cancelled || !res || !res.success || !res.data) return;
        const raw = (res.data as Record<string, unknown>)["rawMessage"];
        if (typeof raw === "string" && raw.trim()) setDetailRaw(raw);
      } catch {
        /* 详情接口不可用: 保留归档原文 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record, isOru]);
  const segments = useMemo(
    () => parseSegments(detailRaw ?? record?.rawMessage ?? ""),
    [detailRaw, record?.rawMessage],
  );
  const msh = segments.find((segment) => segment.name === "MSH");
  const pid = segments.find((segment) => segment.name === "PID");
  const obr = segments.find((segment) => segment.name === "OBR");
  const obx = segments.filter((segment) => segment.name === "OBX");

  return (
    <Drawer
      open={record !== null}
      onClose={onClose}
      width={720}
      destroyOnClose
      title={
        <Space size={8}>
          <span>{t("hl7Archive.detailTitle")}</span>
          {record && <Tag color="purple">{record.messageType}</Tag>}
          {record && (
            <span style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}>
              {record.controlId}
            </span>
          )}
        </Space>
      }
    >
      {record && (
        <div
          style={{
            display: "grid",
            gap: "var(--space-4, 16px)",
          }}
        >
          {!isOru && (
            <div style={{ fontSize: 12, color: "var(--color-warning-500)" }}>
              {t("hl7Oru.notOru")}
            </div>
          )}

          {isOru && (
            <>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t("hl7Oru.segmentMsh")}
                </div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label={t("hl7Oru.sendingApp")}>
                    {field(msh, 2)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.sendingFacility")}>
                    {field(msh, 3)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.receivingApp")}>
                    {field(msh, 4)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.receivingFacility")}>
                    {field(msh, 5)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.messageTime")}>
                    {field(msh, 6)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.messageType")}>
                    {field(msh, 8)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.controlId")}>
                    {field(msh, 9)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.version")}>
                    {field(msh, 11)}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t("hl7Oru.segmentPid")}
                </div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label={t("hl7Oru.patientId")}>
                    {field(pid, 3)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.patientName")}>
                    {displayName(field(pid, 5))}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.birthDate")}>
                    {field(pid, 7)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.sex")}>
                    {field(pid, 8)}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t("hl7Oru.segmentObr")}
                </div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label={t("hl7Oru.placerOrder")}>
                    {field(obr, 2)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.accession")}>
                    {field(obr, 3)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.service")}>
                    {field(obr, 4)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.observationTime")}>
                    {field(obr, 7)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("hl7Oru.orderingProvider")}>
                    {displayName(field(obr, 16))}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {t("hl7Oru.segmentObx")} ({obx.length})
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-2, 8px)",
                  }}
                >
                  {obx.length === 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted, #8b949e)",
                      }}
                    >
                      {t("hl7Oru.empty")}
                    </div>
                  )}
                  {obx.map((segment, index) => (
                    <div
                      key={`${segment.fields[1] ?? index}-${index}`}
                      style={{
                        border: "1px solid var(--border-default, #30363d)",
                        borderRadius: 6,
                        padding: "var(--space-3, 12px)",
                      }}
                    >
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label={t("hl7Oru.setId")}>
                          {field(segment, 1)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("hl7Oru.valueType")}>
                          {field(segment, 2)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("hl7Oru.identifier")}>
                          {field(segment, 3)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("hl7Oru.value")}>
                          {field(segment, 5)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("hl7Oru.resultStatus")}>
                          {field(segment, 11)}
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {t("hl7Oru.rawMessage")}
            </div>
            <pre
              style={{
                background: "var(--bg-primary, #0d1117)",
                color: "var(--text-primary, #f0f6fc)",
                padding: "var(--space-3, 12px)",
                borderRadius: 6,
                fontSize: 12,
                overflow: "auto",
                maxHeight: 240,
                whiteSpace: "pre-wrap",
              }}
            >
              {record.rawMessage || "--"}
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  );
}
