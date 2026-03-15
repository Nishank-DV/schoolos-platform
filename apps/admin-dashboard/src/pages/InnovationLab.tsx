import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Log = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  student?: { firstName: string; lastName: string };
};

export default function InnovationLab() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/innovation/logs?page=1&pageSize=30"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Innovation Lab</h1>
      <p className="text-slate-500 mt-1">Robotics, AI experiments, hackathons, research journal</p>
      <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        API-backed activity feed. Entry creation and moderation UI can be added as a focused follow-up.
      </p>
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Student</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No logs yet. Student projects and lab updates will appear here.</td></tr>
            ) : (
              items.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">{l.type}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{l.title}</td>
                  <td className="px-4 py-3 text-sm">
                    {l.student ? `${l.student.firstName} ${l.student.lastName}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
