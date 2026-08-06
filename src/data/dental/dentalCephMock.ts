// [v3.0.6.8-90] Phase 2: 头影测量分析 mock 数据
// 对标: Sidexis Ceph + Dolphin + Romexis Ceph

export const MOCK_CEPH_STUDIES = [
  { id: 'CEPH-001', patientId: 'P100001', patientName: '张伟', age: 12, gender: 'M', studyType: 'lateral', acquisitionDate: '2026-06-28', device: 'Sirona Orthophos S3 Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'steiner' },
  { id: 'CEPH-002', patientId: 'P100004', patientName: '赵雪', age: 9, gender: 'F', studyType: 'lateral', acquisitionDate: '2026-06-27', device: 'Planmeca ProMax Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'pending', analysisType: null },
  { id: 'CEPH-003', patientId: 'P100005', patientName: '刘阳', age: 15, gender: 'M', studyType: 'lateral', acquisitionDate: '2026-06-25', device: 'Carestream CS 9600', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'mcmamara' },
  { id: 'CEPH-004', patientId: 'P100006', patientName: '陈雨', age: 28, gender: 'F', studyType: 'lateral', acquisitionDate: '2026-06-24', device: 'Sirona Orthophos S3 Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'steiner' },
];

// 标准 18 个解剖标志点
export const MOCK_LANDMARKS: Record<string, { x: number; y: number }> = {
  N: { x: 250, y: 80 }, S: { x: 220, y: 150 }, A: { x: 240, y: 200 },
  B: { x: 230, y: 260 }, Pog: { x: 225, y: 300 }, Me: { x: 225, y: 320 },
  Go: { x: 180, y: 280 }, Ar: { x: 180, y: 155 }, PNS: { x: 280, y: 170 },
  ANS: { x: 260, y: 195 }, Or: { x: 280, y: 100 }, Po: { x: 160, y: 120 },
  Ba: { x: 195, y: 165 }, Na: { x: 250, y: 80 }, Pt: { x: 210, y: 195 },
  Cd: { x: 190, y: 145 }, Gn: { x: 225, y: 310 }, Xi: { x: 230, y: 230 },
};

// 分析类型
export const MOCK_ANALYSIS_TYPES = [
  { id: 'steiner', name: 'Steiner 分析法', description: 'SNA/SNB/ANB ± 角度测量', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','PNS','ANS'], keyMeasurements: ['SNA','SNB','ANB','SN-MP','FMA'] },
  { id: 'downs', name: 'Downs 分析法', description: '面部骨骼角度分析 + 颅颌面', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','Or','Po'], keyMeasurements: ['FPA','SNB','AB-MP','YAxis','OP-FH'] },
  { id: 'mcmamara', name: 'McNamara 分析法', description: '线距分析 + 气道分析', landmarks: ['N','A','B','Pog','ANS','PNS','Go','Cd','Gn','Ba'], keyMeasurements: ['Maxilla-Mandible','LFH','LTA-Pog','Airway-PS','NaPerp-A'] },
  { id: 'ricketts', name: 'Ricketts 分析法', description: '面部生长预测 + 面部三角 ', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','Ba','Pt','Cd','Xi'], keyMeasurements: ['FacialAxis','FacialAngle','Convexity','MandArc','LowerFacialHt'] },
  { id: 'tweeds', name: 'Tweed 分析法', description: '诊断三角 + 矫治目标', landmarks: ['N','A','B','Pog','Me','Go','Or','Po'], keyMeasurements: ['FMA','IMPA','FMIA','ZAngle'] },
  { id: 'coben', name: 'Coben 分析法', description: '颅底三角分析', landmarks: ['N','S','Ba','Ar','PNS','A','B','Pog','Gn','Go'], keyMeasurements: ['S-N','N-Ba','N-ANS','N-Me','ANS-PNS'] },
];

// Steiner 分析结果 (正常值范围)
export const MOCK_STEINER_ANALYSIS = {
  analysisType: 'steiner',
  measurements: [
    { key: 'SNA', label: 'SNA', value: 82, unit: '°', norm: { min: 80, max: 84 }, status: 'normal' },
    { key: 'SNB', label: 'SNB', value: 80, unit: '°', norm: { min: 78, max: 82 }, status: 'normal' },
    { key: 'ANB', label: 'ANB', value: 2, unit: '°', norm: { min: 0, max: 4 }, status: 'normal' },
    { key: 'SN-MP', label: 'SN-MP (下颌平面角)', value: 32, unit: '°', norm: { min: 28, max: 36 }, status: 'normal' },
    { key: 'FMA', label: 'FMA (下颌平面角-FH)', value: 25, unit: '°', norm: { min: 20, max: 30 }, status: 'normal' },
    { key: 'MP-SN', label: 'MP-SN', value: 32, unit: '°', norm: { min: 27, max: 37 }, status: 'normal' },
    { key: 'U1-SN', label: 'U1-SN (上中切牙角)', value: 104, unit: '°', norm: { min: 100, max: 108 }, status: 'normal' },
    { key: 'L1-MP', label: 'L1-MP (下中切牙角)', value: 92, unit: '°', norm: { min: 88, max: 98 }, status: 'normal' },
    { key: 'IMPA', label: 'IMPA', value: 92, unit: '°', norm: { min: 85, max: 95 }, status: 'normal' },
    { key: 'ZAngle', label: 'Z 角', value: 72, unit: '°', norm: { min: 65, max: 80 }, status: 'normal' },
    { key: 'Wits', label: 'Wits 值', value: -1, unit: 'mm', norm: { min: -2, max: 2 }, status: 'normal' },
    { key: 'U1-L1', label: 'U1-L1 (上下切牙角)', value: 128, unit: '°', norm: { min: 120, max: 140 }, status: 'normal' },
    { key: 'Holdaway', label: 'Holdaway 角', value: 12, unit: '°', norm: { min: 8, max: 15 }, status: 'normal' },
  ],
  diagnosis: '骨性 I 类, 均角, 均角型面型',
  facialType: 'dolichofacial' as const,
  growthDirection: 'clockwise' as const,
  createdAt: new Date().toISOString(),
};

// 牙弓分析
export const MOCK_ARCH_ANALYSIS = {
  maxillaArch: {
    intermolarWidth: 42.5, intercanineWidth: 35.2, archLength: 48.0, archPerimeter: 65.2,
    spacing: 0, crowding: -2.5, shape: 'oval',
  },
  mandibleArch: {
    intermolarWidth: 38.0, intercanineWidth: 28.5, archLength: 42.0, archPerimeter: 58.5,
    spacing: 0.5, crowding: -1.5, shape: 'parabolic',
  },
  discrepancy: {
    maxillaCrowding: 2.5, mandibleCrowding: 1.5, maxillarySpace: 0, mandibularSpace: 0.5,
    boltonRatio: 0.902, boltonNormMin: 0.87, boltonNormMax: 0.93, boltonStatus: 'normal',
    needExtraction: false, extractionTeeth: [],
  },
  analysisType: 'space-analysis',
};
