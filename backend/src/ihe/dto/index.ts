import { z } from 'zod'

export const IdentifierSchema = z.object({
  domain: z.string().min(1),
  value: z.string().min(1),
  assigningAuthority: z.string().min(1),
})

export const NameSchema = z.object({
  family: z.string().min(1),
  given: z.array(z.string()).default([]),
})

export const TelecomSchema = z.object({
  system: z.enum(['phone', 'email', 'sms']),
  value: z.string().min(1),
  use: z.enum(['home', 'work', 'mobile']).optional(),
})

export const AddressSchema = z.object({
  line: z.array(z.string()).default([]),
  city: z.string().default(''),
  state: z.string().default(''),
  postalCode: z.string().default(''),
  country: z.string().default('CN'),
})

export const PixFeedSchema = z.object({
  patientId: z.string().min(1),
  assigningAuthority: z.string().min(1),
  identifiers: z.array(IdentifierSchema).min(1),
  name: NameSchema,
  birthDate: z.string().min(1),
  gender: z.enum(['M', 'F', 'O', 'U']),
  address: AddressSchema.optional(),
  telecom: TelecomSchema.optional(),
})

export type PixFeedDto = z.infer<typeof PixFeedSchema>

export const PixQuerySchema = z.object({
  patientId: z.string().min(1),
  sourceDomain: z.string().min(1),
  targetDomains: z.array(z.string().min(1)).min(1).max(20),
})

export type PixQueryDto = z.infer<typeof PixQuerySchema>

export const PdqQuerySchema = z.object({
  patientId: z.string().optional(),
  familyName: z.string().optional(),
  givenName: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(['M', 'F', 'O', 'U']).optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  assigningAuthority: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
})

export type PdqQueryDto = z.infer<typeof PdqQuerySchema>

export const PamMessageSchema = z.object({
  messageType: z.enum(['ADT^A01', 'ADT^A03', 'ADT^A04', 'ADT^A05', 'ADT^A08', 'ADT^A11', 'ADT^A13']),
  patientId: z.string().min(1),
  assigningAuthority: z.string().min(1),
  visitNumber: z.string().optional(),
  accountNumber: z.string().optional(),
  attendingDoctor: z.string().optional(),
  classCode: z.enum(['I', 'O', 'E', 'P', 'R']).optional(),
  assignedLocation: z.object({
    facility: z.string(),
    building: z.string().optional(),
    floor: z.string().optional(),
    pointOfCare: z.string().optional(),
    room: z.string().optional(),
    bed: z.string().optional(),
  }).optional(),
  admitDateTime: z.string().optional(),
  dischargeDateTime: z.string().optional(),
})

export type PamMessageDto = z.infer<typeof PamMessageSchema>

export const PamQuerySchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
  messageType: z.string().optional(),
  patientId: z.string().optional(),
})

export type PamQueryDto = z.infer<typeof PamQuerySchema>

export const AffinityDomainSchema = z.object({
  homeCommunityId: z.string(),
  name: z.string(),
  nameEn: z.string().optional(),
  repositoryUniqueIds: z.array(z.string()).default([]),
  registryUniqueId: z.string().optional(),
  assigningAuthorityId: z.string(),
  pixManagerEndpoint: z.string().optional(),
  pdqSupplierEndpoint: z.string().optional(),
  registryEndpoint: z.string().optional(),
  repositoryEndpoint: z.string().optional(),
  atnaEndpoint: z.string().optional(),
})

export type AffinityDomainDto = z.infer<typeof AffinityDomainSchema>
