import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(main)/search-result/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/search-result/"!</div>
}
