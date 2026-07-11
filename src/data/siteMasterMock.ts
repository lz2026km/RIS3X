export interface SiteConfig {
  siteId: string;
  siteName: string;
  address: string;
  departmentCount: number;
  deviceCount: number;
  annualExamVolume: number;
  devices: { deviceId: string; deviceName: string; modality: string; room: string }[];
}

export const SITE_CONFIG: SiteConfig[] = [
  {
    siteId: 'S001',
    siteName: '总院',
    address: '上海市静安区华山路650号',
    departmentCount: 12,
    deviceCount: 21,
    annualExamVolume: 80000,
    devices: [
      { deviceId: 'DEV-CT-001', deviceName: 'GE Revolution CT', modality: 'CT', room: 'CT检查室1' },
      { deviceId: 'DEV-CT-002', deviceName: 'Siemens SOMATOM Force', modality: 'CT', room: 'CT检查室2' },
      { deviceId: 'DEV-CT-003', deviceName: 'Canon Aquilion ONE', modality: 'CT', room: 'CT检查室3' },
      { deviceId: 'DEV-CT-004', deviceName: '联影 uCT 960+', modality: 'CT', room: 'CT检查室4' },
      { deviceId: 'DEV-MR-001', deviceName: 'Siemens MAGNETOM Vida 3T', modality: 'MR', room: 'MRI检查室1' },
      { deviceId: 'DEV-MR-002', deviceName: 'GE SIGNA Premier 3T', modality: 'MR', room: 'MRI检查室2' },
      { deviceId: 'DEV-MR-003', deviceName: 'Philips Ingenia 1.5T', modality: 'MR', room: 'MRI检查室3' },
      { deviceId: 'DEV-MR-004', deviceName: '联影 uMR 790', modality: 'MR', room: 'MRI检查室4' },
      { deviceId: 'DEV-MR-005', deviceName: '联影 uMR 780', modality: 'MR', room: 'MRI检查室5' },
      { deviceId: 'DEV-DR-001', deviceName: '西门子 Multix Fusion', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'DEV-DR-002', deviceName: '飞利浦 DigitalDiagnost', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'DEV-DR-003', deviceName: '联影 uDR 780i', modality: 'DR', room: 'DR检查室3' },
      { deviceId: 'DEV-DR-004', deviceName: 'GE Definium 6560', modality: 'DR', room: 'DR检查室4' },
      { deviceId: 'DEV-DR-005', deviceName: '西门子 Luminos dRF', modality: 'DR', room: 'DR检查室5' },
      { deviceId: 'DEV-DSA-001', deviceName: '飞利浦 Cios Alpha', modality: 'DSA', room: 'DSA导管室1' },
      { deviceId: 'DEV-DSA-002', deviceName: '西门子 Artis Q Zeego', modality: 'DSA', room: 'DSA导管室2' },
      { deviceId: 'DEV-MG-001', deviceName: 'GE Pristina Serena', modality: 'MG', room: '钼靶检查室1' },
      { deviceId: 'DEV-MG-002', deviceName: '联影 uMammo 890i', modality: 'MG', room: '钼靶检查室2' },
      { deviceId: 'DEV-MG-003', deviceName: '西门子 Mammomat Inspiration', modality: 'MG', room: '钼靶检查室3' },
      { deviceId: 'DEV-PET-CT-001', deviceName: 'GE Discovery MI', modality: 'PET-CT', room: 'PET-CT检查室1' },
      { deviceId: 'DEV-PET-CT-002', deviceName: '联影 uMI 780', modality: 'PET-CT', room: 'PET-CT检查室2' },
    ],
  },
  {
    siteId: 'S002',
    siteName: '东院',
    address: '上海市浦东新区浦建路160号',
    departmentCount: 6,
    deviceCount: 15,
    annualExamVolume: 35000,
    devices: [
      { deviceId: 'DEV-CT-005', deviceName: '联影 uCT 780', modality: 'CT', room: 'CT检查室1' },
      { deviceId: 'DEV-CT-006', deviceName: 'GE Revolution ACT', modality: 'CT', room: 'CT检查室2' },
      { deviceId: 'DEV-CT-007', deviceName: '西门子 SOMATOM go.Sim', modality: 'CT', room: 'CT检查室3' },
      { deviceId: 'DEV-DR-006', deviceName: '飞利浦 DigitalDiagnost C50', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'DEV-DR-007', deviceName: '联影 uDR 560i', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'DEV-DR-008', deviceName: 'GE Definium 5000', modality: 'DR', room: 'DR检查室3' },
      { deviceId: 'DEV-DR-009', deviceName: '西门子 Multix Impact', modality: 'DR', room: 'DR检查室4' },
      { deviceId: 'DEV-DR-010', deviceName: '联影 uDR 370i', modality: 'DR', room: 'DR检查室5' },
      { deviceId: 'DEV-MG-001', deviceName: 'Hologic Selenia Dimensions', modality: 'MG', room: '钼靶检查室1' },
      { deviceId: 'DEV-MG-002', deviceName: '西门子 MAMMOMAT Fusion', modality: 'MG', room: '钼靶检查室2' },
      { deviceId: 'DEV-MG-003', deviceName: '联影 uMammo 780i', modality: 'MG', room: '钼靶检查室3' },
      { deviceId: 'DEV-US-001', deviceName: '飞利浦 EPIQ Elite', modality: 'US', room: '超声检查室1' },
      { deviceId: 'DEV-US-002', deviceName: 'GE LOGIQ E20', modality: 'US', room: '超声检查室2' },
      { deviceId: 'DEV-US-003', deviceName: '西门子 ACUSON Sequoia', modality: 'US', room: '超声检查室3' },
      { deviceId: 'DEV-US-004', deviceName: '飞利浦 ClearVue 850', modality: 'US', room: '超声检查室4' },
    ],
  },
  {
    siteId: 'S003',
    siteName: '西院',
    address: '上海市长宁区仙霞路1111号',
    departmentCount: 4,
    deviceCount: 10,
    annualExamVolume: 15000,
    devices: [
      { deviceId: 'DEV-DR-011', deviceName: '飞利浦 DigitalDiagnost C90', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'DEV-DR-012', deviceName: '联影 uDR 560i-A', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'DEV-MR-006', deviceName: 'GE SIGNA Voyager 1.5T', modality: 'MR', room: 'MRI检查室1' },
      { deviceId: 'DEV-MR-007', deviceName: '联影 uMR 770', modality: 'MR', room: 'MRI检查室2' },
      { deviceId: 'DEV-US-005', deviceName: '飞利浦 EPIQ 7C', modality: 'US', room: '超声检查室1' },
      { deviceId: 'DEV-US-006', deviceName: '西门子 ACUSON Juniper', modality: 'US', room: '超声检查室2' },
      { deviceId: 'DEV-US-007', deviceName: 'GE LOGIQ E10', modality: 'US', room: '超声检查室3' },
      { deviceId: 'DEV-US-008', deviceName: 'GE LOGIQ E9', modality: 'US', room: '超声检查室4' },
      { deviceId: 'DEV-CT-008', deviceName: 'GE Revolution ACT', modality: 'CT', room: 'CT检查室1' },
      { deviceId: 'DEV-CT-009', deviceName: '联影 uCT 760', modality: 'CT', room: 'CT检查室2' },
    ],
  },
];
