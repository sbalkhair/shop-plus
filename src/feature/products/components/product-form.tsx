import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createProduct, updateProduct } from "@/feature/products/api/products"
import {
  createProductSchema,
  type CreateProductInput,
} from "@/feature/products/schema"
import { useUploadThing } from "@/feature/uploads/client"
import { hashFileName } from "@/feature/uploads/hash-file"
import type { Category, Product } from "@/types"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { ImagePlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface ProductFormProps {
  /** Admin-managed categories available for the product. */
  categories: Category[]
  /** When provided, the form updates this product instead of creating one. */
  product?: Product
  /** Called after the product is saved. */
  onSaved?: (product: Product) => void
}

export function ProductForm({
  categories,
  product,
  onSaved,
}: ProductFormProps) {
  const isEditing = Boolean(product)
  const [fileInputKey, setFileInputKey] = useState(0)

  const saveProductMutation = useMutation({
    mutationFn: (values: CreateProductInput) =>
      product
        ? updateProduct({ data: { id: product.id, ...values } })
        : createProduct({ data: values }),
    onSuccess: (saved) => {
      toast.success(
        isEditing
          ? `"${saved.name}" updated`
          : `"${saved.name}" added to the catalogue`
      )
      onSaved?.(saved)

      if (!isEditing && !onSaved) {
        form.reset()
        setFileInputKey((key) => key + 1)
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Could not update the product"
            : "Could not create the product"
      )
    },
  })

  const { startUpload, isUploading } = useUploadThing("productImage", {
    // Store images under a content-addressed, original-name-free hash.
    onBeforeUploadBegin: (files) => Promise.all(files.map(hashFileName)),
    onUploadError: (error) => {
      toast.error(error.message)
    },
  })

  const form = useForm({
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      price: product?.price ?? 0,
      originalPrice: product?.originalPrice ?? 0,
      image: product?.image ?? "",
      category: product?.category ?? "",
      unit: product?.unit ?? "piece",
      stock: product?.stock ?? 0,
      isOrganic: product?.isOrganic ?? false,
    },
    validators: {
      onSubmit: createProductSchema,
    },
    onSubmit: ({ value }) => {
      saveProductMutation.mutate(value)
    },
  })

  const uploadImage = async (
    file: File | undefined,
    onChange: (url: string) => void
  ) => {
    if (!file) {
      return
    }

    try {
      const uploaded = await startUpload([file])
      const url = uploaded?.[0]?.ufsUrl

      if (url) {
        onChange(url)
        toast.success("Image uploaded")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product details</CardTitle>
        <CardDescription>
          The image is uploaded to UploadThing. Product data is validated on the
          server before it is saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="image"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="product-image">Product image</FieldLabel>
                  <FieldContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                        {field.state.value ? (
                          <img
                            src={field.state.value}
                            alt="Product preview"
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImagePlusIcon className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          key={fileInputKey}
                          id="product-image"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={isUploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ""
                            void uploadImage(file, field.handleChange)
                          }}
                        />
                        <FieldDescription>
                          {isUploading
                            ? "Uploading image…"
                            : "PNG, JPG, WEBP, or GIF up to 4 MB."}
                        </FieldDescription>
                      </div>
                    </div>
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <form.Field
              name="name"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. Organic Bananas"
                    />
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <form.Field
              name="description"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Short description shown on the product page"
                      rows={4}
                    />
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="price"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Price (SAR)</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.state.value || ""}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value)
                          )
                        }
                        placeholder="0.00"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="originalPrice"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Original price (SAR)
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.state.value || ""}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value)
                          )
                        }
                        placeholder="Optional"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="stock"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Stock</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={0}
                        step="1"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value)
                          )
                        }
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />

              <form.Field
                name="unit"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Unit</FieldLabel>
                    <FieldContent>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="piece, kg, pack…"
                      />
                    </FieldContent>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <form.Field
              name="category"
              children={(field) => (
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <FieldContent>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.slug}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            <form.Field
              name="isOrganic"
              children={(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="is-organic">Organic</FieldLabel>
                    <FieldDescription>
                      Mark this product as organic.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="is-organic"
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </Field>
              )}
            />

            {saveProductMutation.error && (
              <FieldError>
                {saveProductMutation.error instanceof Error
                  ? saveProductMutation.error.message
                  : isEditing
                    ? "Could not update the product"
                    : "Could not create the product"}
              </FieldError>
            )}

            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={saveProductMutation.isPending || isUploading}
              >
                {saveProductMutation.isPending ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : isEditing ? (
                  "Save changes"
                ) : (
                  "Add product"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
