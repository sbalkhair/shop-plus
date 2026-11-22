import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  decryptDeliveryOtp,
  deliveryOtpMatches,
  encryptDeliveryOtp,
  formatDeliveryOtp,
  generateDeliveryOtp,
  hashDeliveryOtp,
} from "./crypto"
import { getDeliveryOtpEnv, resetDeliveryOtpEnvForTests } from "./env"

const SECRET = "a".repeat(64)

beforeEach(() => {
  process.env.DELIVERY_OTP_SECRET = SECRET
  process.env.DELIVERY_OTP_TTL_MINUTES = "60"
  process.env.DELIVERY_OTP_MAX_ATTEMPTS = "5"
  resetDeliveryOtpEnvForTests()
})

afterEach(() => {
  delete process.env.DELIVERY_OTP_SECRET
  delete process.env.DELIVERY_OTP_TTL_MINUTES
  delete process.env.DELIVERY_OTP_MAX_ATTEMPTS
  resetDeliveryOtpEnvForTests()
})

describe("delivery OTP environment", () => {
  it("applies the default expiry and attempt policy", () => {
    delete process.env.DELIVERY_OTP_TTL_MINUTES
    delete process.env.DELIVERY_OTP_MAX_ATTEMPTS
    resetDeliveryOtpEnvForTests()

    expect(getDeliveryOtpEnv()).toMatchObject({
      DELIVERY_OTP_TTL_MINUTES: 60,
      DELIVERY_OTP_MAX_ATTEMPTS: 5,
    })
  })

  it("fails closed when the secret is missing or too short", () => {
    process.env.DELIVERY_OTP_SECRET = "too-short"
    resetDeliveryOtpEnvForTests()

    expect(() => getDeliveryOtpEnv()).toThrow(/DELIVERY_OTP_SECRET/)
  })
})

describe("delivery OTP generation", () => {
  it("formats values with leading zeros", () => {
    expect(formatDeliveryOtp(0)).toBe("000000")
    expect(formatDeliveryOtp(42)).toBe("000042")
    expect(formatDeliveryOtp(999999)).toBe("999999")
  })

  it("rejects out-of-range values", () => {
    expect(() => formatDeliveryOtp(-1)).toThrow()
    expect(() => formatDeliveryOtp(1_000_000)).toThrow()
    expect(() => formatDeliveryOtp(1.5)).toThrow()
  })

  it("always generates exactly six digits", () => {
    for (let index = 0; index < 2_000; index += 1) {
      expect(generateDeliveryOtp()).toMatch(/^\d{6}$/)
    }
  })
})

describe("delivery OTP hashing", () => {
  it("matches the correct code and rejects everything else", () => {
    const hash = hashDeliveryOtp("004271")

    expect(deliveryOtpMatches("004271", hash)).toBe(true)
    expect(deliveryOtpMatches("004272", hash)).toBe(false)
    expect(deliveryOtpMatches("4271", hash)).toBe(false)
    expect(deliveryOtpMatches("004271 ", hash)).toBe(false)
    expect(deliveryOtpMatches("abcdef", hash)).toBe(false)
    expect(deliveryOtpMatches("004271", "not-a-hash")).toBe(false)
  })

  it("produces a stable keyed hash and changes with the secret", () => {
    const first = hashDeliveryOtp("123456")

    expect(hashDeliveryOtp("123456")).toBe(first)

    process.env.DELIVERY_OTP_SECRET = "b".repeat(64)
    resetDeliveryOtpEnvForTests()

    expect(hashDeliveryOtp("123456")).not.toBe(first)
  })
})

describe("delivery OTP encryption", () => {
  it("round-trips the code", () => {
    expect(decryptDeliveryOtp(encryptDeliveryOtp("000042"))).toBe("000042")
  })

  it("uses a fresh IV for every encryption", () => {
    expect(encryptDeliveryOtp("123456")).not.toBe(encryptDeliveryOtp("123456"))
  })

  it("rejects tampered or malformed payloads", () => {
    const payload = encryptDeliveryOtp("123456")
    const parts = payload.split(".")
    const last = parts[3].slice(-1)
    parts[3] = `${parts[3].slice(0, -1)}${last === "A" ? "B" : "A"}`

    expect(() => decryptDeliveryOtp(parts.join("."))).toThrow()
    expect(() => decryptDeliveryOtp("garbage")).toThrow()
    expect(() => decryptDeliveryOtp("v1.a.b.c")).toThrow()
  })
})
