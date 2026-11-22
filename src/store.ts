import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export interface CartItem {
  id: string
  name: string
  quantity: number
  price: number
  originalPrice: number
  image: string
  unit: string
  stock: number
}

/**
 * Key used for the anonymous cart. Authenticated carts are keyed by user id.
 * Using a stable key per identity means switching accounts never exposes (or
 * deletes) another account's cart.
 */
const GUEST_OWNER = "guest"

interface CartStore {
  /** Cart of the currently active owner. */
  cart: CartItem[]
  /** Persisted carts keyed by owner (`guest` or a user id). */
  cartsByOwner: Record<string, CartItem[]>
  /** Owner currently displayed; derived from auth, never trusted from storage. */
  ownerKey: string
  setOwner: (userId: string | null) => void
  addToCart: (product: CartItem) => void
  removeFromCart: (id: string) => void
  removeAllItemFromCart: (id: string) => void
  clearCart: () => void
  getCartTotal: () => number
}

interface PersistedCartState {
  cartsByOwner?: Record<string, CartItem[]>
  /** Legacy (v0) shape: a single unscoped cart. */
  cart?: CartItem[]
}

const withOwnerCart = (
  state: CartStore,
  cart: CartItem[]
): Pick<CartStore, "cart" | "cartsByOwner"> => ({
  cart,
  cartsByOwner: {
    ...state.cartsByOwner,
    [state.ownerKey]: cart,
  },
})

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: [],
      cartsByOwner: {},
      ownerKey: GUEST_OWNER,

      setOwner: (userId) =>
        set((state) => {
          const nextOwner = userId ?? GUEST_OWNER

          if (nextOwner === state.ownerKey) {
            return state
          }

          // Park the current cart under its owner, then restore the next
          // owner's cart. Carts are never discarded on logout or account
          // switch; they are simply no longer active.
          const cartsByOwner = {
            ...state.cartsByOwner,
            [state.ownerKey]: state.cart,
          }

          return {
            ownerKey: nextOwner,
            cartsByOwner,
            cart: cartsByOwner[nextOwner] ?? [],
          }
        }),

      addToCart: (product) =>
        set((state) => {
          // check if product existing
          const existingProduct = state.cart.find(
            (item) => item.id === product.id
          )

          // if product existing increment quantity
          if (existingProduct) {
            return withOwnerCart(
              state,
              state.cart.map((item) =>
                item.id === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              )
            )
          }

          // if product not exist
          return withOwnerCart(state, [
            ...state.cart,
            { ...product, quantity: 1 },
          ])
        }),

      removeFromCart: (id) =>
        set((state) => {
          // find product
          const existingProduct = state.cart.find((item) => item.id === id)

          // if product not exist
          if (!existingProduct) {
            return state
          }

          // if quantity of product great than one
          if (existingProduct.quantity > 1) {
            return withOwnerCart(
              state,
              state.cart.map((item) =>
                item.id === id ? { ...item, quantity: item.quantity - 1 } : item
              )
            )
          }

          // if quantity one
          return withOwnerCart(
            state,
            state.cart.filter((item) => item.id !== id)
          )
        }),

      removeAllItemFromCart: (id) =>
        set((state) => {
          // find product
          const existingProduct = state.cart.find((item) => item.id === id)

          // if product not exist
          if (!existingProduct) {
            return state
          }

          return withOwnerCart(
            state,
            state.cart.filter((item) => item.id !== id)
          )
        }),

      clearCart: () => set((state) => withOwnerCart(state, [])),

      getCartTotal: () => {
        return get().cart.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        )
      },
    }),
    {
      name: "cart-storage",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only carts are persisted. The active owner must always be derived from
      // the authenticated session so a previous user's cart cannot reappear
      // for the next person using the browser.
      partialize: (state) => ({ cartsByOwner: state.cartsByOwner }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedCartState | undefined
        const legacyCart = Array.isArray(persisted?.cart)
          ? persisted.cart
          : undefined

        // V0 carts had no owner. Treat them as guest data rather than
        // attributing them to whoever happens to be signed in next.
        const cartsByOwner =
          persisted?.cartsByOwner ??
          (legacyCart ? { [GUEST_OWNER]: legacyCart } : {})

        return {
          ...currentState,
          cartsByOwner,
          ownerKey: GUEST_OWNER,
          cart: cartsByOwner[GUEST_OWNER] ?? [],
        }
      },
    }
  )
)
