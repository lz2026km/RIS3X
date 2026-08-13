// G005 放射科RIS系统 - 检查模板管理页面 v1.0.0
// 功能：CT/MRI/X线报告模板维护，含搜索、新增/编辑/删除、预览功能
// [G005 v3.0.6.11-90 Wave 4A (PACS P0-3)] 批量导入导出 (JSON/文本, templatesApi 真实数据)
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { templatesApi } from '../services/api/templatesApi'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ListOrdered, FileEdit, Tag, Plus, X, Search, Eye, Edit2, Trash2, Save, Check, Copy, FileText, Activity, Scan, Image as ImageIcon, Stethoscope, Filter, GitBranch, FolderTree, Wand2, TrendingUp, BarChart2, Users, Share2, Shield, History, RotateCcw, Star, Globe, Upload, Download } from 'lucide-react'

const C = {
  primary: '#1e40af', primaryLight: '#3b82f6', primaryLighter: 'var(--color-info-bg)',
  accent: '#0891b2', accentLight: '#06b6d4', white: '#ffffff',
  bg: 'var(--bg-deep)', bgLight: 'var(--content-bg)', border: 'var(--border-color)', borderLight: 'var(--border-color)',
  textDark: 'var(--text-primary)', textMid: 'var(--text-secondary)', textLight: 'var(--text-muted)',
  success: '#059669', successLight: 'var(--color-success-bg)', warning: '#d97706', warningLight: 'var(--color-warning-bg)',
  danger: '#dc2626', dangerLight: 'var(--color-error-bg)', info: '#2563eb', infoLight: 'var(--color-info-bg)',
}

interface TemplateRecord {
  id: string
  code: string
  name: string
  modality: 'CT' | 'MRI' | 'X线'
  category: string
  subCategory: string
  content: string
  tags: string[]
  author: string
  createTime: string
  updateTime: string
  usageCount: number
  status: 'active' | 'inactive'
  version: string
}

interface TemplateVersion {
  id: string
  templateId: string
  version: string
  status: 'draft' | 'review' | 'published' | 'archived'
  changedBy: string
  changedAt: string
  changeLog: string
  content: string
}

interface ShareEntry {
  templateId: string
  sharedWith: string
  permission: 'view' | 'edit' | 'admin'
  sharedBy: string
  sharedAt: string
  department: string
}

const initialTemplates: TemplateRecord[] = [
  { id: 'tpl-001', code: 'CT-BRAIN-001', name: '颅脑CT平扫模板', modality: 'CT', category: '颅脑', subCategory: '平扫', content: '【检查技术】\n扫描参数：层厚5mm，层间距5mm，FOV 25cm\n扫描范围：颅顶至颅底\n\n【影像表现】\n1. 脑实质密度：未见异常密度影\n2. 脑室系统：形态、大小正常\n3. 中线结构：居中\n4. 脑沟脑裂：未见增宽\n5. 颅骨：骨质结构完整，未见骨折\n\n【诊断意见】\n颅脑CT平扫未见明显异常', tags: ['颅脑', '平扫', '常规'], author: '张明', createTime: '2024-01-15 10:30', updateTime: '2024-03-20 14:22', usageCount: 1256, status: 'active', version: 'v2.1' },
  { id: 'tpl-002', code: 'CT-CHEST-001', name: '胸部CT平扫模板', modality: 'CT', category: '胸部', subCategory: '平扫', content: '【检查技术】\n扫描参数：层厚5mm，层间距5mm，FOV 38cm\n扫描范围：肺尖至肺底\n\n【影像表现】\n1. 肺野：双肺纹理清晰，未见实变影\n2. 胸膜：胸膜无增厚，胸腔无积液\n3. 纵隔：纵隔结构清晰，无肿大淋巴结\n4. 心影：形态、大小正常\n5. 胸廓：骨质结构完整\n\n【诊断意见】\n胸部CT平扫未见明显异常', tags: ['胸部', '平扫', '常规'], author: '李华', createTime: '2024-01-18 09:15', updateTime: '2024-04-10 11:30', usageCount: 982, status: 'active', version: 'v2.0' },
  { id: 'tpl-003', code: 'CT-ABD-001', name: '腹部CT平扫模板', modality: 'CT', category: '腹部', subCategory: '平扫', content: '【检查技术】\n扫描参数：层厚5mm，层间距5mm，FOV 35cm\n扫描范围：膈顶至髂嵴\n\n【影像表现】\n1. 肝脏：形态、大小正常，密度均匀\n2. 胆囊：壁不厚，腔内未见结石\n3. 脾脏：大小、形态正常\n4. 胰腺：轮廓清晰，未见异常\n5. 肾脏：双肾形态正常，未见结石\n6. 腹膜后：未见肿大淋巴结\n\n【诊断意见】\n腹部CT平扫未见明显异常', tags: ['腹部', '平扫', '常规'], author: '王芳', createTime: '2024-02-01 14:00', updateTime: '2024-04-15 16:45', usageCount: 845, status: 'active', version: 'v1.8' },
  { id: 'tpl-004', code: 'CT-Spine-001', name: '颈椎CT平扫模板', modality: 'CT', category: '脊柱', subCategory: '颈椎', content: '【检查技术】\n扫描参数：层厚2mm，层间距2mm，FOV 20cm\n扫描范围：C1-C7\n\n【影像表现】\n1. 椎体：各椎体形态正常，骨质结构完整\n2. 椎间盘：未见突出或膨出\n3. 椎管：形态、宽度正常\n4. 韧带：未见钙化或肥厚\n5. 软组织：未见异常密度影\n\n【诊断意见】\n颈椎CT平扫未见明显异常', tags: ['脊柱', '颈椎', '平扫'], author: '刘强', createTime: '2024-02-10 11:20', updateTime: '2024-03-25 09:30', usageCount: 567, status: 'active', version: 'v1.5' },
  { id: 'tpl-005', code: 'MRI-BRAIN-001', name: '颅脑MRI平扫模板', modality: 'MRI', category: '颅脑', subCategory: '平扫', content: '【检查技术】\n扫描序列：T1WI、T2WI、FLAIR、DWI\n层厚：5mm，层间距：1mm\n\n【影像表现】\n1. 脑实质：未见异常信号灶\n2. 脑室系统：形态、大小正常\n3. 中线结构：居中\n4. 脑沟脑裂：未见增宽或变窄\n5. 颅骨：未见异常信号\n\n【诊断意见】\n颅脑MRI平扫未见明显异常', tags: ['颅脑', '平扫', 'MRI', '常规'], author: '张明', createTime: '2024-02-15 08:45', updateTime: '2024-04-18 10:15', usageCount: 723, status: 'active', version: 'v2.2' },
  { id: 'tpl-006', code: 'MRI-KNEE-001', name: '膝关节MRI模板', modality: 'MRI', category: '关节', subCategory: '膝关节', content: '【检查技术】\n扫描序列：T1WI、T2WI、PDWI、脂肪抑制\n层厚：3mm\n\n【影像表现】\n1. 半月板：形态完整，未见撕裂信号\n2. 交叉韧带：前/后交叉韧带连续性完好\n3. 侧副韧带：内/外侧副韧带信号正常\n4. 关节软骨：厚度均匀，信号未见异常\n5. 关节腔：未见积液\n6. 周围软组织：未见肿块\n\n【诊断意见】\n膝关节MRI未见明显异常', tags: ['关节', '膝关节', 'MRI'], author: '陈静', createTime: '2024-02-20 15:30', updateTime: '2024-04-20 14:00', usageCount: 456, status: 'active', version: 'v1.3' },
  { id: 'tpl-007', code: 'X-CHEST-001', name: '胸部X线正侧位模板', modality: 'X线', category: '胸部', subCategory: '正侧位', content: '【检查技术】\n投照体位：胸部正位、侧位\n曝光参数：120kV，200mA\n\n【影像表现】\n1. 肺野：双肺纹理清晰，肺野透亮度正常\n2. 肺门：结构清晰，无增大\n3. 纵隔：纵隔居中，无增宽\n4. 心影：形态、大小正常\n5. 胸廓：双侧对称，肋骨骨质完整\n6. 膈肌：双侧膈面光滑，肋膈角锐利\n\n【诊断意见】\n胸部X线片未见明显异常', tags: ['胸部', 'X线', '正侧位'], author: '李华', createTime: '2024-02-25 10:00', updateTime: '2024-04-22 11:20', usageCount: 1580, status: 'active', version: 'v3.0' },
  { id: 'tpl-008', code: 'X-SPINE-001', name: '腰椎X线正侧位模板', modality: 'X线', category: '脊柱', subCategory: '腰椎', content: '【检查技术】\n投照体位：腰椎正位、侧位、双斜位\n曝光参数：75kV，400mA\n\n【影像表现】\n1. 椎体：L1-L5椎体形态正常，骨质结构完整\n2. 椎间隙：椎间隙宽度正常\n3. 椎弓根：双侧对称，未见骨折\n4. 棘突：棘突连线居中\n5. 软组织：椎旁软组织层次清晰\n\n【诊断意见】\n腰椎X线片未见明显异常', tags: ['脊柱', '腰椎', 'X线'], author: '王芳', createTime: '2024-03-01 09:30', updateTime: '2024-04-25 15:40', usageCount: 892, status: 'active', version: 'v2.1' },
  { id: 'tpl-009', code: 'CT-HEADCTA-001', name: '头颅CTA模板', modality: 'CT', category: '颅脑', subCategory: 'CTA', content: '【检查技术】\n扫描参数：层厚0.625mm，FOV 20cm\n对比剂：碘普罗胺350mgI/ml，80ml\n注射速率：5ml/s\n\n【影像表现】\n1. 脑动脉：各分支走行自然，管腔未见狭窄或扩张\n2. Willis环：环完整性好\n3. 动脉瘤：未检出\n4. 血管畸形：未见\n5. 脑实质：未见出血或梗死\n\n【诊断意见】\n头颅CTA未见明显异常', tags: ['颅脑', 'CTA', '血管'], author: '张明', createTime: '2024-03-05 14:20', updateTime: '2024-04-28 09:15', usageCount: 345, status: 'active', version: 'v1.6' },
  { id: 'tpl-010', code: 'CT-ABDCE-001', name: '腹部增强CT模板', modality: 'CT', category: '腹部', subCategory: '增强', content: '【检查技术】\n扫描参数：层厚5mm，动脉期/静脉期/延迟期\n对比剂：碘普罗胺350mgI/ml，100ml\n\n【影像表现】\n1. 动脉期：肝脏、脾脏动脉期强化均匀\n2. 静脉期：门静脉、肝静脉显示清晰\n3. 延迟期：胆囊、胆管未见异常\n4. 肝脏：未见异常强化灶\n5. 胰腺：强化均匀，胰管无扩张\n6. 肾脏：皮质期、髓质期、分泌期正常\n\n【诊断意见】\n腹部增强CT未见明显异常', tags: ['腹部', '增强', 'CT'], author: '刘强', createTime: '2024-03-10 11:45', updateTime: '2024-05-01 16:30', usageCount: 412, status: 'active', version: 'v1.4' },
  { id: 'tpl-011', code: 'MRI-SPINE-001', name: '腰椎MRI模板', modality: 'MRI', category: '脊柱', subCategory: '腰椎', content: '【检查技术】\n扫描序列：T1WI、T2WI、脂肪抑制\n层厚：4mm\n\n【影像表现】\n1. 椎体：L1-S1椎体形态正常，信号均匀\n2. 椎间盘：T2WI信号正常，未见突出\n3. 硬膜囊：形态正常，未受压\n4. 神经根：未见水肿或受压\n5. 椎管：未见狭窄\n6. 周围软组织：未见异常\n\n【诊断意见】\n腰椎MRI平扫未见明显异常', tags: ['脊柱', '腰椎', 'MRI'], author: '陈静', createTime: '2024-03-15 08:00', updateTime: '2024-05-05 10:20', usageCount: 634, status: 'active', version: 'v2.0' },
  { id: 'tpl-012', code: 'X-PELVIS-001', name: '骨盆X线模板', modality: 'X线', category: '骨盆', subCategory: '正位', content: '【检查技术】\n投照体位：骨盆正位\n曝光参数：80kV，300mA\n\n【影像表现】\n1. 髂骨：双侧形态对称，骨质结构完整\n2. 耻骨联合：间隙正常\n3. 髋臼：双侧形态对称，未见骨折\n4. 股骨头：双侧形态规则，骨质完整\n5. 关节间隙：双侧等宽，间隙正常\n6. 软组织：未见异常钙化\n\n【诊断意见】\n骨盆X线片未见明显异常', tags: ['骨盆', 'X线', '常规'], author: '李华', createTime: '2024-03-20 13:15', updateTime: '2024-05-08 14:45', usageCount: 523, status: 'active', version: 'v1.7' },
  { id: 'tpl-013', code: 'CT-PELVIS-001', name: '盆腔CT平扫模板', modality: 'CT', category: '盆腔', subCategory: '平扫', content: '【检查技术】\n扫描参数：层厚5mm，层间距5mm\n扫描范围：髂嵴至耻骨联合\n\n【影像表现】\n1. 膀胱：充盈良好，壁不厚\n2. 前列腺/子宫：形态、大小正常\n3. 直肠：肠壁无增厚\n4. 盆腔淋巴结：未见肿大\n5. 盆腔积液：未见\n6. 骨骼：骨质结构完整\n\n【诊断意见】\n盆腔CT平扫未见明显异常', tags: ['盆腔', '平扫', 'CT'], author: '王芳', createTime: '2024-03-25 10:30', updateTime: '2024-05-10 09:00', usageCount: 398, status: 'active', version: 'v1.3' },
  { id: 'tpl-014', code: 'MRI-LIVER-001', name: '肝脏MRI平扫模板', modality: 'MRI', category: '腹部', subCategory: '肝脏', content: '【检查技术】\n扫描序列：T1WI、T2WI、DWI、脂肪抑制\n层厚：5mm\n\n【影像表现】\n1. 肝脏：形态、大小正常，信号均匀\n2. 肝内管道：走行自然，无扩张\n3. 肝脏病变：未见异常信号灶\n4. 胆道：肝内外胆管无扩张\n5. 胆囊：壁不厚，腔内未见结石\n6. 脾脏：大小、信号正常\n\n【诊断意见】\n肝脏MRI平扫未见明显异常', tags: ['腹部', '肝脏', 'MRI'], author: '刘强', createTime: '2024-04-01 15:45', updateTime: '2024-05-12 11:30', usageCount: 287, status: 'active', version: 'v1.2' },
  { id: 'tpl-015', code: 'X-SHOULDER-001', name: '肩关节X线模板', modality: 'X线', category: '关节', subCategory: '肩关节', content: '【检查技术】\n投照体位：肩关节正位、穿胸位\n曝光参数：65kV，200mA\n\n【影像表现】\n1. 肱骨头：形态规则，骨质完整\n2. 关节盂：未见骨质破坏\n3. 肩峰：骨质结构完整\n4. 软组织：未见异常钙化\n5. 关节间隙：正常\n\n【诊断意见】\n肩关节X线片未见明显异常', tags: ['关节', '肩关节', 'X线'], author: '陈静', createTime: '2024-04-05 09:00', updateTime: '2024-05-15 10:00', usageCount: 345, status: 'active', version: 'v1.1' },
  { id: 'tpl-016', code: 'CT-SINUS-001', name: '副鼻窦CT模板', modality: 'CT', category: '头颈', subCategory: '副鼻窦', content: '【检查技术】\n扫描参数：层厚2mm，层间距2mm\n扫描范围：额窦至上颌窦\n\n【影像表现】\n1. 上颌窦：黏膜无增厚，窦腔清晰\n2. 筛窦：气化良好，未见密度增高\n3. 额窦：窦腔清晰，骨质完整\n4. 蝶窦：窦腔清晰，无占位\n5. 鼻中隔：居中，无弯曲\n6. 周围骨质：未见骨质破坏\n\n【诊断意见】\n副鼻窦CT平扫未见明显异常', tags: ['头颈', '副鼻窦', 'CT'], author: '张明', createTime: '2024-04-10 14:30', updateTime: '2024-05-18 15:20', usageCount: 432, status: 'active', version: 'v1.4' },
  { id: 'tpl-017', code: 'MRI-PROSTATE-001', name: '前列腺MRI模板', modality: 'MRI', category: '盆腔', subCategory: '前列腺', content: '【检查技术】\n扫描序列：T1WI、T2WI、DWI、脂肪抑制\n层厚：3mm\n\n【影像表现】\n1. 前列腺：体积约30ml，信号均匀\n2. 移行带：信号未见异常\n3. 外周带：T2WI高信号，未见结节\n4. 精囊腺：双侧对称，信号正常\n5. 周围脂肪：清晰\n6. 淋巴结：未见肿大\n\n【诊断意见】\n前列腺MRI平扫未见明显异常', tags: ['盆腔', '前列腺', 'MRI'], author: '刘强', createTime: '2024-04-15 11:00', updateTime: '2024-05-20 09:45', usageCount: 234, status: 'active', version: 'v1.0' },
  { id: 'tpl-018', code: 'X-ABDOMEN-001', name: '腹部X线立位片模板', modality: 'X线', category: '腹部', subCategory: '立位片', content: '【检查技术】\n投照体位：腹部立位\n曝光参数：75kV，300mA\n\n【影像表现】\n1. 膈肌：双侧膈面光滑，肋膈角锐利\n2. 肝脏：肝影正常\n3. 脾脏：脾影正常\n4. 肠管：未见气液平面\n5. 腹腔：未见游离气体\n6. 骨骼：腰椎、骨盆骨质完整\n\n【诊断意见】\n腹部X线立位片未见明显异常', tags: ['腹部', 'X线', '立位'], author: '李华', createTime: '2024-04-20 10:15', updateTime: '2024-05-22 14:30', usageCount: 678, status: 'active', version: 'v2.0' },
  { id: 'tpl-019', code: 'CT-ANGIO-001', name: '肺动脉CTA模板', modality: 'CT', category: '胸部', subCategory: 'CTA', content: '【检查技术】\n扫描参数：层厚1mm，FOV 35cm\n对比剂：碘普罗胺350mgI/ml，80ml\n注射速率：4ml/s\n\n【影像表现】\n1. 肺动脉主干：未见栓塞\n2. 左肺动脉：管腔通畅\n3. 右肺动脉：管腔通畅\n4. 叶段肺动脉：未见充盈缺损\n5. 肺实质：未见梗死灶\n6. 纵隔：未见肿大淋巴结\n\n【诊断意见】\n肺动脉CTA未见明显异常', tags: ['胸部', 'CTA', '血管', '肺动脉'], author: '王芳', createTime: '2024-04-25 08:30', updateTime: '2024-05-25 11:15', usageCount: 189, status: 'active', version: 'v1.1' },
  { id: 'tpl-020', code: 'MRI-BREAST-001', name: '乳腺MRI平扫模板', modality: 'MRI', category: '乳腺', subCategory: '平扫', content: '【检查技术】\n扫描序列：T1WI、T2WI、脂肪抑制、DWI\n层厚：3mm\n\n【影像表现】\n1. 双侧乳腺：腺体分布对称\n2. 信号：T1WI呈中等信号，T2WI呈高信号\n3. 肿块：未见异常强化肿块\n4. 乳头：双侧对称，无内陷\n5. 皮肤：未见增厚\n6. 腋窝：淋巴结未见肿大\n\n【诊断意见】\n乳腺MRI平扫未见明显异常', tags: ['乳腺', 'MRI', '平扫'], author: '陈静', createTime: '2024-04-30 13:00', updateTime: '2024-05-28 10:00', usageCount: 156, status: 'active', version: 'v1.0' }
]

const mockVersions: TemplateVersion[] = [
  { id: 'TV-001', templateId: 'tpl-001', version: 'v1.0', status: 'published', changedBy: '张明', changedAt: '2024-01-15 10:30', changeLog: '初始版本创建', content: '' },
  { id: 'TV-002', templateId: 'tpl-001', version: 'v1.1', status: 'published', changedBy: '李华', changedAt: '2024-02-20 14:00', changeLog: '更新检查技术参数', content: '' },
  { id: 'TV-003', templateId: 'tpl-001', version: 'v2.0', status: 'published', changedBy: '王芳', changedAt: '2024-03-20 14:22', changeLog: '新增影像表现描述，优化排版', content: '' },
  { id: 'TV-004', templateId: 'tpl-001', version: 'v2.1', status: 'draft', changedBy: '刘强', changedAt: '2024-06-01 09:00', changeLog: '待审核：更新适应症描述', content: '' },
  { id: 'TV-005', templateId: 'tpl-007', version: 'v1.0', status: 'published', changedBy: '李华', changedAt: '2024-02-25 10:00', changeLog: '初始版本', content: '' },
  { id: 'TV-006', templateId: 'tpl-007', version: 'v2.0', status: 'published', changedBy: '王芳', changedAt: '2024-03-15 11:30', changeLog: '增加侧位描述', content: '' },
  { id: 'TV-007', templateId: 'tpl-007', version: 'v3.0', status: 'published', changedBy: '张明', changedAt: '2024-04-22 11:20', changeLog: '优化诊断意见', content: '' },
]

const mockShares: ShareEntry[] = [
  { templateId: 'tpl-001', sharedWith: '急诊科', permission: 'view', sharedBy: '张明', sharedAt: '2024-05-01', department: '放射科' },
  { templateId: 'tpl-001', sharedWith: '神经内科', permission: 'edit', sharedBy: '李华', sharedAt: '2024-05-10', department: '放射科' },
  { templateId: 'tpl-007', sharedWith: '呼吸科', permission: 'view', sharedBy: '王芳', sharedAt: '2024-05-15', department: '放射科' },
  { templateId: 'tpl-005', sharedWith: '康复科', permission: 'admin', sharedBy: '张明', sharedAt: '2024-06-01', department: '放射科' },
]

const generateId = () => `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const formatDate = (date: Date) => {
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const usageTrend = [120, 135, 142, 138, 150, 155, 160, 175, 180, 185, 190, 200]


export default function TemplateManagementPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterModality, setFilterModality] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRecord | null>(null)
  const [formData, setFormData] = useState<Partial<TemplateRecord>>({ code: '', name: '', modality: 'CT', category: '', subCategory: '', content: '', tags: [], status: 'active', version: 'v1.0' })
  const [tagInput, setTagInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const pageSize = 10
  const [activeTab, setActiveTab] = useState<'manage' | 'version' | 'analytics' | 'share'>('manage')

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-3)] 批量导入文件输入
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadApiTemplates = useCallback(() => {
    templatesApi.list().then((res: any) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((d: any) => ({
          id: d.id,
          code: d.category + '-' + d.bodyPart,
          name: d.name,
          modality: d.modality || 'CT',
          category: d.category,
          subCategory: d.bodyPart,
          content: d.body,
          tags: d.tags || [],
          author: d.createdById,
          createTime: d.createdAt || '',
          updateTime: d.updatedAt || '',
          usageCount: 0,
          status: 'active',
          version: 'v1.0',
        }))
        setTemplates(mapped)
      }
    })
  }, [])

  useEffect(() => {
    loadApiTemplates()
  }, [loadApiTemplates])

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-3)] 批量导出: 当前全部模板 (templatesApi.list 真实数据) → JSON Blob
  const handleExportTemplates = async () => {
    setExporting(true)
    try {
      const res = await templatesApi.list()
      const items = Array.isArray(res.data) && res.data.length > 0 ? res.data : templates
      const exportData = items.map((t: any) => ({
        name: t.name,
        category: t.category,
        content: t.body ?? t.content,
        modality: t.modality ?? 'CT',
        bodyPart: t.bodyPart,
        tags: t.tags ?? [],
      }))
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-templates-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`已导出 ${exportData.length} 条模板 (JSON)`)
    } catch {
      showToast('批量导出失败: 请检查模板数据')
    }
    setExporting(false)
  }

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-3)] 批量导入: JSON/文本解析 → 逐条 templatesApi.create
  const handleImportTemplates = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      let parsed: any
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('文件不是合法 JSON')
      }
      const items: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.templates) ? parsed.templates : []
      if (items.length === 0) throw new Error('未解析到模板数据（请确认文件为 JSON 数组）')
      let ok = 0
      let failed = 0
      const firstError: string[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i] ?? {}
        const name = String(it.name ?? '').trim()
        const content = String(it.content ?? it.body ?? '').trim()
        const category = String(it.category ?? 'general').trim() || 'general'
        const modality = String(it.modality ?? 'CT').trim() || 'CT'
        if (!name || !content) {
          failed++
          firstError.push(`第 ${i + 1} 条缺少模板名称/内容`)
          continue
        }
        try {
          const res = await templatesApi.create({
            name,
            category,
            bodyPart: String(it.bodyPart ?? category ?? 'general'),
            body: content,
            modality,
            createdById: 'current',
            tags: Array.isArray(it.tags) ? it.tags : [],
          })
          if (res.success) ok++
          else { failed++; firstError.push(`第 ${i + 1} 条: ${res.error?.message ?? '创建失败'}`) }
        } catch {
          failed++
          firstError.push(`第 ${i + 1} 条: 网络错误`)
        }
      }
      if (ok > 0) {
        showToast(`批量导入完成: 成功 ${ok} 条${failed > 0 ? `, 失败 ${failed} 条` : ''}`)
        loadApiTemplates()
      } else {
        showToast(`批量导入失败: ${firstError[0] ?? '全部失败'}`)
      }
    } catch (e) {
      showToast(`批量导入失败: ${(e as Error).message}`)
    }
    setImporting(false)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      const matchKeyword = searchKeyword === '' || tpl.name.toLowerCase().includes(searchKeyword.toLowerCase()) || tpl.code.toLowerCase().includes(searchKeyword.toLowerCase()) || tpl.tags.some(tag => tag.toLowerCase().includes(searchKeyword.toLowerCase())) || tpl.content.toLowerCase().includes(searchKeyword.toLowerCase())
      const matchModality = filterModality === 'all' || tpl.modality === filterModality
      const matchStatus = filterStatus === 'all' || tpl.status === filterStatus
      return matchKeyword && matchModality && matchStatus
    })
  }, [templates, searchKeyword, filterModality, filterStatus])

  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTemplates.slice(start, start + pageSize)
  }, [filteredTemplates, currentPage])

  const totalPages = Math.ceil(filteredTemplates.length / pageSize)

  const handleSearch = () => setCurrentPage(1)

  const handleAdd = () => {
    setModalMode('add')
    setFormData({ code: '', name: '', modality: 'CT', category: '', subCategory: '', content: '', tags: [], status: 'active', version: 'v1.0' })
    setTagInput('')
    setShowModal(true)
  }

  const handleEdit = (template: TemplateRecord) => {
    setModalMode('edit')
    setFormData({ ...template })
    setTagInput('')
    setShowModal(true)
  }

  const handlePreview = (template: TemplateRecord) => {
    setPreviewTemplate(template)
    setShowPreview(true)
  }

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.content) {
      setValidationError('请填写必填项（模板代码、名称、内容）')
      setTimeout(() => setValidationError(null), 3000)
      return
    }
    if (modalMode === 'add') {
      const newTemplate: TemplateRecord = { ...formData as TemplateRecord, id: generateId(), author: '当前用户', createTime: formatDate(new Date()), updateTime: formatDate(new Date()), usageCount: 0 }
      await templatesApi.create({
        name: formData.name!,
        category: formData.category || 'general',
        bodyPart: formData.subCategory || 'general',
        body: formData.content!,
        createdById: 'current',
        tags: formData.tags,
      })
      setTemplates([newTemplate, ...templates])
    } else {
      await templatesApi.update(formData.id!, {
        name: formData.name,
        category: formData.category,
        bodyPart: formData.subCategory,
        body: formData.content,
        tags: formData.tags,
      })
      setTemplates(templates.map(tpl => tpl.id === formData.id ? { ...tpl, ...formData, updateTime: formatDate(new Date()) } as TemplateRecord : tpl))
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除该模板吗？')) {
      await templatesApi.delete(id)
      setTemplates(templates.filter(tpl => tpl.id !== id))
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    showToast('已复制到剪贴板')
  }

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tag) || [] })
  }

  const getModalityIcon = (modality: string) => {
    switch (modality) { case 'CT': return <Scan size={16} style={{ color: C.primary }} />; case 'MRI': return <Activity size={16} style={{ color: C.accent }} />; case 'X线': return <ImageIcon size={16} style={{ color: C.success }} />; default: return <FileText size={16} /> }
  }

  const renderTab = (key: string, label: string, icon: React.ReactNode) => (
    <button key={key} onClick={() => setActiveTab(key as any)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeTab === key ? C.primary : 'transparent', color: activeTab === key ? '#fff' : C.textMid }}>
      {icon} {label}
    </button>
  )

  const renderVersionTab = () => {
    const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-001')
    const [versions, setVersions] = useState<TemplateVersion[]>(mockVersions)
    const [diffView, setDiffView] = useState<string | null>(null)

    const templateVersions = versions.filter(v => v.templateId === selectedTemplateId)
    const draftVersion = templateVersions.find(v => v.status === 'draft')
    const publishedVersion = templateVersions.find(v => v.status === 'published')

    const handleSubmitReview = () => {
      if (!draftVersion) return
      setVersions(prev => prev.map(v => v.id === draftVersion.id ? { ...v, status: 'review' as const, changeLog: '已提交审核：等待审核人确认' } : v))
      showToast(`已提交审核版本 ${draftVersion.version}，等待审核人确认`)
    }

    // [Wave2A] 版本回滚: 模板后端无版本端点 → 快照回滚 (templatesApi.update 恢复模板内容 + 本地版本状态)
    const handleRollback = async (v: TemplateVersion) => {
      const target = templates.find(t => t.id === selectedTemplateId)
      const snapshot = v.content || target?.content || ''
      let apiOk = true
      try {
        const res = await templatesApi.update(selectedTemplateId, { body: snapshot })
        apiOk = res.success
      } catch { apiOk = false }
      setVersions(prev => prev.map(x => {
        if (x.id === v.id) {
          return { ...x, status: 'published' as const, changeLog: `已回滚: 恢复至 ${v.version} (${new Date().toLocaleDateString('zh-CN')})` }
        }
        if (x.status === 'draft' || x.status === 'review') {
          return { ...x, status: 'archived' as const, changeLog: `${x.changeLog || '历史版本'} · 已被回滚操作归档` }
        }
        return x
      }))
      showToast(`已回滚至 ${v.version}（模板内容已恢复${apiOk ? '，已同步后端' : '，后端同步失败·本地快照生效'}）`)
    }

    return (
      <div style={{ display: activeTab === 'version' ? undefined : 'none', background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <History size={20} color={C.primary} />
          <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>版本管理</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>演示数据（版本）</span>
          <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} style={{ marginLeft: 'auto', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.textDark, background: 'var(--bg-card)', cursor: 'pointer' }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.version})</option>)}
          </select>
          {draftVersion && (
            <button onClick={handleSubmitReview} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: C.success, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Shield size={14} /> 提交审核
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {publishedVersion && (
            <div style={{ flex: 1, background: C.successLight, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.success}` }}>
              <div style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>生产版本</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>{publishedVersion.version}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>{publishedVersion.changedAt} · {publishedVersion.changedBy}</div>
            </div>
          )}
          {draftVersion && (
            <div style={{ flex: 1, background: C.warningLight, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.warning}` }}>
              <div style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>草稿版本</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.warning }}>{draftVersion.version}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>{draftVersion.changedAt} · {draftVersion.changedBy}</div>
            </div>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bgLight }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>版本</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>状态</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>修改人</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>修改时间</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>变更说明</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {templateVersions.map(v => (
              <tr key={v.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: '10px 14px' }}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.primary }}>{v.version}</span></td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: v.status === 'published' ? C.successLight : v.status === 'draft' ? C.warningLight : v.status === 'review' ? C.infoLight : C.bgLight,
                    color: v.status === 'published' ? C.success : v.status === 'draft' ? C.warning : v.status === 'review' ? C.info : C.textLight,
                  }}>
                    {v.status === 'published' ? '已发布' : v.status === 'draft' ? '草稿' : v.status === 'review' ? '审核中' : '已归档'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: C.textMid }}>{v.changedBy}</td>
                <td style={{ padding: '10px 14px', color: C.textMid }}>{v.changedAt}</td>
                <td style={{ padding: '10px 14px', color: C.textDark }}>{v.changeLog}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDiffView(diffView === v.id ? null : v.id)} style={{ padding: '4px 8px', background: C.bgLight, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Eye size={14} /> {diffView === v.id ? '收起' : '对比'}
                    </button>
                    {v.status === 'published' && (
                      <button onClick={() => void handleRollback(v)} style={{ padding: '4px 8px', background: C.warningLight, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: C.warning, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <RotateCcw size={14} /> 回滚
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {diffView && (
          <div style={{ marginTop: 12, background: C.bgLight, borderRadius: 8, padding: 12, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 8 }}>版本差异</div>
            <div style={{ fontSize: 12, color: C.success, background: C.successLight, padding: '6px 10px', borderRadius: 4, marginBottom: 4 }}>+ 新增：适应症补充说明</div>
            <div style={{ fontSize: 12, color: C.danger, background: C.dangerLight, padding: '6px 10px', borderRadius: 4 }}>- 删除：旧版扫描参数描述</div>
          </div>
        )}
      </div>
    )
  }

  const renderAnalyticsTab = () => {
    const sortedByUsage = [...templates].sort((a, b) => b.usageCount - a.usageCount)
    const totalUsage = templates.reduce((s, t) => s + t.usageCount, 0)

    return (
      <div style={{ display: activeTab === 'analytics' ? undefined : 'none' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TrendingUp size={18} color={C.accent} />
                <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>使用趋势（近12个月）</span>
              </div>
              <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 8px' }}>
                {usageTrend.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: '100%', height: `${(v / 200) * 160}px`, background: `hsl(${220 + i * 5}, 70%, ${50 + i * 2}%)`, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                    <span style={{ fontSize: 8, color: C.textLight }}>{i + 1}月</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BarChart2 size={18} color={C.primary} />
                <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>最常用模板 TOP 5</span>
              </div>
              {sortedByUsage.slice(0, 5).map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? C.warning : C.textLight, minWidth: 24 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{t.modality} · {t.author}</div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.success }}>{t.usageCount}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: 350 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BarChart2 size={18} color={C.primary} />
                <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>概览</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: C.primaryLighter, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.primary }}>{templates.length}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>模板总数</div>
                </div>
                <div style={{ background: C.successLight, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>{totalUsage}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>总使用次数</div>
                </div>
                <div style={{ background: C.warningLight, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.warning }}>{Math.round(totalUsage / templates.length)}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>平均使用</div>
                </div>
                <div style={{ background: C.infoLight, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.info }}>{templates.filter(t => t.status === 'active').length}</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>活跃模板</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Star size={18} color={C.warning} />
                <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>用户满意度</span>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.warning }}>4.5</div>
                <div style={{ fontSize: 12, color: C.textLight }}>/ 5.0</div>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', margin: '6px 0' }}>
                  {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: s <= 4 ? C.warning : C.border, fontSize: 18 }}>★</span>)}
                </div>
                <div style={{ fontSize: 12, color: C.textMid }}>基于 128 份用户评价</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderShareTab = () => {
    const [entries, setEntries] = useState<ShareEntry[]>(mockShares)
    const [selectedTemplateId, setSelectedTemplateId] = useState('全部')
    const [showShareModal, setShowShareModal] = useState(false)
    const [shareForm, setShareForm] = useState({ templateId: 'tpl-001', sharedWith: '', permission: 'view' as ShareEntry['permission'], department: '放射科' })

    const filteredEntries = selectedTemplateId === '全部' ? entries : entries.filter(e => e.templateId === selectedTemplateId)

    const handleCreateShare = () => {
      if (!shareForm.templateId || !shareForm.sharedWith.trim()) return
      const tpl = templates.find(t => t.id === shareForm.templateId)
      setEntries(prev => [...prev, {
        templateId: shareForm.templateId,
        sharedWith: shareForm.sharedWith.trim(),
        permission: shareForm.permission,
        sharedBy: '当前用户',
        sharedAt: new Date().toISOString().slice(0, 10),
        department: shareForm.department,
      }])
      showToast(`已将「${tpl?.name ?? shareForm.templateId}」分享给 ${shareForm.sharedWith.trim()}`)
      setShowShareModal(false)
      setShareForm({ templateId: 'tpl-001', sharedWith: '', permission: 'view', department: '放射科' })
    }

    return (
      <div style={{ display: activeTab === 'share' ? undefined : 'none', background: 'var(--bg-card)', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Share2 size={20} color={C.accent} />
          <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>分享与协作</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>演示数据（分享）</span>
          <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} style={{ marginLeft: 'auto', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.textDark, background: 'var(--bg-card)', cursor: 'pointer' }}>
            <option value="全部">全部模板</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => setShowShareModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Plus size={14} /> 新建分享</button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: C.primaryLighter, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.primary }}>{entries.length}</div>
            <div style={{ fontSize: 12, color: C.textMid }}>分享总数</div>
          </div>
          <div style={{ flex: 1, background: C.successLight, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>{new Set(entries.map(e => e.sharedWith)).size}</div>
            <div style={{ fontSize: 12, color: C.textMid }}>协作科室/用户</div>
          </div>
          <div style={{ flex: 1, background: C.warningLight, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.warning }}>{entries.filter(e => e.permission === 'admin').length}</div>
            <div style={{ fontSize: 12, color: C.textMid }}>管理员权限</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: C.bgLight }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>模板</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>共享给</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>权限</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>分享人</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>时间</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>部门</th>
          </tr></thead>
          <tbody>
            {filteredEntries.map((e, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: '10px 14px' }}><span style={{ fontWeight: 600, color: C.textDark }}>{templates.find(t => t.id === e.templateId)?.name}</span></td>
                <td style={{ padding: '10px 14px' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textDark }}><Users size={14} color={C.textMid} /> {e.sharedWith}</span></td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: e.permission === 'admin' ? C.dangerLight : e.permission === 'edit' ? C.warningLight : C.infoLight,
                    color: e.permission === 'admin' ? C.danger : e.permission === 'edit' ? C.warning : C.info,
                  }}>
                    {e.permission === 'admin' ? <Shield size={10} /> : e.permission === 'edit' ? <Edit2 size={10} /> : <Eye size={10} />}
                    {e.permission === 'admin' ? '管理' : e.permission === 'edit' ? '编辑' : '查看'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: C.textMid }}>{e.sharedBy}</td>
                <td style={{ padding: '10px 14px', color: C.textMid }}>{e.sharedAt}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 12, color: C.textLight }}>{e.department}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, padding: '12px 14px', background: C.infoLight, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={16} color={C.info} />
          <span style={{ fontSize: 12, color: C.textDark }}>支持跨部门共享 · 权限控制（查看/编辑/管理） · 共享请求流程</span>
        </div>
        {showShareModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowShareModal(false)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark, display: 'flex', alignItems: 'center', gap: 8 }}><Share2 size={16} color={C.primary} /> 新建分享</div>
                <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18, padding: 4 }}>×</button>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>模板</label>
                  <select value={shareForm.templateId} onChange={e => setShareForm({ ...shareForm, templateId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.textDark, background: 'var(--bg-card)' }}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.version})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>共享给（科室/用户）</label>
                  <input value={shareForm.sharedWith} onChange={e => setShareForm({ ...shareForm, sharedWith: e.target.value })} placeholder="如: 神经内科 / 王医生" style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>权限</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([['view', '查看'], ['edit', '编辑'], ['admin', '管理']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setShareForm({ ...shareForm, permission: v })} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${shareForm.permission === v ? C.primary : C.border}`, background: shareForm.permission === v ? C.primaryLighter : 'var(--bg-card)', color: shareForm.permission === v ? C.primary : C.textMid }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button onClick={() => setShowShareModal(false)} style={{ padding: '8px 20px', border: `1px solid ${C.border}`, borderRadius: 6, background: 'var(--bg-card)', color: C.textMid, fontSize: 13, cursor: 'pointer' }}>取消</button>
                  <button onClick={handleCreateShare} disabled={!shareForm.sharedWith.trim()} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: shareForm.sharedWith.trim() ? C.primary : '#94a3b8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: shareForm.sharedWith.trim() ? 'pointer' : 'not-allowed' }}>确认分享</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <ClipboardList size={28} style={{ color: C.primary }} />
          <h1 style={styles.title}>检查模板管理</h1>
        </div>
        <button style={styles.addBtn} onClick={handleAdd}><Plus size={18} /><span>新增模板</span></button>
        {/* [G005 v3.0.6.11-90 Wave 4A (PACS P0-3)] 批量导入导出 */}
        <input ref={importFileRef} type="file" accept=".json,.txt,application/json,text/plain" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportTemplates(f) }} />
        <button onClick={() => importFileRef.current?.click()} disabled={importing} style={{ marginLeft: 8, padding: '8px 14px', background: 'var(--bg-card)', color: '#0891b2', border: '1px solid #0891b2', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: importing ? 0.6 : 1 }}>
          <Upload size={16} /><span>{importing ? '导入中...' : '批量导入'}</span>
        </button>
        <button onClick={() => void handleExportTemplates()} disabled={exporting} style={{ marginLeft: 8, padding: '8px 14px', background: 'var(--bg-card)', color: '#7c3aed', border: '1px solid #7c3aed', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: exporting ? 0.6 : 1 }}>
          <Download size={16} /><span>{exporting ? '导出中...' : '批量导出'}</span>
        </button>
        <button onClick={() => navigate('/template-designer')} style={{ marginLeft: 8, padding: '8px 14px', background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)' }}>
          <Wand2 size={16} /><span>可视化设计器 (R2)</span>
        </button>
        <button onClick={() => navigate('/template-inheritance')} style={{ marginLeft: 8, padding: '8px 14px', background: 'var(--bg-card)', color: '#1e40af', border: '1px solid #3b82f6', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <GitBranch size={16} /><span>继承/克隆</span>
        </button>
        <button onClick={() => navigate('/template-category')} style={{ marginLeft: 8, padding: '8px 14px', background: 'var(--bg-card)', color: '#0891b2', border: '1px solid #0891b2', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <FolderTree size={16} /><span>分类树</span>
        </button>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={18} style={{ color: C.textLight }} />
          <input type="text" placeholder="搜索模板名称、编码、内容..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} style={styles.searchInput} />
        </div>
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <Filter size={16} style={{ color: C.textMid }} />
            <select value={filterModality} onChange={(e) => { setFilterModality(e.target.value); setCurrentPage(1); }} style={styles.select}>
              <option value="all">全部设备</option>
              <option value="CT">CT</option>
              <option value="MRI">MRI</option>
              <option value="X线">X线</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} style={styles.select}>
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {renderTab('manage', '模板管理', <ClipboardList size={14} />)}
        {renderTab('version', '版本管理', <History size={14} />)}
        {renderTab('analytics', '使用分析', <TrendingUp size={14} />)}
        {renderTab('share', '分享协作', <Share2 size={14} />)}
      </div>

      {activeTab === 'manage' && (
        <>
          <div style={styles.statsBar}>
            <div style={styles.statItem}><ListOrdered size={16} style={{ color: C.primary }} /><span style={styles.statLabel}>模板总数</span><span style={styles.statValue}>{templates.length}</span></div>
            <div style={styles.statItem}><Scan size={16} style={{ color: C.accent }} /><span style={styles.statLabel}>CT模板</span><span style={styles.statValue}>{templates.filter(t => t.modality === 'CT').length}</span></div>
            <div style={styles.statItem}><Activity size={16} style={{ color: C.success }} /><span style={styles.statLabel}>MRI模板</span><span style={styles.statValue}>{templates.filter(t => t.modality === 'MRI').length}</span></div>
            <div style={styles.statItem}><ImageIcon size={16} style={{ color: C.warning }} /><span style={styles.statLabel}>X线模板</span><span style={styles.statValue}>{templates.filter(t => t.modality === 'X线').length}</span></div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr style={styles.theadTr}>
                <th style={{ ...styles.th, ...styles.thCode }}>模板编码</th>
                <th style={{ ...styles.th, ...styles.thName }}>模板名称</th>
                <th style={{ ...styles.th, ...styles.thModality }}>检查类型</th>
                <th style={{ ...styles.th, ...styles.thCategory }}>分类</th>
                <th style={{ ...styles.th, ...styles.thTags }}>标签</th>
                <th style={{ ...styles.th, ...styles.thUsage }}>使用次数</th>
                <th style={{ ...styles.th, ...styles.thStatus }}>状态</th>
                <th style={{ ...styles.th, ...styles.thActions }}>操作</th>
              </tr></thead>
              <tbody>
                {paginatedTemplates.map((tpl, idx) => (
                  <tr key={tpl.id} style={{ ...styles.tr, backgroundColor: idx % 2 === 0 ? 'var(--bg-card)' : C.bgLight }}>
                    <td style={styles.td}><code style={styles.code}>{tpl.code}</code></td>
                    <td style={styles.td}><div style={styles.nameCell}><span style={styles.name}>{tpl.name}</span><span style={styles.version}>{tpl.version}</span></div></td>
                    <td style={styles.td}><div style={styles.modalityCell}>{getModalityIcon(tpl.modality)}<span style={styles.modalityText}>{tpl.modality}</span></div></td>
                    <td style={styles.td}><span style={styles.categoryText}>{tpl.category}</span><span style={styles.subCategoryText}> / {tpl.subCategory}</span></td>
                    <td style={styles.td}><div style={styles.tagsCell}>{tpl.tags.slice(0, 3).map(tag => <span key={tag} style={styles.tag}>{tag}</span>)}{tpl.tags.length > 3 && <span style={styles.tagMore}>+{tpl.tags.length - 3}</span>}</div></td>
                    <td style={styles.td}><span style={styles.usageCount}>{tpl.usageCount}</span></td>
                    <td style={styles.td}><span style={{ ...styles.statusBadge, backgroundColor: tpl.status === 'active' ? C.successLight : C.bgLight, color: tpl.status === 'active' ? C.success : C.textLight }}>{tpl.status === 'active' ? '启用' : '停用'}</span></td>
                    <td style={styles.td}>
                      <div style={styles.actionsCell}>
                        <button style={styles.actionBtn} onClick={() => handlePreview(tpl)} title="预览"><Eye size={16} /></button>
                        <button style={styles.actionBtn} onClick={() => handleEdit(tpl)} title="编辑"><Edit2 size={16} /></button>
                        <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => handleDelete(tpl.id)} title="删除"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedTemplates.length === 0 && (
                  <tr><td colSpan={8} style={styles.emptyCell}><ClipboardList size={48} style={{ color: C.textLight }} /><p style={styles.emptyText}>未找到匹配的模板</p></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>上一页</button>
              <div style={styles.pageInfo}>第 <span style={styles.pageCurrent}>{currentPage}</span> / {totalPages} 页 <span style={styles.pageDivider}>|</span> 共 {filteredTemplates.length} 条</div>
              <button style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>下一页</button>
            </div>
          )}
        </>
      )}

      {renderVersionTab()}
      {renderAnalyticsTab()}
      {renderShareTab()}

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}><FileEdit size={22} style={{ color: C.primary }} /><h2>{modalMode === 'add' ? '新增模板' : '编辑模板'}</h2></div>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label style={styles.label}><Tag size={14} /> 模板编码 <span style={styles.required}>*</span></label><input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} style={styles.input} placeholder="如：CT-BRAIN-001" /></div>
                <div style={styles.formGroup}><label style={styles.label}><FileText size={14} /> 模板名称 <span style={styles.required}>*</span></label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={styles.input} placeholder="如：颅脑CT平扫模板" /></div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label style={styles.label}><Scan size={14} /> 检查类型</label><select value={formData.modality} onChange={e => setFormData({ ...formData, modality: e.target.value as any })} style={styles.select}><option value="CT">CT</option><option value="MRI">MRI</option><option value="X线">X线</option></select></div>
                <div style={styles.formGroup}><label style={styles.label}><ListOrdered size={14} /> 版本号</label><input type="text" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} style={styles.input} placeholder="如：v1.0" /></div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label style={styles.label}>一级分类</label><input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={styles.input} placeholder="如：颅脑、胸部、腹部" /></div>
                <div style={styles.formGroup}><label style={styles.label}>二级分类</label><input type="text" value={formData.subCategory} onChange={e => setFormData({ ...formData, subCategory: e.target.value })} style={styles.input} placeholder="如：平扫、增强、CTA" /></div>
              </div>
              <div style={styles.formGroup}><label style={styles.label}><Stethoscope size={14} /> 模板内容 <span style={styles.required}>*</span></label><textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} style={styles.textarea} placeholder="输入报告模板内容..." rows={10} /></div>
              <div style={styles.formGroup}>
                <label style={styles.label}><Tag size={14} /> 标签</label>
                <div style={styles.tagInput}><input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} style={styles.tagInputField} placeholder="输入标签后按回车添加" /><button style={styles.tagAddBtn} onClick={handleAddTag}>添加</button></div>
                <div style={styles.tagsList}>{formData.tags?.map(tag => <span key={tag} style={styles.tagItem}>{tag}<button style={styles.tagRemove} onClick={() => handleRemoveTag(tag)}>×</button></span>)}</div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>状态</label>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}><input type="radio" checked={formData.status === 'active'} onChange={() => setFormData({ ...formData, status: 'active' })} /><span style={styles.radioText}>启用</span></label>
                  <label style={styles.radioLabel}><input type="radio" checked={formData.status === 'inactive'} onChange={() => setFormData({ ...formData, status: 'inactive' })} /><span style={styles.radioText}>停用</span></label>
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>取消</button>
              <button style={styles.saveBtn} onClick={handleSave}><Save size={16} /> 保存</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewTemplate && (
        <div style={styles.modalOverlay} onClick={() => setShowPreview(false)}>
          <div style={styles.previewModal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}><Eye size={22} style={{ color: C.primary }} /><h2>模板预览</h2></div>
              <button style={styles.modalClose} onClick={() => setShowPreview(false)}><X size={20} /></button>
            </div>
            <div style={styles.previewMeta}>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>编码：</span><code style={styles.code}>{previewTemplate.code}</code></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>名称：</span><span>{previewTemplate.name}</span></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>类型：</span><span>{previewTemplate.modality}</span></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>版本：</span><span>{previewTemplate.version}</span></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>分类：</span><span>{previewTemplate.category} / {previewTemplate.subCategory}</span></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>作者：</span><span>{previewTemplate.author}</span></div>
              <div style={styles.previewMetaItem}><span style={styles.previewMetaLabel}>使用次数：</span><span>{previewTemplate.usageCount}</span></div>
            </div>
            <div style={styles.previewContent}><pre style={styles.previewText}>{previewTemplate.content}</pre></div>
            <div style={styles.previewTags}>{previewTemplate.tags.map(tag => <span key={tag} style={styles.tag}>{tag}</span>)}</div>
            <div style={styles.modalFooter}><button style={styles.copyBtn} onClick={() => handleCopy(previewTemplate.content)}><Copy size={16} /> 复制内容</button><button style={styles.cancelBtn} onClick={() => setShowPreview(false)}>关闭</button></div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: '#059669', color: '#fff', padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} />{toast}</div>}
      {validationError && <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#dc2626', color: '#fff', padding: '12px 24px', borderRadius: 8, boxShadow: '0 4px 12px rgba(220,38,38,0.3)', fontSize: 14, fontWeight: 500 }}>{validationError}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', backgroundColor: C.bg, minHeight: '100vh', fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  title: { fontSize: '20px', fontWeight: 700, color: C.textDark, margin: 0 },
  addBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', backgroundColor: C.primary, color: C.white, border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.2s' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '400px', padding: '8px 14px', backgroundColor: C.bgLight, borderRadius: '6px', border: `1px solid ${C.borderLight}` },
  searchInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: C.textDark },
  filters: { display: 'flex', alignItems: 'center', gap: '12px' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  select: { padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '14px', color: C.textDark, backgroundColor: 'var(--bg-card)', cursor: 'pointer', outline: 'none' },
  statsBar: { display: 'flex', gap: '24px', marginBottom: '16px', backgroundColor: 'var(--bg-card)', padding: '14px 24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  statItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  statLabel: { fontSize: '14px', color: C.textMid },
  statValue: { fontSize: '16px', fontWeight: 600, color: C.textDark },
  tableWrapper: { backgroundColor: 'var(--bg-card)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  theadTr: { backgroundColor: C.primaryLighter },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: C.primary, borderBottom: `2px solid ${C.primaryLight}` },
  thCode: { width: '130px' }, thName: { width: '180px' }, thModality: { width: '90px' }, thCategory: { width: '120px' }, thTags: { width: '150px' }, thUsage: { width: '80px' }, thStatus: { width: '70px' }, thActions: { width: '120px' },
  tr: { transition: 'background-color 0.15s' },
  td: { padding: '12px 16px', fontSize: '13px', color: C.textDark, borderBottom: `1px solid ${C.borderLight}` },
  code: { fontFamily: '"Consolas", "Monaco", monospace', fontSize: '12px', backgroundColor: C.bgLight, padding: '2px 6px', borderRadius: '4px', color: C.primary },
  nameCell: { display: 'flex', flexDirection: 'column', gap: '2px' },
  name: { fontWeight: 500 },
  version: { fontSize: '11px', color: C.textLight },
  modalityCell: { display: 'flex', alignItems: 'center', gap: '6px' },
  modalityText: { fontWeight: 500 },
  categoryText: { fontWeight: 500 },
  subCategoryText: { color: C.textLight, fontSize: '12px' },
  tagsCell: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  tag: { display: 'inline-block', padding: '2px 8px', backgroundColor: C.primaryLighter, color: C.primary, borderRadius: '10px', fontSize: '11px' },
  tagMore: { display: 'inline-block', padding: '2px 6px', backgroundColor: C.bgLight, color: C.textLight, borderRadius: '10px', fontSize: '11px' },
  usageCount: { fontWeight: 500, color: C.accent },
  statusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  actionsCell: { display: 'flex', gap: '8px' },
  actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', backgroundColor: C.bgLight, border: 'none', borderRadius: '6px', cursor: 'pointer', color: C.textMid, transition: 'all 0.2s' },
  actionBtnDanger: { color: C.danger },
  emptyCell: { textAlign: 'center', padding: '60px 20px', color: C.textLight },
  emptyText: { marginTop: '12px', fontSize: '14px' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '20px', padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  pageBtn: { padding: '8px 16px', backgroundColor: C.primary, color: C.white, border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  pageBtnDisabled: { backgroundColor: C.borderLight, color: C.textLight, cursor: 'not-allowed' },
  pageInfo: { fontSize: '13px', color: C.textMid },
  pageCurrent: { fontWeight: 600, color: C.primary },
  pageDivider: { margin: '0 8px', color: C.border },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { width: '700px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  previewModal: { width: '650px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${C.borderLight}`, backgroundColor: C.bgLight },
  modalTitle: { display: 'flex', alignItems: 'center', gap: '10px' },
  modalClose: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', backgroundColor: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', color: C.textMid },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: C.textDark, marginBottom: '6px' },
  required: { color: C.danger },
  input: { width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '14px', color: C.textDark, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '14px', color: C.textDark, outline: 'none', fontFamily: '"Consolas", "Monaco", monospace', resize: 'vertical', boxSizing: 'border-box' },
  tagInput: { display: 'flex', gap: '8px' },
  tagInputField: { flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '14px', outline: 'none' },
  tagAddBtn: { padding: '8px 16px', backgroundColor: C.primaryLighter, color: C.primary, border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  tagsList: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
  tagItem: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: C.primaryLighter, color: C.primary, borderRadius: '14px', fontSize: '13px' },
  tagRemove: { backgroundColor: 'transparent', border: 'none', color: C.primary, cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 },
  radioGroup: { display: 'flex', gap: '20px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: C.textDark, cursor: 'pointer' },
  radioText: { fontSize: '14px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${C.borderLight}`, backgroundColor: C.bgLight },
  cancelBtn: { padding: '10px 20px', backgroundColor: 'var(--bg-card)', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', backgroundColor: C.primary, color: C.white, border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  copyBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', backgroundColor: C.accent, color: C.white, border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  previewMeta: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px 24px', backgroundColor: C.bgLight, borderBottom: `1px solid ${C.borderLight}` },
  previewMetaItem: { fontSize: '13px', color: C.textMid },
  previewMetaLabel: { fontWeight: 500, color: C.textDark },
  previewContent: { padding: '20px 24px', flex: 1, overflowY: 'auto' },
  previewText: { fontFamily: '"Consolas", "Monaco", monospace', fontSize: '13px', lineHeight: 1.8, color: C.textDark, whiteSpace: 'pre-wrap', margin: 0 },
  previewTags: { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 24px', borderTop: `1px solid ${C.borderLight}` },
}
