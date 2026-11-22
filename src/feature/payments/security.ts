import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Compares a webhook secret without leaking length or content through timing.
 *
 * Both values are hashed first so `timingSafeEqual` always receives buffers of
 * equal length. The provided value is never logged.
 */
export const secretMatches = (provided: unknown, expected: string): boolean => {
  if (
    typeof provided !== "string" ||
    provided.length === 0 ||
    expected.length === 0
  ) {
    return false
  }

  const providedHash = createHash("sha256").update(provided, "utf8").digest()
  const expectedHash = createHash("sha256").update(expected, "utf8").digest()

  return timingSafeEqual(providedHash, expectedHash)
}
