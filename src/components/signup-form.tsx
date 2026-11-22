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
import { signUpSchema } from "@/feature/auth/schema"
import { authClient } from "@/lib/auth-client"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const signUpMutation = useMutation({
    mutationFn: async (values: {
      name: string
      email: string
      password: string
    }) => {
      const { data, error } = await authClient.signUp.email(values)

      if (error) {
        throw new Error(error.message || "Failed to sign up")
      }

      return data
    },
    onSuccess: async (data) => {
      queryClient.clear()
      await router.invalidate()
      toast.success(`Welcome ${data.user.name}`)
      navigate({ to: "/" })
    },
  })

  const error = signUpMutation.error
    ? signUpMutation.error instanceof Error
      ? signUpMutation.error.message
      : "Failed to sign up"
    : null

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: ({ value }) => {
      signUpMutation.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
      })
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Fill in the form below to create your account
          </p>
        </div>
        <form.Field
          name="name"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter Full name"
                />
              </FieldContent>
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              )}
            </Field>
          )}
        />

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
                  placeholder="Enter your email"
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
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  placeholder="Enter your password"
                />
              </FieldContent>
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              )}
            </Field>
          )}
        />
        <form.Field
          name="confirmPassword"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
              <FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  placeholder="Enter Confirm password"
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
          <Button type="submit" disabled={signUpMutation.isPending}>
            {signUpMutation.isPending ? "Creating..." : "Create Account"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            You have an account?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Login
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
