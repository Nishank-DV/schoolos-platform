import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  class: { name: string };
  subject: { name: string };
  teacher: { firstName: string; lastName: string };
};

export default function Timetable() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/timetable"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSlots(d.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Timetable</h1>
      <p className="text-slate-500 mt-1">Class schedules</p>
      <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        API-backed read view. Slot creation and edits are currently handled through backend endpoints.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Day</th>
              <th className="text-left p-3 text-sm font-medium">Time</th>
              <th className="text-left p-3 text-sm font-medium">Class</th>
              <th className="text-left p-3 text-sm font-medium">Subject</th>
              <th className="text-left p-3 text-sm font-medium">Teacher</th>
              <th className="text-left p-3 text-sm font-medium">Room</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3">{DAYS[s.dayOfWeek]}</td>
                <td className="p-3">{s.startTime} – {s.endTime}</td>
                <td className="p-3">{s.class.name}</td>
                <td className="p-3">{s.subject.name}</td>
                <td className="p-3">{s.teacher.firstName} {s.teacher.lastName}</td>
                <td className="p-3 text-slate-500">{s.room ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {slots.length === 0 && <p className="text-slate-500 mt-4">No slots available. Use the timetable API to add slots.</p>}
      </div>
    </div>
  );
}
