import { env } from "@colorstack-gt/env/web";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

const PAGES_THAT_SET_THEIR_OWN_SCROLL = ["/you", "/onboarding"];

export function getRouter() {
  const convex = new ConvexReactClient(env.VITE_CONVEX_URL);

  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: ({ location }) =>
      !PAGES_THAT_SET_THEIR_OWN_SCROLL.includes(location.pathname),
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
