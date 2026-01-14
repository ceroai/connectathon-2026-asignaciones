#!/usr/bin/env python3
"""
Script to create sample appointments for testing purposes.
Creates multiple appointments spread across the next several days.
"""

from datetime import datetime, timedelta
from fhir_client import FHIRClient

SAMPLE_PATIENTS = [
    {"name": "Jorge", "family": "Pérez", "phone": "+56991504487"},
    {"name": "María", "family": "González", "phone": "+56987654321"},
    {"name": "Carlos", "family": "Rodríguez", "phone": "+56976543210"},
    {"name": "Ana", "family": "Martínez", "phone": "+56965432109"},
    {"name": "Pedro", "family": "López", "phone": "+56954321098"},
    {"name": "Sofía", "family": "Hernández", "phone": "+56943210987"},
    {"name": "Diego", "family": "García", "phone": "+56932109876"},
    {"name": "Valentina", "family": "Muñoz", "phone": "+56921098765"},
    {"name": "Matías", "family": "Soto", "phone": "+56910987654"},
    {"name": "Camila", "family": "Díaz", "phone": "+56909876543"},
]

APPOINTMENT_TIMES = [
    (9, 0),
    (9, 30),
    (10, 0),
    (10, 30),
    (11, 0),
    (14, 0),
    (14, 30),
    (15, 0),
    (15, 30),
    (16, 0),
]


def create_sample_appointments(days_ahead: int = 5, appointments_per_day: int = 2):
    """
    Create sample appointments for the next several days.
    
    Args:
        days_ahead: Number of days to create appointments for (default: 5)
        appointments_per_day: Number of appointments per day (default: 2)
    """
    client = FHIRClient()
    
    print("🔐 Authenticating with FHIR server...")
    client.authenticate()
    print("✅ Authenticated successfully!\n")
    
    created_appointments = []
    patient_index = 0
    time_index = 0
    
    for day_offset in range(1, days_ahead + 1):
        appointment_date = datetime.now() + timedelta(days=day_offset)
        date_str = appointment_date.strftime("%A, %B %d, %Y")
        
        print(f"📅 Creating appointments for {date_str}")
        print("-" * 50)
        
        for _ in range(appointments_per_day):
            # Get patient data (cycle through sample patients)
            patient_data = SAMPLE_PATIENTS[patient_index % len(SAMPLE_PATIENTS)]
            patient_index += 1
            
            # Get appointment time (cycle through available times)
            hour, minute = APPOINTMENT_TIMES[time_index % len(APPOINTMENT_TIMES)]
            time_index += 1
            
            # Set the appointment datetime
            appointment_datetime = appointment_date.replace(
                hour=hour, 
                minute=minute, 
                second=0, 
                microsecond=0
            )
            
            try:
                print(f"  Creating appointment for {patient_data['name']} {patient_data['family']}...")
                
                result = client.create_test_appointment(
                    patient_name=patient_data["name"],
                    family_name=patient_data["family"],
                    phone=patient_data["phone"],
                    appointment_date=appointment_datetime,
                )
                
                created_appointments.append(result)
                
                print(f"    ✅ Patient ID: {result['patient']['id'][:8]}...")
                print(f"    ✅ Appointment: {appointment_datetime.strftime('%H:%M')} - {result['appointment']['id'][:8]}...")
                print()
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                print()
    
    client.close()
    
    print("=" * 50)
    print(f"✨ Created {len(created_appointments)} appointments successfully!")
    print("=" * 50)
    
    return created_appointments


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create sample FHIR appointments")
    parser.add_argument(
        "--days", 
        type=int, 
        default=5, 
        help="Number of days to create appointments for (default: 5)"
    )
    parser.add_argument(
        "--per-day", 
        type=int, 
        default=2, 
        help="Number of appointments per day (default: 2)"
    )
    
    args = parser.parse_args()
    
    create_sample_appointments(days_ahead=args.days, appointments_per_day=args.per_day)
