import { readFile } from "node:fs/promises"

import { PrismaPg } from "@prisma/adapter-pg"
import "dotenv/config"
import { UTApi } from "uploadthing/server"

import { dummyProducts } from "../asset/products.ts"
import { PrismaClient } from "../src/generated/prisma/client.ts"
import { deleteUploadThingFileByUrl } from "../src/feature/uploads/delete-file.ts"
import { getUploadThingFileKey } from "../src/feature/uploads/file-key.ts"
import { hashFileName } from "../src/feature/uploads/hash-file.ts"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})
const utapi = new UTApi()

/**
 * `--clean` removes every existing product and category (and any UploadThing
 * images they reference) before re-seeding. Without it the seed is idempotent
 * and reuses images that are already hosted on UploadThing.
 */
const shouldClean = process.argv.includes("--clean")

interface SeedCategory {
  slug: string
  name: string
  sortOrder: number
  /** Bundled artwork in `asset/`, uploaded to UploadThing during seeding. */
  file: string
}

const seedCategories: SeedCategory[] = [
  {
    slug: "fruits-vegetables",
    name: "Fruits & Vegetables",
    sortOrder: 0,
    file: "fruits_vegetables.png",
  },
  {
    slug: "personal-care",
    name: "Personal Care",
    sortOrder: 1,
    file: "personal_care.png",
  },
  {
    slug: "pantry-staples",
    name: "Pantry Staples",
    sortOrder: 2,
    file: "pantry_staples.png",
  },
  { slug: "bakery", name: "Bakery", sortOrder: 3, file: "bakery.png" },
  { slug: "beverages", name: "Beverages", sortOrder: 4, file: "drinks.png" },
  {
    slug: "meat-seafood",
    name: "Meat & Seafood",
    sortOrder: 5,
    file: "meat_seafood.png",
  },
  { slug: "snacks", name: "Snacks", sortOrder: 6, file: "snacks.png" },
  {
    slug: "frozen-foods",
    name: "Frozen Foods",
    sortOrder: 7,
    file: "frozen_foods.png",
  },
  {
    slug: "baby-care",
    name: "Baby Care",
    sortOrder: 8,
    file: "baby_care.png",
  },
  {
    slug: "dairy-eggs",
    name: "Dairy & Eggs",
    sortOrder: 9,
    file: "dairy_eggs.png",
  },
]

const EXTENSION_BY_MIME: Partial<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const MIME_BY_EXTENSION: Partial<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}
const EXTENSION_IN_URL = /\.([a-z0-9]{2,5})$/i

const resolveImageType = (contentType: string | null, url: string) => {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  const extension =
    EXTENSION_BY_MIME[mime] ??
    EXTENSION_IN_URL.exec(new URL(url).pathname)?.[1]?.toLowerCase() ??
    "png"

  return {
    extension,
    type: mime.startsWith("image/")
      ? mime
      : `image/${extension === "jpg" ? "jpeg" : extension}`,
  }
}

const downloadSeedImage = async (url: string): Promise<File> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}`)
  }

  const { extension, type } = resolveImageType(
    response.headers.get("content-type"),
    url
  )
  const bytes = new Uint8Array(await response.arrayBuffer())

  return new File([bytes], `seed.${extension}`, { type })
}

const readBundledImage = async (fileName: string): Promise<File> => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "png"
  const type = MIME_BY_EXTENSION[extension] ?? "image/png"
  const bytes = await readFile(new URL(`../asset/${fileName}`, import.meta.url))

  return new File([bytes], fileName, { type })
}

const uploadFile = async (file: File): Promise<string> => {
  const result = await utapi.uploadFiles(file)
  const uploaded =
    (result as { right?: { ufsUrl?: string }; data?: { ufsUrl?: string } })
      .right ?? (result as { data?: { ufsUrl?: string } }).data

  if (!uploaded?.ufsUrl) {
    throw new Error(`UploadThing upload failed for ${file.name}`)
  }

  return uploaded.ufsUrl
}

/**
 * Uploads a seed image to UploadThing under a hashed filename and returns its
 * public URL. Images that are already on UploadThing are left untouched.
 */
const uploadSeedImage = async (url: string): Promise<string> => {
  if (getUploadThingFileKey(url)) {
    return url
  }

  return uploadFile(await hashFileName(await downloadSeedImage(url)))
}

const uploadCategoryImage = async (fileName: string): Promise<string> =>
  uploadFile(await hashFileName(await readBundledImage(fileName)))

const removeExistingProducts = async () => {
  const products = await prisma.product.findMany({
    select: { id: true, image: true },
  })

  if (products.length === 0) {
    return
  }

  await prisma.product.deleteMany()

  for (const product of products) {
    try {
      await deleteUploadThingFileByUrl(product.image)
    } catch (error) {
      console.warn(`Could not delete image for product ${product.id}`, error)
    }
  }

  console.log(`Deleted ${products.length} existing products.`)
}

const removeExistingCategories = async () => {
  const categories = await prisma.category.findMany({
    select: { id: true, image: true },
  })

  if (categories.length === 0) {
    return
  }

  await prisma.category.deleteMany()

  for (const category of categories) {
    if (!category.image) {
      continue
    }

    try {
      await deleteUploadThingFileByUrl(category.image)
    } catch (error) {
      console.warn(`Could not delete image for category ${category.id}`, error)
    }
  }

  console.log(`Deleted ${categories.length} existing categories.`)
}

async function main() {
  const [existingProducts, existingCategories] = await Promise.all([
    prisma.product.findMany({ select: { id: true, image: true } }),
    prisma.category.findMany({
      select: { id: true, slug: true, image: true },
    }),
  ])

  const existingProductById = new Map(
    existingProducts.map((product) => [product.id, product])
  )
  const existingCategoryBySlug = new Map(
    existingCategories.map((category) => [category.slug, category])
  )
  const uploadedProductImages = new Map<string, string>()
  const uploadedCategoryImages = new Map<string, string>()

  // Upload (or reuse) every image before touching the database so a failed
  // upload cannot leave the catalogue half-written.
  const categoryRows: Array<{
    slug: string
    data: { name: string; image: string; sortOrder: number }
  }> = []

  for (const category of seedCategories) {
    const existing = existingCategoryBySlug.get(category.slug)
    let image = uploadedCategoryImages.get(category.file)

    if (!image && !shouldClean && existing) {
      const reusableImage = getUploadThingFileKey(existing.image)
        ? existing.image
        : undefined
      image = reusableImage
    }

    if (!image) {
      image = await uploadCategoryImage(category.file)
      uploadedCategoryImages.set(category.file, image)
    }

    categoryRows.push({
      slug: category.slug,
      data: {
        name: category.name,
        image,
        sortOrder: category.sortOrder,
      },
    })
  }

  const productRows: Array<{
    id: string
    data: {
      name: string
      description: string
      price: number
      originalPrice: number
      image: string
      category: string
      unit: string
      stock: number
      isOrganic: boolean
      rating: number
      reviewCount: number
      createdAt: Date
      updatedAt: Date
    }
  }> = []

  for (const product of dummyProducts) {
    const existingImage = existingProductById.get(product._id)?.image
    const canReuse =
      !shouldClean &&
      existingImage !== undefined &&
      getUploadThingFileKey(existingImage) !== null

    let image = canReuse
      ? existingImage
      : uploadedProductImages.get(product.image)

    if (!image) {
      image = await uploadSeedImage(product.image)
      uploadedProductImages.set(product.image, image)
    }

    productRows.push({
      id: product._id,
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        image,
        category: product.category,
        unit: product.unit,
        stock: product.stock,
        isOrganic: product.isOrganic,
        rating: product.rating,
        reviewCount: product.reviewCount,
        createdAt: new Date(product.createdAt),
        updatedAt: new Date(product.updatedAt),
      },
    })
  }

  if (shouldClean) {
    // Products must go first because they reference categories.
    await removeExistingProducts()
    await removeExistingCategories()
  }

  await prisma.$transaction(
    [
      ...categoryRows.map(({ slug, data }) =>
        prisma.category.upsert({
          where: { slug },
          update: data,
          create: { slug, ...data },
        })
      ),
      ...productRows.map(({ id, data }) =>
        prisma.product.upsert({
          where: { id },
          update: data,
          create: { id, ...data },
        })
      ),
    ],
    { maxWait: 60_000, timeout: 300_000 }
  )

  console.log(
    `Seeded ${categoryRows.length} categories and ${productRows.length} products with images hosted on UploadThing.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
