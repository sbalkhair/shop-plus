import { describe, expect, it } from "vitest"
import { assertPublicCallbackUrl, isPrivateCallbackHost } from "./callback"

describe("callback URL validation", () => {
  it("accepts public HTTPS domains", () => {
    expect(() =>
      assertPublicCallbackUrl(
        new URL("https://shop.example.com/payment-result")
      )
    ).not.toThrow()

    expect(() =>
      assertPublicCallbackUrl(
        new URL("https://random-name.trycloudflare.com/payment-result")
      )
    ).not.toThrow()
  })

  it("rejects localhost and private hosts", () => {
    for (const host of [
      "localhost",
      "app.localhost",
      "printer.local",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.20",
      "172.16.4.2",
      "172.31.255.1",
      "0.0.0.0",
      "::1",
      "[::1]",
    ]) {
      expect(isPrivateCallbackHost(host)).toBe(true)
    }

    expect(isPrivateCallbackHost("example.com")).toBe(false)
    expect(isPrivateCallbackHost("172.32.0.1")).toBe(false)
    expect(isPrivateCallbackHost("8.8.8.8")).toBe(false)
  })

  it("rejects plain HTTP even for a public host", () => {
    expect(() =>
      assertPublicCallbackUrl(new URL("http://shop.example.com/payment-result"))
    ).toThrow(/HTTPS/i)
  })

  it("rejects a private host over HTTPS with a clear message", () => {
    expect(() =>
      assertPublicCallbackUrl(new URL("https://localhost:3000/payment-result"))
    ).toThrow(/public callback domain/i)
  })
})
