import { describe, expect, it, vi } from "vitest"
import {
  MoyasarApiError,
  type MoyasarClient,
  type MoyasarPayment,
} from "./moyasar"
import { resetMoyasarEnvCache } from "./env"
import { buildPaymentReference } from "./reference"
import { buildOrder, buildPayment, createFakeDb } from "./test-support/fake-db"
import {
  handleMoyasarWebhook,
  type MoyasarWebhookDependencies,
} from "./webhook"

const orderId = "11111111-1111-4111-8111-111111111111"
const paymentId = "22222222-2222-4222-8222-222222222222"
const userId = "user_1"
const secret = "webhook_secret_value_123456"
const description = buildPaymentReference({ orderId, paymentId })

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

const makeClient = (fetchPayment: MoyasarClient["fetchPayment"]) =>
  ({
    createIntent: vi.fn(),
    fetchIntent: vi.fn(),
    cancelIntent: vi.fn(),
    fetchPayment: vi.fn(fetchPayment),
    listPayments: vi.fn(),
  }) as unknown as MoyasarClient

const fetchPaymentMock = (client: MoyasarClient) =>
  client.fetchPayment as unknown as ReturnType<typeof vi.fn>

const setup = (
  fetchPayment: MoyasarClient["fetchPayment"] = async () => makePayment()
) => {
  const fake = createFakeDb({
    orders: [buildOrder({ id: orderId, userId, total: 25, subtotal: 25 })],
    payments: [
      buildPayment({
        id: paymentId,
        orderId,
        amount: 2500,
        activeOrderId: orderId,
        status: "intent_created",
      }),
    ],
  })

  const client = makeClient(fetchPayment)
  const dependencies: MoyasarWebhookDependencies = {
    env: { MOYASAR_WEBHOOK_SECRET: secret },
    client,
    db: fake.db,
  }

  return { fake, client, dependencies }
}

const payload = (overrides: Record<string, unknown> = {}) => ({
  id: "evt_123",
  type: "payment_paid",
  created_at: new Date().toISOString(),
  secret_token: secret,
  live: false,
  data: {
    id: "pay_abc123",
    status: "paid",
    amount: 2500,
    currency: "SAR",
  },
  ...overrides,
})

const webhookRequest = (body: unknown): Request =>
  new Request("https://shop.example/api/webhooks/moyasar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

describe("handleMoyasarWebhook", () => {
  it("fails closed when the integration is not configured", async () => {
    vi.stubEnv("MOYASAR_PUBLISHABLE_KEY", "")
    resetMoyasarEnvCache()

    try {
      const response = await handleMoyasarWebhook(webhookRequest(payload()))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({
        error: "not_configured",
      })
    } finally {
      vi.unstubAllEnvs()
      resetMoyasarEnvCache()
    }
  })

  it("rejects malformed JSON", async () => {
    const { dependencies } = setup()

    const response = await handleMoyasarWebhook(
      webhookRequest("{not json"),
      dependencies
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "invalid_json" })
  })

  it("rejects a payload with the wrong shape", async () => {
    const { dependencies } = setup()

    const response = await handleMoyasarWebhook(
      webhookRequest({ id: "evt_123" }),
      dependencies
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_payload",
    })
  })

  it("rejects an invalid signature without touching the provider", async () => {
    const { dependencies, client } = setup()

    const response = await handleMoyasarWebhook(
      webhookRequest(payload({ secret_token: "wrong_secret_value_123456" })),
      dependencies
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "invalid_signature",
    })
    expect(fetchPaymentMock(client)).not.toHaveBeenCalled()
  })

  it("refuses live events because only sandbox is supported", async () => {
    const { dependencies, client } = setup()

    const response = await handleMoyasarWebhook(
      webhookRequest(payload({ live: true })),
      dependencies
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "live_events_not_supported",
    })
    expect(fetchPaymentMock(client)).not.toHaveBeenCalled()
  })

  it("acknowledges but ignores unhandled event types", async () => {
    const { dependencies, client } = setup()

    const response = await handleMoyasarWebhook(
      webhookRequest(payload({ type: "payment_created" })),
      dependencies
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      ignored: true,
    })
    expect(fetchPaymentMock(client)).not.toHaveBeenCalled()
  })

  it("acknowledges a payment that no longer exists at the provider", async () => {
    const { dependencies } = setup(async () => {
      throw new MoyasarApiError(404, "not_found", "Not found")
    })

    const response = await handleMoyasarWebhook(
      webhookRequest(payload()),
      dependencies
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      ignored: true,
    })
  })

  it("asks the provider to retry on a transient failure", async () => {
    const { dependencies } = setup(async () => {
      throw new MoyasarApiError(503, "unavailable", "Try later")
    })

    const response = await handleMoyasarWebhook(
      webhookRequest(payload()),
      dependencies
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: "provider_unavailable",
    })
  })

  it("applies a verified payment found through the secret-key refetch", async () => {
    const { dependencies, fake } = setup()
    let requestedId: string | null = null
    const client = makeClient(async (id) => {
      requestedId = id
      return makePayment()
    })

    const response = await handleMoyasarWebhook(webhookRequest(payload()), {
      ...dependencies,
      client,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      status: "paid",
    })
    expect(requestedId).toBe("pay_abc123")
    expect(fake.orders.get(orderId)).toMatchObject({
      isPaid: true,
      status: "Placed",
    })
    expect(fake.payments.get(paymentId)).toMatchObject({ status: "paid" })
  })

  it("ignores a payment that does not belong to an order", async () => {
    const { dependencies } = setup(async () =>
      makePayment({ description: "unrelated payment" })
    )

    const response = await handleMoyasarWebhook(
      webhookRequest(payload()),
      dependencies
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      ignored: true,
      reason: "invalid_reference",
    })
  })

  it("is idempotent for duplicate deliveries", async () => {
    const { dependencies, fake } = setup()

    const first = await handleMoyasarWebhook(
      webhookRequest(payload()),
      dependencies
    )
    const second = await handleMoyasarWebhook(
      webhookRequest(payload()),
      dependencies
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({
      received: true,
      status: "paid",
    })
    expect(fake.orders.get(orderId)).toMatchObject({
      isPaid: true,
      status: "Placed",
    })
    expect(fake.orders.get(orderId)?.statusHistory).toHaveLength(1)
    expect(fake.payments.get(paymentId)).toMatchObject({ status: "paid" })
  })
})
