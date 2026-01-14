import { useState } from "react";

export interface CalendarAppointment {
  _id: string;
  fhirId: string;
  status: string;
  serviceType?: string;
  start: string;
  end: string;
  patientName?: string;
  patientPhone?: string;
  organizationName?: string;
  contacted?: boolean;
  callHistory?: Array<{ timestamp: string; callSid?: string; outcome?: string }>;
}

interface CalendarProps {
  appointments: CalendarAppointment[];
  onDateSelect: (date: Date, appointments: CalendarAppointment[]) => void;
  selectedDate: Date | null;
}

export function Calendar({ appointments, onDateSelect, selectedDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getAppointmentsForDate = (date: Date): CalendarAppointment[] => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start);
      return (
        aptDate.getFullYear() === date.getFullYear() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getDate() === date.getDate()
      );
    });
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
        />
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayAppointments = getAppointmentsForDate(date);
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          onClick={() => onDateSelect(date, dayAppointments)}
          className={`h-28 p-2 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors overflow-hidden
            ${isSelected ? "bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500 ring-inset" : "hover:bg-slate-100 dark:hover:bg-slate-800"}
            ${isToday && !isSelected ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}
          `}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-medium ${
                isToday
                  ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {day}
            </span>
            {dayAppointments.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium text-white bg-blue-600 rounded-full">
                {dayAppointments.length}
              </span>
            )}
          </div>
          {/* Show first 2 appointments preview */}
          <div className="mt-1 space-y-1">
            {dayAppointments.slice(0, 2).map((apt) => (
              <div
                key={apt._id}
                className="text-xs truncate text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5"
              >
                {new Date(apt.start).toLocaleTimeString("es-CL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                - {apt.patientName?.split(" ")[0] || "Paciente"}
              </div>
            ))}
            {dayAppointments.length > 2 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                +{dayAppointments.length - 2} mas
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthName = currentMonth.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white capitalize">
          {monthName}
        </h2>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
        >
          Hoy
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">{renderDays()}</div>
    </div>
  );
}
