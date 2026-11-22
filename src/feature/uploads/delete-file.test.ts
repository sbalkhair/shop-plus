import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteUploadThingFileByUrl } from "./delete-file"

const { deleteFiles } = vi.hoisted(() => ({ deleteFiles: vi.fn() }))

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = deleteFiles
  },
}))

describe("deleteUploadThingFileByUrl", () => {
  beforeEach(() => {
    deleteFiles.mockReset()
  })

  it("deletes the file key derived from an UploadThing URL", async () => {
    deleteFiles.mockResolvedValue({ success: true, deletedCount: 1 })

    await expect(
      deleteUploadThingFileByUrl("https://gc1t1626x6.ufs.sh/f/abc123.png")
    ).resolves.toBe(true)

    expect(deleteFiles).toHaveBeenCalledWith("abc123.png")
  })

  it("skips external image hosts without calling UploadThing", async () => {
    await expect(
      deleteUploadThingFileByUrl("https://raw.githubusercontent.com/a/b.png")
    ).resolves.toBe(false)

    expect(deleteFiles).not.toHaveBeenCalled()
  })

  it("throws when UploadThing reports a failed deletion", async () => {
    deleteFiles.mockResolvedValue({ success: false, deletedCount: 0 })

    await expect(
      deleteUploadThingFileByUrl("https://x.ufs.sh/f/key.png")
    ).rejects.toThrow(/could not delete/i)
  })
})
