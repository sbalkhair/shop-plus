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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  createDeliveryPartner,
  updateDeliveryPartner,
} from "@/feature/delivery-partners/api/delivery-partners"
import {
  createDeliveryPartnerSchema,
  updateDeliveryPartnerSchema,
  type CreateDeliveryPartnerInput,
  type DeliveryPartnerVehicle,
} from "@/feature/delivery-partners/schema"
import type { DeliveryPartner } from "@/types"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

type DeliveryPartnerFormInput = Omit<CreateDeliveryPartnerInput, "password"> & {
  password?: string
}

const VEHICLE_OPTIONS: { value: DeliveryPartnerVehicle; label: string }[] = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "car", label: "Car" },
]

interface DeliveryPartnerFormProps {
  /** When provided, the form updates this partner instead of creating one. */
  partner?: DeliveryPartner
  onSaved?: (partner: DeliveryPartner) => void
}

export function DeliveryPartnerForm({
  partner,
  onSaved,
}: DeliveryPartnerFormProps) {
  const isEditing = Boolean(partner)

  const saveMutation = useMutation({
    mutationFn: (values: DeliveryPartnerFormInput) =>
      partner
        ? updateDeliveryPartner({ data: { id: partner.id, ...values } })
        : createDeliveryPartner({
            data: { ...values, password: values.password ?? "" },
          }),
    onSuccess: (saved) => {
      toast.success(
        isEditing ? `"${saved.name}" updated` : `"${saved.name}" added`
      )
      onSaved?.(saved)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Could not update the delivery partner"
            : "Could not create the delivery partner"
      )
    },
  })

  const form = useForm({
    defaultValues: {
      name: partner?.name ?? "",
      email: partner?.email ?? "",
      phone: partner?.phone ?? "",
      vehicleType: partner?.vehicleType ?? "bike",
      isActive: partner?.isActive ?? true,
      password: "",
    },
    validators: {
      // The runtime schema differs (create requires a password; edit allows an
      // optional reset), so the shared shape is asserted for the form generic.
      onSubmit: (isEditing
        ? updateDeliveryPartnerSchema.omit({ id: true })
        : createDeliveryPartnerSchema) as typeof createDeliveryPartnerSchema,
    },
    onSubmit: ({ value }) => {
      const { password, ...fields } = value
      const trimmedPassword = password.trim()

      saveMutation.mutate({
        ...fields,
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery partner details</CardTitle>
        <CardDescription>
          Couriers can sign in to the delivery portal and confirm hand-offs with
          the customer&apos;s verification code.
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
            <form.Field
              name="name"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. Omar Ali"
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
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
                      placeholder="courier@example.com"
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
              name="phone"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
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
                      placeholder="0500000000"
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
              name="password"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {isEditing ? "Reset driver password" : "Temporary password"}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      autoComplete="new-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder={
                        isEditing
                          ? "Leave blank to keep current"
                          : "At least 8 characters"
                      }
                    />
                  </FieldContent>
                  <FieldDescription>
                    {isEditing
                      ? "Set a new password only if the driver needs one. It is hashed and cannot be viewed again."
                      : "Share this with the driver so they can sign in. It is hashed and cannot be viewed again."}
                  </FieldDescription>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <form.Field
              name="vehicleType"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Vehicle</FieldLabel>
                  <FieldContent>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value)
                        }
                      }}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              )}
            />

            <form.Field
              name="isActive"
              children={(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>
                      Available for deliveries
                    </FieldLabel>
                    <FieldDescription>
                      Inactive partners cannot be assigned to new orders.
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
                    ? "Could not update the delivery partner"
                    : "Could not create the delivery partner"}
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
                  "Add delivery partner"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
