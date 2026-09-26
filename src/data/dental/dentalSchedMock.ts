// [v3.0.6.8-96] Phase 4: 牙椅预约排班 + PSR 6分位
// 对标: 领健·牙医管家

export const MOCK_DENTAL_CHAIRS = [
  { id: 'CH-01', name: '1号综合治疗台', type: 'standard', status: 'online', specialties: ['general','endo','restorative'], minStockAlerts: true },
  { id: 'CH-02', name: '2号综合治疗台', type: 'standard', status: 'online', specialties: ['general','perio','surgery'], minStockAlerts: true },
  { id: 'CH-03', name: '3号综合治疗台', type: 'standard', status: 'online', specialties: ['general','pediatric'], minStockAlerts: true },
  { id: 'CH-04', name: '4号种植专用手术室', type: 'implant', status: 'online', specialties: ['implant','surgery'], minStockAlerts: true },
  { id: 'CH-05', name: '5号正畸专用椅', type: 'ortho', status: 'maintenance', specialties: ['ortho'], minStockAlerts: false },
  { id: 'CH-06', name: '6号儿童专用椅', type: 'pediatric', status: 'online', specialties: ['pediatric'], minStockAlerts: true },
];

export const MOCK_DENTISTS = [
  { id: 'DR-001', name: '王医生', specialty: 'general', title: '主治医师', chairs: ['CH-01','CH-02'], hours: { start: '08:00', end: '17:00' } },
  { id: 'DR-002', name: '李医生', specialty: 'perio', title: '副主任医师', chairs: ['CH-02','CH-03'], hours: { start: '09:00', end: '18:00' } },
  { id: 'DR-003', name: '张主任', specialty: 'implant', title: '主任医师', chairs: ['CH-04'], hours: { start: '08:30', end: '17:30' } },
  { id: 'DR-004', name: '赵医生', specialty: 'ortho', title: '主治医师', chairs: ['CH-05'], hours: { start: '09:00', end: '18:00' } },
  { id: 'DR-005', name: '刘医生', specialty: 'pediatric', title: '医师', chairs: ['CH-06'], hours: { start: '08:00', end: '17:00' } },
];

const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];

export function generateMockAppointments(date: string) {
  const appts = [];
  const patients = ['张伟','李娜','王芳','赵雪','刘阳','陈雨','孙明','周婷','吴强','郑丽'];
  const types = ['初诊','复诊','治疗','复查','洁牙','种植','正畸','修复'];
  let idx = 0;
  for (const chair of MOCK_DENTAL_CHAIRS) {
    if (chair.status !== 'online') continue;
    const slotCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < slotCount && i < TIME_SLOTS.length; i++) {
      const patient = patients[(idx + i) % patients.length];
      const type = types[(idx + i) % types.length];
      appts.push({
        id: `APT-${date.replace(/-/g,'')}-${String(idx).padStart(3,'0')}`,
        patientName: patient,
        patientId: `P${String(100000 + (idx % 5) + 1)}`,
        chairId: chair.id,
        chairName: chair.name,
        dentist: MOCK_DENTISTS[i % MOCK_DENTISTS.length]?.name ?? '',
        date,
        time: TIME_SLOTS[i],
        type,
        duration: type === '种植' || type === '正畸' ? 60 : type === '初诊' ? 30 : 30,
        status: ['scheduled','scheduled','scheduled','in-progress','completed','no-show'][i % 6],
        notes: '',
        createdAt: new Date().toISOString(),
      });
      idx++;
    }
  }
  return appts;
}

// PSR 6分位牙周记录 (PSR = Periodontal Screening & Recording)
export const MOCK_PSR_RECORDS = [
  { patientId: 'P100001', date: '2026-06-15', quadrant: 1, sextant: 1, 
    probingDepths: [3,2,3,3,4,2], // 6点探诊 mm
    bleeding: [true,false,false,true,true,false],
    furcation: [0,0,0,0,0,0],
    mobility: 0,
    plaqueIndex: 1,
    psrCode: 2, // PSR 0-4
    note: '下颌右侧轻度牙龈炎',
    dentist: '李医生',
  },
  { patientId: 'P100001', date: '2026-06-15', quadrant: 2, sextant: 2,
    probingDepths: [4,5,4,3,4,4],
    bleeding: [true,true,true,false,true,true],
    furcation: [0,0,1,0,0,0], // 1=初期, 2=中度
    mobility: 1,
    plaqueIndex: 2,
    psrCode: 3,
    note: '下颌左侧中度牙周炎, 36远中颊侧根分叉病变 I度',
    dentist: '李医生',
  },
  { patientId: 'P100002', date: '2026-06-10', quadrant: 3, sextant: 3,
    probingDepths: [2,2,3,2,2,3],
    bleeding: [false,false,false,false,false,false],
    furcation: [0,0,0,0,0,0],
    mobility: 0,
    plaqueIndex: 0,
    psrCode: 1,
    note: '健康',
    dentist: '李医生',
  },
];

export const MOCK_SCHEDULE_STATS = {
  todayAppointments: 28,
  completed: 12,
  inProgress: 4,
  noShow: 2,
  cancelled: 1,
  avgWaitTime: 8, // minutes
  chairUtilization: 0.72,
  peakHour: '10:00-11:00',
};
