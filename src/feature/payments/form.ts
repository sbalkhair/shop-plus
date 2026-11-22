/**
 * Client-side integration with the official Moyasar payment form.
 *
 * Only the pinned official bundle is used. Card data never touches our code:
 * the form collects it and posts directly to Moyasar.
 */

const MOYASAR_VERSION = "2.3.1"
const MOYASAR_SCRIPT_SRC = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_VERSION}/dist/moyasar.umd.js`
const MOYASAR_STYLE_HREF = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_VERSION}/dist/moyasar.css`

/**
 * Subresource integrity for the pinned assets. If jsDelivr ever serves
 * different bytes for this version, the browser refuses to execute them.
 */
const MOYASAR_SCRIPT_INTEGRITY =
  "sha384-Yw0SJJLPRrlQhtpLguEnZJDCfn0+hFBJ1cj1ZYGC8iUx4bZUd+qCJazzvE6lI2kw"
const MOYASAR_STYLE_INTEGRITY =
  "sha384-8xmocx41kQKlYH5d4hks2PDITkdEzjB9/md8m+PMgZITQzMzwS6IUo9xlf+RGQW7"

export interface MoyasarPaymentSource {
  type?: string
  company?: string
  message?: string
  transaction_url?: string
}

export interface MoyasarFormPayment {
  id: string
  status: string
  amount: number
  currency: string
  description?: string
  source?: MoyasarPaymentSource
}

export interface MoyasarPaymentIntentRef {
  id: string
  client_secret: string
}

export interface MoyasarInitiatingOverrides {
  amount?: number
  currency?: string
  description?: string
  callback_url?: string
  metadata?: Record<string, string>
  publishable_api_key?: string
  save_card?: boolean
  use_payment_intent?: boolean
  payment_intent?: MoyasarPaymentIntentRef
}

export interface MoyasarFormConfig {
  element: string | HTMLElement
  amount: number
  currency: string
  description: string
  publishable_api_key: string
  callback_url: string
  methods?: string[]
  language?: string
  fixed_width?: boolean
  given_id?: string
  metadata?: Record<string, string>
  use_payment_intent?: boolean
  payment_intent?: MoyasarPaymentIntentRef
  on_initiating?: (
    source?: unknown
  ) => Promise<boolean | MoyasarInitiatingOverrides | void>
  on_completed?: (payment: MoyasarFormPayment) => Promise<void> | void
  on_failure?: (error: string) => void
  on_redirect?: (url: string) => void
}

export interface MoyasarGlobal {
  init: (config: MoyasarFormConfig) => void
  setAmount: (amount: number) => void
}

declare global {
  interface Window {
    Moyasar?: MoyasarGlobal
  }
}

let loaderPromise: Promise<MoyasarGlobal> | null = null

const ensureStyle = (): void => {
  if (document.querySelector("link[data-moyasar-style]")) {
    return
  }

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = MOYASAR_STYLE_HREF
  link.integrity = MOYASAR_STYLE_INTEGRITY
  link.crossOrigin = "anonymous"
  link.dataset.moyasarStyle = "true"
  document.head.appendChild(link)
}

/**
 * Loads the official form bundle once per page. Resolves with the global
 * `Moyasar` object.
 */
export const loadMoyasarForm = (): Promise<MoyasarGlobal> => {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("The Moyasar form can only be loaded in the browser.")
    )
  }

  if (window.Moyasar) {
    return Promise.resolve(window.Moyasar)
  }

  if (loaderPromise) {
    return loaderPromise
  }

  loaderPromise = new Promise<MoyasarGlobal>((resolve, reject) => {
    ensureStyle()

    const handleLoad = () => {
      if (window.Moyasar) {
        resolve(window.Moyasar)
        return
      }

      loaderPromise = null
      reject(new Error("The Moyasar form failed to initialize."))
    }

    const handleError = () => {
      loaderPromise = null
      reject(
        new Error(
          "Could not load the secure payment form. Check your connection and try again."
        )
      )
    }

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-moyasar-script]"
    )

    if (existing) {
      existing.addEventListener("load", handleLoad, { once: true })
      existing.addEventListener("error", handleError, { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = MOYASAR_SCRIPT_SRC
    script.integrity = MOYASAR_SCRIPT_INTEGRITY
    script.crossOrigin = "anonymous"
    script.async = true
    script.dataset.moyasarScript = "true"
    script.addEventListener("load", handleLoad, { once: true })
    script.addEventListener("error", handleError, { once: true })
    document.head.appendChild(script)
  })

  return loaderPromise
}
