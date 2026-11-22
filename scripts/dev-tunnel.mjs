import { spawn } from "node:child_process"
import { createConnection } from "node:net"

/**
 * Runs the app behind a public Cloudflare quick tunnel so Moyasar can reach the
 * callback and webhook URLs.
 *
 * Cloudflare quick tunnels are free and do not need an account, but the URL is
 * random on every run. This script starts the tunnel first, waits for its
 * public HTTPS URL, then starts Vite with:
 *
 *   BETTER_AUTH_URL=https://<random>.trycloudflare.com
 *   MOYASAR_CALLBACK_URL=https://<random>.trycloudflare.com/payment-result
 *
 * Use `bun run dev:tunnel` and open the printed App URL, not localhost.
 */

const PORT = Number(process.env.PORT || 3000)
const TUNNEL_TARGET = `http://localhost:${PORT}`
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

const isPortInUse = () =>
  new Promise((resolve) => {
    const socket = createConnection({ port: PORT, host: "127.0.0.1" })

    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })

let cloudflared = null
let vite = null
let shuttingDown = false
let tunnelTimeout = null

const shutdown = (code) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  if (tunnelTimeout) {
    clearTimeout(tunnelTimeout)
  }

  if (vite && !vite.killed) {
    vite.kill("SIGTERM")
  }

  if (cloudflared && !cloudflared.killed) {
    cloudflared.kill("SIGTERM")
  }

  process.exitCode = code
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

const startVite = (publicUrl) => {
  const env = {
    ...process.env,
    BETTER_AUTH_URL: publicUrl,
    DEV_ALLOWED_HOST: new URL(publicUrl).hostname,
    MOYASAR_CALLBACK_URL: `${publicUrl}/payment-result`,
  }

  vite = spawn(
    process.execPath,
    ["x", "vite", "dev", "--port", String(PORT), "--strictPort"],
    { stdio: "inherit", env }
  )

  vite.on("exit", (code) => {
    if (!shuttingDown) {
      console.error("\nDev server stopped.")
      shutdown(code ?? 0)
    }
  })

  console.log(`
Moyasar sandbox origin is ready:

  App:      ${publicUrl}
  Callback: ${publicUrl}/payment-result
  Webhook:  ${publicUrl}/api/webhooks/moyasar

Open the App URL (not localhost). Use the same public host in the Moyasar
dashboard and make sure its webhook secret matches MOYASAR_WEBHOOK_SECRET.
`)
}

const main = async () => {
  if (await isPortInUse()) {
    console.error(
      `Port ${PORT} is already in use. Stop the existing dev server, then run this again.`
    )
    process.exit(1)
  }

  console.log("Starting Cloudflare quick tunnel...")

  cloudflared = spawn(
    "cloudflared",
    ["tunnel", "--url", TUNNEL_TARGET, "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] }
  )

  let started = false

  const onOutput = (chunk) => {
    const text = chunk.toString()
    const match = text.match(TUNNEL_URL_PATTERN)

    if (match && !started) {
      started = true

      if (tunnelTimeout) {
        clearTimeout(tunnelTimeout)
        tunnelTimeout = null
      }

      startVite(match[0])
    }
  }

  cloudflared.stdout.on("data", onOutput)
  cloudflared.stderr.on("data", onOutput)

  cloudflared.on("error", (error) => {
    if (error.code === "ENOENT") {
      console.error(
        "cloudflared is not installed. Install it with: brew install cloudflared"
      )
      shutdown(1)
      return
    }

    console.error(`Could not start cloudflared: ${error.message}`)
    shutdown(1)
  })

  cloudflared.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`cloudflared stopped (code ${code ?? "unknown"}).`)
      shutdown(code ?? 1)
    }
  })

  tunnelTimeout = setTimeout(() => {
    if (!started) {
      console.error("Timed out waiting for a public tunnel URL.")
      shutdown(1)
    }
  }, 30_000)
}

main()
