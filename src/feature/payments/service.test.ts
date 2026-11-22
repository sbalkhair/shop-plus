import { describe, expect, it, vi } from "vitest"
import type { MoyasarClient, MoyasarPayment } from "./moyasar"
import { MoyasarApiError } from "./moyasar"
import { buildPaymentReference } from "./reference"
import {
  createPaymentIntentForOrder,
  loadPaymentSession,
  reconcileOrderPayment,
  verifyPaymentForUser,
} from "./service"
import { buildOrder, buildPayment, createFakeDb } from "./test-support/fake-db"

const orderId = "11111111-1111-4111-8111-111111111111"
const paymentId = "22222222-2222-4222-8222-222222222222"
const otherPaymentId = "33333333-3333-4333-8333-333333333333"
const userId = "user_1"
const publishableKey = "pk_test_abc123"
const callbackUrl = "https://shop.example/payment-result"
const description = buildPaymentReference({ orderId, paymentId })

const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

const makeIntent = (
  overrides: Partial<{
    id: string
    amount: number
    currency: string
    description: string | null
    callback_url: string
    status: "created" | "fulfilled" | "canceled"
    expires_at: string
  }> = {}
) => ({
  id: "intent_123",
  amount: 2500,
  currency: "SAR",
  description,
  callback_url: callbackUrl,
  status: "created" as const,
  client_secret: "secret_123",
  expires_at: future(),
  ...overrides,
})

const makePayment = (
  overrides: Partial<MoyasarPayment> = {}
): MoyasarPayment => ({
  id: "pay_abc123",
  status: "paid",
  amount: 2500,
  currency: "SAR",
  description,
  source: {
    type: "creditcard",
    company: "visa",
    number: "411111******1111",
  },
  ...overrides,
})

const makeClient = (
  overrides: Partial<Record<keyof MoyasarClient, unknown>> = {}
): MoyasarClient =>
  ({
    createIntent: vi.fn(
      async (input: { amount: number; description: string }) =>
        makeIntent({
          amount: input.amount,
          description: input.description,
          callback_url: callbackUrl,
        })
    ),
    fetchIntent: vi.fn(async () => makeIntent()),
    cancelIntent: vi.fn(async (intentId: string) => ({
      id: intentId,
      status: "canceled",
    })),
    fetchPayment: vi.fn(async () => makePayment()),
    listPayments: vi.fn(async () => ({ payments: [], meta: {} })),
    ...overrides,
  }) as unknown as MoyasarClient

const seed = (
  options: {
    order?: Parameters<typeof buildOrder>[0]
    payment?: Parameters<typeof buildPayment>[0]
  } = {}
) => {
  const fake = createFakeDb({
    orders: [
      buildOrder({
        id: orderId,
        userId,
        total: 25,
        subtotal: 25,
        ...options.order,
      }),
    ],
    payments: options.payment
      ? [
          buildPayment({
            id: paymentId,
            orderId,
            amount: 2500,
            activeOrderId: orderId,
            ...options.payment,
          }),
        ]
      : [],
  })

  const sessionInput = {
    db: fake.db,
    userId,
    orderId,
    publishableKey,
    callbackUrl,
  }

  return { ...fake, sessionInput }
}

const clientMock = (client: MoyasarClient) =>
  client as unknown as {
    createIntent: ReturnType<typeof vi.fn>
    fetchIntent: ReturnType<typeof vi.fn>
    cancelIntent: ReturnType<typeof vi.fn>
    fetchPayment: ReturnType<typeof vi.fn>
    listPayments: ReturnType<typeof vi.fn>
  }

describe("loadPaymentSession", () => {
  it("rejects a missing order", async () => {
    const { sessionInput } = seed()

    await expect(
      loadPaymentSession({ ...sessionInput, orderId: otherPaymentId })
    ).rejects.toThrow("Order not found.")
  })

  it("rejects an order owned by another user", async () => {
    const { sessionInput } = seed()

    await expect(
      loadPaymentSession({ ...sessionInput, userId: "someone_else" })
    ).rejects.toThrow("Order not found.")
  })

  it("returns a payable session with a fresh server-generated reference", async () => {
    const { sessionInput } = seed()

    const session = await loadPaymentSession(sessionInput)

    expect(session).toMatchObject({
      state: "payable",
      stateMessage: null,
      amount: 2500,
      currency: "SAR",
      paymentId: null,
      publishableKey,
      callbackUrl,
      order: { orderId, total: 25, currency: "SAR" },
    })
    expect(session.paymentRef).toMatch(/^[0-9a-f-]{36}$/)
    expect(session.description).toBe(
      buildPaymentReference({ orderId, paymentId: session.paymentRef! })
    )
  })

  it("reuses an in-flight attempt instead of generating a second reference", async () => {
    const { sessionInput } = seed({ payment: { status: "intent_created" } })

    const session = await loadPaymentSession(sessionInput)

    expect(session).toMatchObject({ state: "payable", paymentRef: paymentId })
  })

  it("reports processing when an attempt is in flight", async () => {
    const { sessionInput } = seed({
      payment: { status: "processing", moyasarPaymentId: "pay_abc123" },
    })

    const session = await loadPaymentSession(sessionInput)

    expect(session).toMatchObject({
      state: "processing",
      paymentId: "pay_abc123",
    })
  })

  it("reports paid without offering a reference for a paid order", async () => {
    const { sessionInput } = seed({
      order: { isPaid: true, status: "Placed" },
      payment: { status: "paid", activeOrderId: null },
    })

    const session = await loadPaymentSession(sessionInput)

    expect(session).toMatchObject({
      state: "paid",
      paymentRef: null,
      description: "",
    })
  })

  it("marks cash orders unavailable", async () => {
    const { sessionInput } = seed({
      order: { paymentMethod: "cash", status: "Placed" },
    })

    const session = await loadPaymentSession(sessionInput)

    expect(session).toMatchObject({
      state: "unavailable",
      stateMessage: "This order is not a card-payment order.",
      paymentRef: null,
    })
  })
})

describe("createPaymentIntentForOrder", () => {
  const create = (
    fake: ReturnType<typeof seed>,
    client: MoyasarClient,
    overrides: { paymentRef?: string; userId?: string; orderId?: string } = {}
  ) =>
    createPaymentIntentForOrder({
      db: fake.db,
      client,
      userId: overrides.userId ?? userId,
      orderId: overrides.orderId ?? orderId,
      paymentRef: overrides.paymentRef ?? paymentId,
      callbackUrl,
    })

  it("rejects an order owned by another user", async () => {
    const fake = seed()
    const client = makeClient()

    await expect(
      create(fake, client, { userId: "someone_else" })
    ).rejects.toThrow("Order not found.")
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it.each([
    ["cash", { paymentMethod: "cash", status: "Placed" }, "not_payable"],
    ["canceled", { status: "Canceled" }, "not_payable"],
    ["paid", { isPaid: true, status: "Placed" }, "already_paid"],
  ])(
    "refuses to create an intent for a %s order",
    async (_label, orderOverrides, reason) => {
      const fake = seed({ order: orderOverrides })
      const client = makeClient()

      const result = await create(fake, client)

      expect(result).toMatchObject({ ok: false, reason })
      expect(clientMock(client).createIntent).not.toHaveBeenCalled()
    }
  )

  it("creates the intent from the server-side order total", async () => {
    const fake = seed()
    const client = makeClient()

    const result = await create(fake, client)

    expect(result).toMatchObject({
      ok: true,
      orderId,
      intentId: "intent_123",
      clientSecret: "secret_123",
      amount: 2500,
      currency: "SAR",
    })
    expect(clientMock(client).createIntent).toHaveBeenCalledWith({
      amount: 2500,
      currency: "SAR",
      description,
      callback_url: callbackUrl,
    })

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "intent_created",
      activeOrderId: orderId,
      moyasarIntentId: "intent_123",
      amount: 2500,
      currency: "SAR",
    })
  })

  it("rejects a payment reference that belongs to another order", async () => {
    const fake = seed({
      payment: {
        orderId: "44444444-4444-4444-8444-444444444444",
        activeOrderId: null,
      },
    })

    await expect(create(fake, makeClient())).rejects.toThrow(
      "This payment does not belong to this order."
    )
  })

  it("returns the known payment id instead of charging again", async () => {
    const fake = seed({
      payment: { status: "processing", moyasarPaymentId: "pay_abc123" },
    })
    const client = makeClient()

    const result = await create(fake, client)

    expect(result).toMatchObject({
      ok: false,
      reason: "payment_already_submitted",
      paymentId: "pay_abc123",
    })
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it("reuses a still-valid matching intent", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => makeIntent()),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: true, intentId: "intent_123" })
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it("recreates an intent that expired", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_old" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", expires_at: past() })
      ),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: true, intentId: "intent_123" })
    expect(clientMock(client).createIntent).toHaveBeenCalledTimes(1)
    expect(clientMock(client).cancelIntent).not.toHaveBeenCalled()
  })

  it("replaces an intent that was canceled", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_old" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", status: "canceled" })
      ),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: true, intentId: "intent_123" })
    expect(fake.payments.get(paymentId)).toMatchObject({
      moyasarIntentId: "intent_123",
    })
  })

  it("never creates a second charge when the existing intent is fulfilled", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_old" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", status: "fulfilled" })
      ),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: false, reason: "payment_processing" })
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it("cancels and supersedes a different active attempt before charging", async () => {
    const fake = seed({
      payment: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "intent_created",
        moyasarIntentId: "intent_old",
      },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", status: "created" })
      ),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: true })
    expect(clientMock(client).cancelIntent).toHaveBeenCalledWith("intent_old")
    expect(
      fake.payments.get("55555555-5555-4555-8555-555555555555")
    ).toMatchObject({ status: "superseded", activeOrderId: null })
  })

  it("does not create a second charge when another attempt was fulfilled", async () => {
    const fake = seed({
      payment: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "intent_created",
        moyasarIntentId: "intent_old",
      },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", status: "fulfilled" })
      ),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: false, reason: "payment_processing" })
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it("reports a busy payment when a mismatched intent cannot be canceled", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_old" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () =>
        makeIntent({ id: "intent_old", status: "created", amount: 1000 })
      ),
      cancelIntent: vi.fn(async () => {
        throw new MoyasarApiError(409, "conflict", "Cannot cancel")
      }),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: false, reason: "payment_busy" })
    expect(clientMock(client).createIntent).not.toHaveBeenCalled()
  })

  it("recreates an intent that no longer exists at the provider", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_gone" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => {
        throw new MoyasarApiError(404, "not_found", "Not found")
      }),
    })

    const result = await create(fake, client)

    expect(result).toMatchObject({ ok: true })
    expect(clientMock(client).createIntent).toHaveBeenCalledTimes(1)
  })
})

describe("verifyPaymentForUser", () => {
  const verify = (
    fake: ReturnType<typeof seed>,
    client: MoyasarClient,
    overrides: {
      paymentId?: string
      userId?: string
      expectedOrderId?: string
    } = {}
  ) =>
    verifyPaymentForUser({
      db: fake.db,
      client,
      userId: overrides.userId ?? userId,
      paymentId: overrides.paymentId ?? "pay_abc123",
      expectedOrderId: overrides.expectedOrderId,
    })

  it("returns an invalid result when the provider does not know the payment", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient({
      fetchPayment: vi.fn(async () => {
        throw new MoyasarApiError(404, "not_found", "Not found")
      }),
    })

    const result = await verify(fake, client)

    expect(result).toMatchObject({
      status: "invalid",
      message: "We could not find this payment.",
      orderIsPaid: false,
    })
  })

  it("applies a verified paid payment and reports the order as paid", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient()

    const result = await verify(fake, client)

    expect(result).toMatchObject({
      status: "paid",
      orderId,
      amount: 2500,
      currency: "SAR",
      message: "Payment received.",
      paymentId,
      orderStatus: "Placed",
      orderIsPaid: true,
    })
    expect(fake.orders.get(orderId)).toMatchObject({
      isPaid: true,
      status: "Placed",
    })
  })

  it("rejects a payment for a different order", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient()

    const result = await verify(fake, client, {
      expectedOrderId: otherPaymentId,
    })

    expect(result).toMatchObject({
      status: "invalid",
      message: "This payment is not associated with this order.",
    })
    expect(clientMock(client).fetchPayment).toHaveBeenCalledTimes(1)
  })

  it("does not treat an initiated payment as paid", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient({
      fetchPayment: vi.fn(async () => makePayment({ status: "initiated" })),
    })

    const result = await verify(fake, client)

    expect(result).toMatchObject({ status: "pending", orderIsPaid: false })
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: false })
  })

  it("reports a failed payment without fulfilling the order", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient({
      fetchPayment: vi.fn(async () =>
        makePayment({
          status: "failed",
          source: {
            type: "creditcard",
            company: "visa",
            message: "Insufficient funds",
          },
        })
      ),
    })

    const result = await verify(fake, client)

    expect(result).toMatchObject({
      status: "failed",
      message: "Insufficient funds",
      orderIsPaid: false,
    })
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: false })
  })

  it("returns an invalid result for an amount mismatch", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient({
      fetchPayment: vi.fn(async () => makePayment({ amount: 100 })),
    })

    const result = await verify(fake, client)

    expect(result).toMatchObject({ status: "invalid", orderIsPaid: false })
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: false })
  })

  it("records a paid payment but does not fulfil a canceled order", async () => {
    const fake = seed({
      order: { status: "Canceled" },
      payment: { status: "intent_created" },
    })
    const client = makeClient()

    const result = await verify(fake, client)

    expect(result).toMatchObject({
      status: "paid",
      orderStatus: "Canceled",
      orderIsPaid: false,
      message:
        "Payment received, but this order was canceled. Please contact support to arrange a refund.",
    })
    expect(fake.orders.get(orderId)).toMatchObject({
      isPaid: false,
      status: "Canceled",
    })
    expect(fake.payments.get(paymentId)).toMatchObject({ status: "paid" })
  })

  it("returns an invalid result when the order belongs to another user", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient()

    const result = await verify(fake, client, { userId: "someone_else" })

    expect(result).toMatchObject({
      status: "invalid",
      message: "You do not have access to this payment.",
    })
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: false })
  })

  it("rethrows unexpected provider failures so the caller can retry", async () => {
    const fake = seed({ payment: { status: "intent_created" } })
    const client = makeClient({
      fetchPayment: vi.fn(async () => {
        throw new Error("boom")
      }),
    })

    await expect(verify(fake, client)).rejects.toThrow("boom")
  })
})

describe("reconcileOrderPayment", () => {
  const reconcile = (
    fake: ReturnType<typeof seed>,
    client: MoyasarClient,
    overrides: { userId?: string } = {}
  ) =>
    reconcileOrderPayment({
      ...fake.sessionInput,
      userId: overrides.userId ?? userId,
      client,
    })

  it("rejects an order owned by another user", async () => {
    const fake = seed()

    await expect(
      reconcile(fake, makeClient(), { userId: "someone_else" })
    ).rejects.toThrow("Order not found.")
  })

  it("returns a payable session when nothing is in flight", async () => {
    const fake = seed()
    const client = makeClient()

    const session = await reconcile(fake, client)

    expect(session.state).toBe("payable")
    expect(clientMock(client).fetchPayment).not.toHaveBeenCalled()
  })

  it("recovers a known payment id that succeeded without a callback", async () => {
    const fake = seed({
      payment: { status: "processing", moyasarPaymentId: "pay_abc123" },
    })
    const client = makeClient()

    const session = await reconcile(fake, client)

    expect(session.state).toBe("paid")
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: true })
    expect(fake.payments.get(paymentId)).toMatchObject({ status: "paid" })
  })

  it("expires an attempt whose payment is gone at the provider", async () => {
    const fake = seed({
      payment: { status: "processing", moyasarPaymentId: "pay_gone" },
    })
    const client = makeClient({
      fetchPayment: vi.fn(async () => {
        throw new MoyasarApiError(404, "not_found", "Not found")
      }),
    })

    const session = await reconcile(fake, client)

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "expired",
      activeOrderId: null,
    })
    expect(session.state).toBe("payable")
  })

  it("recovers a fulfilled intent through the payment metadata lookup", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => makeIntent({ status: "fulfilled" })),
      listPayments: vi.fn(async () => ({
        payments: [makePayment()],
        meta: {},
      })),
    })

    const session = await reconcile(fake, client)

    expect(clientMock(client).listPayments).toHaveBeenCalledWith({
      metadata: { shop_plus_payment: paymentId },
    })
    expect(session.state).toBe("paid")
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: true })
  })

  it("keeps a fulfilled intent in processing when no payment is found", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => makeIntent({ status: "fulfilled" })),
    })

    const session = await reconcile(fake, client)

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "processing",
      activeOrderId: orderId,
    })
    expect(session.state).toBe("processing")
  })

  it("releases an expired intent so a new attempt can start", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => makeIntent({ expires_at: past() })),
    })

    const session = await reconcile(fake, client)

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "expired",
      activeOrderId: null,
    })
    expect(session.state).toBe("payable")
  })

  it("releases a canceled intent", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient({
      fetchIntent: vi.fn(async () => makeIntent({ status: "canceled" })),
    })

    const session = await reconcile(fake, client)

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "canceled",
      activeOrderId: null,
    })
    expect(session.state).toBe("payable")
  })

  it("leaves a live intent alone", async () => {
    const fake = seed({
      payment: { status: "intent_created", moyasarIntentId: "intent_123" },
    })
    const client = makeClient()

    const session = await reconcile(fake, client)

    expect(fake.payments.get(paymentId)).toMatchObject({
      status: "intent_created",
      activeOrderId: orderId,
    })
    expect(session.state).toBe("payable")
  })

  it("finds a recent attempt even after it released the active slot", async () => {
    const fake = seed({
      payment: {
        status: "processing",
        moyasarPaymentId: "pay_abc123",
        activeOrderId: null,
      },
    })
    const client = makeClient()

    const session = await reconcile(fake, client)

    expect(session.state).toBe("paid")
    expect(fake.orders.get(orderId)).toMatchObject({ isPaid: true })
  })

  it("does not reconcile terminal attempts", async () => {
    const fake = seed({
      payment: { status: "failed", activeOrderId: null },
    })
    const client = makeClient()

    const session = await reconcile(fake, client)

    expect(clientMock(client).fetchPayment).not.toHaveBeenCalled()
    expect(session.state).toBe("payable")
  })
})
