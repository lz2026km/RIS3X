import { t } from "../../i18n/appI18n";
import { Search } from "lucide-react";

interface DoseSearchPanelProps {
  view: string;
  setView: (view: any) => void;
  searchText: string;
  setSearchText: (text: string) => void;
  modalityFilter: string;
  setModalityFilter: (modality: string) => void;
  alertFilter: string;
  setAlertFilter: (alert: string) => void;
  modalities: string[];
}

export default function DoseSearchPanel({
  view,
  setView,
  searchText,
  setSearchText,
  modalityFilter,
  setModalityFilter,
  alertFilter,
  setAlertFilter,
  modalities,
}: DoseSearchPanelProps) {
  // [v3.0.6.8-31] t() 来自 appI18n (内联 dict 含 doseTrack.* 翻译)
  const tabs = [
    { key: "overview", label: t("doseTrack.tabs.overview") },
    { key: "live", label: "实时监测" },
    { key: "patient", label: t("doseTrack.tabs.patient") },
    { key: "device", label: t("doseTrack.tabs.device") },
    { key: "alert", label: t("doseTrack.tabs.alert") },
    { key: "aapm", label: t("doseTrack.tabs.aapm") },
    { key: "trend", label: t("doseTrack.tabs.trend") },
    { key: "breast", label: t("doseTrack.tabs.breast") },
    { key: "pediatric", label: t("doseTrack.tabs.pediatric") },
    { key: "dicom", label: t("doseTrack.tabs.dicom") },
    { key: "cumulative", label: t("doseTrack.tabs.cumulative") },
    { key: "drl", label: t("doseTrack.tabs.drl") },
    { key: "pediatricopt", label: t("doseTrack.tabs.pediatricopt") },
    { key: "staff", label: t("doseTrack.tabs.staff") },
    { key: "spc", label: t("doseTrack.tabs.spc") },
  ] as const;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--bg-primary)",
          padding: 4,
          borderRadius: 8,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: view === v.key ? "var(--bg-card)" : "transparent",
              color: view === v.key ? "#1e40af" : "#64748b",
              boxShadow:
                view === v.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder={t("doseTrack.searchPlaceholder")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: "6px 10px 6px 30px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              width: 180,
              outline: "none",
            }}
          />
        </div>
        {view !== "alert" &&
          view !== "aapm" &&
          view !== "trend" &&
          view !== "breast" &&
          view !== "pediatric" && (
            <select
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#334155",
                outline: "none",
              }}
            >
              {modalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        {view === "alert" && (
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#334155",
              outline: "none",
            }}
          >
            <option value="全部">{t("doseTrack.allStatus")}</option>
            <option value="pending">{t("doseTrack.statusPending")}</option>
            <option value="acknowledged">{t("doseTrack.statusAcknowledged")}</option>
          </select>
        )}
      </div>
    </div>
  );
}
