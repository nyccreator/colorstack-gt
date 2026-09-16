import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { RESUME_CONTENT_TYPE, RESUME_MAX_BYTES } from "./lib/config";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const siteUrl = process.env.SITE_URL!;

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin === siteUrl ? origin : siteUrl,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

const uploadResume = httpAction(async (ctx, request) => {
  const headers = cors(request.headers.get("Origin"));

  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return new Response("Sign in to continue.", { status: 401, headers });

  if (request.headers.get("Content-Type") !== RESUME_CONTENT_TYPE) {
    return new Response("Upload a PDF.", { status: 415, headers });
  }

  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > RESUME_MAX_BYTES) {
    return new Response("Keep the file under 5MB.", { status: 413, headers });
  }

  const blob = await request.blob();
  if (blob.size > RESUME_MAX_BYTES) {
    return new Response("Keep the file under 5MB.", { status: 413, headers });
  }

  const name =
    (new URL(request.url).searchParams.get("name") ?? "").trim().slice(0, 120) || "resume.pdf";
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
      return new Response("Finish the earlier screens first.", { status: 409, headers });
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
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });
  }),
});

export default http;
