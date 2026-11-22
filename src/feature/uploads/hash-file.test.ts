import { describe, expect, it } from "vitest"

import { hashFileName } from "./hash-file"

const makeFile = (name: string, type: string, content = "original-content") =>
  new File([content], name, {
    type,
    lastModified: 1_700_000_000_000,
  })

describe("hashFileName", () => {
  it("replaces the original name with a SHA-256 hash and keeps the extension", async () => {
    const hashed = await hashFileName(
      makeFile("holiday-photo.png", "image/png")
    )

    expect(hashed.name).toMatch(/^[a-f0-9]{64}\.png$/)
    expect(hashed.name).not.toContain("holiday")
    expect(hashed.type).toBe("image/png")
  })

  it("maps image MIME types to safe extensions", async () => {
    expect((await hashFileName(makeFile("x.jpeg", "image/jpeg"))).name).toMatch(
      /\.jpg$/
    )
    expect((await hashFileName(makeFile("x.webp", "image/webp"))).name).toMatch(
      /\.webp$/
    )
    expect((await hashFileName(makeFile("x.gif", "image/gif"))).name).toMatch(
      /\.gif$/
    )
  })

  it("produces unique names for identical content", async () => {
    const first = await hashFileName(makeFile("cat.png", "image/png"))
    const second = await hashFileName(makeFile("cat.png", "image/png"))

    expect(first.name).not.toBe(second.name)
  })

  it("keeps the uploaded file contents", async () => {
    const hashed = await hashFileName(
      makeFile("cat.png", "image/png", "image-bytes")
    )

    expect(await hashed.text()).toBe("image-bytes")
  })
})
