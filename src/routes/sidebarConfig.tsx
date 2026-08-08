/**
 * G005 放射RIS系统 v3.0.1 - 全局路由表与侧边栏配置
 * 从 v3.0.0 单体 App.tsx (768 行) 拆出,便于按域分文件维护
 */
import React from "react";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Calendar,
  Activity,
  Box,
  Camera,
  FileText,
  Layers,
  ShieldCheck,
  BarChart3,
  ClipboardCheck,
  BookOpen,
  Shield,
  Bell,
  Package,
  Pen,
  ShieldAlert,
  UserCheck,
  GraduationCap,
  UsersRound,
  Database,
  Monitor,
  Radio,
  Cpu,
  Crosshair,
  Printer,
  ListChecks,
  ClipboardList,
  ListOrdered,
  ScrollText,
  AlertOctagon,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Gauge,
  FileStack,
  Wrench,
  Settings,
  Leaf,
  Zap,
  Network,
  BarChart2,
  UserCircle,
  History,
  Search,
  Sliders,
  Wand2,
  Download,
  Send,
  Smartphone,
  Stamp,
  Link2,
  Clock,
  Target,
  Award,
  Wallet,
  FileSpreadsheet,
  Edit3,
  GitBranch,
  Eye,
  Image,
  Calculator,
  Sparkles,
  Upload,
  Archive,
  Hammer,
  Fingerprint,
  Video,
  Server,
  FolderOpen, // [W1-A v3.0.6.11-79] 文件管理
} from "lucide-react";
import type { ReactNode } from "react";
import { GitCompare, FileDown, Globe, FileSignature, Scan, Mic, Code, Siren, Heart, Bone, Brain, Plug, LayoutGrid } from 'lucide-react';

export type Role = "医生" | "技师" | "护士" | "管理员" | "主任";

export interface SidebarItem {
  path: string;
  icon: ReactNode;
  labelKey: string;
  roles: ReadonlyArray<Role>;
}

export interface SidebarSection {
  section: string;
  items: ReadonlyArray<SidebarItem>;
}

export const ROLE_NAMES: ReadonlyArray<Role> = [
  "医生",
  "技师",
  "护士",
  "管理员",
  "主任",
];

export const SIDEBAR_ITEMS: ReadonlyArray<SidebarSection> = [
  {
    section: "nav.workbench",
    items: [
      {
        path: "/",
        icon: <LayoutDashboard size={18} />,
        labelKey: "nav.homeOverview",
        roles: ["医生", "技师", "护士", "管理员", "主任"],
      },
      {
        path: "/worklist",
        icon: <ListChecks size={18} />,
        labelKey: "nav.worklist",
        roles: ["医生", "技师", "护士", "管理员", "主任"],
      },
      {
        path: "/triage/worklist",
        icon: <ListOrdered size={18} />,
        labelKey: "nav.triageWorklist",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/triage/dashboard",
        icon: <Siren size={18} />,
        labelKey: "nav.triageDashboard",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/exams",
        icon: <ClipboardList size={18} />,
        labelKey: "nav.examRecords",
        roles: ["医生", "技师", "护士", "管理员", "主任"],
      },
    ],
  },
  {
    section: "nav.patientManagement",
    items: [
      {
        path: "/patients",
        icon: <Users size={18} />,
        labelKey: "nav.patientManage",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/appointments",
        icon: <CalendarClock size={18} />,
        labelKey: "nav.appointment",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/appointment-management",
        icon: <Settings size={18} />,
        labelKey: "nav.appointmentManage",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/queue-call",
        icon: <ListOrdered size={18} />,
        labelKey: "nav.queueCall",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/follow-up",
        icon: <UserCheck size={18} />,
        labelKey: "nav.followUp",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/kiosk/check-in",
        icon: <Smartphone size={18} />,
        labelKey: "nav.kioskCheckIn",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patient/self-service",
        icon: <UserCircle size={18} />,
        labelKey: "nav.selfServicePortal",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patient/service-management",
        icon: <Settings size={18} />,
        labelKey: "nav.serviceManagement",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patients/:id/360",
        icon: <Eye size={18} />,
        labelKey: "nav.patient360",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
    ],
  },
  {
    section: "nav.reportManagement",
    items: [
      {
        path: "/write-report",
        icon: <Edit3 size={18} />,
        labelKey: "nav.writeReport",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/reports/v3-write",
        icon: <Edit3 size={18} />,
        labelKey: "nav.writeReportV3",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/reports",
        icon: <FileText size={18} />,
        labelKey: "nav.reportList",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/critical-value",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.criticalValue",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/consultation",
        icon: <MessageSquare size={18} />,
        labelKey: "nav.consultation",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/tele/conference",
        icon: <Monitor size={18} />,
        labelKey: "nav.teleConference",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [Sprint 4] F16 Tele-Sign
      {
        path: "/tele-sign",
        icon: <FileSignature size={18} />,
        labelKey: "nav.teleSign",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-review",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.reportReview",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-revisions",
        icon: <History size={18} />,
        labelKey: "nav.reportRevisions",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/collaboration",
        icon: <Users size={18} />,
        labelKey: "nav.collaboration",
        roles: ["医生", "主任", "管理员",],
      },
      // [Sprint 4] F15 Dual Read
      {
        path: "/dual-read",
        icon: <GitCompare size={18} />,
        labelKey: "nav.dualRead",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/keyword-check",
        icon: <Search size={18} />,
        labelKey: "nav.keywordCheck",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-score-rule",
        icon: <Sliders size={18} />,
        labelKey: "nav.scoreRule",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-defect-library",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.defectLibrary",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai-report-draft",
        icon: <Wand2 size={18} />,
        labelKey: "nav.aiReportDraft",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/critical-value-rule",
        icon: <Settings size={18} />,
        labelKey: "nav.cvRule",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/critical-value-stats",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.cvStats",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/special-assessment",
        icon: <Award size={18} />,
        labelKey: "nav.specialAssessment",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-export",
        icon: <Download size={18} />,
        labelKey: "nav.reportExport",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/export/approval",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.exportApproval",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/publish",
        icon: <FileStack size={18} />,
        labelKey: "nav.publish",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-delivery",
        icon: <Send size={18} />,
        labelKey: "nav.reportDelivery",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/patient-report-portal",
        icon: <Smartphone size={18} />,
        labelKey: "nav.patientPortal",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ca-signature",
        icon: <Stamp size={18} />,
        labelKey: "nav.caSignature",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/nlp/spellcheck",
        icon: <BookOpen size={18} />,
        labelKey: "nav.nlpSpellcheck",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/asr/transcribe",
        icon: <Mic size={18} />,
        labelKey: "nav.asrTranscribe",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/snomed/encode",
        icon: <Code size={18} />,
        labelKey: "nav.snomedEncode",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/snomed/encoder",
        icon: <Code size={18} />,
        labelKey: "nav.snomedEncoder",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/blockchain-proof",
        icon: <Link2 size={18} />,
        labelKey: "nav.blockchainProof",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/management",
        icon: <Sliders size={18} />,
        labelKey: "nav.cdsManagement",
        roles: ["医生", "主任", "管理员",],
      },
      // [G005 W2-B] CDS 6 方法页面: 指南库 / 告警中心 / 剂量监测
      {
        path: "/cds/guidelines",
        icon: <BookOpen size={18} />,
        labelKey: "nav.cdsGuidelines",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/alerts",
        icon: <Bell size={18} />,
        labelKey: "nav.cdsAlertCenter",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/dose-monitoring",
        icon: <Gauge size={18} />,
        labelKey: "nav.cdsDoseMonitoring",
        roles: ["主任", "管理员", "技师",],
      },
      {
        path: "/cds/statistics",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.cdsStatistics",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/rule-config",
        icon: <Sliders size={18} />,
        labelKey: "nav.ruleConfig",
        roles: ["主任", "管理员"],
      },
    ],
  },
  {
      section: "nav.qualityControlV3",
    items: [
      {
        path: "/review-center",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.reviewCenter",
        roles: ["主任", "管理员"],
      },
      {
        path: "/quality-control",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.qualityControlV3",
        roles: ["主任", "管理员"],
      },
      {
        path: "/critical-value-center",
        icon: <ShieldAlert size={18} />,
        labelKey: "nav.criticalValueCenter",
        roles: ["主任", "管理员"],
      },
      {
        path: "/defect-management",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.defectManagement",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.8-27] 放射科质控总看板(新增)
      {
        path: "/qc-dashboard",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.qcDashboard",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc-image",
        icon: <Camera size={18} />,
        labelKey: "nav.qcImage",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc-radiologist-annual",
        icon: <Users size={18} />,
        labelKey: "nav.qcRadiologistAnnual",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc/image-ai",
        icon: <Sparkles size={18} />,
        labelKey: "nav.qcImageAi",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/cosign",
        icon: React.createElement(UserCheck, { size: 18 }),
        labelKey: "nav.cosign",
        roles: ["主任", "管理员"],
      },
      {
        path: "/radpath/tracker",
        icon: React.createElement(GitCompare, { size: 18 }),
        labelKey: "nav.radpathTracker",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-40] A14 Critical Alert
      {
        path: "/critical-alert",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.criticalAlert",
        roles: ["医生", "主任", "管理员", "护士"],
      },
      // [v3.0.6.11-79] W2-A 危急值接收端门户
      {
        path: "/critical-value-receiver",
        icon: <Bell size={18} />,
        labelKey: "nav.criticalValueReceiver",
        roles: ["医生", "主任", "管理员", "护士"],
      },
    ],
  },
  {
    section: "nav.workflowV3",
    items: [
      {
        path: "/workflow-designer",
        icon: <Layers size={18} />,
        labelKey: "nav.workflowDesigner",
        roles: ["管理员"],
      },
      {
        path: "/routing-rules",
        icon: <GitBranch size={18} />,
        labelKey: "nav.routingRules",
        roles: ["管理员"],
      },
      {
        path: "/workload-heatmap",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.workloadHeatmap",
        roles: ["管理员"],
      },
      {
        path: "/sla-policy",
        icon: <Clock size={18} />,
        labelKey: "nav.slaPolicy",
        roles: ["管理员"],
      },
      // [Sprint 4] F17 Smart Route
      {
        path: "/smart-route",
        icon: <GitBranch size={18} />,
        labelKey: "nav.smartRoute",
        roles: ["管理员"],
      },
      {
        path: "/orchestrator",
        icon: <GitBranch size={18} />,
        labelKey: "nav.orchestrator",
        roles: ["管理员", "主任"],
      },
      // [v3.0.6.11-40] A16 工作流补齐: Smart MWL / AI Triage / Smart Routing / CoSign / RadPath / CriticalValue5Step
      {
        path: "/smart-mwl",
        icon: <ListOrdered size={18} />,
        labelKey: "nav.smartMwl",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/ai-triage",
        icon: <Zap size={18} />,
        labelKey: "nav.aiTriageWorkflow",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/smart-routing",
        icon: <GitBranch size={18} />,
        labelKey: "nav.smartRouting",
        roles: ["管理员", "主任"],
      },
      {
        path: "/cosign-review",
        icon: <UserCheck size={18} />,
        labelKey: "nav.cosignReview",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/radpath",
        icon: <GitCompare size={18} />,
        labelKey: "nav.radpathLinkage",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/critical-value-5step",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.criticalValue5Step",
        roles: ["医生", "主任", "管理员", "护士"],
      },
    ],
  },
  {
    section: "nav.imagingPrint",
    items: [
      {
        path: "/dicom-viewer",
        icon: <Activity size={18} />,
        labelKey: "nav.dicomBrowser",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom-viewer-pro",
        icon: <Activity size={18} />,
        labelKey: "nav.dicomBrowserPro",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/fusion",
        icon: <Layers size={18} />,
        labelKey: "nav.dicomFusion",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/fusion-v2",
        icon: <Layers size={18} />,
        labelKey: "nav.fusionV2",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/volume-viewer",
        icon: <Box size={18} />,
        labelKey: "nav.dicomVolume",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.11-62] G005 3D 分割与定量 (对标 Siemens Lesion Quantification)
      {
        path: "/dicom/segmentation",
        icon: <Scan size={18} />,
        labelKey: "nav.segmentation",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-41] A12 影像处理补齐: MPR / MIP / VR / 后处理 / DBT
      {
        path: "/dicom/mpr",
        icon: <Layers size={18} />,
        labelKey: "nav.mpr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/mip",
        icon: <Layers size={18} />,
        labelKey: "nav.mip",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/vr",
        icon: <Box size={18} />,
        labelKey: "nav.vr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/post-processing",
        icon: <Settings size={18} />,
        labelKey: "nav.postProcessing",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/dbt",
        icon: <Layers size={18} />,
        labelKey: "nav.dbt",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-60] Auto-hanging 自动布局协议管理
      {
        path: "/dicom/hanging-protocols",
        icon: <LayoutGrid size={18} />,
        labelKey: "nav.hangingProtocols",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/print-management",
        icon: <Printer size={18} />,
        labelKey: "nav.filmPrint",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/ai-assist",
        icon: <Cpu size={18} />,
        labelKey: "nav.aiAssist",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/vna-dashboard",
        icon: <Database size={18} />,
        labelKey: "nav.vnaDashboard",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/web",
        icon: <Globe size={18} />,
        labelKey: "nav.dicomWeb",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/compress",
        icon: <FileDown size={18} />,
        labelKey: "nav.dicomCompress",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/4d",
        icon: <Activity size={18} />,
        labelKey: "nav.dicom4d",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [Sprint 4] F14 Cross-Modal Search
      {
        path: "/cross-modal-search",
        icon: <Search size={18} />,
        labelKey: "nav.crossModalSearch",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [v3.0.6.11-60] G005 相似病例检索 (对标 Siemens Similar Patient Search)
      {
        path: "/similar-case",
        icon: <Brain size={18} />,
        labelKey: "nav.similarCaseSearch",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [P1-fix] 删除上方已重复的 cross-modal-search 条目
      {
        path: "/dicom/sr-manager",
        icon: <FileText size={18} />,
        labelKey: "nav.dicomSr",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/radiomics",
        icon: <Activity size={18} />,
        labelKey: "nav.radiomics",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-40] A13 WADO-RS / STOW-RS / SR Report
      {
        path: "/dicom/wado-rs",
        icon: <Globe size={18} />,
        labelKey: "nav.wadoRs",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/stow-rs",
        icon: <Upload size={18} />,
        labelKey: "nav.stowRs",
        roles: ["技师", "管理员"],
      },
      {
        path: "/dicom/sr-report",
        icon: <FileText size={18} />,
        labelKey: "nav.srReport",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [audit-fix-2026-07-28] DICOM/Fusion/Radiomics 管理
      {
        path: "/dicom/dimse",
        icon: <Radio size={18} />,
        labelKey: "nav.dicomDimse",
        roles: ["技师", "管理员", "医生", "主任"],
      },
      {
        path: "/dicom/sr-templates",
        icon: <FileText size={18} />,
        labelKey: "nav.dicomSrTemplates",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fusion/manager",
        icon: <Layers size={18} />,
        labelKey: "nav.fusionManager",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/radiomics/features",
        icon: <Activity size={18} />,
        labelKey: "nav.radiomicsFeatures",
        roles: ["医生", "主任", "管理员"],
      },
    ],
  },
  {
    section: "nav.aiIntelligence",
    items: [
      {
        path: "/ai-qc",
        icon: <Zap size={18} />,
        labelKey: "nav.aiQc",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai-structured-report",
        icon: <FileText size={18} />,
        labelKey: "nav.aiStructuredReport",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai-medical-device",
        icon: <Cpu size={18} />,
        labelKey: "nav.aiMedicalDevice",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai-draft",
        icon: <FileText size={18} />,
        labelKey: "nav.aiDraft",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai-cad",
        icon: <Crosshair size={18} />,
        labelKey: "nav.aiCad",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      {
        path: "/ai/rads-scoring",
        icon: <Sparkles size={18} />,
        labelKey: "nav.aiRadsScoring",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      {
        path: "/ai/review",
        icon: <Shield size={18} />,
        labelKey: "nav.aiReview",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/ai/providers",
        icon: <Cpu size={18} />,
        labelKey: "nav.aiProviders",
        roles: ["管理员",],
      },
      // [v3.0.6.11-40] A12 AI CAD 子专科
      {
        path: "/ai/lung-cad",
        icon: <Crosshair size={18} />,
        labelKey: "nav.lungCad",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/ai/breast-cad",
        icon: <Crosshair size={18} />,
        labelKey: "nav.breastCad",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/ai/fracture-cad",
        icon: <Crosshair size={18} />,
        labelKey: "nav.fractureCad",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/ai/cardiac-ai",
        icon: <Crosshair size={18} />,
        labelKey: "nav.cardiacAi",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      // [Sprint 4] F13 AI Marketplace
      {
        path: "/ai-marketplace",
        icon: <Cpu size={18} />,
        labelKey: "nav.aiMarketplace",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-41] A11 AI 集成补齐: 第三方 AI + 深度学习降噪
      {
        path: "/ai/third-party",
        icon: <Plug size={18} />,
        labelKey: "nav.thirdPartyAi",
        roles: ["管理员"],
      },
      {
        path: "/ai/dl-denoise",
        icon: <Sparkles size={18} />,
        labelKey: "nav.dlDenoise",
        roles: ["医生", "主任", "技师", "管理员"],
      },
    ],
  },
  {
    section: "nav.qualityControl",
    items: [
      {
        path: "/qc",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.imageQc",
        roles: ["主任", "管理员"],
      },
      {
        path: "/equipment-efficiency",
        icon: <BarChart2 size={18} />,
        labelKey: "nav.equipmentEfficiency",
        roles: ["主任", "管理员"],
      },
      {
        path: "/typical-cases",
        icon: <GraduationCap size={18} />,
        labelKey: "nav.typicalCases",
        roles: ["主任", "管理员"],
      },
      {
        path: "/teach/lecture",
        icon: <Video size={18} />,
        labelKey: "nav.teachLecture",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      {
        path: "/finding-library",
        icon: <Database size={18} />,
        labelKey: "nav.typicalFindings",
        roles: ["主任", "管理员"],
      },
      {
        path: "/term-library",
        icon: <BookOpen size={18} />,
        labelKey: "nav.reportGlossary",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-management",
        icon: <FileStack size={18} />,
        labelKey: "nav.templateManage",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-designer",
        icon: <FileStack size={18} />,
        labelKey: "nav.templateDesigner",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-inheritance",
        icon: <FileStack size={18} />,
        labelKey: "nav.templateInheritance",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-category",
        icon: <FileStack size={18} />,
        labelKey: "nav.templateCategory",
        roles: ["主任", "管理员"],
      },
      {
        path: "/term-synonym-graph",
        icon: <Network size={18} />,
        labelKey: "nav.termSynonymGraph",
        roles: ["主任", "管理员"],
      },
      {
        path: "/report-phrase-bank",
        icon: <BookOpen size={18} />,
        labelKey: "nav.phraseBank",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/adverse-events",
        icon: <ShieldAlert size={18} />,
        labelKey: "nav.adverseEvents",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/cqi",
        icon: <TrendingUp size={18} />,
        labelKey: "nav.cqi",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/patient-safety-goals",
        icon: <Target size={18} />,
        labelKey: "nav.patientSafetyGoals",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/radiation-safety",
        icon: <Radio size={18} />,
        labelKey: "nav.radiationSafety",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/rca-analysis",
        icon: <Search size={18} />,
        labelKey: "nav.rcaAnalysis",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/risk-management",
        icon: <Shield size={18} />,
        labelKey: "nav.riskManagement",
        roles: ["主任", "管理员"],
      },
    ],
  },
  {
    section: "nav.regionalCoordination",
    items: [
      {
        path: "/ihe/pix",
        icon: <Fingerprint size={18} />,
        labelKey: "nav.pixManager",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/integration/fhir/bulk-export",
        icon: <Download size={18} />,
        labelKey: "nav.fhirBulkExport",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/integration/fhir/bulk-export-detail",
        icon: <Activity size={18} />,
        labelKey: "nav.fhirBulkExportDetail",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/regional-report",
        icon: <FileText size={18} />,
        labelKey: "nav.regionalReport",
        roles: ["管理员"],
      },
      {
        path: "/schedule",
        icon: <CalendarClock size={18} />,
        labelKey: "nav.departmentSchedule",
        roles: ["管理员"],
      },
      {
        path: "/department",
        icon: <UsersRound size={18} />,
        labelKey: "nav.departmentManage",
        roles: ["管理员"],
      },
      {
        path: "/hie/medical-alliance",
        icon: <Network size={18} />,
        labelKey: "nav.medicalAlliance",
        roles: ["管理员"],
      },
      {
        path: "/integration/fhir-server",
        icon: <Network size={18} />,
        labelKey: "nav.fhirServer",
        roles: ["管理员"],
      },
      // [audit-fix-2026-07-28] FHIR CRUD 管理
      {
        path: "/fhir/patient",
        icon: <Users size={18} />,
        labelKey: "nav.fhirPatient",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/observation",
        icon: <Activity size={18} />,
        labelKey: "nav.fhirObservation",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/diagnostic-report",
        icon: <FileText size={18} />,
        labelKey: "nav.fhirDiagnosticReport",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/imaging-study",
        icon: <Layers size={18} />,
        labelKey: "nav.fhirImagingStudy",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/subscription",
        icon: <Bell size={18} />,
        labelKey: "nav.fhirSubscription",
        roles: ["管理员"],
      },
      {
        path: "/integration/ihe-connectathon",
        icon: <Network size={18} />,
        labelKey: "nav.iheConnectathon",
        roles: ["管理员"],
      },
      {
        path: "/integration/hl7-archive",
        icon: <Archive size={18} />,
        labelKey: "nav.hl7Archive",
        roles: ["管理员"],
      },
      {
        path: "/integration/hl7-builder",
        icon: <Hammer size={18} />,
        labelKey: "nav.hl7Builder",
        roles: ["管理员"],
      },
      // [G005 W2] FHIR SMART 授权
      {
        path: "/integration/smart-auth",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.smartAuth",
        roles: ["管理员", "主任"],
      },
      // [Sprint 4] F18 HL7 SIU
      {
        path: "/hl7-siu",
        icon: <CalendarClock size={18} />,
        labelKey: "nav.hl7Siu",
        roles: ["技师", "管理员"],
      },
      {
        path: "/ihe/pam",
        icon: <Network size={18} />,
        labelKey: "nav.ihePam",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/ihe/visit",
        icon: <Activity size={18} />,
        labelKey: "nav.iheVisit",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      // [audit-fix-2026-07-28] IHE/HL7 管理
      {
        path: "/ihe/manager",
        icon: <Network size={18} />,
        labelKey: "nav.iheManager",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/hl7/manager",
        icon: <Archive size={18} />,
        labelKey: "nav.hl7Manager",
        roles: ["技师", "管理员"],
      },
    ],
  },
  {
    section: "nav.dicomNetwork",
    items: [
      {
        path: "/integration/dimse",
        icon: <Activity size={18} />,
        labelKey: "nav.dimse",
        roles: ["技师", "管理员", "医生", "主任"],
      },
      {
        path: "/integration/dimse/upload",
        icon: <Upload size={18} />,
        labelKey: "nav.dimseUpload",
        roles: ["技师", "管理员"],
      },
    ],
  },
  {
    section: "nav.patientService",
    items: [
      {
        path: "/cancer-screen",
        icon: <Shield size={18} />,
        labelKey: "nav.cancerScreen",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/patient-portal",
        icon: <UserCircle size={18} />,
        labelKey: "nav.patientImageQuery",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/clinical-data",
        icon: <Database size={18} />,
        labelKey: "nav.clinicalData",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/education/patient-education",
        icon: <BookOpen size={18} />,
        labelKey: "nav.patientEducation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/patient",
        icon: <Smartphone size={18} />,
        labelKey: "nav.patientMobileApp",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/doctor",
        icon: <Smartphone size={18} />,
        labelKey: "nav.doctorMobileWorkstation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/nurse",
        icon: <Smartphone size={18} />,
        labelKey: "nav.nurseMobileWorkstation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/tech",
        icon: <Smartphone size={18} />,
        labelKey: "nav.techMobileWorkstation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/push",
        icon: <Bell size={18} />,
        labelKey: "nav.mobilePush",
        roles: ["护士", "医生", "管理员",],
      },
    ],
  },
  {
    section: "nav.dataAnalysis",
    items: [
      {
        path: "/statistics",
        icon: <TrendingUp size={18} />,
        labelKey: "nav.statistics",
        roles: ["主任", "管理员"],
      },
      {
        path: "/green-it",
        icon: <Leaf size={18} />,
        labelKey: "nav.greenIt",
        roles: ["主任", "管理员"],
      },
      {
        path: "/dept-dashboard",
        icon: <Gauge size={18} />,
        labelKey: "nav.departmentDashboard",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.11-40] A14 Remote Reading
      {
        path: "/remote-reading",
        icon: <Globe size={18} />,
        labelKey: "nav.remoteReading",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/operations-center",
        icon: <Monitor size={18} />,
        labelKey: "nav.operationsCenter",
        roles: ["主任", "管理员"],
      },
      {
        path: "/cost-analysis",
        icon: <DollarSign size={18} />,
        labelKey: "nav.costAnalysis",
        roles: ["主任", "管理员"],
      },
      {
        path: "/stats-report",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.dataStats",
        roles: ["主任", "管理员"],
      },
      {
        path: "/nuclear-stats",
        icon: <Radio size={18} />,
        labelKey: "nav.nuclearStats",
        roles: ["主任", "管理员"],
      },
      {
        path: "/report-kpi-dashboard",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.kpiDashboard",
        roles: ["主任", "管理员"],
      },
      {
        path: "/doctor-workload",
        icon: <Users size={18} />,
        labelKey: "nav.doctorWorkload",
        roles: ["主任", "管理员"],
      },
      {
        path: "/diagnosis-accuracy",
        icon: <Target size={18} />,
        labelKey: "nav.diagnosisAccuracy",
        roles: ["主任", "管理员"],
      },
      {
        path: "/report-timeliness",
        icon: <Clock size={18} />,
        labelKey: "nav.reportTimeliness",
        roles: ["主任", "管理员"],
      },
      {
        path: "/report-search",
        icon: <Search size={18} />,
        labelKey: "nav.reportSearch",
        roles: ["主任", "管理员"],
      },
      {
        path: "/operations/oee",
        icon: <Gauge size={18} />,
        labelKey: "nav.oeDashboard",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/cardiac/database",
        icon: <Database size={18} />,
        labelKey: "nav.cvDatabase",
        roles: ["主任", "管理员"],
      },
      {
        path: "/cardiac/operations",
        icon: <Activity size={18} />,
        labelKey: "nav.cvOperations",
        roles: ["主任", "管理员"],
      },
      {
        path: "/cardiac/qc",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.cvQc",
        roles: ["主任", "管理员"],
      },
      {
        path: "/ops/devices",
        icon: <Monitor size={18} />,
        labelKey: "nav.deviceOps",
        roles: ["主任", "管理员"],
      },
      {
        path: "/ops/hr",
        icon: <Users size={18} />,
        labelKey: "nav.hrOperations",
        roles: ["主任", "管理员"],
      },
  {
    path: "/ops/dashboard",
    icon: <Gauge size={18} />,
    labelKey: "nav.opsDashboard",
    roles: ["主任", "管理员"],
  },
      {
        path: "/operations/occupancy",
        icon: <LayoutDashboard size={18} />,
        labelKey: "nav.roomOccupancy",
        roles: ["主任", "管理员", "技师"],
      },
      // [v3.0.6.11-40] A14 Auto Collection
      {
        path: "/auto-collection",
        icon: <Settings size={18} />,
        labelKey: "nav.autoCollection",
        roles: ["管理员"],
      },
      {
        path: "/quality/department",
        icon: <Award size={18} />,
        labelKey: "nav.departmentQuality",
        roles: ["主任", "管理员"],
      },
      {
        path: "/analytics/benchmark-v2",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.benchmarkCompare",
        roles: ["主任", "管理员"],
      },
      {
        path: "/analytics/benchmark-ai-diagnosis",
        icon: <Target size={18} />,
        labelKey: "nav.aiDiagnosisAccuracy",
        roles: ["主任", "管理员"],
      },
      {
        path: "/analytics/tat-dashboard",
        icon: <Clock size={18} />,
        labelKey: "nav.tatDashboard",
        roles: ["主任", "管理员", "医生"],
      },
    ],
  },
  {
    section: "nav.revenue",
    items: [
      {
        path: "/charge-items",
        icon: <DollarSign size={18} />,
        labelKey: "nav.chargeItems",
        roles: ["管理员"],
      },
      {
        path: "/accounts-receivable",
        icon: <Wallet size={18} />,
        labelKey: "nav.accountsReceivable",
        roles: ["管理员"],
      },
      {
        path: "/revenue-analysis",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.revenueAnalysis",
        roles: ["管理员"],
      },
      {
        path: "/cost-accounting",
        icon: <TrendingUp size={18} />,
        labelKey: "nav.costAccounting",
        roles: ["管理员"],
      },
      {
        path: "/financial-reports",
        icon: <FileSpreadsheet size={18} />,
        labelKey: "nav.financialReports",
        roles: ["管理员"],
      },
    ],
  },
  {
    section: "nav.dataReport",
    items: [
      {
        path: "/national-report",
        icon: <ShieldAlert size={18} />,
        labelKey: "nav.nationalReport",
        roles: ["管理员"],
      },
      {
        path: "/data-report-center",
        icon: <Database size={18} />,
        labelKey: "nav.dataReportCenter",
        roles: ["管理员"],
      },
      {
        path: "/insurance-audit",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.insuranceAudit",
        roles: ["管理员"],
      },
      {
        path: "/enterprise-search",
        icon: <Search size={18} />,
        labelKey: "nav.enterpriseSearch",
        roles: ["管理员"],
      },
    ],
  },
  {
    section: "nav.eyeSpecialty",
    items: [
      {
        path: "/eye",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeWorkspace",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs",
        icon: <Image size={18} />,
        labelKey: "nav.eyePacs",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/fundus",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeFundus",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/oct",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeOct",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/oct-a",
        icon: <Image size={18} />,
        labelKey: "nav.eyeOcta",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/visual-field",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeVisualField",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/topography",
        icon: <Image size={18} />,
        labelKey: "nav.eyeTopography",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/ffa",
        icon: <Image size={18} />,
        labelKey: "nav.eyeFfa",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/compare",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeCompare",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/montage",
        icon: <Image size={18} />,
        labelKey: "nav.eyeMontage",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ris",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeRis",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/report-write",
        icon: <FileText size={18} />,
        labelKey: "nav.eyeReportWrite",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ris/iol-calculator",
        icon: <Calculator size={18} />,
        labelKey: "nav.eyeIol",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ris/va",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeVa",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ris/iop",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeIop",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/emr",
        icon: <BookOpen size={18} />,
        labelKey: "nav.eyeEmr",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ai",
        icon: <Sparkles size={18} />,
        labelKey: "nav.eyeAi",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/kpi-dashboard",
        icon: <BarChart3 size={18} />,
        labelKey: "nav.eyeKpi",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-85] 补齐 14 条眼科导航(PR1-PR11)
      {
        path: "/eye/pacs/real-viewer",
        icon: <Image size={18} />,
        labelKey: "nav.eyePacsReal",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/viewer",
        icon: <Image size={18} />,
        labelKey: "nav.eyePacsViewer",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ai-report",
        icon: <Sparkles size={18} />,
        labelKey: "nav.eyeAiReport",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/toric-planner",
        icon: <Calculator size={18} />,
        labelKey: "nav.eyeToric",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/strabismus",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeStrabismus",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/neuro",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeNeuro",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/oncology",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeOncology",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/cornea",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeCornea",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/contact-lens",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeContactLens",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/low-vision",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeLowVision",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/cataract",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeCataract",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/refractive",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeRefractive",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/tele",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeTele",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/case-library",
        icon: <BookOpen size={18} />,
        labelKey: "nav.eyeCaseLibrary",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/optometry-loop",
        icon: <Activity size={18} />,
        labelKey: "nav.eyeOptometryLoop",
        roles: ["医生", "技师", "主任", "管理员",],
      },
    ],
  },
  // [v3.0.6.8-54] 口腔专科
  {
    section: "nav.dentalSpecialty",
    items: [
      {
        path: "/dental",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalWorkspace",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/studies",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalPacs",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/chart",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalChart",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/ai",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalAi",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/treatment",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalTreatment",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/implant",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalImplant",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/ortho",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalOrtho",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/tele",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalTele",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/inventory",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalInventory",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/dashboard",
        icon: React.createElement(BarChart3, { size: 18 }),
        labelKey: "nav.dentalDashboard",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-87] Phase 1: 修复 CAD/CAM
      {
        path: "/dental/cad",
        icon: React.createElement(Pen, { size: 18 }),
        labelKey: "nav.dentalCad",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-88] Phase 1: 种植 3D 规划
      {
        path: "/dental/implant-3d",
        icon: React.createElement(Box, { size: 18 }),
        labelKey: "nav.dentalImplant3d",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-89] Phase 1: 导板 + 上部
      {
        path: "/dental/guide",
        icon: React.createElement(Layers, { size: 18 }),
        labelKey: "nav.dentalGuide",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-90] Phase 2: 头影测量
      {
        path: "/dental/ceph",
        icon: React.createElement(Crosshair, { size: 18 }),
        labelKey: "nav.dentalCeph",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-92] Phase 2: 隐形矫治
      {
        path: "/dental/aligner",
        icon: React.createElement(Layers, { size: 18 }),
        labelKey: "nav.dentalAligner",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-93] Phase 3: CBCT 体渲染
      {
        path: "/dental/volume-viewer",
        icon: React.createElement(Box, { size: 18 }),
        labelKey: "nav.dentalVolume",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-94] Phase 4: 360° 患者视图
      {
        path: "/dental/patient-view",
        icon: React.createElement(Users, { size: 18 }),
        labelKey: "nav.dentalEmr",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-95] Phase 4: 收费/划价
      {
        path: "/dental/billing",
        icon: React.createElement(DollarSign, { size: 18 }),
        labelKey: "nav.dentalBilling",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-96] Phase 4: 排班+PSR
      {
        path: "/dental/schedule",
        icon: React.createElement(Calendar, { size: 18 }),
        labelKey: "nav.dentalSchedule",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-98] Phase 5: 口内照片
      {
        path: "/dental/photo",
        icon: React.createElement(Camera, { size: 18 }),
        labelKey: "nav.dentalPhoto",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.11-42] P2 牙体牙髓
      {
        path: "/dental/endo",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalEndo",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 牙周
      {
        path: "/dental/perio",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalPerio",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 修复
      {
        path: "/dental/restorative",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalRestorative",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔外科
      {
        path: "/dental/surgery",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalSurgery",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 儿牙
      {
        path: "/dental/pediatric",
        icon: React.createElement(Activity, { size: 18 }),
        labelKey: "nav.dentalPediatric",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔影像查看
      {
        path: "/dental/viewer",
        icon: React.createElement(Eye, { size: 18 }),
        labelKey: "nav.dentalViewer",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 3D扫描查看
      {
        path: "/dental/viewer/scan-3d",
        icon: React.createElement(Box, { size: 18 }),
        labelKey: "nav.dentalScan3d",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔标注
      {
        path: "/dental/annotate",
        icon: React.createElement(Pen, { size: 18 }),
        labelKey: "nav.dentalAnnotate",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 MPR重建
      {
        path: "/dental/viewer/mpr",
        icon: React.createElement(Layers, { size: 18 }),
        labelKey: "nav.dentalMpr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔ONNX AI
      {
        path: "/dental/ai-onnx",
        icon: React.createElement(Cpu, { size: 18 }),
        labelKey: "nav.dentalAiOnnx",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔转诊
      {
        path: "/dental/referral",
        icon: React.createElement(Users, { size: 18 }),
        labelKey: "nav.dentalReferral",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 CBCT报告
      {
        path: "/dental/cbct-report",
        icon: React.createElement(FileText, { size: 18 }),
        labelKey: "nav.dentalCbctReport",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔影像融合
      {
        path: "/dental/rad-fusion",
        icon: React.createElement(Layers, { size: 18 }),
        labelKey: "nav.dentalRadFusion",
        roles: ["医生", "技师", "主任", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 乳腺专科
  {
    section: "nav.specialtyModules",
    items: [
      {
        path: "/mammo/operations",
        icon: <Heart size={18} />,
        labelKey: "nav.mammoOperations",
        roles: ["主任", "管理员"],
      },
      {
        path: "/mammo/quality",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.mammoQuality",
        roles: ["主任", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 区域协同
  {
    section: "nav.regionalCoordination",
    items: [
      {
        path: "/regional-imaging",
        icon: <Image size={18} />,
        labelKey: "nav.regionalImaging",
        roles: ["管理员"],
      },
      {
        path: "/integration/mllp-monitor",
        icon: <Radio size={18} />,
        labelKey: "nav.mllpMonitor",
        roles: ["管理员", "技师"],
      },
      {
        path: "/integration/mllp-config",
        icon: <Settings size={18} />,
        labelKey: "nav.mllpConfig",
        roles: ["管理员"],
      },
      {
        path: "/ihe-integration",
        icon: <Network size={18} />,
        labelKey: "nav.iheIntegration",
        roles: ["主任", "管理员", "技师"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 数据分析
  {
    section: "nav.dataAnalysis",
    items: [
      {
        path: "/director-dashboard",
        icon: <LayoutDashboard size={18} />,
        labelKey: "nav.directorDashboard",
        roles: ["主任", "管理员"],
      },
      {
        path: "/command-center",
        icon: <Monitor size={18} />,
        labelKey: "nav.commandCenter",
        roles: ["主任", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 质控补充
  {
    section: "nav.qualityControl",
    items: [
      {
        path: "/research",
        icon: <GraduationCap size={18} />,
        labelKey: "nav.research",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/report-templates",
        icon: <FileStack size={18} />,
        labelKey: "nav.reportTemplates",
        roles: ["医生", "主任", "技师", "管理员", "护士"],
      },
      {
        path: "/clinical-calculators",
        icon: <Calculator size={18} />,
        labelKey: "nav.clinicalCalculators",
        roles: ["医生", "主任", "技师", "护士", "管理员"],
      },
      {
        path: "/patient-safety",
        icon: <Shield size={18} />,
        labelKey: "nav.patientSafety",
        roles: ["主任", "管理员", "护士"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 系统管理
  {
    section: "nav.systemManage",
    items: [
      {
        path: "/emr-templates",
        icon: <FileText size={18} />,
        labelKey: "nav.emrTemplates",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/system-admin",
        icon: <Settings size={18} />,
        labelKey: "nav.systemAdmin",
        roles: ["管理员"],
      },
      {
        path: "/audit-compliance",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.auditCompliance",
        roles: ["主任", "管理员"],
      },
      {
        path: "/compliance-docs",
        icon: <ScrollText size={18} />,
        labelKey: "nav.complianceDocs",
        roles: ["主任", "管理员"],
      }, // [v3.0.6.11-79 W1-C] 合规文档库
      {
        path: "/terminology-server",
        icon: <Server size={18} />,
        labelKey: "nav.terminologyServer",
        roles: ["医生", "主任", "技师", "管理员", "护士"],
      },
      {
        path: "/patient-device-mgmt",
        icon: <Monitor size={18} />,
        labelKey: "nav.patientDeviceMgmt",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/notif-tpl-dict",
        icon: <Bell size={18} />,
        labelKey: "nav.notifTplDict",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/audit",
        icon: <History size={18} />,
        labelKey: "nav.audit",
        roles: ["管理员"],
      },
      {
        path: "/authority",
        icon: <Shield size={18} />,
        labelKey: "nav.authority",
        roles: ["管理员"],
      },
      {
        path: "/dictionary",
        icon: <BookOpen size={18} />,
        labelKey: "nav.dictionary",
        roles: ["管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 患者管理
  {
    section: "nav.patientManagement",
    items: [
      {
        path: "/treatment-plans",
        icon: <ClipboardList size={18} />,
        labelKey: "nav.treatmentPlans",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/patient-unified",
        icon: <Users size={18} />,
        labelKey: "nav.patientUnified",
        roles: ["医生", "主任", "技师", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 影像打印
  {
    section: "nav.imagingPrint",
    items: [
      {
        path: "/dicom-share",
        icon: <Send size={18} />,
        labelKey: "nav.dicomShare",
        roles: ["医生", "主任", "技师", "管理员", "护士"],
      },
      {
        path: "/dicom-sr-manager",
        icon: <FileText size={18} />,
        labelKey: "nav.dicomSrManager",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/print-management",
        icon: <Printer size={18} />,
        labelKey: "nav.printManagement",
        roles: ["技师", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 工作流
  {
    section: "nav.workflowV3",
    items: [
      {
        path: "/scheduling-center",
        icon: <CalendarClock size={18} />,
        labelKey: "nav.schedulingCenter",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/clinical-pathways",
        icon: <GitBranch size={18} />,
        labelKey: "nav.clinicalPathways",
        roles: ["医生", "主任", "管理员", "护士"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: AI智能
  {
    section: "nav.aiIntelligence",
    items: [
      {
        path: "/ai-fusion-workspace",
        icon: <Layers size={18} />,
        labelKey: "nav.aiFusionWorkspace",
        roles: ["医生", "主任", "技师", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 患者服务
  {
    section: "nav.patientService",
    items: [
      {
        path: "/consent-education",
        icon: <BookOpen size={18} />,
        labelKey: "nav.consentEducation",
        roles: ["医生", "主任", "技师", "护士", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 报告管理
  {
    section: "nav.reportManagement",
    items: [
      {
        path: "/report-workflow",
        icon: <GitBranch size={18} />,
        labelKey: "nav.reportWorkflow",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/review-check",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.reviewCheck",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/sign-amend",
        icon: <FileSignature size={18} />,
        labelKey: "nav.signAmend",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/v3-report-hub",
        icon: <FileText size={18} />,
        labelKey: "nav.v3ReportHub",
        roles: ["医生", "主任", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 设备物资
  {
    section: "nav.equipmentMaterials",
    items: [
      {
        path: "/materials",
        icon: <Package size={18} />,
        labelKey: "nav.materials",
        roles: ["技师", "管理员"],
      },
      {
        path: "/supplies",
        icon: <Package size={18} />,
        labelKey: "nav.supplies",
        roles: ["技师", "管理员"],
      },
      {
        path: "/radiology-materials",
        icon: <Package size={18} />,
        labelKey: "nav.radiologyMaterials",
        roles: ["技师", "管理员"],
      },
    ],
  },
  // [v3.0.6.11-40] A15 专科模块: 乳腺/心脏/骨科/神经
  {
    section: "nav.specialtyModules",
    items: [
      {
        path: "/mammo/breast-specialty",
        icon: React.createElement(Heart, { size: 18 }),
        labelKey: "nav.breastSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/cardiac/cardiac-specialty",
        icon: React.createElement(Heart, { size: 18 }),
        labelKey: "nav.cardiacSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/ortho-specialty",
        icon: React.createElement(Bone, { size: 18 }),
        labelKey: "nav.orthoSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/neuro-specialty",
        icon: React.createElement(Brain, { size: 18 }),
        labelKey: "nav.neuroSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
    ],
  },
  {
    section: "nav.systemManage",
    items: [
      // [v3.0.6.11-79] W1-B 用户中心 (个人资料/改密/安全/退出)
      {
        path: "/user/center",
        icon: <UserCircle size={18} />,
        labelKey: "nav.userCenter",
        roles: ["医生", "技师", "护士", "管理员", "主任"],
      },
      {
        path: "/user-management",
        icon: <Shield size={18} />,
        labelKey: "nav.userManagement",
        roles: ["管理员"],
      },
      // [v3.0.6.11-40] A14 PACS Admin
      {
        path: "/pacs-admin",
        icon: <Server size={18} />,
        labelKey: "nav.pacsAdmin",
        roles: ["管理员"],
      },
      {
        path: "/admin/config",
        icon: <Sliders size={18} />,
        labelKey: "nav.clinicalConfig",
        roles: ["管理员"],
      },
      {
        path: "/dictionary",
        icon: <BookOpen size={18} />,
        labelKey: "nav.dataDictionary",
        roles: ["管理员"],
      },
      {
        path: "/operation-log",
        icon: <ScrollText size={18} />,
        labelKey: "nav.operationLog",
        roles: ["管理员"],
      },
      {
        path: "/notification-center",
        icon: <Bell size={18} />,
        labelKey: "nav.notification",
        roles: ["管理员"],
      },
      {
        path: "/system/dicom-print",
        icon: <Printer size={18} />,
        labelKey: "nav.dicomPrint",
        roles: ["管理员"],
      },
      {
        path: "/business-continuity",
        icon: <Shield size={18} />,
        labelKey: "nav.businessContinuity",
        roles: ["管理员"],
      },
      {
        path: "/multi-site",
        icon: <Network size={18} />,
        labelKey: "nav.multiSiteDashboard",
        roles: ["管理员"],
      },
      {
        path: "/cloud-storage",
        icon: <Database size={18} />,
        labelKey: "nav.cloudStorage",
        roles: ["管理员"],
      },
      {
        path: "/finance/department",
        icon: <DollarSign size={18} />,
        labelKey: "nav.departmentFinance",
        roles: ["管理员"],
      },
      {
        path: "/finance/patient",
        icon: <Wallet size={18} />,
        labelKey: "nav.patientFinance",
        roles: ["管理员"],
      },
      // [v3.0.6.11-21] 新增 v3.0.6.11-20 系统管理菜单
      {
        path: "/system/audit",
        icon: <History size={18} />,
        labelKey: "nav.systemAudit",
        roles: ["管理员"],
      },
      {
        path: "/system/backup",
        icon: <Database size={18} />,
        labelKey: "nav.systemBackup",
        roles: ["管理员"],
      },
      {
        path: "/system/tenant-config",
        icon: <Shield size={18} />,
        labelKey: "nav.tenantConfig",
        roles: ["管理员"],
      },
      {
        path: "/system/compliance",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.systemCompliance",
        roles: ["管理员", "主任"],
      },
      // [W1-A v3.0.6.11-79] 文件管理 (上传/下载/校验和确认)
      {
        path: "/system/files",
        icon: <FolderOpen size={18} />,
        labelKey: "nav.fileManagement",
        roles: ["管理员", "主任"],
      },
      {
        path: "/security/mfa-setup",
        icon: <Fingerprint size={18} />,
        labelKey: "nav.mfaSetup",
        roles: ["管理员", "主任", "医生", "技师", "护士"],
      },
    ],
  },
  {
    section: "nav.equipmentMaterials",
    items: [
      {
        path: "/equipment-lifecycle",
        icon: <Cpu size={18} />,
        labelKey: "nav.equipmentLifecycle",
        roles: ["技师", "管理员"],
      },
      {
        path: "/devices",
        icon: <Monitor size={18} />,
        labelKey: "nav.devices",
        roles: ["技师", "管理员"],
      },
      {
        path: "/device-fault",
        icon: <Wrench size={18} />,
        labelKey: "nav.faultRegister",
        roles: ["技师", "管理员"],
      },
      {
        path: "/materials",
        icon: <Package size={18} />,
        labelKey: "nav.materialsManage",
        roles: ["技师", "管理员"],
      },
      {
        path: "/dose-track",
        icon: <Activity size={18} />,
        labelKey: "nav.doseTrack",
        roles: ["技师", "管理员"],
      },
      {
        path: "/rdsr",
        icon: <Activity size={18} />,
        labelKey: "nav.rdsr",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/adverse-reactions",
        icon: <AlertOctagon size={18} />,
        labelKey: "nav.adverseReactions",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/injection-workstation",
        icon: <Monitor size={18} />,
        labelKey: "nav.injectionWorkstation",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/inventory",
        icon: <Package size={18} />,
        labelKey: "nav.contrastInventory",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/quality-compliance",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.contrastQualityCompliance",
        roles: ["技师", "管理员"],
      },
    ],
  },
];
