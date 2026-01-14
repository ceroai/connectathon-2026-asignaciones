import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("patients").collect();
  },
});

export const getByFhirId = query({
  args: { fhirId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    fhirId: v.string(),
    identifier: v.optional(v.string()),
    givenName: v.string(),
    familyName: v.string(),
    phone: v.optional(v.string()),
    gender: v.optional(v.string()),
    birthDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("patients", args);
    }
  },
});
