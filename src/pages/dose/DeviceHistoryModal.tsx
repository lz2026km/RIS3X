import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { rdsrApi } from "../../services/api/rdsrApi";
import { t } from "../../i18n/appI18n";
import { ErrorBanner } from "../../components/feedback";
import ChartContainer from "../../components/charts/ChartContainer";

interface HistoryPoint {
  date: string;
  DLP: number;
  CTDI: number;
  examCount: number;
}

interface Props {
  device: string;
  onClose: () => void;
}

const MOCK_HISTORY: HistoryPoint[] = [
  { date: "04-25", DLP: 820, CTDI: 22.5, examCount: 25 },
  { date: "04-26", DLP: 780, CTDI: 21.2, examCount: 23 },
  { date: "04-27", DLP: 950, CTDI: 25.8, examCount: 28 },
  { date: "04-28", DLP: 690, CTDI: 18.5, examCount: 20 },
  { date: "04-29", DLP: 850, CTDI: 23.2, examCount: 26 },
  { date: "04-30", DLP: 920, CTDI: 24.5, examCount: 27 },
  { date: "05-01", DLP: 850, CTDI: 22.5, examCount: 28 },
];

// [G005 W8-Dose] 设备历史: 优先取 /rdsr/device/:id/history, 端点不可用/返回空时回退本地演示。
export default function DeviceHistoryModal({ device, onClose }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>(MOCK_HISTORY);
  const [dataSource, setDataSource] = useState<"api" | "demo">("demo");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getDeviceHistory(device);
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setHistory(
            res.data.map((p) => ({
              date: p.date,
              DLP: p.DLP,
              CTDI: p.CTDIvol,
              examCount: p.examCount,
            })),
          );
          setDataSource("api");
        } else if (!cancelled && !res.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch {
        setLoadError(t('w9.states.error'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device, reloadTick]);

  const avgDlp = history.length
    ? Math.round(history.reduce((s, p) => s + p.DLP, 0) / history.length)
    : 0;
  const avgCtdi = history.length
    ? (history.reduce((s, p) => s + p.CTDI, 0) / history.length).toFixed(1)
    : "0.0";
  const totalExams = history.reduce((s, p) => s + p.examCount, 0);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 'var(--space-6, 24px)',
          width: 600,
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 'var(--space-5, 20px)',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-primary-800)" }}>
              {device} 历史趋势
              {dataSource === "demo" && (
                <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--color-warning-bg, #fffbeb)", color: "var(--color-warning-600)", border: "1px solid var(--color-warning-300, #fcd34d)", fontWeight: 600, verticalAlign: "middle" }}>{t("w8Dose.deviceHistoryDemo")}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 'var(--space-1, 4px)' }}>
              近7日剂量趋势分析
            </div>
          </div>
          <button aria-label="关闭"
            onClick={onClose}
            style={{
              padding: 'var(--space-2, 8px)',
              background: "var(--bg-primary)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <XCircle size={18} color="#64748b" />
          </button>
        </div>

        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}

        <ChartContainer height={200} state={history.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="DLP"
              stroke="var(--color-primary-500)"
              strokeWidth={2}
              name="DLP"
            />
            <Line
              type="monotone"
              dataKey="CTDI"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="CTDIvol"
            />
          </LineChart>
        </ChartContainer>

        <div
          style={{
            marginTop: 'var(--space-4, 16px)',
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 'var(--space-3, 12px)',
          }}
        >
          <ModalStat label="7日平均DLP" value={String(avgDlp)} />
          <ModalStat label="7日平均CTDI" value={avgCtdi} />
          <ModalStat label="总检查量" value={String(totalExams)} />
        </div>
      </div>
    </div>
  );
}

const ModalStat = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      background: "var(--bg-primary)",
      borderRadius: 8,
      padding: 'var(--space-3, 12px)',
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary-800)" }}>{value}</div>
  </div>
);