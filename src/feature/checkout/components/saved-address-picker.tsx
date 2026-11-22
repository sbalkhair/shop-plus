import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Address } from "@/types"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { MapPinIcon } from "lucide-react"

interface SavedAddressPickerProps {
  addresses: Address[]
  selectedId: string
  onChange: (value: string) => void
}

/**
 * Saved-address radio list. The "new" option reveals the manual form, so the
 * caller owns the form state and only receives the selected id.
 */
export function SavedAddressPicker({
  addresses,
  selectedId,
  onChange,
}: SavedAddressPickerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-5 text-orange-500" />
          <CardTitle>Delivery address</CardTitle>
        </div>
        <CardDescription>
          Choose a saved address or enter a different one for this order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedId}
          onValueChange={onChange}
          className="grid gap-3"
        >
          {addresses.map((address) => {
            const active = selectedId === address.id

            return (
              <label
                key={address.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  active
                    ? "border-orange-400 bg-orange-50"
                    : "hover:bg-muted/40"
                )}
              >
                <RadioGroupItem value={address.id} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{address.label}</span>
                    {address.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm">
                    {address.address}, {address.city}, {address.state}{" "}
                    {address.zip}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {address.fullName} · {address.phone}
                  </p>
                </div>
              </label>
            )
          })}

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              selectedId === "new"
                ? "border-orange-400 bg-orange-50"
                : "hover:bg-muted/40"
            )}
          >
            <RadioGroupItem value="new" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">
                Use a different address
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter another delivery address for this order.
              </p>
            </div>
          </label>
        </RadioGroup>

        <p className="mt-4 text-xs text-muted-foreground">
          Manage your saved addresses in{" "}
          <Link
            to="/addresses"
            className="font-semibold text-orange-500 transition-colors hover:text-orange-700"
          >
            My addresses
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
