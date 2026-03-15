import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  admissionNumber: string;
  class?: { name: string };
};

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/students?page=1&pageSize=10"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStudents(d.data.items); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold">My Children</h1>
      <p className="text-slate-500 text-sm">Attendance, performance, fees, homework</p>
      <Link to="/announcements" className="mt-4 block rounded-xl border border-indigo-100 bg-indigo-50 p-4 hover:bg-indigo-100">
        <p className="font-medium text-indigo-900">Announcements</p>
        <p className="text-sm text-indigo-600">Read school communication for parents</p>
      </Link>
      <ul className="mt-4 space-y-3">
        {students.map((s) => (
          <Link key={s.id} to={`/child/${s.id}`} className="block rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">{s.firstName} {s.lastName}</p>
            <p className="text-sm text-slate-500">Grade {s.grade} · {s.class?.name ?? "-"}</p>
          </Link>
        ))}
      </ul>
      {!loading && students.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No linked children found for this parent account.</p>
      )}
    </div>
  );
}
