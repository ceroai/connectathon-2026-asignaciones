import { CalendarAppointment } from "./Calendar";

interface AppointmentSidebarProps {
  selectedDate: Date | null;
  appointments: CalendarAppointment[];
  onClose: () => void;
  onCall: (appointment: CalendarAppointment) => void;
  callingAptId?: string | null;
  callResult?: { aptId: string; success: boolean; message: string } | null;
}

export function AppointmentSidebar({
  selectedDate,
  appointments,
  onClose,
  onCall,
  callingAptId,
  callResult,
}: AppointmentSidebarProps) {
  if (!selectedDate) {
    return (
      <div className="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p>Selecciona una fecha para ver las citas</p>
        </div>
      </div>
    );
  }

  const formattedDate = selectedDate.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statusColors: Record<string, string> = {
    booked: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    arrived: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white capitalize">
            {formattedDate}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Appointments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {appointments.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-8">
            No hay citas para esta fecha
          </div>
        ) : (
          appointments
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            .map((apt) => (
              <div
                key={apt._id}
                className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2"
              >
                {/* Time and Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {new Date(apt.start).toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(apt.end).toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColors[apt.status] || "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {apt.status.toUpperCase()}
                  </span>
                </div>

                {/* Patient */}
                {apt.patientName && (
                  <div className="flex items-center gap-2">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {apt.patientName}
                    </span>
                  </div>
                )}

                {/* Phone */}
                {apt.patientPhone && (
                  <div className="flex items-center gap-2">
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
                      href={`tel:${apt.patientPhone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {apt.patientPhone}
                    </a>
                  </div>
                )}

                {/* Organization */}
                {apt.organizationName && (
                  <div className="flex items-center gap-2">
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
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {apt.organizationName}
                    </span>
                  </div>
                )}

                {/* Service Type */}
                {apt.serviceType && (
                  <div className="flex items-center gap-2">
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {apt.serviceType}
                    </span>
                  </div>
                )}

                {/* Contact Status & Call Button */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    {apt.contacted ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Contactado
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No contactado</span>
                    )}
                    {apt.callHistory && apt.callHistory.length > 0 && (
                      <span className="text-xs text-slate-400">
                        ({apt.callHistory.length} llamada{apt.callHistory.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                  {apt.patientPhone && (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => onCall(apt)}
                        disabled={callingAptId === apt._id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
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
                        {callingAptId === apt._id ? "Llamando..." : "Llamar"}
                      </button>
                      {callResult && callResult.aptId === apt._id && (
                        <span className={`text-xs ${callResult.success ? "text-green-600" : "text-red-600"}`}>
                          {callResult.message}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
