import { describe, expect, it } from "vitest"

import { PAGE_SIZE } from "@/lib/constant"
import {
  createProductSchema,
  deleteProductSchema,
  getProductSchema,
  productIdSchema,
  productListQuerySchema,
  updateProductSchema,
} from "./schema"

const validProduct = {
  name: "Organic Bananas",
  description: "Fresh bananas",
  price: 12.5,
  originalPrice: 15,
  image: "https://gc1t1626x6.ufs.sh/f/abc123",
  category: "fruits-vegetables",
  unit: "kg",
  stock: 20,
  isOrganic: true,
}

const parse = (input: unknown) => createProductSchema.safeParse(input)

describe("createProductSchema", () => {
  it("accepts a complete product", () => {
    const result = parse(validProduct)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validProduct)
    }
  })

  it("accepts a blank original price as 'no discount'", () => {
    const result = parse({ ...validProduct, originalPrice: 0 })

    expect(result.success).toBe(true)
  })

  it("rejects a missing or non-HTTPS image", () => {
    expect(parse({ ...validProduct, image: "" }).success).toBe(false)
    expect(
      parse({ ...validProduct, image: "http://example.com/a.png" }).success
    ).toBe(false)
    expect(parse({ ...validProduct, image: "not-a-url" }).success).toBe(false)
  })

  it("rejects a non-positive price", () => {
    expect(parse({ ...validProduct, price: 0 }).success).toBe(false)
    expect(parse({ ...validProduct, price: -1 }).success).toBe(false)
  })

  it("rejects an original price below the selling price", () => {
    expect(parse({ ...validProduct, originalPrice: 10 }).success).toBe(false)
  })

  it("rejects invalid stock values", () => {
    expect(parse({ ...validProduct, stock: -1 }).success).toBe(false)
    expect(parse({ ...validProduct, stock: 1.5 }).success).toBe(false)
  })

  it("requires a category and unit", () => {
    expect(parse({ ...validProduct, category: "" }).success).toBe(false)
    expect(parse({ ...validProduct, unit: "" }).success).toBe(false)
  })
})

const productId = "69c22613ae75a98c7cd13b37"

describe("updateProductSchema", () => {
  it("accepts a complete product with an id", () => {
    const result = updateProductSchema.safeParse({
      ...validProduct,
      id: productId,
    })

    expect(result.success).toBe(true)
  })

  it("accepts a Prisma UUID id", () => {
    expect(
      updateProductSchema.safeParse({
        ...validProduct,
        id: "0f8fad5b-d9cb-469f-a165-70867728950e",
      }).success
    ).toBe(true)
  })

  it("requires a valid id", () => {
    expect(updateProductSchema.safeParse(validProduct).success).toBe(false)
    expect(
      updateProductSchema.safeParse({ ...validProduct, id: "" }).success
    ).toBe(false)
    expect(
      updateProductSchema.safeParse({ ...validProduct, id: "has spaces" })
        .success
    ).toBe(false)
  })

  it("still enforces the discount rule", () => {
    expect(
      updateProductSchema.safeParse({
        ...validProduct,
        id: productId,
        originalPrice: 10,
      }).success
    ).toBe(false)
  })
})

describe("deleteProductSchema", () => {
  it("accepts a valid id", () => {
    expect(deleteProductSchema.safeParse({ id: productId }).success).toBe(true)
  })

  it("rejects a missing or malformed id", () => {
    expect(deleteProductSchema.safeParse({}).success).toBe(false)
    expect(deleteProductSchema.safeParse({ id: "" }).success).toBe(false)
    expect(deleteProductSchema.safeParse({ id: "a/b" }).success).toBe(false)
  })
})

describe("productIdSchema", () => {
  it("accepts both seeded hex ids and Prisma UUIDs", () => {
    expect(productIdSchema.safeParse(productId).success).toBe(true)
    expect(
      productIdSchema.safeParse("0f8fad5b-d9cb-469f-a165-70867728950e").success
    ).toBe(true)
  })
})

describe("product list query", () => {
  it("applies storefront defaults", () => {
    expect(productListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: PAGE_SIZE,
      sort: "featured",
    })
  })

  it("rejects invalid pages and prices", () => {
    expect(productListQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(productListQuerySchema.safeParse({ minPrice: -1 }).success).toBe(
      false
    )
  })

  it("accepts sale and category filters", () => {
    expect(
      productListQuerySchema.parse({
        category: "bakery",
        onSale: true,
        sort: "price-asc",
      })
    ).toMatchObject({
      category: "bakery",
      onSale: true,
      sort: "price-asc",
    })
  })
})

describe("getProduct schema", () => {
  it("only accepts safe ids", () => {
    expect(getProductSchema.safeParse({ id: "abc123" }).success).toBe(true)
    expect(getProductSchema.safeParse({ id: "../etc" }).success).toBe(false)
  })
})
