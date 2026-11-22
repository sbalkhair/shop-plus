import { formatOrderDate, type OrderStatusEvent } from "../types"
import { CircleCheckIcon, ClockIcon } from "lucide-react"

interface OrderTimelineProps {
  history: OrderStatusEvent[]
}

/** Oldest-to-newest status history rendered as a vertical timeline. */
export function OrderTimeline({ history }: OrderTimelineProps) {
  return (
    <ol className="relative space-y-5 border-l border-zinc-200 pl-6">
      {history.map((event, index) => {
        const isLatest = index === history.length - 1

        return (
          <li key={`${event.timestamp}-${index}`} className="relative">
            <span className="absolute top-0.5 -left-[1.9rem] flex size-6 items-center justify-center rounded-full bg-white">
              {isLatest && event.status !== "Delivered" ? (
                <ClockIcon className="size-4 text-orange-500" />
              ) : (
                <CircleCheckIcon className="size-4 text-green-600" />
              )}
            </span>
            <p className="text-sm font-medium">{event.status}</p>
            <p className="text-xs text-muted-foreground">
              {formatOrderDate(event.timestamp)}
            </p>
            {event.note && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.note}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
