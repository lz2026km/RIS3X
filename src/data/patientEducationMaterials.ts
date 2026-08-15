/**
 * 患者宣教资料库（Patient Education Materials）
 * 供患者门户、自助服务、知情同意参考
 */
export interface PatientEducationMaterial {
  code: string
  title: string
  category: '检查准备' | '检查过程' | '报告解读' | '术后护理' | '辐射安全' | '对比剂' | '随访管理'
  modality?: string
  targetAudience: string
  keyPoints: string[]
  commonQuestions: { question: string; answer: string }[]
  warnings: string[]
  duration?: string
  fasting?: string
  medication?: string
  postCare?: string[]
}

export const PATIENT_EDUCATION_MATERIALS: PatientEducationMaterial[] = [
  {
    code: 'EDU-001',
    title: 'CT 增强检查须知',
    category: '检查准备',
    modality: 'CT',
    targetAudience: '拟行 CT 增强检查患者',
    keyPoints: ['检查前禁食 4 小时', '去除金属饰品', '告知医生药物过敏史', '签署知情同意书'],
    commonQuestions: [
      { question: '为什么需要空腹？', answer: '空腹可减少注射对比剂后的恶心呕吐风险，保证图像质量。' },
      { question: '检查大概需要多长时间？', answer: '平扫约 5-10 分钟，增强约 15-20 分钟。' },
      { question: '对比剂对身体有影响吗？', answer: '大多数患者耐受良好，少数可出现轻度不适（发热感、金属味），通常短暂。' },
    ],
    warnings: ['已知对比剂严重过敏史者需提前告知', '肾功能不全患者需提前告知医生', '妊娠患者需告知医生'],
    duration: '15-20 分钟',
    fasting: '禁食 4 小时',
    postCare: ['检查后多饮水促进对比剂排出', '留观 30 分钟无不适方可离开', '穿刺点按压 5 分钟'],
  },
  {
    code: 'EDU-002',
    title: 'MR 检查须知',
    category: '检查准备',
    modality: 'MR',
    targetAudience: '拟行磁共振检查患者',
    keyPoints: ['去除所有金属物品（首饰/手表/发夹）', '告知体内植入物（起搏器/人工关节/金属夹）', '检查前禁食 4-6 小时（腹部/增强）', '持有磁卡需远离磁场'],
    commonQuestions: [
      { question: '磁共振有辐射吗？', answer: '磁共振不使用电离辐射，利用强磁场成像，对人体无已知损伤。' },
      { question: '检查时会听到噪音吗？', answer: '会听到类似敲击的噪音，属正常现象，会提供耳塞保护听力。' },
      { question: '幽闭恐惧症可以检查吗？', answer: '可以告知医生，必要时可给予镇静或在开放型设备检查。' },
    ],
    warnings: ['体内有心脏起搏器者绝对禁忌', '眼内金属异物者需先评估', '妊娠早期需医生评估'],
    duration: '20-40 分钟',
    fasting: '腹部/增强检查禁食 4-6 小时',
    postCare: ['无特殊限制', '增强检查后多饮水'],
  },
  {
    code: 'EDU-003',
    title: 'PET-CT 检查须知',
    category: '检查准备',
    modality: 'PET-CT',
    targetAudience: '拟行 PET-CT 检查患者',
    keyPoints: ['检查前禁食 4-6 小时（可饮水）', '血糖控制在 7.8 mmol/L 以下', '检查前 24 小时避免剧烈运动', '多饮水', '注射显像剂后安静休息 1 小时'],
    commonQuestions: [
      { question: 'PET-CT 辐射大吗？', answer: '一次 PET-CT 辐射约 7-14 mSv，与常规 CT 增强相近，获益大于风险。' },
      { question: '糖尿病可以检查吗？', answer: '可以，但需控制血糖；医生会根据血糖水平决定是否延后检查。' },
      { question: '检查后多久可以接触家人？', answer: '检查后 4 小时内避免与孕妇、婴幼儿密切接触，之后无特殊限制。' },
    ],
    warnings: ['妊娠患者原则上不进行', '哺乳期患者需暂停哺乳 4 小时以上', '严重糖尿病酮症需先处理'],
    duration: '全程约 2-3 小时（含等待期）',
    fasting: '禁食 4-6 小时',
    postCare: ['多饮水促进显像剂排出', '当天避免与孕妇婴幼儿密切接触'],
  },
  {
    code: 'EDU-004',
    title: '超声检查须知',
    category: '检查准备',
    modality: '超声',
    targetAudience: '拟行超声检查患者',
    keyPoints: ['腹部超声需空腹 8 小时', '泌尿系/妇科超声需充盈膀胱', '甲状腺/乳腺/血管超声无需特殊准备', '穿着宽松衣物便于暴露检查部位'],
    commonQuestions: [
      { question: '为什么腹部超声要空腹？', answer: '空腹可减少胃肠气体干扰，胆囊充盈便于评估。' },
      { question: '超声有辐射吗？', answer: '超声使用声波成像，无电离辐射，孕妇也可安全使用。' },
    ],
    warnings: [],
    duration: '10-30 分钟',
    fasting: '腹部检查空腹 8 小时',
  },
  {
    code: 'EDU-005',
    title: '数字化乳腺摄影（钼靶）须知',
    category: '检查准备',
    modality: 'MG',
    targetAudience: '拟行乳腺钼靶检查女性患者',
    keyPoints: ['检查时间建议在月经结束后 7-10 天', '检查前不使用腋下止汗剂/粉剂', '穿分体衣物', '检查时需配合压迫乳房（短暂不适）'],
    commonQuestions: [
      { question: '钼靶检查疼吗？', answer: '检查时乳房被短暂压迫（约 10-20 秒/幅），有轻度不适，可忍受。' },
      { question: '辐射剂量大吗？', answer: '单次钼靶辐射剂量约 0.4 mSv，远低于 CT。' },
      { question: '多久出结果？', answer: '通常 1-2 个工作日，加急可当日。' },
    ],
    warnings: ['妊娠患者需告知医生', '乳房有伤口/感染时需暂缓'],
    duration: '15-20 分钟',
  },
  {
    code: 'EDU-006',
    title: '消化道钡餐检查须知',
    category: '检查准备',
    modality: 'DR',
    targetAudience: '拟行上消化道钡餐患者',
    keyPoints: ['检查前禁食 8-12 小时', '检查当日停用影响胃肠动力药物', '穿无金属衣物'],
    commonQuestions: [
      { question: '钡剂有副作用吗？', answer: '钡剂不被人体吸收，检查后随粪便排出，少数人可有便秘。' },
      { question: '检查后多久可进食？', answer: '检查结束后即可进食，多饮水促进钡剂排出。' },
    ],
    warnings: ['肠梗阻患者禁做', '吞咽困难严重者需评估'],
    duration: '20-30 分钟',
    fasting: '禁食 8-12 小时',
    postCare: ['多饮水促进钡剂排出', '如 2-3 天未排便需就医'],
  },
  {
    code: 'EDU-007',
    title: '放射检查辐射安全常识',
    category: '辐射安全',
    targetAudience: '全体受检者',
    keyPoints: ['常规单次 X 线/CT 辐射剂量安全可控', '辐射剂量：DR 0.02-0.1 mSv，CT 平扫 1-10 mSv', '检查获益远大于风险', '不必要的检查应避免', '妊娠患者务必告知医生'],
    commonQuestions: [
      { question: '一年最多能做几次 CT？', answer: '没有绝对上限，但医生会权衡利弊；常规诊疗所需的检查次数均在安全范围内。' },
      { question: '儿童做 CT 安全吗？', answer: '儿童检查采用儿童专用低剂量方案，辐射防护要求更严格。' },
      { question: '检查后体内会残留辐射吗？', answer: '检查结束后体内不残留辐射（放射治疗/核医学检查除外）。' },
    ],
    warnings: ['妊娠或可能妊娠者务必告知', '非必要不重复检查'],
  },
  {
    code: 'EDU-008',
    title: '对比剂使用知情要点',
    category: '对比剂',
    targetAudience: '拟行增强检查（CT/MR）患者',
    keyPoints: ['增强检查需静脉注射对比剂', 'CT 使用碘对比剂，MR 使用钆对比剂', '注射时可有发热感/金属味（正常）', '告知过敏史、哮喘、肾功能情况'],
    commonQuestions: [
      { question: '对比剂过敏会有什么表现？', answer: '轻者皮疹瘙痒，重者呼吸困难——出现任何不适立即告知技师/医生，现场有抢救设备和药物。' },
      { question: '肾功能不好能打对比剂吗？', answer: '需医生评估，必要时改用不含碘/钆的检查或采取预防措施。' },
      { question: '哺乳期可以检查吗？', answer: '碘对比剂建议暂停哺乳 24 小时；钆对比剂建议暂停 24 小时（欧洲指南）。' },
    ],
    warnings: ['过敏史者提前告知', '肾功能异常者提前告知', '妊娠患者原则上不用'],
    postCare: ['检查后多饮水（24 小时内 1500-2000ml）', '观察穿刺点'],
  },
  {
    code: 'EDU-009',
    title: '介入手术术前须知',
    category: '检查准备',
    targetAudience: '拟行介入手术患者',
    keyPoints: ['术前禁食 6-8 小时（具体遵医嘱）', '术前停用抗凝/抗血小板药物（遵医嘱）', '术前完善化验（凝血/肾功能/血常规）', '签署知情同意书', '术前备皮、建立静脉通路'],
    commonQuestions: [
      { question: '介入手术是大手术吗？', answer: '介入手术多为微创，通过穿刺血管完成，创伤小、恢复快。' },
      { question: '手术需要全麻吗？', answer: '多数介入手术采用局麻+镇静，少数复杂手术需全麻，麻醉医生会评估。' },
      { question: '术后多久能下床？', answer: '穿刺点不同而异：股动脉需卧床 6-12 小时，桡动脉 2-4 小时。' },
    ],
    warnings: ['术前如实告知用药史（抗凝药）', '对造影剂过敏者告知', '发热、感冒等不适告知医生'],
    duration: '30 分钟-3 小时（视手术类型）',
    fasting: '禁食 6-8 小时',
    postCare: ['术后卧床制动（按穿刺部位）', '观察穿刺点出血/肿胀', '多饮水', '遵医嘱用药'],
  },
  {
    code: 'EDU-010',
    title: '报告领取与解读说明',
    category: '报告解读',
    targetAudience: '已接受放射检查患者',
    keyPoints: ['检查报告由放射科医生书写并审核后发布', '报告包括：影像所见、诊断意见、建议', '报告仅供参考，最终诊断请咨询临床医生', '可凭取片凭条/身份证领取'],
    commonQuestions: [
      { question: '报告多久能出？', answer: '门诊检查通常 2 小时内出报告，特殊检查（如 PET-CT、MRI 增强）需 1-2 个工作日。' },
      { question: '报告上的专业术语看不懂怎么办？', answer: '可咨询就诊医生解读，或使用医院提供的报告解读服务。' },
      { question: '报告丢失了能补打吗？', answer: '可携带有效证件到放射科登记处申请补打，部分医院支持线上查看。' },
    ],
    warnings: ['危急值报告医院会主动电话通知', '报告结果请及时与临床医生沟通'],
  },
  {
    code: 'EDU-011',
    title: '磁共振增强（钆对比剂）须知',
    category: '对比剂',
    modality: 'MR',
    targetAudience: '拟行 MR 增强检查患者',
    keyPoints: ['需静脉注射钆对比剂', '注射后立即扫描（增强序列）', '肾功能严重不全者需评估（肾源性系统性纤维化风险）'],
    commonQuestions: [
      { question: '钆对比剂安全吗？', answer: '常规剂量下安全；重度肾功能不全者需医生评估风险获益。' },
    ],
    warnings: ['严重肾功能不全者提前告知'],
    duration: '30-50 分钟',
    postCare: ['多饮水'],
  },
  {
    code: 'EDU-012',
    title: '骨密度检查（DXA）须知',
    category: '检查过程',
    modality: 'DXA',
    targetAudience: '拟行骨密度检查患者',
    keyPoints: ['检查前 24 小时停服钙剂', '检查时需去除金属物品', '检查部位：腰椎+髋部（常规）', '近期做过钡餐/核医学检查需告知（可能影响结果）'],
    commonQuestions: [
      { question: '骨密度检查有辐射吗？', answer: 'DXA 辐射剂量极低（约 0.001-0.01 mSv），接近自然本底水平。' },
      { question: '多久出结果？', answer: '通常 1-2 小时可出报告（T 值/骨量评估）。' },
    ],
    warnings: ['妊娠患者不做', '近期做过钡餐/核素检查者延迟'],
    duration: '10-15 分钟',
  },
  {
    code: 'EDU-013',
    title: '核医学检查后的防护建议',
    category: '辐射安全',
    targetAudience: '已完成核医学检查/治疗患者',
    keyPoints: ['检查后多饮水促进放射性药物排出', '当日避免与孕妇、婴幼儿密切接触（<1 米距离）', '勤洗手，使用独立毛巾', '治疗剂量（如 131I）需按医嘱隔离', '排泄物注意冲净马桶'],
    commonQuestions: [
      { question: '体内辐射多久消失？', answer: '取决于所用药物：多数诊断用药物 24 小时内大部分排出；治疗药物按医嘱。' },
      { question: '多久可以抱孩子？', answer: '诊断检查后 24 小时以上；治疗剂量需遵医嘱（通常 7 天以上）。' },
    ],
    warnings: ['治疗患者严格隔离期', '哺乳期患者暂停哺乳时间遵医嘱'],
  },
  {
    code: 'EDU-014',
    title: '乳腺超声检查须知',
    category: '检查准备',
    modality: '超声',
    targetAudience: '拟行乳腺超声检查女性患者',
    keyPoints: ['无需特殊准备', '检查时上衣需上抬暴露胸部', '最佳检查时间：月经结束后 5-10 天', '穿着分体衣物'],
    commonQuestions: [
      { question: '乳腺超声和钼靶选哪个？', answer: '超声对致密型乳腺和年轻女性敏感，钼靶对钙化敏感；医生会根据年龄和情况选择或联合。' },
    ],
    warnings: [],
    duration: '15-20 分钟',
  },
  {
    code: 'EDU-015',
    title: '下肢静脉造影须知',
    category: '检查过程',
    modality: 'DSA',
    targetAudience: '拟行下肢静脉造影患者',
    keyPoints: ['检查前禁食 4-6 小时', '穿宽松衣物', '告知医生抗凝药物使用情况', '签署知情同意'],
    commonQuestions: [
      { question: '造影疼吗？', answer: '穿刺时有轻微疼痛，造影剂注入时可能有发热感。' },
    ],
    warnings: ['对比剂过敏者告知', '严重肾功能不全者评估'],
    duration: '30-45 分钟',
    postCare: ['穿刺点按压 5-10 分钟', '多饮水'],
  },
  {
    code: 'EDU-016',
    title: '胸部 X 线检查须知',
    category: '检查准备',
    modality: 'DR',
    targetAudience: '拟行胸部 X 线检查患者',
    keyPoints: ['去除胸部金属物品（项链/胸罩钢圈）', '穿无金属衣物', '按技师指示深吸气后屏气', '妊娠患者告知医生'],
    commonQuestions: [
      { question: '胸片辐射大吗？', answer: '单次胸片辐射约 0.02-0.1 mSv，剂量很低，安全。' },
      { question: '结果多久出？', answer: '急诊 30 分钟内，门诊通常 2 小时内。' },
    ],
    warnings: ['妊娠患者告知'],
    duration: '5-10 分钟',
  },
  {
    code: 'EDU-017',
    title: '穿刺活检术后护理',
    category: '术后护理',
    targetAudience: '已完成穿刺活检患者',
    keyPoints: ['术后按压穿刺点 15-30 分钟', '观察穿刺点出血/血肿', '肺穿刺后需观察 2-4 小时（气胸风险）', '避免剧烈运动 24 小时', '遵医嘱使用抗生素（必要时）'],
    commonQuestions: [
      { question: '活检后能洗澡吗？', answer: '24 小时内保持穿刺点干燥，之后可正常淋浴。' },
      { question: '病理结果多久出？', answer: '常规病理 3-7 个工作日，免疫组化需更长时间。' },
    ],
    warnings: ['胸痛/呼吸困难/大量出血立即就医', '发热超过 38℃ 就医'],
    postCare: ['24 小时内避免重体力劳动', '穿刺点保持干燥'],
  },
  {
    code: 'EDU-018',
    title: '随访管理须知',
    category: '随访管理',
    targetAudience: '需定期随访复查患者',
    keyPoints: ['医生会根据病情制定随访计划', '请按时复诊（可通过医院随访系统/电话提醒）', '随访间隔可能为 1-3-6-12 个月', '复查时携带既往影像资料', '症状变化及时就诊（不必等预约时间）'],
    commonQuestions: [
      { question: '随访和复查有区别吗？', answer: '随访是系统的定期观察计划，复查是其中的一次检查；两者常结合进行。' },
      { question: '忘记随访时间怎么办？', answer: '医院会通过短信/电话提醒；错过可主动联系随访中心重新安排。' },
    ],
    warnings: ['出现新症状（疼痛/体重下降/出血）及时就诊', '影像资料妥善保管便于对比'],
  },
  {
    code: 'EDU-019',
    title: '放疗定位 CT 检查须知',
    category: '检查准备',
    modality: 'CT',
    targetAudience: '拟行放射治疗定位 CT 患者',
    keyPoints: ['按医嘱保持膀胱充盈/排空状态', '去除金属物品', '保持体位固定（配合固定装置）', '呼吸训练（如腹部加压）', '体表标记线勿擦除'],
    commonQuestions: [
      { question: '定位 CT 和诊断 CT 有区别吗？', answer: '定位 CT 用于放疗计划设计，需体位固定和体表标记，扫描范围按放疗需要。' },
      { question: '体表标记线能洗掉吗？', answer: '不能自行擦除，褪色请放疗技师补画。' },
    ],
    warnings: ['体表标记线脱落及时补画'],
    duration: '20-40 分钟',
  },
  {
    code: 'EDU-020',
    title: '检查预约改期须知',
    category: '检查准备',
    targetAudience: '需改期/取消检查患者',
    keyPoints: ['改期至少提前 1 个工作日', '可通过医院 App/电话/窗口办理', '特殊检查（增强/钡餐）改期需重新准备（空腹等）', '退费按医院流程办理'],
    commonQuestions: [
      { question: '临时有事可以当天改期吗？', answer: '可联系登记处协调，但可能需等待空档或重新预约。' },
      { question: '预约了没去会怎样？', answer: '未按时检查会占用资源，建议提前取消；医院可能收取相应费用（按政策）。' },
    ],
    warnings: ['增强检查当天改期请及时告知（已注射准备）'],
  },
]

export function findEducationByCategory(category: PatientEducationMaterial['category']): PatientEducationMaterial[] {
  return PATIENT_EDUCATION_MATERIALS.filter((m) => m.category === category)
}

export function findEducationByModality(modality: string): PatientEducationMaterial[] {
  return PATIENT_EDUCATION_MATERIALS.filter((m) => m.modality === modality)
}

export function searchEducationMaterials(keyword: string): PatientEducationMaterial[] {
  const k = keyword.trim().toLowerCase()
  if (!k) return PATIENT_EDUCATION_MATERIALS
  return PATIENT_EDUCATION_MATERIALS.filter(
    (m) => m.title.includes(k) || m.keyPoints.some((p) => p.includes(k)) || m.code.toLowerCase().includes(k),
  )
}

export const EDUCATION_CATEGORIES: { value: PatientEducationMaterial['category']; count: number }[] = [
  '检查准备',
  '检查过程',
  '报告解读',
  '术后护理',
  '辐射安全',
  '对比剂',
  '随访管理',
].map((c) => ({
  value: c as PatientEducationMaterial['category'],
  count: PATIENT_EDUCATION_MATERIALS.filter((m) => m.category === c).length,
}))
