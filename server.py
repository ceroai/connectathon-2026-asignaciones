import os
import threading
from io import BytesIO
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Response, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from elevenlabs import ElevenLabs
from twilio.rest import Client

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ACCOUNT_SID = os.getenv("ACCOUNT_SID")
AUTH_TOKEN = os.getenv("AUTH_TOKEN")
SERVER_HOST = os.getenv("SERVER_HOST", "http://localhost:8000")
FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "GJid0jgRsqjUy21Avuex")

elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

# In-memory store for call data
call_data_store: dict[str, dict] = {}

# Store call status by callSid
call_status_store: dict[str, dict] = {}

# Cache for pre-generated audio
audio_cache: dict[str, bytes] = {}


class CallRequest(BaseModel):
    phone: str
    patient_name: str
    date: str
    time: str
    service_type: str | None = None
    organization_name: str | None = None


def generate_message(data: dict) -> str:
    """Generate a personalized call message from appointment data."""
    patient_name = data.get("patient_name", "paciente")
    date = data.get("date", "")
    time = data.get("time", "")
    service_type = data.get("service_type", "su cita médica")
    organization_name = data.get("organization_name", "el hospital")

    message = (
        f"Hola {patient_name}. "
        f"Llamo de {organization_name} para informarle que tiene una cita asignada "
        f"para {service_type} el día {date} a las {time}. "
        f"Presione 1 para confirmar su asistencia, o presione 2 si necesita reagendar. "
        f"Gracias."
    )
    return message


def pre_generate_audio(call_id: str, data: dict) -> None:
    """Pre-generate and cache audio for a call (runs in background thread)."""
    message = generate_message(data)
    print(f"Pre-generating audio for call {call_id}: {message}")

    try:
        audio_generator = elevenlabs_client.text_to_speech.convert(
            voice_id=VOICE_ID,
            text=message,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        audio_bytes = BytesIO()
        for chunk in audio_generator:
            audio_bytes.write(chunk)
        audio_bytes.seek(0)

        audio_cache[call_id] = audio_bytes.read()
        print(f"Audio pre-generated for call {call_id} ({len(audio_cache[call_id])} bytes)")
    except Exception as e:
        print(f"Error pre-generating audio for call {call_id}: {e}")


@app.post("/call")
def initiate_call(data: CallRequest):
    """Initiate a Twilio call with personalized ElevenLabs audio."""
    call_id = str(uuid4())

    # Store call data for later retrieval by TwiML/audio endpoints
    call_data = {
        "patient_name": data.patient_name,
        "date": data.date,
        "time": data.time,
        "service_type": data.service_type or "su cita médica",
        "organization_name": data.organization_name or "el hospital",
    }
    call_data_store[call_id] = call_data

    # Pre-generate audio in background thread (non-blocking, call starts immediately)
    # Audio will be ready by the time the call is answered (~10-30 seconds)
    audio_thread = threading.Thread(target=pre_generate_audio, args=(call_id, call_data))
    audio_thread.start()

    # Initiate Twilio call with status callback
    twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
    call = twilio_client.calls.create(
        to=data.phone,
        from_=FROM_NUMBER,
        url=f"{SERVER_HOST}/twiml/{call_id}",
        status_callback=f"{SERVER_HOST}/call-status-webhook",
        status_callback_event=["initiated", "ringing", "answered", "completed"],
        timeout=20,  # Stop ringing after 20 seconds if no answer
        machine_detection="Enable",  # Detect voicemail/answering machines
    )

    # Initialize call status tracking
    call_status_store[call.sid] = {
        "status": "initiated",
        "outcome": "pending",
    }

    print(f"Call initiated! SID: {call.sid}, Call ID: {call_id}")
    return {"callSid": call.sid, "callId": call_id}


@app.get("/twiml/{call_id}")
@app.post("/twiml/{call_id}")
def get_twiml(call_id: str):
    """Return TwiML that plays audio and waits for patient response."""
    if call_id not in call_data_store:
        raise HTTPException(status_code=404, detail="Call not found")

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="1" action="{SERVER_HOST}/handle-response/{call_id}" method="POST" timeout="10">
        <Play>{SERVER_HOST}/audio/{call_id}</Play>
    </Gather>
    <Say language="es-MX">No recibimos ninguna respuesta. Hasta luego.</Say>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.get("/audio/{call_id}")
def get_audio(call_id: str):
    """Return pre-generated audio for a specific call (instant response)."""
    # Check cache first (should be pre-generated)
    if call_id in audio_cache:
        print(f"Serving cached audio for call {call_id}")
        return Response(content=audio_cache[call_id], media_type="audio/mpeg")

    # Fallback to on-demand generation if cache miss
    if call_id not in call_data_store:
        raise HTTPException(status_code=404, detail="Call not found")

    data = call_data_store[call_id]
    message = generate_message(data)
    print(f"Cache miss - generating audio for call {call_id}: {message}")

    audio_generator = elevenlabs_client.text_to_speech.convert(
        voice_id=VOICE_ID,
        text=message,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    audio_bytes = BytesIO()
    for chunk in audio_generator:
        audio_bytes.write(chunk)
    audio_bytes.seek(0)

    return Response(content=audio_bytes.read(), media_type="audio/mpeg")


@app.post("/handle-response/{call_id}")
def handle_response(call_id: str, Digits: str = Form("")):
    """Handle patient DTMF response (1=confirm, 2=reschedule)."""
    print(f"Patient response for call {call_id}: Digits={Digits}")

    if Digits == "1":
        # Patient confirmed
        if call_id in call_data_store:
            call_data_store[call_id]["patient_response"] = "confirmed"
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-MX">Gracias por confirmar su cita. Hasta pronto.</Say>
</Response>"""
    elif Digits == "2":
        # Patient requested reschedule
        if call_id in call_data_store:
            call_data_store[call_id]["patient_response"] = "reschedule"
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-MX">Entendido. Nos comunicaremos para reagendar su cita. Hasta pronto.</Say>
</Response>"""
    else:
        # Unrecognized input
        if call_id in call_data_store:
            call_data_store[call_id]["patient_response"] = "unknown"
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-MX">Opción no reconocida. Hasta luego.</Say>
</Response>"""

    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.post("/call-status-webhook")
async def call_status_webhook(
    CallSid: str = Form(""),
    CallStatus: str = Form(""),
    AnsweredBy: str = Form(""),
):
    """Receive Twilio call status updates."""
    print(f"Call status webhook: SID={CallSid}, Status={CallStatus}, AnsweredBy={AnsweredBy}")

    # Map Twilio status to our outcome
    # Twilio statuses: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
    if CallStatus == "completed":
        outcome = "answered"
    elif CallStatus == "in-progress":
        outcome = "answered"
    elif CallStatus in ["busy", "no-answer"]:
        outcome = "no_answer"
    elif CallStatus in ["failed", "canceled"]:
        outcome = "failed"
    elif CallStatus in ["queued", "ringing", "initiated"]:
        outcome = "pending"
    else:
        outcome = "pending"

    call_status_store[CallSid] = {
        "status": CallStatus,
        "outcome": outcome,
    }

    # Clean up audio cache when call completes
    if CallStatus in ["completed", "busy", "failed", "canceled", "no-answer"]:
        # Find and clean up associated call_id
        for call_id in list(audio_cache.keys()):
            if call_id in call_data_store:
                audio_cache.pop(call_id, None)
                print(f"Cleaned up audio cache for call {call_id}")

    print(f"Updated call status store: {CallSid} -> {outcome}")
    return {"received": True}


@app.get("/call-status/{call_sid}")
def get_call_status(call_sid: str):
    """Get the current status of a call."""
    if call_sid not in call_status_store:
        return {"status": "unknown", "outcome": "pending"}
    return call_status_store[call_sid]


@app.post("/cancel-call/{call_sid}")
def cancel_call(call_sid: str):
    """Cancel an in-progress call."""
    try:
        twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
        call = twilio_client.calls(call_sid).update(status="canceled")

        call_status_store[call_sid] = {
            "status": "canceled",
            "outcome": "failed",
        }

        print(f"Call canceled: {call_sid}")
        return {"success": True, "status": "canceled"}
    except Exception as e:
        print(f"Error canceling call: {e}")
        return {"success": False, "error": str(e)}


# Legacy endpoints for backward compatibility
@app.get("/audio")
def get_audio_legacy():
    """Legacy audio endpoint with predefined message."""
    message = "Hola. Llamo del hospital de Melipilla para informarle que tiene una cita asignada. Por favor, confirme su asistencia."

    audio_generator = elevenlabs_client.text_to_speech.convert(
        voice_id=VOICE_ID,
        text=message,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    audio_bytes = BytesIO()
    for chunk in audio_generator:
        audio_bytes.write(chunk)
    audio_bytes.seek(0)

    return Response(content=audio_bytes.read(), media_type="audio/mpeg")


@app.get("/twiml")
@app.post("/twiml")
def get_twiml_legacy():
    """Legacy TwiML endpoint."""
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{SERVER_HOST}/audio</Play>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="application/xml")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
