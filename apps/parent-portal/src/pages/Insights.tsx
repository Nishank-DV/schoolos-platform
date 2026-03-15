import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type StudentMetrics = {
  studentId: string;
  attendanceRate: number;
  assignmentCompletionRate: number;
  averageExamScore: number;
  quizScoreAverage: number;
  innovationActivityScore: number;
  strengths: string[];
  weaknesses: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  aiInsights: string;
};

type Recommendations = {
  studentId: string;
  studyPlan: string;
  recommendedSubjects: string[];
  practiceFocusAreas: string[];
  careerAlignmentHints: string[];
};

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  admissionNumber: string;
};

export default function Insights() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  // Load children on mount
  useEffect(() => {
    async function loadChildren() {
      try {
        const headers = getAuthHeaders();
        const resp = await fetch(apiUrl("/api/students?page=1&pageSize=10"), { headers }).then((r) => r.json());
        if (resp.success && Array.isArray(resp.data?.items)) {
          setChildren(resp.data.items);
          if (resp.data.items.length > 0) {
            setSelectedChildId(resp.data.items[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to load children", e);
      } finally {
        setLoading(false);
      }
    }
    loadChildren();
  }, []);

  // Load insights when child is selected
  useEffect(() => {
    if (!selectedChildId) return;

    async function loadData() {
      try {
        const headers = getAuthHeaders();
        const [metricsResp, recsResp] = await Promise.all([
          fetch(apiUrl(`/api/analytics/student/${selectedChildId}`), { headers }).then((r) => r.json()),
          fetch(apiUrl(`/api/analytics/student/${selectedChildId}/recommendations`), { headers }).then((r) => r.json()),
        ]);
        if (metricsResp.success) setMetrics(metricsResp.data);
        if (recsResp.success) setRecommendations(recsResp.data);
      } catch (e) {
        console.error("Failed to load insights", e);
      }
    }

    loadData();
  }, [selectedChildId]);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Child Performance Insights</h1>
      <p className="mt-1 text-slate-500">Track your child's academic progress and strengths.</p>

      {/* Child Selection */}
      {children.length > 0 && (
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">Select Child:</label>
          <select
            value={selectedChildId || ""}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} - Grade {c.grade}
              </option>
            ))}
          </select>
        </div>
      )}

      {metrics && (
        <>
          {/* Performance Metrics */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Attendance</p>
              <p className="mt-2 text-2xl font-semibold text-green-600">{metrics.attendanceRate}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Assignments</p>
              <p className="mt-2 text-2xl font-semibold text-blue-600">{metrics.assignmentCompletionRate}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Exam Score</p>
              <p className="mt-2 text-2xl font-semibold text-purple-600">{metrics.averageExamScore}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Quiz Performance</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">{metrics.quizScoreAverage}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Risk Level</p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  metrics.riskLevel === "HIGH"
                    ? "text-red-600"
                    : metrics.riskLevel === "MEDIUM"
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {metrics.riskLevel}
              </p>
            </div>
          </div>

          {/* Health Alert */}
          {metrics.riskLevel !== "LOW" && (
            <div
              className={`mt-6 rounded-xl border p-4 ${
                metrics.riskLevel === "HIGH"
                  ? "border-red-200 bg-red-50"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <p className={`font-semibold ${metrics.riskLevel === "HIGH" ? "text-red-900" : "text-yellow-900"}`}>
                ⚠ {metrics.riskLevel === "HIGH" ? "High Risk" : "Medium Risk Required"} - Action Suggested
              </p>
              <p className={`mt-1 text-sm ${metrics.riskLevel === "HIGH" ? "text-red-700" : "text-yellow-700"}`}>
                {metrics.weaknesses.slice(0, 2).join(" and ")}
              </p>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-slate-900">Strengths</h3>
              <div className="mt-3 space-y-2">
                {metrics.strengths.map((s) => (
                  <p key={s} className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">✓</span>
                    {s}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-slate-900">Areas for Improvement</h3>
              <div className="mt-3 space-y-2">
                {metrics.weaknesses.map((w) => (
                  <p key={w} className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">!</span>
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h3 className="font-semibold text-blue-900">Academic Coach Insights</h3>
            <p className="mt-2 text-sm text-blue-800">{metrics.aiInsights}</p>
          </div>

          {/* Recommendations */}
          {recommendations && (
            <div className="mt-6 rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-slate-900">Recommended Actions</h3>
              <p className="mt-2 text-sm text-slate-700">{recommendations.studyPlan}</p>

              {recommendations.recommendedSubjects.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600">Focus Areas:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {recommendations.recommendedSubjects.map((subj) => (
                      <span key={subj} className="rounded-lg bg-amber-100 px-3 py-1 text-xs text-amber-700">
                        {subj}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
