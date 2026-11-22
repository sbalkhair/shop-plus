import { PAGE_SIZE } from "@/lib/constant"
import { MAX_PAGE } from "@/lib/parse-number"
import { z } from "zod"

export const MAX_PRODUCT_PRICE = 1_000_000
export const MAX_PRODUCT_CATEGORY_LENGTH = 80

/**
 * UploadThing returns absolute HTTPS URLs. The admin form submits the URL
 * returned by the upload, and the server re-validates it before persisting it.
 */
export const productImageUrlSchema = z
  .string()
  .trim()
  .min(1, "Upload a product image before saving")
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:"
    } catch {
      return false
    }
  }, "Image URL must be a valid HTTPS URL")

/**
 * Product ids come from two sources: seeded products use 24-character hex ids,
 * while products created through the admin form receive a Prisma UUID. Keep the
 * check permissive enough for both without allowing arbitrary input.
 */
export const productIdSchema = z
  .string()
  .trim()
  .min(1, "Product id is required")
  .max(64, "Product id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid product id")

export const getProductSchema = z.object({ id: productIdSchema })

export const productSortSchema = z.enum([
  "featured",
  "price-asc",
  "price-desc",
  "rating",
  "newest",
])

export type ProductSort = z.infer<typeof productSortSchema>

/**
 * Storefront catalogue query. Filtering, sorting, and pagination all happen in
 * the database so the browser never downloads the full catalogue.
 */
export const productListQuerySchema = z.object({
  page: z.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.number().int().min(1).max(48).default(PAGE_SIZE),
  category: z
    .string()
    .trim()
    .min(1)
    .max(MAX_PRODUCT_CATEGORY_LENGTH)
    .optional(),
  organic: z.boolean().optional(),
  minPrice: z.number().min(0).max(MAX_PRODUCT_PRICE).optional(),
  maxPrice: z.number().min(0).max(MAX_PRODUCT_PRICE).optional(),
  sort: productSortSchema.default("featured"),
  /** Only products whose original price is above the selling price. */
  onSale: z.boolean().optional(),
  excludeId: productIdSchema.optional(),
})

export type ProductListInput = z.infer<typeof productListQuerySchema>

const productFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  description: z.string().trim().max(2000, "Description is too long"),
  price: z
    .number()
    .positive("Price must be greater than 0")
    .max(MAX_PRODUCT_PRICE, "Price is too large"),
  originalPrice: z
    .number()
    .min(0, "Original price cannot be negative")
    .max(MAX_PRODUCT_PRICE, "Original price is too large"),
  image: productImageUrlSchema,
  category: z
    .string()
    .trim()
    .min(1, "Choose a category")
    .max(MAX_PRODUCT_CATEGORY_LENGTH),
  unit: z.string().trim().min(1, "Unit is required").max(40),
  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative")
    .max(1_000_000, "Stock is too large"),
  isOrganic: z.boolean(),
})

const hasValidDiscount = (value: { originalPrice: number; price: number }) =>
  value.originalPrice === 0 || value.originalPrice >= value.price

const discountIssue = {
  path: ["originalPrice"],
  message: "Original price must be at least the selling price",
}

export const createProductSchema = productFieldsSchema.refine(
  hasValidDiscount,
  discountIssue
)

export const updateProductSchema = productFieldsSchema
  .extend({ id: productIdSchema })
  .refine(hasValidDiscount, discountIssue)

export const deleteProductSchema = z.object({ id: productIdSchema })

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type DeleteProductInput = z.infer<typeof deleteProductSchema>
