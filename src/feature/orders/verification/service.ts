import type { Prisma } from "@/generated/prisma/client"
import type { DeliveryVerificationView } from "../types"
import {
  decryptDeliveryOtp,
  encryptDeliveryOtp,
  generateDeliveryOtp,
  hashDeliveryOtp,
} from "./crypto"
import { getDeliveryOtpEnv } from "./env"

export interface DeliveryVerificationRow {
  codeEncrypted: string
  expiresAt: Date
  verifiedAt: Date | null
  attempts: number
}

export const DELIVERY_OTP_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
} as const

/**
 * Creates a fresh code for an order, replacing any previous one. Regenerating
 * resets attempts and clears the previous confirmation so there is always at
 * most one active verification per order.
 */
export const issueDeliveryVerification = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  now = new Date()
) => {
  const env = getDeliveryOtpEnv()
  const code = generateDeliveryOtp()
  const data = {
    codeHash: hashDeliveryOtp(code),
    codeEncrypted: encryptDeliveryOtp(code),
    expiresAt: new Date(now.getTime() + env.DELIVERY_OTP_TTL_MINUTES * 60_000),
    verifiedAt: null,
    attempts: 0,
    lastAttemptAt: null,
    verifiedByDeliveryPartnerId: null,
  }

  return tx.deliveryVerification.upsert({
    where: { orderId },
    create: { orderId, ...data },
    update: data,
  })
}

/**
 * Removes the verification when an order leaves the delivery stage. A canceled
 * order must not keep a usable code around.
 */
export const invalidateDeliveryVerification = async (
  tx: Prisma.TransactionClient,
  orderId: string
) => {
  await tx.deliveryVerification.deleteMany({ where: { orderId } })
}

export const deliveryVerificationStatus = (
  verification: DeliveryVerificationRow,
  now = new Date()
): DeliveryVerificationView["status"] => {
  if (verification.verifiedAt) {
    return "verified"
  }

  if (verification.expiresAt.getTime() <= now.getTime()) {
    return "expired"
  }

  if (verification.attempts >= getDeliveryOtpEnv().DELIVERY_OTP_MAX_ATTEMPTS) {
    return "locked"
  }

  return "awaiting"
}

/**
 * Maps a verification row to the client-safe shape. `revealCode` must only be
 * true for the order owner; admins and drivers never receive the code.
 */
export const toDeliveryVerificationView = (
  verification: DeliveryVerificationRow | null,
  { revealCode }: { revealCode: boolean },
  now = new Date()
): DeliveryVerificationView | null => {
  if (!verification) {
    return null
  }

  const status = deliveryVerificationStatus(verification, now)
  let code: string | null = null

  if (revealCode && status === "awaiting") {
    try {
      code = decryptDeliveryOtp(verification.codeEncrypted)
    } catch {
      // A malformed or rotated payload should hide the code, not break the
      // tracking page. The customer can ask an admin to regenerate it.
      code = null
    }
  }

  return {
    status,
    expiresAt: verification.expiresAt.toISOString(),
    verifiedAt: verification.verifiedAt?.toISOString() ?? null,
    attemptsRemaining: Math.max(
      0,
      getDeliveryOtpEnv().DELIVERY_OTP_MAX_ATTEMPTS - verification.attempts
    ),
    code,
  }
}
