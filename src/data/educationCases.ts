// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 教学病例库
// 20 个教学病例（供 TeachingExamModal / 典型病例）
// ============================================================

export type TeachingCategory =
  | '胸部' | '腹部' | '神经系统' | '骨关节' | '乳腺' | '心血管' | '头颈部';

export interface TeachingCase {
  id: string;
  title: string;
  modality: string;
  category: TeachingCategory;
  /** 病史/临床表现 */
  presentation: string;
  /** 影像所见 */
  findings: string;
  /** 诊断 */
  diagnosis: string;
  /** 解析要点 */
  discussion: string;
  /** 4 个考试选项 */
  options: string[];
  /** 正确答案索引（0-3） */
  correctIndex: number;
  /** 难度 */
  difficulty: '基础' | '进阶' | '疑难';
}

export const EDUCATION_CASES: TeachingCase[] = [
  {
    id: 'EC-001',
    title: '右肺上叶分叶状肿块伴毛刺',
    modality: 'CT',
    category: '胸部',
    presentation: '62岁男性，吸烟40年，咳嗽痰中带血2月，体重下降5kg。胸部CT示右肺上叶肿块。',
    findings: '右肺上叶见约35mm×28mm分叶状实性肿块，边缘见毛刺征，邻近胸膜牵拉凹陷，纵隔窗见肿块内偏心性空洞。',
    diagnosis: '右肺上叶周围型肺癌（肺腺癌可能性大）',
    discussion: '分叶征+毛刺征+胸膜牵拉为周围型肺癌典型三联征；偏心性厚壁空洞支持恶性。需分期评估（PET-CT/头颅MRI）并行活检。',
    options: ['肺结核', '肺脓肿', '周围型肺癌', '良性错构瘤'],
    correctIndex: 2,
    difficulty: '基础',
  },
  {
    id: 'EC-002',
    title: '双肺弥漫性磨玻璃影伴铺路石征',
    modality: 'CT',
    category: '胸部',
    presentation: '45岁男性，进行性呼吸困难3月，干咳，无发热。既往无粉尘接触史。',
    findings: '双肺弥漫性磨玻璃样密度增高影，其内见增厚小叶间隔呈铺路石样改变（crazy-paving），以双下肺为著，未见实变及胸腔积液。',
    diagnosis: '肺泡蛋白沉积症（PAP）',
    discussion: '铺路石征（磨玻璃+小叶间隔增厚）为PAP特征表现；鉴别诊断包括肺孢子菌肺炎、粘液性腺癌（后者有实性成分）。确诊靠支气管肺泡灌洗（牛奶样液体）。',
    options: ['肺泡蛋白沉积症', '肺水肿', '卡氏肺孢子菌肺炎', '肺间质纤维化'],
    correctIndex: 0,
    difficulty: '进阶',
  },
  {
    id: 'EC-003',
    title: '青年男性自发性气胸',
    modality: 'DR',
    category: '胸部',
    presentation: '20岁瘦高体型男性，突发右侧胸痛伴气促2小时。',
    findings: '右胸野外带透亮度增高，无肺纹理，可见肺压缩边缘线；右肺压缩约50%，纵隔轻度左移。',
    diagnosis: '右侧自发性气胸（肺压缩约50%）',
    discussion: '瘦高青年自发性气胸常见于肺大疱破裂；压缩>30%伴症状需胸腔闭式引流；复发者评估肺大疱手术。',
    options: ['右侧胸腔积液', '右侧气胸', '肺不张', '膈疝'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-004',
    title: '急性胸痛——胸主动脉夹层',
    modality: 'CT',
    category: '心血管',
    presentation: '55岁高血压男性，突发撕裂样胸痛向后背放射，血压左右上肢不对称（R 170/95, L 120/70mmHg）。',
    findings: '增强CTA示升主动脉内膜片自主动脉根部延伸至腹主动脉，真腔受压变窄，假腔扩张伴血栓形成，心包积液。',
    diagnosis: 'Stanford A型主动脉夹层（累及升主动脉）',
    discussion: 'A型夹层累及升主动脉需急诊外科手术；B型可内科（控制血压+胸腹主动脉腔内修复）。本病例关键：累及升主动脉即A型。',
    options: ['Stanford B型夹层', 'Stanford A型夹层', '主动脉瘤', '肺栓塞'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-005',
    title: '咯血待查——肺曲霉球',
    modality: 'CT',
    category: '胸部',
    presentation: '50岁肺结核病史10年，近1月反复咯血。',
    findings: '右上肺陈旧性结核空洞，洞内见球形软组织影（曲霉球），球体与洞壁间见新月形气体影（空气新月征），卧位与俯卧位复查球体位置移动。',
    diagnosis: '肺曲霉球（曲菌瘤）',
    discussion: '空气新月征+球体可移动（浮球征）为曲霉球特征；继发于既往空洞性疾病（结核、支气管扩张）；反复大咯血者考虑手术或介入栓塞。',
    options: ['肺癌伴空洞', '肺曲霉球', '肺脓肿', '肺隔离症'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-006',
    title: '肝占位——快进快出',
    modality: 'CT',
    category: '腹部',
    presentation: '60岁男性，乙肝肝硬化10年，超声发现肝右叶占位，AFP 500ng/mL。',
    findings: '肝右叶约40mm低密度占位，动脉期明显不均匀强化，门脉期及延迟期强化减退（廓清），可见假包膜，门静脉右支未见明确癌栓。',
    diagnosis: '肝细胞癌（HCC，LI-RADS 5）',
    discussion: '肝硬化背景+动脉期强化+廓清+假包膜符合HCC典型表现（LI-RADS 5可临床确诊）；治疗按BCLC分期（本例早期可消融或切除）。',
    options: ['肝血管瘤', '肝细胞癌', '肝转移瘤', '肝脓肿'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-007',
    title: '肝占位——向心性填充',
    modality: 'MR',
    category: '腹部',
    presentation: '38岁女性，健康体检超声发现肝左叶占位，无肝病史，肿瘤标志物阴性。',
    findings: '肝左叶约28mm类圆形占位，T2明显高信号（亮于脾），T1低信号；增强动脉期边缘结节样强化，门脉期及延迟期向心性填充，延迟5分钟病灶完全均匀强化。',
    diagnosis: '肝血管瘤',
    discussion: '"边缘结节样强化+向心性填充"为血管瘤特征性强化模式；T2亮于脾脏是重要鉴别点；无需治疗，定期随访。',
    options: ['肝细胞癌', '肝血管瘤', '局灶性结节增生', '肝囊肿'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-008',
    title: '急性腹痛——肠梗阻',
    modality: 'CT',
    category: '腹部',
    presentation: '70岁女性，腹痛腹胀伴停止排气排便2天，腹部可见肠型。',
    findings: '小肠多发扩张肠管（最宽约45mm），肠壁变薄，可见阶梯状气液平面；结肠未见明显扩张；回盲部见粪石样致密影，局部肠管呈鸟嘴样狭窄。',
    diagnosis: '小肠机械性梗阻（回肠粪石嵌顿所致）',
    discussion: '小肠扩张>30mm+气液平面为梗阻证据；结肠不扩张提示小肠梗阻；"鸟嘴征"为梗阻点；粪石嵌顿为老年患者常见病因，先保守治疗无效再手术。',
    options: ['结肠癌所致梗阻', '肠麻痹', '小肠梗阻（粪石嵌顿）', '肠套叠'],
    correctIndex: 2,
    difficulty: '进阶',
  },
  {
    id: 'EC-009',
    title: '突发剧烈头痛——蛛网膜下腔出血',
    modality: 'CT',
    category: '神经系统',
    presentation: '48岁女性，突发雷击样头痛1小时，伴呕吐、颈项强直。',
    findings: 'CT平扫示大脑纵裂池、双侧外侧裂池、鞍上池及环池弥漫性高密度影（CT值约55-70HU），脑室系统未见明显出血，脑实质未见血肿。',
    diagnosis: '蛛网膜下腔出血（动脉瘤破裂可能）',
    discussion: '急性SAH首选CT平扫，发病6小时内敏感度近100%；主要病因为颅内动脉瘤破裂（约80%），须急诊CTA排查动脉瘤，阳性者尽早介入或开颅夹闭。',
    options: ['高血压脑出血', '蛛网膜下腔出血', '硬膜下血肿', '脑肿瘤出血'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-010',
    title: '急性卒中——超急性期脑梗死',
    modality: 'MR',
    category: '神经系统',
    presentation: '65岁男性，突发右侧肢体无力伴言语不清2小时。NIHSS 12分。',
    findings: 'MRI DWI示左侧大脑中动脉供血区（基底节+皮质下白质）大范围明显高信号，ADC低信号；T2WI/FLAIR该区域信号尚未明显升高（DWI-FLAIR错配）；左侧MCA M1段MRA未见显影。',
    diagnosis: '左侧大脑中动脉闭塞致超急性期大面积脑梗死（DWI-FLAIR错配，提示发病<4.5h）',
    discussion: 'DWI（细胞毒性水肿）最早阳性；DWI-FLAIR错配提示发病时间<4.5小时，符合静脉溶栓窗口；大血管闭塞可评估血管内取栓。',
    options: ['脑出血', '超急性期脑梗死（MCA闭塞）', '脑肿瘤', '脑脓肿'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-011',
    title: '腰痛伴下肢放射痛',
    modality: 'MR',
    category: '骨关节',
    presentation: '42岁男性，腰痛3月，向左下肢放射痛伴麻木1月，咳嗽时加重，直腿抬高试验阳性。',
    findings: 'L4/5椎间盘向后方突出，硬膜囊前缘受压，左侧L5神经根受压移位；L5/S1椎间盘膨出。矢状位T2示L4/5椎间盘信号减低。',
    diagnosis: 'L4/5椎间盘突出压迫左侧L5神经根',
    discussion: '椎间盘突出的影像学表现：矢状位"突出"信号+神经根受压；与椎间盘膨出鉴别（突出为局灶性，膨出为环形）。先保守治疗6周，无效或神经功能障碍加重者手术。',
    options: ['腰椎骨折', 'L4/5椎间盘突出', '椎管内肿瘤', '腰椎结核'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-012',
    title: '膝关节扭伤后疼痛',
    modality: 'MR',
    category: '骨关节',
    presentation: '28岁男性，篮球运动中扭伤左膝，即刻疼痛肿胀，不能完全伸直，关节不稳定感。',
    findings: '矢状位示前交叉韧带（ACL）中断，残端水肿高信号；股骨外侧髁及胫骨后外侧骨髓水肿；外侧半月板后角见线样高信号达关节面；内侧半月板信号正常。',
    diagnosis: '前交叉韧带完全撕裂，伴外侧半月板后角撕裂及骨挫伤（Segond骨折未明确）',
    discussion: 'ACL撕裂常合并外侧半月板及外侧骨挫伤（撞击机制）；"髁间窝切迹骨折/撕脱"为间接征象；年轻患者ACL重建可考虑，需关节镜评估半月板。',
    options: ['内侧半月板桶柄状撕裂', 'ACL完全撕裂', '髌骨脱位', '后交叉韧带撕裂'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-013',
    title: '髋部疼痛——股骨头坏死',
    modality: 'MR',
    category: '骨关节',
    presentation: '45岁男性，长期大剂量糖皮质激素应用史，双髋疼痛2月，行走加重。',
    findings: '双侧股骨头前上部见地图样T1低信号、T2压脂高信号（骨髓水肿），T1内见"双线征"（内高外低信号条带）；右侧股骨头形态轻度塌陷。',
    diagnosis: '双侧股骨头缺血性坏死（右侧ARCO III期，左侧II期）',
    discussion: 'MR是股骨头坏死最敏感检查；"双线征"为特征；早期（未塌陷）可行髓芯减压/植骨，已塌陷需关节置换；激素为常见病因。',
    options: ['股骨颈骨折', '股骨头缺血性坏死', '化脓性髋关节炎', '髋关节骨关节炎'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-014',
    title: '青年男性膝关节夜间痛',
    modality: 'DR',
    category: '骨关节',
    presentation: '17岁男性，左膝关节上方疼痛伴夜间痛3月，局部肿胀、皮温高，无明显外伤史。',
    findings: 'X线示左股骨远端干骺端溶骨性破坏，骨皮质破坏，骨膜反应呈日光放射状（sunburst），软组织肿块形成，内见骨样基质钙化。',
    diagnosis: '骨肉瘤（股骨远端）',
    discussion: '"日光放射样骨膜反应"+溶骨破坏+软组织肿块为骨肉瘤特征；好发于青少年长骨干骺端；确诊需活检，术前新辅助化疗后手术。',
    options: ['尤文肉瘤', '骨肉瘤', '慢性骨髓炎', '骨巨细胞瘤'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-015',
    title: '乳腺筛查异常',
    modality: 'MG',
    category: '乳腺',
    presentation: '55岁女性，年度乳腺钼靶筛查，左乳MLO位发现簇状微小钙化。',
    findings: '左乳外上象限见成簇分布的多形性微小钙化（约8mm范围），形态细小线样分支状，未见明确肿块；右乳未见异常。',
    diagnosis: '左乳导管原位癌（DCIS）可能（BI-RADS 4B）',
    discussion: '细线样分支状钙化沿导管分布为DCIS典型表现；需放大投照明确钙化形态，穿刺活检（钼靶引导）确诊；DCIS为浸润性癌前病变，治疗为保乳+放疗或全切。',
    options: ['乳腺纤维腺瘤', '导管原位癌（DCIS）', '乳腺囊肿', '乳腺淋巴结钙化'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-016',
    title: '甲状腺结节评估',
    modality: 'US',
    category: '头颈部',
    presentation: '40岁女性，触及颈部肿物来诊，无压痛，无甲功异常。超声示右叶结节。',
    findings: '甲状腺右叶见约18mm×15mm实性低回声结节，形态高大于宽（非平行生长），边缘不规则，内见多发点状强回声（微钙化）；左叶及峡部未见异常，颈部未见肿大淋巴结。',
    diagnosis: '甲状腺右叶可疑恶性结节（TI-RADS TR5）',
    discussion: '低回声+高大于宽+不规则边缘+微钙化=TR5（≥7分）；按ACR指南TR5且≥1cm建议FNA；甲状腺乳头状癌为最常见病理类型，预后良好。',
    options: ['结节性甲状腺肿', '甲状腺腺瘤', '甲状腺癌（乳头状癌可能）', '亚急性甲状腺炎'],
    correctIndex: 2,
    difficulty: '基础',
  },
  {
    id: 'EC-017',
    title: '前列腺特异性抗原升高',
    modality: 'MR',
    category: '腹部',
    presentation: '68岁男性，PSA 12.5ng/mL，直肠指诊可疑结节，首次前列腺穿刺阴性，临床怀疑csPCa。',
    findings: 'mpMRI（3T）：外周带右后侧见约12mm结节，DWI明显低信号（高b值），ADC明显低信号；T2WI局灶低信号；DCE示早期强化（早于周围正常实质）。',
    diagnosis: '外周带结节，PI-RADS 4（高度可疑临床显著性前列腺癌）',
    discussion: 'DWI为主导序列：明显低信号灶+ADC低值+PZ≤1.5cm=4分；建议MRI/超声融合靶向穿刺；csPCa定义为Gleason≥7，治疗前需分期。',
    options: ['PI-RADS 2（低概率）', 'PI-RADS 3', 'PI-RADS 4', 'PI-RADS 5'],
    correctIndex: 2,
    difficulty: '进阶',
  },
  {
    id: 'EC-018',
    title: '气促伴心悸——肺栓塞',
    modality: 'CT',
    category: '心血管',
    presentation: '50岁女性，右下肢肿胀1周，突发胸痛气促伴晕厥1次，D-二聚体 5.2mg/L。',
    findings: 'CTPA示双侧主肺动脉及叶段动脉多发充盈缺损（中心性充盈缺损、骑跨于肺动脉分叉处）；右心室增大（RV/LV>1）；右下肢超声示腘静脉血栓。',
    diagnosis: '急性双侧肺栓塞（累及中央肺动脉，伴右心功能不全）',
    discussion: '肺动脉充盈缺损为直接征象；RV/LV>1提示右心功能障碍（高危PE），结合血流动力学不稳定考虑溶栓；抗凝治疗为基础。',
    options: ['肺动脉高压（原发性）', '急性肺栓塞', '主动脉夹层', '肺炎'],
    correctIndex: 1,
    difficulty: '基础',
  },
  {
    id: 'EC-019',
    title: '上腹疼痛伴黄疸',
    modality: 'CT',
    category: '腹部',
    presentation: '65岁女性，进行性黄疸1月，皮肤瘙痒，陶土样便，体重下降。CA19-9 860U/mL。',
    findings: '胰头区见约30mm乏血供肿块，边界不清；胆总管及胰管扩张呈"双管征"；胰腺周围脂肪间隙模糊，肠系膜上静脉受压变形。',
    diagnosis: '胰头癌（伴胆道梗阻及血管侵犯可能）',
    discussion: '"双管征"（胆总管+胰管扩张）为胰头占位特征；胰腺癌典型为乏血供肿块；血管侵犯（SMA/SMV）决定可切除性，需血管重建评估。',
    options: ['胰腺神经内分泌肿瘤', '胰头癌', '慢性胰腺炎', '胆总管结石'],
    correctIndex: 1,
    difficulty: '进阶',
  },
  {
    id: 'EC-020',
    title: '头痛伴视物模糊——颅内占位',
    modality: 'MR',
    category: '神经系统',
    presentation: '52岁女性，渐进性头痛2月，视物模糊，伴恶心。眼底检查见视乳头水肿。',
    findings: '右侧额叶凸面见约45mm类圆形占位，T1等信号、T2等/稍高信号，信号均匀；增强后明显均匀强化，邻近脑膜"硬膜尾征"；周围水肿不明显，中线轻度左移。',
    diagnosis: '右侧额叶脑膜瘤（WHO I级）',
    discussion: '"均匀强化+硬膜尾征+脑外占位"为脑膜瘤三联征；脑外征象：灰白质移位、脑脊液裂隙；多为良性，手术全切预后良好。',
    options: ['胶质母细胞瘤', '脑膜瘤', '转移瘤', '脑脓肿'],
    correctIndex: 1,
    difficulty: '基础',
  },
];

// ============================================================
// 导出与工具函数
// ============================================================

/** 按类别获取教学病例 */
export function getCasesByCategory(category: TeachingCategory): TeachingCase[] {
  return EDUCATION_CASES.filter((c) => c.category === category);
}

/** 按难度筛选 */
export function getCasesByDifficulty(difficulty: TeachingCase['difficulty']): TeachingCase[] {
  return EDUCATION_CASES.filter((c) => c.difficulty === difficulty);
}

/** 检索病例（标题/诊断/关键词） */
export function searchCases(query: string): TeachingCase[] {
  const q = query.trim().toLowerCase();
  if (!q) return EDUCATION_CASES;
  return EDUCATION_CASES.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.diagnosis.toLowerCase().includes(q) ||
      c.modality.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}

/** 随机抽取 n 个病例（用于考试出题） */
export function randomCases(n: number, excludeIds: string[] = []): TeachingCase[] {
  const pool = EDUCATION_CASES.filter((c) => !excludeIds.includes(c.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/** 判断答案是否正确 */
export function checkAnswer(caseId: string, selectedIndex: number): boolean {
  const c = EDUCATION_CASES.find((x) => x.id === caseId);
  return c ? c.correctIndex === selectedIndex : false;
}

export const EDUCATION_LIBRARY = {
  cases: EDUCATION_CASES,
  categories: ['胸部', '腹部', '神经系统', '骨关节', '乳腺', '心血管', '头颈部'] as TeachingCategory[],
  totalCases: EDUCATION_CASES.length,
};
