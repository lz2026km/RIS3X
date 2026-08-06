import { z } from 'zod'

export const RequestCertificateSchema = z.object({
  commonName: z.string().min(1),
  userId: z.string().min(1),
  department: z.string().min(1),
  title: z.string().min(1),
  algorithm: z.enum(['SM2', 'RSA-2048', 'RSA-4096', 'ECDSA-P256']).optional(),
})

export const RevokeCertificateSchema = z.object({
  reason: z.string().min(1),
})

export const SignReportSchema = z.object({
  certificateId: z.string().min(1),
  reportHash: z.string().min(1),
})

export const IssueTimestampSchema = z.object({
  dataHash: z.string().min(1),
  reportId: z.string().optional(),
})
