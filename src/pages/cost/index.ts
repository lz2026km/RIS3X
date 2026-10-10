export type TimeRange = 'month' | 'quarter' | 'year'
export type TabType = 'overview' | 'equipment' | 'consumable' | 'labor' | 'benefit' | 'medicalConsumable' | 'depreciation' | 'profitMargin' | 'departmentRanking' | 'drg' | 'breakeven' | 'insurance' | 'budget' | 'pl' | 'claims'

export type EquipmentCost = {
  id: string
  name: string
  modality: string
  purchasePrice: number
  depreciationYears: number
  annualMaintenance: number
  annualUsage: number
  unitCost: number
}

export type ConsumableCost = {
  id: string
  name: string
  category: string
  unit: string
  unitPrice: number
  monthlyUsage: number
  monthlyCost: number
  annualCost: number
}

export type LaborCost = {
  id: string
  role: string
  count: number
  avgSalary: number
  annualCost: number
  workload: number
}

export type BenefitData = {
  month: string
  revenue: number
  cost: number
  profit: number
  examCount: number
}

export type MedicalConsumableDetail = {
  id: string
  examType: string
  itemName: string
  unit: string
  unitPrice: number
  monthlyUsage: number
  monthlyCost: number
  annualCost: number
}

export type DeptConsumable = {
  deptId: string
  deptName: string
  modality: string
  ctConsumable: number
  mrConsumable: number
  dsaConsumable: number
  total: number
}

export type EquipmentDepreciation = {
  id: string
  name: string
  modality: string
  purchasePrice: number
  salvageValue: number
  totalDepreciable: number
  usefulYears: number
  depreciationMethod: 'straightLine' | 'doubleDeclining'
  annualDepreciation: number
  monthlyDepreciation: number
  accumulatedDepreciation: number
  currentBookValue: number
}

export type ExamProfitMargin = {
  id: string
  examName: string
  modality: string
  revenue: number
  cost: number
  profit: number
  profitRate: number
  monthlyCount: number
  monthlyProfit: number
  isLoss: boolean
}

export type DeptRevenue = {
  deptId: string
  deptName: string
  modality: string
  monthlyRevenue: number
  monthlyCost: number
  monthlyProfit: number
  examCount: number
  costPerExam: number
  profitPerExam: number
  yoyGrowth: number
  momGrowth: number
}

export const PRIMARY = 'var(--color-primary-800)'

export const EQUIPMENT_DATA: EquipmentCost[] = [
  { id: 'ct-force', name: 'SOMATOM Force', modality: 'CT', purchasePrice: 1200, depreciationYears: 10, annualMaintenance: 80, annualUsage: 12000, unitCost: 0 },
  { id: 'mri-prisma', name: 'Prisma 3.0T', modality: 'MRI', purchasePrice: 2800, depreciationYears: 10, annualMaintenance: 150, annualUsage: 6000, unitCost: 0 },
  { id: 'dsa-artis', name: 'Artis Zee', modality: 'DSA', purchasePrice: 1800, depreciationYears: 10, annualMaintenance: 120, annualUsage: 3000, unitCost: 0 },
  { id: 'ct-lightning', name: 'SOMATOM Lightning', modality: 'CT', purchasePrice: 600, depreciationYears: 10, annualMaintenance: 45, annualUsage: 8000, unitCost: 0 },
  { id: 'mri-sempra', name: 'Sempra 1.5T', modality: 'MRI', purchasePrice: 900, depreciationYears: 10, annualMaintenance: 60, annualUsage: 5000, unitCost: 0 },
]

export const CONSUMABLE_DATA: ConsumableCost[] = [
  { id: 'film-14x17', name: '14x17英寸胶片', category: '胶片', unit: '张', unitPrice: 28, monthlyUsage: 3000, monthlyCost: 84000, annualCost: 1008000 },
  { id: 'film-10x12', name: '10x12英寸胶片', category: '胶片', unit: '张', unitPrice: 18, monthlyUsage: 5000, monthlyCost: 90000, annualCost: 1080000 },
  { id: 'film-8x10', name: '8x10英寸胶片', category: '胶片', unit: '张', unitPrice: 12, monthlyUsage: 2000, monthlyCost: 24000, annualCost: 288000 },
  { id: 'contrast-ct', name: 'CT对比剂(碘海醇)', category: '对比剂', unit: '瓶', unitPrice: 280, monthlyUsage: 600, monthlyCost: 168000, annualCost: 2016000 },
  { id: 'contrast-mri', name: 'MRI对比剂(钆剂)', category: '对比剂', unit: '瓶', unitPrice: 520, monthlyUsage: 200, monthlyCost: 104000, annualCost: 1248000 },
  { id: 'injector-syringe', name: '高压注射器针筒', category: '注射器', unit: '支', unitPrice: 85, monthlyUsage: 400, monthlyCost: 34000, annualCost: 408000 },
  { id: 'catheter-dsa', name: 'DSA导管耗材', category: '耗材', unit: '套', unitPrice: 2500, monthlyUsage: 80, monthlyCost: 200000, annualCost: 2400000 },
  { id: 'film-chemical', name: '胶片冲洗化学试剂', category: '其他', unit: '套', unitPrice: 4500, monthlyUsage: 4, monthlyCost: 18000, annualCost: 216000 },
  { id: 'dvd-medias', name: 'DICOM光盘刻录', category: '其他', unit: '张', unitPrice: 8, monthlyUsage: 600, monthlyCost: 4800, annualCost: 57600 },
]

export const LABOR_DATA: LaborCost[] = [
  { id: 'tech-ct', role: 'CT技师', count: 8, avgSalary: 12000, annualCost: 0, workload: 0 },
  { id: 'tech-mri', role: 'MRI技师', count: 6, avgSalary: 13500, annualCost: 0, workload: 0 },
  { id: 'tech-dsa', role: 'DSA技师', count: 4, avgSalary: 15000, annualCost: 0, workload: 0 },
  { id: 'nurse-ct', role: 'CT护士', count: 4, avgSalary: 10000, annualCost: 0, workload: 0 },
  { id: 'nurse-mri', role: 'MRI护士', count: 3, avgSalary: 10000, annualCost: 0, workload: 0 },
  { id: 'nurse-dsa', role: 'DSA护士', count: 3, avgSalary: 11000, annualCost: 0, workload: 0 },
  { id: 'physician', role: '放射科医师', count: 12, avgSalary: 18000, annualCost: 0, workload: 0 },
  { id: 'assistant', role: '登记员/助理', count: 6, avgSalary: 6000, annualCost: 0, workload: 0 },
]

export const BENEFIT_DATA: BenefitData[] = [
  { month: '2025-07', revenue: 680, cost: 420, profit: 260, examCount: 4200 },
  { month: '2025-08', revenue: 720, cost: 435, profit: 285, examCount: 4450 },
  { month: '2025-09', revenue: 695, cost: 428, profit: 267, examCount: 4300 },
  { month: '2025-10', revenue: 780, cost: 445, profit: 335, examCount: 4800 },
  { month: '2025-11', revenue: 820, cost: 460, profit: 360, examCount: 5100 },
  { month: '2025-12', revenue: 890, cost: 485, profit: 405, examCount: 5500 },
  { month: '2026-01', revenue: 750, cost: 440, profit: 310, examCount: 4600 },
  { month: '2026-02', revenue: 680, cost: 420, profit: 260, examCount: 4100 },
  { month: '2026-03', revenue: 820, cost: 465, profit: 355, examCount: 5100 },
  { month: '2026-04', revenue: 860, cost: 475, profit: 385, examCount: 5300 },
]

export const MEDICAL_CONSUMABLE_DATA: MedicalConsumableDetail[] = [
  { id: 'ct-contrast-iodine', examType: 'CT增强', itemName: '对比剂(碘海醇)', unit: '瓶', unitPrice: 280, monthlyUsage: 400, monthlyCost: 112000, annualCost: 1344000 },
  { id: 'ct-syringe', examType: 'CT增强', itemName: '高压注射器针筒', unit: '支', unitPrice: 85, monthlyUsage: 350, monthlyCost: 29750, annualCost: 357000 },
  { id: 'ct-needle', examType: 'CT增强', itemName: '静脉穿刺针管', unit: '支', unitPrice: 12, monthlyUsage: 400, monthlyCost: 4800, annualCost: 57600 },
  { id: 'ct-saline', examType: 'CT增强', itemName: '生理盐水冲管', unit: '瓶', unitPrice: 5, monthlyUsage: 800, monthlyCost: 4000, annualCost: 48000 },
  { id: 'mr-contrast-gd', examType: 'MR增强', itemName: '钆剂(钆双胺)', unit: '瓶', unitPrice: 520, monthlyUsage: 180, monthlyCost: 93600, annualCost: 1123200 },
  { id: 'mr-syringe', examType: 'MR增强', itemName: '高压注射器针筒', unit: '支', unitPrice: 95, monthlyUsage: 160, monthlyCost: 15200, annualCost: 182400 },
  { id: 'mr-needle', examType: 'MR增强', itemName: '静脉穿刺针管', unit: '支', unitPrice: 12, monthlyUsage: 180, monthlyCost: 2160, annualCost: 25920 },
  { id: 'dsa-catheter-guide', examType: 'DSA', itemName: '导引导管', unit: '套', unitPrice: 3500, monthlyUsage: 50, monthlyCost: 175000, annualCost: 2100000 },
  { id: 'dsa-catheter-micro', examType: 'DSA', itemName: '微导管', unit: '套', unitPrice: 4500, monthlyUsage: 40, monthlyCost: 180000, annualCost: 2160000 },
  { id: 'dsa-stent', examType: 'DSA', itemName: '支架(冠脉/外周)', unit: '个', unitPrice: 8500, monthlyUsage: 25, monthlyCost: 212500, annualCost: 2550000 },
  { id: 'dsa-balloon', examType: 'DSA', itemName: '球囊扩张导管', unit: '个', unitPrice: 3200, monthlyUsage: 35, monthlyCost: 112000, annualCost: 1344000 },
  { id: 'dsa-contrast', examType: 'DSA', itemName: '造影剂(碘克沙醇)', unit: '瓶', unitPrice: 380, monthlyUsage: 120, monthlyCost: 45600, annualCost: 547200 },
  { id: 'dsa-coil', examType: 'DSA', itemName: '弹簧圈栓塞物', unit: '个', unitPrice: 2800, monthlyUsage: 20, monthlyCost: 56000, annualCost: 672000 },
  { id: 'dsa-suture', examType: 'DSA', itemName: '血管缝合器', unit: '套', unitPrice: 1200, monthlyUsage: 45, monthlyCost: 54000, annualCost: 648000 },
]

export const DEPT_CONSUMABLE_DATA: DeptConsumable[] = [
  { deptId: 'dept-ct1', deptName: 'CT室一组', modality: 'CT', ctConsumable: 185, mrConsumable: 0, dsaConsumable: 0, total: 185 },
  { deptId: 'dept-ct2', deptName: 'CT室二组', modality: 'CT', ctConsumable: 165, mrConsumable: 0, dsaConsumable: 0, total: 165 },
  { deptId: 'dept-mr1', deptName: 'MRI室一组', modality: 'MRI', ctConsumable: 0, mrConsumable: 145, dsaConsumable: 0, total: 145 },
  { deptId: 'dept-mr2', deptName: 'MRI室二组', modality: 'MRI', ctConsumable: 0, mrConsumable: 128, dsaConsumable: 0, total: 128 },
  { deptId: 'dept-dsa1', deptName: 'DSA介入室', modality: 'DSA', ctConsumable: 0, mrConsumable: 0, dsaConsumable: 980, total: 980 },
  { deptId: 'dept-xray', deptName: '普放室', modality: '普放', ctConsumable: 25, mrConsumable: 0, dsaConsumable: 0, total: 25 },
]

export const DEPRECIATION_DATA: EquipmentDepreciation[] = [
  { id: 'dep-ct-force', name: 'SOMATOM Force', modality: 'CT', purchasePrice: 1200, salvageValue: 120, totalDepreciable: 1080, usefulYears: 10, depreciationMethod: 'straightLine', annualDepreciation: 108, monthlyDepreciation: 9, accumulatedDepreciation: 324, currentBookValue: 876 },
  { id: 'dep-mri-prisma', name: 'Prisma 3.0T', modality: 'MRI', purchasePrice: 2800, salvageValue: 280, totalDepreciable: 2520, usefulYears: 10, depreciationMethod: 'doubleDeclining', annualDepreciation: 0, monthlyDepreciation: 0, accumulatedDepreciation: 840, currentBookValue: 1960 },
  { id: 'dep-dsa-artis', name: 'Artis Zee', modality: 'DSA', purchasePrice: 1800, salvageValue: 180, totalDepreciable: 1620, usefulYears: 10, depreciationMethod: 'straightLine', annualDepreciation: 162, monthlyDepreciation: 13.5, accumulatedDepreciation: 486, currentBookValue: 1314 },
  { id: 'dep-ct-lightning', name: 'SOMATOM Lightning', modality: 'CT', purchasePrice: 600, salvageValue: 60, totalDepreciable: 540, usefulYears: 10, depreciationMethod: 'straightLine', annualDepreciation: 54, monthlyDepreciation: 4.5, accumulatedDepreciation: 216, currentBookValue: 384 },
  { id: 'dep-mri-sempra', name: 'Sempra 1.5T', modality: 'MRI', purchasePrice: 900, salvageValue: 90, totalDepreciable: 810, usefulYears: 10, depreciationMethod: 'doubleDeclining', annualDepreciation: 0, monthlyDepreciation: 0, accumulatedDepreciation: 270, currentBookValue: 630 },
]

export const EXAM_PROFIT_MARGIN_DATA: ExamProfitMargin[] = [
  { id: 'exam-ct-plain', examName: 'CT平扫', modality: 'CT', revenue: 450, cost: 180, profit: 270, profitRate: 60.0, monthlyCount: 2800, monthlyProfit: 756000, isLoss: false },
  { id: 'exam-ct-contrast', examName: 'CT增强', modality: 'CT', revenue: 850, cost: 520, profit: 330, profitRate: 38.8, monthlyCount: 450, monthlyProfit: 148500, isLoss: false },
  { id: 'exam-mr-plain', examName: 'MRI平扫', modality: 'MRI', revenue: 780, cost: 320, profit: 460, profitRate: 59.0, monthlyCount: 1200, monthlyProfit: 552000, isLoss: false },
  { id: 'exam-mr-contrast', examName: 'MR增强', modality: 'MRI', revenue: 1200, cost: 780, profit: 420, profitRate: 35.0, monthlyCount: 200, monthlyProfit: 84000, isLoss: false },
  { id: 'exam-dsa-coronary', examName: 'DSA冠脉造影', modality: 'DSA', revenue: 8500, cost: 6200, profit: 2300, profitRate: 27.1, monthlyCount: 80, monthlyProfit: 184000, isLoss: false },
  { id: 'exam-dsa-peripheral', examName: 'DSA外周血管', modality: 'DSA', revenue: 6800, cost: 5100, profit: 1700, profitRate: 25.0, monthlyCount: 45, monthlyProfit: 76500, isLoss: false },
  { id: 'exam-xray-chest', examName: 'X线胸部正侧位', modality: '普放', revenue: 120, cost: 45, profit: 75, profitRate: 62.5, monthlyCount: 3500, monthlyProfit: 262500, isLoss: false },
  { id: 'exam-xray-bone', examName: 'X线骨骼片', modality: '普放', revenue: 150, cost: 55, profit: 95, profitRate: 63.3, monthlyCount: 2200, monthlyProfit: 209000, isLoss: false },
  { id: 'exam-ct-cardiac', examName: 'CT冠脉成像', modality: 'CT', revenue: 1500, cost: 1350, profit: 150, profitRate: 10.0, monthlyCount: 120, monthlyProfit: 18000, isLoss: false },
  { id: 'exam-dsa-neuro', examName: 'DSA神经介入', modality: 'DSA', revenue: 12000, cost: 11500, profit: 500, profitRate: 4.2, monthlyCount: 30, monthlyProfit: 15000, isLoss: false },
  { id: 'exam-ct-low', examName: 'CT低剂量筛查', modality: 'CT', revenue: 320, cost: 380, profit: -60, profitRate: -18.8, monthlyCount: 180, monthlyProfit: -10800, isLoss: true },
  { id: 'exam-mr-functional', examName: 'MR功能成像', modality: 'MRI', revenue: 980, cost: 1050, profit: -70, profitRate: -7.1, monthlyCount: 60, monthlyProfit: -4200, isLoss: true },
]

export const DEPT_REVENUE_DATA: DeptRevenue[] = [
  { deptId: 'dept-ct1', deptName: 'CT室一组', modality: 'CT', monthlyRevenue: 285, monthlyCost: 145, monthlyProfit: 140, examCount: 1500, costPerExam: 967, profitPerExam: 933, yoyGrowth: 15.2, momGrowth: 5.8 },
  { deptId: 'dept-ct2', deptName: 'CT室二组', modality: 'CT', monthlyRevenue: 256, monthlyCost: 132, monthlyProfit: 124, examCount: 1350, costPerExam: 978, profitPerExam: 919, yoyGrowth: 12.8, momGrowth: 3.5 },
  { deptId: 'dept-mr1', deptName: 'MRI室一组', modality: 'MRI', monthlyRevenue: 320, monthlyCost: 155, monthlyProfit: 165, examCount: 850, costPerExam: 1824, profitPerExam: 1941, yoyGrowth: 18.5, momGrowth: 8.2 },
  { deptId: 'dept-mr2', deptName: 'MRI室二组', modality: 'MRI', monthlyRevenue: 285, monthlyCost: 142, monthlyProfit: 143, examCount: 750, costPerExam: 1893, profitPerExam: 1907, yoyGrowth: 14.2, momGrowth: 6.5 },
  { deptId: 'dept-dsa', deptName: 'DSA介入室', modality: 'DSA', monthlyRevenue: 580, monthlyCost: 420, monthlyProfit: 160, examCount: 180, costPerExam: 23333, profitPerExam: 8889, yoyGrowth: 22.5, momGrowth: 12.3 },
  { deptId: 'dept-xray', deptName: '普放室', modality: '普放', monthlyRevenue: 95, monthlyCost: 42, monthlyProfit: 53, examCount: 2800, costPerExam: 150, profitPerExam: 189, yoyGrowth: -3.5, momGrowth: -1.2 },
]

export const DRG_DATA = [
  { code: 'DRG-BJ11', name: '缺血性脑卒中', icd: 'I63.901', weight: 1.8, cost: 28500, nationalAvgCost: 32000, reimbursement: 22800, days: 8, level: 'A' as const },
  { code: 'DRG-BJ13', name: '出血性脑卒中', icd: 'I61.902', weight: 2.5, cost: 52000, nationalAvgCost: 58000, reimbursement: 41600, days: 14, level: 'B' as const },
  { code: 'DRG-CA11', name: '冠脉支架植入', icd: 'I25.103', weight: 3.2, cost: 85000, nationalAvgCost: 92000, reimbursement: 68000, days: 7, level: 'A' as const },
  { code: 'DRG-DB11', name: '肺部恶性肿瘤手术', icd: 'C34.901', weight: 2.8, cost: 68000, nationalAvgCost: 75000, reimbursement: 54400, days: 12, level: 'A' as const },
  { code: 'DRG-EJ11', name: '髋关节置换术', icd: 'M16.901', weight: 2.1, cost: 42000, nationalAvgCost: 45000, reimbursement: 33600, days: 10, level: 'B' as const },
  { code: 'DRG-FS11', name: '急性阑尾炎手术', icd: 'K35.901', weight: 0.9, cost: 12000, nationalAvgCost: 15000, reimbursement: 9600, days: 5, level: 'A' as const },
  { code: 'DIP-ZJ01', name: 'CT增强检查', icd: 'Z01.800', weight: 0.4, cost: 3200, nationalAvgCost: 3800, reimbursement: 2560, days: 1, level: 'C' as const },
  { code: 'DIP-ZJ02', name: 'MRI增强检查', icd: 'Z01.801', weight: 0.5, cost: 4800, nationalAvgCost: 5200, reimbursement: 3840, days: 1, level: 'C' as const },
]

export const BREAK_EVEN_DATA = {
  devices: [
    { name: 'CT SOMATOM Force', fixedCost: 120000, variableCostPerExam: 320, revenuePerExam: 680, monthlyExams: 1000, breakEvenPoint: 0 },
    { name: 'MRI Prisma 3.0T', fixedCost: 180000, variableCostPerExam: 480, revenuePerExam: 980, monthlyExams: 500, breakEvenPoint: 0 },
    { name: 'DSA Artis Zee', fixedCost: 200000, variableCostPerExam: 3500, revenuePerExam: 8500, monthlyExams: 150, breakEvenPoint: 0 },
  ],
  monthlyTrend: [
    { month: '2026-01', ctRevenue: 580000, ctCost: 420000, mrRevenue: 390000, mrCost: 310000, dsaRevenue: 950000, dsaCost: 780000 },
    { month: '2026-02', ctRevenue: 520000, ctCost: 380000, mrRevenue: 360000, mrCost: 290000, dsaRevenue: 880000, dsaCost: 720000 },
    { month: '2026-03', ctRevenue: 610000, ctCost: 440000, mrRevenue: 420000, mrCost: 330000, dsaRevenue: 1020000, dsaCost: 820000 },
    { month: '2026-04', ctRevenue: 650000, ctCost: 460000, mrRevenue: 450000, mrCost: 350000, dsaRevenue: 1080000, dsaCost: 860000 },
  ]
}

export const INSURANCE_ALLOCATION = {
  currentMonth: [
    { name: '医保(城镇职工)', type: '医保', value: 385000, color: 'var(--color-primary-500)' },
    { name: '医保(城乡居民)', type: '医保', value: 156000, color: '#8b5cf6' },
    { name: '商业保险', type: '商保', value: 98000, color: '#059669' },
    { name: '自费', type: '自费', value: 62000, color: 'var(--color-warning-600)' },
    { name: '公费/其他', type: '其他', value: 28000, color: '#6b7280' },
  ],
  monthlyTrend: [
    { month: '2026-01', medicalInsurance: 510, commercial: 82, selfPay: 58, other: 25 },
    { month: '2026-02', medicalInsurance: 485, commercial: 75, selfPay: 52, other: 22 },
    { month: '2026-03', medicalInsurance: 530, commercial: 90, selfPay: 60, other: 28 },
    { month: '2026-04', medicalInsurance: 541, commercial: 98, selfPay: 62, other: 28 },
  ]
}

export const BUDGET_DATA = {
  monthly: [
    { month: '2026-01', budget: 420000, actual: 418000, variance: -2000, varianceRate: -0.5 },
    { month: '2026-02', budget: 420000, actual: 435000, variance: 15000, varianceRate: 3.6 },
    { month: '2026-03', budget: 450000, actual: 428000, variance: -22000, varianceRate: -4.9 },
    { month: '2026-04', budget: 450000, actual: 498000, variance: 48000, varianceRate: 10.7 },
  ],
  ytd: { budget: 1740000, actual: 1779000, variance: 39000, varianceRate: 2.2 },
  categories: [
    { name: '胶片耗材', budget: 520000, actual: 538000 },
    { name: '对比剂', budget: 380000, actual: 365000 },
    { name: '导管支架', budget: 480000, actual: 510000 },
    { name: '人力成本', budget: 1680000, actual: 1700000 },
    { name: '设备维保', budget: 520000, actual: 510000 },
    { name: '其他费用', budget: 120000, actual: 108000 },
  ]
}

export const PL_DATA = {
  currentMonth: { revenue: 729000, cost: 385000, grossProfit: 344000, operatingExpenses: 185000, netIncome: 159000, profitRate: 21.8 },
  monthly: [
    { month: '2026-01', revenue: 680000, cost: 365000, grossProfit: 315000, operatingExpenses: 178000, netIncome: 137000 },
    { month: '2026-02', revenue: 652000, cost: 352000, grossProfit: 300000, operatingExpenses: 175000, netIncome: 125000 },
    { month: '2026-03', revenue: 698000, cost: 378000, grossProfit: 320000, operatingExpenses: 182000, netIncome: 138000 },
    { month: '2026-04', revenue: 729000, cost: 385000, grossProfit: 344000, operatingExpenses: 185000, netIncome: 159000 },
  ],
  breakdown: [
    { item: '检查收入', amount: 620000, type: 'revenue' as const },
    { item: '药品加成', amount: 72000, type: 'revenue' as const },
    { item: '其他收入', amount: 37000, type: 'revenue' as const },
    { item: '耗材成本', amount: -182000, type: 'cost' as const },
    { item: '人力成本', amount: -140000, type: 'cost' as const },
    { item: '设备折旧', amount: -63000, type: 'cost' as const },
    { item: '管理费用', amount: -85000, type: 'expense' as const },
    { item: '运营费用', amount: -62000, type: 'expense' as const },
    { item: '营销费用', amount: -38000, type: 'expense' as const },
  ]
}

export const CLAIMS_DATA = {
  claims: [
    { id: 'CL-001', patientName: '张伟', payer: '医保' as const, type: 'CT增强', amount: 2800, status: '已提交' as const, submitDate: '2026-04-25', result: '' as const, resultDate: '' as const },
    { id: 'CL-002', patientName: '王芳', payer: '医保' as const, type: 'MRI增强', amount: 5200, status: '已通过' as const, submitDate: '2026-04-24', result: '通过' as const, resultDate: '2026-04-28' as const },
    { id: 'CL-003', patientName: '李明', payer: '商保' as const, type: '冠脉CTA', amount: 6800, status: '已拒绝' as const, submitDate: '2026-04-22', result: '拒绝-材料不全' as const, resultDate: '2026-04-27' as const },
    { id: 'CL-004', patientName: '赵丽', payer: '医保' as const, type: 'DSA冠脉造影', amount: 8500, status: '申诉中' as const, submitDate: '2026-04-20', result: '申诉中' as const, resultDate: '' as const },
    { id: 'CL-005', patientName: '刘强', payer: '医保' as const, type: 'CT平扫', amount: 1200, status: '已提交' as const, submitDate: '2026-04-26', result: '' as const, resultDate: '' as const },
    { id: 'CL-006', patientName: '陈静', payer: '商保' as const, type: 'PET-CT全身', amount: 8800, status: '已通过' as const, submitDate: '2026-04-18', result: '通过' as const, resultDate: '2026-04-22' as const },
  ],
  denialReasons: [
    { reason: '材料不全', count: 8 },
    { reason: '医保限制用药', count: 5 },
    { reason: '检查超频次', count: 3 },
    { reason: '诊断不符', count: 2 },
    { reason: '超医保目录', count: 4 },
  ]
}

export const formatCurrency = (value: number, isSmall = false): string => {
  if (isSmall) {
    return `¥${value.toLocaleString()}`
  }
  return `¥${value.toLocaleString()}万`
}

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

export const calculateUnitCost = (equipment: EquipmentCost): number => {
  const annualDepreciation = equipment.purchasePrice / equipment.depreciationYears
  const totalAnnualCost = annualDepreciation + equipment.annualMaintenance
  return totalAnnualCost / equipment.annualUsage
}

export const calculateStraightLineDepreciation = (price: number, salvage: number, years: number, usedYears: number): { annual: number; monthly: number; accumulated: number; bookValue: number } => {
  const depreciable = price - salvage
  const annual = depreciable / years
  const accumulated = annual * usedYears
  const bookValue = price - accumulated
  return { annual, monthly: annual / 12, accumulated, bookValue }
}

export const calculateDoubleDecliningDepreciation = (price: number, salvage: number, years: number, usedYears: number): { annual: number; monthly: number; accumulated: number; bookValue: number } => {
  const rate = 2 / years
  let bookValue = price
  let accumulated = 0
  for (let i = 0; i < usedYears; i++) {
    const depreciation = bookValue * rate
    accumulated += depreciation
    bookValue -= depreciation
  }
  if (usedYears >= years - 2) {
    const remainingYears = years - usedYears
    if (remainingYears > 0) {
      const remaining = bookValue - salvage
      const annual = remaining / remainingYears
      accumulated = price - bookValue + annual * usedYears
    }
  }
  const annual = bookValue * rate
  return { annual: bookValue > salvage ? annual : 0, monthly: annual / 12, accumulated, bookValue: bookValue > salvage ? bookValue : salvage }
}

export { CostFilter } from './CostFilter'
export { CostOverview } from './CostOverview'
