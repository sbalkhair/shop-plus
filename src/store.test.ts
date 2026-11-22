import { beforeEach, describe, expect, it } from "vitest"
import { useCartStore, type CartItem } from "./store"

const product = (id: string, overrides: Partial<CartItem> = {}): CartItem => ({
  id,
  name: `Product ${id}`,
  quantity: 1,
  price: 10,
  originalPrice: 12,
  image: "/product.png",
  unit: "each",
  stock: 10,
  ...overrides,
})

const resetStore = () => {
  useCartStore.setState({
    cart: [],
    cartsByOwner: {},
    ownerKey: "guest",
  })
}

const cartIds = () => useCartStore.getState().cart.map((item) => item.id)

describe("cart ownership", () => {
  beforeEach(resetStore)

  it("stores the anonymous cart under the guest owner", () => {
    useCartStore.getState().addToCart(product("apple"))

    expect(cartIds()).toEqual(["apple"])
    expect(useCartStore.getState().cartsByOwner.guest).toHaveLength(1)
  })

  it("parks the guest cart and starts a new account with its own cart", () => {
    useCartStore.getState().addToCart(product("apple"))
    useCartStore.getState().setOwner("user-a")

    expect(cartIds()).toEqual([])
    expect(useCartStore.getState().cartsByOwner.guest).toHaveLength(1)

    useCartStore.getState().addToCart(product("banana"))

    expect(cartIds()).toEqual(["banana"])
    expect(useCartStore.getState().cartsByOwner["user-a"]).toHaveLength(1)
  })

  it("does not leak one account's cart into another account", () => {
    useCartStore.getState().setOwner("user-a")
    useCartStore.getState().addToCart(product("apple"))

    useCartStore.getState().setOwner("user-b")

    expect(cartIds()).toEqual([])

    useCartStore.getState().addToCart(product("banana"))

    expect(cartIds()).toEqual(["banana"])
    expect(useCartStore.getState().cartsByOwner["user-a"]).toHaveLength(1)
    expect(useCartStore.getState().cartsByOwner["user-b"]).toHaveLength(1)
  })

  it("restores the previous account cart when switching back", () => {
    useCartStore.getState().setOwner("user-a")
    useCartStore.getState().addToCart(product("apple"))

    useCartStore.getState().setOwner("user-b")
    useCartStore.getState().setOwner("user-a")

    expect(cartIds()).toEqual(["apple"])
  })

  it("restores the guest cart on logout without exposing account carts", () => {
    useCartStore.getState().addToCart(product("guest-item"))
    useCartStore.getState().setOwner("user-a")
    useCartStore.getState().addToCart(product("account-item"))

    useCartStore.getState().setOwner(null)

    expect(cartIds()).toEqual(["guest-item"])
    expect(useCartStore.getState().cartsByOwner["user-a"]).toHaveLength(1)
  })

  it("clears only the active owner's cart", () => {
    useCartStore.getState().setOwner("user-a")
    useCartStore.getState().addToCart(product("apple"))

    useCartStore.getState().setOwner("user-b")
    useCartStore.getState().addToCart(product("banana"))
    useCartStore.getState().clearCart()

    expect(cartIds()).toEqual([])
    expect(useCartStore.getState().cartsByOwner["user-a"]).toHaveLength(1)
    expect(useCartStore.getState().cartsByOwner["user-b"]).toEqual([])
  })

  it("ignores a redundant owner switch", () => {
    useCartStore.getState().addToCart(product("apple"))
    const stateBefore = useCartStore.getState()

    useCartStore.getState().setOwner(null)

    expect(useCartStore.getState()).toBe(stateBefore)
  })
})
