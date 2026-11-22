/**
 * UploadThing serves files from `<appId>.ufs.sh/f/<fileKey>` (previously
 * `uploadthing.com` / `utfs.io`). The stored product only keeps the public URL,
 * so the deletion key is derived from it instead of adding another column.
 */
const UPLOADTHING_HOSTS = ["ufs.sh", "uploadthing.com", "utfs.io"] as const

const isUploadThingHost = (hostname: string) =>
  UPLOADTHING_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  )

/**
 * Returns the UploadThing file key for a public file URL, or `null` when the
 * URL is not an UploadThing file (for example seeded products that use
 * external image hosts).
 */
export const getUploadThingFileKey = (url: string): string | null => {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== "https:" || !isUploadThingHost(parsed.hostname)) {
    return null
  }

  const match = /^\/f\/([^/]+)$/.exec(parsed.pathname)

  if (!match) {
    return null
  }

  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}
