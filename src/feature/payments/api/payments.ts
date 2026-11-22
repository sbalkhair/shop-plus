import { authorizationMiddleware } from "@/feature/auth/middleware"
import { prisma } from "@/lib/db"
import { createServerFn } from "@tanstack/react-start"
import { formatMinorUnits } from "../money"
import {
  attachPaymentSchema,
  createPaymentIntentSchema,
  getPaymentSessionSchema,
  verifyPaymentSchema,
} from "../schema"
import {
  createPaymentIntentForOrder,
  loadPaymentSession,
  reconcileOrderPayment,
  verifyPaymentForUser,
} from "../service"
import {
  PAYMENT_CURRENCY,
  type CreatePaymentIntentResult,
  type PaymentCurrency,
  type PaymentResult,
  type PaymentSession,
} from "../types"

/**
 * Server functions for the Moyasar card flow.
 *
 * Security invariants:
 * - Amounts and order totals always come from the database order, never from
 *   the request body.
 * - The Moyasar secret key is only ever read through `getMoyasarEnv()` on the
 *   server. It is never returned to the client or written to logs.
 * - Client secrets are returned to the browser but never persisted.
 * - Every payment is re-fetched from Moyasar with the secret key before any
 *   order state changes.
 */

/**
 * Moyasar rejects `callback_url` values that are not publicly reachable
 * domains, so local/private origins must be surfaced as a clear configuration
 * error instead of the provider's validation message.
 */
const resolveCallbackUrl = async (
  orderId: string,
  options: { requirePublic?: boolean } = {}
): Promise<string> => {
  const { getMoyasarEnv } = await import("../env")
  const env = getMoyasarEnv()

  let base = env.MOYASAR_CALLBACK_URL

  if (!base) {
    const { getRequestUrl } = await import("@tanstack/react-start/server")
    base = `${getRequestUrl({ xForwardedHost: true }).origin}/payment-result`
  }

  const url = new URL(base)

  if (options.requirePublic) {
    const { assertPublicCallbackUrl } = await import("../callback")
    assertPublicCallbackUrl(url)
  }

  url.searchParams.set("orderId", orderId)

  return url.toString()
}

/**
 * Loads the server-owned payment session for an order.
 *
 * This function is read-only: it never creates a payment row. When no active
 * attempt exists it returns a fresh UUID that the client must send back to
 * `createPaymentIntent`. Using the session-provided ref as `given_id` makes
 * the eventual Moyasar payment id deterministic.
 */
export const getPaymentSession = createServerFn({ method: "GET" })
  .middleware([authorizationMiddleware({ permissions: ["payments:create"] })])
  .validator((data: unknown) => getPaymentSessionSchema.parse(data))
  .handler(async ({ data, context }): Promise<PaymentSession> => {
    const { getMoyasarEnv } = await import("../env")

    const env = getMoyasarEnv()
    const callbackUrl = await resolveCallbackUrl(data.orderId, {
      requirePublic: true,
    })

    return loadPaymentSession({
      db: prisma,
      userId: context.user.id,
      orderId: data.orderId,
      publishableKey: env.MOYASAR_PUBLISHABLE_KEY,
      callbackUrl,
    })
  })

/**
 * Creates (or safely reuses) a Moyasar payment intent for one payment attempt.
 * Duplicate and concurrent initialization is serialized per order.
 */
export const createPaymentIntent = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["payments:create"] })])
  .validator((data: unknown) => createPaymentIntentSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreatePaymentIntentResult> => {
    const { getMoyasarClient } = await import("../moyasar")

    const client = getMoyasarClient()
    const callbackUrl = await resolveCallbackUrl(data.orderId, {
      requirePublic: true,
    })

    return createPaymentIntentForOrder({
      db: prisma,
      client,
      userId: context.user.id,
      orderId: data.orderId,
      paymentRef: data.paymentRef,
      callbackUrl,
    })
  })

/**
 * Verifies a payment the browser reports as completed and applies it to the
 * order. The browser value is only used as a lookup id; status, amount and
 * currency always come from Moyasar.
 */
export const attachPayment = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["payments:create"] })])
  .validator((data: unknown) => attachPaymentSchema.parse(data))
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const { getMoyasarClient } = await import("../moyasar")

    return verifyPaymentForUser({
      db: prisma,
      client: getMoyasarClient(),
      userId: context.user.id,
      paymentId: data.paymentId,
      expectedOrderId: data.orderId,
    })
  })

/**
 * Authoritative verification for the post-payment return page. This is safe to
 * call repeatedly: applying the same payment twice is idempotent.
 */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["payments:create"] })])
  .validator((data: unknown) => verifyPaymentSchema.parse(data))
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const { getMoyasarClient } = await import("../moyasar")

    return verifyPaymentForUser({
      db: prisma,
      client: getMoyasarClient(),
      userId: context.user.id,
      paymentId: data.paymentId,
    })
  })

/**
 * Reconciles the current attempt with Moyasar and returns the refreshed
 * session. Used by the payment page's "Refresh status" button so a delayed or
 * lost callback/webhook can still be resolved.
 */
export const refreshPayment = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["payments:create"] })])
  .validator((data: unknown) => getPaymentSessionSchema.parse(data))
  .handler(async ({ data, context }): Promise<PaymentSession> => {
    const { getMoyasarEnv } = await import("../env")
    const { getMoyasarClient } = await import("../moyasar")

    const env = getMoyasarEnv()
    const callbackUrl = await resolveCallbackUrl(data.orderId, {
      requirePublic: true,
    })

    return reconcileOrderPayment({
      db: prisma,
      client: getMoyasarClient(),
      userId: context.user.id,
      orderId: data.orderId,
      publishableKey: env.MOYASAR_PUBLISHABLE_KEY,
      callbackUrl,
    })
  })

/** Formats the server-owned amount for display/debugging without floats. */
export const describePaymentAmount = (
  amount: number,
  currency: PaymentCurrency = PAYMENT_CURRENCY
): string => formatMinorUnits(amount, currency)
