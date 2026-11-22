import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { useEffect, useRef } from "react"

import { getCurrentUser } from "@/feature/auth/api/session"
import { isSameAuthUser, toAuthUser, type AuthUser } from "@/feature/auth/roles"
import { authClient } from "@/lib/auth-client"
import { useCartStore } from "@/store"
import { Toaster } from "sonner"
import appCss from "../styles.css?url"

export interface RouterContext {
  queryClient: QueryClient
  currentUser: AuthUser | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => ({
    currentUser: await getCurrentUser(),
  }),
  // The root context contains session-specific data and must never be cached
  // publicly. Prerendered pages are static by definition; the client sync
  // below corrects their auth context after hydration.
  headers: () => ({
    "Cache-Control": "private, no-store",
  }),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Shop-Plus",
      },
      {
        description: "Shop plus is a platform for selling grocery products",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

/**
 * Reconciles client-only auth state with the router context.
 *
 * TanStack Router trusts the context transported with SSR/prerendered HTML and
 * does not re-run the root `beforeLoad` during hydration. That is correct for
 * per-request SSR, but a prerendered page always carries `currentUser: null`,
 * even for a signed-in visitor.
 *
 * The Better Auth session atom is shared with `useSession()`, so reading it
 * here does not create an additional session request. When it resolves to a
 * different user than the hydrated context, we invalidate the router once so
 * `beforeLoad` can refresh the context. Login/logout flows also invalidate
 * explicitly after changing the session.
 */
function AuthSync() {
  const { data: session, isPending } = authClient.useSession()
  const { currentUser } = Route.useRouteContext()
  const router = useRouter()
  const hasSynced = useRef(false)

  useEffect(() => {
    useCartStore.getState().setOwner(currentUser?.id ?? null)
  }, [currentUser?.id])

  useEffect(() => {
    if (isPending || hasSynced.current) {
      return
    }

    hasSynced.current = true

    const sessionUser = session?.user ? toAuthUser(session.user) : null

    if (!isSameAuthUser(sessionUser, currentUser)) {
      void router.invalidate()
    }
  }, [currentUser, isPending, router, session])

  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-orange-100/20">
        <QueryClientProvider client={queryClient}>
          <AuthSync />
          <div className="min-h-screen">{children}</div>
          <Toaster position="top-right" closeButton />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>

        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
