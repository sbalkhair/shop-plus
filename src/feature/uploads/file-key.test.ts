import { describe, expect, it } from "vitest"

import { getUploadThingFileKey } from "./file-key"

describe("getUploadThingFileKey", () => {
  it("extracts keys from current and legacy UploadThing hosts", () => {
    expect(
      getUploadThingFileKey("https://gc1t1626x6.ufs.sh/f/abc123_image.png")
    ).toBe("abc123_image.png")
    expect(getUploadThingFileKey("https://uploadthing.com/f/key.jpg")).toBe(
      "key.jpg"
    )
    expect(getUploadThingFileKey("https://utfs.io/f/key.jpg")).toBe("key.jpg")
  })

  it("decodes URL-encoded keys", () => {
    expect(getUploadThingFileKey("https://x.ufs.sh/f/abc%20def.png")).toBe(
      "abc def.png"
    )
  })

  it("ignores external, insecure, and malformed URLs", () => {
    expect(
      getUploadThingFileKey("https://raw.githubusercontent.com/a/b.png")
    ).toBeNull()
    expect(getUploadThingFileKey("http://x.ufs.sh/f/key.png")).toBeNull()
    expect(getUploadThingFileKey("https://x.ufs.sh/key.png")).toBeNull()
    expect(
      getUploadThingFileKey("https://x.ufs.sh/f/nested/key.png")
    ).toBeNull()
    expect(getUploadThingFileKey("not a url")).toBeNull()
    expect(getUploadThingFileKey("")).toBeNull()
  })

  it("does not match look-alike hosts", () => {
    expect(getUploadThingFileKey("https://notufs.sh/f/key.png")).toBeNull()
    expect(
      getUploadThingFileKey("https://ufs.sh.evil.example/f/key.png")
    ).toBeNull()
  })
})
