import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ShoppingCart } from "lucide-react"

/** Shown when the customer reaches checkout with an empty cart. */
export function CheckoutEmptyState() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-md items-center text-center">
        <CardHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-500">
            <ShoppingCart className="size-7" />
          </div>
          <CardTitle className="mt-2 text-xl">Your cart is empty</CardTitle>
          <CardDescription>
            Add some products to your cart before checking out.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          <Link
            to="/products"
            className={cn(
              buttonVariants(),
              "w-full rounded-xl bg-orange-500 hover:bg-orange-600"
            )}
          >
            Start shopping
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
