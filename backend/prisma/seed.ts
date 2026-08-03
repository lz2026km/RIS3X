/**
 * G005 放射RIS系统 v3.0.1 - Prisma Seed
 * 5 角色用户 + 3 设备 + 3 患者 + 5 检查 + 5 报告 + 5 危急值 + 5 预约
 * v3.0.6.11-53: 内置示例 DICOM (dicom-samples/manifest.json) 写入 dicomInstance 表
 */
import { PrismaClient, UserRole, Gender, DeviceState, ReportState, CriticalState, CriticalSeverity, NotificationMethod, PatientType, AppointmentState, RadsCategory } from '@prisma/client'
import { hash } from 'bcrypt'
import * as fs from 'node:fs'
import * as path from 'node:path'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log('[seed] starting G005 v3.0.1 ...')

  // 5 角色用户
  const users = [
    { username: 'admin', password: 'Admin@123', fullName: '系统管理员', role: UserRole.ADMIN, department: '信息中心' },
    { username: 'director_li', password: 'Dir@2024', fullName: '李明辉', role: UserRole.DIRECTOR, department: '放射科' },
    { username: 'doctor_wang', password: 'Doc@2024', fullName: '王芳', role: UserRole.DOCTOR, department: '放射科' },
    { username: 'doctor_zhang', password: 'Doc@2024', fullName: '张伟', role: UserRole.DOCTOR, department: '放射科' },
    { username: 'tech_liu', password: 'Tech@2024', fullName: '刘洋', role: UserRole.TECHNICIAN, department: 'CT 室' },
  ]
  for (const u of users) {
    const passwordHash = await hash(u.password, 10)
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        tenantId: 'default',
      },
    })
  }
  console.log(`[seed] ${users.length} users upserted`)

  // 3 设备
  const devices = [
    { code: 'CT-001', name: 'Siemens SOMATOM Definition', modality: 'CT', manufacturer: 'Siemens', location: 'CT 室 1', state: DeviceState.IDLE },
    { code: 'MR-002', name: 'GE Signa HDxt 3.0T', modality: 'MR', manufacturer: 'GE', location: 'MR 室 2', state: DeviceState.IDLE },
    { code: 'DR-003', name: 'Philips DigitalDiagnost', modality: 'DR', manufacturer: 'Philips', location: 'DR 室 3', state: DeviceState.MAINTENANCE },
  ]
  for (const d of devices) {
    await prisma.device.upsert({ where: { code: d.code }, update: {}, create: { ...d, tenantId: 'default' } })
  }
  console.log(`[seed] ${devices.length} devices upserted`)

  // 3 患者
  const patients = [
    { name: '张三', gender: Gender.MALE, type: PatientType.OUTPATIENT, phone: '13800138001' },
    { name: '李四', gender: Gender.FEMALE, type: PatientType.INPATIENT, phone: '13800138002' },
    { name: '王五', gender: Gender.MALE, type: PatientType.EMERGENCY, phone: '13800138003' },
  ]
  const createdPatients = []
  for (const p of patients) {
    const found = await prisma.patient.findFirst({ where: { name: p.name, phone: p.phone } })
    const pt = found ?? (await prisma.patient.create({ data: { ...p, tenantId: 'default' } }))
    createdPatients.push(pt)
  }
  console.log(`[seed] ${createdPatients.length} patients`)

  // 5 检查 + 5 报告
  const doctorWang = await prisma.user.findUnique({ where: { username: 'doctor_wang' } })
  const ctDevice = await prisma.device.findUnique({ where: { code: 'CT-001' } })
  if (!doctorWang || !ctDevice) throw new Error('seed dependency missing')

  for (let i = 0; i < 5; i++) {
    const pt = createdPatients[i % createdPatients.length]!
    const accession = `ACC-2026-${String(i + 1).padStart(4, '0')}`
    const exam = await prisma.exam.upsert({
      where: { accessionNumber: accession },
      update: {},
      create: {
        patientId: pt.id,
        accessionNumber: accession,
        modality: 'CT',
        bodyPart: 'CHEST',
        deviceId: ctDevice.id,
        scheduledAt: new Date(Date.now() - i * 86400000),
        state: 'COMPLETED',
        tenantId: 'default',
      },
    })
    const report = await prisma.report.findFirst({ where: { examId: exam.id } })
    if (!report) {
      await prisma.report.create({
        data: {
          patientId: pt.id,
          examId: exam.id,
          radiologistId: doctorWang.id,
          state: i === 0 ? ReportState.SIGNED : i === 1 ? ReportState.INITIAL_REVIEW : ReportState.WRITING,
          findings: `双肺纹理清晰,未见明显异常密度影。\n气管支气管通畅。`,
          conclusion: i === 0 ? '胸部 CT 平扫未见明显异常。' : '待进一步评估。',
          signedAt: i === 0 ? new Date() : null,
          isCritical: i === 4,
          qualityScore: 80 + i,
          tenantId: 'default',
        },
      })
    }
  }
  console.log('[seed] 5 exams + 5 reports')

  // 5 危急值
  for (let i = 0; i < 5; i++) {
    await prisma.criticalValue.create({
      data: {
        description: ['大量气胸', '主动脉夹层', '大面积脑梗死', '急性心肌梗死', '肠系膜栓塞'][i] ?? '危急值',
        severity: i < 2 ? CriticalSeverity.CRITICAL : CriticalSeverity.HIGH,
        state: i < 2 ? CriticalState.ACKNOWLEDGED : CriticalState.FOUND,
        method: NotificationMethod.PHONE,
        notifiedTo: 'doctor_wang',
        tenantId: 'default',
      },
    })
  }
  console.log('[seed] 5 critical values')

  // 5 预约
  for (let i = 0; i < 5; i++) {
    const pt = createdPatients[i % createdPatients.length]!
    await prisma.appointment.create({
      data: {
        patientId: pt.id,
        deviceId: ctDevice.id,
        modality: 'CT',
        scheduledAt: new Date(Date.now() + i * 3600000),
        state: i === 0 ? AppointmentState.SCHEDULED : AppointmentState.COMPLETED,
        tenantId: 'default',
      },
    })
  }
  console.log('[seed] 5 appointments')

  // 5 RADS 模板
  const rads = [
    { category: RadsCategory.BI_RADS, code: 'BI-RADS 1', name: '阴性', body: '乳腺影像未见异常。' },
    { category: RadsCategory.BI_RADS, code: 'BI-RADS 2', name: '良性', body: '乳腺所见为良性。' },
    { category: RadsCategory.LI_RADS, code: 'LI-RADS 1', name: '肯定良性', body: '肝脏病灶肯定良性。' },
    { category: RadsCategory.PI_RADS, code: 'PI-RADS 1', name: '极低危', body: '前列腺癌极低危。' },
    { category: RadsCategory.TI_RADS, code: 'TI-RADS 2', name: '良性', body: '甲状腺结节良性。' },
  ]
  for (const r of rads) {
    await prisma.radsTemplate.upsert({
      where: { id: `${r.category}_${r.code}`.replace(/\s+/g, '_') },
      update: {},
      create: { id: `${r.category}_${r.code}`.replace(/\s+/g, '_'), ...r, tenantId: 'default' },
    })
  }
  console.log('[seed] 5 RADS templates')

  // 内置示例 DICOM (Phase 1.2+1.3): 从 dicom-samples/manifest.json 注册到 dicomInstance 表
  await seedDicomSamples(prisma)

  // v3.0.6.11-60: Auto-hanging 默认悬挂协议
  await seedHangingProtocols()

  console.log('[seed] done ✓')
}

interface SampleSeriesManifest {
  key: string
  modality: string
  sopClassUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  patientName: string
  patientId: string
  rows: number
  columns: number
  windowCenter: string
  windowWidth: string
  rescaleIntercept: string
  rescaleSlope: string
  transferSyntax: string
  instances: Array<{
    file: string
    sopInstanceUid: string
    instanceNumber: number
    sliceLocation: number
  }>
}

async function seedDicomSamples(prisma: PrismaClient): Promise<void> {
  const manifestPath = path.resolve(__dirname, '..', 'dicom-samples', 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.log('[seed] dicom-samples/manifest.json not found, skip DICOM sample seeding (run: npx ts-node scripts/generate-dicom-samples.ts)')
    return
  }
  const manifest: { baseDir: string; instanceCount: number; series: SampleSeriesManifest[] } = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8'),
  )
  const baseDir = path.resolve(path.dirname(manifestPath))
  const model = (prisma as any).dicomInstance
  if (!model?.upsert) {
    console.log('[seed] dicomInstance model not available, skip DICOM sample seeding')
    return
  }
  let count = 0
  for (const series of manifest.series) {
    for (const inst of series.instances) {
      const storagePath = path.join(baseDir, inst.file)
      const sizeBytes = fs.statSync(storagePath).size
      try {
        await model.upsert({
          where: { sopInstanceUid: inst.sopInstanceUid },
          update: {
            storagePath,
            sizeBytes,
            modality: series.modality,
            sopClassUid: series.sopClassUid,
          },
          create: {
            tenantId: 'default',
            studyInstanceUid: series.studyInstanceUid,
            seriesInstanceUid: series.seriesInstanceUid,
            sopInstanceUid: inst.sopInstanceUid,
            sopClassUid: series.sopClassUid,
            modality: series.modality,
            storagePath,
            sizeBytes,
            transferSyntax: series.transferSyntax,
          },
        })
        count++
      } catch (e) {
        console.error(`[seed] failed to upsert DICOM instance ${inst.sopInstanceUid}: ${(e as Error).message}`)
      }
    }
  }
  console.log(`[seed] ${count}/${manifest.instanceCount} built-in DICOM instances registered (tenant=default)`)
}

// v3.0.6.11-60: Auto-hanging 默认悬挂协议 seed (对标 GE/Siemens/Fujifilm)
async function seedHangingProtocols(): Promise<void> {
  const seeds = [
    { name: 'CT 头颅 轴位标准', modality: 'CT', bodyPart: 'HEAD', layout: { rows: 1, cols: 1, seriesOrder: ['轴位'] }, priority: 100, description: 'CT 头颅常规: 单视野轴位' },
    { name: 'CT 胸部 肺窗+纵隔窗', modality: 'CT', bodyPart: 'CHEST', layout: { rows: 2, cols: 2, seriesOrder: ['轴位-肺窗', '轴位-纵隔窗', '冠状位', '矢状位'] }, priority: 100, description: 'CT 胸部常规: 肺窗/纵隔窗双窗 2×2' },
    { name: 'MR 头颅 多序列', modality: 'MR', bodyPart: 'HEAD', layout: { rows: 2, cols: 3, seriesOrder: ['T1', 'T2', 'FLAIR', 'DWI', 'T1增强', 'SWI'] }, priority: 100, description: 'MR 头颅: T1/T2/FLAIR/DWI 六序列 2×3' },
    { name: 'DR 胸部 正侧位', modality: 'DR', bodyPart: 'CHEST', layout: { rows: 1, cols: 2, seriesOrder: ['正位', '侧位'] }, priority: 95, description: 'DR 胸部: 正位+侧位 1×2' },
    { name: 'CT 腹部 平扫+增强', modality: 'CT', bodyPart: 'ABDOMEN', layout: { rows: 2, cols: 2, seriesOrder: ['平扫', '动脉期', '门脉期', '延迟期'] }, priority: 90, description: 'CT 腹部: 四期对比 2×2' },
    { name: 'MR 脊柱 矢冠轴', modality: 'MR', bodyPart: 'SPINE', layout: { rows: 1, cols: 3, seriesOrder: ['矢状位', '冠状位', '轴位'] }, priority: 90, description: 'MR 脊柱: 矢状+冠状+轴位 1×3' },
    { name: 'CT 颈椎 骨窗+软窗', modality: 'CT', bodyPart: 'NECK', layout: { rows: 1, cols: 2, seriesOrder: ['骨窗', '软组织窗'] }, priority: 85, description: 'CT 颈椎: 双窗对比 1×2' },
    { name: 'MR 膝关节 多序列', modality: 'MR', bodyPart: 'KNEE', layout: { rows: 2, cols: 2, seriesOrder: ['矢状位 PD', '矢状位 T1', '冠状位 PD', '轴位 PD'] }, priority: 80, description: 'MR 膝关节: 矢冠轴四序列 2×2' },
  ]
  for (const s of seeds) {
    const existing = await prisma.hangingProtocol.findFirst({ where: { name: s.name } })
    if (existing) continue
    await prisma.hangingProtocol.create({ data: { ...s, tenantId: 'default' } })
  }
  console.log(`[seed] ${seeds.length} hanging protocols upserted`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
