import { describe, expect, it } from "vitest"
import { MoyasarApiError, createMoyasarClient } from "./moyasar"

const secretKey = "sk_test_abc123"
const baseUrl = "https://api.moyasar.com/v1/"

const intentFixture = {
  id: "intent_1",
  amount: 1234,
  currency: "SAR",
  description: "shop-plus:order:order-1:payment:payment-1",
  callback_url: "https://example.com/payment-result",
  status: "created",
  client_secret: "pi_client_secret",
  expires_at: "2030-01-01T00:00:00Z",
}

const paymentFixture = {
  id: "pay_1",
  status: "paid",
  amount: 1234,
  currency: "SAR",
  description: "shop-plus:order:order-1:payment:payment-1",
  source: {
    type: "creditcard",
    company: "visa",
    number: "411111******1111",
  },
}

interface CapturedRequest {
  url: string
  init: RequestInit
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const createClient = (
  handler: (request: CapturedRequest) => Response | Promise<Response>
) => {
  const requests: CapturedRequest[] = []

  const client = createMoyasarClient({
    secretKey,
    baseUrl,
    fetchImpl: async (input, init) => {
      const request = { url: String(input), init: init ?? {} }
      requests.push(request)
      return handler(request)
    },
  })

  return { client, requests }
}

describe("Moyasar client", () => {
  it("creates an intent with basic auth and a JSON body", async () => {
    const { client, requests } = createClient(() => jsonResponse(intentFixture))

    const intent = await client.createIntent({
      amount: 1234,
      currency: "SAR",
      description: "order description",
      callback_url: "https://example.com/payment-result",
    })

    expect(intent.id).toBe("intent_1")
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe("https://api.moyasar.com/v1/payment_intents")
    expect(requests[0].init.method).toBe("POST")
    expect(requests[0].init.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    })
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      amount: 1234,
      currency: "SAR",
      description: "order description",
      callback_url: "https://example.com/payment-result",
    })
  })

  it("fetches and encodes an intent id", async () => {
    const { client, requests } = createClient(() => jsonResponse(intentFixture))

    await client.fetchIntent("intent/with space")

    expect(requests[0].url).toBe(
      "https://api.moyasar.com/v1/payment_intents/intent%2Fwith%20space"
    )
    expect(requests[0].init.method).toBe("GET")
    expect(requests[0].init.body).toBeUndefined()
  })

  it("fetches a payment and exposes its provider fields", async () => {
    const { client, requests } = createClient(() =>
      jsonResponse(paymentFixture)
    )

    const payment = await client.fetchPayment("pay_1")

    expect(requests[0].url).toBe("https://api.moyasar.com/v1/payments/pay_1")
    expect(payment).toMatchObject({
      id: "pay_1",
      status: "paid",
      amount: 1234,
      currency: "SAR",
    })
  })

  it("cancels an intent", async () => {
    const { client, requests } = createClient(() =>
      jsonResponse({ id: "intent_1", status: "canceled" })
    )

    await expect(client.cancelIntent("intent_1")).resolves.toEqual({
      id: "intent_1",
      status: "canceled",
    })
    expect(requests[0].url).toBe(
      "https://api.moyasar.com/v1/payment_intents/intent_1/cancel"
    )
    expect(requests[0].init.method).toBe("POST")
  })

  it("surfaces provider errors without leaking the secret key", async () => {
    const { client } = createClient(() =>
      jsonResponse(
        { type: "invalid_request", message: "Amount is too small." },
        422
      )
    )

    const error = await client
      .createIntent({
        amount: 1,
        currency: "SAR",
        description: "x",
        callback_url: "https://example.com",
      })
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(MoyasarApiError)
    expect(error).toMatchObject({
      status: 422,
      type: "invalid_request",
      message: "Amount is too small.",
    })
    expect(String((error as Error).message)).not.toContain(secretKey)
  })

  it("rejects an empty successful response", async () => {
    const { client } = createClient(() => new Response("", { status: 200 }))

    await expect(client.fetchPayment("pay_1")).rejects.toMatchObject({
      status: 200,
      type: "invalid_response",
    })
  })

  it("maps network failures to a provider error", async () => {
    const { client } = createClient(() => {
      throw new TypeError("fetch failed")
    })

    await expect(client.fetchPayment("pay_1")).rejects.toMatchObject({
      status: 0,
      type: "network_error",
    })
  })

  it("rejects a response that does not match the documented shape", async () => {
    const { client } = createClient(() =>
      jsonResponse({ id: "intent_1", status: "created" })
    )

    await expect(client.fetchIntent("intent_1")).rejects.toThrow()
  })
})
