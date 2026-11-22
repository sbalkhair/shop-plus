import { describe, expect, it } from "vitest"

import { myOrdersQuerySchema, orderItemsSchema } from "./schema"

describe("order item schema", () => {
  it("normalises stored order items", () => {
    expect(
      orderItemsSchema.parse([
        {
          product: "product-1",
          name: "Olive oil",
          image: "https://example.com/oil.png",
          price: 12.5,
          quantity: 2,
        },
      ])
    ).toEqual([
      {
        product: "product-1",
        name: "Olive oil",
        image: "https://example.com/oil.png",
        price: 12.5,
        quantity: 2,
        unit: "",
      },
    ])
  })

  it("rejects invalid quantities", () => {
    expect(
      orderItemsSchema.safeParse([{ product: "p", quantity: 0 }]).success
    ).toBe(false)
  })
})

describe("my orders query", () => {
  it("defaults to the first page", () => {
    expect(myOrdersQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    })
  })

  it("accepts a status filter and page", () => {
    expect(
      myOrdersQuerySchema.parse({ page: 2, status: "Delivered" })
    ).toMatchObject({ page: 2, status: "Delivered" })
  })
})
