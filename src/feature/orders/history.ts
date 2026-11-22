import { statusHistorySchema } from "./schema"
import type { OrderStatusEvent } from "./types"

/**
 * JSON columns are validated before they reach the UI. Orders created before
 * tracking existed still get a usable single-entry timeline.
 */
export const parseStatusHistory = (
  value: unknown,
  fallback: { status: string; createdAt: Date }
): OrderStatusEvent[] => {
  const parsed = statusHistorySchema.safeParse(value)

  if (parsed.success && parsed.data.length > 0) {
    return parsed.data
  }

  return [
    {
      status: fallback.status,
      timestamp: fallback.createdAt.toISOString(),
      note: "Order created",
    },
  ]
}
