import { z } from 'zod'

// ═══════════ [G005 W7-Exec] MWL / 协议 / 序列 QC / 剂量回写 DTO ═══════════

export const MwlQuerySchema = z.object({
  modality: z.string().max(32).optional(),
  date: z.string().max(32).optional(),
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  patientName: z.string().max(128).optional(),
  patientId: z.string().max(64).optional(),
  accessionNumber: z.string().max(64).optional(),
  stationAE: z.string().max(64).optional(),
  includeCompleted: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === 'true')
    .optional(),
})
export type MwlQueryDto = z.infer<typeof MwlQuerySchema>

export const MppsLinkSchema = z.object({
  studyUid: z.string().min(1),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DISCONTINUED']),
  accessionNumber: z.string().optional(),
  requestedProcedureId: z.string().optional(),
  examId: z.string().optional(),
  performedSteps: z
    .array(
      z.object({
        code: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }),
    )
    .optional(),
})
export type MppsLinkDto = z.infer<typeof MppsLinkSchema>

export const ExposureParamsSchema = z.object({
  kVp: z.coerce.number().positive().max(1000).optional(),
  mAs: z.coerce.number().positive().max(100000).optional(),
  aec: z.boolean().optional(),
  rotationTime: z.coerce.number().positive().max(60).optional(),
  pitch: z.coerce.number().positive().max(10).optional(),
  thickness: z.coerce.number().positive().optional(),
  collimation: z.string().optional(),
  reconstruction: z.string().optional(),
})
export type ExposureParamsDto = z.infer<typeof ExposureParamsSchema>

export const ScanRangeSchema = z.object({
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
  orientation: z.string().optional(),
  landmarks: z.array(z.string()).optional(),
})
export type ScanRangeDto = z.infer<typeof ScanRangeSchema>

export const ProtocolSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  modality: z.string().min(1).max(32),
  bodyPart: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  contrast: z.coerce.boolean().optional(),
  seriesCount: z.coerce.number().int().min(1).max(64).optional(),
  expectedImages: z.coerce.number().int().min(1).max(100000).optional(),
  exposureParams: ExposureParamsSchema.optional(),
  scanRange: ScanRangeSchema.optional(),
  contrastProtocolId: z.string().max(64).optional(),
})
export type ProtocolDto = z.infer<typeof ProtocolSchema>

export const ExamProtocolSetSchema = z.object({
  protocolId: z.string().max(64).optional(),
  seriesCount: z.coerce.number().int().min(0).max(64).optional(),
  expectedImages: z.coerce.number().int().min(0).max(100000).optional(),
  exposureParams: ExposureParamsSchema.optional(),
  scanRange: ScanRangeSchema.optional(),
  contrastProtocolId: z.string().max(64).optional(),
})
export type ExamProtocolSetDto = z.infer<typeof ExamProtocolSetSchema>

export const SeriesRegisterSchema = z.object({
  seriesNumber: z.coerce.number().int().min(1).max(9999),
  seriesInstanceUid: z.string().max(128).optional(),
  description: z.string().max(200).optional(),
  modality: z.string().max(32).optional(),
  imageCount: z.coerce.number().int().min(0).max(100000),
  acquiredAt: z.string().optional(),
  exposureParams: ExposureParamsSchema.optional(),
})
export type SeriesRegisterDto = z.infer<typeof SeriesRegisterSchema>

export const SeriesQcItemSchema = z.object({
  seriesNumber: z.coerce.number().int().min(1).max(9999),
  quality: z.enum(['PASS', 'REJECT']),
  reason: z.string().max(500).optional(),
  score: z.coerce.number().min(0).max(100).optional(),
})
export type SeriesQcItemDto = z.infer<typeof SeriesQcItemSchema>

export const SeriesQcSchema = z.object({
  items: z.array(SeriesQcItemSchema).min(1).max(200),
  scoredBy: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
})
export type SeriesQcDto = z.infer<typeof SeriesQcSchema>

export const DoseWritebackSchema = z
  .object({
    ctdivol: z.coerce.number().nonnegative().max(10000).optional(),
    ctdiVol: z.coerce.number().nonnegative().max(10000).optional(),
    dlp: z.coerce.number().nonnegative().max(1000000).optional(),
    ssde: z.coerce.number().nonnegative().max(10000).optional(),
    studyUid: z.string().max(128).optional(),
    bodyPart: z.string().max(64).optional(),
    modality: z.string().max(32).optional(),
    source: z.enum(['RDSR', 'MANUAL']).optional(),
    rdsr: z
      .object({
        ctdivol: z.coerce.number().nonnegative().optional(),
        dlp: z.coerce.number().nonnegative().optional(),
        ssde: z.coerce.number().nonnegative().optional(),
        bodyPart: z.string().optional(),
        studyUid: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const ctdivol = value.ctdivol ?? value.ctdiVol ?? value.rdsr?.ctdivol
    const dlp = value.dlp ?? value.rdsr?.dlp
    if (ctdivol === undefined && dlp === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ctdivol or dlp is required' })
    }
  })
export type DoseWritebackDto = z.infer<typeof DoseWritebackSchema>