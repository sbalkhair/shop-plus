import type { PrismaClient } from "@/generated/prisma/client"
import { getMoyasarEnv } from "./env"
import {
  getMoyasarClient,
  MoyasarApiError,
  type MoyasarClient,
} from "./moyasar"
import { secretMatches } from "./security"
import { moyasarWebhookSchema } from "./schema"

/**
 * Moyasar webhook handling.
 *
 * The webhook payload is only a trigger. Status, amount and currency always
 * come from an authoritative `GET /payments/:id` call made with the secret key.
 * This makes callback and webhook processing converge on the same idempotent
 * `applyVerifiedPayment` path and prevents a forged payload from marking an
 * order as paid.
 */

/**
 * Optional dependencies used by tests. Production callers pass only the
 * request, so the route stays a plain fetch handler.
 */
export interface MoyasarWebhookDependencies {
  env: { MOYASAR_WEBHOOK_SECRET: string }
  client: MoyasarClient
  db: PrismaClient
}

export const MOYASAR_HANDLED_EVENTS = new Set([
  "payment_paid",
  "payment_faild",
  "payment_failed",
  "payment_refunded",
  "payment_voided",
  "payment_authorized",
  "payment_captured",
  "payment_verified",
])

const jsonResponse = (
  status: number,
  body: Record<string, unknown>
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })

export const handleMoyasarWebhook = async (
  request: Request,
  dependencies?: MoyasarWebhookDependencies
): Promise<Response> => {
  // Loaded lazily so this module (and its unit tests) can be imported without
  // DATABASE_URL; `apply` pulls in the Prisma singleton.
  const { PaymentVerificationError, applyVerifiedPayment } =
    await import("./apply")

  let env: { MOYASAR_WEBHOOK_SECRET: string }

  try {
    env = dependencies?.env ?? getMoyasarEnv()
  } catch {
    // Configuration errors are never echoed back: the message could include
    // hints about which secret is missing.
    return jsonResponse(500, { error: "not_configured" })
  }

  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    return jsonResponse(400, { error: "invalid_json" })
  }

  const parsed = moyasarWebhookSchema.safeParse(raw)

  if (!parsed.success) {
    return jsonResponse(400, { error: "invalid_payload" })
  }

  const payload = parsed.data

  if (!secretMatches(payload.secret_token, env.MOYASAR_WEBHOOK_SECRET)) {
    return jsonResponse(401, { error: "invalid_signature" })
  }

  // This integration is sandbox-only. A live event means the wrong credentials
  // were configured, so refuse to act on it.
  if (payload.live) {
    return jsonResponse(400, { error: "live_events_not_supported" })
  }

  if (!MOYASAR_HANDLED_EVENTS.has(payload.type)) {
    return jsonResponse(200, { received: true, ignored: true })
  }

  const client = dependencies?.client ?? getMoyasarClient()

  let payment: Awaited<ReturnType<typeof client.fetchPayment>>

  try {
    payment = await client.fetchPayment(payload.data.id)
  } catch (error) {
    if (error instanceof MoyasarApiError && error.status === 404) {
      // Nothing to process and retrying will not help.
      return jsonResponse(200, { received: true, ignored: true })
    }

    // Transient provider/network failure: let Moyasar retry.
    return jsonResponse(502, { error: "provider_unavailable" })
  }

  try {
    const result = await applyVerifiedPayment(
      {
        providerPayment: payment,
      },
      dependencies?.db
    )

    return jsonResponse(200, {
      received: true,
      status: result.status,
    })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      // Permanent mismatch (wrong merchant, amount, currency, ...). A retry
      // cannot succeed, so acknowledge to stop the retry loop.
      return jsonResponse(200, {
        received: true,
        ignored: true,
        reason: error.code,
      })
    }

    return jsonResponse(500, { error: "processing_failed" })
  }
}
