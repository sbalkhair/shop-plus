import { z } from "zod"

/**
 * Input schemas for the payment server functions.
 *
 * All identifiers are validated here before they reach the database or the
 * Moyasar API. The client never supplies amounts or order totals.
 */

/**
 * Payment attempt ids double as the Moyasar form's `given_id`, which the
 * official form validates as a UUID v4. Enforce the same format server-side so
 * an attempt can never be created with an unusable id.
 */
export const paymentAttemptRefSchema = z
  .uuid()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "must be a UUID v4"
  )

export const getPaymentSessionSchema = z.object({
  orderId: z.uuid(),
})

export const createPaymentIntentSchema = z.object({
  orderId: z.uuid(),
  paymentRef: paymentAttemptRefSchema,
})

export const attachPaymentSchema = z.object({
  orderId: z.uuid(),
  paymentId: z.string().trim().min(1).max(200),
})

export const verifyPaymentSchema = z.object({
  paymentId: z.string().trim().min(1).max(200),
})

/** Minimal shape of a Moyasar webhook envelope. */
export const moyasarWebhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created_at: z.string().optional(),
  secret_token: z.string().min(1),
  account_name: z.string().optional(),
  live: z.boolean().optional().default(false),
  data: z
    .object({
      id: z.string().min(1),
      status: z.string().optional(),
      amount: z.number().int().optional(),
      currency: z.string().optional(),
    })
    .passthrough(),
})

export type MoyasarWebhookPayload = z.infer<typeof moyasarWebhookSchema>
