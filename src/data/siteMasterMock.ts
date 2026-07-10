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
    deviceCount: 25,
    annualExamVolume: 80000,
    devices: [
      { deviceId: 'D001', deviceName: 'GE Revolution CT', modality: 'CT', room: 'CT检查室1' },
      { deviceId: 'D002', deviceName: 'Siemens SOMATOM Force', modality: 'CT', room: 'CT检查室2' },
      { deviceId: 'D003', deviceName: 'Canon Aquilion ONE', modality: 'CT', room: 'CT检查室3' },
      { deviceId: 'D004', deviceName: '联影 uCT 960+', modality: 'CT', room: 'CT检查室4' },
      { deviceId: 'D005', deviceName: 'Siemens MAGNETOM Vida 3T', modality: 'MR', room: 'MRI检查室1' },
      { deviceId: 'D006', deviceName: 'GE SIGNA Premier 3T', modality: 'MR', room: 'MRI检查室2' },
      { deviceId: 'D007', deviceName: 'Philips Ingenia 1.5T', modality: 'MR', room: 'MRI检查室3' },
      { deviceId: 'D008', deviceName: '联影 uMR 790', modality: 'MR', room: 'MRI检查室4' },
      { deviceId: 'D009', deviceName: '联影 uMR 780', modality: 'MR', room: 'MRI检查室5' },
      { deviceId: 'D010', deviceName: '西门子 Multix Fusion', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'D011', deviceName: '飞利浦 DigitalDiagnost', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'D012', deviceName: '联影 uDR 780i', modality: 'DR', room: 'DR检查室3' },
      { deviceId: 'D013', deviceName: 'GE Definium 6560', modality: 'DR', room: 'DR检查室4' },
      { deviceId: 'D014', deviceName: '西门子 Luminos dRF', modality: 'DR', room: 'DR检查室5' },
      { deviceId: 'D015', deviceName: '飞利浦 Cios Alpha', modality: 'DSA', room: 'DSA导管室1' },
      { deviceId: 'D016', deviceName: '西门子 Artis Q Zeego', modality: 'DSA', room: 'DSA导管室2' },
      { deviceId: 'D017', deviceName: 'GE Innova IGS 5', modality: 'DSA', room: 'DSA导管室3' },
      { deviceId: 'D018', deviceName: '联影 uDSA 780', modality: 'DSA', room: 'DSA导管室4' },
      { deviceId: 'D019', deviceName: 'GE Pristina Serena', modality: 'Mammo', room: '钼靶检查室1' },
      { deviceId: 'D020', deviceName: '联影 uMammo 890i', modality: 'Mammo', room: '钼靶检查室2' },
      { deviceId: 'D021', deviceName: '西门子 Mammomat Inspiration', modality: 'Mammo', room: '钼靶检查室3' },
      { deviceId: 'D022', deviceName: 'GE Discovery MI', modality: 'PET-CT', room: 'PET-CT检查室1' },
      { deviceId: 'D023', deviceName: '联影 uMI 780', modality: 'PET-CT', room: 'PET-CT检查室2' },
      { deviceId: 'D024', deviceName: '飞利浦 Vereos PET/CT', modality: 'PET-CT', room: 'PET-CT检查室3' },
      { deviceId: 'D025', deviceName: '西门子 Biograph Vision', modality: 'PET-CT', room: 'PET-CT检查室4' },
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
      { deviceId: 'D101', deviceName: '联影 uCT 780', modality: 'CT', room: 'CT检查室1' },
      { deviceId: 'D102', deviceName: 'GE Revolution ACT', modality: 'CT', room: 'CT检查室2' },
      { deviceId: 'D103', deviceName: '西门子 SOMATOM go.Sim', modality: 'CT', room: 'CT检查室3' },
      { deviceId: 'D104', deviceName: '飞利浦 DigitalDiagnost C50', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'D105', deviceName: '联影 uDR 560i', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'D106', deviceName: 'GE Definium 5000', modality: 'DR', room: 'DR检查室3' },
      { deviceId: 'D107', deviceName: '西门子 Multix Impact', modality: 'DR', room: 'DR检查室4' },
      { deviceId: 'D108', deviceName: '联影 uDR 370i', modality: 'DR', room: 'DR检查室5' },
      { deviceId: 'D109', deviceName: 'Hologic Selenia Dimensions', modality: 'Mammo', room: '钼靶检查室1' },
      { deviceId: 'D110', deviceName: '西门子 MAMMOMAT Fusion', modality: 'Mammo', room: '钼靶检查室2' },
      { deviceId: 'D111', deviceName: '飞利浦 EPIQ Elite', modality: 'US', room: '超声检查室1' },
      { deviceId: 'D112', deviceName: 'GE LOGIQ E20', modality: 'US', room: '超声检查室2' },
      { deviceId: 'D113', deviceName: '西门子 ACUSON Sequoia', modality: 'US', room: '超声检查室3' },
      { deviceId: 'D114', deviceName: '联影 uMammo 780i', modality: 'Mammo', room: '钼靶检查室3' },
      { deviceId: 'D115', deviceName: '飞利浦 ClearVue 850', modality: 'US', room: '超声检查室4' },
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
      { deviceId: 'D201', deviceName: '飞利浦 DigitalDiagnost C90', modality: 'DR', room: 'DR检查室1' },
      { deviceId: 'D202', deviceName: '联影 uDR 560i-A', modality: 'DR', room: 'DR检查室2' },
      { deviceId: 'D203', deviceName: '西门子 Multix Impact E', modality: 'DR', room: 'DR检查室3' },
      { deviceId: 'D204', deviceName: 'GE Definium 6000', modality: 'DR', room: 'DR检查室4' },
      { deviceId: 'D205', deviceName: '联影 uDR 370i-A', modality: 'DR', room: 'DR检查室5' },
      { deviceId: 'D206', deviceName: 'GE SIGNA Voyager 1.5T', modality: 'MR', room: 'MRI检查室1' },
      { deviceId: 'D207', deviceName: '联影 uMR 770', modality: 'MR', room: 'MRI检查室2' },
      { deviceId: 'D208', deviceName: '飞利浦 EPIQ 7C', modality: 'US', room: '超声检查室1' },
      { deviceId: 'D209', deviceName: '西门子 ACUSON Juniper', modality: 'US', room: '超声检查室2' },
      { deviceId: 'D210', deviceName: 'GE LOGIQ E10', modality: 'US', room: '超声检查室3' },
    ],
  },
];
