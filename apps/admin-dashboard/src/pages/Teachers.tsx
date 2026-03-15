import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  school?: { name: string };
};

export default function Teachers() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((t) =>
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    );
  }, [items, search]);

  useEffect(() => {
    fetch(apiUrl("/api/teachers?page=1&pageSize=50"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading teachers...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>
          <p className="text-slate-500 mt-1">Faculty directory</p>
          <p className="text-xs text-slate-400 mt-1">Showing {filtered.length} of {items.length} teachers</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-60"
        />
      </div>
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Phone</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">School</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.firstName} {t.lastName}</td>
                <td className="px-4 py-3 text-sm">{t.email}</td>
                <td className="px-4 py-3 text-sm">{t.phone ?? "-"}</td>
                <td className="px-4 py-3 text-sm">{t.school?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-4 py-8 text-center text-slate-500">No teachers match the current search.</p>}
      </div>
    </div>
  );
}
