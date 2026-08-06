// ============================================================
// G005 放射RIS系统 v2.1.0 - 扩展术语库 (2000 词条)
// Phase R12 W11: 解剖 + RADS + 影像征象 + 危急值 + 修饰 + 测量
// ============================================================

export type TermCategory =
  | 'anatomy-organ' | 'anatomy-region' | 'anatomy-substructure'
  | 'finding-lung' | 'finding-liver' | 'finding-breast' | 'finding-brain' | 'finding-bone' | 'finding-cardiac' | 'finding-kidney' | 'finding-thyroid' | 'finding-general'
  | 'modifier' | 'measurement' | 'radlex' | 'snomed' | 'icd10' | 'critical-value' | 'technique' | 'lod' | 'fracture';

export interface Term {
  id: string;
  term: string;             // 英文/拉丁
  cn: string;               // 中文
  category: TermCategory;
  synonyms?: string[];      // 别名
  snomed?: string;          // SNOMED CT code
  radlex?: string;          // RadLex RID
  icd10?: string;           // ICD-10 code
  description?: string;
}

const ANATOMY_REGIONS = [
  { term: 'head', cn: '头部' }, { term: 'neck', cn: '颈部' }, { term: 'chest', cn: '胸部' },
  { term: 'abdomen', cn: '腹部' }, { term: 'pelvis', cn: '盆腔' }, { term: 'spine', cn: '脊柱' },
  { term: 'thorax', cn: '胸腔' }, { term: 'mediastinum', cn: '纵隔' },
  { term: 'upper-extremity', cn: '上肢' }, { term: 'lower-extremity', cn: '下肢' },
  { term: 'retroperitoneum', cn: '腹膜后' }, { term: 'craniofacial', cn: '颅面' },
];

const ORGANS = [
  { term: 'brain', cn: '脑' }, { term: 'cerebellum', cn: '小脑' }, { term: 'brainstem', cn: '脑干' },
  { term: 'lung-RUL', cn: '右肺上叶' }, { term: 'lung-RML', cn: '右肺中叶' }, { term: 'lung-RLL', cn: '右肺下叶' },
  { term: 'lung-LUL', cn: '左肺上叶' }, { term: 'lung-LLL', cn: '左肺下叶' },
  { term: 'heart-LV', cn: '左心室' }, { term: 'heart-RV', cn: '右心室' }, { term: 'heart-LA', cn: '左心房' }, { term: 'heart-RA', cn: '右心房' },
  { term: 'liver', cn: '肝脏' }, { term: 'liver-RL', cn: '肝右叶' }, { term: 'liver-LL', cn: '肝左叶' }, { term: 'liver-caudate', cn: '尾状叶' },
  { term: 'gallbladder', cn: '胆囊' }, { term: 'bile-duct', cn: '胆管' }, { term: 'spleen', cn: '脾脏' },
  { term: 'pancreas', cn: '胰腺' }, { term: 'pancreas-head', cn: '胰头' }, { term: 'pancreas-body', cn: '胰体' }, { term: 'pancreas-tail', cn: '胰尾' },
  { term: 'kidney-left', cn: '左肾' }, { term: 'kidney-right', cn: '右肾' }, { term: 'adrenal', cn: '肾上腺' },
  { term: 'stomach', cn: '胃' }, { term: 'duodenum', cn: '十二指肠' }, { term: 'jejunum', cn: '空肠' }, { term: 'ileum', cn: '回肠' },
  { term: 'colon-ascending', cn: '升结肠' }, { term: 'colon-transverse', cn: '横结肠' }, { term: 'colon-descending', cn: '降结肠' }, { term: 'colon-sigmoid', cn: '乙状结肠' }, { term: 'rectum', cn: '直肠' },
  { term: 'bladder', cn: '膀胱' }, { term: 'prostate', cn: '前列腺' }, { term: 'uterus', cn: '子宫' }, { term: 'ovary', cn: '卵巢' },
  { term: 'breast-left', cn: '左乳' }, { term: 'breast-right', cn: '右乳' },
  { term: 'thyroid', cn: '甲状腺' }, { term: 'parathyroid', cn: '甲状旁腺' },
  { term: 'cervical-spine', cn: '颈椎' }, { term: 'thoracic-spine', cn: '胸椎' }, { term: 'lumbar-spine', cn: '腰椎' }, { term: 'sacrum', cn: '骶骨' },
  { term: 'femur', cn: '股骨' }, { term: 'tibia', cn: '胫骨' }, { term: 'fibula', cn: '腓骨' }, { term: 'humerus', cn: '肱骨' }, { term: 'radius', cn: '桡骨' }, { term: 'ulna', cn: '尺骨' },
  { term: 'knee', cn: '膝关节' }, { term: 'hip', cn: '髋关节' }, { term: 'shoulder', cn: '肩关节' }, { term: 'wrist', cn: '腕关节' }, { term: 'ankle', cn: '踝关节' },
];

const FINDINGS = [
  // 肺
  { term: 'pulmonary-nodule', cn: '肺结节', category: 'finding-lung' as TermCategory, snomed: '426396005', radlex: 'RID5761', icd10: 'R91.1' },
  { term: 'ground-glass-opacity', cn: '磨玻璃密度影', category: 'finding-lung' as TermCategory, snomed: '428121001' },
  { term: 'consolidation', cn: '实变', category: 'finding-lung' as TermCategory, snomed: '95436008' },
  { term: 'tree-in-bud', cn: '树芽征', category: 'finding-lung' as TermCategory },
  { term: 'honeycombing', cn: '蜂窝影', category: 'finding-lung' as TermCategory, snomed: '40733004' },
  { term: 'pleural-effusion', cn: '胸腔积液', category: 'finding-lung' as TermCategory, snomed: '60046008', icd10: 'J90' },
  { term: 'pneumothorax', cn: '气胸', category: 'finding-lung' as TermCategory, snomed: '233918000', icd10: 'J93' },
  { term: 'atelectasis', cn: '肺不张', category: 'finding-lung' as TermCategory, snomed: '46621007' },
  { term: 'cavitation', cn: '空洞形成', category: 'finding-lung' as TermCategory },
  { term: 'spiculation', cn: '毛刺征', category: 'finding-lung' as TermCategory },
  { term: 'calcification', cn: '钙化', category: 'finding-lung' as TermCategory, snomed: '47525004' },
  { term: 'mediastinal-lymphadenopathy', cn: '纵隔淋巴结肿大', category: 'finding-lung' as TermCategory },
  // 肝
  { term: 'hepatic-cyst', cn: '肝囊肿', category: 'finding-liver' as TermCategory, snomed: '312912001' },
  { term: 'hemangioma', cn: '血管瘤', category: 'finding-liver' as TermCategory, snomed: '21861000' },
  { term: 'focal-nodular-hyperplasia', cn: '局灶性结节增生', category: 'finding-liver' as TermCategory },
  { term: 'hepatocellular-carcinoma', cn: '肝细胞癌', category: 'finding-liver' as TermCategory, snomed: '25370001', icd10: 'C22.0' },
  { term: 'liver-metastasis', cn: '肝转移瘤', category: 'finding-liver' as TermCategory },
  { term: 'cirrhosis', cn: '肝硬化', category: 'finding-liver' as TermCategory, snomed: '19943007', icd10: 'K74.6' },
  { term: 'fatty-liver', cn: '脂肪肝', category: 'finding-liver' as TermCategory, snomed: '42454008' },
  { term: 'biliary-dilation', cn: '胆管扩张', category: 'finding-liver' as TermCategory },
  { term: 'ascites', cn: '腹水', category: 'finding-liver' as TermCategory, snomed: '389026000' },
  // 乳腺
  { term: 'breast-mass', cn: '乳腺肿块', category: 'finding-breast' as TermCategory, snomed: '309529002' },
  { term: 'microcalcification', cn: '微钙化', category: 'finding-breast' as TermCategory },
  { term: 'ductal-carcinoma', cn: '导管癌', category: 'finding-breast' as TermCategory, icd10: 'C50.9' },
  { term: 'fibroadenoma', cn: '纤维腺瘤', category: 'finding-breast' as TermCategory, snomed: '254845004' },
  { term: 'breast-cyst', cn: '乳腺囊肿', category: 'finding-breast' as TermCategory },
  // 脑
  { term: 'cerebral-infarction', cn: '脑梗死', category: 'finding-brain' as TermCategory, snomed: '230690007', icd10: 'I63.9' },
  { term: 'cerebral-hemorrhage', cn: '脑出血', category: 'finding-brain' as TermCategory, snomed: '274100004', icd10: 'I61.9' },
  { term: 'brain-tumor', cn: '脑肿瘤', category: 'finding-brain' as TermCategory, snomed: '126952004' },
  { term: 'white-matter-lesion', cn: '白质病变', category: 'finding-brain' as TermCategory },
  { term: 'brain-atrophy', cn: '脑萎缩', category: 'finding-brain' as TermCategory, snomed: '278918005' },
  { term: 'hydrocephalus', cn: '脑积水', category: 'finding-brain' as TermCategory, snomed: '230350006' },
  { term: 'subdural-hematoma', cn: '硬膜下血肿', category: 'finding-brain' as TermCategory, snomed: '4323009' },
  { term: 'epidural-hematoma', cn: '硬膜外血肿', category: 'finding-brain' as TermCategory },
  // 骨
  { term: 'fracture', cn: '骨折', category: 'fracture' as TermCategory, snomed: '72704001' },
  { term: 'comminuted-fracture', cn: '粉碎性骨折', category: 'fracture' as TermCategory },
  { term: 'displaced-fracture', cn: '移位骨折', category: 'fracture' as TermCategory },
  { term: 'compression-fracture', cn: '压缩性骨折', category: 'fracture' as TermCategory },
  { term: 'pathological-fracture', cn: '病理性骨折', category: 'fracture' as TermCategory },
  { term: 'avulsion-fracture', cn: '撕脱性骨折', category: 'fracture' as TermCategory },
  { term: 'osteoporosis', cn: '骨质疏松', category: 'finding-bone' as TermCategory, snomed: '64859006' },
  { term: 'osteolytic-lesion', cn: '溶骨性病变', category: 'finding-bone' as TermCategory },
  { term: 'osteoblastic-lesion', cn: '成骨性病变', category: 'finding-bone' as TermCategory },
  { term: 'bone-marrow-edema', cn: '骨髓水肿', category: 'finding-bone' as TermCategory },
  // 心脏
  { term: 'cardiomegaly', cn: '心脏增大', category: 'finding-cardiac' as TermCategory, snomed: '8186001' },
  { term: 'pericardial-effusion', cn: '心包积液', category: 'finding-cardiac' as TermCategory, snomed: '373945007' },
  { term: 'coronary-calcification', cn: '冠状动脉钙化', category: 'finding-cardiac' as TermCategory },
  { term: 'myocardial-infarction', cn: '心肌梗死', category: 'finding-cardiac' as TermCategory, snomed: '22298006', icd10: 'I21' },
  // 肾
  { term: 'renal-cyst', cn: '肾囊肿', category: 'finding-kidney' as TermCategory, snomed: '36171000' },
  { term: 'renal-stone', cn: '肾结石', category: 'finding-kidney' as TermCategory, snomed: '95570007', icd10: 'N20.0' },
  { term: 'hydronephrosis', cn: '肾积水', category: 'finding-kidney' as TermCategory, snomed: '197811007' },
  { term: 'renal-mass', cn: '肾占位', category: 'finding-kidney' as TermCategory },
  { term: 'renal-cell-carcinoma', cn: '肾细胞癌', category: 'finding-kidney' as TermCategory, snomed: '254637007' },
  // 甲状腺
  { term: 'thyroid-nodule', cn: '甲状腺结节', category: 'finding-thyroid' as TermCategory, snomed: '426396005' },
  { term: 'thyroid-cyst', cn: '甲状腺囊肿', category: 'finding-thyroid' as TermCategory },
  { term: 'goiter', cn: '甲状腺肿', category: 'finding-thyroid' as TermCategory, snomed: '3716002' },
  // 通用
  { term: 'mass', cn: '肿块', category: 'finding-general' as TermCategory, snomed: '4147007' },
  { term: 'edema', cn: '水肿', category: 'finding-general' as TermCategory, snomed: '79654002' },
  { term: 'inflammation', cn: '炎症', category: 'finding-general' as TermCategory, snomed: '257551008' },
  { term: 'hyperplasia', cn: '增生', category: 'finding-general' as TermCategory, snomed: '134306007' },
  { term: 'necrosis', cn: '坏死', category: 'finding-general' as TermCategory, snomed: '6574001' },
  { term: 'fibrosis', cn: '纤维化', category: 'finding-general' as TermCategory, snomed: '112674009' },
  { term: 'stenosis', cn: '狭窄', category: 'finding-general' as TermCategory, snomed: '41543000' },
  { term: 'occlusion', cn: '闭塞', category: 'finding-general' as TermCategory, snomed: '26036001' },
  { term: 'dilation', cn: '扩张', category: 'finding-general' as TermCategory, snomed: '253011002' },
];

const MODIFIERS = [
  { term: 'focal', cn: '局灶性' }, { term: 'diffuse', cn: '弥漫性' }, { term: 'multiple', cn: '多发' },
  { term: 'solitary', cn: '单发' }, { term: 'bilateral', cn: '双侧' }, { term: 'unilateral', cn: '单侧' },
  { term: 'mild', cn: '轻度' }, { term: 'moderate', cn: '中度' }, { term: 'severe', cn: '重度' },
  { term: 'acute', cn: '急性' }, { term: 'chronic', cn: '慢性' }, { term: 'subacute', cn: '亚急性' },
  { term: 'well-defined', cn: '边界清楚' }, { term: 'ill-defined', cn: '边界不清' },
  { term: 'regular', cn: '形态规则' }, { term: 'irregular', cn: '形态不规则' },
  { term: 'homogeneous', cn: '均匀' }, { term: 'heterogeneous', cn: '不均匀' },
  { term: 'hyperdense', cn: '高密度' }, { term: 'hypodense', cn: '低密度' }, { term: 'isodense', cn: '等密度' },
  { term: 'hyperintense', cn: '高信号' }, { term: 'hypointense', cn: '低信号' }, { term: 'isointense', cn: '等信号' },
  { term: 'enhanced', cn: '强化的' }, { term: 'non-enhanced', cn: '无强化的' },
  { term: 'enhancement', cn: '强化' }, { term: 'washout', cn: '廓清' }, { term: 'delayed-enhancement', cn: '延迟强化' },
  { term: 'peripheral', cn: '周围性' }, { term: 'central', cn: '中央性' },
  { term: 'anterior', cn: '前部' }, { term: 'posterior', cn: '后部' }, { term: 'superior', cn: '上部' }, { term: 'inferior', cn: '下部' },
  { term: 'medial', cn: '内侧' }, { term: 'lateral', cn: '外侧' },
  { term: 'proximal', cn: '近端' }, { term: 'distal', cn: '远端' },
  { term: 'lobulated', cn: '分叶状' }, { term: 'spiculated', cn: '毛刺状' }, { term: 'smooth', cn: '光滑' },
  { term: 'cystic', cn: '囊性' }, { term: 'solid', cn: '实性' }, { term: 'mixed', cn: '混合性' },
  { term: 'vascular', cn: '血管性' }, { term: 'avascular', cn: '无血管' },
  { term: 'mobile', cn: '活动的' }, { term: 'fixed', cn: '固定的' },
  { term: 'tender', cn: '触痛的' }, { term: 'non-tender', cn: '无触痛' },
];

const MEASUREMENTS: Array<{ term: string; cn: string; unit: string; category: TermCategory }> = [
  { term: 'diameter', cn: '直径', unit: 'mm', category: 'measurement' },
  { term: 'length', cn: '长度', unit: 'mm', category: 'measurement' },
  { term: 'width', cn: '宽度', unit: 'mm', category: 'measurement' },
  { term: 'height', cn: '高度', unit: 'mm', category: 'measurement' },
  { term: 'area', cn: '面积', unit: 'mm²', category: 'measurement' },
  { term: 'volume', cn: '体积', unit: 'mm³', category: 'measurement' },
  { term: 'ct-value', cn: 'CT 值', unit: 'HU', category: 'measurement' },
  { term: 'signal-intensity', cn: '信号强度', unit: 'SI', category: 'measurement' },
  { term: 'cobb-angle', cn: 'Cobb 角', unit: '°', category: 'measurement' },
  { term: 'angle', cn: '角度', unit: '°', category: 'measurement' },
];

const CRITICAL_VALUES = [
  { term: 'tension-pneumothorax', cn: '张力性气胸', urgency: 'immediate' },
  { term: 'massive-hemothorax', cn: '大量血胸', urgency: 'immediate' },
  { term: 'aortic-dissection', cn: '主动脉夹层', urgency: 'immediate' },
  { term: 'aortic-aneurysm-rupture', cn: '主动脉瘤破裂', urgency: 'immediate' },
  { term: 'pulmonary-embolism', cn: '肺栓塞', urgency: 'immediate' },
  { term: 'acute-stroke', cn: '急性脑卒中', urgency: 'immediate' },
  { term: 'cerebral-hemorrhage-acute', cn: '急性脑出血', urgency: 'immediate' },
  { term: 'subarachnoid-hemorrhage', cn: '蛛网膜下腔出血', urgency: 'immediate' },
  { term: 'bowel-perforation', cn: '肠穿孔', urgency: 'immediate' },
  { term: 'bowel-obstruction', cn: '肠梗阻', urgency: 'urgent' },
  { term: 'ectopic-pregnancy-rupture', cn: '宫外孕破裂', urgency: 'immediate' },
  { term: 'testicular-torsion', cn: '睾丸扭转', urgency: 'immediate' },
  { term: 'acute-appendicitis', cn: '急性阑尾炎', urgency: 'urgent' },
  { term: 'acute-cholecystitis', cn: '急性胆囊炎', urgency: 'urgent' },
  { term: 'acute-pancreatitis', cn: '急性胰腺炎', urgency: 'urgent' },
  { term: 'foreign-body', cn: '异物', urgency: 'urgent' },
  { term: 'fracture-dislocation', cn: '骨折伴脱位', urgency: 'urgent' },
  { term: 'spine-fracture-cord', cn: '脊柱骨折伴脊髓损伤', urgency: 'immediate' },
  { term: 'open-fracture', cn: '开放性骨折', urgency: 'urgent' },
  { term: 'misplaced-tube', cn: '管道位置异常', urgency: 'urgent' },
];

const TECHNIQUES = [
  { term: 'plain-scan', cn: '平扫' }, { term: 'contrast-enhanced', cn: '增强扫描' },
  { term: 'arterial-phase', cn: '动脉期' }, { term: 'venous-phase', cn: '静脉期' },
  { term: 'delayed-phase', cn: '延迟期' }, { term: 'multiphase', cn: '多期扫描' },
  { term: 'T1WI', cn: 'T1 加权' }, { term: 'T2WI', cn: 'T2 加权' },
  { term: 'FLAIR', cn: '液体衰减反转恢复' }, { term: 'DWI', cn: '弥散加权成像' },
  { term: 'ADC', cn: '表观扩散系数' }, { term: 'MRA', cn: '磁共振血管成像' },
  { term: 'MRCP', cn: '磁共振胰胆管成像' }, { term: 'CTA', cn: 'CT 血管成像' },
  { term: 'CTU', cn: 'CT 尿路成像' }, { term: 'PET-CT', cn: 'PET-CT' },
  { term: 'SPECT', cn: '单光子发射断层' }, { term: 'fusion-imaging', cn: '融合成像' },
  { term: '3D-reconstruction', cn: '三维重建' }, { term: 'MPR', cn: '多平面重建' },
];

// 扩增：变异词条（形容词修饰组合）
const VARIANTS = [
  { suffix: '-primary', cnPre: '原发性' }, { suffix: '-secondary', cnPre: '继发性' },
  { suffix: '-benign', cnPre: '良性' }, { suffix: '-malignant', cnPre: '恶性' },
  { suffix: '-congenital', cnPre: '先天性' }, { suffix: '-acquired', cnPre: '获得性' },
  { suffix: '-idiopathic', cnPre: '特发性' }, { suffix: '-traumatic', cnPre: '外伤性' },
];

// 生成扩展术语
export function generateTerms(): Term[] {
  const terms: Term[] = [];
  const seen = new Set<string>();

  // 解剖 - 大区
  ANATOMY_REGIONS.forEach((r, i) => {
    const id = `R${(i + 1).toString().padStart(3, '0')}`;
    terms.push({ id, term: r.term, cn: r.cn, category: 'anatomy-region' });
  });

  // 解剖 - 器官
  ORGANS.forEach((o, i) => {
    const id = `O${(i + 1).toString().padStart(3, '0')}`;
    terms.push({ id, term: o.term, cn: o.cn, category: 'anatomy-organ', description: `解剖结构：${o.cn}` });
  });

  // 影像所见
  FINDINGS.forEach((f, i) => {
    const id = `F${(i + 1).toString().padStart(4, '0')}`;
    terms.push({
      id, term: f.term, cn: f.cn, category: f.category,
      snomed: f.snomed, radlex: f.radlex, icd10: f.icd10,
    });
  });

  // 修饰词
  MODIFIERS.forEach((m, i) => {
    terms.push({ id: `M${(i + 1).toString().padStart(3, '0')}`, term: m.term, cn: m.cn, category: 'modifier' });
  });

  // 测量
  MEASUREMENTS.forEach((m, i) => {
    terms.push({ id: `ME${(i + 1).toString().padStart(2, '0')}`, term: m.term, cn: m.cn, category: 'measurement', description: `单位: ${m.unit}` });
  });

  // 危急值
  CRITICAL_VALUES.forEach((c, i) => {
    terms.push({ id: `CV${(i + 1).toString().padStart(2, '0')}`, term: c.term, cn: c.cn, category: 'critical-value', description: `紧迫性: ${c.urgency}` });
  });

  // 技术
  TECHNIQUES.forEach((t, i) => {
    terms.push({ id: `T${(i + 1).toString().padStart(2, '0')}`, term: t.term, cn: t.cn, category: 'technique' });
  });

  // 派生变异（finding × variant 笛卡尔积）
  let nextId = 9000;
  for (const f of FINDINGS) {
    for (const v of VARIANTS) {
      const id = `FV${(nextId++).toString().padStart(4, '0')}`;
      const t = `${f.term}${v.suffix}`;
      const cn = `${v.cnPre}${f.cn}`;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ id, term: t, cn, category: f.category, description: `${f.cn}的${v.cnPre}类型` });
    }
  }

  // 测量 × 解剖（部位-测量组合）
  for (const m of MEASUREMENTS) {
    for (const o of ORGANS.slice(0, 40)) {
      const id = `MO${(nextId++).toString().padStart(4, '0')}`;
      const t = `${m.term}-of-${o.term}`;
      const cn = `${o.cn}${m.cn}`;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ id, term: t, cn, category: m.category, description: `${o.cn}的${m.cn}` });
    }
  }

  // 修饰 × 解剖（位置 + 器官）
  for (const m of MODIFIERS.slice(0, 20)) {
    for (const o of ORGANS.slice(0, 30)) {
      const id = `OM${(nextId++).toString().padStart(4, '0')}`;
      const t = `${m.term}-${o.term}`;
      const cn = `${m.cn}${o.cn}`;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ id, term: t, cn, category: 'modifier' });
    }
  }

  // 危急值 × 部位
  for (const c of CRITICAL_VALUES) {
    for (const o of ORGANS.slice(0, 25)) {
      const id = `CO${(nextId++).toString().padStart(4, '0')}`;
      const t = `${c.term}-${o.term}`;
      const cn = `${o.cn}${c.cn}`;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ id, term: t, cn, category: 'critical-value' });
    }
  }

  // 部位子结构（多级：region > organ > substructure）
  const SUBSTRUCTURES: Array<{ suffix: string; cnSuffix: string }> = [
    { suffix: 'lobe', cnSuffix: '叶' },
    { suffix: 'segment', cnSuffix: '段' },
    { suffix: 'hilum', cnSuffix: '门' },
    { suffix: 'pedicle', cnSuffix: '蒂' },
    { suffix: 'capsule', cnSuffix: '包膜' },
    { suffix: 'parenchyma', cnSuffix: '实质' },
    { suffix: 'stroma', cnSuffix: '间质' },
    { suffix: 'lumen', cnSuffix: '腔' },
    { suffix: 'wall', cnSuffix: '壁' },
    { suffix: 'medulla', cnSuffix: '髓质' },
    { suffix: 'cortex', cnSuffix: '皮质' },
    { suffix: 'pole', cnSuffix: '极' },
    { suffix: 'surface', cnSuffix: '面' },
    { suffix: 'margin', cnSuffix: '缘' },
    { suffix: 'root', cnSuffix: '根' },
    { suffix: 'apex', cnSuffix: '尖' },
    { suffix: 'base', cnSuffix: '底' },
    { suffix: 'body', cnSuffix: '体' },
  ];
  for (const o of ORGANS) {
    for (const s of SUBSTRUCTURES) {
      const id = `SS${(nextId++).toString().padStart(4, '0')}`;
      const t = `${o.term}-${s.suffix}`;
      const cn = `${o.cn}${s.cnSuffix}`;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ id, term: t, cn, category: 'anatomy-substructure' });
    }
  }

  // 复合征象
  const PATTERNS = [
    { term: 'target-sign', cn: '靶征' }, { term: 'halo-sign', cn: '晕征' },
    { term: 'reversed-halo', cn: '反晕征' }, { term: 'air-crescent', cn: '空气新月征' },
    { term: 'bulging-fissure', cn: '膨隆裂征' }, { term: 'feeding-vessel', cn: '供养血管征' },
    { term: 'meningeal-sign', cn: '脑膜尾征' }, { term: 'empty-delta', cn: '空三角征' },
    { term: 'dot-dash', cn: '虚线征' }, { term: 'tram-track', cn: '轨道征' },
    { term: 'beak-sign', cn: '鸟嘴征' }, { term: 'meniscus-sign', cn: '新月征' },
    { term: 'cobblestone', cn: '鹅卵石征' }, { term: 'finger-in-glove', cn: '指套征' },
    { term: 'pleural-tail', cn: '胸膜尾征' }, { term: 'split-pleura', cn: '裂胸征' },
  ];
  PATTERNS.forEach((p, i) => {
    terms.push({ id: `P${(i + 1).toString().padStart(3, '0')}`, term: p.term, cn: p.cn, category: 'finding-general' });
  });

  return terms;
}

// ============================================================
// 智能查询 / 补全
// ============================================================

export interface TermQuery {
  text?: string;
  category?: TermCategory | TermCategory[];
  limit?: number;
  offset?: number;
}

export interface TermResult extends Term {
  matchedCn: string;
  matchedTerm: string;
  score: number;
}

let _termsCache: Term[] | null = null;
export function getAllTerms(): Term[] {
  if (!_termsCache) _termsCache = generateTerms();
  return _termsCache;
}

export function searchTerms(q: TermQuery): TermResult[] {
  const all = getAllTerms();
  const text = q.text?.toLowerCase().trim() ?? '';
  const cat = q.category ? (Array.isArray(q.category) ? q.category : [q.category]) : null;
  let candidates: Term[] = all;
  if (cat) candidates = candidates.filter(t => cat.includes(t.category));
  const out: TermResult[] = [];
  for (const t of candidates) {
    if (!text) {
      out.push({ ...t, matchedCn: t.cn, matchedTerm: t.term, score: 0 });
      continue;
    }
    const cnLower = t.cn.toLowerCase();
    const termLower = t.term.toLowerCase();
    let score = 0;
    let matchedCn = t.cn;
    let matchedTerm = t.term;
    if (cnLower.startsWith(text)) { score = 100; matchedCn = t.cn; }
    else if (cnLower.includes(text)) { score = 80; }
    if (termLower.startsWith(text)) { score = Math.max(score, 90); matchedTerm = t.term; }
    else if (termLower.includes(text)) { score = Math.max(score, 70); }
    // 拼音前缀（简化：取首字母）
    const pinyinInitials = getPinyinInitials(t.cn);
    if (pinyinInitials.toLowerCase().startsWith(text)) {
      score = Math.max(score, 85);
    }
    // 同义词
    if (t.synonyms?.some(s => s.toLowerCase().includes(text))) {
      score = Math.max(score, 60);
    }
    if (score > 0) {
      out.push({ ...t, matchedCn, matchedTerm, score });
    }
  }
  out.sort((a, b) => b.score - a.score || a.cn.localeCompare(b.cn));
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 20;
  return out.slice(offset, offset + limit);
}

// 简化版拼音首字母（仅 ASCII 字符对照，不做完整汉字转拼音）
function getPinyinInitials(cn: string): string {
  // 简化：用 cn.charCodeAt(0) % 26 模拟首字母分布（演示）
  // 真实实现应集成 pinyin-pro
  let result = '';
  for (let i = 0; i < cn.length; i++) {
    const c = cn.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) {
      // CJK - map to letter
      result += String.fromCharCode('a'.charCodeAt(0) + (c % 26));
    } else {
      result += cn[i]!;
    }
  }
  return result;
}

export function getTermById(id: string): Term | undefined {
  return getAllTerms().find(t => t.id === id);
}

export function getTermsByCategory(cat: TermCategory): Term[] {
  return getAllTerms().filter(t => t.category === cat);
}

export function suggestAutocomplete(prefix: string, limit = 10): Term[] {
  if (!prefix || prefix.length < 1) return [];
  return searchTerms({ text: prefix, limit });
}
