import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("appointments").order("desc").collect();
  },
});

export const getByFhirId = query({
  args: { fhirId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    fhirId: v.string(),
    status: v.string(),
    serviceType: v.optional(v.string()),
    start: v.string(),
    end: v.string(),
    created: v.optional(v.string()),
    patientId: v.optional(v.string()),
    patientName: v.optional(v.string()),
    patientPhone: v.optional(v.string()),
    contactMethod: v.optional(v.string()),
    contacted: v.optional(v.boolean()),
    serviceRequestId: v.optional(v.string()),
    serviceRequestCode: v.optional(v.string()),
    serviceRequestCategory: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    organizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("appointments", args);
    }
  },
});

export const markContacted = mutation({
  args: {
    fhirId: v.string(),
    contacted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();

    if (appointment) {
      await ctx.db.patch(appointment._id, { contacted: args.contacted });
    }
  },
});

export const recordCall = mutation({
  args: {
    fhirId: v.string(),
    callSid: v.optional(v.string()),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();

    if (appointment) {
      const currentHistory = appointment.callHistory || [];
      const newCall = {
        timestamp: args.timestamp,
        callSid: args.callSid,
        outcome: "pending" as const,
      };
      await ctx.db.patch(appointment._id, {
        callHistory: [...currentHistory, newCall],
        contacted: true,
      });
    }
  },
});

export const updateCallOutcome = mutation({
  args: {
    fhirId: v.string(),
    callIndex: v.number(),
    outcome: v.union(
      v.literal("pending"),
      v.literal("answered"),
      v.literal("no_answer"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db
      .query("appointments")
      .withIndex("by_fhirId", (q) => q.eq("fhirId", args.fhirId))
      .first();

    if (appointment && appointment.callHistory) {
      const updatedHistory = [...appointment.callHistory];
      if (args.callIndex >= 0 && args.callIndex < updatedHistory.length) {
        updatedHistory[args.callIndex] = {
          ...updatedHistory[args.callIndex],
          outcome: args.outcome,
        };
        await ctx.db.patch(appointment._id, {
          callHistory: updatedHistory,
        });
      }
    }
  },
});
