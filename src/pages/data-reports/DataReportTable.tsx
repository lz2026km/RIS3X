// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Activity, Award, Gauge, Video, LayoutDashboard, Send, FolderTree, Sliders, BarChart4,
  PieChart as PieChartIcon, Upload, Download, FileText, CheckCircle, AlertTriangle, Clock,
  Monitor, Scan, Radio, Image, Target, Zap, Users, MessageSquare, Plus, X, Save, Trash2,
  Eye, ChevronRight, Circle, GripVertical, Layers, Cell, TrendingUp, TrendingDown,
  Check, ArrowRight, Copy, Move, Maximize2, Minimize2, Share2, GitBranch, Table2,
  Sigma, MousePointer, Edit3, MoreVertical, Settings, Calendar, Search, Filter, RefreshCw,
  Database, Building2, Network, Server, Globe, AlertCircle, CheckSquare, Wrench, Timer,
  Percent, ShieldCheck, User,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area,
} from "recharts";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { t } from '../../i18n/appI18n';
import { COLORS, styles, StatCard, DeviceUsageChart, QualityScoreChart, DoseTrendChart, ConsultationPieChart, ExamVolumeChart } from './DataReportCharts';
import { datareportApi, type NationalReportDto, type DataReportDto } from '../../services/api/datareportApi';

// ============ 鏁版嵁 ============
const REPORT_STATUS_COLORS = { 宸蹭笂鎶? COLORS.success, 寰呬笂鎶? COLORS.warning, 涓婃姤涓? COLORS.primaryLight, 涓婃姤澶辫触: COLORS.danger, 宸茬‘璁? COLORS.success, 寰呯‘璁? COLORS.warning };

const examVolumeData = [
  { month: "1鏈?, CT: 2450, MR: 1580, DR: 4200, MG: 380, DSA: 120 },
  { month: "2鏈?, CT: 2280, MR: 1420, DR: 3850, MG: 350, DSA: 105 },
  { month: "3鏈?, CT: 2650, MR: 1680, DR: 4450, MG: 420, DSA: 135 },
  { month: "4鏈?, CT: 2520, MR: 1720, DR: 4380, MG: 400, DSA: 128 },
  { month: "5鏈?, CT: 2780, MR: 1850, DR: 4620, MG: 440, DSA: 142 },
  { month: "6鏈?, CT: 2890, MR: 1920, DR: 4800, MG: 460, DSA: 155 },
];

const deviceUsageData = [
  { name: "CT-1", usage: 92, avgReport: 45, status: "姝ｅ父杩愯" },
  { name: "CT-2", usage: 78, avgReport: 52, status: "姝ｅ父杩愯" },
  { name: "MR-1", usage: 88, avgReport: 38, status: "姝ｅ父杩愯" },
  { name: "MR-2", usage: 65, avgReport: 42, status: "缁存姢涓? },
  { name: "DR-1", usage: 85, avgReport: 28, status: "姝ｅ父杩愯" },
  { name: "DR-2", usage: 72, avgReport: 25, status: "姝ｅ父杩愯" },
  { name: "DSA", usage: 58, avgReport: 68, status: "姝ｅ父杩愯" },
  { name: "MG", usage: 82, avgReport: 22, status: "姝ｅ父杩愯" },
];

const qualityScoreData = [
  { name: "CT", score: 96.5, excellent: 89, good: 8, pass: 3, fail: 0 },
  { name: "MR", score: 94.8, excellent: 85, good: 10, pass: 4, fail: 1 },
  { name: "DR", score: 98.2, excellent: 92, good: 6, pass: 2, fail: 0 },
  { name: "MG", score: 93.6, excellent: 82, good: 12, pass: 5, fail: 1 },
  { name: "DSA", score: 97.1, excellent: 91, good: 7, pass: 2, fail: 0 },
];

const doseData = [
  { month: "1鏈?, CT_DLP: 42500, CT_Dose: 1250, DR_Dose: 85, MG_Dose: 12 },
  { month: "2鏈?, CT_DLP: 41200, CT_Dose: 1180, DR_Dose: 82, MG_Dose: 11 },
  { month: "3鏈?, CT_DLP: 43800, CT_Dose: 1320, DR_Dose: 88, MG_Dose: 13 },
  { month: "4鏈?, CT_DLP: 42100, CT_Dose: 1280, DR_Dose: 86, MG_Dose: 12 },
  { month: "5鏈?, CT_DLP: 45200, CT_Dose: 1380, DR_Dose: 90, MG_Dose: 14 },
  { month: "6鏈?, CT_DLP: 46800, CT_Dose: 1420, DR_Dose: 92, MG_Dose: 14 },
];

const consultationData = [
  { type: "鐤戦毦鐥呬緥浼氳瘖", total: 156, completed: 142, pending: 12, avgTime: "2.5h" },
  { type: "杩滅▼褰卞儚浼氳瘖", total: 89, completed: 85, pending: 4, avgTime: "1.8h" },
  { type: "鏈腑蹇€熷啺鍐?, total: 45, completed: 45, pending: 0, avgTime: "0.5h" },
  { type: "涓村簥绉戝浼氳瘖", total: 234, completed: 220, pending: 14, avgTime: "3.2h" },
];

const pendingReports = [
  { id: "RPT20260501001", patient: "寮犱紵", modality: "CT", examType: "鑳搁儴澧炲己", doctor: "鏉庢槑", reportTime: "2026-05-02 09:30", status: "寰呬笂鎶? },
  { id: "RPT20260501002", patient: "鐜嬭姵", modality: "MR", examType: "棰呰剳骞虫壂", doctor: "璧靛己", reportTime: "2026-05-02 10:15", status: "寰呬笂鎶? },
  { id: "RPT20260501003", patient: "鏉庡", modality: "DR", examType: "鑳搁儴姝ｄ晶浣?, doctor: "瀛欑", reportTime: "2026-05-02 11:00", status: "涓婃姤涓? },
  { id: "RPT20260501004", patient: "鍒樻磱", modality: "CT", examType: "鑵归儴澧炲己", doctor: "鏉庢槑", reportTime: "2026-05-02 14:20", status: "寰呬笂鎶? },
  { id: "RPT20260501005", patient: "闄堥潤", modality: "MG", examType: "涔宠吅閽奸澏", doctor: "鍛ㄧ惓", reportTime: "2026-05-02 15:45", status: "涓婃姤澶辫触" },
];

const widgetPaletteItems = [
  { id: "bar", label: "鏌辩姸鍥?, icon: "BarChart3" },
  { id: "line", label: "鎶樼嚎鍥?, icon: "LineChart" },
  { id: "pie", label: "楗煎浘", icon: "PieChart" },
  { id: "table", label: "鏁版嵁琛?, icon: "Table2" },
  { id: "kpi", label: "KPI鍗＄墖", icon: "LayoutDashboard" },
  { id: "text", label: "鏂囨湰", icon: "FileText" },
];

const mockSavedLayouts = [
  { id: "L1", name: "鏈堝害杩愯惀鎶ヨ〃", widgets: 4, lastModified: "2026-05-01", createdBy: "绠＄悊鍛? },
  { id: "L2", name: "绉戝缁╂晥鐪嬫澘", widgets: 6, lastModified: "2026-04-28", createdBy: "鏉庝富浠? },
  { id: "L3", name: "璁惧鍒╃敤鐜囨姤鍛?, widgets: 3, lastModified: "2026-04-25", createdBy: "璁惧绉? },
];

const mockSchedules = [
  { id: "S1", name: "鏈堝害鎶ュ憡", frequency: "姣忔湀", format: "PDF", recipients: ["闄㈤暱鍔?, "鍖诲姟绉?], lastSent: "2026-05-01", nextSend: "2026-06-01", status: "鍚敤" },
  { id: "S2", name: "鍛ㄦ姤", frequency: "姣忓懆", format: "Excel", recipients: ["绉戝涓讳换", "璐ㄦ帶缁?], lastSent: "2026-05-04", nextSend: "2026-05-11", status: "鍚敤" },
  { id: "S3", name: "瀛ｅ害璐ㄦ帶鎶ュ憡", frequency: "姣忓搴?, format: "HTML", recipients: ["璐ㄦ帶濮斿憳浼?], lastSent: "2026-04-01", nextSend: "2026-07-01", status: "鏆傚仠" },
];

const mockDistLog = [
  { id: "D1", schedule: "鏈堝害鎶ュ憡", sentAt: "2026-05-01 08:00", format: "PDF", recipients: "闄㈤暱鍔? 鍖诲姟绉?, status: "鎴愬姛" },
  { id: "D2", schedule: "鍛ㄦ姤", sentAt: "2026-05-04 09:00", format: "Excel", recipients: "绉戝涓讳换, 璐ㄦ帶缁?, status: "鎴愬姛" },
  { id: "D3", schedule: "鏈堝害鎶ュ憡", sentAt: "2026-04-01 08:00", format: "PDF", recipients: "闄㈤暱鍔? 鍖诲姟绉?, status: "鎴愬姛" },
  { id: "D4", schedule: "鍛ㄦ姤", sentAt: "2026-04-27 09:00", format: "Excel", recipients: "绉戝涓讳换, 璐ㄦ帶缁?, status: "澶辫触" },
];

const mockBenchmarkData = [
  { metric: "妫€鏌ラ噺(鏈堝潎)", own: 2968, peer1: 3200, peer2: 2800, peer3: 3100, percentile: 65, gap: "-7.2%" },
  { metric: "璁惧浣跨敤鐜?%)", own: 88, peer1: 92, peer2: 85, peer3: 90, percentile: 70, gap: "-4.3%" },
  { metric: "鎶ュ憡骞冲潎鏃舵晥(min)", own: 32, peer1: 28, peer2: 35, peer3: 30, percentile: 60, gap: "+14.3%" },
  { metric: "璐ㄦ帶璇勫垎", own: 96.5, peer1: 97.2, peer2: 95.8, peer3: 96.8, percentile: 55, gap: "-0.7%" },
  { metric: "闃虫€ф鍑虹巼(%)", own: 67, peer1: 65, peer2: 70, peer3: 68, percentile: 72, gap: "+3.1%" },
  { metric: "鍗辨€ュ€奸€氭姤鐜?%)", own: 100, peer1: 98, peer2: 100, peer3: 99, percentile: 90, gap: "0%" },
];

// ============ Sortable item for drag-drop ============
const SortableItem = ({ id, label, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "6px 10px",
    background: isDragging ? "#dbeafe" : "#f0f9ff",
    borderRadius: "6px",
    border: "1px solid #bfdbfe",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    cursor: "grab",
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GripVertical size={12} color="#94a3b8" />
      <span style={{ flex: 1 }}>{label}</span>
      {onRemove && <X size={12} style={{ cursor: "pointer", color: "#ef4444" }} onClick={() => onRemove(id)} />}
    </div>
  );
};

// ============ 缁勪欢: ReportBuilder ============
const ReportBuilder = () => {
  const [canvasWidgets, setCanvasWidgets] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [savedLayouts, setSavedLayouts] = useState(mockSavedLayouts);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const [metadata, setMetadata] = useState({ metrics: [], dimensions: [] });
  const [configDims, setConfigDims] = useState([]);
  const [configMeasures, setConfigMeasures] = useState([]);
  const [configAgg, setConfigAgg] = useState("sum");
  const [configFilters, setConfigFilters] = useState([]);
  const [dataSources, setDataSources] = useState([]);

  const aggOptions = [
    { value: "sum", label: "姹傚拰 (Sum)" },
    { value: "avg", label: "骞冲潎鍊?(Avg)" },
    { value: "count", label: "璁℃暟 (Count)" },
    { value: "distinctCount", label: "鍘婚噸璁℃暟 (Distinct)" },
    { value: "min", label: "鏈€灏忓€?(Min)" },
    { value: "max", label: "鏈€澶у€?(Max)" },
  ];

  useEffect(() => {
    fetch("/api/v1/olap/metadata")
      .then((r) => r.json())
      .then((data) => {
        setMetadata(data);
        const sources = (data.metrics || []).map((m) => ({
          value: m.id,
          label: m.name,
        }));
        setDataSources(sources);
      })
      .catch(() => {});
  }, []);

  const dimSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addWidget = (widgetId) => {
    const newWidget = {
      id: `w${Date.now()}`,
      type: widgetId,
      label: widgetPaletteItems.find((w) => w.id === widgetId)?.label || widgetId,
      config: { dataSource: "exam_count", dimensions: [], measures: [], aggregation: "sum", filters: [] },
      gridPos: { x: canvasWidgets.length % 3, y: Math.floor(canvasWidgets.length / 3), w: 1, h: 1 },
    };
    setCanvasWidgets([...canvasWidgets, newWidget]);
  };

  const removeWidget = (widgetId) => {
    setCanvasWidgets(canvasWidgets.filter((w) => w.id !== widgetId));
  };

  const openConfig = (widget) => {
    setSelectedConfig(widget);
    setConfigDims(widget.config.dimensions || []);
    setConfigMeasures(widget.config.measures || []);
    setConfigAgg(widget.config.aggregation || "sum");
    setConfigFilters(widget.config.filters || []);
    setShowConfig(true);
  };

  const saveConfig = () => {
    setSelectedConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, config: { ...prev.config, dimensions: configDims, measures: configMeasures, aggregation: configAgg, filters: configFilters } };
    });
    setShowConfig(false);
  };

  const handleDimDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = configDims.indexOf(active.id);
      const newIndex = configDims.indexOf(over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        setConfigDims(arrayMove(configDims, oldIndex, newIndex));
      }
    }
  };

  const toggleDimension = (dimId) => {
    setConfigDims((prev) =>
      prev.includes(dimId) ? prev.filter((d) => d !== dimId) : [...prev, dimId],
    );
  };

  const toggleMeasure = (mId) => {
    setConfigMeasures((prev) =>
      prev.includes(mId) ? prev.filter((m) => m !== mId) : [...prev, mId],
    );
  };

  const saveLayout = () => {
    if (!layoutName.trim()) return;
    setSavedLayouts([...savedLayouts, { id: `L${Date.now()}`, name: layoutName, widgets: canvasWidgets.length, lastModified: new Date().toISOString().split("T")[0], createdBy: "褰撳墠鐢ㄦ埛" }]);
    setShowSaveDialog(false);
    setLayoutName("");
  };

  const loadLayout = (layout) => {};

  const renderWidgetPreview = (widget) => {
    const baseStyle = { background: "#f8fafc", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "12px", height: "180px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer", position: "relative" };
    const emojiMap = { bar: "馃搳", line: "馃搱", pie: "馃ェ", table: "馃搵", kpi: "馃搶", text: "馃摑" };
    return (
      <div role="button" tabIndex={0}
        aria-label={`閰嶇疆缁勪欢 ${widget.label}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openConfig(widget) } }}
        style={baseStyle} onClick={() => openConfig(widget)}>
        <div style={{ position: "absolute", top: "6px", right: "6px", display: "flex", gap: "4px" }}>
          <button aria-label="鍒犻櫎缁勪欢" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: COLORS.textMuted }} onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}><Trash2 size={12} /></button>
        </div>
        <div style={{ fontSize: "24px", color: COLORS.primary, marginBottom: "8px" }}>{emojiMap[widget.type] || "馃摑"}</div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: COLORS.textDark }}>{widget.label}</div>
        <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>鐐瑰嚮閰嶇疆</div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ ...styles.card, width: "220px", flexShrink: 0 }}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><Layers size={16} />{t('dc.widgetPanel')}</div></div>
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {widgetPaletteItems.map((item) => (
              <div key={item.id} role="button" tabIndex={0}
                aria-label={`娣诲姞缁勪欢 ${item.label}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addWidget(item.id) } }}
                style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e5e7eb", cursor: "grab", display: "flex", alignItems: "center", gap: "8px", userSelect: "none" }} onClick={() => addWidget(item.id)}>
                <GripVertical size={14} style={{ color: COLORS.textMuted }} />
                <span style={{ fontSize: "13px" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}><LayoutDashboard size={16} /> 鎶ヨ〃鐢诲竷 {canvasWidgets.length > 0 && <span style={{ fontSize: "12px", color: COLORS.textMuted }}>({canvasWidgets.length} 涓粍浠?</span>}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowSaveDialog(true)}><Save size={14} />{t('dc.saveLayout')}</button>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setCanvasWidgets([])}><Trash2 size={14} />{t('dc.clear')}</button>
              </div>
            </div>
            <div style={{ padding: "16px", minHeight: "300px" }}>
              {canvasWidgets.length === 0 ? (
                <div style={styles.emptyState}><p style={{ margin: 0 }}>{t('dc.emptyHint')}</p></div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {canvasWidgets.map((w) => <div key={w.id}>{renderWidgetPreview(w)}</div>)}
                </div>
              )}
            </div>
          </div>
          <div style={{ ...styles.card, marginTop: "12px" }}>
            <div style={styles.cardHeader}><div style={styles.cardTitle}><FolderTree size={16} />{t('dc.savedLayouts')}</div></div>
            <div style={{ padding: "12px" }}>
              {savedLayouts.map((layout) => (
                <div key={layout.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{layout.name}</div>
                    <div style={{ fontSize: "11px", color: COLORS.textMuted }}>{layout.widgets} 涓粍浠?路 {layout.lastModified} 路 {layout.createdBy}</div>
                  </div>
                  <button style={{ ...styles.btn, padding: "4px 10px", fontSize: "12px", ...styles.btnOutline }} onClick={() => loadLayout(layout)}><Eye size={12} />{t('dc.load')}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showConfig && selectedConfig && (
        <div role="dialog" aria-modal="true" aria-label="缁勪欢閰嶇疆" style={styles.modalOverlay} onClick={() => setShowConfig(false)}>
          <div style={{ ...styles.modal, width: "640px", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>閰嶇疆缁勪欢 - {selectedConfig.label}</div>
              <button aria-label="关闭弹窗" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowConfig(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{t('dc.dataSource')}</div>
                <select style={styles.select} value={(selectedConfig.config.measures || [])[0] || ""} onChange={(e) => { const v = e.target.value; setConfigMeasures(v ? [v] : []); }}>
                  <option value="">閫夋嫨鎸囨爣</option>
                  {dataSources.map((ds) => <option key={ds.value} value={ds.value}>{ds.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>鑱氬悎鏂瑰紡</div>
                <select style={styles.select} value={configAgg} onChange={(e) => setConfigAgg(e.target.value)}>
                  {aggOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                  {t('dc.dimension')} <span style={{ fontWeight: 400, color: COLORS.textMuted, fontSize: "11px" }}>锛堢偣鍑婚€夋嫨, 鎷栨嫿鎺掑簭锛?/span>
                </div>
                <DndContext sensors={dimSensors} collisionDetection={closestCenter} onDragEnd={handleDimDragEnd}>
                  <SortableContext items={configDims} strategy={verticalListSortingStrategy}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                      {configDims.length === 0 && <span style={{ fontSize: "12px", color: COLORS.textMuted }}>璇蜂粠涓嬫柟閫夋嫨缁村害</span>}
                      {configDims.map((dimId) => {
                        const dim = metadata.dimensions?.find((d) => d.id === dimId);
                        return <SortableItem key={dimId} id={dimId} label={dim?.name || dimId} onRemove={toggleDimension} />;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                  {(metadata.dimensions || []).map((dim) => (
                    <label key={dim.id} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", background: configDims.includes(dim.id) ? "#dbeafe" : "#f8fafc", cursor: "pointer", border: "1px solid", borderColor: configDims.includes(dim.id) ? "#93c5fd" : "#e5e7eb" }}>
                      <input type="checkbox" checked={configDims.includes(dim.id)} onChange={() => toggleDimension(dim.id)} style={{ accentColor: COLORS.primary }} />
                      {dim.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>搴﹂噺閫夋嫨</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(metadata.metrics || []).map((m) => (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", background: configMeasures.includes(m.id) ? "#dbeafe" : "#f8fafc", cursor: "pointer", border: "1px solid", borderColor: configMeasures.includes(m.id) ? "#93c5fd" : "#e5e7eb" }}>
                      <input type="checkbox" checked={configMeasures.includes(m.id)} onChange={() => toggleMeasure(m.id)} style={{ accentColor: COLORS.primary }} />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{t('dc.filterCondition')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select aria-label="筛选字段" style={styles.select}><option value="">閫夋嫨瀛楁</option>{metadata.dimensions?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                  <select aria-label="筛选条件" style={styles.select}><option value="=">=</option><option>&gt;</option><option>&lt;</option><option>like</option></select>
                  <input aria-label="筛选值" style={styles.input} placeholder="值" />
                  <button style={{ ...styles.btn, ...styles.btnPrimary, padding: "6px 12px", fontSize: "12px" }}>{t('dc.add')}</button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowConfig(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveConfig}>{t('dc.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSaveDialog && (
        <div role="dialog" aria-modal="true" aria-label="淇濆瓨甯冨眬" style={styles.modalOverlay} onClick={() => setShowSaveDialog(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}><div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.saveLayoutTitle')}</div><button aria-label="关闭弹窗" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowSaveDialog(false)}><X size={18} /></button></div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: "16px" }}><label htmlFor="dc-layout-name" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{t('dc.layoutName')}</label><input id="dc-layout-name" aria-label="布局名称" style={{ ...styles.input, width: "100%" }} placeholder="杈撳叆甯冨眬鍚嶇О" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} /></div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowSaveDialog(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={saveLayout}><Save size={14} /> 淇濆瓨</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 缁勪欢: ScheduledDistribution ============
const ScheduledDistribution = () => {
  const [schedules, setSchedules] = useState(mockSchedules);
  const [distLog, setDistLog] = useState(mockDistLog);
  const [showAdd, setShowAdd] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: "", frequency: "姣忔湀", format: "PDF", recipients: "" });

  const addSchedule = () => {
    setSchedules([...schedules, { id: `S${Date.now()}`, name: newSchedule.name, frequency: newSchedule.frequency, format: newSchedule.format, recipients: newSchedule.recipients.split(",").map((s) => s.trim()), lastSent: "-", nextSend: "-", status: "鍚敤" }]);
    setShowAdd(false);
    setNewSchedule({ name: "", frequency: "姣忔湀", format: "PDF", recipients: "" });
  };

  const toggleStatus = (id) => {
    setSchedules(schedules.map((s) => s.id === id ? { ...s, status: s.status === "鍚敤" ? "鏆傚仠" : "鍚敤" } : s));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={styles.card}>
        <div style={styles.cardHeader}><div style={styles.cardTitle}><Send size={16} />{t('dc.scheduleTask')}</div><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowAdd(true)}><Plus size={14} />{t('dc.newSchedule')}</button></div>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('dc.taskName')}</th><th style={styles.th}>{t('dc.frequency')}</th><th style={styles.th}>{t('dc.format')}</th><th style={styles.th}>{t('dc.recipients')}</th><th style={styles.th}>{t('dc.lastSent')}</th><th style={styles.th}>{t('dc.nextSend')}</th><th style={styles.th}>{t('qcimage.status')}</th><th style={styles.th}>{t('qcimage.action')}</th></tr></thead>
          <tbody>{schedules.map((s) => (
            <tr key={s.id}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{s.name}</div></td>
              <td style={styles.td}>{s.frequency}</td>
              <td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: "#eff6ff", color: COLORS.primary }}>{s.format}</span></td>
              <td style={styles.td}>{s.recipients.join(", ")}</td>
              <td style={styles.td}><div style={{ fontSize: "12px" }}>{s.lastSent}</div></td>
              <td style={styles.td}><div style={{ fontSize: "12px" }}>{s.nextSend}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: s.status === "鍚敤" ? COLORS.successLight : "#f3f4f6", color: s.status === "鍚敤" ? COLORS.success : COLORS.textMuted }}>{s.status}</span></td>
              <td style={styles.td}><button style={{ ...styles.btn, padding: "4px 10px", fontSize: "12px", ...styles.btnOutline }} onClick={() => toggleStatus(s.id)}>{s.status === "鍚敤" ? "鏆傚仠" : "鍚敤"}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={styles.card}>
        <div style={styles.cardHeader}><div style={styles.cardTitle}><Clock size={16} />{t('dc.distLog')}</div></div>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('dc.scheduleTask')}</th><th style={styles.th}>{t('dc.sendTime')}</th><th style={styles.th}>{t('dc.format')}</th><th style={styles.th}>{t('dc.recipients')}</th><th style={styles.th}>{t('qcimage.status')}</th></tr></thead>
          <tbody>{distLog.map((d) => (
            <tr key={d.id}>
              <td style={styles.td}>{d.schedule}</td><td style={styles.td}>{d.sentAt}</td><td style={styles.td}>{d.format}</td><td style={styles.td}>{d.recipients}</td>
              <td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: d.status === "鎴愬姛" ? COLORS.successLight : COLORS.dangerLight, color: d.status === "鎴愬姛" ? COLORS.success : COLORS.danger }}>{d.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {showAdd && (
        <div role="dialog" aria-modal="true" aria-label="鏂板缓璋冨害浠诲姟" style={styles.modalOverlay} onClick={() => setShowAdd(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}><div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.newScheduleTask')}</div><button aria-label="关闭弹窗" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.taskName')}</label><input style={{ ...styles.input, width: "100%" }} value={newSchedule.name} onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })} /></div>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.frequency')}</label><select style={styles.select} value={newSchedule.frequency} onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}><option>姣忔棩</option><option>姣忓懆</option><option>姣忔湀</option><option>姣忓搴?/option></select></div>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.format')}</label><select style={styles.select} value={newSchedule.format} onChange={(e) => setNewSchedule({ ...newSchedule, format: e.target.value })}><option>PDF</option><option>Excel</option><option>CSV</option><option>HTML</option></select></div>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>鏀朵欢浜?(閫楀彿鍒嗛殧)</label><input style={{ ...styles.input, width: "100%" }} value={newSchedule.recipients} onChange={(e) => setNewSchedule({ ...newSchedule, recipients: e.target.value })} placeholder="闄㈤暱鍔? 鍖诲姟绉? /></div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowAdd(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={addSchedule}><Plus size={14} />{t('dc.create')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 缁勪欢: DrillDownNavigation ============
const DrillDownNavigation = () => {
  const [drillLevel, setDrillLevel] = useState("summary");
  const [breadcrumb, setBreadcrumb] = useState(["鎬昏"]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [detailRecords, setDetailRecords] = useState([]);

  const summaryData = [
    { category: "CT", total: 2890, revenue: 4335000, cost: 1734000, avgTime: 45 },
    { category: "MR", total: 1920, revenue: 3840000, cost: 1536000, avgTime: 38 },
    { category: "DR", total: 4800, revenue: 1920000, cost: 960000, avgTime: 28 },
    { category: "MG", total: 460, revenue: 552000, cost: 276000, avgTime: 22 },
    { category: "DSA", total: 155, revenue: 1085000, cost: 542500, avgTime: 68 },
  ];

  const drillDetail = (category) => {
    setSelectedSegment(category);
    setDrillLevel("detail");
    setBreadcrumb(["鎬昏", category]);
    setDetailRecords([
      { id: 1, patient: `鎮ｈ€?{category}01`, doctor: "鏉庢槑", date: "2026-05-15", revenue: 1500, cost: 600 },
      { id: 2, patient: `鎮ｈ€?{category}02`, doctor: "鐜嬭姵", date: "2026-05-14", revenue: 1500, cost: 600 },
      { id: 3, patient: `鎮ｈ€?{category}03`, doctor: "璧靛己", date: "2026-05-13", revenue: 1500, cost: 600 },
      { id: 4, patient: `鎮ｈ€?{category}04`, doctor: "瀛欑", date: "2026-05-12", revenue: 1500, cost: 600 },
      { id: 5, patient: `鎮ｈ€?{category}05`, doctor: "鍛ㄧ惓", date: "2026-05-11", revenue: 1500, cost: 600 },
    ]);
  };

  const drillToRecord = (record) => {
    setDrillLevel("record");
    setBreadcrumb(["鎬昏", selectedSegment, record.patient]);
  };

  const goBack = () => {
    if (drillLevel === "record") { setDrillLevel("detail"); setBreadcrumb(["鎬昏", selectedSegment]); }
    else if (drillLevel === "detail") { setDrillLevel("summary"); setBreadcrumb(["鎬昏"]); setSelectedSegment(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
        <FolderTree size={14} style={{ color: COLORS.textMuted }} />
        {breadcrumb.map((crumb, idx) => (
          <span key={idx} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {idx > 0 && <ChevronRight size={12} style={{ color: COLORS.textMuted }} />}
            <span style={{ color: idx === breadcrumb.length - 1 ? COLORS.primary : COLORS.textMuted, fontWeight: idx === breadcrumb.length - 1 ? 600 : 400, fontSize: "13px", cursor: idx < breadcrumb.length - 1 ? "pointer" : "default" }} onClick={() => { if (idx === 0) { setDrillLevel("summary"); setBreadcrumb(["鎬昏"]); setSelectedSegment(null); } }}>{crumb}</span>
          </span>
        ))}
        {drillLevel !== "summary" && <button style={{ ...styles.btn, padding: "4px 10px", fontSize: "12px", ...styles.btnOutline, marginLeft: "auto" }} onClick={goBack}><ChevronRight size={12} style={{ transform: "rotate(180deg)" }} /> 杩斿洖</button>}
      </div>
      {drillLevel === "summary" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><BarChart3 size={16} />{t('dc.summaryDrill')}</div></div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t('dc.category')}</th><th style={styles.th}>{t('dc.examVolume')}</th><th style={styles.th}>{t('dc.revenue')}</th><th style={styles.th}>{t('dc.cost')}</th><th style={styles.th}>{t('dc.avgTime')}</th><th style={styles.th}>{t('qcimage.action')}</th></tr></thead>
            <tbody>{summaryData.map((item) => (
              <tr key={item.category} style={{ cursor: "pointer" }} onClick={() => drillDetail(item.category)}>
                <td style={styles.td}><div style={{ fontWeight: 500 }}>{item.category}</div></td>
                <td style={styles.td}>{item.total.toLocaleString()}</td>
                <td style={styles.td}>{item.revenue.toLocaleString()}</td>
                <td style={styles.td}>{item.cost.toLocaleString()}</td>
                <td style={styles.td}>{item.avgTime}</td>
                <td style={styles.td}><button style={{ ...styles.btn, padding: "4px 8px", fontSize: "11px", ...styles.btnPrimary }} onClick={(e) => { e.stopPropagation(); drillDetail(item.category); }}>{t('dc.viewDetail')}<ChevronRight size={10} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {drillLevel === "detail" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><FileText size={16} /> {selectedSegment} - 璇︾粏璁板綍</div></div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t('qcimage.patient')}</th><th style={styles.th}>{t('qcscore.doctor')}</th><th style={styles.th}>{t('qc.date')}</th><th style={styles.th}>{t('dc.revenue')}</th><th style={styles.th}>{t('dc.cost')}</th><th style={styles.th}>{t('qcimage.action')}</th></tr></thead>
            <tbody>{detailRecords.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => drillToRecord(r)}>
                <td style={styles.td}>{r.patient}</td><td style={styles.td}>{r.doctor}</td><td style={styles.td}>{r.date}</td>
                <td style={styles.td}>{r.revenue.toLocaleString()}</td><td style={styles.td}>{r.cost.toLocaleString()}</td>
                <td style={styles.td}><button style={{ ...styles.btn, padding: "4px 8px", fontSize: "11px", ...styles.btnOutline }} onClick={(e) => { e.stopPropagation(); drillToRecord(r); }}>{t('qcscore.view')}<ChevronRight size={10} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {drillLevel === "record" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><User size={16} />{t('dc.patientDetail')}</div></div>
          <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>{t('dc.patientName')}</div><div style={{ fontWeight: 500 }}>{breadcrumb[2]}</div></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>妫€鏌ュ垎绫?/div><div style={{ fontWeight: 500 }}>{selectedSegment}</div></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>{t('dcm.examDate')}</div><div>2026-05-15</div></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>{t('qcdefect.reportDoctor')}</div><div>鏉庢槑</div></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>璇婃柇缁撹</div><div style={{ gridColumn: "1/-1" }}>鍙宠偤涓婂彾缁撹妭锛屽缓璁畾鏈熼殢璁?/div></div>
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "center" }}>
            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={goBack}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> 杩斿洖鍒楄〃</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 缁勪欢: OLAPFiltering ============
const OLAPFiltering = () => {
  const [dimensions] = useState({ time: "鏈?, department: "鍏ㄩ儴", modality: "鍏ㄩ儴", doctor: "鍏ㄩ儴" });
  const [measures] = useState({ measure: "count" });
  const [filterChain, setFilterChain] = useState([]);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);

  const addFilter = () => {
    setFilterChain([...filterChain, { dimension: "time", operator: "=", value: "2026-05" }]);
    setShowFilterBuilder(false);
  };

  const removeFilter = (idx) => {
    setFilterChain(filterChain.filter((_, i) => i !== idx));
  };

  const chartData = [
    { name: "CT", count: 2890, revenue: 4335, cost: 1734 },
    { name: "MR", count: 1920, revenue: 3840, cost: 1536 },
    { name: "DR", count: 4800, revenue: 1920, cost: 960 },
    { name: "MG", count: 460, revenue: 552, cost: 276 },
    { name: "DSA", count: 155, revenue: 1085, cost: 543 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={styles.card}>
        <div style={styles.cardHeader}><div style={styles.cardTitle}><Sliders size={16} />{t('dc.multiFilter')}</div></div>
        <div style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dc.timeDimension')}</div><select style={{ ...styles.select, width: "100%" }} defaultValue="鏈?><option>鏃?/option><option>鍛?/option><option>鏈?/option><option>骞?/option></select></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dc.department')}</div><select style={{ ...styles.select, width: "100%" }} defaultValue="鍏ㄩ儴"><option>{t('qcfilter.all')}</option><option>鏀惧皠绉?/option><option>CT瀹?/option><option>MRI瀹?/option></select></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dc.modalityType')}</div><select style={{ ...styles.select, width: "100%" }} defaultValue="鍏ㄩ儴"><option>{t('qcfilter.all')}</option><option>CT</option><option>MR</option><option>DR</option></select></div>
            <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('qcscore.doctor')}</div><select style={{ ...styles.select, width: "100%" }} defaultValue="鍏ㄩ儴"><option>{t('qcfilter.all')}</option><option>鏉庢槑</option><option>鐜嬭姵</option><option>璧靛己</option></select></div>
          </div>
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{t('dc.filterChain')}</div>
              <button style={{ ...styles.btn, padding: "4px 10px", fontSize: "12px", ...styles.btnOutline }} onClick={() => setShowFilterBuilder(true)}><Plus size={12} />{t('dc.addCondition')}</button>
            </div>
            {filterChain.length === 0 ? (
              <div style={{ fontSize: "13px", color: COLORS.textMuted, textAlign: "center", padding: "12px" }}>{t('dc.noFilter')}</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {filterChain.map((f, idx) => (
                  <span key={idx} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: "#eff6ff", borderRadius: "4px", fontSize: "12px", color: COLORS.primary }}>
                    {f.dimension} {f.operator} {f.value}
                    <X size={12} style={{ cursor: "pointer" }} onClick={() => removeFilter(idx)} />
                    {idx < filterChain.length - 1 && <ChevronRight size={12} />}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={styles.grid2}>
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><BarChart3 size={16} />{t('dc.dimAnalysis')}</div></div>
          <div style={{ padding: "16px", height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="count" name="妫€鏌ラ噺" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="鏀跺叆(涓?" fill={COLORS.success} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><PieChartIcon size={16} />{t('dc.distribution')}</div></div>
          <div style={{ padding: "16px", height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} dataKey="count" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartData.map((_, idx) => <Cell key={idx} fill={[COLORS.ct, COLORS.mri, COLORS.dr, COLORS.mg, COLORS.dsa][idx]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {showFilterBuilder && (
        <div role="dialog" aria-modal="true" aria-label="娣诲姞绛涢€夋潯浠? style={styles.modalOverlay} onClick={() => setShowFilterBuilder(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}><div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.addFilter')}</div><button aria-label="关闭弹窗" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowFilterBuilder(false)}><X size={18} /></button></div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.dimension')}</label><select style={styles.select}><option>鏃堕棿</option><option>{t('dc.department')}</option><option>{t('dc.modalityType')}</option><option>{t('qcscore.doctor')}</option></select></div>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>鍊?/label><input style={{ ...styles.input, width: "100%" }} placeholder="杈撳叆鍊? /></div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowFilterBuilder(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={addFilter}>{t('dc.add')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 缁勪欢: BenchmarkComparison ============
const BenchmarkComparison = () => {
  const [benchData, setBenchData] = useState(mockBenchmarkData);
  const [showPeerInput, setShowPeerInput] = useState(false);
  const [peerInput, setPeerInput] = useState({ metric: "", value: "" });

  const addPeerData = () => {
    setShowPeerInput(false);
    setPeerInput({ metric: "", value: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowPeerInput(true)}><Plus size={14} />{t('dc.addPeerData')}</button>
      </div>
      <div style={styles.card}>
        <div style={styles.cardHeader}><div style={styles.cardTitle}><BarChart4 size={16} />{t('dc.metricCompare')}</div></div>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('dc.metric')}</th><th style={styles.th}>{t('dc.own')}</th><th style={styles.th}>{t('dc.benchA')}</th><th style={styles.th}>{t('dc.benchB')}</th><th style={styles.th}>{t('dc.benchC')}</th><th style={styles.th}>{t('dc.percentile')}</th><th style={styles.th}>{t('dc.gapAnalysis')}</th></tr></thead>
          <tbody>{benchData.map((item, idx) => (
            <tr key={idx}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{item.metric}</div></td>
              <td style={styles.td}><div style={{ fontWeight: 600, color: COLORS.primary }}>{item.own}</div></td>
              <td style={styles.td}>{item.peer1}</td><td style={styles.td}>{item.peer2}</td><td style={styles.td}>{item.peer3}</td>
              <td style={styles.td}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ ...styles.progressBar, width: "80px" }}><div style={{ ...styles.progressFill, width: `${item.percentile}%`, backgroundColor: item.percentile >= 70 ? COLORS.success : item.percentile >= 50 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontSize: "12px", fontWeight: 600 }}>{item.percentile}%</span></div></td>
              <td style={styles.td}><span style={{ color: item.gap.startsWith("+") ? COLORS.success : item.gap.startsWith("-") ? COLORS.danger : COLORS.textMuted, fontWeight: 500 }}>{item.gap.startsWith("+") ? "鈫? : item.gap.startsWith("-") ? "鈫? : "鈫?} {item.gap}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={styles.grid2}>
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><Activity size={16} /> 鏈櫌 vs 鏍囨潌鍧囧€?/div></div>
          <div style={{ padding: "16px", height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="metric" tick={{ fontSize: 12 }} /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="own" name="鏈櫌" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="peer1" name="鏍囨潌A" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="peer2" name="鏍囨潌B" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><div style={styles.cardTitle}><Target size={16} />{t('dc.gapAnalysis')}</div></div>
          <div style={{ padding: "16px" }}>
            {benchData.filter((d) => d.gap.startsWith("-")).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: COLORS.success }}>
                <CheckCircle size={48} style={{ marginBottom: "12px" }} />
                <div style={{ fontWeight: 600 }}>{t('dc.allMet')}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: COLORS.danger }}>{t('dc.improveMetrics')}</div>
                {benchData.filter((d) => d.gap.startsWith("-")).map((item, idx) => (
                  <div key={idx} style={{ padding: "10px", background: COLORS.dangerLight, borderRadius: "6px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontWeight: 500, fontSize: "13px" }}>{item.metric}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>鏈櫌: {item.own} vs 鏍囨潌: {item.peer1}</div></div>
                    <div style={{ color: COLORS.danger, fontWeight: 600 }}>{item.gap}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {showPeerInput && (
        <div role="dialog" aria-modal="true" aria-label="杈撳叆瀵规爣鏁版嵁" style={styles.modalOverlay} onClick={() => setShowPeerInput(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}><div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.inputBenchData')}</div><button aria-label="关闭弹窗" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowPeerInput(false)}><X size={18} /></button></div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.instName')}</label><input style={{ ...styles.input, width: "100%" }} placeholder="濡? 鏍囨潌鍖婚櫌A" /></div>
              <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{t('dc.dataFile')}</label><input type="file" style={{ ...styles.input, width: "100%" }} /></div>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", fontSize: "12px", color: COLORS.textMuted, marginBottom: "12px" }}>鏀寔 CSV / Excel 鏍煎紡瀵煎叆锛屾枃浠堕渶鍖呭惈鐩稿悓鎸囨爣瀹氫箟</div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowPeerInput(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={addPeerData}><Download size={14} /> 瀵煎叆鏁版嵁</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 涓诲鍑虹粍浠?============
export default function DataReportTable({
  activeTab,
  handleExport, setShowUploadModal, setUploadDataType,
  setShowNewConsultationModal, setSelectedDevice,
  selectedExportFormat, setSelectedExportFormat,
  nationalReports: propNationalReports,
  dataReports: propDataReports,
}) {
  const [nationalReports, setNationalReports] = useState<NationalReportDto[]>(propNationalReports || []);
  const [dataReports, setDataReports] = useState<DataReportDto[]>(propDataReports || []);
  useEffect(() => {
    datareportApi.listNationalReports().then(res => { if (res.success) setNationalReports(res.data); }).catch(() => {});
    datareportApi.listDataReports().then(res => { if (res.success) setDataReports(res.data); }).catch(() => {});
  }, []);
  const renderTabContent = () => {
    switch (activeTab) {
      case "examVolume":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}><BarChart3 size={18} />{t('dc.examTrend')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleExport("examVolume")}><Download size={14} />{t('dc.exportExcel')}</button>
                  <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setUploadDataType("examVolume"); setShowUploadModal(true); }}><Upload size={14} />{t('dc.uploadData')}</button>
                </div>
              </div>
              <div style={{ padding: "18px" }}><ExamVolumeChart data={examVolumeData} /></div>
            </div>
            <div style={styles.grid2}>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><PieChartIcon size={18} />{t('dc.modalityDistribution')}</div></div>
                <div style={{ padding: "18px", height: "280px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "CT", value: examVolumeData.reduce((s, d) => s + d.CT, 0) }, { name: "MR", value: examVolumeData.reduce((s, d) => s + d.MR, 0) }, { name: "DR", value: examVolumeData.reduce((s, d) => s + d.DR, 0) }, { name: "MG", value: examVolumeData.reduce((s, d) => s + d.MG, 0) }, { name: "DSA", value: examVolumeData.reduce((s, d) => s + d.DSA, 0) }]} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                        {[COLORS.ct, COLORS.mri, COLORS.dr, COLORS.mg, COLORS.dsa].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Activity size={18} />{t('dc.pendingList')}</div><span style={{ ...styles.statusBadge, backgroundColor: COLORS.warningLight, color: COLORS.warning }}>{pendingReports.length} 鏉″緟澶勭悊</span></div>
                <div style={{ maxHeight: "300px", overflow: "auto" }}>
                  {pendingReports.slice(0, 5).map((item, idx) => (
                    <div key={idx} style={{ ...styles.listItem, borderLeft: `3px solid ${REPORT_STATUS_COLORS[item.status] || COLORS.border}` }}>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: "2px" }}>{item.patient}</div>
                        <div style={{ fontSize: "12px", color: COLORS.textMuted }}>{item.modality} | {item.examType} | {item.doctor}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ ...styles.statusBadge, backgroundColor: `${REPORT_STATUS_COLORS[item.status]}20`, color: REPORT_STATUS_COLORS[item.status] }}>{item.status}</span>
                        <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>{item.reportTime}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "deviceUsage":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}><Gauge size={18} />{t('dc.deviceUsageTitle')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleExport("deviceUsage")}><Download size={14} />{t('dc.exportReport')}</button>
                  <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setUploadDataType("deviceUsage"); setShowUploadModal(true); }}><Upload size={14} />{t('dc.uploadData')}</button>
                </div>
              </div>
              <div style={{ padding: "18px" }}><DeviceUsageChart data={deviceUsageData} /></div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardHeader}><div style={styles.cardTitle}><Monitor size={18} /> 璁惧璇︾粏鍒楄〃</div></div>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>{t('dc.deviceName')}</th><th style={styles.th}>{t('dc.usageRate')}</th><th style={styles.th}>{t('dcm.avgReportTime')}</th><th style={styles.th}>{t('qcimage.status')}</th><th style={styles.th}>{t('qcimage.action')}</th></tr></thead>
                <tbody>{deviceUsageData.map((device, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{device.name}</td>
                    <td style={styles.td}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ ...styles.progressBar, width: "100px" }}><div style={{ ...styles.progressFill, width: `${device.usage}%`, backgroundColor: device.usage >= 80 ? COLORS.success : device.usage >= 60 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontWeight: 500 }}>{device.usage}%</span></div></td>
                    <td style={styles.td}>{device.avgReport} min</td>
                    <td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: device.status === "姝ｅ父杩愯" ? COLORS.successLight : COLORS.warningLight, color: device.status === "姝ｅ父杩愯" ? COLORS.success : COLORS.warning }}><Circle size={6} fill="currentColor" />{device.status}</span></td>
                    <td style={styles.td}><button style={{ ...styles.btn, ...styles.btnOutline, padding: "4px 10px" }} onClick={() => setSelectedDevice(device)}><Eye size={12} />{t('qcscore.view')}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );

      case "qualityScore":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}><Award size={18} />{t('dc.qualityScore')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleExport("qualityScore")}><Download size={14} />{t('dc.exportReport')}</button>
                  <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setUploadDataType("qualityScore"); setShowUploadModal(true); }}><Upload size={14} />{t('dc.uploadData')}</button>
                </div>
              </div>
              <div style={{ padding: "18px" }}><QualityScoreChart data={qualityScoreData} /></div>
            </div>
            <div style={styles.grid2}>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Target size={18} />{t('dc.scoreDistribution')}</div></div>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>{t('dc.modalityType')}</th><th style={styles.th}>{t('qcimage.excellentRate')}</th><th style={styles.th}>{t('dc.goodRate')}</th><th style={styles.th}>{t('dc.passRate')}</th><th style={styles.th}>{t('dc.fail')}</th></tr></thead>
                  <tbody>{qualityScoreData.map((item, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}><span style={{ color: COLORS.success, fontWeight: 500 }}>{item.excellent}%</span></td>
                      <td style={styles.td}>{item.good}%</td>
                      <td style={styles.td}>{item.pass}%</td>
                      <td style={styles.td}><span style={{ color: item.fail > 0 ? COLORS.danger : COLORS.textMuted }}>{item.fail}%</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><CheckCircle size={18} />{t('dc.qcKeyPoints')}</div></div>
                <div style={{ padding: "18px" }}>
                  {[{ label: t('dc.reportCompletion'), value: "98.5%", color: COLORS.success }, { label: t('dc.diagnosisMatch'), value: "96.2%", color: COLORS.primaryLight }, { label: t('dc.timelinessRate'), value: "94.8%", color: COLORS.mri }, { label: t('dc.criticalRate'), value: "100%", color: COLORS.success }].map((item, idx) => (
                    <div key={idx} style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}><span style={{ fontSize: "13px", color: COLORS.textMuted }}>{item.label}</span><span style={{ fontWeight: 600 }}>{item.value}</span></div>
                      <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: item.value, backgroundColor: item.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "doseStats":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}><Zap size={18} />{t('dc.doseTrend')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleExport("doseStats")}><Download size={14} />{t('dc.exportReport')}</button>
                  <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setUploadDataType("doseStats"); setShowUploadModal(true); }}><Upload size={14} />{t('dc.uploadData')}</button>
                </div>
              </div>
              <div style={{ padding: "18px" }}><DoseTrendChart data={doseData} /></div>
            </div>
            <div style={styles.grid3}>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Scan size={18} /> CT鍓傞噺缁熻</div></div>
                <div style={{ padding: "18px" }}>
                  <div style={{ textAlign: "center", marginBottom: "16px" }}><div style={{ fontSize: "32px", fontWeight: 700, color: COLORS.ct }}>46,800</div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>鏈湀CT-DLP (mGy路cm)</div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ backgroundColor: "#f0f9ff", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.ct }}>1,420</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>鏈夋晥鍓傞噺(mSv)</div></div>
                    <div style={{ backgroundColor: "#f0f9ff", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.ct }}>2,890</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>{t('dc.examCount')}</div></div>
                  </div>
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Image size={18} /> DR鍓傞噺缁熻</div></div>
                <div style={{ padding: "18px" }}>
                  <div style={{ textAlign: "center", marginBottom: "16px" }}><div style={{ fontSize: "32px", fontWeight: 700, color: COLORS.dr }}>92</div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>鏈湀DR鎬诲墏閲?(渭Sv)</div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ backgroundColor: "#ecfdf5", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.dr }}>4,800</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>{t('dc.examCount')}</div></div>
                    <div style={{ backgroundColor: "#ecfdf5", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.dr }}>0.019</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>骞冲潎鍓傞噺(渭Sv)</div></div>
                  </div>
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Radio size={18} /> 涔宠吅MG鍓傞噺缁熻</div></div>
                <div style={{ padding: "18px" }}>
                  <div style={{ textAlign: "center", marginBottom: "16px" }}><div style={{ fontSize: "32px", fontWeight: 700, color: COLORS.mg }}>14</div><div style={{ fontSize: "12px", color: COLORS.textMuted }}>鏈湀MG鎬诲墏閲?(mGy)</div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ backgroundColor: "#fffbeb", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.mg }}>460</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>{t('dc.examCount')}</div></div>
                    <div style={{ backgroundColor: "#fffbeb", padding: "10px", borderRadius: "6px", textAlign: "center" }}><div style={{ fontSize: "18px", fontWeight: 600, color: COLORS.mg }}>0.03</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>骞冲潎鍓傞噺(mGy)</div></div>
                  </div>
                </div>
              </div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardHeader}><div style={styles.cardTitle}><ShieldCheck size={18} />{t('dc.doseCompliance')}</div></div>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>{t('dc.examType')}</th><th style={styles.th}>{t('dc.examCount')}</th><th style={styles.th}>骞冲潎DLP</th><th style={styles.th}>鍙傝€冩按骞?/th><th style={styles.th}>瓒呮爣渚嬫暟</th><th style={styles.th}>鍚堣鐜?/th></tr></thead>
                <tbody>
                  <tr><td style={styles.td}>鎴愪汉鑳搁儴CT</td><td style={styles.td}>1,250</td><td style={styles.td}>520 mGy路cm</td><td style={styles.td}>800 mGy路cm</td><td style={styles.td}><span style={{ color: COLORS.success }}>0</span></td><td style={styles.td}><span style={{ color: COLORS.success, fontWeight: 600 }}>100%</span></td></tr>
                  <tr><td style={styles.td}>鎴愪汉鑵归儴CT</td><td style={styles.td}>890</td><td style={styles.td}>780 mGy路cm</td><td style={styles.td}>1000 mGy路cm</td><td style={styles.td}><span style={{ color: COLORS.success }}>0</span></td><td style={styles.td}><span style={{ color: COLORS.success, fontWeight: 600 }}>100%</span></td></tr>
                  <tr><td style={styles.td}>鍎跨澶撮儴CT</td><td style={styles.td}>320</td><td style={styles.td}>680 mGy路cm</td><td style={styles.td}>900 mGy路cm</td><td style={styles.td}><span style={{ color: COLORS.success }}>0</span></td><td style={styles.td}><span style={{ color: COLORS.success, fontWeight: 600 }}>100%</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "consultation":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={styles.grid2}>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Video size={18} />{t('dc.consultType')}</div><button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleExport("consultation")}><Download size={14} />{t('dc.exportReport')}</button></div>
                <div style={{ padding: "18px" }}><ConsultationPieChart data={consultationData} /></div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><div style={styles.cardTitle}><Users size={18} />{t('dc.consultStatus')}</div></div>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>浼氳瘖绫诲瀷</th><th style={styles.th}>{t('dc.total')}</th><th style={styles.th}>{t('dc.completed')}</th><th style={styles.th}>{t('dc.inProgress')}</th><th style={styles.th}>{t('dc.avgDuration')}</th></tr></thead>
                  <tbody>{consultationData.map((item, idx) => (
                    <tr key={idx}><td style={styles.td}>{item.type}</td><td style={styles.td}>{item.total}</td><td style={styles.td}><span style={{ color: COLORS.success }}>{item.completed}</span></td><td style={styles.td}><span style={{ color: item.pending > 0 ? COLORS.warning : COLORS.textMuted }}>{item.pending}</span></td><td style={styles.td}>{item.avgTime}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardHeader}><div style={styles.cardTitle}><MessageSquare size={18} />{t('dc.consultRecords')}</div><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowNewConsultationModal(true)}><Plus size={14} />{t('dc.newConsultation')}</button></div>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>{t('dc.consultId')}</th><th style={styles.th}>{t('dc.patientName')}</th><th style={styles.th}>浼氳瘖绫诲瀷</th><th style={styles.th}>{t('dcm.orderingDoctor')}</th><th style={styles.th}>{t('dc.consultDoctor')}</th><th style={styles.th}>{t('dc.applyTime')}</th><th style={styles.th}>{t('qcimage.status')}</th></tr></thead>
                <tbody>
                  <tr><td style={styles.td}>CON20260501001</td><td style={styles.td}>鐜嬪缓鍥?/td><td style={styles.td}>鐤戦毦鐥呬緥浼氳瘖</td><td style={styles.td}>鏉庢槑</td><td style={styles.td}>寮犲崕</td><td style={styles.td}>2026-05-01 09:30</td><td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: COLORS.successLight, color: COLORS.success }}><CheckCircle size={10} />{t('dc.completed')}</span></td></tr>
                  <tr><td style={styles.td}>CON20260501002</td><td style={styles.td}>璧靛皬绾?/td><td style={styles.td}>杩滅▼褰卞儚浼氳瘖</td><td style={styles.td}>瀛欑</td><td style={styles.td}>鍛ㄧ惓</td><td style={styles.td}>2026-05-01 14:20</td><td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: COLORS.successLight, color: COLORS.success }}><CheckCircle size={10} />{t('dc.completed')}</span></td></tr>
                  <tr><td style={styles.td}>CON20260501003</td><td style={styles.td}>鍒樹紵</td><td style={styles.td}>涓村簥绉戝浼氳瘖</td><td style={styles.td}>鐜嬪己</td><td style={styles.td}>闄堟槑</td><td style={styles.td}>2026-05-02 10:00</td><td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: COLORS.primaryLight + "30", color: COLORS.primaryLight }}><Clock size={10} />{t('dc.inProgress')}</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "reportBuilder":
        return <ReportBuilder />;

      case "scheduledDist":
        return <ScheduledDistribution />;

      case "drillDown":
        return <DrillDownNavigation />;

      case "olapFilter":
        return <OLAPFiltering />;

      case "benchmark":
        return <BenchmarkComparison />;

      default:
        return null;
    }
  };

  return renderTabContent();
}
