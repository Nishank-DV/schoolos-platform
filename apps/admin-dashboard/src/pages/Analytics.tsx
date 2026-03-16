import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type SchoolMetrics = {
  totalStudents: number;
  averageAttendance: number;
  averageScore: number;
  assignmentCompletionRate: number;
  innovationParticipationRate: number;
};

type Risk = {
  studentId: string;
  admissionNumber: string;
  name: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  metrics: {
    attendanceRate: number;
    assignmentCompletionRate: number;
    averageExamScore: number;
    quizScoreAverage: number;
    innovationActivityScore: number;
    strengths: string[];
    weaknesses: string[];
  };
};

type Gap = { studentId: string; studentName: string; subject: string; score: number };

type Tab = "overview" | "risks" | "gaps";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "School Overview" },
  { id: "risks", label: "At-Risk Students" },
  { id: "gaps", label: "Learning Gaps" },
];

function riskBadgeClass(level: string) {
  if (level === "HIGH") return "bg-red-100 text-red-700 border-red-200";
  if (level === "MEDIUM") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function riskBadgeLabel(level: string) {
  if (level === "HIGH") return "🔴 High Risk";
  if (level === "MEDIUM") return "🟡 Medium Risk";
  return "🟢 Low Risk";
}

export default function Analytics() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [schoolMetrics, setSchoolMetrics] = useState<SchoolMetrics | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [metricsResp, risksResp, gapsResp] = await Promise.all([
          apiGet<SchoolMetrics>("/api/analytics/school/overview"),
          apiGet<Risk[]>("/api/analytics/risks"),
          apiGet<Gap[]>("/api/analytics/learning-gaps"),
        ]);
        setSchoolMetrics(metricsResp);
        setRisks(Array.isArray(risksResp) ? risksResp : []);
        setGaps(Array.isArray(gapsResp) ? gapsResp : []);
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Failed to load analytics", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [addToast]);

  if (loading) return <div className="text-slate-500">Loading analytics...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Academic Analytics</h1>
      <p className="mt-1 text-slate-500">AI-powered insights into school performance and student progress.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm ${activeTab === tab.id ? "bg-primary-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && schoolMetrics && (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Total Students</p>
              <p className="mt-2 text-2xl font-semibold">{schoolMetrics.totalStudents}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Average Attendance</p>
              <p className="mt-2 text-2xl font-semibold text-green-600">{schoolMetrics.averageAttendance}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Average Score</p>
              <p className="mt-2 text-2xl font-semibold text-blue-600">{schoolMetrics.averageScore}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Assignment Completion</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">{schoolMetrics.assignmentCompletionRate}%</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Innovation Participation</p>
              <p className="mt-2 text-2xl font-semibold text-purple-600">{schoolMetrics.innovationParticipationRate}%</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-white p-6">
            <h2 className="font-semibold text-slate-900">Performance Insights</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {schoolMetrics.averageAttendance >= 90 ? (
                <p>✓ Strong attendance patterns across school</p>
              ) : (
                <p>⚠ Consider attendance monitoring initiatives</p>
              )}
              {schoolMetrics.averageScore >= 70 ? (
                <p>✓ Students performing above average</p>
              ) : (
                <p>⚠ Focus on subject-wise support programs</p>
              )}
              {schoolMetrics.innovationParticipationRate >= 30 ? (
                <p>✓ Good participation in innovation labs</p>
              ) : (
                <p>⚠ Encourage more students to join innovation activities</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "risks" && (
        <div className="mt-6">
          <div className="space-y-3">
            {risks.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                No students at risk. Great work!
              </div>
            ) : (
              risks.map((risk) => (
                <div key={risk.studentId} className={`rounded-lg border p-4 bg-white ${riskBadgeClass(risk.riskLevel)}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{risk.name}</p>
                      <p className="text-xs text-slate-500">{risk.admissionNumber}</p>
                    </div>
                    <p className="text-sm font-semibold">{riskBadgeLabel(risk.riskLevel)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div>
                      <p className="text-slate-500">Attendance</p>
                      <p className="font-semibold">{risk.metrics.attendanceRate}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Avg Score</p>
                      <p className="font-semibold">{risk.metrics.averageExamScore}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Assignments</p>
                      <p className="font-semibold">{risk.metrics.assignmentCompletionRate}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Weaknesses</p>
                      <p className="font-semibold">{risk.metrics.weaknesses.length}</p>
                    </div>
                  </div>
                  {risk.metrics.weaknesses.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      <strong>Issues:</strong> {risk.metrics.weaknesses.slice(0, 2).join(", ")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "gaps" && (
        <div className="mt-6 bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 font-medium border-b border-slate-200">Learning Gap Detection</div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Student</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Subject</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-600">Score %</th>
              </tr>
            </thead>
            <tbody>
              {gaps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No gaps detected
                  </td>
                </tr>
              ) : (
                gaps.map((g) => (
                  <tr key={`${g.studentId}-${g.subject}`} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium">{g.studentName}</td>
                    <td className="px-4 py-3 text-sm">{g.subject}</td>
                    <td className="px-4 py-3 text-sm text-amber-600">{g.score}%</td>
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
