import { Outlet, createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { App } from "@/App";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <App />
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
});

export const fileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/file/$",
  component: () => null,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, fileRoute]),
  ...(import.meta.env.PRESET === "web" ? { history: createHashHistory() } : {}),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
