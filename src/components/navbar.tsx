import { authClient } from "@/lib/auth-client"
import { calculateTotals, formatPrice } from "@/lib/pricing"
import { Route } from "@/routes/__root"
import { useCartStore } from "@/store"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import {
  ChevronDownIcon,
  LogOutIcon,
  MapPinIcon,
  Minus,
  PackageIcon,
  Plus,
  SearchIcon,
  ShieldIcon,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserIcon,
} from "lucide-react"
import { useState } from "react"
import { Button, buttonVariants } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"

const Navbar = () => {
  const { currentUser: user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const router = useRouter()

  const cart = useCartStore((state) => state.cart)
  const addToCart = useCartStore((state) => state.addToCart)
  const removeFromCart = useCartStore((state) => state.removeFromCart)
  const removeAllItemFromCart = useCartStore(
    (state) => state.removeAllItemFromCart
  )
  const clearCart = useCartStore((state) => state.clearCart)

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const { subtotal, tax, deliveryFee, total } = calculateTotals(
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const navigate = useNavigate()

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate({
        to: "/search-result",
        search: { q: searchQuery.trim() },
      })

      setSearchQuery("")
    }
  }

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await authClient.signOut()
    queryClient.clear()
    await router.invalidate()
    navigate({ to: "/" })
  }
  return (
    <nav className="sticky top-0 z-50 mb-3 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* logo */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-[22px] font-medium"
        >
          <ShoppingBag size={24} />{" "}
          <span className="font-bold">
            SUPER<span className="text-primary">shop</span>
          </span>
        </Link>

        <div className="flex w-full items-center justify-end gap-4 lg:gap-10">
          {/* Nav link desktop */}
          <div className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
            <Link to="/" activeProps={{ className: "text-orange-400" }}>
              Home
            </Link>
            <Link to="/products" activeProps={{ className: "text-orange-400" }}>
              Products
            </Link>
            <Link to="/deals" activeProps={{ className: "text-orange-400" }}>
              Deals
            </Link>
          </div>

          {/* search */}
          <form
            onSubmit={handleSearch}
            className="hidden max-w-sm flex-1 text-xs sm:flex sm:text-sm"
          >
            <div className="relative w-full">
              <SearchIcon className="absolute top-3 left-2.5 size-4 -translate-y-1 text-zinc-500" />
              <input
                className="w-full rounded-full border-0 bg-orange-50 p-2 pl-8 text-zinc-500"
                placeholder="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Right action */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger
                className="relative rounded-xl p-2"
                aria-label="Open cart"
              >
                <ShoppingCart className="size-5 text-zinc-900" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-orange-400 text-[10px] text-white">
                    {cartCount}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent side="right" className="w-full">
                <SheetHeader>
                  <SheetTitle>Your Cart</SheetTitle>
                  <div className="flex items-center justify-between">
                    <SheetDescription>
                      {cartCount === 0
                        ? "Your cart is empty"
                        : `${cartCount} item${cartCount === 1 ? "" : "s"} in your cart`}
                    </SheetDescription>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-end text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={clearCart}
                    >
                      <Trash2 />
                      Clear cart
                    </Button>
                  </div>
                </SheetHeader>

                {cart.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                    <ShoppingCart className="size-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Your cart is empty</p>
                    <p className="text-xs text-muted-foreground">
                      Add some products to get started.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setCartOpen(false)
                        navigate({ to: "/products" })
                      }}
                    >
                      Continue shopping
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 space-y-4 overflow-y-auto px-4">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-3 border-b border-dashed border-slate-200 pb-3"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="size-18 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="line-clamp-1 text-sm font-medium">
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.unit}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeAllItemFromCart(item.id)}
                                aria-label={`Remove ${item.name} from cart`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => removeFromCart(item.id)}
                                  aria-label={`Decrease ${item.name} quantity`}
                                >
                                  <Minus />
                                </Button>
                                <span className="w-5 text-center text-xs font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => addToCart(item)}
                                  disabled={item.quantity >= item.stock}
                                  aria-label={`Increase ${item.name} quantity`}
                                >
                                  <Plus />
                                </Button>
                              </div>
                              <p className="text-sm font-semibold">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <SheetFooter className="border-t">
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Subtotal
                          </span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tax (15%)
                          </span>
                          <span>{formatPrice(tax)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Delivery
                          </span>
                          <span
                            className={
                              deliveryFee === 0
                                ? "font-medium text-green-600"
                                : undefined
                            }
                          >
                            {deliveryFee === 0
                              ? "Free"
                              : formatPrice(deliveryFee)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-1.5 text-base font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(total)}</span>
                        </div>
                      </div>
                      <Button
                        className="mt-2 w-full"
                        onClick={() => {
                          setCartOpen(false)
                          navigate({ to: "/checkout" })
                        }}
                      >
                        Checkout
                      </Button>
                    </SheetFooter>
                  </>
                )}
              </SheetContent>
            </Sheet>
            {/* User */}
            <div className="relative">
              {user ? (
                <>
                  <button
                    className="flex items-center gap-2 p-2"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary text-white">
                      {user.name.charAt(0).toUpperCase() || "U"}
                    </div>
                    <ChevronDownIcon className="size-4 text-zinc-500" />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 z-50 mt-2.5 w-56 rounded-xl border bg-white py-2 shadow-lg">
                        <div className="border-b px-4 py-2">
                          <p className="text-sm font-medium text-zinc-950">
                            {user.name}
                          </p>
                          <p className="text-xs text-zinc-600">{user.email}</p>
                        </div>

                        <div onClick={() => setUserMenuOpen(false)}>
                          {user.role === "customer" && (
                            <>
                              <Link
                                to="/orders"
                                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                              >
                                <PackageIcon size={16} />
                                My Orders
                              </Link>
                              <Link
                                to="/addresses"
                                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-orange-200"
                              >
                                <MapPinIcon size={16} />
                                Addresses
                              </Link>
                            </>
                          )}
                          {user.isAdmin && (
                            <Link
                              to="/admin/products"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-orange-500 transition-colors hover:bg-zinc-50"
                            >
                              <ShieldIcon size={16} />
                              Admin Panel
                            </Link>
                          )}
                          <div className="border-t pt-1">
                            <button
                              onClick={handleLogout}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
                            >
                              <LogOutIcon size={16} />
                              Logout
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className={buttonVariants()}>
                    <UserIcon className="size-4" />
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
