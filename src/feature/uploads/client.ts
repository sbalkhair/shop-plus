import { generateReactHelpers } from "@uploadthing/react"

import type { UploadRouter } from "./uploadthing"

/**
 * Typed UploadThing hook. The router import is type-only, so no server code
 * (token, middleware, auth) is bundled into the client.
 */
export const { useUploadThing } = generateReactHelpers<UploadRouter>()
