import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  grade: number | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

export default function Enquiries() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/enquiries?page=1&pageSize=50"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Enquiries (CRM)</h1>
      <p className="text-slate-500 mt-1">Admission enquiries pipeline</p>
      <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        This is an API-backed list view. Create and workflow actions can be added in a later UX sprint.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Name</th>
              <th className="text-left p-3 text-sm font-medium">Email</th>
              <th className="text-left p-3 text-sm font-medium">Grade</th>
              <th className="text-left p-3 text-sm font-medium">Status</th>
              <th className="text-left p-3 text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="p-3">{e.name}</td>
                <td className="p-3 text-slate-600">{e.email}</td>
                <td className="p-3">{e.grade ?? "–"}</td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100">{e.status}</span>
                </td>
                <td className="p-3 text-slate-500 text-sm">{new Date(e.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="text-slate-500 mt-4">No enquiries yet. New leads from forms or integrations will appear here.</p>}
      </div>
    </div>
  );
}
