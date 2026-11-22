import { z } from "zod"

/**
 * Moyasar sandbox configuration.
 *
 * Validation is lazy so that non-payment routes can still boot when the keys
 * have not been configured yet. Every payment entry point calls
 * `getMoyasarEnv()`, which fails closed with a clear message.
 *
 * Only test keys are accepted. This prevents an accidental live charge while
 * the integration is being validated.
 */
export const moyasarEnvSchema = z.object({
  MOYASAR_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .regex(
      /^pk_test_[A-Za-z0-9]+$/,
      "must be a sandbox publishable key (pk_test_...)"
    ),
  MOYASAR_SECRET_KEY: z
    .string()
    .trim()
    .regex(
      /^sk_test_[A-Za-z0-9]+$/,
      "must be a sandbox secret key (sk_test_...)"
    ),
  MOYASAR_WEBHOOK_SECRET: z
    .string()
    .trim()
    .min(16, "must be at least 16 characters"),
  MOYASAR_BASE_URL: z.url().default("https://api.moyasar.com/v1"),
  MOYASAR_CALLBACK_URL: z.url().optional(),
})

type MoyasarEnv = z.infer<typeof moyasarEnvSchema>

let cached: MoyasarEnv | null = null

export const getMoyasarEnv = (): MoyasarEnv => {
  if (cached) {
    return cached
  }

  const parsed = moyasarEnvSchema.safeParse({
    MOYASAR_PUBLISHABLE_KEY: process.env.MOYASAR_PUBLISHABLE_KEY,
    MOYASAR_SECRET_KEY: process.env.MOYASAR_SECRET_KEY,
    MOYASAR_WEBHOOK_SECRET: process.env.MOYASAR_WEBHOOK_SECRET,
    MOYASAR_BASE_URL: process.env.MOYASAR_BASE_URL,
    MOYASAR_CALLBACK_URL: process.env.MOYASAR_CALLBACK_URL || undefined,
  })

  if (!parsed.success) {
    const invalid = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ")

    // Never include the rejected values; they may be secrets.
    throw new Error(
      `Moyasar sandbox is not configured. Add valid MOYASAR_* values to .env (see .env.example). Invalid: ${invalid || "environment"}.`
    )
  }

  cached = parsed.data
  return cached
}

/** Test helper. Not used by application code. */
export const resetMoyasarEnvCache = (): void => {
  cached = null
}
