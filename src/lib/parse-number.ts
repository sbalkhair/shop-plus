export const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value)
    if (Number.isFinite(number)) {
      return number
    }
  }

  return undefined
}

/** Mirrors the upper bound used by the server-side pagination schemas. */
export const MAX_PAGE = 100_000

/**
 * Normalizes an untrusted, 1-based route `page` param. Invalid values are
 * dropped so the server schema can apply its default instead of rejecting the
 * request.
 */
export const parsePage = (value: unknown): number | undefined => {
  const page = parseNumber(value)

  if (page === undefined) {
    return undefined
  }

  const normalized = Math.floor(page)

  return normalized >= 1 ? Math.min(normalized, MAX_PAGE) : undefined
}
