import { describe, expect, it } from "vitest"
import {
  categoryIdSchema,
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "./schema"

const categoryId = "0f8fad5b-d9cb-469f-a165-70867728950e"

const validCategory = {
  name: "Fruits & Vegetables",
  slug: "fruits-vegetables",
  image: "https://gc1t1626x6.ufs.sh/f/abc123",
}

const parse = (input: unknown) => createCategorySchema.safeParse(input)

describe("createCategorySchema", () => {
  it("accepts a complete category", () => {
    const result = parse(validCategory)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validCategory)
    }
  })

  it("accepts a blank image because category artwork is optional", () => {
    expect(parse({ ...validCategory, image: "" }).success).toBe(true)
  })

  it("rejects a non-HTTPS image", () => {
    expect(
      parse({ ...validCategory, image: "http://example.com/a.png" }).success
    ).toBe(false)
    expect(parse({ ...validCategory, image: "not-a-url" }).success).toBe(false)
  })

  it("rejects a name that is too short or too long", () => {
    expect(parse({ ...validCategory, name: "A" }).success).toBe(false)
    expect(parse({ ...validCategory, name: "a".repeat(81) }).success).toBe(
      false
    )
  })

  it("requires a URL-safe slug", () => {
    expect(parse({ ...validCategory, slug: "" }).success).toBe(false)
    expect(parse({ ...validCategory, slug: "Fruits" }).success).toBe(false)
    expect(
      parse({ ...validCategory, slug: "fruits--vegetables" }).success
    ).toBe(false)
    expect(parse({ ...validCategory, slug: "fruits vegetables" }).success).toBe(
      false
    )
    expect(
      parse({ ...validCategory, slug: "fruits-vegetables-2" }).success
    ).toBe(true)
  })

  it("trims whitespace before validating", () => {
    const result = parse({
      name: "  Fruits  ",
      slug: "  fruits  ",
      image: "",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Fruits")
      expect(result.data.slug).toBe("fruits")
    }
  })
})

describe("updateCategorySchema", () => {
  it("accepts a complete category with a UUID id", () => {
    expect(
      updateCategorySchema.safeParse({ ...validCategory, id: categoryId })
        .success
    ).toBe(true)
  })

  it("requires a valid UUID id", () => {
    expect(updateCategorySchema.safeParse(validCategory).success).toBe(false)
    expect(
      updateCategorySchema.safeParse({ ...validCategory, id: "" }).success
    ).toBe(false)
    expect(
      updateCategorySchema.safeParse({ ...validCategory, id: "not-a-uuid" })
        .success
    ).toBe(false)
  })

  it("still enforces the slug rule", () => {
    expect(
      updateCategorySchema.safeParse({
        ...validCategory,
        id: categoryId,
        slug: "Invalid Slug",
      }).success
    ).toBe(false)
  })
})

describe("deleteCategorySchema", () => {
  it("accepts a valid id", () => {
    expect(deleteCategorySchema.safeParse({ id: categoryId }).success).toBe(
      true
    )
  })

  it("rejects a missing or malformed id", () => {
    expect(deleteCategorySchema.safeParse({}).success).toBe(false)
    expect(deleteCategorySchema.safeParse({ id: "" }).success).toBe(false)
    expect(deleteCategorySchema.safeParse({ id: "a/b" }).success).toBe(false)
  })
})

describe("categoryIdSchema", () => {
  it("requires a UUID", () => {
    expect(categoryIdSchema.safeParse(categoryId).success).toBe(true)
    expect(categoryIdSchema.safeParse("69c22613ae75a98c7cd13b37").success).toBe(
      false
    )
  })
})
