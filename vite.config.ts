import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { default as viteReact } from "@vitejs/plugin-react"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "vite"
import { nitro } from "nitro/vite"

/**
 * Routes that depend on the signed-in user must not be prerendered. Their
 * HTML is per-request (or served after the client reconciles the session), so
 * prerendering them would only bake in an anonymous/login view.
 */
const PROTECTED_PATH_PREFIXES = [
  "/addresses",
  "/checkout",
  "/order-tracking",
  "/orders",
  "/payment",
  "/payment-result",
  "/admin",
]

const isProtectedPath = (path: string) => {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path

  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  )
}

/**
 * Opt-in local HTTPS for development. `bun run dev` stays plain HTTP; run
 * `bun run dev:https` to generate/reuse certs in `certs/` and serve over TLS.
 */
const localHttps =
  process.env.HTTPS === "true"
    ? (() => {
        const certDir = resolve(process.cwd(), "certs")
        const keyPath = resolve(certDir, "localhost-key.pem")
        const certPath = resolve(certDir, "localhost-cert.pem")

        if (!existsSync(keyPath) || !existsSync(certPath)) {
          throw new Error(
            "HTTPS=true but local certificates are missing. Run `bun run dev:https` or `bun run cert:local` first."
          )
        }

        return {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath),
        }
      })()
    : undefined

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    https: localHttps,
    // Set by `bun run dev:tunnel` so Vite accepts the random public host.
    allowedHosts: process.env.DEV_ALLOWED_HOST
      ? [process.env.DEV_ALLOWED_HOST]
      : undefined,
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: true,
        concurrency: 10,
        crawlLinks: true,
        autoSubfolderIndex: true,
        retryCount: 20,
        filter: ({ path }) => !isProtectedPath(path),
        onSuccess: ({ page }) => {
          console.log(`Rendered ${page.path}!`)
        },
      },
    }),
    nitro(),
    viteReact(),
  ],
  ssr: {
    external: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "pg",
      ".prisma/client",
      "@/generated/prisma",
      "node:url",
      "node:path",
      "node:process",
      "node:fs",
    ],
    noExternal: [],
  },
  optimizeDeps: {
    exclude: [
      "@prisma/client",
      "@prisma/adapter-pg",
      ".prisma/client",
      "pg",
      "@/generated/prisma",
      "@tanstack/react-start",
      "@tanstack/react-router",
      "@tanstack/start-server-core",
      "@tanstack/start-client-core",
      "@tanstack/start-plugin-core",
    ],
    force: false,
  },
})

export default config
