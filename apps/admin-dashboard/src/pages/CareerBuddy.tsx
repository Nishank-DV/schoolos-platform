import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Session = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  careerProfile?: {
    student?: { firstName: string; lastName: string; grade: number };
  };
};

type Analytics = {
  completionRate: number;
  totalEligible: number;
  completedCount: number;
  interestDistribution: { label: string; count: number }[];
  popularCareers: { career: string; count: number }[];
  skillClusters: { label: string; count: number }[];
};

export default function CareerBuddy() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"sessions" | "analytics">("sessions");

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/careerbuddy/admin/sessions"), { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(apiUrl("/api/careerbuddy/teacher/analytics"), { headers: getAuthHeaders() }).then((r) => r.json()),
    ]).then(([sRes, aRes]) => {
      if (sRes.success) setSessions(sRes.data);
      if (aRes.success) setAnalytics(aRes.data);
      if (!sRes.success || !aRes.success) {
        setError(sRes.error || aRes.error || "Failed to load complete CareerBuddy data");
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading CareerBuddy data...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">CareerBuddy</h1>
      <p className="text-slate-500 mt-1">AI career discovery for Grade 9 & 10. Track sessions and view teacher analytics.</p>

      <div className="flex gap-2 mt-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("sessions")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "sessions" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500"}`}
        >
          Assessment sessions
        </button>
        <button
          type="button"
          onClick={() => setTab("analytics")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "analytics" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500"}`}
        >
          Teacher dashboard
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === "analytics" && analytics && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm text-slate-500">Assessment completion rate</p>
              <p className="text-2xl font-bold text-slate-900">{analytics.completionRate}%</p>
              <p className="text-xs text-slate-400 mt-1">{analytics.completedCount} of {analytics.totalEligible} eligible students (Grade 9 & 10)</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm text-slate-500">Completed assessments</p>
              <p className="text-2xl font-bold text-slate-900">{analytics.completedCount}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm text-slate-500">Eligible students</p>
              <p className="text-2xl font-bold text-slate-900">{analytics.totalEligible}</p>
            </div>
          </div>
          {analytics.interestDistribution.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Class-level career interest distribution</h2>
              <ul className="space-y-2">
                {analytics.interestDistribution.map((d, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{d.label}</span>
                    <span className="font-medium">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analytics.popularCareers.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Popular career categories</h2>
              <ul className="space-y-2">
                {analytics.popularCareers.slice(0, 10).map((c, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{c.career}</span>
                    <span className="font-medium">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analytics.skillClusters.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Skill clusters among students</h2>
              <ul className="space-y-2">
                {analytics.skillClusters.map((s, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="font-medium">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && !analytics && !loading && !error && (
        <p className="mt-6 text-sm text-slate-500">Analytics are not available yet for this school.</p>
      )}

      {tab === "sessions" && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Student</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Grade</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Started</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Completed</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No assessment sessions yet</td></tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {s.careerProfile?.student
                        ? `${s.careerProfile.student.firstName} ${s.careerProfile.student.lastName}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">{s.careerProfile?.student?.grade ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        s.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      {s.completedAt ? new Date(s.completedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
