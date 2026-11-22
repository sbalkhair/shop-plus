import { createFileRoute } from "@tanstack/react-router"

/**
 * UploadThing route handler.
 *
 * Kept lazy so the server can boot, prerender, and build without the
 * UploadThing token present. The first request creates the handler once.
 */

type UploadHandler = (
  request: Request | { request: Request }
) => Promise<Response>

let handlerPromise: Promise<UploadHandler> | null = null

const getHandler = (): Promise<UploadHandler> => {
  handlerPromise ??= (async () => {
    const [{ createRouteHandler }, { uploadRouter }] = await Promise.all([
      import("uploadthing/server"),
      import("@/feature/uploads/uploadthing"),
    ])

    return createRouteHandler({ router: uploadRouter })
  })()

  return handlerPromise
}

export const Route = createFileRoute("/api/uploadthing")({
  server: {
    handlers: {
      GET: async ({ request }) => (await getHandler())(request),
      POST: async ({ request }) => (await getHandler())(request),
    },
  },
})
