import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "cn"
import { NavigationIcon, MapPinIcon } from "lucide-react"
import {
  buildNavigationUrl,
  formatMapCoordinate,
  getShippingLocation,
} from "../location"
import { DeliveryLocationMap } from "./delivery-location-map"

interface DeliveryLocationAddress {
  address: string
  city: string
  state: string
  zip?: string
  notes?: string
  latitude?: number | null
  longitude?: number | null
}

interface DeliveryLocationCardProps {
  address: DeliveryLocationAddress | null
  title?: string
  description?: string
  /** Drivers get a one-tap Google Maps directions link. */
  showNavigation?: boolean
  className?: string
}

/**
 * Read-only delivery destination shared by customer tracking, driver details,
 * and the admin order view.
 */
export function DeliveryLocationCard({
  address,
  title = "Delivery location",
  description,
  showNavigation = false,
  className,
}: DeliveryLocationCardProps) {
  if (!address) {
    return null
  }

  const coordinate = getShippingLocation(address)
  const writtenAddress = [
    address.address,
    address.city,
    address.state,
    address.zip,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ")
  const navigationUrl = buildNavigationUrl({
    ...address,
    address: writtenAddress,
  })

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinIcon className="size-4 text-orange-500" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {coordinate ? (
          <DeliveryLocationMap value={coordinate} />
        ) : (
          <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            No map pin was saved for this order. Use the written address below
            for navigation.
          </p>
        )}

        <div>
          <p className="text-sm font-medium">{address.address}</p>
          <p className="text-xs text-muted-foreground">
            {[address.city, address.state, address.zip]
              .filter((part): part is string => Boolean(part))
              .join(", ")}
          </p>
          {coordinate && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatMapCoordinate(coordinate)}
            </p>
          )}
          {address.notes && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              “{address.notes}”
            </p>
          )}
        </div>

        {showNavigation && navigationUrl && (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm" })}
          >
            <NavigationIcon data-icon="inline-start" />
            Navigate with Google Maps
          </a>
        )}
      </CardContent>
    </Card>
  )
}
