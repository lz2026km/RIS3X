// [v3.0.6.8-88] 种植 3D 规划 mock 数据
// 对标: 3Shape Implant Studio + SimPlant + CoDiagnostiX

export const MOCK_IMPLANT_BRANDS = [
  {
    id: 'straumann', name: 'Straumann', country: 'Switzerland',
    models: [
      { id: 'BLT-RC-3.3x8', name: 'Bone Level Tapered RC', diameters: [3.3], lengths: [8,10,12,14], platform: 'RC', connection: 'crossfit', price: 3800 },
      { id: 'BLT-RC-4.1x10', name: 'Bone Level Tapered RC 4.1', diameters: [4.1], lengths: [8,10,12,14], platform: 'RC', connection: 'crossfit', price: 4000 },
      { id: 'BLT-RC-4.8x10', name: 'Bone Level Tapered RC 4.8', diameters: [4.8], lengths: [6,8,10,12], platform: 'RC', connection: 'crossfit', price: 4200 },
      { id: 'BLX-4.5x10', name: 'BLX Active Blade', diameters: [3.75,4.5,5.5], lengths: [8,10,12,14], platform: 'NC', connection: 'torc', price: 4500 },
      { id: 'SP-BB-4.1x10', name: 'Standard Plus BoneBank', diameters: [3.3,4.1,4.8], lengths: [8,10,12,14,16], platform: 'RN', connection: 'internal-hex', price: 3200 },
      { id: 'NC-3.5x10', name: 'Narrow CrossFit 3.5', diameters: [3.5], lengths: [8,10,12,14], platform: 'NC', connection: 'crossfit', price: 3800 },
    ],
  },
  {
    id: 'nobel', name: 'Nobel Biocare', country: 'Sweden',
    models: [
      { id: 'NP-RP-4.3x10', name: 'NobelReplace Conical NP', diameters: [3.5,4.3,5.0,6.0], lengths: [8,10,13,16], platform: 'NP', connection: 'tri-channel', price: 4200 },
      { id: 'AC-3.5x10', name: 'Active NP 3.5', diameters: [3.5,4.3,5.0], lengths: [8.5,10,11.5,13,15], platform: 'NP', connection: 'conical', price: 4800 },
      { id: 'CC-4.3x10', name: 'Conical Connection RP 4.3', diameters: [3.5,4.3,5.0], lengths: [8,10,11.5,13,15], platform: 'RP', connection: 'conical', price: 4400 },
      { id: 'PC-3.75x10', name: 'Parallel CC NP 3.75', diameters: [3.75,4.25,5.0], lengths: [7,8.5,10,11.5,13,15], platform: 'NP', connection: 'cc', price: 3800 },
    ],
  },
  {
    id: 'dentsply', name: 'Dentsply Sirona', country: 'USA/Germany',
    models: [
      { id: 'AX-3.5x11', name: 'Astra OsseoSpeed TX 3.5S', diameters: [3.5,4.0,4.5,5.0], lengths: [9,11,13,15], platform: 'micro-thread', connection: 'conical', price: 3500 },
      { id: 'AX-4.0x11', name: 'Astra OsseoSpeed TX 4.0', diameters: [3.5,4.0,4.5,5.0], lengths: [9,11,13,15], platform: 'conical', connection: 'seal-design', price: 3600 },
      { id: 'AX-5.0x9', name: 'Astra OsseoSpeed TX 5.0S', diameters: [5.0], lengths: [6,9,11], platform: 'conical', connection: 'seal-design', price: 3800 },
    ],
  },
  {
    id: 'osstem', name: 'Osstem', country: 'South Korea',
    models: [
      { id: 'TS-III-4.0x10', name: 'TS III SA 4.0', diameters: [4.0,4.5,5.0,6.0], lengths: [7,8.5,10,11.5,13,15], platform: 'internal', connection: 'hex', price: 1800 },
      { id: 'TS-III-4.5x10', name: 'TS III SA 4.5', diameters: [4.0,4.5,5.0,6.0], lengths: [7,8.5,10,11.5,13,15], platform: 'internal', connection: 'hex', price: 1900 },
      { id: 'TS-III-5.0x8.5', name: 'TS III SA Wide 5.0', diameters: [5.0,6.0], lengths: [7,8.5,10], platform: 'internal', connection: 'hex', price: 2100 },
    ],
  },
  {
    id: 'neobiotech', name: 'Neobiotech', country: 'South Korea',
    models: [
      { id: 'NR-4.0x10', name: 'NeoReserve NR 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1500 },
      { id: 'NR-4.5x10', name: 'NeoReserve NR Wide 4.5', diameters: [4.5,5.0], lengths: [8,10,12], platform: 'internal', connection: 'conical', price: 1600 },
      { id: 'NR-3.5x10', name: 'NeoReserve NR Narrow 3.5', diameters: [3.5], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1500 },
    ],
  },
  {
    id: 'dio', name: 'DIO', country: 'South Korea',
    models: [
      { id: 'SM-4.0x10', name: 'SM Active 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'hex', price: 1300 },
      { id: 'UF-4.0x10', name: 'UF II 4.0', diameters: [4.0,4.5,5.0], lengths: [8.5,10,11.5,13], platform: 'internal', connection: 'conical', price: 1400 },
    ],
  },
  {
    id: 'bego', name: 'Bego Implant', country: 'Germany',
    models: [
      { id: 'RS-3.75x10', name: 'RS/RSX Bone Level 3.75', diameters: [3.75,4.5,5.5], lengths: [8.5,10,11.5,13,15], platform: 'internal', connection: 'conical', price: 2800 },
      { id: 'RSX-4.5x10', name: 'RSX Narrow 4.5', diameters: [4.5], lengths: [8.5,10,11.5,13], platform: 'internal', connection: 'conical', price: 2900 },
    ],
  },
  {
    id: 'megagen', name: 'Megagen', country: 'South Korea',
    models: [
      { id: 'IS-4.0x10', name: 'Implantium II IS 4.0', diameters: [4.0,4.5,5.0,5.5], lengths: [7,8.5,10,11.5,13], platform: 'internal', connection: 'double-hex', price: 1600 },
      { id: 'IS-4.5x10', name: 'Implantium II IS Wide 4.5', diameters: [4.5,5.0,5.5], lengths: [7,8.5,10,11.5], platform: 'internal', connection: 'double-hex', price: 1700 },
    ],
  },
  {
    id: 'zimmer', name: 'Zimmer Biomet', country: 'USA',
    models: [
      { id: 'T3-3.7x10', name: 'Tapered Screw-Vent T3 3.7', diameters: [3.7,4.1,4.7,6.0], lengths: [8,10,11.5,13,16], platform: 'internal-hex', connection: 'friction-fit', price: 4200 },
      { id: 'T3-4.1x10', name: 'Tapered Screw-Vent T3 4.1', diameters: [4.1,4.7,6.0], lengths: [8,10,11.5,13,16], platform: 'internal-hex', connection: 'friction-fit', price: 4400 },
      { id: 'TSV-4.7x10', name: 'Trabecular Metal Tapered 4.7', diameters: [4.7,6.0], lengths: [10,11.5,13,16], platform: 'internal-hex', connection: 'friction-fit', price: 5200 },
      { id: 'EZ-3.5x10', name: 'Eztetic 3.5', diameters: [3.5], lengths: [8.5,10,11.5,13], platform: 'narrow', connection: 'conical', price: 4800 },
    ],
  },
  {
    id: 'mis', name: 'MIS Implants', country: 'Israel',
    models: [
      { id: 'C1-3.75x10', name: 'C1 Conical 3.75', diameters: [3.75,4.2,5.0], lengths: [8,10,11.5,13,16], platform: 'standard', connection: 'conical', price: 2200 },
      { id: 'C1-4.2x10', name: 'C1 Conical 4.2', diameters: [4.2,5.0], lengths: [8,10,11.5,13,16], platform: 'standard', connection: 'conical', price: 2300 },
      { id: 'V3-3.9x10', name: 'V3 Triangular 3.9', diameters: [3.9,4.3,5.0], lengths: [8,10,11.5,13], platform: 'standard', connection: 'triangular', price: 2800 },
      { id: 'SEVEN-4.2x10', name: 'SEVEN Internal 4.2', diameters: [3.75,4.2,5.0,6.0], lengths: [8,10,11.5,13,16], platform: 'standard', connection: 'hex', price: 2000 },
    ],
  },
  {
    id: 'anthogyr', name: 'Anthogyr', country: 'France',
    models: [
      { id: 'Axiom-3.4x10', name: 'Axiom REG 3.4', diameters: [3.4,4.0,4.6,5.2], lengths: [8,10,12,14,16], platform: 'standard', connection: 'conical', price: 3800 },
      { id: 'Axiom-4.0x10', name: 'Axiom REG 4.0', diameters: [4.0,4.6,5.2], lengths: [8,10,12,14,16], platform: 'standard', connection: 'conical', price: 4000 },
      { id: 'Axiom-PX-3.4x10', name: 'Axiom PX 3.4', diameters: [3.4,4.0,4.6], lengths: [8,10,12,14], platform: 'narrow', connection: 'conical', price: 4200 },
    ],
  },
  {
    id: 'camlog', name: 'Camlog', country: 'Germany',
    models: [
      { id: 'CL-3.8x10', name: 'Camlog Screw-Line 3.8', diameters: [3.8,4.3,5.0,6.0], lengths: [9,11,13,16], platform: 'standard', connection: 'tube-in-tube', price: 3500 },
      { id: 'CL-4.3x10', name: 'Camlog Screw-Line 4.3', diameters: [4.3,5.0,6.0], lengths: [9,11,13,16], platform: 'standard', connection: 'tube-in-tube', price: 3600 },
      { id: 'CL-5.0x9', name: 'Camlog Screw-Line Wide 5.0', diameters: [5.0,6.0], lengths: [9,11,13], platform: 'wide', connection: 'tube-in-tube', price: 3800 },
    ],
  },
  {
    id: 'thommen', name: 'Thommen Medical', country: 'Switzerland',
    models: [
      { id: 'SPI-3.5x10', name: 'SPI Element 3.5', diameters: [3.5,4.0,4.5,5.0], lengths: [8,9.5,11,12.5,14], platform: 'standard', connection: 'tube-in-tube', price: 4500 },
      { id: 'SPI-4.0x10', name: 'SPI Element 4.0', diameters: [4.0,4.5,5.0,6.0], lengths: [8,9.5,11,12.5,14], platform: 'standard', connection: 'tube-in-tube', price: 4700 },
      { id: 'CONTACT-4.0x10', name: 'CONTACT 4.0', diameters: [4.0,4.5,5.0], lengths: [9,11,12.5,14], platform: 'standard', connection: 'tube-in-tube', price: 4900 },
    ],
  },
  {
    id: 'wego', name: '威高 Wego', country: '中国 山东',
    models: [
      { id: 'WG-3.5x10', name: 'WG 种植体 3.5', diameters: [3.5,4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1800 },
      { id: 'WG-4.0x10', name: 'WG 种植体 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1900 },
      { id: 'WG-4.5x10', name: 'WG 种植体 4.5 Wide', diameters: [4.5,5.0,5.5], lengths: [8,10,12], platform: 'internal', connection: 'conical', price: 2000 },
      { id: 'WG-PLUS-4.0x10', name: 'WG Plus 亲水 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 2400 },
    ],
  },
  {
    id: 'kindly', name: '康德莱 Kindly', country: '中国 浙江',
    models: [
      { id: 'KD-3.5x10', name: 'KD 种植体 3.5', diameters: [3.5,4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1600 },
      { id: 'KD-4.0x10', name: 'KD 种植体 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1700 },
      { id: 'KD-4.5x10', name: 'KD 种植体 4.5', diameters: [4.5,5.0,5.5], lengths: [8,10,12], platform: 'internal', connection: 'conical', price: 1800 },
    ],
  },
  {
    id: 'bicon', name: 'Bicon', country: 'USA',
    models: [
      { id: 'BC-3.5x8', name: 'Bicon Short 3.5x8', diameters: [3.5,4.0,4.5,5.0,6.0], lengths: [5,6,8,11], platform: 'bicon', connection: 'locking-taper', price: 3200 },
      { id: 'BC-4.0x8', name: 'Bicon Standard 4.0x8', diameters: [4.0,4.5,5.0], lengths: [8,11,14], platform: 'bicon', connection: 'locking-taper', price: 3400 },
      { id: 'BC-5.0x6', name: 'Bicon Wide 5.0x6', diameters: [5.0,6.0], lengths: [5,6,8,11], platform: 'bicon', connection: 'locking-taper', price: 3600 },
    ],
  },
  {
    id: 'chuangying', name: '创英 ChuangYing', country: '中国 江苏',
    models: [
      { id: 'CY-3.5x10', name: 'CY 种植体 3.5', diameters: [3.5,4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'hex', price: 1400 },
      { id: 'CY-4.0x10', name: 'CY 种植体 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'hex', price: 1500 },
      { id: 'CY-4.5x10', name: 'CY 种植体 4.5', diameters: [4.5,5.0,5.5], lengths: [8,10,12], platform: 'internal', connection: 'hex', price: 1600 },
    ],
  },
  {
    id: 'cdic', name: 'CDIC 华西口腔', country: '中国 四川',
    models: [
      { id: 'CDIC-3.5x10', name: 'CDIC 亲水 3.5', diameters: [3.5,4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1300 },
      { id: 'CDIC-4.0x10', name: 'CDIC 亲水 4.0', diameters: [4.0,4.5,5.0], lengths: [8,10,12,14], platform: 'internal', connection: 'conical', price: 1400 },
      { id: 'CDIC-4.5x10', name: 'CDIC 亲水 4.5', diameters: [4.5,5.0,5.5], lengths: [8,10,12], platform: 'internal', connection: 'conical', price: 1500 },
    ],
  },
];

export const MOCK_IMPLANT_PLANS_3D = [
  {
    id: 'IMP3D-001', patientId: 'P100001', toothNo: 36, brand: 'straumann', model: 'BLT-RC-4.1x10',
    entryPoint: { x: 150.2, y: 120.5, z: 80.0 },
    apexPoint: { x: 148.5, y: 109.0, z: 30.5 },
    angleMesioDistal: 2.5, angleBuccoLingual: 0.8,
    distanceToNerve: 3.2, boneDensityAtApex: 850,
    abutment: 'titanium-base', prostheticPlan: 'cement-retained',
    guideDesigned: false, status: 'planning',
    createdAt: '2026-06-28T10:00:00Z',
    assignedDentist: 'Dr. Chen', patientName: 'Zhang Wei',
  },
  {
    id: 'IMP3D-002', patientId: 'P100002', toothNo: 46, brand: 'nobel', model: 'NP-RP-4.3x10',
    entryPoint: { x: 165.0, y: 130.0, z: 85.0 },
    apexPoint: { x: 163.2, y: 118.0, z: 35.0 },
    angleMesioDistal: -1.8, angleBuccoLingual: 1.2,
    distanceToNerve: 4.5, boneDensityAtApex: 920,
    abutment: 'custom-zirconia', prostheticPlan: 'screw-retained',
    guideDesigned: true, guideFile: '/dental/guides/IMP3D-002.stl', status: 'guided-surgery',
    createdAt: '2026-06-27T14:30:00Z',
    assignedDentist: 'Dr. Chen', patientName: 'Li Na',
  },
  {
    id: 'IMP3D-003', patientId: 'P100003', toothNo: 16, brand: 'osstem', model: 'TS-III-4.5x10',
    entryPoint: { x: 130.0, y: 115.0, z: 90.0 },
    apexPoint: { x: 128.5, y: 103.0, z: 40.0 },
    angleMesioDistal: 3.1, angleBuccoLingual: -0.5,
    distanceToNerve: 8.2, boneDensityAtApex: 720,
    abutment: 'prefab-titanium', prostheticPlan: 'cement-retained',
    guideDesigned: false, status: 'planning',
    createdAt: '2026-06-25T09:15:00Z',
    assignedDentist: 'Dr. Wang', patientName: 'Wang Fang',
  },
];

export const MOCK_NERVE_3D = {
  lowerAlveolarNerve: {
    path: [
      { x: 100, y: 180, z: 50 }, { x: 105, y: 175, z: 48 }, { x: 115, y: 170, z: 45 },
      { x: 125, y: 165, z: 42 }, { x: 130, y: 160, z: 40 }, { x: 138, y: 155, z: 38 },
      { x: 142, y: 148, z: 36 }, { x: 148, y: 140, z: 35 }, { x: 152, y: 132, z: 34 },
      { x: 155, y: 125, z: 33 }, { x: 158, y: 118, z: 32 }, { x: 160, y: 110, z: 32 },
      { x: 162, y: 100, z: 33 }, { x: 163, y: 90, z: 35 }, { x: 160, y: 80, z: 40 },
    ],
    diameter: 3.2, leftSide: true,
  },
  mentalForamen: { left: { x: 140, y: 158, z: 36 }, right: { x: 280, y: 158, z: 36 } },
  incisiveCanal: { path: [{ x: 138, y: 155, z: 36 }, { x: 135, y: 145, z: 34 }, { x: 132, y: 135, z: 32 }] },
};

export const MOCK_BONE_DENSITY_MAP = {
  measurements: [
    { label: 'Implant Site (36)', region: '36 distal', hu: 680, quality: 'D3' },
    { label: 'Implant Site (36)', region: '36 mesial', hu: 720, quality: 'D3' },
    { label: 'Implant Site (36)', region: '36 apical', hu: 850, quality: 'D2' },
    { label: 'Implant Site (36)', region: '36 buccal', hu: 620, quality: 'D3' },
    { label: 'Implant Site (36)', region: '36 lingual', hu: 750, quality: 'D2' },
    { label: 'Adjacent 35', region: '35 distal', hu: 950, quality: 'D2' },
    { label: 'Adjacent 37', region: '37 mesial', hu: 880, quality: 'D2' },
  ],
  overallQuality: 'D2/D3 (中等密度)',
  mappingUrl: 'data:image/png;base64,DUMMY_HU_MAP',
  averageHU: 750,
  minHU: 480,
  maxHU: 1200,
};

export const MOCK_NERVE_DISTANCES = [
  { structure: '下牙槽神经管', toothNo: 36, distance: 3.2, safe: true, alert: false },
  { structure: '下牙槽神经管', toothNo: 37, distance: 5.8, safe: true, alert: false },
  { structure: '颏神经', toothNo: 35, distance: 8.5, safe: true, alert: false },
  { structure: '鼻底', toothNo: 11, distance: 12.0, safe: true, alert: false },
  { structure: '上颌窦底', toothNo: 16, distance: 2.5, safe: false, alert: true, action: '上颌窦提升' },
  { structure: '上颌窦底', toothNo: 17, distance: 3.8, safe: true, alert: false },
];
