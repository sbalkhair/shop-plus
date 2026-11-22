import "dotenv/config"

import { UploadThingError, createUploadthing } from "uploadthing/server"
import type { FileRouter } from "uploadthing/server"

/**
 * UploadThing file router.
 *
 * Only admins may upload product or category images. Authentication is
 * enforced here, on the server, from the request cookies; the client-side
 * check is a UX nicety only and must never be trusted.
 */

const f = createUploadthing()

const adminOnly = async ({ req }: { req: Request }) => {
  // Loaded per request so importing the router does not initialize the
  // Prisma-backed auth module (the upload route itself is also lazy).
  const { auth } = await import("@/lib/auth")

  const session = await auth.api.getSession({ headers: req.headers })

  if (!session?.user.isAdmin) {
    throw new UploadThingError("Only admins can upload images.")
  }

  return { userId: session.user.id }
}

const imageRoute = {
  image: {
    maxFileSize: "4MB",
    maxFileCount: 1,
  },
} as const

export const uploadRouter = {
  productImage: f(imageRoute)
    .middleware(adminOnly)
    .onUploadComplete(async ({ metadata, file }) => {
      // The client only receives this `serverData` payload, never a secret.
      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
      }
    }),
  categoryImage: f(imageRoute)
    .middleware(adminOnly)
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
      }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
