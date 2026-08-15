/**
 * 报告书写参考库（Reporting Reference）
 * 供报告书写、医生培训、规范参考
 */
export interface ReportReferenceItem {
  code: string
  category: '测量参考' | '评分标准' | '报告规范' | '病变描述' | '随访建议'
  title: string
  content: string[]
  tags: string[]
}

export const REPORT_REFERENCE_ITEMS: ReportReferenceItem[] = [
  {
    code: 'REF-001',
    category: '测量参考',
    title: '正常甲状腺体积与超声测量',
    content: [
      '甲状腺正常体积：男性 12-20ml，女性 10-18ml',
      '侧叶长径 4-6cm，前后径 1.5-2cm，宽度 2-2.5cm',
      '峡部厚度 ≤3mm',
      '回声：与唾液腺相比呈均匀中等回声',
      '血流：腺体血流信号轻度（3 级分类中 I-II 级为主）',
    ],
    tags: ['甲状腺', '超声', '测量'],
  },
  {
    code: 'REF-002',
    category: '测量参考',
    title: '肝右叶前后径正常值',
    content: [
      '肝右叶前后径（锁骨中线）≤13cm',
      '肝右叶斜径 ≤15cm',
      '左叶上下径 8-10cm，前后径 5-7cm',
      '门静脉主干内径 10-13mm',
      '肝静脉内径 <10mm',
    ],
    tags: ['肝脏', '超声', 'CT', '测量'],
  },
  {
    code: 'REF-003',
    category: '测量参考',
    title: '脾脏大小参考值',
    content: [
      '脾脏长径 ≤12cm，厚径 ≤4cm',
      '脾静脉内径 <8mm',
      '脾指数（长×宽×厚）<480cm³',
      '脾脏增大分级：轻度（12-15cm）、中度（15-20cm）、重度（>20cm）',
    ],
    tags: ['脾脏', '测量'],
  },
  {
    code: 'REF-004',
    category: '测量参考',
    title: '肾大小与肾积水分级',
    content: [
      '肾脏长径 10-12cm，皮质厚度 1-1.5cm',
      '肾积水分级（SFU）：I 级肾盂分离 <7mm，II 级 7-10mm，III 级 >10mm 伴肾盏扩张，IV 级肾实质变薄',
      '成人肾盂分离 ≥10mm 提示梗阻（膀胱充盈时除外）',
    ],
    tags: ['肾脏', '测量', '积水'],
  },
  {
    code: 'REF-005',
    category: '测量参考',
    title: '主动脉直径参考值',
    content: [
      '升主动脉 20-37mm（40 岁后每岁 +1mm 上限）',
      '降主动脉 20-30mm',
      '腹主动脉 15-25mm（≥30mm 为动脉瘤）',
      '主肺动脉 15-25mm（≥29mm 提示肺动脉高压）',
    ],
    tags: ['主动脉', '测量'],
  },
  {
    code: 'REF-006',
    category: '评分标准',
    title: 'ASPECTS 评分（急性缺血性卒中）',
    content: [
      '10 分制：每受累区域扣 1 分',
      '区域：尾状核、豆状核、内囊、岛带、M1-M6 皮质',
      'CT 早期缺血征（低密度/灰白质分界模糊）',
      'ASPECTS ≤7 提示大面积梗死，取栓需综合评估',
    ],
    tags: ['卒中', 'ASPECTS', '评分'],
  },
  {
    code: 'REF-007',
    category: '评分标准',
    title: 'GCS 评分（格拉斯哥昏迷）',
    content: [
      '睁眼反应：4 分自发睁眼 / 3 分呼唤睁眼 / 2 分刺痛睁眼 / 1 分无反应',
      '语言反应：5 分正常交谈 / 4 分言语混乱 / 3 分词语不清 / 2 分仅有发声 / 1 分无反应',
      '运动反应：6 分遵嘱动作 / 5 分定位刺痛 / 4 分回缩反应 / 3 分屈曲异常 / 2 分伸展异常 / 1 分无反应',
      '总分 3-15 分：≤8 分提示昏迷',
    ],
    tags: ['GCS', '昏迷', '评分'],
  },
  {
    code: 'REF-008',
    category: '评分标准',
    title: 'BI-RADS 分类速查',
    content: [
      '0 类：评估不完整，需追加检查',
      '1 类：阴性',
      '2 类：良性',
      '3 类：可能良性（恶性可能 <2%），建议 6 个月随访',
      '4A：低度可疑（2-10%），建议活检',
      '4B：中度可疑（10-50%）',
      '4C：高度可疑（50-95%）',
      '5 类：几乎肯定恶性（>95%）',
      '6 类：已证实恶性（活检后）',
    ],
    tags: ['乳腺', 'BI-RADS', '评分'],
  },
  {
    code: 'REF-009',
    category: '评分标准',
    title: 'Lung-RADS 分类速查（2019 版）',
    content: [
      '1 类：阴性（恶性可能 <1%）',
      '2 类：良性结节（<1%）',
      '3 类：可能良性（1-2%），建议 6 个月随访',
      '4A：可疑（5-15%），建议 3 个月随访/增强',
      '4B：高度可疑（>15%），建议增强/活检',
      '4X：4A/4B 伴恶性特征（毛刺/分叶）',
      'S 类：其他临床发现（非结节）',
    ],
    tags: ['肺结节', 'Lung-RADS', '评分'],
  },
  {
    code: 'REF-010',
    category: '评分标准',
    title: 'PI-RADS v2.1 要点',
    content: [
      '基于 T2WI（周边带）+ DWI（弥散）评分 1-5 分',
      '周边带：DWI 为主；移行带：T2WI 为主',
      'PI-RADS 3：可疑，建议 6-12 个月随访或活检（临床决策）',
      'PI-RADS 4：高度可疑，建议活检',
      'PI-RADS 5：极可能临床显著癌（>1.5cm/侵犯包膜外）',
    ],
    tags: ['前列腺', 'PI-RADS', '评分'],
  },
  {
    code: 'REF-011',
    category: '评分标准',
    title: 'TI-RADS 甲状腺结节分类',
    content: [
      'TR1：良性（纯囊性/海绵样）',
      'TR2：良性（<2%恶性）',
      'TR3：轻度可疑（5%）',
      'TR4：中度可疑（5-80%）',
      'TR5：高度可疑（>80%）',
      '恶性征象：实性、低回声、边缘不规则、微钙化、高大于宽',
    ],
    tags: ['甲状腺', 'TI-RADS', '评分'],
  },
  {
    code: 'REF-012',
    category: '评分标准',
    title: 'CT 肝段划分（Couinaud 八段）',
    content: [
      '肝静脉为段间分界：肝中静脉分左右叶',
      '门静脉为段内分界：门脉左支分 II-IV 段，右支分 V-VIII 段',
      '尾状叶 = I 段（肝静脉后/门静脉分叉上）',
      '左外叶 = II+III 段，左内叶 = IV 段',
      '右前叶 = V+VIII 段，右后叶 = VI+VII 段',
    ],
    tags: ['肝脏', '解剖', 'Couinaud'],
  },
  {
    code: 'REF-013',
    category: '病变描述',
    title: '肺结节描述模板',
    content: [
      '位置：右肺上叶前段（RUL anterior）',
      '大小：长径 × 短径（mm），注明测量层面',
      '密度：实性 / 磨玻璃 / 部分实性（实性成分比例）',
      '边缘：光滑 / 分叶 / 毛刺 / 棘突',
      '内部：钙化（粗大/点状）、脂肪、空洞',
      '周围：血管集束、胸膜牵拉、卫星灶',
      '随访对比：较前变化（增大/缩小/稳定）',
    ],
    tags: ['肺结节', '描述', '模板'],
  },
  {
    code: 'REF-014',
    category: '病变描述',
    title: '肝脏占位描述要点',
    content: [
      '位置（段）+ 大小三维',
      '边界/包膜',
      '密度/回声：CT HU 值、超声回声（高/低/等/混合）',
      '增强表现：动脉期强化模式（快进快出/持续强化/环形强化）',
      '门脉期/延迟期廓清',
      '有无坏死/出血/钙化/脂肪',
      '胆管扩张/血管侵犯/淋巴结',
      '对比既往影像',
    ],
    tags: ['肝脏', '占位', '描述'],
  },
  {
    code: 'REF-015',
    category: '病变描述',
    title: '椎间盘突出描述规范',
    content: [
      '部位：节段（L4/5）+ 中央/旁中央/侧方/椎间孔',
      '类型：膨出/突出/脱出/游离',
      '大小：前后径（mm）+ 突出程度（轻度/中度/重度）',
      '神经根/硬膜囊受压程度',
      '马尾综合征征象（急诊指征）',
      '椎管狭窄合并情况',
      '骨赘/韧带肥厚等退变并存',
    ],
    tags: ['椎间盘', '描述', '规范'],
  },
  {
    code: 'REF-016',
    category: '随访建议',
    title: '肺结节随访建议（按 Lung-RADS）',
    content: [
      'Lung-RADS 2：年度低剂量 CT 随访',
      'Lung-RADS 3：6 个月低剂量 CT 随访',
      'Lung-RADS 4A：3 个月随访或增强检查',
      'Lung-RADS 4B/4X：建议增强 CT/活检',
      '磨玻璃结节持续存在 ≥8mm：6-12 个月复查，稳定后年度随访',
      '结节增大（长径 +2mm 或体积 +20%）：缩短随访间隔',
    ],
    tags: ['肺结节', '随访'],
  },
  {
    code: 'REF-017',
    category: '随访建议',
    title: '甲状腺结节随访建议（ACR TI-RADS）',
    content: [
      'TR1/TR2：无需超声随访（良性）',
      'TR3：1 年随访，稳定后 2 年',
      'TR4：6-12 个月随访',
      'TR5：6 个月随访或活检（≥1cm）',
      '结节增大（体积增加 >50% 或两个径线 +2mm）：缩短间隔',
      '新发可疑淋巴结：及时活检',
    ],
    tags: ['甲状腺', '随访'],
  },
  {
    code: 'REF-018',
    category: '随访建议',
    title: '腹主动脉瘤随访建议',
    content: [
      '直径 3.0-3.9cm：3 年超声随访',
      '直径 4.0-4.9cm：12 个月随访',
      '直径 5.0-5.4cm：6 个月随访（考虑外科评估）',
      '直径 ≥5.5cm（男性）/≥5.0cm（女性）：转外科评估',
      '增长速率 >5mm/年：缩短随访间隔',
      '症状性动脉瘤：急诊评估',
    ],
    tags: ['主动脉瘤', '随访'],
  },
  {
    code: 'REF-019',
    category: '随访建议',
    title: '肝囊肿/血管瘤随访建议',
    content: [
      '单纯性肝囊肿（Bosniak 1）：无需随访',
      '典型血管瘤：无需随访（明确影像特征时）',
      '不典型血管瘤：6-12 个月复查确认稳定',
      '复杂囊肿（Bosniak 2F）：6 个月复查，稳定后 1-2 年',
      'Bosniak 3/4：转外科评估',
    ],
    tags: ['肝脏', '囊肿', '血管瘤', '随访'],
  },
  {
    code: 'REF-020',
    category: '报告规范',
    title: '影像报告结构规范',
    content: [
      '患者信息：姓名、性别、年龄、检查号',
      '检查信息：检查方法、日期、部位',
      '临床背景：主诉/诊断/检查目的',
      '影像所见：按解剖结构系统描述',
      '诊断意见：主要阳性发现 + 可能诊断',
      '建议：随访/增强/穿刺等',
      '签名：书写医生 + 审核医生',
      '报告时效：危急值即时通知，普通 2 小时内',
    ],
    tags: ['报告', '规范', '结构'],
  },
  {
    code: 'REF-021',
    category: '报告规范',
    title: '危急值报告时限与流程',
    content: [
      '危急值定义：危及生命的影像发现',
      '时限：检出后 10 分钟内电话通知',
      '流程：检出 → 双人确认 → 电话通知开单科室 → 记录（时间/接收人）→ 系统留痕',
      '常见危急值：急性脑出血、主动脉夹层、大面积肺栓塞、张力性气胸、消化道穿孔等',
      '通知失败：升级至科室主任/医务科',
    ],
    tags: ['危急值', '报告', '流程'],
  },
  {
    code: 'REF-022',
    category: '病变描述',
    title: '骨折描述规范',
    content: [
      '部位：骨段（骨干/干骺端/关节内）+ 侧别',
      '类型：横形/斜形/螺旋/粉碎/青枝（儿童）',
      '移位：成角方向 + 角度、重叠/分离程度（占骨径%）',
      '关节面受累：台阶 >2mm 提示手术指征',
      '合并损伤：血管/神经/韧带',
      '多发骨折：注明全部位置',
      '陈旧性鉴别：骨痂/硬化缘',
    ],
    tags: ['骨折', '描述', '规范'],
  },
  {
    code: 'REF-023',
    category: '测量参考',
    title: '心腔大小超声参考值',
    content: [
      '左房前后径 ≤38mm，左房容积指数 ≤34ml/m²',
      '左室舒张末期内径 38-56mm（女性 38-52mm）',
      '室间隔厚度 6-11mm，左室后壁 6-11mm',
      '右室前后径 ≤42mm（心尖四腔）',
      '射血分数（EF）：正常 ≥52%（Simpson 双平面）',
      'E/A 比值：正常 1-2（老年人可逆）',
    ],
    tags: ['心脏', '超声', '测量'],
  },
  {
    code: 'REF-024',
    category: '测量参考',
    title: '颈动脉内中膜厚度（IMT）参考',
    content: [
      'IMT 正常 <0.9mm',
      '0.9-1.3mm：内膜增厚',
      '>1.3mm：斑块形成（局限性 >1.5mm 或向腔内突起）',
      '斑块性质：软斑（低回声）、硬斑（钙化）、混合斑',
      '狭窄分级：<50%、50-69%、70-99%、闭塞',
    ],
    tags: ['颈动脉', 'IMT', '测量'],
  },
  {
    code: 'REF-025',
    category: '评分标准',
    title: '肺栓塞严重指数（PESI）要点',
    content: [
      '年龄 +1 分/年',
      '男性 +10，癌症 +30，心衰/肺病 +10，HR≥110 +20，SBP<100 +30，RR≥30 +20，T<36 +20，意识改变 +60，SpO2<90 +20',
      '分级：I-II 级（≤105 分）低危，III 级（106-125）中危，IV-V 级（>125）高危',
      '高危患者考虑溶栓/介入',
    ],
    tags: ['肺栓塞', 'PESI', '评分'],
  },
]

export function findReferenceByCategory(category: ReportReferenceItem['category']): ReportReferenceItem[] {
  return REPORT_REFERENCE_ITEMS.filter((r) => r.category === category)
}

export function searchReportReferences(keyword: string): ReportReferenceItem[] {
  const k = keyword.trim().toLowerCase()
  if (!k) return REPORT_REFERENCE_ITEMS
  return REPORT_REFERENCE_ITEMS.filter(
    (r) =>
      r.title.includes(k) ||
      r.tags.some((t) => t.includes(k)) ||
      r.content.some((c) => c.includes(k)) ||
      r.code.toLowerCase().includes(k),
  )
}

export const REFERENCE_CATEGORY_STATS: { category: ReportReferenceItem['category']; count: number }[] = [
  '测量参考',
  '评分标准',
  '报告规范',
  '病变描述',
  '随访建议',
].map((c) => ({
  category: c as ReportReferenceItem['category'],
  count: REPORT_REFERENCE_ITEMS.filter((r) => r.category === c).length,
}))
