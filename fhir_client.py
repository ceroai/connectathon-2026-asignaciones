import os
import uuid
from datetime import datetime, timedelta
import httpx
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

AUTH_URL = os.getenv("FHIR_AUTH_URL", "https://auth.cegconsultores.cl/realms/fhir/protocol/openid-connect/token")
FHIR_BASE_URL = os.getenv("FHIR_BASE_URL", "https://fhir.cegconsultores.cl/fhir")

# Auth credentials from environment
CLIENT_ID = os.getenv("FHIR_CLIENT_ID")
CLIENT_SECRET = os.getenv("FHIR_CLIENT_SECRET")
USERNAME = os.getenv("FHIR_USERNAME")
PASSWORD = os.getenv("FHIR_PASSWORD")

# Default resource IDs (from existing resources)
DEFAULT_ORGANIZATION_ID = "5491b8d5-e06c-4f89-beb7-75a1989cdc81"
DEFAULT_PRACTITIONER_ID = "2d5d9db4-6ade-43c9-b4f5-cc68b9c7f210"
DEFAULT_PRACTITIONER_ROLE_ID = "0e5c9353-5f8e-4801-b7fc-59395f14344c"


class FHIRClient:
    def __init__(self):
        self.access_token = None
        self.client = httpx.Client(timeout=30.0)

    def authenticate(self) -> str:
        """Get access token from Keycloak."""
        response = self.client.post(
            AUTH_URL,
            data={
                "grant_type": "password",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "username": USERNAME,
                "password": PASSWORD,
                "scope": "openid profile",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data["access_token"]
        return self.access_token

    def _get_headers(self) -> dict:
        """Get authorization headers."""
        if not self.access_token:
            self.authenticate()
        return {"Authorization": f"Bearer {self.access_token}"}

    def get_appointments(self) -> dict:
        """Get all appointments."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/Appointment",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_patient(self, patient_id: str) -> dict:
        """Get patient by ID."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/Patient/{patient_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_service_request(self, service_request_id: str) -> dict:
        """Get ServiceRequest by ID."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/ServiceRequest/{service_request_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_organization(self, organization_id: str) -> dict:
        """Get Organization by ID."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/Organization/{organization_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_location(self, location_id: str) -> dict:
        """Get Location by ID."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/Location/{location_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_practitioner_role(self, practitioner_role_id: str) -> dict:
        """Get PractitionerRole by ID."""
        response = self.client.get(
            f"{FHIR_BASE_URL}/PractitionerRole/{practitioner_role_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def create_patient(
        self,
        given_name: str,
        family_name: str,
        phone: str,
        rut: str = None,
        patient_id: str = None,
    ) -> dict:
        """Create a new patient with the given name and phone number.

        Args:
            given_name: Patient's first name
            family_name: Patient's last name
            phone: Patient's phone number
            rut: Patient's RUT (Chilean ID), optional
            patient_id: UUID for the patient, auto-generated if not provided

        Returns:
            The created Patient resource
        """
        if patient_id is None:
            patient_id = str(uuid.uuid4())

        if rut is None:
            rut = f"TEST-{uuid.uuid4().hex[:8].upper()}"

        patient = {
            "resourceType": "Patient",
            "id": patient_id,
            "meta": {
                "profile": ["https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/StructureDefinition/PatientLE"]
            },
            "identifier": [{
                "type": {
                    "coding": [{
                        "system": "https://hl7chile.cl/fhir/ig/clcore/CodeSystem/CSTipoIdentificador",
                        "code": "01",
                        "display": "RUN"
                    }]
                },
                "value": rut
            }],
            "name": [{
                "use": "official",
                "family": family_name,
                "given": [given_name]
            }],
            "telecom": [{
                "system": "phone",
                "value": phone
            }],
            "gender": "unknown",
            "birthDate": "1990-01-01"
        }

        response = self.client.put(
            f"{FHIR_BASE_URL}/Patient/{patient_id}",
            headers={**self._get_headers(), "Content-Type": "application/json"},
            json=patient,
        )
        response.raise_for_status()
        return response.json()

    def create_service_request(
        self,
        patient_id: str,
        practitioner_role_id: str = None,
        service_request_id: str = None,
        code_display: str = "Consulta general",
    ) -> dict:
        """Create a ServiceRequest for a patient.

        Args:
            patient_id: The patient's ID
            practitioner_role_id: The practitioner role ID (uses default if not provided)
            service_request_id: UUID for the service request, auto-generated if not provided
            code_display: Description of the service

        Returns:
            The created ServiceRequest resource
        """
        if service_request_id is None:
            service_request_id = str(uuid.uuid4())

        if practitioner_role_id is None:
            practitioner_role_id = DEFAULT_PRACTITIONER_ROLE_ID

        service_request = {
            "resourceType": "ServiceRequest",
            "id": service_request_id,
            "meta": {
                "profile": ["https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/StructureDefinition/ServiceRequestCirugiaLE"]
            },
            "identifier": [{
                "value": f"SR-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            }],
            "status": "active",
            "intent": "order",
            "category": [{
                "coding": [{
                    "system": "https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/CodeSystem/CSTipoCirugiaPropuesta",
                    "code": "1",
                    "display": "Cirugía Mayor Electiva"
                }]
            }],
            "priority": "routine",
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "183452005",
                    "display": code_display
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "authoredOn": datetime.now().isoformat(),
            "requester": {
                "reference": f"PractitionerRole/{practitioner_role_id}"
            }
        }

        response = self.client.put(
            f"{FHIR_BASE_URL}/ServiceRequest/{service_request_id}",
            headers={**self._get_headers(), "Content-Type": "application/json"},
            json=service_request,
        )
        response.raise_for_status()
        return response.json()

    def create_appointment(
        self,
        patient_id: str,
        service_request_id: str,
        start: datetime,
        end: datetime = None,
        practitioner_role_id: str = None,
        appointment_id: str = None,
        status: str = "booked",
    ) -> dict:
        """Create an Appointment.

        Args:
            patient_id: The patient's ID
            service_request_id: The service request ID this appointment is based on
            start: Appointment start datetime
            end: Appointment end datetime (defaults to start + 30 minutes)
            practitioner_role_id: The practitioner role ID (uses default if not provided)
            appointment_id: UUID for the appointment, auto-generated if not provided
            status: Appointment status (default: "booked")

        Returns:
            The created Appointment resource
        """
        if appointment_id is None:
            appointment_id = str(uuid.uuid4())

        if practitioner_role_id is None:
            practitioner_role_id = DEFAULT_PRACTITIONER_ROLE_ID

        if end is None:
            end = start + timedelta(minutes=30)

        appointment = {
            "resourceType": "Appointment",
            "id": appointment_id,
            "meta": {
                "profile": ["https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/StructureDefinition/AppointmentAgendarLE"]
            },
            "extension": [
                {
                    "url": "https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/StructureDefinition/ExtensionMediodeContacto",
                    "valueCodeableConcept": {
                        "coding": [{
                            "system": "https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/CodeSystem/CSMediodeContacto",
                            "code": "3",
                            "display": "Llamada"
                        }]
                    }
                },
                {
                    "extension": [{
                        "url": "Contactado",
                        "valueBoolean": False
                    }],
                    "url": "https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/StructureDefinition/Contactado"
                }
            ],
            "identifier": [{
                "value": f"CITA-{start.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            }],
            "status": status,
            "serviceType": [{
                "coding": [{
                    "system": "https://interoperabilidad.minsal.cl/fhir/ig/quirurgico/CodeSystem/CSTipoServicioAgendamiento",
                    "code": "1",
                    "display": "Entrevista Pre Quirúrgica"
                }]
            }],
            "start": start.strftime("%Y-%m-%dT%H:%M:%S-04:00"),
            "end": end.strftime("%Y-%m-%dT%H:%M:%S-04:00"),
            "created": datetime.now().strftime("%Y-%m-%dT%H:%M:%S-04:00"),
            "basedOn": [{
                "reference": f"ServiceRequest/{service_request_id}"
            }],
            "participant": [
                {
                    "actor": {
                        "reference": f"Patient/{patient_id}",
                        "type": "Patient"
                    },
                    "status": "accepted"
                },
                {
                    "actor": {
                        "reference": f"PractitionerRole/{practitioner_role_id}",
                        "type": "PractitionerRole"
                    },
                    "status": "accepted"
                }
            ]
        }

        response = self.client.put(
            f"{FHIR_BASE_URL}/Appointment/{appointment_id}",
            headers={**self._get_headers(), "Content-Type": "application/json"},
            json=appointment,
        )
        response.raise_for_status()
        return response.json()

    def create_test_appointment(
        self,
        patient_name: str,
        phone: str,
        appointment_date: datetime,
        family_name: str = "Test",
    ) -> dict:
        """Convenience method to create a complete test appointment with a new patient.

        This creates:
        1. A new Patient with the given name and phone
        2. A ServiceRequest for that patient
        3. An Appointment at the specified date

        Args:
            patient_name: Patient's first name
            phone: Patient's phone number
            appointment_date: When the appointment should be scheduled
            family_name: Patient's last name (default: "Test")

        Returns:
            Dictionary with created resources: {patient, service_request, appointment}
        """
        # Create patient
        patient = self.create_patient(
            given_name=patient_name,
            family_name=family_name,
            phone=phone,
        )
        patient_id = patient["id"]

        # Create service request
        service_request = self.create_service_request(
            patient_id=patient_id,
        )
        service_request_id = service_request["id"]

        # Create appointment
        appointment = self.create_appointment(
            patient_id=patient_id,
            service_request_id=service_request_id,
            start=appointment_date,
        )

        return {
            "patient": patient,
            "service_request": service_request,
            "appointment": appointment,
        }

    def close(self):
        """Close the HTTP client."""
        self.client.close()


def extract_id_from_reference(reference: str) -> str:
    """Extract ID from a FHIR reference like 'ResourceType/id'."""
    if "/" in reference:
        return reference.split("/")[-1]
    return reference


if __name__ == "__main__":
    client = FHIRClient()

    print("Authenticating...")
    client.authenticate()
    print("Authenticated successfully!\n")

    print("Fetching appointments...")
    appointments = client.get_appointments()
    print(f"Found {appointments.get('total', 0)} appointments\n")

    if appointments.get("entry"):
        for entry in appointments["entry"]:
            appointment = entry.get("resource", {})
            print(f"Appointment ID: {appointment.get('id')}")
            print(f"  Status: {appointment.get('status')}")
            print(f"  Start: {appointment.get('start')}")
            print(f"  End: {appointment.get('end')}")

            # Get ServiceRequest from basedOn
            for based_on in appointment.get("basedOn", []):
                ref = based_on.get("reference", "")
                if "ServiceRequest" in ref:
                    sr_id = extract_id_from_reference(ref)
                    print(f"\n  Fetching ServiceRequest {sr_id}...")
                    try:
                        service_request = client.get_service_request(sr_id)
                        sr_code = service_request.get("code", {})
                        sr_text = sr_code.get("text") or sr_code.get("coding", [{}])[0].get("display", "")
                        sr_category = service_request.get("category", [{}])[0].get("coding", [{}])[0].get("display", "")
                        print(f"  ServiceRequest: {sr_text}")
                        print(f"  Category: {sr_category}")
                    except Exception as e:
                        print(f"  Error fetching service request: {e}")

            # Get patient and PractitionerRole from participants
            for participant in appointment.get("participant", []):
                actor = participant.get("actor", {})

                if actor.get("type") == "Patient":
                    ref = actor.get("reference", "")
                    patient_id = extract_id_from_reference(ref)
                    print(f"\n  Fetching patient {patient_id}...")
                    try:
                        patient = client.get_patient(patient_id)
                        name = patient.get("name", [{}])[0]
                        given = " ".join(name.get("given", []))
                        family = name.get("family", "")
                        print(f"  Patient: {given} {family}")
                        telecom = patient.get("telecom", [])
                        for contact in telecom:
                            if contact.get("system") == "phone":
                                print(f"  Phone: {contact.get('value')}")
                    except Exception as e:
                        print(f"  Error fetching patient: {e}")

                if actor.get("type") == "PractitionerRole":
                    ref = actor.get("reference", "")
                    pr_id = extract_id_from_reference(ref)
                    print(f"\n  Fetching PractitionerRole {pr_id}...")
                    try:
                        practitioner_role = client.get_practitioner_role(pr_id)

                        # Get Organization from PractitionerRole
                        org_ref = practitioner_role.get("organization", {}).get("reference", "")
                        if org_ref:
                            org_id = extract_id_from_reference(org_ref)
                            print(f"  Fetching Organization {org_id}...")
                            try:
                                organization = client.get_organization(org_id)
                                print(f"  Organization: {organization.get('name', 'N/A')}")
                            except Exception as e:
                                print(f"  Error fetching organization: {e}")
                    except Exception as e:
                        print(f"  Error fetching practitioner role: {e}")

    # Example: Create a test appointment
    print("\n" + "="*50)
    print("CREATING TEST APPOINTMENT")
    print("="*50)

    try:
        # Create appointment for tomorrow at 10:00
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)

        result = client.create_test_appointment(
            patient_name="TestPatient",
            family_name="Demo",
            phone="+56912345678",
            appointment_date=appointment_time,
        )

        print(f"\nCreated Patient: {result['patient']['id']}")
        print(f"  Name: {result['patient']['name'][0]['given'][0]} {result['patient']['name'][0]['family']}")
        print(f"  Phone: {result['patient']['telecom'][0]['value']}")
        print(f"\nCreated ServiceRequest: {result['service_request']['id']}")
        print(f"\nCreated Appointment: {result['appointment']['id']}")
        print(f"  Start: {result['appointment']['start']}")
        print(f"  End: {result['appointment']['end']}")
        print(f"  Status: {result['appointment']['status']}")
    except Exception as e:
        print(f"Error creating test appointment: {e}")

    client.close()
