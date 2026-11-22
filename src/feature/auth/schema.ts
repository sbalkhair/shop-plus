import z from "zod"

export const loginSchema = z.object({
  email: z.email({ error: "enter valid email" }).min(1, "email is required"),
  password: z.string().min(1, "password is required"),
})

export const signUpSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    email: z.email({ error: "enter valid email" }).min(1, "email is required"),
    password: z.string().min(8, "password is must be 8 characters or more"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "not match password",
    path: ["confirmPassword"],
  })
