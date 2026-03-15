import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type ClassRow = {
  id: string;
  name: string;
  grade: number;
  section: string;
  teacher?: { firstName: string; lastName: string };
  _count?: { students: number };
};

export default function Classes() {
  const [items, setItems] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/classes?page=1&pageSize=50"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
      <p className="text-slate-500 mt-1">Class sections</p>
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Class</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Grade</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Section</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Teacher</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Students</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm">{c.grade}</td>
                <td className="px-4 py-3 text-sm">{c.section}</td>
                <td className="px-4 py-3 text-sm">
                  {c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : "-"}
                </td>
                <td className="px-4 py-3 text-sm">{c._count?.students ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
