import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  grade: number;
  class?: { name: string };
};

type StudentReport = {
  student?: Student;
  summary: { total: number; present: number; absent: number; late: number; attendancePercent: number };
  monthly: Array<{ month: string; present: number; absent: number; late: number; total: number; attendancePercent: number }>;
  records: Array<{
    id: string;
    status: "Present" | "Absent" | "Late";
    remarks: string | null;
    session: { id: string; date: string; class: { id: string; name: string }; section: { id: string; name: string } };
  }>;
};

export default function Attendance() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(apiUrl(`/api/attendance/report/student/${id}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReport(d.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-500">Loading attendance...</div>;
  if (!report) return <div className="text-slate-500">Attendance data not available.</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Attendance Overview</h1>
          <p className="text-sm text-slate-500">
            {report.student ? `${report.student.firstName} ${report.student.lastName} (${report.student.admissionNumber})` : "Student"}
          </p>
        </div>
        {id && (
          <Link to={`/child/${id}`} className="text-sm text-primary-700 hover:underline">
            Back to child profile
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Attendance %</p>
          <p className="text-lg font-semibold text-slate-900">{report.summary.attendancePercent}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Total Days</p>
          <p className="text-lg font-semibold text-slate-900">{report.summary.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Present</p>
          <p className="text-lg font-semibold text-green-700">{report.summary.present}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Absent / Late</p>
          <p className="text-lg font-semibold text-amber-700">{report.summary.absent + report.summary.late}</p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Monthly trend</h2>
        <ul className="space-y-2 text-sm">
          {report.monthly.length === 0 && <li className="text-slate-500">No monthly trend yet.</li>}
          {report.monthly.map((m) => (
            <li key={m.month} className="rounded-lg border border-slate-200 p-2">
              <div className="flex justify-between">
                <span>{m.month}</span>
                <span className="font-medium">{m.attendancePercent}%</span>
              </div>
              <p className="text-xs text-slate-500">P: {m.present} | A: {m.absent} | L: {m.late}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Recent records</h2>
        <ul className="space-y-2 text-sm">
          {report.records.slice(0, 20).map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 p-2 flex justify-between items-center">
              <div>
                <p>{new Date(r.session.date).toLocaleDateString()}</p>
                <p className="text-xs text-slate-500">{r.session.class.name} {r.session.section.name}</p>
              </div>
              <span className={r.status === "Present" ? "text-green-700" : r.status === "Absent" ? "text-red-700" : "text-amber-700"}>{r.status}</span>
            </li>
          ))}
          {report.records.length === 0 && <li className="text-slate-500">No attendance records available.</li>}
        </ul>
      </section>
    </div>
  );
}
