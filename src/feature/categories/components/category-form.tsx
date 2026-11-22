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
import { Spinner } from "@/components/ui/spinner"
import {
  createCategory,
  updateCategory,
} from "@/feature/categories/api/categories"
import {
  createCategorySchema,
  type CreateCategoryInput,
} from "@/feature/categories/schema"
import { useUploadThing } from "@/feature/uploads/client"
import { hashFileName } from "@/feature/uploads/hash-file"
import type { Category } from "@/types"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { ImagePlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface CategoryFormProps {
  /** When provided, the form updates this category instead of creating one. */
  category?: Category
  /** Called after the category is saved. */
  onSaved?: (category: Category) => void
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export function CategoryForm({ category, onSaved }: CategoryFormProps) {
  const isEditing = Boolean(category)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [slugEdited, setSlugEdited] = useState(isEditing)

  const saveCategoryMutation = useMutation({
    mutationFn: (values: CreateCategoryInput) =>
      category
        ? updateCategory({ data: { id: category.id, ...values } })
        : createCategory({ data: values }),
    onSuccess: (saved) => {
      toast.success(
        isEditing ? `"${saved.name}" updated` : `"${saved.name}" added`
      )
      onSaved?.(saved)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Could not update the category"
            : "Could not create the category"
      )
    },
  })

  const { startUpload, isUploading } = useUploadThing("categoryImage", {
    onBeforeUploadBegin: (files) => Promise.all(files.map(hashFileName)),
    onUploadError: (error) => {
      toast.error(error.message)
    },
  })

  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      image: category?.image ?? "",
    },
    validators: {
      onSubmit: createCategorySchema,
    },
    onSubmit: ({ value }) => {
      saveCategoryMutation.mutate(value)
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
        <CardTitle>Category details</CardTitle>
        <CardDescription>
          Categories drive the catalogue filters and the home page grid. The
          image is uploaded to UploadThing.
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
                  <FieldLabel htmlFor="category-image">
                    Category image
                  </FieldLabel>
                  <FieldContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                        {field.state.value ? (
                          <img
                            src={field.state.value}
                            alt="Category preview"
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImagePlusIcon className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          key={fileInputKey}
                          id="category-image"
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
                            : "PNG, JPG, WEBP, or GIF up to 4 MB. Optional."}
                        </FieldDescription>
                        {field.state.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              field.handleChange("")
                              setFileInputKey((key) => key + 1)
                            }}
                          >
                            <Trash2Icon />
                            Remove image
                          </Button>
                        )}
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
                      onChange={(event) => {
                        const value = event.target.value
                        field.handleChange(value)

                        if (!slugEdited) {
                          form.setFieldValue("slug", slugify(value))
                        }
                      }}
                      placeholder="e.g. Fresh Fruits"
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
              name="slug"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setSlugEdited(true)
                        field.handleChange(event.target.value)
                      }}
                      placeholder="e.g. fresh-fruits"
                    />
                  </FieldContent>
                  <FieldDescription>
                    Used in product filters. Changing it updates every product
                    in this category.
                  </FieldDescription>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  )}
                </Field>
              )}
            />

            {saveCategoryMutation.error && (
              <FieldError>
                {saveCategoryMutation.error instanceof Error
                  ? saveCategoryMutation.error.message
                  : isEditing
                    ? "Could not update the category"
                    : "Could not create the category"}
              </FieldError>
            )}

            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={saveCategoryMutation.isPending || isUploading}
              >
                {saveCategoryMutation.isPending ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : isEditing ? (
                  "Save changes"
                ) : (
                  "Add category"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
