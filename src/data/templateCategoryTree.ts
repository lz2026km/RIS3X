// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板分类树数据
// Phase R2：按设备 / 部位 / 病种 三维分类
// ============================================================

export interface TemplateCategoryNode {
  id: string;
  name: string;
  code: string;
  level: 'modality' | 'bodyPart' | 'disease';
  icon?: string;
  children: TemplateCategoryNode[];
  templateCount: number;
  description?: string;
}

// ============================================================
// 分类树结构
// ============================================================
export const TEMPLATE_CATEGORY_TREE: TemplateCategoryNode[] = [
  {
    id: 'cat-ct',
    name: 'CT 模板',
    code: 'CT',
    level: 'modality',
    icon: '',
    templateCount: 0,
    description: 'CT 各类检查的标准化报告模板',
    children: [
      {
        id: 'cat-ct-head', name: '头颅', code: 'CT-HEAD', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-ct-head-plain', name: '平扫', code: 'CT-HEAD-PLAIN', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-head-enhance', name: '增强', code: 'CT-HEAD-ENHANCE', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-head-cta', name: 'CTA', code: 'CT-HEAD-CTA', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-head-perfusion', name: '灌注', code: 'CT-HEAD-PERFUSION', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-ct-chest', name: '胸部', code: 'CT-CHEST', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-ct-chest-plain', name: '平扫', code: 'CT-CHEST-PLAIN', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-chest-enhance', name: '增强', code: 'CT-CHEST-ENHANCE', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-chest-hrct', name: '高分辨率', code: 'CT-CHEST-HRCT', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-chest-lungcancer', name: '肺癌筛查', code: 'CT-CHEST-LUNGCANCER', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-chest-covid', name: '新冠肺炎', code: 'CT-CHEST-COVID', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-ct-abdomen', name: '腹部', code: 'CT-ABDOMEN', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-ct-abdomen-plain', name: '平扫', code: 'CT-ABDOMEN-PLAIN', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-abdomen-enhance', name: '增强（三期）', code: 'CT-ABDOMEN-ENHANCE', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-abdomen-urography', name: '尿路造影（CTU）', code: 'CT-ABDOMEN-CTU', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-ct-cardiac', name: '心脏冠脉', code: 'CT-CARDIAC', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-ct-cardiac-cta', name: '冠脉 CTA', code: 'CT-CARDIAC-CTA', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-cardiac-cacs', name: '钙化积分', code: 'CT-CARDIAC-CACS', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-ct-spine', name: '脊柱', code: 'CT-SPINE', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-ct-spine-cervical', name: '颈椎', code: 'CT-SPINE-CERVICAL', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-spine-thoracic', name: '胸椎', code: 'CT-SPINE-THORACIC', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-ct-spine-lumbar', name: '腰椎', code: 'CT-SPINE-LUMBAR', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
    ],
  },
  {
    id: 'cat-mr',
    name: 'MR 模板',
    code: 'MR',
    level: 'modality',
    icon: '',
    templateCount: 0,
    description: 'MR 各类检查的标准化报告模板',
    children: [
      {
        id: 'cat-mr-head', name: '头颅', code: 'MR-HEAD', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-mr-head-plain', name: '平扫', code: 'MR-HEAD-PLAIN', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-head-enhance', name: '增强', code: 'MR-HEAD-ENHANCE', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-head-mra', name: 'MRA', code: 'MR-HEAD-MRA', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-head-mrs', name: 'MRS 波谱', code: 'MR-HEAD-MRS', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-head-dwi', name: 'DWI 弥散', code: 'MR-HEAD-DWI', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-mr-spine', name: '脊柱', code: 'MR-SPINE', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-mr-spine-cervical', name: '颈椎', code: 'MR-SPINE-CERVICAL', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-spine-thoracic', name: '胸椎', code: 'MR-SPINE-THORACIC', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-spine-lumbar', name: '腰椎', code: 'MR-SPINE-LUMBAR', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-mr-abdomen', name: '腹部', code: 'MR-ABDOMEN', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-mr-abdomen-liver', name: '肝脏', code: 'MR-ABDOMEN-LIVER', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-abdomen-pancreas', name: '胰腺', code: 'MR-ABDOMEN-PANCREAS', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-abdomen-pelvis', name: '盆腔', code: 'MR-ABDOMEN-PELVIS', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
      {
        id: 'cat-mr-joint', name: '关节', code: 'MR-JOINT', level: 'bodyPart', icon: '', templateCount: 0,
        children: [
          { id: 'cat-mr-joint-knee', name: '膝关节', code: 'MR-JOINT-KNEE', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-joint-shoulder', name: '肩关节', code: 'MR-JOINT-SHOULDER', level: 'disease', icon: '', templateCount: 0, children: [] },
          { id: 'cat-mr-joint-hip', name: '髋关节', code: 'MR-JOINT-HIP', level: 'disease', icon: '', templateCount: 0, children: [] },
        ],
      },
    ],
  },
  {
    id: 'cat-mg',
    name: 'MG',
    code: 'MG',
    level: 'modality',
    icon: '',
    templateCount: 0,
    children: [
      { id: 'cat-mg-screening', name: '筛查', code: 'MG-SCREENING', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-mg-diagnosis', name: '诊断', code: 'MG-DIAGNOSIS', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-mg-followup', name: '随访', code: 'MG-FOLLOWUP', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
    ],
  },
  {
    id: 'cat-dr',
    name: 'DR/CR 模板',
    code: 'DR',
    level: 'modality',
    icon: '',
    templateCount: 0,
    children: [
      { id: 'cat-dr-chest', name: '胸部', code: 'DR-CHEST', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-dr-abdomen', name: '腹部', code: 'DR-ABDOMEN', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-dr-spine', name: '脊柱', code: 'DR-SPINE', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-dr-limb', name: '四肢', code: 'DR-LIMB', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
    ],
  },
  {
    id: 'cat-us',
    name: '超声模板',
    code: 'US',
    level: 'modality',
    icon: '',
    templateCount: 0,
    children: [
      { id: 'cat-us-thyroid', name: '甲状腺', code: 'US-THYROID', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-us-abdomen', name: '腹部', code: 'US-ABDOMEN', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-us-cardiac', name: '心脏', code: 'US-CARDIAC', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-us-vascular', name: '血管', code: 'US-VASCULAR', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
    ],
  },
  {
    id: 'cat-special',
    name: '专科模板',
    code: 'SPECIAL',
    level: 'modality',
    icon: '',
    templateCount: 0,
    children: [
      { id: 'cat-special-petct', name: 'PET-CT', code: 'PETCT', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-special-dsa', name: 'DSA', code: 'DSA', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
      { id: 'cat-special-gi', name: 'GI', code: 'GI', level: 'bodyPart', icon: '', templateCount: 0, children: [] },
    ],
  },
];

// ============================================================
// 工具函数：递归统计模板数
// ============================================================
export function countTemplatesInTree(node: TemplateCategoryNode): number {
  let count = node.templateCount;
  for (const child of node.children) {
    count += countTemplatesInTree(child);
  }
  return count;
}

// ============================================================
// 工具函数：扁平化所有节点
// ============================================================
export interface FlatCategoryNode extends TemplateCategoryNode {
  parentId: string | null;
  depth: number;
  path: string;
}

export function flattenCategoryTree(tree: TemplateCategoryNode[], parentId: string | null = null, depth = 0, parentPath = ''): FlatCategoryNode[] {
  const result: FlatCategoryNode[] = [];
  for (const node of tree) {
    const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    result.push({ ...node, parentId, depth, path });
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, node.id, depth + 1, path));
    }
  }
  return result;
}

// ============================================================
// 工具函数：按 ID 查找
// ============================================================
export function findCategoryById(tree: TemplateCategoryNode[], id: string): TemplateCategoryNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategoryById(node.children, id);
    if (found) return found;
  }
  return null;
}

// ============================================================
// 工具函数：统计各级数量
// ============================================================
export function countByLevel(tree: TemplateCategoryNode[]): { modality: number; bodyPart: number; disease: number; total: number } {
  let modality = 0, bodyPart = 0, disease = 0, total = 0;
  function walk(nodes: TemplateCategoryNode[]) {
    for (const n of nodes) {
      total++;
      if (n.level === 'modality') modality++;
      else if (n.level === 'bodyPart') bodyPart++;
      else if (n.level === 'disease') disease++;
      if (n.children.length > 0) walk(n.children);
    }
  }
  walk(tree);
  return { modality, bodyPart, disease, total };
}

export default {
  TEMPLATE_CATEGORY_TREE,
  countTemplatesInTree,
  flattenCategoryTree,
  findCategoryById,
  countByLevel,
};
