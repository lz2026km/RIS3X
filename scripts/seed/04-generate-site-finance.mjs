/**
 * G005 多院区 + 财务数据生成器 — 生成 siteMasterMock.ts / financeMock.ts
 * 输出: src/data/siteMasterMock.ts + src/data/financeMock.ts
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ============= SITE CONFIG =============

const siteConfig = {
  S001: {
    siteName: '总院',
    address: '上海市静安区华山路650号',
    departmentCount: 12,
    deviceCount: 25,
    annualExamVolume: 80000,
    devices: [
      ['D001','GE Revolution CT','CT','CT检查室1'],
      ['D002','Siemens SOMATOM Force','CT','CT检查室2'],
      ['D003','Canon Aquilion ONE','CT','CT检查室3'],
      ['D004','联影 uCT 960+','CT','CT检查室4'],
      ['D005','Siemens MAGNETOM Vida 3T','MR','MRI检查室1'],
      ['D006','GE SIGNA Premier 3T','MR','MRI检查室2'],
      ['D007','Philips Ingenia 1.5T','MR','MRI检查室3'],
      ['D008','联影 uMR 790','MR','MRI检查室4'],
      ['D009','联影 uMR 780','MR','MRI检查室5'],
      ['D010','西门子 Multix Fusion','DR','DR检查室1'],
      ['D011','飞利浦 DigitalDiagnost','DR','DR检查室2'],
      ['D012','联影 uDR 780i','DR','DR检查室3'],
      ['D013','GE Definium 6560','DR','DR检查室4'],
      ['D014','西门子 Luminos dRF','DR','DR检查室5'],
      ['D015','飞利浦 Cios Alpha','DSA','DSA导管室1'],
      ['D016','西门子 Artis Q Zeego','DSA','DSA导管室2'],
      ['D017','GE Innova IGS 5','DSA','DSA导管室3'],
      ['D018','联影 uDSA 780','DSA','DSA导管室4'],
      ['D019','GE Pristina Serena','Mammo','钼靶检查室1'],
      ['D020','联影 uMammo 890i','Mammo','钼靶检查室2'],
      ['D021','西门子 Mammomat Inspiration','Mammo','钼靶检查室3'],
      ['D022','GE Discovery MI','PET-CT','PET-CT检查室1'],
      ['D023','联影 uMI 780','PET-CT','PET-CT检查室2'],
      ['D024','飞利浦 Vereos PET/CT','PET-CT','PET-CT检查室3'],
      ['D025','西门子 Biograph Vision','PET-CT','PET-CT检查室4'],
    ],
  },
  S002: {
    siteName: '东院',
    address: '上海市浦东新区浦建路160号',
    departmentCount: 6,
    deviceCount: 15,
    annualExamVolume: 35000,
    devices: [
      ['D101','联影 uCT 780','CT','CT检查室1'],
      ['D102','GE Revolution ACT','CT','CT检查室2'],
      ['D103','西门子 SOMATOM go.Sim','CT','CT检查室3'],
      ['D104','飞利浦 DigitalDiagnost C50','DR','DR检查室1'],
      ['D105','联影 uDR 560i','DR','DR检查室2'],
      ['D106','GE Definium 5000','DR','DR检查室3'],
      ['D107','西门子 Multix Impact','DR','DR检查室4'],
      ['D108','联影 uDR 370i','DR','DR检查室5'],
      ['D109','Hologic Selenia Dimensions','Mammo','钼靶检查室1'],
      ['D110','西门子 MAMMOMAT Fusion','Mammo','钼靶检查室2'],
      ['D111','飞利浦 EPIQ Elite','US','超声检查室1'],
      ['D112','GE LOGIQ E20','US','超声检查室2'],
      ['D113','西门子 ACUSON Sequoia','US','超声检查室3'],
      ['D114','联影 uMammo 780i','Mammo','钼靶检查室3'],
      ['D115','飞利浦 ClearVue 850','US','超声检查室4'],
    ],
  },
  S003: {
    siteName: '西院',
    address: '上海市长宁区仙霞路1111号',
    departmentCount: 4,
    deviceCount: 10,
    annualExamVolume: 15000,
    devices: [
      ['D201','飞利浦 DigitalDiagnost C90','DR','DR检查室1'],
      ['D202','联影 uDR 560i-A','DR','DR检查室2'],
      ['D203','西门子 Multix Impact E','DR','DR检查室3'],
      ['D204','GE Definium 6000','DR','DR检查室4'],
      ['D205','联影 uDR 370i-A','DR','DR检查室5'],
      ['D206','GE SIGNA Voyager 1.5T','MR','MRI检查室1'],
      ['D207','联影 uMR 770','MR','MRI检查室2'],
      ['D208','飞利浦 EPIQ 7C','US','超声检查室1'],
      ['D209','西门子 ACUSON Juniper','US','超声检查室2'],
      ['D210','GE LOGIQ E10','US','超声检查室3'],
    ],
  },
};

// ============= FINANCE DATA GENERATION =============

const CHARGE_ITEMS = [
  { code: 'INJ001', name: '碘海醇注射液(300mgI/ml 100ml)', unitPrice: 285 },
  { code: 'INJ002', name: '碘帕醇注射液(370mgI/ml 100ml)', unitPrice: 345 },
  { code: 'INJ003', name: '碘克沙醇注射液(320mgI/ml 100ml)', unitPrice: 420 },
  { code: 'INJ004', name: '钆喷酸葡胺注射液(10ml)', unitPrice: 198 },
  { code: 'INJ005', name: '钆双胺注射液(10ml)', unitPrice: 256 },
  { code: 'INJ006', name: '钆特酸葡胺注射液(10ml)', unitPrice: 312 },
  { code: 'INJ007', name: '钆布醇注射液(7.5ml)', unitPrice: 458 },
  { code: 'INJ008', name: '超顺磁氧化铁注射液(5ml)', unitPrice: 680 },
  { code: 'INJ009', name: '99mTc-MDP骨显像剂', unitPrice: 350 },
  { code: 'INJ010', name: '18F-FDG显像剂(5mCi)', unitPrice: 1800 },
  { code: 'INJ011', name: '18F-FDG显像剂(10mCi)', unitPrice: 3200 },
  { code: 'INJ012', name: '13N-氨水显像剂', unitPrice: 2800 },
  { code: 'INJ013', name: '碘普罗胺注射液(370mgI/ml 50ml)', unitPrice: 178 },
  { code: 'INJ014', name: '碘佛醇注射液(320mgI/ml 100ml)', unitPrice: 298 },
  { code: 'INJ015', name: '碘美普尔注射液(400mgI/ml 100ml)', unitPrice: 385 },
  { code: 'INJ016', name: '钆塞酸二钠注射液(10ml)', unitPrice: 520 },
  { code: 'INJ017', name: '六氟化硫微泡注射液', unitPrice: 480 },
  { code: 'INJ018', name: '利多卡因注射液(5ml)', unitPrice: 12 },
  { code: 'INJ019', name: '地塞米松磷酸钠注射液', unitPrice: 8 },
  { code: 'INJ020', name: '生理盐水注射液(10ml)', unitPrice: 5 },
  { code: 'INJ021', name: '生理盐水注射液(250ml)', unitPrice: 8 },
  { code: 'INJ022', name: '生理盐水注射液(500ml)', unitPrice: 10 },
  { code: 'INJ023', name: '硫酸阿托品注射液', unitPrice: 6 },
  { code: 'INJ024', name: '盐酸异丙嗪注射液', unitPrice: 15 },
  { code: 'INJ025', name: '盐酸肾上腺素注射液', unitPrice: 18 },
  { code: 'INJ026', name: '盐酸苯海拉明注射液', unitPrice: 12 },
  { code: 'INJ027', name: '注射用硫代硫酸钠', unitPrice: 25 },
  { code: 'INJ028', name: '注射用碳酸氢钠', unitPrice: 20 },
  { code: 'INJ029', name: '碘帕醇注射液(300mgI/ml 50ml)', unitPrice: 165 },
  { code: 'INJ030', name: '碘克沙醇注射液(270mgI/ml 50ml)', unitPrice: 260 },
  { code: 'INJ031', name: '吲哚菁绿注射液', unitPrice: 350 },
  { code: 'INJ032', name: '亚甲蓝注射液', unitPrice: 45 },
  { code: 'SCN001', name: 'CT平扫(头部)', unitPrice: 200 },
  { code: 'SCN002', name: 'CT平扫(胸部)', unitPrice: 280 },
  { code: 'SCN003', name: 'CT平扫(腹部)', unitPrice: 320 },
  { code: 'SCN004', name: 'CT平扫(盆腔)', unitPrice: 300 },
  { code: 'SCN005', name: 'CT平扫(脊柱)', unitPrice: 350 },
  { code: 'SCN006', name: 'CT平扫(四肢)', unitPrice: 260 },
  { code: 'SCN007', name: 'CT增强(头部)', unitPrice: 400 },
  { code: 'SCN008', name: 'CT增强(胸部)', unitPrice: 500 },
  { code: 'SCN009', name: 'CT增强(腹部)', unitPrice: 560 },
  { code: 'SCN010', name: 'CT增强(盆腔)', unitPrice: 520 },
  { code: 'SCN011', name: 'CT增强(全腹部)', unitPrice: 680 },
  { code: 'SCN012', name: 'CT增强(颈部)', unitPrice: 420 },
  { code: 'SCN013', name: 'CT增强(冠脉CTA)', unitPrice: 1200 },
  { code: 'SCN014', name: 'CT增强(头颈CTA)', unitPrice: 1100 },
  { code: 'SCN015', name: 'CT增强(肺动脉CTA)', unitPrice: 900 },
  { code: 'SCN016', name: 'CT增强(下肢动脉CTA)', unitPrice: 1000 },
  { code: 'SCN017', name: 'CT增强(上肢动脉CTA)', unitPrice: 950 },
  { code: 'SCN018', name: 'CT增强(肾动脉CTA)', unitPrice: 850 },
  { code: 'SCN019', name: 'CT灌注成像(头部)', unitPrice: 800 },
  { code: 'SCN020', name: 'CT灌注成像(肝脏)', unitPrice: 900 },
  { code: 'SCN021', name: 'CT三维重建', unitPrice: 150 },
  { code: 'SCN022', name: 'CT骨密度测定', unitPrice: 180 },
  { code: 'SCN023', name: 'CT引导下穿刺定位', unitPrice: 600 },
  { code: 'SCN024', name: 'CT结肠成像', unitPrice: 750 },
  { code: 'SCN025', name: 'CT尿路成像(CTU)', unitPrice: 700 },
  { code: 'SCN026', name: 'MR平扫(头部)', unitPrice: 480 },
  { code: 'SCN027', name: 'MR平扫(颈椎)', unitPrice: 520 },
  { code: 'SCN028', name: 'MR平扫(胸椎)', unitPrice: 520 },
  { code: 'SCN029', name: 'MR平扫(腰椎)', unitPrice: 520 },
  { code: 'SCN030', name: 'MR平扫(腹部)', unitPrice: 580 },
  { code: 'SCN031', name: 'MR平扫(盆腔)', unitPrice: 560 },
  { code: 'SCN032', name: 'MR平扫(膝关节)', unitPrice: 480 },
  { code: 'SCN033', name: 'MR平扫(肩关节)', unitPrice: 480 },
  { code: 'SCN034', name: 'MR平扫(踝关节)', unitPrice: 460 },
  { code: 'SCN035', name: 'MR平扫(乳腺)', unitPrice: 600 },
  { code: 'SCN036', name: 'MR增强(头部)', unitPrice: 750 },
  { code: 'SCN037', name: 'MR增强(腹部)', unitPrice: 900 },
  { code: 'SCN038', name: 'MR增强(盆腔)', unitPrice: 850 },
  { code: 'SCN039', name: 'MR增强(乳腺)', unitPrice: 950 },
  { code: 'SCN040', name: 'MR增强(全脊柱)', unitPrice: 1200 },
  { code: 'SCN041', name: 'MRA(头部)', unitPrice: 680 },
  { code: 'SCN042', name: 'MRA(颈部)', unitPrice: 650 },
  { code: 'SCN043', name: 'MRA(腹部)', unitPrice: 720 },
  { code: 'SCN044', name: 'MRV(头部)', unitPrice: 620 },
  { code: 'SCN045', name: 'MRCP(胰胆管成像)', unitPrice: 680 },
  { code: 'SCN046', name: 'MR尿路成像(MRU)', unitPrice: 600 },
  { code: 'SCN047', name: 'MR弥散张量成像(DTI)', unitPrice: 800 },
  { code: 'SCN048', name: 'MR波谱分析(MRS)', unitPrice: 750 },
  { code: 'SCN049', name: 'MR脑功能成像(fMRI)', unitPrice: 1100 },
  { code: 'SCN050', name: 'MR心肌灌注成像', unitPrice: 1300 },
  { code: 'SCN051', name: 'MR全脊柱成像', unitPrice: 900 },
  { code: 'SCN052', name: 'MR关节造影', unitPrice: 800 },
  { code: 'SCN053', name: 'DR胸部正位', unitPrice: 80 },
  { code: 'SCN054', name: 'DR胸部正侧位', unitPrice: 120 },
  { code: 'SCN055', name: 'DR腹部立位', unitPrice: 80 },
  { code: 'SCN056', name: 'DR腹部卧位', unitPrice: 80 },
  { code: 'SCN057', name: 'DR颈椎正侧位', unitPrice: 100 },
  { code: 'SCN058', name: 'DR颈椎双斜位', unitPrice: 120 },
  { code: 'SCN059', name: 'DR腰椎正侧位', unitPrice: 100 },
  { code: 'SCN060', name: 'DR腰椎双斜位', unitPrice: 120 },
  { code: 'SCN061', name: 'DR骨盆正位', unitPrice: 100 },
  { code: 'SCN062', name: 'DR髋关节正位', unitPrice: 90 },
  { code: 'SCN063', name: 'DR膝关节正侧位', unitPrice: 90 },
  { code: 'SCN064', name: 'DR踝关节正侧位', unitPrice: 80 },
  { code: 'SCN065', name: 'DR腕关节正侧位', unitPrice: 80 },
  { code: 'SCN066', name: 'DR肘关节正侧位', unitPrice: 80 },
  { code: 'SCN067', name: 'DR肩关节正位', unitPrice: 80 },
  { code: 'SCN068', name: 'DR手正斜位', unitPrice: 70 },
  { code: 'SCN069', name: 'DR足正斜位', unitPrice: 70 },
  { code: 'SCN070', name: 'DR鼻骨侧位', unitPrice: 70 },
  { code: 'SCN071', name: 'DR副鼻窦华氏位', unitPrice: 80 },
  { code: 'SCN072', name: 'DR乳突伦氏位', unitPrice: 100 },
  { code: 'SCN073', name: 'DR口腔全景', unitPrice: 120 },
  { code: 'SCN074', name: 'DR食道吞钡造影', unitPrice: 200 },
  { code: 'SCN075', name: 'DR上消化道钡餐', unitPrice: 280 },
  { code: 'SCN076', name: 'DR全消化道钡餐', unitPrice: 380 },
  { code: 'SCN077', name: 'DR钡剂灌肠', unitPrice: 320 },
  { code: 'SCN078', name: 'DR静脉肾盂造影(IVP)', unitPrice: 300 },
  { code: 'SCN079', name: 'DR逆行肾盂造影', unitPrice: 350 },
  { code: 'SCN080', name: 'DR子宫输卵管造影', unitPrice: 450 },
  { code: 'SCN081', name: 'DR瘘管/窦道造影', unitPrice: 250 },
  { code: 'SCN082', name: 'DR T管造影', unitPrice: 200 },
  { code: 'SCN083', name: 'DS脑血管造影', unitPrice: 3500 },
  { code: 'SCN084', name: 'DSA冠脉造影', unitPrice: 4000 },
  { code: 'SCN085', name: 'DSA肾动脉造影', unitPrice: 2800 },
  { code: 'SCN086', name: 'DSA下肢动脉造影', unitPrice: 3000 },
  { code: 'SCN087', name: 'DSA肝动脉造影', unitPrice: 2700 },
  { code: 'SCN088', name: 'DSA肺动脉造影', unitPrice: 3200 },
  { code: 'SCN089', name: 'DSA主动脉造影', unitPrice: 2800 },
  { code: 'SCN090', name: 'DSA介入治疗(栓塞)', unitPrice: 5000 },
  { code: 'SCN091', name: 'DSA介入治疗(支架植入)', unitPrice: 5000 },
  { code: 'SCN092', name: 'DSA介入治疗(灌注化疗)', unitPrice: 4500 },
  { code: 'SCN093', name: 'DSA经皮穿刺引流', unitPrice: 3500 },
  { code: 'SCN094', name: 'DSA经皮穿刺活检', unitPrice: 2800 },
  { code: 'SCN095', name: '乳腺钼靶(单侧)', unitPrice: 240 },
  { code: 'SCN096', name: '乳腺钼靶(双侧)', unitPrice: 380 },
  { code: 'SCN097', name: '乳腺钼靶(三维断层)', unitPrice: 500 },
  { code: 'SCN098', name: '乳腺钼靶(定位穿刺)', unitPrice: 800 },
  { code: 'SCN099', name: '乳腺钼靶(导管造影)', unitPrice: 450 },
  { code: 'SCN100', name: 'PET-CT全身显像', unitPrice: 4500 },
  { code: 'SCN101', name: 'PET-CT局部显像', unitPrice: 2800 },
  { code: 'SCN102', name: 'PET-CT延迟显像', unitPrice: 1500 },
  { code: 'SCN103', name: 'PET-MR全身显像', unitPrice: 5000 },
  { code: 'SCN104', name: 'SPECT-CT全身骨显像', unitPrice: 1200 },
  { code: 'SCN105', name: 'SPECT-CT心肌灌注显像', unitPrice: 1500 },
  { code: 'SCN106', name: 'SPECT-CT甲状腺显像', unitPrice: 500 },
  { code: 'SCN107', name: 'SPECT-CT肾动态显像', unitPrice: 800 },
  { code: 'SCN108', name: 'SPECT-CT肺灌注显像', unitPrice: 900 },
  { code: 'SCN109', name: '超声(腹部全套)', unitPrice: 280 },
  { code: 'SCN110', name: '超声(心脏彩超)', unitPrice: 350 },
  { code: 'SCN111', name: '超声(血管彩超)', unitPrice: 300 },
  { code: 'SCN112', name: '超声(甲状腺)', unitPrice: 200 },
  { code: 'SCN113', name: '超声(乳腺)', unitPrice: 200 },
  { code: 'SCN114', name: '超声(妇科)', unitPrice: 220 },
  { code: 'SCN115', name: '超声(产科)', unitPrice: 250 },
  { code: 'SCN116', name: '超声(泌尿系)', unitPrice: 200 },
  { code: 'SCN117', name: '超声(浅表器官)', unitPrice: 180 },
  { code: 'SCN118', name: '超声(肌骨)', unitPrice: 250 },
  { code: 'SCN119', name: '超声(介入引导)', unitPrice: 400 },
  { code: 'SCN120', name: '超声(弹性成像)', unitPrice: 150 },
  { code: 'SCN121', name: '超声(造影增强)', unitPrice: 500 },
  { code: 'DGN001', name: '常规X线诊断报告', unitPrice: 50 },
  { code: 'DGN002', name: 'CT诊断报告', unitPrice: 80 },
  { code: 'DGN003', name: 'MR诊断报告', unitPrice: 100 },
  { code: 'DGN004', name: 'DSA诊断报告', unitPrice: 150 },
  { code: 'DGN005', name: '乳腺钼靶诊断报告', unitPrice: 80 },
  { code: 'DGN006', name: 'PET-CT诊断报告', unitPrice: 200 },
  { code: 'DGN007', name: 'SPECT诊断报告', unitPrice: 150 },
  { code: 'DGN008', name: '超声诊断报告', unitPrice: 60 },
  { code: 'DGN009', name: '急诊影像诊断报告', unitPrice: 120 },
  { code: 'DGN010', name: '影像会诊(单科)', unitPrice: 200 },
  { code: 'DGN011', name: '影像会诊(多科)', unitPrice: 350 },
  { code: 'DGN012', name: '影像远程会诊', unitPrice: 300 },
  { code: 'DGN013', name: 'AI辅助诊断(CT肺结节)', unitPrice: 120 },
  { code: 'DGN014', name: 'AI辅助诊断(CT冠脉)', unitPrice: 180 },
  { code: 'DGN015', name: 'AI辅助诊断(DR骨折)', unitPrice: 100 },
  { code: 'DGN016', name: 'AI辅助诊断(MR脑肿瘤)', unitPrice: 200 },
  { code: 'DGN017', name: 'AI辅助诊断(乳腺钼靶)', unitPrice: 150 },
  { code: 'DGN018', name: 'AI辅助诊断(胸部CT新冠)', unitPrice: 100 },
  { code: 'DGN019', name: 'AI辅助诊断(骨龄评估)', unitPrice: 120 },
  { code: 'DGN020', name: 'AI辅助诊断(眼底OCT)', unitPrice: 150 },
  { code: 'DGN021', name: '三维重建后处理', unitPrice: 160 },
  { code: 'DGN022', name: 'CT仿真内窥镜', unitPrice: 200 },
  { code: 'DGN023', name: 'MR脑灌注分析', unitPrice: 300 },
  { code: 'DGN024', name: 'MR脑功能分析', unitPrice: 400 },
  { code: 'DGN025', name: 'CT冠脉斑块分析', unitPrice: 280 },
  { code: 'DGN026', name: 'CT骨密度分析', unitPrice: 100 },
  { code: 'DGN027', name: '肺结节分析随访', unitPrice: 150 },
  { code: 'DGN028', name: '肝肿瘤评估分析', unitPrice: 200 },
  { code: 'DGN029', name: '影像学定量分析', unitPrice: 180 },
  { code: 'DGN030', name: '手写报告加急费', unitPrice: 100 },
  { code: 'DGN031', name: '外文翻译报告', unitPrice: 150 },
  { code: 'DGN032', name: '影像资料刻录(光盘)', unitPrice: 50 },
  { code: 'DGN033', name: '影像资料云存储', unitPrice: 30 },
  { code: 'DGN034', name: '胶片打印(14×17)', unitPrice: 25 },
  { code: 'DGN035', name: '胶片打印(8×10)', unitPrice: 20 },
  { code: 'DGN036', name: '彩色胶片打印', unitPrice: 40 },
  { code: 'DGN037', name: '增强后处理工作流', unitPrice: 120 },
  { code: 'DGN038', name: '影像学图谱对照分析', unitPrice: 100 },
  { code: 'DGN039', name: '术中影像导航定位', unitPrice: 500 },
  { code: 'DGN040', name: '影像学文献检索报告', unitPrice: 80 },
];

const PATIENTS = Array.from({ length: 500 }, (_, i) => ({
  id: `p-${1001 + i}`,
  name: ['李明','王芳','赵刚','刘洋','陈丽','张强','孙莉','黄伟','吴敏','林峰',
         '周华','许芳','赵文博','钱丽华','孙长海','李娜','王建军','张秀英','陈志强','刘佳琪',
         '杨帆','郑敏','马涛','黄丽娟','刘永强','王伟','李秀兰','张磊','孙静','徐艳',
         '胡波','郭洁','林涛','高芳','罗文','梁娟','宋涛','唐敏','韩冰','曹杰',
         '邓丽','许鹏','彭超','苏晓','潘婷','田军','石磊','谭敏','韦伟','贾蓉',
         '范强','沈洁','金旭','赖琳','蔡文','袁婷','邹强','方艳','汪胜','洪莉',
         '侯磊','廖芳','邱鹏','白洁','冯伟','孙楠','朱倩','姜峰','马兰','余凯',
         '丁燕','罗刚','程洁','叶鹏','钟敏','谭峰','江慧','夏磊','龙婷','文杰',
         '黎娟','龚伟','严俊','史芳','华磊','倪敏','郎涛','金晶','武涛','顾芳',
         '常伟','贺敏','左鹏','温婷','乔峰','彭芳','兵杰','殷俊','秦芳','魏涛'][i % 100],
}));

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickItems(allItems, minCount, maxCount) {
  const count = randomInt(minCount, maxCount);
  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(item => {
    const quantity = randomInt(1, item.unitPrice > 1000 ? 1 : 3);
    const totalPrice = Math.round(quantity * item.unitPrice);
    return { itemCode: item.code, itemName: item.name, quantity, unitPrice: item.unitPrice, totalPrice };
  });
}

const SITE_IDS = ['S001', 'S002', 'S003'];

function genInvoice() {
  const patient = pickRandom(PATIENTS);
  const siteId = pickRandom(SITE_IDS);
  const statusRand = Math.random();
  const status = statusRand < 0.80 ? 'PAID' : statusRand < 0.95 ? 'UNPAID' : 'REFUNDED';
  const items = pickItems(CHARGE_ITEMS, 1, 6);
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const insuranceRand = Math.random();
  const insuranceRate = insuranceRand < 0.40 ? 0.7 : insuranceRand < 0.65 ? 0.55 : insuranceRand < 0.75 ? 0.85 : 0;
  const issuedAt = randomDate(new Date('2024-01-01'), new Date('2026-07-01')).toISOString();
  const insurancePaid = insuranceRate > 0 ? Math.round(totalAmount * insuranceRate) : 0;
  const selfPaid = totalAmount - insurancePaid;

  let paidAt = undefined;
  if (status === 'PAID') {
    const paidDate = new Date(issuedAt);
    paidDate.setDate(paidDate.getDate() + randomInt(0, 15));
    paidAt = paidDate.toISOString();
  }
  return { patientId: patient.id, patientName: patient.name, siteId, items, totalAmount, insurancePaid, selfPaid, status, issuedAt, paidAt };
}

// ============= OUTPUT =============

const DATA_DIR = resolve(ROOT, 'src/data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Write siteMasterMock.ts
const siteLines = [
  'export interface SiteConfig {',
  '  siteId: string;',
  '  siteName: string;',
  '  address: string;',
  '  departmentCount: number;',
  '  deviceCount: number;',
  '  annualExamVolume: number;',
  '  devices: { deviceId: string; deviceName: string; modality: string; room: string }[];',
  '}',
  '',
  'export const SITE_CONFIG: SiteConfig[] = [',
];

for (const [siteId, cfg] of Object.entries(siteConfig)) {
  siteLines.push('  {');
  siteLines.push(`    siteId: '${siteId}',`);
  siteLines.push(`    siteName: '${cfg.siteName}',`);
  siteLines.push(`    address: '${cfg.address}',`);
  siteLines.push(`    departmentCount: ${cfg.departmentCount},`);
  siteLines.push(`    deviceCount: ${cfg.deviceCount},`);
  siteLines.push(`    annualExamVolume: ${cfg.annualExamVolume},`);
  siteLines.push('    devices: [');
  for (const d of cfg.devices) {
    const [did, dname, mod, room] = d;
    siteLines.push(`      { deviceId: '${did}', deviceName: '${dname}', modality: '${mod}', room: '${room}' },`);
  }
  siteLines.push('    ],');
  siteLines.push('  },');
}
siteLines.push('];');

writeFileSync(resolve(DATA_DIR, 'siteMasterMock.ts'), siteLines.join('\n') + '\n', 'utf-8');
console.log(`[seed] siteMasterMock.ts written — ${Object.keys(siteConfig).length} sites`);

// Write financeMock.ts
const invoiceDefStart = [
  'export interface InvoiceItem {',
  '  itemCode: string;',
  '  itemName: string;',
  '  quantity: number;',
  '  unitPrice: number;',
  '  totalPrice: number;',
  '}',
  '',
  'export interface InvoiceRecord {',
  '  invoiceId: string;',
  '  patientId: string;',
  '  patientName: string;',
  '  siteId: string;',
  '  items: InvoiceItem[];',
  '  totalAmount: number;',
  '  insurancePaid: number;',
  '  selfPaid: number;',
  '  status: \'PAID\' | \'UNPAID\' | \'REFUNDED\';',
  '  issuedAt: string;',
  '  paidAt?: string;',
  '}',
];

const recordCount = 5000;
const invoices = Array.from({ length: recordCount }, (_, i) => {
  const inv = genInvoice();
  inv.invoiceId = `INV-${String(i + 1).padStart(6, '0')}`;
  return inv;
});

const finLines = [...invoiceDefStart, '', 'export const GENERATED_INVOICES: InvoiceRecord[] = ['];
for (const inv of invoices) {
  finLines.push('  {');
  finLines.push(`    invoiceId: '${inv.invoiceId}',`);
  finLines.push(`    patientId: '${inv.patientId}',`);
  finLines.push(`    patientName: '${inv.patientName}',`);
  finLines.push(`    siteId: '${inv.siteId}',`);
  finLines.push('    items: [');
  for (const item of inv.items) {
    finLines.push(`      { itemCode: '${item.itemCode}', itemName: '${item.itemName}', quantity: ${item.quantity}, unitPrice: ${item.unitPrice}, totalPrice: ${item.totalPrice} },`);
  }
  finLines.push('    ],');
  finLines.push(`    totalAmount: ${inv.totalAmount},`);
  finLines.push(`    insurancePaid: ${inv.insurancePaid},`);
  finLines.push(`    selfPaid: ${inv.selfPaid},`);
  finLines.push(`    status: '${inv.status}',`);
  finLines.push(`    issuedAt: '${inv.issuedAt}',`);
  if (inv.paidAt) {
    finLines.push(`    paidAt: '${inv.paidAt}',`);
  }
  finLines.push('  },');
}
finLines.push('];');

writeFileSync(resolve(DATA_DIR, 'financeMock.ts'), finLines.join('\n') + '\n', 'utf-8');
console.log(`[seed] financeMock.ts written — ${recordCount} invoices`);

console.log('[seed] Done.');
