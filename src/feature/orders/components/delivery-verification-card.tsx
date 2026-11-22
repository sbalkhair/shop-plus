import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatOrderDate,
  type DeliveryVerificationView,
} from "@/feature/orders/types"
import { CircleCheckIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react"

interface DeliveryVerificationCardProps {
  verification: DeliveryVerificationView
  /** Only the order owner ever receives the code. */
  revealCode: boolean
}

const statusLabel: Record<DeliveryVerificationView["status"], string> = {
  awaiting: "Awaiting confirmation",
  verified: "Confirmed",
  expired: "Expired",
  locked: "Locked",
}

const statusDescription: Record<DeliveryVerificationView["status"], string> = {
  awaiting:
    "The assigned driver will confirm the hand-off with the customer's code.",
  verified: "The hand-off was confirmed and the order is delivered.",
  expired: "The code expired before delivery. An admin can issue a new code.",
  locked:
    "The code was locked after too many incorrect attempts. An admin can issue a new code.",
}

export function DeliveryVerificationCard({
  verification,
  revealCode,
}: DeliveryVerificationCardProps) {
  const showCode =
    revealCode && verification.status === "awaiting" && verification.code

  return (
    <Card className="gap-3 border-orange-200 bg-orange-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {showCode ? (
            <KeyRoundIcon className="size-4 text-orange-500" />
          ) : verification.status === "verified" ? (
            <CircleCheckIcon className="size-4 text-green-600" />
          ) : (
            <ShieldCheckIcon className="size-4 text-orange-500" />
          )}
          {showCode ? "Delivery Verification Code" : "Delivery verification"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {showCode ? (
          <>
            <p className="font-mono text-3xl font-semibold tracking-[0.3em]">
              {verification.code}
            </p>
            <p className="text-sm font-medium">Your order is on its way!</p>
            <p className="text-xs text-muted-foreground">
              Share this code with the delivery driver after receiving your
              order.
            </p>
          </>
        ) : (
          <>
            <Badge
              variant={
                verification.status === "verified" ? "secondary" : "outline"
              }
            >
              {statusLabel[verification.status]}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {statusDescription[verification.status]}
            </p>
            {!revealCode && (
              <p className="text-xs text-muted-foreground">
                The customer&apos;s code is only shown on their tracking page.
              </p>
            )}
          </>
        )}

        {verification.status === "awaiting" && (
          <p className="text-xs text-muted-foreground">
            Expires {formatOrderDate(verification.expiresAt)} ·{" "}
            {verification.attemptsRemaining}{" "}
            {verification.attemptsRemaining === 1 ? "attempt" : "attempts"}{" "}
            remaining
          </p>
        )}

        {verification.status === "verified" && verification.verifiedAt && (
          <p className="text-xs text-muted-foreground">
            Confirmed {formatOrderDate(verification.verifiedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
