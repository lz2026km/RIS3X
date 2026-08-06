// @ts-nocheck
import React, { useState, useEffect } from 'react';

interface FollowUpPatient {
  id: string;
  patientId: string;
  patientName: string;
  examType: 'CT增强' | 'MRI增强' | 'CT平扫' | 'MRI平扫';
  examDate: string;
  followUpType: '对比剂反应' | '肿瘤复查' | '早期肺癌跟踪' | '治疗评估';
  nextFollowUpDate: string;
  status: '待随访' | '进行中' | '已完成' | '逾期';
  reaction?: '无反应' | '轻度' | '中度' | '重度';
  notes?: string;
}

export default function FollowUpPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overdue'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<FollowUpPatient | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [followUpList, setFollowUpList] = useState<FollowUpPatient[]>([    { id: 'FU001', patientId: 'P202400001', patientName: '李四', examType: 'MRI增强', examDate: '2026-01-15', followUpType: '肿瘤复查', nextFollowUpDate: '2026-07-06', status: '进行中', reaction: '轻度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU002', patientId: 'P202400002', patientName: '王五', examType: 'CT平扫', examDate: '2026-04-23', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-06-24', status: '已完成', reaction: '中度', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU003', patientId: 'P202400003', patientName: '赵六', examType: 'MRI平扫', examDate: '2026-03-21', followUpType: '治疗评估', nextFollowUpDate: '2026-07-23', status: '逾期', reaction: '重度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU004', patientId: 'P202400004', patientName: '钱七', examType: 'PET-CT', examDate: '2026-05-15', followUpType: '术后复查', nextFollowUpDate: '2026-08-27', status: '待随访', reaction: '无反应', notes: 'CT引导下活检后观察' },
    { id: 'FU005', patientId: 'P202400005', patientName: '孙八', examType: 'SPECT-CT', examDate: '2026-05-02', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-12-07', status: '进行中', reaction: '轻度', notes: '放疗后疗效评估' },
    { id: 'FU006', patientId: 'P202400006', patientName: '周九', examType: 'CT增强', examDate: '2026-01-17', followUpType: '对比剂反应', nextFollowUpDate: '2026-12-01', status: '已完成', reaction: '中度', notes: '常规增强检查，无不适' },
    { id: 'FU007', patientId: 'P202400007', patientName: '吴十', examType: 'MRI增强', examDate: '2026-04-16', followUpType: '肿瘤复查', nextFollowUpDate: '2026-06-22', status: '逾期', reaction: '重度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU008', patientId: 'P202400008', patientName: '郑一', examType: 'CT平扫', examDate: '2026-01-20', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-06-22', status: '待随访', reaction: '无反应', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU009', patientId: 'P202400009', patientName: '冯二', examType: 'MRI平扫', examDate: '2026-03-16', followUpType: '治疗评估', nextFollowUpDate: '2026-10-20', status: '进行中', reaction: '轻度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU010', patientId: 'P202400010', patientName: '陈三', examType: 'PET-CT', examDate: '2026-01-18', followUpType: '术后复查', nextFollowUpDate: '2026-08-12', status: '已完成', reaction: '中度', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU011', patientId: 'P202400011', patientName: '楚四', examType: 'SPECT-CT', examDate: '2026-02-03', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-06-16', status: '逾期', reaction: '重度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU012', patientId: 'P202400012', patientName: '卫五', examType: 'CT增强', examDate: '2026-01-25', followUpType: '对比剂反应', nextFollowUpDate: '2026-08-28', status: '待随访', reaction: '无反应', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU013', patientId: 'P202400013', patientName: '蒋六', examType: 'MRI增强', examDate: '2026-01-27', followUpType: '肿瘤复查', nextFollowUpDate: '2026-12-18', status: '进行中', reaction: '轻度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU014', patientId: 'P202400014', patientName: '沈七', examType: 'CT平扫', examDate: '2026-04-07', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-12-16', status: '已完成', reaction: '中度', notes: 'CT引导下活检后观察' },
    { id: 'FU015', patientId: 'P202400015', patientName: '韩八', examType: 'MRI平扫', examDate: '2026-02-05', followUpType: '治疗评估', nextFollowUpDate: '2026-05-13', status: '逾期', reaction: '重度', notes: '放疗后疗效评估' },
    { id: 'FU016', patientId: 'P202400016', patientName: '杨九', examType: 'PET-CT', examDate: '2026-03-28', followUpType: '术后复查', nextFollowUpDate: '2026-08-17', status: '待随访', reaction: '无反应', notes: '常规增强检查，无不适' },
    { id: 'FU017', patientId: 'P202400017', patientName: '朱十', examType: 'SPECT-CT', examDate: '2026-05-28', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-05-20', status: '进行中', reaction: '轻度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU018', patientId: 'P202400018', patientName: '秦十一', examType: 'CT增强', examDate: '2026-05-21', followUpType: '对比剂反应', nextFollowUpDate: '2026-07-21', status: '已完成', reaction: '中度', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU019', patientId: 'P202400019', patientName: '尤十二', examType: 'MRI增强', examDate: '2026-05-17', followUpType: '肿瘤复查', nextFollowUpDate: '2026-12-22', status: '逾期', reaction: '重度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU020', patientId: 'P202400020', patientName: '张三', examType: 'CT平扫', examDate: '2026-05-24', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-05-16', status: '待随访', reaction: '无反应', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU021', patientId: 'P202400021', patientName: '李四', examType: 'MRI平扫', examDate: '2026-05-08', followUpType: '治疗评估', nextFollowUpDate: '2026-12-19', status: '进行中', reaction: '轻度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU022', patientId: 'P202400022', patientName: '王五', examType: 'PET-CT', examDate: '2026-03-19', followUpType: '术后复查', nextFollowUpDate: '2026-08-24', status: '已完成', reaction: '中度', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU023', patientId: 'P202400023', patientName: '赵六', examType: 'SPECT-CT', examDate: '2026-02-23', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-05-14', status: '逾期', reaction: '重度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU024', patientId: 'P202400024', patientName: '钱七', examType: 'CT增强', examDate: '2026-03-28', followUpType: '对比剂反应', nextFollowUpDate: '2026-09-23', status: '待随访', reaction: '无反应', notes: 'CT引导下活检后观察' },
    { id: 'FU025', patientId: 'P202400025', patientName: '孙八', examType: 'MRI增强', examDate: '2026-01-05', followUpType: '肿瘤复查', nextFollowUpDate: '2026-05-02', status: '进行中', reaction: '轻度', notes: '放疗后疗效评估' },
    { id: 'FU026', patientId: 'P202400026', patientName: '周九', examType: 'CT平扫', examDate: '2026-02-10', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-05-05', status: '已完成', reaction: '中度', notes: '常规增强检查，无不适' },
    { id: 'FU027', patientId: 'P202400027', patientName: '吴十', examType: 'MRI平扫', examDate: '2026-01-11', followUpType: '治疗评估', nextFollowUpDate: '2026-05-21', status: '逾期', reaction: '重度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU028', patientId: 'P202400028', patientName: '郑一', examType: 'PET-CT', examDate: '2026-03-15', followUpType: '术后复查', nextFollowUpDate: '2026-11-16', status: '待随访', reaction: '无反应', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU029', patientId: 'P202400029', patientName: '冯二', examType: 'SPECT-CT', examDate: '2026-01-18', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-07-09', status: '进行中', reaction: '轻度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU030', patientId: 'P202400030', patientName: '陈三', examType: 'CT增强', examDate: '2026-01-27', followUpType: '对比剂反应', nextFollowUpDate: '2026-12-07', status: '已完成', reaction: '中度', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU031', patientId: 'P202400031', patientName: '楚四', examType: 'MRI增强', examDate: '2026-04-05', followUpType: '肿瘤复查', nextFollowUpDate: '2026-11-09', status: '逾期', reaction: '重度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU032', patientId: 'P202400032', patientName: '卫五', examType: 'CT平扫', examDate: '2026-02-23', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-09-07', status: '待随访', reaction: '无反应', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU033', patientId: 'P202400033', patientName: '蒋六', examType: 'MRI平扫', examDate: '2026-01-22', followUpType: '治疗评估', nextFollowUpDate: '2026-09-10', status: '进行中', reaction: '轻度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU034', patientId: 'P202400034', patientName: '沈七', examType: 'PET-CT', examDate: '2026-02-28', followUpType: '术后复查', nextFollowUpDate: '2026-10-02', status: '已完成', reaction: '中度', notes: 'CT引导下活检后观察' },
    { id: 'FU035', patientId: 'P202400035', patientName: '韩八', examType: 'SPECT-CT', examDate: '2026-05-05', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-07-03', status: '逾期', reaction: '重度', notes: '放疗后疗效评估' },
    { id: 'FU036', patientId: 'P202400036', patientName: '杨九', examType: 'CT增强', examDate: '2026-03-13', followUpType: '对比剂反应', nextFollowUpDate: '2026-10-22', status: '待随访', reaction: '无反应', notes: '常规增强检查，无不适' },
    { id: 'FU037', patientId: 'P202400037', patientName: '朱十', examType: 'MRI增强', examDate: '2026-02-09', followUpType: '肿瘤复查', nextFollowUpDate: '2026-08-28', status: '进行中', reaction: '轻度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU038', patientId: 'P202400038', patientName: '秦十一', examType: 'CT平扫', examDate: '2026-03-03', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-07-28', status: '已完成', reaction: '中度', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU039', patientId: 'P202400039', patientName: '尤十二', examType: 'MRI平扫', examDate: '2026-02-02', followUpType: '治疗评估', nextFollowUpDate: '2026-06-22', status: '逾期', reaction: '重度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU040', patientId: 'P202400040', patientName: '张三', examType: 'PET-CT', examDate: '2026-04-12', followUpType: '术后复查', nextFollowUpDate: '2026-10-13', status: '待随访', reaction: '无反应', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU041', patientId: 'P202400041', patientName: '李四', examType: 'SPECT-CT', examDate: '2026-03-28', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-11-23', status: '进行中', reaction: '轻度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU042', patientId: 'P202400042', patientName: '王五', examType: 'CT增强', examDate: '2026-01-10', followUpType: '对比剂反应', nextFollowUpDate: '2026-06-10', status: '已完成', reaction: '中度', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU043', patientId: 'P202400043', patientName: '赵六', examType: 'MRI增强', examDate: '2026-04-25', followUpType: '肿瘤复查', nextFollowUpDate: '2026-11-11', status: '逾期', reaction: '重度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU044', patientId: 'P202400044', patientName: '钱七', examType: 'CT平扫', examDate: '2026-01-20', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-09-13', status: '待随访', reaction: '无反应', notes: 'CT引导下活检后观察' },
    { id: 'FU045', patientId: 'P202400045', patientName: '孙八', examType: 'MRI平扫', examDate: '2026-05-24', followUpType: '治疗评估', nextFollowUpDate: '2026-11-20', status: '进行中', reaction: '轻度', notes: '放疗后疗效评估' },
    { id: 'FU046', patientId: 'P202400046', patientName: '周九', examType: 'PET-CT', examDate: '2026-05-05', followUpType: '术后复查', nextFollowUpDate: '2026-10-27', status: '已完成', reaction: '中度', notes: '常规增强检查，无不适' },
    { id: 'FU047', patientId: 'P202400047', patientName: '吴十', examType: 'SPECT-CT', examDate: '2026-01-14', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-08-24', status: '逾期', reaction: '重度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU048', patientId: 'P202400048', patientName: '郑一', examType: 'CT增强', examDate: '2026-02-04', followUpType: '对比剂反应', nextFollowUpDate: '2026-10-15', status: '待随访', reaction: '无反应', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU049', patientId: 'P202400049', patientName: '冯二', examType: 'MRI增强', examDate: '2026-03-25', followUpType: '肿瘤复查', nextFollowUpDate: '2026-07-08', status: '进行中', reaction: '轻度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU050', patientId: 'P202400050', patientName: '陈三', examType: 'CT平扫', examDate: '2026-02-04', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-10-12', status: '已完成', reaction: '中度', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU051', patientId: 'P202400051', patientName: '楚四', examType: 'MRI平扫', examDate: '2026-05-28', followUpType: '治疗评估', nextFollowUpDate: '2026-11-08', status: '逾期', reaction: '重度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU052', patientId: 'P202400052', patientName: '卫五', examType: 'PET-CT', examDate: '2026-01-05', followUpType: '术后复查', nextFollowUpDate: '2026-08-11', status: '待随访', reaction: '无反应', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU053', patientId: 'P202400053', patientName: '蒋六', examType: 'SPECT-CT', examDate: '2026-05-07', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-12-12', status: '进行中', reaction: '轻度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU054', patientId: 'P202400054', patientName: '沈七', examType: 'CT增强', examDate: '2026-03-27', followUpType: '对比剂反应', nextFollowUpDate: '2026-09-22', status: '已完成', reaction: '中度', notes: 'CT引导下活检后观察' },
    { id: 'FU055', patientId: 'P202400055', patientName: '韩八', examType: 'MRI增强', examDate: '2026-04-20', followUpType: '肿瘤复查', nextFollowUpDate: '2026-12-26', status: '逾期', reaction: '重度', notes: '放疗后疗效评估' },
    { id: 'FU056', patientId: 'P202400056', patientName: '杨九', examType: 'CT平扫', examDate: '2026-05-20', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-12-17', status: '待随访', reaction: '无反应', notes: '常规增强检查，无不适' },
    { id: 'FU057', patientId: 'P202400057', patientName: '朱十', examType: 'MRI平扫', examDate: '2026-04-10', followUpType: '治疗评估', nextFollowUpDate: '2026-12-02', status: '进行中', reaction: '轻度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU058', patientId: 'P202400058', patientName: '秦十一', examType: 'PET-CT', examDate: '2026-01-17', followUpType: '术后复查', nextFollowUpDate: '2026-08-26', status: '已完成', reaction: '中度', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU059', patientId: 'P202400059', patientName: '尤十二', examType: 'SPECT-CT', examDate: '2026-03-08', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-09-19', status: '逾期', reaction: '重度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU060', patientId: 'P202400060', patientName: '张三', examType: 'CT增强', examDate: '2026-05-25', followUpType: '对比剂反应', nextFollowUpDate: '2026-09-01', status: '待随访', reaction: '无反应', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU061', patientId: 'P202400061', patientName: '李四', examType: 'MRI增强', examDate: '2026-01-20', followUpType: '肿瘤复查', nextFollowUpDate: '2026-05-11', status: '进行中', reaction: '轻度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU062', patientId: 'P202400062', patientName: '王五', examType: 'CT平扫', examDate: '2026-05-13', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-06-08', status: '已完成', reaction: '中度', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU063', patientId: 'P202400063', patientName: '赵六', examType: 'MRI平扫', examDate: '2026-04-16', followUpType: '治疗评估', nextFollowUpDate: '2026-11-21', status: '逾期', reaction: '重度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU064', patientId: 'P202400064', patientName: '钱七', examType: 'PET-CT', examDate: '2026-02-03', followUpType: '术后复查', nextFollowUpDate: '2026-10-08', status: '待随访', reaction: '无反应', notes: 'CT引导下活检后观察' },
    { id: 'FU065', patientId: 'P202400065', patientName: '孙八', examType: 'SPECT-CT', examDate: '2026-04-02', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-06-24', status: '进行中', reaction: '轻度', notes: '放疗后疗效评估' },
    { id: 'FU066', patientId: 'P202400066', patientName: '周九', examType: 'CT增强', examDate: '2026-04-18', followUpType: '对比剂反应', nextFollowUpDate: '2026-05-16', status: '已完成', reaction: '中度', notes: '常规增强检查，无不适' },
    { id: 'FU067', patientId: 'P202400067', patientName: '吴十', examType: 'MRI增强', examDate: '2026-03-04', followUpType: '肿瘤复查', nextFollowUpDate: '2026-08-14', status: '逾期', reaction: '重度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU068', patientId: 'P202400068', patientName: '郑一', examType: 'CT平扫', examDate: '2026-03-24', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-07-03', status: '待随访', reaction: '无反应', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU069', patientId: 'P202400069', patientName: '冯二', examType: 'MRI平扫', examDate: '2026-01-20', followUpType: '治疗评估', nextFollowUpDate: '2026-05-15', status: '进行中', reaction: '轻度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU070', patientId: 'P202400070', patientName: '陈三', examType: 'PET-CT', examDate: '2026-01-20', followUpType: '术后复查', nextFollowUpDate: '2026-07-22', status: '已完成', reaction: '中度', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU071', patientId: 'P202400071', patientName: '楚四', examType: 'SPECT-CT', examDate: '2026-01-25', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-10-20', status: '逾期', reaction: '重度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU072', patientId: 'P202400072', patientName: '卫五', examType: 'CT增强', examDate: '2026-01-10', followUpType: '对比剂反应', nextFollowUpDate: '2026-10-25', status: '待随访', reaction: '无反应', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU073', patientId: 'P202400073', patientName: '蒋六', examType: 'MRI增强', examDate: '2026-04-14', followUpType: '肿瘤复查', nextFollowUpDate: '2026-09-04', status: '进行中', reaction: '轻度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU074', patientId: 'P202400074', patientName: '沈七', examType: 'CT平扫', examDate: '2026-01-25', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-05-27', status: '已完成', reaction: '中度', notes: 'CT引导下活检后观察' },
    { id: 'FU075', patientId: 'P202400075', patientName: '韩八', examType: 'MRI平扫', examDate: '2026-02-19', followUpType: '治疗评估', nextFollowUpDate: '2026-12-13', status: '逾期', reaction: '重度', notes: '放疗后疗效评估' },
    { id: 'FU076', patientId: 'P202400076', patientName: '杨九', examType: 'PET-CT', examDate: '2026-01-19', followUpType: '术后复查', nextFollowUpDate: '2026-11-27', status: '待随访', reaction: '无反应', notes: '常规增强检查，无不适' },
    { id: 'FU077', patientId: 'P202400077', patientName: '朱十', examType: 'SPECT-CT', examDate: '2026-04-04', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-05-16', status: '进行中', reaction: '轻度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU078', patientId: 'P202400078', patientName: '秦十一', examType: 'CT增强', examDate: '2026-03-25', followUpType: '对比剂反应', nextFollowUpDate: '2026-12-06', status: '已完成', reaction: '中度', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU079', patientId: 'P202400079', patientName: '尤十二', examType: 'MRI增强', examDate: '2026-02-16', followUpType: '肿瘤复查', nextFollowUpDate: '2026-11-21', status: '逾期', reaction: '重度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU080', patientId: 'P202400080', patientName: '张三', examType: 'CT平扫', examDate: '2026-02-11', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-12-28', status: '待随访', reaction: '无反应', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU081', patientId: 'P202400081', patientName: '李四', examType: 'MRI平扫', examDate: '2026-03-03', followUpType: '治疗评估', nextFollowUpDate: '2026-07-26', status: '进行中', reaction: '轻度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU082', patientId: 'P202400082', patientName: '王五', examType: 'PET-CT', examDate: '2026-03-07', followUpType: '术后复查', nextFollowUpDate: '2026-09-12', status: '已完成', reaction: '中度', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU083', patientId: 'P202400083', patientName: '赵六', examType: 'SPECT-CT', examDate: '2026-03-05', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-12-11', status: '逾期', reaction: '重度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU084', patientId: 'P202400084', patientName: '钱七', examType: 'CT增强', examDate: '2026-02-19', followUpType: '对比剂反应', nextFollowUpDate: '2026-11-06', status: '待随访', reaction: '无反应', notes: 'CT引导下活检后观察' },
    { id: 'FU085', patientId: 'P202400085', patientName: '孙八', examType: 'MRI增强', examDate: '2026-01-20', followUpType: '肿瘤复查', nextFollowUpDate: '2026-05-17', status: '进行中', reaction: '轻度', notes: '放疗后疗效评估' },
    { id: 'FU086', patientId: 'P202400086', patientName: '周九', examType: 'CT平扫', examDate: '2026-04-13', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-06-17', status: '已完成', reaction: '中度', notes: '常规增强检查，无不适' },
    { id: 'FU087', patientId: 'P202400087', patientName: '吴十', examType: 'MRI平扫', examDate: '2026-03-16', followUpType: '治疗评估', nextFollowUpDate: '2026-09-18', status: '逾期', reaction: '重度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU088', patientId: 'P202400088', patientName: '郑一', examType: 'PET-CT', examDate: '2026-02-08', followUpType: '术后复查', nextFollowUpDate: '2026-06-27', status: '待随访', reaction: '无反应', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU089', patientId: 'P202400089', patientName: '冯二', examType: 'SPECT-CT', examDate: '2026-05-06', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-12-01', status: '进行中', reaction: '轻度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU090', patientId: 'P202400090', patientName: '陈三', examType: 'CT增强', examDate: '2026-03-21', followUpType: '对比剂反应', nextFollowUpDate: '2026-09-07', status: '已完成', reaction: '中度', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
    { id: 'FU091', patientId: 'P202400091', patientName: '楚四', examType: 'MRI增强', examDate: '2026-03-21', followUpType: '肿瘤复查', nextFollowUpDate: '2026-12-18', status: '逾期', reaction: '重度', notes: '肺癌术后3个月复查，影像学评估' },
    { id: 'FU092', patientId: 'P202400092', patientName: '卫五', examType: 'CT平扫', examDate: '2026-04-20', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-08-23', status: '待随访', reaction: '无反应', notes: '肺结节6个月随访，大小稳定' },
    { id: 'FU093', patientId: 'P202400093', patientName: '蒋六', examType: 'MRI平扫', examDate: '2026-01-25', followUpType: '治疗评估', nextFollowUpDate: '2026-11-22', status: '进行中', reaction: '轻度', notes: '肝癌介入治疗后影像学评估' },
    { id: 'FU094', patientId: 'P202400094', patientName: '沈七', examType: 'PET-CT', examDate: '2026-03-27', followUpType: '术后复查', nextFollowUpDate: '2026-12-20', status: '已完成', reaction: '中度', notes: 'CT引导下活检后观察' },
    { id: 'FU095', patientId: 'P202400095', patientName: '韩八', examType: 'SPECT-CT', examDate: '2026-05-10', followUpType: '介入治疗后评估', nextFollowUpDate: '2026-07-27', status: '逾期', reaction: '重度', notes: '放疗后疗效评估' },
    { id: 'FU096', patientId: 'P202400096', patientName: '杨九', examType: 'CT增强', examDate: '2026-03-21', followUpType: '对比剂反应', nextFollowUpDate: '2026-09-22', status: '待随访', reaction: '无反应', notes: '常规增强检查，无不适' },
    { id: 'FU097', patientId: 'P202400097', patientName: '朱十', examType: 'MRI增强', examDate: '2026-04-16', followUpType: '肿瘤复查', nextFollowUpDate: '2026-08-18', status: '进行中', reaction: '轻度', notes: '患者主诉头痛，需进一步评估' },
    { id: 'FU098', patientId: 'P202400098', patientName: '秦十一', examType: 'CT平扫', examDate: '2026-02-08', followUpType: '早期肺癌跟踪', nextFollowUpDate: '2026-08-07', status: '已完成', reaction: '中度', notes: 'CT增强后皮疹，给予抗过敏处理' },
    { id: 'FU099', patientId: 'P202400099', patientName: '尤十二', examType: 'MRI平扫', examDate: '2026-05-15', followUpType: '治疗评估', nextFollowUpDate: '2026-09-13', status: '逾期', reaction: '重度', notes: 'MRI增强后肝功能异常，复查中' },
    { id: 'FU100', patientId: 'P202400100', patientName: '张三', examType: 'PET-CT', examDate: '2026-01-22', followUpType: '术后复查', nextFollowUpDate: '2026-07-27', status: '待随访', reaction: '无反应', notes: '注射碘对比剂后出现轻微恶心，休息后缓解' },
  ]);

  const filteredList = followUpList.filter(item => {
    const keywordMatch = searchKeyword === '' || 
      item.patientName.includes(searchKeyword) || 
      item.patientId.includes(searchKeyword);
    const tabMatch = activeTab === 'all' || 
      (activeTab === 'pending' && item.status === '待随访') ||
      (activeTab === 'overdue' && item.status === '逾期');
    return keywordMatch && tabMatch;
  });

  // [W2-4] 患者详情"随访"入口: /follow-up?patientId=xxx 自动定位该患者
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('patientId');
    if (pid) setSearchKeyword(pid);
  }, []);

  const stats = {
    total: followUpList.length,
    pending: followUpList.filter(f => f.status === '待随访').length,
    overdue: followUpList.filter(f => f.status === '逾期').length,
    completed: followUpList.filter(f => f.status === '已完成').length
  };

  const handleComplete = (id: string) => {
    setFollowUpList(list => list.map(item => 
      item.id === id ? { ...item, status: '已完成' as const } : item
    ));
    setShowModal(false);
    setSelectedPatient(null);
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    padding: '24px'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px'
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#666'
  };

  const statsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: '600',
    color: '#1890ff'
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px'
  };

  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid #e8e8e8'
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
    color: isActive ? '#1890ff' : '#666',
    cursor: 'pointer',
    fontSize: '14px',
    background: 'none',
    border: 'none'
  });

  const tableStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const getStatusTagStyle = (status: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px'
    };
    switch (status) {
      case '待随访':
        return { ...baseStyle, backgroundColor: '#fffbe6', color: '#faad14' };
      case '进行中':
        return { ...baseStyle, backgroundColor: '#e6f7ff', color: '#1890ff' };
      case '已完成':
        return { ...baseStyle, backgroundColor: '#f6ffed', color: '#52c41a' };
      case '逾期':
        return { ...baseStyle, backgroundColor: '#fff2f0', color: '#ff4d4f' };
      default:
        return baseStyle;
    }
  };

  const getExamTypeStyle = (type: string): React.CSSProperties => {
    const colors: Record<string, string> = {
      'CT增强': '#ff6b6b',
      'MRI增强': '#4ecdc4',
      'CT平扫': '#ffe66d',
      'MRI平扫': '#95e1d3'
    };
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      backgroundColor: colors[type] || '#e8e8e8',
      color: '#333'
    };
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto'
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px'
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    color: '#666',
    marginBottom: '6px'
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const modalButtonContainer: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: '#fff',
    color: '#666',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>📋 放射科随访管理</h1>
        <p style={subtitleStyle}>CT/MRI增强复查、对比剂反应随访、肿瘤影像跟踪</p>
      </div>

      <div style={statsContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{stats.total}</div>
          <div style={statLabelStyle}>总随访数</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#faad14'}}>{stats.pending}</div>
          <div style={statLabelStyle}>待随访</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#ff4d4f'}}>{stats.overdue}</div>
          <div style={statLabelStyle}>逾期</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#52c41a'}}>{stats.completed}</div>
          <div style={statLabelStyle}>已完成</div>
        </div>
      </div>

      <div style={searchBarStyle}>
        <input
          type="text"
          placeholder="搜索患者姓名或ID..."
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={inputStyle}
        />
        <button style={buttonStyle} onClick={() => { setSearchKeyword(''); setStatusFilter('all') }}>🔄 重置</button>
        <button style={{...buttonStyle, backgroundColor: '#52c41a'}} onClick={async (evt) => {
          const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
          const orig = btn.innerHTML;
          btn.innerHTML = '⏳ 添加中...';
          btn.disabled = true;
          await new Promise(r => setTimeout(r, 1500));
          const records = JSON.parse(localStorage.getItem('g005_followup_records') || '[]');
          records.push({ id: `FU${Date.now()}`, patientId: 'NEW', patientName: '新患者', examType: 'CT增强', examDate: new Date().toISOString().slice(0,10), followUpType: '肿瘤复查', nextFollowUpDate: '', status: '待随访' });
          localStorage.setItem('g005_followup_records', JSON.stringify(records));
          btn.innerHTML = '✅ 已添加';
          setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
        }}>+ 新增随访</button>
      </div>

      <div style={tabContainerStyle}>
        <button style={tabStyle(activeTab === 'all')} onClick={() => setActiveTab('all')}>
          全部 ({stats.total})
        </button>
        <button style={tabStyle(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          待随访 ({stats.pending})
        </button>
        <button style={tabStyle(activeTab === 'overdue')} onClick={() => setActiveTab('overdue')}>
          逾期 ({stats.overdue})
        </button>
      </div>

      <div style={tableStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>患者信息</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>检查类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>随访类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>检查日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>随访日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#666' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{item.patientName}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{item.patientId}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getExamTypeStyle(item.examType)}>{item.examType}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#333' }}>{item.followUpType}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>{item.examDate}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>{item.nextFollowUpDate}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getStatusTagStyle(item.status)}>{item.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button 
                    style={actionButtonStyle}
                    onClick={() => { setSelectedPatient(item); setShowModal(true); }}
                  >
                    详情
                  </button>
                  {item.status !== '已完成' && (
                    <button 
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#52c41a'}}
                      onClick={() => handleComplete(item.id)}
                    >
                      完成
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedPatient && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>📋 随访详情</h2>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名</label>
              <div style={{ fontSize: '14px', color: '#333' }}>{selectedPatient.patientName}</div>
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID</label>
              <div style={{ fontSize: '14px', color: '#333' }}>{selectedPatient.patientId}</div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查类型</label>
                <span style={getExamTypeStyle(selectedPatient.examType)}>{selectedPatient.examType}</span>
              </div>
              
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访类型</label>
                <div style={{ fontSize: '14px', color: '#333' }}>{selectedPatient.followUpType}</div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查日期</label>
                <div style={{ fontSize: '14px', color: '#333' }}>{selectedPatient.examDate}</div>
              </div>
              
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期</label>
                <div style={{ fontSize: '14px', color: '#333' }}>{selectedPatient.nextFollowUpDate}</div>
              </div>
            </div>

            {selectedPatient.reaction && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>对比剂反应</label>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: selectedPatient.reaction === '无反应' ? '#f6ffed' : 
                                   selectedPatient.reaction === '轻度' ? '#fffbe6' : 
                                   selectedPatient.reaction === '中度' ? '#fff7e6' : '#fff2f0',
                  color: selectedPatient.reaction === '无反应' ? '#52c41a' : 
                         selectedPatient.reaction === '轻度' ? '#faad14' : 
                         selectedPatient.reaction === '中度' ? '#fa8c16' : '#ff4d4f'
                }}>
                  {selectedPatient.reaction}
                </span>
              </div>
            )}

            <div style={formGroupStyle}>
              <label style={labelStyle}>备注信息</label>
              <div style={{ 
                fontSize: '14px', 
                color: '#333',
                padding: '12px',
                backgroundColor: '#fafafa',
                borderRadius: '4px',
                minHeight: '60px'
              }}>
                {selectedPatient.notes || '无'}
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>更新随访状态</label>
              <select style={selectStyle}>
                <option value="">选择状态</option>
                <option value="completed">已完成</option>
                <option value="in_progress">进行中</option>
                <option value="pending">待随访</option>
              </select>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowModal(false)}>取消</button>
              <button 
                style={buttonStyle}
                onClick={() => handleComplete(selectedPatient.id)}
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
