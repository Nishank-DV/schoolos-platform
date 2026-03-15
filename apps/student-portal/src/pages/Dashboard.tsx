import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Grade = { subject: { name: string }; term: string; marks: number; maxMarks: number };

export default function Dashboard() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentId = user?.student?.id;
    if (!studentId) {
      setLoading(false);
      return;
    }
    fetch(apiUrl(`/api/grades/student/${studentId}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.success) setGrades(d.data); })
      .finally(() => setLoading(false));
  }, [user?.student?.id]);

  const name = user?.student ? `${user.student.firstName} ${user.student.lastName}` : user?.email ?? "Student";

  return (
    <div>
      <h1 className="text-xl font-bold">Hi, {name}</h1>
      <p className="text-slate-500 text-sm">Grade {user?.student?.grade ?? "-"}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/assignments" className="rounded-xl bg-blue-50 p-4 border border-blue-100">
          <p className="font-medium text-blue-900">Homework</p>
          <p className="text-sm text-blue-600">View & submit</p>
        </Link>
        <Link to="/announcements" className="rounded-xl bg-red-50 p-4 border border-red-100">
          <p className="font-medium text-red-900">Announcements</p>
          <p className="text-sm text-red-600">School notices</p>
        </Link>
        <Link to="/careerbuddy" className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
          <p className="font-medium text-emerald-900">CareerBuddy</p>
          <p className="text-sm text-emerald-600">Career discovery</p>
        </Link>
      </div>
      {grades.length > 0 && (
        <div className="mt-6">
          <h2 className="font-medium mb-2">Recent grades</h2>
          <ul className="space-y-2">
            {grades.slice(0, 5).map((g, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{g.subject.name} ({g.term})</span>
                <span>{g.marks}/{g.maxMarks}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && grades.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">Recent grades will appear here once assessments are published.</p>
      )}
    </div>
  );
}
