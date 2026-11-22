import { z } from "zod"

const MAX_IMAGE_URL = 2048

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Category artwork is optional. When present it must be the HTTPS URL returned
 * by the admin-only UploadThing route, matching product images.
 */
export const categoryImageUrlSchema = z
  .string()
  .trim()
  .max(MAX_IMAGE_URL, "Image URL is too long")
  .refine(
    (value) => value === "" || isHttpsUrl(value),
    "Image URL must be a valid HTTPS URL"
  )

/**
 * The slug is stored on every product and used in catalogue filters, so keep it
 * URL-safe. Editing a slug cascades to the products that reference it.
 */
export const categorySlugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(80, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens"
  )

export const categoryIdSchema = z.string().uuid("Invalid category id")

const categoryFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  slug: categorySlugSchema,
  image: categoryImageUrlSchema,
})

export const createCategorySchema = categoryFieldsSchema

export const updateCategorySchema = categoryFieldsSchema.extend({
  id: categoryIdSchema,
})

export const deleteCategorySchema = z.object({ id: categoryIdSchema })

export const getCategorySchema = z.object({ id: categoryIdSchema })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>
