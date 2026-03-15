import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
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

export default function Insights() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.student?.id) return;

    const studentId = user.student.id;

    async function loadData() {
      try {
        const headers = getAuthHeaders();
        const [metricsResp, recsResp] = await Promise.all([
          fetch(apiUrl(`/api/analytics/student/${studentId}`), { headers }).then((r) => r.json()),
          fetch(apiUrl(`/api/analytics/student/${studentId}/recommendations`), { headers }).then((r) => r.json()),
        ]);
        if (metricsResp.success) setMetrics(metricsResp.data);
        if (recsResp.success) setRecommendations(recsResp.data);
      } catch (e) {
        console.error("Failed to load insights", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.student?.id]);

  if (loading) return <div className="text-slate-500">Loading your academic insights...</div>;
  if (!metrics) return <div className="text-slate-500">Unable to load insights</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Your Academic Insights</h1>
      <p className="mt-1 text-slate-500">AI-powered analysis of your performance and personalized recommendations.</p>

      {/* Performance Overview */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Attendance Rate</p>
          <p className="mt-2 text-2xl font-semibold text-green-600">{metrics.attendanceRate}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Assignment Completion</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{metrics.assignmentCompletionRate}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Average Exam Score</p>
          <p className="mt-2 text-2xl font-semibold text-purple-600">{metrics.averageExamScore}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Quiz Performance</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{metrics.quizScoreAverage}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Innovation Activities</p>
          <p className="mt-2 text-2xl font-semibold text-orange-600">{metrics.innovationActivityScore}</p>
        </div>
      </div>

      {/* Health Status */}
      <div className="mt-6 rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Academic Health</h2>
            <p className="mt-1 text-sm text-slate-500">Overall risk assessment</p>
          </div>
          <div
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              metrics.riskLevel === "HIGH"
                ? "bg-red-100 text-red-700"
                : metrics.riskLevel === "MEDIUM"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
            }`}
          >
            {metrics.riskLevel === "HIGH" ? "🔴 High Risk" : metrics.riskLevel === "MEDIUM" ? "🟡 Medium Risk" : "🟢 Low Risk"}
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-slate-900">Your Strengths</h3>
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
        <h3 className="font-semibold text-blue-900">AI Learning Insights</h3>
        <p className="mt-2 text-sm text-blue-800">{metrics.aiInsights}</p>
      </div>

      {/* Study Recommendations */}
      {recommendations && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h3 className="font-semibold text-slate-900">Personalized Study Plan</h3>
            <p className="mt-2 text-sm text-slate-700">{recommendations.studyPlan}</p>
          </div>

          {recommendations.recommendedSubjects.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-slate-900">Focus Areas</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendations.recommendedSubjects.map((subject) => (
                  <span key={subject} className="rounded-lg bg-amber-100 px-3 py-1 text-sm text-amber-700">
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recommendations.careerAlignmentHints.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-slate-900">Career Alignment</h3>
              <p className="mt-2 text-sm text-slate-600">Your favorite subjects:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendations.careerAlignmentHints.map((subject) => (
                  <span key={subject} className="rounded-lg bg-purple-100 px-3 py-1 text-sm text-purple-700">
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
