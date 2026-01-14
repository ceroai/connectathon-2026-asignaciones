# Connectathon 2026

Sistema de gestión de citas médicas con integración FHIR, notificaciones por voz usando Twilio + ElevenLabs, y frontend React + Convex.

## Features

- **FHIR Integration**: Sincronización de citas desde servidor FHIR (Appointments, Patients, ServiceRequests, Organizations)
- **Voice Calls**: Llamadas automáticas con mensajes personalizados usando ElevenLabs TTS + Twilio
- **Real-time Frontend**: App React + Convex con actualización en tiempo real
- **Chilean Phone Formatting**: Formateo automático de números chilenos a E.164

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Convex Backend │────▶│   FHIR Server   │
│  (appointments) │     │  (sync, store)  │     │  (data source)  │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         │ POST /call
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  FastAPI Server │────▶│     Twilio      │────▶│   ElevenLabs    │
│  (call handler) │     │  (voice calls)  │     │     (TTS)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Requirements

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) package manager
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for tunneling
- Convex account (free at https://convex.dev)

## Environment Variables

### Backend (Python)

| Variable | Required | Description |
|----------|----------|-------------|
| `ACCOUNT_SID` | Yes | Twilio Account SID |
| `AUTH_TOKEN` | Yes | Twilio Auth Token |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key |
| `SERVER_HOST` | Yes | Public URL of your server (from cloudflared) |

### Frontend (React/Convex)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | FastAPI server URL (defaults to `http://localhost:8000`) |

### FHIR Client (optional overrides)

| Variable | Required | Description |
|----------|----------|-------------|
| `FHIR_CLIENT_ID` | No | FHIR OAuth client ID |
| `FHIR_CLIENT_SECRET` | No | FHIR OAuth client secret |
| `FHIR_USERNAME` | No | FHIR username |
| `FHIR_PASSWORD` | No | FHIR password |

## Setup

### 1. Install Python dependencies

```bash
uv sync
```

### 2. Install cloudflared

```bash
brew install cloudflared
```

### 3. Set environment variables

```bash
export ACCOUNT_SID="your_twilio_account_sid"
export AUTH_TOKEN="your_twilio_auth_token"
export ELEVENLABS_API_KEY="your_elevenlabs_api_key"
```

### 4. Setup Convex app

```bash
cd appointments-app
npm install
npx convex dev  # This will prompt you to create a Convex project
```

## Usage

### Running the full stack

**Terminal 1 - FastAPI Server:**
```bash
uv run python server.py
```

**Terminal 2 - Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:8000
# Copy the generated URL
```

**Terminal 3 - Set SERVER_HOST and restart FastAPI:**
```bash
export SERVER_HOST="https://your-tunnel-url.trycloudflare.com"
uv run python server.py
```

**Terminal 4 - Convex Backend:**
```bash
cd appointments-app
npx convex dev
```

**Terminal 5 - React Frontend:**
```bash
cd appointments-app
npm run dev
```

Open http://localhost:5173 in your browser.

### Using the app

1. Click **"Sincronizar FHIR"** to fetch appointments from the FHIR server
2. View appointment details (patient, date, organization, service request)
3. Click **"Llamar"** to initiate a voice call with personalized message
4. Appointments are auto-marked as "Contactado" after successful calls

## Project Structure

```
connectathon-2026/
├── server.py           # FastAPI server (TwiML, audio, call endpoints)
├── make_call.py        # Standalone call script
├── fhir_client.py      # FHIR API client
├── pyproject.toml      # Python dependencies
│
└── appointments-app/   # React + Convex frontend
    ├── convex/
    │   ├── schema.ts       # Database schema
    │   ├── appointments.ts # Appointment queries/mutations
    │   ├── patients.ts     # Patient queries/mutations
    │   └── sync.ts         # FHIR sync action
    └── src/
        └── App.tsx         # React frontend
```

## API Endpoints

### FastAPI Server (server.py)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/call` | POST | Initiate a voice call with appointment data |
| `/twiml/{call_id}` | GET/POST | TwiML instructions for Twilio |
| `/audio/{call_id}` | GET | ElevenLabs generated audio |

### Call Request Body

```json
{
  "phone": "+56912345678",
  "patient_name": "Juan Pérez",
  "date": "lunes 14 de enero",
  "time": "10:00",
  "service_type": "Traumatología",
  "organization_name": "Hospital de Melipilla"
}
```

## Configuration

### Voice Settings

Edit `server.py`:
- `VOICE_ID` - ElevenLabs voice ID
- `FROM_NUMBER` - Your Twilio phone number

### Message Template

The call message is generated dynamically in `server.py`:

```
"Hola {patient_name}. Llamo de {organization_name} para informarle
que tiene una cita asignada para {service_type} el día {date} a las
{time}. Por favor, confirme su asistencia. Gracias."
```
