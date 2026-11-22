-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- Seed the categories that existing products already reference. Image URLs are
-- filled in by `prisma/seed.ts`, which uploads the bundled category artwork.
INSERT INTO "category" ("id", "slug", "name", "sortOrder", "updatedAt") VALUES
    ('f6eaf1f3-7e74-4417-afd1-f6d8a29b23bc', 'fruits-vegetables', 'Fruits & Vegetables', 0, CURRENT_TIMESTAMP),
    ('18228dcf-acb1-4992-bf56-422716f01f4c', 'personal-care', 'Personal Care', 1, CURRENT_TIMESTAMP),
    ('b3b80b61-9831-4535-880b-fde3b1fe938e', 'pantry-staples', 'Pantry Staples', 2, CURRENT_TIMESTAMP),
    ('090dd650-1a3f-4e1c-966f-a78f5ab5c9cb', 'bakery', 'Bakery', 3, CURRENT_TIMESTAMP),
    ('2bad4516-c1bc-444e-be14-8011632f6c73', 'beverages', 'Beverages', 4, CURRENT_TIMESTAMP),
    ('98a8fa5e-43f7-4aec-80b3-6fc84e150517', 'meat-seafood', 'Meat & Seafood', 5, CURRENT_TIMESTAMP),
    ('4c42b1a8-38b9-40e2-a301-6b20f7af6645', 'snacks', 'Snacks', 6, CURRENT_TIMESTAMP),
    ('8171269c-c0b6-4b79-8ada-178ec6344310', 'frozen-foods', 'Frozen Foods', 7, CURRENT_TIMESTAMP),
    ('383bf227-1bf7-4024-b24d-1ae2d3bdf2f9', 'baby-care', 'Baby Care', 8, CURRENT_TIMESTAMP),
    ('0a1392a2-5a51-46b7-9889-3f7e5581702b', 'dairy-eggs', 'Dairy & Eggs', 9, CURRENT_TIMESTAMP);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_fkey" FOREIGN KEY ("category") REFERENCES "category"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
