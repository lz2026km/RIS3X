import { z } from 'zod'

export const CreateDentalStudySchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional().default(''),
  modality: z.string().min(1),
  region: z.string().optional().default(''),
  toothArea: z.string().optional().default(''),
  toothNumber: z.string().optional(),
  scanType: z.string().optional(),
  acquisitionDate: z.string().optional(),
  studyDate: z.string().min(1),
  deviceModel: z.string().optional().default(''),
  fieldOfView: z.string().optional().default(''),
  voxelSize: z.number().optional(),
  radiationDose: z.number().optional(),
  fileSize: z.number().int().optional(),
  imageCount: z.number().int().optional().default(0),
  quality: z.string().optional(),
  indications: z.string().optional().default(''),
  referringDentist: z.string().optional().default(''),
  status: z.string().optional().default('PENDING'),
  thumbnail: z.string().optional(),
  dicomPath: z.string().optional(),
  segments: z.array(z.any()).optional(),
  measurements: z.array(z.any()).optional(),
  aiAnalysis: z.any().optional(),
  findings: z.string().optional().default(''),
  impressions: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
})

export const UpdateDentalStudySchema = z.object({
  patientName: z.string().optional(),
  modality: z.string().optional(),
  region: z.string().optional(),
  toothArea: z.string().optional(),
  toothNumber: z.string().optional(),
  scanType: z.string().optional(),
  acquisitionDate: z.string().optional(),
  studyDate: z.string().optional(),
  deviceModel: z.string().optional(),
  fieldOfView: z.string().optional(),
  voxelSize: z.number().optional(),
  radiationDose: z.number().optional(),
  fileSize: z.number().int().optional(),
  imageCount: z.number().int().optional(),
  quality: z.string().optional(),
  indications: z.string().optional(),
  referringDentist: z.string().optional(),
  status: z.string().optional(),
  thumbnail: z.string().optional(),
  dicomPath: z.string().optional(),
  segments: z.array(z.any()).optional(),
  measurements: z.array(z.any()).optional(),
  aiAnalysis: z.any().optional(),
  findings: z.string().optional(),
  impressions: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const CreateAiFindingSchema = z.object({
  studyId: z.string().min(1),
  findingType: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1),
  toothNumber: z.string().optional(),
})

export const CreateImplantSchema = z.object({
  patientId: z.string().min(1),
  implantType: z.string().min(1),
  manufacturer: z.string().min(1),
  lotNumber: z.string().optional(),
  implantDate: z.string().min(1),
  toothNumber: z.string().min(1),
})

export const UpdateImplantSchema = z.object({
  implantType: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  lotNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'REMOVED', 'FAILED']).optional(),
})

export const CreateDentalAppointmentSchema = z.object({
  patientId: z.string().min(1),
  dateTime: z.string().min(1),
  dentistId: z.string().min(1),
  reason: z.string().min(1),
  notes: z.string().optional(),
})

export const UpdateDentalAppointmentSchema = z.object({
  dateTime: z.string().min(1).optional(),
  dentistId: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
})

export const CreateDentalInvoiceSchema = z.object({
  patientId: z.string().min(1),
  items: z.array(z.object({ code: z.string(), name: z.string(), amount: z.number().positive(), quantity: z.number().int().positive() })).min(1),
  insuranceClaim: z.boolean().default(false),
})

export const AddInventoryItemSchema = z.object({
  itemName: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  unit: z.string().min(1),
  supplier: z.string().optional(),
})

export const UpdateInventoryItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  quantity: z.number().int().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  supplier: z.string().optional(),
})
