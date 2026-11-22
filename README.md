# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Delivery location pins

Customers can drop an optional delivery pin with [Leaflet](https://leafletjs.com/)
at checkout or while saving an address. The pin is copied into the order's
`shippingAddress` JSON, so it travels with the order. Customers see a read-only
map on their tracking page, and drivers get the same map plus a **Navigate with
Google Maps** link on the assigned-order page. Orders without a pin fall back to
the written address for navigation.

Leaflet is loaded dynamically in a client effect, so the map is never touched
during server rendering. Tiles come from OpenStreetMap and need no API key. The
"use my current location" button uses the browser Geolocation API, which
requires `localhost` or HTTPS.

Saved addresses store the pin in the nullable `latitude` and `longitude`
columns. Apply the migration before using the address book:

```bash
bun run db:migrate
```

## Moyasar sandbox payments

Card payments use Moyasar Payment Intents together with the official
`moyasar-payment-form` bundle. The integration is sandbox-only: `getMoyasarEnv`
rejects live keys and the webhook handler refuses live events.

### 1. Configure the environment

Copy the values from `.env.example` and fill in your sandbox credentials:

```bash
cp .env.example .env
openssl rand -hex 32   # use this output as MOYASAR_WEBHOOK_SECRET
```

Put real credentials in `.env` (gitignored), never in `.env.example`
(committed). The example file must keep placeholder values.

- `MOYASAR_PUBLISHABLE_KEY` — sandbox key (`pk_test_...`). Safe for the browser.
- `MOYASAR_SECRET_KEY` — sandbox key (`sk_test_...`). Server-only, never `VITE_`.
- `MOYASAR_WEBHOOK_SECRET` — any long random password. Enter the same value in
  the Moyasar dashboard under **Settings → Webhooks → Secret Token**.
- `MOYASAR_CALLBACK_URL` — public HTTPS URL for the return page. It **must not**
  be `localhost` or a private IP; Moyasar rejects those. Use the tunnel URL
  printed by `bun run dev:tunnel` and append `/payment-result`.

Restart the dev server after changing these values; the configuration is cached
per process.

### 2. Apply the database migration

```bash
bun run db:migrate
```

### 3. Start a public tunnel (required for Moyasar)

Moyasar validates the callback domain, so a local-only URL fails with
`The URL must use a valid public domain.` The tunnel flow starts a free
Cloudflare quick tunnel, then starts Vite with the matching public origin:

```bash
brew install cloudflared   # once
bun run dev:tunnel
```

It prints something like:

```text
App:      https://random-name.trycloudflare.com
Callback: https://random-name.trycloudflare.com/payment-result
Webhook:  https://random-name.trycloudflare.com/api/webhooks/moyasar
```

Open the **App** URL (not `localhost`) and add the **Webhook** URL in the
Moyasar dashboard with the same secret as `MOYASAR_WEBHOOK_SECRET`. The quick
tunnel URL changes every run, so update the dashboard entry when it does. The
script sets `MOYASAR_CALLBACK_URL` and `BETTER_AUTH_URL` for that process, so
you do not need to edit `.env` for each run.

The callback page always re-fetches the payment from Moyasar, so a missing
webhook only delays fulfilment until the customer returns. If both the callback
and webhook are lost, the payment page's **Refresh status** action (and the
`refreshPayment` server function) reconciles the active attempt with Moyasar:
it fetches a known payment id, or finds a fulfilled intent through the
`shop_plus_payment` metadata filter. An intent that is still `created` is reused
only when its locked amount and description match; otherwise it is canceled
before a replacement is issued. This keeps a second charge from being created
while an older attempt may still succeed.


### Local HTTPS (optional)

`bun run dev:https` serves the app over local TLS and is useful for testing
secure-cookie behaviour, but it does **not** satisfy Moyasar's public-domain
validation. Use `bun run dev:tunnel` for payments.

On first run the HTTPS command generates a self-signed certificate for
`localhost`, `127.0.0.1`, and `::1` in `certs/` (gitignored), then serves
`https://localhost:3000`. Browsers show a certificate warning the first time;
choose **Advanced → Proceed**. To use a browser-trusted certificate instead,
install [mkcert](https://github.com/FiloSottile/mkcert) and generate the same
files:

```bash
mkcert -install
mkcert -key-file certs/localhost-key.pem \
       -cert-file certs/localhost-cert.pem \
       localhost 127.0.0.1 ::1
```

`bun run dev` still serves plain HTTP.

### 4. Test a payment

1. Add products to the cart and choose **Card payment** at checkout.
2. You are redirected to `/payment/<orderId>`, which mounts the official form.
3. Use the sandbox test cards from the Moyasar documentation. A 3-D Secure
   challenge redirects to the bank and then back to `/payment-result?id=...`.
4. Confirm the order is marked paid under **My orders**.

Useful scenarios: a successful card, a declined card, abandoned checkout,
3-D Secure, and a full refund or void from the Moyasar dashboard. Refund and
void events set `isPaid` back to `false` with status `Refunded` or `Voided`.

Only unpaid **card** orders with status `Pending Payment` can enter the card
flow. Cash orders, canceled/refunded/voided/delivered orders, and orders already
marked paid are shown as unavailable instead of being charged. A payment that
succeeds after the order was canceled is recorded for reconciliation but never
fulfils the order, and the result page says so explicitly.

### Security invariants

- Amounts and totals come from the database order; the browser never supplies
  them.
- The secret key and client secrets are never persisted or logged.
- Every reported payment id is re-fetched from Moyasar with the secret key and
  checked for status, amount, currency, ownership, and order reference before
  the order changes. The amount is also re-checked against the current order
  total, not just the original attempt.
- Callback, form completion, refresh, and webhook all converge on one
  idempotent, serializable transaction, so a payment cannot fulfil an order
  twice.
- One active payment attempt per order is enforced by a unique column and a
  Postgres advisory lock.
- Duplicate callbacks, webhook retries, and concurrent requests are safe: the
  order is fulfilled once, `paidAt` and status history are not rewritten, and
  terminal attempts release the active slot.
- Pending, failed, authorized, and voided payments never fulfil an order.

### Automated payment tests

Payment tests use an in-memory Prisma stand-in and a mocked Moyasar client; no
real network or financial transaction is involved:

```bash
bun run test
```

They cover order eligibility, intent creation/reuse/superseding, verification
and amount/currency/ownership checks, canceled-order handling, duplicate and
concurrent callbacks, refresh recovery through payment ids and metadata, and
webhook signature, live-event, provider-failure, and duplicate-delivery paths.

### Sandbox limitations

This integration intentionally supports sandbox credentials only. Before
production use, plan for:

- live `pk_live_...` / `sk_live_...` keys and accepting live webhook events;
- a manual-capture flow for `authorized` payments (they are deliberately not
  treated as paid today);
- provider-side refund/void initiation from the admin UI (the current flow only
  records refunds/voids reported by Moyasar);
- monitoring for payments that are received but not fulfilled automatically
  (for example, a payment that arrives after cancellation), and an operational
  refund process for them.

