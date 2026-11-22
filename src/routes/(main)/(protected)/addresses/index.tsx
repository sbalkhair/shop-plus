import { Button, buttonVariants } from "@/components/ui/button"
import { addressesQueryOptions } from "@/feature/addresses/api/addresses-query"
import { requireCustomer } from "@/feature/auth/guards"
import { AddressCard } from "@/feature/addresses/components/address-card"
import { AddressForm } from "@/feature/addresses/components/address-form"
import type { Address } from "@/types"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { cn } from "cn"
import { MapPinIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

export const Route = createFileRoute("/(main)/(protected)/addresses/")({
  beforeLoad: ({ context, location }) =>
    requireCustomer(context, location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(addressesQueryOptions),
  component: RouteComponent,
})

function RouteComponent() {
  const addresses = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)

  const openCreateForm = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEditForm = (address: Address) => {
    setEditing(address)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const handleSaved = () => {
    closeForm()
    void router.invalidate()
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MapPinIcon className="size-6 text-orange-500" />
            My addresses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {addresses.length === 0
              ? "Save a delivery address to make checkout faster."
              : `${addresses.length} saved address${addresses.length === 1 ? "" : "es"}. Your default address is preselected at checkout.`}
          </p>
        </div>

        {!formOpen && (
          <Button onClick={openCreateForm}>
            <PlusIcon />
            Add address
          </Button>
        )}
      </div>

      {formOpen && (
        <div className="mt-6">
          <AddressForm
            key={editing?.id ?? "new"}
            address={editing ?? undefined}
            defaults={{
              fullName: user.name,
              phone: user.phone ?? "",
              email: user.email,
            }}
            onSaved={handleSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      {addresses.length === 0 ? (
        !formOpen && (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
            <MapPinIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No saved addresses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your home, work, or any other delivery address.
            </p>
            <Button className="mt-4" onClick={openCreateForm}>
              <PlusIcon />
              Add your first address
            </Button>
          </div>
        )
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={openEditForm}
            />
          ))}
        </div>
      )}

      {addresses.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need to update an order already on its way?{" "}
          <Link
            to="/orders"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-auto p-0 text-xs"
            )}
          >
            View your orders
          </Link>
        </p>
      )}
    </div>
  )
}
