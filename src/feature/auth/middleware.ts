import { createMiddleware } from "@tanstack/react-start"
import { ForbiddenError, UnauthorizedError } from "./errors"
import { hasPermissions, type Permission } from "./permissions"
import { hasRole, type AuthUser, type UserRole } from "./roles"

/**
 * Sets the HTTP status for the current server-function response before
 * throwing.
 *
 * Function-middleware errors are serialized into the response body by Start,
 * which would otherwise leave the status at `200`. `setResponseStatus` applies
 * to body-bearing statuses such as `401`/`403`, so the client still decodes
 * the serialized error while the wire response carries the correct status.
 */
const rejectWith = async (error: UnauthorizedError | ForbiddenError) => {
  // Kept dynamic so the server-only entry is never evaluated in client bundles.
  const { setResponseStatus } = await import("@tanstack/react-start/server")
  setResponseStatus(error.status)
  throw error
}

/**
 * Optional-session middleware.
 *
 * Reads the Better Auth session from the request cookies and exposes either
 * the authenticated user or `null` through context. Use this for endpoints
 * that behave differently for signed-in users but do not require a session.
 */
export const sessionMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getAuthSession } = await import("./server")
    const sessionResult = await getAuthSession()

    return next({
      context: {
        user: sessionResult?.user ?? null,
        session: sessionResult?.session ?? null,
      },
    })
  }
)

/**
 * Authentication middleware.
 *
 * Must be attached to every server function that reads or mutates private
 * data. It rejects anonymous requests with an HTTP `401`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user || !context.session) {
      return rejectWith(new UnauthorizedError())
    }

    return next({
      context: {
        user: context.user,
        session: context.session,
      },
    })
  })

interface AuthorizationPolicy {
  permissions?: readonly [Permission, ...Permission[]]
  roles?: readonly [UserRole, ...UserRole[]]
}

const isAllowed = (
  user: AuthUser,
  permissions: AuthorizationPolicy["permissions"],
  roles: AuthorizationPolicy["roles"]
): boolean => {
  if (permissions) {
    return hasPermissions(user, permissions)
  }

  if (roles) {
    return hasRole(user, roles)
  }

  return false
}

/**
 * Authorization middleware. Must be attached after authentication (it includes
 * `authMiddleware` automatically).
 *
 * Supports permission-based policies (preferred) and role-based policies as an
 * optional alternative. Rejections produce an HTTP `403`.
 *
 * @example
 * authorizationMiddleware({ permissions: ["orders:create"] })
 * authorizationMiddleware({ roles: ["admin"] })
 */
export const authorizationMiddleware = (policy: AuthorizationPolicy) => {
  const { permissions, roles } = policy

  if ((permissions === undefined) === (roles === undefined)) {
    throw new Error(
      "authorizationMiddleware requires exactly one of permissions or roles."
    )
  }

  if (permissions?.length === 0 || roles?.length === 0) {
    throw new Error(
      "authorizationMiddleware requires at least one permission or role."
    )
  }

  return createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!isAllowed(context.user, permissions, roles)) {
        return rejectWith(new ForbiddenError())
      }

      return next()
    })
}
