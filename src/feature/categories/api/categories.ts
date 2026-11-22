import { authorizationMiddleware } from "@/feature/auth/middleware"
import { prisma } from "@/lib/db"
import type { Category } from "@/types"
import { createServerFn } from "@tanstack/react-start"
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
} from "../schema"

interface CategoryRow {
  id: string
  slug: string
  name: string
  image: string
  sortOrder: number
}

const mapCategory = (category: CategoryRow): Category => ({
  id: category.id,
  slug: category.slug,
  name: category.name,
  image: category.image,
  sortOrder: category.sortOrder,
})

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002"

/**
 * Categories are public catalogue data, so this endpoint has no middleware.
 * The admin pages use it to populate the product form and the management table.
 */
export const getCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<Category[]> => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return categories.map(mapCategory)
  }
)

export const getCategory = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => getCategorySchema.parse(data))
  .handler(async ({ data }): Promise<Category | null> => {
    const category = await prisma.category.findUnique({
      where: { id: data.id },
    })

    return category ? mapCategory(category) : null
  })

const toCategoryData = (data: CreateCategoryInput) => ({
  name: data.name,
  slug: data.slug,
  image: data.image,
})

/**
 * Creates a category from the admin form. Only admins hold
 * `categories:create`; the slug is validated again on the server.
 */
export const createCategory = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["categories:create"] })])
  .validator((data: unknown) => createCategorySchema.parse(data))
  .handler(async ({ data }): Promise<Category> => {
    try {
      const category = await prisma.category.create({
        data: toCategoryData(data),
      })

      return mapCategory(category)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(
          `A category with the slug "${data.slug}" already exists`
        )
      }

      throw error
    }
  })

/**
 * Updates a category. Renaming the slug cascades to the products that use it.
 * Only admins hold `categories:update`.
 */
export const updateCategory = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["categories:update"] })])
  .validator((data: unknown) => updateCategorySchema.parse(data))
  .handler(async ({ data }): Promise<Category> => {
    const { id, ...fields } = data

    const existing = await prisma.category.findUnique({ where: { id } })

    if (!existing) {
      throw new Error("Category not found")
    }

    try {
      const category = await prisma.category.update({
        where: { id },
        data: toCategoryData(fields),
      })

      return mapCategory(category)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(
          `A category with the slug "${fields.slug}" already exists`
        )
      }

      throw error
    }
  })

/**
 * Permanently removes a category. Products reference categories through a
 * foreign key, so a category that is still in use cannot be deleted. Only
 * admins hold `categories:delete`.
 */
export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["categories:delete"] })])
  .validator((data: unknown) => deleteCategorySchema.parse(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const existing = await prisma.category.findUnique({
      where: { id: data.id },
    })

    if (!existing) {
      throw new Error("Category not found")
    }

    const productCount = await prisma.product.count({
      where: { category: existing.slug },
    })

    if (productCount > 0) {
      throw new Error(
        `"${existing.name}" still has ${productCount} product${
          productCount === 1 ? "" : "s"
        }. Move or delete them before deleting the category.`
      )
    }

    await prisma.category.delete({ where: { id: data.id } })

    // The category is already gone, so storage cleanup must not turn a
    // successful delete into an error for the admin.
    if (existing.image) {
      try {
        const { deleteUploadThingFileByUrl } =
          await import("@/feature/uploads/delete-file")
        await deleteUploadThingFileByUrl(existing.image)
      } catch (error) {
        console.error(`Could not delete image for category ${data.id}`, error)
      }
    }

    return { id: data.id }
  })
