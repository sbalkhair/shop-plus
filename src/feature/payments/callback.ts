/**
 * Moyasar rejects `callback_url` values that are not publicly reachable
 * domains. These helpers let the server fail fast with an actionable message
 * instead of forwarding a local URL to the provider.
 */

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

export const isPrivateCallbackHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")

  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(host))
  )
}

export const assertPublicCallbackUrl = (
  url: URL,
  hint = "Set MOYASAR_CALLBACK_URL to your public tunnel URL (see `bun run dev:tunnel`)."
): void => {
  if (url.protocol !== "https:") {
    throw new Error(`Moyasar requires an HTTPS callback URL. ${hint}`)
  }

  if (isPrivateCallbackHost(url.hostname)) {
    throw new Error(
      `Moyasar requires a public callback domain, so localhost cannot be used. ${hint}`
    )
  }
}
