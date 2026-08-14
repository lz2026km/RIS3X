import { XCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
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

export default function DeviceHistoryModal({ device, onClose }: Props) {
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
          padding: 24,
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
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e40af" }}>
              {device} 历史趋势
              <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#fffbeb", color: "#d97706", border: "1px solid #fcd34d", fontWeight: 600, verticalAlign: "middle" }}>演示数据（模拟 7 日历史）</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              近7日剂量趋势分析
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: "var(--bg-primary)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <XCircle size={18} color="#64748b" />
          </button>
        </div>

        <ChartContainer height={200} state={MOCK_HISTORY.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <LineChart data={MOCK_HISTORY}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="DLP"
              stroke="#3b82f6"
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
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <ModalStat label="7日平均DLP" value="840" />
          <ModalStat label="7日平均CTDI" value="22.6" />
          <ModalStat label="总检查量" value="177" />
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
      padding: 12,
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: "#1e40af" }}>{value}</div>
  </div>
);