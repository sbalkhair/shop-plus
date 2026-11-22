import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDeliveryPartners } from "@/feature/delivery-partners/api/delivery-partners"
import { DeleteDeliveryPartnerButton } from "@/feature/delivery-partners/components/delete-delivery-partner-button"
import type { DeliveryPartner } from "@/types"
import { createFileRoute, Link } from "@tanstack/react-router"
import { cn } from "cn"
import { BikeIcon, PencilIcon, PlusIcon, TruckIcon } from "lucide-react"

export const Route = createFileRoute("/admin/delivery-partners/")({
  loader: () => getDeliveryPartners(),
  component: RouteComponent,
})

const vehicleLabel = (vehicleType: DeliveryPartner["vehicleType"]) =>
  vehicleType === "car" ? "Car" : vehicleType === "scooter" ? "Scooter" : "Bike"

function RouteComponent() {
  const partners = Route.useLoaderData()
  const activeCount = partners.filter((partner) => partner.isActive).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <TruckIcon className="size-6 text-orange-500" />
            Delivery partners
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {partners.length === 0
              ? "No delivery partners yet."
              : `${partners.length} partner${partners.length === 1 ? "" : "s"} · ${activeCount} active`}
          </p>
        </div>

        <Link
          to="/admin/delivery-partners/new"
          className={cn(buttonVariants())}
        >
          <PlusIcon />
          Add partner
        </Link>
      </div>

      {partners.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
          <TruckIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No delivery partners yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a courier so you can assign them to customer orders.
          </p>
          <Link
            to="/admin/delivery-partners/new"
            className={cn(buttonVariants(), "mt-4")}
          >
            <PlusIcon />
            Add partner
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => {
                  const VehicleIcon =
                    partner.vehicleType === "car" ? TruckIcon : BikeIcon

                  return (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-600">
                            {partner.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {partner.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {partner.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{partner.phone}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <VehicleIcon className="size-4 text-muted-foreground" />
                          {vehicleLabel(partner.vehicleType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={partner.isActive ? "secondary" : "outline"}
                        >
                          {partner.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to="/admin/delivery-partners/$id/edit"
                            params={{ id: partner.id }}
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "icon",
                              })
                            )}
                            aria-label={`Edit ${partner.name}`}
                          >
                            <PencilIcon />
                          </Link>
                          <DeleteDeliveryPartnerButton partner={partner} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
