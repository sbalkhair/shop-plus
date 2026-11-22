import type { Order, Prisma, PrismaClient } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { CARD_PAYMENT_METHOD, PAYABLE_ORDER_STATUS } from "./eligibility"
import { toMinorUnits } from "./money"
import type { MoyasarPayment } from "./moyasar"
import { parsePaymentReference } from "./reference"
import { decidePaymentOutcome, sanitizeProviderPayment } from "./state"
import { PAYMENT_CURRENCY, type PaymentStatus } from "./types"

/**
 * Applies a payment that was fetched directly from Moyasar with the secret key.
 * Callback, `on_completed`, and webhook flows all funnel through this function,
 * so they cannot disagree or fulfil an order twice.
 */

export class PaymentVerificationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "PaymentVerificationError"
    this.code = code
  }
}

export interface ApplyVerifiedPaymentInput {
  providerPayment: MoyasarPayment
  /** When set, the order must belong to this user. */
  userId?: string
}

export interface ApplyVerifiedPaymentResult {
  paymentId: string
  orderId: string
  status: PaymentStatus
  orderIsPaid: boolean
  /** Order status after applying the payment, for accurate result messaging. */
  orderStatus: string
  duplicate: boolean
}

interface StatusHistoryEntry {
  status: string
  timestamp: string
  note: string
}

const MAX_TRANSACTION_ATTEMPTS = 3

const expectedOrderMinorAmount = (order: Pick<Order, "total">): number =>
  toMinorUnits(order.total)

const isStatusHistoryEntry = (value: unknown): value is StatusHistoryEntry => {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.status === "string" &&
    typeof record.timestamp === "string" &&
    typeof record.note === "string"
  )
}

const appendHistory = (
  current: unknown,
  entry: StatusHistoryEntry
): StatusHistoryEntry[] => {
  const history = Array.isArray(current)
    ? current.filter(isStatusHistoryEntry)
    : []

  return [...history, entry]
}

const isSerializationFailure = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false
  }

  return (error as { code?: unknown }).code === "P2034"
}

export const applyVerifiedPayment = async (
  { providerPayment, userId }: ApplyVerifiedPaymentInput,
  db: PrismaClient = prisma
): Promise<ApplyVerifiedPaymentResult> => {
  const reference = parsePaymentReference(providerPayment.description)

  if (!reference) {
    throw new PaymentVerificationError(
      "invalid_reference",
      "This payment is not associated with a shop-plus order."
    )
  }

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: reference.paymentId },
          })

          if (!payment) {
            throw new PaymentVerificationError(
              "unknown_payment",
              "This payment is not associated with a shop-plus order."
            )
          }

          if (payment.orderId !== reference.orderId) {
            throw new PaymentVerificationError(
              "order_mismatch",
              "This payment does not belong to the expected order."
            )
          }

          const providerCurrency = providerPayment.currency.toUpperCase()

          if (
            providerPayment.amount !== payment.amount ||
            providerCurrency !== payment.currency.toUpperCase() ||
            providerCurrency !== PAYMENT_CURRENCY
          ) {
            throw new PaymentVerificationError(
              providerPayment.amount !== payment.amount
                ? "amount_mismatch"
                : "currency_mismatch",
              providerPayment.amount !== payment.amount
                ? "The paid amount does not match the payment attempt."
                : "The paid currency does not match the order currency."
            )
          }

          if (
            payment.moyasarPaymentId !== null &&
            payment.moyasarPaymentId !== providerPayment.id
          ) {
            throw new PaymentVerificationError(
              "payment_mismatch",
              "This payment does not match the expected payment attempt."
            )
          }

          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
          })

          if (!order) {
            throw new PaymentVerificationError(
              "unknown_order",
              "The order for this payment no longer exists."
            )
          }

          if (userId && order.userId !== userId) {
            throw new PaymentVerificationError(
              "forbidden",
              "You do not have access to this payment."
            )
          }

          if (order.paymentMethod !== CARD_PAYMENT_METHOD) {
            throw new PaymentVerificationError(
              "not_card_order",
              "This payment is not for a card order."
            )
          }

          // The intent locks an amount, but the order remains the source of
          // truth. Re-check it here so a stale attempt can never satisfy a
          // changed order.
          if (
            payment.amount !== expectedOrderMinorAmount(order) ||
            providerPayment.amount !== expectedOrderMinorAmount(order)
          ) {
            throw new PaymentVerificationError(
              "amount_mismatch",
              "The paid amount does not match the current order total."
            )
          }

          const alreadyPaid = Boolean(order.isPaid)
          const wasPaidAttempt = payment.status === "paid"
          const sanitized = sanitizeProviderPayment(providerPayment)
          const now = new Date()
          const decision = decidePaymentOutcome(providerPayment, {
            orderIsPaid: alreadyPaid,
          })

          const duplicate =
            decision.status === "paid" && alreadyPaid && !wasPaidAttempt

          const paymentData: Prisma.PaymentUpdateInput = {
            moyasarPaymentId: providerPayment.id,
            providerStatus: sanitized.providerStatus,
            status: decision.status,
            method: sanitized.method,
            network: sanitized.network,
            lastFour: sanitized.lastFour,
            failureMessage: sanitized.failureMessage,
            // Release the per-order active slot once the attempt is terminal.
            activeOrderId: decision.isFinal ? null : payment.activeOrderId,
            ...(decision.status === "paid"
              ? { paidAt: payment.paidAt ?? now }
              : {}),
            ...(decision.status === "refunded"
              ? { refundedAt: payment.refundedAt ?? now }
              : {}),
            ...(decision.status === "voided"
              ? { voidedAt: payment.voidedAt ?? now }
              : {}),
            // Only an internal marker is stored; no raw provider payload.
            ...(duplicate ? { metadata: { duplicateOfOrder: order.id } } : {}),
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: paymentData,
          })

          let orderOutcome = decision.orderOutcome

          // A refund/void for an older attempt must not reverse an order that
          // was later paid by a different attempt.
          const reversesOrder =
            orderOutcome === "mark_refunded" || orderOutcome === "mark_voided"

          if (reversesOrder) {
            const otherPaidPayment = await tx.payment.findFirst({
              where: {
                orderId: order.id,
                id: { not: payment.id },
                status: "paid",
              },
              select: { id: true },
            })

            if (otherPaidPayment) {
              orderOutcome = "none"
            }
          }

          // Guard each order transition so a replayed event cannot append a
          // duplicate history entry or flip the order twice. Fulfilment only
          // happens from "Pending Payment"; a late event must never resurrect
          // a canceled, refunded, voided, or already processed order.
          if (
            orderOutcome === "mark_paid" &&
            (alreadyPaid || order.status !== PAYABLE_ORDER_STATUS)
          ) {
            orderOutcome = "none"
          }

          if (
            orderOutcome === "mark_refunded" &&
            order.status === "Refunded" &&
            !alreadyPaid
          ) {
            orderOutcome = "none"
          }

          if (
            orderOutcome === "mark_voided" &&
            order.status === "Voided" &&
            !alreadyPaid
          ) {
            orderOutcome = "none"
          }

          if (orderOutcome === "mark_paid") {
            await tx.order.update({
              where: { id: order.id },
              data: {
                isPaid: true,
                paidAt: order.paidAt ?? now,
                status: "Placed",
                statusHistory: appendHistory(order.statusHistory, {
                  status: "Placed",
                  timestamp: now.toISOString(),
                  note: "Payment received",
                }) as unknown as Prisma.InputJsonValue,
              },
            })
          } else if (orderOutcome === "mark_refunded") {
            await tx.order.update({
              where: { id: order.id },
              data: {
                isPaid: false,
                status: "Refunded",
                statusHistory: appendHistory(order.statusHistory, {
                  status: "Refunded",
                  timestamp: now.toISOString(),
                  note: "Payment refunded",
                }) as unknown as Prisma.InputJsonValue,
              },
            })
          } else if (orderOutcome === "mark_voided") {
            await tx.order.update({
              where: { id: order.id },
              data: {
                isPaid: false,
                status: "Voided",
                statusHistory: appendHistory(order.statusHistory, {
                  status: "Voided",
                  timestamp: now.toISOString(),
                  note: "Payment voided",
                }) as unknown as Prisma.InputJsonValue,
              },
            })
          }

          const orderIsPaid =
            orderOutcome === "mark_refunded" || orderOutcome === "mark_voided"
              ? false
              : orderOutcome === "mark_paid"
                ? true
                : alreadyPaid

          const orderStatus =
            orderOutcome === "mark_paid"
              ? "Placed"
              : orderOutcome === "mark_refunded"
                ? "Refunded"
                : orderOutcome === "mark_voided"
                  ? "Voided"
                  : order.status

          return {
            paymentId: payment.id,
            orderId: order.id,
            status: decision.status,
            orderIsPaid,
            orderStatus,
            duplicate,
          }
        },
        { isolationLevel: "Serializable" }
      )
    } catch (error) {
      if (
        isSerializationFailure(error) &&
        attempt < MAX_TRANSACTION_ATTEMPTS - 1
      ) {
        continue
      }

      throw error
    }
  }

  throw new Error("Could not apply the payment. Please try again.")
}
