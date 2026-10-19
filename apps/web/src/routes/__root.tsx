import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";

import { getToken } from "@/lib/auth-server";
import { knowSession, sessionToken, useAuth } from "@/lib/session";

import appCss from "../index.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export interface RouterAppContext {
  convex: ConvexReactClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#041729" },
      { title: "ColorStack at Georgia Tech" },
      {
        name: "description",
        content:
          "Increasing the number of Black and Latinx Computer Science graduates who go on to start rewarding technical careers.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/assets/logos/colorstack-gt-dark.svg" },
    ],
  }),

  component: RootDocument,
  beforeLoad: async () => {
    const token = await sessionToken(() => getAuth());
    return { token };
  },
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  knowSession(context.token);
  return (
    <ConvexProviderWithAuth client={context.convex} useAuth={useAuth}>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <Outlet />
          {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-left" /> : null}
          <Scripts />
        </body>
      </html>
    </ConvexProviderWithAuth>
  );
}
