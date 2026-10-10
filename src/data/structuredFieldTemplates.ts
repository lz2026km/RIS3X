// ============================================================
// G005 放射科RIS系统 v1.0.1 - 结构化字段模板
// Phase R1：CT/MR/DR/乳腺钼靶/超声 5 大类报告模板字段集
// ============================================================

import type { StructuredField } from '../types';

export interface TemplateFieldDefinition {
  id: string;                    // 字段 ID
  fieldKey: string;              // 字段 key
  fieldLabel: string;            // 显示标签
  fieldGroup: string;            // 字段分组
  dataType: StructuredField['dataType'];
  unit?: string;
  required: boolean;
  defaultValue?: string | number;
  options?: { label: string; value: string; color?: string }[];
  placeholder?: string;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  dependsOn?: string;            // 依赖其他字段 key
  formula?: (values: Record<string, any>) => string | number; // 联动计算
  order: number;
  category?: string;             // 关联到分类（BI-RADS/Lung-RADS etc.）
}

export interface StructuredFieldTemplate {
  id: string;
  name: string;
  modality: string;
  bodyPart: string;
  description: string;
  version: string;
  fields: TemplateFieldDefinition[];
}

// ============================================================
// 模板 1：胸部 CT 平扫+增强
// ============================================================
export const ChestCTTemplate: StructuredFieldTemplate = {
  id: 'tpl-chest-ct-001',
  name: '胸部CT平扫+增强',
  modality: 'CT',
  bodyPart: '胸部',
  description: '胸部CT平扫+增强标准结构化字段',
  version: 'v1.0',
  fields: [
    // 肺窗所见
    { id: 'f-001', fieldKey: 'lung_r_l', fieldLabel: '右肺', fieldGroup: '肺窗所见', dataType: 'text', required: true, order: 1, placeholder: '右肺野透亮度，纹理' },
    { id: 'f-002', fieldKey: 'lung_l', fieldLabel: '左肺', fieldGroup: '肺窗所见', dataType: 'text', required: true, order: 2, placeholder: '左肺野透亮度，纹理' },
    { id: 'f-003', fieldKey: 'trachea', fieldLabel: '气管', fieldGroup: '肺窗所见', dataType: 'text', required: false, order: 3, placeholder: '气管居中/偏移' },
    { id: 'f-004', fieldKey: 'bronchi', fieldLabel: '支气管', fieldGroup: '肺窗所见', dataType: 'text', required: false, order: 4, placeholder: '支气管通畅/狭窄' },
    { id: 'f-005', fieldKey: 'pleural_effusion', fieldLabel: '胸腔积液', fieldGroup: '肺窗所见', dataType: 'enum', required: false, order: 5, options: [
      { label: '无', value: 'none' },
      { label: '左侧少量', value: 'left-minor', color: 'var(--color-warning-500)' },
      { label: '右侧少量', value: 'right-minor', color: 'var(--color-warning-500)' },
      { label: '双侧少量', value: 'bilateral-minor', color: 'var(--color-warning-500)' },
      { label: '左侧大量', value: 'left-major', color: 'var(--color-error-600)' },
      { label: '右侧大量', value: 'right-major', color: 'var(--color-error-600)' },
      { label: '双侧大量', value: 'bilateral-major', color: 'var(--color-error-600)' },
    ] },
    // 纵隔窗
    { id: 'f-010', fieldKey: 'mediastinum', fieldLabel: '纵隔', fieldGroup: '纵隔窗', dataType: 'text', required: false, order: 6, placeholder: '纵隔形态' },
    { id: 'f-011', fieldKey: 'lymph_nodes', fieldLabel: '淋巴结', fieldGroup: '纵隔窗', dataType: 'enum', required: false, order: 7, options: [
      { label: '未见肿大', value: 'normal' },
      { label: '轻度肿大', value: 'mild', color: 'var(--color-warning-500)' },
      { label: '明显肿大', value: 'major', color: 'var(--color-error-600)' },
    ] },
    { id: 'f-012', fieldKey: 'heart_size', fieldLabel: '心脏', fieldGroup: '纵隔窗', dataType: 'text', required: false, order: 8, placeholder: '心影大小' },
    { id: 'f-013', fieldKey: 'pericardial_effusion', fieldLabel: '心包积液', fieldGroup: '纵隔窗', dataType: 'enum', required: false, order: 9, options: [
      { label: '无', value: 'none' },
      { label: '少量', value: 'minor', color: 'var(--color-warning-500)' },
      { label: '中量', value: 'moderate', color: 'var(--color-error-600)' },
      { label: '大量', value: 'major', color: 'var(--color-error-600)' },
    ] },
    // 病灶
    { id: 'f-020', fieldKey: 'has_lesion', fieldLabel: '是否发现病灶', fieldGroup: '病灶', dataType: 'boolean', required: true, order: 10, defaultValue: '' },
    { id: 'f-021', fieldKey: 'lesion_count', fieldLabel: '病灶数量', fieldGroup: '病灶', dataType: 'number', required: false, order: 11, validation: { min: 0, max: 100 } },
    { id: 'f-022', fieldKey: 'lesion_size_max', fieldLabel: '最大病灶尺寸 (mm)', fieldGroup: '病灶', dataType: 'number', required: false, order: 12, unit: 'mm', validation: { min: 0, max: 500 } },
    { id: 'f-023', fieldKey: 'lesion_density', fieldLabel: '病灶密度', fieldGroup: '病灶', dataType: 'enum', required: false, order: 13, options: [
      { label: '实性', value: 'solid', color: '#7c3aed' },
      { label: '部分实性', value: 'part-solid', color: '#a855f7' },
      { label: '磨玻璃', value: 'ground-glass', color: '#c084fc' },
    ], dependsOn: 'has_lesion' },
    // Lung-RADS
    { id: 'f-030', fieldKey: 'lung_rads', fieldLabel: 'Lung-RADS 分级', fieldGroup: 'Lung-RADS', dataType: 'enum', required: false, order: 14, options: [
      { label: '1 类（阴性）', value: '1', color: '#10b981' },
      { label: '2 类（良性）', value: '2', color: '#10b981' },
      { label: '3 类（可能良性）', value: '3', color: 'var(--color-warning-500)' },
      { label: '4A 类（可疑）', value: '4A', color: '#f97316' },
      { label: '4B 类（高度可疑）', value: '4B', color: 'var(--color-error-600)' },
      { label: '4X 类（高危）', value: '4X', color: 'var(--color-error-600)' },
    ], category: 'Lung-RADS', dependsOn: 'has_lesion' },
    { id: 'f-031', fieldKey: 'lung_rads_modifier', fieldLabel: 'Lung-RADS 修饰符', fieldGroup: 'Lung-RADS', dataType: 'multi-enum', required: false, order: 15, options: [
      { label: 'S - 显著/可疑', value: 'S' },
      { label: 'R - 既往肺癌', value: 'R' },
      { label: 'C - 临床关注', value: 'C' },
      { label: 'P - 既往 PET', value: 'P' },
    ], category: 'Lung-RADS', dependsOn: 'has_lesion' },
  ],
};

// ============================================================
// 模板 2：头颅 CT 平扫
// ============================================================
export const HeadCTTemplate: StructuredFieldTemplate = {
  id: 'tpl-head-ct-001',
  name: '头颅CT平扫',
  modality: 'CT',
  bodyPart: '头颅',
  description: '头颅CT平扫结构化字段',
  version: 'v1.0',
  fields: [
    { id: 'h-001', fieldKey: 'brain_parenchyma', fieldLabel: '脑实质', fieldGroup: '颅内', dataType: 'text', required: true, order: 1, placeholder: '灰白质分界/密度' },
    { id: 'h-002', fieldKey: 'ventricle', fieldLabel: '脑室系统', fieldGroup: '颅内', dataType: 'enum', required: false, order: 2, options: [
      { label: '正常', value: 'normal' },
      { label: '扩大', value: 'enlarged', color: 'var(--color-warning-500)' },
      { label: '受压变窄', value: 'compressed', color: 'var(--color-error-600)' },
      { label: '移位', value: 'shifted', color: 'var(--color-error-600)' },
    ] },
    { id: 'h-003', fieldKey: 'midline', fieldLabel: '中线结构', fieldGroup: '颅内', dataType: 'enum', required: true, order: 3, defaultValue: 'center', options: [
      { label: '居中', value: 'center' },
      { label: '偏移', value: 'shift', color: 'var(--color-error-600)' },
    ] },
    { id: 'h-004', fieldKey: 'cisterns', fieldLabel: '脑池', fieldGroup: '颅内', dataType: 'text', required: false, order: 4, placeholder: '脑池显示情况' },
    { id: 'h-005', fieldKey: 'hemorrhage', fieldLabel: '颅内出血', fieldGroup: '异常', dataType: 'enum', required: false, order: 5, options: [
      { label: '无', value: 'none' },
      { label: '硬膜外血肿', value: 'epidural', color: 'var(--color-error-600)' },
      { label: '硬膜下血肿', value: 'subdural', color: 'var(--color-error-600)' },
      { label: '蛛网膜下腔出血', value: 'sah', color: 'var(--color-error-600)' },
      { label: '脑内血肿', value: 'intracerebral', color: 'var(--color-error-600)' },
    ] },
    { id: 'h-006', fieldKey: 'infarction', fieldLabel: '脑梗死', fieldGroup: '异常', dataType: 'enum', required: false, order: 6, options: [
      { label: '无', value: 'none' },
      { label: '缺血性', value: 'ischemic', color: 'var(--color-error-600)' },
      { label: '出血性', value: 'hemorrhagic', color: 'var(--color-error-600)' },
      { label: '腔隙性', value: 'lacunar', color: 'var(--color-warning-500)' },
    ] },
    { id: 'h-007', fieldKey: 'mass', fieldLabel: '占位', fieldGroup: '异常', dataType: 'enum', required: false, order: 7, options: [
      { label: '无', value: 'none' },
      { label: '有', value: 'present', color: 'var(--color-error-600)' },
    ] },
    { id: 'h-008', fieldKey: 'fracture', fieldLabel: '颅骨骨折', fieldGroup: '颅骨', dataType: 'enum', required: false, order: 8, options: [
      { label: '无', value: 'none' },
      { label: '线性骨折', value: 'linear', color: 'var(--color-warning-500)' },
      { label: '凹陷性骨折', value: 'depressed', color: 'var(--color-error-600)' },
      { label: '粉碎性骨折', value: 'comminuted', color: 'var(--color-error-600)' },
    ] },
  ],
};

// ============================================================
// 模板 3：乳腺钼靶
// ============================================================
export const MammographyTemplate: StructuredFieldTemplate = {
  id: 'tpl-mg-001',
  name: 'MG',
  modality: 'MG',
  bodyPart: '胸部',
  description: '乳腺钼靶 BI-RADS 结构化字段',
  version: 'v1.0',
  fields: [
    { id: 'm-001', fieldKey: 'breast_density', fieldLabel: '腺体密度', fieldGroup: '腺体', dataType: 'enum', required: true, order: 1, options: [
      { label: 'A - 脂肪型', value: 'A', color: '#10b981' },
      { label: 'B - 散在纤维腺体型', value: 'B', color: '#84cc16' },
      { label: 'C - 不均匀致密型', value: 'C', color: 'var(--color-warning-500)' },
      { label: 'D - 极度致密型', value: 'D', color: 'var(--color-error-600)' },
    ] },
    { id: 'm-002', fieldKey: 'mass_r', fieldLabel: '右乳肿块', fieldGroup: '肿块', dataType: 'enum', required: false, order: 2, options: [
      { label: '无', value: 'none' },
      { label: '有', value: 'present', color: 'var(--color-error-600)' },
    ] },
    { id: 'm-003', fieldKey: 'mass_r_size', fieldLabel: '右乳肿块尺寸 (mm)', fieldGroup: '肿块', dataType: 'number', required: false, order: 3, unit: 'mm', validation: { min: 0, max: 200 }, dependsOn: 'mass_r' },
    { id: 'm-004', fieldKey: 'mass_r_shape', fieldLabel: '右乳肿块形态', fieldGroup: '肿块', dataType: 'enum', required: false, order: 4, options: [
      { label: '圆形', value: 'round' },
      { label: '卵圆形', value: 'oval' },
      { label: '不规则形', value: 'irregular', color: 'var(--color-error-600)' },
    ], dependsOn: 'mass_r' },
    { id: 'm-005', fieldKey: 'mass_r_margin', fieldLabel: '右乳肿块边缘', fieldGroup: '肿块', dataType: 'enum', required: false, order: 5, options: [
      { label: '清晰', value: 'circumscribed' },
      { label: '遮蔽', value: 'obscured' },
      { label: '微小分叶', value: 'microlobulated' },
      { label: '模糊', value: 'indistinct' },
      { label: '毛刺', value: 'spiculated', color: 'var(--color-error-600)' },
    ], dependsOn: 'mass_r' },
    { id: 'm-010', fieldKey: 'calcification_r', fieldLabel: '右乳钙化', fieldGroup: '钙化', dataType: 'enum', required: false, order: 6, options: [
      { label: '无', value: 'none' },
      { label: '典型良性', value: 'benign' },
      { label: '可疑', value: 'suspicious', color: 'var(--color-error-600)' },
    ] },
    { id: 'm-011', fieldKey: 'calc_r_type', fieldLabel: '右乳钙化类型', fieldGroup: '钙化', dataType: 'enum', required: false, order: 7, options: [
      { label: '无定形', value: 'amorphous', color: 'var(--color-warning-500)' },
      { label: '粗糙不均质', value: 'coarse-heterogeneous', color: 'var(--color-warning-500)' },
      { label: '细小多形性', value: 'fine-pleomorphic', color: 'var(--color-error-600)' },
      { label: '细线/分支状', value: 'fine-linear-branching', color: 'var(--color-error-600)' },
    ], dependsOn: 'calcification_r' },
    // BI-RADS 分级
    { id: 'm-020', fieldKey: 'bi_rads', fieldLabel: 'BI-RADS 分级', fieldGroup: 'BI-RADS', dataType: 'enum', required: true, order: 8, options: [
      { label: '0 类 - 评估不完整', value: '0', color: '#94a3b8' },
      { label: '1 类 - 阴性', value: '1', color: '#10b981' },
      { label: '2 类 - 良性', value: '2', color: '#10b981' },
      { label: '3 类 - 可能良性', value: '3', color: 'var(--color-warning-500)' },
      { label: '4A 类 - 低度可疑', value: '4A', color: '#f97316' },
      { label: '4B 类 - 中度可疑', value: '4B', color: '#ea580c' },
      { label: '4C 类 - 高度可疑', value: '4C', color: 'var(--color-error-600)' },
      { label: '5 类 - 高度提示恶性', value: '5', color: '#b91c1c' },
      { label: '6 类 - 已证实恶性', value: '6', color: '#7f1d1d' },
    ], category: 'BI-RADS' },
    { id: 'm-021', fieldKey: 'bi_rads_recommend', fieldLabel: 'BI-RADS 建议', fieldGroup: 'BI-RADS', dataType: 'text', required: false, order: 9, placeholder: '如：建议6个月后复查' },
  ],
};

// ============================================================
// 模板 4：腹部 CT 平扫+增强
// ============================================================
export const AbdomenCTTemplate: StructuredFieldTemplate = {
  id: 'tpl-abd-ct-001',
  name: '腹部CT平扫+增强',
  modality: 'CT',
  bodyPart: '腹部',
  description: '腹部CT结构化字段',
  version: 'v1.0',
  fields: [
    { id: 'a-001', fieldKey: 'liver', fieldLabel: '肝脏', fieldGroup: '实质器官', dataType: 'text', required: true, order: 1, placeholder: '肝脏大小、密度' },
    { id: 'a-002', fieldKey: 'liver_lesion', fieldLabel: '肝脏占位', fieldGroup: '实质器官', dataType: 'enum', required: false, order: 2, options: [
      { label: '无', value: 'none' },
      { label: '有', value: 'present', color: 'var(--color-error-600)' },
    ] },
    { id: 'a-003', fieldKey: 'gallbladder', fieldLabel: '胆囊', fieldGroup: '实质器官', dataType: 'text', required: false, order: 3, placeholder: '胆囊壁/结石' },
    { id: 'a-004', fieldKey: 'pancreas', fieldLabel: '胰腺', fieldGroup: '实质器官', dataType: 'text', required: false, order: 4, placeholder: '胰腺大小、密度' },
    { id: 'a-005', fieldKey: 'spleen', fieldLabel: '脾脏', fieldGroup: '实质器官', dataType: 'text', required: false, order: 5, placeholder: '脾脏大小' },
    { id: 'a-006', fieldKey: 'kidney_l', fieldLabel: '左肾', fieldGroup: '实质器官', dataType: 'text', required: false, order: 6, placeholder: '左肾大小/积水/结石' },
    { id: 'a-007', fieldKey: 'kidney_r', fieldLabel: '右肾', fieldGroup: '实质器官', dataType: 'text', required: false, order: 7, placeholder: '右肾大小/积水/结石' },
    { id: 'a-010', fieldKey: 'ascites', fieldLabel: '腹水', fieldGroup: '腹腔', dataType: 'enum', required: false, order: 8, options: [
      { label: '无', value: 'none' },
      { label: '少量', value: 'minor', color: 'var(--color-warning-500)' },
      { label: '中量', value: 'moderate', color: 'var(--color-error-600)' },
      { label: '大量', value: 'major', color: 'var(--color-error-600)' },
    ] },
    { id: 'a-011', fieldKey: 'lymphadenopathy', fieldLabel: '腹腔淋巴结', fieldGroup: '腹腔', dataType: 'enum', required: false, order: 9, options: [
      { label: '无肿大', value: 'none' },
      { label: '肿大', value: 'enlarged', color: 'var(--color-error-600)' },
    ] },
  ],
};

// ============================================================
// 模板 5：冠脉 CTA
// ============================================================
export const CoronaryCTATemplate: StructuredFieldTemplate = {
  id: 'tpl-coronary-cta-001',
  name: '冠脉CTA',
  modality: 'CT',
  bodyPart: '心脏',
  description: '冠状动脉CTA CAD-RADS 结构化字段',
  version: 'v1.0',
  fields: [
    { id: 'c-001', fieldKey: 'lm', fieldLabel: '左主干 (LM)', fieldGroup: '冠脉', dataType: 'enum', required: true, order: 1, options: [
      { label: '无狭窄', value: 'normal' },
      { label: '< 25%', value: 'min', color: '#10b981' },
      { label: '25-49%', value: 'mild', color: '#84cc16' },
      { label: '50-69%', value: 'moderate', color: 'var(--color-warning-500)' },
      { label: '70-99%', value: 'severe', color: 'var(--color-error-600)' },
      { label: '完全闭塞', value: 'occlusion', color: '#7f1d1d' },
    ], category: 'CAD-RADS' },
    { id: 'c-002', fieldKey: 'lad', fieldLabel: '前降支 (LAD)', fieldGroup: '冠脉', dataType: 'enum', required: true, order: 2, options: [
      { label: '无狭窄', value: 'normal' },
      { label: '< 25%', value: 'min', color: '#10b981' },
      { label: '25-49%', value: 'mild', color: '#84cc16' },
      { label: '50-69%', value: 'moderate', color: 'var(--color-warning-500)' },
      { label: '70-99%', value: 'severe', color: 'var(--color-error-600)' },
      { label: '完全闭塞', value: 'occlusion', color: '#7f1d1d' },
    ], category: 'CAD-RADS' },
    { id: 'c-003', fieldKey: 'lcx', fieldLabel: '回旋支 (LCX)', fieldGroup: '冠脉', dataType: 'enum', required: true, order: 3, options: [
      { label: '无狭窄', value: 'normal' },
      { label: '< 25%', value: 'min', color: '#10b981' },
      { label: '25-49%', value: 'mild', color: '#84cc16' },
      { label: '50-69%', value: 'moderate', color: 'var(--color-warning-500)' },
      { label: '70-99%', value: 'severe', color: 'var(--color-error-600)' },
      { label: '完全闭塞', value: 'occlusion', color: '#7f1d1d' },
    ], category: 'CAD-RADS' },
    { id: 'c-004', fieldKey: 'rca', fieldLabel: '右冠状动脉 (RCA)', fieldGroup: '冠脉', dataType: 'enum', required: true, order: 4, options: [
      { label: '无狭窄', value: 'normal' },
      { label: '< 25%', value: 'min', color: '#10b981' },
      { label: '25-49%', value: 'mild', color: '#84cc16' },
      { label: '50-69%', value: 'moderate', color: 'var(--color-warning-500)' },
      { label: '70-99%', value: 'severe', color: 'var(--color-error-600)' },
      { label: '完全闭塞', value: 'occlusion', color: '#7f1d1d' },
    ], category: 'CAD-RADS' },
    { id: 'c-010', fieldKey: 'plaque_type', fieldLabel: '斑块类型', fieldGroup: '斑块', dataType: 'multi-enum', required: false, order: 5, options: [
      { label: '钙化斑块', value: 'calcified' },
      { label: '非钙化斑块', value: 'non-calcified' },
      { label: '混合斑块', value: 'mixed' },
    ] },
    { id: 'c-020', fieldKey: 'cad_rads', fieldLabel: 'CAD-RADS 分级', fieldGroup: 'CAD-RADS', dataType: 'enum', required: true, order: 6, options: [
      { label: '0 类 - 不完整评估', value: '0', color: '#94a3b8' },
      { label: '1 类 - 正常', value: '1', color: '#10b981' },
      { label: '2 类 - 轻度斑块', value: '2', color: '#10b981' },
      { label: '3 类 - 中度狭窄', value: '3', color: 'var(--color-warning-500)' },
      { label: '4A 类 - 重度狭窄', value: '4A', color: 'var(--color-error-600)' },
      { label: '4B 类 - 重度狭窄', value: '4B', color: 'var(--color-error-600)' },
      { label: '5 类 - 完全闭塞', value: '5', color: '#7f1d1d' },
    ], category: 'CAD-RADS' },
    { id: 'c-021', fieldKey: 'recommend', fieldLabel: '建议', fieldGroup: 'CAD-RADS', dataType: 'enum', required: false, order: 7, options: [
      { label: '随访', value: 'follow-up' },
      { label: '进一步检查', value: 'further-exam' },
      { label: '冠脉造影', value: 'invasive-angio' },
      { label: 'PCI', value: 'pci' },
    ] },
  ],
};

// ============================================================
// 模板 6：甲状腺超声
// ============================================================
export const ThyroidUSTemplate: StructuredFieldTemplate = {
  id: 'tpl-thyroid-us-001',
  name: '甲状腺超声',
  modality: 'US',
  bodyPart: '颈部',
  description: '甲状腺超声 TI-RADS 结构化字段',
  version: 'v1.0',
  fields: [
    { id: 't-001', fieldKey: 'thyroid_size_l', fieldLabel: '左叶大小', fieldGroup: '甲状腺', dataType: 'text', required: false, order: 1, placeholder: '如：45mm×15mm×12mm' },
    { id: 't-002', fieldKey: 'thyroid_size_r', fieldLabel: '右叶大小', fieldGroup: '甲状腺', dataType: 'text', required: false, order: 2, placeholder: '如：42mm×14mm×11mm' },
    { id: 't-003', fieldKey: 'thyroid_echogenicity', fieldLabel: '回声', fieldGroup: '甲状腺', dataType: 'enum', required: false, order: 3, options: [
      { label: '均匀', value: 'homogeneous' },
      { label: '欠均匀', value: 'inhomogeneous' },
    ] },
    { id: 't-010', fieldKey: 'nodule_l', fieldLabel: '左叶结节', fieldGroup: '结节', dataType: 'enum', required: false, order: 4, options: [
      { label: '无', value: 'none' },
      { label: '有', value: 'present', color: 'var(--color-warning-500)' },
    ] },
    { id: 't-011', fieldKey: 'nodule_l_size', fieldLabel: '左叶结节尺寸 (mm)', fieldGroup: '结节', dataType: 'number', required: false, order: 5, unit: 'mm', validation: { min: 0, max: 100 } },
    { id: 't-012', fieldKey: 'nodule_l_echogenicity', fieldLabel: '左叶结节回声', fieldGroup: '结节', dataType: 'enum', required: false, order: 6, options: [
      { label: '高回声', value: 'hyperechoic' },
      { label: '等回声', value: 'isoechoic' },
      { label: '低回声', value: 'hypoechoic' },
      { label: '极低回声', value: 'very-hypoechoic', color: 'var(--color-error-600)' },
    ] },
    { id: 't-020', fieldKey: 'ti_rads', fieldLabel: 'TI-RADS 分级', fieldGroup: 'TI-RADS', dataType: 'enum', required: true, order: 7, options: [
      { label: '1 类 - 正常', value: '1', color: '#10b981' },
      { label: '2 类 - 良性', value: '2', color: '#10b981' },
      { label: '3 类 - 可能良性', value: '3', color: 'var(--color-warning-500)' },
      { label: '4A 类 - 低度可疑', value: '4A', color: '#f97316' },
      { label: '4B 类 - 中度可疑', value: '4B', color: '#ea580c' },
      { label: '4C 类 - 高度可疑', value: '4C', color: 'var(--color-error-600)' },
      { label: '5 类 - 高度提示恶性', value: '5', color: '#b91c1c' },
      { label: '6 类 - 已证实恶性', value: '6', color: '#7f1d1d' },
    ], category: 'TI-RADS' },
  ],
};

// ============================================================
// 模板 7-30：扩展模板（CT/MR/DR/超声 各种部位）
// ============================================================

// 模板 7：腹部 MR 平扫+增强
export const AbdomenMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-abdomen-mr-001',
  name: '上腹部MR平扫+增强',
  modality: 'MR',
  bodyPart: '上腹部',
  description: '上腹部MR平扫+增强标准结构化字段',
  version: '2.0',
  fields: [
    { id: 'f-mr-001', fieldKey: 'liver_size', fieldLabel: '肝脏大小', fieldGroup: '肝脏', dataType: 'text', required: true, placeholder: '如: 正常范围', order: 1 },
    { id: 'f-mr-002', fieldKey: 'liver_focus_count', fieldLabel: '占位数量', fieldGroup: '肝脏', dataType: 'number', required: false, order: 2 },
    { id: 'f-mr-003', fieldKey: 'liver_focus_size', fieldLabel: '占位最大径 (mm)', fieldGroup: '肝脏', dataType: 'number', required: false, order: 3 },
    { id: 'f-mr-004', fieldKey: 'liver_signal', fieldLabel: '病灶信号特点', fieldGroup: '肝脏', dataType: 'text', required: false, placeholder: 'T1WI低 T2WI高 DWI高', order: 4 },
    { id: 'f-mr-005', fieldKey: 'li_rads', fieldLabel: 'LI-RADS 分类', fieldGroup: '肝脏', dataType: 'enum', required: false, options: [
      { label: 'LR-1 确定良性', value: 'LR-1', color: '#10b981' },
      { label: 'LR-2 可能良性', value: 'LR-2', color: '#84cc16' },
      { label: 'LR-3 中等概率', value: 'LR-3', color: 'var(--color-warning-500)' },
      { label: 'LR-4 可能HCC', value: 'LR-4', color: '#f97316' },
      { label: 'LR-5 确定HCC', value: 'LR-5', color: 'var(--color-error-600)' },
      { label: 'LR-M', value: 'LR-M', color: '#991b1b' },
    ], category: 'LI-RADS', order: 5 },
    { id: 'f-mr-006', fieldKey: 'gb_size', fieldLabel: '胆囊大小', fieldGroup: '胆道', dataType: 'text', required: false, order: 6 },
    { id: 'f-mr-007', fieldKey: 'cbd_diameter', fieldLabel: '胆总管内径 (mm)', fieldGroup: '胆道', dataType: 'number', required: false, validation: { min: 0, max: 30, message: '正常 < 8mm' }, order: 7 },
    { id: 'f-mr-008', fieldKey: 'pancreas_signal', fieldLabel: '胰腺信号', fieldGroup: '胰腺', dataType: 'text', required: false, order: 8 },
    { id: 'f-mr-009', fieldKey: 'pancreas_duct', fieldLabel: '胰管内径 (mm)', fieldGroup: '胰腺', dataType: 'number', required: false, validation: { min: 0, max: 10, message: '正常 < 3mm' }, order: 9 },
    { id: 'f-mr-010', fieldKey: 'spleen_size', fieldLabel: '脾脏大小', fieldGroup: '脾', dataType: 'text', required: false, order: 10 },
  ],
};

// 模板 8：MRCP（胰胆管成像）
export const MRCPTemplate: StructuredFieldTemplate = {
  id: 'tpl-mrcp-001',
  name: 'MRCP',
  modality: 'MR',
  bodyPart: '腹部',
  description: '磁共振胰胆管成像',
  version: '2.0',
  fields: [
    { id: 'f-mrcp-001', fieldKey: 'ihb_dilation', fieldLabel: '肝内胆管扩张', fieldGroup: '胆道', dataType: 'boolean', required: true, order: 1 },
    { id: 'f-mrcp-002', fieldKey: 'cbd_dilation', fieldLabel: '胆总管扩张', fieldGroup: '胆道', dataType: 'boolean', required: true, order: 2 },
    { id: 'f-mrcp-003', fieldKey: 'cbd_diameter', fieldLabel: '胆总管内径 (mm)', fieldGroup: '胆道', dataType: 'number', required: true, order: 3 },
    { id: 'f-mrcp-004', fieldKey: 'pd_dilation', fieldLabel: '胰管扩张', fieldGroup: '胰管', dataType: 'boolean', required: true, order: 4 },
    { id: 'f-mrcp-005', fieldKey: 'pd_diameter', fieldLabel: '胰管内径 (mm)', fieldGroup: '胰管', dataType: 'number', required: true, order: 5 },
    { id: 'f-mrcp-006', fieldKey: 'stone_location', fieldLabel: '结石位置', fieldGroup: '结石', dataType: 'text', required: false, order: 6 },
    { id: 'f-mrcp-007', fieldKey: 'stone_size', fieldLabel: '结石大小 (mm)', fieldGroup: '结石', dataType: 'number', required: false, order: 7 },
    { id: 'f-mrcp-008', fieldKey: 'stricture_location', fieldLabel: '狭窄位置', fieldGroup: '狭窄', dataType: 'text', required: false, order: 8 },
  ],
};

// 模板 9：头颅 MR 平扫+增强
export const HeadMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-head-mr-001',
  name: '头颅MR平扫+增强',
  modality: 'MR',
  bodyPart: '头颅',
  description: '头颅MR平扫+增强标准结构化字段',
  version: '2.0',
  fields: [
    { id: 'f-hmr-001', fieldKey: 'midline_shift', fieldLabel: '中线移位', fieldGroup: '大脑', dataType: 'boolean', required: false, order: 1 },
    { id: 'f-hmr-002', fieldKey: 'ventricle_size', fieldLabel: '脑室大小', fieldGroup: '脑室', dataType: 'text', required: false, order: 2 },
    { id: 'f-hmr-003', fieldKey: 'white_matter', fieldLabel: '脑白质改变', fieldGroup: '脑实质', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' },
      { label: 'Fazekas I', value: 'fazekas-1' },
      { label: 'Fazekas II', value: 'fazekas-2' },
      { label: 'Fazekas III', value: 'fazekas-3' },
    ], order: 3 },
    { id: 'f-hmr-004', fieldKey: 'dwi_finding', fieldLabel: 'DWI 表现', fieldGroup: 'DWI', dataType: 'text', required: false, order: 4 },
    { id: 'f-hmr-005', fieldKey: 'mra_finding', fieldLabel: 'MRA 表现', fieldGroup: 'MRA', dataType: 'text', required: false, order: 5 },
    { id: 'f-hmr-006', fieldKey: 'infarct_location', fieldLabel: '梗死位置', fieldGroup: '梗死', dataType: 'text', required: false, order: 6 },
    { id: 'f-hmr-007', fieldKey: 'infarct_stage', fieldLabel: '梗死分期', fieldGroup: '梗死', dataType: 'enum', required: false, options: [
      { label: '超急性期', value: 'hyperacute' },
      { label: '急性期', value: 'acute' },
      { label: '亚急性期', value: 'subacute' },
      { label: '慢性期', value: 'chronic' },
    ], order: 7 },
  ],
};

// 模板 10：前列腺 mpMRI
export const ProstateMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-prostate-mr-001',
  name: '前列腺多参数MR (mpMRI)',
  modality: 'MR',
  bodyPart: '前列腺',
  description: '前列腺多参数MRI + PI-RADS v2.1',
  version: '2.0',
  fields: [
    { id: 'f-pm-001', fieldKey: 'prostate_volume', fieldLabel: '前列腺体积 (ml)', fieldGroup: '前列腺', dataType: 'number', required: true, order: 1 },
    { id: 'f-pm-002', fieldKey: 'psa_level', fieldLabel: 'PSA 水平 (ng/ml)', fieldGroup: 'PSA', dataType: 'number', required: true, order: 2 },
    { id: 'f-pm-003', fieldKey: 'pz_t2w', fieldLabel: '外周带 T2W 评分', fieldGroup: 'PI-RADS', dataType: 'enum', required: true, options: [
      { label: '1 - 正常', value: '1' }, { label: '2 - 线性/楔形低信号', value: '2' },
      { label: '3 - 非局限性低信号', value: '3' }, { label: '4 - 透镜状均匀低信号 < 1.5cm', value: '4' },
      { label: '5 - 同 4 但 ≥ 1.5cm', value: '5' },
    ], category: 'PI-RADS', order: 3 },
    { id: 'f-pm-004', fieldKey: 'tz_t2w', fieldLabel: '移行带 T2W 评分', fieldGroup: 'PI-RADS', dataType: 'enum', required: true, options: [
      { label: '1 - 正常/BPH结节', value: '1' }, { label: '2 - 均匀低信号 BPH', value: '2' },
      { label: '3 - 混杂信号边界不清', value: '3' }, { label: '4 - 透镜状均匀低信号 < 1.5cm', value: '4' },
      { label: '5 - 同 4 但 ≥ 1.5cm', value: '5' },
    ], category: 'PI-RADS', order: 4 },
    { id: 'f-pm-005', fieldKey: 'dwi_score', fieldLabel: 'DWI 评分', fieldGroup: 'PI-RADS', dataType: 'enum', required: true, options: [
      { label: '1 - 无异常', value: '1' }, { label: '2 - 模糊低信号', value: '2' },
      { label: '3 - 局灶轻-中度低信号 < 1.5cm', value: '3' },
      { label: '4 - 局灶显著低信号 < 1.5cm', value: '4' },
      { label: '5 - ≥ 1.5cm 或前列腺外侵犯', value: '5' },
    ], category: 'PI-RADS', order: 5 },
    { id: 'f-pm-006', fieldKey: 'dce_positive', fieldLabel: 'DCE 阳性', fieldGroup: 'PI-RADS', dataType: 'boolean', required: false, order: 6 },
    { id: 'f-pm-007', fieldKey: 'overall_pi_rads', fieldLabel: '综合 PI-RADS', fieldGroup: 'PI-RADS', dataType: 'enum', required: true, options: [
      { label: 'PI-RADS 1', value: '1' }, { label: 'PI-RADS 2', value: '2' },
      { label: 'PI-RADS 3', value: '3' }, { label: 'PI-RADS 4', value: '4' },
      { label: 'PI-RADS 5', value: '5' },
    ], category: 'PI-RADS', order: 7 },
    { id: 'f-pm-008', fieldKey: 'sector', fieldLabel: '扇区定位', fieldGroup: 'PI-RADS', dataType: 'text', required: false, order: 8 },
  ],
};

// 模板 11：MR 颅脑血管 (MRA)
export const MRABrainTemplate: StructuredFieldTemplate = {
  id: 'tpl-mra-brain-001',
  name: '头颅 MRA',
  modality: 'MR',
  bodyPart: '头颅',
  description: '头颅磁共振血管成像',
  version: '2.0',
  fields: [
    { id: 'f-mra-001', fieldKey: 'ica_stenosis', fieldLabel: '颈内动脉狭窄', fieldGroup: '颈部血管', dataType: 'text', required: false, order: 1 },
    { id: 'f-mra-002', fieldKey: 'mca_stenosis', fieldLabel: '大脑中动脉狭窄', fieldGroup: '颅内血管', dataType: 'text', required: false, order: 2 },
    { id: 'f-mra-003', fieldKey: 'aca_stenosis', fieldLabel: '大脑前动脉', fieldGroup: '颅内血管', dataType: 'text', required: false, order: 3 },
    { id: 'f-mra-004', fieldKey: 'pca_stenosis', fieldLabel: '大脑后动脉', fieldGroup: '颅内血管', dataType: 'text', required: false, order: 4 },
    { id: 'f-mra-005', fieldKey: 'aneurysm', fieldLabel: '动脉瘤', fieldGroup: '颅内血管', dataType: 'text', required: false, order: 5 },
    { id: 'f-mra-006', fieldKey: 'avm', fieldLabel: '动静脉畸形', fieldGroup: '颅内血管', dataType: 'text', required: false, order: 6 },
    { id: 'f-mra-007', fieldKey: 'vertebrobasilar', fieldLabel: '椎基底动脉', fieldGroup: '后循环', dataType: 'text', required: false, order: 7 },
  ],
};

// 模板 12：腰椎 MR
export const LumbarMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-lumbar-mr-001',
  name: '腰椎 MR',
  modality: 'MR',
  bodyPart: '腰椎',
  description: '腰椎 MR 平扫',
  version: '2.0',
  fields: [
    { id: 'f-lm-001', fieldKey: 'lordosis', fieldLabel: '腰椎曲度', fieldGroup: '整体', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '变直', value: 'straight' },
      { label: '反弓', value: 'reversed' }, { label: '侧弯', value: 'scoliosis' },
    ], order: 1 },
    { id: 'f-lm-002', fieldKey: 'l1_l2', fieldLabel: 'L1/2 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' }, { label: '脱出', value: 'extrusion' },
    ], order: 2 },
    { id: 'f-lm-003', fieldKey: 'l2_l3', fieldLabel: 'L2/3 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' }, { label: '脱出', value: 'extrusion' },
    ], order: 3 },
    { id: 'f-lm-004', fieldKey: 'l3_l4', fieldLabel: 'L3/4 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' }, { label: '脱出', value: 'extrusion' },
    ], order: 4 },
    { id: 'f-lm-005', fieldKey: 'l4_l5', fieldLabel: 'L4/5 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' }, { label: '脱出', value: 'extrusion' },
    ], order: 5 },
    { id: 'f-lm-006', fieldKey: 'l5_s1', fieldLabel: 'L5/S1 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' }, { label: '脱出', value: 'extrusion' },
    ], order: 6 },
    { id: 'f-lm-007', fieldKey: 'canal_stenosis', fieldLabel: '椎管狭窄', fieldGroup: '椎管', dataType: 'enum', required: false, options: [
      { label: '无', value: 'none' }, { label: '轻度', value: 'mild' },
      { label: '中度', value: 'moderate' }, { label: '重度', value: 'severe' },
    ], order: 7 },
    { id: 'f-lm-008', fieldKey: 'nerve_root', fieldLabel: '神经根受压', fieldGroup: '椎管', dataType: 'text', required: false, order: 8 },
  ],
};

// 模板 13：颈椎 MR
export const CervicalMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-cervical-mr-001',
  name: '颈椎 MR',
  modality: 'MR',
  bodyPart: '颈椎',
  description: '颈椎 MR 平扫',
  version: '2.0',
  fields: [
    { id: 'f-cm-001', fieldKey: 'lordosis', fieldLabel: '颈椎曲度', fieldGroup: '整体', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '变直', value: 'straight' },
      { label: '反弓', value: 'reversed' },
    ], order: 1 },
    { id: 'f-cm-002', fieldKey: 'c34_disc', fieldLabel: 'C3/4 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' },
    ], order: 2 },
    { id: 'f-cm-003', fieldKey: 'c45_disc', fieldLabel: 'C4/5 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' },
    ], order: 3 },
    { id: 'f-cm-004', fieldKey: 'c56_disc', fieldLabel: 'C5/6 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' },
    ], order: 4 },
    { id: 'f-cm-005', fieldKey: 'c67_disc', fieldLabel: 'C6/7 椎间盘', fieldGroup: '椎间盘', dataType: 'enum', required: false, options: [
      { label: '正常', value: 'normal' }, { label: '膨出', value: 'bulging' },
      { label: '突出', value: 'herniation' },
    ], order: 5 },
    { id: 'f-cm-006', fieldKey: 'cord_signal', fieldLabel: '脊髓信号', fieldGroup: '脊髓', dataType: 'text', required: false, order: 6 },
    { id: 'f-cm-007', fieldKey: 'cord_compression', fieldLabel: '脊髓受压', fieldGroup: '脊髓', dataType: 'text', required: false, order: 7 },
  ],
};

// 模板 14：MR 心脏
export const CardiacMRTemplate: StructuredFieldTemplate = {
  id: 'tpl-cardiac-mr-001',
  name: '心脏 MR',
  modality: 'MR',
  bodyPart: '心脏',
  description: '心脏 MR 平扫+增强 + 心功能分析',
  version: '2.0',
  fields: [
    { id: 'f-cmrr-001', fieldKey: 'lv_ef', fieldLabel: 'LVEF (%)', fieldGroup: '心功能', dataType: 'number', required: true, validation: { min: 5, max: 80 }, order: 1 },
    { id: 'f-cmrr-002', fieldKey: 'lv_edd', fieldLabel: 'LV EDD (mm)', fieldGroup: '心功能', dataType: 'number', required: true, order: 2 },
    { id: 'f-cmrr-003', fieldKey: 'rv_ef', fieldLabel: 'RVEF (%)', fieldGroup: '心功能', dataType: 'number', required: false, order: 3 },
    { id: 'f-cmrr-004', fieldKey: 'wall_motion', fieldLabel: '室壁运动', fieldGroup: '室壁', dataType: 'text', required: true, order: 4 },
    { id: 'f-cmrr-005', fieldKey: 'late_enhancement', fieldLabel: '延迟强化', fieldGroup: '强化', dataType: 'text', required: false, order: 5 },
    { id: 'f-cmrr-006', fieldKey: 'pericardial', fieldLabel: '心包', fieldGroup: '心包', dataType: 'text', required: false, order: 6 },
    { id: 'f-cmrr-007', fieldKey: 'valve', fieldLabel: '瓣膜', fieldGroup: '瓣膜', dataType: 'text', required: false, order: 7 },
  ],
};

// 模板 15：CTA 冠脉
export const CoronaryCTATemplateV2: StructuredFieldTemplate = {
  id: 'tpl-coronary-cta-002',
  name: '冠脉 CTA',
  modality: 'CT',
  bodyPart: '心脏',
  description: '冠脉 CTA + CAD-RADS 评分',
  version: '2.0',
  fields: [
    { id: 'f-ccta-001', fieldKey: 'image_quality', fieldLabel: '图像质量', fieldGroup: '整体', dataType: 'enum', required: true, options: [
      { label: '优秀', value: 'excellent' }, { label: '良好', value: 'good' },
      { label: '可评估', value: 'diagnostic' }, { label: '不可评估', value: 'non-diagnostic' },
    ], order: 1 },
    { id: 'f-ccta-002', fieldKey: 'lm_stenosis', fieldLabel: 'LM 狭窄 (%)', fieldGroup: '冠脉', dataType: 'number', required: true, order: 2 },
    { id: 'f-ccta-003', fieldKey: 'lad_stenosis', fieldLabel: 'LAD 狭窄 (%)', fieldGroup: '冠脉', dataType: 'number', required: true, order: 3 },
    { id: 'f-ccta-004', fieldKey: 'lcx_stenosis', fieldLabel: 'LCX 狭窄 (%)', fieldGroup: '冠脉', dataType: 'number', required: true, order: 4 },
    { id: 'f-ccta-005', fieldKey: 'rca_stenosis', fieldLabel: 'RCA 狭窄 (%)', fieldGroup: '冠脉', dataType: 'number', required: true, order: 5 },
    { id: 'f-ccta-006', fieldKey: 'plaque_burden', fieldLabel: '斑块负荷', fieldGroup: '斑块', dataType: 'enum', required: false, options: [
      { label: 'P1 轻度', value: 'P1' }, { label: 'P2 中度', value: 'P2' },
      { label: 'P3 中重度', value: 'P3' }, { label: 'P4 重度', value: 'P4' },
    ], category: 'CAD-RADS', order: 6 },
    { id: 'f-ccta-007', fieldKey: 'high_risk_plaque', fieldLabel: '高危斑块', fieldGroup: '斑块', dataType: 'boolean', required: false, order: 7 },
    { id: 'f-ccta-008', fieldKey: 'cad_rads', fieldLabel: 'CAD-RADS 分类', fieldGroup: '整体', dataType: 'enum', required: true, options: [
      { label: '0 - 无狭窄', value: '0' }, { label: '1 - 1-24%', value: '1' },
      { label: '2 - 25-49%', value: '2' }, { label: '3 - 50-69%', value: '3' },
      { label: '4A - 70-99% 1-2 支', value: '4A' }, { label: '4B - 3 支/左主干', value: '4B' },
      { label: '5 - 完全闭塞', value: '5' }, { label: 'N - 不可评估', value: 'N' },
    ], category: 'CAD-RADS', order: 8 },
  ],
};

// 模板 16-30：CTU/CT 尿路造影、CTA 头颈、超声各部位、PET-CT 等
// 为了保持文件可管理，使用工厂模式生成简化模板
function createSimpleTemplate(id: string, name: string, modality: string, bodyPart: string, fields: TemplateFieldDefinition[]): StructuredFieldTemplate {
  return { id, name, modality, bodyPart, description: `${name} 标准结构化字段`, version: '2.0', fields };
}

export const SimpleTemplates: StructuredFieldTemplate[] = [
  createSimpleTemplate('tpl-ctu-001', 'CT 尿路造影 (CTU)', 'CT', '腹部', [
    { id: 'f-ctu-001', fieldKey: 'kidney_r', fieldLabel: '右肾', fieldGroup: '肾', dataType: 'text', required: true, order: 1 },
    { id: 'f-ctu-002', fieldKey: 'kidney_l', fieldLabel: '左肾', fieldGroup: '肾', dataType: 'text', required: true, order: 2 },
    { id: 'f-ctu-003', fieldKey: 'ureter_r', fieldLabel: '右输尿管', fieldGroup: '输尿管', dataType: 'text', required: false, order: 3 },
    { id: 'f-ctu-004', fieldKey: 'ureter_l', fieldLabel: '左输尿管', fieldGroup: '输尿管', dataType: 'text', required: false, order: 4 },
    { id: 'f-ctu-005', fieldKey: 'bladder', fieldLabel: '膀胱', fieldGroup: '膀胱', dataType: 'text', required: true, order: 5 },
  ]),
  createSimpleTemplate('tpl-cta-headneck-001', '头颈 CTA', 'CT', '头颈', [
    { id: 'f-cta-001', fieldKey: 'aortic_arch', fieldLabel: '主动脉弓', fieldGroup: '弓上', dataType: 'text', required: false, order: 1 },
    { id: 'f-cta-002', fieldKey: 'brachiocephalic', fieldLabel: '头臂干', fieldGroup: '弓上', dataType: 'text', required: false, order: 2 },
    { id: 'f-cta-003', fieldKey: 'carotid_bifurcation', fieldLabel: '颈动脉分叉', fieldGroup: '颈部', dataType: 'text', required: true, order: 3 },
    { id: 'f-cta-004', fieldKey: 'ica', fieldLabel: '颈内动脉', fieldGroup: '颈部', dataType: 'text', required: true, order: 4 },
    { id: 'f-cta-005', fieldKey: 'vertebral', fieldLabel: '椎动脉', fieldGroup: '后循环', dataType: 'text', required: false, order: 5 },
    { id: 'f-cta-006', fieldKey: 'willis', fieldLabel: 'Willis 环', fieldGroup: '颅内', dataType: 'text', required: true, order: 6 },
  ]),
  createSimpleTemplate('tpl-cta-pulmonary-001', 'CTPA 肺动脉造影', 'CT', '胸部', [
    { id: 'f-ctpa-001', fieldKey: 'main_pa', fieldLabel: '主肺动脉', fieldGroup: '肺动脉', dataType: 'text', required: true, order: 1 },
    { id: 'f-ctpa-002', fieldKey: 'rpa', fieldLabel: '右肺动脉', fieldGroup: '肺动脉', dataType: 'text', required: true, order: 2 },
    { id: 'f-ctpa-003', fieldKey: 'lpa', fieldLabel: '左肺动脉', fieldGroup: '肺动脉', dataType: 'text', required: true, order: 3 },
    { id: 'f-ctpa-004', fieldKey: 'pe_location', fieldLabel: '栓塞位置', fieldGroup: '肺栓塞', dataType: 'text', required: false, order: 4 },
    { id: 'f-ctpa-005', fieldKey: 'rv_lv_ratio', fieldLabel: 'RV/LV 比值', fieldGroup: '心功能', dataType: 'number', required: false, order: 5 },
  ]),
  createSimpleTemplate('tpl-us-ty-001', '甲状腺超声 (TI-RADS)', 'US', '甲状腺', [
    { id: 'f-ty-001', fieldKey: 'thyroid_size_r', fieldLabel: '右叶大小 (mm)', fieldGroup: '甲状腺', dataType: 'text', required: true, order: 1 },
    { id: 'f-ty-002', fieldKey: 'thyroid_size_l', fieldLabel: '左叶大小 (mm)', fieldGroup: '甲状腺', dataType: 'text', required: true, order: 2 },
    { id: 'f-ty-003', fieldKey: 'nodule_count', fieldLabel: '结节数量', fieldGroup: '结节', dataType: 'number', required: false, order: 3 },
    { id: 'f-ty-004', fieldKey: 'nodule_max_size', fieldLabel: '最大结节 (mm)', fieldGroup: '结节', dataType: 'number', required: false, order: 4 },
    { id: 'f-ty-005', fieldKey: 'ti_rads', fieldLabel: 'TI-RADS 分类', fieldGroup: '分类', dataType: 'enum', required: false, options: [
      { label: 'TR1 良性', value: 'TR1' }, { label: 'TR2 无可疑', value: 'TR2' },
      { label: 'TR3 低度', value: 'TR3' }, { label: 'TR4 中度', value: 'TR4' },
      { label: 'TR5 高度', value: 'TR5' },
    ], category: 'TI-RADS', order: 5 },
  ]),
  createSimpleTemplate('tpl-us-artery-001', '颈动脉超声', 'US', '颈部', [
    { id: 'f-car-001', fieldKey: 'imt_r', fieldLabel: '右 CCA IMT (mm)', fieldGroup: 'IMT', dataType: 'number', required: true, order: 1 },
    { id: 'f-car-002', fieldKey: 'imt_l', fieldLabel: '左 CCA IMT (mm)', fieldGroup: 'IMT', dataType: 'number', required: true, order: 2 },
    { id: 'f-car-003', fieldKey: 'plaque_r', fieldLabel: '右斑块', fieldGroup: '斑块', dataType: 'text', required: false, order: 3 },
    { id: 'f-car-004', fieldKey: 'plaque_l', fieldLabel: '左斑块', fieldGroup: '斑块', dataType: 'text', required: false, order: 4 },
    { id: 'f-car-005', fieldKey: 'stenosis_r', fieldLabel: '右狭窄 (%)', fieldGroup: '狭窄', dataType: 'number', required: false, order: 5 },
    { id: 'f-car-006', fieldKey: 'stenosis_l', fieldLabel: '左狭窄 (%)', fieldGroup: '狭窄', dataType: 'number', required: false, order: 6 },
  ]),
  createSimpleTemplate('tpl-us-cardiac-001', '心脏超声 (ECHO)', 'US', '心脏', [
    { id: 'f-echo-001', fieldKey: 'lv_ef', fieldLabel: 'LVEF (%)', fieldGroup: '心功能', dataType: 'number', required: true, order: 1 },
    { id: 'f-echo-002', fieldKey: 'lvesd', fieldLabel: 'LVESD (mm)', fieldGroup: '心功能', dataType: 'number', required: true, order: 2 },
    { id: 'f-echo-003', fieldKey: 'lvedd', fieldLabel: 'LVEDD (mm)', fieldGroup: '心功能', dataType: 'number', required: true, order: 3 },
    { id: 'f-echo-004', fieldKey: 'wall_motion', fieldLabel: '室壁运动', fieldGroup: '室壁', dataType: 'text', required: true, order: 4 },
    { id: 'f-echo-005', fieldKey: 'valve_function', fieldLabel: '瓣膜功能', fieldGroup: '瓣膜', dataType: 'text', required: true, order: 5 },
  ]),
  createSimpleTemplate('tpel-us-obstetric-001', '产科超声 (II 级)', 'US', '产科', [
    { id: 'f-ob-001', fieldKey: 'gestational_age', fieldLabel: '孕周', fieldGroup: '胎儿', dataType: 'text', required: true, order: 1 },
    { id: 'f-ob-002', fieldKey: 'bpd', fieldLabel: '双顶径 BPD (mm)', fieldGroup: '测量', dataType: 'number', required: true, order: 2 },
    { id: 'f-ob-003', fieldKey: 'hc', fieldLabel: '头围 HC (mm)', fieldGroup: '测量', dataType: 'number', required: true, order: 3 },
    { id: 'f-ob-004', fieldKey: 'ac', fieldLabel: '腹围 AC (mm)', fieldGroup: '测量', dataType: 'number', required: true, order: 4 },
    { id: 'f-ob-005', fieldKey: 'fl', fieldLabel: '股骨长 FL (mm)', fieldGroup: '测量', dataType: 'number', required: true, order: 5 },
    { id: 'f-ob-006', fieldKey: 'fhr', fieldLabel: '胎心率 (bpm)', fieldGroup: '测量', dataType: 'number', required: true, order: 6 },
    { id: 'f-ob-007', fieldKey: 'placenta', fieldLabel: '胎盘位置', fieldGroup: '附属', dataType: 'text', required: true, order: 7 },
    { id: 'f-ob-008', fieldKey: 'afi', fieldLabel: '羊水指数 AFI', fieldGroup: '附属', dataType: 'number', required: true, order: 8 },
  ]),
  createSimpleTemplate('tpl-mr-mamma-001', '乳腺 MR', 'MR', '乳腺', [
    { id: 'f-mmb-001', fieldKey: 'bi_rads', fieldLabel: 'BI-RADS 分类', fieldGroup: '分类', dataType: 'enum', required: true, options: [
      { label: '0 评估不完全', value: '0' }, { label: '1 阴性', value: '1' },
      { label: '2 良性', value: '2' }, { label: '3 可能良性', value: '3' },
      { label: '4A 低度可疑', value: '4A' }, { label: '4B 中度可疑', value: '4B' },
      { label: '4C 高度可疑', value: '4C' }, { label: '5 高度提示恶性', value: '5' },
      { label: '6 已证实恶性', value: '6' },
    ], category: 'BI-RADS', order: 1 },
    { id: 'f-mmb-002', fieldKey: 'lesion_count', fieldLabel: '病灶数量', fieldGroup: '病灶', dataType: 'number', required: false, order: 2 },
    { id: 'f-mmb-003', fieldKey: 'lesion_size', fieldLabel: '最大病灶 (mm)', fieldGroup: '病灶', dataType: 'number', required: false, order: 3 },
    { id: 'f-mmb-004', fieldKey: 'kinetic_curve', fieldLabel: '动态增强曲线', fieldGroup: '强化', dataType: 'enum', required: false, options: [
      { label: 'I 型 - 持续上升', value: 'I' },
      { label: 'II 型 - 平台型', value: 'II' },
      { label: 'III 型 - 流出型', value: 'III' },
    ], order: 4 },
  ]),
  createSimpleTemplate('tpl-dr-chest-001', '胸部 DR 正侧位', 'DR', '胸部', [
    { id: 'f-cdr-001', fieldKey: 'lung_r', fieldLabel: '右肺', fieldGroup: '肺', dataType: 'text', required: true, order: 1 },
    { id: 'f-cdr-002', fieldKey: 'lung_l', fieldLabel: '左肺', fieldGroup: '肺', dataType: 'text', required: true, order: 2 },
    { id: 'f-cdr-003', fieldKey: 'heart_size', fieldLabel: '心影大小', fieldGroup: '心脏', dataType: 'text', required: true, order: 3 },
    { id: 'f-cdr-004', fieldKey: 'mediastinum', fieldLabel: '纵隔', fieldGroup: '纵隔', dataType: 'text', required: false, order: 4 },
    { id: 'f-cdr-005', fieldKey: 'pleura', fieldLabel: '胸膜', fieldGroup: '胸膜', dataType: 'text', required: false, order: 5 },
    { id: 'f-cdr-006', fieldKey: 'bone', fieldLabel: '骨性胸廓', fieldGroup: '骨', dataType: 'text', required: false, order: 6 },
  ]),
  createSimpleTemplate('tpl-dr-abdomen-001', '腹部 DR', 'DR', '腹部', [
    { id: 'f-abd-001', fieldKey: 'gas_pattern', fieldLabel: '肠气分布', fieldGroup: '肠', dataType: 'text', required: true, order: 1 },
    { id: 'f-abd-002', fieldKey: 'free_air', fieldLabel: '膈下游离气体', fieldGroup: '危急', dataType: 'boolean', required: true, order: 2 },
    { id: 'f-abd-003', fieldKey: 'calcification', fieldLabel: '钙化', fieldGroup: '其他', dataType: 'text', required: false, order: 3 },
    { id: 'f-abd-004', fieldKey: 'bone', fieldLabel: '骨性结构', fieldGroup: '骨', dataType: 'text', required: false, order: 4 },
  ]),
  createSimpleTemplate('tpl-dr-bone-001', '骨关节 DR', 'DR', '四肢', [
    { id: 'f-bdr-001', fieldKey: 'fracture', fieldLabel: '骨折', fieldGroup: '骨', dataType: 'text', required: false, order: 1 },
    { id: 'f-bdr-002', fieldKey: 'dislocation', fieldLabel: '脱位', fieldGroup: '关节', dataType: 'text', required: false, order: 2 },
    { id: 'f-bdr-003', fieldKey: 'joint_space', fieldLabel: '关节间隙', fieldGroup: '关节', dataType: 'text', required: false, order: 3 },
    { id: 'f-bdr-004', fieldKey: 'soft_tissue', fieldLabel: '软组织', fieldGroup: '软组织', dataType: 'text', required: false, order: 4 },
  ]),
  createSimpleTemplate('tpl-mr-knee-001', '膝关节 MR', 'MR', '膝关节', [
    { id: 'f-k-001', fieldKey: 'acl', fieldLabel: '前交叉韧带', fieldGroup: '韧带', dataType: 'text', required: true, order: 1 },
    { id: 'f-k-002', fieldKey: 'pcl', fieldLabel: '后交叉韧带', fieldGroup: '韧带', dataType: 'text', required: true, order: 2 },
    { id: 'f-k-003', fieldKey: 'mcl', fieldLabel: '内侧副韧带', fieldGroup: '韧带', dataType: 'text', required: true, order: 3 },
    { id: 'f-k-004', fieldKey: 'lcl', fieldLabel: '外侧副韧带', fieldGroup: '韧带', dataType: 'text', required: true, order: 4 },
    { id: 'f-k-005', fieldKey: 'medial_meniscus', fieldLabel: '内侧半月板', fieldGroup: '半月板', dataType: 'enum', required: true, options: [
      { label: '正常', value: 'normal' }, { label: 'I°损伤', value: 'I' },
      { label: 'II°损伤', value: 'II' }, { label: 'III°撕裂', value: 'III' },
    ], order: 5 },
    { id: 'f-k-006', fieldKey: 'lateral_meniscus', fieldLabel: '外侧半月板', fieldGroup: '半月板', dataType: 'enum', required: true, options: [
      { label: '正常', value: 'normal' }, { label: 'I°损伤', value: 'I' },
      { label: 'II°损伤', value: 'II' }, { label: 'III°撕裂', value: 'III' },
    ], order: 6 },
    { id: 'f-k-007', fieldKey: 'cartilage', fieldLabel: '关节软骨', fieldGroup: '软骨', dataType: 'text', required: false, order: 7 },
  ]),
  createSimpleTemplate('tpl-mr-shoulder-001', '肩关节 MR', 'MR', '肩关节', [
    { id: 'f-sh-001', fieldKey: 'rotator_cuff', fieldLabel: '肩袖', fieldGroup: '肩袖', dataType: 'text', required: true, order: 1 },
    { id: 'f-sh-002', fieldKey: 'supraspinatus', fieldLabel: '冈上肌腱', fieldGroup: '肩袖', dataType: 'enum', required: true, options: [
      { label: '正常', value: 'normal' }, { label: '肌腱炎', value: 'tendinitis' },
      { label: '部分撕裂', value: 'partial-tear' }, { label: '完全撕裂', value: 'full-tear' },
    ], order: 2 },
    { id: 'f-sh-003', fieldKey: 'infraspinatus', fieldLabel: '冈下肌腱', fieldGroup: '肩袖', dataType: 'enum', required: true, options: [
      { label: '正常', value: 'normal' }, { label: '部分撕裂', value: 'partial-tear' },
      { label: '完全撕裂', value: 'full-tear' },
    ], order: 3 },
    { id: 'f-sh-004', fieldKey: 'subscapularis', fieldLabel: '肩胛下肌腱', fieldGroup: '肩袖', dataType: 'enum', required: true, options: [
      { label: '正常', value: 'normal' }, { label: '部分撕裂', value: 'partial-tear' },
      { label: '完全撕裂', value: 'full-tear' },
    ], order: 4 },
    { id: 'f-sh-005', fieldKey: 'labrum', fieldLabel: '盂唇', fieldGroup: '盂唇', dataType: 'text', required: false, order: 5 },
    { id: 'f-sh-006', fieldKey: 'biceps_tendon', fieldLabel: '肱二头肌长头腱', fieldGroup: '其他', dataType: 'text', required: false, order: 6 },
  ]),
  createSimpleTemplate('tpl-pet-ct-001', 'PET-CT 全身', 'PET-CT', '全身', [
    { id: 'f-pet-001', fieldKey: 'indication', fieldLabel: '检查目的', fieldGroup: '临床', dataType: 'text', required: true, order: 1 },
    { id: 'f-pet-002', fieldKey: 'hypermetabolic', fieldLabel: '高代谢病灶', fieldGroup: '所见', dataType: 'text', required: false, order: 2 },
    { id: 'f-pet-003', fieldKey: 'bone_metastasis', fieldLabel: '骨转移', fieldGroup: '转移', dataType: 'text', required: false, order: 3 },
    { id: 'f-pet-004', fieldKey: 'lymph_node', fieldLabel: '淋巴结', fieldGroup: '转移', dataType: 'text', required: false, order: 4 },
    { id: 'f-pet-005', fieldKey: 'organ_metastasis', fieldLabel: '脏器转移', fieldGroup: '转移', dataType: 'text', required: false, order: 5 },
    { id: 'f-pet-006', fieldKey: 'suv_max', fieldLabel: 'SUVmax', fieldGroup: '量化', dataType: 'number', required: false, order: 6 },
  ]),
];

// ============================================================
// 所有模板集合
// ============================================================
export const STRUCTURED_FIELD_TEMPLATES: StructuredFieldTemplate[] = [
  ChestCTTemplate,
  HeadCTTemplate,
  MammographyTemplate,
  AbdomenCTTemplate,
  CoronaryCTATemplate,
  ThyroidUSTemplate,
  AbdomenMRTemplate,
  MRCPTemplate,
  HeadMRTemplate,
  ProstateMRTemplate,
  MRABrainTemplate,
  LumbarMRTemplate,
  CervicalMRTemplate,
  CardiacMRTemplate,
  CoronaryCTATemplateV2,
  ...SimpleTemplates,
];

// 按 modality + bodyPart 查找模板
export function findTemplate(modality: string, bodyPart: string): StructuredFieldTemplate | undefined {
  return STRUCTURED_FIELD_TEMPLATES.find(
    t => t.modality === modality && t.bodyPart === bodyPart,
  );
}

// 按 ID 查找
export function getTemplateById(id: string): StructuredFieldTemplate | undefined {
  return STRUCTURED_FIELD_TEMPLATES.find(t => t.id === id);
}

// 按模态查找
export function findTemplatesByModality(modality: string): StructuredFieldTemplate[] {
  return STRUCTURED_FIELD_TEMPLATES.filter(t => t.modality === modality);
}

// 按分类查找
export function findTemplatesByCategory(category: string): StructuredFieldTemplate[] {
  return STRUCTURED_FIELD_TEMPLATES.filter(t =>
    t.fields.some(f => f.category === category)
  );
}

export const TEMPLATE_COUNT = STRUCTURED_FIELD_TEMPLATES.length;
export const TEMPLATE_BY_MODALITY: Record<string, StructuredFieldTemplate[]> = STRUCTURED_FIELD_TEMPLATES.reduce((acc, t) => {
  if (!acc[t.modality]) acc[t.modality] = [];
  acc[t.modality]!.push(t);
  return acc;
}, {} as Record<string, StructuredFieldTemplate[]>);

// 默认导出
export default {
  STRUCTURED_FIELD_TEMPLATES,
  findTemplate,
  getTemplateById,
  findTemplatesByModality,
  findTemplatesByCategory,
  TEMPLATE_COUNT,
  TEMPLATE_BY_MODALITY,
  ChestCTTemplate,
  HeadCTTemplate,
  MammographyTemplate,
  AbdomenCTTemplate,
  CoronaryCTATemplate,
  ThyroidUSTemplate,
  AbdomenMRTemplate,
  MRCPTemplate,
  HeadMRTemplate,
  ProstateMRTemplate,
  MRABrainTemplate,
  LumbarMRTemplate,
  CervicalMRTemplate,
  CardiacMRTemplate,
  CoronaryCTATemplateV2,
  SimpleTemplates,
};
