// G005 放射科RIS系统 - 胶片打印管理页面 v2.0.0
// [v3.0.6.11-81] W2-B: 打印机=deviceApi / 队列·历史·统计=printApi(/print/*) / 失败回退演示数据
import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { templatesApi } from '../services/api/templatesApi'
import { deviceApi } from '../services/api/deviceApi'
import { printApi } from '../services/api/printApi'
import { Printer, Settings, FileText, Film, CheckCircle, XCircle, Search, Plus, X, Eye, Edit2, RefreshCw, Download, BarChart, PieChart, TrendingUp, AlertCircle, Info, Copy, Layers, Box, DollarSign, Monitor, Network, HardDrive, Cog, FileBarChart, ScrollText, Database, Zap, Timer, BarChart2, Activity, Server, Wifi, WifiOff, FileSpreadsheet, Building2, Receipt, CreditCard, LayoutGrid, SlidersHorizontal, AlertTriangle, ClipboardList, ShieldAlert } from 'lucide-react'
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { ChartContainer } from '../components/charts'
import { VirtualTable } from '../components/common/VirtualTable'
import { PageHeader } from '../components/common/PageHeader'
import { DataTable } from '../components/common'
import type { TableColumnsType } from 'antd'
// [G005 2B] 原生表格 slice 分页 (DICOM 任务队列 / 成本分析)
import { usePagination } from '../hooks/usePagination'
import { t } from '../i18n/appI18n';

// ============================================================
// 样式常量 - WIN10风格
// ============================================================
const C = {
  primary: 'var(--color-primary-800)',        // 深蓝主色
  primaryLight: 'var(--color-primary-500)',   // 浅蓝
  primaryLighter: 'var(--color-info-bg)', // 淡蓝背景
  accent: 'var(--color-info-600)',         // 青色辅色
  accentLight: 'var(--color-info-500)',    // 浅青
  white: '#ffffff',          // 白色卡片
  bg: 'var(--bg-deep)',             // 浅灰背景
  border: 'var(--border-color)',         // 边框色
  textDark: 'var(--text-primary)',       // 深色文字
  textMid: 'var(--text-secondary)',        // 中色文字
  textLight: 'var(--text-muted)',      // 浅色文字
  success: '#059669',        // 成功绿
  warning: 'var(--color-warning-600)',        // 警告橙
  danger: 'var(--color-error-600)',         // 危险红
  info: 'var(--color-primary-600)',           // 信息蓝
}

// ============================================================
// 模拟数据
// ============================================================

// 打印机列表数据
const PRINTERS = [
  { id: 'P001', name: t("printMgmt.printerKonica1"), type: 'network', status: 'online', location: t("printMgmt.roomCt1"), filmSpec: '14x17', defaultCopies: 1, dpi: 300 },
  { id: 'P002', name: t("printMgmt.printerKonica2"), type: 'network', status: 'online', location: t("printMgmt.roomMr"), filmSpec: '14x17', defaultCopies: 1, dpi: 300 },
  { id: 'P003', name: t("printMgmt.printerFuji"), type: 'network', status: 'online', location: t("printMgmt.roomDr"), filmSpec: '10x12', defaultCopies: 1, dpi: 600 },
  { id: 'P004', name: t("printMgmt.printerLocal"), type: 'local', status: 'online', location: t("printMgmt.roomRegistration"), filmSpec: 'A4', defaultCopies: 2, dpi: 600 },
  { id: 'P005', name: t("printMgmt.printerLaser"), type: 'local', status: 'offline', location: t("printMgmt.roomDiag1"), filmSpec: 'A4', defaultCopies: 1, dpi: 1200 },
]

// 胶片规格配置
const FILM_SPECS = [
  { id: 'FS001', name: '14"×17" (35×43cm)', code: '14x17', size: '35×43cm', dpi: '300/600', default: true },
  { id: 'FS002', name: '10"×12" (25×30cm)', code: '10x12', size: '25×30cm', dpi: '300/600', default: false },
  { id: 'FS003', name: '8"×10" (20×25cm)', code: '8x10', size: '20×25cm', dpi: '300/600', default: false },
  { id: 'FS004', name: '14"×14" (35×35cm)', code: '14x14', size: '35×35cm', dpi: '300/600', default: false },
  { id: 'FS005', name: '11"×14" (28×35cm)', code: '11x14', size: '28×35cm', dpi: '300/600', default: false },
]

// DICOM打印参数预设
const DICOM_PRESETS = [
  { id: 'DP001', name: t("printMgmt.stdDicomPrint"), orientation: 'PORTRAIT', mediumType: 'BLUE FILM', filmDestination: 'MAGAZINE', trimming: 'NO' },
  { id: 'DP002', name: t("printMgmt.highContrastPrint"), orientation: 'LANDSCAPE', mediumType: 'CLEAR FILM', filmDestination: 'PROCESSOR', trimming: 'YES' },
  { id: 'DP003', name: t("printMgmt.mammoPrint"), orientation: 'PORTRAIT', mediumType: 'MAMMO BLUE', filmDestination: 'MAGAZINE', trimming: 'NO' },
]

const MEDIUM_TYPE_LABELS: Record<string, string> = {
  'BLUE FILM': t("printMgmt.blueBaseFilm"),
  'CLEAR FILM': t("printMgmt.clearFilm"),
  'MAMMO BLUE': t("printMgmt.mammoBlueFilm"),
}

// 报告打印模板
const REPORT_TEMPLATES = [
  { id: 'RT001', name: t("printMgmt.stdCtReport"), type: 'CT', copies: 1, includeImages: true, includeLogo: true },
  { id: 'RT002', name: t("printMgmt.stdMrReport"), type: 'MR', copies: 1, includeImages: true, includeLogo: true },
  { id: 'RT003', name: t("printMgmt.drBriefReport"), type: 'DR', copies: 1, includeImages: false, includeLogo: true },
  { id: 'RT004', name: t("printMgmt.interventionReport"), type: t("printMgmt.intervention"), copies: 2, includeImages: true, includeLogo: true },
  { id: 'RT005', name: t("printMgmt.emergencyReport"), type: t("printMgmt.emergency"), copies: 2, includeImages: true, includeLogo: false },
]

// 打印队列数据
const PRINT_QUEUE = [
  { id: 'PQ001', patientId: 'P20260501001', patientName: '张三', modality: 'CT', studyDesc: t("printMgmt.examChestCt"), filmSpec: '14x17', copies: 1, status: 'printing', printer: 'P001', requestTime: '2026-05-02 10:30:00', progress: 65 },
  { id: 'PQ002', patientId: 'P20260501002', patientName: '李四', modality: 'MR', studyDesc: t("printMgmt.examHeadMr"), filmSpec: '14x14', copies: 1, status: 'queued', printer: 'P002', requestTime: '2026-05-02 10:25:00', progress: 0 },
  { id: 'PQ003', patientId: 'P20260501003', patientName: '王五', modality: 'DR', studyDesc: t("printMgmt.examChestDr"), filmSpec: '10x12', copies: 2, status: 'queued', printer: 'P001', requestTime: '2026-05-02 10:20:00', progress: 0 },
  { id: 'PQ004', patientId: 'P20260501004', patientName: '赵六', modality: 'CT', studyDesc: t("printMgmt.examAbdCtEnhance"), filmSpec: '14x17', copies: 1, status: 'completed', printer: 'P001', requestTime: '2026-05-02 09:45:00', progress: 100 },
  { id: 'PQ005', patientId: 'P20260501005', patientName: '钱七', modality: 'CT', studyDesc: t("printMgmt.examChestCt"), filmSpec: '14x17', copies: 1, status: 'error', printer: 'P002', requestTime: '2026-05-02 09:30:00', progress: 30, errorMsg: t("printMgmt.printerOutOfPaper") },
]

// 打印记录数据
const PRINT_HISTORY = [
  { id: 'PH001', patientId: 'P20260501004', patientName: '赵六', modality: 'CT', studyDesc: t("printMgmt.examAbdCtEnhance"), filmSpec: '14x17', copies: 1, pages: 2, printer: t("printMgmt.printerKonica1"), operator: '李医生', printTime: '2026-05-02 09:50:00', status: 'success', cost: 25.0 },
  { id: 'PH002', patientId: 'P20260501006', patientName: '孙八', modality: 'MR', studyDesc: t("printMgmt.examLumbarMr"), filmSpec: '14x17', copies: 1, pages: 4, printer: t("printMgmt.printerKonica2"), operator: '王医生', printTime: '2026-05-02 09:35:00', status: 'success', cost: 50.0 },
  { id: 'PH003', patientId: 'P20260501007', patientName: '周九', modality: 'DR', studyDesc: t("printMgmt.examChestDrAP"), filmSpec: '10x12', copies: 1, pages: 1, printer: t("printMgmt.printerFuji"), operator: '李医生', printTime: '2026-05-02 09:20:00', status: 'success', cost: 12.5 },
  { id: 'PH004', patientId: 'P20260501008', patientName: '吴十', modality: 'CT', studyDesc: t("printMgmt.examHeadCt"), filmSpec: '14x17', copies: 1, pages: 2, printer: t("printMgmt.printerKonica1"), operator: '张医生', printTime: '2026-05-02 08:55:00', status: 'success', cost: 25.0 },
  { id: 'PH005', patientId: 'P20260501009', patientName: '郑十一', modality: 'CT', studyDesc: t("printMgmt.examLungCtLowDose"), filmSpec: '14x17', copies: 1, pages: 2, printer: t("printMgmt.printerKonica1"), operator: '李医生', printTime: '2026-05-02 08:40:00', status: 'success', cost: 25.0 },
]

// 胶片使用量统计数据
const FILM_USAGE_STATS = [
  { date: '04-26', films14x17: 45, films10x12: 22, films8x10: 8, total: 75, cost: 937.5 },
  { date: '04-27', films14x17: 52, films10x12: 18, films8x10: 12, total: 82, cost: 1025.0 },
  { date: '04-28', films14x17: 38, films10x12: 25, films8x10: 5, total: 68, cost: 850.0 },
  { date: '04-29', films14x17: 61, films10x12: 30, films8x10: 15, total: 106, cost: 1325.0 },
  { date: '04-30', films14x17: 55, films10x12: 28, films8x10: 10, total: 93, cost: 1162.5 },
  { date: '05-01', films14x17: 48, films10x12: 20, films8x10: 8, total: 76, cost: 950.0 },
  { date: '05-02', films14x17: 42, films10x12: 24, films8x10: 6, total: 72, cost: 900.0 },
]

// 设备打印量统计
const DEVICE_PRINT_STATS = [
  { device: 'CT-1', printCount: 156, totalFilms: 312, cost: 3900 },
  { device: 'CT-2', printCount: 142, totalFilms: 284, cost: 3550 },
  { device: 'MR-1', printCount: 98, totalFilms: 392, cost: 4900 },
  { device: 'DR-1', printCount: 210, totalFilms: 210, cost: 2625 },
  { device: 'DR-2', printCount: 185, totalFilms: 185, cost: 2312.5 },
]

// 耗材成本分析
const CONSUMABLE_COSTS = [
  { name: t("printMgmt.film14x17"), unit: t("printMgmt.sheetsUnit"), price: 12.5, used: 341, total: 4262.5 },
  { name: t("printMgmt.film10x12"), unit: t("printMgmt.sheetsUnit"), price: 10.0, used: 167, total: 1670 },
  { name: t("printMgmt.film8x10"), unit: t("printMgmt.sheetsUnit"), price: 8.0, used: 64, total: 512 },
  { name: t("printMgmt.a4Paper"), unit: t("printMgmt.sheetsUnit"), price: 0.3, used: 520, total: 156 },
]

// 打印效率统计
const EFFICIENCY_STATS = [
  { hour: '08:00', avgTime: 45, completed: 5 },
  { hour: '09:00', avgTime: 38, completed: 12 },
  { hour: '10:00', avgTime: 42, completed: 18 },
  { hour: '11:00', avgTime: 35, completed: 15 },
  { hour: '12:00', avgTime: 50, completed: 8 },
  { hour: '13:00', avgTime: 40, completed: 10 },
  { hour: '14:00', avgTime: 36, completed: 14 },
  { hour: '15:00', avgTime: 33, completed: 16 },
  { hour: '16:00', avgTime: 38, completed: 13 },
]

// ============================================================
// DICOM打印队列数据 (20条虚构数据)
// ============================================================

// DICOM打印服务器配置
const DICOM_SERVERS = [
  { id: 'DCS001', name: t("printMgmt.serverPrimary"), ip: '192.168.1.100', port: 11112, status: 'online', aet: 'PRINT_SERVER', description: t("printMgmt.primaryPrintServer") },
  { id: 'DCS002', name: t("printMgmt.serverBackup"), ip: '192.168.1.101', port: 11112, status: 'online', aet: 'PRINT_SERVER_BAK', description: t("printMgmt.backupPrintServer") },
]

// DICOM打印机列表
const DICOM_PRINTERS = [
  { id: 'DP001', name: t("printMgmt.printerKonicaHash1"), serverId: 'DCS001', status: 'online', location: t("printMgmt.roomCt1"), filmsToday: 45 },
  { id: 'DP002', name: t("printMgmt.printerKonicaHash2"), serverId: 'DCS001', status: 'online', location: t("printMgmt.roomMr"), filmsToday: 38 },
  { id: 'DP003', name: t("printMgmt.printerFuji"), serverId: 'DCS001', status: 'online', location: t("printMgmt.roomDr"), filmsToday: 62 },
  { id: 'DP004', name: t("printMgmt.printerGe"), serverId: 'DCS002', status: 'offline', location: t("printMgmt.roomPlainFilm"), filmsToday: 0 },
  { id: 'DP005', name: t("printMgmt.printerPhilips"), serverId: 'DCS002', status: 'online', location: 'ICU', filmsToday: 28 },
]

// 胶片规格选项
const FILM_SPEC_OPTIONS = [
  { value: '14x17', label: t("printMgmt.size14x17Cm") },
  { value: '10x12', label: t("printMgmt.size10x12Cm") },
  { value: '8x10', label: t("printMgmt.size8x10Cm") },
  { value: 'A4_LANDSCAPE', label: t("printMgmt.a4Landscape") },
  { value: 'CUSTOM', label: t("printMgmt.custom") },
]

// 介质类型选项
const MEDIUM_TYPES = [
  { value: 'BLUE_FILM', label: t("printMgmt.blueBaseFilm") },
  { value: 'CLEAR_FILM', label: t("printMgmt.clearFilm") },
  { value: 'PAPER', label: t("printMgmt.paper") },
]

// DICOM打印队列表格 - 20条虚构数据
const DICOM_PRINT_TASKS: Array<{
  id: string;
  patientId: string;
  patientName: string;
  modality: string;
  studyType: string;
  filmSpec: string;
  copies: number;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  submitTime: string;
  completeTime: string | null;
  printer: string;
  mediumType: string;
}> = [
  { id: 'DPT001', patientId: 'P20260502001', patientName: '王建国', modality: 'CT', studyType: t("printMgmt.examChestCt"), filmSpec: '14×17', copies: 1, status: 'printing', submitTime: '2026-05-03 08:30:00', completeTime: null, printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT002', patientId: 'P20260502002', patientName: '刘淑芳', modality: 'MR', studyType: t("printMgmt.examHeadMr"), filmSpec: '14×17', copies: 1, status: 'queued', submitTime: '2026-05-03 08:25:00', completeTime: null, printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT003', patientId: 'P20260502003', patientName: '陈志强', modality: 'DR', studyType: t("printMgmt.examChestDr"), filmSpec: '10×12', copies: 2, status: 'queued', submitTime: '2026-05-03 08:20:00', completeTime: null, printer: t("printMgmt.fuji"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT004', patientId: 'P20260502004', patientName: '赵秀英', modality: 'CT', studyType: t("printMgmt.examAbdCtEnhance"), filmSpec: '14×17', copies: 1, status: 'completed', submitTime: '2026-05-03 08:00:00', completeTime: '2026-05-03 08:05:23', printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT005', patientId: 'P20260502005', patientName: '孙伟东', modality: 'CT', studyType: t("printMgmt.examChestCt"), filmSpec: '14×17', copies: 1, status: 'failed', submitTime: '2026-05-03 07:55:00', completeTime: '2026-05-03 08:00:10', printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT006', patientId: 'P20260502006', patientName: '周丽华', modality: 'MR', studyType: t("printMgmt.examLumbarMr"), filmSpec: '14×17', copies: 1, status: 'completed', submitTime: '2026-05-03 07:50:00', completeTime: '2026-05-03 07:56:45', printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT007', patientId: 'P20260502007', patientName: '吴敏', modality: 'DR', studyType: t("printMgmt.examKneeDr"), filmSpec: '8×10', copies: 1, status: 'queued', submitTime: '2026-05-03 07:45:00', completeTime: null, printer: t("printMgmt.fuji"), mediumType: t("printMgmt.clearFilm") },
  { id: 'DPT008', patientId: 'P20260502008', patientName: '郑海涛', modality: 'CT', studyType: t("printMgmt.examHeadCt"), filmSpec: '14×17', copies: 1, status: 'completed', submitTime: '2026-05-03 07:30:00', completeTime: '2026-05-03 07:35:18', printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT009', patientId: 'P20260502009', patientName: '黄晓燕', modality: 'MR', studyType: t("printMgmt.examShoulderMr"), filmSpec: '10×12', copies: 2, status: 'queued', submitTime: '2026-05-03 07:25:00', completeTime: null, printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.clearFilm") },
  { id: 'DPT010', patientId: 'P20260502010', patientName: '杨建军', modality: 'CT', studyType: t("printMgmt.examLungCtLowDose"), filmSpec: '14×17', copies: 1, status: 'printing', submitTime: '2026-05-03 07:20:00', completeTime: null, printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT011', patientId: 'P20260502011', patientName: '林淑珍', modality: 'DR', studyType: t("printMgmt.examChestDrAP"), filmSpec: '10×12', copies: 1, status: 'completed', submitTime: '2026-05-03 07:15:00', completeTime: '2026-05-03 07:20:33', printer: t("printMgmt.fuji"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT012', patientId: 'P20260502012', patientName: '徐志远', modality: 'CT', studyType: t("printMgmt.examAbdCt"), filmSpec: '14×17', copies: 1, status: 'queued', submitTime: '2026-05-03 07:10:00', completeTime: null, printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT013', patientId: 'P20260502013', patientName: '马晓丽', modality: 'MR', studyType: t("printMgmt.examPelvisMr"), filmSpec: '14×17', copies: 1, status: 'completed', submitTime: '2026-05-03 07:00:00', completeTime: '2026-05-03 07:08:52', printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT014', patientId: 'P20260502014', patientName: '朱强', modality: 'DR', studyType: t("printMgmt.examWristDr"), filmSpec: '8×10', copies: 1, status: 'failed', submitTime: '2026-05-03 06:55:00', completeTime: '2026-05-03 06:58:20', printer: t("printMgmt.fuji"), mediumType: t("printMgmt.paper") },
  { id: 'DPT015', patientId: 'P20260502015', patientName: '胡文静', modality: 'CT', studyType: t("printMgmt.examNeckCt"), filmSpec: '14×17', copies: 1, status: 'completed', submitTime: '2026-05-03 06:50:00', completeTime: '2026-05-03 06:55:41', printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT016', patientId: 'P20260502016', patientName: '郭永强', modality: 'MR', studyType: t("printMgmt.examKneeMr"), filmSpec: '10×12', copies: 1, status: 'queued', submitTime: '2026-05-03 06:45:00', completeTime: null, printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.clearFilm") },
  { id: 'DPT017', patientId: 'P20260502017', patientName: '林志豪', modality: 'CT', studyType: t("printMgmt.examCardiacCta"), filmSpec: '14×17', copies: 2, status: 'printing', submitTime: '2026-05-03 06:40:00', completeTime: null, printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.clearFilm") },
  { id: 'DPT018', patientId: 'P20260502018', patientName: '张美玲', modality: 'DR', studyType: t("printMgmt.examLumbarDr"), filmSpec: '10×12', copies: 2, status: 'completed', submitTime: '2026-05-03 06:35:00', completeTime: '2026-05-03 06:42:15', printer: t("printMgmt.fuji"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT019', patientId: 'P20260502019', patientName: '李志鹏', modality: 'CT', studyType: t("printMgmt.examPancreasCt"), filmSpec: '14×17', copies: 1, status: 'queued', submitTime: '2026-05-03 06:30:00', completeTime: null, printer: t("printMgmt.konicaShort1"), mediumType: t("printMgmt.blueBaseFilm") },
  { id: 'DPT020', patientId: 'P20260502020', patientName: '赵雅琴', modality: 'MR', studyType: t("printMgmt.examBreastMr"), filmSpec: '14×17', copies: 1, status: 'queued', submitTime: '2026-05-03 06:25:00', completeTime: null, printer: t("printMgmt.konicaShort2"), mediumType: t("printMgmt.clearFilm") },
]

// 打印计费配置 - 各规格单价
const FILM_PRICE_CONFIG: Array<{ spec: string; pricePerSheet: number; unit: string }> = [
  { spec: t("printMgmt.size14x17"), pricePerSheet: 25.0, unit: t("printMgmt.yuanPerSheet") },
  { spec: t("printMgmt.size10x12"), pricePerSheet: 20.0, unit: t("printMgmt.yuanPerSheet") },
  { spec: t("printMgmt.size8x10"), pricePerSheet: 15.0, unit: t("printMgmt.yuanPerSheet") },
  { spec: t("printMgmt.a4Landscape"), pricePerSheet: 5.0, unit: t("printMgmt.yuanPerSheet") },
  { spec: t("printMgmt.custom"), pricePerSheet: 30.0, unit: t("printMgmt.yuanPerSheet") },
]

// 科室计费统计数据
const DEPARTMENT_BILLING: Array<{ dept: string; patientCount: number; filmCount: number; amount: number }> = [
  { dept: t("printMgmt.roomCt"), patientCount: 156, filmCount: 312, amount: 7800.0 },
  { dept: t("printMgmt.roomMr2"), patientCount: 98, filmCount: 294, amount: 7350.0 },
  { dept: t("printMgmt.roomDr2"), patientCount: 210, filmCount: 315, amount: 6300.0 },
  { dept: t("printMgmt.roomPlain"), patientCount: 85, filmCount: 102, amount: 2040.0 },
  { dept: 'ICU', patientCount: 28, filmCount: 56, amount: 1400.0 },
]

// 打印成本报表数据
const COST_REPORT: Array<{ date: string; filmCost: number; paperCost: number; inkCost: number; total: number }> = [
  { date: '2026-04-27', filmCost: 1025.0, paperCost: 45.0, inkCost: 120.0, total: 1190.0 },
  { date: '2026-04-28', filmCost: 850.0, paperCost: 38.0, inkCost: 95.0, total: 983.0 },
  { date: '2026-04-29', filmCost: 1325.0, paperCost: 52.0, inkCost: 140.0, total: 1517.0 },
  { date: '2026-04-30', filmCost: 1162.5, paperCost: 48.0, inkCost: 125.0, total: 1335.5 },
  { date: '2026-05-01', filmCost: 950.0, paperCost: 42.0, inkCost: 110.0, total: 1102.0 },
  { date: '2026-05-02', filmCost: 900.0, paperCost: 40.0, inkCost: 105.0, total: 1045.0 },
  { date: '2026-05-03', filmCost: 875.0, paperCost: 35.0, inkCost: 98.0, total: 1008.0 },
]

// ============================================================
// 打印布局模板数据
// ============================================================
const PRINT_LAYOUT_TEMPLATES = [
  { id: 'LT001', name: t("printMgmt.layout4in1Std"), cols: 2, rows: 2, total: 4, orientation: 'PORTRAIT', preset: true, thumbnail: '4in1' },
  { id: 'LT002', name: t("printMgmt.layout6in1Compact"), cols: 3, rows: 2, total: 6, orientation: 'LANDSCAPE', preset: true, thumbnail: '6in1' },
  { id: 'LT003', name: t("printMgmt.layout8in1Dense"), cols: 4, rows: 2, total: 8, orientation: 'PORTRAIT', preset: true, thumbnail: '8in1' },
  { id: 'LT004', name: t("printMgmt.layout2in1Wide"), cols: 2, rows: 1, total: 2, orientation: 'LANDSCAPE', preset: true, thumbnail: '2in1' },
  { id: 'LT005', name: t("printMgmt.customLayout"), cols: 3, rows: 3, total: 9, orientation: 'PORTRAIT', preset: false, thumbnail: 'custom' },
]

// 科室打印配额数据
const DEPT_PRINT_QUOTAS = [
  { dept: t("printMgmt.roomCt"), monthlyQuota: 2000, current: 1450, budget: 50000, spent: 36250, status: 'normal', alertThreshold: 80 },
  { dept: t("printMgmt.roomMr2"), monthlyQuota: 1500, current: 1120, budget: 45000, spent: 33600, status: 'normal', alertThreshold: 80 },
  { dept: t("printMgmt.roomDr2"), monthlyQuota: 2500, current: 2100, budget: 30000, spent: 26250, status: 'warning', alertThreshold: 80 },
  { dept: t("printMgmt.roomPlain"), monthlyQuota: 800, current: 520, budget: 12000, spent: 7800, status: 'normal', alertThreshold: 80 },
  { dept: 'ICU', monthlyQuota: 300, current: 280, budget: 7500, spent: 7000, status: 'critical', alertThreshold: 80 },
  { dept: t("printMgmt.emergency"), monthlyQuota: 600, current: 590, budget: 15000, spent: 14750, status: 'critical', alertThreshold: 80 },
]

// 配额增加请求历史
const QUOTA_REQUESTS = [
  { id: 'QR001', dept: t("printMgmt.roomDr2"), requestedAmount: 500, reason: t("printMgmt.noteCheckupSeason"), status: 'approved', requestDate: '2026-04-25', approvedDate: '2026-04-26' },
  { id: 'QR002', dept: 'ICU', requestedAmount: 200, reason: t("printMgmt.noteIcuExpansion"), status: 'pending', requestDate: '2026-04-28', approvedDate: null },
  { id: 'QR003', dept: t("printMgmt.emergency"), requestedAmount: 300, reason: t("printMgmt.noteEmergencyGrowth"), status: 'pending', requestDate: '2026-04-29', approvedDate: null },
]

// 每月成本趋势数据
const MONTHLY_COST_TREND = [
  { month: t("printMgmt.jan"), ct: 4800, mr: 5200, dr: 3200, other: 1800, total: 15000 },
  { month: t("printMgmt.feb"), ct: 4200, mr: 4800, dr: 2800, other: 1500, total: 13300 },
  { month: t("printMgmt.mar"), ct: 5100, mr: 5500, dr: 3500, other: 2000, total: 16100 },
  { month: t("printMgmt.apr"), ct: 5300, mr: 5800, dr: 3700, other: 2200, total: 17000 },
  { month: t("printMgmt.may"), ct: 4900, mr: 5400, dr: 3400, other: 1900, total: 15600 },
  { month: t("printMgmt.jun"), ct: 5500, mr: 6000, dr: 3800, other: 2300, total: 17600 },
]

// 打印机成本数据
const PRINTER_COST_DATA = [
  { printer: t("printMgmt.konicaHash1"), films: 420, costPerPrint: 12.5, totalCost: 5250, deptCost: { CT: 2800, MR: 1200, DR: 1250 } },
  { printer: t("printMgmt.konicaHash2"), films: 380, costPerPrint: 12.5, totalCost: 4750, deptCost: { CT: 800, MR: 3500, DR: 450 } },
  { printer: t("printMgmt.fuji"), films: 310, costPerPrint: 10.0, totalCost: 3100, deptCost: { CT: 500, MR: 300, DR: 2300 } },
  { printer: 'GE', films: 180, costPerPrint: 15.0, totalCost: 2700, deptCost: { CT: 1800, MR: 0, DR: 900 } },
  { printer: t("printMgmt.philips"), films: 250, costPerPrint: 12.5, totalCost: 3125, deptCost: { CT: 1200, MR: 925, DR: 1000 } },
]

// ============================================================
// 辅助函数
// ============================================================

// 获取状态颜色
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online': return C.success
    case 'offline': return C.danger
    case 'printing': return C.info
    case 'queued': return C.warning
    case 'completed': return C.success
    case 'failed': return C.danger
    case 'error': return C.danger
    default: return C.textLight
  }
}

// 获取状态文本
const getStatusText = (status: string): string => {
  switch (status) {
    case 'online': return t("printMgmt.online")
    case 'offline': return t("printMgmt.offline")
    case 'printing': return t("printMgmt.printing")
    case 'queued': return t("printMgmt.queued")
    case 'completed': return t("printMgmt.completed")
    case 'failed': return t("printMgmt.failed")
    case 'error': return t("printMgmt.error")
    default: return t("printMgmt.unknown")
  }
}

// 获取设备图标
const getModalityIcon = (modality: string): React.ReactNode => {
  switch (modality) {
    case 'CT': return <Monitor size={16} />
    case 'MR': return <Layers size={16} />
    case 'DR': return <HardDrive size={16} />
    default: return <Printer size={16} />
  }
}

// ============================================================
// 卡片组件
// ============================================================
interface CardProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ title, icon, children, style }) => (
  <div style={{
    background: 'var(--bg-card)',
    borderRadius: 6,
    padding: 'var(--space-4, 16px)',
    marginBottom: 'var(--space-3, 12px)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: `1px solid ${C.border}`,
    ...style
  }}>
    {title && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
        marginBottom: 'var(--space-3, 12px)', paddingBottom: 'var(--space-2, 8px)',
        borderBottom: `1px solid ${C.border}`
      }}>
        {icon && <span style={{ color: C.primary }}>{icon}</span>}
        <span style={{ fontWeight: 600, fontSize: 14, color: C.textDark }}>{title}</span>
      </div>
    )}
    {children}
  </div>
)

// 标签页组件
interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => (
  <div style={{
    display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-4, 16px)',
    background: C.bg, borderRadius: 6, padding: 'var(--space-1, 4px)'
  }}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        style={{
          flex: 1, padding: '8px 12px', border: 'none', borderRadius: 4,
          cursor: 'pointer', fontSize: 12, fontWeight: 500,
          background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
          color: activeTab === tab.id ? C.primary : C.textMid,
          boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ marginRight: 6 }}>{tab.icon}</span>
        {tab.label}
      </button>
    ))}
  </div>
)

// 状态标签组件
interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500,
    background: `${getStatusColor(status)}20`,
    color: getStatusColor(status)
  }}>
    {status === 'online' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusColor(status) }} />}
    {getStatusText(status)}
  </span>
)

// 进度条组件
interface ProgressBarProps {
  progress: number;
  color?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color }) => (
  <div style={{ width: '100%', height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
    <div style={{
      width: `${progress}%`, height: '100%',
      background: color || C.primary,
      borderRadius: 3, transition: 'width 0.3s'
    }} />
  </div>
)

// 搜索栏组件
interface SearchBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder }) => (
  <div style={{ position: 'relative', flex: 1 }}>
    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textLight }} />
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', paddingLeft: 34, paddingRight: 'var(--space-3, 12px)', paddingTop: 'var(--space-2, 8px)', paddingBottom: 'var(--space-2, 8px)',
        border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, boxSizing: 'border-box'
      }}
    />
  </div>
)

// ============================================================
// 主组件
// ============================================================
export default function PrintManagementPage() {
  // 状态定义
  const [activeSection, setActiveSection] = useState<string>('printConfig')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null)
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false)
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false)
  const [previewItem, setPreviewItem] = useState<any>(null)

  // [G005 Wave2A P0] 打印机受控表单 + 保存/删除中状态
  const [printerForm, setPrinterForm] = useState<any>({ name: '', location: '', type: 'network', filmSpec: '14x17', defaultCopies: 1, dpi: 300, aet: '', host: '', port: 104 })
  const [savingPrinter, setSavingPrinter] = useState<boolean>(false)
  const [deletingPrinterId, setDeletingPrinterId] = useState<string>('')

  // [G005 Wave2A P1] DICOM 预设受控编辑 (localStorage 持久化)
  const [presetEditOpen, setPresetEditOpen] = useState<boolean>(false)
  const [presetForm, setPresetForm] = useState<any>({ name: '', filmSize: '14x17', orientation: 'PORTRAIT', mediumType: 'BLUE FILM', filmDestination: 'MAGAZINE', trimming: 'NO' })

  // [G005 Wave2A P1] 模板预览弹窗 (胶片布局模拟)
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState<boolean>(false)
  const [templatePreviewItem, setTemplatePreviewItem] = useState<any>(null)

  // 打印配置相关状态 ([W2-B] 真实化: deviceApi/printApi, 失败回退静态演示数据)
  const [printers, setPrinters] = useState(PRINTERS)
  const [filmSpecs] = useState(FILM_SPECS)
  // [G005 Wave2A P1] 预设可编辑 + localStorage 持久化
  const [dicomPresets, setDicomPresets] = useState<typeof DICOM_PRESETS>(() => {
    try {
      const raw = localStorage.getItem('g005_dicom_presets')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { /* ignore */ }
    return DICOM_PRESETS
  })
  const [reportTemplates] = useState(REPORT_TEMPLATES)
  const [printQueue, setPrintQueue] = useState(PRINT_QUEUE)
  const [printHistory, setPrintHistory] = useState(PRINT_HISTORY)

  // 统计相关状态 ([W2-B] printApi.getStats → filmUsage/devicePrint/costReport)
  const [filmUsageStats, setFilmUsageStats] = useState(FILM_USAGE_STATS)
  const [devicePrintStats, setDevicePrintStats] = useState(DEVICE_PRINT_STATS)
  const [costReport, setCostReport] = useState(COST_REPORT)
  const [_consumableCosts] = useState(CONSUMABLE_COSTS)
  const [_efficiencyStats] = useState(EFFICIENCY_STATS)

  // [W2-B] DICOM 打印任务 (printApi 队列+历史合并)
  const [dicomTasks, setDicomTasks] = useState(DICOM_PRINT_TASKS)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'api' | 'static'>('api')

  // [G005 Wave1B] 打印机面板: printApi.listPrinters (GET /print/printers) + 任务详情 printApi.getJob
  const [printersApi, setPrintersApi] = useState<Array<{ id: string; name: string; status: 'online' | 'offline'; location: string; filmsToday: number }>>([])
  const [taskDetail, setTaskDetail] = useState<any>(null)
  const [taskDetailLoading, setTaskDetailLoading] = useState(false)

  // 配置默认值
  const [defaultCopies, setDefaultCopies] = useState<number>(1)
  const [defaultFilmSpec, setDefaultFilmSpec] = useState<string>('14x17')
  const [selectedPreset, setSelectedPreset] = useState<string>('DP001')

  // 批量打印选中
  const [selectedQueueItems, setSelectedQueueItems] = useState<string[]>([])

  // 模板预览/编辑状态
  const [_previewTemplate, _setPreviewTemplate] = useState<any>(null)

  // 刷新/暂停队列状态
  const [queuePaused, setQueuePaused] = useState<boolean>(false)

  // Toast状态
  const [toastMessage, setToastMessage] = useState<string>('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')
  const [showToast, setShowToast] = useState<boolean>(false)

  // 确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'primary' | 'danger';
  }>({ show: false, title: '', message: '', onConfirm: () => {} })

  // 模板编辑弹窗状态
  const [showTemplateEditModal, setShowTemplateEditModal] = useState<boolean>(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [isNewTemplate, setIsNewTemplate] = useState<boolean>(false)

  // 显示Toast的辅助函数
  const displayToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // 自定义布局构建器状态
  const [customCols, setCustomCols] = useState<number>(3)
  const [customRows, setCustomRows] = useState<number>(3)
  const [customOrientation, setCustomOrientation] = useState<string>('PORTRAIT')
  const [savingCustomTemplate, setSavingCustomTemplate] = useState<boolean>(false)

  // [v3.0.6.11-98 Wave3B P1] 额度申请 Modal (科室/张数/用途 → localStorage 记录 + 标注)
  const [quotaModalOpen, setQuotaModalOpen] = useState<boolean>(false)
  const [quotaForm, setQuotaForm] = useState({ dept: DEPT_PRINT_QUOTAS[0]?.dept ?? t("printMgmt.roomCt"), requestedAmount: 100, reason: '' })
  const [quotaSaving, setQuotaSaving] = useState<boolean>(false)
  const [quotaRequests, setQuotaRequests] = useState<any[]>(QUOTA_REQUESTS)

  const handleSaveCustomTemplate = async () => {
    setSavingCustomTemplate(true)
    try {
      const res = await templatesApi.create({
        name: `自定义 ${customCols}×${customRows} ${customOrientation === 'PORTRAIT' ? t("printMgmt.portrait") : t("printMgmt.landscape")}`,
        category: 'print-layout',
        bodyPart: t("printMgmt.general"),
        body: JSON.stringify({ cols: customCols, rows: customRows, orientation: customOrientation, type: 'print-layout' }),
        createdById: 'current-user',
        tags: [t("printMgmt.printLayout")],
      })
      if (res.success) {
        displayToast(t('w9b.printMgmt.templateSaved', { name: res.data.name }), 'success')
      } else {
        displayToast(res.error?.message ?? t("printMgmt.templateSaveFailed"), 'error')
      }
    } catch {
      displayToast(t("printMgmt.templateSaveFailedRetry"), 'error')
    } finally {
      setSavingCustomTemplate(false)
    }
  }

  // DICOM打印队列相关状态
  const [dicomQueueSearch, setDicomQueueSearch] = useState<string>('')
  const [selectedFilmSpec, setSelectedFilmSpec] = useState<string>('14x17')
  const [selectedMediumType, setSelectedMediumType] = useState<string>('BLUE_FILM')
  const [printCopies, setPrintCopies] = useState<number>(1)
  const [customFilmWidth, setCustomFilmWidth] = useState<string>('')
  const [customFilmHeight, setCustomFilmHeight] = useState<string>('')

  // 统计卡片数据
  const todayPrints = printHistory.filter(p => p.printTime.startsWith('2026-05-02')).length
  const todayFilms = filmUsageStats.find(f => f.date === '05-02')?.total || 0
  const todayCost = filmUsageStats.find(f => f.date === '05-02')?.cost || 0
  const activePrinters = printers.filter(p => p.status === 'online').length

  // [W2-B] 真实化: 打印机=deviceApi, 队列/历史/统计=printApi; 失败回退静态演示数据
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setDataLoading(true)
      setDataError(null)
      try {
        const [devicesRes, queueRes, historyRes, statsRes, printersRes] = await Promise.all([
          deviceApi.list({ take: 50 }),
          printApi.listQueue(),
          printApi.listHistory(),
          printApi.getStats(),
          printApi.listPrinters(),
        ])
        if (cancelled) return
        let ok = false
        // [G005 Wave1B] 打印机面板数据源: printApi.listPrinters 优先, 空则回退 deviceApi
        if (printersRes.success && Array.isArray(printersRes.data) && printersRes.data.length > 0) {
          setPrintersApi(printersRes.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status === 'online' ? 'online' : 'offline',
            location: p.location ?? '',
            filmsToday: 0,
          })))
          ok = true
        }
        if (devicesRes.success && Array.isArray(devicesRes.data) && devicesRes.data.length > 0) {
          setPrinters(devicesRes.data.map((d: any) => ({
            id: d.id,
            name: d.name || (d.brand && d.model ? `${d.brand} ${d.model}` : '') || d.code || d.id || t("printMgmt.printer"),
            type: d.modality === 'DR' || d.modality === 'CR' ? 'local' : 'network',
            status: (d.status === '维护中' || d.status === '故障' || d.status === 'MAINTENANCE' || d.status === 'BROKEN' || d.status === 'OFFLINE') ? 'offline' : 'online',
            location: d.room ?? d.roomId ?? '',
            filmSpec: '14x17',
            defaultCopies: 1,
            dpi: 300,
          })))
          ok = true
        }
        if (queueRes.success && Array.isArray(queueRes.data)) {
          setPrintQueue(queueRes.data.map((t) => ({
            id: t.id,
            patientId: t.patientId ?? '',
            patientName: t.patientName,
            modality: t.modality ?? 'CT',
            studyDesc: t.studyType ?? '胶片打印',
            filmSpec: t.filmSpec ?? '14x17',
            copies: t.copies ?? 1,
            status: t.status === 'printing' ? 'printing' : t.status === 'failed' ? 'error' : t.status === 'completed' ? 'completed' : 'queued',
            printer: t.printer ?? 'P001',
            requestTime: t.submitTime,
            progress: t.progress ?? 0,
            errorMsg: t.errorMsg,
          })))
          ok = true
        }
        if (historyRes.success && Array.isArray(historyRes.data)) {
          setPrintHistory(historyRes.data.map((t) => ({
            id: t.id,
            patientId: t.patientId ?? '',
            patientName: t.patientName,
            modality: t.modality ?? 'CT',
            studyDesc: t.studyType ?? '胶片打印',
            filmSpec: t.filmSpec ?? '14x17',
            copies: t.copies ?? 1,
            pages: t.copies ?? 1,
            printer: t.printer ?? 'DICOM 打印机',
            operator: '系统',
            printTime: t.submitTime,
            status: t.status === 'completed' ? 'success' : 'error',
            cost: 0,
          })))
          ok = true
        }
        if (statsRes.success && statsRes.data) {
          if (Array.isArray(statsRes.data.filmUsage) && statsRes.data.filmUsage.length > 0) setFilmUsageStats(statsRes.data.filmUsage)
          if (Array.isArray(statsRes.data.devicePrint) && statsRes.data.devicePrint.length > 0) setDevicePrintStats(statsRes.data.devicePrint)
          if (Array.isArray(statsRes.data.costReport) && statsRes.data.costReport.length > 0) setCostReport(statsRes.data.costReport)
          ok = true
        }
        if (ok) { setDataSource('api'); setDataError(null) }
        else setDataError(t("printMgmt.apiUnavailable"))
      } catch {
        if (!cancelled) setDataError(t("printMgmt.loadFailedDemo"))
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // [W2-B] DICOM 打印任务: /print/jobs(任务列表) + /print/queue + /print/history 合并
  // [G005 Wave1A P0] 接入 printApi.listJobs / listQueues / reprintJob
  const [serverQueues, setServerQueues] = useState<number>(0)
  const [reprintingId, setReprintingId] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [j, q, h, qs] = await Promise.all([
        printApi.listJobs(),
        printApi.listQueue(),
        printApi.listHistory(),
        printApi.listQueues(),
      ])
      if (cancelled) return
      if (qs.success && Array.isArray(qs.data)) setServerQueues(qs.data.length)
      const all: typeof DICOM_PRINT_TASKS = []
      const push = (t: any) => {
        all.push({
          id: t.id,
          patientId: t.patientId ?? '',
          patientName: t.patientName,
          modality: t.modality ?? 'CT',
          studyType: t.studyType ?? '胶片打印',
          filmSpec: t.filmSpec ?? '14×17',
          copies: t.copies ?? 1,
          status: (t.status === 'queued' || t.status === 'printing' || t.status === 'completed' || t.status === 'failed') ? t.status : 'queued',
          submitTime: t.submitTime,
          completeTime: t.completeTime ?? null,
          printer: t.printer ?? '',
          mediumType: '蓝基胶片',
        })
      }
      if (j.success && Array.isArray(j.data)) j.data.forEach((t: any) => push(t))
      if (q.success && Array.isArray(q.data)) q.data.forEach((t: any) => push(t))
      if (h.success && Array.isArray(h.data)) h.data.forEach((t: any) => push(t))
      if (all.length > 0) {
        const seen = new Set<string>()
        setDicomTasks(all.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))))
      }
    })()
    return () => { cancelled = true }
  }, [])

  // [G005 Wave1A P0] 重新打印: POST /print/jobs/:id/reprint (后端新建任务)
  const handleReprintJob = async (taskId: string) => {
    setReprintingId(taskId)
    try {
      const res = await printApi.reprintJob(taskId)
      if (res.success) {
        displayToast(t('w9b.printMgmt.jobResubmitted', { id: res.data?.id ?? taskId }), 'success')
        handleRefreshQueue()
      } else {
        displayToast(res.error?.message ?? t("printMgmt.reprintFailed"), 'error')
      }
    } catch {
      displayToast(t("printMgmt.reprintFailedRetry"), 'error')
    } finally {
      setReprintingId('')
    }
  }

  // [G005 Wave1B] 任务详情: printApi.getJob (GET /print/jobs/:id), 失败回退行数据
  const handleViewTaskDetail = async (task: any) => {
    setTaskDetailLoading(true)
    setTaskDetail(task)
    try {
      const res = await printApi.getJob(task.id)
      if (res.success && res.data) setTaskDetail(res.data)
    } catch {
      /* 详情接口不可用, 使用列表行 */
    }
    setTaskDetailLoading(false)
  }

  // [G005 Wave2A P0] 刷新打印机面板数据 (printApi.listPrinters)
  const refreshPrintersApi = async () => {
    const res = await printApi.listPrinters()
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      setPrintersApi(res.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status === 'online' ? 'online' : 'offline',
        location: p.location ?? '',
        filmsToday: 0,
      })))
    }
  }

  // [G005 Wave2A P0] 打开打印机弹窗 (受控表单初始化)
  const handleOpenPrinterModal = (printer: any | null) => {
    setSelectedPrinter(printer)
    setPrinterForm(printer ? {
      name: printer.name ?? '',
      location: printer.location ?? '',
      type: printer.type ?? 'network',
      filmSpec: printer.filmSpec ?? '14x17',
      defaultCopies: printer.defaultCopies ?? 1,
      dpi: printer.dpi ?? 300,
      aet: printer.aet ?? '',
      host: printer.host ?? '',
      port: printer.port ?? 104,
    } : { name: '', location: '', type: 'network', filmSpec: '14x17', defaultCopies: 1, dpi: 300, aet: '', host: '', port: 104 })
    setShowPrinterModal(true)
  }

  // [G005 Wave2A P0] 保存打印机 → createPrinter/updatePrinter 真实调用 → 刷新列表
  const handleSavePrinter = async () => {
    if (!printerForm.name?.trim()) {
      displayToast(t("printMgmt.printerNameRequired"), 'error')
      return
    }
    setSavingPrinter(true)
    try {
      const payload = {
        name: printerForm.name.trim(),
        location: printerForm.location.trim() || undefined,
        type: printerForm.type,
        filmSpec: printerForm.filmSpec,
        defaultCopies: Number(printerForm.defaultCopies) || 1,
        dpi: Number(printerForm.dpi) || 300,
        aet: printerForm.aet?.trim() || undefined,
        host: printerForm.host?.trim() || undefined,
        port: printerForm.port ? Number(printerForm.port) : undefined,
        mediumTypes: ['BLUE FILM', 'CLEAR FILM'],
        filmsPerHour: 40,
      }
      const res = selectedPrinter
        ? await printApi.updatePrinter(selectedPrinter.id, payload)
        : await printApi.createPrinter(payload)
      if (res.success && res.data) {
        const saved: any = res.data
        setPrinters(prev => {
          const idx = prev.findIndex((p: any) => p.id === saved.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = { ...next[idx], ...saved }
            return next
          }
          return [saved, ...prev]
        })
        displayToast(selectedPrinter ? `打印机「${saved.name}」已更新` : `打印机「${saved.name}」已添加`, 'success')
        setShowPrinterModal(false)
        void refreshPrintersApi()
      } else {
        displayToast(res.error?.message ?? t("printMgmt.printerSaveFailed"), 'error')
      }
    } catch {
      displayToast(t("printMgmt.printerSaveFailedRetry"), 'error')
    } finally {
      setSavingPrinter(false)
    }
  }

  // [G005 Wave2A P0] 删除打印机 → deletePrinter 真实调用
  const handleDeletePrinter = async (printer: any) => {
    if (!window.confirm(t('w9b.printMgmt.confirmDeletePrinter', { name: printer.name }))) return
    setDeletingPrinterId(printer.id)
    try {
      const res = await printApi.deletePrinter(printer.id)
      if (res.success) {
        setPrinters(prev => prev.filter((p: any) => p.id !== printer.id))
        setPrintersApi(prev => prev.filter((p: any) => p.id !== printer.id))
        displayToast(t('w9b.printMgmt.printerDeleted', { name: printer.name }), 'success')
      } else {
        displayToast(res.error?.message ?? t("printMgmt.printerDeleteFailed"), 'error')
      }
    } catch {
      displayToast(t("printMgmt.printerDeleteFailedRetry"), 'error')
    } finally {
      setDeletingPrinterId('')
    }
  }

  // [G005 Wave2A P1] 编辑 DICOM 预设 → 受控编辑弹窗 → localStorage 持久化
  const handleEditDicomPreset = (): void => {
    const preset = dicomPresets.find(p => p.id === selectedPreset)
    setPresetForm({ ...(preset ?? { id: 'DP001', name: '', orientation: 'PORTRAIT', mediumType: 'BLUE FILM', filmDestination: 'MAGAZINE', trimming: 'NO', filmSize: '14x17' }) })
    setPresetEditOpen(true)
  }

  const handleSaveDicomPreset = (): void => {
    if (!presetForm.name?.trim()) {
      displayToast(t("printMgmt.presetNameRequired"), 'error')
      return
    }
    const updated = dicomPresets.map(p => p.id === presetForm.id ? { ...p, ...presetForm } : p)
    setDicomPresets(updated)
    try { localStorage.setItem('g005_dicom_presets', JSON.stringify(updated)) } catch { /* ignore */ }
    setPresetEditOpen(false)
    displayToast(t('w9b.printMgmt.presetSaved', { name: presetForm.name }), 'success')
  }

  // [G005 Wave1B] 打印机状态看板: printApi.listPrinters 优先, 空则静态 DICOM_PRINTERS
  const scpPrinters = printersApi.length > 0 ? printersApi : DICOM_PRINTERS

  // 打印量趋势数据
  const trendData = filmUsageStats.map(f => ({
    date: f.date,
    prints: f.total,
    cost: f.cost
  }))

  // 胶片规格分布
  const filmDistData = [
    { name: '14×17', value: filmUsageStats.reduce((sum, f) => sum + f.films14x17, 0), color: C.primary },
    { name: '10×12', value: filmUsageStats.reduce((sum, f) => sum + f.films10x12, 0), color: C.accent },
    { name: '8×10', value: filmUsageStats.reduce((sum, f) => sum + f.films8x10, 0), color: '#8b5cf6' },
  ]

  // 各设备打印占比
  const deviceDistData = devicePrintStats.map(d => ({
    name: d.device,
    value: d.printCount,
    color: ['var(--color-primary-800)', 'var(--color-info-600)', '#8b5cf6', 'var(--color-warning-600)', 'var(--color-error-600)'][devicePrintStats.indexOf(d) % 5]
  }))

  // DICOM打印队列表格筛选
  const filteredDicomTasks = dicomTasks.filter(task =>
    task.patientName.includes(dicomQueueSearch) ||
    task.patientId.includes(dicomQueueSearch) ||
    task.studyType.includes(dicomQueueSearch)
  )

  // [G005 2B] 原生表格 slice 分页
  const { pageData: pagedDicomTasks, pagination: dicomQueuePagination } = usePagination(filteredDicomTasks, 10)
  const { pageData: pagedPrinterCost, pagination: printerCostPagination } = usePagination(PRINTER_COST_DATA, 10)

  // DICOM统计
  const dicomQueuedCount = dicomTasks.filter(t => t.status === 'queued').length
  const dicomPrintingCount = dicomTasks.filter(t => t.status === 'printing').length
  const dicomCompletedCount = dicomTasks.filter(t => t.status === 'completed').length
  const dicomFailedCount = dicomTasks.filter(t => t.status === 'failed').length

  // ============================================================
  // 事件处理函数
  // ============================================================

  // [G005 Wave2A P1] 预览模板 → 打开胶片布局预览弹窗 (CSS 模拟胶片 + 列说明)
  const handlePreviewTemplate = (template: any): void => {
    setTemplatePreviewItem(template)
    setTemplatePreviewOpen(true)
  }

  // 编辑模板
  const handleEditTemplate = (template: any): void => {
    setEditingTemplate(template)
    setIsNewTemplate(false)
    setShowTemplateEditModal(true)
  }

  // 新建模板
  const handleNewTemplate = (): void => {
    setIsNewTemplate(true)
    setEditingTemplate({ name: '', type: 'CT', copies: 1, includeImages: true, includeLogo: true })
    setShowTemplateEditModal(true)
  }

  // 立即打印报告
  const handlePrintReport = async (): Promise<void> => {
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmPrint"),
      message: t("printMgmt.confirmPrintMsg"),
      confirmText: t("printMgmt.print"),
      cancelText: t("printMgmt.cancel"),
      type: 'primary',
      onConfirm: async () => {
        await api.post('/print/jobs', { reportId: 'current', printerId: 'p1', filmSize: '14x17', copies: 1 })
        displayToast(t("printMgmt.printStarted"), 'success')
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // [G005 Wave2A P1] 下载PDF → 用当前任务数据真实生成 HTML/文本报告 Blob 下载
  const handleDownloadPdf = (): void => {
    const item = previewItem ?? printQueue[0] ?? printHistory[0]
    const patientName = item?.patientName ?? t("printMgmt.unknownPatient")
    const taskId = item?.id ?? 'REPORT-1'
    const modality = item?.modality ?? 'CT'
    const studyDesc = item?.studyDesc ?? item?.studyType ?? t("printMgmt.imageReport")
    const filmSpec = item?.filmSpec ?? '14x17'
    const copies = item?.copies ?? 1
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${t('w9b.printMgmt.taskSheetTitle', { taskId })}</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; margin: 40px; color: #1e293b; }
  h1 { color: var(--color-primary-800); border-bottom: 2px solid var(--color-primary-800); padding-bottom: 8px; }
  table { border-collapse: collapse; margin-top: 16px; }
  td, th { border: 1px solid #cbd5e1; padding: 8px 16px; text-align: left; }
  th { background: #eff6ff; }
  .foot { margin-top: 32px; font-size: 12px; color: #64748b; }
</style></head><body>
<h1>${t('w9b.printMgmt.taskSheetHeading')}</h1>
<table>
  <tr><th>${t('w9b.printMgmt.thTaskId')}</th><td>${taskId}</td></tr>
  <tr><th>${t('w9b.printMgmt.thPatientName')}</th><td>${patientName}</td></tr>
  <tr><th>${t('w9b.printMgmt.thModality')}</th><td>${modality}</td></tr>
  <tr><th>${t('w9b.printMgmt.thStudyDesc')}</th><td>${studyDesc}</td></tr>
  <tr><th>${t('w9b.printMgmt.thFilmSpec')}</th><td>${filmSpec}</td></tr>
  <tr><th>${t('w9b.printMgmt.thCopies')}</th><td>${copies}</td></tr>
  <tr><th>${t('w9b.printMgmt.thGeneratedAt')}</th><td>${timeStr}</td></tr>
</table>
<div class="foot">G005 RIS v3.0.6.11-87 · ${t('w9b.printMgmt.footText')}</div>
</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('w9b.printMgmt.taskFileName', { taskId })
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    displayToast(t('w9b.printMgmt.reportDownloaded', { taskId }), 'success')
  }

  // 刷新队列
  const handleRefreshQueue = (): void => {
    displayToast(dataSource === 'api' ? t("printMgmt.queueRefreshedServer") : t("printMgmt.queueRefreshedDemo"), 'success')
    void (async () => {
      const [queueRes, historyRes] = await Promise.all([printApi.listQueue(), printApi.listHistory()])
      if (queueRes.success && Array.isArray(queueRes.data)) {
        setPrintQueue(queueRes.data.map((t: any) => ({
          id: t.id,
          patientId: t.patientId ?? '',
          patientName: t.patientName,
          modality: t.modality ?? 'CT',
          studyDesc: t.studyType ?? '胶片打印',
          filmSpec: t.filmSpec ?? '14x17',
          copies: t.copies ?? 1,
          status: t.status === 'printing' ? 'printing' : t.status === 'failed' ? 'error' : t.status === 'completed' ? 'completed' : 'queued',
          printer: t.printer ?? 'P001',
          requestTime: t.submitTime,
          progress: t.progress ?? 0,
          errorMsg: t.errorMsg,
        })))
      }
      if (historyRes.success && Array.isArray(historyRes.data)) {
        setPrintHistory(historyRes.data.map((t: any) => ({
          id: t.id,
          patientId: t.patientId ?? '',
          patientName: t.patientName,
          modality: t.modality ?? 'CT',
          studyDesc: t.studyType ?? '胶片打印',
          filmSpec: t.filmSpec ?? '14x17',
          copies: t.copies ?? 1,
          pages: t.copies ?? 1,
          printer: t.printer ?? 'DICOM 打印机',
          operator: '系统',
          printTime: t.submitTime,
          status: t.status === 'completed' ? 'success' : 'error',
          cost: 0,
        })))
      }
    })()
  }

  // 暂停/恢复队列
  const handleTogglePauseQueue = (): void => {
    setQueuePaused(!queuePaused)
    displayToast(queuePaused ? t("printMgmt.queueResumed") : t("printMgmt.queuePaused"), 'success')
  }

  // [G005 Wave2A P1] 立即打印胶片任务 → printApi.createJob 真实创建
  const handlePrintFilmNow = async (item: any): Promise<void> => {
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmPrintNow"),
      message: `确定要立即打印 ${item.patientName} 的胶片任务吗？`,
      confirmText: t("printMgmt.print"),
      cancelText: t("printMgmt.cancel"),
      type: 'primary',
      onConfirm: async () => {
        try {
          const res = await printApi.createJob({
            patientName: item.patientName,
            patientId: item.patientId,
            modality: item.modality,
            studyType: item.studyDesc ?? item.studyType,
            filmSpec: item.filmSpec,
            copies: item.copies || 1,
            printer: item.printer,          })
          if (res.success) {
            displayToast(t('w9b.printMgmt.printStarted', { name: item.patientName, id: res.data?.id ?? '' }), 'success')
            handleRefreshQueue()
          } else {
            displayToast(res.error?.message ?? t("printMgmt.taskCreateFailed"), 'error')
          }
        } catch {
          displayToast(t("printMgmt.taskCreateFailedRetry"), 'error')
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // [G005 Wave2A P1] 重新打印 (预览弹窗内) → printApi.reprintJob 真实新建任务
  const handleReprint = (): void => {
    if (previewItem) {
      setConfirmModal({
        show: true,
        title: t("printMgmt.confirmReprint"),
        message: `确定要重新打印 ${previewItem.patientName} 的胶片吗？`,
        confirmText: t("printMgmt.reprint"),
        cancelText: t("printMgmt.cancel"),
        type: 'primary',
        onConfirm: async () => {
          if (previewItem.id) await handleReprintJob(previewItem.id)
          setShowPreviewModal(false)
          setConfirmModal(prev => ({ ...prev, show: false }))
        }
      })
    }
  }

  // [G005 Wave2A P1] DICOM打印队列立即打印 → printApi.createJob 真实创建
  const handleDicomPrintNow = (taskId: string): void => {
    const task = dicomTasks.find((t: any) => t.id === taskId)
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmPrintNow"),
      message: `确定要立即打印任务 ${taskId} 吗？`,
      confirmText: t("printMgmt.print"),
      cancelText: t("printMgmt.cancel"),
      type: 'primary',
      onConfirm: async () => {
        try {
          const res = await printApi.createJob({
            patientName: task?.patientName,
            patientId: task?.patientId,
            modality: task?.modality,
            studyType: task?.studyType,
            filmSpec: task?.filmSpec,
            copies: task?.copies,
            printer: task?.printer,
          })
          if (res.success) {
            displayToast(t('w9b.printMgmt.jobStarted', { id: res.data?.id ?? taskId }), 'success')
            handleRefreshQueue()
          } else {
            displayToast(res.error?.message ?? t("printMgmt.taskCreateFailed"), 'error')
          }
        } catch {
          displayToast(t("printMgmt.taskCreateFailedRetry"), 'error')
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // [G005 Wave2A P1] 取消任务 → printApi.cancelJob 真实调用
  const handleCancelTask = (taskId: string): void => {
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmCancelTask"),
      message: `确定要取消任务 ${taskId} 吗？此操作无法撤销。`,
      confirmText: t("printMgmt.cancelTask"),
      cancelText: t("printMgmt.back"),
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await printApi.cancelJob(taskId)
          if (res.success) {
            displayToast(t('w9b.printMgmt.jobCancelled', { id: taskId }), 'success')
            setDicomTasks(prev => prev.filter((t: any) => t.id !== taskId))
            setPrintQueue(prev => prev.filter((t: any) => t.id !== taskId))
          } else {
            displayToast(res.error?.message ?? t("printMgmt.cancelTaskFailed"), 'error')
          }
        } catch {
          displayToast(t("printMgmt.cancelTaskFailedRetry"), 'error')
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // [G005 Wave2A P1] 重试任务 → printApi.retryJob 真实调用
  const handleRetryTask = (taskId: string): void => {
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmRetryTask"),
      message: `确定要重试任务 ${taskId} 吗？`,
      confirmText: t("printMgmt.retry"),
      cancelText: t("printMgmt.cancel"),
      type: 'primary',
      onConfirm: async () => {
        try {
          const res = await printApi.retryJob(taskId)
          if (res.success) {
            displayToast(t('w9b.printMgmt.jobRetried', { id: taskId }), 'success')
            setDicomTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: 'queued', progress: 0, errorMsg: undefined, completeTime: null } : t))
            setPrintQueue(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: 'queued', progress: 0, errorMsg: undefined } : t))
          } else {
            displayToast(res.error?.message ?? t("printMgmt.retryTaskFailed"), 'error')
          }
        } catch {
          displayToast(t("printMgmt.retryTaskFailedRetry"), 'error')
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // ============================================================
  // 渲染函数
  // ============================================================

  // [v3.0.6.11-98 Wave3B P1] 批量打印: 逐条 printApi.createJob 真实创建 (失败逐条回退提示)
  const handleBatchPrint = async (): Promise<void> => {
    if (selectedQueueItems.length === 0) return
    setConfirmModal({
      show: true,
      title: t("printMgmt.confirmBatchPrint"),
      message: `确定要批量打印选中的 ${selectedQueueItems.length} 份报告吗？`,
      confirmText: t("printMgmt.batchPrint"),
      cancelText: t("printMgmt.cancel"),
      type: 'primary',
      onConfirm: async () => {
        let ok = 0
        for (const key of selectedQueueItems) {
          const idx = Number(key.replace('batch-', ''))
          const item = printHistory[idx] ?? printQueue[idx]
          if (!item) continue
          try {
            const res = await printApi.createJob({
              patientName: item.patientName,
              patientId: item.patientId,
              modality: item.modality,
              studyType: item.studyDesc ?? '胶片打印',
              filmSpec: item.filmSpec,
              copies: item.copies ?? 1,
              printer: item.printer,
            })
            if (res.success) ok++
          } catch {
            /* 单条失败不阻断, 汇总提示 */
          }
        }
        if (ok > 0) {
          displayToast(t('w9b.printMgmt.batchSubmitted', { ok, total: selectedQueueItems.length }), 'success')
          setSelectedQueueItems([])
          handleRefreshQueue()
        } else {
          displayToast(t("printMgmt.batchPrintFailed"), 'error')
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      }
    })
  }

  // [v3.0.6.11-98 Wave3B P1] 导出预览图: 当前 4合1 胶片布局 → canvas 绘制 → PNG Blob 下载
  const handleDownloadPreview = (): void => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1e40af'
    ctx.fillRect(0, 0, canvas.width, 60)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t("printMgmt.filmPreview4in1"), canvas.width / 2, 38)
    // [v3.0.6.11-99 Wave8A P1] 预览标签取自当前队列/历史真实任务 (无任务时通用占位 + 标注)
    const previewSources = [previewItem, ...printQueue, ...printHistory]
      .filter((it): it is NonNullable<typeof it> => !!it)
      .slice(0, 4)
    const labels = previewSources.length > 0
      ? previewSources.map((it) => (it as any).studyDesc ?? (it as any).studyType ?? `${(it as any).modality ?? t("printMgmt.images")} 检查`)
      : [t("printMgmt.imageChestAP"), t("printMgmt.imageChestLat"), t("printMgmt.imageAbdCt"), t("printMgmt.imageHeadMr")]
    const cellW = 280
    const cellH = 340
    labels.forEach((label, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 13 + col * (cellW + 14)
      const y = 80 + row * (cellH + 14)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(x, y, cellW, cellH)
      ctx.strokeStyle = '#cbd5e1'
      ctx.strokeRect(x, y, cellW, cellH)
      ctx.fillStyle = `rgba(148,163,184,${0.25 + i * 0.08})`
      ctx.fillRect(x + 14, y + 16, cellW - 28, (cellH - 72) * 0.6)
      ctx.fillStyle = '#334155'
      ctx.font = '16px "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + cellW / 2, y + cellH - 20)
    })
    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px "Microsoft YaHei", sans-serif'
    ctx.fillText(`${new Date().toLocaleString('zh-CN')} · ${customCols}x${customRows} 布局 · ${previewSources.length > 0 ? t("printMgmt.labelSourceQueue") : t("printMgmt.labelPlaceholderNote")}`, canvas.width / 2, 776)
    canvas.toBlob((blob) => {
      if (!blob) {
        displayToast(t("printMgmt.previewExportFailed"), 'error')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `胶片布局预览_${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      displayToast(t("printMgmt.previewExported"), 'success')
    }, 'image/png')
  }

  // [v3.0.6.11-98 Wave3B P1] 新建打印额度申请: 表单 → localStorage 记录 + 列表插入 (标注: 待后端审批流)
  const handleSubmitQuotaRequest = (): void => {
    if (!quotaForm.dept || quotaForm.requestedAmount <= 0) {
      displayToast(t("printMgmt.quotaSelectDeptAndCount"), 'error')
      return
    }
    if (!quotaForm.reason.trim()) {
      displayToast(t("printMgmt.quotaPurposeRequired"), 'error')
      return
    }
    setQuotaSaving(true)
    setTimeout(() => {
      const record = {
        id: `QR${Date.now()}`,
        dept: quotaForm.dept,
        requestedAmount: quotaForm.requestedAmount,
        reason: quotaForm.reason.trim(),
        status: 'pending',
        requestDate: new Date().toISOString().slice(0, 10),
        approvedDate: null,
      }
      try {
        const saved = JSON.parse(localStorage.getItem('print_quota_requests') ?? '[]') as unknown[]
        saved.push(record)
        localStorage.setItem('print_quota_requests', JSON.stringify(saved))
      } catch { /* localStorage 不可用不阻断 */ }
      setQuotaRequests(prev => [record, ...prev])
      setQuotaModalOpen(false)
      setQuotaForm({ dept: DEPT_PRINT_QUOTAS[0]?.dept ?? t("printMgmt.roomCt"), requestedAmount: 100, reason: '' })
      setQuotaSaving(false)
      displayToast(t('w9b.printMgmt.quotaSubmitted', { dept: record.dept, amount: record.requestedAmount }), 'success')
    }, 400)
  }

  // 渲染打印配置管理
  const renderPrintConfig = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 打印机列表 */}
      <Card title={t("printMgmt.printerList")} icon={<Printer size={16} />}>
        <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <SearchBar value={searchKeyword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)} placeholder={t("printMgmt.searchPrinterPlaceholder")} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)', maxHeight: 320, overflowY: 'auto' }}>
          {printers.filter(p => p.name.toLowerCase().includes(searchKeyword.toLowerCase())).map(printer => (
            <div
              key={printer.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenPrinterModal(printer)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenPrinterModal(printer) } }}
              style={{
                padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: selectedPrinter?.id === printer.id ? C.primaryLighter : 'var(--bg-card)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1, 4px)' }}>
                  {printer.type === 'network' ? <Network size={14} /> : <HardDrive size={14} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{printer.name}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMid }}>
                  <span style={{ marginRight: 'var(--space-3, 12px)' }}>{printer.location}</span>
                  <span>{t("printMgmt.defaultLabel")} {printer.defaultCopies}{t("printMgmt.copiesUnit")}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StatusBadge status={printer.status} />
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDeletePrinter(printer) }}
                  disabled={deletingPrinterId === printer.id}
                  title={t("printMgmt.deletePrinter")}
                  style={{
                    padding: '2px 6px', border: 'none', borderRadius: 4, cursor: 'pointer',
                    background: 'transparent', color: deletingPrinterId === printer.id ? C.textLight : C.danger
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => handleOpenPrinterModal(null)}
          style={{
            marginTop: 'var(--space-3, 12px)', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4,
            background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Plus size={14} /> {t("printMgmt.addPrinter2")}
        </button>
      </Card>

      {/* 胶片规格配置 */}
      <Card title={t("printMgmt.filmSpecConfig")} icon={<Film size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {filmSpecs.map(spec => (
            <div
              key={spec.id}
              style={{
                padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: spec.code === defaultFilmSpec ? C.primaryLighter : 'var(--bg-card)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{spec.name}</span>
                  {spec.default && (
                    <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 10, background: C.primary, color: C.white }}>
                      {t("printMgmt.default")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>
                  {t("printMgmt.sizeLabel")} {spec.size} {t("printMgmt.resolutionLabel")} {spec.dpi}
                </div>
              </div>
              <button
                onClick={() => setDefaultFilmSpec(spec.code)}
                style={{
                  padding: '4px 12px', border: `1px solid ${C.border}`, borderRadius: 4,
                  background: spec.code === defaultFilmSpec ? C.primary : 'var(--bg-card)',
                  color: spec.code === defaultFilmSpec ? C.white : C.textMid,
                  fontSize: 12, cursor: 'pointer'
                }}
              >
                {spec.code === defaultFilmSpec ? t("printMgmt.isDefault") : t("printMgmt.setDefault")}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 默认打印设置 */}
      <Card title={t("printMgmt.defaultPrintSettings")} icon={<Settings size={16} />}>
        <div style={{ display: 'flex', gap: 'var(--space-3, 12px)' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t("printMgmt.defaultCopies")}</label>
            <select
              value={defaultCopies}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDefaultCopies(Number(e.target.value))}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 12,}}
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {t("printMgmt.copiesUnit")}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t("printMgmt.defaultFilmSpec")}</label>
            <select
              value={defaultFilmSpec}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDefaultFilmSpec(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 12,}}
            >
              {filmSpecs.map(spec => <option key={spec.id} value={spec.code}>{spec.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* DICOM打印参数 */}
      <Card title={t("printMgmt.dicomPrintParams")} icon={<Database size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {dicomPresets.map(preset => (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPreset(preset.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPreset(preset.id) } }}
              style={{
                padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
                cursor: 'pointer',
                background: preset.id === selectedPreset ? C.primaryLighter : 'var(--bg-card)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{preset.name}</span>
                {preset.id === selectedPreset && <CheckCircle size={16} color={C.primary} />}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                {[
                  { label: t("printMgmt.orientation"), value: preset.orientation },
                  { label: t("printMgmt.medium"), value: MEDIUM_TYPE_LABELS[preset.mediumType] ?? preset.mediumType },
                  { label: t("printMgmt.output"), value: preset.filmDestination },
                  { label: t("printMgmt.crop"), value: preset.trimming },
                ].map(p => (
                  <span key={p.label} style={{ fontSize: 12, padding: '2px 6px', background: C.bg, borderRadius: 3, color: C.textMid }}>
                    {p.label}: {p.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleEditDicomPreset}
          style={{
            marginTop: 'var(--space-3, 12px)', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4,
            background: C.accent, color: C.white, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Cog size={14} /> {t("printMgmt.editDicomPreset")}
        </button>
      </Card>
    </div>
  )

  // 渲染图文报告打印
  const renderReportPrint = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 报告打印模板 */}
      <Card title={t("printMgmt.reportPrintTemplate")} icon={<ScrollText size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {reportTemplates.map(template => (
            <div
              key={template.id}
              style={{
                padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{template.name}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 6px', borderRadius: 10,
                    background: `${C.accent}20`, color: C.accent
                  }}>
                    {template.type}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.textMid, display: 'flex', gap: 'var(--space-2, 8px)' }}>
                  <span>{t("printMgmt.default")} {template.copies} {t("printMgmt.copiesUnit")}</span>
                  {template.includeImages && <span>{t("printMgmt.includeImage")}</span>}
                  {template.includeLogo && <span>{t("printMgmt.includeLogo")}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
                <button onClick={() => handlePreviewTemplate(template)} style={{ padding: 6, border: 'none', borderRadius: 4, background: C.primaryLighter, cursor: 'pointer' }}>
                  <Eye size={14} color={C.primary} />
                </button>
                <button onClick={() => handleEditTemplate(template)} style={{ padding: 6, border: 'none', borderRadius: 4, background: C.bg, cursor: 'pointer' }}>
                  <Edit2 size={14} color={C.textMid} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleNewTemplate}
          style={{
            marginTop: 'var(--space-3, 12px)', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4,
            background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Plus size={14} /> {t("printMgmt.newTemplate")}
        </button>
      </Card>

      {/* 打印预览 */}
      <Card title={t("printMgmt.printPreview")} icon={<Eye size={16} />}>
        <div style={{
          background: C.bg, borderRadius: 4, padding: 'var(--space-4, 16px)', minHeight: 300,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <FileText size={48} color={C.textLight} style={{ marginBottom: 'var(--space-3, 12px)' }} />
          <p style={{ fontSize: 12, color: C.textMid, margin: 0 }}>{t("printMgmt.selectReportToPreview")}</p>
          <p style={{ fontSize: 12, color: C.textLight, margin: '8px 0 0 0' }}>
            {t("printMgmt.previewHint")}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)' }}>
          <button onClick={handlePrintReport} style={{
            flex: 1, padding: '8px 12px', border: 'none', borderRadius: 4,
            background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <Printer size={14} /> {t("printMgmt.printNow")}
          </button>
          <button onClick={handleDownloadPdf} style={{
            flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 4,
            background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <Download size={14} /> {t("printMgmt.downloadPdf")}
          </button>
        </div>
      </Card>

      {/* 批量打印 */}
      <Card title={t("printMgmt.batchPrint")} icon={<Copy size={16} />}>
        <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
            <span style={{ fontSize: 12, color: C.textMid }}>
              {t("printMgmt.selected")} <span style={{ color: C.primary, fontWeight: 600 }}>{selectedQueueItems.length}</span> {t("printMgmt.reportsUnit")}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
              <button
                onClick={() => setSelectedQueueItems(printHistory.map((_: any, i: number) => `batch-${i}`))}
                style={{ fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t("printMgmt.selectAll")}
              </button>
              <button
                onClick={() => setSelectedQueueItems([])}
                style={{ fontSize: 12, color: C.textMid, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t("printMgmt.clear")}
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
            {printHistory.slice(0, 5).map((item, idx) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const key = `batch-${idx}`
                  setSelectedQueueItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    const key = `batch-${idx}`
                    setSelectedQueueItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '6px 8px',
                  borderRadius: 4, border: `1px solid ${C.border}`, cursor: 'pointer',
                  background: selectedQueueItems.includes(`batch-${idx}`) ? C.primaryLighter : 'var(--bg-card)'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedQueueItems.includes(`batch-${idx}`)}
                  onChange={() => {}}
                  tabIndex={-1}
                  style={{ accentColor: C.primary }}
                />
                <span style={{ fontSize: 12, color: C.textDark }}>{item.patientName}</span>
                <span style={{ fontSize: 12, color: C.textLight }}>{item.modality} - {item.studyDesc}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => void handleBatchPrint()}
          disabled={selectedQueueItems.length === 0}
          style={{
            width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4,
            background: selectedQueueItems.length > 0 ? C.primary : C.border,
            color: C.white, fontSize: 12, cursor: selectedQueueItems.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Printer size={14} /> {t("printMgmt.batchPrintPrefix")}{selectedQueueItems.length})
        </button>
      </Card>

      {/* 打印记录 */}
      <Card title={t("printMgmt.printHistory")} icon={<FileBarChart size={16} />}>
        <VirtualTable
          columns={[
            {
              title: t("printMgmt.patient"),
              dataIndex: 'patientName',
              key: 'patientName',
              render: (_: unknown, record) => (
                <div>
                  <div style={{ fontWeight: 500, color: C.textDark }}>{record.patientName}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{record.patientId}</div>
                </div>
              ),
            },
            {
              title: t("printMgmt.exam"),
              dataIndex: 'modality',
              key: 'modality',
              render: (_: unknown, record) => (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    {getModalityIcon(record.modality)}
                    <span>{record.modality}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{record.studyDesc}</div>
                </div>
              ),
            },
            { title: t("printMgmt.time"), dataIndex: 'printTime', key: 'printTime', width: 90, render: (v: string) => <span style={{ color: C.textMid }}>{v.slice(11)}</span> },
            { title: t("printMgmt.cost"), dataIndex: 'cost', key: 'cost', width: 90, render: (v: number) => <span style={{ color: C.success, fontWeight: 500 }}>¥{v.toFixed(1)}</span> },
          ]}
          dataSource={printHistory}
          rowKey="id"
          height={280}
          pageSize={8}
        />
      </Card>
    </div>
  )

  // 渲染胶片打印管理
  const renderFilmPrintManagement = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 胶片打印队列 */}
      <Card title={t("printMgmt.filmPrintQueue")} icon={<Layers size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
            <button onClick={handleRefreshQueue} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 12,
              background: C.primary, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)'
            }}>
              <RefreshCw size={14} />
              {t("printMgmt.refresh")}
            </button>
            <button onClick={handleTogglePauseQueue} style={{
              padding: '4px 12px', borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 12,
              background: 'var(--bg-card)', color: C.textMid, cursor: 'pointer'
            }}>
              {queuePaused ? t("printMgmt.resumeAll") : t("printMgmt.pauseAll")}
            </button>
          </div>
          <span style={{ fontSize: 12, color: C.textMid }}>
            {t("printMgmt.queueLabel")} <span style={{ color: C.primary }}>{printQueue.length}</span> {t("printMgmt.itemUnit")}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {printQueue.map(item => (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-3, 12px)', borderRadius: 4, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                  {getModalityIcon(item.modality)}
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{item.patientName}</span>
                  <span style={{ fontSize: 12, padding: '1px 6px', background: `${C.accent}20`, color: C.accent, borderRadius: 3 }}>
                    {item.modality}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6 }}>
                  {item.studyDesc} {t("printMgmt.specLabel")} {item.filmSpec} {t("printMgmt.copiesLabel")} {item.copies}
                </div>
                {item.status === 'printing' && (
                  <ProgressBar progress={item.progress} />
                )}
                {item.status === 'error' && (
                  <div style={{ fontSize: 12, color: C.danger }}>{t("printMgmt.errorLabel")} {item.errorMsg}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
                {item.status === 'queued' && (
                  <button onClick={() => handlePrintFilmNow(item)} style={{ padding: 6, border: 'none', borderRadius: 4, background: C.primary, cursor: 'pointer' }}>
                    <Zap size={14} color={C.white} />
                  </button>
                )}
                <button
                  onClick={() => { setPreviewItem(item); setShowPreviewModal(true) }}
                  style={{ padding: 6, border: 'none', borderRadius: 4, background: C.bg, cursor: 'pointer' }}
                >
                  <Eye size={14} color={C.textMid} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 打印状态追踪 */}
      <Card title={t("printMgmt.printStatusTrack")} icon={<Activity size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {[
            { label: t("printMgmt.onlinePrinters"), value: activePrinters, total: printers.length, color: C.success },
            { label: t("printMgmt.queuedTasks"), value: printQueue.filter(q => q.status === 'queued').length, total: printQueue.length, color: C.warning },
            { label: t("printMgmt.printingNow"), value: printQueue.filter(q => q.status === 'printing').length, total: printQueue.length, color: C.info },
            { label: t("printMgmt.doneToday"), value: todayPrints, total: 0, color: C.primary },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: C.textDark }}>{stat.label}</div>
                {stat.total > 0 && <div style={{ fontSize: 12, color: C.textLight }}>{t("printMgmt.total")} {stat.total} {t("printMgmt.itemUnit")}</div>}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 打印费用统计 */}
      <Card title={t("printMgmt.costStats")} icon={<DollarSign size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)', background: `${C.success}10`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.todayCost")}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.success }}>¥{todayCost.toFixed(1)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
            {[
              { label: t("printMgmt.sheetsPrinted"), value: todayFilms, unit: t("printMgmt.sheetsUnit") },
              { label: t("printMgmt.avgCost"), value: todayFilms > 0 ? (todayCost / todayFilms).toFixed(1) : '0', unit: t("printMgmt.yuanPerSheet") },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: 10, background: C.bg, borderRadius: 4 }}>
                <div style={{ fontSize: 12, color: C.textMid }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.textDark }}>{item.value} <span style={{ fontSize: 12 }}>{item.unit}</span></div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 胶片使用量统计 */}
      <Card title={t("printMgmt.filmUsageStats")} icon={<BarChart2 size={16} />}>
        <div style={{ height: 180 }}>
          <ChartContainer height={180} state={filmUsageStats.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noFilmUsageData")}>
            <ReBarChart data={filmUsageStats.slice(-7)} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: C.textDark }}
              />
              <Bar dataKey="films14x17" name="14×17" fill={C.primary} stackId="a" />
              <Bar dataKey="films10x12" name="10×12" fill={C.accent} stackId="a" />
              <Bar dataKey="films8x10" name="8×10" fill="#8b5cf6" stackId="a" />
            </ReBarChart>
          </ChartContainer>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)' }}>
          {[{ label: '14×17', color: C.primary }, { label: '10×12', color: C.accent }, { label: '8×10', color: '#8b5cf6' }].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: C.textMid }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  // 渲染DICOM打印队列
  const dicomTaskColumns: TableColumnsType<(typeof DICOM_PRINT_TASKS)[number]> = [
    { title: t("printMgmt.taskId"), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', color: C.textMid }}>{v}</span> },
    {
      title: t("printMgmt.patientName"), key: 'patientName',
      render: (_v, task) => (
        <>
          <div style={{ fontWeight: 500, color: C.textDark }}>{task.patientName}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{task.patientId}</div>
        </>
      ),
    },
    {
      title: t("printMgmt.examType"), key: 'examType',
      render: (_v, task) => (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            {getModalityIcon(task.modality)}
            <span>{task.modality}</span>
          </div>
          <div style={{ fontSize: 12, color: C.textLight }}>{task.studyType}</div>
        </>
      ),
    },
    {
      title: t("printMgmt.filmSpecCol"), dataIndex: 'filmSpec', key: 'filmSpec',
      render: (v: string) => <span style={{ padding: '2px 6px', background: `${C.primary}15`, color: C.primary, borderRadius: 3, fontSize: 12 }}>{v}</span>,
    },
    { title: t("printMgmt.copies"), dataIndex: 'copies', key: 'copies', align: 'center' as const },
    { title: t("printMgmt.status"), dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
    { title: t("printMgmt.submittedAt"), dataIndex: 'submitTime', key: 'submitTime', render: (v: string) => <span style={{ color: C.textMid }}>{v}</span> },
    { title: t("printMgmt.completedAt"), dataIndex: 'completeTime', key: 'completeTime', render: (v: string | null) => <span style={{ color: C.textMid }}>{v || '-'}</span> },
    {
      title: t("printMgmt.actions"), key: 'actions',
      render: (_v, task) => (
        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
          {task.status === 'queued' && (
            <button
              onClick={() => handleDicomPrintNow(task.id)}
              style={{ padding: '4px 8px', border: 'none', borderRadius: 3, background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.printNow")}
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={() => handleRetryTask(task.id)}
              style={{ padding: '4px 8px', border: 'none', borderRadius: 3, background: C.warning, color: C.white, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.retry")}
            </button>
          )}
          {(task.status === 'queued' || task.status === 'failed') && (
            <button
              onClick={() => handleCancelTask(task.id)}
              style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 3, background: 'var(--bg-card)', color: C.danger, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.cancel")}
            </button>
          )}
          {task.status === 'printing' && (
            <span style={{ fontSize: 12, color: C.info }}>{t("printMgmt.printingDots")}</span>
          )}
          {task.status === 'completed' && (
            <span style={{ fontSize: 12, color: C.success }}>{t("printMgmt.completed")}</span>
          )}
          {(task.status === 'completed' || task.status === 'failed') && (
            <button
              onClick={() => void handleReprintJob(task.id)}
              disabled={reprintingId === task.id}
              style={{ padding: '4px 8px', border: 'none', borderRadius: 3, background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer' }}
            >
              {reprintingId === task.id ? t("printMgmt.reprinting") : t("printMgmt.reprint")}
            </button>
          )}
          <button
            onClick={() => void handleViewTaskDetail(task)}
            style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 3, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
          >
            {t("printMgmt.detail")}
          </button>
        </div>
      ),
    },
  ]

  const renderDicomPrintQueue = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 打印服务器配置面板 */}
      <Card title={t("printMgmt.printServerConfig")} icon={<Server size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3, 12px)' }}>
          {DICOM_SERVERS.map(server => (
            <div
              key={server.id}
              style={{
                padding: 'var(--space-3, 12px)', borderRadius: 4, border: `1px solid ${C.border}`,
                background: server.status === 'online' ? `${C.success}05` : `${C.danger}05`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <Server size={18} color={server.status === 'online' ? C.success : C.danger} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{server.name}</span>
                </div>
                <StatusBadge status={server.status} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                <div>
                  <span style={{ color: C.textLight }}>{t("printMgmt.serverNameLabel")} </span>
                  <span style={{ color: C.textDark }}>{server.aet}</span>
                </div>
                <div>
                  <span style={{ color: C.textLight }}>{t("printMgmt.ipPortLabel")} </span>
                  <span style={{ color: C.textDark }}>{server.ip}:{server.port}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: C.textLight }}>{t("printMgmt.descLabel")} </span>
                  <span style={{ color: C.textDark }}>{server.description}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DICOM打印机列表 */}
        <div style={{ marginTop: 'var(--space-4, 16px)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 'var(--space-2, 8px)' }}>{t("printMgmt.dicomPrinterList")} {printersApi.length > 0 && <span style={{ fontSize: 11, color: C.success }}>{t("printMgmt.listPrintersLive")}</span>}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-2, 8px)' }}>
            {scpPrinters.map(printer => (
              <div
                key={printer.id}
                style={{
                  padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
                  background: printer.status === 'online' ? 'var(--bg-card)' : C.bg,
                  opacity: printer.status === 'online' ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  {printer.status === 'online' ? (
                    <Wifi size={14} color={C.success} />
                  ) : (
                    <WifiOff size={14} color={C.danger} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{printer.name}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMid }}>{printer.location}</div>
                <div style={{ fontSize: 12, color: C.textLight, marginTop: 'var(--space-1, 4px)' }}>
                  {t("printMgmt.todayLabel")} <span style={{ color: C.primary }}>{printer.filmsToday}</span> {t("printMgmt.sheetsUnit")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 胶片规格选择 */}
      <Card title={t("printMgmt.filmSpecSelect")} icon={<Film size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t("printMgmt.filmSpecCol")}</label>
            <select
              value={selectedFilmSpec}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedFilmSpec(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 12, background: 'var(--bg-card)'
              }}
            >
              {FILM_SPEC_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {selectedFilmSpec === 'CUSTOM' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.widthCm")}</label>
                <input
                  type="text"
                  value={customFilmWidth}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFilmWidth(e.target.value)}
                  placeholder={t("printMgmt.widthExample2")}
                  style={{
                    width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 4, fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.heightCm")}</label>
                <input
                  type="text"
                  value={customFilmHeight}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFilmHeight(e.target.value)}
                  placeholder={t("printMgmt.heightExample2")}
                  style={{
                    width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 4, fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t("printMgmt.mediumType")}</label>
            <select
              value={selectedMediumType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMediumType(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 12, background: 'var(--bg-card)'
              }}
            >
              {MEDIUM_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t("printMgmt.printCopies")}</label>
            <select
              value={printCopies}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrintCopies(Number(e.target.value))}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 12, background: 'var(--bg-card)'
              }}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} {t("printMgmt.copiesUnit")}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 打印状态统计 */}
      <Card title={t("printMgmt.dicomPrintStatus")} icon={<Activity size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2, 8px)' }}>
          {[
            { label: t("printMgmt.queued"), value: dicomQueuedCount, color: C.warning },
            { label: t("printMgmt.printing"), value: dicomPrintingCount, color: C.info },
            { label: t("printMgmt.completed"), value: dicomCompletedCount, color: C.success },
            { label: t("printMgmt.failed"), value: dicomFailedCount, color: C.danger },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                padding: 'var(--space-3, 12px)', borderRadius: 4, background: `${stat.color}10`,
                border: `1px solid ${stat.color}30`, textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>{stat.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-3, 12px)', padding: 10, background: C.bg, borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: C.textMid }}>
            {t("printMgmt.todayTotalLabel")} <span style={{ color: C.primary, fontWeight: 600 }}>{dicomTasks.length}</span> {t("printMgmt.itemUnit")}
            {' · '}{t("printMgmt.serverQueueLabel")} <span style={{ color: C.info, fontWeight: 600 }}>{serverQueues}</span> {t("printMgmt.itemUnit")}
          </div>
        </div>
      </Card>

      {/* 打印队列表格 */}
      <Card title={t("printMgmt.dicomPrintQueue")} icon={<FileSpreadsheet size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
          <SearchBar
            value={dicomQueueSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDicomQueueSearch(e.target.value)}
            placeholder={t("printMgmt.searchQueuePlaceholder")}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginLeft: 'var(--space-3, 12px)' }}>
            <button
              onClick={handleRefreshQueue}
              style={{
                padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.border}`,
                background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)'
              }}
            >
              <RefreshCw size={14} /> {t("printMgmt.refresh")}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <DataTable<(typeof DICOM_PRINT_TASKS)[number]>
            columns={dicomTaskColumns}
            dataSource={pagedDicomTasks}
            rowKey="id"
            showPagination={false}
          />
        </div>
        {/* [G005 2B] 原生表格分页控制 */}
        {dicomQueuePagination.total > dicomQueuePagination.pageSize && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-2, 8px)', fontSize: 12, color: C.textMid }}>
            <span>{t("printMgmt.totalPrefix")} {dicomQueuePagination.total} {t("printMgmt.itemsUnit")}</span>
            <button
              onClick={() => dicomQueuePagination.onChange(Math.max(1, dicomQueuePagination.current - 1), dicomQueuePagination.pageSize)}
              disabled={dicomQueuePagination.current <= 1}
              style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
            >{t("printMgmt.prevPage")}</button>
            <span>{dicomQueuePagination.current}/{Math.max(1, Math.ceil(dicomQueuePagination.total / dicomQueuePagination.pageSize))}</span>
            <button
              onClick={() => dicomQueuePagination.onChange(Math.min(Math.ceil(dicomQueuePagination.total / dicomQueuePagination.pageSize), dicomQueuePagination.current + 1), dicomQueuePagination.pageSize)}
              disabled={dicomQueuePagination.current >= Math.ceil(dicomQueuePagination.total / dicomQueuePagination.pageSize)}
              style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
            >{t("printMgmt.nextPage")}</button>
          </div>
        )}
      </Card>

      {/* 打印计费 - 各规格单价 */}
      <Card title={t("printMgmt.specUnitPrice")} icon={<Receipt size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {FILM_PRICE_CONFIG.map(item => (
            <div
              key={item.spec}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 4, background: C.bg
              }}
            >
              <span style={{ fontSize: 12, color: C.textDark }}>{item.spec}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.success }}>¥{item.pricePerSheet.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 打印计费 - 科室计费统计 */}
      <Card title={t("printMgmt.deptBillingStats")} icon={<Building2 size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {DEPARTMENT_BILLING.map(dept => (
            <div
              key={dept.dept}
              style={{
                padding: 10, borderRadius: 4, border: `1px solid ${C.border}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{dept.dept}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.success }}>¥{dept.amount.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', fontSize: 12, color: C.textMid }}>
                <span>{t("printMgmt.patientLabel")} {dept.patientCount}</span>
                <span>{t("printMgmt.filmLabel")} {dept.filmCount}{t("printMgmt.sheetsUnit")}</span>
              </div>
              <div style={{ marginTop: 6, height: 4, background: C.bg, borderRadius: 2 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(dept.filmCount / 350) * 100}%`,
                    background: C.primary,
                    borderRadius: 2
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 打印计费 - 打印成本报表 */}
      <Card title={t("printMgmt.costReport")} icon={<FileBarChart size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ height: 200, marginBottom: 'var(--space-3, 12px)' }}>
          <ChartContainer height={200} state={costReport.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noCostData")}>
            <ReBarChart data={costReport} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: C.textDark }}
              />
              <Bar dataKey="filmCost" name={t("printMgmt.filmCost")} fill={C.primary} stackId="a" />
              <Bar dataKey="paperCost" name={t("printMgmt.paperCost")} fill={C.accent} stackId="a" />
              <Bar dataKey="inkCost" name={t("printMgmt.inkCost")} fill="#8b5cf6" stackId="a" />
            </ReBarChart>
          </ChartContainer>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4, 16px)' }}>
          {[
            { labelKey: 'printMgmt.filmCost', color: C.primary },
            { labelKey: 'printMgmt.paperCost', color: C.accent },
            { labelKey: 'printMgmt.inkCost', color: '#8b5cf6' },
          ].map(item => (
            <div key={item.labelKey} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: C.textMid }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
              {t(item.labelKey)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 渲染 DICOM Print SCP 集成
  // ============================================================
  const renderPrintSCP = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 打印机状态看板 */}
      <Card title={`打印机状态看板${printersApi.length > 0 ? t("printMgmt.listPrintersLive2") : ''}`} icon={<Monitor size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-2, 8px)' }}>
          {scpPrinters.map(p => (
            <div key={p.id} style={{
              padding: 'var(--space-3, 12px)', borderRadius: 8, border: `1px solid ${p.status === 'online' ? C.success + '40' : C.danger + '40'}`,
              background: p.status === 'online' ? `${C.success}05` : `${C.danger}05`,
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: 6 }}>
                {p.status === 'online' ? <Wifi size={24} color={C.success} /> : <WifiOff size={24} color={C.danger} />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 'var(--space-1, 4px)' }}>{p.location}</div>
              <StatusBadge status={p.status} />
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 'var(--space-1, 4px)' }}>{t("printMgmt.todayLabel")} {p.filmsToday}{t("printMgmt.sheetsUnit")}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 打印任务队列（按优先级） */}
      <Card title={t("printMgmt.taskQueueByPriority")} icon={<ClipboardList size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {dicomTasks.filter(t => t.status === 'printing' || t.status === 'queued').slice(0, 8).map((task, idx) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)',
              padding: '8px 12px', borderRadius: 6,
              background: idx === 0 ? `${C.info}10` : 'var(--bg-primary)',
              border: `1px solid ${idx === 0 ? C.info + '30' : C.border}`
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: idx < 3 ? C.danger : idx < 6 ? C.warning : C.info,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700
              }}>{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{task.patientName}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ fontSize: 12, color: C.textLight }}>
                  {task.studyType} · {task.filmSpec} · {task.copies}{t("printMgmt.copiesDot")} {task.submitTime}
                </div>
              </div>
              <span style={{ fontSize: 12, color: C.textLight, fontFamily: 'monospace' }}>{task.printer}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 胶片/纸张规格配置 */}
      <Card title={t("printMgmt.filmPaperConfig")} icon={<Film size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {FILM_SPEC_OPTIONS.map(opt => (
            <div key={opt.value} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)',
              border: `1px solid ${selectedFilmSpec === opt.value ? C.accent + '40' : C.border}`
            }}>
              <span style={{ fontSize: 12, color: C.textDark }}>{opt.label}</span>
              <button
                onClick={() => setSelectedFilmSpec(opt.value)}
                style={{
                  padding: '3px 10px', borderRadius: 6, border: 'none',
                  background: selectedFilmSpec === opt.value ? C.accent : C.bg,
                  color: selectedFilmSpec === opt.value ? '#fff' : C.textMid,
                  fontSize: 12, cursor: 'pointer'
                }}
              >
                {selectedFilmSpec === opt.value ? t("printMgmt.selectedShort") : t("printMgmt.select")}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 介质类型配置 */}
      <Card title={t("printMgmt.mediumTypeConfig")} icon={<SlidersHorizontal size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {MEDIUM_TYPES.map(mt => (
            <div key={mt.value} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)',
              border: `1px solid ${C.border}`
            }}>
              <span style={{ fontSize: 12, color: C.textDark }}>{mt.label}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: C.textMid }}>
                <input type="radio" name="medium" defaultChecked={mt.value === 'BLUE_FILM'} style={{ accentColor: C.primary }} />
                {t("printMgmt.default")}
              </label>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 渲染成本追踪
  // ============================================================
  const printerCostColumns: TableColumnsType<(typeof PRINTER_COST_DATA)[number]> = [
    { title: t("printMgmt.printer"), dataIndex: 'printer', key: 'printer', render: (v: string) => <span style={{ fontWeight: 600, color: C.textDark }}>{v}</span> },
    { title: t("printMgmt.filmUsage"), dataIndex: 'films', key: 'films', align: 'center' as const, render: (v: number) => <span style={{ color: C.textMid }}>{v}</span> },
    { title: t("printMgmt.perSheetCost"), dataIndex: 'costPerPrint', key: 'costPerPrint', align: 'center' as const, render: (v: number) => <span style={{ color: C.success }}>¥{v.toFixed(1)}</span> },
    { title: t("printMgmt.totalCost"), dataIndex: 'totalCost', key: 'totalCost', align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 700, color: C.textDark }}>¥{v.toFixed(0)}</span> },
    { title: t("printMgmt.roomCt"), key: 'deptCt', align: 'center' as const, render: (_v, p) => <span style={{ color: C.textMid }}>¥{p.deptCost.CT.toFixed(0)}</span> },
    { title: t("printMgmt.roomMr2"), key: 'deptMr', align: 'center' as const, render: (_v, p) => <span style={{ color: C.textMid }}>¥{p.deptCost.MR.toFixed(0)}</span> },
    { title: t("printMgmt.roomDr2"), key: 'deptDr', align: 'center' as const, render: (_v, p) => <span style={{ color: C.textMid }}>¥{p.deptCost.DR.toFixed(0)}</span> },
  ]

  const renderCostTracking = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 打印机成本分析 */}
      <Card title={t("printMgmt.costByPrinter")} icon={<CreditCard size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ overflowX: 'auto' }}>
          <DataTable<(typeof PRINTER_COST_DATA)[number]>
            columns={printerCostColumns}
            dataSource={pagedPrinterCost}
            rowKey="printer"
            showPagination={false}
          />
        </div>
        {/* [G005 2B] 原生表格分页控制 */}
        {printerCostPagination.total > printerCostPagination.pageSize && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-2, 8px)', fontSize: 12, color: C.textMid }}>
            <span>{t("printMgmt.totalPrefix")} {printerCostPagination.total} {t("printMgmt.itemsUnit")}</span>
            <button
              onClick={() => printerCostPagination.onChange(Math.max(1, printerCostPagination.current - 1), printerCostPagination.pageSize)}
              disabled={printerCostPagination.current <= 1}
              style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
            >{t("printMgmt.prevPage")}</button>
            <span>{printerCostPagination.current}/{Math.max(1, Math.ceil(printerCostPagination.total / printerCostPagination.pageSize))}</span>
            <button
              onClick={() => printerCostPagination.onChange(Math.min(Math.ceil(printerCostPagination.total / printerCostPagination.pageSize), printerCostPagination.current + 1), printerCostPagination.pageSize)}
              disabled={printerCostPagination.current >= Math.ceil(printerCostPagination.total / printerCostPagination.pageSize)}
              style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
            >{t("printMgmt.nextPage")}</button>
          </div>
        )}
      </Card>

      {/* 月度成本趋势 */}
      <Card title={t("printMgmt.monthlyCostTrend")} icon={<TrendingUp size={16} />}>
        <div style={{ height: 200 }}>
          <ChartContainer height={200} state={MONTHLY_COST_TREND.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noMonthlyCost")}>
            <ReBarChart data={MONTHLY_COST_TREND} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
              <Bar dataKey="ct" name="CT" fill="#7c3aed" stackId="a" />
              <Bar dataKey="mr" name="MR" fill="var(--color-primary-600)" stackId="a" />
              <Bar dataKey="dr" name="DR" fill="#059669" stackId="a" />
              <Bar dataKey="other" name={t("printMgmt.chart.other")} fill="var(--color-warning-600)" stackId="a" />
            </ReBarChart>
          </ChartContainer>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)' }}>
          {[{ labelKey: 'printMgmt.chart.ct', color: '#7c3aed' }, { labelKey: 'printMgmt.chart.mr', color: 'var(--color-primary-600)' }, { labelKey: 'printMgmt.chart.dr', color: '#059669' }, { labelKey: 'printMgmt.chart.other', color: 'var(--color-warning-600)' }].map(item => (
            <div key={item.labelKey} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: C.textMid }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />{t(item.labelKey)}
            </div>
          ))}
        </div>
      </Card>

      {/* 科室成本分配 */}
      <Card title={t("printMgmt.costByDept")} icon={<Building2 size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEPARTMENT_BILLING.map(d => (
            <div key={d.dept}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: C.textDark }}>{d.dept}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>¥{d.amount.toFixed(0)}</span>
              </div>
              <div style={{ height: 6, background: C.bg, borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${(d.amount / 8000) * 100}%`, borderRadius: 3, background: [C.primary, C.accent, '#8b5cf6', C.warning, C.danger][DEPARTMENT_BILLING.indexOf(d) % 5] }} />
              </div>
              <div style={{ fontSize: 12, color: C.textLight, marginTop: 1 }}>{d.filmCount}{t("printMgmt.filmsDot")} {d.patientCount}{t("printMgmt.patientsUnit")}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 渲染打印布局模板
  // ============================================================
  const renderLayoutTemplates = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 预设布局 */}
      <Card title={t("printMgmt.presetLayouts")} icon={<LayoutGrid size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3, 12px)' }}>
          {PRINT_LAYOUT_TEMPLATES.filter(t => t.preset).map(template => (
            <div key={template.id} style={{
              borderRadius: 8, border: `1px solid ${C.border}`,
              overflow: 'hidden', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              {/* 预览缩略图 */}
              <div style={{
                background: 'var(--bg-card)', padding: 'var(--space-4, 16px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 120
              }}>
                <div style={{
                  width: '100%', aspectRatio: template.orientation === 'PORTRAIT' ? '3/4' : '4/3',
                  background: 'var(--bg-card)', borderRadius: 4, border: `1px solid ${C.border}`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${template.rows}, 1fr)`,
                  gap: 1, padding: 1
                }}>
                  {Array.from({ length: template.total }, (_, i) => (
                    <div key={i} style={{
                      background: `${C.primary}08`,
                      border: `1px solid ${C.primary}20`,
                      borderRadius: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: C.textLight
                    }}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{template.name}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>
                  {template.cols}×{template.rows} · {template.orientation === 'PORTRAIT' ? t("printMgmt.portrait") : t("printMgmt.landscape")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 自定义布局构建器 */}
      <Card title={t("printMgmt.customLayoutBuilder")} icon={<Settings size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
            <div>
              <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.columns")}</label>
              <select style={{
                width: '100%', padding: '6px 10px', borderRadius: 4, border: `1px solid ${C.border}`,
                fontSize: 12,}} value={customCols} onChange={e => setCustomCols(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.rows")}</label>
              <select style={{
                width: '100%', padding: '6px 10px', borderRadius: 4, border: `1px solid ${C.border}`,
                fontSize: 12,}} value={customRows} onChange={e => setCustomRows(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.orientation")}</label>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
              {['PORTRAIT', 'LANDSCAPE'].map(dir => (
                <button key={dir} onClick={() => setCustomOrientation(dir)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
                  background: customOrientation === dir ? C.primary : 'var(--bg-card)',
                  color: customOrientation === dir ? '#fff' : C.textMid,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>
                  {dir === 'PORTRAIT' ? t("printMgmt.portrait") : t("printMgmt.landscape")}
                </button>
              ))}
            </div>
          </div>
          {/* 自定义预览 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 6, padding: 'var(--space-3, 12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 140
          }}>
            <div style={{
              width: 160, aspectRatio: '3/4',
              background: 'var(--bg-card)', borderRadius: 4, border: `1px solid ${C.border}`,
              display: 'grid', gridTemplateColumns: `repeat(${customCols}, 1fr)`, gridTemplateRows: `repeat(${customRows}, 1fr)`,
              gap: 1, padding: 1
            }}>
              {Array.from({ length: customCols * customRows }, (_, i) => (
                <div key={i} style={{
                  background: `${C.accent}08`, border: `1px solid ${C.accent}20`, borderRadius: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: C.textLight
                }}>{i + 1}</div>
              ))}
            </div>
          </div>
          <button onClick={() => void handleSaveCustomTemplate()} disabled={savingCustomTemplate} style={{
            width: '100%', padding: '8px 12px', border: 'none', borderRadius: 6,
            background: savingCustomTemplate ? C.border : C.primary, color: savingCustomTemplate ? C.textMid : '#fff', fontSize: 12, fontWeight: 600, cursor: savingCustomTemplate ? 'wait' : 'pointer'
          }}>
            {savingCustomTemplate ? t("printMgmt.saving") : t("printMgmt.saveAsCustomTemplate")}
          </button>
        </div>
      </Card>

      {/* 预览缩略图 */}
      <Card title={t("printMgmt.printPreview")} icon={<Eye size={16} />}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 6, padding: 'var(--space-5, 20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3, 12px)'
        }}>
          <div style={{
            width: 200, aspectRatio: '3/4',
            background: 'var(--bg-card)', borderRadius: 6, border: `2px solid ${C.border}`,
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)',
            gap: 2, padding: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            {[t("printMgmt.imageChestAP"), t("printMgmt.imageChestLat"), t("printMgmt.imageAbdCt"), t("printMgmt.imageHeadMr")].map((label, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', borderRadius: 2, padding: 'var(--space-1, 4px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: C.textMid, gap: 2
              }}>
                <div style={{ width: '80%', height: '50%', background: `linear-gradient(135deg, ${C.textLight}20, ${C.textLight}40)`, borderRadius: 1 }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t("printMgmt.layout4in1Preview")}</div>
          <button onClick={handleDownloadPreview} style={{
            padding: '6px 16px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer'
          }}>
            <Download size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--space-1, 4px)' }} />
            {t("printMgmt.exportPreview")}
          </button>
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 渲染配额管理
  // ============================================================
  const renderQuotaManagement = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 科室配额状态 */}
      <Card title={t("printMgmt.deptQuotaStatus")} icon={<ShieldAlert size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)' }}>
          {DEPT_PRINT_QUOTAS.map(d => {
            const pct = Math.round((d.current / d.monthlyQuota) * 100)
            return (
              <div key={d.dept} style={{
                padding: 'var(--space-3, 12px)', borderRadius: 8,
                background: d.status === 'critical' ? `${C.danger}05` : d.status === 'warning' ? `${C.warning}05` : `${C.success}05`,
                border: `1px solid ${d.status === 'critical' ? C.danger + '30' : d.status === 'warning' ? C.warning + '30' : C.success + '30'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{d.dept}</span>
                  {d.status === 'critical' && <AlertTriangle size={14} color={C.danger} />}
                  {d.status === 'warning' && <AlertTriangle size={14} color={C.warning} />}
                  {d.status === 'normal' && <CheckCircle size={14} color={C.success} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>{d.current} / {d.monthlyQuota} {t("printMgmt.sheetsUnit")}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: pct >= d.alertThreshold ? (pct >= 95 ? C.danger : C.warning) : C.success
                  }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: C.bg, borderRadius: 4, marginBottom: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.min(100, pct)}%`,
                    background: pct >= d.alertThreshold ? (pct >= 95 ? C.danger : C.warning) : C.success,
                    transition: 'width 0.4s'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textLight }}>
                  <span>{t("printMgmt.budgetYuan")}{d.budget.toLocaleString()}</span>
                  <span>{t("printMgmt.spentYuan")}{d.spent.toLocaleString()}</span>
                </div>
                {d.status === 'critical' && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: C.danger }}>
                      {t("printMgmt.quotaAlmostExhausted")}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* 月度预算追踪 */}
      <Card title={t("printMgmt.monthlyBudgetTrack")} icon={<CreditCard size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEPT_PRINT_QUOTAS.slice(0, 4).map(d => {
            const budgetPct = Math.round((d.spent / d.budget) * 100)
            return (
              <div key={d.dept}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: C.textDark }}>{d.dept}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: budgetPct > 90 ? C.danger : budgetPct > 75 ? C.warning : C.success }}>
                    ¥{d.spent.toLocaleString()} / ¥{d.budget.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 6, background: C.bg, borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${Math.min(100, budgetPct)}%`,
                    background: budgetPct > 90 ? C.danger : budgetPct > 75 ? C.warning : C.success
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 请求增加配额 */}
      <Card title={t("printMgmt.quotaIncreaseRequest")} icon={<Plus size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {quotaRequests.map(req => (
            <div key={req.id} style={{
              padding: 10, borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'var(--bg-card)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1, 4px)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{req.dept}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: req.status === 'approved' ? `${C.success}15` : `${C.warning}15`,
                  color: req.status === 'approved' ? C.success : C.warning
                }}>
                  {req.status === 'approved' ? t("printMgmt.approved") : t("printMgmt.pendingApproval")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textLight }}>{t("printMgmt.requestMore")} <strong>{req.requestedAmount}</strong> {t("printMgmt.sheetsUnit")}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>{req.reason}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>
                {req.requestDate} · {req.approvedDate || t("printMgmt.underReview")}
              </div>
            </div>
          ))}
          <button onClick={() => setQuotaModalOpen(true)} style={{
            width: '100%', padding: '8px 12px', border: `1px solid ${C.accent}40`,
            borderRadius: 6, background: `${C.accent}10`, color: C.accent,
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--space-1, 4px)' }} />
            {t("printMgmt.startQuotaRequest")}
          </button>
        </div>
      </Card>

      {/* [v3.0.6.11-98 Wave3B P1] 新建打印额度申请 Modal: 科室/张数/用途 → localStorage + 标注 */}
      {quotaModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !quotaSaving && setQuotaModalOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', width: 460, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Plus size={16} /> {t("printMgmt.newQuotaRequest")}
              </div>
              <button onClick={() => !quotaSaving && setQuotaModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.textLight, padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.requestDeptRequired")}</label>
                <select value={quotaForm.dept} onChange={e => setQuotaForm({ ...quotaForm, dept: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, background: 'var(--bg-card)' }}>
                  {DEPT_PRINT_QUOTAS.map(d => <option key={d.dept} value={d.dept}>{d.dept}{t("printMgmt.monthlyQuotaPrefix")} {d.monthlyQuota} {t("printMgmt.quotaUsedLabel")} {d.current} {t("printMgmt.sheetsSuffix")}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.requestCountRequired")}</label>
                <input type="number" min={1} value={quotaForm.requestedAmount} onChange={e => setQuotaForm({ ...quotaForm, requestedAmount: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{t("printMgmt.requestPurposeRequired")}</label>
                <textarea rows={3} value={quotaForm.reason} onChange={e => setQuotaForm({ ...quotaForm, reason: e.target.value })} placeholder={t("printMgmt.purposeExample")} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#f59e0b22', color: '#b45309', border: '1px solid #fcd34d' }}>
                {t("printMgmt.quotaSubmitNote2")}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-2, 8px)' }}>
                <button onClick={() => setQuotaModalOpen(false)} disabled={quotaSaving} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("printMgmt.cancel")}</button>
                <button onClick={handleSubmitQuotaRequest} disabled={quotaSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: quotaSaving ? 'wait' : 'pointer' }}>{quotaSaving ? t("printMgmt.submitting") : t("printMgmt.submitRequest")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 配额使用预警 */}
      <Card title={t("printMgmt.quotaAlertRules")} icon={<AlertTriangle size={16} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {[
            { level: t("printMgmt.green"), threshold: '< 80%', desc: t("printMgmt.usageNormal"), color: C.success },
            { level: t("printMgmt.yellow"), threshold: '80% - 95%', desc: t("printMgmt.nearLimit"), color: C.warning },
            { level: t("printMgmt.red"), threshold: '≥ 95%', desc: t("printMgmt.alertNow"), color: C.danger },
          ].map(rule => (
            <div key={rule.level} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6,
              background: `${rule.color}08`, border: `1px solid ${rule.color}25`
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: rule.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700
              }}>{rule.level[0]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{rule.level} · {rule.threshold}</div>
                <div style={{ fontSize: 12, color: C.textMid }}>{rule.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, color: C.textMid }}>
          {t("printMgmt.overQuotaNote")}
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 渲染打印统计
  // ============================================================
  const renderPrintStatistics = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
      {/* 打印量趋势 */}
      <Card title={t("printMgmt.printVolumeTrend")} icon={<TrendingUp size={16} />} style={{ gridColumn: 'span 2' }}>
        <div style={{ height: 200 }}>
          <ChartContainer height={200} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noTrendData")}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: C.textDark }}
              />
              <Area type="monotone" dataKey="prints" name={t("printMgmt.printSheets")} stroke={C.primary} fill={C.primaryLighter} />
            </AreaChart>
          </ChartContainer>
        </div>
      </Card>

      {/* 各设备打印量 */}
      <Card title={t("printMgmt.printByDevice")} icon={<Monitor size={16} />}>
        <div style={{ height: 200 }}>
          <ChartContainer height={200} state={devicePrintStats.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noDevicePrintData")}>
            <ReBarChart data={devicePrintStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="device" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: C.textDark }}
              />
              <Bar dataKey="printCount" name={t("printMgmt.printCount")} fill={C.primary} radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ChartContainer>
        </div>
      </Card>

      {/* 耗材成本分析 */}
      <Card title={t("printMgmt.consumableCostAnalysis")} icon={<Box size={16} />}>
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)' }}>
          <div style={{ height: 200, flex: 1 }}>
            <ChartContainer height={200} state={filmDistData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noFilmDistData")}>
              <RePieChart>
                <Pie
                  data={filmDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: C.textLight, strokeWidth: 1 }}
                >
                  {filmDistData.map((entry, _index) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                  formatter={(value: number) => [`${value} 张`, t("printMgmt.usage")]}
                />
              </RePieChart>
            </ChartContainer>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-2, 8px)' }}>
            {CONSUMABLE_COSTS.map(item => (
              <div key={item.name} style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMid, marginBottom: 2 }}>
                  <span>{item.name}</span>
                  <span>¥{item.total.toFixed(1)}</span>
                </div>
                <ProgressBar progress={(item.used / 500) * 100} color={C.accent} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 打印效率统计 */}
      <Card title={t("printMgmt.efficiencyStats")} icon={<Timer size={16} />}>
        <div style={{ height: 200 }}>
          <ChartContainer height={200} state={EFFICIENCY_STATS.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noEfficiencyData")}>
            <LineChart data={EFFICIENCY_STATS} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke={C.textLight} />
              <YAxis tick={{ fontSize: 12 }} stroke={C.textLight} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: C.textDark }}
                formatter={(value: number, name: string) => [
                  name === 'avgTime' ? `${value}秒` : `${value}份`,
                  name === 'avgTime' ? t("printMgmt.avgDuration") : t("printMgmt.completedCount")
                ]}
              />
              <Line type="monotone" dataKey="avgTime" name={t("printMgmt.avgDuration")} stroke={C.warning} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="completed" name={t("printMgmt.completedCount")} stroke={C.success} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </div>
      </Card>

      {/* 设备打印占比 */}
      <Card title={t("printMgmt.printShareByDevice")} icon={<PieChart size={16} />}>
        <div style={{ height: 200 }}>
          <ChartContainer height={200} state={deviceDistData.length === 0 ? 'empty' : 'ready'} emptyDescription={t("printMgmt.noDeviceShareData")}>
            <RePieChart>
              <Pie
                data={deviceDistData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: C.textLight, strokeWidth: 1 }}
              >
                {deviceDistData.map((entry, _index) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
                formatter={(value: number) => [`${value} 次`, t("printMgmt.printCount")]}
              />
            </RePieChart>
          </ChartContainer>
        </div>
      </Card>
    </div>
  )

  // ============================================================
  // 弹窗渲染
  // ============================================================

  // 打印机详情弹窗 ([G005 Wave2A P0] 受控表单 → createPrinter/updatePrinter)
  const renderPrinterModal = () => {
    if (!showPrinterModal) return null
    const fields = [
      { label: t("printMgmt.printerName"), key: 'name', type: 'input' },
      { label: t("printMgmt.location"), key: 'location', type: 'input' },
      { label: t("printMgmt.type"), key: 'type', type: 'select', options: ['network', 'local'] },
      { label: t("printMgmt.defaultFilmSpec"), key: 'filmSpec', type: 'select', options: ['14x17', '10x12', '8x10'] },
      { label: t("printMgmt.defaultCopies"), key: 'defaultCopies', type: 'select', options: [1, 2, 3] },
      { label: t("printMgmt.resolutionDpi"), key: 'dpi', type: 'select', options: [300, 600, 1200] },
      { label: t("printMgmt.aeTitle"), key: 'aet', type: 'input' },
      { label: t("printMgmt.hostAddress"), key: 'host', type: 'input' },
      { label: t("printMgmt.port"), key: 'port', type: 'input' },
    ]
    const setField = (key: string, value: any) => setPrinterForm((f: any) => ({ ...f, [key]: value }))
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-6, 24px)', width: 480,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>
              {selectedPrinter ? t("printMgmt.editPrinter") : t("printMgmt.addPrinter2")}
            </span>
            <button onClick={() => setShowPrinterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color={C.textMid} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', maxHeight: '60vh', overflowY: 'auto' }}>
            {fields.map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{field.label}</label>
                {field.type === 'input' ? (
                  <input
                    type="text"
                    value={printerForm[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                      borderRadius: 4, fontSize: 12, boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <select
                    value={printerForm[field.key] ?? field.options?.[0]}
                    onChange={(e) => setField(field.key, e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                      borderRadius: 4, fontSize: 12, boxSizing: 'border-box'
                    }}
                  >
                    {(field.options ?? []).map((opt: any) => (
                      <option key={opt} value={opt}>{field.key === 'type' ? (opt === 'network' ? t("printMgmt.networkPrinter") : t("printMgmt.localPrinter")) : opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-5, 20px)' }}>
            <button
              onClick={() => setShowPrinterModal(false)}
              style={{
                flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4,
                background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer'
              }}
            >
              {t("printMgmt.cancel")}
            </button>
            <button
              onClick={() => void handleSavePrinter()}
              disabled={savingPrinter}
              style={{
                flex: 1, padding: '10px 12px', border: 'none', borderRadius: 4,
                background: C.primary, color: C.white, fontSize: 12, cursor: savingPrinter ? 'not-allowed' : 'pointer'
              }}
            >
              {savingPrinter ? t("printMgmt.saving") : t("printMgmt.save")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // [G005 Wave2A P1] DICOM 预设编辑弹窗 (受控 → localStorage)
  const renderPresetEditModal = () => {
    if (!presetEditOpen) return null
    const setF = (key: string, value: any) => setPresetForm((f: any) => ({ ...f, [key]: value }))
    const rows: Array<{ label: string; key: string; type: 'input' | 'select'; options?: string[] }> = [
      { label: t("printMgmt.presetName"), key: 'name', type: 'input' },
      { label: t("printMgmt.filmSize"), key: 'filmSize', type: 'select', options: ['14x17', '10x12', '8x10', '14x14', '11x14'] },
      { label: t("printMgmt.orientation"), key: 'orientation', type: 'select', options: ['PORTRAIT', 'LANDSCAPE'] },
      { label: t("printMgmt.mediumType"), key: 'mediumType', type: 'select', options: ['BLUE FILM', 'CLEAR FILM', 'MAMMO BLUE'] },
      { label: t("printMgmt.filmOutput"), key: 'filmDestination', type: 'select', options: ['MAGAZINE', 'PROCESSOR'] },
      { label: t("printMgmt.crop"), key: 'trimming', type: 'select', options: ['NO', 'YES'] },
    ]
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-6, 24px)', width: 440, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t("printMgmt.editDicomPreset")}</span>
            <button onClick={() => setPresetEditOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color={C.textMid} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {rows.map(r => (
              <div key={r.key}>
                <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{r.label}</label>
                {r.type === 'input' ? (
                  <input
                    type="text"
                    value={presetForm[r.key] ?? ''}
                    onChange={(e) => setF(r.key, e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
                  />
                ) : (
                  <select
                    value={presetForm[r.key] ?? r.options?.[0]}
                    onChange={(e) => setF(r.key, e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
                  >
                    {(r.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-5, 20px)' }}>
            <button
              onClick={() => setPresetEditOpen(false)}
              style={{ flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.cancel")}
            </button>
            <button
              onClick={handleSaveDicomPreset}
              style={{ flex: 1, padding: '10px 12px', border: 'none', borderRadius: 4, background: C.accent, color: C.white, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.save")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // [G005 Wave2A P1] 模板预览弹窗 (CSS 模拟胶片布局 + 列说明)
  const renderTemplatePreviewModal = () => {
    if (!templatePreviewOpen || !templatePreviewItem) return null
    const tpl = templatePreviewItem
    const cols = 2
    const cells = Math.max(1, tpl.copies ?? 1) * 2
    const legend = [
      { label: t("printMgmt.filmSize"), value: t("printMgmt.size14x17Cm2") },
      { label: t("printMgmt.layout"), value: `${cols} 列 × ${Math.ceil(cells / cols)} 行` },
      { label: t("printMgmt.imageArea"), value: t("printMgmt.imageMatrixExample") },
      { label: t("printMgmt.textArea"), value: t("printMgmt.textContent") },
    ]
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-6, 24px)', width: 620, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t("printMgmt.templatePreviewDash")} {tpl.name}</span>
            <button onClick={() => setTemplatePreviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color={C.textMid} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', alignItems: 'flex-start' }}>
            <div style={{
              width: 340, background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', border: '2px solid #94a3b8',
              borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)'
            }}>
              <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>FILM SPEC: 14x17 · {tpl.type ?? 'CT'} {tpl.includeImages ? '· IMG' : ''}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
                {Array.from({ length: cells }).map((_, i) => (
                  <div key={i} style={{
                    aspectRatio: '1/0.75', background: '#0f172a', borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#475569', fontSize: 10, fontFamily: 'monospace'
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                {tpl.name} · {tpl.copies} {t("printMgmt.copiesDot")} {tpl.includeLogo ? t("printMgmt.includeLogo") : t("printMgmt.noLogo")}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 'var(--space-2, 8px)' }}>{t("printMgmt.filmLayoutNote")}</div>
              {legend.map(l => (
                <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>{l.label}</span>
                  <span style={{ color: C.textDark, fontWeight: 500 }}>{l.value}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: C.textLight, marginTop: 10 }}>{t("printMgmt.layoutNoteBody")}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-5, 20px)' }}>
            <button
              onClick={() => setTemplatePreviewOpen(false)}
              style={{ padding: '10px 24px', border: 'none', borderRadius: 4, background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer' }}
            >
              {t("printMgmt.close")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 预览弹窗
  const renderPreviewModal = () => {
    if (!showPreviewModal || !previewItem) return null
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-6, 24px)', width: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t("printMgmt.filmPrintPreview")}</span>
            <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color={C.textMid} />
            </button>
          </div>
          <div style={{ background: C.bg, borderRadius: 4, padding: 'var(--space-5, 20px)', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <Film size={48} color={C.primary} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
              {[
                { label: t("printMgmt.patientName"), value: previewItem.patientName },
                { label: t("printMgmt.patientId"), value: previewItem.patientId },
                { label: t("printMgmt.examItem"), value: previewItem.studyDesc },
                { label: t("printMgmt.deviceType"), value: previewItem.modality },
                { label: t("printMgmt.filmSpecCol"), value: previewItem.filmSpec },
                { label: t("printMgmt.printCopies"), value: `${previewItem.copies} 份` },
              ].map(item => (
                <div key={item.label} style={{ padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 4 }}>
                  <div style={{ fontSize: 12, color: C.textLight, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ color: C.textDark, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {previewItem.status === 'printing' && (
              <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ color: C.textMid }}>{t("printMgmt.printProgress")}</span>
                  <span style={{ color: C.primary }}>{previewItem.progress}%</span>
                </div>
                <ProgressBar progress={previewItem.progress} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
            <button
              onClick={() => setShowPreviewModal(false)}
              style={{
                flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 4,
                background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer'
              }}
            >
              {t("printMgmt.close")}
            </button>
            <button
              onClick={handleReprint}
              style={{
                flex: 1, padding: '10px 12px', border: 'none', borderRadius: 4,
                background: C.primary, color: C.white, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Printer size={14} /> {t("printMgmt.reprint")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Toast提示组件
  // ============================================================
  const Toast = () => {
    if (!showToast) return null
    const toastColors = {
      success: { bg: '#059669', text: '#ffffff' },
      error: { bg: 'var(--color-error-600)', text: '#ffffff' },
      info: { bg: 'var(--color-primary-600)', text: '#ffffff' }
    }
    const colors = toastColors[toastType]
    return (
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        background: colors.bg,
        color: colors.text,
        padding: '12px 20px',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2, 8px)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {toastType === 'success' && <CheckCircle size={18} />}
        {toastType === 'error' && <XCircle size={18} />}
        {toastType === 'info' && <Info size={18} />}
        <span style={{ fontSize: 14, fontWeight: 500 }}>{toastMessage}</span>
      </div>
    )
  }

  // ============================================================
  // 确认弹窗组件
  // ============================================================
  const ConfirmModal = () => {
    if (!confirmModal.show) return null
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1500
      }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: 'var(--space-6, 24px)',
          width: 400,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3, 12px)',
            marginBottom: 'var(--space-4, 16px)'
          }}>
            {confirmModal.type === 'danger' ? (
              <AlertCircle size={24} color={C.danger} />
            ) : (
              <Info size={24} color={C.primary} />
            )}
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>
              {confirmModal.title}
            </span>
          </div>
          <p style={{ fontSize: 14, color: C.textMid, marginBottom: 'var(--space-5, 20px)' }}>
            {confirmModal.message}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
            <button
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                background: 'var(--bg-card)',
                color: C.textMid,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {confirmModal.cancelText || t("printMgmt.cancel")}
            </button>
            <button
              onClick={confirmModal.onConfirm}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                borderRadius: 4,
                background: confirmModal.type === 'danger' ? C.danger : C.primary,
                color: C.white,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {confirmModal.confirmText || t("printMgmt.ok")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 模板编辑弹窗组件
  // ============================================================
  const TemplateEditModal = () => {
    if (!showTemplateEditModal) return null
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: 'var(--space-6, 24px)',
          width: 480,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4, 16px)'
          }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>
              {isNewTemplate ? t("printMgmt.newTemplate") : t("printMgmt.editTemplate")}
            </span>
            <button
              onClick={() => setShowTemplateEditModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color={C.textMid} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>
                {t("printMgmt.templateName")}
              </label>
              <input
                type="text"
                value={editingTemplate?.name || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder={t("printMgmt.templateNamePlaceholder")}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  fontSize: 12, boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>
                {t("printMgmt.reportType")}
              </label>
              <select
                value={editingTemplate?.type || 'CT'}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  fontSize: 12, background: 'var(--bg-card)'
                }}
              >
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="DR">DR</option>
                <option value="介入">{t("printMgmt.intervention")}</option>
                <option value="急诊">{t("printMgmt.emergency")}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>
                {t("printMgmt.defaultCopies2")}
              </label>
              <select
                value={editingTemplate?.copies || 1}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, copies: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  fontSize: 12, background: 'var(--bg-card)'
                }}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} {t("printMgmt.copiesUnit")}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-5, 20px)' }}>
            <button
              onClick={() => setShowTemplateEditModal(false)}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                background: 'var(--bg-card)',
                color: C.textMid,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {t("printMgmt.cancel")}
            </button>
            <button
              onClick={() => {
                displayToast(isNewTemplate ? t("printMgmt.templateCreated") : t("printMgmt.templateSaved"), 'success')
                setShowTemplateEditModal(false)
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                borderRadius: 4,
                background: C.primary,
                color: C.white,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {t("printMgmt.save")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 主渲染
  // ============================================================

  const sections: Tab[] = [
    { id: 'printConfig', label: t("printMgmt.printConfig"), icon: <Settings size={14} /> },
    { id: 'reportPrint', label: t("printMgmt.imageTextReport"), icon: <FileText size={14} /> },
    { id: 'filmPrint', label: t("printMgmt.filmPrint"), icon: <Film size={14} /> },
    { id: 'dicPrint', label: t("printMgmt.dicomPrintQueue"), icon: <Database size={14} /> },
    { id: 'printSCP', label: t("printMgmt.printScp"), icon: <Server size={14} /> },
    { id: 'costTracking', label: t("printMgmt.costTracking"), icon: <CreditCard size={14} /> },
    { id: 'layouts', label: t("printMgmt.layoutTemplates"), icon: <LayoutGrid size={14} /> },
    { id: 'quota', label: t("printMgmt.quotaManagement"), icon: <ShieldAlert size={14} /> },
    { id: 'statistics', label: t("printMgmt.printStats"), icon: <BarChart size={14} /> },
  ]

  return (
    <div style={{ background: C.bg, padding: 'var(--space-4, 16px)' }}>
      {/* 页面标题 */}
      <PageHeader
        as="h1"
        size="md"
        icon={<Printer size={24} color={C.primary} />}
        title={t("printMgmt.pageTitle")}
        subtitle={<span style={{ fontSize: 12, color: C.textMid }}>{t("printMgmt.pageSubtitle")}</span>}
        style={{ marginBottom: 'var(--space-4, 16px)' }}
      />

      {/* 数据来源标注 ([W2-B] 真实化) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4, 16px)',
        padding: '8px 14px', borderRadius: 6,
        background: dataError ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
        border: `1px solid ${dataError ? '#fecaca' : '#bbf7d0'}`
      }}>
        {dataLoading
          ? <span style={{ fontSize: 12, color: C.textMid }}>{t("printMgmt.loading")}</span>
          : (
            <>
              <span style={{
                fontSize: 12, fontWeight: 600,
                padding: '2px 10px', borderRadius: 10,
                background: dataSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: dataSource === 'api' ? '#15803d' : '#a16207'
              }}>
                {dataSource === 'api' ? t("printMgmt.realData") : t("printMgmt.demoData")}
              </span>
              <span style={{ fontSize: 12, color: dataError ? 'var(--color-error-600)' : '#4b5563' }}>
                {dataError
                  ? dataError
                  : t("printMgmt.dataSourceNote2")}
              </span>
            </>
          )}
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
        {[
          { label: t("printMgmt.todayPrints"), value: todayPrints, unit: t("printMgmt.copiesUnit"), icon: <Printer size={20} />, color: C.primary },
          { label: t("printMgmt.filmsUsed"), value: todayFilms, unit: t("printMgmt.sheetsUnit"), icon: <Film size={20} />, color: C.accent },
          { label: t("printMgmt.todayCost"), value: `¥${todayCost.toFixed(0)}`, unit: '', icon: <DollarSign size={20} />, color: C.success },
          { label: t("printMgmt.onlinePrinters"), value: activePrinters, unit: `/ ${printers.length}`, icon: <Network size={20} />, color: C.warning },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-card)', borderRadius: 6, padding: 'var(--space-4, 16px)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)'
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 8, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: stat.color }}>{stat.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMid }}>{stat.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.textDark }}>
                {stat.value}
                <span style={{ fontSize: 12, fontWeight: 400, color: C.textLight }}> {stat.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 标签页切换 */}
      <Tabs tabs={sections} activeTab={activeSection} onChange={setActiveSection} />

      {/* 内容区域 */}
      {activeSection === 'printConfig' && renderPrintConfig()}
      {activeSection === 'reportPrint' && renderReportPrint()}
      {activeSection === 'filmPrint' && renderFilmPrintManagement()}
      {activeSection === 'dicPrint' && renderDicomPrintQueue()}
      {activeSection === 'printSCP' && renderPrintSCP()}
      {activeSection === 'costTracking' && renderCostTracking()}
      {activeSection === 'layouts' && renderLayoutTemplates()}
      {activeSection === 'quota' && renderQuotaManagement()}
      {activeSection === 'statistics' && renderPrintStatistics()}

      {/* 弹窗 */}
      {renderPrinterModal()}
      {renderPreviewModal()}
      {renderPresetEditModal()}
      {renderTemplatePreviewModal()}
      <Toast />
      <ConfirmModal />
      <TemplateEditModal />

      {/* [G005 Wave1B] 任务详情 Modal: printApi.getJob */}
      {taskDetail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTaskDetail(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 520, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-5, 20px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <Monitor size={16} color={C.primary} /> {t("printMgmt.taskDetailPrefix")} {taskDetail.id}
            </div>
            {taskDetailLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)', color: C.textLight, fontSize: 12 }}>{t("printMgmt.loadingDetail")}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                {[
                  [t("printMgmt.taskId2"), taskDetail.id],
                  [t("printMgmt.patient"), `${taskDetail.patientName ?? ''} ${taskDetail.patientId ? `(${taskDetail.patientId})` : ''}`],
                  [t("printMgmt.examType"), taskDetail.modality ?? '-'],
                  [t("printMgmt.imageType"), taskDetail.studyType ?? taskDetail.studyDesc ?? '-'],
                  [t("printMgmt.filmSpecCol"), taskDetail.filmSpec ?? '-'],
                  [t("printMgmt.copies"), taskDetail.copies ?? 1],
                  [t("printMgmt.printer"), taskDetail.printer ?? '-'],
                  [t("printMgmt.status"), taskDetail.status ?? '-'],
                  [t("printMgmt.submittedAt"), taskDetail.submitTime ?? '-'],
                  [t("printMgmt.completedAt"), taskDetail.completeTime ?? '-'],
                  [t("printMgmt.progress"), taskDetail.progress != null ? `${taskDetail.progress}%` : '-'],
                  [t("printMgmt.errorMessage"), taskDetail.errorMsg ?? '-'],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: 12, color: C.textLight, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 500, color: C.textDark }}>{String(value ?? '-')}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4, 16px)' }}>
              <button onClick={() => setTaskDetail(null)} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 4, background: 'var(--bg-card)', color: C.textMid, fontSize: 12, cursor: 'pointer' }}>{t("printMgmt.close")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
