import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { PaymentMethod } from "@/feature/orders/schema"
import { cn } from "cn"
import { BanknoteIcon, CreditCardIcon } from "lucide-react"

const PAYMENT_METHODS = [
  {
    value: "card",
    label: "Card payment",
    description: "Pay securely with your debit or credit card.",
    icon: CreditCardIcon,
  },
  {
    value: "cash",
    label: "Cash on delivery",
    description: "Pay with cash when your order arrives.",
    icon: BanknoteIcon,
  },
] satisfies Array<{
  value: PaymentMethod
  label: string
  description: string
  icon: typeof CreditCardIcon
}>

interface PaymentMethodPickerProps {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
}

export function PaymentMethodPicker({
  value,
  onChange,
}: PaymentMethodPickerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCardIcon className="size-5 text-orange-500" />
          <CardTitle>Payment method</CardTitle>
        </div>
        <CardDescription>Choose how you want to pay.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(next) => onChange(next as PaymentMethod)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon
            const active = value === method.value

            return (
              <label
                key={method.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  active
                    ? "border-orange-400 bg-orange-50"
                    : "hover:bg-muted/40"
                )}
              >
                <RadioGroupItem value={method.value} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-orange-500" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </label>
            )
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
