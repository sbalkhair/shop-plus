import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { setDefaultAddress } from "@/feature/addresses/api/addresses"
import type { Address } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { CheckIcon, MapPinIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { DeleteAddressButton } from "./delete-address-button"

interface AddressCardProps {
  address: Address
  onEdit: (address: Address) => void
}

export function AddressCard({ address, onEdit }: AddressCardProps) {
  const router = useRouter()

  const setDefaultMutation = useMutation({
    mutationFn: () => setDefaultAddress({ data: { id: address.id } }),
    onSuccess: async () => {
      toast.success(`"${address.label}" is now your default address`)
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the default address"
      )
    },
  })

  return (
    <Card
      className={
        address.isDefault
          ? "border-orange-300 ring-1 ring-orange-200"
          : undefined
      }
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <MapPinIcon className="size-4 text-orange-500" />
              {address.label}
              {address.isDefault && <Badge variant="secondary">Default</Badge>}
            </CardTitle>
            <CardDescription className="mt-1">
              {address.fullName} · {address.phone}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{address.address}</p>
        <p className="text-sm text-muted-foreground">
          {address.city}, {address.state} {address.zip}
        </p>
        {address.notes && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {address.notes}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!address.isDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefaultMutation.mutate()}
              disabled={setDefaultMutation.isPending}
            >
              {setDefaultMutation.isPending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                <>
                  <CheckIcon />
                  Set as default
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(address)}>
            <PencilIcon />
            Edit
          </Button>
          <DeleteAddressButton address={address} />
        </div>
      </CardContent>
    </Card>
  )
}
