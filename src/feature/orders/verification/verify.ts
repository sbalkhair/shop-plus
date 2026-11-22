import type { Prisma } from "@/generated/prisma/client"
import { statusHistorySchema } from "../schema"
import { deliveryOtpMatches } from "./crypto"
import { getDeliveryOtpEnv } from "./env"
import { deliveryVerificationStatus } from "./service"

export interface VerifyDeliveryInput {
  orderId: string
  code: string
  /** `DeliveryPartner.id`, not the Better Auth user id. */
  driverPartnerId: string
  /** Injected for deterministic tests. */
  now?: Date
  maxAttempts?: number
}

export type VerifyDeliveryResult =
  { ok: true; verifiedAt: Date } | { ok: false; message: string }

const fail = (message: string): VerifyDeliveryResult => ({
  ok: false,
  message,
})

const deliveryLockKey = (orderId: string) => `delivery:${orderId}`

/**
 * Transaction body for a driver hand-off confirmation.
 *
 * The caller must run this inside an interactive Prisma transaction. The
 * advisory lock serializes attempts for one order, the verification claim is
 * conditional, and the order transition is conditional on `Out for Delivery`.
 * Failed attempts are committed because the function returns a failure result
 * instead of throwing.
 */
export const verifyDeliveryInTransaction = async (
  tx: Prisma.TransactionClient,
  {
    orderId,
    code,
    driverPartnerId,
    now = new Date(),
    maxAttempts = getDeliveryOtpEnv().DELIVERY_OTP_MAX_ATTEMPTS,
  }: VerifyDeliveryInput
): Promise<VerifyDeliveryResult> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deliveryLockKey(orderId)}))`

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { deliveryVerification: true },
  })

  if (!order) {
    return fail("Order not found.")
  }

  if (order.deliveryPartnerId !== driverPartnerId) {
    return fail("You are not assigned to this delivery.")
  }

  if (order.status === "Delivered") {
    return fail("This order has already been delivered.")
  }

  if (order.status !== "Out for Delivery") {
    return fail("This order is not out for delivery.")
  }

  const verification = order.deliveryVerification

  if (!verification) {
    return fail(
      "No delivery verification code is available for this order. Ask the store to issue a new one."
    )
  }

  const status = deliveryVerificationStatus(verification, now)

  if (status === "verified") {
    return fail("This delivery has already been confirmed.")
  }

  if (status === "expired") {
    return fail(
      "This delivery verification code has expired. Ask the store to issue a new one."
    )
  }

  if (status === "locked") {
    return fail(
      "Too many incorrect attempts. Ask the store to issue a new code."
    )
  }

  if (!deliveryOtpMatches(code, verification.codeHash)) {
    const updated = await tx.deliveryVerification.update({
      where: { orderId: order.id },
      data: { attempts: { increment: 1 }, lastAttemptAt: now },
      select: { attempts: true },
    })
    const remaining = Math.max(0, maxAttempts - updated.attempts)

    if (remaining === 0) {
      return fail(
        "Too many incorrect attempts. Ask the store to issue a new code."
      )
    }

    return fail(
      `Incorrect delivery verification code. ${remaining} ${
        remaining === 1 ? "attempt" : "attempts"
      } remaining.`
    )
  }

  const claimed = await tx.deliveryVerification.updateMany({
    where: {
      orderId: order.id,
      verifiedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: maxAttempts },
    },
    data: {
      verifiedAt: now,
      verifiedByDeliveryPartnerId: driverPartnerId,
      lastAttemptAt: now,
    },
  })

  if (claimed.count !== 1) {
    return fail(
      "This delivery verification code can no longer be used. Ask the store to issue a new one."
    )
  }

  const history = statusHistorySchema.safeParse(order.statusHistory)
  const currentHistory = history.success ? history.data : []
  const markCashPaid = order.paymentMethod === "cash" && !order.isPaid

  const nextHistory = [
    ...currentHistory,
    {
      status: "Delivered",
      timestamp: now.toISOString(),
      note: markCashPaid
        ? "Delivered and cash collected"
        : "Delivered after verification code confirmed",
    },
  ]

  // Kept conditional as a second guard. If it ever fails, throwing rolls the
  // whole transaction back, including the claim above.
  const updatedOrder = await tx.order.updateMany({
    where: { id: order.id, status: "Out for Delivery" },
    data: {
      status: "Delivered",
      statusHistory: nextHistory,
      ...(markCashPaid ? { isPaid: true, paidAt: now } : {}),
    },
  })

  if (updatedOrder.count !== 1) {
    throw new Error(
      "This order changed while verifying the delivery. Refresh and try again."
    )
  }

  return { ok: true, verifiedAt: now }
}
