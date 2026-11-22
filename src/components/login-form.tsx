import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { loginSchema } from "@/feature/auth/schema"
import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"

const getSafeRedirect = (redirect?: string | null) => {
  if (!redirect) return "/"
  if (typeof redirect !== "string") return "/"
  if (!redirect.startsWith("/")) return "/"
  if (redirect.startsWith("//")) return "/"
  return redirect
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearch({ strict: false })
  const redirectParam = "redirect" in search ? search.redirect : undefined
  const redirect = typeof redirectParam === "string" ? redirectParam : undefined

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const { data, error } = await authClient.signIn.email(values)

      if (error) {
        throw new Error(error.message || "Failed to sign in")
      }

      return data
    },
    onSuccess: async (data) => {
      queryClient.clear()
      await router.invalidate()
      toast.success(`Welcome ${data.user.name}`)

      const destination = data.user.isDriver
        ? redirect?.startsWith("/delivery")
          ? redirect
          : "/delivery"
        : getSafeRedirect(redirect)

      navigate({ to: destination })
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to sign in"
      )
    },
  })

  const error = loginMutation.error
    ? loginMutation.error instanceof Error
      ? loginMutation.error.message
      : "Failed to sign in"
    : null

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: ({ value }) => {
      loginMutation.mutate({ email: value.email, password: value.password })
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <form.Field
          name="email"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="m@example.com"
                />
              </FieldContent>
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              )}
            </Field>
          )}
        />

        <form.Field
          name="password"
          children={(field) => (
            <Field>
              <div className="flex items-center">
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Link
                  to="/"
                  className="ms-auto text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  type="password"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Password"
                />
              </FieldContent>
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              )}
            </Field>
          )}
        />

        {error && <FieldError className="text-center">{error}</FieldError>}
        <Field>
          <Button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Logging in..." : "Login"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
