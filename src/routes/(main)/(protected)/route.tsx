import { requireAuth } from "@/feature/auth/guards"
import { createFileRoute, Outlet } from "@tanstack/react-router"

/**
 * Layout route for all pages that require a signed-in user.
 *
 * Keeping the guard here means individual child routes cannot forget it.
 */
export const Route = createFileRoute("/(main)/(protected)")({
  beforeLoad: ({ context, location }) => requireAuth(context, location.href),
  component: Outlet,
})
