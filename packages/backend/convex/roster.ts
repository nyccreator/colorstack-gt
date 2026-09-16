import { ConvexError, v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { parseRoster } from "./lib/roster";

function day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export const audit = internalMutation({
  args: { csv: v.string() },
  returns: v.object({
    exportedAt: v.string(),
    total: v.number(),
    added: v.number(),
    removed: v.number(),
  }),
  handler: async (ctx, { csv }) => {
    const { exportedAt, emails } = parseRoster(csv);
    if (exportedAt === null) throw new ConvexError("No export date in that file.");
    if (emails.length === 0) throw new ConvexError("No addresses in that file.");

    const last = await ctx.db.query("audits").withIndex("by_exportedAt").order("desc").first();
    if (last && exportedAt < last.exportedAt) {
      throw new ConvexError(
        `That export is from ${day(exportedAt)} and the last audit used ${day(last.exportedAt)}.`,
      );
    }

    const existing = await ctx.db.query("roster").collect();
    const before = new Set(existing.map((row) => row.email));
    const after = new Set(emails);

    for (const row of existing) {
      if (!after.has(row.email)) await ctx.db.delete(row._id);
    }
    for (const email of after) {
      if (!before.has(email)) await ctx.db.insert("roster", { email });
    }

    await ctx.db.insert("audits", { exportedAt, emails: after.size });

    return {
      exportedAt: day(exportedAt),
      total: after.size,
      added: [...after].filter((email) => !before.has(email)).length,
      removed: [...before].filter((email) => !after.has(email)).length,
    };
  },
});
