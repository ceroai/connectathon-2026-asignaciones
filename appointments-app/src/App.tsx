import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Calendar, CalendarAppointment } from "./components/Calendar";
import { AppointmentSidebar } from "./components/AppointmentSidebar";

type ViewMode = "list" | "calendar";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Format Chilean phone number to E.164 format (+56XXXXXXXXX)
 * Handles various input formats: 912345678, 9 1234 5678, +56912345678, etc.
 */
function formatChileanPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If already has country code (56...)
  if (digits.startsWith("56") && digits.length === 11) {
    return "+" + digits;
  }

  // If 9 digits starting with 9 (mobile) - most common format
  if (digits.length === 9 && digits.startsWith("9")) {
    return "+56" + digits;
  }

  // If 8 digits (missing leading 9 for mobile)
  if (digits.length === 8) {
    return "+569" + digits;
  }

  // Fallback: just prepend +56
  return "+56" + digits;
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const appointments = useQuery(api.appointments.list);

  // Derive selected appointments from live data instead of storing in state
  // This ensures call history updates are reflected immediately
  const selectedAppointments = selectedDate && appointments
    ? (appointments as CalendarAppointment[]).filter((apt) => {
        const aptDate = new Date(apt.start);
        return (
          aptDate.getFullYear() === selectedDate.getFullYear() &&
          aptDate.getMonth() === selectedDate.getMonth() &&
          aptDate.getDate() === selectedDate.getDate()
        );
      })
    : [];

  const handleDateSelect = (date: Date, _dayAppointments: CalendarAppointment[]) => {
    setSelectedDate(date);
  };

  const handleCloseSidebar = () => {
    setSelectedDate(null);
  };

  const recordCall = useMutation(api.appointments.recordCall);
  const [sidebarCalling, setSidebarCalling] = useState<string | null>(null);
  const [sidebarCallResult, setSidebarCallResult] = useState<{ aptId: string; success: boolean; message: string } | null>(null);

  const handleSidebarCall = async (apt: CalendarAppointment) => {
    if (!apt.patientPhone) {
      setSidebarCallResult({ aptId: apt._id, success: false, message: "No hay teléfono" });
      return;
    }

    setSidebarCalling(apt._id);
    setSidebarCallResult(null);

    const startDate = new Date(apt.start);
    const dateStr = startDate.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = startDate.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      const response = await fetch(`${API_URL}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formatChileanPhone(apt.patientPhone),
          patient_name: apt.patientName || "paciente",
          date: dateStr,
          time: timeStr,
          service_type: apt.serviceType || "su cita",
          organization_name: apt.organizationName || "el hospital",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSidebarCallResult({ aptId: apt._id, success: true, message: "Llamando..." });

      // Record the call in history
      await recordCall({
        fhirId: apt.fhirId,
        callSid: data.callSid,
        timestamp: new Date().toLocaleString("sv-SE", {
          timeZone: "America/Santiago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).replace(" ", "T"),
      });
    } catch (error) {
      console.error("Call error:", error);
      setSidebarCallResult({ aptId: apt._id, success: false, message: "Error al llamar" });
    } finally {
      setSidebarCalling(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Sistema de Notificación de Asignación de Citas
          </h1>
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "calendar"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                Calendario
              </button>
            </div>
            <SyncButton />
          </div>
        </div>
      </header>

      {viewMode === "list" ? (
        <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
          <AppointmentsList />
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 overflow-auto">
            {appointments === undefined ? (
              <div className="flex justify-center py-12">
                <div className="animate-pulse text-slate-500">Cargando calendario...</div>
              </div>
            ) : (
              <Calendar
                appointments={appointments as CalendarAppointment[]}
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
              />
            )}
          </div>
          <AppointmentSidebar
            selectedDate={selectedDate}
            appointments={selectedAppointments}
            onClose={handleCloseSidebar}
            onCall={handleSidebarCall}
            callingAptId={sidebarCalling}
            callResult={sidebarCallResult}
          />
        </main>
      )}
    </div>
  );
}

function SyncButton() {
  const syncFhirData = useAction(api.sync.syncFhirData);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncFhirData();
      setResult(
        `Sincronizado: ${res.appointments} citas, ${res.patients} pacientes`
      );
    } catch (e) {
      setResult("Error al sincronizar");
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {result}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {syncing ? "Sincronizando..." : "Sincronizar FHIR"}
      </button>
    </div>
  );
}

function AppointmentsList() {
  const appointments = useQuery(api.appointments.list);

  if (appointments === undefined) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-slate-500">Cargando citas...</div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-500 dark:text-slate-400 mb-4">
          No hay citas disponibles
        </div>
        <p className="text-sm text-slate-400">
          Haz clic en "Sincronizar FHIR" para cargar las citas desde el servidor
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">
        Citas ({appointments.length})
      </h2>
      <div className="grid gap-4">
        {appointments.map((appointment) => (
          <AppointmentCard key={appointment._id} appointment={appointment} />
        ))}
      </div>
    </div>
  );
}

type CallOutcome = "pending" | "answered" | "no_answer" | "failed";

const outcomeConfig: Record<CallOutcome, { label: string; color: string; icon: string }> = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: "?",
  },
  answered: {
    label: "Contestada",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: "✓",
  },
  no_answer: {
    label: "Sin respuesta",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: "✗",
  },
  failed: {
    label: "Fallida",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: "!",
  },
};

/**
 * Get current timestamp in America/Santiago timezone as ISO string
 */
function getSantiagoTimestamp(): string {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace(" ", "T");
}

/**
 * Format a Santiago timestamp for display
 */
function formatCallTime(timestamp: string): string {
  const date = new Date(timestamp + "-03:00"); // Approximate Chile timezone
  return date.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CallHistoryItem({
  call,
  index,
  fhirId,
  onUpdateOutcome,
}: {
  call: { timestamp: string; callSid?: string; outcome?: CallOutcome };
  index: number;
  fhirId: string;
  onUpdateOutcome: (args: { fhirId: string; callIndex: number; outcome: CallOutcome }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const outcome = call.outcome || "pending";
  const config = outcomeConfig[outcome];

  const handleOutcomeChange = (newOutcome: CallOutcome) => {
    onUpdateOutcome({ fhirId, callIndex: index, outcome: newOutcome });
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 font-medium">
        {index + 1}
      </span>
      <span className="text-slate-500 dark:text-slate-400">
        {formatCallTime(call.timestamp)}
      </span>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} hover:opacity-80 transition-opacity`}
        >
          {config.label}
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-10 min-w-[120px]">
            {(Object.keys(outcomeConfig) as CallOutcome[]).map((key) => (
              <button
                key={key}
                onClick={() => handleOutcomeChange(key)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600 ${
                  key === outcome ? "font-medium" : ""
                }`}
              >
                <span className={`inline-block w-4 text-center mr-2`}>
                  {outcomeConfig[key].icon}
                </span>
                {outcomeConfig[key].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
}: {
  appointment: {
    _id: string;
    fhirId: string;
    status: string;
    serviceType?: string;
    start: string;
    end: string;
    patientName?: string;
    patientPhone?: string;
    contactMethod?: string;
    contacted?: boolean;
    serviceRequestCode?: string;
    serviceRequestCategory?: string;
    organizationName?: string;
    callHistory?: Array<{ timestamp: string; callSid?: string; outcome?: "pending" | "answered" | "no_answer" | "failed" }>;
  };
}) {
  const markContacted = useMutation(api.appointments.markContacted);
  const recordCall = useMutation(api.appointments.recordCall);
  const updateCallOutcome = useMutation(api.appointments.updateCallOutcome);
  const [updating, setUpdating] = useState(false);
  const [calling, setCalling] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleToggleContacted = async () => {
    setUpdating(true);
    try {
      await markContacted({
        fhirId: appointment.fhirId,
        contacted: !appointment.contacted,
      });
    } finally {
      setUpdating(false);
    }
  };

  const pollCallStatus = async (callSid: string, callIndex: number) => {
    const maxAttempts = 30; // Poll for up to 60 seconds (30 * 2s)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/call-status/${callSid}`);
        const statusData = await response.json();

        if (statusData.outcome && statusData.outcome !== "pending") {
          // Update the call outcome in Convex
          await updateCallOutcome({
            fhirId: appointment.fhirId,
            callIndex,
            outcome: statusData.outcome,
          });
          setCallResult({
            success: statusData.outcome === "answered",
            message: statusData.outcome === "answered"
              ? "Llamada contestada"
              : statusData.outcome === "no_answer"
              ? "Sin respuesta"
              : "Llamada cancelada",
          });
          setActiveCallSid(null);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          setCallResult({ success: true, message: "Llamada en curso..." });
          setActiveCallSid(null);
        }
      } catch (error) {
        console.error("Error polling call status:", error);
      }
    };

    poll();
  };

  const handleCancelCall = async () => {
    if (!activeCallSid) return;

    try {
      const response = await fetch(`${API_URL}/cancel-call/${activeCallSid}`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setCallResult({ success: false, message: "Llamada cancelada" });
      } else {
        setCallResult({ success: false, message: "Error al cancelar" });
      }
    } catch (error) {
      console.error("Error canceling call:", error);
      setCallResult({ success: false, message: "Error al cancelar" });
    } finally {
      setActiveCallSid(null);
    }
  };

  const handleCall = async () => {
    if (!appointment.patientPhone) {
      setCallResult({ success: false, message: "No hay teléfono" });
      return;
    }

    setCalling(true);
    setCallResult(null);

    const startDate = new Date(appointment.start);
    const dateStr = startDate.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = startDate.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      const response = await fetch(`${API_URL}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formatChileanPhone(appointment.patientPhone),
          patient_name: appointment.patientName || "paciente",
          date: dateStr,
          time: timeStr,
          service_type: appointment.serviceType || appointment.serviceRequestCode || "su cita",
          organization_name: appointment.organizationName || "el hospital",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setCallResult({ success: true, message: "Llamando..." });
      setActiveCallSid(data.callSid);

      // Record the call in history
      await recordCall({
        fhirId: appointment.fhirId,
        callSid: data.callSid,
        timestamp: getSantiagoTimestamp(),
      });

      // Get the index of the newly added call (last in the array)
      const callIndex = (appointment.callHistory?.length || 0);

      // Start polling for call status
      pollCallStatus(data.callSid, callIndex);
    } catch (error) {
      console.error("Call error:", error);
      setCallResult({ success: false, message: "Error al llamar" });
    } finally {
      setCalling(false);
    }
  };

  const startDate = new Date(appointment.start);
  const endDate = new Date(appointment.end);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusColors: Record<string, string> = {
    booked: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    arrived: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[appointment.status] || "bg-slate-100 text-slate-800"}`}
            >
              {appointment.status.toUpperCase()}
            </span>
            {appointment.serviceType && (
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {appointment.serviceType}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {formatDate(startDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <span className="text-slate-600 dark:text-slate-300">
                {formatTime(startDate)} - {formatTime(endDate)}
              </span>
            </div>
          </div>

          {appointment.patientName && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="text-slate-700 dark:text-slate-200 font-medium">
                  {appointment.patientName}
                </span>
              </div>
              {appointment.patientPhone && (
                <div className="flex items-center gap-2 ml-7">
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <a
                    href={`tel:${appointment.patientPhone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {appointment.patientPhone}
                  </a>
                </div>
              )}
            </div>
          )}

          {appointment.organizationName && (
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {appointment.organizationName}
              </span>
            </div>
          )}

          {(appointment.serviceRequestCode || appointment.serviceRequestCategory) && (
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <div className="flex flex-col">
                {appointment.serviceRequestCode && (
                  <span className="text-slate-700 dark:text-slate-200 text-sm">
                    {appointment.serviceRequestCode}
                  </span>
                )}
                {appointment.serviceRequestCategory && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs">
                    {appointment.serviceRequestCategory}
                  </span>
                )}
              </div>
            </div>
          )}

          {appointment.contactMethod && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Medio de contacto: {appointment.contactMethod}</span>
            </div>
          )}

          {/* Call History */}
          {appointment.callHistory && appointment.callHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Historial de llamadas ({appointment.callHistory.length})
                </span>
              </div>
              <div className="space-y-2 ml-6">
                {appointment.callHistory.map((call, index) => (
                  <CallHistoryItem
                    key={index}
                    call={call}
                    index={index}
                    fhirId={appointment.fhirId}
                    onUpdateOutcome={updateCallOutcome}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {appointment.patientPhone && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCall}
                disabled={calling || !!activeCallSid}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {calling ? "Iniciando..." : "Llamar"}
              </button>
              {activeCallSid && (
                <button
                  onClick={handleCancelCall}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancelar
                </button>
              )}
            </div>
          )}
          {callResult && (
            <span
              className={`text-xs ${callResult.success ? "text-green-600" : "text-red-600"}`}
            >
              {callResult.message}
            </span>
          )}
          <button
            onClick={handleToggleContacted}
            disabled={updating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              appointment.contacted
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
            }`}
          >
            {updating
              ? "..."
              : appointment.contacted
                ? "Contactado"
                : "Marcar contactado"}
          </button>
        </div>
      </div>
    </div>
  );
}
