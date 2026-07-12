import { z } from 'zod'

export const CreatePatientSchema = z.object({
  resourceType: z.literal('Patient'),
  name: z.array(z.object({ use: z.string().optional(), family: z.string(), given: z.array(z.string()) })).min(1),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  identifier: z.array(z.object({ system: z.string(), value: z.string() })).optional(),
  telecom: z.array(z.object({ system: z.enum(['phone', 'email']), value: z.string() })).optional(),
  address: z.array(z.object({ line: z.array(z.string()).optional(), city: z.string().optional(), country: z.string().optional() })).optional(),
})

export const UpdatePatientSchema = z.object({
  name: z.array(z.object({ use: z.string().optional(), family: z.string(), given: z.array(z.string()) })).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  identifier: z.array(z.object({ system: z.string(), value: z.string() })).optional(),
  telecom: z.array(z.object({ system: z.enum(['phone', 'email']), value: z.string() })).optional(),
  address: z.array(z.object({ line: z.array(z.string()).optional(), city: z.string().optional(), country: z.string().optional() })).optional(),
})

export const CreateSubscriptionSchema = z.object({
  resourceType: z.literal('Subscription'),
  status: z.enum(['requested', 'active', 'error', 'off']),
  channel: z.object({ type: z.enum(['rest-hook', 'websocket', 'email']), endpoint: z.string().url() }),
  criteria: z.string().min(1),
  reason: z.string().min(1),
})
