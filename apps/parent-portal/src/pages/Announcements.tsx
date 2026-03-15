import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high";
  audience: "all" | "students" | "parents" | "teachers";
  publishedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
};

function badgeClass(priority: Announcement["priority"]) {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/announcements/feed/parent"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading announcements...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold">Announcements</h1>
      <p className="text-slate-500 text-sm">School communication relevant to parents.</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No announcements available.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`rounded-xl border bg-white p-4 ${item.priority === "high" ? "border-red-200" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-slate-900">{item.title}</h2>
                <span className={`rounded px-2 py-1 text-xs ${badgeClass(item.priority)}`}>{item.priority}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{item.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(item.publishedAt ?? item.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
