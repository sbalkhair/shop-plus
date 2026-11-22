import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, chmodSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Generates a self-signed certificate for local HTTPS development.
 *
 * The generated files are gitignored and reused on subsequent runs. If you
 * want a browser-trusted certificate, install mkcert and generate the same two
 * files into `certs/` instead:
 *
 *   mkcert -install
 *   mkcert -key-file certs/localhost-key.pem \
 *          -cert-file certs/localhost-cert.pem \
 *          localhost 127.0.0.1 ::1
 */

const force = process.argv.includes("--force")
const certDir = resolve(process.cwd(), "certs")
const keyPath = resolve(certDir, "localhost-key.pem")
const certPath = resolve(certDir, "localhost-cert.pem")

if (!force && existsSync(keyPath) && existsSync(certPath)) {
  console.log("Local HTTPS certificate already exists in certs/.")
  process.exit(0)
}

mkdirSync(certDir, { recursive: true })

try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-sha256",
      "-days",
      "825",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1",
      "-addext",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "-addext",
      "extendedKeyUsage=serverAuth",
    ],
    { stdio: "inherit" }
  )
} catch {
  console.error(
    "Could not generate a local certificate. Make sure `openssl` is installed,\n" +
      "or install mkcert and generate certs/localhost-key.pem and\n" +
      "certs/localhost-cert.pem manually."
  )
  process.exit(1)
}

chmodSync(keyPath, 0o600)

console.log("Created certs/localhost-key.pem and certs/localhost-cert.pem.")
console.log(
  "Browsers will warn about the self-signed certificate; choose Advanced → Proceed once.\n" +
    "For a trusted certificate, use mkcert as described in scripts/dev-cert.mjs."
)
