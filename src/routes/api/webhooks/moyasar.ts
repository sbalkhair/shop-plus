import { handleMoyasarWebhook } from "@/feature/payments/webhook"
import { createFileRoute } from "@tanstack/react-router"

/**
 * Moyasar webhook endpoint.
 *
 * Configure this URL in the Moyasar dashboard:
 *   POST https://<host>/api/webhooks/moyasar
 *
 * Authentication is performed inside the handler with the merchant-chosen
 * webhook secret, then every event is re-verified against the Moyasar API.
 */
export const Route = createFileRoute("/api/webhooks/moyasar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) =>
        handleMoyasarWebhook(request),
    },
  },
})
