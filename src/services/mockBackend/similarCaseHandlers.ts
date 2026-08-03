// [v3.0.6.11-60] 相似病例检索 MSW handlers (对标 Siemens Similar Patient Search)
// 确定性算法: 关键词/Jaccard 文本相似 + 检查特征匹配 + SNOMED 编码匹配
// 综合评分 = 0.5×文本 + 0.3×特征 + 0.2×SNOMED
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/similar-case';

const KEYWORD_DICT: ReadonlyArray<readonly [string, string]> = [
  ['结节', 'nodule'], ['钙化', 'calcification'], ['骨折', 'fracture'],
  ['梗死', 'infarct'], ['占位', 'mass'], ['肿块', 'mass'], ['肿瘤', 'tumor'],
  ['癌', 'cancer'], ['转移', 'metastasis'], ['出血', 'hemorrhage'],
  ['血肿', 'hematoma'], ['积液', 'effusion'], ['胸腔积液', 'pleural effusion'],
  ['腹水', 'ascites'], ['肺炎', 'pneumonia'], ['感染', 'infection'],
  ['炎症', 'inflammation'], ['增生', 'hyperplasia'], ['囊肿', 'cyst'],
  ['空洞', 'cavity'], ['肺气肿', 'emphysema'], ['纤维化', 'fibrosis'],
  ['磨玻璃', 'ground-glass'], ['浸润', 'infiltrate'], ['栓塞', 'embolism'],
  ['动脉瘤', 'aneurysm'], ['夹层', 'dissection'], ['狭窄', 'stenosis'],
  ['硬化', 'sclerosis'], ['水肿', 'edema'], ['缺血', 'ischemia'],
  ['脑萎缩', 'atrophy'], ['椎间盘突出', 'herniation'], ['椎管狭窄', 'spinal stenosis'],
  ['半月板撕裂', 'meniscus tear'], ['韧带损伤', 'ligament injury'],
  ['关节积液', 'joint effusion'], ['骨质疏松', 'osteoporosis'],
  ['结石', 'calculus'], ['肾积水', 'hydronephrosis'], ['胆结石', 'cholelithiasis'],
  ['子宫肌瘤', 'fibroid'], ['前列腺增生', 'prostatic hyperplasia'],
  ['淋巴结肿大', 'lymphadenopathy'], ['斑块', 'plaque'], ['肝硬化', 'cirrhosis'],
  ['脂肪肝', 'steatosis'], ['占位病变', 'space-occupying lesion'],
  ['胰腺炎', 'pancreatitis'], ['阑尾炎', 'appendicitis'], ['肠梗阻', 'bowel obstruction'],
  ['气胸', 'pneumothorax'], ['纵隔', 'mediastinal'], ['脑膜瘤', 'meningioma'],
  ['胶质瘤', 'glioma'], ['垂体瘤', 'pituitary adenoma'], ['听神经瘤', 'acoustic neuroma'],
  ['鼻窦炎', 'sinusitis'], ['中耳炎', 'otitis media'], ['白内障', 'cataract'],
  ['视网膜', 'retinal'], ['玻璃体', 'vitreous'], ['主动脉', 'aorta'],
  ['冠状动脉', 'coronary artery'], ['肾囊肿', 'renal cyst'],
  ['甲状腺结节', 'thyroid nodule'], ['乳腺结节', 'breast nodule'],
  ['肝占位', 'hepatic mass'], ['脑出血', 'cerebral hemorrhage'],
  ['骨转移', 'bone metastasis'], ['肺结节', 'pulmonary nodule'],
  ['肾结石', 'renal calculus'], ['输尿管结石', 'ureteral calculus'],
  ['胆囊结石', 'gallstone'], ['胆总管结石', 'choledocholithiasis'],
  ['炎性假瘤', 'inflammatory pseudotumor'], ['错构瘤', 'hamartoma'],
  ['血管瘤', 'hemangioma'], ['息肉', 'polyp'], ['溃疡', 'ulcer'],
  ['穿孔', 'perforation'], ['瘘', 'fistula'], ['脓肿', 'abscess'],
  ['囊性变', 'cystic degeneration'], ['强化', 'enhancement'],
  ['低密度', 'hypodensity'], ['高密度', 'hyperdensity'],
];

interface SeedCase {
  id: string;
  reportId: string;
  patientId: string;
  gender: string;
  age: number;
  modality: string;
  bodyPart: string;
  studyDate: string;
  findings: string;
  impression: string;
  conclusion: string;
  snomedCodes: string[];
  source: 'demo';
}

const SEED_CASES: SeedCase[] = [
  {
    id: 'sc-demo-001', reportId: 'rpt-1001', patientId: 'P1001', gender: '女', age: 58,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-06-12',
    findings: '右肺上叶尖段见一不规则形软组织密度结节,大小约 18mm×15mm,边缘毛糙,可见分叶及短毛刺征,CT 值约 32HU。双肺纹理清晰,未见磨玻璃影。纵隔内未见肿大淋巴结。',
    impression: '右肺上叶占位性病变,考虑周围型肺癌可能,建议增强扫描及穿刺活检。',
    conclusion: '右肺上叶占位性病变 (肺癌待排)',
    snomedCodes: ['SNOMED:79678001'], source: 'demo',
  },
  {
    id: 'sc-demo-002', reportId: 'rpt-1002', patientId: 'P1002', gender: '女', age: 62,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-05-28',
    findings: '右肺上叶磨玻璃密度结节,大小约 8mm×6mm,边界清晰,内可见血管穿行。双肺散在钙化灶。',
    impression: '右肺上叶磨玻璃结节 (GGO),考虑早期肺腺癌可能,建议定期随访或手术切除。',
    conclusion: '右肺上叶磨玻璃结节 (早期肺癌待排)',
    snomedCodes: ['SNOMED:424132000'], source: 'demo',
  },
  {
    id: 'sc-demo-003', reportId: 'rpt-1003', patientId: 'P1003', gender: '男', age: 45,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-04-19',
    findings: '右肺下叶见圆形低密度影,壁薄光滑,大小约 25mm×22mm,内无分隔。双肺纹理增粗,右上肺见条索状高密度影。',
    impression: '右肺下叶肺大疱;右上肺陈旧性纤维化条索影。',
    conclusion: '肺大疱 (良性)',
    snomedCodes: ['SNOMED:361182007'], source: 'demo',
  },
  {
    id: 'sc-demo-004', reportId: 'rpt-1004', patientId: 'P1004', gender: '男', age: 71,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-03-02',
    findings: '右肺上叶纵隔旁见类圆形软组织肿块,大小约 4.5cm×3.8cm,边缘光整,增强后轻度强化。胸廓入口处气管轻度受压。',
    impression: '纵隔占位性病变,考虑胸腺瘤可能,建议手术切除并病理检查。',
    conclusion: '纵隔占位 (胸腺瘤可能)',
    snomedCodes: ['SNOMED:415550006'], source: 'demo',
  },
  {
    id: 'sc-demo-005', reportId: 'rpt-1005', patientId: 'P1005', gender: '女', age: 33,
    modality: 'DX', bodyPart: '胸部', studyDate: '2026-05-10',
    findings: '双肺纹理增多,右下肺野见片状高密度影,边缘模糊,肋膈角变钝。心影大小正常。',
    impression: '右下肺炎症,右侧少量胸腔积液,建议抗感染治疗后复查。',
    conclusion: '右下肺炎症伴少量胸腔积液',
    snomedCodes: ['SNOMED:233604007'], source: 'demo',
  },
  {
    id: 'sc-demo-006', reportId: 'rpt-1006', patientId: 'P1006', gender: '男', age: 29,
    modality: 'DX', bodyPart: '胸部', studyDate: '2026-06-01',
    findings: '右肺野外带见条状无肺纹理透亮区,肺组织压缩约 30%,右侧肋膈角变钝。',
    impression: '右侧自发性气胸 (压缩约 30%),建议胸腔闭式引流。',
    conclusion: '右侧自发性气胸',
    snomedCodes: ['SNOMED:361181000'], source: 'demo',
  },
  {
    id: 'sc-demo-007', reportId: 'rpt-1007', patientId: 'P1007', gender: '女', age: 50,
    modality: 'CT', bodyPart: '颅脑', studyDate: '2026-04-25',
    findings: '左侧基底节区见低密度梗死灶,大小约 2.5cm×2.0cm,边界清楚。双侧侧脑室对称,中线结构居中。',
    impression: '左侧基底节区腔隙性脑梗死,建议控制血压及抗血小板治疗。',
    conclusion: '左侧基底节区脑梗死',
    snomedCodes: ['SNOMED:230690007'], source: 'demo',
  },
  {
    id: 'sc-demo-008', reportId: 'rpt-1008', patientId: 'P1008', gender: '男', age: 67,
    modality: 'CT', bodyPart: '颅脑', studyDate: '2026-05-16',
    findings: '右侧丘脑及基底节区见大片高密度影,大小约 5cm×4cm,周围可见低密度水肿带,侧脑室受压变窄,中线结构左移约 8mm。',
    impression: '右侧基底节区脑出血 (血肿形成),伴脑水肿及占位效应,建议神经外科会诊。',
    conclusion: '右侧基底节区脑出血',
    snomedCodes: ['SNOMED:274100004'], source: 'demo',
  },
  {
    id: 'sc-demo-009', reportId: 'rpt-1009', patientId: 'P1009', gender: '女', age: 55,
    modality: 'MR', bodyPart: '颅脑', studyDate: '2026-03-30',
    findings: '右额叶见类圆形囊实性占位,大小约 3.2cm×2.8cm,T1WI 低信号,T2WI 高信号,增强后实性部分明显强化,周围可见轻度水肿。',
    impression: '右额叶占位性病变,考虑胶质瘤可能,建议手术活检明确病理。',
    conclusion: '右额叶占位 (胶质瘤可能)',
    snomedCodes: ['SNOMED:115655009'], source: 'demo',
  },
  {
    id: 'sc-demo-010', reportId: 'rpt-1010', patientId: 'P1010', gender: '男', age: 48,
    modality: 'CT', bodyPart: '腹部', studyDate: '2026-04-08',
    findings: '肝右叶见类圆形低密度占位,大小约 6cm×5cm,边界不清,增强后动脉期明显强化,门脉期及延迟期强化减退 (快进快出)。',
    impression: '肝右叶占位性病变,考虑肝细胞癌可能,建议进一步 AFP 检测及增强 MRI。',
    conclusion: '肝右叶占位 (肝细胞癌可能)',
    snomedCodes: ['SNOMED:93870000'], source: 'demo',
  },
  {
    id: 'sc-demo-011', reportId: 'rpt-1011', patientId: 'P1011', gender: '男', age: 52,
    modality: 'CT', bodyPart: '腹部', studyDate: '2026-05-22',
    findings: '胆囊内见多发圆形高密度影,最大约 1.2cm,壁不厚,胆总管未见扩张。肝实质密度均匀。',
    impression: '胆囊结石 (多发),建议随访观察,如反复发作可行胆囊切除术。',
    conclusion: '胆囊结石 (多发)',
    snomedCodes: ['SNOMED:51027005'], source: 'demo',
  },
  {
    id: 'sc-demo-012', reportId: 'rpt-1012', patientId: 'P1012', gender: '女', age: 38,
    modality: 'DX', bodyPart: '腹部', studyDate: '2026-06-09',
    findings: '左侧输尿管中段见约 0.9cm 高密度结石影,其上输尿管扩张,左肾盂积水。右肾区未见结石。',
    impression: '左输尿管结石伴左肾积水,建议碎石治疗。',
    conclusion: '左侧输尿管结石伴肾积水',
    snomedCodes: ['SNOMED:95570007'], source: 'demo',
  },
  {
    id: 'sc-demo-013', reportId: 'rpt-1013', patientId: 'P1013', gender: '男', age: 60,
    modality: 'CT', bodyPart: '脊柱', studyDate: '2026-03-15',
    findings: '腰4/5椎间盘向后突出,硬膜囊受压,腰5/骶1椎间盘膨出,相应椎管狭窄。腰2椎体前缘见骨赘形成。',
    impression: '腰椎间盘突出伴椎管狭窄,建议保守治疗,如症状加重可考虑手术。',
    conclusion: '腰4/5椎间盘突出,腰椎管狭窄',
    snomedCodes: ['SNOMED:23077000'], source: 'demo',
  },
  {
    id: 'sc-demo-014', reportId: 'rpt-1014', patientId: 'P1014', gender: '男', age: 35,
    modality: 'MR', bodyPart: '膝关节', studyDate: '2026-05-03',
    findings: '右膝内侧半月板后角见线状高信号影,达关节面,呈桶柄状撕裂。前交叉韧带信号未见异常,关节腔内可见少量积液。',
    impression: '右膝内侧半月板桶柄状撕裂伴少量关节积液,建议关节镜治疗。',
    conclusion: '右膝内侧半月板撕裂',
    snomedCodes: ['SNOMED:294596001'], source: 'demo',
  },
  {
    id: 'sc-demo-015', reportId: 'rpt-1015', patientId: 'P1015', gender: '女', age: 63,
    modality: 'DX', bodyPart: '上肢', studyDate: '2026-04-11',
    findings: '右桡骨远端见骨质连续性中断,断端轻度移位,未见明显粉碎。余诸骨未见明确骨折征象。',
    impression: '右桡骨远端骨折 (Colles 骨折),建议石膏固定后复查。',
    conclusion: '右桡骨远端骨折',
    snomedCodes: ['SNOMED:125605004'], source: 'demo',
  },
  {
    id: 'sc-demo-016', reportId: 'rpt-1016', patientId: 'P1016', gender: '女', age: 68,
    modality: 'DX', bodyPart: '脊柱', studyDate: '2026-05-30',
    findings: '胸12椎体呈楔形变扁,骨密度普遍减低,多个椎体边缘见骨赘形成。',
    impression: '胸12椎体压缩性骨折 (骨质疏松性),建议卧床休息及抗骨质疏松治疗。',
    conclusion: '胸12椎体压缩性骨折 (骨质疏松)',
    snomedCodes: ['SNOMED:64840009'], source: 'demo',
  },
  {
    id: 'sc-demo-017', reportId: 'rpt-1017', patientId: 'P1017', gender: '女', age: 47,
    modality: 'MG', bodyPart: '乳腺', studyDate: '2026-04-02',
    findings: '右乳外上象限见一高密度结节影,大小约 1.5cm×1.2cm,边界欠清,可见细小钙化灶。左乳未见明确肿块。',
    impression: '右乳占位性病变伴钙化 (BI-RADS 4B),建议穿刺活检。',
    conclusion: '右乳腺结节 (BI-RADS 4B,需活检)',
    snomedCodes: ['SNOMED:254837009'], source: 'demo',
  },
  {
    id: 'sc-demo-018', reportId: 'rpt-1018', patientId: 'P1018', gender: '男', age: 56,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-03-20',
    findings: '主动脉弓降部内膜撕裂,真假双腔,真腔受压变窄,假腔累及至降主动脉中段,左侧胸腔见少量积液。',
    impression: 'Stanford B 型主动脉夹层,建议急诊介入腔内修复术。',
    conclusion: '主动脉夹层 (Stanford B 型)',
    snomedCodes: ['SNOMED:52767005'], source: 'demo',
  },
  {
    id: 'sc-demo-019', reportId: 'rpt-1019', patientId: 'P1019', gender: '男', age: 54,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-05-07',
    findings: '左前降支近段见混合性斑块,管腔狭窄约 50%;右冠状动脉中段见钙化性斑块,管腔狭窄约 30%。',
    impression: '冠状动脉粥样硬化伴多支斑块形成,建议控制危险因素并药物干预。',
    conclusion: '冠状动脉粥样硬化斑块',
    snomedCodes: ['SNOMED:53741008'], source: 'demo',
  },
  {
    id: 'sc-demo-020', reportId: 'rpt-1020', patientId: 'P1020', gender: '男', age: 26,
    modality: 'US', bodyPart: '腹部', studyDate: '2026-04-15',
    findings: '右下腹见一扩张的阑尾,直径约 11mm,壁增厚水肿,周围见少量积液,可见粪石影。',
    impression: '急性阑尾炎伴周围炎性渗出,建议手术治疗。',
    conclusion: '急性阑尾炎',
    snomedCodes: ['SNOMED:74400008'], source: 'demo',
  },
  {
    id: 'sc-demo-021', reportId: 'rpt-1021', patientId: 'P1021', gender: '女', age: 42,
    modality: 'US', bodyPart: '甲状腺', studyDate: '2026-06-06',
    findings: '甲状腺右叶见低回声结节,大小约 1.2cm×0.9cm,边界尚清,内见多发细小强回声 (微钙化),TI-RADS 4A 类。',
    impression: '甲状腺右叶结节伴微钙化 (TI-RADS 4A),建议细针穿刺活检。',
    conclusion: '甲状腺结节 (TI-RADS 4A)',
    snomedCodes: ['SNOMED:450894009'], source: 'demo',
  },
  {
    id: 'sc-demo-022', reportId: 'rpt-1022', patientId: 'P1022', gender: '男', age: 65,
    modality: 'MR', bodyPart: '盆腔', studyDate: '2026-03-27',
    findings: '前列腺体积增大,大小约 5.2cm×4.6cm×4.0cm,突入膀胱,外周带信号正常,未见明确结节。',
    impression: '前列腺增生,建议 PSA 检测随访。',
    conclusion: '前列腺增生',
    snomedCodes: ['SNOMED:266569009'], source: 'demo',
  },
  {
    id: 'sc-demo-023', reportId: 'rpt-1023', patientId: 'P1023', gender: '男', age: 59,
    modality: 'CT', bodyPart: '胸部', studyDate: '2026-02-18',
    findings: '右肺上叶见分叶状肿块伴空洞形成,大小约 5cm×4cm,洞壁厚薄不均,右肺门及纵隔见多发肿大淋巴结。',
    impression: '右肺上叶肿块伴空洞,考虑肺癌伴肺门纵隔淋巴结转移,建议活检分期。',
    conclusion: '右肺上叶占位 (肺癌伴淋巴结转移)',
    snomedCodes: ['SNOMED:93880001'], source: 'demo',
  },
  {
    id: 'sc-demo-024', reportId: 'rpt-1024', patientId: 'P1024', gender: '女', age: 70,
    modality: 'DX', bodyPart: '脊柱', studyDate: '2026-05-19',
    findings: '胸椎及腰椎多发椎体见混杂密度灶,腰3椎体压缩性变扁,骨盆诸骨见多发类圆形低密度灶。',
    impression: '多发椎体及骨盆骨质破坏,考虑骨转移瘤可能,建议进一步检查明确原发灶。',
    conclusion: '多发骨转移瘤 (可疑)',
    snomedCodes: ['SNOMED:286911005'], source: 'demo',
  },
];

const memoryFeedback: Array<{ reportId: string; targetReportId: string; useful: boolean; comment?: string }> = [];

function normalize(s: string): string {
  return (s ?? '').toLowerCase().trim();
}

function extractKeywords(text: string): string[] {
  const t = normalize(text);
  if (!t) return [];
  const found = new Set<string>();
  for (const [zh, en] of KEYWORD_DICT) {
    if (t.includes(zh)) found.add(zh);
    if (t.includes(en)) found.add(zh);
  }
  return [...found];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const k of sa) if (sb.has(k)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function snomedScore(a: string[], b: string[]): number {
  const clean = (arr: string[]) => [...new Set((arr ?? []).map(normalize).filter(Boolean))];
  const sa = clean(a);
  const sb = clean(b);
  if (sa.length === 0 && sb.length === 0) return 0.5;
  if (sa.length === 0 || sb.length === 0) return 0.3;
  const sbSet = new Set(sb);
  let inter = 0;
  for (const c of sa) if (sbSet.has(c)) inter++;
  const union = sa.length + sb.length - inter;
  return union === 0 ? 0.5 : inter / union;
}

function ageBand(age: number): number {
  if (age < 18) return 0;
  if (age < 40) return 1;
  if (age < 60) return 2;
  if (age < 80) return 3;
  return 4;
}

function featureScore(q: { modality?: string; bodyPart?: string; age?: number; gender?: string }, c: SeedCase): number {
  let score = 0;
  if (q.modality && normalize(q.modality) === normalize(c.modality)) score += 0.4;
  if (q.bodyPart && normalize(q.bodyPart) === normalize(c.bodyPart)) score += 0.3;
  if (q.age !== undefined && ageBand(q.age) === ageBand(c.age)) score += 0.15;
  if (q.gender && q.gender === c.gender) score += 0.15;
  return score;
}

function score(query: {
  keywords: string[];
  modality?: string;
  bodyPart?: string;
  age?: number;
  gender?: string;
  snomedCodes: string[];
}, c: SeedCase & { keywords: string[] }) {
  const textScore = jaccard(query.keywords, c.keywords);
  const feature = featureScore(query, c);
  const snomed = snomedScore(query.snomedCodes, c.snomedCodes);
  const similarity = Math.round(100 * (0.5 * textScore + 0.3 * feature + 0.2 * snomed));
  return { ...c, keywords: c.keywords, textScore, featureScore: feature, snomedScore: snomed, similarity };
}

function withKeywords(c: SeedCase): SeedCase & { keywords: string[] } {
  return { ...c, keywords: extractKeywords(`${c.findings} ${c.impression} ${c.conclusion}`) };
}

function runSearch(body: {
  reportText?: string;
  modality?: string;
  bodyPart?: string;
  limit?: number;
}): ReturnType<typeof score>[] {
  const text = body.reportText ?? '';
  const keywords = extractKeywords(text);
  const query = { keywords, modality: body.modality, bodyPart: body.bodyPart, snomedCodes: [] };
  const limit = Math.min(50, Math.max(1, body.limit ?? 10));
  return SEED_CASES
    .map(withKeywords)
    .map((c) => score(query, c))
    .filter((r) => r.similarity > 0 || keywords.length === 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function runByReport(reportId: string, limit: number): ReturnType<typeof score>[] {
  const source = SEED_CASES.find((c) => c.reportId === reportId);
  if (!source) return [];
  const keywords = extractKeywords(`${source.findings} ${source.impression}`);
  const query = {
    keywords,
    modality: source.modality,
    bodyPart: source.bodyPart,
    age: source.age,
    gender: source.gender,
    snomedCodes: source.snomedCodes,
  };
  return SEED_CASES
    .filter((c) => c.reportId !== reportId)
    .map(withKeywords)
    .map((c) => score(query, c))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(50, Math.max(1, limit)));
}

// ══════════════════════════════════════════════════════════════════════════
// [v3.0.6.11-62] 影像级相似检索 (对标 Siemens 影像检索 / Infinitt 影像维度)
// 确定性特征: 32-bin 强度直方图 + 统计(mean/std/skew/kurt/percentiles)
//             + 纹理(相邻差分均值) + 形态(高/低密度占比)
// 相似度 = 0.6×特征余弦 + 0.4×模态/部位匹配 (跨模态家族特征余弦记 0)
// ══════════════════════════════════════════════════════════════════════════
const HIST_BINS = 32;
const CT_MIN = -1024;
const CT_MAX = 1024;
const SIGNAL_MAX = 2048;

interface MockImageFeature {
  seriesUid: string;
  studyUid: string;
  modality: string;
  bodyPart: string;
  instanceCount: number;
  histogram: number[];
  vector: number[];
  source: 'real' | 'demo';
  summary: {
    mean: number; std: number; skew: number; kurtosis: number; min: number; max: number;
    percentiles: number[]; textureEnergy: number; highDensityRatio: number; lowDensityRatio: number;
  };
}

const isCtFamily = (m: string) => /^(CT|PET-CT|NM)$/i.test(m ?? '');

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const IMG_TEMPLATES: Record<string, { mean: number; std: number; texture: number; high: number; low: number }> = {
  'CT|颅脑': { mean: 30, std: 150, texture: 60, high: 0.04, low: 0.02 },
  'CT|胸部': { mean: -700, std: 170, texture: 40, high: 0.005, low: 0.06 },
  'CT|腹部': { mean: 40, std: 120, texture: 45, high: 0.02, low: 0.02 },
  'CT|脊柱': { mean: 120, std: 170, texture: 55, high: 0.09, low: 0.01 },
  'CT|default': { mean: 0, std: 150, texture: 50, high: 0.03, low: 0.03 },
  'MR|颅脑': { mean: 850, std: 400, texture: 250, high: 0.01, low: 0.03 },
  'MR|膝关节': { mean: 700, std: 450, texture: 300, high: 0.005, low: 0.02 },
  'MR|盆腔': { mean: 650, std: 420, texture: 220, high: 0.005, low: 0.01 },
  'MR|default': { mean: 800, std: 420, texture: 250, high: 0.008, low: 0.02 },
  'DX|胸部': { mean: 500, std: 350, texture: 180, high: 0.002, low: 0.02 },
  'DX|腹部': { mean: 480, std: 360, texture: 190, high: 0.002, low: 0.015 },
  'DX|脊柱': { mean: 560, std: 380, texture: 200, high: 0.01, low: 0.015 },
  'DX|上肢': { mean: 520, std: 360, texture: 190, high: 0.005, low: 0.02 },
  'DX|default': { mean: 520, std: 360, texture: 190, high: 0.005, low: 0.02 },
  'MG|乳腺': { mean: 600, std: 400, texture: 230, high: 0.01, low: 0.01 },
  'MG|default': { mean: 600, std: 400, texture: 230, high: 0.01, low: 0.01 },
  'US|腹部': { mean: 700, std: 450, texture: 280, high: 0.002, low: 0.002 },
  'US|甲状腺': { mean: 720, std: 440, texture: 270, high: 0.001, low: 0.001 },
  'US|default': { mean: 710, std: 450, texture: 275, high: 0.002, low: 0.002 },
};

function gaussianHistogram(mean: number, std: number, min: number, span: number, seed: number): number[] {
  const width = span / HIST_BINS;
  const hist: number[] = [];
  for (let i = 0; i < HIST_BINS; i++) {
    const c = min + width * i + width / 2;
    const d = (c - mean) / Math.max(1e-6, std);
    const g = Math.exp(-0.5 * d * d);
    const jitter = 0.85 + ((hashString(`bin${i}:${seed}`) % 300) / 1000);
    hist.push(Math.round(1000 * g * jitter + 4));
  }
  return hist;
}

function statsFromHistogram(hist: number[], total: number, min: number, span: number) {
  const width = span / HIST_BINS;
  const center = (i: number) => min + width * i + width / 2;
  let mean = 0;
  for (let i = 0; i < HIST_BINS; i++) mean += (hist[i] ?? 0) * center(i);
  mean /= total;
  let m2 = 0, m3 = 0, m4 = 0;
  for (let i = 0; i < HIST_BINS; i++) {
    const d = center(i) - mean;
    const c = (hist[i] ?? 0) / total;
    m2 += c * d * d; m3 += c * d * d * d; m4 += c * d * d * d * d;
  }
  const std = Math.sqrt(m2);
  const skew = std > 1e-9 ? m3 / (std ** 3) : 0;
  const kurtosis = m2 > 1e-12 ? m4 / (m2 * m2) : 3;
  let minV = min + span, maxV = min, first = -1;
  for (let i = 0; i < HIST_BINS; i++) {
    if ((hist[i] ?? 0) > 0) {
      if (first < 0) first = i;
      minV = min + width * i;
      maxV = min + width * i + width;
    }
  }
  const percentile = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (let i = 0; i < HIST_BINS; i++) { cum += hist[i] ?? 0; if (cum >= target) return center(i); }
    return min + span;
  };
  return { mean, std, skew, kurtosis, minV: first >= 0 ? minV : min, maxV: first >= 0 ? maxV : min + span, percentiles: [percentile(0.05), percentile(0.25), percentile(0.5), percentile(0.75), percentile(0.95)] };
}

function buildVector(hist: number[], total: number, min: number, span: number, s: ReturnType<typeof statsFromHistogram>, tex: number, high: number, low: number): number[] {
  const norm = (v: number, lo: number, hi: number) => Math.max(-1, Math.min(1, (v - lo) / (hi - lo)));
  const v: number[] = [];
  for (let i = 0; i < HIST_BINS; i++) v.push((hist[i] ?? 0) / total);
  v.push(norm(s.mean, min, min + span));
  v.push(s.std / span);
  v.push(Math.max(-1, Math.min(1, s.skew / 5)));
  v.push(Math.max(-1, Math.min(1, (s.kurtosis - 3) / 10)));
  for (const p of s.percentiles) v.push(norm(p, min, min + span));
  v.push(tex / span);
  v.push(high);
  v.push(low);
  let len = 0;
  for (const x of v) len += x * x;
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / len;
  return v;
}

function buildMockFeature(seriesUid: string, studyUid: string, modality: string, bodyPart: string, source: 'real' | 'demo'): MockImageFeature {
  const template = IMG_TEMPLATES[`${modality}|${bodyPart}`] ?? IMG_TEMPLATES[`${modality}|default`] ?? { mean: 0, std: 200, texture: 100, high: 0.02, low: 0.02 };
  const h = hashString(seriesUid);
  const jitter = (v: number, amp: number) => v + (((h % 251) / 250) - 0.5) * 2 * amp;
  const mean = jitter(template.mean, Math.min(30, Math.max(18, template.std * 0.18)));
  const std = Math.max(20, jitter(template.std, template.std * 0.1));
  const texture = Math.max(5, jitter(template.texture, template.texture * 0.1));
  const high = Math.max(0, Math.min(0.3, jitter(template.high, 0.003)));
  const low = Math.max(0, Math.min(0.3, jitter(template.low, 0.003)));
  const ct = isCtFamily(modality);
  const min = ct ? CT_MIN : 0;
  const span = ct ? CT_MAX - CT_MIN : SIGNAL_MAX;
  const hist = gaussianHistogram(mean, std, min, span, h);
  const total = hist.reduce((a, b) => a + b, 0);
  const s = statsFromHistogram(hist, total, min, span);
  return {
    seriesUid, studyUid, modality, bodyPart, instanceCount: 1, histogram: hist,
    vector: buildVector(hist, total, min, span, s, texture, high, low), source,
    summary: {
      mean: Math.round(s.mean * 10) / 10, std: Math.round(s.std * 10) / 10,
      skew: Math.round(s.skew * 100) / 100, kurtosis: Math.round(s.kurtosis * 100) / 100,
      min: Math.round(s.minV), max: Math.round(s.maxV),
      percentiles: s.percentiles.map((p) => Math.round(p)),
      textureEnergy: Math.round(texture * 10) / 10,
      highDensityRatio: Math.round(high * 10000) / 10000,
      lowDensityRatio: Math.round(low * 10000) / 10000,
    },
  };
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return Math.max(-1, Math.min(1, dot));
}

function imageSimilarityScore(q: MockImageFeature, c: MockImageFeature): { cos: number; match: number; score: number } {
  const cos = isCtFamily(q.modality) === isCtFamily(c.modality) ? cosine(q.vector, c.vector) : 0;
  let match = 0;
  if (q.modality && q.modality === c.modality) match += 0.55;
  if (q.bodyPart && q.bodyPart === c.bodyPart) match += 0.45;
  return { cos, match, score: 0.6 * cos + 0.4 * match };
}

function toSummary(f: MockImageFeature) {
  return { ...f.summary, histogram: f.histogram };
}

// 内置真实样本系列 (与 backend dicom-samples manifest 对齐) + demo 特征库
const REAL_SERIES: Array<{ seriesUid: string; studyUid: string; modality: string; bodyPart: string }> = [
  { seriesUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.S.1', studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.20260115.ACC-SAMPLE-0001', modality: 'CT', bodyPart: '颅脑' },
  { seriesUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.S.2', studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.20260115.ACC-SAMPLE-0002', modality: 'CT', bodyPart: '胸部' },
  { seriesUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.MR.S.3', studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.20260116.ACC-SAMPLE-0003', modality: 'MR', bodyPart: '颅脑' },
  { seriesUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.DR.S.4', studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.20260116.ACC-SAMPLE-0004', modality: 'DR', bodyPart: '胸部' },
];

let mockImageFeatures: MockImageFeature[] | null = null;

function imageFeatureLibrary(): MockImageFeature[] {
  if (mockImageFeatures) return mockImageFeatures;
  const list: MockImageFeature[] = [];
  for (const s of REAL_SERIES) list.push(buildMockFeature(s.seriesUid, s.studyUid, s.modality, s.bodyPart, 'real'));
  for (const c of SEED_CASES) list.push(buildMockFeature(`demo-series-${c.reportId}`, `demo-study-${c.reportId}`, c.modality, c.bodyPart, 'demo'));
  mockImageFeatures = list;
  return list;
}

function imageSeriesList() {
  return imageFeatureLibrary().map((f) => ({
    seriesUid: f.seriesUid,
    studyUid: f.studyUid,
    modality: f.modality,
    bodyPart: f.bodyPart,
    instanceCount: f.instanceCount,
    description: f.source === 'real' ? `${f.modality} ${f.bodyPart} 影像 (真实样本)` : `${f.modality} ${f.bodyPart} (演示特征库)`,
    source: f.source,
  }));
}

function runImageSearch(body: { seriesUID?: string; studyUid?: string; limit?: number }) {
  const lib = imageFeatureLibrary();
  const query = (body.seriesUID && lib.find((f) => f.seriesUid === body.seriesUID))
    ?? (body.studyUid && lib.find((f) => f.studyUid === body.studyUid));
  if (!query) return [];
  const limit = Math.min(20, Math.max(1, body.limit ?? 10));
  return lib
    .filter((f) => f.seriesUid !== query.seriesUid)
    .map((f) => {
      const { cos, match, score } = imageSimilarityScore(query, f);
      return {
        seriesUid: f.seriesUid,
        studyUid: f.studyUid,
        modality: f.modality,
        bodyPart: f.bodyPart,
        instanceCount: f.instanceCount,
        similarity: Math.round(score * 100),
        featureScore: Math.round(cos * 10000) / 100,
        matchScore: Math.round(match * 10000) / 100,
        featureSummary: toSummary(f),
        source: f.source,
      };
    })
    .sort((a, b) => b.similarity - a.similarity || b.featureScore - a.featureScore)
    .slice(0, limit);
}

function runHybridSearch(body: { reportId?: string; reportText?: string; seriesUID?: string; studyUid?: string; limit?: number }) {
  const lib = imageFeatureLibrary();
  const sourceCase = body.reportId ? SEED_CASES.find((c) => c.reportId === body.reportId) : undefined;
  const text = body.reportText ?? (sourceCase ? `${sourceCase.findings} ${sourceCase.impression}` : '');
  const keywords = extractKeywords(text);
  const textQuery = {
    keywords,
    modality: sourceCase?.modality,
    bodyPart: sourceCase?.bodyPart,
    age: sourceCase?.age,
    gender: sourceCase?.gender,
    snomedCodes: sourceCase?.snomedCodes ?? [],
  };
  const imageQuery = (body.seriesUID && lib.find((f) => f.seriesUid === body.seriesUID))
    ?? (body.studyUid && lib.find((f) => f.studyUid === body.studyUid))
    ?? (sourceCase && lib.find((f) => f.seriesUid === `demo-series-${sourceCase.reportId}`));
  const limit = Math.min(20, Math.max(1, body.limit ?? 10));

  const results: any[] = [];
  for (const f of lib) {
    const seed = SEED_CASES.find((s) => `demo-series-${s.reportId}` === f.seriesUid);
    const hasText = keywords.length > 0;
    let textScore: number | null = null;
    let imageScore: number | null = null;
    if (hasText) {
      const kws = seed ? extractKeywords(`${seed.findings} ${seed.impression} ${seed.conclusion}`) : [];
      const jac = jaccard(keywords, kws);
      let feat = 0;
      if (seed && ((textQuery.modality && textQuery.modality === seed.modality) || (textQuery.bodyPart && textQuery.bodyPart === seed.bodyPart))) {
        if (textQuery.modality && textQuery.modality === seed.modality) feat += 0.4;
        if (textQuery.bodyPart && textQuery.bodyPart === seed.bodyPart) feat += 0.3;
        if (textQuery.age !== undefined && seed.age !== undefined && ageBand(textQuery.age) === ageBand(seed.age)) feat += 0.15;
        if (textQuery.gender && textQuery.gender === seed.gender) feat += 0.15;
      }
      const snomed = snomedScore(textQuery.snomedCodes, seed?.snomedCodes ?? []);
      textScore = Math.round(100 * (0.5 * jac + 0.3 * feat + 0.2 * snomed)) / 100;
    }
    if (imageQuery && imageQuery.seriesUid !== f.seriesUid) {
      const { score } = imageSimilarityScore(imageQuery, f);
      imageScore = Math.round(score * 100) / 100;
    }
    const similarity = textScore !== null && imageScore !== null
      ? Math.round(100 * (0.5 * textScore + 0.5 * imageScore))
      : textScore !== null ? Math.round(textScore * 100) : imageScore !== null ? Math.round(imageScore * 100) : 0;
    if (similarity <= 0 && textScore === null && imageScore === null) continue;
    results.push({
      id: seed ? seed.id : `img-${f.seriesUid}`,
      reportId: seed ? seed.reportId : `series-${f.seriesUid.slice(-8)}`,
      seriesUid: f.seriesUid,
      studyUid: f.studyUid,
      modality: f.modality,
      bodyPart: f.bodyPart,
      similarity,
      textScore,
      imageScore,
      featureSummary: imageQuery ? toSummary(f) : null,
      source: f.source,
      impression: seed?.impression,
      findings: seed?.findings,
      keywords: seed ? extractKeywords(`${seed.findings} ${seed.impression} ${seed.conclusion}`) : [],
    });
  }
  return results.sort((a, b) => b.similarity - a.similarity || (b.imageScore ?? 0) - (a.imageScore ?? 0)).slice(0, limit);
}

export const similarCaseHandlers = [
  http.post(`${API}/search`, async ({ request }) => {
    await delay(120);
    const body = await request.json().catch(() => ({}));
    const { reportText, modality, bodyPart, limit } = (body ?? {}) as Record<string, unknown>;
    const results = runSearch({
      reportText: typeof reportText === 'string' ? reportText : '',
      modality: typeof modality === 'string' ? modality : undefined,
      bodyPart: typeof bodyPart === 'string' ? bodyPart : undefined,
      limit: typeof limit === 'number' ? limit : 10,
    });
    return HttpResponse.json({ success: true, data: results, total: results.length });
  }),

  // [v3.0.6.11-62] 影像级相似检索
  http.post(`${API}/image-search`, async ({ request }) => {
    await delay(150);
    const body = await request.json().catch(() => ({}));
    const { seriesUID, studyUid, limit } = (body ?? {}) as Record<string, unknown>;
    if (!seriesUID && !studyUid) {
      return HttpResponse.json({ success: false, error: 'seriesUID or studyUid required' }, { status: 400 });
    }
    const results = runImageSearch({
      seriesUID: typeof seriesUID === 'string' ? seriesUID : undefined,
      studyUid: typeof studyUid === 'string' ? studyUid : undefined,
      limit: typeof limit === 'number' ? limit : 10,
    });
    return HttpResponse.json({ success: true, data: results, total: results.length });
  }),

  http.post(`${API}/hybrid-search`, async ({ request }) => {
    await delay(150);
    const body = await request.json().catch(() => ({}));
    const { reportId, reportText, seriesUID, studyUid, limit } = (body ?? {}) as Record<string, unknown>;
    if (!reportId && !reportText && !seriesUID && !studyUid) {
      return HttpResponse.json({ success: false, error: 'at least one of reportId/reportText/seriesUID/studyUid required' }, { status: 400 });
    }
    const results = runHybridSearch({
      reportId: typeof reportId === 'string' ? reportId : undefined,
      reportText: typeof reportText === 'string' ? reportText : undefined,
      seriesUID: typeof seriesUID === 'string' ? seriesUID : undefined,
      studyUid: typeof studyUid === 'string' ? studyUid : undefined,
      limit: typeof limit === 'number' ? limit : 10,
    });
    return HttpResponse.json({ success: true, data: results, total: results.length });
  }),

  http.get(`${API}/series`, async () => {
    await delay(80);
    const data = imageSeriesList();
    return HttpResponse.json({ success: true, data, total: data.length });
  }),

  http.get(`${API}/:reportId`, async ({ params }) => {
    await delay(100);
    const reportId = String(params.reportId ?? '');
    return HttpResponse.json({ success: true, data: runByReport(reportId, 10) });
  }),

  http.post(`${API}/feedback`, async ({ request }) => {
    await delay(60);
    const body = await request.json().catch(() => ({}));
    const { reportId, targetReportId, useful, comment } = (body ?? {}) as Record<string, unknown>;
    if (!reportId || !targetReportId) {
      return HttpResponse.json({ success: false, error: 'reportId and targetReportId required' }, { status: 400 });
    }
    memoryFeedback.push({
      reportId: String(reportId),
      targetReportId: String(targetReportId),
      useful: Boolean(useful),
      comment: typeof comment === 'string' ? comment : undefined,
    });
    return HttpResponse.json({ success: true, data: { success: true } });
  }),
];
