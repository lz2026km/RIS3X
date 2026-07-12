import { z } from 'zod'

export const CreateChargeItemSchema = z.object({
  patientId: z.string().min(1),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  amount: z.number().positive(),
  quantity: z.number().int().positive().default(1),
})

export const UpdateChargeItemSchema = z.object({
  itemCode: z.string().min(1).optional(),
  itemName: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
})

export const CreateInvoiceSchema = z.object({
  patientId: z.string().min(1),
  chargeItemIds: z.array(z.string().min(1)).min(1),
  discount: z.number().min(0).optional(),
})

export const PayInvoiceSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'INSURANCE', 'ALIPAY', 'WECHAT']),
  amount: z.number().positive(),
  transactionId: z.string().optional(),
})
