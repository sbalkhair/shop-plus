import { z } from "zod"

/**
 * Delivery OTP configuration.
 *
 * Validation is lazy so that routes that never touch delivery verification can
 * still boot when the secret has not been configured yet. Every OTP entry point
 * calls `getDeliveryOtpEnv()`, which fails closed with a clear message.
 */
const deliveryOtpEnvSchema = z.object({
  DELIVERY_OTP_SECRET: z
    .string()
    .trim()
    .min(32, "DELIVERY_OTP_SECRET must be at least 32 characters"),
  DELIVERY_OTP_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .default(60),
  DELIVERY_OTP_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .max(20)
    .default(5),
})

export type DeliveryOtpEnv = z.infer<typeof deliveryOtpEnvSchema>

let cachedEnv: DeliveryOtpEnv | null = null

export const getDeliveryOtpEnv = (): DeliveryOtpEnv => {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = deliveryOtpEnvSchema.safeParse({
    DELIVERY_OTP_SECRET: process.env.DELIVERY_OTP_SECRET,
    DELIVERY_OTP_TTL_MINUTES: process.env.DELIVERY_OTP_TTL_MINUTES,
    DELIVERY_OTP_MAX_ATTEMPTS: process.env.DELIVERY_OTP_MAX_ATTEMPTS,
  })

  if (!parsed.success) {
    throw new Error(
      "Delivery OTP is not configured. Set DELIVERY_OTP_SECRET (min 32 characters) in the server environment."
    )
  }

  cachedEnv = parsed.data

  return cachedEnv
}

/** Test-only hook so environment changes are picked up between tests. */
export const resetDeliveryOtpEnvForTests = (): void => {
  cachedEnv = null
}
