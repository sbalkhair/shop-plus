import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createAddress, updateAddress } from "@/feature/addresses/api/addresses"
import {
  createAddressSchema,
  type CreateAddressInput,
} from "@/feature/addresses/schema"
import { DeliveryLocationPicker } from "@/feature/maps/components/delivery-location-picker"
import type { Address } from "@/types"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

interface AddressFormDefaults {
  fullName: string
  phone: string
  email: string
}

interface AddressFormProps {
  /** When provided, the form updates this address instead of creating one. */
  address?: Address
  /** Prefills used when creating a customer's first address. */
  defaults?: AddressFormDefaults
  onSaved?: (address: Address) => void
  onCancel?: () => void
}

export function AddressForm({
  address,
  defaults,
  onSaved,
  onCancel,
}: AddressFormProps) {
  const isEditing = Boolean(address)

  const saveMutation = useMutation({
    mutationFn: (values: CreateAddressInput) =>
      address
        ? updateAddress({ data: { id: address.id, ...values } })
        : createAddress({ data: values }),
    onSuccess: (saved) => {
      toast.success(
        isEditing ? `"${saved.label}" updated` : `"${saved.label}" added`
      )
      onSaved?.(saved)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Could not update the address"
            : "Could not save the address"
      )
    },
  })

  const defaultValues: CreateAddressInput = {
    label: address?.label ?? "Home",
    fullName: address?.fullName ?? defaults?.fullName ?? "",
    phone: address?.phone ?? defaults?.phone ?? "",
    email: address?.email ?? defaults?.email ?? "",
    address: address?.address ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    zip: address?.zip ?? "",
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
    notes: address?.notes ?? "",
    isDefault: address?.isDefault ?? false,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: createAddressSchema,
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate(value)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit delivery address" : "Add a delivery address"}
        </CardTitle>
        <CardDescription>
          Save the address your orders should be delivered to. Your default
          address is selected automatically at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="label"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Label</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Home, Work, Parents…"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="fullName"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Recipient name</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Enter the recipient's full name"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="phone"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Phone number</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="tel"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="+966 50 000 0000"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="email"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Email{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Enter your email"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <form.Field
              name="address"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Street address</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Building, street, apartment"
                    />
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field
                name="city"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>City</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="City"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="state"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>State</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="State"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="zip"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Postal code</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="12345"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <form.Subscribe
              selector={(state) =>
                [
                  state.values.latitude ?? null,
                  state.values.longitude ?? null,
                ] as const
              }
            >
              {([latitude, longitude]) => (
                <DeliveryLocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(coordinate) => {
                    form.setFieldValue("latitude", coordinate.latitude)
                    form.setFieldValue("longitude", coordinate.longitude)
                  }}
                  onClear={() => {
                    form.setFieldValue("latitude", null)
                    form.setFieldValue("longitude", null)
                  }}
                />
              )}
            </form.Subscribe>

            <form.Field
              name="notes"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    Delivery notes{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FieldLabel>
                  <FieldContent>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Gate code, landmarks, or special instructions"
                    />
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <form.Field
              name="isDefault"
              children={(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>
                      Use as my default address
                    </FieldLabel>
                    <FieldDescription>
                      This address will be preselected for delivery at checkout.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </Field>
              )}
            />

            {saveMutation.error && (
              <FieldError>
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : isEditing
                    ? "Could not update the address"
                    : "Could not save the address"}
              </FieldError>
            )}

            <Field orientation="horizontal">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : isEditing ? (
                  "Save changes"
                ) : (
                  "Save address"
                )}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
              )}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
