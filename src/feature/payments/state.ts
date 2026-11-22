import type { PaymentStatus } from "./types"

/**
 * Pure payment state machine.
 *
 * Moyasar's status is never used directly as an internal status and is never
 * trusted on its own. `decidePaymentOutcome` translates a server-verified
 * provider status into our own state plus the order transition that must
 * happen. Keeping this pure makes the critical transitions testable without a
 * database.
 */

export type OrderOutcome =
  "none" | "mark_paid" | "mark_refunded" | "mark_voided"

export interface PaymentDecision {
  status: PaymentStatus
  orderOutcome: OrderOutcome
  /**
   * Terminal attempts release the "active payment per order" slot so the
   * customer can start a fresh attempt (e.g. after a decline).
   */
  isFinal: boolean
}

interface ProviderPaymentSummary {
  status: string
  amount: number
  refunded?: number
}

export const decidePaymentOutcome = (
  payment: ProviderPaymentSummary,
  options: { orderIsPaid: boolean }
): PaymentDecision => {
  switch (payment.status) {
    case "paid":
    case "captured":
      return {
        status: "paid",
        // Never fulfil the order twice, even if a duplicate callback/webhook
        // races with the first successful one.
        orderOutcome: options.orderIsPaid ? "none" : "mark_paid",
        isFinal: true,
      }

    case "authorized":
      // Funds reserved but not captured. Not a completed payment.
      return { status: "authorized", orderOutcome: "none", isFinal: false }

    case "initiated":
      // 3D Secure challenge pending (or another redirect flow).
      return { status: "processing", orderOutcome: "none", isFinal: false }

    case "verified":
      // Card verification only. Never treat this as a completed charge.
      return { status: "processing", orderOutcome: "none", isFinal: false }

    case "failed":
      return { status: "failed", orderOutcome: "none", isFinal: true }

    case "refunded": {
      const fullyRefunded = (payment.refunded ?? 0) >= payment.amount

      return {
        status: "refunded",
        orderOutcome: fullyRefunded ? "mark_refunded" : "none",
        isFinal: true,
      }
    }

    case "voided":
      return { status: "voided", orderOutcome: "mark_voided", isFinal: true }

    case "expired":
      return { status: "expired", orderOutcome: "none", isFinal: true }

    default:
      // Unknown provider statuses are treated as non-paid and non-terminal.
      // The payment can still be resolved by a later event.
      return { status: "processing", orderOutcome: "none", isFinal: false }
  }
}

interface SanitizedProviderPayment {
  providerStatus: string
  method: string | null
  network: string | null
  lastFour: string | null
  failureMessage: string | null
}

const truncate = (value: string | undefined, max: number): string | null => {
  if (!value) {
    return null
  }

  return value.length > max ? value.slice(0, max) : value
}

/**
 * Extracts the last four digits from Moyasar's masked card number
 * (e.g. `411111******1111`). The full masked value is never persisted.
 */
export const lastFourFromMaskedNumber = (
  value: string | undefined
): string | null => {
  if (!value) {
    return null
  }

  const digits = value.replace(/\D/g, "")

  return digits.length >= 4 ? digits.slice(-4) : null
}

export const sanitizeProviderPayment = (payment: {
  status: string
  source?: {
    type?: string
    company?: string
    number?: string
    message?: string
  } | null
}): SanitizedProviderPayment => ({
  providerStatus: payment.status,
  method: payment.source?.type ?? null,
  network: payment.source?.company ?? null,
  lastFour: lastFourFromMaskedNumber(payment.source?.number),
  failureMessage: truncate(payment.source?.message, 500),
})
