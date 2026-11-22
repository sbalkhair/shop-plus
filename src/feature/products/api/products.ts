import { authorizationMiddleware } from "@/feature/auth/middleware"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import type { Product } from "@/types"
import { createServerFn } from "@tanstack/react-start"
import {
  createProductSchema,
  deleteProductSchema,
  getProductSchema,
  productListQuerySchema,
  updateProductSchema,
  type CreateProductInput,
  type ProductSort,
} from "../schema"

interface ProductRow {
  id: string
  name: string
  description: string | null
  price: number
  originalPrice: number | null
  image: string
  category: string
  unit: string | null
  stock: number | null
  isOrganic: boolean | null
  rating: number | null
  reviewCount: number | null
  createdAt: Date
}

const mapProduct = (product: ProductRow): Product => {
  const originalPrice = product.originalPrice ?? product.price
  const discount =
    originalPrice > product.price
      ? Math.round(((originalPrice - product.price) / originalPrice) * 100)
      : 0

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    originalPrice,
    image: product.image,
    category: product.category,
    unit: product.unit ?? "",
    stock: product.stock ?? 0,
    isOrganic: product.isOrganic ?? false,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    discount,
    createdAt: product.createdAt.toISOString(),
  }
}

export interface ProductListResult {
  products: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** Counts across the whole catalogue, used by the category sidebar. */
  categoryCounts: Record<string, number>
  totalProducts: number
}

const productOrderBy = (
  sort: ProductSort
): Prisma.ProductOrderByWithRelationInput[] => {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { createdAt: "desc" }]
    case "price-desc":
      return [{ price: "desc" }, { createdAt: "desc" }]
    case "rating":
      return [{ rating: "desc" }, { createdAt: "desc" }]
    default:
      // `featured` keeps the historical newest-first catalogue order.
      return [{ createdAt: "desc" }]
  }
}

/**
 * Storefront catalogue page. Filters, sorting, and pagination are resolved in
 * the database; the full catalogue is never sent to the browser.
 */
export const listProducts = createServerFn({ method: "GET" })
  .validator((data: unknown) => productListQuerySchema.parse(data))
  .handler(async ({ data }): Promise<ProductListResult> => {
    const where: Prisma.ProductWhereInput = {
      ...(data.category ? { category: data.category } : {}),
      ...(data.organic ? { isOrganic: true } : {}),
      ...(data.minPrice !== undefined || data.maxPrice !== undefined
        ? {
            price: {
              ...(data.minPrice !== undefined ? { gte: data.minPrice } : {}),
              ...(data.maxPrice !== undefined ? { lte: data.maxPrice } : {}),
            },
          }
        : {}),
      ...(data.excludeId ? { id: { not: data.excludeId } } : {}),
    }

    const categoryGroups = await prisma.product.groupBy({
      by: ["category"],
      _count: { _all: true },
    })

    const categoryCounts = Object.fromEntries(
      categoryGroups.map((group) => [group.category, group._count._all])
    )
    const totalProducts = categoryGroups.reduce(
      (sum, group) => sum + group._count._all,
      0
    )

    // `discount` is derived by comparing two columns, which Prisma cannot
    // express in a `where` clause. Resolve matching ids first, then load only
    // the requested page.
    let onSaleIds: string[] | null = null
    let total: number

    if (data.onSale) {
      const candidates = await prisma.product.findMany({
        where,
        select: { id: true, price: true, originalPrice: true },
      })

      onSaleIds = candidates
        .filter((product) => (product.originalPrice ?? 0) > product.price)
        .map((product) => product.id)

      total = onSaleIds.length
    } else {
      total = await prisma.product.count({ where })
    }

    const totalPages = Math.max(1, Math.ceil(total / data.pageSize))
    const page = Math.min(data.page, totalPages)
    const skip = (page - 1) * data.pageSize

    let rows: ProductRow[]

    if (onSaleIds) {
      const pageIds = onSaleIds.slice(skip, skip + data.pageSize)

      rows =
        pageIds.length === 0
          ? []
          : await prisma.product.findMany({
              where: { id: { in: pageIds } },
              orderBy: productOrderBy(data.sort),
            })
    } else {
      rows = await prisma.product.findMany({
        where,
        orderBy: productOrderBy(data.sort),
        skip,
        take: data.pageSize,
      })
    }

    return {
      products: rows.map(mapProduct),
      total,
      page,
      pageSize: data.pageSize,
      totalPages,
      categoryCounts,
      totalProducts,
    }
  })

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    })

    return products.map(mapProduct)
  }
)

export const getProduct = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => getProductSchema.parse(data))
  .handler(async ({ data }): Promise<Product | null> => {
    const product = await prisma.product.findUnique({
      where: { id: data.id },
    })

    return product ? mapProduct(product) : null
  })

/**
 * Normalises editable fields before they reach the database. A blank original
 * price (0) means "no discount", so a value below the selling price is never
 * stored.
 */
const toProductData = (data: CreateProductInput) => ({
  name: data.name,
  description: data.description,
  price: data.price,
  originalPrice:
    data.originalPrice > data.price ? data.originalPrice : data.price,
  image: data.image,
  category: data.category,
  unit: data.unit,
  stock: data.stock,
  isOrganic: data.isOrganic,
})

/**
 * Creates a product from the admin form.
 *
 * Only admins hold `products:create`. The client submits a URL returned by the
 * admin-only UploadThing route; price, stock, and every other field are
 * validated again here before they reach the database.
 */
export const createProduct = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["products:create"] })])
  .validator((data: unknown) => createProductSchema.parse(data))
  .handler(async ({ data }): Promise<Product> => {
    const category = await prisma.category.findUnique({
      where: { slug: data.category },
    })

    if (!category) {
      throw new Error("Choose a valid category")
    }

    const product = await prisma.product.create({
      data: toProductData(data),
    })

    return mapProduct(product)
  })

/**
 * Updates an existing product from the admin form. Only admins hold
 * `products:update`.
 */
export const updateProduct = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["products:update"] })])
  .validator((data: unknown) => updateProductSchema.parse(data))
  .handler(async ({ data }): Promise<Product> => {
    const { id, ...fields } = data

    const existing = await prisma.product.findUnique({ where: { id } })

    if (!existing) {
      throw new Error("Product not found")
    }

    const category = await prisma.category.findUnique({
      where: { slug: fields.category },
    })

    if (!category) {
      throw new Error("Choose a valid category")
    }

    const product = await prisma.product.update({
      where: { id },
      data: toProductData(fields),
    })

    return mapProduct(product)
  })

/**
 * Permanently removes a product. Only admins hold `products:delete`.
 */
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["products:delete"] })])
  .validator((data: unknown) => deleteProductSchema.parse(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const existing = await prisma.product.findUnique({ where: { id: data.id } })

    if (!existing) {
      throw new Error("Product not found")
    }

    await prisma.product.delete({ where: { id: data.id } })

    // The product is already gone, so storage cleanup must not turn a
    // successful delete into an error for the admin. Seeded products point at
    // external images and are ignored by the helper.
    try {
      const { deleteUploadThingFileByUrl } =
        await import("@/feature/uploads/delete-file")
      await deleteUploadThingFileByUrl(existing.image)
    } catch (error) {
      console.error(`Could not delete image for product ${data.id}`, error)
    }

    return { id: data.id }
  })
