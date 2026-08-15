// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10E-2 - 报告全文模板库
// 25 个完整结构化报告模板，覆盖 CT/MR/DR/US/MG/XA/NM/PT 八大模态
// 段落含 {{占位符}} 供报告书写系统动态填充，供模板管理/书写参考
// ============================================================

export type TemplateModality = 'CT' | 'MR' | 'DR' | 'CR' | 'US' | 'MG' | 'PT' | 'XA' | 'NM';

export interface ReportTemplateStructure {
  /** 适应证 / 临床病史（含占位符） */
  indication: string;
  /** 扫描技术 / 设备参数 */
  technique: string;
  /** 影像所见（结构化分段） */
  findings: string;
  /** 印象 / 诊断意见 */
  impression: string;
  /** 结论 / 建议 */
  conclusion: string;
}

export interface ReportTemplate {
  /** 模板名称 */
  name: string;
  /** 模态分类 */
  category: string;
  /** 检查模态 */
  modality: TemplateModality;
  /** 检查部位 */
  bodyPart: string;
  /** 报告全文结构（各段落含 {{}} 占位符） */
  structure: ReportTemplateStructure;
  /** 标签（检索/分组用） */
  tags: string[];
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // ============================================================
  // 一、CT 类（7 个）
  // ============================================================
  {
    name: '胸部 CT 平扫（肺结节随访）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '胸部（肺）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{clinicalHistory}}。既往 {{year}} 年 {{month}} 月胸部 CT 示右肺下叶 {{size}} 结节，本次复查。',
      technique: '采用 {{ctModel}} 扫描仪，患者仰卧位，吸气末屏气扫描，扫描范围自肺尖至肋膈角。重建层厚 {{sliceThickness}}mm，肺窗、纵隔窗观察。',
      findings: '双肺纹理清晰，右肺下叶外基底段见一实性结节，大小约 {{sizeNow}}（较前 {{sizeBefore}} 变化 {{sizeChange}}），边缘 {{margin}}，未见明显分叶及毛刺。余肺实质未见异常密度影。气管及主支气管通畅。纵隔未见肿大淋巴结。心脏大血管形态正常。双侧胸膜未见增厚，胸腔未见积液。',
      impression: '右肺下叶实性结节，大小较前 {{sizeTrend}}，符合 Lung-RADS {{radsCategory}}，建议 {{followUp}}。',
      conclusion: '影像诊断：肺结节（良性可能 / 需随访观察）。建议：{{followUpAdvice}}。',
    },
    tags: ['肺结节', '随访', 'Lung-RADS', '平扫'],
  },
  {
    name: '胸部 CT 增强（占位定性）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '胸部（纵隔）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{clinicalHistory}}，胸部 CT 发现 {{location}} 占位，为明确性质行增强扫描。',
      technique: '采用 {{ctModel}} 扫描仪，平扫 + 增强三期扫描。肘静脉团注碘对比剂 {{contrastAgent}} {{contrastVolume}}ml，流率 {{flowRate}}ml/s，分别于动脉期（{{arterialTime}}s）、静脉期（{{venousTime}}s）、延迟期（{{delayedTime}}s）扫描。',
      findings: '{{location}}见类圆形软组织肿块，大小约 {{size}}，平扫密度约 {{density}}HU，增强后动脉期强化约 {{arterialEnhancement}}HU，静脉期 {{venousEnhancement}}HU，延迟期 {{delayedEnhancement}}HU，呈 {{enhancementPattern}}强化。病灶边界 {{margin}}，与周围组织关系 {{relationship}}。纵隔内见 {{lymphNodes}}。',
      impression: '{{location}}占位性病变，增强扫描呈 {{enhancementPattern}}强化，考虑 {{suggestedDiagnosis}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{suggestedDiagnosis}}（可能）。建议：{{nextStep}}。',
    },
    tags: ['增强', '占位', '定性', '纵隔'],
  },
  {
    name: '头部 CT 平扫（急性脑血管病）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '头颅',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。突发 {{symptoms}} {{duration}}，急诊行头颅 CT 平扫。',
      technique: '采用 {{ctModel}} 扫描仪，头颅轴位平扫，层厚 {{sliceThickness}}mm，层距 {{sliceInterval}}mm，扫描基线为听眶线，骨窗及软组织窗观察。',
      findings: '双侧大脑半球对称，{{region}}见 {{lesionType}}，大小约 {{size}}，CT 值约 {{density}}HU。中线结构居中/向 {{side}} 偏移约 {{shift}}mm。脑室大小 {{ventricle}}。脑沟脑裂 {{sulci}}。基底节区及放射冠未见异常。颅骨骨质未见明确异常。',
      impression: '{{region}}{{lesionType}}，符合 {{diagnosis}} 影像表现，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['头颅', '平扫', '脑出血', '急诊', '卒中'],
  },
  {
    name: '腹部 CT 平扫+增强（肝脏占位）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '腹部（肝脏）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{clinicalHistory}}，超声发现肝内占位，行 CT 平扫及增强扫描。',
      technique: '采用 {{ctModel}} 扫描仪，患者仰卧位屏气扫描。平扫后经肘静脉团注碘对比剂 {{contrastAgent}} {{contrastVolume}}ml，分别于动脉期（{{arterialTime}}s，含肝动脉期 25-35s 及门脉早期）、门脉期（{{portalTime}}s）、延迟期（{{delayedTime}}s）扫描。',
      findings: '肝脏大小 {{liverSize}}，肝实质密度 {{parenchymaDensity}}。肝{{segment}}见类圆形占位，大小约 {{size}}，平扫呈 {{plainDensity}}密度，动脉期明显强化，门脉期强化 {{portalPattern}}，延迟期 {{delayedPattern}}，呈 {{enhancementPattern}}。门静脉 {{portalVein}}。胆囊 {{gallbladder}}。脾脏 {{spleen}}。胰腺 {{pancreas}}。双肾及肾上腺未见异常。腹主动脉旁淋巴结 {{lymphNodes}}。',
      impression: '肝{{segment}}占位，呈 {{enhancementPattern}}强化，LI-RADS {{liRadsCategory}}，考虑 {{diagnosis}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['腹部', '增强', '肝脏', 'LI-RADS', '占位'],
  },
  {
    name: '腹部 CT 平扫（急腹症）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '腹部（急腹症）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，临床拟诊急腹症，行全腹部 CT 平扫。',
      technique: '采用 {{ctModel}} 扫描仪，患者仰卧位，扫描范围自膈顶至耻骨联合，层厚 {{sliceThickness}}mm，软组织窗及骨窗观察，必要时行冠状位重建。',
      findings: '腹腔内见 {{freeGas}}游离气体。肠管扩张：{{bowelDilation}}，可见 {{airFluidLevels}}气液平面。肠壁 {{bowelWall}}。肠系膜 {{mesentery}}，漩涡征 {{whirlSign}}。胆囊 {{gallbladder}}，胆囊壁 {{gallbladderWall}}，腔内 {{gallstones}}。胰腺 {{pancreas}}。双肾输尿管 {{kidneys}}。膀胱 {{bladder}}。盆腔 {{pelvis}}。腹主动脉 {{aorta}}。',
      impression: '{{region}}见 {{keyFinding}}，符合 {{diagnosis}} 影像表现，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}（急腹症）。建议：{{nextStep}}。',
    },
    tags: ['急腹症', '平扫', '穿孔', '梗阻', '急诊'],
  },
  {
    name: '腰椎 CT 平扫（椎间盘）',
    category: 'CT',
    modality: 'CT',
    bodyPart: '腰椎',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，临床疑腰椎间盘突出，行腰椎 CT 平扫。',
      technique: '采用 {{ctModel}} 扫描仪，患者仰卧位，扫描范围自 L1 椎体上缘至 S1 椎体下缘，层厚 {{sliceThickness}}mm，骨窗及软组织窗观察，并行矢状位及冠状位重建。',
      findings: '腰椎生理曲度 {{curvature}}。椎体序列 {{alignment}}。L{{level}}/L{{level+1}} 椎间盘向后 {{herniationType}}突出约 {{protrusionSize}}mm，硬膜囊受压 {{duraCompression}}，椎管有效矢状径约 {{canalDiameter}}mm。L{{level}}/L{{level+1}} 双侧侧隐窝 {{lateralRecess}}。椎体边缘见骨赘形成 {{osteophytes}}。黄韧带 {{ligamentumFlavum}}。椎小关节 {{facetJoints}}。',
      impression: 'L{{level}}/L{{level+1}} 椎间盘 {{herniationType}}突出，硬膜囊受压，建议 {{nextStep}}。',
      conclusion: '影像诊断：腰椎间盘突出症（L{{level}}/L{{level+1}}）。建议：{{nextStep}}。',
    },
    tags: ['腰椎', '椎间盘', '突出', '平扫'],
  },
  {
    name: '冠状动脉 CTA',
    category: 'CT',
    modality: 'CT',
    bodyPart: '心脏（冠状动脉）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}}，临床疑冠心病，行冠状动脉 CTA 检查。',
      technique: '采用 {{ctModel}} 扫描仪，患者心率 {{heartRate}} 次/分，予以 {{betaBlocker}} 控制心率。肘静脉团注碘对比剂 {{contrastVolume}}ml，流率 {{flowRate}}ml/s，采用 {{gating}} 门控技术，回顾性/前瞻性采集，层厚 {{sliceThickness}}mm，行冠脉树及 VR、MIP、CPR 重建。',
      findings: '冠状动脉起源及走行 {{originCourse}}。右冠状动脉（RCA）：{{rcaFindings}}，狭窄程度约 {{rcaStenosis}}%。左主干（LM）：{{lmFindings}}，狭窄 {{lmStenosis}}%。左前降支（LAD）：{{ladFindings}}，中段见混合斑块，狭窄约 {{ladStenosis}}%。左旋支（LCX）：{{lcxFindings}}。心肌密度 {{myocardium}}。心腔大小 {{chambers}}。',
      impression: '冠脉 CTA 示 {{summarizedStenosis}}，符合 {{diagnosis}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}（冠脉造影 / 药物保守治疗）。',
    },
    tags: ['冠脉', 'CTA', '斑块', '狭窄', '心脏'],
  },
  // ============================================================
  // 二、MR 类（6 个）
  // ============================================================
  {
    name: '头颅 MR 平扫+增强',
    category: 'MR',
    modality: 'MR',
    bodyPart: '头颅',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，临床疑颅内占位/炎症，行头颅 MR 平扫及增强扫描。',
      technique: '采用 {{mrModel}} 3.0T 磁共振扫描仪，头颅专用线圈。常规序列：T1WI、T2WI、FLAIR、DWI（b=1000s/mm²）及 ADC 图。增强扫描经肘静脉注射钆对比剂 {{gadolinium}} {{gadoliniumVolume}}ml，行轴位、冠状位、矢状位 T1WI 增强扫描。',
      findings: '{{region}}见类圆形占位，大小约 {{size}}，T1WI 呈 {{t1Signal}} 信号，T2WI 呈 {{t2Signal}} 信号，FLAIR 呈 {{flairSignal}}，DWI {{dwiSignal}}/ADC {{adcSignal}}。增强后病灶呈 {{enhancementPattern}}强化，强化边界 {{margin}}，周围水肿 {{edema}}。占位效应 {{massEffect}}，中线结构移位 {{shift}}mm。脑室系统 {{ventricles}}。',
      impression: '{{region}}占位性病变，考虑 {{diagnosis}}（WHO {{grade}} 级），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['头颅', 'MR', '增强', '占位', 'DWI'],
  },
  {
    name: '头颅 MR（脑梗死 DWI）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '头颅（急性缺血）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。突发 {{symptoms}} {{duration}}，疑急性脑梗死，行头颅 MR 检查。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，序列包括 T1WI、T2WI、FLAIR、DWI（b=0/1000s/mm²）、ADC、MRA（TOF）。急诊流程优先 DWI 及 MRA。',
      findings: '{{region}}见片状异常信号，DWI 呈明显高信号，ADC 呈低信号，T2WI/FLAIR 呈 {{t2Signal}} 信号，范围约 {{size}}，符合急性脑梗死（细胞毒性水肿）。MRA 示 {{artery}} 段 {{occlusion}}。对侧大脑半球未见异常。{{otherFindings}}。',
      impression: '{{region}}急性期脑梗死，MRA 示 {{artery}} 段 {{occlusion}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：急性脑梗死（{{region}}）。建议：{{nextStep}}。',
    },
    tags: ['头颅', 'MR', '梗死', 'DWI', 'MRA', '急诊'],
  },
  {
    name: '颈椎 MR（脊髓及间盘）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '颈椎',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，疑颈椎间盘病变/脊髓受压，行颈椎 MR 检查。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，颈椎线圈。矢状位 T1WI、T2WI、STIR 及轴位 T2WI 扫描，层厚 {{sliceThickness}}mm，必要时加扫增强序列。',
      findings: '颈椎生理曲度 {{curvature}}。C{{level}}/C{{level+1}} 椎间盘 {{degeneration}}，向后 {{herniationType}}突出，脊髓受压 {{cordCompression}}，受压处脊髓信号 {{cordSignal}}。椎管前后径最窄处约 {{canalDiameter}}mm。C{{level}}/C{{level+1}} 双侧椎间孔 {{foramen}}。黄韧带肥厚 {{ligamentumFlavum}}。颈髓内未见明确异常信号。',
      impression: 'C{{level}}/C{{level+1}} 椎间盘突出伴脊髓受压，建议 {{nextStep}}。',
      conclusion: '影像诊断：颈椎病（C{{level}}/C{{level+1}}）。建议：{{nextStep}}。',
    },
    tags: ['颈椎', 'MR', '脊髓', '椎间盘', '颈髓'],
  },
  {
    name: '腰椎 MR（间盘及终板）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '腰椎',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，疑腰椎间盘突出，行腰椎 MR 检查。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，腰椎线圈。矢状位 T1WI、T2WI、STIR 及轴位 T2WI，层厚 {{sliceThickness}}mm。',
      findings: '腰椎序列正常，生理曲度 {{curvature}}。L{{level}}/L{{level+1}} 椎间盘 T2 信号 {{discSignal}}（退变），向后 {{herniationType}}突出，硬膜囊受压 {{duraCompression}}，右侧侧隐窝变窄。L{{level}}/L{{level+1}} 终板见 {{modicType}} 信号改变（Modic {{modicGrade}} 型）。椎管内未见占位。马尾神经信号正常。',
      impression: 'L{{level}}/L{{level+1}} 椎间盘突出（{{side}}型），伴终板炎（Modic {{modicGrade}} 型），建议 {{nextStep}}。',
      conclusion: '影像诊断：腰椎间盘突出伴终板炎。建议：{{nextStep}}。',
    },
    tags: ['腰椎', 'MR', '椎间盘', 'Modic', '硬膜囊'],
  },
  {
    name: '膝关节 MR（半月板/韧带）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '膝关节',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{traumaHistory}}，{{symptoms}} {{duration}}，疑半月板/韧带损伤，行膝关节 MR 检查。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，膝关节线圈。矢状位 PDWI-FS、冠状位 PDWI、轴位 PDWI-FS 及矢状位 T1WI，必要时行 T2*mapping。',
      findings: '内侧半月板 {{medialMeniscus}}，后角见 {{tearType}} 线样高信号达关节面，符合半月板撕裂（{{bucketHandle}}）。外侧半月板 {{lateralMeniscus}}。前交叉韧带（ACL）{{acl}}，后交叉韧带（PCL）{{pcl}}。内侧副韧带 {{mcl}}，外侧副韧带 {{lcl}}。髌骨位置 {{patellaPosition}}，髌股关节面软骨 {{cartilage}}。关节腔及髌上囊积液 {{effusion}}。',
      impression: '内侧半月板撕裂（{{tearType}}），{{acl}} 前交叉韧带损伤，建议 {{nextStep}}。',
      conclusion: '影像诊断：半月板撕裂并韧带损伤。建议：{{nextStep}}（关节镜探查/保守治疗）。',
    },
    tags: ['膝关节', 'MR', '半月板', '韧带', '损伤'],
  },
  {
    name: '乳腺 MR 增强（术前评估）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '乳腺',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。超声/MG 发现 {{location}} 病变，行乳腺 MR 增强检查以明确范围及多灶性评估。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，专用乳腺线圈。患者俯卧位，扫描序列：T1WI、T2WI-FS、DWI 及动态增强扫描（注射钆对比剂 {{gadolinium}} {{gadoliniumVolume}}ml，采集 6-8 期）。图像行 MIP 重建及 TIC 曲线分析。',
      findings: '右乳 {{location}}见肿块样病变，大小约 {{size}}，T2WI-FS 呈 {{t2Signal}} 信号，DWI 呈 {{dwiSignal}}，增强后早期强化率约 {{earlyEnhancement}}%，TIC 曲线呈 {{ticType}} 型（{{plateauWashout}}）。病变周围见 {{additionalFindings}}。同侧腋窝淋巴结 {{axillaryNodes}}。对侧乳腺未见异常强化。',
      impression: '右乳 {{location}}病变，BI-RADS-MRI {{biRadsCategory}} 类，考虑 {{diagnosis}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}（BI-RADS {{biRadsCategory}} 类）。建议：{{nextStep}}。',
    },
    tags: ['乳腺', 'MR', '增强', 'BI-RADS', 'TIC'],
  },
  {
    name: '腹部 MR（肝脏占位定性）',
    category: 'MR',
    modality: 'MR',
    bodyPart: '腹部（肝脏）',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。CT 发现肝内占位性质待定，行腹部 MR 平扫及动态增强检查。',
      technique: '采用 {{mrModel}} 磁共振扫描仪，体部线圈。序列：轴位 T1WI 双回波（同/反相位）、T2WI-FS、DWI（b=0/600/800s/mm²）、MRCP 及动态增强 T1WI-FS（动脉期、门脉期、延迟期）。',
      findings: '肝{{segment}}见类圆形病灶，大小约 {{size}}，T1WI 呈 {{t1Signal}} 信号，T2WI 呈 {{t2Signal}} 信号（{{t2Brightness}}），DWI {{dwiSignal}}。增强扫描动脉期 {{arterialPattern}}，门脉期 {{portalPattern}}，延迟期 {{delayedPattern}}，呈 {{enhancementPattern}}。肝胆特异期（钆塞酸二钠）呈 {{hbpPhase}}。余肝脏实质 {{parenchyma}}。脾脏 {{spleen}}。胆囊、胰腺、双肾未见异常。',
      impression: '肝{{segment}}病灶，MR 特征符合 {{diagnosis}}，LI-RADS {{liRadsCategory}} 类，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['腹部', 'MR', '肝脏', '增强', '定性'],
  },
  // ============================================================
  // 三、DR 类（4 个）
  // ============================================================
  {
    name: '胸部正侧位 DR',
    category: 'DR',
    modality: 'DR',
    bodyPart: '胸部',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，行胸部正侧位 X 线检查。',
      technique: '采用 {{drModel}} 数字化摄影系统，站立位后前位（正位）及左侧位摄片，曝光条件：{{kv}}kV / {{mas}}mAs，焦片距 180cm。',
      findings: '胸廓对称，肋骨未见骨折。双肺纹理 {{lungMarkings}}，肺野内未见明确实质性病变。肺门形态正常。纵隔居中，未见增宽。心影大小形态 {{heartSize}}。双侧膈面光整，肋膈角锐利/{{costophrenicAngles}}。侧位片示心后间隙 {{retrocardiacSpace}}，胸椎生理曲度正常。',
      impression: '双肺、心影、纵隔及膈肌未见明显异常（或见 {{finding}}）。建议：{{advice}}。',
      conclusion: '影像所见：{{summary}}。建议：{{advice}}。',
    },
    tags: ['胸部', 'DR', '正侧位', '体检', '平片'],
  },
  {
    name: '腹部立位 DR（急腹症）',
    category: 'DR',
    modality: 'DR',
    bodyPart: '腹部',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，临床疑肠梗阻/穿孔，行腹部立位 X 线检查。',
      technique: '采用 {{drModel}} 数字化摄影系统，站立位前后位摄片，曝光条件：{{kv}}kV / {{mas}}mAs，含膈肌至耻骨联合范围。',
      findings: '膈下未见明确游离气体（/双侧膈下见新月形游离气体影）。小肠及结肠见多个阶梯状气液平面，肠管扩张，扩张最明显处位于 {{location}}，直径约 {{diameter}}mm。肠壁未见明确积气。腹壁脂肪线清晰。腰大肌影正常。其余腹部未见异常钙化灶。',
      impression: '腹部立位片示 {{diagnosis}} 影像表现（肠梗阻/消化道穿孔），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['腹部', 'DR', '急腹症', '肠梗阻', '穿孔'],
  },
  {
    name: '四肢骨骼 DR（骨折）',
    category: 'DR',
    modality: 'DR',
    bodyPart: '四肢',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{traumaHistory}}，{{location}}疼痛肿胀，行 {{location}}正侧位 X 线检查。',
      technique: '采用 {{drModel}} 数字化摄影系统，{{location}}正位及侧位摄片，必要时加拍斜位或应力位。',
      findings: '{{location}}{{bone}}见骨折线，位于 {{position}}，骨折线 {{fractureLine}}，骨折端移位 {{displacement}}，成角约 {{angulation}} 度。骨皮质连续性中断。关节面见 {{jointInvolvement}}。周围软组织肿胀 {{softTissue}}。关节间隙未见异常。邻近骨未见其他骨折。',
      impression: '{{location}}{{bone}}{{type}}骨折（伴移位），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{bone}}{{type}}骨折。建议：{{nextStep}}。',
    },
    tags: ['四肢', 'DR', '骨折', '外伤', '急诊'],
  },
  {
    name: '颈椎正侧位+张口位 DR',
    category: 'DR',
    modality: 'DR',
    bodyPart: '颈椎',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，行颈椎正侧位及张口位 X 线检查。',
      technique: '采用 {{drModel}} 数字化摄影系统，颈椎正位、侧位及张口位（齿状突）摄片，曝光条件：{{kv}}kV / {{mas}}mAs。',
      findings: '颈椎生理曲度 {{curvature}}，椎体序列整齐，C{{level}}/C{{level+1}} 椎间隙变窄。椎体前缘见骨赘形成 {{osteophytes}}。张口位示齿状突居中/向 {{side}} 偏移，寰齿间隙约 {{atlantodental}}mm。钩椎关节未见明显增生。项韧带见钙化 {{ligamentCalcification}}。',
      impression: '颈椎退行性变（C{{level}}/C{{level+1}}），建议 {{nextStep}}。',
      conclusion: '影像诊断：颈椎退行性变。建议：{{nextStep}}。',
    },
    tags: ['颈椎', 'DR', '退变', '齿状突'],
  },
  // ============================================================
  // 四、US 类（3 个）
  // ============================================================
  {
    name: '腹部彩色多普勒超声',
    category: 'US',
    modality: 'US',
    bodyPart: '腹部',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，行腹部彩超检查。',
      technique: '采用 {{usModel}} 超声诊断仪，凸阵探头（{{convexProbe}}MHz），患者空腹 8 小时以上，常规二维、彩色多普勒及频谱多普勒检查，必要时行超声造影。',
      findings: '肝脏大小 {{liverSize}}，实质回声 {{liverEchogenicity}}，肝{{segment}}见 {{lesionType}}，大小约 {{size}}，边界 {{margin}}，内部回声 {{internalEcho}}，CDFI 示病灶周边及内部血流 {{vascularity}}。肝内胆管未见扩张。胆囊大小正常，壁 {{gallbladderWall}}，腔内见 {{gallstones}}结石影，伴声影 {{acousticShadowing}}。胰腺形态大小正常，回声均匀。脾脏不大。双肾形态大小正常，肾盂未见分离。腹主动脉旁未见肿大淋巴结。腹腔未见积液。',
      impression: '肝{{segment}}{{lesionType}}（{{diagnosis}}可能），建议 {{nextStep}}。',
      conclusion: '超声诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['腹部', '彩超', '肝', '胆囊', '结石'],
  },
  {
    name: '甲状腺超声（TI-RADS）',
    category: 'US',
    modality: 'US',
    bodyPart: '甲状腺',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}}，行甲状腺超声检查。',
      technique: '采用 {{usModel}} 超声诊断仪，线阵探头（{{linearProbe}}MHz），常规二维、彩色多普勒检查，结节评分采用 TI-RADS 分级系统。',
      findings: '甲状腺左叶大小 {{leftLobeSize}}，右叶大小 {{rightLobeSize}}，峡部厚约 {{isthmus}}mm。实质回声 {{parenchymaEcho}}。右叶见 {{lesionType}}结节，大小约 {{size}}，形态 {{shape}}，边界 {{margin}}，内部回声 {{internalEcho}}，纵横比 {{tallerThanWide}}，内部见 {{calcifications}}钙化，CDFI 示血流 {{vascularity}}，TI-RADS 分类 {{tiRadsCategory}} 类。左侧颈部淋巴结 {{lymphNodes}}。',
      impression: '甲状腺右叶结节，TI-RADS {{tiRadsCategory}} 类，建议 {{nextStep}}。',
      conclusion: '超声诊断：甲状腺结节（TI-RADS {{tiRadsCategory}} 类）。建议：{{nextStep}}。',
    },
    tags: ['甲状腺', '超声', 'TI-RADS', '结节'],
  },
  {
    name: '乳腺超声（BI-RADS）',
    category: 'US',
    modality: 'US',
    bodyPart: '乳腺',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}}，行乳腺超声检查。',
      technique: '采用 {{usModel}} 超声诊断仪，线阵探头（{{linearProbe}}MHz），双侧乳腺及腋窝常规二维、彩色多普勒及弹性成像检查，病变按 BI-RADS-US 分级。',
      findings: '双侧乳腺腺体层结构 {{structure}}，回声 {{echogenicity}}。右乳 {{clockPosition}} 位距乳头 {{distance}}cm 处见肿块，大小约 {{size}}，形态 {{shape}}，边缘 {{margin}}，内部回声 {{internalEcho}}，后方回声 {{posteriorFeatures}}，CDFI 示血流 {{vascularity}}，弹性成像评分 {{elasticScore}} 分，BI-RADS-US 分类 {{biRadsCategory}} 类。右侧腋窝见淋巴结 {{axillaryNodes}}。左侧乳腺未见异常。',
      impression: '右乳肿块，BI-RADS-US {{biRadsCategory}} 类，建议 {{nextStep}}。',
      conclusion: '超声诊断：右乳肿块（BI-RADS {{biRadsCategory}} 类）。建议：{{nextStep}}。',
    },
    tags: ['乳腺', '超声', 'BI-RADS', '肿块'],
  },
  // ============================================================
  // 五、MG 类（1 个）
  // ============================================================
  {
    name: '乳腺 X 线摄影（筛查）',
    category: 'MG',
    modality: 'MG',
    bodyPart: '乳腺',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{purpose}}，行双乳 X 线摄影（CC 及 MLO 位）检查。',
      technique: '采用 {{mgModel}} 数字化乳腺机，行双乳头尾位（CC）及内外斜位（MLO）摄影，必要时加压点片及放大摄影。摄片质量：{{quality}}。',
      findings: '双侧乳腺呈 {{density}} 型致密腺体。右乳外上象限见 {{lesionType}}，大小约 {{size}}，形态 {{shape}}，边缘 {{margin}}，伴 {{calcifications}}钙化，分布 {{distribution}}。左乳内可见 {{leftFindings}}。双腋尾区淋巴结 {{axillaryNodes}}。皮肤及乳头未见异常。',
      impression: '右乳 {{lesionType}}伴钙化，BI-RADS-MG {{biRadsCategory}} 类，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}（BI-RADS {{biRadsCategory}} 类）。建议：{{nextStep}}。',
    },
    tags: ['乳腺', 'MG', '筛查', 'BI-RADS', '钙化'],
  },
  // ============================================================
  // 六、XA 造影类（2 个）
  // ============================================================
  {
    name: '上消化道钡餐造影',
    category: 'XA',
    modality: 'XA',
    bodyPart: '食管/胃/十二指肠',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，行上消化道钡餐造影检查。',
      technique: '采用 {{xaModel}} 数字化胃肠机，口服产气粉及硫酸钡混悬液 {{bariumVolume}}ml，行食管、胃、十二指肠双对比造影，多体位动态观察及摄片。',
      findings: '食管黏膜光滑，蠕动正常，未见充盈缺损及龛影。贲门开闭正常。胃呈钩型，胃泡 {{gastricBubble}}，黏膜皱襞 {{rugae}}，胃窦部蠕动对称，未见龛影及充盈缺损。十二指肠球部充盈良好，形态规则，黏膜未见异常。十二指肠降段及水平段走行自然。钡剂通过顺利，小肠近端显示良好。',
      impression: '上消化道钡餐造影未见明确器质性病变（或见 {{finding}}），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['消化道', '钡餐', '造影', '食管', '胃'],
  },
  {
    name: '静脉肾盂造影（IVP）',
    category: 'XA',
    modality: 'XA',
    bodyPart: '泌尿系统',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{symptoms}} {{duration}}，行静脉肾盂造影检查评估泌尿系统结构及功能。',
      technique: '采用 {{xaModel}} 数字化胃肠机，肘静脉团注碘对比剂 {{contrastAgent}} {{contrastVolume}}ml，分别于注射后 {{timingSequence}} 摄片，必要时行延迟摄片。',
      findings: '双肾位置、大小及形态正常。注射后 {{timing}} 分钟双肾盏、肾盂显影良好，肾盏杯口锐利。双侧输尿管走行自然，未见充盈缺损及扩张。膀胱充盈良好，形态规则，腔内未见充盈缺损。排尿后片示残余尿约 {{residualUrine}}ml。',
      impression: '静脉肾盂造影示双肾、输尿管及膀胱未见明确异常（或见 {{finding}}），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['IVP', '肾盂', '造影', '输尿管', '膀胱'],
  },
  // ============================================================
  // 七、NM 类（1 个）
  // ============================================================
  {
    name: '全身骨显像（骨扫描）',
    category: 'NM',
    modality: 'NM',
    bodyPart: '全身骨骼',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。{{diagnosis}}，行全身骨显像检查评估骨转移情况。',
      technique: '静脉注射 {{tracer}} 显像剂 {{tracerDose}}mCi，注射后 {{imagingTime}} 小时行全身前后位及后前位平面显像，必要时行 SPECT/CT 断层融合显像。',
      findings: '全身骨骼放射性分布 {{distribution}}。{{location}}见异常放射性浓聚灶，大小约 {{size}}，形态 {{shape}}，SUVmax 约 {{suvMax}}，SPECT/CT 融合示病灶定位于 {{anatomyLocation}}，伴/不伴骨质破坏。{{otherFoci}}。肾脏显影正常。其余骨骼未见明确异常放射性分布。',
      impression: '全身骨显像示 {{location}}异常浓聚灶，考虑 {{diagnosis}}（转移瘤可能），建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}。建议：{{nextStep}}。',
    },
    tags: ['骨显像', 'NM', 'SPECT', '转移', '骨扫描'],
  },
  // ============================================================
  // 八、PT 类（1 个）
  // ============================================================
  {
    name: 'PET-CT 肿瘤分期评估',
    category: 'PT',
    modality: 'PT',
    bodyPart: '全身',
    structure: {
      indication: '患者 {{patientName}}，{{sex}}，{{age}} 岁。病理确诊 {{diagnosis}}，行 18F-FDG PET-CT 检查进行分期评估。',
      technique: '患者空腹 {{fastingTime}} 小时以上，血糖 {{glucose}}mmol/L。静脉注射 18F-FDG {{fdgDose}}mCi，静卧 {{uptakeTime}} 分钟后行 CT 定位扫描及全身 PET 采集，图像行衰减校正及 MIP 重建。',
      findings: '{{primarySite}}见原发灶，大小约 {{size}}，FDG 代谢增高，SUVmax 约 {{suvMax}}。{{lymphNodeStations}}见淋巴结转移灶，SUVmax {{nodeSuv}}。{{distantSites}}见远处转移灶，SUVmax {{metastaticSuv}}。全身其余部位未见明确异常 FDG 摄取。脑部生理性摄取正常。',
      impression: 'PET-CT 示 {{diagnosis}}伴 {{nodalStatus}}淋巴结及 {{metastasisStatus}}转移，分期为 {{tumorStage}}，建议 {{nextStep}}。',
      conclusion: '影像诊断：{{diagnosis}}（TNM 分期 {{tumorStage}}）。建议：{{nextStep}}。',
    },
    tags: ['PET-CT', '分期', 'FDG', 'SUVmax', '肿瘤'],
  },
];

// ============================================================
// 工具函数
// ============================================================

/** 按模态筛选报告模板（filter by modality, e.g. 'CT' / 'MR'） */
export function filterTemplatesByModality(modality: TemplateModality): ReportTemplate[] {
  return REPORT_TEMPLATES.filter((t) => t.modality === modality);
}

/** 按关键词检索模板（名称/部位/标签，search by keyword） */
export function searchReportTemplates(keyword: string): ReportTemplate[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return REPORT_TEMPLATES;
  return REPORT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(kw) ||
      t.bodyPart.toLowerCase().includes(kw) ||
      t.category.toLowerCase().includes(kw) ||
      t.tags.some((tag) => tag.toLowerCase().includes(kw)),
  );
}

/** 统计各模态模板数量（for template management overview） */
export function getTemplateCountByModality(): Array<{ modality: TemplateModality; count: number }> {
  const modalities: TemplateModality[] = ['CT', 'MR', 'DR', 'US', 'MG', 'XA', 'NM', 'PT'];
  return modalities.map((modality) => ({
    modality,
    count: REPORT_TEMPLATES.filter((t) => t.modality === modality).length,
  }));
}
