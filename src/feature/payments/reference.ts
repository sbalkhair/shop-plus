import { z } from "zod"

/**
 * The payment-intent description is locked by Moyasar at intent creation and is
 * shown to the merchant only (never to the payer). We use it as a server-side
 * reference that links a Moyasar payment back to our own records.
 *
 * `intent_id` is not present on the documented payment object, so this locked
 * description is the authoritative association.
 */
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

const REFERENCE_REGEX = new RegExp(
  `^shop-plus:order:(${UUID_PATTERN}):payment:(${UUID_PATTERN})$`,
  "i"
)

const uuidSchema = z.uuid()

export interface PaymentReference {
  orderId: string
  paymentId: string
}

export const buildPaymentReference = (reference: PaymentReference): string =>
  `shop-plus:order:${reference.orderId}:payment:${reference.paymentId}`

/**
 * Parses a locked intent description. Returns `null` for anything that is not
 * an exact, well-formed shop-plus reference. Callers must treat `null` as an
 * untrusted payment and refuse to process it.
 */
export const parsePaymentReference = (
  description: string | null | undefined
): PaymentReference | null => {
  if (typeof description !== "string") {
    return null
  }

  const match = REFERENCE_REGEX.exec(description.trim())

  if (!match) {
    return null
  }

  const [, orderId, paymentId] = match

  if (
    !uuidSchema.safeParse(orderId).success ||
    !uuidSchema.safeParse(paymentId).success
  ) {
    return null
  }

  return { orderId, paymentId }
}
