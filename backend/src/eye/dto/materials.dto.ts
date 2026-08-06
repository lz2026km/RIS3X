import { z } from 'zod'

// ── [G005-P1] 眼料/接触镜/OK镜 写操作 schema (在用孤儿补齐) ──

export const CreateIolItemSchema = z.object({
  barcode: z.string().min(1),
  model: z.string().min(1),
  type: z.enum(['monofocal', 'toric', 'multifocal', 'edof']),
  power: z.number(),
  cylinder: z.number().optional(),
  batchNumber: z.string().min(1),
  expiryDate: z.string().min(1),
  stockLocation: z.string().min(1),
  supplier: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  status: z.enum(['in_stock', 'reserved', 'implanted', 'expired', 'recalled']).optional(),
})

export const IolOutSchema = z.object({
  reason: z.string().min(1),
  patientId: z.string().optional(),
  surgeon: z.string().optional(),
})

export const IolTransferSchema = z.object({
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
})

export const IolAdjustSchema = z.object({
  deltaQty: z.number().int(),
  reason: z.string().min(1),
})

export const CreateContactLensSchema = z.object({
  brand: z.string().min(1),
  type: z.enum(['RGP', 'Scleral', 'Soft', 'OK', 'Hybrid']),
  series: z.string().min(1),
  bc: z.number(),
  dia: z.number(),
  power: z.number(),
  cylinder: z.number().optional(),
  axis: z.number().optional(),
  stock: z.number().int().nonnegative(),
  trialLens: z.boolean().optional(),
  unitPrice: z.number().nonnegative(),
  supplier: z.string().min(1),
})

export const UpdateContactLensSchema = z.object({
  brand: z.string().min(1).optional(),
  type: z.enum(['RGP', 'Scleral', 'Soft', 'OK', 'Hybrid']).optional(),
  series: z.string().min(1).optional(),
  bc: z.number().optional(),
  dia: z.number().optional(),
  power: z.number().optional(),
  cylinder: z.number().optional(),
  axis: z.number().optional(),
  stock: z.number().int().nonnegative().optional(),
  trialLens: z.boolean().optional(),
  unitPrice: z.number().nonnegative().optional(),
  supplier: z.string().min(1).optional(),
})

export const ContactLensFittingSchema = z.object({
  patientId: z.string().min(1),
  fittingData: z.record(z.string(), z.unknown()).optional(),
})

export const OkLensDesignSchema = z.object({
  patientId: z.string().min(1),
  k1: z.number(),
  k2: z.number(),
  kAxis: z.number(),
  targetReduction: z.number(),
  brand: z.string().optional(),
})
