import { DeliveryPartnerForm } from "@/feature/delivery-partners/components/delivery-partner-form"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/delivery-partners/new")({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/admin/delivery-partners"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to delivery partners
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Add a delivery partner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Couriers you add here can be assigned to customer orders.
        </p>
      </div>

      <DeliveryPartnerForm
        onSaved={() => {
          void navigate({ to: "/admin/delivery-partners" })
        }}
      />
    </div>
  )
}
