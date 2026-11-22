import { z } from "zod"
import { getMoyasarEnv } from "./env"

/**
 * Minimal, typed HTTP client for the Moyasar API.
 *
 * - Authenticates with HTTP Basic (`username = secret key`, empty password).
 * - Never logs or includes the secret key in error messages.
 * - Accepts an injectable `fetch` so the wire format can be unit tested.
 */

const intentSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  description: z.string().nullable().optional(),
  callback_url: z.string().nullable().optional(),
  status: z.enum(["created", "fulfilled", "canceled"]),
  client_secret: z.string(),
  expires_at: z.string(),
  fulfilled_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const paymentSourceSchema = z
  .object({
    type: z.string().optional(),
    company: z.string().optional(),
    number: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough()

const paymentSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    description: z.string().nullable().optional(),
    refunded: z.number().int().optional(),
    captured: z.number().int().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    source: paymentSourceSchema.nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

const paymentListSchema = z
  .object({
    payments: z.array(paymentSchema),
    meta: z.unknown().optional(),
  })
  .passthrough()

const cancelSchema = z
  .object({
    id: z.string(),
    status: z.string(),
  })
  .passthrough()

const apiErrorSchema = z.object({
  type: z.string().optional(),
  message: z.string().optional(),
  errors: z.unknown().optional(),
})

type MoyasarIntent = z.infer<typeof intentSchema>
export type MoyasarPayment = z.infer<typeof paymentSchema>

interface CreateIntentInput {
  amount: number
  currency: string
  description: string
  callback_url: string
}

interface ListPaymentsInput {
  page?: number
  /** Filter by exact metadata values, e.g. `metadata[trip_id]=123`. */
  metadata?: Record<string, string>
}

export class MoyasarApiError extends Error {
  readonly status: number
  readonly type: string

  constructor(status: number, type: string, message: string) {
    super(message)
    this.name = "MoyasarApiError"
    this.status = status
    this.type = type
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

interface MoyasarClientOptions {
  secretKey: string
  baseUrl: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "")

const safeMessage = (message: string | undefined, status: number): string => {
  const fallback = `Moyasar request failed (HTTP ${status}).`
  const value = message?.trim() || fallback

  // Provider messages are short and safe, but cap them defensively.
  return value.length > 300 ? value.slice(0, 300) : value
}

export const createMoyasarClient = ({
  secretKey,
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}: MoyasarClientOptions) => {
  const request = async (
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<unknown> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response

    try {
      response = await fetchImpl(`${trimBaseUrl(baseUrl)}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${secretKey}:`)}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      throw new MoyasarApiError(
        0,
        "network_error",
        "Could not reach Moyasar. Please try again."
      )
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()
    let json: unknown = null

    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
    }

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(json)

      throw new MoyasarApiError(
        response.status,
        parsed.success ? (parsed.data.type ?? "api_error") : "api_error",
        safeMessage(
          parsed.success ? parsed.data.message : undefined,
          response.status
        )
      )
    }

    if (json === null) {
      throw new MoyasarApiError(
        response.status,
        "invalid_response",
        "Moyasar returned an empty response."
      )
    }

    return json
  }

  return {
    createIntent: async (input: CreateIntentInput): Promise<MoyasarIntent> =>
      intentSchema.parse(await request("POST", "/payment_intents", input)),
    fetchIntent: async (intentId: string): Promise<MoyasarIntent> =>
      intentSchema.parse(
        await request("GET", `/payment_intents/${encodeURIComponent(intentId)}`)
      ),
    cancelIntent: async (intentId: string) =>
      cancelSchema.parse(
        await request(
          "POST",
          `/payment_intents/${encodeURIComponent(intentId)}/cancel`
        )
      ),
    fetchPayment: async (paymentId: string): Promise<MoyasarPayment> =>
      paymentSchema.parse(
        await request("GET", `/payments/${encodeURIComponent(paymentId)}`)
      ),
    listPayments: async (
      input: ListPaymentsInput = {}
    ): Promise<z.infer<typeof paymentListSchema>> => {
      const params = new URLSearchParams()

      if (input.page !== undefined) {
        params.set("page", String(input.page))
      }

      for (const [key, value] of Object.entries(input.metadata ?? {})) {
        params.set(`metadata[${key}]`, value)
      }

      const query = params.toString()

      return paymentListSchema.parse(
        await request("GET", `/payments${query ? `?${query}` : ""}`)
      )
    },
  }
}

export type MoyasarClient = ReturnType<typeof createMoyasarClient>

export const getMoyasarClient = (): MoyasarClient => {
  const env = getMoyasarEnv()

  return createMoyasarClient({
    secretKey: env.MOYASAR_SECRET_KEY,
    baseUrl: env.MOYASAR_BASE_URL,
  })
}
