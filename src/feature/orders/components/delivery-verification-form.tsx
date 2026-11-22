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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { verifyDeliveryOtp } from "@/feature/orders/api/delivery"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface DeliveryVerificationFormProps {
  orderId: string
}

/**
 * Driver hand-off confirmation. The driver only submits the code; this form
 * never receives or displays the customer's code.
 */
export function DeliveryVerificationForm({
  orderId,
}: DeliveryVerificationFormProps) {
  const router = useRouter()
  const [code, setCode] = useState("")

  const verifyMutation = useMutation({
    mutationFn: (value: string) =>
      verifyDeliveryOtp({ data: { orderId, code: value } }),
    onSuccess: async () => {
      setCode("")
      toast.success("Delivery confirmed. The order is now delivered.")
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not verify the delivery code"
      )
    },
  })

  const error = verifyMutation.error
    ? verifyMutation.error instanceof Error
      ? verifyMutation.error.message
      : "Could not verify the delivery code"
    : null

  return (
    <Card className="border-orange-200 bg-orange-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-5 text-orange-500" />
          Confirm delivery
        </CardTitle>
        <CardDescription>
          Ask the customer for their six-digit delivery verification code after
          handing over the order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (code.length === 6) {
              verifyMutation.mutate(code)
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="delivery-code">Verification code</FieldLabel>
              <FieldContent>
                <InputOTP
                  id="delivery-code"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={error ? true : undefined}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="size-10 text-base"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </FieldContent>
              <FieldDescription>
                The code is shown only to the customer while the order is out
                for delivery.
              </FieldDescription>
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={verifyMutation.isPending || code.length !== 6}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Spinner />
                    Confirming…
                  </>
                ) : (
                  "Confirm delivery"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
