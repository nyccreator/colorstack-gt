import { env } from "@colorstack-gt/env/web";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convex = new ConvexReactClient(env.VITE_CONVEX_URL);

  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    // Onboarding and the You page set their own scroll on every move, Back included, so the router must not restore it.
    scrollRestoration: ({ location }) => !["/you", "/onboarding"].includes(location.pathname),
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: { convex },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
