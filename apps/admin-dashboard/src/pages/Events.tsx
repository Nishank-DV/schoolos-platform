import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Event = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  type: string;
  createdAt: string;
};

export default function Events() {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/events?page=1&pageSize=30"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Events & Calendar</h1>
      <p className="text-slate-500 mt-1">School events, holidays, PTM</p>
      <div className="mt-6 space-y-3">
        {items.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{e.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100">{e.type}</span>
            </div>
            {e.description && <p className="text-sm text-slate-600 mt-1">{e.description}</p>}
            <p className="text-xs text-slate-400 mt-2">
              {new Date(e.startDate).toLocaleString()}
              {e.endDate && ` – ${new Date(e.endDate).toLocaleString()}`}
            </p>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">No events yet.</p>}
      </div>
    </div>
  );
}
