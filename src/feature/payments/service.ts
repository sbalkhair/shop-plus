import type { Order, Payment, PrismaClient } from "@/generated/prisma/client"
import { orderItemsSchema } from "@/feature/orders/schema"
import type { OrderItemView } from "@/feature/orders/types"
import { PaymentVerificationError, applyVerifiedPayment } from "./apply"
import {
  evaluatePaymentEligibility,
  isTerminalAttemptStatus,
  resolveActiveAttemptState,
} from "./eligibility"
import { assertChargeableMinorAmount, toMinorUnits } from "./money"
import {
  MoyasarApiError,
  type MoyasarClient,
  type MoyasarPayment,
} from "./moyasar"
import { buildPaymentReference, parsePaymentReference } from "./reference"
import {
  PAYMENT_CURRENCY,
  type CreatePaymentIntentResult,
  type PaymentCurrency,
  type PaymentOrderSummary,
  type PaymentResult,
  type PaymentResultStatus,
  type PaymentSession,
  type PaymentSessionState,
} from "./types"

/**
 * Payment orchestration shared by the server functions.
 *
 * Every function takes its database and Moyasar client explicitly so the
 * critical flows can be tested with an in-memory database and a mocked
 * provider. No amount, currency, or ownership value is ever read from the
 * client.
 */

const ORDER_NUMBER_LENGTH = 8

/** Attempt states that may still resolve and therefore still matter. */
const IN_FLIGHT_ATTEMPT_STATUSES = new Set([
  "creating",
  "intent_created",
  "processing",
  "authorized",
])

const orderNumber = (orderId: string): string =>
  orderId.slice(0, ORDER_NUMBER_LENGTH).toUpperCase()

const toOrderSummary = (order: Order): PaymentOrderSummary => {
  const items: OrderItemView[] = orderItemsSchema.parse(order.items)

  return {
    orderId: order.id,
    orderNumber: orderNumber(order.id),
    subtotal: order.subtotal,
    tax: order.tax ?? 0,
    deliveryFee: order.deliveryFee ?? 0,
    total: order.total,
    currency: PAYMENT_CURRENCY,
    items,
  }
}

const toResultStatus = (status: string): PaymentResultStatus => {
  switch (status) {
    case "paid":
      return "paid"
    case "authorized":
      return "authorized"
    case "failed":
      return "failed"
    case "refunded":
      return "refunded"
    case "voided":
      return "voided"
    case "expired":
      return "expired"
    case "canceled":
      return "canceled"
    default:
      return "pending"
  }
}

export const invalidPaymentResult = (message: string): PaymentResult => ({
  status: "invalid",
  orderId: null,
  orderNumber: null,
  amount: null,
  currency: PAYMENT_CURRENCY,
  message,
  paymentId: null,
  orderStatus: null,
  orderIsPaid: false,
})

interface SessionInput {
  db: PrismaClient
  userId: string
  orderId: string
  publishableKey: string
  callbackUrl: string
}

/**
 * Loads the server-owned session for an order. This is read-only: it never
 * creates a payment row and never calls the provider.
 */
export const loadPaymentSession = async ({
  db,
  userId,
  orderId,
  publishableKey,
  callbackUrl,
}: SessionInput): Promise<PaymentSession> => {
  const order = await db.order.findUnique({ where: { id: orderId } })

  if (!order || order.userId !== userId) {
    throw new Error("Order not found.")
  }

  const active = await db.payment.findUnique({
    where: { activeOrderId: order.id },
  })
  const eligibility = evaluatePaymentEligibility(order)

  const state: PaymentSessionState = eligibility.payable
    ? resolveActiveAttemptState(active)
    : eligibility.state

  const canReuseActive =
    eligibility.payable &&
    active !== null &&
    !isTerminalAttemptStatus(active.status)

  const paymentRef =
    state === "paid" || state === "unavailable"
      ? null
      : canReuseActive
        ? active.id
        : state === "payable"
          ? globalThis.crypto.randomUUID()
          : null

  const minorTotal = toMinorUnits(order.total)
  const amount =
    state === "payable" ? assertChargeableMinorAmount(minorTotal) : minorTotal

  return {
    state,
    stateMessage: eligibility.payable ? null : eligibility.message,
    order: toOrderSummary(order),
    amount,
    currency: PAYMENT_CURRENCY,
    paymentRef,
    paymentId: active?.moyasarPaymentId ?? null,
    publishableKey,
    callbackUrl,
    description: paymentRef
      ? buildPaymentReference({ orderId: order.id, paymentId: paymentRef })
      : "",
  }
}

interface CreateIntentInput {
  db: PrismaClient
  client: MoyasarClient
  userId: string
  orderId: string
  paymentRef: string
  callbackUrl: string
}

/**
 * Creates (or safely reuses) one chargeable intent for an order.
 *
 * A Postgres advisory lock serializes intent creation per order. Combined with
 * the unique `Payment.activeOrderId` column, a customer can never hold two
 * chargeable intents for the same order at once.
 */
export const createPaymentIntentForOrder = async ({
  db,
  client,
  userId,
  orderId,
  paymentRef,
  callbackUrl,
}: CreateIntentInput): Promise<CreatePaymentIntentResult> =>
  db.$transaction(
    async (tx): Promise<CreatePaymentIntentResult> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-payment:${orderId}`}))`

      const order = await tx.order.findUnique({ where: { id: orderId } })

      if (!order || order.userId !== userId) {
        throw new Error("Order not found.")
      }

      const eligibility = evaluatePaymentEligibility(order)

      if (!eligibility.payable) {
        return {
          ok: false,
          reason:
            eligibility.reason === "already_paid"
              ? "already_paid"
              : "not_payable",
          orderId: order.id,
          paymentId: null,
          message: eligibility.message,
        }
      }

      const amount = assertChargeableMinorAmount(toMinorUnits(order.total))
      const description = buildPaymentReference({
        orderId: order.id,
        paymentId: paymentRef,
      })
      const now = Date.now()

      const existing = await tx.payment.findUnique({
        where: { id: paymentRef },
      })

      if (existing && existing.orderId !== order.id) {
        throw new Error("This payment does not belong to this order.")
      }

      if (existing?.moyasarPaymentId) {
        return {
          ok: false,
          reason: "payment_already_submitted",
          orderId: order.id,
          paymentId: existing.moyasarPaymentId,
          message: "This payment has already been submitted.",
        }
      }

      // Reuse a still-valid, matching intent instead of creating a second
      // chargeable intent for the same attempt.
      if (existing?.moyasarIntentId) {
        let intent: Awaited<ReturnType<typeof client.fetchIntent>> | null = null

        try {
          intent = await client.fetchIntent(existing.moyasarIntentId)
        } catch (error) {
          // A missing intent (deleted in the dashboard) is treated like an
          // expired one: a fresh intent is created below.
          if (!(error instanceof MoyasarApiError) || error.status !== 404) {
            throw error
          }
        }

        if (intent) {
          const expired = Date.parse(intent.expires_at) <= now
          const matches =
            intent.amount === amount &&
            intent.currency.toUpperCase() === PAYMENT_CURRENCY &&
            intent.description === description

          if (intent.status === "created" && !expired) {
            if (matches) {
              if (existing.status !== "intent_created") {
                await tx.payment.update({
                  where: { id: existing.id },
                  data: {
                    status: "intent_created",
                    activeOrderId: order.id,
                  },
                })
              }

              return {
                ok: true,
                orderId: order.id,
                intentId: intent.id,
                clientSecret: intent.client_secret,
                amount,
                currency: PAYMENT_CURRENCY,
              }
            }

            // A locked intent with a different amount/description can never
            // be reused. Cancel it before creating a replacement.
            try {
              await client.cancelIntent(intent.id)
            } catch (error) {
              if (error instanceof MoyasarApiError) {
                return {
                  ok: false,
                  reason: "payment_busy",
                  orderId: order.id,
                  paymentId: null,
                  message:
                    "A previous payment attempt could not be canceled. Please refresh and try again.",
                }
              }

              throw error
            }
          } else if (intent.status === "fulfilled") {
            // The intent was used, but the payment id is not known yet. Do not
            // create a second charge; reconciliation will recover it.
            return {
              ok: false,
              reason: "payment_processing",
              orderId: order.id,
              paymentId: null,
              message:
                "A payment for this order is already being processed. Refresh the page to check its status.",
            }
          }
        }
      }

      // Supersede any other active attempt for this order.
      const active = await tx.payment.findUnique({
        where: { activeOrderId: order.id },
      })

      if (active && active.id !== paymentRef) {
        if (active.moyasarIntentId) {
          let oldIntent: Awaited<ReturnType<typeof client.fetchIntent>> | null =
            null

          try {
            oldIntent = await client.fetchIntent(active.moyasarIntentId)
          } catch (error) {
            if (!(error instanceof MoyasarApiError) || error.status !== 404) {
              throw error
            }
          }

          if (oldIntent) {
            const oldExpired = Date.parse(oldIntent.expires_at) <= now

            if (oldIntent.status === "fulfilled") {
              return active.moyasarPaymentId
                ? {
                    ok: false,
                    reason: "payment_already_submitted",
                    orderId: order.id,
                    paymentId: active.moyasarPaymentId,
                    message:
                      "A payment for this order is already being processed.",
                  }
                : {
                    ok: false,
                    reason: "payment_processing",
                    orderId: order.id,
                    paymentId: null,
                    message:
                      "A payment for this order is already being processed. Refresh the page to check its status.",
                  }
            }

            if (oldIntent.status === "created" && !oldExpired) {
              try {
                await client.cancelIntent(active.moyasarIntentId)
              } catch (error) {
                if (error instanceof MoyasarApiError) {
                  return {
                    ok: false,
                    reason:
                      error.type === "intent_not_fulfillable"
                        ? "payment_processing"
                        : "payment_busy",
                    orderId: order.id,
                    paymentId: null,
                    message:
                      "A previous payment attempt could not be canceled. Please refresh and try again.",
                  }
                }

                throw error
              }
            }
          }
        }

        await tx.payment.update({
          where: { id: active.id },
          data: { status: "superseded", activeOrderId: null },
        })
      }

      const payment = existing
        ? await tx.payment.update({
            where: { id: existing.id },
            data: {
              activeOrderId: order.id,
              status: "creating",
              amount,
              currency: PAYMENT_CURRENCY,
              moyasarIntentId: null,
              moyasarPaymentId: null,
              intentExpiresAt: null,
              failureCode: null,
              failureMessage: null,
            },
          })
        : await tx.payment.create({
            data: {
              id: paymentRef,
              orderId: order.id,
              activeOrderId: order.id,
              amount,
              currency: PAYMENT_CURRENCY,
              status: "creating",
            },
          })

      const intent = await client.createIntent({
        amount: payment.amount,
        currency: payment.currency,
        description,
        callback_url: callbackUrl,
      })

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          moyasarIntentId: intent.id,
          status: "intent_created",
          intentExpiresAt: new Date(intent.expires_at),
        },
      })

      return {
        ok: true,
        orderId: order.id,
        intentId: intent.id,
        clientSecret: intent.client_secret,
        amount: payment.amount,
        currency: PAYMENT_CURRENCY,
      }
    },
    { maxWait: 5_000, timeout: 25_000 }
  )

interface VerifyInput {
  db: PrismaClient
  client: MoyasarClient
  userId: string
  paymentId: string
  expectedOrderId?: string
}

const resultMessage = (
  result: Awaited<ReturnType<typeof applyVerifiedPayment>>,
  providerPayment: MoyasarPayment
): string | null => {
  if (result.status !== "paid") {
    return providerPayment.source?.message ?? null
  }

  if (result.orderIsPaid) {
    return "Payment received."
  }

  if (result.orderStatus === "Canceled") {
    return "Payment received, but this order was canceled. Please contact support to arrange a refund."
  }

  return "Payment received, but the order could not be fulfilled automatically. Please contact support."
}

/**
 * Re-fetches a payment from Moyasar with the secret key and applies it.
 *
 * The browser only supplies a payment id. Status, amount, currency, order
 * ownership, and the order reference are all verified server-side.
 */
export const verifyPaymentForUser = async ({
  db,
  client,
  userId,
  paymentId,
  expectedOrderId,
}: VerifyInput): Promise<PaymentResult> => {
  let providerPayment: MoyasarPayment

  try {
    providerPayment = await client.fetchPayment(paymentId)
  } catch (error) {
    if (error instanceof MoyasarApiError && error.status === 404) {
      return invalidPaymentResult("We could not find this payment.")
    }

    throw error
  }

  const reference = parsePaymentReference(providerPayment.description)

  if (
    !reference ||
    (expectedOrderId !== undefined && reference.orderId !== expectedOrderId)
  ) {
    return invalidPaymentResult(
      "This payment is not associated with this order."
    )
  }

  try {
    const result = await applyVerifiedPayment({ providerPayment, userId }, db)

    return {
      status: toResultStatus(result.status),
      orderId: result.orderId,
      orderNumber: orderNumber(result.orderId),
      amount: providerPayment.amount,
      currency: providerPayment.currency.toUpperCase() as PaymentCurrency,
      message: resultMessage(result, providerPayment),
      paymentId: result.paymentId,
      orderStatus: result.orderStatus,
      orderIsPaid: result.orderIsPaid,
    }
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return invalidPaymentResult(error.message)
    }

    throw error
  }
}

const markAttemptTerminal = async (
  db: PrismaClient,
  payment: Pick<Payment, "id">,
  status: "expired" | "canceled",
  failureMessage: string
): Promise<void> => {
  await db.payment.update({
    where: { id: payment.id },
    data: { status, activeOrderId: null, failureMessage },
  })
}

const recoverFulfilledPayment = async (
  client: MoyasarClient,
  orderId: string,
  paymentRef: string
): Promise<MoyasarPayment | null> => {
  const result = await client.listPayments({
    metadata: { shop_plus_payment: paymentRef },
  })

  for (const providerPayment of result.payments) {
    const reference = parsePaymentReference(providerPayment.description)

    if (reference?.orderId === orderId && reference.paymentId === paymentRef) {
      return providerPayment
    }
  }

  return null
}

/**
 * Reconciles an in-flight attempt with the provider. This is what makes
 * "Refresh status" work when a callback or webhook is delayed or lost, without
 * ever allowing a second charge while an old payment may still succeed.
 */
export const reconcileOrderPayment = async ({
  db,
  client,
  userId,
  orderId,
  publishableKey,
  callbackUrl,
}: SessionInput & { client: MoyasarClient }): Promise<PaymentSession> => {
  const order = await db.order.findUnique({ where: { id: orderId } })

  if (!order || order.userId !== userId) {
    throw new Error("Order not found.")
  }

  const active = await db.payment.findUnique({
    where: { activeOrderId: order.id },
  })

  const candidate =
    active ??
    (await db.payment.findFirst({
      where: {
        orderId: order.id,
        OR: [
          { moyasarPaymentId: { not: null } },
          { moyasarIntentId: { not: null } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    }))

  if (candidate && IN_FLIGHT_ATTEMPT_STATUSES.has(candidate.status)) {
    if (candidate.moyasarPaymentId) {
      try {
        const providerPayment = await client.fetchPayment(
          candidate.moyasarPaymentId
        )

        await applyVerifiedPayment({ providerPayment, userId }, db)
      } catch (error) {
        if (error instanceof MoyasarApiError && error.status === 404) {
          await markAttemptTerminal(
            db,
            candidate,
            "expired",
            "Payment was not found at Moyasar."
          )
        } else {
          throw error
        }
      }
    } else if (candidate.moyasarIntentId) {
      let intent: Awaited<ReturnType<typeof client.fetchIntent>> | null = null

      try {
        intent = await client.fetchIntent(candidate.moyasarIntentId)
      } catch (error) {
        if (error instanceof MoyasarApiError && error.status === 404) {
          await markAttemptTerminal(
            db,
            candidate,
            "expired",
            "Payment intent was not found at Moyasar."
          )
        } else {
          throw error
        }
      }

      if (intent) {
        if (intent.status === "fulfilled") {
          const recovered = await recoverFulfilledPayment(
            client,
            order.id,
            candidate.id
          )

          if (recovered) {
            await applyVerifiedPayment(
              { providerPayment: recovered, userId },
              db
            )
          } else {
            // A payment exists but its id is not known yet. Keep the attempt
            // in `processing` so the UI never offers a second charge.
            await db.payment.update({
              where: { id: candidate.id },
              data: { status: "processing", activeOrderId: order.id },
            })
          }
        } else if (intent.status === "canceled") {
          await markAttemptTerminal(
            db,
            candidate,
            "canceled",
            "Payment intent was canceled."
          )
        } else if (Date.parse(intent.expires_at) <= Date.now()) {
          // Expiry is not a status: an expired intent cannot be fulfilled or
          // canceled, so the attempt can be released safely.
          await markAttemptTerminal(
            db,
            candidate,
            "expired",
            "Payment intent expired."
          )
        }
      }
    }
  }

  return loadPaymentSession({
    db,
    userId,
    orderId,
    publishableKey,
    callbackUrl,
  })
}
