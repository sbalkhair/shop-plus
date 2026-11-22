import { SignupForm } from "@/components/signup-form"
import AuthImageSide from "@/feature/auth/components/auth-image-side"
import HeadAuth from "@/feature/auth/components/head-auth"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(auth)/signup/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="grid min-h-svh bg-white lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <HeadAuth />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <AuthImageSide />
    </div>
  )
}
