import { createServerFn } from "@tanstack/react-start"
import { sessionMiddleware } from "../middleware"
import type { AuthUser } from "../roles"

/**
 * Returns the client-safe current user, or `null` when unauthenticated.
 *
 * Uses `sessionMiddleware` so the request session is read once and the result
 * is exposed through function context.
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context }): Promise<AuthUser | null> => context.user)
