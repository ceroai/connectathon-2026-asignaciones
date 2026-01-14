import { action } from "./_generated/server";
import { api } from "./_generated/api";

// FHIR server configuration from environment variables
// Set these in your Convex dashboard: https://dashboard.convex.dev
const AUTH_URL = process.env.FHIR_AUTH_URL || "https://auth.cegconsultores.cl/realms/fhir/protocol/openid-connect/token";
const FHIR_BASE_URL = process.env.FHIR_BASE_URL || "https://fhir.cegconsultores.cl/fhir";

const CLIENT_ID = process.env.FHIR_CLIENT_ID!;
const CLIENT_SECRET = process.env.FHIR_CLIENT_SECRET!;
const USERNAME = process.env.FHIR_USERNAME!;
const PASSWORD = process.env.FHIR_PASSWORD!;

function extractIdFromReference(reference: string): string {
  if (reference.includes("/")) {
    return reference.split("/").pop() || reference;
  }
  return reference;
}

async function authenticate(): Promise<string> {
  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
      scope: "openid profile",
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchResource(
  token: string,
  resourceType: string,
  id: string
): Promise<any> {
  const response = await fetch(`${FHIR_BASE_URL}/${resourceType}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch ${resourceType}/${id} failed: ${response.status}`);
  }

  return response.json();
}

async function fetchAppointments(token: string): Promise<any> {
  const response = await fetch(`${FHIR_BASE_URL}/Appointment`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch appointments failed: ${response.status}`);
  }

  return response.json();
}

export const syncFhirData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Starting FHIR sync...");

    // Authenticate
    const token = await authenticate();
    console.log("Authenticated successfully");

    // Fetch appointments
    const appointmentsBundle = await fetchAppointments(token);
    console.log(`Found ${appointmentsBundle.total} appointments`);

    const results = {
      appointments: 0,
      patients: 0,
    };

    // Process each appointment
    for (const entry of appointmentsBundle.entry || []) {
      const appointment = entry.resource;

      // Extract contact method from extensions
      let contactMethod: string | undefined;
      let contacted: boolean | undefined;

      for (const ext of appointment.extension || []) {
        if (ext.url?.includes("MediodeContacto")) {
          contactMethod = ext.valueCodeableConcept?.coding?.[0]?.display;
        }
        if (ext.url?.includes("Contactado")) {
          for (const subExt of ext.extension || []) {
            if (subExt.url === "Contactado") {
              contacted = subExt.valueBoolean;
            }
          }
        }
      }

      // Extract service type
      const serviceType =
        appointment.serviceType?.[0]?.coding?.[0]?.display || undefined;

      // Extract ServiceRequest from basedOn
      let serviceRequestId: string | undefined;
      let serviceRequestCode: string | undefined;
      let serviceRequestCategory: string | undefined;

      for (const basedOn of appointment.basedOn || []) {
        const ref = basedOn.reference || "";
        if (ref.includes("ServiceRequest")) {
          serviceRequestId = extractIdFromReference(ref);
          try {
            const serviceRequest = await fetchResource(
              token,
              "ServiceRequest",
              serviceRequestId
            );
            const code = serviceRequest.code || {};
            serviceRequestCode =
              code.text || code.coding?.[0]?.display || undefined;
            serviceRequestCategory =
              serviceRequest.category?.[0]?.coding?.[0]?.display || undefined;
            console.log(`  ServiceRequest: ${serviceRequestCode}`);
          } catch (e) {
            console.error(`Failed to fetch ServiceRequest ${serviceRequestId}:`, e);
          }
        }
      }

      // Find patient and PractitionerRole from participants
      let patientId: string | undefined;
      let patientName: string | undefined;
      let patientPhone: string | undefined;
      let organizationId: string | undefined;
      let organizationName: string | undefined;

      for (const participant of appointment.participant || []) {
        const actorType = participant.actor?.type;
        const ref = participant.actor?.reference || "";

        // Process Patient
        if (actorType === "Patient") {
          patientId = extractIdFromReference(ref);

          try {
            const patient = await fetchResource(token, "Patient", patientId);

            const name = patient.name?.[0] || {};
            const givenName = (name.given || []).join(" ");
            const familyName = name.family || "";
            patientName = `${givenName} ${familyName}`.trim();

            // Get phone
            for (const telecom of patient.telecom || []) {
              if (telecom.system === "phone") {
                patientPhone = telecom.value;
                break;
              }
            }

            // Get identifier (RUN)
            const identifier = patient.identifier?.[0]?.value;

            // Upsert patient
            await ctx.runMutation(api.patients.upsert, {
              fhirId: patientId,
              identifier,
              givenName,
              familyName,
              phone: patientPhone,
              gender: patient.gender,
              birthDate: patient.birthDate,
            });
            results.patients++;
            console.log(`  Patient: ${patientName}`);
          } catch (e) {
            console.error(`Failed to fetch patient ${patientId}:`, e);
          }
        }

        // Process PractitionerRole to get Organization
        if (actorType === "PractitionerRole") {
          const prId = extractIdFromReference(ref);

          try {
            const practitionerRole = await fetchResource(
              token,
              "PractitionerRole",
              prId
            );

            // Get Organization from PractitionerRole
            const orgRef = practitionerRole.organization?.reference || "";
            if (orgRef) {
              organizationId = extractIdFromReference(orgRef);

              try {
                const organization = await fetchResource(
                  token,
                  "Organization",
                  organizationId
                );
                organizationName = organization.name || undefined;
                console.log(`  Organization: ${organizationName}`);
              } catch (e) {
                console.error(`Failed to fetch Organization ${organizationId}:`, e);
              }
            }
          } catch (e) {
            console.error(`Failed to fetch PractitionerRole ${prId}:`, e);
          }
        }
      }

      // Upsert appointment
      await ctx.runMutation(api.appointments.upsert, {
        fhirId: appointment.id,
        status: appointment.status,
        serviceType,
        start: appointment.start,
        end: appointment.end,
        created: appointment.created,
        patientId,
        patientName,
        patientPhone,
        contactMethod,
        contacted,
        serviceRequestId,
        serviceRequestCode,
        serviceRequestCategory,
        organizationId,
        organizationName,
      });
      results.appointments++;
    }

    console.log(
      `Sync complete: ${results.appointments} appointments, ${results.patients} patients`
    );
    return results;
  },
});
