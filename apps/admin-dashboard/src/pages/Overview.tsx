import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type OverviewData = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceRate: number;
  averageGrade: number;
};

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/analytics/overview"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;
  const stats = [
    { label: "Students", value: data?.totalStudents ?? 0 },
    { label: "Teachers", value: data?.totalTeachers ?? 0 },
    { label: "Classes", value: data?.totalClasses ?? 0 },
    { label: "Attendance rate %", value: data?.attendanceRate ?? 0 },
    { label: "Avg grade %", value: data?.averageGrade ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
      <p className="text-slate-500 mt-1">School dashboard at a glance</p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
