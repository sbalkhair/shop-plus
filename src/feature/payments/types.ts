/**
 * Shared payment types.
 *
 * This module is intentionally free of server-only imports so it can be used by
 * both the server functions and the client components.
 */

import type { OrderItemView } from "@/feature/orders/types"
import { CURRENCY } from "@/lib/pricing"

const PAYMENT_STATUSES = [
  "pending",
  "creating",
  "intent_created",
  "processing",
  "authorized",
  "paid",
  "failed",
  "canceled",
  "expired",
  "refunded",
  "voided",
  "superseded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_CURRENCY = CURRENCY

export type PaymentCurrency = typeof PAYMENT_CURRENCY

/** Moyasar requires at least 100 minor units (1.00 SAR). */
export const MIN_PAYMENT_AMOUNT = 100

export interface PaymentOrderSummary {
  orderId: string
  orderNumber: string
  subtotal: number
  tax: number
  deliveryFee: number
  total: number
  currency: PaymentCurrency
  items: OrderItemView[]
}

export type PaymentSessionState =
  "payable" | "processing" | "authorized" | "paid" | "unavailable"

export interface PaymentSession {
  state: PaymentSessionState
  /** Why the order cannot be paid right now. Null when it can be paid. */
  stateMessage: string | null
  order: PaymentOrderSummary
  /** Amount in the smallest currency unit (halalas). */
  amount: number
  currency: PaymentCurrency
  /**
   * Server-generated UUID for the current attempt. It is also sent to Moyasar
   * as `given_id`, so the resulting payment id is deterministic.
   */
  paymentRef: string | null
  /** Moyasar payment id, present when a payment was already submitted. */
  paymentId: string | null
  publishableKey: string
  callbackUrl: string
  description: string
}

export type PaymentResultStatus =
  | "paid"
  | "failed"
  | "pending"
  | "authorized"
  | "refunded"
  | "voided"
  | "expired"
  | "invalid"
  | "canceled"
  | "error"

export interface PaymentResult {
  status: PaymentResultStatus
  orderId: string | null
  orderNumber: string | null
  /** Amount in the smallest currency unit (halalas). */
  amount: number | null
  currency: PaymentCurrency
  message: string | null
  paymentId: string | null
  /** Current order status, so success is never shown for a canceled order. */
  orderStatus: string | null
  /** True only when the server actually fulfilled this order. */
  orderIsPaid: boolean
}

/**
 * Result of asking the server to create (or reuse) a payment intent.
 *
 * Expected states are returned instead of thrown so the form can stop and the
 * page can redirect without parsing error strings.
 */
export type CreatePaymentIntentResult =
  | {
      ok: true
      orderId: string
      intentId: string
      /** Single-use credential for this intent. Never stored server-side. */
      clientSecret: string
      /** Amount in the smallest currency unit (halalas). */
      amount: number
      currency: PaymentCurrency
    }
  | {
      ok: false
      reason:
        | "payment_already_submitted"
        | "already_paid"
        | "payment_busy"
        | "payment_processing"
        | "not_payable"
      orderId: string
      /** Moyasar payment id for this attempt, when known. */
      paymentId: string | null
      message: string
    }
