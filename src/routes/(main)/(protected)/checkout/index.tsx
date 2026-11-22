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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addressesQueryOptions } from "@/feature/addresses/api/addresses-query"
import { CheckoutEmptyState } from "@/feature/checkout/components/checkout-empty-state"
import { CheckoutSummary } from "@/feature/checkout/components/checkout-summary"
import { PaymentMethodPicker } from "@/feature/checkout/components/payment-method-picker"
import { SavedAddressPicker } from "@/feature/checkout/components/saved-address-picker"
import { DeliveryLocationPicker } from "@/feature/maps/components/delivery-location-picker"
import { createOrder } from "@/feature/orders/api/orders"
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/feature/orders/schema"
import {
  calculateTotals,
  formatPrice,
  FREE_DELIVERY_THRESHOLD,
} from "@/lib/pricing"
import { useCartStore } from "@/store"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { MapPinIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/(main)/(protected)/checkout/")({
  // Saved addresses are a customer-only feature. Admins can still place an
  // order using the manual address form.
  loader: ({ context }) =>
    context.currentUser?.role === "customer"
      ? context.queryClient.ensureQueryData(addressesQueryOptions)
      : [],
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const savedAddresses = Route.useLoaderData()
  const defaultAddress =
    savedAddresses.find((address) => address.isDefault) ?? savedAddresses.at(0)
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    defaultAddress?.id ?? "new"
  )

  const cart = useCartStore((state) => state.cart)
  const addToCart = useCartStore((state) => state.addToCart)
  const removeFromCart = useCartStore((state) => state.removeFromCart)
  const removeAllItemFromCart = useCartStore(
    (state) => state.removeAllItemFromCart
  )
  const clearCart = useCartStore((state) => state.clearCart)

  const totals = calculateTotals(
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  const createOrderMutation = useMutation({
    mutationFn: async ({
      paymentMethod,
      ...shippingAddress
    }: CheckoutFormValues) =>
      createOrder({
        data: {
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shippingAddress,
          paymentMethod,
        },
      }),
    onSuccess: (result, values) => {
      clearCart()

      if (values.paymentMethod === "card") {
        toast.success("Order created. Complete the payment to confirm it.")
        navigate({
          to: "/payment/$orderId",
          params: { orderId: result.orderId },
        })
        return
      }

      toast.success(
        `Order #${result.orderId.slice(0, 8).toUpperCase()} placed successfully`
      )
      navigate({ to: "/orders" })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to place your order. Please try again."
      )
    },
  })

  const defaultValues: CheckoutFormValues = {
    fullName: defaultAddress?.fullName ?? user.name,
    phone: defaultAddress?.phone ?? user.phone ?? "",
    email: defaultAddress?.email || user.email,
    address: defaultAddress?.address ?? "",
    city: defaultAddress?.city ?? "",
    state: defaultAddress?.state ?? "",
    zip: defaultAddress?.zip ?? "",
    latitude: defaultAddress?.latitude ?? null,
    longitude: defaultAddress?.longitude ?? null,
    notes: defaultAddress?.notes ?? "",
    paymentMethod: "card",
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: checkoutSchema,
    },
    onSubmit: ({ value }) => {
      if (cart.length === 0) {
        return
      }

      createOrderMutation.mutate(value)
    },
  })

  const fillAddressFields = (address: (typeof savedAddresses)[number]) => {
    form.setFieldValue("fullName", address.fullName)
    form.setFieldValue("phone", address.phone)
    form.setFieldValue("email", address.email || user.email)
    form.setFieldValue("address", address.address)
    form.setFieldValue("city", address.city)
    form.setFieldValue("state", address.state)
    form.setFieldValue("zip", address.zip)
    form.setFieldValue("latitude", address.latitude ?? null)
    form.setFieldValue("longitude", address.longitude ?? null)
    form.setFieldValue("notes", address.notes)
  }

  const handleAddressChange = (value: string) => {
    setSelectedAddressId(value)

    if (value === "new") {
      form.setFieldValue("fullName", user.name)
      form.setFieldValue("phone", user.phone ?? "")
      form.setFieldValue("email", user.email)
      form.setFieldValue("address", "")
      form.setFieldValue("city", "")
      form.setFieldValue("state", "")
      form.setFieldValue("zip", "")
      form.setFieldValue("latitude", null)
      form.setFieldValue("longitude", null)
      form.setFieldValue("notes", "")
      return
    }

    const selected = savedAddresses.find((address) => address.id === value)

    if (selected) {
      fillAddressFields(selected)
    }
  }

  const locationPicker = (
    <form.Subscribe
      selector={(state) =>
        [state.values.latitude ?? null, state.values.longitude ?? null] as const
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
  )

  if (cart.length === 0) {
    return <CheckoutEmptyState />
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your items and enter your delivery details.
          </p>
        </div>
        <Link
          to="/products"
          className="text-sm font-semibold text-orange-500 transition-colors hover:text-orange-700"
        >
          Continue shopping
        </Link>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
        className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="space-y-6">
          {savedAddresses.length > 0 && (
            <SavedAddressPicker
              addresses={savedAddresses}
              selectedId={selectedAddressId}
              onChange={handleAddressChange}
            />
          )}

          {selectedAddressId === "new" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-5 text-orange-500" />
                  <CardTitle>Shipping address</CardTitle>
                </div>
                <CardDescription>
                  Where should we deliver your order?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field
                      name="fullName"
                      children={(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            Full name
                          </FieldLabel>
                          <FieldContent>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="Enter your full name"
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
                          <FieldLabel htmlFor={field.name}>
                            Phone number
                          </FieldLabel>
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
                              placeholder="+1 555 000 0000"
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

                  <form.Field
                    name="address"
                    children={(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Street address
                        </FieldLabel>
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
                          <FieldLabel htmlFor={field.name}>
                            Postal code
                          </FieldLabel>
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

                  {locationPicker}

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
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {selectedAddressId !== "new" && (
            <Card>
              <CardContent>{locationPicker}</CardContent>
            </Card>
          )}

          <form.Field
            name="paymentMethod"
            children={(field) => (
              <PaymentMethodPicker
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border bg-white p-4">
              <TruckIcon className="mt-0.5 size-5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Fast delivery</p>
                <p className="text-xs text-muted-foreground">
                  Free on orders over {formatPrice(FREE_DELIVERY_THRESHOLD)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border bg-white p-4">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Secure checkout</p>
                <p className="text-xs text-muted-foreground">
                  Your details are protected
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="h-fit lg:sticky lg:top-20">
          <CheckoutSummary
            items={cart}
            totals={totals}
            paymentMethod={form.state.values.paymentMethod}
            isSubmitting={createOrderMutation.isPending}
            onIncrease={addToCart}
            onDecrease={removeFromCart}
            onRemove={removeAllItemFromCart}
          />
        </aside>
      </form>
    </div>
  )
}
