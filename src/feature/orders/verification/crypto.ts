import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"
import { getDeliveryOtpEnv } from "./env"

/**
 * Delivery codes are exactly six digits, including leading zeros.
 *
 * `randomInt` is backed by the CSPRNG. The numeric range is chosen so every
 * value from 000000 to 999999 is equally likely.
 */
export const DELIVERY_OTP_LENGTH = 6
export const DELIVERY_OTP_CODE_PATTERN = /^\d{6}$/

export const formatDeliveryOtp = (value: number): string => {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value >= 10 ** DELIVERY_OTP_LENGTH
  ) {
    throw new Error("Delivery OTP value is out of range.")
  }

  return String(value).padStart(DELIVERY_OTP_LENGTH, "0")
}

export const generateDeliveryOtp = (): string =>
  formatDeliveryOtp(randomInt(0, 10 ** DELIVERY_OTP_LENGTH))

const HKDF_SALT = Buffer.from("shop-plus:delivery-otp:v1", "utf8")
const HMAC_INFO = Buffer.from("delivery-otp:hmac", "utf8")
const ENCRYPTION_INFO = Buffer.from("delivery-otp:encryption", "utf8")
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

interface DerivedKeys {
  hmacKey: Buffer
  encryptionKey: Buffer
}

const keyCache = new Map<string, DerivedKeys>()

const deriveKeys = (secret: string): DerivedKeys => {
  const cached = keyCache.get(secret)

  if (cached) {
    return cached
  }

  const keys: DerivedKeys = {
    hmacKey: Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, HMAC_INFO, 32)),
    encryptionKey: Buffer.from(
      hkdfSync("sha256", secret, HKDF_SALT, ENCRYPTION_INFO, 32)
    ),
  }

  keyCache.set(secret, keys)

  return keys
}

const keys = (): DerivedKeys =>
  deriveKeys(getDeliveryOtpEnv().DELIVERY_OTP_SECRET)

/**
 * Keyed hash used for constant-time verification. A plain hash would let an
 * attacker brute-force all one million possible codes offline.
 */
export const hashDeliveryOtp = (code: string): string =>
  createHmac("sha256", keys().hmacKey).update(code, "utf8").digest("hex")

export const deliveryOtpMatches = (
  code: string,
  expectedHash: string
): boolean => {
  if (!DELIVERY_OTP_CODE_PATTERN.test(code)) {
    return false
  }

  const provided = Buffer.from(hashDeliveryOtp(code), "hex")
  const expected = Buffer.from(expectedHash, "hex")

  if (provided.length !== expected.length || expected.length === 0) {
    return false
  }

  return timingSafeEqual(provided, expected)
}

/**
 * Only the order owner receives the plaintext code, so it must be recoverable
 * server-side. AES-256-GCM keeps it confidential at rest and detects tampering.
 */
export const encryptDeliveryOtp = (code: string): string => {
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv("aes-256-gcm", keys().encryptionKey, iv)
  const ciphertext = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export const decryptDeliveryOtp = (payload: string): string => {
  const parts = payload.split(".")

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid delivery verification payload.")
  }

  const iv = Buffer.from(parts[1], "base64url")
  const authTag = Buffer.from(parts[2], "base64url")
  const ciphertext = Buffer.from(parts[3], "base64url")

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid delivery verification payload.")
  }

  const decipher = createDecipheriv("aes-256-gcm", keys().encryptionKey, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8")

  if (!DELIVERY_OTP_CODE_PATTERN.test(plaintext)) {
    throw new Error("Invalid delivery verification payload.")
  }

  return plaintext
}
