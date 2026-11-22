import type { Prisma } from "@/generated/prisma/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  decryptDeliveryOtp,
  encryptDeliveryOtp,
  hashDeliveryOtp,
} from "./crypto"
import { getDeliveryOtpEnv, resetDeliveryOtpEnvForTests } from "./env"
import {
  deliveryVerificationStatus,
  invalidateDeliveryVerification,
  issueDeliveryVerification,
  toDeliveryVerificationView,
  type DeliveryVerificationRow,
} from "./service"

const SECRET = "a".repeat(64)
const NOW = new Date("2026-11-09T12:00:00.000Z")

const row = (
  overrides: Partial<DeliveryVerificationRow> = {}
): DeliveryVerificationRow => ({
  codeEncrypted: encryptDeliveryOtp("004271"),
  expiresAt: new Date(NOW.getTime() + 60_000),
  verifiedAt: null,
  attempts: 0,
  ...overrides,
})

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

describe("deliveryVerificationStatus", () => {
  it("is awaiting while unverified, unexpired, and under the attempt limit", () => {
    expect(deliveryVerificationStatus(row(), NOW)).toBe("awaiting")
    expect(deliveryVerificationStatus(row({ attempts: 4 }), NOW)).toBe(
      "awaiting"
    )
  })

  it("expires at the exact expiry instant", () => {
    expect(deliveryVerificationStatus(row({ expiresAt: NOW }), NOW)).toBe(
      "expired"
    )
    expect(
      deliveryVerificationStatus(
        row({ expiresAt: new Date(NOW.getTime() - 1) }),
        NOW
      )
    ).toBe("expired")
  })

  it("locks once the attempt limit is reached", () => {
    expect(deliveryVerificationStatus(row({ attempts: 5 }), NOW)).toBe("locked")
    expect(deliveryVerificationStatus(row({ attempts: 6 }), NOW)).toBe("locked")
  })

  it("prefers verified over expired and locked", () => {
    expect(
      deliveryVerificationStatus(
        row({ verifiedAt: NOW, expiresAt: NOW, attempts: 9 }),
        NOW
      )
    ).toBe("verified")
  })

  it("respects a configured attempt limit", () => {
    process.env.DELIVERY_OTP_MAX_ATTEMPTS = "2"
    resetDeliveryOtpEnvForTests()

    expect(deliveryVerificationStatus(row({ attempts: 1 }), NOW)).toBe(
      "awaiting"
    )
    expect(deliveryVerificationStatus(row({ attempts: 2 }), NOW)).toBe("locked")
  })
})

describe("toDeliveryVerificationView", () => {
  it("returns null when there is no verification", () => {
    expect(
      toDeliveryVerificationView(null, { revealCode: true }, NOW)
    ).toBeNull()
  })

  it("reveals the decrypted code to the owner while awaiting", () => {
    const view = toDeliveryVerificationView(row(), { revealCode: true }, NOW)

    expect(view).toMatchObject({
      status: "awaiting",
      code: "004271",
      verifiedAt: null,
      attemptsRemaining: 5,
    })
    expect(view?.expiresAt).toBe(new Date(NOW.getTime() + 60_000).toISOString())
  })

  it("never reveals the code to admins and drivers", () => {
    expect(
      toDeliveryVerificationView(row(), { revealCode: false }, NOW)?.code
    ).toBeNull()
  })

  it("hides the code after expiry", () => {
    const view = toDeliveryVerificationView(
      row({ expiresAt: new Date(NOW.getTime() - 1) }),
      { revealCode: true },
      NOW
    )

    expect(view?.status).toBe("expired")
    expect(view?.code).toBeNull()
  })

  it("hides the code when attempts are locked out", () => {
    const view = toDeliveryVerificationView(
      row({ attempts: 5 }),
      { revealCode: true },
      NOW
    )

    expect(view?.status).toBe("locked")
    expect(view?.code).toBeNull()
    expect(view?.attemptsRemaining).toBe(0)
  })

  it("hides the code after verification and reports the timestamp", () => {
    const view = toDeliveryVerificationView(
      row({ verifiedAt: NOW }),
      { revealCode: true },
      NOW
    )

    expect(view?.status).toBe("verified")
    expect(view?.code).toBeNull()
    expect(view?.verifiedAt).toBe(NOW.toISOString())
  })

  it("never exposes the hash or ciphertext", () => {
    const verification = row()
    const view = toDeliveryVerificationView(
      verification,
      { revealCode: false },
      NOW
    )
    const serialized = JSON.stringify(view)

    expect(serialized).not.toContain(verification.codeEncrypted)
    expect(serialized).not.toContain(hashDeliveryOtp("004271"))
    expect(serialized).not.toContain("codeHash")
    expect(serialized).not.toContain("codeEncrypted")
  })

  it("clamps attemptsRemaining at zero", () => {
    const view = toDeliveryVerificationView(
      row({ attempts: 9 }),
      { revealCode: false },
      NOW
    )

    expect(view?.attemptsRemaining).toBe(0)
    expect(getDeliveryOtpEnv().DELIVERY_OTP_MAX_ATTEMPTS).toBe(5)
  })

  it("hides a corrupt payload instead of breaking the page", () => {
    const view = toDeliveryVerificationView(
      row({ codeEncrypted: "v1.not.valid.payload" }),
      { revealCode: true },
      NOW
    )

    expect(view?.status).toBe("awaiting")
    expect(view?.code).toBeNull()
  })
})

describe("issueDeliveryVerification", () => {
  const createFakeTransaction = () => {
    let upsertArgs: unknown = null
    let deleteArgs: unknown = null

    const tx = {
      deliveryVerification: {
        upsert: (args: unknown) => {
          upsertArgs = args
          const { update } = args as { update: Record<string, unknown> }
          return Promise.resolve({ orderId: "order-1", ...update })
        },
        deleteMany: (args: unknown) => {
          deleteArgs = args
          return Promise.resolve({ count: 1 })
        },
      },
    }

    return {
      tx: tx as unknown as Prisma.TransactionClient,
      getUpsertArgs: () => upsertArgs,
      getDeleteArgs: () => deleteArgs,
    }
  }

  it("creates a fresh six-digit code with the configured expiry", async () => {
    const { tx, getUpsertArgs } = createFakeTransaction()

    const issued = await issueDeliveryVerification(tx, "order-1", NOW)

    const args = getUpsertArgs() as {
      where: { orderId: string }
      create: {
        orderId: string
        codeHash: string
        codeEncrypted: string
        expiresAt: Date
        attempts: number
        verifiedAt: Date | null
      }
      update: {
        codeHash: string
        codeEncrypted: string
        expiresAt: Date
        attempts: number
        verifiedAt: Date | null
      }
    }

    expect(args.where).toEqual({ orderId: "order-1" })
    expect(args.create.orderId).toBe("order-1")
    expect(args.create.expiresAt).toEqual(new Date(NOW.getTime() + 60 * 60_000))

    const code = decryptDeliveryOtp(args.create.codeEncrypted)

    expect(code).toMatch(/^\d{6}$/)
    expect(args.create.codeHash).toBe(hashDeliveryOtp(code))
    expect(issued.expiresAt).toEqual(args.create.expiresAt)
  })

  it("regenerating resets attempts and any previous confirmation", async () => {
    const { tx, getUpsertArgs } = createFakeTransaction()

    await issueDeliveryVerification(tx, "order-1", NOW)

    const args = getUpsertArgs() as {
      update: {
        attempts: number
        verifiedAt: Date | null
        lastAttemptAt: Date | null
        verifiedByDeliveryPartnerId: string | null
      }
    }

    expect(args.update).toMatchObject({
      attempts: 0,
      verifiedAt: null,
      lastAttemptAt: null,
      verifiedByDeliveryPartnerId: null,
    })
  })

  it("issues a different code each time", async () => {
    const { tx, getUpsertArgs } = createFakeTransaction()

    await issueDeliveryVerification(tx, "order-1", NOW)
    const first = getUpsertArgs() as {
      update: { codeEncrypted: string }
    }
    await issueDeliveryVerification(tx, "order-1", NOW)
    const second = getUpsertArgs() as {
      update: { codeEncrypted: string }
    }

    expect(first.update.codeEncrypted).not.toBe(second.update.codeEncrypted)
  })

  it("invalidates by deleting the order's verification", async () => {
    const { tx, getDeleteArgs } = createFakeTransaction()

    await invalidateDeliveryVerification(tx, "order-1")

    expect(getDeleteArgs()).toEqual({ where: { orderId: "order-1" } })
  })
})
