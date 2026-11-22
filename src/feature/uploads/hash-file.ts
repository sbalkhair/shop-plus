/**
 * Extensions for the image types accepted by the UploadThing router. Keeping
 * this mapping (instead of trusting the uploaded filename) makes the generated
 * name predictable and avoids leaking the original name.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

const FALLBACK_EXTENSION = /\.([a-z0-9]{1,8})$/i

const getExtension = (file: File): string => {
  const fromMime = EXTENSION_BY_MIME[file.type]

  if (fromMime) {
    return fromMime
  }

  return FALLBACK_EXTENSION.exec(file.name)?.[1]?.toLowerCase() ?? "bin"
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")

/**
 * Renames a file to a SHA-256 hash before it is uploaded.
 *
 * The digest covers the file contents plus 32 random bytes, so the result is a
 * real content hash while still being unique when the same image is uploaded
 * twice. The original filename never reaches UploadThing.
 */
export const hashFileName = async (file: File): Promise<File> => {
  const salt = new Uint8Array(32)
  crypto.getRandomValues(salt)

  const content = new Uint8Array(await file.arrayBuffer())
  const input = new Uint8Array(salt.length + content.length)
  input.set(salt)
  input.set(content, salt.length)

  const digest = await crypto.subtle.digest("SHA-256", input)
  const extension = getExtension(file)

  return new File([file], `${toHex(digest)}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  })
}
