import type { PaymentSessionState } from "./types"

/**
 * Card payments are only allowed for unpaid card orders that are still waiting
 * for payment. This is the single source of truth used by the payment session,
 * intent creation, and the read-only payment page.
 */

export const CARD_PAYMENT_METHOD = "card"
export const PAYABLE_ORDER_STATUS = "Pending Payment"

export type PaymentEligibility =
  | { payable: true }
  | {
      payable: false
      reason: "not_card" | "already_paid" | "terminal" | "not_pending"
      state: Extract<PaymentSessionState, "paid" | "unavailable">
      message: string
    }

interface OrderEligibilityInput {
  paymentMethod: string
  isPaid: boolean | null
  status: string
}

export const evaluatePaymentEligibility = (
  order: OrderEligibilityInput
): PaymentEligibility => {
  if (order.paymentMethod !== CARD_PAYMENT_METHOD) {
    return {
      payable: false,
      reason: "not_card",
      state: "unavailable",
      message: "This order is not a card-payment order.",
    }
  }

  if (order.isPaid) {
    return {
      payable: false,
      reason: "already_paid",
      state: "paid",
      message: "This order has already been paid.",
    }
  }

  if (order.status === PAYABLE_ORDER_STATUS) {
    return { payable: true }
  }

  switch (order.status) {
    case "Canceled":
      return {
        payable: false,
        reason: "terminal",
        state: "unavailable",
        message:
          "This order was canceled. If a payment was taken, please contact support.",
      }
    case "Refunded":
      return {
        payable: false,
        reason: "terminal",
        state: "unavailable",
        message: "This order was refunded and can no longer be paid.",
      }
    case "Voided":
      return {
        payable: false,
        reason: "terminal",
        state: "unavailable",
        message: "This order was voided and can no longer be paid.",
      }
    case "Delivered":
      return {
        payable: false,
        reason: "terminal",
        state: "unavailable",
        message: "This order was already delivered.",
      }
    default:
      return {
        payable: false,
        reason: "not_pending",
        state: "unavailable",
        message: "This order is no longer awaiting payment.",
      }
  }
}

/** Attempts in these states can no longer be charged. */
const TERMINAL_ATTEMPT_STATUSES = new Set([
  "failed",
  "canceled",
  "expired",
  "refunded",
  "voided",
  "superseded",
])

export const isTerminalAttemptStatus = (status: string): boolean =>
  TERMINAL_ATTEMPT_STATUSES.has(status)

interface ActiveAttempt {
  status: string
}

/**
 * Maps the current attempt to the page state. `intent_created` stays payable so
 * the customer can resume the same attempt reference instead of creating a
 * second chargeable intent.
 */
export const resolveActiveAttemptState = (
  active: ActiveAttempt | null
): Extract<
  PaymentSessionState,
  "payable" | "processing" | "authorized" | "paid"
> => {
  if (active === null || isTerminalAttemptStatus(active.status)) {
    return "payable"
  }

  switch (active.status) {
    case "paid":
      return "paid"
    case "authorized":
      return "authorized"
    case "intent_created":
      return "payable"
    default:
      return "processing"
  }
}
