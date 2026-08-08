// ============================================================
// G005 放射科RIS系统 - 医保审核页面
// CT对比剂 / MRI对比剂 / DSA抗凝药物 医保限制审核
// ============================================================
import { useTranslation } from "react-i18next";
import { useState, useMemo, useEffect } from "react";
import { datareportApi, type InsuranceAuditDto as DataReportAuditDto } from "../services/api/datareportApi";
import { insuranceApi } from "../services/api/insuranceApi";
import { PermissionGate } from "../components/common/PermissionGate";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { VOUCHER_DATA } from '../data/initialData';
import { ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, FileText, Pill, Stethoscope, Calendar, MessageSquare, Check, X, Send, BookOpen, ClipboardList, Activity, AlertOctagon, BarChart3, Settings, TrendingUp, Clock3, DollarSign, PieChart as PieChartIcon, AlertCircle, Percent, Upload, Loader2, Plus, ClipboardCheck, Target, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "脑血管DSA",
    drugName: "比伐卢定注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "心脏DSA",
    drugName: "肝素钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "肾动脉DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "外周血管DSA",
    drugName: "阿加曲班注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "脑血管DSA",
    drugName: "利伐沙班片",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "心脏DSA",
    drugName: "比伐卢定注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "肾动脉DSA",
    drugName: "肝素钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "外周血管DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "脑血管DSA",
    drugName: "阿加曲班注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "心脏DSA",
    drugName: "利伐沙班片",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "肾动脉DSA",
    drugName: "比伐卢定注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "外周血管DSA",
    drugName: "肝素钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "脑血管DSA",
    drugName: "磺达肝癸钠注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "心脏DSA",
    drugName: "阿加曲班注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "肾动脉DSA",
    drugName: "利伐沙班片",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "DSA手术",
    examItem: "外周血管DSA",
    drugName: "比伐卢定注射液",
    drugCategory: "抗凝药物",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "李审核",
    auditTime: "2026-05-01 09:30",
    reason: "凝血功能异常，ACT目标值设定过高",
  },
  {
    id: 4,
    patientName: "赵六",
    patientId: "P30004",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-05-01 10:30",
    reason: "脑梗死发病超过24小时，不在医保适应证时间窗内",
  },
  {
    id: 8,
    patientName: "吴十",
    patientId: "P30008",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 11:15",
  },
  {
    id: 11,
    patientName: "陈三",
    patientId: "P30011",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 12:15",
  },
  {
    id: 15,
    patientName: "沈七",
    patientId: "P30015",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-05-01 14:30",
    reason: "既往有肝素诱导血小板减少症(HIT)病史",
  },
  {
    id: 19,
    patientName: "秦一",
    patientId: "P30019",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-05-01 15:30",
    reason: "不在医保限定的时间窗内(发病6小时内)",
  },
  {
    id: 23,
    patientName: "吕五",
    patientId: "P30023",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-05-01 16:15",
  },
  {
    id: 26,
    patientName: "孔八",
    patientId: "P30026",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-05-01 17:15",
  },
  {
    id: 30,
    patientName: "金二",
    patientId: "P30030",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-30 09:30",
    reason: "术前凝血功能严重异常",
  },
  {
    id: 34,
    patientName: "戚六",
    patientId: "P30034",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-04-30 10:30",
    reason: "医保适应证仅限急性缺血性脑卒中",
  },
  {
    id: 38,
    patientName: "水十",
    patientId: "P30038",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 11:15",
  },
  {
    id: 41,
    patientName: "石三",
    patientId: "P30041",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-30 14:00",
  },
  {
    id: 45,
    patientName: "柳七",
    patientId: "P30045",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-30 15:00",
    reason: "患者有活动性出血病史",
  },
  {
    id: 49,
    patientName: "梅五",
    patientId: "P30049",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 16:00",
  },
  {
    id: 53,
    patientName: "伍八",
    patientId: "P30053",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-30 16:45",
  },
  {
    id: 56,
    patientName: "卜一",
    patientId: "P30056",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 09:15",
  },
  {
    id: 60,
    patientName: "黄五",
    patientId: "P30060",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-29 10:15",
  },
  {
    id: 64,
    patientName: "邵九",
    patientId: "P30064",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 11:15",
  },
  {
    id: 68,
    patientName: "米三",
    patientId: "P30068",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 12:00",
  },
  {
    id: 71,
    patientName: "臧六",
    patientId: "P30071",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "李审核",
    auditTime: "2026-04-29 14:45",
  },
  {
    id: 75,
    patientName: "戴十",
    patientId: "P30075",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "王审核",
    auditTime: "2026-04-29 15:45",
    reason: "INR值超过2.5",
  },
  {
    id: 79,
    patientName: "庞四",
    patientId: "P30079",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "拒绝",
    auditor: "张审核",
    auditTime: "2026-04-29 16:45",
    reason: "颅内出血急性期",
  },
  {
    id: 83,
    patientName: "屈八",
    patientId: "P30083",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-29 17:30",
  },
  {
    id: 86,
    patientName: "董一",
    patientId: "P30086",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "补充资料",
    auditor: "李审核",
    auditTime: "2026-04-28 09:45",
    reason: "需提供凝血功能详细报告",
  },
  {
    id: 90,
    patientName: "马五",
    patientId: "P30090",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "王审核",
    auditTime: "2026-04-28 10:45",
  },
  {
    id: 94,
    patientName: "方九",
    patientId: "P30094",
    examType: "CT增强",
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
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
    result: "通过",
    auditor: "张审核",
    auditTime: "2026-04-28 11:45",
  },
  {
    id: 98,
    patientName: "柳三",
    patientId: "P30098",
    examType: "MRI增强",
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
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
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
    category: "抗凝药物",
    restriction:
      "限介入手术抗凝，禁用于有出血倾向、肝素诱导血小板减少症(HIT)患者",
    applicableExams: "DSA/血管介入/肿瘤栓塞/取栓术",
    notes: "需监测ACT，目标值250-300秒",
  },
  {
    id: 10,
    name: "低分子肝素钠注射液",
    category: "抗凝药物",
    restriction: "限介入手术抗凝及术后预防性抗凝，限二级以上医疗机构",
    applicableExams: "外周血管介入/支架术后/深静脉血栓预防",
    notes: "皮下注射，无需监测ACT，使用方便",
  },
  {
    id: 11,
    name: "阿加曲班注射液",
    category: "抗凝药物",
    restriction: "限急性缺血性脑卒中抗凝，发病48小时内使用，医保适应证严格限定",
    applicableExams: "急性脑梗死取栓术/动脉内溶栓",
    notes: "直接凝血酶抑制剂，需监测APTT",
  },
  {
    id: 12,
    name: "磺达肝癸钠注射液",
    category: "抗凝药物",
    restriction: "限DSA手术抗凝，限二级以上医疗机构使用",
    applicableExams: "DSA/血管介入手术",
    notes: "选择性Xa因子抑制剂，肾脏清除",
  },
  {
    id: 13,
    name: "比伐卢定注射液",
    category: "抗凝药物",
    restriction: "限PCI术中抗凝，限二级以上医疗机构使用",
    applicableExams: "冠脉介入/PCI术/急性心梗介入治疗",
    notes: "直接凝血酶抑制剂，作用可逆",
  },
  {
    id: 14,
    name: "利伐沙班片",
    category: "抗凝药物",
    restriction: "限深静脉血栓(DVT)和肺栓塞(PE)治疗及预防复发",
    applicableExams: "骨科DVT预防/血管外科术后抗凝",
    notes: "口服Xa因子抑制剂，胃肠道吸收好",
  },
];

// 适应证规则
const indicationRules: IndicationRule[] = [
  {
    id: 1,
    examType: "CT增强",
    examName: "CT肺动脉造影(CTPA)",
    drugName: "碘普罗胺注射液",
    drugCategory: "CT对比剂",
    insuranceRequirement:
      "限二级以上医疗机构，限CT增强扫描；肺栓塞疑似患者可使用，需提供D-二聚体或Wells评分支持",
    description: "CTPA用于肺栓塞诊断，需评估对比剂肾病风险及碘过敏史",
  },
  {
    id: 2,
    examType: "MRI增强",
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
    drugCategory: "抗凝药物",
    insuranceRequirement:
      "限急性缺血性脑卒中(发病48小时内)使用；医保严格限定适应证，需神经科会诊记录",
    description: "阿加曲班用于急性脑梗死动脉内介入治疗后的抗凝，需监测APTT",
  },
  {
    id: 4,
    examType: "MRI增强",
    examName: "肝脏MRI动态增强",
    drugName: "钆塞酸二钠注射液",
    drugCategory: "MRI对比剂",
    insuranceRequirement:
      "限肝脏MRI平扫+增强扫描；肝功能Child-Pugh C级禁用；用于肝硬化结节定性及HCC筛查",
    description: "钆塞酸二钠为肝胆特异性对比剂，用于肝脏局灶性病变的鉴别诊断",
  },
  {
    id: 5,
    examType: "CT增强",
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
    drugCategory: "抗凝药物",
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
  { name: "心内科", value: 20, amount: 98.4, color: "#ef4444" },
  { name: "神经内科", value: 18, amount: 88.5, color: "#f97316" },
  { name: "呼吸内科", value: 15, amount: 73.8, color: "#eab308" },
  { name: "消化内科", value: 12, amount: 59.0, color: "#22c55e" },
  { name: "肿瘤科", value: 10, amount: 49.2, color: "#3b82f6" },
  { name: "血管外科", value: 8, amount: 39.4, color: "#8b5cf6" },
  { name: "其他科室", value: 17, amount: 83.6, color: "#64748b" },
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
  title: { fontSize: 18, fontWeight: 700, color: "#1a3a5c", margin: 0 },
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
    fontSize: 26,
    fontWeight: 700,
    color: "#1a3a5c",
    lineHeight: 1.2,
  },
  kpiLabel: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "2px solid #e2e8f0",
    marginBottom: 20,
  },
  tab: {
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    color: "#64748b",
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
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 14px",
    flex: 1,
    minWidth: 200,
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    color: "var(--text-secondary)",
    width: "100%",
  },
  select: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    color: "var(--text-secondary)",
    background: "var(--content-bg)",
    outline: "none",
    cursor: "pointer",
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
    border: "1px solid #f1f5f9",
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
    color: "#1a3a5c",
  },
  cardPatientId: {
    fontSize: 12,
    color: "#94a3b8",
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
    fontSize: 13,
    color: "#475569",
  },
  cardDrug: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 10,
  },
  cardDrugName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#166534",
  },
  cardDrugSpec: {
    fontSize: 12,
    color: "#16a34a",
    marginTop: 2,
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#eff6ff",
    color: "#2563eb",
    marginTop: 4,
    display: "inline-block",
  },
  cardRestriction: {
    fontSize: 12,
    color: "#dc2626",
    background: "#fef2f2",
    border: "1px solid #fecaca",
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
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid #f1f5f9",
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
    background: "#dcfce7",
    color: "#166534",
  },
  badgeDanger: {
    background: "#fee2e2",
    color: "#dc2626",
  },
  badgeWarning: {
    background: "#fef3c7",
    color: "#d97706",
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
    background: "#1e40af",
    color: "#fff",
  },
  btnSuccess: {
    background: "#16a34a",
    color: "#fff",
  },
  btnDanger: {
    background: "#dc2626",
    color: "#fff",
  },
  btnOutline: {
    background: "transparent",
    border: "1px solid #e2e8f0",
    color: "#475569",
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
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a3a5c",
  },
  chartCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1a3a5c",
    marginBottom: 16,
  },
  ruleCard: {
    background: "var(--bg-card)",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    marginBottom: 12,
    borderLeft: "4px solid #1e40af",
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
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
  },
  drugTd: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "var(--text-secondary)",
    fontSize: 13,
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#94a3b8",
  },
  voucherCard: {
    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
    borderRadius: 12,
    padding: "20px 24px",
    color: "#fff",
    marginBottom: 20,
  },
  voucherCardTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  voucherCardSubtitle: {
    fontSize: 13,
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
    fontSize: 24,
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
    border: "1px solid #dbeafe",
  },
  voucherFilterBtn: {
    padding: "6px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
  },
  voucherFilterActive: {
    background: "#1e40af",
    color: "#fff",
  },
  voucherFilterInactive: {
    background: "#f0f9ff",
    color: "#3b82f6",
    border: "1px solid #dbeafe",
  },
  voucherTableWrapper: {
    background: "var(--bg-card)",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    overflow: "hidden",
    border: "1px solid #dbeafe",
  },
  voucherTh: {
    background: "#f0f9ff",
    padding: "12px 16px",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "#1e40af",
    borderBottom: "1px solid #dbeafe",
    fontSize: 13,
  },
  voucherTd: {
    padding: "12px 16px",
    borderBottom: "1px solid #f1f5f9",
    color: "var(--text-secondary)",
    fontSize: 13,
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
    borderTop: "1px solid #e2e8f0",
  },
  pageInfo: {
    fontSize: 14,
    color: "#64748b",
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
    border: "1px solid #e2e8f0",
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
    background: "#16a34a",
    color: "#fff",
  },
  toastError: {
    background: "#dc2626",
    color: "#fff",
  },
  toastInfo: {
    background: "#1e40af",
    color: "#fff",
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
    color: "#1a3a5c",
    marginBottom: 16,
  },
  modalText: {
    fontSize: 14,
    color: "#475569",
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
    color: "#1a3a5c",
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
    fontSize: 26,
    fontWeight: 700,
    color: "#1a3a5c",
    lineHeight: 1.2,
  },
  fundKpiLabel: {
    fontSize: 13,
    color: "#64748b",
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
    color: "#1a3a5c",
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
    borderBottom: "1px solid #f1f5f9",
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
    fontSize: 13,
    fontWeight: 600,
  },
  violationTime: {
    fontSize: 12,
    color: "#94a3b8",
  },
  violationDesc: {
    fontSize: 12,
    color: "#64748b",
  },
  balanceWarningNormal: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  balanceWarningWarning: {
    background: "#fef3c7",
    color: "#d97706",
    border: "1px solid #fecaca",
  },
  balanceWarningCritical: {
    background: "#fee2e2",
    color: "#dc2626",
    border: "1px solid #fecaca",
  },
};

// ---------- 组件 ----------
const PRIMARY = "#1e40af";
const ACCENT = "#3b82f6";
const SUCCESS = "#16a34a";
const WARNING = "#d97706";
const DANGER = "#dc2626";
const GRAY = "#64748b";
const WHITE = "#ffffff";

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
  pending: "待审核",
  history: "审核历史",
  stats: "统计分析",
  rules: "规则管理",
  voucher: "电子凭证管理",
  fundMonitor: "基金监控",
  claim837: "837理赔",
  denial: "拒赔管理",
  preAuth: "预授权",
  drg: "DRG校验",
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
  高: "#dc2626",
  中: "#d97706",
  低: "#16a34a",
};

// 结果颜色
const resultColors: Record<string, { bg: string; text: string }> = {
  通过: { bg: "#dcfce7", text: "#166534" },
  拒绝: { bg: "#fee2e2", text: "#dc2626" },
  补充资料: { bg: "#fef3c7", text: "#d97706" },
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
          <AlertOctagon size={12} />
        ) : audit.urgency === "中" ? (
          <Clock size={12} />
        ) : (
          <Clock3 size={12} />
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
      <span style={{ marginLeft: "auto", color: "#94a3b8" }}>
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
      <AlertTriangle size={12} style={{ marginRight: 6 }} />
      {audit.restriction}
    </div>

    <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
      <Stethoscope size={12} style={{ marginRight: 6 }} />
      {audit.reason}
    </div>

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
        style={{ width: 1, height: 20, background: "#cbd5e1", margin: "0 4px" }}
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
        <FileText size={16} /> 详情
      </button>
    </div>
  </div>
);

// 审核历史表格行
const HistoryRow: React.FC<{ record: AuditHistory }> = ({ record }) => {
  const { t } = useTranslation("insuranceAudit");
  const colors = resultColors[record.result];
  return (
    <tr>
      <td style={styles.td}>{record.auditTime}</td>
      <td style={styles.td}>{record.patientName}</td>
      <td style={styles.td}>{record.patientId}</td>
      <td style={styles.td}>{record.examItem}</td>
      <td style={styles.td}>{record.drugName}</td>
      <td style={styles.td}>
        <span
          style={{
            ...styles.badge,
            background: colors.bg,
            color: colors.text,
          }}
        >
          <ResultIcon result={record.result} />
          {record.result === "通过"
            ? t("passed")
            : record.result === "拒绝"
              ? t("rejected")
              : t("supplement")}
        </span>
      </td>
      <td style={styles.td}>{record.auditor}</td>
      <td style={styles.td}>{record.reason || "-"}</td>
    </tr>
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

  // [W2-B] 保险审计详情 (getInsuranceAudit)
  const [showAuditDetail, setShowAuditDetail] = useState(false);
  const [auditDetailLoading, setAuditDetailLoading] = useState(false);
  const [auditDetail, setAuditDetail] = useState<DataReportAuditDto | null>(null);

  const handleViewDetail = (id: string) => {
    setAuditDetailLoading(true);
    setShowAuditDetail(true);
    setAuditDetail(null);
    void datareportApi.getInsuranceAudit(id).then((res) => {
      setAuditDetailLoading(false);
      if (res.success) {
        const raw = res.data as unknown;
        const item = Array.isArray(raw) ? raw[0] : raw;
        setAuditDetail((item as DataReportAuditDto) ?? null);
      } else {
        setToastType("error");
        setToastMessage(res.error?.message || "详情加载失败");
      }
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
              examItem: d.examType || "影像检查",
              drugName: d.drugName || d.drugCategory || "对比剂",
              drugCategory: d.drugCategory || "对比剂",
              drugSpec: "常规规格",
              restriction: "医保限制用药目录",
              reason: d.reason || "待审核",
              submitTime: d.submitTime || "",
              submitDept: "放射科",
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
              examItem: d.examItem || "影像检查",
              drugName: d.contrastAgent || d.anticoagulant || "对比剂",
              drugCategory: d.contrastAgent ? "对比剂" : "抗凝药物",
              drugSpec: "常规规格",
              restriction: "医保限制用药目录",
              reason: d.reason || "待审核",
              submitTime: "",
              submitDept: "放射科",
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
      status: "已提交",
      submitDate: "2026-05-01",
      carrier: "中国人保",
      trackStatus: "已受理",
    },
    {
      id: "CLM002",
      patientName: "李娜",
      patientId: "P202400002",
      examItem: "头颅MRI增强",
      icd10: "C71.9",
      cpt: "70553",
      amount: 1200,
      status: "待提交",
      submitDate: "",
      carrier: "中国平安",
      trackStatus: "待提交",
    },
    {
      id: "CLM003",
      patientName: "王磊",
      patientId: "P202400003",
      examItem: "脑血管DSA",
      icd10: "I65.9",
      cpt: "75680",
      amount: 2800,
      status: "已提交",
      submitDate: "2026-04-28",
      carrier: "中国人保",
      trackStatus: "审核中",
    },
    {
      id: "CLM004",
      patientName: "赵敏",
      patientId: "P202400004",
      examItem: "腹部CT增强",
      icd10: "C22.0",
      cpt: "74160",
      amount: 950,
      status: "已支付",
      submitDate: "2026-04-25",
      carrier: "中国平安",
      trackStatus: "已支付",
    },
    {
      id: "CLM005",
      patientName: "周涛",
      patientId: "P202400005",
      examItem: "前列腺MRI增强",
      icd10: "C61",
      cpt: "72196",
      amount: 1500,
      status: "被拒",
      submitDate: "2026-04-20",
      carrier: "中国人保",
      trackStatus: "拒赔",
    },
  ];
  const icdCptMapping = [
    { icd10: "I63.9", description: "脑梗死", cpt: "70460", exam: "头颅CT增强" },
    {
      icd10: "C71.9",
      description: "脑恶性肿瘤",
      cpt: "70553",
      exam: "头颅MRI增强",
    },
    {
      icd10: "I65.9",
      description: "脑动脉狭窄",
      cpt: "75680",
      exam: "脑血管DSA",
    },
    {
      icd10: "C22.0",
      description: "肝细胞癌",
      cpt: "74160",
      exam: "腹部CT增强",
    },
    {
      icd10: "C61",
      description: "前列腺癌",
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
      description: "CPT编码与ICD-10不匹配",
      amount: 1500,
      date: "2026-04-25",
      carrier: "中国人保",
      appealStatus: "待申诉",
    },
    {
      id: "DEN002",
      patientName: "吴静",
      patientId: "P202400006",
      examItem: "冠脉CTA",
      denialReason: "authorization_missing",
      description: "未获得预先授权",
      amount: 1800,
      date: "2026-04-22",
      carrier: "中国平安",
      appealStatus: "申诉中",
    },
    {
      id: "DEN003",
      patientName: "郑强",
      patientId: "P202400007",
      examItem: "肺动脉CTA",
      denialReason: "medical_necessity",
      description: "医保判定非医学必要",
      amount: 1200,
      date: "2026-04-18",
      carrier: "中国人保",
      appealStatus: "已通过",
    },
    {
      id: "DEN004",
      patientName: "钱琳",
      patientId: "P202400008",
      examItem: "腹部CT增强",
      denialReason: "duplicate",
      description: "同一项目重复申报",
      amount: 950,
      date: "2026-04-15",
      carrier: "中国平安",
      appealStatus: "已拒绝",
    },
    {
      id: "DEN005",
      patientName: "孙鹏",
      patientId: "P202400009",
      examItem: "肾动脉DSA",
      denialReason: "coding_error",
      description: "ICD-10代码与性别不符",
      amount: 2200,
      date: "2026-04-10",
      carrier: "中国人保",
      appealStatus: "待申诉",
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
    coding_error: "编码错误",
    authorization_missing: "缺少授权",
    medical_necessity: "医学必要性",
    duplicate: "重复申报",
    other: "其他",
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
      docs: ["申请单", "病历摘要", "心电图"],
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
      docs: ["申请单", "病历摘要", "影像报告", "病理报告"],
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
      docs: ["申请单", "病历摘要", "CT报告"],
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
      docs: ["申请单", "肝功能报告"],
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
      drgName: "脑血管疾病伴合并症",
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
      drgName: "神经系统肿瘤伴合并症",
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
      drgName: "脑血管疾病不伴合并症",
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
      drgName: "肝胆系统肿瘤伴合并症",
      expectedCost: 20000,
      actualCost: 28500,
      outlier: true,
      validationScore: 72,
    },
  ];
  const drgMapping = [
    { icdStart: "A00", icdEnd: "B99", drg: "A", category: "感染性疾病" },
    { icdStart: "C00", icdEnd: "D49", drg: "B", category: "肿瘤" },
    { icdStart: "I60", icdEnd: "I69", drg: "B70", category: "脑血管疾病" },
    { icdStart: "K70", icdEnd: "K77", drg: "H60", category: "肝胆疾病" },
  ];

  const pageSize = 10;

  // Toast auto dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
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
    const header = "患者,患者ID,检查类型,检查项目,药品,药品类别,审核结果,审核人,审核时间,原因";
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
    a.download = `保险审核历史-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(`已导出 ${filteredHistory.length} 条审核历史记录`);
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
        setToastMessage(res.error?.message || t("approveFailed", "通过失败"));
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
      const reason = rejectReasonText.trim() || t("rejectDefaultReason", "不符合医保限制用药条件");
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
          setToastMessage(res.error?.message || t("rejectFailed", "拒绝失败"));
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

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <ShieldCheck
            size={22}
            style={{
              marginRight: 10,
              verticalAlign: "middle",
              color: "#1e40af",
            }}
          />
          {t("title")}
        </h2>
      </div>

      {/* KPI 卡片 */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, background: "#dbeafe" }}>
            <ClipboardList size={22} color="#1e40af" />
          </div>
          <div>
            <div style={styles.kpiValue}>{statsData.totalPending}</div>
            <div style={styles.kpiLabel}>{t("pendingCount")}</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, background: "#dcfce7" }}>
            <CheckCircle size={22} color="#16a34a" />
          </div>
          <div>
            <div style={styles.kpiValue}>{statsData.passRate}%</div>
            <div style={styles.kpiLabel}>{t("passRate")}</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, background: "#fef3c7" }}>
            <Activity size={22} color="#d97706" />
          </div>
          <div>
            <div style={styles.kpiValue}>{statsData.todayProcessed}</div>
            <div style={styles.kpiLabel}>{t("todayProcessed")}</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, background: "#f3e8ff" }}>
            <Clock size={22} color="#9333ea" />
          </div>
          <div>
            <div style={styles.kpiValue}>{statsData.avgReviewTime}</div>
            <div style={styles.kpiLabel}>平均审核时间</div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 医保基金监控区域 */}
      {/* ============================================================ */}
      <div style={styles.fundMonitorSection}>
        <div style={styles.fundMonitorHeader}>
          <h3 style={styles.fundMonitorTitle}>
            <DollarSign size={20} style={{ color: "#16a34a" }} />
            医保基金监控
          </h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            数据更新于 2026-05-27 12:00
          </span>
        </div>

        {/* 基金监控KPI */}
        <div style={styles.fundKpiRow}>
          <div style={styles.fundKpiCard}>
            <div style={{ ...styles.fundKpiIcon, background: "#dcfce7" }}>
              <Percent size={22} color="#16a34a" />
            </div>
            <div>
              <div style={styles.fundKpiValue}>{fundMonitorKPI.usageRate}%</div>
              <div style={styles.fundKpiLabel}>本月基金使用率</div>
            </div>
          </div>
          <div style={styles.fundKpiCard}>
            <div
              style={{
                ...styles.fundKpiIcon,
                background:
                  fundMonitorKPI.balanceWarning === "正常"
                    ? "#dcfce7"
                    : fundMonitorKPI.balanceWarning === "警告"
                      ? "#fef3c7"
                      : "#fee2e2",
              }}
            >
              <AlertTriangle
                size={22}
                color={
                  fundMonitorKPI.balanceWarning === "正常"
                    ? "#16a34a"
                    : fundMonitorKPI.balanceWarning === "警告"
                      ? "#d97706"
                      : "#dc2626"
                }
              />
            </div>
            <div>
              <div style={styles.fundKpiValue}>
                {fundMonitorKPI.balanceWarning}
              </div>
              <div style={styles.fundKpiLabel}>基金余额预警</div>
            </div>
          </div>
          <div style={styles.fundKpiCard}>
            <div style={{ ...styles.fundKpiIcon, background: "#fee2e2" }}>
              <AlertOctagon size={22} color="#dc2626" />
            </div>
            <div>
              <div style={styles.fundKpiValue}>
                {fundMonitorKPI.violationCount}
              </div>
              <div style={styles.fundKpiLabel}>本月违规使用次数</div>
            </div>
          </div>
          <div style={styles.fundKpiCard}>
            <div style={{ ...styles.fundKpiIcon, background: "#dbeafe" }}>
              <TrendingUp size={22} color="#1e40af" />
            </div>
            <div>
              <div style={styles.fundKpiValue}>
                {fundMonitorKPI.passRateTrend}%
              </div>
              <div style={styles.fundKpiLabel}>审核通过率</div>
            </div>
          </div>
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
                  color: "#16a34a",
                }}
              />
              近30天基金使用趋势
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={fundTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="万" />
                <Tooltip
                  formatter={(value: number) => [`¥${value}万元`, "使用金额"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#94a3b8"
                  fill="#f1f5f9"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  name="日预算"
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#16a34a"
                  fill="#dcfce7"
                  strokeWidth={2}
                  name="实际使用"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 科室使用分布 */}
          <div style={styles.fundChartCard}>
            <div style={styles.fundChartTitle}>
              <PieChartIcon
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "#f97316",
                }}
              />
              科室医保使用分布
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 220, height: 220, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
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
                    formatter={(value: number) => [`${value}%`, "占比"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
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
                    <div style={{ flex: 1, fontSize: 12, color: "#475569" }}>
                      {dept.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#1a3a5c",
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
                  color: "#3b82f6",
                }}
              />
              近12个月基金使用趋势
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fundMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="万" />
                <Tooltip
                  formatter={(value: number) => [`¥${value}万元`, "使用金额"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Bar
                  dataKey="budget"
                  fill="#e2e8f0"
                  name="月度预算"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="amount"
                  fill="#3b82f6"
                  name="实际使用"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 违规使用预警列表 */}
          <div style={styles.violationListCard}>
            <div style={styles.fundChartTitle}>
              <AlertCircle
                size={16}
                style={{
                  marginRight: 6,
                  verticalAlign: "middle",
                  color: "#dc2626",
                }}
              />
              违规使用预警
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  fontWeight: 400,
                  color: "#64748b",
                }}
              >
                共 {violationAlerts.length} 条
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
                    style={{ ...styles.violationIcon, background: "#fee2e2" }}
                  >
                    <AlertOctagon size={16} color="#dc2626" />
                  </div>
                  <div style={styles.violationContent}>
                    <div style={styles.violationHeader}>
                      <span
                        style={{ ...styles.violationType, color: "#dc2626" }}
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
                color: "#8b5cf6",
              }}
            />
            审核通过率趋势（近30天）
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={passRateTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                domain={[70, 90]}
                unit="%"
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "通过率"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#8b5cf6"
                fill="#f3e8ff"
                strokeWidth={2}
                name="审核通过率"
              />
            </AreaChart>
          </ResponsiveContainer>
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
                ? { color: "#1e40af", borderBottomColor: "#1e40af" }
                : {}),
            }}
            onClick={() => setActiveTab(key)}
          >
            {TAB_ICONS[key]}
            {t(`tabs.${key}`)}
            {key === "pending" && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
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
              <Search size={16} color="#94a3b8" />
              <input
                style={styles.searchInput}
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              style={styles.select}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="全部">{t("allTypes")}</option>
              <option value="CT增强">CT增强</option>
              <option value="MRI增强">MRI增强</option>
              <option value="DSA手术">DSA手术</option>
            </select>
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
                          examItem: d.examType || "影像检查",
                          drugName: d.drugName || d.drugCategory || "对比剂",
                          drugCategory: d.drugCategory || "对比剂",
                          drugSpec: "常规规格",
                          restriction: "医保限制用药目录",
                          reason: d.reason || "待审核",
                          submitTime: d.submitTime || "",
                          submitDept: "放射科",
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
            {auditLoading && (
              <span style={{ fontSize: 12, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={14} className="spin" /> 正在同步医保平台数据...
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
              <div style={{ fontSize: 12, marginTop: 4, color: "#94a3b8" }}>
                暂无数据
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
                    显示 {(pendingPage - 1) * pageSize + 1} -{" "}
                    {Math.min(pendingPage * pageSize, filteredPending.length)}{" "}
                    条，共 {filteredPending.length} 条 · 第 {pendingPage}/
                    {pendingTotalPages} 页
                  </div>
                  <div style={styles.pageButtons}>
                    <button
                      style={styles.pageBtn}
                      disabled={pendingPage === 1}
                      aria-label="上一页"
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
                            aria-label={`第 ${page} 页`}
                            aria-current={
                              pendingPage === page ? "page" : undefined
                            }
                            style={{
                              ...styles.pageBtn,
                              ...(pendingPage === page
                                ? {
                                    background: "#1e40af",
                                    color: "#fff",
                                    borderColor: "#1e40af",
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
                      aria-label="下一页"
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
              <Search size={16} color="#94a3b8" />
              <input
                style={styles.searchInput}
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              style={styles.select}
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
            >
              <option value="全部">{t("allResults")}</option>
              <option value="通过">{t("passed")}</option>
              <option value="拒绝">{t("rejected")}</option>
              <option value="补充资料">{t("supplement")}</option>
            </select>
            <button onClick={handleExportHistory} style={{ ...styles.btn, ...styles.btnOutline }}>
              <Filter size={16} />
              {t("export")}
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t("history.auditTime")}</th>
                  <th style={styles.th}>{t("history.patientName")}</th>
                  <th style={styles.th}>{t("history.patientId")}</th>
                  <th style={styles.th}>{t("history.examItem")}</th>
                  <th style={styles.th}>{t("history.drugName")}</th>
                  <th style={styles.th}>{t("history.result")}</th>
                  <th style={styles.th}>{t("history.auditor")}</th>
                  <th style={styles.th}>{t("history.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((record) => (
                  <HistoryRow key={record.id} record={record} />
                ))}
              </tbody>
            </table>

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
                  aria-label="上一页"
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
                      aria-label={`第 ${page} 页`}
                      aria-current={historyPage === page ? "page" : undefined}
                      style={{
                        ...styles.pageBtn,
                        ...(historyPage === page
                          ? {
                              background: "#1e40af",
                              color: "#fff",
                              borderColor: "#1e40af",
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
                  aria-label="下一页"
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
              <TrendingUp size={16} color="#16a34a" style={{ marginTop: 8 }} />
              <span style={{ fontSize: 12, color: "#16a34a", marginLeft: 4 }}>
                +12%
              </span>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>CT增强审核</div>
              <div style={styles.statValue}>158</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                占比 48.5%
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>MRI增强审核</div>
              <div style={styles.statValue}>98</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                占比 30.1%
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statTitle}>DSA抗凝审核</div>
              <div style={styles.statValue}>70</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                占比 21.5%
              </div>
            </div>
          </div>

          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>
              <BarChart3
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              审核结果分布
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}
                >
                  通过率
                </div>
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
                      background: "#16a34a",
                      height: "100%",
                      width: "78.5%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}
                    >
                      78.5%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}
                >
                  拒绝率
                </div>
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
                      background: "#dc2626",
                      height: "100%",
                      width: "12.3%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}
                    >
                      12.3%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}
                >
                  补充资料率
                </div>
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
                      background: "#d97706",
                      height: "100%",
                      width: "9.2%",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}
                  >
                    <span
                      style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}
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
              药品使用排行 (Top 5)
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
                  <div style={{ width: 24, fontSize: 13, color: "#64748b" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>
                    {item.name}
                  </div>
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
                        background: "#1e40af",
                        height: "100%",
                        width: `${item.pct * 4}%`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 50,
                      fontSize: 13,
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
            <div style={styles.voucherCardTitle}>电子凭证管理</div>
            <div style={styles.voucherCardSubtitle}>
              医保审核电子凭证记录与查询
            </div>
            <div style={styles.voucherStatsRow}>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>{voucherStats.total}</div>
                <div style={styles.voucherStatLabel}>凭证总数</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.invoiced}
                </div>
                <div style={styles.voucherStatLabel}>已开票</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.pending}
                </div>
                <div style={styles.voucherStatLabel}>待开票</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  {voucherStats.cancelled}
                </div>
                <div style={styles.voucherStatLabel}>已作废</div>
              </div>
              <div style={styles.voucherStatItem}>
                <div style={styles.voucherStatValue}>
                  ¥{voucherStats.totalAmount.toLocaleString()}
                </div>
                <div style={styles.voucherStatLabel}>总金额</div>
              </div>
            </div>
          </div>

          {/* 工具栏 */}
          <div style={styles.voucherToolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input
                style={styles.searchInput}
                placeholder="搜索患者姓名、ID、凭证ID、关联审核ID..."
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["全部", "已开票", "待开票", "已作废"].map((status) => (
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={styles.voucherTh}>凭证ID</th>
                  <th style={styles.voucherTh}>关联审核ID</th>
                  <th style={styles.voucherTh}>患者姓名</th>
                  <th style={styles.voucherTh}>患者ID</th>
                  <th style={styles.voucherTh}>凭证类型</th>
                  <th style={styles.voucherTh}>金额</th>
                  <th style={styles.voucherTh}>开票时间</th>
                  <th style={styles.voucherTh}>状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.slice(0, 50).map((voucher) => (
                  <tr key={voucher.id}>
                    <td style={styles.voucherTd}>{voucher.id}</td>
                    <td style={styles.voucherTd}>{voucher.relatedAuditId}</td>
                    <td style={styles.voucherTd}>{voucher.patientName}</td>
                    <td style={styles.voucherTd}>{voucher.patientId}</td>
                    <td style={styles.voucherTd}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          background:
                            voucher.voucherType === "检查费"
                              ? "#dbeafe"
                              : voucher.voucherType === "药品费"
                                ? "#dcfce7"
                                : "#fef3c7",
                          color:
                            voucher.voucherType === "检查费"
                              ? "#1e40af"
                              : voucher.voucherType === "药品费"
                                ? "#166534"
                                : "#d97706",
                        }}
                      >
                        {voucher.voucherType}
                      </span>
                    </td>
                    <td style={styles.voucherTd}>
                      ¥{voucher.amount.toFixed(2)}
                    </td>
                    <td style={styles.voucherTd}>{voucher.invoiceTime}</td>
                    <td style={styles.voucherTd}>
                      <span
                        style={{
                          ...styles.voucherStatusBadge,
                          background:
                            voucher.status === "已开票"
                              ? "#dcfce7"
                              : voucher.status === "待开票"
                                ? "#fef3c7"
                                : "#fee2e2",
                          color:
                            voucher.status === "已开票"
                              ? "#166534"
                              : voucher.status === "待开票"
                                ? "#d97706"
                                : "#dc2626",
                        }}
                      >
                        {voucher.status === "已开票" && (
                          <CheckCircle size={12} />
                        )}
                        {voucher.status === "待开票" && <Clock size={12} />}
                        {voucher.status === "已作废" && <XCircle size={12} />}
                        {voucher.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "16px",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            显示 {Math.min(50, filteredVouchers.length)} /{" "}
            {filteredVouchers.length} 条记录
          </div>
        </>
      )}

      {/* 837理赔 */}
      {activeTab === "claim837" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: WHITE,
              borderRadius: 10,
              padding: 16,
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color={PRIMARY} />
              <span style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>
                837 (X12 5010) 理赔申请
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setClaimBatchMode(!claimBatchMode)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${claimBatchMode ? ACCENT : "#e2e8f0"}`,
                  background: claimBatchMode ? `${ACCENT}15` : WHITE,
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
                {claimBatchMode ? "取消批量" : "批量提交"}
              </button>
              <button
                onClick={() => {
                  setToastType("success");
                  setToastMessage("模拟提交成功，已发送至保险商");
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
                提交理赔
              </button>
            </div>
          </div>
          <div
            style={{
              background: WHITE,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "12px 16px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {["全部", "待提交", "已提交", "已支付", "被拒"].map((s) => (
                <button
                  key={s}
                  onClick={() => setClaimStatusFilter(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    border: `1px solid ${claimStatusFilter === s ? ACCENT : "#e2e8f0"}`,
                    background: claimStatusFilter === s ? ACCENT : WHITE,
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--content-bg)",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {[
                    "理赔ID",
                    "患者",
                    "检查项目",
                    "ICD-10",
                    "CPT",
                    "金额",
                    "保险商",
                    "提交日期",
                    "状态",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: PRIMARY,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claim837Data
                  .filter(
                    (c) =>
                      claimStatusFilter === "全部" ||
                      c.status === claimStatusFilter,
                  )
                  .map((c, idx) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: idx % 2 === 0 ? WHITE : "#fafbfc",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                          color: GRAY,
                        }}
                      >
                        {c.id}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 700,
                          color: PRIMARY,
                        }}
                      >
                        {c.patientName}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                        }}
                      >
                        {c.examItem}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                      >
                        {c.icd10}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                      >
                        {c.cpt}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 700,
                          color: PRIMARY,
                        }}
                      >
                        ¥{c.amount}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                          color: GRAY,
                        }}
                      >
                        {c.carrier}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                        }}
                      >
                        {c.submitDate || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            background:
                              c.status === "已支付"
                                ? "#d1fae5"
                                : c.status === "待提交"
                                  ? "#fef3c7"
                                  : c.status === "被拒"
                                    ? "#fee2e2"
                                    : "#dbeafe",
                            color:
                              c.status === "已支付"
                                ? SUCCESS
                                : c.status === "待提交"
                                  ? WARNING
                                  : c.status === "被拒"
                                    ? DANGER
                                    : ACCENT,
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              background: WHITE,
              borderRadius: 12,
              padding: 20,
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: PRIMARY,
                margin: "0 0 12px",
              }}
            >
              ICD-10 / CPT 编码映射
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--content-bg)",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: PRIMARY,
                      fontSize: 12,
                    }}
                  >
                    ICD-10
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: PRIMARY,
                      fontSize: 12,
                    }}
                  >
                    描述
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: PRIMARY,
                      fontSize: 12,
                    }}
                  >
                    CPT
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: PRIMARY,
                      fontSize: 12,
                    }}
                  >
                    适用检查
                  </th>
                </tr>
              </thead>
              <tbody>
                {icdCptMapping.map((m, idx) => (
                  <tr
                    key={m.icd10}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: idx % 2 === 0 ? WHITE : "#fafbfc",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {m.icd10}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontSize: 12,
                      }}
                    >
                      {m.description}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {m.cpt}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontSize: 12,
                      }}
                    >
                      {m.exam}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                label: "拒赔总数",
                value: denialData.length,
                icon: <XCircle size={18} />,
                color: DANGER,
                bg: "#fee2e2",
              },
              {
                label: "待申诉",
                value: denialData.filter((d) => d.appealStatus === "待申诉")
                  .length,
                icon: <AlertTriangle size={18} />,
                color: WARNING,
                bg: "#fef3c7",
              },
              {
                label: "申诉中",
                value: denialData.filter((d) => d.appealStatus === "申诉中")
                  .length,
                icon: <Loader2 size={18} />,
                color: ACCENT,
                bg: "#eff6ff",
              },
              {
                label: "已通过",
                value: denialData.filter((d) => d.appealStatus === "已通过")
                  .length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "#d1fae5",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: WHITE,
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid #e2e8f0",
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
                    style={{ fontSize: 22, fontWeight: 800, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}
          >
            <div
              style={{
                background: WHITE,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  gap: 6,
                }}
              >
                {["全部", "待申诉", "申诉中", "已通过", "已拒绝"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDenialAppealFilter(s)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: `1px solid ${denialAppealFilter === s ? ACCENT : "#e2e8f0"}`,
                      background: denialAppealFilter === s ? ACCENT : WHITE,
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "var(--content-bg)",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {[
                      "患者",
                      "检查",
                      "拒赔原因",
                      "原因说明",
                      "金额",
                      "申诉状态",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 700,
                          color: PRIMARY,
                          fontSize: 12,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {denialData
                    .filter(
                      (d) =>
                        denialAppealFilter === "全部" ||
                        d.appealStatus === denialAppealFilter,
                    )
                    .map((d, idx) => (
                      <tr
                        key={d.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: idx % 2 === 0 ? WHITE : "#fafbfc",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: PRIMARY,
                          }}
                        >
                          {d.patientName}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: 12,
                          }}
                        >
                          {d.examItem}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: 12,
                          }}
                        >
                          {denialReasonLabels[d.denialReason] || d.denialReason}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: 12,
                            color: "#475569",
                          }}
                        >
                          {d.description}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 700,
                          }}
                        >
                          ¥{d.amount}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 700,
                              background:
                                d.appealStatus === "已通过"
                                  ? "#d1fae5"
                                  : d.appealStatus === "申诉中"
                                    ? "#dbeafe"
                                    : d.appealStatus === "已拒绝"
                                      ? "#fee2e2"
                                      : "#fef3c7",
                              color:
                                d.appealStatus === "已通过"
                                  ? SUCCESS
                                  : d.appealStatus === "申诉中"
                                    ? ACCENT
                                    : d.appealStatus === "已拒绝"
                                      ? DANGER
                                      : WARNING,
                            }}
                          >
                            {d.appealStatus === "待申诉"
                              ? "待申诉"
                              : d.appealStatus === "申诉中"
                                ? "申诉中"
                                : d.appealStatus === "已通过"
                                  ? "已通过"
                                  : "已拒绝"}
                          </span>
                          {d.appealStatus === "待申诉" && (
                            <button
                              onClick={() => {
                                setToastType("success");
                                setToastMessage("申诉信已生成");
                              }}
                              style={{
                                marginLeft: 6,
                                padding: "2px 8px",
                                borderRadius: 4,
                                border: "1px solid #e2e8f0",
                                background: WHITE,
                                color: ACCENT,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              申诉
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                background: WHITE,
                borderRadius: 12,
                padding: 16,
                border: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: PRIMARY,
                  margin: "0 0 12px",
                }}
              >
                拒赔率趋势
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={denialRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={DANGER}
                    fill="#fee2e2"
                    strokeWidth={2}
                    name="拒赔率"
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                      <span style={{ fontSize: 12, color: GRAY }}>{label}</span>
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
                label: "总预授权数",
                value: preAuthData.length,
                icon: <ClipboardList size={18} />,
                color: ACCENT,
                bg: "#eff6ff",
              },
              {
                label: "待审批",
                value: preAuthData.filter((p) => p.status === "pending").length,
                icon: <Clock size={18} />,
                color: WARNING,
                bg: "#fef3c7",
              },
              {
                label: "已批准",
                value: preAuthData.filter((p) => p.status === "approved")
                  .length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "#d1fae5",
              },
              {
                label: "已拒绝",
                value: preAuthData.filter((p) => p.status === "denied").length,
                icon: <XCircle size={18} />,
                color: DANGER,
                bg: "#fee2e2",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: WHITE,
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid #e2e8f0",
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
                    style={{ fontSize: 22, fontWeight: 800, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: WHITE,
              borderRadius: 10,
              padding: 12,
              border: "1px solid #e2e8f0",
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
                    border: `1px solid ${preAuthFilter === s ? ACCENT : "#e2e8f0"}`,
                    background: preAuthFilter === s ? ACCENT : WHITE,
                    color: preAuthFilter === s ? WHITE : GRAY,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s === "pending"
                    ? "待审批"
                    : s === "approved"
                      ? "已批准"
                      : s === "denied"
                        ? "已拒绝"
                        : "全部"}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setToastType("success");
                setToastMessage("预授权请求已创建");
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
              新建预授权
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
                const statusBg =
                  p.status === "approved"
                    ? "#d1fae5"
                    : p.status === "denied"
                      ? "#fee2e2"
                      : "#fef3c7";
                const statusLabel =
                  p.status === "pending"
                    ? "待审批"
                    : p.status === "approved"
                      ? "已批准"
                      : "已拒绝";
                return (
                  <div
                    key={p.id}
                    style={{
                      background: WHITE,
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
                        <span style={{ fontSize: 12, color: GRAY }}>
                          {p.patientId}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            background: statusBg,
                            color: statusColor,
                          }}
                        >
                          {statusLabel}
                        </span>
                        {p.status === "pending" && (
                          <>
                            <PermissionGate permission="audit.approve">
                              <button
                                type="button"
                                onClick={() => {
                                  setToastType("success");
                                  setToastMessage("预授权已批准");
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
                                批准
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="audit.approve">
                              <button
                                type="button"
                                onClick={() => {
                                  setToastType("error");
                                  setToastMessage("预授权已拒绝");
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
                                拒绝
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
                      <div style={{ fontSize: 12, color: GRAY }}>
                        检查:{" "}
                        <span style={{ color: "var(--text-secondary)" }}>{p.examItem}</span>
                      </div>
                      <div style={{ fontSize: 12, color: GRAY }}>
                        请求日期:{" "}
                        <span style={{ color: "var(--text-secondary)" }}>
                          {p.requestedDate}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}
                      >
                        所需材料 ({p.docsCompleted}/{p.docs.length})
                      </div>
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
                                i < p.docsCompleted ? "#d1fae5" : "#f1f5f9",
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
                        有效期至: {p.expiryDate}
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
                label: "DRG验证总数",
                value: drgData.length,
                icon: <BarChart3 size={18} />,
                color: ACCENT,
                bg: "#eff6ff",
              },
              {
                label: "有效验证",
                value: drgData.filter((d) => d.validationScore >= 80).length,
                icon: <CheckCircle size={18} />,
                color: SUCCESS,
                bg: "#d1fae5",
              },
              {
                label: "异常病例",
                value: drgData.filter((d) => d.outlier).length,
                icon: <AlertTriangle size={18} />,
                color: WARNING,
                bg: "#fef3c7",
              },
              {
                label: "平均校验分",
                value: Math.round(
                  drgData.reduce((s, d) => s + d.validationScore, 0) /
                    drgData.length,
                ),
                icon: <Target size={18} />,
                color: "#8b5cf6",
                bg: "#ede9fe",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: WHITE,
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid #e2e8f0",
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
                    style={{ fontSize: 22, fontWeight: 800, color: card.color }}
                  >
                    {card.value}
                  </div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: WHITE,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--content-bg)",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {[
                    "患者",
                    "ICD代码",
                    "DRG分组",
                    "预期费用",
                    "实际费用",
                    "费用偏差",
                    "异常",
                    "校验分",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: PRIMARY,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drgData.map((d, idx) => {
                  const costDiff = (
                    ((d.actualCost - d.expectedCost) / d.expectedCost) *
                    100
                  ).toFixed(1);
                  const diffColor =
                    parseFloat(costDiff) > 10
                      ? DANGER
                      : parseFloat(costDiff) < -10
                        ? SUCCESS
                        : GRAY;
                  return (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: idx % 2 === 0 ? WHITE : "#fafbfc",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 600,
                          color: PRIMARY,
                        }}
                      >
                        {d.patientName}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                      >
                        {d.icdCodes}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: PRIMARY,
                          }}
                        >
                          {d.drgCode}
                        </div>
                        <div style={{ fontSize: 12, color: GRAY }}>
                          {d.drgName}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                        }}
                      >
                        ¥{d.expectedCost.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                        }}
                      >
                        ¥{d.actualCost.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: diffColor,
                        }}
                      >
                        {costDiff}%
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {d.outlier ? (
                          <AlertTriangle size={14} color={WARNING} />
                        ) : (
                          <CheckCircle size={14} color={SUCCESS} />
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            background:
                              d.validationScore >= 80 ? "#d1fae5" : "#fef3c7",
                            color: d.validationScore >= 80 ? SUCCESS : WARNING,
                          }}
                        >
                          {d.validationScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              background: WHITE,
              borderRadius: 12,
              padding: 20,
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: PRIMARY,
                margin: "0 0 12px",
              }}
            >
              DRG分组映射
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
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{ fontSize: 16, fontWeight: 800, color: PRIMARY }}
                  >
                    {m.drg}
                  </div>
                  <div style={{ fontSize: 12, color: GRAY }}>
                    ICD: {m.icdStart}-{m.icdEnd}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                    {m.category}
                  </div>
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
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1a3a5c",
                  margin: "0 0 12px 0",
                }}
              >
                <BookOpen
                  size={18}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                医保适应证规则
              </h3>
            </div>
            <button
              onClick={async (evt) => {
                const btn = (evt?.target ||
                  evt?.currentTarget) as HTMLButtonElement;
                const orig = btn.innerHTML;
                btn.innerHTML = "⏳ 添加中...";
                btn.disabled = true;
                await new Promise((r) => setTimeout(r, 1500));
                const rules = JSON.parse(
                  localStorage.getItem("g005_insurance_rules") || "[]",
                );
                rules.push({
                  id: Date.now(),
                  examType: "CT",
                  examName: "新规则",
                  drugName: "碘对比剂",
                  drugCategory: "CT对比剂",
                  restriction: "新添加规则",
                  applicableExams: "CT检查",
                  notes: "",
                });
                localStorage.setItem(
                  "g005_insurance_rules",
                  JSON.stringify(rules),
                );
                btn.innerHTML = "✅ 已添加";
                setTimeout(() => {
                  btn.innerHTML = orig;
                  btn.disabled = false;
                }, 2000);
              }}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              <Settings size={16} />
              添加规则
            </button>
          </div>

          {indicationRulesState.map((rule) => (
            <div key={rule.id} style={styles.ruleCard}>
              <div style={styles.ruleHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 15, fontWeight: 600, color: "#1a3a5c" }}
                  >
                    {rule.examName}
                  </span>
                  <span
                    style={{
                      ...styles.cardCategory,
                      background: "#eff6ff",
                      color: "#1e40af",
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
                      title="删除规则"
                      aria-label="删除规则"
                    >
                      <Trash2 size={14} />
                    </button>
                  </PermissionGate>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                <Pill size={12} style={{ marginRight: 6 }} />
                <strong>药品:</strong> {rule.drugName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  padding: "8px 12px",
                  background: "#fef3c7",
                  borderRadius: 6,
                  color: "#92400e",
                  marginBottom: 8,
                }}
              >
                <ShieldCheck size={12} style={{ marginRight: 6 }} />
                {rule.insuranceRequirement}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {rule.description}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1a3a5c",
                marginBottom: 12,
              }}
            >
              <Filter
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              限制药品库
            </h3>
            <div style={styles.tableWrapper}>
              <table style={styles.drugTable}>
                <thead>
                  <tr>
                    <th style={styles.drugTh}>药品名称</th>
                    <th style={styles.drugTh}>类别</th>
                    <th style={styles.drugTh}>医保限制</th>
                    <th style={styles.drugTh}>适用检查</th>
                    <th style={styles.drugTh}>注意事项</th>
                  </tr>
                </thead>
                <tbody>
                  {restrictedDrugs.map((drug) => (
                    <tr key={drug.id}>
                      <td
                        style={{
                          ...styles.drugTd,
                          fontWeight: 600,
                          color: "#1a3a5c",
                        }}
                      >
                        {drug.name}
                      </td>
                      <td style={styles.drugTd}>
                        <span
                          style={{
                            ...styles.cardCategory,
                            background:
                              drug.category === "CT对比剂"
                                ? "#dbeafe"
                                : drug.category === "MRI对比剂"
                                  ? "#f3e8ff"
                                  : "#fce7f3",
                            color:
                              drug.category === "CT对比剂"
                                ? "#1e40af"
                                : drug.category === "MRI对比剂"
                                  ? "#7c3aed"
                                  : "#be185d",
                          }}
                        >
                          {drug.category}
                        </span>
                      </td>
                      <td
                        style={{
                          ...styles.drugTd,
                          color: "#dc2626",
                          fontSize: 12,
                        }}
                      >
                        {drug.restriction}
                      </td>
                      <td style={{ ...styles.drugTd, fontSize: 12 }}>
                        {drug.applicableExams}
                      </td>
                      <td
                        style={{
                          ...styles.drugTd,
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {drug.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          aria-label="保险审计详情"
          style={styles.modalOverlay}
          onClick={() => setShowAuditDetail(false)}
        >
          <div style={{ ...styles.modal, width: 560, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              <FileText size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              保险审计详情
            </div>
            {auditDetailLoading ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                详情加载中...
              </div>
            ) : auditDetail ? (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px 16px",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>审核编号：</span>
                    <b>{auditDetail.id ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>患者：</span>
                    <b>{auditDetail.patientName ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>患者编号：</span>
                    <b>{auditDetail.patientId ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>检查类型：</span>
                    <b>{auditDetail.examType ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>药品：</span>
                    <b>{auditDetail.drugName ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>药品类别：</span>
                    <b>{auditDetail.drugCategory ?? "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>提交时间：</span>
                    <b>{auditDetail.submitTime || "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>状态：</span>
                    <span
                      style={{
                        ...styles.badge,
                        background: (auditDetail.status || "").startsWith("REJ") || (auditDetail.status || "").toLowerCase() === "rejected"
                          ? "#fee2e2"
                          : (auditDetail.status || "").startsWith("APP") || (auditDetail.status || "").toLowerCase() === "approved"
                            ? "#dcfce7"
                            : "#fef3c7",
                        color: (auditDetail.status || "").startsWith("REJ") || (auditDetail.status || "").toLowerCase() === "rejected"
                          ? "#b91c1c"
                          : (auditDetail.status || "").startsWith("APP") || (auditDetail.status || "").toLowerCase() === "approved"
                            ? "#166534"
                            : "#854d0e",
                      }}
                    >
                      {auditDetail.status ?? "-"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>审核人：</span>
                    <b>{auditDetail.auditor || "-"}</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>审核时间：</span>
                    <b>{auditDetail.auditTime || "-"}</b>
                  </div>
                </div>
                {(auditDetail.reason || auditDetail.result) && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: "#f9fafb",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      审核结果：{auditDetail.result || "-"}
                    </div>
                    <div style={{ color: "#475569", lineHeight: 1.7 }}>
                      原因说明：{auditDetail.reason || "-"}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                未找到该审计记录
              </div>
            )}
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => setShowAuditDetail(false)}
              >
                关闭
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
              placeholder="请输入拒绝原因（必填，将同步至医保平台）"
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
                fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12, resize: "vertical",
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
        title="删除医保规则"
        message={`确定要删除规则 "${ruleToDelete?.examName}" 吗?该操作不可撤销。`}
        confirmText="删除"
        variant="danger"
        onCancel={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            setIndicationRules((prev) =>
              prev.filter((r) => r.id !== ruleToDelete.id),
            );
            setToastType("success");
            setToastMessage(`已删除规则: ${ruleToDelete.examName}`);
            setRuleToDelete(null);
          }
        }}
      />
    </div>
  );
}
