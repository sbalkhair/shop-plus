import { afterEach, describe, expect, it } from "vitest"
import { getMoyasarEnv, moyasarEnvSchema, resetMoyasarEnvCache } from "./env"

const validEnv = {
  MOYASAR_PUBLISHABLE_KEY: "pk_test_abc123",
  MOYASAR_SECRET_KEY: "sk_test_abc123",
  MOYASAR_WEBHOOK_SECRET: "a".repeat(32),
}

describe("Moyasar environment validation", () => {
  it("accepts sandbox credentials and defaults the base URL", () => {
    const parsed = moyasarEnvSchema.parse(validEnv)

    expect(parsed.MOYASAR_BASE_URL).toBe("https://api.moyasar.com/v1")
    expect(parsed.MOYASAR_CALLBACK_URL).toBeUndefined()
  })

  it("rejects live credentials", () => {
    expect(
      moyasarEnvSchema.safeParse({
        ...validEnv,
        MOYASAR_PUBLISHABLE_KEY: "pk_live_abc123",
      }).success
    ).toBe(false)

    expect(
      moyasarEnvSchema.safeParse({
        ...validEnv,
        MOYASAR_SECRET_KEY: "sk_live_abc123",
      }).success
    ).toBe(false)
  })

  it("requires a reasonably long webhook secret", () => {
    expect(
      moyasarEnvSchema.safeParse({
        ...validEnv,
        MOYASAR_WEBHOOK_SECRET: "short",
      }).success
    ).toBe(false)
  })

  it("accepts an optional callback URL and rejects an invalid one", () => {
    expect(
      moyasarEnvSchema.parse({
        ...validEnv,
        MOYASAR_CALLBACK_URL: "https://shop.example.com/payment-result",
      }).MOYASAR_CALLBACK_URL
    ).toBe("https://shop.example.com/payment-result")

    expect(
      moyasarEnvSchema.safeParse({
        ...validEnv,
        MOYASAR_CALLBACK_URL: "not-a-url",
      }).success
    ).toBe(false)
  })

  describe("getMoyasarEnv", () => {
    const original = { ...process.env }

    afterEach(() => {
      process.env = { ...original }
      resetMoyasarEnvCache()
    })

    it("fails closed without exposing rejected values", () => {
      delete process.env.MOYASAR_PUBLISHABLE_KEY
      delete process.env.MOYASAR_SECRET_KEY
      delete process.env.MOYASAR_WEBHOOK_SECRET
      resetMoyasarEnvCache()

      expect(() => getMoyasarEnv()).toThrow(/not configured/i)

      try {
        getMoyasarEnv()
      } catch (error) {
        expect(String((error as Error).message)).not.toContain(
          "MOYASAR_SECRET_KEY="
        )
      }
    })

    it("returns validated values and caches them", () => {
      process.env.MOYASAR_PUBLISHABLE_KEY = validEnv.MOYASAR_PUBLISHABLE_KEY
      process.env.MOYASAR_SECRET_KEY = validEnv.MOYASAR_SECRET_KEY
      process.env.MOYASAR_WEBHOOK_SECRET = validEnv.MOYASAR_WEBHOOK_SECRET
      resetMoyasarEnvCache()

      const first = getMoyasarEnv()

      process.env.MOYASAR_SECRET_KEY = "sk_test_changed"

      expect(getMoyasarEnv()).toBe(first)
      expect(first.MOYASAR_SECRET_KEY).toBe(validEnv.MOYASAR_SECRET_KEY)
    })
  })
})
