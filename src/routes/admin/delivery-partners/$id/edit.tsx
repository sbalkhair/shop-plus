import { getDeliveryPartner } from "@/feature/delivery-partners/api/delivery-partners"
import { DeliveryPartnerForm } from "@/feature/delivery-partners/components/delivery-partner-form"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router"

export const Route = createFileRoute("/admin/delivery-partners/$id/edit")({
  loader: async ({ params }) => {
    const partner = await getDeliveryPartner({ data: { id: params.id } })

    if (!partner) {
      throw notFound()
    }

    return { partner }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { partner } = Route.useLoaderData()
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
        <h1 className="mt-3 text-2xl font-semibold">Edit delivery partner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details for &quot;{partner.name}&quot;.
        </p>
      </div>

      <DeliveryPartnerForm
        key={partner.id}
        partner={partner}
        onSaved={() => {
          void navigate({ to: "/admin/delivery-partners" })
        }}
      />
    </div>
  )
}
