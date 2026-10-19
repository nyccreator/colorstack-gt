import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { SITE_URL } from "./env";
import { RESUME_CONTENT_TYPE, RESUME_MAX_BYTES, resumeName } from "./lib/config";
import { MESSAGES } from "./lib/messages";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const headers = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const uploadResume = httpAction(async (ctx, request) => {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return new Response(MESSAGES.signIn, { status: 401, headers });

  if (request.headers.get("Content-Type") !== RESUME_CONTENT_TYPE) {
    return new Response(MESSAGES.resumeType, { status: 415, headers });
  }

  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > RESUME_MAX_BYTES) {
    return new Response(MESSAGES.resumeSize, { status: 413, headers });
  }

  const blob = await request.blob();
  if (blob.size > RESUME_MAX_BYTES) {
    return new Response(MESSAGES.resumeSize, { status: 413, headers });
  }

  const name = resumeName(new URL(request.url).searchParams.get("name") ?? "");
  const storageId = await ctx.storage.store(blob);

  try {
    const attached = await ctx.runMutation(internal.members.setResume, {
      userId: user._id,
      storageId,
      name,
      size: blob.size,
    });
    if (!attached) {
      await ctx.storage.delete(storageId);
      return new Response(MESSAGES.resumeFirst, { status: 409, headers });
    }
  } catch (error) {
    await ctx.storage.delete(storageId);
    throw error;
  }

  return Response.json({ name, size: blob.size }, { headers });
});

http.route({
  path: "/resume",
  method: "POST",
  handler: uploadResume,
});

http.route({
  path: "/resume",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers })),
});

export default http;
