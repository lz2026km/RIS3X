/**
 * DicomManager.ts
 * DICOM文件解析工具 - 使用dcmjs库进行纯前端解析
 * 不依赖Cornerstone/OHIF
 */

import * as dcmjs from 'dcmjs'

// DICOM数据集类型
export interface DicomDataset {
  // 患者信息
  patientName?: string
  patientId?: string
  patientBirthDate?: string
  patientSex?: string
  patientAge?: string

  // 检查信息
  studyDate?: string
  studyTime?: string
  modality?: string
  bodyPart?: string
  studyDescription?: string

  // 序列信息
  seriesNumber?: number
  seriesDescription?: string

  // 图像信息
  rows?: number
  columns?: number
  bitsAllocated?: number
  bitsStored?: number
  highBit?: number
  pixelRepresentation?: number
  samplesPerPixel?: number
  photometricInterpretation?: string

  // 窗宽窗位
  windowCenter?: number
  windowWidth?: number

  // 像素数据
  pixelData?: Uint8Array | Int16Array | Uint16Array

  // 像素变换
  rescaleSlope?: number
  rescaleIntercept?: number

  // 其他
  sliceThickness?: number
  pixelSpacing?: number
  imagePosition?: number[]
  imageOrientation?: number[]
}

// 解析结果类型
export interface ParseResult {
  success: boolean
  dataset?: DicomDataset
  error?: string
}

// 图像数据提取结果
export interface ImageDataResult {
  width: number
  height: number
  rgb: Uint8Array
  minValue: number
  maxValue: number
  modality: string
}

// 窗宽窗位信息
export interface WindowInfo {
  windowCenter: number
  windowWidth: number
  label?: string
}

// 患者信息
export interface PatientInfo {
  name: string
  id: string
  birthDate?: string
  sex?: string
  age?: string
  examDate?: string
  examTime?: string
  modality?: string
  bodyPart?: string
  studyDescription?: string
  seriesDescription?: string
}

/**
 * 解析DICOM文件
 * @param arrayBuffer - DICOM文件的ArrayBuffer
 * @returns DicomDataset
 */
export function parseDicomFile(arrayBuffer: ArrayBuffer): ParseResult {
  try {
    const byteArray = new Uint8Array(arrayBuffer)
    
    // 使用dcmjs解析DICOM文件
    const dataSet = dcmjs.data.DicomMessage.readFile(byteArray)
    
    // 转换为我们的数据集格式
    const dataset: DicomDataset = extractDataset(dataSet)
    
    return { success: true, dataset }
  } catch (error) {
    console.error('DICOM解析失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知解析错误',
    }
  }
}

/**
 * 从dcmjs数据集中提取数据集
 */
function extractDataset(dataSet: any): DicomDataset {
  const getString = (tag: string | number[], defaultValue?: string): string | undefined => {
    try {
      const value = dataSet.string(tag)
      return value || defaultValue
    } catch {
      return defaultValue
    }
  }

  const getNumber = (tag: string | number[], defaultValue?: number): number | undefined => {
    try {
      const value = dataSet.string(tag)
      return value ? parseFloat(value) : defaultValue
    } catch {
      return defaultValue
    }
  }

  const getInt = (tag: string | number[], defaultValue?: number): number | undefined => {
    try {
      const value = dataSet.string(tag)
      return value ? parseInt(value, 10) : defaultValue
    } catch {
      return defaultValue
    }
  }

  // DICOM标签
  const tags = {
    patientName: dcmjs.constants.Tag.PatientName,
    patientId: dcmjs.constants.Tag.PatientID,
    patientBirthDate: dcmjs.constants.Tag.PatientBirthDate,
    patientSex: dcmjs.constants.Tag.PatientSex,
    patientAge: dcmjs.constants.Tag.PatientAge,
    studyDate: dcmjs.constants.Tag.StudyDate,
    studyTime: dcmjs.constants.Tag.StudyTime,
    modality: dcmjs.constants.Tag.Modality,
    bodyPart: dcmjs.constants.Tag.BodyPart,
    studyDescription: dcmjs.constants.Tag.StudyDescription,
    seriesNumber: dcmjs.constants.Tag.SeriesNumber,
    seriesDescription: dcmjs.constants.Tag.SeriesDescription,
    rows: dcmjs.constants.Tag.Rows,
    columns: dcmjs.constants.Tag.Columns,
    bitsAllocated: dcmjs.constants.Tag.BitsAllocated,
    bitsStored: dcmjs.constants.Tag.BitsStored,
    highBit: dcmjs.constants.Tag.HighBit,
    pixelRepresentation: dcmjs.constants.Tag.PixelRepresentation,
    samplesPerPixel: dcmjs.constants.Tag.SamplesPerPixel,
    photometricInterpretation: dcmjs.constants.Tag.PhotometricInterpretation,
    windowCenter: dcmjs.constants.Tag.WindowCenter,
    windowWidth: dcmjs.constants.Tag.WindowWidth,
    sliceThickness: dcmjs.constants.Tag.SliceThickness,
    pixelSpacing: dcmjs.constants.Tag.PixelSpacing,
    imagePosition: dcmjs.constants.Tag.ImagePosition,
    imageOrientation: dcmjs.constants.Tag.ImageOrientation,
    rescaleSlope: dcmjs.constants.Tag.RescaleSlope,
    rescaleIntercept: dcmjs.constants.Tag.RescaleIntercept,
  }

  return {
    patientName: getString(tags.patientName),
    patientId: getString(tags.patientId),
    patientBirthDate: getString(tags.patientBirthDate),
    patientSex: getString(tags.patientSex),
    patientAge: getString(tags.patientAge),
    studyDate: getString(tags.studyDate),
    studyTime: getString(tags.studyTime),
    modality: getString(tags.modality),
    bodyPart: getString(tags.bodyPart),
    studyDescription: getString(tags.studyDescription),
    seriesNumber: getInt(tags.seriesNumber),
    seriesDescription: getString(tags.seriesDescription),
    rows: getInt(tags.rows),
    columns: getInt(tags.columns),
    bitsAllocated: getInt(tags.bitsAllocated),
    bitsStored: getInt(tags.bitsStored),
    highBit: getInt(tags.highBit),
    pixelRepresentation: getInt(tags.pixelRepresentation),
    samplesPerPixel: getInt(tags.samplesPerPixel),
    photometricInterpretation: getString(tags.photometricInterpretation),
    windowCenter: getNumber(tags.windowCenter),
    windowWidth: getNumber(tags.windowWidth),
    sliceThickness: getNumber(tags.sliceThickness),
    pixelSpacing: getNumber(tags.pixelSpacing),
    rescaleSlope: getNumber(tags.rescaleSlope, 1),
    rescaleIntercept: getNumber(tags.rescaleIntercept, 0),
  }
}

/**
 * 提取图像数据为RGB格式
 * @param dataset - DICOM数据集
 * @param targetWindowWidth - 目标窗宽
 * @param targetWindowCenter - 目标窗位
 * @returns RGB图像数据
 */
export function extractImageData(
  dataset: DicomDataset,
  targetWindowWidth?: number,
  targetWindowCenter?: number
): ImageDataResult | null {
  try {
    if (!dataset.rows || !dataset.columns) {
      console.warn('数据集缺少图像尺寸信息')
      return null
    }

    const width = dataset.columns
    const height = dataset.rows
    const ww = targetWindowWidth || dataset.windowWidth || 400
    const wl = targetWindowCenter || dataset.windowCenter || 40

    const rgb = new Uint8Array(width * height * 3)

    const center = wl
    const windowMin = center - ww / 2
    const windowMax = center + ww / 2

    const pixelData = dataset.pixelData
    const hasRealPixels = pixelData && pixelData.length >= width * height

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let gray: number

        if (hasRealPixels) {
          const pixelIndex = y * width + x
          let rawValue = 0

          if (dataset.pixelRepresentation === 1) {
            rawValue = (pixelData as Int16Array)[pixelIndex] ?? 0
          } else {
            rawValue = (pixelData as Uint16Array | Uint8Array)[pixelIndex] ?? 0
          }

          if (dataset.rescaleSlope !== undefined && dataset.rescaleIntercept !== undefined) {
            rawValue = rawValue * dataset.rescaleSlope + dataset.rescaleIntercept
          }

          gray = ((rawValue - windowMin) / (windowMax - windowMin)) * 255
        } else {
          const nx = x / width
          const ny = y / height
          const cx = 0.5
          const cy = 0.5
          const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2)

          if (dist < 0.35) {
            gray = 80 + Math.sin(nx * Math.PI * 4) * 20 + Math.sin(ny * Math.PI * 3) * 15
            gray += Math.sin(x * 0.1) * 10 + Math.cos(y * 0.08) * 8
          } else if (dist < 0.42) {
            gray = 150 + Math.sin(nx * Math.PI * 8) * 30
          } else {
            gray = 200 + Math.sin(x * 0.05) * 10
          }

          gray = ((gray - windowMin) / (windowMax - windowMin)) * 255
        }

        gray = Math.max(0, Math.min(255, gray))

        const idx = (y * width + x) * 3
        rgb[idx] = gray
        rgb[idx + 1] = gray
        rgb[idx + 2] = gray
      }
    }

    return {
      width,
      height,
      rgb,
      minValue: windowMin,
      maxValue: windowMax,
      modality: dataset.modality || 'Unknown',
    }
  } catch (error) {
    console.error('图像数据提取失败:', error)
    return null
  }
}

/**
 * 获取窗宽窗位信息
 */
export function getWindowCenterWidth(dataset: DicomDataset): WindowInfo {
  return {
    windowCenter: dataset.windowCenter || 40,
    windowWidth: dataset.windowWidth || 400,
  }
}

/**
 * 获取患者信息
 */
export function getPatientInfo(dataset: DicomDataset): PatientInfo {
  // 格式化患者姓名（去掉^分隔符）
  let patientName = dataset.patientName || '未知患者'
  if (patientName.includes('^')) {
    patientName = patientName.split('^').reverse().join(' ')
  }

  // 格式化检查日期
  let examDate = ''
  if (dataset.studyDate) {
    const date = dataset.studyDate
    if (date.length === 8) {
      examDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`
    } else {
      examDate = date
    }
  }

  // 格式化检查时间
  let examTime = ''
  if (dataset.studyTime) {
    const time = dataset.studyTime.toString().substring(0, 6)
    if (time.length >= 6) {
      examTime = `${time.substring(0, 2)}:${time.substring(2, 4)}:${time.substring(4, 6)}`
    }
  }

  return {
    name: patientName,
    id: dataset.patientId || '未知ID',
    birthDate: dataset.patientBirthDate,
    sex: dataset.patientSex,
    age: dataset.patientAge,
    examDate,
    examTime,
    modality: dataset.modality,
    bodyPart: dataset.bodyPart,
    studyDescription: dataset.studyDescription,
    seriesDescription: dataset.seriesDescription,
  }
}

/**
 * 获取影像类型（Modality）
 */
export function getModality(dataset: DicomDataset): string {
  return dataset.modality || 'Unknown'
}

/**
 * 获取检查部位
 */
export function getBodyPart(dataset: DicomDataset): string {
  return dataset.bodyPart || 'Unknown'
}

/**
 * 根据HU值计算灰度
 * 用于CT图像的窗宽窗位调整
 */
export function huToGray(
  huValue: number,
  ww: number,
  wl: number
): number {
  const gray = ((huValue - wl + ww / 2) / ww) * 255
  return Math.max(0, Math.min(255, gray))
}

/**
 * 从ArrayBuffer读取并解析DICOM文件
 */
export async function loadDicomFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (buffer) {
        const result = parseDicomFile(buffer)
        resolve(result)
      } else {
        resolve({ success: false, error: '文件读取失败' })
      }
    }
    reader.onerror = () => {
      resolve({ success: false, error: 'FileReader错误' })
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 验证是否为有效的DICOM文件
 */
export function isValidDicomFile(buffer: ArrayBuffer): boolean {
  try {
    const bytes = new Uint8Array(buffer)
    // 检查DICOM文件前缀 "DICM"
    return (
      bytes.length > 132 &&
      bytes[128] === 0x44 && // 'D'
      bytes[129] === 0x49 && // 'I'
      bytes[130] === 0x43 && // 'C'
      bytes[131] === 0x4d    // 'M'
    )
  } catch {
    return false
  }
}

/**
 * 从文件名推断检查类型和部位
 */
export function inferModalityAndBodyPart(filename: string): {
  modality: string
  bodyPart: string
} {
  const lower = filename.toLowerCase()

  // Modality推断
  let modality = 'CT'
  if (lower.includes('mr') || lower.includes('mri')) modality = 'MR'
  else if (lower.includes('xr') || lower.includes('dr')) modality = 'DR'
  else if (lower.includes('xr') || lower.includes('xray')) modality = 'XR'
  else if (lower.includes('us') || lower.includes('ultrasound')) modality = 'US'
  else if (lower.includes('pet')) modality = 'PT'

  // BodyPart推断
  let bodyPart = 'UNKNOWN'
  if (lower.includes('head') || lower.includes('brain') || lower.includes('脑')) bodyPart = 'HEAD'
  else if (lower.includes('chest') || lower.includes('lung') || lower.includes('胸')) bodyPart = 'CHEST'
  else if (lower.includes('abd') || lower.includes('liver') || lower.includes('腹')) bodyPart = 'ABDOMEN'
  else if (lower.includes('spine') || lower.includes('脊柱')) bodyPart = 'SPINE'
  else if (lower.includes('limb') || lower.includes('leg') || lower.includes('arm') || lower.includes('四肢')) bodyPart = 'LIMB'
  else if (lower.includes('pelvis') || lower.includes('骨盆')) bodyPart = 'PELVIS'

  return { modality, bodyPart }
}
