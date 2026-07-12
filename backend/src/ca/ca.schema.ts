import { z } from 'zod'

export const UploadCertificateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CA', 'INTERMEDIATE', 'USER']),
  certificateData: z.string().min(1),
  privateKey: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

export const SignDocumentSchema = z.object({
  documentId: z.string().min(1),
  signatureType: z.enum(['DIGITAL', 'ELECTRONIC']),
  certificateId: z.string().min(1),
  reason: z.string().optional(),
})

export const VerifySignatureSchema = z.object({
  documentId: z.string().min(1),
  signatureData: z.string().min(1),
})

export const UpdateCaConfigSchema = z.object({
  defaultCertId: z.string().min(1).optional(),
  signingAlgorithm: z.string().optional(),
  hashAlgorithm: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
})
