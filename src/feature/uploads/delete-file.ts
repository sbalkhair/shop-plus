import "dotenv/config"

import { UTApi } from "uploadthing/server"

import { getUploadThingFileKey } from "./file-key"

let utapi: UTApi | null = null

const getUtapi = (): UTApi => {
  utapi ??= new UTApi()
  return utapi
}

/**
 * Deletes the UploadThing file referenced by a public URL.
 *
 * Returns `false` when the URL is not an UploadThing file, so callers can skip
 * cleanup for external images. Throws when UploadThing rejects the deletion;
 * callers decide whether that should surface to the user.
 */
export const deleteUploadThingFileByUrl = async (
  url: string
): Promise<boolean> => {
  const key = getUploadThingFileKey(url)

  if (!key) {
    return false
  }

  const result = await getUtapi().deleteFiles(key)

  if (!result.success) {
    throw new Error(`UploadThing could not delete file "${key}"`)
  }

  return true
}
