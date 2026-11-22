import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DeliveryPartner } from "@/types"
import { BikeIcon, MailIcon, PhoneIcon, TruckIcon } from "lucide-react"

interface DeliveryPartnerCardProps {
  partner: DeliveryPartner
}

const vehicleLabel = (vehicleType: DeliveryPartner["vehicleType"]) =>
  vehicleType === "car" ? "Car" : vehicleType === "scooter" ? "Scooter" : "Bike"

export function DeliveryPartnerCard({ partner }: DeliveryPartnerCardProps) {
  const VehicleIcon = partner.vehicleType === "car" ? TruckIcon : BikeIcon

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <VehicleIcon className="size-4 text-orange-500" />
          Delivery partner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-600">
            {partner.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{partner.name}</p>
            <Badge variant="outline" className="mt-1">
              {vehicleLabel(partner.vehicleType)}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <a
            href={`tel:${partner.phone}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <PhoneIcon className="size-3.5 shrink-0" />
            {partner.phone}
          </a>
          <a
            href={`mailto:${partner.email}`}
            className="flex items-center gap-2 break-all text-muted-foreground hover:text-foreground"
          >
            <MailIcon className="size-3.5 shrink-0" />
            {partner.email}
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
