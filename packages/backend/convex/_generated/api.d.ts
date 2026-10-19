/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as email from "../email.js";
import type * as env from "../env.js";
import type * as http from "../http.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_demographics from "../lib/demographics.js";
import type * as lib_graduation from "../lib/graduation.js";
import type * as lib_groups from "../lib/groups.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_programs from "../lib/programs.js";
import type * as lib_roster from "../lib/roster.js";
import type * as members from "../members.js";
import type * as roster from "../roster.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  email: typeof email;
  env: typeof env;
  http: typeof http;
  "lib/config": typeof lib_config;
  "lib/demographics": typeof lib_demographics;
  "lib/graduation": typeof lib_graduation;
  "lib/groups": typeof lib_groups;
  "lib/identity": typeof lib_identity;
  "lib/messages": typeof lib_messages;
  "lib/programs": typeof lib_programs;
  "lib/roster": typeof lib_roster;
  members: typeof members;
  roster: typeof roster;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
