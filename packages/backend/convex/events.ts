import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { clubEvent } from "./schema";

const isTime = (t: number) => !Number.isNaN(new Date(t).getTime());

export const list = query({
  args: {},
  returns: v.array(clubEvent),
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").withIndex("by_startsAt").collect();
    // Rows are typed in by hand, and one impossible date would take the whole page down for everyone.
    const valid = rows.filter(
      (e) => isTime(e.startsAt) && isTime(e.endsAt) && e.endsAt >= e.startsAt,
    );
    return Promise.all(
      valid.map(async ({ _id, _creationTime, flier, ...event }) => {
        const src = flier && (await ctx.storage.getUrl(flier.storageId));
        return {
          ...event,
          id: _id,
          ...(src ? { flier: { src, width: flier.width, height: flier.height } } : {}),
        };
      }),
    );
  },
});

export const uploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});
