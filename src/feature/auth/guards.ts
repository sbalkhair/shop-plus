import { redirect } from "@tanstack/react-router"
import { hasRole, type AuthUser } from "./roles"

interface AuthRouteContext {
  currentUser: AuthUser | null
}

/**
 * Route guard for pages that require a signed-in user.
 *
 * This is for navigation/UX only. Data endpoints must still enforce
 * authentication through `authMiddleware`/`authorizationMiddleware`.
 */
export const requireAuth = (
  context: AuthRouteContext,
  locationHref: string
): { user: AuthUser } => {
  if (!context.currentUser) {
    throw redirect({
      to: "/login",
      search: { redirect: locationHref },
    })
  }

  return { user: context.currentUser }
}

/**
 * Route guard for customer-only pages such as saved addresses and the
 * customer's own order history. Admins and drivers have dedicated areas.
 */
export const requireCustomer = (
  context: AuthRouteContext,
  locationHref: string
): { user: AuthUser } => {
  const { user } = requireAuth(context, locationHref)

  if (!hasRole(user, ["customer"])) {
    throw redirect({ to: "/" })
  }

  return { user }
}

/**
 * Route guard for pages that require the admin role.
 */
export const requireAdmin = (
  context: AuthRouteContext,
  locationHref: string
): { user: AuthUser } => {
  const { user } = requireAuth(context, locationHref)

  if (!hasRole(user, ["admin"])) {
    throw redirect({ to: "/" })
  }

  return { user }
}

/**
 * Route guard for the driver portal. Drivers are a separate role and cannot
 * access customer or admin pages.
 */
export const requireDriver = (
  context: AuthRouteContext,
  locationHref: string
): { user: AuthUser } => {
  const { user } = requireAuth(context, locationHref)

  if (!hasRole(user, ["driver"])) {
    throw redirect({ to: "/" })
  }

  return { user }
}
