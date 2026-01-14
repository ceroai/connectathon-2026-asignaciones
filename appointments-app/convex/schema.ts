import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  appointments: defineTable({
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
    // ServiceRequest fields
    serviceRequestId: v.optional(v.string()),
    serviceRequestCode: v.optional(v.string()),
    serviceRequestCategory: v.optional(v.string()),
    // Organization fields (from PractitionerRole)
    organizationId: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    // Call history - array of call records with timestamps and outcomes
    callHistory: v.optional(
      v.array(
        v.object({
          timestamp: v.string(), // ISO timestamp in America/Santiago
          callSid: v.optional(v.string()),
          outcome: v.optional(v.union(
            v.literal("pending"),
            v.literal("answered"),
            v.literal("no_answer"),
            v.literal("failed")
          )),
        })
      )
    ),
  }).index("by_fhirId", ["fhirId"]),

  patients: defineTable({
    fhirId: v.string(),
    identifier: v.optional(v.string()),
    givenName: v.string(),
    familyName: v.string(),
    phone: v.optional(v.string()),
    gender: v.optional(v.string()),
    birthDate: v.optional(v.string()),
  }).index("by_fhirId", ["fhirId"]),
});
