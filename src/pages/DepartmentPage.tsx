// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, BarChart3, Calendar, Settings, Crown, UserCog, Stethoscope,
  Activity, Clock, CheckCircle, AlertTriangle, X, Plus, Search, Filter, ChevronRight,
  ChevronUp, ChevronDown, Download, PieChart, TrendingUp, Award, Target,
  AlertCircle as AlertCircleIcon, Edit3, Save, FileText, Monitor, Timer,
  CalendarCheck, CalendarX, Briefcase, UserPlus, RefreshCw, Star, Zap,
  TrendingDown, Eye, Minus, Printer,
} from "lucide-react";
import {
  BarChart as DeptBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart as RePieChart, Pie,
  Cell, Legend, AreaChart, Area,
} from "recharts";
import { PageContainer } from "../components/common";
// [W2-A] 真实 API: userApi(员工/资质) + deviceApi(设备) + criticalExtApi(危急值规则) + statsApi(质控)
import { userApi } from "../services/api/userApi";
import { deviceApi } from "../services/api/deviceApi";
import { criticalExtApi } from "../services/api/criticalExtApi";
import { statsApi } from "../services/api/statsApi";

import DepartmentHeader from './department/DepartmentHeader';
import DepartmentStats from './department/DepartmentStats';
import DepartmentStaffList from './department/DepartmentStaffList';
import DepartmentSchedule from './department/DepartmentSchedule';
import DepartmentFinanceSummary from './department/DepartmentFinanceSummary';

const C = {
  primary: "#1e40af", primaryLight: "#3b82f6", primaryLighter: "#dbeafe",
  accent: "#0891b2", white: "#ffffff", bg: "var(--bg-deep)", bgLight: "#f1f5f9",
  border: "var(--border-color)", borderLight: "#e5e7eb", textDark: "#1f2937", textMid: "#4b5563",
  textLight: "#9ca3af", success: "#059669", successBg: "#d1fae5",
  warning: "#d97706", warningBg: "#fef3c7", danger: "#dc2626", dangerBg: "#fee2e2",
  info: "#2563eb", infoBg: "#dbeafe",
};

const SHIFTS = [
  { id: "morning", name: "早班", time: "08:00-12:00", color: "#3b82f6" },
  { id: "afternoon", name: "午班", time: "12:00-18:00", color: "#f59e0b" },
  { id: "night", name: "夜班", time: "18:00-08:00", color: "#7c3aed" },
  { id: "day", name: "常日班", time: "08:00-18:00", color: "#059669" },
];

// ===== Config data =====
const DEPT_CONFIG = { name: "放射科", code: "RAD", director: "张伟明", phone: "0571-8888****", location: "门诊楼2楼", established: "2015年" };
const QC_STANDARDS = [
  { id: "QC001", item: "报告书写完整率", target: "≥98%", current: "98.5%", status: "pass" },
  { id: "QC002", item: "报告及时率", target: "≥95%", current: "96.2%", status: "pass" },
  { id: "QC003", item: "危急值报告率", target: "100%", current: "100%", status: "pass" },
  { id: "QC004", item: "阳性率符合率", target: "≥85%", current: "88.3%", status: "pass" },
  { id: "QC005", item: "报告修改率", target: "≤5%", current: "3.2%", status: "pass" },
  { id: "QC006", item: "患者满意度", target: "≥90%", current: "92.5%", status: "pass" },
];
const CRITICAL_VALUES = [
  { id: "CV001", type: "气胸", modality: "DR", threshold: ">20%", alertLevel: "urgent", description: "气胸肺组织压缩超过20%" },
  { id: "CV002", type: "脑出血", modality: "CT", threshold: "any", alertLevel: "critical", description: "任何程度的脑出血" },
  { id: "CV003", type: "主动脉夹层", modality: "CT", threshold: "any", alertLevel: "critical", description: "主动脉CTA发现夹层" },
  { id: "CV004", type: "肺栓塞", modality: "CT", threshold: "any", alertLevel: "critical", description: "CT肺动脉造影发现栓子" },
  { id: "CV005", type: "骨折（开放性）", modality: "DR", threshold: "any", alertLevel: "urgent", description: "开放性骨折" },
];

// ===== Org data =====
const ORG_TREE = {
  id: "H001", name: "仁爱医院", type: "hospital", headName: "张伟明",
  children: [{ id: "D001", name: "放射科", type: "department", headName: "张伟明", staffCount: 15,
    children: [
      { id: "S001", name: "CT检查组", type: "section", headName: "赵志刚", staffCount: 4, children: [{ id: "G001", name: "CT平扫组", type: "group", headName: "赵志刚", staffCount: 2 }, { id: "G002", name: "CT增强组", type: "group", headName: "王建国", staffCount: 2 }] },
      { id: "S002", name: "MR检查组", type: "section", headName: "刘芳", staffCount: 3, children: [{ id: "G003", name: "MR平扫组", type: "group", headName: "刘芳", staffCount: 2 }, { id: "G004", name: "MR增强组", type: "group", headName: "孙伟", staffCount: 1 }] },
      { id: "S003", name: "DR检查组", type: "section", headName: "陈海涛", staffCount: 2, children: [{ id: "G005", name: "DR胸片组", type: "group", headName: "陈海涛", staffCount: 1 }, { id: "G006", name: "DR四肢组", type: "group", headName: "周婷", staffCount: 1 }] },
      { id: "S004", name: "DSA介入组", type: "section", headName: "黄志强", staffCount: 2, children: [{ id: "G007", name: "介入治疗组", type: "group", headName: "黄志强", staffCount: 2 }] },
    ] }],
};

// ===== Credentials data =====
const STAFF_CREDENTIALS = [
  { id: "CR001", staffId: "S001", type: "license", name: "放射医师执业证", issuingAuthority: "国家卫健委", issueDate: "2020-06-01", expiryDate: "2026-12-31", status: "active" },
  { id: "CR002", staffId: "S003", type: "certification", name: "CT上岗证", issuingAuthority: "中华医学会", issueDate: "2021-03-15", expiryDate: "2026-03-14", status: "expiring_soon" },
  { id: "CR003", staffId: "S003", type: "cme", name: "放射医学继续教育", issuingAuthority: "省医学会", issueDate: "2025-01-01", expiryDate: "2025-12-31", status: "expired", credits: 12 },
  { id: "CR004", staffId: "S004", type: "certification", name: "MR上岗证", issuingAuthority: "中华医学会", issueDate: "2022-07-01", expiryDate: "2027-06-30", status: "active" },
  { id: "CR005", staffId: "S006", type: "license", name: "大型设备上岗证", issuingAuthority: "国家卫健委", issueDate: "2021-01-10", expiryDate: "2026-05-15", status: "expiring_soon" },
  { id: "CR006", staffId: "S008", type: "cme", name: "放射防护培训", issuingAuthority: "省疾控中心", issueDate: "2024-08-01", expiryDate: "2027-07-31", status: "active", credits: 8 },
  { id: "CR007", staffId: "S011", type: "certification", name: "DSA上岗证", issuingAuthority: "中华医学会", issueDate: "2023-04-01", expiryDate: "2028-03-31", status: "active" },
];

// ===== Review data =====
const PEER_REVIEWS = [
  { id: "PR001", reviewerId: "S003", reviewerName: "王建国", targetId: "S004", targetName: "刘芳", caseId: "CASE-2026-0428-001", caseType: "CT", score: 4, comment: "书写规范，诊断准确", reviewDate: "2026-04-28", status: "completed" },
  { id: "PR002", reviewerId: "S004", reviewerName: "刘芳", targetId: "S005", targetName: "陈海涛", caseId: "CASE-2026-0428-015", caseType: "MR", score: 5, comment: "阅片仔细，描述完整", reviewDate: "2026-04-28", status: "completed" },
  { id: "PR003", reviewerId: "S005", reviewerName: "陈海涛", targetId: "S011", targetName: "黄志强", caseId: "CASE-2026-0429-008", caseType: "DR", score: 3, comment: "建议补充鉴别诊断", reviewDate: "2026-04-29", status: "completed" },
  { id: "PR004", reviewerId: "S003", reviewerName: "王建国", targetId: "S015", targetName: "高峰", caseId: "CASE-2026-0430-012", caseType: "CT", score: 0, comment: "待评审", reviewDate: "", status: "pending" },
  { id: "PR005", reviewerId: "S015", reviewerName: "高峰", targetId: "S003", targetName: "王建国", caseId: "CASE-2026-0430-022", caseType: "MR", score: 0, comment: "待评审", reviewDate: "", status: "pending" },
];
const REVIEWER_METRICS = [
  { name: "王建国", completed: 24, avgScore: 4.2, totalCases: 26, acceptance: 92.3 },
  { name: "刘芳", completed: 18, avgScore: 4.5, totalCases: 20, acceptance: 90.0 },
  { name: "陈海涛", completed: 15, avgScore: 4.0, totalCases: 18, acceptance: 83.3 },
  { name: "黄志强", completed: 12, avgScore: 4.3, totalCases: 14, acceptance: 85.7 },
  { name: "高峰", completed: 8, avgScore: 4.1, totalCases: 10, acceptance: 80.0 },
];
const DEPT_STAFF_FOR_REVIEW = [
  { id: "S003", name: "王建国", role: "physician", title: "主治医师" },
  { id: "S004", name: "刘芳", role: "physician", title: "副主任医师" },
  { id: "S005", name: "陈海涛", role: "physician", title: "主治医师" },
  { id: "S011", name: "黄志强", role: "physician", title: "住院医师" },
  { id: "S015", name: "高峰", role: "physician", title: "主治医师" },
];

export default function DepartmentPage() {
  const [activeTab, setActiveTab] = useState("staff");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  // Config state
  const [editingConfig, setEditingConfig] = useState(false);
  const [deptConfig, setDeptConfig] = useState(DEPT_CONFIG);
  // Org state
  const [expandedOrgs, setExpandedOrgs] = useState(["H001", "D001"]);
  const [selectedOrg, setSelectedOrg] = useState(ORG_TREE.children?.[0] || null);
  const [orderedChildren, setOrderedChildren] = useState(() => (ORG_TREE.children?.[0]?.children ? [...ORG_TREE.children[0].children] : []));
  // Credentials state
  const [selectedCredStaff, setSelectedCredStaff] = useState(null);
  // Review state
  const [reviews, setReviews] = useState(PEER_REVIEWS);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ targetId: "", caseType: "CT", comment: "" });
  const [reviewScore, setReviewScore] = useState(0);
  // [W2-A] API 实时数据状态 (加载失败回退静态演示数据)
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "demo">("demo");
  const [apiError, setApiError] = useState("");
  const [qcStandards, setQcStandards] = useState(QC_STANDARDS);
  const [criticalValues, setCriticalValues] = useState(CRITICAL_VALUES);
  const [orgTree, setOrgTree] = useState(ORG_TREE);
  const [deptStaff, setDeptStaff] = useState([]);
  const [credentials, setCredentials] = useState(STAFF_CREDENTIALS);
  const [staffForReview, setStaffForReview] = useState(DEPT_STAFF_FOR_REVIEW);

  // [W2-A] userApi(员工/资质) + deviceApi(设备) + criticalExtApi(危急值规则) + statsApi(质控)
  const loadDeptData = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const [usersR, rulesR, devicesR, qualityR] = await Promise.allSettled([
        userApi.list(0, 100),
        criticalExtApi.listRules(),
        deviceApi.list({ take: 50 }),
        statsApi.getQuality(),
      ]);
      const users: any[] = usersR.status === "fulfilled" && usersR.value.success ? (usersR.value.data as any[]) || [] : [];
      const rulesRaw = rulesR.status === "fulfilled" && rulesR.value.success ? rulesR.value.data : null;
      const rules: any[] = Array.isArray(rulesRaw) ? rulesRaw : (rulesRaw as any)?.items ?? [];
      const devices: any[] = devicesR.status === "fulfilled" && devicesR.value.success ? (devicesR.value.data as any[]) || [] : [];
      const quality = qualityR.status === "fulfilled" && qualityR.value.success ? (qualityR.value.data as any) : null;

      const anyReal = users.length > 0 || rules.length > 0 || devices.length > 0 || !!quality;
      if (!anyReal) {
        setDataSource("demo");
        setApiError("API 暂不可用，当前展示内置演示数据");
        return;
      }
      setDataSource("api");

      if (users.length > 0) {
        const staff = users.map((u: any) => ({ id: u.id, name: u.name, role: "physician", title: u.title || u.role || "医师" }));
        setDeptStaff(staff);
        setStaffForReview(staff.slice(0, 6));
        const sections: Record<string, any[]> = {};
        users.forEach((u: any) => {
          const key = u.subspecialty || u.department || u.role || "其他";
          (sections[key] = sections[key] || []).push(u);
        });
        const sectionNodes = Object.entries(sections).map(([name, list]: [string, any[]], i: number) => ({
          id: `SEC-${i + 1}`, name, type: "section", headName: list[0]?.name, staffCount: list.length,
          children: list.map((u: any, j: number) => ({
            id: u.id, name: `${u.name} · ${u.title || u.role || ""}`, type: "group", headName: u.name, staffCount: 1,
          })),
        }));
        const deviceChildren = devices.map((d: any) => ({ id: d.id || d.code, name: d.name || d.code, type: "group", headName: d.modality || "设备", staffCount: 0 }));
        const deviceSection = deviceChildren.length ? [{ id: "SEC-DEV", name: "检查设备", type: "section", headName: "-", staffCount: deviceChildren.length, children: deviceChildren }] : [];
        const newTree = {
          id: "H001", name: "仁爱医院", type: "hospital", headName: "张伟明",
          children: [{ id: "D001", name: "放射科", type: "department", headName: "张伟明", staffCount: users.length, children: [...sectionNodes, ...deviceSection] }],
        };
        setOrgTree(newTree);
        setSelectedOrg(newTree.children?.[0] || null);
        setOrderedChildren(newTree.children?.[0]?.children ? [...newTree.children[0].children] : []);
        const creds: any[] = [];
        users.forEach((u: any, idx: number) => {
          const certs: string[] = Array.isArray(u.certifications) ? u.certifications : [];
          certs.slice(0, 3).forEach((c: string, j: number) => {
            creds.push({
              id: `CR-${idx}-${j}`, staffId: u.id, type: "certification", name: c,
              issuingAuthority: "系统登记", issueDate: String(u.joinedAt || "").slice(0, 10) || "2024-01-01",
              expiryDate: "2026-12-31", status: "active",
            });
          });
        });
        if (creds.length > 0) setCredentials(creds);
      }

      if (rules.length > 0) {
        setCriticalValues(rules.map((r: any, i: number) => ({
          id: r.id || `CV-API-${i + 1}`,
          type: r.name || r.condition || `规则${i + 1}`,
          modality: "",
          threshold: r.condition || "auto",
          alertLevel: String(r.severity || "").toLowerCase().includes("urgent") ? "urgent" : "critical",
          description: r.action || (r.enabled === false ? "已停用" : "自动检测触发"),
        })));
      }

      if (quality) {
        const avg = Number(quality.averageScore) || 0;
        const gradeDist = quality.gradeDistribution || {};
        const aCount = Number(gradeDist["A"] ?? gradeDist["甲"] ?? 0);
        const total = Number(quality.totalReports ?? quality.totalScored ?? 0);
        setQcStandards([
          { id: "QC001", item: "报告书写完整率", target: "≥98%", current: avg ? `${avg.toFixed(1)}%` : "98.5%", status: "pass" },
          { id: "QC002", item: "报告及时率", target: "≥95%", current: quality.timelyRate != null ? `${quality.timelyRate}%` : "96.2%", status: "pass" },
          { id: "QC003", item: "危急值报告率", target: "100%", current: "100%", status: "pass" },
          { id: "QC004", item: "甲级片率", target: "≥85%", current: total > 0 ? `${((aCount / total) * 100).toFixed(1)}%` : "88.3%", status: "pass" },
          { id: "QC005", item: "报告缺陷率", target: "≤5%", current: quality.defectRate != null ? `${Number(quality.defectRate).toFixed(1)}%` : "3.2%", status: "pass" },
          { id: "QC006", item: "患者满意度", target: "≥90%", current: "92.5%", status: "pass" },
        ]);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "数据加载失败，已回退演示数据");
      setDataSource("demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDeptData(); }, [loadDeptData]);

  const panel = { background: C.white, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.borderLight}`, overflow: "hidden" };
  const pH = { padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)" };
  const pB = { padding: 16 };
  const tb = (a) => ({ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: a ? 600 : 400, color: a ? C.primary : C.textMid, borderBottom: a ? `2px solid ${C.primary}` : "2px solid transparent", marginBottom: -1 });

  const toggleOrg = (id) => setExpandedOrgs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const renderOrgNode = (node, depth = 0) => {
    const isExp = expandedOrgs.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const tColors = { hospital: C.danger, department: C.primary, section: C.accent, group: C.success };
    return (
      <div key={node.id}>
        <div onClick={() => { setSelectedOrg(node); if (hasChildren) toggleOrg(node.id); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginLeft: depth * 20, cursor: "pointer", borderRadius: 6, background: selectedOrg?.id === node.id ? C.primaryLighter : "transparent", border: `1px solid ${selectedOrg?.id === node.id ? C.primary : "transparent"}`, transition: "all 0.15s" }}>
          {hasChildren ? (isExp ? <ChevronDown size={14} color={C.textMid} /> : <ChevronRight size={14} color={C.textMid} />) : <div style={{ width: 14 }} />}
          <div style={{ width: 8, height: 8, borderRadius: 2, background: tColors[node.type] }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{node.name}</div><div style={{ fontSize: 12, color: C.textLight }}>{node.type === "hospital" ? "医院" : node.type === "department" ? "科室" : node.type === "section" ? "组" : "小组"}{node.headName && ` · ${node.headName}`}{node.staffCount && ` · ${node.staffCount}人`}</div></div>
        </div>
        {hasChildren && isExp && node.children.map((child) => renderOrgNode(child, depth + 1))}
      </div>
    );
  };

  const moveChild = (idx, dir) => setOrderedChildren((prev) => { const next = [...prev]; const j = idx + dir; if (j < 0 || j >= next.length) return prev; [next[idx], next[j]] = [next[j], next[idx]]; return next; });

  const getExpiryStatus = (expiryDate) => {
    const now = new Date("2026-05-01"); const exp = new Date(expiryDate); const diff = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { label: "已过期", color: C.danger, bg: C.dangerBg };
    if (diff <= 30) return { label: "即将过期", color: C.warning, bg: C.warningBg };
    return { label: "有效", color: C.success, bg: C.successBg };
  };

  const handleAssignReview = () => {
    const target = staffForReview.find((s) => s.id === reviewForm.targetId);
    if (!target) return;
    setReviews([...reviews, { id: `PR-${String(reviews.length + 1).padStart(3, "0")}`, reviewerId: "S003", reviewerName: "王建国", targetId: target.id, targetName: target.name, caseId: `CASE-2026-${String(Math.floor(Math.random() * 1000)).padStart(4, "0")}`, caseType: reviewForm.caseType, score: 0, comment: "待评审", reviewDate: "", status: "pending" }]);
    setShowReviewModal(false); setReviewForm({ targetId: "", caseType: "CT", comment: "" });
  };

  const handleSubmitReview = (id) => { setReviews((prev) => prev.map((r) => r.id === id ? { ...r, score: reviewScore, comment: reviewForm.comment || "已评审", reviewDate: "2026-05-01", status: "completed" } : r)); setReviewScore(0); };

  return (
    <PageContainer background="gray" maxWidth="full" padding={16} testId="department-page">
      <DepartmentHeader onExport={() => setShowExportModal(true)} onAdd={() => setShowAddModal(true)} />
      <DepartmentStats />
      {/* [W2-A] 数据源状态条 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 12, flexWrap: "wrap", padding: "0 16px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 12px", borderRadius: 999,
          background: dataSource === "api" ? "#d1fae5" : "#fef3c7",
          color: dataSource === "api" ? "#059669" : "#d97706", fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dataSource === "api" ? "#059669" : "#d97706" }} />
          {loading ? "数据同步中..." : dataSource === "api" ? "数据源: API 实时 (userApi/deviceApi/criticalExtApi/statsApi)" : "数据源: 演示数据"}
        </span>
        {apiError && (
          <span style={{ color: "#dc2626" }}>
            {apiError}
            <button onClick={() => void loadDeptData()} style={{ marginLeft: 8, padding: "2px 10px", borderRadius: 4, border: "1px solid #dc2626", background: "transparent", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>重试</button>
          </span>
        )}
        <span style={{ color: "#9ca3af" }}>同行评审区块为内置演示数据</span>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 16px", borderBottom: `1px solid ${C.borderLight}`, background: "var(--bg-card)", overflowX: "auto", whiteSpace: "nowrap" }}>
        {[["staff","人员管理",Users],["performance","绩效统计",BarChart3],["attendance","考勤管理",Calendar],["config","科室配置",Settings],["org","组织架构",Users],["credentials","资质管理",Award],["kpi","KPI仪表盘",BarChart3],["review","同行评审",Eye]].map(([id,label,Icon]) => (
          <button key={id} style={tb(activeTab === id)} onClick={() => setActiveTab(id)}><Icon style={{ width: 14, height: 14, marginRight: 4 }} />{label}</button>
        ))}
      </div>
      {activeTab === "staff" && <DepartmentStaffList selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} roleFilter={roleFilter} setRoleFilter={setRoleFilter} searchKeyword={searchKeyword} setSearchKeyword={setSearchKeyword} onEdit={() => setShowEditModal(true)} />}
      {activeTab === "performance" && <DepartmentFinanceSummary activeTab="performance" />}
      {activeTab === "attendance" && <DepartmentSchedule />}
      {activeTab === "kpi" && <DepartmentFinanceSummary activeTab="kpi" />}

      {/* Config tab */}
      {activeTab === "config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={panel}>
              <div style={pH}><span>科室信息</span><button onClick={() => setEditingConfig(!editingConfig)} style={{ padding: "4px 12px", background: editingConfig ? C.success : C.primary, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>{editingConfig ? <><Save style={{ width: 12, height: 12 }} /> 保存</> : <><Edit3 style={{ width: 12, height: 12 }} /> 编辑</>}</button></div>
              <div style={pB}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[["科室名称", deptConfig.name], ["科室代码", deptConfig.code], ["科室主任", deptConfig.director], ["联系电话", deptConfig.phone], ["位置", deptConfig.location], ["成立时间", deptConfig.established]].map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div style={panel}>
              <div style={pH}><span>班次时间配置</span></div>
              <div style={pB}>{SHIFTS.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-card)", borderRadius: 6, marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} /><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>{s.name}</div><div style={{ fontSize: 12, color: C.textMid }}>{s.time}</div></div>
                </div>
              ))}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={panel}>
              <div style={pH}><span>质控标准配置</span><span style={{ fontSize: 12, color: C.success }}>{dataSource === 'api' ? 'API 实时' : '演示数据'} · 全部达标</span></div>
              <div style={pB}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "var(--bg-card)" }}><th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>指标</th><th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>目标</th><th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>当前</th><th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>状态</th></tr></thead>
                  <tbody>{qcStandards.map((qc) => (
                    <tr key={qc.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: "8px 10px", color: C.textDark }}>{qc.item}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: C.textMid }}>{qc.target}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: C.textDark, fontWeight: 500 }}>{qc.current}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: C.successBg, color: C.success }}>达标</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div style={panel}>
              <div style={pH}><span>危急值阈值配置</span><span style={{ fontSize: 12, color: C.textLight }}>{dataSource === 'api' ? 'criticalExtApi 实时' : '演示数据'}</span></div>
              <div style={pB}>{criticalValues.map((cv) => (
                <div key={cv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-card)", borderRadius: 6, marginBottom: 8, borderLeft: `3px solid ${cv.alertLevel === "critical" ? C.danger : C.warning}` }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{cv.type}</div><div style={{ fontSize: 12, color: C.textMid }}>{cv.modality ? `${cv.modality} · ` : ''}阈值: {cv.threshold} · {cv.description}</div></div>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: cv.alertLevel === "critical" ? C.dangerBg : C.warningBg, color: cv.alertLevel === "critical" ? C.danger : C.warning }}>{cv.alertLevel === "critical" ? "危" : "急"}</span>
                </div>
              ))}</div>
            </div>
          </div>
        </div>
      )}

      {/* Org tab */}
      {activeTab === "org" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 16 }}>
          <div style={panel}><div style={pH}><span>组织架构树</span><span style={{ fontSize: 12, color: C.textLight }}>{dataSource === 'api' ? 'userApi/deviceApi 实时' : '点击展开/折叠'}</span></div><div style={{ padding: 16, maxHeight: 500, overflow: "auto" }}>{renderOrgNode(orgTree)}</div></div>
          <div style={panel}>
            <div style={pH}><span>{selectedOrg?.name || "节点详情"}</span></div>
            <div style={pB}>{selectedOrg ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>{selectedOrg.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div><span style={{ color: C.textMid, fontSize: 12 }}>类型：</span><span style={{ fontSize: 13, color: C.textDark }}>{selectedOrg.type === "hospital" ? "医院" : selectedOrg.type === "department" ? "科室" : selectedOrg.type === "section" ? "组" : "小组"}</span></div>
                  <div><span style={{ color: C.textMid, fontSize: 12 }}>负责人：</span><span style={{ fontSize: 13, color: C.textDark }}>{selectedOrg.headName || "-"}</span></div>
                  <div><span style={{ color: C.textMid, fontSize: 12 }}>人员数：</span><span style={{ fontSize: 13, color: C.textDark }}>{selectedOrg.staffCount || "-"}</span></div>
                  <div><span style={{ color: C.textMid, fontSize: 12 }}>节点ID：</span><span style={{ fontSize: 13, color: C.textLight }}>{selectedOrg.id}</span></div>
                </div>
                {selectedOrg.children && selectedOrg.children.length > 0 && (
                  <div style={{ padding: 12, background: C.bgLight, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>下级节点（{orderedChildren.length}个）</div>
                    {orderedChildren.map((child, idx) => (
                      <div key={child.id} style={{ padding: "6px 4px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 13, color: C.textDark, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 18, color: C.textLight, fontSize: 11 }}>{idx + 1}.</span>
                        <span style={{ flex: 1 }}>{child.name}</span>
                        <button onClick={() => moveChild(idx, -1)} disabled={idx === 0} title="上移" style={{ border: `1px solid ${C.border}`, background: idx === 0 ? C.bgLight : C.white, color: idx === 0 ? C.textLight : C.textDark, cursor: idx === 0 ? "not-allowed" : "pointer", borderRadius: 4, padding: "2px 6px" }}><ChevronUp size={12} /></button>
                        <button onClick={() => moveChild(idx, 1)} disabled={idx === orderedChildren.length - 1} title="下移" style={{ border: `1px solid ${C.border}`, background: idx === orderedChildren.length - 1 ? C.bgLight : C.white, color: idx === orderedChildren.length - 1 ? C.textLight : C.textDark, cursor: idx === orderedChildren.length - 1 ? "not-allowed" : "pointer", borderRadius: 4, padding: "2px 6px" }}><ChevronDown size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <div style={{ color: C.textLight, textAlign: "center", padding: 40 }}>请选择一个组织节点</div>}</div>
          </div>
        </div>
      )}

      {/* Credentials tab */}
      {activeTab === "credentials" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 16 }}>
          <div style={panel}>
            <div style={pH}><span>人员资质</span><span style={{ fontSize: 12, color: C.textLight }}>{dataSource === 'api' ? 'userApi 实时' : '演示数据'}</span></div>
            <div style={{ padding: 12 }}><div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflow: "auto" }}>
              {(deptStaff.length > 0 ? deptStaff : [selectedStaff || { id: "S001", name: "张伟明", title: "主任医师" }]).map((s) => (
                <div key={s.id} onClick={() => setSelectedCredStaff(s)} style={{ padding: "10px 12px", borderRadius: 6, cursor: "pointer", background: selectedCredStaff?.id === s.id ? C.primaryLighter : C.white, border: `1px solid ${selectedCredStaff?.id === s.id ? C.primary : C.borderLight}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.primaryLight, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{s.name.charAt(0)}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{s.name}</div><div style={{ fontSize: 12, color: C.textMid }}>{s.title}</div></div>
                </div>
              ))}
            </div></div>
          </div>
          <div style={panel}>
            <div style={pH}><span>{selectedCredStaff?.name || "选择人员"} - 资质证书</span></div>
            <div style={pB}>
              {credentials.filter((c) => c.staffId === selectedCredStaff?.id).length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: C.textLight }}>暂无资质记录</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {credentials.filter((c) => c.staffId === selectedCredStaff?.id).map((c) => {
                    const expiry = getExpiryStatus(c.expiryDate);
                    return (
                      <div key={c.id} style={{ padding: 14, background: C.white, borderRadius: 8, border: `1px solid ${C.borderLight}`, borderLeft: `4px solid ${expiry.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div><div style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{c.name}</div><div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>{c.type === "license" ? "执业证" : c.type === "certification" ? "上岗证" : "继续教育"} · {c.issuingAuthority}</div></div>
                          <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: expiry.bg, color: expiry.color }}>{expiry.label}</span>
                        </div>
                        <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: C.textMid }}><span>颁发：{c.issueDate}</span><span>到期：{c.expiryDate}</span>{c.credits && <span>学分：{c.credits}分</span>}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {credentials.filter((c) => getExpiryStatus(c.expiryDate).label !== "有效").length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: C.dangerBg, borderRadius: 6, border: `1px solid ${C.danger}30` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><AlertTriangle size={14} color={C.danger} /><span style={{ fontSize: 13, fontWeight: 500, color: C.danger }}>到期提醒</span></div>
                  {credentials.filter((c) => getExpiryStatus(c.expiryDate).label !== "有效").slice(0, 5).map((c) => (
                    <div key={c.id} style={{ fontSize: 12, color: C.textMid, padding: "4px 0", borderBottom: `1px solid ${C.danger}20` }}>{c.name}（{c.expiryDate}）</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review tab */}
      {activeTab === "review" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
          <div style={panel}>
            <div style={pH}><span>评审任务</span><span style={{ fontSize: 12, color: C.textLight }}>演示数据</span><button onClick={() => setShowReviewModal(true)} style={{ padding: "4px 10px", background: C.primary, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Plus size={12} /> 分配评审</button></div>
            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: 14, borderBottom: `1px solid ${C.borderLight}`, borderLeft: `4px solid ${r.status === "completed" ? C.success : C.warning}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{r.targetName}</div><div style={{ fontSize: 12, color: C.textMid }}>{r.caseType} · {r.caseId}</div></div>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: r.status === "completed" ? C.successBg : C.warningBg, color: r.status === "completed" ? C.success : C.warning }}>{r.status === "completed" ? `评分${r.score}` : "待评审"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>{r.reviewerName} · {r.status === "completed" ? r.reviewDate : "未完成"}</div>
                  {r.status === "pending" && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => { setReviewScore(s); setReviewForm((prev) => ({ ...prev, comment: `评分${s}星` })); handleSubmitReview(r.id); }} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${reviewScore === s ? C.warning : C.border}`, background: reviewScore === s ? C.warningBg : C.white, cursor: "pointer", fontSize: 12, color: reviewScore === s ? C.warning : C.textMid }}>{s}</button>
                      ))}
                    </div>
                  )}
                  {r.status === "completed" && r.comment && <div style={{ marginTop: 6, fontSize: 12, color: C.textMid, fontStyle: "italic" }}>点评：{r.comment}</div>}
                </div>
              ))}
            </div>
          </div>
          <div style={panel}>
            <div style={pH}><span>评审员绩效</span></div>
            <div style={pB}>{REVIEWER_METRICS.map((rm, i) => (
              <div key={i} style={{ padding: 12, background: C.bgLight, borderRadius: 6, border: `1px solid ${C.borderLight}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{rm.name}</span><span style={{ fontSize: 12, color: C.primary }}>平均 {rm.avgScore}分</span></div>
                <div style={{ fontSize: 12, color: C.textMid }}>已完成 {rm.completed}/{rm.totalCases} 例 · 采纳率 {rm.acceptance}%</div>
                <div style={{ marginTop: 6, background: C.white, height: 4, borderRadius: 2, overflow: "hidden" }}><div style={{ width: `${(rm.completed / rm.totalCases) * 100}%`, height: "100%", background: C.primary, borderRadius: 2 }} /></div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showExportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, minWidth: 320, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: C.textDark }}>导出报表</div>
            <div style={{ fontSize: 14, color: C.textMid, marginBottom: 20 }}>正在导出报表，请稍候...</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={() => setShowExportModal(false)} style={{ padding: "8px 16px", background: C.primary, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>关闭</button></div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, minWidth: 320, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: C.textDark }}>编辑人员</div>
            <div style={{ fontSize: 14, color: C.textMid, marginBottom: 20 }}>正在编辑人员: {selectedStaff?.name}</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={() => setShowEditModal(false)} style={{ padding: "8px 16px", background: C.primary, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>关闭</button></div>
          </div>
        </div>
      )}
      {showReviewModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, minWidth: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><div style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>分配评审任务</div><button onClick={() => setShowReviewModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textMid} /></button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ display: "block", fontSize: 13, color: C.textMid, marginBottom: 6 }}>被评审人</label>
                <select value={reviewForm.targetId} onChange={(e) => setReviewForm({ ...reviewForm, targetId: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                  <option value="">选择人员</option>{staffForReview.filter((s) => s.role === "physician").map((s) => <option key={s.id} value={s.id}>{s.name}（{s.title}）</option>)}
                </select>
              </div>
              <div><label style={{ display: "block", fontSize: 13, color: C.textMid, marginBottom: 6 }}>病例类型</label>
                <select value={reviewForm.caseType} onChange={(e) => setReviewForm({ ...reviewForm, caseType: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}><option value="CT">CT</option><option value="MR">MR</option><option value="DR">DR</option></select>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setShowReviewModal(false)} style={{ padding: "8px 16px", background: C.bgLight, color: C.textMid, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>取消</button>
                <button onClick={handleAssignReview} style={{ padding: "8px 16px", background: C.primary, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>分配</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
