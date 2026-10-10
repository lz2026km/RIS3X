// ============================================================
// G005 放射科RIS系统 - 医保审核页面
// CT对比剂 / MRI对比剂 / DSA抗凝药物 医保限制审核
// ============================================================
import { useTranslation } from "react-i18next";
import { useState, useMemo, useEffect } from "react";
import { Select } from "antd";
import { datareportApi, type InsuranceAuditDto as DataReportAuditDto } from "../services/api/datareportApi";
import { insuranceApi } from "../services/api/insuranceApi";
import { PageHeader } from "../components/common/PageHeader";
import { StatCard } from "../components/common/StatCard";
import { AppText } from "../components/common/AppText";
import { PermissionGate } from "../components/common/PermissionGate";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/common/DataTable";
import { StatusTag } from "../components/common/StatusTag";
import { VOUCHER_DATA } from '../data/initialData';
import { ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, FileText, Pill, Stethoscope, Calendar, MessageSquare, Check, X, Send, BookOpen, ClipboardList, Activity, AlertOctagon, BarChart3, Settings, TrendingUp, Clock3, DollarSign, PieChart as PieChartIcon, AlertCircle, Percent, Upload, Loader2, Plus, ClipboardCheck, Target, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { ChartContainer } from '../components/charts';
import { autoInterval } from '../utils/chartUtils';
import { t } from '../i18n/appI18n';
import { t as appT } from '../i18n/appI18n';

// ---------- 类型定义 ----------
interface PendingAudit {
  id: string;
  patientName: string;
  patientId: string;
  examType: string;
  examItem: string;
  drugName: string;
  drugCategory: string;
  drugSpec: string;
  restriction: string;
  reason: string;
  submitTime: string;
  submitDept: string;
  urgency: "高" | "中" | "低";
}

interface AuditHistory {
  id: number;
  patientName: string;
  patientId: string;
  examType: string;
  examItem: string;
  drugName: string;
  drugCategory: string;
  result: "通过" | "拒绝" | "补充资料";
  auditor: string;
  auditTime: string;
  reason?: string;
}

interface RestrictedDrug {
  id: number;
  name: string;
  category: string;
  restriction: string;
  applicableExams: string;
  notes: string;
}

interface IndicationRule {
  id: number;
  examType: string;
  examName: string;
  drugName: string;
  drugCategory: string;
  insuranceRequirement: string;
  description: string;
}

interface StatsData {
  passRate: number;
  totalPending: number;
  todayProcessed: number;
  avgReviewTime: string;
}

// ---------- 演示数据 ----------

const pendingAuditData: PendingAudit[] = [
  {
    id: "AUD001",
    patientName: "张伟",
    patientId: "P202400001",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颅CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "50ml:15g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘海醇注射液行头颅CT增强检查",
    submitTime: "2026-05-02 08:30",
    submitDept: "神经内科",
    urgency: "高",
  },
  {
    id: "AUD002",
    patientName: "李娜",
    patientId: "P202400002",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "头颅MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:7.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆喷酸葡胺注射液行头颅MRI增强检查",
    submitTime: "2026-05-02 09:15",
    submitDept: "肿瘤科",
    urgency: "中",
  },
  {
    id: "AUD003",
    patientName: "王磊",
    patientId: "P202400003",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "脑血管DSA",
    drugName: "比伐卢定注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "0.6ml:5000IU",
    restriction: "限DSA手术使用",
    reason: "申请使用比伐卢定注射液行脑血管DSA检查",
    submitTime: "2026-05-02 10:20",
    submitDept: "血管外科",
    urgency: "低",
  },
  {
    id: "AUD004",
    patientName: "赵敏",
    patientId: "P202400004",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:32g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘克沙醇注射液行腹部CT增强检查",
    submitTime: "2026-05-02 11:45",
    submitDept: "消化内科",
    urgency: "高",
  },
  {
    id: "AUD005",
    patientName: "周涛",
    patientId: "P202400005",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆布醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:2.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆布醇注射液行前列腺MRI增强检查",
    submitTime: "2026-05-02 13:00",
    submitDept: "泌尿外科",
    urgency: "中",
  },
  {
    id: "AUD006",
    patientName: "吴静",
    patientId: "P202400006",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "心脏DSA",
    drugName: "肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "12500U/支",
    restriction: "限DSA手术使用",
    reason: "申请使用肝素钠注射液行心脏DSA检查",
    submitTime: "2026-05-02 14:30",
    submitDept: "心内科",
    urgency: "低",
  },
  {
    id: "AUD007",
    patientName: "郑强",
    patientId: "P202400007",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺动脉CTA",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:61.2g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘普罗胺注射液行肺动脉CTA检查",
    submitTime: "2026-05-02 15:45",
    submitDept: "呼吸内科",
    urgency: "高",
  },
  {
    id: "AUD008",
    patientName: "钱琳",
    patientId: "P202400008",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆贝葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆贝葡胺注射液行乳腺MRI增强检查",
    submitTime: "2026-05-02 16:00",
    submitDept: "乳腺外科",
    urgency: "中",
  },
  {
    id: "AUD009",
    patientName: "孙鹏",
    patientId: "P202400009",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "肾动脉DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "2.5mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用磺达肝癸钠注射液行肾动脉DSA检查",
    submitTime: "2026-05-02 17:15",
    submitDept: "肾内科",
    urgency: "低",
  },
  {
    id: "AUD010",
    patientName: "马超",
    patientId: "P202400010",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘佛醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:35g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘佛醇注射液行冠脉CTA检查",
    submitTime: "2026-05-03 08:00",
    submitDept: "心内科",
    urgency: "高",
  },
  {
    id: "AUD011",
    patientName: "胡霞",
    patientId: "P202400011",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "腹部MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆双胺注射液行腹部MRI增强检查",
    submitTime: "2026-05-03 09:30",
    submitDept: "消化内科",
    urgency: "中",
  },
  {
    id: "AUD012",
    patientName: "林峰",
    patientId: "P202400012",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "外周血管DSA",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用阿加曲班注射液行外周血管DSA检查",
    submitTime: "2026-05-03 10:45",
    submitDept: "血管外科",
    urgency: "低",
  },
  {
    id: "AUD013",
    patientName: "董洁",
    patientId: "P202400013",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颅CT增强",
    drugName: "碘帕醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:37g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘帕醇注射液行头颅CT增强检查",
    submitTime: "2026-05-03 11:30",
    submitDept: "神经内科",
    urgency: "高",
  },
  {
    id: "AUD014",
    patientName: "杨帆",
    patientId: "P202400014",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "头颅MRI增强",
    drugName: "钆特醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:3.0mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆特醇注射液行头颅MRI增强检查",
    submitTime: "2026-05-03 13:00",
    submitDept: "神经外科",
    urgency: "中",
  },
  {
    id: "AUD015",
    patientName: "蒋伟",
    patientId: "P202400015",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "脑血管DSA",
    drugName: "利伐沙班片",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/片",
    restriction: "限DSA手术使用",
    reason: "申请使用利伐沙班片行脑血管DSA检查",
    submitTime: "2026-05-03 14:15",
    submitDept: "神经内科",
    urgency: "低",
  },
  {
    id: "AUD016",
    patientName: "刘洋",
    patientId: "P202400016",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "50ml:15g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘海醇注射液行腹部CT增强检查",
    submitTime: "2026-05-03 15:30",
    submitDept: "肿瘤科",
    urgency: "高",
  },
  {
    id: "AUD017",
    patientName: "陈静",
    patientId: "P202400017",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:7.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆喷酸葡胺注射液行前列腺MRI增强检查",
    submitTime: "2026-05-03 16:45",
    submitDept: "泌尿外科",
    urgency: "中",
  },
  {
    id: "AUD018",
    patientName: "黄志明",
    patientId: "P202400018",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "心脏DSA",
    drugName: "比伐卢定注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "0.6ml:5000IU",
    restriction: "限DSA手术使用",
    reason: "申请使用比伐卢定注射液行心脏DSA检查",
    submitTime: "2026-05-03 17:00",
    submitDept: "心内科",
    urgency: "低",
  },
  {
    id: "AUD019",
    patientName: "徐敏",
    patientId: "P202400019",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺动脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:32g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘克沙醇注射液行肺动脉CTA检查",
    submitTime: "2026-05-04 08:15",
    submitDept: "呼吸内科",
    urgency: "高",
  },
  {
    id: "AUD020",
    patientName: "高建",
    patientId: "P202400020",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆布醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:2.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆布醇注射液行乳腺MRI增强检查",
    submitTime: "2026-05-04 09:30",
    submitDept: "乳腺外科",
    urgency: "中",
  },
  {
    id: "AUD021",
    patientName: "何婷",
    patientId: "P202400021",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "肾动脉DSA",
    drugName: "肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "12500U/支",
    restriction: "限DSA手术使用",
    reason: "申请使用肝素钠注射液行肾动脉DSA检查",
    submitTime: "2026-05-04 10:45",
    submitDept: "肾内科",
    urgency: "低",
  },
  {
    id: "AUD022",
    patientName: "许刚",
    patientId: "P202400022",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:61.2g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘普罗胺注射液行冠脉CTA检查",
    submitTime: "2026-05-04 11:00",
    submitDept: "心内科",
    urgency: "高",
  },
  {
    id: "AUD023",
    patientName: "曹娟",
    patientId: "P202400023",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "腹部MRI增强",
    drugName: "钆贝葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆贝葡胺注射液行腹部MRI增强检查",
    submitTime: "2026-05-04 12:15",
    submitDept: "消化内科",
    urgency: "中",
  },
  {
    id: "AUD024",
    patientName: "冯强",
    patientId: "P202400024",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "外周血管DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "2.5mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用磺达肝癸钠注射液行外周血管DSA检查",
    submitTime: "2026-05-04 13:30",
    submitDept: "血管外科",
    urgency: "低",
  },
  {
    id: "AUD025",
    patientName: "贺磊",
    patientId: "P202400025",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颅CT增强",
    drugName: "碘佛醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:35g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘佛醇注射液行头颅CT增强检查",
    submitTime: "2026-05-04 14:45",
    submitDept: "神经内科",
    urgency: "高",
  },
  {
    id: "AUD026",
    patientName: "贺娟",
    patientId: "P202400026",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "头颅MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆双胺注射液行头颅MRI增强检查",
    submitTime: "2026-05-04 15:00",
    submitDept: "神经外科",
    urgency: "中",
  },
  {
    id: "AUD027",
    patientName: "贺志强",
    patientId: "P202400027",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "脑血管DSA",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用阿加曲班注射液行脑血管DSA检查",
    submitTime: "2026-05-04 16:15",
    submitDept: "神经内科",
    urgency: "低",
  },
  {
    id: "AUD028",
    patientName: "贺梅",
    patientId: "P202400028",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘帕醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:37g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘帕醇注射液行腹部CT增强检查",
    submitTime: "2026-05-04 17:30",
    submitDept: "肿瘤科",
    urgency: "高",
  },
  {
    id: "AUD029",
    patientName: "贺勇",
    patientId: "P202400029",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆特醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:3.0mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆特醇注射液行前列腺MRI增强检查",
    submitTime: "2026-05-05 08:00",
    submitDept: "泌尿外科",
    urgency: "中",
  },
  {
    id: "AUD030",
    patientName: "贺丽",
    patientId: "P202400030",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "心脏DSA",
    drugName: "利伐沙班片",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/片",
    restriction: "限DSA手术使用",
    reason: "申请使用利伐沙班片行心脏DSA检查",
    submitTime: "2026-05-05 09:15",
    submitDept: "心内科",
    urgency: "低",
  },
  {
    id: "AUD031",
    patientName: "贺鹏",
    patientId: "P202400031",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "50ml:15g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘海醇注射液行肺动脉CTA检查",
    submitTime: "2026-05-05 10:30",
    submitDept: "呼吸内科",
    urgency: "高",
  },
  {
    id: "AUD032",
    patientName: "贺洁",
    patientId: "P202400032",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:7.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆喷酸葡胺注射液行乳腺MRI增强检查",
    submitTime: "2026-05-05 11:45",
    submitDept: "乳腺外科",
    urgency: "中",
  },
  {
    id: "AUD033",
    patientName: "贺刚",
    patientId: "P202400033",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "肾动脉DSA",
    drugName: "比伐卢定注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "0.6ml:5000IU",
    restriction: "限DSA手术使用",
    reason: "申请使用比伐卢定注射液行肾动脉DSA检查",
    submitTime: "2026-05-05 13:00",
    submitDept: "肾内科",
    urgency: "低",
  },
  {
    id: "AUD034",
    patientName: "贺霞",
    patientId: "P202400034",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:32g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘克沙醇注射液行冠脉CTA检查",
    submitTime: "2026-05-05 14:15",
    submitDept: "心内科",
    urgency: "高",
  },
  {
    id: "AUD035",
    patientName: "贺峰",
    patientId: "P202400035",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "腹部MRI增强",
    drugName: "钆布醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:2.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆布醇注射液行腹部MRI增强检查",
    submitTime: "2026-05-05 15:30",
    submitDept: "消化内科",
    urgency: "中",
  },
  {
    id: "AUD036",
    patientName: "贺敏",
    patientId: "P202400036",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "外周血管DSA",
    drugName: "肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "12500U/支",
    restriction: "限DSA手术使用",
    reason: "申请使用肝素钠注射液行外周血管DSA检查",
    submitTime: "2026-05-05 16:45",
    submitDept: "血管外科",
    urgency: "低",
  },
  {
    id: "AUD037",
    patientName: "贺伟",
    patientId: "P202400037",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颅CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:61.2g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘普罗胺注射液行头颅CT增强检查",
    submitTime: "2026-05-05 17:00",
    submitDept: "神经内科",
    urgency: "高",
  },
  {
    id: "AUD038",
    patientName: "贺娜",
    patientId: "P202400038",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "头颅MRI增强",
    drugName: "钆贝葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆贝葡胺注射液行头颅MRI增强检查",
    submitTime: "2026-05-06 08:15",
    submitDept: "神经外科",
    urgency: "中",
  },
  {
    id: "AUD039",
    patientName: "贺磊",
    patientId: "P202400039",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "脑血管DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "2.5mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用磺达肝癸钠注射液行脑血管DSA检查",
    submitTime: "2026-05-06 09:30",
    submitDept: "神经内科",
    urgency: "低",
  },
  {
    id: "AUD040",
    patientName: "贺娟",
    patientId: "P202400040",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘佛醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:35g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘佛醇注射液行腹部CT增强检查",
    submitTime: "2026-05-06 10:45",
    submitDept: "肿瘤科",
    urgency: "高",
  },
  {
    id: "AUD041",
    patientName: "贺强",
    patientId: "P202400041",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:4.305g",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆双胺注射液行前列腺MRI增强检查",
    submitTime: "2026-05-06 11:00",
    submitDept: "泌尿外科",
    urgency: "中",
  },
  {
    id: "AUD042",
    patientName: "贺静",
    patientId: "P202400042",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "心脏DSA",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/支",
    restriction: "限DSA手术使用",
    reason: "申请使用阿加曲班注射液行心脏DSA检查",
    submitTime: "2026-05-06 12:15",
    submitDept: "心内科",
    urgency: "低",
  },
  {
    id: "AUD043",
    patientName: "贺明",
    patientId: "P202400043",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺动脉CTA",
    drugName: "碘帕醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:37g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘帕醇注射液行肺动脉CTA检查",
    submitTime: "2026-05-06 13:30",
    submitDept: "呼吸内科",
    urgency: "高",
  },
  {
    id: "AUD044",
    patientName: "贺玲",
    patientId: "P202400044",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆特醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:3.0mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆特醇注射液行乳腺MRI增强检查",
    submitTime: "2026-05-06 14:45",
    submitDept: "乳腺外科",
    urgency: "中",
  },
  {
    id: "AUD045",
    patientName: "贺浩",
    patientId: "P202400045",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "肾动脉DSA",
    drugName: "利伐沙班片",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "20mg/片",
    restriction: "限DSA手术使用",
    reason: "申请使用利伐沙班片行肾动脉DSA检查",
    submitTime: "2026-05-06 15:00",
    submitDept: "肾内科",
    urgency: "低",
  },
  {
    id: "AUD046",
    patientName: "贺燕",
    patientId: "P202400046",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "50ml:15g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘海醇注射液行冠脉CTA检查",
    submitTime: "2026-05-06 16:15",
    submitDept: "心内科",
    urgency: "高",
  },
  {
    id: "AUD047",
    patientName: "贺超",
    patientId: "P202400047",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "腹部MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "15ml:7.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆喷酸葡胺注射液行腹部MRI增强检查",
    submitTime: "2026-05-06 17:30",
    submitDept: "消化内科",
    urgency: "中",
  },
  {
    id: "AUD048",
    patientName: "贺涛",
    patientId: "P202400048",
    examType: t("insuranceAudit.typeDsaSurgery"),
    examItem: "外周血管DSA",
    drugName: "比伐卢定注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    drugSpec: "0.6ml:5000IU",
    restriction: "限DSA手术使用",
    reason: "申请使用比伐卢定注射液行外周血管DSA检查",
    submitTime: "2026-05-07 08:00",
    submitDept: "血管外科",
    urgency: "低",
  },
  {
    id: "AUD049",
    patientName: "贺蓉",
    patientId: "P202400049",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颅CT增强",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    drugSpec: "100ml:32g",
    restriction: "限CT增强检查使用",
    reason: "申请使用碘克沙醇注射液行头颅CT增强检查",
    submitTime: "2026-05-07 09:15",
    submitDept: "神经内科",
    urgency: "高",
  },
  {
    id: "AUD050",
    patientName: "贺龙",
    patientId: "P202400050",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "头颅MRI增强",
    drugName: "钆布醇注射液",
    drugCategory: "MRI对比剂",
    drugSpec: "10ml:2.5mmol",
    restriction: "限MRI增强检查使用",
    reason: "申请使用钆布醇注射液行头颅MRI增强检查",
    submitTime: "2026-05-07 10:30",
    submitDept: "神经外科",
    urgency: "中",
  },
];

// 审核历史 - 100条
const auditHistory: AuditHistory[] = [
  {
    id: 1,
    patientName: "张三",
    patientId: "P30001",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 09:00",
  },
  {
    id: 2,
    patientName: "李四",
    patientId: "P30002",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 09:15",
  },
  {
    id: 3,
    patientName: "王五",
    patientId: "P30003",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-05-01 09:30",
    reason: "凝血功能异常，ACT目标值设定过高",
  },
  {
    id: 4,
    patientName: "赵六",
    patientId: "P30004",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 09:45",
  },
  {
    id: 5,
    patientName: "钱七",
    patientId: "P30005",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-05-01 10:00",
    reason: "乳腺癌诊断依据不足，需病理确认",
  },
  {
    id: 6,
    patientName: "孙八",
    patientId: "P30006",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "补充资料",
    auditor: "王审核",
    auditTime: "2026-05-01 10:15",
    reason: "需提供甲状腺功能检测报告",
  },
  {
    id: 7,
    patientName: "周九",
    patientId: "P30007",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-05-01 10:30",
    reason: "脑梗死发病超过24小时，不在医保适应证时间窗内",
  },
  {
    id: 8,
    patientName: "吴十",
    patientId: "P30008",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 10:45",
  },
  {
    id: 9,
    patientName: "郑一",
    patientId: "P30009",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 11:00",
  },
  {
    id: 10,
    patientName: "冯二",
    patientId: "P30010",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 11:15",
  },
  {
    id: 11,
    patientName: "陈三",
    patientId: "P30011",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-05-01 11:30",
    reason: "eGFR=28ml/min/1.73m²，低于安全阈值",
  },
  {
    id: 12,
    patientName: "褚四",
    patientId: "P30012",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "补充资料",
    auditor: "王审核",
    auditTime: "2026-05-01 11:45",
    reason: "需提供甲状腺功能及肾功能报告",
  },
  {
    id: 13,
    patientName: "卫五",
    patientId: "P30013",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 12:00",
  },
  {
    id: 14,
    patientName: "蒋六",
    patientId: "P30014",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 12:15",
  },
  {
    id: 15,
    patientName: "沈七",
    patientId: "P30015",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 12:30",
  },
  {
    id: 16,
    patientName: "韩八",
    patientId: "P30016",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 14:00",
  },
  {
    id: 17,
    patientName: "杨九",
    patientId: "P30017",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 14:15",
  },
  {
    id: 18,
    patientName: "朱十",
    patientId: "P30018",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-05-01 14:30",
    reason: "既往有肝素诱导血小板减少症(HIT)病史",
  },
  {
    id: 19,
    patientName: "秦一",
    patientId: "P30019",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 14:45",
  },
  {
    id: 20,
    patientName: "尤二",
    patientId: "P30020",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-05-01 15:00",
    reason: "MRI适应证不明确",
  },
  {
    id: 21,
    patientName: "许三",
    patientId: "P30021",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 15:15",
  },
  {
    id: 22,
    patientName: "何四",
    patientId: "P30022",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-05-01 15:30",
    reason: "不在医保限定的时间窗内(发病6小时内)",
  },
  {
    id: 23,
    patientName: "吕五",
    patientId: "P30023",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 15:45",
  },
  {
    id: 24,
    patientName: "施六",
    patientId: "P30024",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 16:00",
  },
  {
    id: 25,
    patientName: "张七",
    patientId: "P30025",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 16:15",
  },
  {
    id: 26,
    patientName: "孔八",
    patientId: "P30026",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "补充资料",
    auditor: "李审核",
    auditTime: "2026-05-01 16:30",
    reason: "需提供肾功能(eGFR)检测结果",
  },
  {
    id: 27,
    patientName: "曹九",
    patientId: "P30027",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 16:45",
  },
  {
    id: 28,
    patientName: "严十",
    patientId: "P30028",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 17:00",
  },
  {
    id: 29,
    patientName: "华一",
    patientId: "P30029",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 17:15",
  },
  {
    id: 30,
    patientName: "金二",
    patientId: "P30030",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-05-01 17:30",
  },
  {
    id: 31,
    patientName: "魏三",
    patientId: "P30031",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 09:00",
  },
  {
    id: 32,
    patientName: "陶四",
    patientId: "P30032",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 09:15",
  },
  {
    id: 33,
    patientName: "姜五",
    patientId: "P30033",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-30 09:30",
    reason: "术前凝血功能严重异常",
  },
  {
    id: 34,
    patientName: "戚六",
    patientId: "P30034",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 09:45",
  },
  {
    id: 35,
    patientName: "谢七",
    patientId: "P30035",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-04-30 10:00",
    reason: "不符合乳腺癌MRI适应证指南",
  },
  {
    id: 36,
    patientName: "邹八",
    patientId: "P30036",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-30 10:15",
  },
  {
    id: 37,
    patientName: "柏九",
    patientId: "P30037",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-04-30 10:30",
    reason: "医保适应证仅限急性缺血性脑卒中",
  },
  {
    id: 38,
    patientName: "水十",
    patientId: "P30038",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 10:45",
  },
  {
    id: 39,
    patientName: "窦一",
    patientId: "P30039",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-30 11:00",
  },
  {
    id: 40,
    patientName: "章二",
    patientId: "P30040",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 11:15",
  },
  {
    id: 41,
    patientName: "石三",
    patientId: "P30041",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 11:30",
  },
  {
    id: 42,
    patientName: "韦四",
    patientId: "P30042",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "补充资料",
    auditor: "王审核",
    auditTime: "2026-04-30 11:45",
    reason: "需提供心电图及心功能评估",
  },
  {
    id: 43,
    patientName: "程五",
    patientId: "P30043",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 12:00",
  },
  {
    id: 44,
    patientName: "陆六",
    patientId: "P30044",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 14:00",
  },
  {
    id: 45,
    patientName: "柳七",
    patientId: "P30045",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-30 14:15",
  },
  {
    id: 46,
    patientName: "杜八",
    patientId: "P30046",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 14:30",
  },
  {
    id: 47,
    patientName: "阮九",
    patientId: "P30047",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 14:45",
  },
  {
    id: 48,
    patientName: "蓝十",
    patientId: "P30048",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-30 15:00",
    reason: "患者有活动性出血病史",
  },
  {
    id: 49,
    patientName: "梅五",
    patientId: "P30049",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 15:15",
  },
  {
    id: 50,
    patientName: "林六",
    patientId: "P30050",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 15:30",
  },
  {
    id: 51,
    patientName: "万六",
    patientId: "P30051",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-30 15:45",
  },
  {
    id: 52,
    patientName: "代七",
    patientId: "P30052",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 16:00",
  },
  {
    id: 53,
    patientName: "伍八",
    patientId: "P30053",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 16:15",
  },
  {
    id: 54,
    patientName: "余九",
    patientId: "P30054",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "补充资料",
    auditor: "王审核",
    auditTime: "2026-04-30 16:30",
    reason: "需提供血压及心率监测记录",
  },
  {
    id: 55,
    patientName: "元十",
    patientId: "P30055",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 16:45",
  },
  {
    id: 56,
    patientName: "卜一",
    patientId: "P30056",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 17:00",
  },
  {
    id: 57,
    patientName: "顾二",
    patientId: "P30057",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-30 17:15",
  },
  {
    id: 58,
    patientName: "孟三",
    patientId: "P30058",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 09:00",
  },
  {
    id: 59,
    patientName: "平四",
    patientId: "P30059",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 09:15",
  },
  {
    id: 60,
    patientName: "黄五",
    patientId: "P30060",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-29 09:30",
    reason: "类风湿关节炎诊断依据不充分",
  },
  {
    id: 61,
    patientName: "萧六",
    patientId: "P30061",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 09:45",
  },
  {
    id: 62,
    patientName: "尹七",
    patientId: "P30062",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 10:00",
  },
  {
    id: 63,
    patientName: "姚八",
    patientId: "P30063",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 10:15",
  },
  {
    id: 64,
    patientName: "邵九",
    patientId: "P30064",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 10:30",
  },
  {
    id: 65,
    patientName: "汪十",
    patientId: "P30065",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 10:45",
  },
  {
    id: 66,
    patientName: "毛一",
    patientId: "P30066",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-29 11:00",
    reason: "碘过敏试验阳性",
  },
  {
    id: 67,
    patientName: "狄二",
    patientId: "P30067",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 11:15",
  },
  {
    id: 68,
    patientName: "米三",
    patientId: "P30068",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 11:30",
  },
  {
    id: 69,
    patientName: "贝四",
    patientId: "P30069",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 11:45",
  },
  {
    id: 70,
    patientName: "明五",
    patientId: "P30070",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 12:00",
  },
  {
    id: 71,
    patientName: "臧六",
    patientId: "P30071",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "补充资料",
    auditor: "李审核",
    auditTime: "2026-04-29 14:00",
    reason: "需提供PSA检测报告",
  },
  {
    id: 72,
    patientName: "计七",
    patientId: "P30072",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 14:15",
  },
  {
    id: 73,
    patientName: "伏八",
    patientId: "P30073",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 14:30",
  },
  {
    id: 74,
    patientName: "成九",
    patientId: "P30074",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 14:45",
  },
  {
    id: 75,
    patientName: "戴十",
    patientId: "P30075",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 15:00",
  },
  {
    id: 76,
    patientName: "谈一",
    patientId: "P30076",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 15:15",
  },
  {
    id: 77,
    patientName: "宋二",
    patientId: "P30077",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 15:30",
  },
  {
    id: 78,
    patientName: "茅三",
    patientId: "P30078",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-29 15:45",
    reason: "INR值超过2.5",
  },
  {
    id: 79,
    patientName: "庞四",
    patientId: "P30079",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 16:00",
  },
  {
    id: 80,
    patientName: "熊五",
    patientId: "P30080",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 16:15",
  },
  {
    id: 81,
    patientName: "纪六",
    patientId: "P30081",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 16:30",
  },
  {
    id: 82,
    patientName: "舒七",
    patientId: "P30082",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-04-29 16:45",
    reason: "颅内出血急性期",
  },
  {
    id: 83,
    patientName: "屈八",
    patientId: "P30083",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 17:00",
  },
  {
    id: 84,
    patientName: "项九",
    patientId: "P30084",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 17:15",
  },
  {
    id: 85,
    patientName: "祝十",
    patientId: "P30085",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 17:30",
  },
  {
    id: 86,
    patientName: "董一",
    patientId: "P30086",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "前列腺MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-28 09:00",
  },
  {
    id: 87,
    patientName: "梁二",
    patientId: "P30087",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "冠脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 09:15",
  },
  {
    id: 88,
    patientName: "杜三",
    patientId: "P30088",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "肺结节CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 09:30",
  },
  {
    id: 89,
    patientName: "骆四",
    patientId: "P30089",
    examType: "DSA",
    examItem: "肿瘤栓塞术",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "补充资料",
    auditor: "李审核",
    auditTime: "2026-04-28 09:45",
    reason: "需提供凝血功能详细报告",
  },
  {
    id: 90,
    patientName: "马五",
    patientId: "P30090",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "骨关节MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 10:00",
  },
  {
    id: 91,
    patientName: "苗六",
    patientId: "P30091",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "腹部CT增强",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 10:15",
  },
  {
    id: 92,
    patientName: "凤七",
    patientId: "P30092",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "颅脑MRI增强",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-28 10:30",
  },
  {
    id: 93,
    patientName: "花八",
    patientId: "P30093",
    examType: "DSA",
    examItem: "冠状动脉造影",
    drugName: "普通肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 10:45",
  },
  {
    id: 94,
    patientName: "方九",
    patientId: "P30094",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "胸部CT增强",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 11:00",
  },
  {
    id: 95,
    patientName: "俞十",
    patientId: "P30095",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "乳腺MRI增强",
    drugName: "钆喷酸葡胺注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-28 11:15",
  },
  {
    id: 96,
    patientName: "任一",
    patientId: "P30096",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "头颈CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 11:30",
  },
  {
    id: 97,
    patientName: "袁二",
    patientId: "P30097",
    examType: "DSA",
    examItem: "脑血管取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 11:45",
  },
  {
    id: 98,
    patientName: "柳三",
    patientId: "P30098",
    examType: t("insuranceAudit.typeMriEnhance"),
    examItem: "肝脏MRI增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-28 12:00",
  },
  {
    id: 99,
    patientName: "酆四",
    patientId: "P30099",
    examType: t("insuranceAudit.typeCtEnhance"),
    examItem: "主动脉CTA",
    drugName: "碘海醇注射液",
    drugCategory: "CT对比剂",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 14:00",
  },
  {
    id: 100,
    patientName: "鲍五",
    patientId: "P30100",
    examType: "DSA",
    examItem: "外周血管支架术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 14:15",
  },
];

// 限制药品库
const restrictedDrugs: RestrictedDrug[] = [
  {
    id: 1,
    name: "碘海醇注射液",
    category: "CT对比剂",
    restriction: "限二级以上医疗机构，限CT增强扫描使用",
    applicableExams: "全身CT增强(头颈/胸部/腹部/盆腔/四肢)",
    notes: "需询问碘过敏史，肾功能不全者慎用",
  },
  {
    id: 2,
    name: "碘普罗胺注射液",
    category: "CT对比剂",
    restriction: "限CT增强扫描，肾功能不全(eGFR<30)及甲亢患者慎用",
    applicableExams: "CT血管造影(CTA)/CT增强扫描",
    notes: "非离子型碘对比剂，过敏反应发生率低",
  },
  {
    id: 3,
    name: "碘克沙醇注射液",
    category: "CT对比剂",
    restriction: "限CT增强，甲状腺功能亢进患者禁用",
    applicableExams: "冠脉CTA/头颈CTA/主动脉CTA",
    notes: "等渗非离子型对比剂，肾脏安全性较高",
  },
  {
    id: 4,
    name: "碘佛醇注射液",
    category: "CT对比剂",
    restriction: "限CT增强使用，限二级以上医疗机构",
    applicableExams: "CT增强扫描/CTA",
    notes: "需皮试，有严重心肺疾病者慎用",
  },
  {
    id: 5,
    name: "钆双胺注射液",
    category: "MRI对比剂",
    restriction: "限二级以上医疗机构，eGFR<30ml/min/1.73m²禁用",
    applicableExams: "颅脑MRI增强/脊髓MRI增强/全身MRI增强",
    notes: "线性钆对比剂，NSF风险需评估",
  },
  {
    id: 6,
    name: "钆喷酸葡胺注射液",
    category: "MRI对比剂",
    restriction: "限MRI增强扫描，类风湿关节炎患者优先使用",
    applicableExams: "关节MRI增强/软组织MRI增强/乳腺MRI增强",
    notes: "需监测肾功能，急性肾损伤患者慎用",
  },
  {
    id: 7,
    name: "钆塞酸二钠注射液",
    category: "MRI对比剂",
    restriction: "限肝脏MRI平扫+增强，肝功能Child-Pugh C级禁用",
    applicableExams: "肝脏MRI增强/胆道MRI成像",
    notes: "肝胆特异性对比剂，用于FNH/ HCC鉴别",
  },
  {
    id: 8,
    name: "钆布醇注射液",
    category: "MRI对比剂",
    restriction: "限MRI增强扫描，限二级以上医疗机构使用",
    applicableExams: "颅脑MRI增强/肿瘤MRI分期/心血管MRI",
    notes: "大环状钆对比剂，稳定性高，NSF风险低",
  },
  {
    id: 9,
    name: "普通肝素钠注射液",
    category: t("insuranceAudit.anticoagulant"),
    restriction:
      "限介入手术抗凝，禁用于有出血倾向、肝素诱导血小板减少症(HIT)患者",
    applicableExams: "DSA/血管介入/肿瘤栓塞/取栓术",
    notes: "需监测ACT，目标值250-300秒",
  },
  {
    id: 10,
    name: "低分子肝素钠注射液",
    category: t("insuranceAudit.anticoagulant"),
    restriction: "限介入手术抗凝及术后预防性抗凝，限二级以上医疗机构",
    applicableExams: "外周血管介入/支架术后/深静脉血栓预防",
    notes: "皮下注射，无需监测ACT，使用方便",
  },
  {
    id: 11,
    name: "阿加曲班注射液",
    category: t("insuranceAudit.anticoagulant"),
    restriction: "限急性缺血性脑卒中抗凝，发病48小时内使用，医保适应证严格限定",
    applicableExams: "急性脑梗死取栓术/动脉内溶栓",
    notes: "直接凝血酶抑制剂，需监测APTT",
  },
  {
    id: 12,
    name: "磺达肝癸钠注射液",
    category: t("insuranceAudit.anticoagulant"),
    restriction: "限DSA手术抗凝，限二级以上医疗机构使用",
    applicableExams: "DSA/血管介入手术",
    notes: "选择性Xa因子抑制剂，肾脏清除",
  },
  {
    id: 13,
    name: "比伐卢定注射液",
    category: t("insuranceAudit.anticoagulant"),
    restriction: "限PCI术中抗凝，限二级以上医疗机构使用",
    applicableExams: "冠脉介入/PCI术/急性心梗介入治疗",
    notes: "直接凝血酶抑制剂，作用可逆",
  },
  {
    id: 14,
    name: "利伐沙班片",
    category: t("insuranceAudit.anticoagulant"),
    restriction: "限深静脉血栓(DVT)和肺栓塞(PE)治疗及预防复发",
    applicableExams: "骨科DVT预防/血管外科术后抗凝",
    notes: "口服Xa因子抑制剂，胃肠道吸收好",
  },
];

// 适应证规则
const indicationRules: IndicationRule[] = [
  {
    id: 1,
    examType: t("insuranceAudit.typeCtEnhance"),
    examName: "CT肺动脉造影(CTPA)",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    insuranceRequirement:
      "限二级以上医疗机构，限CT增强扫描；肺栓塞疑似患者可使用，需提供D-二聚体或Wells评分支持",
    description: "CTPA用于肺栓塞诊断，需评估对比剂肾病风险及碘过敏史",
  },
  {
    id: 2,
    examType: t("insuranceAudit.typeMriEnhance"),
    examName: "颅脑MRI增强扫描",
    drugName: "钆双胺注射液",
    drugCategory: "MRI对比剂",
    insuranceRequirement:
      "限二级以上医疗机构；eGFR<30ml/min/1.73m²禁用；脑肿瘤/脑转移瘤/炎症性病变可使用",
    description:
      "钆对比剂用于脑肿瘤术后复发评估及炎症性病变诊断，需签署知情同意书",
  },
  {
    id: 3,
    examType: "DSA",
    examName: "急性脑梗死取栓术",
    drugName: "阿加曲班注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    insuranceRequirement:
      "限急性缺血性脑卒中(发病48小时内)使用；医保严格限定适应证，需神经科会诊记录",
    description: "阿加曲班用于急性脑梗死动脉内介入治疗后的抗凝，需监测APTT",
  },
  {
    id: 4,
    examType: t("insuranceAudit.typeMriEnhance"),
    examName: "肝脏MRI动态增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    insuranceRequirement:
      "限肝脏MRI平扫+增强扫描；肝功能Child-Pugh C级禁用；用于肝硬化结节定性及HCC筛查",
    description: "钆塞酸二钠为肝胆特异性对比剂，用于肝脏局灶性病变的鉴别诊断",
  },
  {
    id: 5,
    examType: t("insuranceAudit.typeCtEnhance"),
    examName: "冠状动脉CTA",
    drugName: "碘克沙醇注射液",
    drugCategory: "CT对比剂",
    insuranceRequirement:
      "限CT增强扫描；甲状腺功能亢进患者禁用；需提供心率及心功能评估",
    description: "碘克沙醇为等渗对比剂，用于冠心病筛查及冠脉支架术后评估",
  },
  {
    id: 6,
    examType: "DSA",
    examName: "外周血管支架置入术",
    drugName: "低分子肝素钠注射液",
    drugCategory: t("insuranceAudit.anticoagulant"),
    insuranceRequirement:
      "限介入手术抗凝及术后预防性抗凝；限二级以上医疗机构；需评估出血风险",
    description: "低分子肝素用于外周血管介入术中及术后抗凝，预防支架内血栓形成",
  },
];

// 统计数据
const statsData: StatsData = {
  passRate: 78.5,
  totalPending: 50,
  todayProcessed: 12,
  avgReviewTime: "18分钟",
};

// ============================================================
// 医保基金监控数据
// ============================================================

// 近30天基金使用趋势（万元）
const fundTrendData = [
  { date: "04-28", amount: 16.8, budget: 16.7 },
  { date: "04-29", amount: 15.2, budget: 16.7 },
  { date: "04-30", amount: 18.5, budget: 16.7 },
  { date: "05-01", amount: 14.3, budget: 16.7 },
  { date: "05-02", amount: 17.8, budget: 16.7 },
  { date: "05-03", amount: 19.2, budget: 16.7 },
  { date: "05-04", amount: 16.5, budget: 16.7 },
  { date: "05-05", amount: 15.8, budget: 16.7 },
  { date: "05-06", amount: 18.3, budget: 16.7 },
  { date: "05-07", amount: 17.1, budget: 16.7 },
  { date: "05-08", amount: 16.9, budget: 16.7 },
  { date: "05-09", amount: 15.6, budget: 16.7 },
  { date: "05-10", amount: 14.8, budget: 16.7 },
  { date: "05-11", amount: 18.7, budget: 16.7 },
  { date: "05-12", amount: 17.5, budget: 16.7 },
  { date: "05-13", amount: 16.2, budget: 16.7 },
  { date: "05-14", amount: 15.9, budget: 16.7 },
  { date: "05-15", amount: 18.6, budget: 16.7 },
  { date: "05-16", amount: 19.1, budget: 16.7 },
  { date: "05-17", amount: 17.3, budget: 16.7 },
  { date: "05-18", amount: 16.4, budget: 16.7 },
  { date: "05-19", amount: 15.7, budget: 16.7 },
  { date: "05-20", amount: 18.2, budget: 16.7 },
  { date: "05-21", amount: 17.8, budget: 16.7 },
  { date: "05-22", amount: 16.3, budget: 16.7 },
  { date: "05-23", amount: 15.5, budget: 16.7 },
  { date: "05-24", amount: 18.9, budget: 16.7 },
  { date: "05-25", amount: 17.6, budget: 16.7 },
  { date: "05-26", amount: 19.4, budget: 16.7 },
  { date: "05-27", amount: 17.2, budget: 16.7 },
];

// 近12个月基金使用趋势（万元）
const fundMonthlyData = [
  { month: "2025-06", amount: 468, budget: 500 },
  { month: "2025-07", amount: 485, budget: 500 },
  { month: "2025-08", amount: 492, budget: 500 },
  { month: "2025-09", amount: 478, budget: 500 },
  { month: "2025-10", amount: 456, budget: 500 },
  { month: "2025-11", amount: 502, budget: 500 },
  { month: "2025-12", amount: 515, budget: 500 },
  { month: "2026-01", amount: 487, budget: 500 },
  { month: "2026-02", amount: 423, budget: 500 },
  { month: "2026-03", amount: 465, budget: 500 },
  { month: "2026-04", amount: 491, budget: 500 },
  { month: "2026-05", amount: 392, budget: 500 }, // 当前月（截至27日）
];

// 科室使用分布（二八定律）
const deptUsageData = [
  { name: "心内科", value: 20, amount: 98.4, color: "var(--color-error-500)" },
  { name: "神经内科", value: 18, amount: 88.5, color: "#f97316" },
  { name: "呼吸内科", value: 15, amount: 73.8, color: "#eab308" },
  { name: "消化内科", value: 12, amount: 59.0, color: "var(--color-success-500)" },
  { name: "肿瘤科", value: 10, amount: 49.2, color: "var(--color-primary-500)" },
  { name: "血管外科", value: 8, amount: 39.4, color: "#8b5cf6" },
  { name: "其他科室", value: 17, amount: 83.6, color: "var(--text-secondary)" },
];

// 基金监控KPI
const fundMonitorKPI = {
  usageRate: 78.4, // 本月基金使用率
  balanceWarning: "正常", // 余额预警：正常/警告/超限
  violationCount: 23, // 违规使用次数
  passRateTrend: 78.5, // 审核通过率
  monthlyBudget: 5000000, // 月度预算（元）
  usedAmount: 3920000, // 已使用金额（元）
  balanceAmount: 1080000, // 余额（元）
  warningThreshold: 0.85, // 预警阈值 85%
  criticalThreshold: 0.95, // 超限阈值 95%
};

// 违规使用预警列表
const violationAlerts = [
  {
    id: "VIO001",
    patientName: "张三",
    patientId: "P202401001",
    dept: "心内科",
    drugName: "碘克沙醇注射液",
    violationType: "超出适应证",
    description: "冠脉CTA检查，但患者甲状腺功能亢进，碘对比剂禁用",
    time: "2026-05-27 09:30",
  },
  {
    id: "VIO002",
    patientName: "李四",
    patientId: "P202401002",
    dept: "神经内科",
    drugName: "钆双胺注射液",
    violationType: "剂量超标",
    description: "eGFR=25ml/min，低于安全阈值30ml/min，存在肾源性纤维化风险",
    time: "2026-05-27 10:15",
  },
  {
    id: "VIO003",
    patientName: "王五",
    patientId: "P202401003",
    dept: "呼吸内科",
    drugName: "碘普罗胺注射液",
    violationType: "重复使用",
    description: "同一患者7天内进行两次CT增强检查，累计辐射剂量超标",
    time: "2026-05-26 14:20",
  },
  {
    id: "VIO004",
    patientName: "赵六",
    patientId: "P202401004",
    dept: "肿瘤科",
    drugName: "钆塞酸二钠注射液",
    violationType: "适应证不符",
    description: "肝脏MRI增强，但肝功能Child-Pugh C级，禁用于该药品",
    time: "2026-05-26 11:45",
  },
  {
    id: "VIO005",
    patientName: "钱七",
    patientId: "P202401005",
    dept: "血管外科",
    drugName: "阿加曲班注射液",
    violationType: "超时间窗",
    description: "急性脑梗死取栓术，但发病已超过48小时，不在医保适应证时间窗内",
    time: "2026-05-25 16:30",
  },
  {
    id: "VIO006",
    patientName: "孙八",
    patientId: "P202401006",
    dept: "心内科",
    drugName: "碘海醇注射液",
    violationType: "未做皮试",
    description: "CT增强检查使用碘海醇，但未按要求进行碘过敏试验",
    time: "2026-05-25 09:00",
  },
  {
    id: "VIO007",
    patientName: "周九",
    patientId: "P202401007",
    dept: "消化内科",
    drugName: "碘克沙醇注射液",
    violationType: "科室权限",
    description: "该药品仅限于二级以上医疗机构使用，本院级别不符",
    time: "2026-05-24 15:20",
  },
  {
    id: "VIO008",
    patientName: "吴十",
    patientId: "P202401008",
    dept: "神经内科",
    drugName: "利伐沙班片",
    violationType: "适应证不符",
    description: "用于房颤抗凝治疗，但医保适应证限定为DVT和PE治疗",
    time: "2026-05-24 10:40",
  },
];

// 审核通过率趋势（近30天）
const passRateTrendData = [
  { date: "04-28", rate: 76.5 },
  { date: "04-29", rate: 78.2 },
  { date: "04-30", rate: 75.8 },
  { date: "05-01", rate: 79.1 },
  { date: "05-02", rate: 77.3 },
  { date: "05-03", rate: 80.2 },
  { date: "05-04", rate: 78.6 },
  { date: "05-05", rate: 79.5 },
  { date: "05-06", rate: 81.3 },
  { date: "05-07", rate: 77.9 },
  { date: "05-08", rate: 76.8 },
  { date: "05-09", rate: 79.4 },
  { date: "05-10", rate: 80.1 },
  { date: "05-11", rate: 78.7 },
  { date: "05-12", rate: 77.5 },
  { date: "05-13", rate: 79.8 },
  { date: "05-14", rate: 81.2 },
  { date: "05-15", rate: 78.4 },
  { date: "05-16", rate: 79.6 },
  { date: "05-17", rate: 80.5 },
  { date: "05-18", rate: 77.2 },
  { date: "05-19", rate: 78.9 },
  { date: "05-20", rate: 79.1 },
  { date: "05-21", rate: 81.8 },
  { date: "05-22", rate: 78.3 },
  { date: "05-23", rate: 79.7 },
  { date: "05-24", rate: 80.4 },
  { date: "05-25", rate: 77.6 },
  { date: "05-26", rate: 78.8 },
  { date: "05-27", rate: 78.5 },
];

// ---------- 样式定义 ----------
const styles: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: 700, color: "var(--color-primary-800)", margin: 0 },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: "16px 18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: 700,
    color: "var(--color-primary-800)",
    lineHeight: 1.2,
  },
  kpiLabel: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 2,
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "2px solid var(--border-color)",
    marginBottom: 20,
  },
  tab: {
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-secondary)",
    background: "none",
    border: "none",
    borderBottom: "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap" as const,
    background: "var(--bg-card)",
    padding: "14px 18px",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--content-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 8,
    padding: "8px 14px",
    flex: 1,
    minWidth: 200,
  },
  searchInput: {
    border: "none", background: "transparent",
    fontSize: 14,
    color: "var(--text-secondary)",
    width: "100%",
  },
  select: {
    border: "1px solid var(--border-color)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    color: "var(--text-secondary)",
    background: "var(--content-bg)", cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--border-color)",
    fontSize: 12,
    fontFamily: "inherit",
    boxSizing: "border-box", background: "var(--content-bg)",
    color: "var(--text-primary)",
  },
  cardList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 14,
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: "16px 18px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid var(--border-light)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardPatient: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--color-primary-800)",
  },
  cardPatientId: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 2,
  },
  cardTag: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  cardRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  cardDrug: {
    background: "var(--color-success-bg)",
    border: "1px solid var(--color-success-bg)",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 10,
  },
  cardDrugName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--color-success)",
  },
  cardDrugSpec: {
    fontSize: 12,
    color: "var(--color-success)",
    marginTop: 2,
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--color-info-bg)",
    color: "var(--color-primary)",
    marginTop: 4,
    display: "inline-block",
  },
  cardRestriction: {
    fontSize: 12,
    color: "var(--color-error)",
    background: "var(--color-error-bg)",
    border: "1px solid var(--color-error-bg)",
    borderRadius: 6,
    padding: "6px 10px",
    marginBottom: 10,
  },
  cardActions: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  tableWrapper: {
    background: "var(--bg-card)",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  },
  th: {
    background: "var(--content-bg)",
    padding: "12px 16px",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-color)",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text-secondary)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  badgeSuccess: {
    background: "var(--color-success-bg)",
    color: "var(--color-success)",
  },
  badgeDanger: {
    background: "var(--color-error-bg)",
    color: "var(--color-error)",
  },
  badgeWarning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning)",
  },
  btnGroup: {
    display: "flex",
    gap: 8,
  },
  btn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
  },
  btnPrimary: {
    background: "var(--color-primary)",
    color: "var(--text-inverse)",
  },
  btnSuccess: {
    background: "var(--color-success)",
    color: "var(--text-inverse)",
  },
  btnDanger: {
    background: "var(--color-error)",
    color: "var(--text-inverse)",
  },
  btnOutline: {
    background: "transparent",
    border: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  statTitle: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 30,
    fontWeight: 700,
    color: "var(--color-primary-800)",
  },
  chartCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--color-primary-800)",
    marginBottom: 16,
  },
  ruleCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 12,
    borderLeft: "4px solid var(--color-primary)",
  },
  ruleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  drugTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  drugTh: {
    background: "var(--content-bg)",
    padding: "10px 12px",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-color)",
    fontSize: 12,
  },
  drugTd: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text-secondary)",
    fontSize: 12,
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "var(--text-secondary)",
  },
  voucherCard: {
    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary) 100%)",
    borderRadius: 12,
    padding: "20px 24px",
    color: "var(--text-inverse)",
    marginBottom: 20,
  },
  voucherCardTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  voucherCardSubtitle: {
    fontSize: 12,
    opacity: 0.9,
  },
  voucherStatsRow: {
    display: "flex",
    gap: 24,
    marginTop: 16,
  },
  voucherStatItem: {
    display: "flex",
    flexDirection: "column",
  },
  voucherStatValue: {
    fontSize: 30,
    fontWeight: 700,
  },
  voucherStatLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  voucherToolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap" as const,
    background: "var(--bg-card)",
    padding: "14px 18px",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 16,
    border: "1px solid var(--color-info-bg)",
  },
  voucherFilterBtn: {
    padding: "6px 16px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
  },
  voucherFilterActive: {
    background: "var(--color-primary)",
    color: "var(--text-inverse)",
  },
  voucherFilterInactive: {
    background: "var(--color-info-bg)",
    color: "var(--color-primary)",
    border: "1px solid var(--color-info-bg)",
  },
  voucherTableWrapper: {
    background: "var(--bg-card)",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    overflow: "hidden",
    border: "1px solid var(--color-info-bg)",
  },
  voucherTh: {
    background: "var(--color-info-bg)",
    padding: "12px 16px",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "var(--color-primary)",
    borderBottom: "1px solid var(--color-info-bg)",
    fontSize: 12,
  },
  voucherTd: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text-secondary)",
    fontSize: 12,
  },
  voucherStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderTop: "1px solid var(--border-color)",
  },
  pageInfo: {
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  pageButtons: {
    display: "flex",
    gap: 8,
  },
  pageBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--border-color)",
    background: "var(--bg-card)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  toast: {
    position: "fixed",
    top: 24,
    right: 24,
    padding: "12px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: "var(--z-toast, 800)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    animation: "slideIn 0.3s ease",
  },
  toastSuccess: {
    background: "var(--color-success)",
    color: "var(--text-inverse)",
  },
  toastError: {
    background: "var(--color-error)",
    color: "var(--text-inverse)",
  },
  toastInfo: {
    background: "var(--color-primary)",
    color: "var(--text-inverse)",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "var(--z-modal, 500)",
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: 12,
    padding: 24,
    minWidth: 360,
    maxWidth: 480,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--color-primary-800)",
    marginBottom: 16,
  },
  modalText: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 20,
  },
  modalActions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  // 医保基金监控样式
  fundMonitorSection: {
    marginBottom: 24,
  },
  fundMonitorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  fundMonitorTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--color-primary-800)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  fundKpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  fundKpiCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: "16px 18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  fundKpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fundKpiValue: {
    fontSize: 30,
    fontWeight: 700,
    color: "var(--color-primary-800)",
    lineHeight: 1.2,
  },
  fundKpiLabel: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 2,
  },
  fundChartRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 20,
  },
  fundChartCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  fundChartTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--color-primary-800)",
    marginBottom: 16,
  },
  violationListCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  violationItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--border-light)",
  },
  violationItemLast: {
    borderBottom: "none",
  },
  violationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  violationContent: {
    flex: 1,
  },
  violationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  violationType: {
    fontSize: 12,
    fontWeight: 600,
  },
  violationTime: {
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  violationDesc: {
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  balanceWarningNormal: {
    background: "var(--color-success-bg)",
    color: "var(--color-success)",
    border: "1px solid var(--color-success-bg)",
  },
  balanceWarningWarning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning)",
    border: "1px solid var(--color-error-bg)",
  },
  balanceWarningCritical: {
    background: "var(--color-error-bg)",
    color: "var(--color-error)",
    border: "1px solid var(--color-error-bg)",
  },
};

// ---------- 组件 ----------
const PRIMARY = "var(--color-primary)";
const ACCENT = "var(--color-primary-500)";
const SUCCESS = "var(--color-success)";
const WARNING = "var(--color-warning)";
const DANGER = "var(--color-error)";
const GRAY = "var(--text-secondary)";
const WHITE = "var(--text-inverse)";

type TabKey =
  | "pending"
  | "history"
  | "stats"
  | "rules"
  | "voucher"
  | "fundMonitor"
  | "claim837"
  | "denial"
  | "preAuth"
  | "drg";

const TAB_LABELS: Record<TabKey, string> = {
  pending: t("insuranceAudit.statusPending"),
  history: t("insuranceAudit.auditHistory"),
  stats: t("insuranceAudit.statistics"),
  rules: t("insuranceAudit.ruleManagement"),
  voucher: t("insuranceAudit.voucherTitle"),
  fundMonitor: t("insuranceAudit.fundMonitoring"),
  claim837: t("insuranceAudit.claims837"),
  denial: t("insuranceAudit.denialManagement"),
  preAuth: t("insuranceAudit.preAuthorization"),
  drg: t("insuranceAudit.drgValidation"),
};

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  pending: <ClipboardList size={18} />,
  history: <Clock size={18} />,
  stats: <BarChart3 size={18} />,
  rules: <Settings size={18} />,
  voucher: <FileText size={18} />,
  fundMonitor: <DollarSign size={18} />,
  claim837: <FileText size={18} />,
  denial: <XCircle size={18} />,
  preAuth: <ClipboardCheck size={18} />,
  drg: <BarChart3 size={18} />,
};

// 紧急度颜色
const urgencyColor: Record<string, string> = {
  高: "var(--color-error)",
  中: "var(--color-warning)",
  低: "var(--color-success)",
};

// 结果 → canonical statusTokens tone
const resultTone: Record<string, string> = {
  通过: "approved",
  拒绝: "rejected",
  补充资料: "warning",
};

// 结果图标
const ResultIcon: React.FC<{ result: string }> = ({ result }) => {
  if (result === "通过") return <CheckCircle size={14} />;
  if (result === "拒绝") return <XCircle size={14} />;
  return <AlertTriangle size={14} />;
};

// 待审核卡片
const PendingAuditCard: React.FC<{
  audit: PendingAudit;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestInfo: (id: string) => void;
  onViewDetail: (id: string) => void;
  t: (key: string) => string;
}> = ({ audit, onApprove, onReject, onRequestInfo, onViewDetail, t }) => (
  <div style={styles.card}>
    <div style={styles.cardHeader}>
      <div>
        <div style={styles.cardPatient}>{audit.patientName}</div>
        <div style={styles.cardPatientId}>{audit.patientId}</div>
      </div>
      <span
        style={{
          ...styles.cardTag,
          background: `${urgencyColor[audit.urgency]}15`,
          color: urgencyColor[audit.urgency],
        }}
      >
        {audit.urgency === "高" ? (
          <AlertOctagon size={14} />
        ) : audit.urgency === "中" ? (
          <Clock size={14} />
        ) : (
          <Clock3 size={14} />
        )}
        {audit.urgency === "高"
          ? t("highUrgency")
          : audit.urgency === "中"
            ? t("mediumUrgency")
            : t("lowUrgency")}
      </span>
    </div>

    <div style={styles.cardRow}>
      <FileText size={14} />
      <span>{audit.examItem}</span>
      <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
        {audit.submitDept}
      </span>
    </div>

    <div style={styles.cardRow}>
      <Calendar size={14} />
      <span>{audit.submitTime}</span>
    </div>

    <div style={styles.cardDrug}>
      <div style={styles.cardDrugName}>
        <Pill size={14} style={{ marginRight: 6 }} />
        {audit.drugName}
      </div>
      <div style={styles.cardDrugSpec}>{audit.drugSpec}</div>
      <span style={styles.cardCategory}>{audit.drugCategory}</span>
    </div>

    <div style={styles.cardRestriction}>
      <AlertTriangle size={14} style={{ marginRight: 6 }} />
      {audit.restriction}
    </div>

    <AppText size="sm" color="secondary" as="div" style={{ marginBottom: 12 }}>
      <Stethoscope size={14} style={{ marginRight: 6 }} />
      {audit.reason}
    </AppText>

    <div style={styles.cardActions}>
      <PermissionGate permission="audit.approve">
        <button
          type="button"
          style={{ ...styles.btn, ...styles.btnSuccess, padding: "6px 14px", fontWeight: 600 }}
          onClick={() => onApprove(audit.id)}
        >
          <Check size={16} /> {t("approve")}
        </button>
      </PermissionGate>
      <div
        aria-hidden
        style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 4px" }}
      />
      <PermissionGate permission="audit.approve">
        <button
          type="button"
          style={{ ...styles.btn, ...styles.btnDanger, marginLeft: 4, padding: "6px 14px", fontWeight: 600 }}
          onClick={() => onReject(audit.id)}
        >
          <X size={16} /> {t("reject")}
        </button>
      </PermissionGate>
      <button
        type="button"
        style={{ ...styles.btn, ...styles.btnOutline, marginLeft: 4 }}
        onClick={() => onRequestInfo(audit.id)}
      >
        <MessageSquare size={16} /> {t("requestInfo")}
      </button>
      <button
        type="button"
        style={{ ...styles.btn, ...styles.btnOutline, marginLeft: 4 }}
        onClick={() => onViewDetail(audit.id)}
      >
        <FileText size={16} /> {t("insuranceAudit.detail")}
      </button>
    </div>
  </div>
);

// 审核历史表格行
// 审核历史结果单元格
const HistoryResultCell: React.FC<{ result: string }> = ({ result }) => {
  const { t } = useTranslation("insuranceAudit");
  return (
    <StatusTag status={resultTone[result] ?? "warning"}>
      <ResultIcon result={result} />
      {result === "通过"
        ? t("passed")
        : result === "拒绝"
          ? t("rejected")
          : t("supplement")}
    </StatusTag>
  );
};

// 主组件
export default function InsuranceAuditPage() {
  const { t } = useTranslation("insuranceAudit");
  const [indicationRulesState, setIndicationRules] =
    useState<IndicationRule[]>(indicationRules);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("全部");
  const [filterResult, setFilterResult] = useState("全部");
  const [historyPage, setHistoryPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [_selectedAudit, setSelectedAudit] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success",
  );
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAudits, setPendingAudits] = useState(pendingAuditData);
  const [auditLoading, setAuditLoading] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState("");

  // [W2-B] 保险审计详情 (insuranceApi.getById 优先, datareportApi.getInsuranceAudit 回退)
  const [showAuditDetail, setShowAuditDetail] = useState(false);
  const [auditDetailLoading, setAuditDetailLoading] = useState(false);
  const [auditDetail, setAuditDetail] = useState<DataReportAuditDto | null>(null);

  const handleViewDetail = (id: string) => {
    setAuditDetailLoading(true);
    setShowAuditDetail(true);
    setAuditDetail(null);
    void insuranceApi.getById(id).then((res) => {
      if (res.success && res.data) {
        setAuditDetailLoading(false);
        setAuditDetail(res.data as unknown as DataReportAuditDto);
        return;
      }
      // 回退: datareport 聚合视图 (与医保平台同表)
      void datareportApi.getInsuranceAudit(id).then((res2) => {
        setAuditDetailLoading(false);
        if (res2.success) {
          const raw = res2.data as unknown;
          const item = Array.isArray(raw) ? raw[0] : raw;
          setAuditDetail((item as DataReportAuditDto) ?? null);
        } else {
          setToastType("error");
          setToastMessage(res2.error?.message || t("insuranceAudit.detailLoadFailed"));
        }
      });
    });
  };

  // [Phase 2] 从真实 API 加载待审核数据
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setAuditLoading(true);
      const [listRes, insuranceRes] = await Promise.all([
        datareportApi.listInsuranceAudits(),
        insuranceApi.list(),
      ]);
      if (cancelled) return;
      const mapped: PendingAudit[] = [];
      if (listRes.success && Array.isArray(listRes.data)) {
        (listRes.data as DataReportAuditDto[]).forEach((d) => {
          if (d.status === "pending" || d.status === "PENDING") {
            mapped.push({
              id: d.id,
              patientName: d.patientName,
              patientId: d.patientId,
              examType: d.examType || "CT",
              examItem: d.examType || t("insuranceAudit.examTypeImage"),
              drugName: d.drugName || d.drugCategory || t("insuranceAudit.contrast2"),
              drugCategory: d.drugCategory || t("insuranceAudit.contrast2"),
              drugSpec: t("insuranceAudit.regularSpec"),
              restriction: t("insuranceAudit.restrictedDrugList"),
              reason: d.reason || t("insuranceAudit.statusPending"),
              submitTime: d.submitTime || "",
              submitDept: t("insuranceAudit.radiologyDept"),
              urgency: "中",
            });
          }
        });
      }
      if (insuranceRes.success && Array.isArray(insuranceRes.data)) {
        (insuranceRes.data as any[]).forEach((d) => {
          if (d.status === "pending") {
            mapped.push({
              id: d.id,
              patientName: d.patientName,
              patientId: d.patientId,
              examType: d.examItem || "CT",
              examItem: d.examItem || t("insuranceAudit.examTypeImage"),
              drugName: d.contrastAgent || d.anticoagulant || t("insuranceAudit.contrast2"),
              drugCategory: d.contrastAgent ? t("insuranceAudit.contrast2") : t("insuranceAudit.anticoagulant"),
              drugSpec: t("insuranceAudit.regularSpec"),
              restriction: t("insuranceAudit.restrictedDrugList"),
              reason: d.reason || t("insuranceAudit.statusPending"),
              submitTime: "",
              submitDept: t("insuranceAudit.radiologyDept"),
              urgency: "中",
            });
          }
        });
      }
      if (mapped.length > 0) setPendingAudits(mapped);
      setAuditLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherFilterStatus, setVoucherFilterStatus] = useState("全部");
  const [ruleToDelete, setRuleToDelete] = useState<IndicationRule | null>(null);

  // 837 Claim Generation state
  const claim837Data = [
    {
      id: "CLM001",
      patientName: "张伟",
      patientId: "P202400001",
      examItem: "头颅CT增强",
      icd10: "I63.9",
      cpt: "70460",
      amount: 850,
      status: t("insuranceAudit.statusSubmitted"),
      submitDate: "2026-05-01",
      carrier: t("insuranceAudit.insurerPicc"),
      trackStatus: t("insuranceAudit.statusAccepted"),
    },
    {
      id: "CLM002",
      patientName: "李娜",
      patientId: "P202400002",
      examItem: "头颅MRI增强",
      icd10: "C71.9",
      cpt: "70553",
      amount: 1200,
      status: t("insuranceAudit.statusPendingSubmit"),
      submitDate: "",
      carrier: t("insuranceAudit.insurerPingAn"),
      trackStatus: t("insuranceAudit.statusPendingSubmit"),
    },
    {
      id: "CLM003",
      patientName: "王磊",
      patientId: "P202400003",
      examItem: "脑血管DSA",
      icd10: "I65.9",
      cpt: "75680",
      amount: 2800,
      status: t("insuranceAudit.statusSubmitted"),
      submitDate: "2026-04-28",
      carrier: t("insuranceAudit.insurerPicc"),
      trackStatus: t("insuranceAudit.statusReviewing"),
    },
    {
      id: "CLM004",
      patientName: "赵敏",
      patientId: "P202400004",
      examItem: "腹部CT增强",
      icd10: "C22.0",
      cpt: "74160",
      amount: 950,
      status: t("insuranceAudit.statusPaid"),
      submitDate: "2026-04-25",
      carrier: t("insuranceAudit.insurerPingAn"),
      trackStatus: t("insuranceAudit.statusPaid"),
    },
    {
      id: "CLM005",
      patientName: "周涛",
      patientId: "P202400005",
      examItem: "前列腺MRI增强",
      icd10: "C61",
      cpt: "72196",
      amount: 1500,
      status: t("insuranceAudit.statusDenied"),
      submitDate: "2026-04-20",
      carrier: t("insuranceAudit.insurerPicc"),
      trackStatus: t("insuranceAudit.denial"),
    },
  ];
  const icdCptMapping = [
    { icd10: "I63.9", description: t("insuranceAudit.diseaseCerebralInfarction"), cpt: "70460", exam: "头颅CT增强" },
    {
      icd10: "C71.9",
      description: t("insuranceAudit.diseaseBrainMalignancy"),
      cpt: "70553",
      exam: "头颅MRI增强",
    },
    {
      icd10: "I65.9",
      description: t("insuranceAudit.diseaseCerebralStenosis"),
      cpt: "75680",
      exam: "脑血管DSA",
    },
    {
      icd10: "C22.0",
      description: t("insuranceAudit.diseaseHcc"),
      cpt: "74160",
      exam: "腹部CT增强",
    },
    {
      icd10: "C61",
      description: t("insuranceAudit.diseaseProstateCancer"),
      cpt: "72196",
      exam: "前列腺MRI增强",
    },
  ];
  const [claimBatchMode, setClaimBatchMode] = useState(false);
  const [claimStatusFilter, setClaimStatusFilter] = useState("全部");

  // Denial Management
  const denialData = [
    {
      id: "DEN001",
      patientName: "周涛",
      patientId: "P202400005",
      examItem: "前列腺MRI增强",
      denialReason: "coding_error",
      description: t("insuranceAudit.denialCptIcdMismatch"),
      amount: 1500,
      date: "2026-04-25",
      carrier: t("insuranceAudit.insurerPicc"),
      appealStatus: t("insuranceAudit.statusPendingAppeal"),
    },
    {
      id: "DEN002",
      patientName: "吴静",
      patientId: "P202400006",
      examItem: "冠脉CTA",
      denialReason: "authorization_missing",
      description: t("insuranceAudit.denialNoPreAuth"),
      amount: 1800,
      date: "2026-04-22",
      carrier: t("insuranceAudit.insurerPingAn"),
      appealStatus: t("insuranceAudit.statusAppealing"),
    },
    {
      id: "DEN003",
      patientName: "郑强",
      patientId: "P202400007",
      examItem: "肺动脉CTA",
      denialReason: "medical_necessity",
      description: t("insuranceAudit.denialNotMedicallyNecessary2"),
      amount: 1200,
      date: "2026-04-18",
      carrier: t("insuranceAudit.insurerPicc"),
      appealStatus: t("insuranceAudit.statusApproved"),
    },
    {
      id: "DEN004",
      patientName: "钱琳",
      patientId: "P202400008",
      examItem: "腹部CT增强",
      denialReason: "duplicate",
      description: t("insuranceAudit.denialDuplicateClaim"),
      amount: 950,
      date: "2026-04-15",
      carrier: t("insuranceAudit.insurerPingAn"),
      appealStatus: t("insuranceAudit.statusRejected"),
    },
    {
      id: "DEN005",
      patientName: "孙鹏",
      patientId: "P202400009",
      examItem: "肾动脉DSA",
      denialReason: "coding_error",
      description: t("insuranceAudit.denialIcdGenderMismatch"),
      amount: 2200,
      date: "2026-04-10",
      carrier: t("insuranceAudit.insurerPicc"),
      appealStatus: t("insuranceAudit.statusPendingAppeal"),
    },
  ];
  const denialRateTrend = [
    { month: "2025-11", rate: 12.5 },
    { month: "2025-12", rate: 11.8 },
    { month: "2026-01", rate: 13.2 },
    { month: "2026-02", rate: 10.5 },
    { month: "2026-03", rate: 11.0 },
    { month: "2026-04", rate: 9.8 },
  ];
  const denialReasonLabels: Record<string, string> = {
    coding_error: t("insuranceAudit.denialCodingError"),
    authorization_missing: t("insuranceAudit.denialMissingAuthorization"),
    medical_necessity: t("insuranceAudit.medicalNecessity"),
    duplicate: t("insuranceAudit.duplicateClaim"),
    other: t("insuranceAudit.other"),
  };
  const [denialAppealFilter, setDenialAppealFilter] = useState("全部");

  // Pre-Authorization
  const preAuthData = [
    {
      id: "PA001",
      patientName: "张伟",
      patientId: "P202400001",
      examItem: "冠脉CTA",
      requestedDate: "2026-04-28",
      status: "pending",
      docs: [t("insuranceAudit.applicationForm"), t("insuranceAudit.medicalSummary"), t("insuranceAudit.ecg")],
      docsCompleted: 2,
      expiryDate: "2026-05-28",
    },
    {
      id: "PA002",
      patientName: "李娜",
      patientId: "P202400002",
      examItem: "头颅MRI增强",
      requestedDate: "2026-04-25",
      status: "approved",
      docs: [t("insuranceAudit.applicationForm"), t("insuranceAudit.medicalSummary"), t("insuranceAudit.imageReport"), t("insuranceAudit.pathologyReport")],
      docsCompleted: 4,
      expiryDate: "2026-05-25",
    },
    {
      id: "PA003",
      patientName: "王磊",
      patientId: "P202400003",
      examItem: "脑血管DSA",
      requestedDate: "2026-04-20",
      status: "denied",
      docs: [t("insuranceAudit.applicationForm"), t("insuranceAudit.medicalSummary"), t("insuranceAudit.ctReport")],
      docsCompleted: 3,
      expiryDate: "2026-05-20",
    },
    {
      id: "PA004",
      patientName: "赵敏",
      patientId: "P202400004",
      examItem: "腹部CT增强",
      requestedDate: "2026-04-30",
      status: "pending",
      docs: [t("insuranceAudit.applicationForm"), t("insuranceAudit.liverFunctionReport")],
      docsCompleted: 1,
      expiryDate: "2026-05-30",
    },
  ];
  const [preAuthFilter, setPreAuthFilter] = useState("全部");

  // DRG Validation
  const drgData = [
    {
      id: "DRG001",
      patientName: "张伟",
      patientId: "P202400001",
      icdCodes: "I63.9, I10",
      drgCode: "B70A",
      drgName: t("insuranceAudit.drgCerebrovascularWithCc"),
      expectedCost: 15000,
      actualCost: 16800,
      outlier: false,
      validationScore: 92,
    },
    {
      id: "DRG002",
      patientName: "李娜",
      patientId: "P202400002",
      icdCodes: "C71.9, D63.0",
      drgCode: "A10A",
      drgName: t("insuranceAudit.drgNeuroTumorWithCc"),
      expectedCost: 25000,
      actualCost: 32000,
      outlier: true,
      validationScore: 78,
    },
    {
      id: "DRG003",
      patientName: "王磊",
      patientId: "P202400003",
      icdCodes: "I65.9",
      drgCode: "B70B",
      drgName: t("insuranceAudit.drgCerebrovascularNoCc"),
      expectedCost: 12000,
      actualCost: 11500,
      outlier: false,
      validationScore: 95,
    },
    {
      id: "DRG004",
      patientName: "赵敏",
      patientId: "P202400004",
      icdCodes: "C22.0, K70.3",
      drgCode: "H60A",
      drgName: t("insuranceAudit.drgHepatobiliaryTumorWithCc"),
      expectedCost: 20000,
      actualCost: 28500,
      outlier: true,
      validationScore: 72,
    },
  ];
  const drgMapping = [
    { icdStart: "A00", icdEnd: "B99", drg: "A", category: t("insuranceAudit.drgInfectious") },
    { icdStart: "C00", icdEnd: "D49", drg: "B", category: t("insuranceAudit.drgTumor") },
    { icdStart: "I60", icdEnd: "I69", drg: "B70", category: t("insuranceAudit.drgCerebrovascular") },
    { icdStart: "K70", icdEnd: "K77", drg: "H60", category: t("insuranceAudit.drgHepatobiliary") },
  ];

  const pageSize = 10;

  // Toast auto dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toastMessage]);

  // 过滤后的待审核数据
  const filteredPending = useMemo(() => {
    return pendingAudits.filter((a) => {
      const matchSearch =
        searchTerm === "" ||
        a.patientName.includes(searchTerm) ||
        a.patientId.includes(searchTerm) ||
        a.drugName.includes(searchTerm);
      const matchType = filterType === "全部" || a.examType === filterType;
      return matchSearch && matchType;
    });
  }, [searchTerm, filterType]);

  // 过滤后的历史数据
  const filteredHistory = useMemo(() => {
    return auditHistory.filter((h) => {
      const matchSearch =
        searchTerm === "" ||
        h.patientName.includes(searchTerm) ||
        h.patientId.includes(searchTerm) ||
        h.drugName.includes(searchTerm);
      const matchResult = filterResult === "全部" || h.result === filterResult;
      return matchSearch && matchResult;
    });
  }, [searchTerm, filterResult]);

  const totalPages = Math.ceil(filteredHistory.length / pageSize);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * pageSize,
    historyPage * pageSize,
  );

  const pendingTotalPages = Math.ceil(filteredPending.length / pageSize);
  const paginatedPending = filteredPending.slice(
    (pendingPage - 1) * pageSize,
    pendingPage * pageSize,
  );

  // [W2-C] 导出审核历史为 CSV
  const handleExportHistory = () => {
    const header = t("insuranceAudit.csvHeader");
    const rows = filteredHistory.map((h) =>
      [
        h.patientName,
        h.patientId,
        h.examType,
        h.examItem,
        h.drugName,
        h.drugCategory,
        h.result,
        h.auditor,
        h.auditTime,
        h.reason || "",
      ].join(","),
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-audit-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(t("insuranceAudit.exportedRecords", { count: filteredHistory.length }));
  };

  // 过滤后的电子凭证数据
  const filteredVouchers = useMemo(() => {
    return VOUCHER_DATA.filter((v) => {
      const matchSearch =
        voucherSearch === "" ||
        v.patientName.includes(voucherSearch) ||
        v.patientId.includes(voucherSearch) ||
        v.id.includes(voucherSearch) ||
        v.relatedAuditId.includes(voucherSearch);
      const matchStatus =
        voucherFilterStatus === "全部" || v.status === voucherFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [voucherSearch, voucherFilterStatus]);

  // 电子凭证统计
  const voucherStats = useMemo(() => {
    const total = VOUCHER_DATA.length;
    const invoiced = VOUCHER_DATA.filter((v) => v.status === "已开票").length;
    const pending = VOUCHER_DATA.filter((v) => v.status === "待开票").length;
    const cancelled = VOUCHER_DATA.filter((v) => v.status === "已作废").length;
    const totalAmount = VOUCHER_DATA.reduce((sum, v) => sum + v.amount, 0);
    return { total, invoiced, pending, cancelled, totalAmount };
  }, []);

  const handleApprove = (id: string) => {
    setSelectedAudit(id);
    setToastType("success");
    setToastMessage(t("approvedMsg") + `: ${id}`);
    // 调用真实 API 并通过
    void insuranceApi.approve(id).then((res) => {
      if (!res.success) {
        setToastType("error");
        setToastMessage(res.error?.message || t("approveFailed", t("insuranceAudit.approveFailed")));
        return;
      }
      setToastType("success");
      setToastMessage(t("approvedMsg") + `: ${id}`);
      setPendingAudits((prev) => prev.filter((a) => a.id !== id));
    });
  };

  const handleReject = (id: string) => {
    setPendingId(id);
    setShowRejectModal(true);
  };

  const handleRequestInfo = (id: string) => {
    setPendingId(id);
    setShowRequestInfoModal(true);
  };

  const confirmReject = () => {
    if (pendingId) {
      const reason = rejectReasonText.trim() || t("rejectDefaultReason", t("insuranceAudit.approveFailedReason"));
      setToastType("error");
      setToastMessage(t("rejectedMsg") + `: ${pendingId}`);
      setShowRejectModal(false);
      setPendingId(null);
      setRejectReasonText("");
      // 调用真实 API 拒绝
      void insuranceApi.reject(pendingId, reason).then((res) => {
        if (res.success) {
          setPendingAudits((prev) => prev.filter((a) => a.id !== pendingId));
        } else {
          setToastType("error");
          setToastMessage(res.error?.message || t("rejectFailed", t("insuranceAudit.rejectFailed")));
        }
      });
    }
  };

  const confirmRequestInfo = () => {
    if (pendingId) {
      setToastType("info");
      setToastMessage(t("requestedMsg") + `: ${pendingId}`);
      setShowRequestInfoModal(false);
      setPendingId(null);
    }
  };

  // [Wave 4A] 新建医保审核记录 (insuranceApi.create, 后端 POST /insurance-audits)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: "",
    patientName: "",
    examItem: "",
    contrastAgent: "",
    anticoagulant: "",
    amount: 0,
    reason: "",
  });

  const openCreateModal = () => {
    setCreateForm({
      patientId: "",
      patientName: "",
      examItem: "",
      contrastAgent: "",
      anticoagulant: "",
      amount: 0,
      reason: "",
    });
    setShowCreateModal(true);
  };

  const handleCreateAudit = async () => {
    if (!createForm.patientId.trim() || !createForm.patientName.trim()) {
      setToastType("error");
      setToastMessage(t("insuranceAudit.patientRequired"));
      return;
    }
    if (!createForm.contrastAgent.trim() && !createForm.anticoagulant.trim()) {
      setToastType("error");
      setToastMessage(t("insuranceAudit.drugRequired"));
      return;
    }
    setCreating(true);
    const res = await insuranceApi.create({
      patientId: createForm.patientId.trim(),
      patientName: createForm.patientName.trim(),
      examItem: createForm.examItem.trim() || t("insuranceAudit.examTypeImage"),
      contrastAgent: createForm.contrastAgent.trim() || undefined,
      anticoagulant: createForm.anticoagulant.trim() || undefined,
      amount: createForm.amount > 0 ? createForm.amount : undefined,
      reason: createForm.reason.trim() || t("insuranceAudit.newRecordAdded"),
    });
    setCreating(false);
    if (res.success) {
      setToastType("success");
      setToastMessage(t('insuranceAudit.recordCreatedToast', { id: res.data.id }));
      setShowCreateModal(false);
      // 同步刷新待审核列表
      const listRes = await insuranceApi.list();
      if (listRes.success && Array.isArray(listRes.data)) {
        const mapped: PendingAudit[] = [];
        (listRes.data as any[]).forEach((d) => {
          if (d.status === "pending") {
            mapped.push({
              id: d.id,
              patientName: d.patientName,
              patientId: d.patientId,
              examType: d.examItem || "CT",
              examItem: d.examItem || t("insuranceAudit.examTypeImage"),
              drugName: d.contrastAgent || d.anticoagulant || t("insuranceAudit.contrast2"),
              drugCategory: d.contrastAgent ? t("insuranceAudit.contrast2") : t("insuranceAudit.anticoagulant"),
              drugSpec: t("insuranceAudit.regularSpec"),
              restriction: t("insuranceAudit.restrictedDrugList"),
              reason: d.reason || t("insuranceAudit.statusPending"),
              submitTime: "",
              submitDept: t("insuranceAudit.radiologyDept"),
              urgency: "中",
            });
          }
        });
        if (mapped.length > 0) setPendingAudits(mapped);
      }
    } else {
      setToastType("error");
      setToastMessage(res.error?.message || t("insuranceAudit.createFailed"));
    }
  };

  return (
    <div style={styles.root}>
      <PageHeader
        icon={<ShieldCheck size={22} style={{ color: "var(--color-primary)" }} />}
        title={t("title")}
        subtitle={
          /* [G005 Wave2B P2] statsData/fundTrendData 等大量硬编码 → 部分演示数据徽标 */
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "var(--color-warning-bg)", color: "var(--color-warning)", border: "1px solid var(--color-warning-border)", fontWeight: 600 }}>{t("insuranceAudit.partialDemoData")}</span>
        }
      />

      {/* KPI 卡片 */}
      <div style={styles.kpiRow}>
        <StatCard
          title={t("pendingCount")}
          value={statsData.totalPending}
          icon={<ClipboardList size={22} />}
          color="info"
        />
        <StatCard
          title={t("passRate")}
          value={statsData.passRate}
          suffix="%"
          icon={<CheckCircle size={22} />}
          color="success"
        />
        <StatCard
          title={t("todayProcessed")}
          value={statsData.todayProcessed}
          icon={<Activity size={22} />}
          color="warning"
        />
        <StatCard
          title={t("insuranceAudit.avgAuditTime")}
          value={statsData.avgReviewTime}
          icon={<Clock size={22} />}
          color="primary"
        />
      </div>

      {/* ============================================================ */}
      {/* 医保基金监控区域 */}
      {/* ============================================================ */}
      <div style={styles.fundMonitorSection}>
        <div style={styles.fundMonitorHeader}>
          <h3 style={styles.fundMonitorTitle}>
            <DollarSign size={20} style={{ color: "var(--color-success)" }} />
            {t("insuranceAudit.fundMonitorTitle")}
          </h3>
          <AppText size="xs" color="secondary" as="span">
            {t("insuranceAudit.dataUpdatedAt")}
          </AppText>
        </div>

        {/* 基金监控KPI */}
        <div style={styles.fundKpiRow}>
          <StatCard
            title={t("insuranceAudit.monthlyFundUsage")}
            value={fundMonitorKPI.usageRate}
            suffix="%"
            icon={<Percent size={22} />}
            color="success"
          />
          <StatCard
            title={t("insuranceAudit.fundBalanceWarning")}
            value={fundMonitorKPI.balanceWarning}
            icon={<AlertTriangle size={22} />}
            color={fundMonitorKPI.balanceWarning === "正常" ? "success" : fundMonitorKPI.balanceWarning === "警告" ? "warning" : "error"}
          />
          <StatCard
            title={t("insuranceAudit.monthlyViolations")}
            value={fundMonitorKPI.violationCount}
            icon={<AlertOctagon size={22} />}
            color="error"
          />
          <StatCard
            title={t("insuranceAudit.approvalRate")}
            value={fundMonitorKPI.passRateTrend}
            suffix="%"
            icon={<TrendingUp size={22} />}
            color="info"
          />
        </div>

        {/* 图表区域：基金趋势 + 科室分布 */}
        <div style={styles.fundChartRow}>
          {/* 基金使用趋势图 */}
          <div style={styles.fundChartCard}>
            <div style={styles.fundChartTitle}>
              <TrendingUp
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "var(--color-success)",
                }}
              />
              {t("insuranceAudit.fundTrendRecent30d")}
            </div>
            <ChartContainer height={220} state={fundTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("insuranceAudit.noFundTrendData")}>
              <AreaChart data={fundTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit={t("insuranceAudit.tenThousand")} />
                <Tooltip
                  formatter={(value: number) => [appT("w9a.insuranceAudit.currencyWan", { value }), t("insuranceAudit.usageAmount")]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#94a3b8"
                  fill="var(--content-bg)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  name={t("insuranceAudit.chartDailyBudget")}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-success-600)"
                  fill="#dcfce7"
                  strokeWidth={2}
                  name={t("insuranceAudit.chartActualUsage")}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* 科室使用分布 */}
          <div style={styles.fundChartCard}>
            <div style={styles.fundChartTitle}>
              <PieChartIcon
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "var(--color-warning)",
                }}
              />
              {t("insuranceAudit.deptUsageDist")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 220, height: 220, flexShrink: 0 }}>
              <ChartContainer height={220} state={deptUsageData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("insuranceAudit.noDeptDistData")}>
                <PieChart>
                  <Pie
                    data={deptUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {deptUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, t("insuranceAudit.share")]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                    }}
                  />
                </PieChart>
              </ChartContainer>
              <div style={{ flex: 1 }}>
                {deptUsageData.map((dept, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: dept.color,
                        flexShrink: 0,
                      }}
                    />
                    <AppText size="xs" color="secondary" as="div" style={{ flex: 1 }}>
                      {dept.name}
                    </AppText>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-primary-800)",
                      }}
                    >
                      {dept.value}%
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* 月度趋势图 + 违规预警列表 */}
        <div style={styles.fundChartRow}>
          {/* 近12个月基金使用趋势 */}
          <div style={styles.fundChartCard}>
            <div style={styles.fundChartTitle}>
              <BarChart3
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "var(--color-primary)",
                }}
              />
              {t("insuranceAudit.fundTrendRecent12m")}
            </div>
            <ChartContainer height={200} state={fundMonthlyData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("insuranceAudit.noMonthlyFundData")}>
              <BarChart data={fundMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit={t("insuranceAudit.tenThousand")} />
                <Tooltip
                  formatter={(value: number) => [appT("w9a.insuranceAudit.currencyWan", { value }), t("insuranceAudit.usageAmount")]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                  }}
                />
                <Bar
                  dataKey="budget"
                  fill="var(--border-color)"
                  name={t("insuranceAudit.chartMonthlyBudget")}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="amount"
                  fill="var(--color-primary-500)"
                  name={t("insuranceAudit.chartActualUsage")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* 违规使用预警列表 */}
          <div style={styles.violationListCard}>
            <div style={styles.fundChartTitle}>
              <AlertCircle
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "var(--color-error)",
                }}
              />
              {t("insuranceAudit.violationWarning")}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text-secondary)",
                }}
              >
                {t("insuranceAudit.totalPrefix")} {violationAlerts.length} {t("insuranceAudit.items")}
              </span>
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {violationAlerts.slice(0, 6).map((violation, idx) => (
                <div
                  key={violation.id}
                  style={{
                    ...styles.violationItem,
                    ...(idx === 5 ? styles.violationItemLast : {}),
                  }}
                >
                  <div
                    style={{ ...styles.violationIcon, background: "var(--color-error-bg)" }}
                  >
                    <AlertOctagon size={16} color="var(--color-error)" />
                  </div>
                  <div style={styles.violationContent}>
                    <div style={styles.violationHeader}>
                      <span
                        style={{ ...styles.violationType, color: "var(--color-error)" }}
                      >
                        {violation.violationType}
                      </span>
                      <span style={styles.violationTime}>{violation.time}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 2,
                      }}
                    >
                      {violation.patientName} ({violation.patientId}) -{" "}
                      {violation.dept}
                    </div>
                    <div style={styles.violationDesc}>
                      {violation.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 审核通过率趋势 */}
        <div style={styles.fundChartCard}>
          <div style={styles.fundChartTitle}>
            <TrendingUp
              size={16}
              style={{
                marginRight: 6,
                verticalAlign: "middle",
                color: "var(--color-modality-mr)",
              }}
            />
            {t("insuranceAudit.approvalTrendRecent30d")}
          </div>
            <ChartContainer height={180} state={passRateTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("insuranceAudit.noApprovalTrendData")}>
              <AreaChart data={passRateTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" interval={autoInterval(passRateTrendData.length)} tickFormatter={(v: string) => (v && v.length > 5 ? `${v.slice(5)}` : v)} />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                domain={[70, 90]}
                unit="%"
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, t("insuranceAudit.passedRate")]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border-color)" }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#8b5cf6"
                fill="#f3e8ff"
                strokeWidth={2}
                  name={t("insuranceAudit.chartApprovalRate")}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* 标签页 */}
      <div style={styles.tabs}>
        {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
          <button
            key={key}
            style={{
              ...styles.tab,
              ...(activeTab === key ? styles.tabActive : {}),
              ...(activeTab === key
                ? { color: "var(--color-primary)", borderBottomColor: "var(--color-primary)" }
                : {}),
            }}
            onClick={() => setActiveTab(key)}
          >
            {TAB_ICONS[key]}
            {t(`tabs.${key}`)}
            {key === "pending" && (
              <span
                style={{
                  background: "var(--color-error)",
                  color: "var(--text-inverse)",
                  fontSize: 12,
                  padding: "2px 6px",
                  borderRadius: 10,
                  marginLeft: 4,
                }}
              >
                {pendingAudits.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 待审核 */}
      {activeTab === "pending" && (
        <>
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                style={styles.searchInput}
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              style={styles.select}
              value={filterType}
              onChange={(v) => setFilterType(v)}
              options={[
                { value: "全部", label: t("allTypes") },
                { value: "CT增强", label: t("insuranceAudit.typeCtEnhance") },
                { value: "MRI增强", label: t("insuranceAudit.typeMriEnhance") },
                { value: "DSA手术", label: t("insuranceAudit.typeDsaSurgery") },
              ]}
            />
            <button
              onClick={() => {
                setToastType("success");
                setToastMessage(t("refreshed"));
                // [Phase 2] 刷新时重新拉取医保平台数据
                setAuditLoading(true);
                void datareportApi.listInsuranceAudits().then((res) => {
                  setAuditLoading(false);
                  if (res.success && Array.isArray(res.data)) {
                    const list = res.data as DataReportAuditDto[];
                    const mapped: PendingAudit[] = [];
                    list.forEach((d) => {
                      if (d.status === "pending" || d.status === "PENDING") {
                        mapped.push({
                          id: d.id,
                          patientName: d.patientName,
                          patientId: d.patientId,
                          examType: d.examType || "CT",
                          examItem: d.examType || t("insuranceAudit.examTypeImage"),
                          drugName: d.drugName || d.drugCategory || t("insuranceAudit.contrast2"),
                          drugCategory: d.drugCategory || t("insuranceAudit.contrast2"),
                          drugSpec: t("insuranceAudit.regularSpec"),
                          restriction: t("insuranceAudit.restrictedDrugList"),
                          reason: d.reason || t("insuranceAudit.statusPending"),
                          submitTime: d.submitTime || "",
                          submitDept: t("insuranceAudit.radiologyDept"),
                          urgency: "中",
                        });
                      }
                    });
                    if (mapped.length > 0) setPendingAudits(mapped);
                  }
                });
              }}
              style={{ ...styles.btn, ...styles.btnOutline }}
            >
              <RefreshCw size={16} />
              {t("refresh")}
            </button>
            <button
              onClick={openCreateModal}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              <Plus size={16} />
              {t("insuranceAudit.newAuditRecord")}
            </button>
            {auditLoading && (
              <span style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={14} className="spin" /> {t("insuranceAudit.syncingPlatform")}
              </span>
            )}
          </div>

          {filteredPending.length === 0 ? (
            <div role="status" aria-live="polite" style={styles.emptyState}>
              <ClipboardList
                size={48}
                style={{ marginBottom: 12, opacity: 0.5 }}
                aria-hidden
              />
              <div>{t("noPending")}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary)" }}>
                {t("insuranceAudit.noData")}
              </div>
            </div>
          ) : (
            <>
              <div style={styles.cardList}>
                {paginatedPending.map((audit) => (
                  <PendingAuditCard
                    key={audit.id}
                    audit={audit}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onRequestInfo={handleRequestInfo}
                    onViewDetail={handleViewDetail}
                    t={t}
                  />
                ))}
              </div>
              {pendingTotalPages > 1 && (
                <div style={styles.pagination}>
                  <div style={styles.pageInfo}>
                    {t("insuranceAudit.showing")} {(pendingPage - 1) * pageSize + 1} -{" "}
                    {Math.min(pendingPage * pageSize, filteredPending.length)}{" "}
                    {t("insuranceAudit.itemsOf")} {filteredPending.length} {t("insuranceAudit.itemsPage")} {pendingPage}/
                    {pendingTotalPages} {t("insuranceAudit.pageUnit")}
                  </div>
                  <div style={styles.pageButtons}>
                    <button
                      style={styles.pageBtn}
                      disabled={pendingPage === 1}
                      aria-label={t("insuranceAudit.prevPage")}
                      onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from(
                      { length: Math.min(5, pendingTotalPages) },
                      (_, i) => {
                        let page = i + 1;
                        if (pendingTotalPages > 5) {
                          if (pendingPage > 3) page = pendingPage - 2 + i;
                          if (pendingPage > pendingTotalPages - 2)
                            page = pendingTotalPages - 4 + i;
                        }
                        if (page < 1 || page > pendingTotalPages) return null;
                        return (
                          <button
                            key={page}
                            aria-label={t('insuranceAudit.pageAria', { page })}
                            aria-current={
                              pendingPage === page ? "page" : undefined
                            }
                            style={{
                              ...styles.pageBtn,
                              ...(pendingPage === page
                                ? {
                                    background: "var(--color-primary)",
                                    color: "var(--text-inverse)",
                                    borderColor: "var(--color-primary)",
                                  }
                                : {}),
                            }}
                            onClick={() => setPendingPage(page)}
                          >
                            {page}
                          </button>
                        );
                      },
                    )}
                    <button
                      style={styles.pageBtn}
                      disabled={pendingPage === pendingTotalPages}
                      aria-label={t("insuranceAudit.nextPage")}
                      onClick={() =>
                        setPendingPage((p) =>
                          Math.min(pendingTotalPages, p + 1),
                        )
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 审核历史 */}
      {activeTab === "history" && (
        <>
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                style={styles.searchInput}
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              style={styles.select}
              value={filterResult}
              onChange={(v) => setFilterResult(v)}
              options={[
                { value: "全部", label: t("allResults") },
                { value: "通过", label: t("passed") },
                { value: "拒绝", label: t("rejected") },
                { value: "补充资料", label: t("supplement") },
              ]}
            />
            <button onClick={handleExportHistory} style={{ ...styles.btn, ...styles.btnOutline }}>
              <Filter size={16} />
              {t("export")}
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <DataTable
              dataSource={paginatedHistory}
              rowKey={(record) => String(record.id)}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: t("history.auditTime"), dataIndex: "auditTime", key: "auditTime" },
                { title: t("history.patientName"), dataIndex: "patientName", key: "patientName" },
                { title: t("history.patientId"), dataIndex: "patientId", key: "patientId" },
                { title: t("history.examItem"), dataIndex: "examItem", key: "examItem" },
                { title: t("history.drugName"), dataIndex: "drugName", key: "drugName" },
                { title: t("history.result"), key: "result", render: (_v, record) => <HistoryResultCell result={record.result} /> },
                { title: t("history.auditor"), dataIndex: "auditor", key: "auditor" },
                { title: t("history.notes"), key: "reason", render: (_v, record) => record.reason || "-" },
              ]}
            />

            <div style={styles.pagination}>
              <div style={styles.pageInfo}>
                {t("history.totalRecords", {
                  total: filteredHistory.length,
                  page: historyPage,
                  pages: totalPages,
                })}
              </div>
              <div style={styles.pageButtons}>
                <button
                  style={styles.pageBtn}
                  disabled={historyPage === 1}
                  aria-label={t("insuranceAudit.prevPage")}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page = i + 1;
                  if (totalPages > 5) {
                    if (historyPage > 3) page = historyPage - 2 + i;
                    if (historyPage > totalPages - 2) page = totalPages - 4 + i;
                  }
                  if (page < 1 || page > totalPages) return null;
                  return (
                    <button
                      key={page}
                      aria-label={appT("w9a.insuranceAudit.pageAria", { page })}
                      aria-current={historyPage === page ? "page" : undefined}
                      style={{
                        ...styles.pageBtn,
                        ...(historyPage === page
                          ? {
                              background: "var(--color-primary)",
                              color: "var(--text-inverse)",
                              borderColor: "var(--color-primary)",
                            }
                          : {}),
                      }}
                      onClick={() => setHistoryPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  style={styles.pageBtn}
                  disabled={historyPage === totalPages}
                  aria-label={t("insuranceAudit.nextPage")}
                  onClick={() =>
                    setHistoryPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 统计分析 */}
      {activeTab === "stats" && (
        <>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>{t("stats.monthlyTotal")}</div>
              <div style={styles.statValue}>326</div>
              <TrendingUp size={16} color="var(--color-success)" style={{ marginTop: 8 }} />
              <AppText size="xs" color="success" as="span" style={{ marginLeft: 4 }}>
                +12%
              </AppText>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>{t("insuranceAudit.statCtEnhance")}</div>
              <div style={styles.statValue}>158</div>
              <AppText size="xs" color="secondary" as="div" style={{ marginTop: 4 }}>
                {t("insuranceAudit.share485")}
              </AppText>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>{t("insuranceAudit.statMriEnhance")}</div>
              <div style={styles.statValue}>98</div>
              <AppText size="xs" color="secondary" as="div" style={{ marginTop: 4 }}>
                {t("insuranceAudit.share301")}
              </AppText>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>{t("insuranceAudit.statDsaAnticoag")}</div>
              <div style={styles.statValue}>70</div>
              <AppText size="xs" color="secondary" as="div" style={{ marginTop: 4 }}>
                {t("insuranceAudit.share215")}
              </AppText>
            </div>
          </div>

          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>
              <BarChart3
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              {t("insuranceAudit.resultDist")}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <AppText size="sm" color="secondary" as="div" style={{ marginBottom: 8 }}>
                  {t("insuranceAudit.passedRate")}
                </AppText>
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 8,
                    height: 24,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "var(--color-success)",
                      height: "100%",
                      width: "78.5%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "var(--text-inverse)", fontSize: 12, fontWeight: 600 }}
                    >
                      78.5%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <AppText size="sm" color="secondary" as="div" style={{ marginBottom: 8 }}>
                  {t("insuranceAudit.rejectedRate")}
                </AppText>
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 8,
                    height: 24,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "var(--color-error)",
                      height: "100%",
                      width: "12.3%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "var(--text-inverse)", fontSize: 12, fontWeight: 600 }}
                    >
                      12.3%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <AppText size="sm" color="secondary" as="div" style={{ marginBottom: 8 }}>
                  {t("insuranceAudit.supplementRate")}
                </AppText>
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 8,
                    height: 24,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "var(--color-warning)",
                      height: "100%",
                      width: "9.2%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "var(--text-inverse)", fontSize: 12, fontWeight: 600 }}
                    >
                      9.2%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>
              <Activity
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              {t("insuranceAudit.drugTop5")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "碘海醇注射液", count: 68, pct: 21 },
                { name: "钆双胺注射液", count: 52, pct: 16 },
                { name: "碘克沙醇注射液", count: 45, pct: 14 },
                { name: "普通肝素钠注射液", count: 38, pct: 12 },
                { name: "钆喷酸葡胺注射液", count: 31, pct: 10 },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <AppText size="sm" color="secondary" as="div" style={{ width: 24 }}>
                    {i + 1}
                  </AppText>
                  <AppText size="sm" color="secondary" as="div" style={{ flex: 1 }}>
                    {item.name}
                  </AppText>
                  <div
                    style={{
                      width: 100,
                      background: "var(--content-bg)",
                      borderRadius: 6,
                      height: 20,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--color-primary)",
                        height: "100%",
                        width: `${item.pct * 4}%`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 50,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      textAlign: "right",
                    }}
                  >
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 电子凭证管理 */}
      {activeTab === "voucher" && (
        <>
          {/* 蓝色渐变卡片头部 */}
          <div style={styles.voucherCard}>
            <div style={styles.voucherCardTitle}>{t("insuranceAudit.voucherTitle")}</div>
            <div style={styles.voucherCardSubtitle}>
              {t("insuranceAudit.voucherSubtitle")}
            </div>
            <div style={styles.voucherStatsRow}>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>{voucherStats.total}</div>
                <div style={styles.voucherStatLabel}>{t("insuranceAudit.voucherTotal")}</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.invoiced}
                </div>
                <div style={styles.voucherStatLabel}>{t("insuranceAudit.voucherIssued2")}</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.pending}
                </div>
                <div style={styles.voucherStatLabel}>{t("insuranceAudit.voucherPending2")}</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.cancelled}
                </div>
                <div style={styles.voucherStatLabel}>{t("insuranceAudit.voucherVoided")}</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  ¥{voucherStats.totalAmount.toLocaleString()}
                </div>
                <div style={styles.voucherStatLabel}>{t("insuranceAudit.voucherTotalAmount")}</div>
              </div>
            </div>
          </div>

          {/* 工具栏 */}
          <div style={styles.voucherToolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                style={styles.searchInput}
                placeholder={t("insuranceAudit.voucherSearchPlaceholder")}
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["全部", t("insuranceAudit.voucherIssued2"), t("insuranceAudit.voucherPending2"), t("insuranceAudit.voucherVoided")].map((status) => (
                <button
                  key={status}
                  style={{
                    ...styles.voucherFilterBtn,
                    ...(voucherFilterStatus === status
                      ? styles.voucherFilterActive
                      : styles.voucherFilterInactive),
                  }}
                  onClick={() => setVoucherFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* 电子凭证列表 */}
          <div style={styles.voucherTableWrapper}>
            <DataTable
              dataSource={filteredVouchers.slice(0, 50)}
              rowKey={(voucher) => String(voucher.id)}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: t("insuranceAudit.voucherId"), dataIndex: "id", key: "id" },
                { title: t("insuranceAudit.linkedAuditId"), dataIndex: "relatedAuditId", key: "relatedAuditId" },
                { title: t("insuranceAudit.patientName"), dataIndex: "patientName", key: "patientName" },
                { title: t("insuranceAudit.patientId"), dataIndex: "patientId", key: "patientId" },
                {
                  title: t("insuranceAudit.voucherType"), key: "voucherType",
                  render: (_v, voucher) => (
                    <StatusTag status={voucher.voucherType === "检查费" ? "info" : voucher.voucherType === "药品费" ? "success" : "warning"}>
                      {voucher.voucherType}
                    </StatusTag>
                  ),
                },
                { title: t("insuranceAudit.amount"), key: "amount", align: "right" as const, render: (_v, voucher) => `¥${voucher.amount.toFixed(2)}` },
                { title: t("insuranceAudit.issueTime"), dataIndex: "invoiceTime", key: "invoiceTime" },
                {
                  title: t("insuranceAudit.status"), key: "status",
                  render: (_v, voucher) => (
                    <StatusTag status={voucher.status === "已开票" ? "success" : voucher.status === "待开票" ? "pending" : "cancelled"}>
                      {voucher.status === "已开票" && <CheckCircle size={14} />}
                      {voucher.status === "待开票" && <Clock size={14} />}
                      {voucher.status === "已作废" && <XCircle size={14} />}
                      {voucher.status}
                    </StatusTag>
                  ),
                },
              ]}
            />
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "16px",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            {t("insuranceAudit.showing")} {Math.min(50, filteredVouchers.length)} /{" "}
            {filteredVouchers.length} {t("insuranceAudit.recordsUnit")}
          </div>
        </>
      )}

      {/* 837理赔 */}
      {activeTab === "claim837" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 10,
              padding: 16,
              border: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color={PRIMARY} />
              <span style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>
                {t("insuranceAudit.claimsTitle")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setClaimBatchMode(!claimBatchMode)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${claimBatchMode ? ACCENT : "var(--border-color)"}`,
                  background: claimBatchMode ? `${ACCENT}15` : 'var(--bg-card)',
                  color: claimBatchMode ? ACCENT : GRAY,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Upload size={14} />
                {claimBatchMode ? t("insuranceAudit.cancelBatch") : t("insuranceAudit.batchSubmit")}
              </button>
              <button
                onClick={() => {
                  setToastType("success");
                  setToastMessage(t("insuranceAudit.claimSubmitted2"));
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: ACCENT,
                  color: WHITE,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Send size={14} />
                {t("insuranceAudit.submitClaim")}
              </button>
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              {["全部", t("insuranceAudit.statusPendingSubmit"), t("insuranceAudit.statusSubmitted"), t("insuranceAudit.statusPaid"), t("insuranceAudit.statusDenied")].map((s) => (
                <button
                  key={s}
                  onClick={() => setClaimStatusFilter(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    border: `1px solid ${claimStatusFilter === s ? ACCENT : "var(--border-color)"}`,
                    background: claimStatusFilter === s ? ACCENT : 'var(--bg-card)',
                    color: claimStatusFilter === s ? WHITE : GRAY,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <DataTable
              dataSource={claim837Data.filter(
                (c) =>
                  claimStatusFilter === "全部" ||
                  c.status === claimStatusFilter,
              )}
              rowKey={(c) => String(c.id)}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: t("insuranceAudit.claimId"), key: "id", render: (_v, c) => <span style={{ color: GRAY }}>{c.id}</span> },
                { title: t("insuranceAudit.patient"), key: "patientName", render: (_v, c) => <span style={{ fontWeight: 700, color: PRIMARY }}>{c.patientName}</span> },
                { title: t("insuranceAudit.examItem2"), key: "examItem", render: (_v, c) => <span style={{ fontSize: 12 }}>{c.examItem}</span> },
                { title: "ICD-10", key: "icd10", render: (_v, c) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.icd10}</span> },
                { title: "CPT", key: "cpt", render: (_v, c) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.cpt}</span> },
                { title: t("insuranceAudit.amount"), key: "amount", align: "right" as const, render: (_v, c) => <span style={{ fontWeight: 700, color: PRIMARY }}>¥{c.amount}</span> },
                { title: t("insuranceAudit.insurer2"), key: "carrier", render: (_v, c) => <span style={{ fontSize: 12, color: GRAY }}>{c.carrier}</span> },
                { title: t("insuranceAudit.submitDate"), key: "submitDate", render: (_v, c) => c.submitDate || "-" },
                {
                  title: t("insuranceAudit.status"), key: "status",
                  render: (_v, c) => (
                    <StatusTag status={c.status === "已支付" ? "paid" : c.status === "待提交" ? "pending" : c.status === "被拒" ? "rejected" : "info"}>
                      {c.status}
                    </StatusTag>
                  ),
                },
              ]}
            />
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 20,
              border: "1px solid var(--border-color)",
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: PRIMARY,
                margin: "0 0 12px",
              }}
            >
              {t("insuranceAudit.codeMappingTitle")}
            </h3>
            <DataTable
              dataSource={icdCptMapping}
              rowKey={(m) => m.icd10}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: "ICD-10", key: "icd10", render: (_v, m) => <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{m.icd10}</span> },
                { title: t("insuranceAudit.description"), key: "description", render: (_v, m) => <span style={{ fontSize: 12 }}>{m.description}</span> },
                { title: "CPT", key: "cpt", render: (_v, m) => <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{m.cpt}</span> },
                { title: t("insuranceAudit.applicableExam"), key: "exam", render: (_v, m) => <span style={{ fontSize: 12 }}>{m.exam}</span> },
              ]}
            />
          </div>
        </div>
      )}

      {/* 拒赔管理 */}
      {activeTab === "denial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: t("insuranceAudit.denialTotal"),
                value: denialData.length,
                icon: <XCircle size={18} />,
                color: DANGER,
                bg: "var(--color-error-bg)",
              },
              {
                label: t("insuranceAudit.statusPendingAppeal"),
                value: denialData.filter((d) => d.appealStatus === "待申诉")
                  .length,
                icon: <AlertTriangle size={18} />,
                color: WARNING,
                bg: "var(--color-warning-bg)",
              },
              {
                label: t("insuranceAudit.statusAppealing"),
                value: denialData.filter((d) => d.appealStatus === "申诉中")
                  .length,
                icon: <Loader2 size={18} />,
                color: ACCENT,
                bg: "var(--color-primary)22",
              },
              {
                label: t("insuranceAudit.statusApproved"),
                value: denialData.filter((d) => d.appealStatus === "已通过")
                  .length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "var(--color-success-bg)",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: card.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div
                    style={{ fontSize: 30, fontWeight: 700, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 12,
                border: "1px solid var(--border-color)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  gap: 6,
                }}
              >
                {["全部", t("insuranceAudit.statusPendingAppeal"), t("insuranceAudit.statusAppealing"), t("insuranceAudit.statusApproved"), t("insuranceAudit.statusRejected")].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDenialAppealFilter(s)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: `1px solid ${denialAppealFilter === s ? ACCENT : "var(--border-color)"}`,
                      background: denialAppealFilter === s ? ACCENT : 'var(--bg-card)',
                      color: denialAppealFilter === s ? WHITE : GRAY,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <DataTable
                dataSource={denialData.filter(
                  (d) =>
                    denialAppealFilter === "全部" ||
                    d.appealStatus === denialAppealFilter,
                )}
                rowKey={(d) => String(d.id)}
                pagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t("insuranceAudit.patient"), key: "patientName", render: (_v, d) => <span style={{ fontWeight: 600, color: PRIMARY }}>{d.patientName}</span> },
                  { title: t("insuranceAudit.exam"), key: "examItem", render: (_v, d) => <span style={{ fontSize: 12 }}>{d.examItem}</span> },
                  { title: t("insuranceAudit.denialReason"), key: "denialReason", render: (_v, d) => <span style={{ fontSize: 12 }}>{denialReasonLabels[d.denialReason] || d.denialReason}</span> },
                  { title: t("insuranceAudit.reasonNote"), key: "description", render: (_v, d) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.description}</span> },
                  { title: t("insuranceAudit.amount"), key: "amount", align: "right" as const, render: (_v, d) => <span style={{ fontWeight: 700 }}>¥{d.amount}</span> },
                  {
                    title: t("insuranceAudit.appealStatus"), key: "appealStatus",
                    render: (_v, d) => (
                      <>
                        <StatusTag status={d.appealStatus === "已通过" ? "approved" : d.appealStatus === "申诉中" ? "info" : d.appealStatus === "已拒绝" ? "rejected" : "pending"}>
                          {d.appealStatus === "待申诉"
                            ? t("insuranceAudit.statusPendingAppeal")
                            : d.appealStatus === "申诉中"
                              ? t("insuranceAudit.statusAppealing")
                              : d.appealStatus === "已通过"
                                ? t("insuranceAudit.statusApproved")
                                : t("insuranceAudit.statusRejected")}
                        </StatusTag>
                        {d.appealStatus === "待申诉" && (
                          <button
                            onClick={() => {
                              setToastType("success");
                              setToastMessage(t("insuranceAudit.appealLetterGenerated"));
                            }}
                            style={{
                              marginLeft: 6,
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--border-color)",
                              background: 'var(--bg-card)',
                              color: ACCENT,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {t("insuranceAudit.appeal")}
                          </button>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            </div>
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 12,
                padding: 16,
                border: "1px solid var(--border-color)",
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: PRIMARY,
                  margin: "0 0 12px",
                }}
              >
                {t("insuranceAudit.denialRateTrend")}
              </h3>
              <ChartContainer height={180} state={denialRateTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={t("insuranceAudit.noDenialTrendData")}>
                <AreaChart data={denialRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} interval={autoInterval(denialRateTrend.length)} tickFormatter={(v: string) => (v && v.length > 6 ? `${v.slice(0, 6)}…` : v)} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={DANGER}
                    fill="#fee2e2"
                    strokeWidth={2}
                    name={t("insuranceAudit.chartDenialRate")}
                  />
                </AreaChart>
              </ChartContainer>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {Object.entries(denialReasonLabels).map(([key, label]) => {
                  const count = denialData.filter(
                    (d) => d.denialReason === key,
                  ).length;
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        background: "var(--content-bg)",
                        borderRadius: 4,
                      }}
                    >
                      <AppText size="xs" color="secondary" as="span">{label}</AppText>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: PRIMARY,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预授权 */}
      {activeTab === "preAuth" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: t("insuranceAudit.preauthTotal"),
                value: preAuthData.length,
                icon: <ClipboardList size={18} />,
                color: ACCENT,
                bg: "var(--color-primary)22",
              },
              {
                label: t("insuranceAudit.preauthPending"),
                value: preAuthData.filter((p) => p.status === "pending").length,
                icon: <Clock size={18} />,
                color: WARNING,
                bg: "var(--color-warning-bg)",
              },
              {
                label: t("insuranceAudit.preauthApproved"),
                value: preAuthData.filter((p) => p.status === "approved")
                  .length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "var(--color-success-bg)",
              },
              {
                label: t("insuranceAudit.statusRejected"),
                value: preAuthData.filter((p) => p.status === "denied").length,
                icon: <XCircle size={18} />,
                color: DANGER,
                bg: "var(--color-error-bg)",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: card.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div
                    style={{ fontSize: 30, fontWeight: 700, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 10,
              padding: 12,
              border: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {["全部", "pending", "approved", "denied"].map((s) => (
                <button
                  key={s}
                  onClick={() => setPreAuthFilter(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    border: `1px solid ${preAuthFilter === s ? ACCENT : "var(--border-color)"}`,
                    background: preAuthFilter === s ? ACCENT : 'var(--bg-card)',
                    color: preAuthFilter === s ? WHITE : GRAY,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s === "pending"
                    ? t("insuranceAudit.preauthPending")
                    : s === "approved"
                      ? t("insuranceAudit.preauthApproved")
                      : s === "denied"
                        ? t("insuranceAudit.statusRejected")
                        : "全部"}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setToastType("success");
                setToastMessage(t("insuranceAudit.preauthCreated"));
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: ACCENT,
                color: WHITE,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={14} />
              {t("insuranceAudit.newPreauth")}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {preAuthData
              .filter(
                (p) => preAuthFilter === "全部" || p.status === preAuthFilter,
              )
              .map((p) => {
                const statusColor =
                  p.status === "approved"
                    ? SUCCESS
                    : p.status === "denied"
                      ? DANGER
                      : WARNING;
                const statusToneKey =
                  p.status === "approved" ? "approved" : p.status === "denied" ? "rejected" : "pending";
                const statusLabel =
                  p.status === "pending"
                    ? t("insuranceAudit.preauthPending")
                    : p.status === "approved"
                      ? t("insuranceAudit.preauthApproved")
                      : t("insuranceAudit.statusRejected");
                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 10,
                      padding: 16,
                      border: `1px solid ${statusColor}30`,
                      borderLeft: `4px solid ${statusColor}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: PRIMARY }}>
                          {p.patientName}
                        </span>
                        <AppText size="xs" color="secondary" as="span">
                          {p.patientId}
                        </AppText>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <StatusTag status={statusToneKey} size="md">{statusLabel}</StatusTag>
                        {p.status === "pending" && (
                          <>
                            <PermissionGate permission="audit.approve">
                              <button
                                type="button"
                                onClick={() => {
                                  setToastType("success");
                                  setToastMessage(t("insuranceAudit.preauthApprovedMsg"));
                                }}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: SUCCESS,
                                  color: WHITE,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                {t("insuranceAudit.approve")}
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="audit.approve">
                              <button
                                type="button"
                                onClick={() => {
                                  setToastType("error");
                                  setToastMessage(t("insuranceAudit.preauthRejectedMsg"));
                                }}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: DANGER,
                                  color: WHITE,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  marginLeft: 4,
                                }}
                              >
                                {t("insuranceAudit.reject")}
                              </button>
                            </PermissionGate>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <AppText size="xs" color="secondary" as="div">
                        {t("insuranceAudit.examLabel")}{" "}
                        <span style={{ color: "var(--text-secondary)" }}>{p.examItem}</span>
                      </AppText>
                      <AppText size="xs" color="secondary" as="div">
                        {t("insuranceAudit.requestDateLabel")}{" "}
                        <span style={{ color: "var(--text-secondary)" }}>
                          {p.requestedDate}
                        </span>
                      </AppText>
                    </div>
                    <div>
                      <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 6 }}>
                        {t("insuranceAudit.requiredMaterials")}{p.docsCompleted}/{p.docs.length})
                      </AppText>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {p.docs.map((doc, i) => (
                          <span
                            key={doc}
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              background:
                                i < p.docsCompleted ? "var(--color-success-bg)" : "var(--content-bg)",
                              color: i < p.docsCompleted ? SUCCESS : GRAY,
                            }}
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                    {p.expiryDate && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color:
                            new Date(p.expiryDate) < new Date()
                              ? DANGER
                              : WARNING,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={11} />
                        {t("insuranceAudit.expiryLabel")} {p.expiryDate}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* DRG校验 */}
      {activeTab === "drg" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: t("insuranceAudit.drgTotal"),
                value: drgData.length,
                icon: <BarChart3 size={18} />,
                color: ACCENT,
                bg: "var(--color-primary)22",
              },
              {
                label: t("insuranceAudit.drgValid"),
                value: drgData.filter((d) => d.validationScore >= 80).length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "var(--color-success-bg)",
              },
              {
                label: t("insuranceAudit.drgAbnormal"),
                value: drgData.filter((d) => d.outlier).length,
                icon: <AlertTriangle size={18} />,
                color: WARNING,
                bg: "var(--color-warning-bg)",
              },
              {
                label: t("insuranceAudit.drgAvgScore"),
                value: Math.round(
                  drgData.reduce((s, d) => s + d.validationScore, 0) /
                    drgData.length,
                ),
                icon: <Target size={18} />,
                color: "var(--color-modality-mr)",
                bg: "var(--color-modality-mr)22",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: card.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div
                    style={{ fontSize: 30, fontWeight: 700, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <AppText size="xs" color="secondary">{card.label}</AppText>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              overflow: "hidden",
            }}
          >
            <DataTable
              dataSource={drgData}
              rowKey={(d) => String(d.id)}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: t("insuranceAudit.patient"), key: "patientName", render: (_v, d) => <span style={{ fontWeight: 600, color: PRIMARY }}>{d.patientName}</span> },
                { title: t("insuranceAudit.drgIcdCode"), key: "icdCodes", render: (_v, d) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{d.icdCodes}</span> },
                {
                  title: t("insuranceAudit.drgGroup"), key: "drgCode",
                  render: (_v, d) => (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{d.drgCode}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>{d.drgName}</div>
                    </div>
                  ),
                },
                { title: t("insuranceAudit.drgExpectedCost"), key: "expectedCost", align: "right" as const, render: (_v, d) => `¥${d.expectedCost.toLocaleString()}` },
                { title: t("insuranceAudit.drgActualCost"), key: "actualCost", align: "right" as const, render: (_v, d) => `¥${d.actualCost.toLocaleString()}` },
                {
                  title: t("insuranceAudit.drgCostDeviation"), key: "costDiff", align: "right" as const,
                  render: (_v, d) => {
                    const costDiff = (((d.actualCost - d.expectedCost) / d.expectedCost) * 100).toFixed(1);
                    const diffColor = parseFloat(costDiff) > 10 ? DANGER : parseFloat(costDiff) < -10 ? SUCCESS : GRAY;
                    return <span style={{ fontWeight: 700, color: diffColor }}>{costDiff}%</span>;
                  },
                },
                {
                  title: t("insuranceAudit.abnormal"), key: "outlier",
                  render: (_v, d) => d.outlier ? <AlertTriangle size={14} color={WARNING} /> : <CheckCircle size={14} color={SUCCESS} />,
                },
                {
                  title: t("insuranceAudit.validationScore"), key: "validationScore",
                  render: (_v, d) => (
                    <StatusTag status={d.validationScore >= 80 ? 'success' : 'warning'}>{d.validationScore}</StatusTag>
                  ),
                },
              ]}
            />
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 20,
              border: "1px solid var(--border-color)",
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: PRIMARY,
                margin: "0 0 12px",
              }}
            >
              {t("insuranceAudit.drgGroupMapping")}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              {drgMapping.map((m) => (
                <div
                  key={m.drg}
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 8,
                    padding: 12,
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{ fontSize: 16, fontWeight: 800, color: PRIMARY }}
                  >
                    {m.drg}
                  </div>
                  <AppText size="xs" color="secondary" as="div">
                    ICD: {m.icdStart}-{m.icdEnd}
                  </AppText>
                  <AppText size="xs" color="secondary" as="div" style={{ marginTop: 4 }}>
                    {m.category}
                  </AppText>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 规则管理 */}
      {activeTab === "rules" && (
        <>
          <div style={styles.toolbar}>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  margin: "0 0 12px 0",
                }}
              >
                <BookOpen
                  size={18}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                {t("insuranceAudit.indicationRules")}
              </h3>
            </div>
            <button
              onClick={async (evt) => {
                const btn = (evt?.target ||
                  evt?.currentTarget) as HTMLButtonElement;
                const orig = btn.innerHTML;
                btn.innerHTML = t("insuranceAudit.adding");
                btn.disabled = true;
                await new Promise((r) => setTimeout(r, 1500));
                const rules = (() => {
                  try {
                    return JSON.parse(
                      localStorage.getItem("g005_insurance_rules") || "[]",
                    )
                  } catch { return [] }
                })();
                rules.push({
                  id: Date.now(),
                  examType: "CT",
                  examName: t("insuranceAudit.newRule"),
                  drugName: t("insuranceAudit.drugIodineContrast"),
                  drugCategory: "CT对比剂",
                  restriction: t("insuranceAudit.ruleAdded"),
                  applicableExams: t("insuranceAudit.examCt"),
                  notes: "",
                });
                localStorage.setItem(
                  "g005_insurance_rules",
                  JSON.stringify(rules),
                );
                btn.innerHTML = t("insuranceAudit.added");
                setTimeout(() => {
                  btn.innerHTML = orig;
                  btn.disabled = false;
                }, 2000);
              }}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              <Settings size={16} />
              {t("insuranceAudit.addRule")}
            </button>
          </div>

          {indicationRulesState.map((rule) => (
            <div key={rule.id} style={styles.ruleCard}>
              <div style={styles.ruleHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary-800)" }}
                  >
                    {rule.examName}
                  </span>
                  <span
                    style={{
                      ...styles.cardCategory,
                      background: "var(--color-info-bg)",
                      color: "var(--color-primary)",
                    }}
                  >
                    {rule.drugCategory}
                  </span>
                </div>
                <div style={styles.btnGroup}>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(`/api/rules/${rule.id}/detail`, "_blank")
                    }
                    style={{ ...styles.btn, ...styles.btnOutline }}
                  >
                    <FileText size={14} />
                  </button>
                  <PermissionGate permission="audit.approve">
                    <button
                      type="button"
                      onClick={() => setRuleToDelete(rule)}
                      style={{ ...styles.btn, ...styles.btnOutline }}
                      title={t("insuranceAudit.deleteRule")}
                      aria-label={t("insuranceAudit.deleteRule")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </PermissionGate>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                <Pill size={14} style={{ marginRight: 6 }} />
                <strong>{t("insuranceAudit.drugLabel")}</strong> {rule.drugName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  padding: "8px 12px",
                  background: "var(--color-warning-bg)",
                  borderRadius: 6,
                  color: "var(--color-warning)",
                  marginBottom: 8,
                }}
              >
                <ShieldCheck size={14} style={{ marginRight: 6 }} />
                {rule.insuranceRequirement}
              </div>
              <AppText size="xs" color="secondary" as="div">
                {rule.description}
              </AppText>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-primary-800)",
                marginBottom: 12,
              }}
            >
              <Filter
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              {t("insuranceAudit.restrictedDrugLibrary")}
            </h3>
            <div style={styles.tableWrapper}>
              <DataTable
                dataSource={restrictedDrugs}
                rowKey={(drug) => String(drug.id)}
                pagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t("insuranceAudit.drugName"), key: "name", render: (_v, drug) => <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{drug.name}</span> },
                  {
                    title: t("insuranceAudit.category"), key: "category",
                    render: (_v, drug) => (
                      <StatusTag status="info" bordered={false}>
                        {drug.category}
                      </StatusTag>
                    ),
                  },
                  { title: t("insuranceAudit.insuranceRestriction"), key: "restriction", render: (_v, drug) => <span style={{ color: "var(--color-error)", fontSize: 12 }}>{drug.restriction}</span> },
                  { title: t("insuranceAudit.applicableExam"), key: "applicableExams", render: (_v, drug) => <span style={{ fontSize: 12 }}>{drug.applicableExams}</span> },
                  { title: t("insuranceAudit.cautions"), key: "notes", render: (_v, drug) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{drug.notes}</span> },
                ]}
              />
            </div>
          </div>
        </>
      )}
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            ...styles.toast,
            ...(toastType === "success"
              ? styles.toastSuccess
              : toastType === "error"
                ? styles.toastError
                : styles.toastInfo),
          }}
        >
          {toastType === "success" && <CheckCircle size={18} />}
          {toastType === "error" && <XCircle size={18} />}
          {toastType === "info" && <AlertTriangle size={18} />}
          {toastMessage}
        </div>
      )}

      {/* [W2-B] 保险审计详情 Modal (getInsuranceAudit) */}
      {showAuditDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("insuranceAudit.auditDetailTitle")}
          style={styles.modalOverlay}
          onClick={() => setShowAuditDetail(false)}
        >
          <div style={{ ...styles.modal, width: 560, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              <FileText size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              {t("insuranceAudit.auditDetailTitle")}
            </div>
            {auditDetailLoading ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
                {t("insuranceAudit.detailLoading")}
              </div>
            ) : auditDetail ? (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px 16px",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.auditNoLabel")}</span>
                    <b>{auditDetail.id ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.patientLabel")}</span>
                    <b>{auditDetail.patientName ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.patientIdLabel")}</span>
                    <b>{auditDetail.patientId ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.examTypeLabel")}</span>
                    <b>{auditDetail.examType ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.drugLabel2")}</span>
                    <b>{auditDetail.drugName ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.drugCategoryLabel")}</span>
                    <b>{auditDetail.drugCategory ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.submitTimeLabel")}</span>
                    <b>{auditDetail.submitTime || "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.statusLabel")}</span>
                    <span
                      style={{
                        ...styles.badge,
                        background: (auditDetail.status || "").startsWith("REJ") || (auditDetail.status || "").toLowerCase() === "rejected"
                          ? "var(--color-error-bg)"
                          : (auditDetail.status || "").startsWith("APP") || (auditDetail.status || "").toLowerCase() === "approved"
                            ? "var(--color-success-bg)"
                            : "var(--color-warning-bg)",
                        color: (auditDetail.status || "").startsWith("REJ") || (auditDetail.status || "").toLowerCase() === "rejected"
                          ? "var(--color-error)"
                          : (auditDetail.status || "").startsWith("APP") || (auditDetail.status || "").toLowerCase() === "approved"
                            ? "var(--color-success)"
                            : "var(--color-warning)",
                      }}
                    >
                      {auditDetail.status ?? "-"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.auditorLabel")}</span>
                    <b>{auditDetail.auditor || "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>{t("insuranceAudit.auditTimeLabel")}</span>
                    <b>{auditDetail.auditTime || "-"}</b>
                  </div>
                </div>
                {(auditDetail.reason || auditDetail.result) && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: "var(--bg-card)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      {t("insuranceAudit.auditResultLabel")}{auditDetail.result || "-"}
                    </div>
                    <div style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                      {t("insuranceAudit.reasonLabel")}{auditDetail.reason || "-"}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
                {t("insuranceAudit.recordNotFound")}
              </div>
            )}
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => setShowAuditDetail(false)}
              >
                {t("insuranceAudit.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝确认 Modal */}
      {showRejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("confirmRejectTitle")}
          style={styles.modalOverlay}
          onClick={() => setShowRejectModal(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{t("confirmRejectTitle")}</div>
            <div style={styles.modalText}>{t("confirmRejectText")}</div>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder={t("insuranceAudit.rejectReasonRequired")}
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-color)",
                fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12, resize: "vertical",
              }}
            />
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnOutline }}
                onClick={() => setShowRejectModal(false)}
              >
                {t("cancel")}
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnDanger }}
                onClick={confirmReject}
              >
                {t("confirmReject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 补充资料 Modal */}
      {showRequestInfoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("confirmRequestTitle")}
          style={styles.modalOverlay}
          onClick={() => setShowRequestInfoModal(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{t("confirmRequestTitle")}</div>
            <div style={styles.modalText}>{t("confirmRequestText")}</div>
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnOutline }}
                onClick={() => setShowRequestInfoModal(false)}
              >
                {t("cancel")}
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={confirmRequestInfo}
              >
                {t("confirmSend")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 规则删除确认 */}
      <ConfirmDialog
        open={!!ruleToDelete}
        title={t("insuranceAudit.deleteRuleConfirm")}
        message={t("insuranceAudit.ruleDeletedConfirm", { name: ruleToDelete?.examName })}
        confirmText={t("insuranceAudit.delete")}
        variant="danger"
        onCancel={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            setIndicationRules((prev) =>
              prev.filter((r) => r.id !== ruleToDelete.id),
            );
            setToastType("success");
            setToastMessage(t("insuranceAudit.ruleDeleted", { name: ruleToDelete.examName }));
            setRuleToDelete(null);
          }
        }}
      />

      {/* [Wave 4A] 新建医保审核记录 Modal (insuranceApi.create) */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("insuranceAudit.newRecordTitle")}
          style={styles.modalOverlay}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div style={{ ...styles.modal, width: 520, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              <Plus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              {t("insuranceAudit.newRecordTitle")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 12 }}>
              <div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.patientIdRequired")}</div>
                <input
                  style={styles.input}
                  placeholder={t("insuranceAudit.patientIdPlaceholder")}
                  value={createForm.patientId}
                  onChange={(e) => setCreateForm({ ...createForm, patientId: e.target.value })}
                />
              </div>
              <div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.patientNameRequired")}</div>
                <input
                  style={styles.input}
                  placeholder={t("insuranceAudit.patientName")}
                  value={createForm.patientName}
                  onChange={(e) => setCreateForm({ ...createForm, patientName: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.examItem2")}</div>
                <input
                  style={styles.input}
                  placeholder={t("insuranceAudit.examItemPlaceholder")}
                  value={createForm.examItem}
                  onChange={(e) => setCreateForm({ ...createForm, examItem: e.target.value })}
                />
              </div>
              <div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.contrast2")}</div>
                <input
                  style={styles.input}
                  placeholder={t("insuranceAudit.contrastPlaceholder")}
                  value={createForm.contrastAgent}
                  onChange={(e) => setCreateForm({ ...createForm, contrastAgent: e.target.value })}
                />
              </div>
              <div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.anticoagulant")}</div>
                <input
                  style={styles.input}
                  placeholder={t("insuranceAudit.anticoagulantPlaceholder")}
                  value={createForm.anticoagulant}
                  onChange={(e) => setCreateForm({ ...createForm, anticoagulant: e.target.value })}
                />
              </div>
              <div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.amountYuan")}</div>
                <input
                  style={styles.input}
                  type="number"
                  placeholder="0"
                  value={createForm.amount || ""}
                  onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) || 0 })}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{t("insuranceAudit.applyReason")}</div>
                <textarea
                  rows={2}
                  style={{ ...styles.input, resize: "vertical" }}
                  placeholder={t("insuranceAudit.applyReasonPlaceholder")}
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                />
              </div>
            </div>
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnOutline }}
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {t("cancel")}
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => void handleCreateAudit()}
                disabled={creating}
              >
                {creating ? t("insuranceAudit.submitting") : t("insuranceAudit.submitAudit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
