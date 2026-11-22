import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Tracking lives at `/order-tracking/$orderId`. Keep the old list URL useful by
 * sending visitors to their order list, where every order links to tracking.
 */
export const Route = createFileRoute("/(main)/(protected)/order-tracking/")({
  beforeLoad: () => {
    throw redirect({ to: "/orders" })
  },
})
