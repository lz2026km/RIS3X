// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - RADS 评分规则库
// Lung-RADS 2019 / BI-RADS / PI-RADS v2.1 / LI-RADS / TI-RADS
// 供 AiRadsPage / StructuredFieldForm 使用
// ============================================================

export type RadsSystem =
  | 'Lung-RADS'
  | 'BI-RADS'
  | 'PI-RADS'
  | 'LI-RADS'
  | 'TI-RADS';

export interface RadsRule {
  category: RadsSystem;
  score: string;
  /** 分类中文名称 */
  title: string;
  /** 详细描述 */
  description: string;
  /** 管理建议 */
  management: string;
  /** 关键词，用于智能匹配 */
  keywords: string[];
  /** 恶性风险概率（可选） */
  risk?: string;
  /** 随访时间建议（可选） */
  followUp?: string;
}

export const RADS_SYSTEMS: RadsSystem[] = [
  'Lung-RADS',
  'BI-RADS',
  'PI-RADS',
  'LI-RADS',
  'TI-RADS',
];

// ============================================================
// 1. Lung-RADS 2019（肺癌筛查 CT 报告分级系统）
// ============================================================

export const LUNG_RADS_2019: RadsRule[] = [
  {
    category: 'Lung-RADS',
    score: '0',
    title: '不完整评估',
    description:
      '需要追加CT检查或对比既往影像才能完成评估；部分病例可因技术因素（运动伪影、缺层）需重新扫描。常见情形：≥15mm 实性结节未行薄层扫描、既往检查资料缺失。',
    management: '建议在 12 个月后行低剂量CT复查（如需），或调取既往影像资料对比后重新分类。',
    keywords: ['不完整', '追加', '薄层', '既往', '资料缺失', '技术因素'],
  },
  {
    category: 'Lung-RADS',
    score: '0',
    title: '不完整评估——高危结节未行薄层扫描',
    description:
      '发现的结节径线 ≥15mm（实性）或实性成分 ≥8mm（部分实性），但未行薄层（≤1.5mm）重建，无法准确评估特征。',
    management: '立即补行薄层扫描重建，完成评估后按相应分类管理。',
    keywords: ['高危', '薄层', '重建', '15mm', '实性成分'],
  },
  {
    category: 'Lung-RADS',
    score: '1',
    title: '阴性（无肺结节）',
    description:
      '未见肺结节。可存在良性表现，如：肺实质内钙化结节、脂肪性错构瘤、稳定 ≥3 年的结节。',
    management: '无需特殊处理；12 个月后常规低剂量CT筛查。',
    risk: '恶性概率 <1%',
    followUp: '12个月后常规筛查',
    keywords: ['阴性', '无结节', '钙化', '错构瘤', '稳定'],
  },
  {
    category: 'Lung-RADS',
    score: '1',
    title: '阴性——确诊良性结节',
    description:
      '结节具有明确良性特征：完全钙化（中央/层状/爆米花样）、含脂肪密度（错构瘤）、或实性结节连续 3 年无变化。',
    management: '无需随访，按常规筛查周期（12个月）复查即可。',
    risk: '恶性概率 <1%',
    keywords: ['良性', '钙化', '脂肪密度', '爆米花样', '错构瘤', '三年稳定'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '良性表现或良性行为',
    description:
      '结节为良性表现或生物学良性：基线实性结节 <6mm；基线纯磨玻璃 <30mm；基线部分实性结节总径 <6mm；或结节自基线无变化并 ≥3 年稳定。',
    management: '继续年度低剂量CT筛查。',
    risk: '恶性概率 <1%',
    followUp: '12个月后年度筛查',
    keywords: ['良性行为', '6mm', '30mm', '磨玻璃', '部分实性', '稳定'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '实性结节 <6mm（基线）',
    description:
      '基线筛查实性结节最大径 <6mm。若形态可疑（毛刺）或位于上叶，仍归 2 类但建议密切观察。',
    management: '12 个月后年度低剂量CT筛查。',
    risk: '恶性概率 <1%',
    keywords: ['实性', '6mm以下', '基线', '小结节', '微小'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '部分实性结节总径 <6mm（基线）',
    description:
      '基线筛查部分实性（混合磨玻璃）结节总最大径 <6mm，实性成分不可评价或 <4mm。',
    management: '12 个月后年度低剂量CT筛查。',
    keywords: ['部分实性', '混合磨玻璃', '6mm', '基线'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '纯磨玻璃结节 <30mm（基线）',
    description:
      '基线筛查纯磨玻璃结节（无实性成分）最大径 <30mm。此类病灶生长缓慢，长期随访稳定性高。',
    management: '12 个月后年度低剂量CT筛查。',
    risk: '恶性概率 <1%',
    keywords: ['纯磨玻璃', 'GGO', '30mm', '无实性成分'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '纯磨玻璃结节 ≥30mm 且无变化',
    description:
      '纯磨玻璃结节 ≥30mm 但连续复查（≥3年）无增长，或新发现但 ≤30mm 且形态符合良性。',
    management: '12 个月后年度低剂量CT筛查。',
    keywords: ['纯磨玻璃', '30mm以上', '无变化', '稳定'],
  },
  {
    category: 'Lung-RADS',
    score: '2',
    title: '其他良性发现',
    description:
      '包括：肺内弥漫性钙化灶、纤维化稳定、胸膜斑（与石棉接触相关）、弥漫性增厚、肺门/纵隔淋巴结短径 <10mm、心包积液/胸腔积液稳定、食管裂孔疝、骨质疏松等。',
    management: '按年度常规筛查；相关发现建议临床相应专科评估。',
    keywords: ['胸膜斑', '石棉', '钙化', '淋巴结', '裂孔疝', '良性发现'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '可能良性（需短期随访）',
    description:
      '恶性概率 1%-2%，需 6 个月短期随访确定稳定性。典型情形：基线实性结节 ≥6mm～<8mm；基线部分实性总径 ≥6mm 且实性成分 <6mm；新发实性结节 <6mm；新发部分实性 <6mm；纯磨玻璃 ≥30mm（基线）或新发磨玻璃 ≥30mm。',
    management: '6 个月后短期复查CT；若病灶无变化，12 个月后再次复查；若增长升级为 4 类。',
    risk: '恶性概率 1%-2%',
    followUp: '6个月短期随访',
    keywords: ['可能良性', '6个月', '随访', '短期', '变化'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '实性结节 ≥6mm～<8mm（基线）',
    description:
      '基线实性结节最大径 6-7.9mm，形态可呈圆形/分叶状，边缘光滑或欠光滑。',
    management: '6 个月后复查；若稳定 12 个月后年度筛查；若增长或出现毛刺归 4A/4B。',
    risk: '恶性概率 1%-2%',
    keywords: ['实性', '6-8mm', '基线', '分叶'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '部分实性结节总径 ≥6mm 且实性成分 <6mm（基线）',
    description:
      '基线部分实性结节总最大径 ≥6mm，其中实性成分 <6mm。',
    management: '6 个月后复查；稳定则 12 个月后再复查；实性成分增长或 ≥6mm 升级。',
    risk: '恶性概率 1%-2%',
    keywords: ['部分实性', '实性成分', '6mm', '基线', '混合'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '新发实性结节 <6mm',
    description:
      '既往无此病灶，本次筛查新发现实性结节 <6mm。需与陈旧性炎性灶鉴别。',
    management: '6 个月后复查；若新发 ≥6mm 则升级为 4A；若持续增大升级 4B。',
    risk: '恶性概率 1%-2%',
    keywords: ['新发', '实性', '6mm以下', '新增'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '新发部分实性结节 <6mm',
    description:
      '新发现部分实性（亚实性）结节总径 <6mm。',
    management: '6 个月后复查CT评估变化趋势。',
    risk: '恶性概率 1%-2%',
    keywords: ['新发', '部分实性', '亚实性', '6mm以下'],
  },
  {
    category: 'Lung-RADS',
    score: '3',
    title: '新发纯磨玻璃结节 ≥30mm',
    description:
      '新发现纯磨玻璃结节最大径 ≥30mm；若随访中出现实性成分，需升级分类。',
    management: '6 个月后复查；出现实性成分或增长则升级为 4A。',
    risk: '恶性概率 1%-2%',
    keywords: ['新发', '纯磨玻璃', '30mm以上'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '可疑恶性（恶性概率 5%-15%）',
    description:
      '具有低度可疑特征：基线实性结节 ≥15mm；基线部分实性结节实性成分 ≥8mm；新发实性结节 8mm～<15mm；新发部分实性结节 ≥6mm（总径）；增长中的实性结节 <8mm 或增长中的实性成分 <8mm；新发或增长的磨玻璃 <30mm；支气管内结节。',
    management: '建议 3 个月后随访CT，或 PET-CT / 穿刺活检进一步评估；根据结节特征和患者风险分层决策。',
    risk: '恶性概率 5%-15%',
    followUp: '3个月随访或进一步检查',
    keywords: ['可疑', '4A', '15mm', '8mm', '新发', '增长'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '实性结节 ≥15mm（基线）',
    description:
      '基线实性结节最大径 ≥15mm，为低度可疑恶性结节。',
    management: '3 个月后CT随访；若增长或出现恶性特征，建议PET-CT或活检。',
    risk: '恶性概率 5%-15%',
    keywords: ['实性', '15mm以上', '基线', '低度可疑'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '部分实性结节实性成分 ≥8mm（基线）',
    description:
      '基线部分实性结节实性成分最大径 ≥8mm（总径可更大）。',
    management: '3 个月后复查；恶性风险增加，必要时活检。',
    risk: '恶性概率 5%-15%',
    keywords: ['部分实性', '实性成分', '8mm以上', '基线'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '新发实性结节 8mm～<15mm',
    description:
      '新发现实性结节最大径 8-14.9mm，形态可规则或带毛刺。',
    management: '3 个月后CT随访；考虑PET-CT或活检。',
    risk: '恶性概率 5%-15%',
    keywords: ['新发', '实性', '8-15mm', '新增'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '新发部分实性结节总径 ≥6mm',
    description:
      '新发现部分实性结节总最大径 ≥6mm，实性成分可评估。',
    management: '3 个月后CT随访；若实性成分增长，升级为 4B。',
    risk: '恶性概率 5%-15%',
    keywords: ['新发', '部分实性', '6mm以上'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '增长中实性结节 <8mm',
    description:
      '原 <8mm 的实性结节随访中出现增长（≥1.5mm），但尚未达 8mm。',
    management: '3 个月后复查；若继续增长升级为 4B。',
    risk: '恶性概率 5%-15%',
    keywords: ['增长', '实性', '8mm以下', '增大'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '新发或增长磨玻璃结节 <30mm',
    description:
      '新发现的磨玻璃结节，或原磨玻璃结节随访中增长（磨玻璃部分增大）。',
    management: '3 个月后复查；出现实性成分或明显增长建议进一步检查。',
    risk: '恶性概率 5%-15%',
    keywords: ['磨玻璃', '增长', '新发', '30mm以下'],
  },
  {
    category: 'Lung-RADS',
    score: '4A',
    title: '支气管内结节',
    description:
      '支气管腔内见软组织结节（基底宽阔或带蒂），可为良性（错构瘤、炎性息肉）或恶性。',
    management: '建议支气管镜检查明确诊断。',
    risk: '恶性概率 5%-15%',
    keywords: ['支气管内', '腔内结节', '气道', '支气管镜'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '高度可疑恶性（恶性概率 >15%）',
    description:
      '典型情形：基线实性结节 ≥15mm 且随访增长；新发实性结节 ≥15mm；实性成分增长 ≥8mm 或新发实性成分 ≥6mm 或实性成分增加 ≥1.5mm；新发或增长磨玻璃 >30mm；支气管内结节 ≥15mm。',
    management: '建议进一步检查：PET-CT、支气管镜或经皮穿刺活检；多学科会诊制定治疗方案。',
    risk: '恶性概率 >15%',
    followUp: '建议进一步检查（PET-CT/活检）',
    keywords: ['高度可疑', '4B', '15mm以上', '活检', 'PET'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '新发实性结节 ≥15mm',
    description:
      '新发现实性结节最大径 ≥15mm，恶性概率显著升高。',
    management: '立即建议活检/PET-CT，启动MDT会诊。',
    risk: '恶性概率 >15%',
    keywords: ['新发', '实性', '15mm以上', '大结节'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '实性结节 ≥15mm 且随访增长',
    description:
      '基线实性结节 ≥15mm，随访中进一步增长（≥1.5mm）。',
    management: '活检或PET-CT明确诊断；考虑手术评估。',
    risk: '恶性概率 >15%',
    keywords: ['增长', '15mm以上', '实性', '随访'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '实性成分增长 ≥8mm 或新发实性成分 ≥6mm',
    description:
      '亚实性结节实性成分增大至 ≥8mm，或新出现实性成分 ≥6mm，提示浸润性生长。',
    management: '建议活检明确病理类型，多学科评估治疗。',
    risk: '恶性概率 >15%',
    keywords: ['实性成分', '增长', '浸润', '8mm'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '实性成分增加 ≥1.5mm（随访）',
    description:
      '随访中亚实性结节实性成分增大 ≥1.5mm（薄层测量）。',
    management: '短期复查或直接活检；评估手术指征。',
    risk: '恶性概率 >15%',
    keywords: ['实性成分', '增加', '1.5mm', '随访'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '新发或增长磨玻璃结节 >30mm',
    description:
      '磨玻璃结节 >30mm 且为新发或随访中出现增长。',
    management: '建议活检或PET-CT；多学科讨论。',
    risk: '恶性概率 >15%',
    keywords: ['磨玻璃', '30mm以上', '增长', '新发'],
  },
  {
    category: 'Lung-RADS',
    score: '4B',
    title: '支气管内结节 ≥15mm',
    description:
      '支气管内软组织结节 ≥15mm，或伴阻塞性肺不张/阻塞性肺炎。',
    management: '立即支气管镜检查并活检。',
    risk: '恶性概率 >15%',
    keywords: ['支气管内', '15mm以上', '阻塞', '支气管镜'],
  },
  {
    category: 'Lung-RADS',
    score: '4X',
    title: '高度可疑恶性伴额外特征（侵袭性特征）',
    description:
      '4B 病灶同时具备以下任一特征：(1) 最大径 ≥15mm；(2) 体积倍增时间 <400 天（快速增长）；(3) 增强CT 中强化明显；(4) PET-CT 示代谢活性增高（SUVmax 显著升高）。',
    management:
      '立即多学科会诊；推荐经皮穿刺活检或手术切除；分期检查（PET-CT、头颅MRI）。',
    risk: '恶性概率 >15%（具侵袭性特征）',
    keywords: ['4X', '倍增时间', '快速增长', '强化', 'PET', '代谢增高'],
  },
  {
    category: 'Lung-RADS',
    score: '4X',
    title: '快速增长（倍增时间 <400 天）',
    description:
      '随访中实性结节体积倍增时间 <400 天，或径线增长 ≥2mm/年（按体积估算）。',
    management: '建议活检确诊；分期检查并行MDT。',
    risk: '恶性概率 >15%',
    keywords: ['倍增', '快速', '400天', '体积', '增长'],
  },
  {
    category: 'Lung-RADS',
    score: 'S',
    title: '其他发现（S类：非肺结节）',
    description:
      '与肺癌筛查无关的临床重要发现：胸部主动脉瘤/扩张、主动脉夹层、心包积液、左心房增大、食管裂孔疝巨大、胸膜疾病、重度骨质疏松伴压缩性骨折、锁骨下动脉扩张等。',
    management: '按相应临床指南处理；报告中建议转诊相应专科。',
    keywords: ['其他发现', 'S类', '主动脉', '心包', '胸膜', '裂孔疝'],
  },
  {
    category: 'Lung-RADS',
    score: 'S',
    title: '主动脉扩张/动脉瘤',
    description:
      '升主动脉直径 ≥50mm、腹主动脉直径 ≥30mm（或随龄增大），属 S 类重要发现。',
    management: '建议心血管专科评估，超声/CTA 随访。',
    keywords: ['主动脉', '动脉瘤', '扩张', '50mm', '30mm'],
  },
  {
    category: 'Lung-RADS',
    score: 'S',
    title: '重度骨质疏松伴椎体压缩性骨折',
    description:
      'CT 骨窗示胸腰椎多发椎体楔形变、骨密度减低，符合重度骨质疏松。',
    management: '建议骨密度检测及骨质疏松专科治疗。',
    keywords: ['骨质疏松', '压缩性骨折', '楔形变', '骨窗'],
  },
];

// ============================================================
// 2. BI-RADS（乳腺影像报告和数据系统）
// ============================================================

export const BI_RADS_2013: RadsRule[] = [
  {
    category: 'BI-RADS',
    score: '0',
    title: '评估不完整（需进一步影像检查）',
    description:
      '现有检查无法完成评估，需要追加影像检查：如诊断性加压投照、超声、MRI 等。常见于：致密型乳腺中隐灶、体位不全、设备故障。',
    management: '追加指定影像学检查后重新分类（1-6 类）。',
    keywords: ['不完整', '追加', '加压投照', '超声', 'MRI', '诊断性'],
  },
  {
    category: 'BI-RADS',
    score: '1',
    title: '阴性',
    description:
      '乳腺影像未见异常，无肿块、结构扭曲、可疑钙化或非对称致密。两侧乳腺对称，皮肤及乳头正常。',
    management: '常规筛查，按年龄指南进行年度或每2年筛查。',
    keywords: ['阴性', '无异常', '正常', '对称'],
  },
  {
    category: 'BI-RADS',
    score: '2',
    title: '良性发现',
    description:
      '明确的良性改变，恶性概率为 0：单纯囊肿、钙化的纤维腺瘤、含脂肪的错构瘤/淋巴结节、分泌物性钙化、手术瘢痕稳定、胸内假体等。',
    management: '无需随访干预，按常规筛查周期复查。',
    keywords: ['良性', '囊肿', '纤维腺瘤', '钙化', '错构瘤', '淋巴结'],
  },
  {
    category: 'BI-RADS',
    score: '3',
    title: '可能良性（短期随访）',
    description:
      '恶性概率 ≤2% 的病灶：圆形/卵圆形、边缘光整、平行生长的实性肿块；簇状圆形钙化（≤5 枚/簇）；局灶性非对称。建议 6 个月随访确认稳定性。',
    management: '6 个月后复查（X线或超声）；若稳定，12/24 个月继续随访；若增长或特征改变升级为 4 类。',
    risk: '恶性概率 ≤2%',
    followUp: '6个月短期随访',
    keywords: ['可能良性', '随访', '6个月', '圆形', '光整'],
  },
  {
    category: 'BI-RADS',
    score: '4A',
    title: '可疑恶性——低度可疑',
    description:
      '恶性概率 2%～10%。形态轻度可疑的病灶：边缘部分模糊、局部不规则、非对称致密伴形态变化。',
    management: '建议穿刺活检（细针或空心针）。',
    risk: '恶性概率 2%-10%',
    keywords: ['4A', '低度可疑', '部分模糊', '不规则', '活检'],
  },
  {
    category: 'BI-RADS',
    score: '4B',
    title: '可疑恶性——中度可疑',
    description:
      '恶性概率 10%～50%。形态中度可疑：边缘毛刺（局灶性）、可疑钙化（不定形）、结构扭曲。',
    management: '建议活检及病理学检查；根据结果制定治疗计划。',
    risk: '恶性概率 10%-50%',
    keywords: ['4B', '中度可疑', '毛刺', '不定形钙化', '结构扭曲', '活检'],
  },
  {
    category: 'BI-RADS',
    score: '4C',
    title: '可疑恶性——高度可疑',
    description:
      '恶性概率 50%～95%。形态高度可疑：边缘毛刺明显、多形性/细线分支状钙化、肿块伴皮肤增厚或乳头凹陷。',
    management: '强烈建议活检；MDT 讨论后制定新辅助或手术方案。',
    risk: '恶性概率 50%-95%',
    keywords: ['4C', '高度可疑', '多形性钙化', '分支状', '毛刺'],
  },
  {
    category: 'BI-RADS',
    score: '5',
    title: '高度提示恶性',
    description:
      '恶性概率 ≥95%。典型恶性表现：不规则高密度肿块伴显著毛刺、线样分支状钙化分布、恶性结构扭曲合并皮肤受累。',
    management: '立即活检确诊；分期检查（腋窝超声、全身PET-CT）并启动治疗。',
    risk: '恶性概率 ≥95%',
    keywords: ['5类', '高度恶性', '毛刺', '分支状钙化', '皮肤受累'],
  },
  {
    category: 'BI-RADS',
    score: '6',
    title: '活检证实的恶性',
    description:
      '病理已证实为恶性肿瘤（活检阳性）的病变，用于治疗前评估、新辅助化疗疗效评估、手术定位。',
    management: '按肿瘤分期及多学科方案进行治疗，需结合病理免疫组化。',
    keywords: ['6类', '确诊', '活检阳性', '恶性', '治疗前'],
  },
  {
    category: 'BI-RADS',
    score: '描述符',
    title: '肿块形态描述符（lexicon）',
    description:
      '肿块形态：圆形、卵圆形、分叶状、不规则形。边缘：光整、模糊、小分叶、毛刺、界限不清。密度：高密度、等密度、低密度、含脂肪。',
    management: '描述符用于组合分级，需结合整体BI-RADS分类。',
    keywords: ['形态', '边缘', '密度', '分叶', '毛刺', '光整'],
  },
  {
    category: 'BI-RADS',
    score: '描述符',
    title: '钙化形态描述符（lexicon）',
    description:
      '典型良性钙化：皮肤钙化、血管钙化、粗大钙化、杆状、圆形、点状、蛋壳样、营养不良性。可疑钙化：不定形、粗糙不均质、细小多形性、细线分支状。',
    management: '钙化分布（成簇、线样、段样、区域、弥漫）与形态联合判断分级。',
    keywords: ['钙化', '多形性', '不定形', '细线', '簇状', '段样分布'],
  },
  {
    category: 'BI-RADS',
    score: '描述符',
    title: '结构扭曲与非对称致密',
    description:
      '结构扭曲：正常结构（导管、小叶、血管）被牵拉，无明确肿块；伴或不伴手术瘢痕。非对称致密：单侧局灶/区域/广泛不对称，需与前片对比。',
    management: '结构扭曲常需活检排除浸润性癌；非对称致密需随访。',
    keywords: ['结构扭曲', '非对称', '致密', '牵拉', '瘢痕'],
  },
  {
    category: 'BI-RADS',
    score: '伴随征象',
    title: '伴随征象（associated features）',
    description:
      '皮肤凹陷、皮肤增厚、乳头回缩、乳头内陷、腋窝淋巴结肿大（皮质增厚、形态失常）、局部结构紊乱。',
    management: '伴随征象提示恶性可能性增高，应纳入分级并建议活检。',
    keywords: ['皮肤凹陷', '乳头回缩', '淋巴结', '腋窝', '皮肤增厚'],
  },
  {
    category: 'BI-RADS',
    score: 'MR-BI-RADS',
    title: '乳腺MRI增强背景实质强化（BPE）分级',
    description:
      '背景实质强化程度：最低（<10% 腺体强化）、轻度（10%-25%）、中度（25%-50%）、重度（>50%）。增强形态：局灶、肿块、非肿块强化（线样/段样/区域/弥漫）。',
    management: 'BPE 影响检查敏感性；非肿块强化线样/段样分布需活检。',
    keywords: ['MRI', '背景实质强化', 'BPE', '非肿块强化', '段样'],
  },
  {
    category: 'BI-RADS',
    score: 'BI-RADS US',
    title: '超声附加特征（Ultrasound）',
    description:
      '超声评估：肿块形态（椭圆形、不规则）、方位（平行/不平行）、边缘（光整/模糊/角状/毛刺）、回声（无回声/低/等/高/混合）、后方回声（无变化/增强/衰减）。',
    management: '超声特征与钼靶/MRI 联合应用；不平行、角状、毛刺边缘提示恶性。',
    keywords: ['超声', '回声', '方位', '后方回声', '不平行', '角状'],
  },
  {
    category: 'BI-RADS',
    score: 'BI-RADS MG',
    title: '乳腺X线摄影附加特征（Mammography）',
    description:
      '投照位：CC（头尾位）、MLO（内外斜位）。重点评估：肿块、钙化、结构扭曲、非对称致密、皮肤及乳头改变、腋窝淋巴结。',
    management: 'CC+MLO 双体位为筛查标准；可疑征象追加加压/放大投照。',
    keywords: ['钼靶', 'CC', 'MLO', '加压', '放大'],
  },
];

// ============================================================
// 3. PI-RADS v2.1（前列腺 MRI 评分系统）
// ============================================================

export const PI_RADS_V21: RadsRule[] = [
  {
    category: 'PI-RADS',
    score: 'PZ-1',
    title: '外周带评分1——极低概率临床显著性前列腺癌',
    description:
      '外周带（PZ）DWI 未见异常或呈均匀低信号；DCE 无早期强化或呈弥漫性轻度强化。',
    management: '极低概率存在 csPCa（Gleason ≥7）；无需活检。',
    risk: 'csPCa 概率 <1%',
    keywords: ['外周带', 'DWI正常', '低信号', 'PZ', '阴性'],
  },
  {
    category: 'PI-RADS',
    score: 'PZ-2',
    title: '外周带评分2——低概率',
    description:
      '外周带可见局灶性线样/地图样低信号（DWI），ADC 图无对应明显低信号；或呈分叶状高信号但无低信号灶。',
    management: '低概率 csPCa；一般不建议活检。',
    risk: 'csPCa 概率低',
    keywords: ['外周带', '线样低信号', 'DWI', 'ADC', '低概率'],
  },
  {
    category: 'PI-RADS',
    score: 'PZ-3',
    title: '外周带评分3——可疑（模糊）',
    description:
      'DWI 示局灶性中度低信号伴 ADC 等/轻度低信号；DCE 早期强化、局灶性但不明确。病灶界限不清，难以明确良恶性。',
    management: '可疑病灶；结合 PSA、年龄、穿刺史决定是否活检；可 6-12 个月复查MRI。',
    risk: 'csPCa 概率约 10%-20%',
    followUp: '6-12个月复查MRI',
    keywords: ['外周带', '可疑', '中度低信号', 'ADC', 'DCE', '模糊'],
  },
  {
    category: 'PI-RADS',
    score: 'PZ-4',
    title: '外周带评分4——大概率 csPCa',
    description:
      'DWI 示局灶性明显低信号（≤1.5cm），ADC 明显低信号；或 DCE 早期强化（早于或同步于正常实质）。',
    management: '建议系统+靶向穿刺活检（MRI/超声融合）。',
    risk: 'csPCa 概率约 50%-70%',
    keywords: ['外周带', '明显低信号', 'ADC', 'DCE早期', '靶向穿刺'],
  },
  {
    category: 'PI-RADS',
    score: 'PZ-5',
    title: '外周带评分5——极大概率 csPCa',
    description:
      'DWI 示 >1.5cm 的明显低信号灶，或向外周带外延伸/侵犯包膜（T3a），或形态不规则、边界不清。',
    management: '立即活检确诊并分期；多学科治疗（根治/放疗/主动监测）。',
    risk: 'csPCa 概率 >90%',
    keywords: ['外周带', '明显低信号', '1.5cm以上', '包膜侵犯', 'T3a'],
  },
  {
    category: 'PI-RADS',
    score: 'TZ-1',
    title: '移行带评分1——极低概率',
    description:
      '移行带（TZ）T2WI 未见可疑病灶：均匀中等信号，或仅见包裹性结节（假包膜完整）。',
    management: '无需活检。',
    risk: 'csPCa 概率 <1%',
    keywords: ['移行带', 'T2WI', '包裹', '假包膜', '阴性'],
  },
  {
    category: 'PI-RADS',
    score: 'TZ-2',
    title: '移行带评分2——低概率',
    description:
      'T2WI 示局限但边缘清楚的均匀低信号区（结节），无包膜破坏；或典型良性前列腺增生（BPH）结节。',
    management: '低概率 csPCa，一般无需活检。',
    keywords: ['移行带', 'T2WI', '低信号', 'BPH', '局限'],
  },
  {
    category: 'PI-RADS',
    score: 'TZ-3',
    title: '移行带评分3——可疑',
    description:
      'T2WI 示中等/不均质低信号区，边缘模糊，或不符合 2/4/5 类特征。',
    management: '可疑病灶，结合临床指标决定活检策略；可复查。',
    risk: 'csPCa 概率约 15%-25%',
    followUp: '结合PSA动态复查',
    keywords: ['移行带', 'T2WI', '模糊', '不均质', '可疑'],
  },
  {
    category: 'PI-RADS',
    score: 'TZ-4',
    title: '移行带评分4——大概率 csPCa',
    description:
      'T2WI 示明确边界不清的均匀中度低信号灶，呈浸润性生长；或最大径 ≥1.5cm 的异常区。',
    management: '建议融合靶向穿刺活检。',
    risk: 'csPCa 概率约 50%-70%',
    keywords: ['移行带', 'T2WI', '边界不清', '浸润', '融合穿刺'],
  },
  {
    category: 'PI-RADS',
    score: 'TZ-5',
    title: '移行带评分5——极大概率 csPCa',
    description:
      'T2WI 示 >1.5cm 均匀中度低信号灶，形态不规则/分叶状，向包膜外或精囊腺侵犯（T3 征象）；或含1项侵袭性特征。',
    management: '立即活检并分期评估；多学科治疗。',
    risk: 'csPCa 概率 >90%',
    keywords: ['移行带', 'T2WI', '1.5cm以上', '包膜外', '精囊侵犯'],
  },
  {
    category: 'PI-RADS',
    score: '总评分',
    title: 'PI-RADS v2.1 评分规则（加权序列）',
    description:
      '外周带以 DWI 为主导序列（DWI≥3 则总分为DWI分；DWI=3 时结合 DCE——阳性则总评4，阴性则总评3）。移行带以 T2WI 为主导序列，DWI 辅助校正（DWI=4 可提升T2=3 至总评4）。',
    management: '记录每个病灶的DWI/T2WI/DCE 分项评分及总评分；csPCa 定义：PI-RADS 4-5。',
    keywords: ['加权', 'DWI', 'T2WI', 'DCE', '主导序列', '总分'],
  },
  {
    category: 'PI-RADS',
    score: 'E-1',
    title: '包膜外侵犯（EPE）评估',
    description:
      '前列腺包膜不规则、隆突，或病灶与包膜接触长度 >10mm、毗邻神经血管束增粗，提示 EPE。',
    management: 'EPE 影响手术决策；建议增强MRI + 临床风险评估。',
    keywords: ['EPE', '包膜', '神经血管束', '外侵'],
  },
];

// ============================================================
// 4. LI-RADS（肝脏影像报告和数据系统）
// ============================================================

export const LI_RADS_2018: RadsRule[] = [
  {
    category: 'LI-RADS',
    score: 'LR-1',
    title: '明确良性',
    description:
      '病灶具有明确良性特征：单纯囊肿、典型血管瘤（外周结节样强化并向心性填充）、灌注异常（非病灶）、胆管错构瘤、局灶性脂肪改变、典型铁沉积结节等。',
    management: '无需随访。',
    risk: '恶性概率 0%',
    keywords: ['良性', '囊肿', '血管瘤', '灌注异常', '错构瘤'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-2',
    title: '可能良性',
    description:
      '病灶可能良性但无明确诊断特征：如直径 <20mm 的无强化病灶、无特征结节、边界不清或可见轻度退变结节。',
    management: '可按常规随访或 6 个月复查。',
    risk: '恶性概率极低',
    keywords: ['可能良性', '无强化', '无特征', '随访'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-3',
    title: '中度恶性风险（不确定）',
    description:
      '不满足 LR-4/5 主要特征，也无明确良性特征。如：动脉期非环状强化（APHE）但无廓清（washout）；无APHE但伴廓清；或直径变化难以解释的结节。肝硬化背景下多见。',
    management: '6 个月增强MRI/CT随访；必要时活检或MDT讨论。',
    risk: '恶性概率中等（约10%-20%）',
    followUp: '6个月随访',
    keywords: ['不确定', 'LR-3', '无廓清', '无APHE', '肝硬化'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-4',
    title: '高度可疑肝细胞癌（HCC）',
    description:
      '具有以下任一特征：APHE + 廓清 + 包膜强化（任选其一不全）；APHE + 阈值增长（≥6个月内径线增长 ≥50%）；或无APHE 但伴廓清+包膜强化+阈值增长。',
    management: '建议活检或按HCC治疗（消融/切除/移植评估）；多学科讨论。',
    risk: '恶性概率高（约70%-80%）',
    keywords: ['HCC', 'APHE', '廓清', '包膜', '阈值增长'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-5',
    title: '明确为HCC',
    description:
      '至少符合以下两项主要特征：动脉期非环状强化（APHE）、非外周性廓清（washout）、包膜强化（capsule）。或 APHE + 阈值增长。非典型特征需排除LR-M（非HCC恶性）。',
    management: '确诊HCC，启动分期与治疗（BCLC分期导向：消融、切除、TACE、系统治疗）。',
    risk: '恶性概率 >95%（HCC特异性）',
    keywords: ['HCC', 'APHE', '廓清', '包膜', '确诊', 'BCLC'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-5us',
    title: '超声增强明确HCC（CEUS）',
    description:
      '超声造影（CEUS）示结节性增强（nodular enhancement）伴早期廓清（<60秒），符合LR-5us标准。',
    management: '可作HCC确诊依据启动治疗，无需活检。',
    risk: '恶性概率 >95%',
    keywords: ['CEUS', '超声造影', '结节性增强', '早期廓清'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-TIV',
    title: '静脉内肿瘤侵犯（Tumor in Vein）',
    description:
      '门静脉、肝静脉或肝段静脉内软组织填充（强化或不强化），提示肿瘤血管侵犯。常合并肝内病灶。',
    management: 'TIV 提示晚期（BCLC C/D），启动系统治疗或支持治疗；MDT。',
    keywords: ['TIV', '门静脉癌栓', '肝静脉', '血管侵犯', '癌栓'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-M',
    title: '可能/明确非HCC恶性（转移瘤/胆管癌）',
    description:
      '具有非HCC恶性特征：靶样强化（边缘强化伴内部低强化）、环形强化伴中央坏死、弥散受限明显、胆管扩张伴胆管壁增厚、转移灶分布（多发、不同期相）。',
    management: '活检明确病理；按转移瘤或胆管癌方案治疗（化疗/靶向/介入）。',
    keywords: ['LR-M', '靶样', '环形强化', '转移瘤', '胆管癌', '坏死'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-TR',
    title: '治疗反应评估（Treated）',
    description:
      '用于经局部治疗（消融、TACE、放疗、化疗栓塞）后病灶的疗效评估：LR-TR 非存活（无动脉期强化或完全坏死）、LR-TR 存活（残留强化）。',
    management: '按治疗反应调整治疗方案；存活病灶可再治疗。',
    keywords: ['治疗后', 'TACE', '消融', '存活', '坏死', '疗效'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-TR非存活',
    title: '治疗后无存活肿瘤',
    description:
      '治疗区域（消融带/TACE碘油沉积区）无动脉期强化、无廓清，或仅见良性反应性强化（周围环形炎性强化可存在但非结节样）。',
    management: '按方案定期随访（1-3个月后复查）。',
    keywords: ['坏死', '无存活', '碘油沉积', '消融带', '随访'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-TR存活',
    title: '治疗后残留存活肿瘤',
    description:
      '治疗区边缘或内部见结节状/厚壁动脉期强化伴廓清，符合存活肿瘤；或治疗区整体增大。',
    management: '建议补充局部治疗（消融补充/TACE）或调整方案；MDT。',
    keywords: ['残留', '存活', '边缘强化', '再治疗'],
  },
  {
    category: 'LI-RADS',
    score: 'LR-NC',
    title: '不可分类',
    description:
      '因图像质量差、技术因素或缺失检查序列，病灶无法按 LI-RADS 分类。',
    management: '重新扫描或补充序列（多期增强MRI）后重新评估。',
    keywords: ['不可分类', '图像质量', '序列缺失', '重扫'],
  },
];

// ============================================================
// 5. TI-RADS（甲状腺影像报告和数据系统，ACR 2017）
// ============================================================

export const TI_RADS_ACR: RadsRule[] = [
  {
    category: 'TI-RADS',
    score: 'TR1',
    title: '良性（0分）',
    description:
      '0 分结节：囊性/海绵状结节（+0），呈等回声（+1），宽大于高（+0），边缘光整（+0），无回声灶（+0）。典型为单纯囊肿或海绵状结节。',
    management: '无需活检；恶性概率 <0.3%，不需随访。',
    risk: '恶性概率 <0.3%',
    keywords: ['TR1', '海绵状', '囊性', '0分', '良性'],
  },
  {
    category: 'TI-RADS',
    score: 'TR2',
    title: '不可疑（2分）',
    description:
      '1-2 分结节：以囊性为主或等回声（+1）伴点状彗星尾（+1），边缘光整。',
    management: '无需活检；若 ≥2.5cm 可考虑超声随访（可选）。',
    risk: '恶性概率 <1.5%',
    keywords: ['TR2', '彗星尾', '囊性', '1-2分', '随访'],
  },
  {
    category: 'TI-RADS',
    score: 'TR3',
    title: '轻度可疑（3分）',
    description:
      '3 分结节：等回声/高回声（+1）+ 边缘不整（+2）；或低回声（+2）+ 边缘光整。',
    management: '仅当最大径 ≥2.5cm 时建议细针穿刺（FNA）。',
    risk: '恶性概率约 5%',
    keywords: ['TR3', '低回声', '边缘不整', '3分', 'FNA'],
  },
  {
    category: 'TI-RADS',
    score: 'TR4',
    title: '中度可疑（4-6分）',
    description:
      '4-6 分结节：低回声（+2）+ 边缘不整（+2）或分叶（+2）；或低回声+点状强回声（+3）。',
    management: '≥1.5cm 建议FNA；<1.5cm 随访（1-2年）。',
    risk: '恶性概率约 5%-20%',
    keywords: ['TR4', '低回声', '边缘不整', '点状强回声', '4-6分'],
  },
  {
    category: 'TI-RADS',
    score: 'TR5',
    title: '高度可疑（≥7分）',
    description:
      '≥7 分结节：极低回声（+3）+ 小叶状/不规则边缘（+3）+ 浸润性/高大于宽（+3）+ 微钙化（+3）任意组合。',
    management: '≥1.0cm 建议FNA；<1.0cm 可随访观察。',
    risk: '恶性概率约 35%-50%（TR5 ≥7分时 >35%）',
    keywords: ['TR5', '极低回声', '微钙化', '高大于宽', '浸润性边缘'],
  },
  {
    category: 'TI-RADS',
    score: 'FNA指征',
    title: 'FNA 指征汇总',
    description:
      'TR1/TR2：不穿刺；TR3：≥2.5cm 穿刺；TR4：≥1.5cm 穿刺（<1.5cm 随访）；TR5：≥1.0cm 穿刺。随访间隔：TR3 若随访可 1-2 年；TR4 需 1-2 年随访；TR5 需 1-2 年随访。',
    management: '按结节大小与 TI-RADS 分类决定 FNA；动态随访。',
    keywords: ['FNA', '指征', '穿刺', '随访', '大小'],
  },
  {
    category: 'TI-RADS',
    score: '成分',
    title: '成分评分（Composition）',
    description:
      '囊性/完全囊性（0分）；海绵状（0分）；囊实性混合（1分）；实性或近完全实性（2分）。',
    management: '实性成分占比高者恶性风险增加，作为TI-RADS总分组成部分。',
    keywords: ['成分', '囊性', '海绵状', '实性', '混合'],
  },
  {
    category: 'TI-RADS',
    score: '回声',
    title: '回声评分（Echogenicity）',
    description:
      '无回声（0分）；高/等回声（1分）；低回声（2分）；极低回声（3分）。',
    management: '低回声与恶性相关，参与总分计算。',
    keywords: ['回声', '低回声', '极低回声', '等回声'],
  },
  {
    category: 'TI-RADS',
    score: '形态',
    title: '形态评分（Shape）',
    description:
      '宽大于高（横径>前后径，0分）；高大于宽（前后径>横径，3分）。',
    management: '高大于宽（非平行生长）为恶性特征之一。',
    keywords: ['形态', '高大于宽', '宽大于高', '纵向生长'],
  },
  {
    category: 'TI-RADS',
    score: '边缘',
    title: '边缘评分（Margin）',
    description:
      '光整（0分）；不整/分叶（2分）；甲状腺外侵犯（3分）。',
    management: '边缘浸润提示恶性；外侵者需手术评估。',
    keywords: ['边缘', '光整', '不整', '分叶', '外侵'],
  },
  {
    category: 'TI-RADS',
    score: '回声灶',
    title: '回声灶评分（Echogenic Foci）',
    description:
      '无或彗星尾（0分）；粗大钙化（1分）；周边钙化（2分）；点状强回声（3分）。',
    management: '点状强回声（微钙化）为恶性最强影像特征之一。',
    keywords: ['钙化', '微钙化', '彗星尾', '周边钙化', '点状'],
  },
  {
    category: 'TI-RADS',
    score: '总分计算',
    title: '总分与分级对照',
    description:
      '各维度分值相加：0分=TR1；1-2分=TR2；3分=TR3；4-6分=TR4；≥7分=TR5。',
    management: '按总分定级后参考FNA指征表执行。',
    keywords: ['总分', 'TR1-TR5', '分级', '对照'],
  },
];

// ============================================================
// 汇总导出
// ============================================================

export const RADS_RULES: RadsRule[] = [
  ...LUNG_RADS_2019,
  ...BI_RADS_2013,
  ...PI_RADS_V21,
  ...LI_RADS_2018,
  ...TI_RADS_ACR,
];

/** 按系统筛选 RADS 规则 */
export function filterBySystem(system: RadsSystem): RadsRule[] {
  return RADS_RULES.filter((r) => r.category === system);
}

/** 关键词检索：匹配 score/title/description/keywords 字段 */
export function searchRadsRules(
  query: string,
  system?: RadsSystem,
): RadsRule[] {
  const q = query.trim().toLowerCase();
  if (!q) return system ? filterBySystem(system) : RADS_RULES;
  return RADS_RULES.filter((r) => {
    const hit =
      r.score.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.keywords.some((k) => k.toLowerCase().includes(q));
    return hit && (system ? r.category === system : true);
  });
}

/** 按分类名精确查找 */
export function findByScore(system: RadsSystem, score: string): RadsRule[] {
  return RADS_RULES.filter(
    (r) => r.category === system && r.score === score,
  );
}
