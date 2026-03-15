import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  bookedCount: number;
  teacher: { firstName: string; lastName: string } | null;
};

export default function Ptm() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/ptm/slots"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSlots(d.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">PTM Booking</h1>
      <p className="text-slate-500 mt-1">Parent–Teacher meeting slots</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Date</th>
              <th className="text-left p-3 text-sm font-medium">Time</th>
              <th className="text-left p-3 text-sm font-medium">Teacher</th>
              <th className="text-left p-3 text-sm font-medium">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3">{new Date(s.date).toLocaleDateString()}</td>
                <td className="p-3">{s.startTime} – {s.endTime}</td>
                <td className="p-3">
                  {s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : "–"}
                </td>
                <td className="p-3">{s.bookedCount} / {s.maxBookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {slots.length === 0 && <p className="text-slate-500 mt-4">No PTM slots yet.</p>}
      </div>
    </div>
  );
}
