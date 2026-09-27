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

// ── v3.0.6.13 XDS.b / XCA / XDR DTO ──────────────────────────────────────────

export const XdsDocumentSchema = z.object({
  uniqueId: z.string().optional(),
  title: z.string().optional(),
  mimeType: z.string().optional(),
  classCode: z.string().optional(),
  classDisplayName: z.string().optional(),
  formatCode: z.string().optional(),
  formatDisplayName: z.string().optional(),
  typeCode: z.string().optional(),
  typeDisplayName: z.string().optional(),
  languageCode: z.string().optional(),
  practiceSettingCode: z.string().optional(),
  healthcareFacilityTypeCode: z.string().optional(),
  creationTime: z.string().optional(),
  serviceStartTime: z.string().optional(),
  serviceStopTime: z.string().optional(),
  authorInstitution: z.string().optional(),
  authorPerson: z.string().optional(),
  content: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
})

export type XdsDocumentDto = z.infer<typeof XdsDocumentSchema>

export const XdsProvideSchema = z.object({
  patientId: z.string().min(1),
  repositoryUniqueId: z.string().optional(),
  homeCommunityId: z.string().optional(),
  sourcePatientId: z.string().optional(),
  sourcePatientInfo: z.string().optional(),
  submissionSetStatus: z.enum(['Original', 'Approved', 'Deprecated']).optional(),
  documents: z.array(XdsDocumentSchema).min(1).max(200),
})

export type XdsProvideDto = z.infer<typeof XdsProvideSchema>

export const XdsRetrieveSchema = z.object({
  homeCommunityId: z.string().optional(),
  documents: z.array(z.object({
    repositoryUniqueId: z.string().min(1),
    documentUniqueId: z.string().min(1),
  })).min(1).max(200),
})

export type XdsRetrieveDto = z.infer<typeof XdsRetrieveSchema>

export const XdsQuerySchema = z.object({
  patientId: z.string().optional(),
  classCode: z.string().optional(),
  formatCode: z.string().optional(),
  typeCode: z.string().optional(),
  creationTimeFrom: z.string().optional(),
  creationTimeTo: z.string().optional(),
  status: z.enum(['APPROVED', 'DEPRECATED', 'ALL']).optional(),
  homeCommunityId: z.string().optional(),
  authorPerson: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
})

export type XdsQueryDto = z.infer<typeof XdsQuerySchema>

export const XcaQuerySchema = XdsQuerySchema.extend({
  homeCommunityId: z.string().min(1),
})

export type XcaQueryDto = z.infer<typeof XcaQuerySchema>

export const XcaRetrieveSchema = XdsRetrieveSchema.extend({
  homeCommunityId: z.string().min(1),
})

export type XcaRetrieveDto = z.infer<typeof XcaRetrieveSchema>

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
