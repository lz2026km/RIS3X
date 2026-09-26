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
import { GitCompare, FileDown, Globe, FileSignature, Scan, Mic, Code, Siren, Heart, Bone, Brain, Plug, LayoutGrid, Stethoscope, Smile, Anchor, AlignCenter, Scissors, Baby } from 'lucide-react';
import { Cable, UserCog, DatabaseZap, Megaphone } from 'lucide-react';
// [v3.0.6.11-100 Wave 4A] 语音工作站图标
import { Headphones } from 'lucide-react';
import { ScanEye, Microscope, RefreshCw, PlayCircle, MonitorPlay, TimerReset, FlaskConical, Braces, PackageOpen, HeartPulse, Radiation, Boxes, Syringe, Contact, UserRound, UserPlus } from 'lucide-react';
import { PenLine, TextSelect, BookMarked, FileCheck2, KeyRound, FileSearch, BadgeCheck, Flame, Building2, Share2, Library, HardDrive, QrCode, Ruler, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Workflow, Route, Bug, Store, Glasses, EyeOff, Focus, Grid3X3, GitMerge, Images } from 'lucide-react';
import { PenSquare, FolderTree, Blend, BellRing, NotebookText, ToggleRight, Settings2, ListFilter, Cog, Ribbon, Map, Files, SquareStack } from 'lucide-react';
import { Cuboid, GalleryVerticalEnd, Layers3, ScanLine, ScanSearch, SearchCheck, FolderHeart, Timer } from 'lucide-react';
import { ChartLine, Command, Crown, ExternalLink, RadioTower, Webhook, Atom, LifeBuoy, Home, Mail, SlidersHorizontal, Repeat2, PieChart } from 'lucide-react';

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
        icon: <Home size={18} />,
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
        // [G005 W6] 登记工作站 (扫码/身份/准备项/知情同意/对比剂安全/缴费/分诊)
        path: "/registration",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.registrationWorkstation",
        roles: ["护士", "技师", "医生", "主任", "管理员"],
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
        icon: <UsersRound size={18} />,
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
        path: "/queue-call",
        icon: <Megaphone size={18} />,
        labelKey: "nav.queueCall",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/follow-up",
        icon: <CalendarCheck size={18} />,
        labelKey: "nav.followUp",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/kiosk/check-in",
        icon: <QrCode size={18} />,
        labelKey: "nav.kioskCheckIn",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patient/self-service",
        icon: <UserRound size={18} />,
        labelKey: "nav.selfServicePortal",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patient/service-management",
        icon: <UserCog size={18} />,
        labelKey: "nav.serviceManagement",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/patients/:id/360",
        icon: <UserRound size={18} />,
        labelKey: "nav.patient360",
        roles: ["医生", "技师", "护士", "主任", "管理员",],
      },
      {
        path: "/treatment-plans",
        icon: <ListChecks size={18} />,
        labelKey: "nav.treatmentPlans",
        roles: ["医生", "主任", "管理员"],
      },
    ],
  },
  {
    section: "nav.reportManagement",
    items: [
      {
        path: "/write-report",
        icon: <PenLine size={18} />,
        labelKey: "nav.writeReport",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/reports",
        icon: <FileText size={18} />,
        labelKey: "nav.reportList",
        roles: ["医生", "主任", "管理员",],
      },
      // [W6] 已归档报告列表 (只读)
      {
        path: "/reports/archived",
        icon: <Archive size={18} />,
        labelKey: "w6Workflow.archive.nav",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/critical-value",
        icon: <Siren size={18} />,
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
        icon: <MonitorPlay size={18} />,
        labelKey: "nav.teleConference",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [Sprint 4] F16 Tele-Sign
      {
        path: "/tele-sign",
        icon: <PenLine size={18} />,
        labelKey: "nav.teleSign",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-review",
        icon: <FileCheck2 size={18} />,
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
      // [v3.0.6.11-104 Wave 5C] 报告审核收敛: /dual-read 已并入 /review-center (综合审核枢纽) Tab, 重复菜单移除
      // [v3.0.6.11-104 Wave 5A] 报告书写收敛: /report-v2/workbench 已并入 /write-report, 移除旧菜单 (旧路径 redirect)
      {
        path: "/keyword-check",
        icon: <FileSearch size={18} />,
        labelKey: "nav.keywordCheck",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-score-rule",
        icon: <Gauge size={18} />,
        labelKey: "nav.scoreRule",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-defect-library",
        icon: <Bug size={18} />,
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
        icon: <ToggleRight size={18} />,
        labelKey: "nav.cvRule",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: /critical-value-stats 已内嵌为 /critical-value Tab, 移除旧菜单 (旧路由 redirect)
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
        icon: <Stamp size={18} />,
        labelKey: "nav.exportApproval",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/publish",
        icon: <Send size={18} />,
        labelKey: "nav.publish",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/report-delivery",
        icon: <Mail size={18} />,
        labelKey: "nav.reportDelivery",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/patient-report-portal",
        icon: <ExternalLink size={18} />,
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
        icon: <TextSelect size={18} />,
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
      // [v3.0.6.11-103 Wave 17] PACS 对标第一批: 结构化报告 V3 / 语音听写 V2 / 自动编码
      {
        path: "/report/v4/structured",
        icon: <Layers size={18} />,
        labelKey: "nav.structuredReportV3",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/asr/dictation",
        icon: <Mic size={18} />,
        labelKey: "nav.asrDictation",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-104 Wave 5C] SNOMED 收敛: /snomed/auto-coding + /snomed/encoder 已并入 /snomed/encode 三 Tab, 重复菜单移除
      {
        path: "/blockchain-proof",
        icon: <Link2 size={18} />,
        labelKey: "nav.blockchainProof",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/management",
        icon: <Settings2 size={18} />,
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
        icon: <BellRing size={18} />,
        labelKey: "nav.cdsAlertCenter",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/dose-monitoring",
        icon: <Radiation size={18} />,
        labelKey: "nav.cdsDoseMonitoring",
        roles: ["主任", "管理员", "技师",],
      },
      {
        path: "/cds/statistics",
        icon: <ChartLine size={18} />,
        labelKey: "nav.cdsStatistics",
        roles: ["医生", "主任", "管理员",],
      },
      {
        path: "/cds/rule-config",
        icon: <ListFilter size={18} />,
        labelKey: "nav.ruleConfig",
        roles: ["主任", "管理员"],
      },
      {
        path: "/report-workflow",
        icon: <Workflow size={18} />,
        labelKey: "nav.reportWorkflow",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-104 Wave 5C] 报告审核收敛: /review-check 已并入 /review-center (综合审核枢纽) Tab, 重复菜单移除
      {
        path: "/sign-amend",
        icon: <FileSignature size={18} />,
        labelKey: "nav.signAmend",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-104 Wave 5A] 报告书写收敛: /v3-report-hub 已并入 /write-report, 移除旧菜单 (旧路径 redirect)
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
      // [v3.0.6.11-100 Wave 2A] 审核组: 委员会会诊 (多医生合议)
      {
        path: "/committee-room",
        icon: <UsersRound size={18} />,
        labelKey: "nav.committeeRoom",
        roles: ["主任", "管理员", "医生"],
      },
      // [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: /critical-value-center 已内嵌为 /critical-value Tab, 移除旧菜单 (旧路由 redirect)
      {
        path: "/defect-management",
        icon: <ListChecks size={18} />,
        labelKey: "nav.defectManagement",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.8-27] 放射科质控总看板(新增)
      {
        path: "/qc-image",
        icon: <Camera size={18} />,
        labelKey: "nav.qcImage",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc-radiologist-annual",
        icon: <Award size={18} />,
        labelKey: "nav.qcRadiologistAnnual",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc/image-ai",
        icon: <ScanSearch size={18} />,
        labelKey: "nav.qcImageAi",
        roles: ["主任", "管理员", "技师"],
      },
      // [G005 Wave 3A v3.0.6.11-99] PDCA 质控闭环
      {
        path: "/qc/pdca",
        icon: <RefreshCw size={18} />,
        labelKey: "nav.qcPdca",
        roles: ["主任", "管理员"],
      },
      // [G005 v3.0.6.11-105 Wave 2B] 放射影像质控国标指标 (2024 版)
      {
        path: "/qc/rqi-2024",
        icon: <Gauge size={18} />,
        labelKey: "nav.rqi2024",
        roles: ["主任", "管理员", "医生"],
      },
      // [G005 v3.0.6.11-105 Wave 3] 放射影像质控指标国家上报中心
      {
        path: "/qc/rqi-report-center",
        icon: <Upload size={18} />,
        labelKey: "nav.rqiReportCenter",
        roles: ["主任", "管理员", "医生"],
      },
      // [G005 Wave 8B v3.0.6.11-101] 报告质控闭环与趋势分析
      {
        path: "/qc/analytics",
        icon: <TrendingUp size={18} />,
        labelKey: "nav.qcAnalytics",
        roles: ["主任", "管理员"],
      },
      {
        path: "/cosign",
        icon: React.createElement(UserCheck, { size: 18 }),
        labelKey: "nav.cosign",
        roles: ["主任", "管理员"],
      },
      {
        path: "/radpath/tracker",
        icon: React.createElement(Route, { size: 18 }),
        labelKey: "nav.radpathTracker",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: /critical-alert 已内嵌为 /critical-value Tab, 移除旧菜单 (旧路由 redirect)
      // [v3.0.6.11-79] W2-A 危急值接收端门户
      {
        path: "/critical-value-receiver",
        icon: <BellRing size={18} />,
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
        icon: <Workflow size={18} />,
        labelKey: "nav.workflowDesigner",
        roles: ["管理员"],
      },
      {
        path: "/routing-rules",
        icon: <Route size={18} />,
        labelKey: "nav.routingRules",
        roles: ["管理员"],
      },
      {
        path: "/workload-heatmap",
        icon: <Flame size={18} />,
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
        icon: <Route size={18} />,
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
        icon: <Route size={18} />,
        labelKey: "nav.smartRouting",
        roles: ["管理员", "主任"],
      },
      {
        path: "/radpath",
        icon: <Map size={18} />,
        labelKey: "nav.radpathLinkage",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: /critical-value-5step 已内嵌为 /critical-value Tab, 移除旧菜单 (旧路由 redirect)
      {
        path: "/scheduling-center",
        icon: <CalendarClock size={18} />,
        labelKey: "nav.schedulingCenter",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/clinical-pathways",
        icon: <Map size={18} />,
        labelKey: "nav.clinicalPathways",
        roles: ["医生", "主任", "管理员", "护士"],
      },
    ],
  },
  {
    section: "nav.imagingPrint",
    items: [
      {
        path: "/dicom-viewer",
        icon: <PlayCircle size={18} />,
        labelKey: "nav.dicomBrowser",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [W1] 真实 DICOM 阅片工作站 (Cornerstone3D 真实像素)
      {
        path: "/dicom/workstation",
        icon: <Monitor size={18} />,
        labelKey: "nav.dicomWorkstation",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/fusion",
        icon: <GitMerge size={18} />,
        labelKey: "nav.dicomFusion",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/fusion-v2",
        icon: <Layers size={18} />,
        labelKey: "nav.fusionV2",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [G005 v3.0.6.11-101 Wave 2A] 影像对比: 多时点/多序列/多模态并排 + 同步浏览
      {
        path: "/imaging-compare",
        icon: <GitCompare size={18} />,
        labelKey: "nav.imagingCompare",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/volume-viewer",
        icon: <Cuboid size={18} />,
        labelKey: "nav.dicomVolume",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.11-62] G005 3D 分割与定量 (对标 Siemens Lesion Quantification)
      {
        path: "/dicom/segmentation",
        icon: <Layers size={18} />,
        labelKey: "nav.segmentation",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-101 Wave 2B] 病理切片 WSI 全切片浏览与标注
      {
        path: "/pathology/wsi-viewer",
        icon: <Microscope size={18} />,
        labelKey: "nav.wsiViewer",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-99 Wave 4A] 病灶追踪 (登记/跨期对比/趋势图/随访联动)
      {
        path: "/dicom/lesion-tracking",
        icon: <Target size={18} />,
        labelKey: "nav.lesionTracking",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-41] A12 影像处理补齐: MPR / MIP / VR / 后处理 / DBT
      {
        path: "/dicom/mpr",
        icon: <Box size={18} />,
        labelKey: "nav.mpr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/mip",
        icon: <Grid3X3 size={18} />,
        labelKey: "nav.mip",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/vr",
        icon: <GalleryVerticalEnd size={18} />,
        labelKey: "nav.vr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-101 Wave 3A] 多平面重建 V2 工作室 (MPR 三平面联动 + VR + CPR + 切割)
      {
        path: "/dicom/volume-studio",
        icon: <Boxes size={18} />,
        labelKey: "nav.volumeStudio",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/post-processing",
        icon: <SlidersHorizontal size={18} />,
        labelKey: "nav.postProcessing",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/dicom/dbt",
        icon: <Grid3X3 size={18} />,
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
        icon: <Brain size={18} />,
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
        icon: <TimerReset size={18} />,
        labelKey: "nav.dicom4d",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [Sprint 4] F14 Cross-Modal Search
      {
        path: "/cross-modal-search",
        icon: <SearchCheck size={18} />,
        labelKey: "nav.crossModalSearch",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [v3.0.6.11-60] G005 相似病例检索 (对标 Siemens Similar Patient Search)
      {
        path: "/similar-case",
        icon: <Images size={18} />,
        labelKey: "nav.similarCaseSearch",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      // [P1-fix] 删除上方已重复的 cross-modal-search 条目
      {
        path: "/dicom/sr-manager",
        icon: <ScrollText size={18} />,
        labelKey: "nav.dicomSr",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dicom/radiomics",
        icon: <FlaskConical size={18} />,
        labelKey: "nav.radiomics",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-40] A13 WADO-RS / STOW-RS / SR Report
      {
        path: "/dicom/wado-rs",
        icon: <RadioTower size={18} />,
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
        icon: <ScrollText size={18} />,
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
        icon: <FileSignature size={18} />,
        labelKey: "nav.dicomSrTemplates",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fusion/manager",
        icon: <Boxes size={18} />,
        labelKey: "nav.fusionManager",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/radiomics/features",
        icon: <Braces size={18} />,
        labelKey: "nav.radiomicsFeatures",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/dicom-share",
        icon: <Share2 size={18} />,
        labelKey: "nav.dicomShare",
        roles: ["医生", "主任", "技师", "管理员", "护士"],
      },
    ],
  },
  {
    section: "nav.aiIntelligence",
    items: [
      // [v3.0.6.11-104 Wave 5A] 质控收敛: /ai-qc 已内嵌为 /qc Tab, 移除旧菜单 (旧路径 redirect)
      {
        path: "/ai-structured-report",
        icon: <FileCheck2 size={18} />,
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
        icon: <PenLine size={18} />,
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
        icon: <Brain size={18} />,
        labelKey: "nav.aiReview",
        roles: ["医生", "主任", "管理员",],
      },
      // [v3.0.6.11-101 Wave 3C] AI 增强工作台: 多器官检出 + 草稿评分 + 智能挂片
      {
        path: "/ai/enhanced",
        icon: <Sparkles size={18} />,
        labelKey: "nav.aiEnhanced",
        roles: ["医生", "主任", "技师", "管理员",],
      },
      {
        path: "/ai/providers",
        icon: <Server size={18} />,
        labelKey: "nav.aiProviders",
        roles: ["管理员",],
      },
      // [G005 W3] AI 定量分析中心 (概念 UI, 确定性模拟)
      {
        path: "/ai/quant-center",
        icon: <ScanSearch size={18} />,
        labelKey: "nav.aiQuantCenter",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      // [G005 W4-AI] AI 模型注册表 / 工作流中心 (概念 UI, 确定性模拟)
      {
        path: "/ai/models",
        icon: <Boxes size={18} />,
        labelKey: "nav.aiModelRegistry",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/ai/workflow",
        icon: <Workflow size={18} />,
        labelKey: "nav.aiWorkflow",
        roles: ["医生", "主任", "管理员"],
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
        icon: <Store size={18} />,
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
      {
        path: "/ai-fusion-workspace",
        icon: <Blend size={18} />,
        labelKey: "nav.aiFusionWorkspace",
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
      // [v3.0.6.11-104 Wave 5A] 质控收敛: 报告 V2 规则/水印迁入质控分组 (旧路径 /report-v2/* redirect)
      {
        path: "/qc/rules",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.reportRules",
        roles: ["主任", "管理员"],
      },
      {
        path: "/qc/watermark",
        icon: <Stamp size={18} />,
        labelKey: "nav.reportWatermark",
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
      // [G005 v3.0.6.11-103 Wave 18] 教学病例库 (收藏/分类/分享评论/考试模式)
      {
        path: "/teach/case-library",
        icon: <BookOpen size={18} />,
        labelKey: "nav.teachingCaseLibrary",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/finding-library",
        icon: <Library size={18} />,
        labelKey: "nav.typicalFindings",
        roles: ["主任", "管理员"],
      },
      {
        path: "/term-library",
        icon: <BookMarked size={18} />,
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
        icon: <PenSquare size={18} />,
        labelKey: "nav.templateDesigner",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-inheritance",
        icon: <Files size={18} />,
        labelKey: "nav.templateInheritance",
        roles: ["主任", "管理员"],
      },
      {
        path: "/template-category",
        icon: <FolderTree size={18} />,
        labelKey: "nav.templateCategory",
        roles: ["主任", "管理员"],
      },
      {
        path: "/term-synonym-graph",
        icon: <Share2 size={18} />,
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
        icon: <AlertTriangle size={18} />,
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
        icon: <Radiation size={18} />,
        labelKey: "nav.radiationSafety",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/rca-analysis",
        icon: <ScanSearch size={18} />,
        labelKey: "nav.rcaAnalysis",
        roles: ["主任", "管理员"],
      },
      {
        path: "/safety/risk-management",
        icon: <ShieldAlert size={18} />,
        labelKey: "nav.riskManagement",
        roles: ["主任", "管理员"],
      },
      {
        path: "/research",
        icon: <GraduationCap size={18} />,
        labelKey: "nav.research",
        roles: ["医生", "主任", "管理员"],
      },
      // [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心 (数据集/字段/CSV·JSON·Excel)
      {
        path: "/research/export-center",
        icon: <Download size={18} />,
        labelKey: "nav.researchExportCenter",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-104 Wave 5C] 模板收敛: /report-templates 已并入 /template-management (模板中心) Tab, 重复菜单移除
      {
        path: "/clinical-calculators",
        icon: <Calculator size={18} />,
        labelKey: "nav.clinicalCalculators",
        roles: ["医生", "主任", "技师", "护士", "管理员"],
      },
      {
        path: "/patient-safety",
        icon: <HeartPulse size={18} />,
        labelKey: "nav.patientSafety",
        roles: ["主任", "管理员", "护士"],
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
        icon: <PackageOpen size={18} />,
        labelKey: "nav.fhirBulkExportDetail",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/regional-report",
        icon: <Globe size={18} />,
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
        icon: <UserRound size={18} />,
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
        icon: <ScrollText size={18} />,
        labelKey: "nav.fhirDiagnosticReport",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/imaging-study",
        icon: <Scan size={18} />,
        labelKey: "nav.fhirImagingStudy",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      {
        path: "/fhir/subscription",
        icon: <Webhook size={18} />,
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
        icon: <KeyRound size={18} />,
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
        icon: <UserCheck size={18} />,
        labelKey: "nav.iheVisit",
        roles: ["主任", "技师", "管理员"],
      },
      // [audit-fix-2026-07-28] IHE/HL7 管理
      {
        path: "/ihe/manager",
        icon: <Cable size={18} />,
        labelKey: "nav.iheManager",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/hl7/manager",
        icon: <Archive size={18} />,
        labelKey: "nav.hl7Manager",
        roles: ["技师", "管理员"],
      },
      {
        path: "/regional-imaging",
        icon: <Map size={18} />,
        labelKey: "nav.regionalImaging",
        roles: ["管理员"],
      },
      // [G005 Wave 4B] 区域医联体协同中心 (RegionalCollaborationPage)
      {
        path: "/regional/collaboration",
        icon: <Network size={18} />,
        labelKey: "nav.regionalCollaboration",
        roles: ["管理员", "主任"],
      },
      {
        path: "/integration/mllp-monitor",
        icon: <RadioTower size={18} />,
        labelKey: "nav.mllpMonitor",
        roles: ["管理员", "技师"],
      },
      {
        path: "/integration/mllp-config",
        icon: <Cable size={18} />,
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
  {
    section: "nav.dicomNetwork",
    items: [
      // [v3.0.6.11-95] W4-B P2: 旧版 /integration/dimse 菜单移除, 统一入口为 /dicom/dimse (nav.dicomDimse)
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
        icon: <ExternalLink size={18} />,
        labelKey: "nav.patientImageQuery",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/clinical-data",
        icon: <FileText size={18} />,
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
        icon: <Stethoscope size={18} />,
        labelKey: "nav.doctorMobileWorkstation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/nurse",
        icon: <ClipboardCheck size={18} />,
        labelKey: "nav.nurseMobileWorkstation",
        roles: ["护士", "医生", "管理员",],
      },
      {
        path: "/mobile/tech",
        icon: <Wrench size={18} />,
        labelKey: "nav.techMobileWorkstation",
        roles: ["技师", "护士", "医生", "管理员"],
      },
      {
        path: "/mobile/push",
        icon: <BellRing size={18} />,
        labelKey: "nav.mobilePush",
        roles: ["护士", "医生", "管理员",],
      },
      // [v3.0.6.11-100 Wave 4A] 移动审批 (待办/通过/驳回/委派/历史)
      {
        path: "/mobile/approval",
        icon: <Smartphone size={18} />,
        labelKey: "nav.mobileApproval",
        roles: ["主任", "管理员"],
      },
      {
        path: "/consent-education",
        icon: <FileCheck2 size={18} />,
        labelKey: "nav.consentEducation",
        roles: ["医生", "主任", "技师", "护士", "管理员"],
      },
      // [v3.0.6.11-104 Wave 3C] 临床反馈闭环: 异议/补充/更正 → 回应 → 关闭
      {
        path: "/clinical-feedback",
        icon: <MessageSquare size={18} />,
        labelKey: "nav.clinicalFeedback",
        roles: ["医生", "主任", "技师", "护士", "管理员"],
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
        icon: <LayoutDashboard size={18} />,
        labelKey: "nav.departmentDashboard",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.11-40] A14 Remote Reading
      {
        path: "/remote-reading",
        icon: <Video size={18} />,
        labelKey: "nav.remoteReading",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/operations-center",
        icon: <Command size={18} />,
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
        icon: <ChartLine size={18} />,
        labelKey: "nav.dataStats",
        roles: ["主任", "管理员"],
      },
      {
        path: "/nuclear-stats",
        icon: <Atom size={18} />,
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
        icon: <BarChart3 size={18} />,
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
        icon: <FileSearch size={18} />,
        labelKey: "nav.reportSearch",
        roles: ["主任", "管理员"],
      },
      {
        path: "/operations/oee",
        icon: <Timer size={18} />,
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
        icon: <HeartPulse size={18} />,
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
      // [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 (周视图/拖拽/冲突检测)
      {
        path: "/ops/device-gantt",
        icon: <Calendar size={18} />,
        labelKey: "nav.deviceGantt",
        roles: ["主任", "管理员", "技师"],
      },
      {
        path: "/ops/hr",
        icon: <Contact size={18} />,
        labelKey: "nav.hrOperations",
        roles: ["主任", "管理员"],
      },
  // [v3.0.6.11-104 Wave 5C] 看板收敛: /ops/dashboard 已合并至 /operations-center (旧路由 redirect 兼容), 菜单移除
  // [v3.0.6.11-88] Wave6A 科室 KPI 大屏 (墙屏模式)
  {
    path: "/ops/kpi-wall",
    icon: <Monitor size={18} />,
    labelKey: "nav.kpiWall",
    roles: ["主任", "管理员"],
  },
  // [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2: 利用率历史 + 紧急插入 + 跨机房优化
  {
    path: "/ops/tech-ops",
    icon: <Radiation size={18} />,
    labelKey: "nav.techOps",
    roles: ["主任", "管理员", "技师"],
  },
  // [v3.0.6.11-100 Wave 1B] 技师工作站: 检查间实时看板
  {
    path: "/tech/room-status",
    icon: <Monitor size={18} />,
    labelKey: "nav.roomStatusBoard",
    roles: ["技师", "主任", "管理员"],
  },
  // [v3.0.6.11-100 Wave 1B] 技师工作站: 重拍分析
  {
    path: "/tech/retake-analytics",
    icon: <RefreshCw size={18} />,
    labelKey: "nav.retakeAnalytics",
    roles: ["技师", "主任", "管理员"],
  },
  // [v3.0.6.11-100 Wave 1A] 技师 KPI 看板
  {
    path: "/tech/kpi",
    icon: <Gauge size={18} />,
    labelKey: "nav.techKpi",
    roles: ["主任", "管理员", "技师"],
  },
  // [v3.0.6.11-101 Wave 4A] 技师工作站 V2: 双检间轮转 + 工作量预测
  {
    path: "/tech/rotation",
    icon: <Repeat2 size={18} />,
    labelKey: "nav.techRotation",
    roles: ["主任", "管理员", "技师"],
  },
  // [v3.0.6.11-101 Wave 5] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏
  {
    path: "/tech/overview",
    icon: <PieChart size={18} />,
    labelKey: "nav.techOverview",
    roles: ["主任", "管理员", "技师"],
  },
  // [v3.0.6.11-103 Wave 11] 技师工作站: 端到端应用流程贯通
  {
    path: "/tech/workbench",
    icon: <ClipboardCheck size={18} />,
    labelKey: "nav.techWorkbench",
    roles: ["技师", "主任", "管理员"],
  },
  // [G005 W7-Exec] MWL 管理 (Modality Worklist 查询 / MPPS 状态)
  {
    path: "/tech/mwl",
    icon: <RadioTower size={18} />,
    labelKey: "w7exec.mwlManagerTitle",
    roles: ["技师", "主任", "管理员"],
  },
      {
        path: "/operations/occupancy",
        icon: <Monitor size={18} />,
        labelKey: "nav.roomOccupancy",
        roles: ["主任", "管理员", "技师"],
      },
      // [v3.0.6.11-40] A14 Auto Collection
      {
        path: "/auto-collection",
        icon: <DatabaseZap size={18} />,
        labelKey: "nav.autoCollection",
        roles: ["管理员"],
      },
      // [v3.0.6.11-104 Wave 5A] 质控收敛: /quality/department 已内嵌为 /qc Tab, 移除旧菜单 (旧路径 redirect)
      {
        path: "/analytics/benchmark-v2",
        icon: <ChartLine size={18} />,
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
      {
        path: "/director-dashboard",
        icon: <Crown size={18} />,
        labelKey: "nav.directorDashboard",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.11-104 Wave 5C] 看板收敛: /command-center 已合并至 /operations-center (旧路由 redirect 兼容), 菜单移除
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
        icon: <DollarSign size={18} />,
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
      // [v3.0.6.11-100 Wave 4A] 自定义报表 (独立完整版, /report/custom)
      {
        path: "/report/custom",
        icon: <FileSpreadsheet size={18} />,
        labelKey: "nav.customReport",
        roles: ["主任", "管理员"],
      },
      // [v3.0.6.11-100 Wave 4A] 语音工作站 (独立完整版, /voice/workstation)
      {
        path: "/voice/workstation",
        icon: <Headphones size={18} />,
        labelKey: "nav.voiceWorkstation",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/insurance-audit",
        icon: <FileSearch size={18} />,
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
        icon: <ScanEye size={18} />,
        labelKey: "nav.eyeOcta",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/visual-field",
        icon: <ScanEye size={18} />,
        labelKey: "nav.eyeVisualField",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/topography",
        icon: <Map size={18} />,
        labelKey: "nav.eyeTopography",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/ffa",
        icon: <FolderHeart size={18} />,
        labelKey: "nav.eyeFfa",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/compare",
        icon: <GitCompare size={18} />,
        labelKey: "nav.eyeCompare",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/montage",
        icon: <LayoutGrid size={18} />,
        labelKey: "nav.eyeMontage",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ris",
        icon: <Eye size={18} />,
        labelKey: "nav.eyeRis",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/report-write",
        icon: <PenLine size={18} />,
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
        icon: <Gauge size={18} />,
        labelKey: "nav.eyeIop",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/emr",
        icon: <FileText size={18} />,
        labelKey: "nav.eyeEmr",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ai",
        icon: <Brain size={18} />,
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
        icon: <ScanLine size={18} />,
        labelKey: "nav.eyePacsReal",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/pacs/viewer",
        icon: <Eye size={18} />,
        labelKey: "nav.eyePacsViewer",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/ai-report",
        icon: <FileText size={18} />,
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
        icon: <ScanEye size={18} />,
        labelKey: "nav.eyeStrabismus",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/neuro",
        icon: <Brain size={18} />,
        labelKey: "nav.eyeNeuro",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/oncology",
        icon: <Microscope size={18} />,
        labelKey: "nav.eyeOncology",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/cornea",
        icon: <ScanLine size={18} />,
        labelKey: "nav.eyeCornea",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/contact-lens",
        icon: <Glasses size={18} />,
        labelKey: "nav.eyeContactLens",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/low-vision",
        icon: <EyeOff size={18} />,
        labelKey: "nav.eyeLowVision",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/cataract",
        icon: <Sparkles size={18} />,
        labelKey: "nav.eyeCataract",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/sub/refractive",
        icon: <Focus size={18} />,
        labelKey: "nav.eyeRefractive",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/eye/tele",
        icon: <Video size={18} />,
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
        icon: <RefreshCw size={18} />,
        labelKey: "nav.eyeOptometryLoop",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [G005 Wave 4B] 影像像素实验室 (EyePixelPage)
      {
        path: "/eye/pixel-lab",
        icon: <Grid3X3 size={18} />,
        labelKey: "nav.eyePixelLab",
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
        icon: React.createElement(Smile, { size: 18 }),
        labelKey: "nav.dentalWorkspace",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/studies",
        icon: React.createElement(Image, { size: 18 }),
        labelKey: "nav.dentalPacs",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/chart",
        icon: React.createElement(Smile, { size: 18 }),
        labelKey: "nav.dentalChart",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/ai",
        icon: React.createElement(Target, { size: 18 }),
        labelKey: "nav.dentalAi",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/treatment",
        icon: React.createElement(Award, { size: 18 }),
        labelKey: "nav.dentalTreatment",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/implant",
        icon: React.createElement(Anchor, { size: 18 }),
        labelKey: "nav.dentalImplant",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/ortho",
        icon: React.createElement(AlignCenter, { size: 18 }),
        labelKey: "nav.dentalOrtho",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/tele",
        icon: React.createElement(Video, { size: 18 }),
        labelKey: "nav.dentalTele",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/inventory",
        icon: React.createElement(Boxes, { size: 18 }),
        labelKey: "nav.dentalInventory",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      {
        path: "/dental/dashboard",
        icon: React.createElement(Gauge, { size: 18 }),
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
        icon: React.createElement(Layers3, { size: 18 }),
        labelKey: "nav.dentalImplant3d",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-89] Phase 1: 导板 + 上部
      {
        path: "/dental/guide",
        icon: React.createElement(Wand2, { size: 18 }),
        labelKey: "nav.dentalGuide",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-90] Phase 2: 头影测量
      {
        path: "/dental/ceph",
        icon: React.createElement(Ruler, { size: 18 }),
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
        icon: React.createElement(Cuboid, { size: 18 }),
        labelKey: "nav.dentalVolume",
        roles: ["医生", "技师", "主任", "管理员",],
      },
      // [v3.0.6.8-94] Phase 4: 360° 患者视图
      {
        path: "/dental/patient-view",
        icon: React.createElement(Smile, { size: 18 }),
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
        icon: React.createElement(Smile, { size: 18 }),
        labelKey: "nav.dentalEndo",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 牙周
      {
        path: "/dental/perio",
        icon: React.createElement(Heart, { size: 18 }),
        labelKey: "nav.dentalPerio",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 修复
      {
        path: "/dental/restorative",
        icon: React.createElement(Hammer, { size: 18 }),
        labelKey: "nav.dentalRestorative",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔外科
      {
        path: "/dental/surgery",
        icon: React.createElement(Scissors, { size: 18 }),
        labelKey: "nav.dentalSurgery",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 儿牙
      {
        path: "/dental/pediatric",
        icon: React.createElement(Baby, { size: 18 }),
        labelKey: "nav.dentalPediatric",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔影像查看
      {
        path: "/dental/viewer",
        icon: React.createElement(Scan, { size: 18 }),
        labelKey: "nav.dentalViewer",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 3D扫描查看
      {
        path: "/dental/viewer/scan-3d",
        icon: React.createElement(Scan, { size: 18 }),
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
        icon: React.createElement(Box, { size: 18 }),
        labelKey: "nav.dentalMpr",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔ONNX AI
      {
        path: "/dental/ai-onnx",
        icon: React.createElement(Sparkles, { size: 18 }),
        labelKey: "nav.dentalAiOnnx",
        roles: ["医生", "技师", "主任", "管理员"],
      },
      // [v3.0.6.11-42] P2 口腔转诊
      {
        path: "/dental/referral",
        icon: React.createElement(UserPlus, { size: 18 }),
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
        icon: React.createElement(SquareStack, { size: 18 }),
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
        icon: <Layers size={18} />,
        labelKey: "nav.mammoOperations",
        roles: ["主任", "管理员"],
      },
      {
        path: "/mammo/quality",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.mammoQuality",
        roles: ["主任", "管理员"],
      },
      {
        path: "/mammo/breast-specialty",
        icon: React.createElement(Ribbon, { size: 18 }),
        labelKey: "nav.breastSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
      {
        path: "/cardiac/cardiac-specialty",
        icon: React.createElement(HeartPulse, { size: 18 }),
        labelKey: "nav.cardiacSpecialty",
        roles: ["医生", "主任", "管理员"],
      },
      // [v3.0.6.11-88] Wave6A 血管分析工作台 (心脏组)
      {
        path: "/cardiac/vessel-analysis",
        icon: React.createElement(HeartPulse, { size: 18 }),
        labelKey: "nav.vesselAnalysis",
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
  // [v3.0.6.11-42] P2 质量提升新增: 系统管理
  {
    section: "nav.systemManage",
    items: [
      // [v3.0.6.11-104 Wave 5C] 模板收敛: /emr-templates 已并入 /template-management (模板中心) Tab, 重复菜单移除
      {
        path: "/system-admin",
        icon: <Settings size={18} />,
        labelKey: "nav.systemAdmin",
        roles: ["管理员"],
      },
      // [v3.0.6.11-103 Wave 4B] 急诊通道管理 (backend Roles: ADMIN/DIRECTOR/DOCTOR)
      {
        path: "/emergency-channel",
        icon: <HeartPulse size={18} />,
        labelKey: "nav.emergencyChannel",
        roles: ["主任", "管理员", "医生"],
      },
      {
        path: "/audit-compliance",
        icon: <BadgeCheck size={18} />,
        labelKey: "nav.auditCompliance",
        roles: ["主任", "管理员"],
      },
      {
        path: "/compliance-docs",
        icon: <FileCheck2 size={18} />,
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
        icon: <HardDrive size={18} />,
        labelKey: "nav.patientDeviceMgmt",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/notif-tpl-dict",
        icon: <NotebookText size={18} />,
        labelKey: "nav.notifTplDict",
        roles: ["医生", "主任", "技师", "管理员"],
      },
      {
        path: "/audit",
        icon: <History size={18} />,
        labelKey: "nav.audit",
        roles: ["管理员"],
      },
      // [v3.0.6.11-79] W1-B 用户中心 (个人资料/改密/安全/退出)
      {
        path: "/user/center",
        icon: <UserCircle size={18} />,
        labelKey: "nav.userCenter",
        roles: ["医生", "技师", "护士", "管理员", "主任"],
      },
      {
        path: "/user-management",
        icon: <UserCog size={18} />,
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
        icon: <Cog size={18} />,
        labelKey: "nav.clinicalConfig",
        roles: ["管理员"],
      },
      {
        path: "/dictionary",
        icon: <BookMarked size={18} />,
        labelKey: "nav.dataDictionary",
        roles: ["管理员"],
      },
      {
        path: "/operation-log",
        icon: <History size={18} />,
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
        icon: <LifeBuoy size={18} />,
        labelKey: "nav.businessContinuity",
        roles: ["管理员"],
      },
      {
        path: "/multi-site",
        icon: <Building2 size={18} />,
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
      {
        path: "/system/backup",
        icon: <HardDrive size={18} />,
        labelKey: "nav.systemBackup",
        roles: ["管理员"],
      },
      {
        path: "/system/tenant-config",
        icon: <Building2 size={18} />,
        labelKey: "nav.tenantConfig",
        roles: ["管理员"],
      },
      {
        path: "/system/compliance",
        icon: <BadgeCheck size={18} />,
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
      // [G005 W8-Report] 签名与证书中心 (证书注册表/CRL/验签)
      {
        path: "/security/certificate-center",
        icon: <ShieldCheck size={18} />,
        labelKey: "nav.certificateCenter",
        roles: ["管理员", "主任", "医生"],
      },
    ],
  },
  // [v3.0.6.11-42] P2 质量提升新增: 设备物资
  {
    section: "nav.equipmentMaterials",
    items: [
      {
        path: "/equipment-lifecycle",
        icon: <Wrench size={18} />,
        labelKey: "nav.equipmentLifecycle",
        roles: ["技师", "管理员"],
      },
      {
        path: "/devices",
        icon: <Cpu size={18} />,
        labelKey: "nav.devices",
        roles: ["技师", "管理员"],
      },
      {
        path: "/materials",
        icon: <Boxes size={18} />,
        labelKey: "nav.materialsManage",
        roles: ["技师", "管理员"],
      },
      {
        path: "/dose-track",
        icon: <Radiation size={18} />,
        labelKey: "nav.doseTrack",
        roles: ["技师", "管理员"],
      },
      {
        path: "/rdsr",
        icon: <Radiation size={18} />,
        labelKey: "nav.rdsr",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/adverse-reactions",
        icon: <AlertTriangle size={18} />,
        labelKey: "nav.adverseReactions",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/injection-workstation",
        icon: <Syringe size={18} />,
        labelKey: "nav.injectionWorkstation",
        roles: ["技师", "管理员"],
      },
      {
        path: "/contrast/inventory",
        icon: <Syringe size={18} />,
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
